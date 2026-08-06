"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const appSource = fs.readFileSync("public/modules/map/app.js", "utf8").replace(/\r\n/g, "\n");
const indexSource = fs.readFileSync("public/modules/map/index.html", "utf8");

assert.match(appSource,
  /const recordOrEmpty = value => value && typeof value === "object" && !Array\.isArray\(value\) \? value : \{\}/,
  "record normalization must reject PHP-round-tripped empty arrays");
const helperContext = {};
vm.runInNewContext(`
  const recordOrEmpty = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};
  result = {
    array: recordOrEmpty([]),
    object: recordOrEmpty({ district: "card-1" }),
    missing: recordOrEmpty(null)
  };
`, helperContext);
assert.equal(Array.isArray(helperContext.result.array), false, "an empty PHP array must become a record");
assert.equal(helperContext.result.object.district, "card-1", "valid records must keep their keys");
assert.equal(Array.isArray(helperContext.result.missing), false, "missing records must become objects");
assert.match(appSource, /current\.tileMeta = recordOrEmpty\(current\.tileMeta\)/,
  "tile metadata must recover from an empty array");
assert.match(appSource, /exp\.districtEffects = recordOrEmpty\(exp\.districtEffects\)/,
  "district effects must recover from an empty array");
assert.match(appSource, /exp\.effectMarkers = recordOrEmpty\(exp\.effectMarkers\)/,
  "effect marker maps must recover from an empty array");

const consumeStart = appSource.indexOf("  function consumeCompletedEncounter() {");
const consumeEnd = appSource.indexOf("\n  function normalizedMonsterName", consumeStart);
assert.ok(consumeStart >= 0 && consumeEnd > consumeStart, "completed encounter consumer not found");
const consumeSource = appSource.slice(consumeStart, consumeEnd);
assert.doesNotMatch(consumeSource, /mapSnapshot/, "encounter completion must not restore a stale map snapshot");
assert.doesNotMatch(consumeSource, /state\.round\s*=/, "encounter completion must not roll back the live round");
assert.doesNotMatch(consumeSource, /enterStep\(/, "encounter completion must not roll back the live step");
assert.match(consumeSource, /state\.maps\[kingdom\]/,
  "encounter completion should apply its delta to the current map state");
assert.match(consumeSource, /snapshotMap\(current,/,
  "encounter completion must snapshot the map it actually changes");
assert.doesNotMatch(appSource.slice(appSource.indexOf("  async function openPendingEncounter()"), consumeStart),
  /mapSnapshot/,
  "new encounter handoffs must not carry a stale full-map snapshot");
assert.match(indexSource, /data-original-app="app\.js\?v=99"/);

console.log("map state recovery: stale encounter snapshots and empty-record round trips verified");
