"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const appSource = fs.readFileSync("public/modules/map/app.js", "utf8").replace(/\r\n/g, "\n");
const functionSource = name => {
  const start = appSource.indexOf(`  function ${name}(`);
  const end = appSource.indexOf("\n  }", start);
  assert.ok(start >= 0 && end > start, `${name} helper must exist`);
  return appSource.slice(start, end + "\n  }".length);
};
const constantSource = name => {
  const start = appSource.indexOf(`  const ${name} = `);
  const end = appSource.indexOf(";\n", start);
  assert.ok(start >= 0 && end > start, `${name} constant must exist`);
  return appSource.slice(start, end + 1);
};

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync("public/modules/map/data/map-data.js", "utf8"), context);
vm.runInContext(`
  const DATA = window.KF_MOD_DATA;
  let nextMarkerId = 0;
  const uid = () => "starting-door-" + (++nextMarkerId);
  ${constantSource("PATH_MARKERS")}
  ${constantSource("DOOR_MARKER_TYPES")}
  ${["kingdomData", "rules", "tile", "tileLabel", "shuffle", "initialPlaced", "defaultMap", "pathKey", "passageHasDoor", "placePrintedDoors", "addLog"].map(functionSource).join("\n")}

  // readState creates both kingdoms before the application's state binding exists.
  // The real addLog and default kingdom lookup must therefore remain unused here.
  const beforeState = { SK: defaultMap("SK"), POS: defaultMap("POS") };
  let state = { kingdom: "SK", log: [] };
  globalThis.testApi = { beforeState, defaultMap, logs: state.log };
`, context);

const data = context.window.KF_MOD_DATA;
const api = context.testApi;
const plain = value => JSON.parse(JSON.stringify(value));
const printedDoors = item => (item.rules?.front?.armoredDoors || [])
  .filter(door => ["armored", "triple-armored"].includes(door.type) && door.target);
const markerValues = current => plain(current.pathMarkers.map(({ from, to, type, printed }) => ({ from, to, type, printed })));
const expectedMarkers = item => plain(printedDoors(item).map(door => ({
  from: item.id, to: door.target, type: door.type, printed: true
})));

const defaultStoneStart = data.maps.POS.tiles.find(item => item.id === data.maps.POS.start);
assert.deepEqual(markerValues(api.beforeState.POS), expectedMarkers(defaultStoneStart),
  "the default Stone start places its printed door before state initialization");
assert.ok(api.beforeState.POS.pathMarkers.some(marker => marker.type === "triple-armored"),
  "the default Stone start has its triple armored door");
assert.equal(api.beforeState.SK.pathMarkers.length, 0, "the default Sunken Kingdom start has no gates");

const stoneGateTiles = data.maps.POS.tiles.filter(item => printedDoors(item).length);
const gateTypes = new Set(stoneGateTiles.flatMap(item => printedDoors(item).map(door => door.type)));
assert.deepEqual([...gateTypes].sort(), ["armored", "triple-armored"],
  "real Stone data exercises both printed door types");
for (const item of stoneGateTiles) {
  const current = api.defaultMap("POS", item.id);
  assert.deepEqual(markerValues(current), expectedMarkers(item),
    `${item.id}: a chosen starting tile immediately places each printed gate`);
  assert.equal(current.tileState[item.id], "explored", `${item.id}: the starting tile remains explored`);
  for (const marker of current.pathMarkers) {
    assert.ok(current.placed.includes(marker.to), `${item.id}: a gate targets a placed neighboring tile`);
    assert.equal(current.tileState[marker.to], "hidden", `${item.id}: placing a gate does not reveal its neighbor`);
  }

  const recreated = api.defaultMap("POS", item.id);
  assert.deepEqual(markerValues(recreated), expectedMarkers(item),
    `${item.id}: resetting or reselecting the start creates exactly one set of gates`);
  assert.deepEqual(markerValues(current), expectedMarkers(item),
    `${item.id}: recreating a map does not mutate the previous map`);
  assert.ok(recreated.pathMarkers.every(marker => !current.pathMarkers.some(previous => previous.id === marker.id)),
    `${item.id}: recreated gates have fresh marker identities`);
}

const hiddenGateNeighborStart = data.maps.POS.tiles.find(item => !printedDoors(item).length
  && item.neighbors.some(id => stoneGateTiles.some(gateTile => gateTile.id === id)));
assert.ok(hiddenGateNeighborStart, "real Stone data has a gate-free start beside a gate-bearing tile");
const gateFreeMap = api.defaultMap("POS", hiddenGateNeighborStart.id);
assert.equal(gateFreeMap.pathMarkers.length, 0, "hidden neighboring tiles do not activate their printed doors");

for (const item of data.maps.SK.tiles) {
  assert.equal(api.defaultMap("SK", item.id).pathMarkers.length, 0,
    `${item.id}: Sunken Kingdom starts do not gain Stone gates`);
}
const fallback = api.defaultMap("POS", "missing-start-tile");
assert.equal(fallback.startingTile, data.maps.POS.start, "an invalid start falls back to the kingdom default");
assert.deepEqual(markerValues(fallback), expectedMarkers(defaultStoneStart),
  "the fallback start receives its printed gates");
assert.equal(api.logs.length, 0, "initializing a map does not write to the active kingdom's log");

console.log("map starting doors: both kingdoms, all printed gate starts, hidden neighbors and map recreation verified");
