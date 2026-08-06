"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const appSource = fs.readFileSync("public/modules/map/app.js", "utf8").replace(/\r\n/g, "\n");
const helperStart = appSource.indexOf("  function tileSize(");
const helperEnd = appSource.indexOf("\n\n  function partyLocationMarker(", helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, "kingdom tile adjacency helpers not found");

const context = {};
vm.runInNewContext(`
  const TTS_CARD_HEIGHT = 3.06;
  const tiles = new Map([
    ["current", { id: "current", x: 0, y: 0, scale: 1, rotation: 180, image: { aspect: 2 / 3 }, neighbors: ["far-linked"] }],
    ["touching", { id: "touching", x: 2.14, y: 0, scale: 1, rotation: 180, image: { aspect: 2 / 3 }, neighbors: [] }],
    ["far-linked", { id: "far-linked", x: 12, y: 0, scale: 1, rotation: 180, image: { aspect: 2 / 3 }, neighbors: ["current"] }],
    ["corner", { id: "corner", x: 2.14, y: 3.16, scale: 1, rotation: 180, image: { aspect: 2 / 3 }, neighbors: [] }],
    ["unplaced-touching", { id: "unplaced-touching", x: -2.14, y: 0, scale: 1, rotation: 180, image: { aspect: 2 / 3 }, neighbors: [] }]
  ]);
  const tile = id => tiles.get(id);
  const current = {
    placed: ["current", "touching", "far-linked", "corner", "unplaced-touching"],
    tileState: { current: "revealed", touching: "explored", "far-linked": "explored", corner: "revealed", "unplaced-touching": "hidden" }
  };
  const mapState = () => current;
  const tileIsFaceUp = id => current.placed.includes(id) && ["revealed", "explored"].includes(current.tileState[id]);
  ${appSource.slice(helperStart, helperEnd)}
  result = {
    touching: kingdomTilesAreAdjacent(tile("current"), tile("touching")),
    farLinked: kingdomTilesAreAdjacent(tile("current"), tile("far-linked")),
    corner: kingdomTilesAreAdjacent(tile("current"), tile("corner")),
    placedCandidates: adjacentPlacedTileIds("current"),
    faceUpCandidates: adjacentFaceUpTileIds("current")
  };
`, context);

assert.equal(context.result.touching, true, "tiles sharing an edge must be adjacent even without a path connection");
assert.equal(context.result.farLinked, false, "a path-connected but distant tile must not be adjacent");
assert.equal(context.result.corner, false, "tiles touching only at a corner must not be adjacent");
assert.equal(JSON.stringify(context.result.placedCandidates), JSON.stringify(["touching", "unplaced-touching"]),
  "threat-seven candidates must contain only placed, edge-adjacent tiles");
assert.equal(JSON.stringify(context.result.faceUpCandidates), JSON.stringify(["touching"]),
  "hidden adjacent tiles must be excluded from monster generation");

assert.match(appSource, /const adjacentTiles = adjacentFaceUpTileIds\(current\.current, current\);/,
  "threat-seven spawn validation must use face-up physical adjacency");
assert.match(appSource, /const adjacentTiles = adjacentFaceUpTileIds\(pending\.tileId, current\);/,
  "threat-seven selector must use the same face-up physical adjacency rule");
assert.doesNotMatch(appSource, /const adjacentTiles = \(tile\(current\.current\)\?\.neighbors \|\| \[\]\)\.filter/,
  "threat-seven spawn must not accept every path-connected tile");

console.log("map threat-seven spawn: only placed, edge-adjacent kingdom tiles are eligible");
