"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const appSource = fs.readFileSync("public/modules/encounter/app.js", "utf8").replace(/\r\n/g, "\n");
const indexSource = fs.readFileSync("public/modules/encounter/index.html", "utf8");
const start = appSource.indexOf("  function attackTargetsVisible(");
const end = appSource.indexOf("\n  function spaceLabel(", start);
assert.ok(start >= 0 && end > start, "attackTargetsVisible function not found");

const context = {};
vm.runInNewContext(`
  const state = {
    phase: "position",
    monsters: [{ id: "m1", space: "" }, { id: "m2", space: "" }]
  };
  ${appSource.slice(start, end)}
  beforePlacement = attackTargetsVisible();
  state.monsters[0].space = "4";
  afterFirstPlacement = attackTargetsVisible();
  state.monsters[1].space = "8";
  afterAllPlacements = attackTargetsVisible();
  state.phase = "monster";
  duringMonsterPhase = attackTargetsVisible();
  state.phase = "setup";
  duringSetup = attackTargetsVisible();
`, context);

assert.equal(context.beforePlacement, false, "range stays hidden before any monster is placed");
assert.equal(context.afterFirstPlacement, true, "placing the first of several monsters reveals its range");
assert.equal(context.afterAllPlacements, true, "range remains visible after all monsters are placed");
assert.equal(context.duringMonsterPhase, true, "range remains visible during the monster phase");
assert.equal(context.duringSetup, false, "range is hidden outside placement and monster phases");
assert.match(appSource, /state\.monsters\.filter\(monster => monster\.space\)/,
  "range calculation only includes monsters already on the board");
assert.match(appSource, /kind === "monster"\) state\.targets = calculatedAttackTargets\(\)/,
  "placing or rotating a monster recalculates range immediately");
assert.match(indexSource, /app\.js\?v=26/, "encounter app cache version is updated");

console.log("encounter attack range: first placed monster is visible immediately");
