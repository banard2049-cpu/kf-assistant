"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const appSource = fs.readFileSync("public/modules/map/app.js", "utf8").replace(/\r\n/g, "\n");
const helperStart = appSource.indexOf("  function pathKey(");
const helperEnd = appSource.indexOf("\n\n  function linkedIds(", helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, "path marker helpers not found");
const rulesStart = appSource.indexOf("  // Map-marker drop rules");
const rulesEnd = appSource.indexOf("\n\n  function markerPalette(", rulesStart);
assert.ok(rulesStart >= 0 && rulesEnd > rulesStart, "marker drop rules not found");

const context = {};
vm.runInNewContext(`
  const PATH_MARKERS = [["armored", "单联装甲门"], ["triple-armored", "三联装甲门"], ["fog", "弥雾"], ["blocked", "其他阻挡"], ["shortcut", "已解锁捷径"]];
  const PASSAGE_MARKER_TYPES = PATH_MARKERS.map(([id]) => id).filter(id => id !== "shortcut");
  const DOOR_MARKER_TYPES = ["armored", "triple-armored"];
  let next = 0;
  const uid = () => "m" + (++next);
  const logs = [];
  const addLog = text => logs.push(text);
  const tiles = {
    A: { id: "A", size: "S", number: 1, rules: { front: { armoredDoors: [{ target: "B", type: "triple-armored" }] } } },
    B: { id: "B", size: "S", number: 2, rules: { front: { armoredDoors: [] } } }
  };
  const tile = id => tiles[id];
  const tileLabel = item => item ? item.size + "-" + item.number : "未知";
  let current = { pathMarkers: [
    { id: "standalone", from: "A", type: "door" },
    { id: "bound", from: "A", to: "B", type: "door" }
  ], tileMarkers: [] };
  const mapState = () => current;
  ${appSource.slice(helperStart, helperEnd)}
  ${appSource.slice(rulesStart, rulesEnd)}
  const legacy = { standaloneDoesNotBlock: blocked("A", "C"), boundBlocks: Boolean(blocked("A", "B")) };
  const map = { pathMarkers: [], tileMarkers: [] };
  const first = placePathMarker(map, "armored", { a: "C", b: "D" });
  const second = placePathMarker(map, "triple-armored", { a: "D", b: "C" });
  const fogOnDoor = placePathMarker(map, "fog", { a: "C", b: "D" });
  const offPassage = placePathMarker(map, "armored", null);
  const shortcut = placePathMarker(map, "shortcut", { a: "C", b: "D" });
  const moved = placePathMarker(map, "armored", { a: "E", b: "F" }, first.marker.id);
  const clue = placeTileMarker(map, "martial", "E", { x: 40, y: 60 });
  placeTileMarker(map, "martial", "F", { x: 10, y: 20 }, clue.marker.id);
  const removed = removeMapMarker(map, "path", moved.marker.id);
  const printedMap = { pathMarkers: [], tileMarkers: [] };
  const printedFirst = placePrintedDoors(printedMap, "A");
  const printedAgain = placePrintedDoors(printedMap, "A");
  result = { legacy, first, second, fogOnDoor, offPassage, shortcut, moved, map, removed, printedFirst, printedAgain, printedMap, logs };
`, context);

const result = JSON.parse(JSON.stringify(context.result));
assert.equal(result.legacy.standaloneDoesNotBlock, undefined,
  "a legacy marker without a target still does not invent a path association");
assert.equal(result.legacy.boundBlocks, true, "bound path markers keep blocking their path");
assert.equal(result.first.ok, true, "a door dropped on a passage is placed");
assert.equal(result.moved.marker.id, result.first.marker.id, "moving a placed door keeps the same marker");
assert.deepEqual([result.moved.marker.from, result.moved.marker.to], ["E", "F"], "a moved door is rebound to the new passage");
assert.equal(result.second.ok, false, "a second door on a path already blocked by a door is discarded");
assert.match(result.second.reason, /装甲门/, "the refusal explains the panzergate rule");
assert.equal(result.fogOnDoor.ok, true, "fog may share a path with a door");
assert.equal(result.offPassage.ok, false, "a passage marker needs a passage to snap to");
assert.equal(result.shortcut.ok, false, "shortcuts are not snapped onto a passage");
assert.equal(result.removed?.id, result.moved.marker.id, "a marker dropped on the palette is removed");
assert.ok(!result.map.pathMarkers.some(item => item.id === result.moved.marker.id));
assert.deepEqual(result.map.tileMarkers.map(item => [item.tileId, item.position.x, item.position.y]), [["F", 10, 20]],
  "a tile marker moved onto another tile keeps one record with the new tile and position");
assert.equal(result.printedFirst.length, 1, "a printed door is placed when its tile is resolved");
assert.deepEqual(
  (({ from, to, type, printed }) => ({ from, to, type, printed }))(result.printedMap.pathMarkers[0]),
  { from: "A", to: "B", type: "triple-armored", printed: true }
);
assert.equal(result.printedAgain.length, 0, "a printed door on an already blocked path is discarded");
assert.ok(result.logs.some(text => /弃置/.test(text)), "the discarded printed door is logged");

assert.doesNotMatch(appSource, /id="markerNeighbor"/, "adding a path marker must not require a target selector");
assert.match(appSource, /current\.pathMarkers\.push\(\{ id: uid\(\), from: current\.selected, type: "shortcut" \}\)/,
  "unlocked shortcuts are still added to the selected tile");
assert.match(appSource, /item\.to \? ` ↔ /, "the marker list shows the bound path");
assert.match(appSource, /revealMapTile\(current, pending\.tileId\);\s+placePrintedDoors\(current, pending\.tileId\);/,
  "printed doors are placed when the tile is flipped in its kingdom tile step");

console.log("map path markers: passage snapping, door rule, palette removal and printed doors verified");
