"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const appSource = fs.readFileSync("public/modules/map/app.js", "utf8").replace(/\r\n/g, "\n");
const indexSource = fs.readFileSync("public/modules/map/index.html", "utf8");
const helperStart = appSource.indexOf("  function monsterStepRequired(");
const helperEnd = appSource.indexOf("\n\n  function beginTile(", helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, "monsterStepRequired helper not found");

const context = {};
vm.runInNewContext(`
  const state = { trackers: { threat: 0 } };
  let current = { monsters: [], threatSevenSpawned: false, threatSevenPending: false };
  const mapState = () => current;
  ${appSource.slice(helperStart, helperEnd)}
  emptyMap = monsterStepRequired();
  current.monsters.push({ id: "m1", tileId: "tile-1" });
  existingMonster = monsterStepRequired();
  current.monsters = [];
  current.threatSevenPending = true;
  pendingSpawn = monsterStepRequired();
  current.threatSevenPending = false;
  state.trackers.threat = 7;
  thresholdSpawn = monsterStepRequired();
  current.threatSevenSpawned = true;
  alreadySpawned = monsterStepRequired();
`, context);

assert.equal(context.emptyMap, false, "b-e remains combined when step d has no work");
assert.equal(context.existingMonster, true, "an existing map monster requires a separate step d");
assert.equal(context.pendingSpawn, true, "a pending monster spawn requires a separate step d");
assert.equal(context.thresholdSpawn, true, "threat 7 without a prior spawn requires a separate step d");
assert.equal(context.alreadySpawned, false, "a completed threat spawn alone does not keep splitting later tiles");

assert.match(appSource, /const splitAfterBc = \["resolve", "flip", "spawn"\]\.includes\(startingStage\) && monsterStepRequired\(current\)/,
  "b-c split is decided before resolving monster movement and generation");
assert.match(appSource, /pending\.monsterStepSplit = true;\s+pending\.stage = "hunt";/,
  "the first confirmation stops after b-c");
assert.match(appSource, /splittingBc \? "完成 b-c，进入 d-e" : resolvingDe \? "完成 d-e"/,
  "the controls expose separate b-c and d-e confirmations");
assert.match(appSource, /if \(pending\.huntSteps\) moveHunt\(pending\.huntSteps\);[\s\S]*?spawnThreatSeven\(pending\.spawnTileId, pending\.district\)/,
  "d-e still moves existing monsters before spawning the threat-seven monster");
assert.match(indexSource, /app\.js\?v=110/);

console.log("map tile resolution: step d work splits b-c from d-e");
