"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const plain = value => JSON.parse(JSON.stringify(value));
const controls = new Map();
const control = selector => {
  if (!controls.has(selector)) controls.set(selector, { listeners: {}, addEventListener(type, handler) { this.listeners[type] = handler; } });
  return controls.get(selector);
};
for (const selector of ["#app", "#undo", "#exportSave", "#importSave", "#importFile", "#newEncounter", "#toast", "#saveStatus", "#confirmPosition"]) control(selector);
const context = vm.createContext({
  window: {
    KF_CAMPAIGN_PARTY: [{ id: "sheet-1", knightId: "stoneface", name: "Knight", type: "knight" }],
    addEventListener() {}
  },
  document: { querySelector: selector => controls.get(selector) || null, querySelectorAll: () => [] },
  localStorage: { getItem: () => null, setItem() {} }, setTimeout: () => 0, clearTimeout() {}
});
const read = file => fs.readFileSync(`public/modules/encounter/${file}`, "utf8");
for (const file of ["data/encounter-data.js", "encounter-catalog.js", "encounter-view.js"]) vm.runInContext(read(file), context);
const app = read("app.js");
vm.runInContext(app.slice(0, app.lastIndexOf("  renderApp();")) + `
  renderApp = () => {};
  window.placementTest = { blankState, bind, handleSpace, confirmPlacement, setPlacementRoll,
    rule: item => bossPlacementRule("monster", item || state.monsters[0]),
    count: bossDiceMatchCount, get: () => state, set: value => { state = normalize(value); } };
})();`, context);
const runtime = context.window.placementTest;
const data = context.window.KF_ENCOUNTER_DATA;
const board = data.boards.vassal;
const initial = plain(runtime.blankState());
function setup({ tier = "vassal", symbols = { 3: { sword: 1 }, 4: { cup: 1 } }, rolls = ["sword", "cup"], space = "", knightSpace = "", encounterType = "normal", customPieces = [] } = {}) {
  board.spaces = Array.from({ length: 24 }, (_, index) => symbols[index + 1] || {});
  const monster = data.monsters.find(item => item.encounterLevels.some(level => level.tier === tier));
  const level = monster.encounterLevels.find(item => item.tier === tier);
  runtime.set({ ...plain(initial), monsterId: monster.id, level: level.level, phase: "position", encounterType,
    selectedPiece: "monster:boss", knights: [{ ...initial.knights[0], id: "knight", space: knightSpace }],
    monsters: [{ id: "boss", name: "Boss", rolls, roll: rolls[0], space, facing: 0 }], customPieces });
}

setup();
assert.equal(runtime.rule().requiredMatches, 2);
assert.deepEqual([...runtime.rule().anchors], ["3"], "a double match elsewhere prohibits the single-match fallback");
const beforeClick = JSON.stringify(runtime.get());
runtime.handleSpace("24");
assert.equal(JSON.stringify(runtime.get()), beforeClick, "invalid clicks do not move, save or add undo history");
assert.match(control("#toast").textContent, /两个不同格子/);
runtime.handleSpace("3");
assert.equal(runtime.get().monsters[0].space, "3");
assert.equal(runtime.confirmPlacement(), true);
assert.equal(runtime.get().phase, "monster");

setup({ space: "4" });
runtime.bind();
control("#confirmPosition").listeners.click();
assert.equal(runtime.get().phase, "position", "the actual confirm button rejects a single match while a double exists");
assert.equal(runtime.get().history.length, 0);
runtime.get().monsters[0].space = "3";
control("#confirmPosition").listeners.click();
assert.equal(runtime.get().phase, "monster");

setup({ rolls: ["sword", "sword"], symbols: { 3: { sword: 1 } } });
assert.equal(runtime.count(["sword", "sword"], [3, 4, 9, 10], board), 1, "one cell cannot satisfy both equal dice");
assert.equal(runtime.rule().requiredMatches, 1);
board.spaces[3] = { sword: 1 };
assert.equal(runtime.rule().requiredMatches, 2, "equal dice can match two distinct equal-symbol cells");

setup({ symbols: { 3: { sword: 1 }, 24: { cup: 1 } }, space: "17" });
assert.equal(runtime.rule().requiredMatches, 1, "symbols too far apart enable the one-die fallback");
assert.ok(runtime.rule().anchors.has("3"));
assert.ok(runtime.rule().anchors.has("17"));
assert.equal(runtime.confirmPlacement(), true, "a one-match footprint is accepted only when no double placement exists");

setup({ symbols: { 1: { sword: 1 }, 2: { cup: 1 } }, space: "3" });
assert.equal(runtime.rule().anchors.size, 0, "locked cells cannot satisfy placement dice");
assert.equal(runtime.confirmPlacement(), false, "zero matches are never accepted");
setup({ tier: "king", symbols: { 1: { sword: 1 }, 2: { cup: 1 } }, space: "2" });
assert.equal(runtime.rule().requiredMatches, 1);
assert.equal(runtime.confirmPlacement(), true);
setup({ tier: "devil", symbols: { 1: { sword: 1 }, 2: { cup: 1 } }, space: "1" });
assert.equal(runtime.rule().requiredMatches, 2);
assert.equal(runtime.confirmPlacement(), true);

const occupiedSymbols = { 3: { sword: 1 }, 4: { cup: 1 }, 15: { sword: 1 } };
setup({ symbols: occupiedSymbols, knightSpace: "3", space: "15" });
assert.equal(runtime.rule().requiredMatches, 2, "later knight placement cannot manufacture a normal-encounter fallback");
assert.equal(runtime.rule().anchors.size, 0);
assert.equal(runtime.confirmPlacement(), false);
setup({ symbols: occupiedSymbols, knightSpace: "3", space: "15", encounterType: "ambush" });
assert.equal(runtime.rule().requiredMatches, 1, "ambush placement accounts for the knights already on the board");
assert.equal(runtime.confirmPlacement(), true);

setup({ space: "3", rolls: ["double-sword", "sword", "cup"] });
assert.equal(runtime.rule().requiredMatches, 2, "effects granting extra dice can use any two different dice");
assert.equal(runtime.confirmPlacement(), true, "the boss does not block its own current footprint");
setup({ space: "3" });
runtime.setPlacementRoll(runtime.get().monsters[0], "monster", 0, "double-sword");
runtime.setPlacementRoll(runtime.get().monsters[0], "monster", 1, "double-sword");
assert.equal(runtime.confirmPlacement(), false, "confirmation recalculates the rule after changing the dice");
assert.equal(runtime.get().phase, "position");

setup({ rolls: ["sword"], space: "3" });
assert.equal(runtime.confirmPlacement(), false, "missing placement dice cannot bypass validation");
setup();
assert.equal(runtime.confirmPlacement(), false, "an unplaced boss cannot be confirmed");
runtime.get().monsters = [];
assert.equal(runtime.confirmPlacement(), false, "an empty monster list cannot bypass confirmation");

setup({ rolls: ["blank", "blank"], symbols: Object.fromEntries(Array.from({ length: 24 }, (_, i) => [i + 1, i === 2 ? {} : { sword: 1, cup: 1 }])) });
assert.equal(runtime.rule().requiredMatches, 1, "Hope-only dice match blank cells and still require distinct cells for a double match");
board.spaces[3] = {};
assert.equal(runtime.rule().requiredMatches, 2);

setup({ space: "3" });
runtime.get().phase = "monster";
assert.equal(runtime.rule(), null, "positioning restrictions do not block later card-effect movement");
console.log("encounter boss placement: distinct dice/cells, global fallback, tier locks, occupancy, extra dice, clicks and confirmation passed");
