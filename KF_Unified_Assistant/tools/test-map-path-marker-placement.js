"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const appSource = fs.readFileSync("public/modules/map/app.js", "utf8").replace(/\r\n/g, "\n");
const helperStart = appSource.indexOf("  function pathKey(");
const helperEnd = appSource.indexOf("\n\n  function linkedIds(", helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, "path marker helpers not found");

const context = {};
vm.runInNewContext(`
  let current = { pathMarkers: [
    { id: "standalone", from: "A", type: "door" },
    { id: "bound", from: "A", to: "B", type: "door" }
  ] };
  const mapState = () => current;
  ${appSource.slice(helperStart, helperEnd)}
  result = {
    standaloneDoesNotBlock: blocked("A", "C"),
    boundBlocks: blocked("A", "B")
  };
`, context);

assert.equal(context.result.standaloneDoesNotBlock, undefined,
  "a freely placed path marker must not invent a path association");
assert.equal(Boolean(context.result.boundBlocks), true,
  "existing bound path markers must retain their blocking behavior");
assert.doesNotMatch(appSource, /id="markerNeighbor"/, "adding a path marker must not require a target selector");
assert.match(appSource, /current\.pathMarkers\.push\(\{ id: uid\(\), from: current\.selected, type \}\)/,
  "new path markers must attach only to the selected tile");
assert.match(appSource, /item\.to \? ` ↔ /,
  "legacy target labels must remain visible only for old bound markers");

console.log("map path markers: target-free placement with legacy path compatibility verified");
