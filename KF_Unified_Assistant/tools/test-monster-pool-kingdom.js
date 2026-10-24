"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const mainSource = fs.readFileSync("public/app.js", "utf8").replace(/\r\n/g, "\n");
const mapSource = fs.readFileSync("public/modules/map/app.js", "utf8").replace(/\r\n/g, "\n");
const mainIndex = fs.readFileSync("public/index.html", "utf8");
const mapIndex = fs.readFileSync("public/modules/map/index.html", "utf8");
const bridgeSource = fs.readFileSync("public/modules/module-bridge.js", "utf8").replace(/\r\n/g, "\n");
const functionSource = (source, name) => {
  const start = source.indexOf(`  function ${name}(`);
  const end = source.indexOf("\n  }", start);
  assert.ok(start >= 0 && end > start, `${name} function not found`);
  return source.slice(start, end + "\n  }".length);
};

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
assert.equal(syncContext.result.kingdom, "POS", "monster pool sync must not override the campaign's kingdom");

// A saved campaign configuration wins even if its previous monster pool belongs to another kingdom.
const bridgeContext = {};
vm.runInNewContext(`
  const window = {};
  const moduleName = "map", activeCampaign = "campaign-1", mapUpstreamKey = "upstream";
  const cache = new Map();
  const localStorage = { setItem: (key, value) => cache.set(key, value) };
  ${functionSource(bridgeSource, "exposeMapUpstream")}
  exposeMapUpstream({ kingdom: "stone", monsterPool: { kingdom: "sunken", districts: [] } });
  configured = window.KF_MAP_UPSTREAM.kingdom;
  cached = JSON.parse(cache.get(mapUpstreamKey)).kingdom;
  exposeMapUpstream({ kingdom: "sunken" });
  withoutPool = window.KF_MAP_UPSTREAM.kingdom;
  exposeMapUpstream({ map: { activeKingdom: "stone" }, monsterPool: { kingdom: "sunken" } });
  legacyConfiguration = window.KF_MAP_UPSTREAM.kingdom;
`, bridgeContext);
assert.equal(bridgeContext.configured, "stone");
assert.equal(bridgeContext.cached, "stone", "offline cache must retain the saved configuration");
assert.equal(bridgeContext.withoutPool, "sunken", "a monster pool is not required to select the campaign map");
assert.equal(bridgeContext.legacyConfiguration, "stone");

const kingdomContext = {};
vm.runInNewContext(`
  const window = { KF_MAP_UPSTREAM: { kingdom: "stone", monsterPool: { kingdom: "sunken" } } };
  const state = { kingdom: "SK", maps: { SK: { progress: "sunken-progress" }, POS: { progress: "stone-progress" } } };
  const SAVE_VERSION = 8, SAVE_KEY = "map", LEGACY_SAVE_KEYS = [];
  const normalizeTrackNotes = value => value || {};
  const normalizeTrackers = value => value || {};
  const MERCENARY_RULES = { normalizeState: value => value || {}, createState: () => ({}) };
  const defaultMap = kingdom => ({ kingdom });
  const rosterKnights = () => [];
  const applySavedTileRegionCorrections = saved => saved;
  let stored = { version: 8, kingdom: "SK", maps: {}, knights: [] };
  const localStorage = { getItem: () => JSON.stringify(stored) };
  ${["upstreamKingdom", "campaignKingdom", "syncCampaignKingdom", "normalizeSavedMapState", "defaultState", "readState"].map(name => functionSource(mapSource, name)).join("\n")}
  staleSave = readState().kingdom;
  importedSave = normalizeSavedMapState({ kingdom: "SK", maps: {} }).kingdom;
  newSave = defaultState().kingdom;
  changed = syncCampaignKingdom();
  selected = state.kingdom;
  preserved = state.maps;
  unchanged = syncCampaignKingdom();
  // An upstream update without a new monster pool still changes the map.
  window.KF_MAP_UPSTREAM = { kingdom: "sunken" };
  changedWithoutPool = syncCampaignKingdom();
  selectedWithoutPool = state.kingdom;
  // Offline use follows the per-campaign configuration cached by the bridge.
  window.KF_MAP_UPSTREAM = null;
  window.KF_CAMPAIGN_KINGDOM = "stone";
  offlineSave = readState().kingdom;
  window.KF_CAMPAIGN_KINGDOM = "";
  stored.kingdom = "POS";
  legacySave = readState().kingdom;
`, kingdomContext);
assert.equal(kingdomContext.staleSave, "POS", "loading must correct a stale saved map kingdom");
assert.equal(kingdomContext.importedSave, "POS", "imports and concurrent state replacements must follow the configuration");
assert.equal(kingdomContext.newSave, "POS", "a new map must start in the configured kingdom");
assert.equal(kingdomContext.changed, true);
assert.equal(kingdomContext.selected, "POS");
assert.equal(kingdomContext.preserved.SK.progress, "sunken-progress");
assert.equal(kingdomContext.preserved.POS.progress, "stone-progress", "changing the configuration must preserve map progress");
assert.equal(kingdomContext.unchanged, false);
assert.equal(kingdomContext.changedWithoutPool, true);
assert.equal(kingdomContext.selectedWithoutPool, "SK");
assert.equal(kingdomContext.offlineSave, "POS");
assert.equal(kingdomContext.legacySave, "POS", "legacy saves remain usable if configuration is unavailable");

assert.doesNotMatch(mapIndex, /id="kingdomSelect"/, "the map page must not offer kingdom switching");
assert.doesNotMatch(mapSource, /#kingdomSelect/, "the removed dropdown must not leave rendering or event references");
assert.match(mapSource, /const kingdomChanged = syncCampaignKingdom\(\);\s+const wheelSynced = syncDistrictWheelFromUpstream\(\);/,
  "upstream configuration changes must apply independently of monster pool updates");
assert.ok(Number(mainIndex.match(/\/app\.js\?v=(\d+)/)?.[1]) >= 33);
assert.ok(Number(mapIndex.match(/data-original-app="app\.js\?v=(\d+)/)?.[1]) >= 119);

console.log("campaign kingdom: map loading, import, upstream updates and offline cache follow the saved configuration without resetting progress");
