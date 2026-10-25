"use strict";

// The Knight of the Fen encounter card reads: "During the Monster Positioning step, position
// 2 Doppelknight Mob Monsters instead of Knight of the Fen (use Doppelknight tokens)." Each
// token therefore rolls one placement die and is placed like a minion, not like a vassal.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const plain = value => JSON.parse(JSON.stringify(value));
const controls = new Map();
const control = selector => {
  if (!controls.has(selector)) controls.set(selector, { listeners: {}, addEventListener(type, handler) { this.listeners[type] = handler; } });
  return controls.get(selector);
};
const storage = new Map();
const context = vm.createContext({
  window: {
    KF_CAMPAIGN_PARTY: [{ id: "sheet-1", knightId: "stoneface", name: "Knight", type: "knight" }],
    KF_CAMPAIGN_OPTIONS: { fivePlayer: false, leaderSheetId: "" },
    addEventListener() {}
  },
  document: { querySelector: control, querySelectorAll: () => [], createElement: () => ({}) },
  localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); }
  },
  setTimeout: () => 0, clearTimeout() {}
});

const read = file => fs.readFileSync(path.join(root, "public/modules/encounter", file), "utf8");
for (const file of ["data/encounter-data.js", "encounter-catalog.js", "encounter-view.js"]) {
  vm.runInContext(read(file), context, { filename: file });
}
const app = read("app.js");
vm.runInContext(app.slice(0, app.lastIndexOf("  renderApp();")) + `
  renderApp = () => {};
  window.fenTest = {
    blankState, preparePieces, requiredMonsterDice, usesMobPlacement, bossPlacementRule,
    handleSpace, confirmPlacement, stats,
    get: () => state, set: value => { state = normalize(value); }
  };
})();`, context);

const runtime = context.window.fenTest;
const data = context.window.KF_ENCOUNTER_DATA;
const view = context.window.KFEncounterView;
const board = data.boards.vassal;
const base = plain(runtime.blankState());
const fen = data.monsters.find(item => item.id === "M_KnightFen");

function select(monsterId, level) {
  runtime.set({ ...plain(base), monsterId, level, phase: "setup" });
  runtime.preparePieces();
  return runtime.get();
}
function setSymbols(symbols) {
  board.spaces = Array.from({ length: board.cols * board.rows }, (_, index) => symbols[index + 1] || {});
}

// Levels 1-2 position two Doppelknights, levels 3-4 position three. Every token has exactly
// one placement die and no boss double-die placement rule.
for (const level of [1, 2, 3, 4]) {
  const state = select("M_KnightFen", level);
  state.phase = "position";
  const expected = level <= 2 ? 2 : 3;
  assert.equal(runtime.stats().monsterCount, expected, `level ${level} monster count comes from the card`);
  assert.equal(runtime.usesMobPlacement(), true);
  assert.equal(runtime.requiredMonsterDice(), 1, `level ${level} tokens roll one die each`);
  assert.equal(state.monsters.length, expected);
  assert.deepEqual(plain(state.monsters.map(monster => monster.rolls.length)), Array(expected).fill(1));
  assert.deepEqual(plain(state.monsters.map(monster => monster.name)),
    plain(state.monsters.map((_, index) => `拟身骑士 ${index + 1}`)));
  for (const monster of state.monsters) {
    assert.equal(runtime.bossPlacementRule("monster", monster), null, `level ${level} has no double-die base requirement`);
  }
}

// Older saves that gave each Doppelknight the vassal's two dice are trimmed on load.
runtime.set({ ...plain(base), monsterId: "M_KnightFen", level: 1, phase: "position",
  monsters: [{ id: "old", name: "怪物 1", roll: "sword", rolls: ["sword", "cup"], space: "", facing: 0 }] });
assert.deepEqual(plain(runtime.get().monsters[0].rolls), ["sword"], "saved Doppelknights keep only one placement die");
assert.equal(runtime.get().monsters[0].roll, "sword");
runtime.set({ ...plain(base), monsterId: "M_KnightFen", level: 1, phase: "position",
  monsters: [{ id: "empty", name: "怪物 1", roll: "", rolls: [], space: "", facing: 0 }] });
assert.equal(runtime.get().monsters[0].rolls.length, 1, "a saved Doppelknight always regains a placement die");

// Other vassals keep the two-dice boss rule.
const bogWitch = select("M_BogWitch", 1);
bogWitch.phase = "position";
assert.equal(runtime.usesMobPlacement(), false);
assert.equal(runtime.requiredMonsterDice(), 2);
assert.ok(runtime.bossPlacementRule("monster", bogWitch.monsters[0]), "a normal vassal still validates its double-die base");

// Minion placement is not restricted to matching cells: only the dice highlights guide it.
setSymbols({ 3: { sword: 1 } });
let state = select("M_KnightFen", 1);
state.phase = "position";
state.monsters[0].rolls = ["sword"];
state.monsters[0].roll = "sword";
state.selectedPiece = `monster:${state.monsters[0].id}`;
runtime.handleSpace("24");
assert.equal(runtime.get().monsters[0].space, "24", "a Doppelknight may be placed off the die's matching cells");
assert.equal(runtime.confirmPlacement(), true, "confirmation accepts minion-style placement without the double-die check");

// A selected Doppelknight highlights only its own single-die matches.
state = select("M_KnightFen", 1);
state.phase = "position";
state.monsters[0].rolls = ["sword"];
state.selectedPiece = `monster:${state.monsters[0].id}`;
const highlights = view.boardHighlights(state, board, fen.encounterLevels[0], data.dice.faces);
assert.deepEqual([...highlights.matches.keys()], [3]);
assert.equal(highlights.matches.get(3), "1", "single-die highlights never report a two-dice match");

// Placing a token still shows the printed attack range; facing stays adjustable as before.
setSymbols({});
state = select("M_KnightFen", 1);
state.phase = "position";
state.monsters[0].rolls = ["blank"];
state.selectedPiece = `monster:${state.monsters[0].id}`;
runtime.handleSpace("9");
assert.equal(runtime.get().monsters[0].space, "9");
assert.ok(runtime.get().targets.length >= 1, "placing a Doppelknight still shows its attack range");

// The positioning UI explains the card exception instead of promising two dice.
assert.match(app, /拟身骑士杂兵/);
assert.match(app, /每个模型只投 1 枚放置骰/);

console.log("encounter Knight of the Fen: two/three Doppelknight tokens, one placement die each, minion placement and range passed");
