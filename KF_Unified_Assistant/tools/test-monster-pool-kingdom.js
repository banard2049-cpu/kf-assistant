"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const mainSource = fs.readFileSync("public/app.js", "utf8").replace(/\r\n/g, "\n");
const mapSource = fs.readFileSync("public/modules/map/app.js", "utf8").replace(/\r\n/g, "\n");
const mainIndex = fs.readFileSync("public/index.html", "utf8");
const mapIndex = fs.readFileSync("public/modules/map/index.html", "utf8");

const savePoolStart = mainSource.indexOf("function saveMonsterPool(");
const savePoolEnd = mainSource.indexOf("\nfunction openMonsterPoolDialog(", savePoolStart);
assert.ok(savePoolStart >= 0 && savePoolEnd > savePoolStart, "saveMonsterPool function not found");

const saveContext = {};
vm.runInNewContext(`
  const calls = [];
  const gameSettings = { leaderSheetId: "leader", kingdom: "stone", districts: 4 };
  const campaignState = { monsterPool: { cards: [], history: [] } };
  const knightSheets = () => [];
  const campaignOp = (path, value) => calls.push([path, value]);
  const renderMonsterPool = () => {};
  const renderEncounterBuilder = () => {};
  ${mainSource.slice(savePoolStart, savePoolEnd)}
  saveMonsterPool([], [], { row: 2 });
  result = calls.map(([path]) => path);
`, saveContext);
assert.deepEqual([...saveContext.result], ["kingdom", "monsterPool", "map.activeKingdom"]);

const syncStart = mapSource.indexOf("  function syncDistrictWheelFromUpstream(");
const syncEnd = mapSource.indexOf("\n\n  function save(", syncStart);
assert.ok(syncStart >= 0 && syncEnd > syncStart, "syncDistrictWheelFromUpstream function not found");

const syncContext = {};
vm.runInNewContext(`
  const pool = { kingdom: "SK", districts: [{ index: 1, monsterId: "monster-1", name: "Monster One", level: 2 }] };
  const state = {
    kingdom: "POS",
    maps: {
      SK: { districtWheel: {}, districtWheelLevels: {}, districtWheelSource: null },
      POS: { districtWheel: {}, districtWheelLevels: {}, districtWheelSource: null }
    }
  };
  const DATA = { monsters: [{ id: "monster-1", name: "Monster One" }] };
  const upstreamMonsterPool = () => pool;
  const rules = () => ({ districts: [{ id: "district-1" }] });
  const ensureDistrictWheel = () => {};
  const normalizedMonsterName = value => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const addLog = () => {};
  const toast = () => {};
  ${mapSource.slice(syncStart, syncEnd)}
  const firstSync = syncDistrictWheelFromUpstream();
  const secondSync = syncDistrictWheelFromUpstream();
  result = {
    firstSync,
    secondSync,
    kingdom: state.kingdom,
    assignment: state.maps.SK.districtWheel["district-1"]
  };
`, syncContext);

assert.equal(syncContext.result.firstSync, true, "new upstream assignments must sync");
assert.equal(syncContext.result.secondSync, false, "an unchanged upstream assignment must be ignored");
assert.equal(syncContext.result.assignment, "monster-1", "the pool must update its own kingdom wheel");
assert.equal(syncContext.result.kingdom, "POS", "upstream sync must preserve the selected kingdom");

assert.match(mainIndex, /\/app\.js\?v=27/);
assert.match(mapIndex, /app\.js\?v=108/);

console.log("monster pool kingdom: random assignment and map sync preserve the selected kingdom");
