const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = relative => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
const source = read('modules/module-bridge.js');
const KEY = 'kf-aibp-assistant-v1';
const handoffKey = name => `${name}:A`;
const tick = () => new Promise(resolve => setImmediate(resolve));
const plain = value => JSON.parse(JSON.stringify(value));
const normal = extra => ({ id: 'normal', campaignId: 'A', monster: 'Normal boss', level: 2, createdAt: 20, ...extra });
const rogue = extra => ({ id: 'rogue', campaignId: 'A', roguePath: true, slotId: 'slot-A', nodeId: 'node-A', monsterId: 'old', monster: 'Rogue boss', level: 1, createdAt: 10, rogueRoster: [{ id: 'rogue-knight', type: 'knight' }], ...extra });

async function bridgeHarness(entries, { search = '', roguePath = null } = {}) {
  const storage = new Map([['kfActiveCampaign', 'A'], ['kf-rogue-path-active-slot-v1:A', 'slot-A'], ...entries]);
  const setups = [];
  let loadedBattle;
  const c = vm.createContext({
    navigator: { onLine: true }, location: { search }, URLSearchParams, Uint8Array,
    document: {
      body: {
        dataset: { kfModule: 'aibp', storageKey: KEY, originalApp: 'app.js' }, querySelector() { return null; },
        append(node) {
          const key = c.KF_MODULE_BOOTSTRAP.storageKey;
          loadedBattle = JSON.parse(storage.get(key) || 'null');
          node.onload();
        },
      },
      querySelector() { return {}; }, createElement() { return {}; }, addEventListener() {},
    },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    fetch: async url => ({ ok: true, json: async () => {
      if (url.includes('auth')) return { user: { id: 'user-A' } };
      if (url.includes('sheets')) return { sheets: [{ id: 'sheet-A', title: 'Campaign knight', state: { knightId: 'stoneface' } }] };
      if (url.includes('campaign-sync')) return { revision: 11 };
      return { campaign: { revision: 10, name: 'A', state: { party: ['sheet-A'], modules: { aibp: { saved: true }, roguePath } } } };
    } }),
    addEventListener() {}, setInterval() {}, setTimeout() {},
    Event: class {}, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
  });
  c.window = c;
  c.dispatchEvent = () => {};
  c.KF_AIBP_HANDOFF = handoff => { setups.push(plain(handoff)); return true; };
  vm.runInContext(source, c); await tick(); await tick();
  return { c, storage, setups, loadedBattle };
}

test('a new normal conflict wins over a consumed rogue handoff and keeps the campaign roster after reload', async () => {
  const h = await bridgeHarness([
    ['kfRogueHandoff', JSON.stringify(rogue({ appliedAibp: true }))],
    ['kfEncounterHandoff', JSON.stringify(normal())],
  ]);
  assert.deepEqual(h.setups.map(setup => setup.id), ['normal']);
  assert.deepEqual(h.loadedBattle, { saved: true });
  assert.equal(h.c.KF_CAMPAIGN_KNIGHTS[0].id, 'sheet-A');
  assert.equal(h.c.KF_CAMPAIGN_PARTY.some(member => member.id === 'rogue-knight'), false);
  assert.equal(JSON.parse(h.storage.get(handoffKey('kfEncounterHandoff'))).appliedAibp, true);
  assert.equal(h.storage.has('kfEncounterHandoff'), false);
  const reloaded = await bridgeHarness([...h.storage.entries()]);
  assert.deepEqual(reloaded.setups, []);
  assert.equal(reloaded.c.KF_CAMPAIGN_KNIGHTS[0].id, 'sheet-A');
});

test('a newer rogue request uses the rogue roster instead of an older ordinary handoff', async () => {
  const h = await bridgeHarness([
    ['kfRogueHandoff', JSON.stringify(rogue({ createdAt: 30 }))],
    ['kfEncounterHandoff', JSON.stringify(normal({ appliedAibp: true }))],
  ]);
  assert.deepEqual(h.setups.map(setup => setup.id), ['rogue']);
  assert.deepEqual(h.setups[0].rogueRoster, rogue().rogueRoster);
  assert.equal(h.c.KF_CAMPAIGN_KNIGHTS[0].id, 'sheet-A');
  const reloaded = await bridgeHarness([...h.storage.entries()]);
  assert.deepEqual(reloaded.setups, []);
  assert.equal(reloaded.c.KF_CAMPAIGN_KNIGHTS[0].id, 'sheet-A');
});

test('postgame handoffs use the stable monster ID and preserve the full level and stage', async () => {
  const request = rogue({ monster: 'old translated name', level: 9, stage: 'withergraal', postgame: true });
  const h = await bridgeHarness([['kfRogueHandoff', JSON.stringify(request)]]);
  assert.equal(h.setups[0].monsterId, 'old');
  assert.equal(h.setups[0].level, 9);
  const applied = JSON.parse(h.storage.get(handoffKey('kfRogueHandoff')));
  assert.equal(applied.stage, 'withergraal');
  assert.equal(applied.postgame, true);
  assert.equal(applied.level, 9);
  assert.equal(h.setups[0].stage, 'withergraal');
});

test('the newest of two pending sources is selected consistently for both battle and roster', async () => {
  for (const rogueIsNewer of [false, true]) {
    const h = await bridgeHarness([
      ['kfRogueHandoff', JSON.stringify(rogue({ createdAt: rogueIsNewer ? 30 : 10 }))],
      ['kfEncounterHandoff', JSON.stringify(normal())],
    ]);
    assert.deepEqual(h.setups.map(setup => setup.id), [rogueIsNewer ? 'rogue' : 'normal']);
    assert.equal(h.c.KF_CAMPAIGN_KNIGHTS[0].id, 'sheet-A');
  }
});

test('legacy consumed rogue requests and malformed records cannot hide a fresh normal battle', async () => {
  for (const stale of [JSON.stringify(rogue({ createdAt: undefined, appliedAibp: true })), '{invalid']) {
    const h = await bridgeHarness([
      ['kfRogueHandoff', stale], ['kfEncounterHandoff', JSON.stringify(normal({ createdAt: undefined }))],
    ]);
    assert.deepEqual(h.setups.map(setup => setup.id), ['normal']);
    assert.equal(h.c.KF_CAMPAIGN_KNIGHTS[0].id, 'sheet-A');
  }
});

test('handoffs belonging to another campaign or rogue slot cannot override the current battle', async () => {
  for (const unrelated of [rogue({ campaignId: 'B', createdAt: 100 }), rogue({ slotId: 'slot-B', createdAt: 100 })]) {
    const h = await bridgeHarness([
      ['kfRogueHandoff', JSON.stringify(unrelated)], ['kfEncounterHandoff', JSON.stringify(normal())],
    ]);
    assert.deepEqual(h.setups.map(setup => setup.id), ['normal']);
    assert.equal(h.c.KF_CAMPAIGN_KNIGHTS[0].id, 'sheet-A');
  }
});

test('only an exact explicit request resumes a Rogue battle saved by another device', async () => {
  const pendingBattle = { handoffId: 'remote-request', monsterId: 'old', level: 9 };
  const roster = [
    { id: 'living', knightId: 'stoneface', name: 'Rogue knight', alive: true },
    { id: 'dead', knightId: 'kara', name: 'Fallen knight', alive: false }
  ];
  const roguePath = { campaignId: 'A', slots: [{ id: 'remote-slot', state: { pendingBattle, roster, stage: 'withergraal' } }] };
  for (const search of ['', '?rogueSlot=other-slot&rogueBattle=remote-request', '?rogueSlot=remote-slot&rogueBattle=old-request']) {
    const ordinary = await bridgeHarness([], { search, roguePath });
    assert.deepEqual(ordinary.setups, []);
    assert.deepEqual(ordinary.loadedBattle, { saved: true });
  }
  const resumed = await bridgeHarness([], { search: '?rogueSlot=remote-slot&rogueBattle=remote-request', roguePath });
  assert.equal(resumed.setups[0].level, 9);
  assert.equal(resumed.setups[0].slotId, 'remote-slot');
  assert.equal(resumed.setups[0].stage, 'withergraal');
  assert.deepEqual(resumed.setups[0].rogueRoster.map(member => member.id), ['living']);
  assert.equal(resumed.c.KF_CAMPAIGN_KNIGHTS[0].id, 'sheet-A');
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
    HANDOFF_KEY: 'kfRogueHandoff',
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
