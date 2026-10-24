"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const appSource = fs.readFileSync("public/modules/encounter/app.js", "utf8").replace(/\r\n/g, "\n");
const start = appSource.indexOf("  function rotateAttackOffset(");
const end = appSource.indexOf("\n  function attackTargetsVisible(", start);
assert.ok(start >= 0 && end > start, "attack range helpers not found");

const targetsFor = (mirror, facing = 0) => {
  const context = {};
  vm.runInNewContext(`
    const board = { cols: 6, rows: 4, mirror: ${mirror} };
    const boardData = () => board;
    const monsterFootprint = () => 2;
    const currentLevel = () => ({ attackPattern: [[0, 2]], attackPatternVerified: true, attackFacing: 0 });
    const state = { monsters: [{ space: "2", facing: ${facing} }] };
    ${appSource.slice(start, end)}
    targets = JSON.stringify(calculatedAttackTargets());
  `, context);
  return JSON.parse(context.targets);
};

// The card diagram is relative to the monster's physical footprint. Space 2 is the top-right
// cell-family on a mirrored board, so the cell two columns right of the footprint is space 1.
assert.deepEqual(targetsFor(true), ["1"], "mirrored board keeps the card diagram's right-hand side on the right");
assert.deepEqual(targetsFor(false), ["4"], "unmirrored boards keep the original mapping");
assert.deepEqual(targetsFor(true, 90), ["14"], "facing rotation turns the pattern clockwise on mirrored boards");

assert.match(appSource, /board\.mirror \? board\.cols - size - anchorCol : anchorCol/,
  "the attack range resolves the footprint's visual column");
assert.match(appSource, /board\.mirror \? board\.cols - 1 - visualCol : visualCol/,
  "the attack range maps visual columns back to space numbers");

console.log("encounter attack range: mirrored boards keep the printed attack diagram unflipped");
