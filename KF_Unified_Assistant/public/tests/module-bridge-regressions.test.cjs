const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../modules/module-bridge.js'), 'utf8');
const LEGACY_KEY = 'kf-map-host-v8';
const workingKey = campaign => `kfModuleState:${campaign}:${LEGACY_KEY}`;
const KEY = workingKey('campaign-A');
const OWNER = `kfModuleStorageOwner:${LEGACY_KEY}`;
const CACHE = 'kfModuleCache:campaign-A:map';
const tick = () => new Promise(resolve => setImmediate(resolve));

async function harness({ entries = [], remote = { round: 8 }, offline = false, syncReply, sharedStorage, pagePath = '/modules/map/' } = {}) {
  const storage = sharedStorage || new Map([['kfActiveCampaign', 'campaign-A'], ...entries]);
  const location = new URL(pagePath, 'http://example.test');
  const events = {}, intervals = [], requests = [], appLoads = [], timers = [], stateEvents = [];
  const context = vm.createContext({
    navigator: { onLine: !offline }, location, Uint8Array, URL, URLSearchParams,
    history: { replaceState(_, __, url) { location.href = new URL(url, location).href; } },
    document: {
      body: {
        dataset: { kfModule: 'map', storageKey: LEGACY_KEY, originalApp: 'app.js' },
        querySelector() { return null; },
        append(node) { appLoads.push(JSON.parse(storage.get(context.KF_MODULE_BOOTSTRAP.storageKey) || 'null')); node.onload(); },
      },
      createElement() { return {}; }, addEventListener(name, callback) { events[name] = callback; },
    },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    fetch: async (url, options) => {
      if (!context.navigator.onLine) throw new Error('offline');
      let data;
      if (url.includes('campaign-sync')) {
        const body = JSON.parse(options.body); requests.push(body);
        data = syncReply ? syncReply(body) : { revision: 11, state: { modules: { map: remote } } };
      } else if (url.includes('auth')) data = { user: { id: 'user-A' } };
      else if (url.includes('sheets')) data = { sheets: [] };
      else data = { campaign: { revision: 10, name: 'A', state: { modules: { map: remote } } } };
      return { ok: true, json: async () => data };
    },
    addEventListener(name, callback) { events[name] = callback; },
    setInterval(callback) { intervals.push(callback); }, setTimeout(callback) { timers.push(callback); },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
  });
  context.window = context;
  context.dispatchEvent = event => stateEvents.push(event);
  vm.runInContext(source, context); await tick(); await tick();
  return { context, storage, events, intervals, requests, appLoads, timers, stateEvents };
}

test('reload replays unacknowledged local progress instead of overwriting it', async () => {
  const local = JSON.stringify({ round: 12 }), acknowledged = JSON.stringify({ round: 7 });
  const h = await harness({ entries: [[OWNER, 'campaign-A'], [LEGACY_KEY, local], [CACHE, JSON.stringify({ value: acknowledged, acknowledgedValue: acknowledged, revision: 4 })]] });
  assert.equal(h.appLoads[0].round, 12);
  const op = h.requests.flatMap(request => request.operations).find(operation => operation.path === 'modules.map');
  assert.equal(op.value.round, 12);
  assert.equal(op.baseRevision, 4);
  assert.equal(h.storage.get(KEY), local);
  assert.equal(JSON.parse(h.storage.get(CACHE)).value, undefined, 'only the scoped working key stores the snapshot');
  assert.ok(JSON.parse(h.storage.get(CACHE)).acknowledgedSignature);
  assert.equal(JSON.parse(h.storage.get(CACHE)).acknowledgedValue, undefined);
});

test('pagehide captures a save made after the polling tick', async () => {
  const h = await harness();
  h.storage.set(KEY, JSON.stringify({ round: 9 })); h.events.pagehide();
  const cache = JSON.parse(h.storage.get(CACHE));
  assert.equal(JSON.parse(h.storage.get(KEY)).round, 9);
  assert.ok(cache.acknowledgedSignature);
  const reloaded = await harness({ entries: [...h.storage.entries()] });
  assert.equal(reloaded.appLoads[0].round, 9);
});

test('an offline boot keeps watching changes after reconnection', async () => {
  const initial = JSON.stringify({ round: 9 });
  const h = await harness({ offline: true, entries: [[CACHE, JSON.stringify({ value: initial, acknowledgedValue: JSON.stringify({ round: 8 }), revision: 4 })]] });
  assert.equal(h.appLoads[0].round, 9);
  assert.equal(h.context.KF_MODULE_BOOTSTRAP.offline, true);
  h.context.navigator.onLine = true; h.events.online(); await tick();
  h.storage.set(KEY, JSON.stringify({ round: 10 })); h.intervals[0](); await tick();
  assert.ok(h.requests.flatMap(request => request.operations).some(op => op.path === 'modules.map' && op.value.round === 10));
});

test('a different campaign working copy is never loaded as the selected campaign', async () => {
  const h = await harness({ entries: [[OWNER, 'campaign-B'], [LEGACY_KEY, JSON.stringify({ round: 99 })]] });
  assert.equal(h.appLoads[0].round, 8);
});

test('unowned legacy progress is retained separately when ownership cannot be inferred', async () => {
  const legacy = JSON.stringify({ round: 99 });
  const h = await harness({ entries: [[LEGACY_KEY, legacy]] });
  assert.equal(h.appLoads[0].round, 8);
  assert.equal(h.storage.get(`kfModuleLegacy:${LEGACY_KEY}`), legacy);
});

test('two campaign pages keep distinct working copies and keep their campaign on navigation and reload', async () => {
  const a = await harness();
  a.storage.set('kfActiveCampaign', 'campaign-B');
  const b = await harness({ sharedStorage: a.storage, remote: { round: 21 } });
  a.storage.set(a.context.KF_MODULE_BOOTSTRAP.storageKey, JSON.stringify({ round: 9 }));
  b.storage.set(b.context.KF_MODULE_BOOTSTRAP.storageKey, JSON.stringify({ round: 22 }));
  a.intervals[0](); b.intervals[0](); await tick();
  for (const [page, campaign, round] of [[a, 'campaign-A', 9], [b, 'campaign-B', 22]]) {
    const operations = page.requests.flatMap(request => request.operations.filter(op => op.path === 'modules.map')
      .map(op => [request.campaignId, op.value.round]));
    assert.deepEqual(operations, [[campaign, round]]);
    assert.equal(page.context.location.searchParams.get('campaignId'), campaign);
    assert.equal(page.context.KF_MODULE_BRIDGE.campaignUrl('/modules/aibp/?foo=bar#board'), `/modules/aibp/?foo=bar&campaignId=${campaign}#board`);
  }
  a.storage.set(LEGACY_KEY, JSON.stringify({ round: 99 }));
  const reloadA = await harness({ sharedStorage: a.storage, remote: { round: 9 }, pagePath: a.context.location.pathname + a.context.location.search });
  assert.equal(reloadA.appLoads[0].round, 9);
  assert.equal(reloadA.context.KF_MODULE_BOOTSTRAP.campaignId, 'campaign-A');
  assert.equal(JSON.parse(a.storage.get(workingKey('campaign-B'))).round, 22);
});

test('an older acknowledgement does not mark a newer local edit as synced', async () => {
  let acknowledge;
  const local = JSON.stringify({ round: 9 });
  const h = await harness({ entries: [[CACHE, JSON.stringify({ value: local, acknowledgedValue: '', revision: 1 })]], syncReply: () => new Promise(resolve => { acknowledge = resolve; }) });
  h.storage.set(KEY, JSON.stringify({ round: 10 })); h.intervals[0]();
  acknowledge({ revision: 12, state: { modules: { map: { round: 9 } } } }); await tick();
  const reloaded = await harness({ entries: [...h.storage.entries()] });
  assert.equal(reloaded.appLoads[0].round, 10);
  assert.ok(reloaded.requests.flatMap(request => request.operations).some(op => op.path === 'modules.map' && op.value.round === 10));
});

test('a server conflict still preserves the higher authoritative map round', async () => {
  const local = JSON.stringify({ round: 6 });
  const h = await harness({ entries: [[CACHE, JSON.stringify({ value: local, acknowledgedValue: '', revision: 1 })]], remote: { round: 12 }, syncReply: () => ({ revision: 15, conflicts: [{ path: 'modules.map', resolution: 'existing' }], state: { modules: { map: { round: 12 } } } }) });
  assert.equal(JSON.parse(h.storage.get(KEY)).round, 12);
  const cache = JSON.parse(h.storage.get(CACHE));
  assert.equal(JSON.parse(h.storage.get(KEY)).round, 12);
  assert.ok(cache.acknowledgedSignature);
});

for (const polled of [false, true]) {
  test(`a conflict for an older map snapshot preserves newer edits ${polled ? 'already queued' : 'made after the last poll'}`, async () => {
    let acknowledge;
    const local = JSON.stringify({ round: 6 });
    const h = await harness({
      entries: [[CACHE, JSON.stringify({ value: local, acknowledgedValue: '', revision: 1 })]],
      remote: { round: 12 },
      syncReply: () => new Promise(resolve => { acknowledge = resolve; }),
    });
    h.storage.set(KEY, JSON.stringify({ round: 13 }));
    if (polled) h.intervals[0]();
    acknowledge({ revision: 15, conflicts: [{ path: 'modules.map', resolution: 'existing' }], state: { modules: { map: { round: 12 } } } });
    await tick();
    assert.equal(JSON.parse(h.storage.get(KEY)).round, 13);
    assert.equal(h.stateEvents.filter(event => event.type === 'kf:module-state').length, 0, 'an old verdict cannot reset live module state');
    h.timers.shift()(); await tick();
    const retry = h.requests[1].operations.find(operation => operation.path === 'modules.map');
    assert.equal(retry.value.round, 13); assert.equal(retry.baseRevision, 1);
    acknowledge({ revision: 16, state: { modules: { map: { round: 13 } } } }); await tick();
    const reloaded = await harness({ entries: [...h.storage.entries()], remote: { round: 13 } });
    assert.equal(reloaded.appLoads[0].round, 13);
    assert.equal(reloaded.requests.flatMap(request => request.operations).some(operation => operation.path === 'modules.map'), false, 'the accepted newer snapshot is acknowledged');
  });
}

test('later polls and a reload retain the conflict base until the new snapshot is arbitrated', async () => {
  let acknowledge;
  const local = JSON.stringify({ round: 6 });
  const h = await harness({
    entries: [[CACHE, JSON.stringify({ value: local, acknowledgedValue: '', revision: 1 })]], remote: { round: 12 },
    syncReply: () => new Promise(resolve => { acknowledge = resolve; }),
  });
  h.storage.set(KEY, JSON.stringify({ round: 7 }));
  acknowledge({ revision: 15, conflicts: [{ path: 'modules.map', resolution: 'existing' }], state: { modules: { map: { round: 12 } } } }); await tick();
  h.storage.set(KEY, JSON.stringify({ round: 8 })); h.intervals[0](); await tick();
  const retry = h.requests[1].operations.find(operation => operation.path === 'modules.map');
  assert.equal(retry.value.round, 8); assert.equal(retry.baseRevision, 1, 'a poll must not rebase the rejected lower round onto the server revision');
  const entries = [...h.storage.entries()];
  acknowledge({ revision: 16, conflicts: [{ path: 'modules.map', resolution: 'existing' }], state: { modules: { map: { round: 12 } } } }); await tick();
  assert.equal(JSON.parse(h.storage.get(KEY)).round, 12, 'an unchanged lower-round snapshot still yields to the server');
  const reloaded = await harness({ entries, remote: { round: 12 } });
  const replay = reloaded.requests.flatMap(request => request.operations).find(operation => operation.path === 'modules.map');
  assert.equal(replay.value.round, 8); assert.equal(replay.baseRevision, 1, 'a reload must also preserve the old conflict base');
});

test('a merged clue response hydrates the map and the next sync keeps its canonical value', async () => {
  const local = { round: 9, knights: [{ sheetId: 'squire:bartos', clues: { martial: 0 } }] };
  const merged = { round: 9, knights: [{ sheetId: 'squire:bartos', clues: { martial: 2 } }] };
  let sent = false;
  const h = await harness({
    entries: [[CACHE, JSON.stringify({ value: JSON.stringify(local), acknowledgedValue: '', revision: 4 })]],
    syncReply: body => {
      const map = body.operations.find(op => op.path === 'modules.map');
      if (!map) return { revision: 25, state: { modules: { map: merged } } };
      if (sent) return { revision: 26, state: { modules: { map: map.value } } };
      sent = true;
      return { revision: 20, conflicts: [{ path: 'modules.map', resolution: 'merged' }], state: { modules: { map: merged } } };
    },
  });
  assert.deepEqual(JSON.parse(h.storage.get(KEY)), merged);
  assert.equal(h.stateEvents.find(event => event.type === 'kf:module-state').detail.knights[0].clues.martial, 2);
  const flushed = h.context.KF_MODULE_BRIDGE.flush();
  await tick();
  for (const timer of h.timers.splice(0)) timer();
  await flushed;
  h.events.online(); await tick();
  const mapOperations = () => h.requests.flatMap(request => request.operations).filter(op => op.path === 'modules.map');
  assert.equal(mapOperations().length, 1, 'clean snapshots are not resubmitted on navigation or reconnect');
  h.storage.set(KEY, JSON.stringify({ ...merged, round: 10 })); h.intervals[0](); await tick();
  assert.equal(mapOperations().at(-1).baseRevision, 20, 'module edits use the last acknowledged snapshot, not the newer presentation revision');
  assert.equal(mapOperations().at(-1).value.knights[0].clues.martial, 2);
});
