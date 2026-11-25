const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

function aibpHarness() {
  const nodes = new Map(), storage = new Map();
  const makeNode = () => ({ innerHTML: '', textContent: '', hidden: false, value: '', dataset: {}, listeners: {},
    classList: { add() {}, remove() {}, toggle() {} }, style: { setProperty() {} },
    addEventListener(event, callback) { this.listeners[event] = callback; }, querySelectorAll() { return []; }, closest() { return this; }, click() { this.listeners.click?.(); },
  });
  const nodeFor = selector => { if (!nodes.has(selector)) nodes.set(selector, makeNode()); return nodes.get(selector); };
  const c = vm.createContext({ console, structuredClone, Date, Math, JSON, Blob,
    URL: { createObjectURL: () => '', revokeObjectURL() {} },
    document: { querySelector: nodeFor, querySelectorAll: () => [], createElement: makeNode },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    confirm: () => true, setTimeout() {}, clearTimeout() {},
  });
  c.window = c; c.KF_AIBP_TESTING = true; c.KF_CAMPAIGN_KINGDOM = 'sunken'; c.KF_CLASH_PHASE = 'full'; c.KF_CAMPAIGN_OPTIONS = { fivePlayer: true };
  for (const relative of ['data/monster-data.js', 'data/localized-traits.js', 'data/localized-sheets.js', 'data/level-config.js', 'data/mob-activation-config.js', 'data/boss-rule-config.js', 'data/conflict-setup-data.js', '../display/data/conflict-board-data.js', '../display/data/belly-board-data.js', 'kf-overlay.js', 'app.js']) {
    vm.runInContext(read('modules/aibp/' + relative), c, { filename: relative });
  }
  const api = c.KF_AIBP_TEST_API;
  return { c, api, nodes, battle: () => api.state().battle };
}

test('five-player signature has a completion control and no longer blocks mob generation', () => {
  const { api, nodes, battle } = aibpHarness();
  api.selectMonster('M_PalebloodWorms'); api.rebuild(); api.resolveAccursed('fail');
  assert.ok(battle().ruleState.ruleCard);
  assert.match(nodes.get('#app').innerHTML, /data-rule-action="complete-rule-card"/);
  api.completeRuleCard(); assert.equal(battle().ruleState.ruleCard, '');
  api.selectMob(battle().bpTrack.findIndex(slot => slot.id)); api.settleMob('defeat');
  assert.equal(battle().mobSpawn.pending.length, 1);
  api.completeMobAction(); assert.equal(battle().mobSpawn.pending.length, 0);
});

test('five-player direct attacks must resolve the active Accursed Persistence first', () => {
  const { api, battle } = aibpHarness();
  api.selectMonster('M_WingedNightmare'); api.rebuild();
  api.resolveWingedNightmareAttack(true);
  assert.equal(battle().singleWounds, 0); assert.equal(battle().accursed.side, 'active');
  api.resolveAccursed('wound'); api.resolveWingedNightmareAttack(true);
  assert.equal(battle().singleWounds, 1, 'the normal attack remains available after interception is resolved');
  api.selectMonster('M_PuppetKing'); api.rebuild();
  assert.equal(battle().monsterId, 'M_PuppetKing');
  const before = battle().ruleState.puppetKing.fallenKnightTokens;
  api.damagePuppetFallenKnight(); assert.equal(battle().ruleState.puppetKing.fallenKnightTokens, before);
});

test('White Ape monster rounds reactivate Accursed Persistence and block ordinary BP draws', () => {
  const { api, battle } = aibpHarness();
  api.selectMonster('M_WhiteApe'); api.rebuild();
  api.resolveAccursed('wound');
  assert.equal(battle().accursed.side, 'dormant');
  api.startWhiteApeRound();
  assert.equal(battle().accursed.side, 'active');
  assert.equal(battle().ruleState.pendingCoordinatedAttacks, 1);
  const deck = plain(battle().bpDeck);
  api.draw('bp');
  assert.equal(battle().activeBP, '');
  assert.deepEqual(plain(battle().bpDeck), deck, 'the intercepted attack must not draw thick skin');

  api.rebuild();
  api.setAccursedLastKnight(true);
  api.startWhiteApeRound();
  assert.equal(battle().accursed.side, 'dormant', 'the last surviving knight keeps the trait dormant');
});

test('Accursed Persistence AT includes every revealed doppelganger BP and excludes hidden ones', () => {
  const { api, battle } = aibpHarness();
  api.selectMonster('M_KnightFen'); battle().level = 3; api.rebuild();
  const doppel = battle().ruleState.doppelgangers[0];
  const cards = plain(doppel.cards);
  assert.equal(cards.length, 2);
  assert.deepEqual(plain(api.accursedRevealedBps()), []);
  api.resolveAccursed('wound');
  api.toggleDoppelgangerCards(doppel.id);
  api.flipAccursedForRound();
  assert.equal(battle().accursed.side, 'active');
  assert.deepEqual(plain(api.accursedRevealedBps()), cards);
  assert.doesNotMatch(api.renderAccursed(), /= 0（还没有已揭示的 BP）/);
  api.toggleDoppelgangerCards(doppel.id);
  assert.deepEqual(plain(api.accursedRevealedBps()), [], 'flipping the stack face down removes it from the revealed cards');
});

test('belly board reload preserves terrain, Fool cards, overlays and display settings', () => {
  const { api, battle } = aibpHarness();
  api.selectMonster('M_Stonemason'); api.rebuild();
  const raw = plain(api.state()); raw.encounters = {}; raw.battle.conflictType = 'belly_of_beast'; raw.battle.conflictLocation = '巨兽之腹';
  Object.assign(api.state(), api.validateState(raw));
  api.toggleConflictCoordinates(); battle().conflictBoard.showStarts = false;
  battle().conflictBoard.overlay = { los: true, path: true, sourceMode: 'boss', sourceCell: { row: 5, column: 5 }, targetCell: null, move: 3 };
  battle().conflictBoard.digestiveTrack.position = 3;
  if (battle().conflictBoard.terrain.length) battle().conflictBoard.terrain[0] = api.moveConflictTerrain(battle().conflictBoard.terrain[0], 5, 5);
  api.drawOrResetFoolCard(); api.commit();
  const before = plain(battle().conflictBoard);
  const after = api.validateState(plain(api.state())).battle.conflictBoard;
  assert.equal(after.showCoordinates, true); assert.equal(after.showStarts, false);
  assert.equal(after.digestiveTrack.position, 3);
  assert.deepEqual(plain(after.terrain), before.terrain);
  assert.deepEqual(plain(after.overlay), before.overlay);
  assert.deepEqual(plain(after.foolDeckOrder), before.foolDeckOrder);
  assert.equal(after.activeFoolCardId, before.activeFoolCardId);
  assert.deepEqual(plain(after.mobAssignments), before.mobAssignments);
});

function encounterHarness() {
  const nodes = new Map(), blobs = [], downloads = [], monsterButtons = [];
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '', hidden: false, addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, style: { setProperty() {} } });
    return nodes.get(id);
  };
  const c = vm.createContext({ window: { addEventListener() {} },
    document: { querySelector: node, querySelectorAll(selector) { return selector === '[data-monster]' ? monsterButtons : []; }, createElement() { return { click() { downloads.push(this.download); } }; } },
    localStorage: { getItem() { return null; }, setItem() {} }, console, Date, Math, Blob,
    URL: { createObjectURL(blob) { blobs.push(blob); return 'blob:test'; }, revokeObjectURL() {} }, URLSearchParams,
    location: { search: '?campaignId=test' }, navigator: { onLine: true }, setTimeout() {}, clearTimeout() {}, requestAnimationFrame() {},
  });
  for (const relative of ['data/encounter-data.js', 'encounter-catalog.js', 'encounter-view.js']) vm.runInContext(read('modules/encounter/' + relative), c);
  for (const monster of c.window.KF_ENCOUNTER_DATA.monsters.filter(item => !item.special).slice(0, 2)) {
    monsterButtons.push({ dataset: { monster: monster.id }, addEventListener(event, handler) { this[event] = handler; } });
  }
  c.window.KF_CAMPAIGN_PARTY = [{ id: 'sheet', name: 'Stoneface', knightId: 'stoneface', type: 'knight' }];
  c.window.KF_CAMPAIGN_OPTIONS = { leaderSheetId: 'sheet' };
  const source = read('modules/encounter/app.js');
  vm.runInContext(source.slice(0, source.lastIndexOf('  renderApp();')) + 'window.testApi={exportSave,importSave,blankState,state:()=>state};})();', c);
  return { c, nodes, blobs, downloads, monsterButtons, api: c.window.testApi };
}

test('encounter export downloads a valid save and legacy configs do not break import', async () => {
  const { api, blobs, downloads, nodes } = encounterHarness();
  api.exportSave(); assert.equal(downloads.length, 1);
  const saved = JSON.parse(await blobs[0].text());
  assert.equal(saved.app, 'KF Encounter Assistant'); assert.equal(saved.version, 1); assert.ok(saved.state);
  saved.state.scrapes = 7; saved.configs = { legacy: true };
  await api.importSave({ text: async () => JSON.stringify(saved) });
  assert.equal(api.state().scrapes, 7); assert.equal(nodes.get('#toast').textContent, '存档已导入');
});

test('switching encounter monsters resets the combat counters for the new monster', async () => {
  const { api, monsterButtons } = encounterHarness();
  const initial = { ...api.blankState(), scrapes: 3, phase: 'knight', criticalUsed: true,
    dragonRoarDone: true, pool: { opportunity: 2, break: 1 } };
  await api.importSave({ text: async () => JSON.stringify(initial) });
  const next = monsterButtons.find(button => button.dataset.monster !== initial.monsterId);
  next.click();
  assert.equal(api.state().monsterId, next.dataset.monster);
  assert.equal(api.state().phase, 'setup');
  assert.equal(api.state().scrapes, 0);
  assert.equal(api.state().criticalUsed, false);
  assert.equal(api.state().dragonRoarDone, false);
  assert.deepEqual(plain(api.state().pool), { opportunity: 0, break: 0 });
});

test('second-screen active BP follows the selected mob slot side', () => {
  const { c, nodes } = encounterHarness();
  for (const relative of ['modules/aibp/data/monster-data.js', 'modules/display/data/conflict-board-data.js']) vm.runInContext(read(relative), c);
  const source = read('modules/display/app.js');
  vm.runInContext(source.slice(0, source.indexOf('  const channel =')) + 'window.testDisplay={renderConflict};})();', c);
  const monster = c.window.KF_MONSTER_DATA.monsters.find(item => item.id === 'M_Pumpkinhead');
  const card = monster.cards.find(item => item.kind === 'BPS');
  const payload = { modules: { aibp: { monsterId: monster.id, level: 1, activeBP: card.id, bpTrack: [{ id: card.id, occupied: true, revealed: true, side: 'back' }], conflictBoard: { layoutId: 'stone:M_Pumpkinhead:all' } } }, presentation: { settings: {} } };
  const active = () => nodes.get('#displayRoot').innerHTML.match(/<figure class="public-card active-bp-card"[^]*?<\/figure>/)?.[0];
  c.window.testDisplay.renderConflict(payload); assert.ok(active().includes(card.image.back));
  payload.modules.aibp.bpTrack[0].side = 'face';
  c.window.testDisplay.renderConflict(payload); assert.ok(active().includes(card.image.face));
});

const saveFile = payload => ({ text: async () => JSON.stringify(payload) });

test('malformed encounter imports and rendering errors preserve the current and saved encounter', async () => {
  const { c, api, nodes } = encounterHarness();
  const writes = [];
  c.localStorage.setItem = (_key, value) => writes.push(JSON.parse(value));
  const valid = { ...api.blankState(), scrapes: 8 };
  await api.importSave(saveFile({ app: 'KF Encounter Assistant', version: 1, state: valid }));
  const before = plain(api.state());
  assert.equal(writes[0].scrapes, 8);
  for (const file of [
    { app: 'Another module', version: 1, state: valid },
    { ...valid, history: [{ monsterId: valid.monsterId }] },
    { ...valid, monsters: [null] }
  ]) {
    await api.importSave(saveFile(file));
    assert.match(nodes.get('#toast').textContent, /导入失败/);
    assert.deepEqual(plain(api.state()), before);
  }
  let failRender = true;
  Object.defineProperty(nodes.get('#app'), 'innerHTML', { set() {
    if (failRender) { failRender = false; throw new Error('render failed'); }
  } });
  await api.importSave(saveFile({ ...valid, scrapes: 1 }));
  assert.match(nodes.get('#toast').textContent, /render failed/);
  assert.deepEqual(plain(api.state()), before);
  assert.equal(writes.length, 1);
});

test('AI/BP import rejects incompatible and partial saves and preserves the original on storage failure', async () => {
  const { c, api, nodes } = aibpHarness();
  api.selectMonster('M_WhiteApe'); api.rebuild();
  const valid = plain(api.state());
  const writes = [];
  c.localStorage.setItem = (_key, value) => writes.push(JSON.parse(value));
  await api.importSave(saveFile(valid));
  assert.equal(writes[0].battle.monsterId, 'M_WhiteApe');
  const before = plain(api.state());
  for (const file of [
    { ...valid, version: 9 },
    { version: 10, battle: { monsterId: 'M_WhiteApe' } },
    { ...valid, encounters: { ...valid.encounters, M_PuppetKing: { battle: { aiDeck: [] } } } },
  ]) {
    await api.importSave(saveFile(file));
    assert.match(nodes.get('#toast').textContent, /导入失败/);
    assert.deepEqual(plain(api.state()), before);
  }
  assert.equal(writes.length, 1);
  c.localStorage.setItem = () => { throw new Error('storage full'); };
  await api.importSave(saveFile(valid));
  assert.match(nodes.get('#toast').textContent, /storage full/);
  assert.deepEqual(plain(api.state()), before);
});
