const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const nodes = new Map();
const makeNode = () => ({
  innerHTML: "",
  textContent: "",
  hidden: false,
  value: "",
  dataset: {},
  listeners: {},
  classList: { add() {}, remove() {}, toggle() {} },
  addEventListener(event, callback) { this.listeners[event] = callback; },
  querySelectorAll() { return []; },
  closest() { return this; },
  click() { this.listeners.click?.(); },
});
const nodeFor = selector => {
  if (!nodes.has(selector)) nodes.set(selector, makeNode());
  return nodes.get(selector);
};
const storage = new Map();
const context = vm.createContext({
  console,
  structuredClone,
  Date,
  Math,
  JSON,
  Blob,
  URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} },
  document: {
    querySelector: nodeFor,
    querySelectorAll: () => [],
    createElement: makeNode,
  },
  localStorage: {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
  },
  confirm: () => true,
  setTimeout: (callback, delay) => {
    const timer = setTimeout(callback, delay);
    timer.unref();
    return timer;
  },
  clearTimeout,
});
context.window = context;
context.window.KF_AIBP_TESTING = true;
context.window.KF_CAMPAIGN_KINGDOM = "sunken";
context.window.KF_CLASH_PHASE = "full";

for (const relative of [
  "data/monster-data.js",
  "data/localized-traits.js",
  "data/localized-sheets.js",
  "data/level-config.js",
  "data/mob-activation-config.js",
  "data/boss-rule-config.js",
  "data/conflict-setup-data.js",
  "../display/data/conflict-board-data.js",
  "app.js",
]) {
  vm.runInContext(fs.readFileSync(path.join(root, relative), "utf8"), context, { filename: relative });
}

const api = context.window.KF_AIBP_TEST_API;
const state = () => api.state().battle;
const rebuild = (phase, level = state().level) => {
  state().clashPhase = phase;
  state().level = level;
  api.rebuild();
};



const monster = () => context.window.KF_MONSTER_DATA.monsters.find(item => item.id === state().monsterId);
const rankOf = id => Number(monster().cards.find(card => card.id === id)?.kind.match(/^BP([123])$/)?.[1] || 0);
const occupied = () => state().bpTrack.filter(slot => slot.id).length;
const plain = value => JSON.parse(JSON.stringify(value));
const cardsAndWounds = () => JSON.stringify([state().aiDeck, state().aiDiscard, state().aiRemoved,
  state().bpDamage, state().singleWounds, state().doubleWounds]);
function prepare(id, rank = 0, level = 1) {
  api.selectMonster(id);
  rebuild("full", level);
  if (!rank) return 0;
  const existing = state().bpTrack.findIndex(slot => rankOf(slot.id) === rank);
  if (existing >= 0) return existing;
  const bp = monster().cards.find(card => card.kind === "BP" + rank);
  api.moveAibpCard(state().bpTrack[0].id, "removed");
  api.moveAibpCard(bp.id, "mob-left");
  return state().bpTrack.findIndex(slot => slot.id === bp.id);
}
function defeat(index = 0) {
  api.selectMob(index);
  api.settle("bp", "defeat");
}
function exhaust(kind) {
  const b = state();
  const used = new Set([...b.bpDeck, ...b.bpDiscard, ...b.bpRemoved, ...b.bpDamage, ...b.bpTrack.map(slot => slot.id)]);
  b.bpRemoved.push(...monster().cards.filter(card => card.kind === kind && !used.has(card.id)).map(card => card.id));
}

// Immediate damage and replacement are one transaction; supply and mangrove rotation must agree.
for (const id of ["M_FirstmenWarriors", "M_FirstmenLictor"]) {
  for (const rank of [1, 2]) {
    const index = prepare(id, rank);
    const count = occupied();
    api.selectMob(index);
    const before = JSON.stringify(state());
    api.settle("bp", "defeat");
    assert.equal(occupied(), count);
    assert.equal(rankOf(state().bpTrack[index].id), rank + 1);
    assert.equal(state().bpTrack[index].revealed, false);
    assert.equal(state().mobSpawn.nextMangrove, 2);
    assert.match(state().mobSpawn.notices.at(-1), /1 号大红树/);
    const after = JSON.stringify(state());
    api.completeMobAction();
    api.spawnMob("immediate");
    assert.equal(JSON.stringify(state()), after, "automatic replacement cannot run twice");
    api.undo();
    assert.equal(JSON.stringify(state()), before, "undo restores damage, promotion, replacement and tree number together");
  }
  prepare(id);
  for (let index = 0; index < 4; index++) defeat(index);
  assert.equal(state().mobSpawn.nextMangrove, 2, "tree rotation is 1, 2, 3, 1");
  assert.equal(api.validateState(plain(api.state())).battle.mobSpawn.nextMangrove, 2);
  const index = prepare(id, 3);
  const count = occupied();
  defeat(index);
  assert.equal(occupied(), count - 1);
  assert.match(state().mobSpawn.notices.at(-1), /BP3.*取消/);
  prepare(id);
  exhaust("BP2");
  const countBefore = occupied();
  defeat(0);
  assert.equal(occupied(), countBefore - 1, "no other rank substitutes for exhausted standard immediate supply");
  assert.equal(state().mobSpawn.nextMangrove, 1);
}

// Deferred deaths from one action are queued, persisted and resolved as an undoable batch.
for (const id of ["M_Ratwolves", "M_PalebloodWorms"]) {
  prepare(id);
  const count = occupied();
  defeat(0);
  defeat(1);
  assert.equal(occupied(), count - 2);
  assert.deepEqual(plain(state().mobSpawn.pending), [1, 1]);
  assert.equal(api.validateState(plain(api.state())).battle.mobSpawn.pending.length, 2);
  assert.match(nodes.get("#app").innerHTML, /mob-action-required/);
  const beforeRound = JSON.stringify(state());
  api.startMobRound();
  assert.equal(JSON.stringify(state()), beforeRound, "a new round cannot skip pending spawning");
  api.selectMob(2);
  assert.doesNotMatch(nodes.get("#app").innerHTML, /class="[^"]*mob-action-required/);
  const active = JSON.stringify(state());
  api.completeMobAction();
  assert.equal(JSON.stringify(state()), active, "unfinished BP blocks action completion");
  api.settle("bp", "fail");
  api.draw("ai");
  const activeAi = JSON.stringify(state());
  api.completeMobAction();
  assert.equal(JSON.stringify(state()), activeAi, "unfinished AI blocks action completion");
  api.settle("ai", "discard");
  const before = plain(state());
  const beforeCards = cardsAndWounds();
  api.completeMobAction();
  assert.equal(occupied(), count);
  assert.equal(rankOf(state().bpTrack[0].id), 2);
  assert.equal(rankOf(state().bpTrack[1].id), 2);
  assert.equal(cardsAndWounds(), beforeCards, "spawning neither adds wounds nor promotes AI twice");
  assert.equal(state().mobSpawn.pending.length, 0);
  assert.doesNotMatch(nodes.get("#app").innerHTML, /class="[^"]*mob-action-required/);
  if (id === "M_Ratwolves") {
    assert.equal(state().mobSpawn.signatures.length, 2);
    assert.equal(api.validateState(plain(api.state())).battle.mobSpawn.signatures.length, 2);
    assert.match(nodes.get("#app").innerHTML, /杂兵轨 1、2：/);
  } else assert.match(state().mobSpawn.notices.at(-1), /版图外.*激活时.*苍白地穴/);
  const after = JSON.stringify(state());
  api.completeMobAction();
  assert.equal(JSON.stringify(state()), after);
  api.undo();
  assert.deepEqual(plain(state().mobSpawn.pending), before.mobSpawn.pending);
  assert.equal(occupied(), count - 2);
  api.completeMobAction();
  if (id === "M_Ratwolves") {
    api.selectMob(2);
    assert.equal(state().activeBP, "");
    api.completeRatwolfSignature();
    assert.equal(state().mobSpawn.signatures.length, 0);
    assert.equal(state().ruleState.ratwolves.pendingSignature, false);
  }
}

const ratSetup = context.window.KF_CONFLICT_SETUPS.monsters.find(item => item.id === "M_Ratwolves");
const initialRatBp = ratSetup.initialBp;
ratSetup.initialBp = { BP1: 3 };
prepare("M_Ratwolves");
exhaust("BP2");
defeat(0);
api.completeMobAction();
assert.equal(rankOf(state().bpTrack[0].id), 1, "ratwolves may fall back to same rank");
api.completeRatwolfSignature();
ratSetup.initialBp = { BP2: 3 };
const ratIndex = prepare("M_Ratwolves", 2);
exhaust("BP2");
exhaust("BP3");
defeat(ratIndex);
api.completeMobAction();
assert.equal(rankOf(state().bpTrack[0].id), 1, "ratwolves may fall back to lower rank");
api.completeRatwolfSignature();
ratSetup.initialBp = initialRatBp;
prepare("M_Ratwolves");
for (const kind of ["BP1", "BP2", "BP3"]) exhaust(kind);
defeat(0);
api.completeMobAction();
assert.equal(state().ruleState.ratwolves.pendingSignature, false);
assert.match(state().mobSpawn.notices.at(-1), /耗尽/);
prepare("M_PalebloodWorms", 1, 3);
defeat(0);
api.completeMobAction();
assert.equal(state().bpTrack[0].markerTokens["token-blood"], 1);

// Ghost removals caused by effects count once; ready thresholds still wait for action completion.
prepare("M_HauntOf");
const ghost = state().bpTrack[0].id;
api.moveAibpCard(ghost, "removed");
assert.equal(state().ruleState.etherealUnity.counter, 1);
api.moveAibpCard(ghost, "discard");
assert.equal(state().ruleState.etherealUnity.counter, 1);
defeat(1);
defeat(2);
assert.equal(state().ruleState.etherealUnity.counter, 3);
assert.equal(occupied(), 0);
api.draw("ai");
const blocked = JSON.stringify(state());
api.resolveEtherealUnity();
assert.equal(JSON.stringify(state()), blocked);
api.settle("ai", "discard");
const ghostCards = cardsAndWounds();
api.completeMobAction();
assert.equal(occupied(), 3);
assert.equal(state().ruleState.etherealUnity.counter, 0);
assert.equal(cardsAndWounds(), ghostCards);
assert.deepEqual(plain(state().mobActivations.map(token => token.position)), [0, 1]);
api.undo();
assert.equal(occupied(), 0);
assert.equal(state().ruleState.etherealUnity.counter, 3);

// Necrofusion counts double wounds as two, starts at level 2, and gives armor at level 3+.
for (const level of [1, 2, 3, 4]) {
  prepare("M_Ironcast", 0, level);
  const bp3 = state().bpTrack.findIndex(slot => rankOf(slot.id) === 3);
  const bp1 = state().bpTrack.findIndex(slot => rankOf(slot.id) === 1);
  defeat(bp3);
  defeat(bp1);
  assert.equal(state().ruleState.ironcast.necrofusion, level === 1 ? 0 : 3);
  const count = occupied();
  const previous = cardsAndWounds();
  api.completeMobAction();
  assert.equal(occupied(), level === 1 ? count : count + 1);
  assert.equal(state().ruleState.ironcast.necrofusion, 0);
  assert.equal(cardsAndWounds(), previous);
  if (level >= 2) {
    const index = Math.min(bp3, bp1);
    assert.equal(rankOf(state().bpTrack[index].id), 1);
    assert.equal(state().bpTrack[index].markerTokens["token-armor"] || 0, level >= 3 ? 1 : 0);
    assert.match(state().mobSpawn.notices.at(-1), /标志行为/);
  }
}
prepare("M_Ironcast", 0, 2);
api.changeIroncastNecrofusionCounter(4);
const count = occupied();
api.completeMobAction();
assert.equal(occupied(), count + 1, "excess counters still generate once and clear all");
assert.equal(state().ruleState.ironcast.necrofusion, 0);
prepare("M_Ironcast", 0, 2);
api.changeIroncastNecrofusionCounter(3);
for (const kind of ["BP1", "BP2", "BP3"]) exhaust(kind);
api.completeMobAction();
assert.equal(state().ruleState.ironcast.necrofusion, 0);
assert.match(state().mobSpawn.notices.at(-1), /供应不足/);

// Only valid monsters expose completion; incompatible/manual spawning and failed clashes do nothing.
for (const id of ["M_Pumpkinhead", "M_Panzergeists", "M_WingedNightmare", "M_BogWitch"]) {
  prepare(id);
  const before = JSON.stringify(state());
  api.spawnMob("immediate");
  api.spawnMob("interval");
  api.completeMobAction();
  assert.equal(JSON.stringify(state()), before);
  assert.doesNotMatch(nodes.get("#app").innerHTML, /data-spawn-mode|data-mob-action-complete/);
}
prepare("M_PalebloodWorms");
defeat(0);
state().conflictStatus = "failed";
const failed = JSON.stringify(state());
api.completeMobAction();
assert.equal(JSON.stringify(state()), failed);
prepare("M_PalebloodWorms");
defeat(0);
const save = plain(api.state());
delete save.battle.mobSpawn;
save.encounters[state().monsterId].battle = plain(save.battle);
const restored = api.validateState(save).battle;
assert.equal(restored.singleWounds, state().singleWounds);
assert.equal(restored.bpDamage.length, state().bpDamage.length);
assert.equal(restored.mobSpawn.nextMangrove, 1);
assert.deepEqual(plain(restored.mobSpawn.pending), []);
console.log("AIBP automatic spawn tests passed: six monsters, timing, batches, supply, markers, undo, saves and red highlight");
