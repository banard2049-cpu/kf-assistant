"use strict";

// A special boss that reuses the base boss's artwork also uses the base boss's special
// attack-cell treatment. Apex Eggknight (Special_F4) borrows the Eggknight portrait, so its
// red attack cells must be painted with the Eggknight egg motif instead of generic warnings.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = name => fs.readFileSync(path.join(root, "public/modules/encounter", name), "utf8");
const context = { window: {} };
for (const name of ["data/encounter-data.js", "encounter-monster-ink.js", "encounter-view.js"]) {
  vm.runInNewContext(read(name), context, { filename: name });
}
const view = context.window.KFEncounterView;
const data = context.window.KF_ENCOUNTER_DATA;
const appSource = read("app.js");
const range = { tier: "vassal" };
range.isUnavailableBoardSpace = (cell, board) => view.isUnavailableBoardSpace(cell, board, range.tier);
vm.runInNewContext(appSource.slice(appSource.indexOf("  function rotateAttackOffset("), appSource.indexOf("  function calculatedAttackTargets("))
  + "\nthis.targets = monsterAttackTargets;", range);

const apex = data.monsters.find(monster => monster.id === "Special_F4");
const level = apex.encounterLevels[0];
const board = view.boardData(data, level);
range.tier = level.tier;
const size = view.monsterFootprint(level);
let best = null;
for (let row = 0; row <= board.rows - size; row += 1) {
  for (let col = 0; col <= board.cols - size; col += 1) {
    const cells = Array.from({ length: size * size }, (_, index) =>
      (row + Math.floor(index / size)) * board.cols + col + index % size + 1);
    if (cells.some(cell => view.isUnavailableBoardSpace(cell, board, level.tier))) continue;
    const piece = { id: "apex-fixture", name: apex.name, space: String(row * board.cols + col + 1), facing: 0, rolls: ["sword"] };
    const targets = range.targets(piece, level, board, size);
    if (!best || targets.length > best.targets.length) best = { piece, targets };
  }
}
assert.ok(best?.targets.length, "Apex Eggknight has a visible printed range");
const state = { monsterId: apex.id, level: level.level, phase: "monster", monsters: [best.piece], targets: best.targets };

const base = data.monsters.find(monster => monster.id === apex.special.baseMonsterId);
assert.equal(base.id, "M_Eggknight");
assert.equal(apex.avatar, base.avatar, "the special boss reuses the base boss artwork");

const options = view.boardInkOptions(state, apex, level);
assert.equal(options.monsterInk, "M_Eggknight", "the special boss borrows the base boss ink id");
assert.equal(options.dragonBreath, false);

const ink = html => html.match(/<svg class="board-ink"[\s\S]*?<\/svg>/)[0].replace(/encounter-ink-\d+/g, "encounter-ink-stable");
const main = view.renderBoard({ state, data, monster: apex, level });
const display = view.renderBoard({ state, data, monster: apex, level, interactive: false });
for (const html of [main, display]) {
  assert.match(html, /data-monster-ink="M_Eggknight"/);
  assert.doesNotMatch(html, /data-monster-ink="Special_F4"/);
  assert.match(html, /data-monster-motif="eggs"/, "the Eggknight egg motif is painted instead of generic warnings");
  const painted = html.match(/data-monster-cells="([^"]+)"/)[1].split(",").map(Number).sort((a, b) => a - b);
  assert.deepEqual(painted, [...best.targets].map(Number).sort((a, b) => a - b), "every printed Apex Eggknight cell is painted");
  assert.ok((html.match(/data-egg-pattern=/g) || []).length >= best.targets.length * 2, "both eggs fill every inherited attack cell");
}
assert.equal(ink(main), ink(display), "the main screen and second screen paint the same inherited ink");

// The fallback only applies when the base monster actually has a special attack-cell rule.
const plagued = data.monsters.find(monster => monster.id === "Special_F3");
assert.deepEqual(Object.keys(view.boardInkOptions({ monsters: [], targets: [] }, plagued, plagued.encounterLevels[0])), [],
  "a special encounter without a custom base rule keeps the generic treatment");
const bogWitch = data.monsters.find(monster => monster.id === "M_BogWitch");
assert.deepEqual(Object.keys(view.boardInkOptions({ monsters: [], targets: [] }, bogWitch, bogWitch.encounterLevels[0])), [],
  "normal monsters do not gain inherited special ink");
const borrowedDragon = { id: "Special_Dragon", special: { baseMonsterId: "M_Panzerdragon" } };
assert.equal(view.boardInkOptions({ monsters: [], targets: [] }, borrowedDragon, { attackFacing: 0 }).dragonBreath, true,
  "the same fallback also inherits a borrowed dragon-breath treatment");

console.log("special boss ink: Apex Eggknight inherits the Eggknight attack-cell treatment passed");
