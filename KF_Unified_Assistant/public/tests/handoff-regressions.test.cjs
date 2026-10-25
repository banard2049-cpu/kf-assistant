const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = relative => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
const source = read('modules/module-bridge.js');
const KEY = 'kf-aibp-assistant-v1';
const tick = () => new Promise(resolve => setImmediate(resolve));
const plain = value => JSON.parse(JSON.stringify(value));
const normal = extra => ({ id: 'normal', campaignId: 'A', monster: 'Normal boss', level: 2, createdAt: 20, ...extra });
const rogue = extra => ({ id: 'rogue', campaignId: 'A', roguePath: true, slotId: 'slot-A', nodeId: 'node-A', monsterId: 'old', monster: 'Rogue boss', level: 1, createdAt: 10, rogueRoster: [{ id: 'rogue-knight', type: 'knight' }], ...extra });

async function bridgeHarness(entries) {
  const storage = new Map([['kfActiveCampaign', 'A'], ['kf-rogue-path-active-slot-v1:A', 'slot-A'], ...entries]);
  const setups = [], events = [], inputs = new Map();let selected = '';
  const control = selector => {
    if (!inputs.has(selector)) inputs.set(selector, {
      value: '', dispatchEvent() {},
      click() {
        if (selector.startsWith('[data-monster=')) selected = selector;
        if (selector === '#setupBattle') {
          setups.push(selected);
          storage.set(KEY, JSON.stringify({ selected }));
        }
      },
    });
    return inputs.get(selector);
  };
  const c = vm.createContext({
    navigator: { onLine: true }, location: {}, Uint8Array,
    document: {
      body: {
        dataset: { kfModule: 'aibp', storageKey: KEY, originalApp: 'app.js' }, querySelector() { return null; },
        append(node) { if (!storage.has(KEY)) storage.set(KEY, '{}'); node.onload(); },
      },
      querySelector: control, createElement() { return {}; }, addEventListener() {},
    },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    fetch: async url => ({ ok: true, json: async () => {
      if (url.includes('auth')) return { user: { id: 'user-A' } };
      if (url.includes('sheets')) return { sheets: [{ id: 'sheet-A', title: 'Campaign knight', state: { knightId: 'stoneface' } }] };
      if (url.includes('campaign-sync')) return { revision: 11 };
      return { campaign: { revision: 10, name: 'A', state: { party: ['sheet-A'], modules: { aibp: { saved: true } } } } };
    } }),
    addEventListener() {}, setInterval() {}, setTimeout() {},
    Event: class {}, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
  });
  c.window = c;
  c.dispatchEvent = event => events.push(event);
  c.KF_MONSTER_DATA = { monsters: [{ id: 'old', name: 'Rogue boss' }, { id: 'new', name: 'Normal boss' }] };
  vm.runInContext(source, c); await tick(); await tick();
  return { c, storage, setups, events };
}

test('a new normal conflict wins over a consumed rogue handoff and keeps the campaign roster after reload', async () => {
  const h = await bridgeHarness([
    ['kfRogueHandoff', JSON.stringify(rogue({ appliedAibp: true }))],
    ['kfEncounterHandoff', JSON.stringify(normal())],
  ]);
  assert.deepEqual(h.setups, ['[data-monster="new"]']);
  assert.equal(h.c.KF_CAMPAIGN_KNIGHTS[0].id, 'sheet-A');
  assert.equal(h.c.KF_CAMPAIGN_PARTY.some(member => member.id === 'rogue-knight'), false);
  assert.equal(JSON.parse(h.storage.get('kfEncounterHandoff')).appliedAibp, true);
  assert.equal(h.events.find(event => event.type === 'kf:aibp-handoff').detail.id, 'normal');
  const reloaded = await bridgeHarness([...h.storage.entries()]);
  assert.deepEqual(reloaded.setups, []);
  assert.equal(reloaded.c.KF_CAMPAIGN_KNIGHTS[0].id, 'sheet-A');
});

test('a newer rogue request uses the rogue roster instead of an older ordinary handoff', async () => {
  const h = await bridgeHarness([
    ['kfRogueHandoff', JSON.stringify(rogue({ createdAt: 30 }))],
    ['kfEncounterHandoff', JSON.stringify(normal({ appliedAibp: true }))],
  ]);
  assert.deepEqual(h.setups, ['[data-monster="old"]']);
  assert.deepEqual(plain(h.c.KF_CAMPAIGN_PARTY), rogue().rogueRoster);
  const reloaded = await bridgeHarness([...h.storage.entries()]);
  assert.deepEqual(reloaded.setups, []);
  assert.deepEqual(plain(reloaded.c.KF_CAMPAIGN_PARTY), rogue().rogueRoster);
});

test('the newest of two pending sources is selected consistently for both battle and roster', async () => {
  for (const rogueIsNewer of [false, true]) {
    const h = await bridgeHarness([
      ['kfRogueHandoff', JSON.stringify(rogue({ createdAt: rogueIsNewer ? 30 : 10 }))],
      ['kfEncounterHandoff', JSON.stringify(normal())],
    ]);
    assert.deepEqual(h.setups, [`[data-monster="${rogueIsNewer ? 'old' : 'new'}"]`]);
    assert.equal(h.c.KF_CAMPAIGN_KNIGHTS[0].id, rogueIsNewer ? 'rogue-knight' : 'sheet-A');
  }
});

test('legacy consumed rogue requests and malformed records cannot hide a fresh normal battle', async () => {
  for (const stale of [JSON.stringify(rogue({ createdAt: undefined, appliedAibp: true })), '{invalid']) {
    const h = await bridgeHarness([
      ['kfRogueHandoff', stale], ['kfEncounterHandoff', JSON.stringify(normal({ createdAt: undefined }))],
    ]);
    assert.deepEqual(h.setups, ['[data-monster="new"]']);
    assert.equal(h.c.KF_CAMPAIGN_KNIGHTS[0].id, 'sheet-A');
  }
});

test('handoffs belonging to another campaign or rogue slot cannot override the current battle', async () => {
  for (const unrelated of [rogue({ campaignId: 'B', createdAt: 100 }), rogue({ slotId: 'slot-B', createdAt: 100 })]) {
    const h = await bridgeHarness([
      ['kfRogueHandoff', JSON.stringify(unrelated)], ['kfEncounterHandoff', JSON.stringify(normal())],
    ]);
    assert.deepEqual(h.setups, ['[data-monster="new"]']);
    assert.equal(h.c.KF_CAMPAIGN_KNIGHTS[0].id, 'sheet-A');
  }
});

function resolutionHarness(handoff, { duplicateLegacy = false, legacy = false } = {}) {
  const storage = new Map([['kfRogueHandoff', JSON.stringify(handoff)]]);
  const node = { id: 'node-A', resurrection: 1, cleared: false };
  const pending = { nodeId: 'node-A', monsterId: 'old', monster: 'Rogue boss', level: 1, ...(legacy ? {} : { handoffId: 'rogue' }) };
  const state = { pendingBattle: pending, currentNodeId: node.id, roster: [], sharedRevives: 1, rewards: [], history: [], status: 'active' };
  const finalized = [];
  const c = vm.createContext({
    localStorage: { getItem: key => storage.get(key) ?? null, removeItem: key => storage.delete(key) },
    state, slots: [{ id: 'slot-A', state }, ...(duplicateLegacy ? [{ id: 'slot-B', state: plain(state) }] : [])], activeSlotId: 'slot-A',
    campaignId: () => 'A', nodeById: () => node, selectedNodeId: null,
    document: { querySelectorAll: () => [] }, save() {}, render() {}, rewardChoiceOptions: () => null,
    finalizeVictory: value => finalized.push(value),
  });
  const rogueSource = read('modules/rogue/app.js');
  vm.runInContext(rogueSource.slice(rogueSource.indexOf('  function clearBattleHandoff('), rogueSource.indexOf('  function render() {')), c);
  return { c, storage, state, finalized };
}

test('rogue victory and defeat clear only the handoff belonging to the resolved battle', () => {
  for (const result of ['victory', 'defeat']) {
    const h = resolutionHarness(rogue()); h.c.resolve(result);
    assert.equal(h.storage.has('kfRogueHandoff'), false);
    assert.equal(h.state.pendingBattle, null);
    if (result === 'victory') assert.equal(h.finalized.length, 1);
  }
  for (const unrelated of [rogue({ campaignId: 'B' }), rogue({ slotId: 'slot-B' }), rogue({ id: 'newer-request' })]) {
    const h = resolutionHarness(unrelated); h.c.resolve('defeat');
    assert.deepEqual(JSON.parse(h.storage.get('kfRogueHandoff')), unrelated);
  }
});

test('legacy rogue cleanup requires an unambiguous matching local slot', () => {
  const legacy = rogue({ id: undefined, slotId: undefined });
  const matched = resolutionHarness(legacy, { legacy: true }); matched.c.resolve('defeat');
  assert.equal(matched.storage.has('kfRogueHandoff'), false);
  const ambiguous = resolutionHarness(legacy, { legacy: true, duplicateLegacy: true }); ambiguous.c.resolve('defeat');
  assert.equal(ambiguous.storage.has('kfRogueHandoff'), true);
});
