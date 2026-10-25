const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../modules/module-bridge.js'), 'utf8');
const KEY = 'kf-map-host-v8';
const OWNER = `kfModuleStorageOwner:${KEY}`;
const CACHE = 'kfModuleCache:campaign-A:map';
const tick = () => new Promise(resolve => setImmediate(resolve));

async function harness({ entries = [], remote = { round: 8 }, offline = false, syncReply } = {}) {
  const storage = new Map([['kfActiveCampaign', 'campaign-A'], ...entries]);
  const events = {}, intervals = [], requests = [], appLoads = [];
  const context = vm.createContext({
    navigator: { onLine: !offline }, location: {}, Uint8Array,
    document: {
      body: {
        dataset: { kfModule: 'map', storageKey: KEY, originalApp: 'app.js' },
        querySelector() { return null; },
        append(node) { appLoads.push(JSON.parse(storage.get(KEY) || 'null')); node.onload(); },
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
    setInterval(callback) { intervals.push(callback); }, setTimeout() {}, CustomEvent: class {},
  });
  context.window = context;
  context.dispatchEvent = () => {};
  vm.runInContext(source, context); await tick(); await tick();
  return { context, storage, events, intervals, requests, appLoads };
}

test('reload replays unacknowledged local progress instead of overwriting it', async () => {
  const local = JSON.stringify({ round: 12 }), acknowledged = JSON.stringify({ round: 7 });
  const h = await harness({ entries: [[OWNER, 'campaign-A'], [KEY, local], [CACHE, JSON.stringify({ value: acknowledged, acknowledgedValue: acknowledged, revision: 4 })]] });
  assert.equal(h.appLoads[0].round, 12);
  const op = h.requests.flatMap(request => request.operations).find(operation => operation.path === 'modules.map');
  assert.equal(op.value.round, 12);
  assert.equal(op.baseRevision, 4);
  assert.equal(JSON.parse(h.storage.get(CACHE)).value, local);
  assert.ok(JSON.parse(h.storage.get(CACHE)).acknowledgedSignature);
  assert.equal(JSON.parse(h.storage.get(CACHE)).acknowledgedValue, undefined);
});

test('pagehide captures a save made after the polling tick', async () => {
  const h = await harness();
  h.storage.set(KEY, JSON.stringify({ round: 9 })); h.events.pagehide();
  const cache = JSON.parse(h.storage.get(CACHE));
  assert.equal(JSON.parse(cache.value).round, 9);
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
  const h = await harness({ entries: [[OWNER, 'campaign-B'], [KEY, JSON.stringify({ round: 99 })]] });
  assert.equal(h.appLoads[0].round, 8);
});

test('unowned legacy progress is retained separately when ownership cannot be inferred', async () => {
  const legacy = JSON.stringify({ round: 99 });
  const h = await harness({ entries: [[KEY, legacy]] });
  assert.equal(h.appLoads[0].round, 8);
  assert.equal(h.storage.get(`kfModuleLegacy:${KEY}`), legacy);
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
  assert.equal(JSON.parse(cache.value).round, 12);
  assert.ok(cache.acknowledgedSignature);
});
