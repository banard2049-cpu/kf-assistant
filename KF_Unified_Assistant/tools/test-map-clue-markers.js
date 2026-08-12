"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("public/modules/map/app.js", "utf8").replace(/\r\n/g, "\n");
const constantsStart = source.indexOf("  const CLUES = [");
const constantsEnd = source.indexOf("\n  const $ =", constantsStart);
const markerTokenStart = source.indexOf("  function markerToken(");
const markerTokenEnd = source.indexOf("\n\n  function monsterToken(", markerTokenStart);

assert.ok(constantsStart >= 0 && constantsEnd > constantsStart, "marker constants not found");
assert.ok(markerTokenStart >= 0 && markerTokenEnd > markerTokenStart, "markerToken function not found");

const context = {};
vm.runInNewContext(`
  const DATA = { tokens: { markers: { generic: "generic.png" } } };
  ${source.slice(constantsStart, constantsEnd)}
  ${source.slice(markerTokenStart, markerTokenEnd)}
  result = {
    tileMarkers: TILE_MARKERS,
    clueMarkers: CLUES.map(([id, name, icon]) => ({ id, name, icon, resolved: markerToken(id) }))
  };
`, context);

const expected = [
  ["martial", "武艺", "assets/tokens/红-token.png?v=1"],
  ["errant", "游侠", "assets/tokens/绿-token.png?v=1"],
  ["historic", "历史", "assets/tokens/黄-token.png?v=1"],
  ["mystic", "神秘", "assets/tokens/6-token.png?v=1"]
];

for (const [id, name, icon] of expected) {
  assert.ok(
    context.result.tileMarkers.some(([markerId, label]) => markerId === id && label === `${name}线索`),
    `${name}线索 must be available as a tile marker`
  );
  const marker = context.result.clueMarkers.find(item => item.id === id);
  assert.equal(marker?.resolved, icon, `${name}线索 must resolve to its colored marker asset`);
  assert.ok(
    fs.existsSync(`public/modules/map/${icon.replace(/\?.*$/, "")}`),
    `${name}线索 asset must exist`
  );
}

assert.match(source, /current\.tileMarkers\.push\(\{ id: uid\(\), tileId: current\.selected, type: \$\("#tileMarkerType"\)\.value \}\)/);
assert.match(source, /\.\.\.tileMarkers\.map\(marker => \(\{/);

console.log("map clue markers: four placeable marker types and assets verified");
