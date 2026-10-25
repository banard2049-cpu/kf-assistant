"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const plain = value => JSON.parse(JSON.stringify(value));
const controls = new Map();
const control = selector => {
  if (!controls.has(selector)) controls.set(selector, { addEventListener() {} });
  return controls.get(selector);
};
const storage = new Map();
const context = vm.createContext({
  window: {
    KF_CAMPAIGN_PARTY: [{ id: "sheet-1", knightId: "stoneface", name: "Knight", type: "knight" }],
    addEventListener() {}
  },
  document: { querySelector: control, querySelectorAll: () => [] },
  localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
  setTimeout: () => 0, clearTimeout() {}
});
const read = file => fs.readFileSync(`public/modules/encounter/${file}`, "utf8");
for (const file of ["data/encounter-data.js", "encounter-catalog.js", "encounter-view.js"]) vm.runInContext(read(file), context);
const app = read("app.js");
vm.runInContext(app.slice(0, app.lastIndexOf("  renderApp();")) + `
  renderApp = () => {};
  window.facingTest = { blankState, handleSpace, confirmPlacement, undo, orientPlacedBosses, monsterAttackTargets,
    get: () => state, set: value => { state = normalize(value); },
    correct: value => { corrections[cardKey()] = value; } };
})();`, context);
const runtime = context.window.facingTest;
const data = context.window.KF_ENCOUNTER_DATA;
const initial = plain(runtime.blankState());
const faces = [0, 90, 180, 270];
const boss = (id, space = "", facing = 0) => ({ id, name: "Boss", space, facing, roll: "blank", rolls: ["blank", "blank"] });

function setup({ monsterId = "M_BogWitch", level = 1, monsters = [boss("b1")], phase = "position", encounterType = "normal" } = {}) {
  runtime.correct({});
  const monster = data.monsters.find(item => item.id === monsterId);
  context.window.KF_CAMPAIGN_PARTY[0].knightId = monster.special?.knightId || "stoneface";
  context.window.KF_CAMPAIGN_OPTIONS = { leaderSheetId: "sheet-1" };
  runtime.set({ ...plain(initial), monsterId, level, monsters, phase, encounterType, selectedPiece: `monster:${monsters[0].id}` });
  runtime.correct({});
  for (const board of [data.boards.vassal, data.boards.dragon, data.boards.mob]) {
    board.spaces = Array.from({ length: board.cols * board.rows }, () => ({}));
  }
}
const saved = () => JSON.parse(storage.get("kf-encounter-assistant-v1"));

// Click placement scores the same unique, playable cells that the attack overlay displays.
setup();
runtime.handleSpace("3");
assert.equal(runtime.get().monsters[0].facing, 90);
assert.equal(runtime.get().targets.length, 3);
assert.deepEqual(saved().targets, plain(runtime.get().targets));
assert.equal(saved().monsters[0].facing, 90);
runtime.handleSpace("3");
assert.equal(runtime.get().monsters[0].facing, 180, "clicking an existing boss still rotates it manually");
runtime.handleSpace("3");
assert.equal(runtime.get().monsters[0].facing, 270, "manual rotations may choose a smaller range");
assert.equal(runtime.confirmPlacement(), true);
assert.equal(runtime.get().monsters[0].facing, 270, "confirmation preserves the manually chosen facing");

// A greedy choice for just the new boss reaches six cells; the joint optimum requires turning the first boss.
for (const encounterType of ["normal", "ambush"]) {
  setup({ monsters: [boss("b1"), boss("b2")], encounterType });
  runtime.handleSpace("3");
  assert.equal(runtime.get().monsters[0].facing, 90);
  runtime.get().selectedPiece = "monster:b2";
  runtime.handleSpace("16");
  assert.deepEqual(plain(runtime.get().monsters.map(item => item.facing)), [180, 0]);
  assert.equal(runtime.get().targets.length, 7, `${encounterType}: overlapping attacks count only once`);
  assert.equal(new Set(runtime.get().targets).size, 7);
  assert.deepEqual(saved().monsters.map(item => item.facing), [180, 0]);
  assert.equal(runtime.get().history.length, 2, "joint orientation is part of the placement's undo entry");
  runtime.undo();
  assert.deepEqual(plain(runtime.get().monsters.map(({ space, facing }) => ({ space, facing }))), [
    { space: "3", facing: 90 }, { space: "", facing: 0 }
  ], "one undo restores both bosses, including the earlier boss's facing");
}

// Equal coverage retains current facings; an improvement changes as few bosses as possible.
setup({ monsters: [boss("b1", "1", 180), boss("b2", "15", 270)], monsterId: "M_DevilAncientDusk" });
runtime.correct({ attackPattern: [[-1, 0], [-1, 1]], attackPatternVerified: true, attackFacing: 0 });
runtime.orientPlacedBosses("monster");
assert.deepEqual(plain(runtime.get().monsters.map(item => item.facing)), [180, 0]);
runtime.orientPlacedBosses("monster");
assert.deepEqual(plain(runtime.get().monsters.map(item => item.facing)), [180, 0], "repeated optimization is stable");

setup({ monsters: [boss("b1", "3", 180)] });
runtime.orientPlacedBosses("monster");
assert.equal(runtime.get().monsters[0].facing, 180, "a single boss also keeps an equally good current facing");

setup({ monsters: [boss("b1", "3")] });
runtime.correct({ attackPattern: [[-1, 0], [-1, 1]], attackPatternVerified: true, attackFacing: 90 });
runtime.orientPlacedBosses("monster");
assert.equal(runtime.get().monsters[0].facing, 180, "printed facing offsets and locked columns affect the optimum");
assert.deepEqual(plain(runtime.monsterAttackTargets(runtime.get().monsters[0])), ["5", "11"]);

// Other models, manual later movement, and unverified patterns retain their facing.
setup({ monsters: [boss("b1", "3")] });
runtime.get().selectedPiece = `knight:${runtime.get().knights[0].id}`;
runtime.handleSpace("6");
assert.equal(runtime.get().monsters[0].facing, 0, "placing a knight does not reorient bosses");
for (const phase of ["monster", "knight"]) {
  setup({ monsters: [boss("b1", "3", 270)], phase });
  runtime.handleSpace("24");
  assert.notEqual(runtime.get().monsters[0].space, "3");
  assert.equal(runtime.get().monsters[0].facing, 270, `${phase}: movement after placement preserves facing`);
}
setup();
runtime.correct({ attackPatternVerified: false });
runtime.get().monsters[0].facing = 270;
runtime.handleSpace("3");
assert.equal(runtime.get().monsters[0].facing, 270);
assert.deepEqual(plain(runtime.get().targets), []);
setup({ monsterId: data.monsters.find(item => item.type === "mob").id });
runtime.get().monsters[0].facing = 180;
runtime.handleSpace("3");
assert.equal(runtime.get().monsters[0].facing, 180, "mob facing is unchanged");

// Exercise all real boss cards, including 3x3 dragons and special encounters, at both board edges.
let cards = 0;
for (const monster of data.monsters.filter(item => item.type === "boss")) {
  for (const level of monster.encounterLevels) {
    for (const corner of ["first", "last"]) {
      setup({ monsterId: monster.id, level: level.level });
      const board = data.boards[["vassal", "king", "devil"].includes(level.tier) ? "vassal" : level.tier];
      const size = level.stats.monsterSize;
      const firstColumn = level.tier === "vassal" ? 2 : level.tier === "king" ? 1 : 0;
      const anchor = corner === "first" ? firstColumn + 1 : (board.rows - size) * board.cols + board.cols - size + 1;
      runtime.handleSpace(String(anchor));
      const placed = runtime.get().monsters[0];
      assert.equal(placed.space, String(anchor));
      const maximum = Math.max(...faces.map(facing => runtime.monsterAttackTargets({ ...placed, facing }).length));
      assert.equal(runtime.get().targets.length, maximum, `${monster.id}:${level.level}:${corner}`);
    }
    cards++;
  }
}

// A full devil board can fit six bosses. Compare the pruned search with exhaustive enumeration.
setup({ monsterId: "M_DevilAncientDusk", monsters: [1, 3, 5, 13, 15, 17].map((space, index) => boss(`b${index}`, String(space))) });
const options = runtime.get().monsters.map(item => faces.map(facing => plain(runtime.monsterAttackTargets({ ...item, facing }))));
let exhaustiveMaximum = 0;
function enumerate(index, targets) {
  if (index === options.length) { exhaustiveMaximum = Math.max(exhaustiveMaximum, targets.size); return; }
  for (const cells of options[index]) enumerate(index + 1, new Set([...targets, ...cells]));
}
enumerate(0, new Set());
runtime.orientPlacedBosses("monster");
const actualUnion = new Set(runtime.get().monsters.flatMap(item => plain(runtime.monsterAttackTargets(item))));
assert.equal(actualUnion.size, exhaustiveMaximum, "the result is globally optimal for six placed bosses");

console.log(`encounter boss facing: joint maximum coverage, overlap, ties, undo, persistence, manual rotation and ${cards} real boss cards passed`);
