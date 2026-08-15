"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (...segments) => fs.readFileSync(path.join(root, ...segments), "utf8").replace(/\r\n/g, "\n");
const index = read("public", "index.html");
const app = read("public", "app.js");
const styles = read("public", "styles.css");
const api = read("public", "api.php");
const bridge = read("public", "modules", "module-bridge.js");
const encounter = read("public", "modules", "encounter", "app.js");
const encounterIndex = read("public", "modules", "encounter", "index.html");
const aibp = read("public", "modules", "aibp", "app.js");
const aibpIndex = read("public", "modules", "aibp", "index.html");
const map = read("public", "modules", "map", "app.js");
const mapIndex = read("public", "modules", "map", "index.html");

function cacheVersion(source, pattern, label) {
  const match = source.match(pattern);
  assert.ok(match, `${label} must use a versioned URL`);
  return Number(match[1]);
}

function functionSlice(source, signature) {
  const start = source.indexOf(signature);
  assert.ok(start >= 0, `${signature} not found`);
  const next = source.indexOf("\n  function ", start + signature.length);
  return source.slice(start, next >= 0 ? next : source.length);
}

// Root page: Harvest is a first-class campaign module and its data loads before the app.
assert.match(index, /data-module="harvest"/);
assert.match(index, /id="harvestModule"/);
for (const id of [
  "harvestSummary", "harvestPhaseGuide", "harvestReceipts", "harvestActivities", "harvestLoot",
  "lockHarvestGoods", "completeHarvest", "reopenHarvest", "resetHarvest",
]) assert.match(index, new RegExp(`id="${id}"`), `${id} must be rendered by the root page`);
const harvestDataScript = index.indexOf('/data/harvest-data.js?v=');
const harvestRuntimeScript = index.indexOf('/data/harvest-runtime.js?v=');
const rootAppScript = index.indexOf('/app.js?v=');
assert.ok(harvestDataScript >= 0 && harvestDataScript < harvestRuntimeScript && harvestRuntimeScript < rootAppScript,
  "Harvest catalog and runtime must load before root app.js");
assert.ok(cacheVersion(index, /harvest-data\.js\?v=(\d+)/, "Harvest data") >= 1);
assert.ok(cacheVersion(index, /harvest-runtime\.js\?v=(\d+)/, "Harvest runtime") >= 1);
assert.match(app, /const harvestData=window\.KF_HARVEST_DATA/);
assert.match(app, /const harvestRuntime=window\.KF_HARVEST_RUNTIME/);
assert.match(app, /function ensureHarvestState\(\)/);
assert.match(app, /campaignOp\("harvest",next\)/);
assert.match(app, /data-harvest-scrap-draft/,
  "Spare Scrap is chosen one card at a time instead of assigned by array order");
assert.match(app, /Object\.entries\(campaignState\.harvestInbox\|\|\{\}\)/);
assert.match(app, /campaignOp\(`harvestInbox\.\$\{inboxId\}`,null\)/,
  "root atomically consumes server-persisted cross-stage receipts");
assert.match(app, /localStorage\.removeItem\(handoff\.storageKey\)/,
  "root consumes the handoff queue exactly once after applying its receipts");
assert.match(styles, /\.harvest-module\{[^}]*container-type:inline-size/);
assert.match(styles, /@container\(max-width:430px\)\{[\s\S]*?\.harvest-loot-grid\{grid-template-columns:1fr 1fr/,
  "Harvest must retain a compact two-card mobile grid");
assert.match(styles,
  /\.harvest-manual-receipt button\{[^}]*height:29px;[^}]*padding:3px 10px;[^}]*white-space:nowrap/,
  "The fixed-height Harvest receipt button must use compact padding and keep its label on one line");

// module-bridge is the integration Adapter: a campaign-scoped, idempotent receipt queue.
assert.match(bridge, /const harvestHandoffKey = activeCampaign \? `kfHarvestHandoff:\$\{activeCampaign\}`/);
assert.match(bridge, /window\.KF_MODULE_BRIDGE = \{ flush: flushCurrentValue, flushHarvestReceipts, recordHarvestReceipt, openHarvest \}/);
assert.match(bridge, /path: `harvestInbox\.\$\{harvestInboxId\(receipt\.id\)\}`/,
  "cross-stage receipts are persisted to a campaign-scoped server inbox");
const bridgeFunctions = bridge.slice(
  bridge.indexOf("  function compatibleUuid()"),
  bridge.indexOf("  const operationId ="),
);
assert.ok(bridgeFunctions.includes("function recordHarvestReceipt"));
const memory = new Map();
const localStorage = {
  getItem: key => memory.has(key) ? memory.get(key) : null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key),
};
const bridgeSandbox = {
  activeCampaign: "campaign-7",
  harvestHandoffKey: "kfHarvestHandoff:campaign-7",
  legacyHarvestHandoffKey: "kfHarvestHandoff",
  moduleName: "encounter",
  localStorage,
  navigator: { onLine: false },
  location: { href: "" },
  crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000007" },
  Date,
  Math,
  Uint8Array,
};
vm.runInNewContext(`${bridgeFunctions}\nthis.bridgeApi={readHarvestHandoff,recordHarvestReceipt,openHarvest};`, bridgeSandbox);
const queuedReceipt = {
  id: "encounter:resolution:7",
  source: "encounter",
  sourceRef: "resolution:7",
  label: "Encounter Scavenge 1",
  createdAt: "2026-08-14T08:00:00.000Z",
  requests: [{ kind: "choice", count: 1 }],
};
bridgeSandbox.bridgeApi.recordHarvestReceipt(queuedReceipt);
bridgeSandbox.bridgeApi.recordHarvestReceipt({ ...queuedReceipt, label: "duplicate replay" });
let queued = JSON.parse(localStorage.getItem("kfHarvestHandoff:campaign-7"));
assert.equal(queued.campaignId, "campaign-7");
assert.equal(queued.receipts.length, 1, "the same receipt id is queued exactly once");
assert.equal(queued.receipts[0].label, queuedReceipt.label, "a replay cannot overwrite the first receipt");
assert.equal(bridgeSandbox.bridgeApi.recordHarvestReceipt({ id: "invalid", requests: [] }), null);
assert.equal(JSON.parse(localStorage.getItem("kfHarvestHandoff:campaign-7")).receipts.length, 1,
  "a receipt without reward requests never enters the queue");
bridgeSandbox.bridgeApi.openHarvest({ ...queuedReceipt, id: "aibp:resolution:8", source: "aibp" });
queued = JSON.parse(localStorage.getItem("kfHarvestHandoff:campaign-7"));
assert.equal(queued.receipts.length, 2);
assert.equal(bridgeSandbox.location.href, "/?module=harvest");

// Encounter: card-face-guided Scavenge becomes a typed generic receipt at completion.
const encounterResolution = functionSlice(encounter, "  function resolutionPanel() {");
const encounterComplete = functionSlice(encounter, "  async function completeEncounter() {");
assert.match(encounterResolution, /id="encounterScavengeCount"[^>]*type="number"[^>]*min="0"[^>]*max="16"/);
assert.match(encounterComplete, /#encounterScavengeCount/);
assert.match(encounterComplete, /KF_MODULE_BRIDGE\?\.recordHarvestReceipt\?\./);
assert.match(encounterComplete, /source:\s*"encounter"/);
assert.match(encounter, /encounterInstanceId:\s*uid\(\)/,
  "each standalone Encounter run must persist a fresh receipt identity");
assert.match(encounterComplete, /const sourceRef = encounterReceiptSourceRef\(handoff\)/);
assert.match(encounterComplete, /sourceRef,/);
assert.match(encounterComplete, /requests:\s*\[\{\s*kind:\s*"choice",\s*count:\s*scavengeCount\s*\}\]/);
assert.match(encounterComplete, /id:\s*`encounter-\$\{sourceRef\}/,
  "map-started Encounter receipts remain stable while repeated standalone runs do not collide");

// AIBP: one explicit outcome command owns reward creation and routing.
assert.match(aibp, /function conflictHarvestRequests\(outcome, clashPhase\)/,
  "AIBP needs a pure reward-request adapter for testable victory/defeat semantics");
const requestHelper = functionSlice(aibp, "  function conflictHarvestRequests(outcome, clashPhase) {");
const requestSandbox = {};
vm.runInNewContext(`${requestHelper}\nthis.results={
  fullVictory:conflictHarvestRequests("victory","full"),
  preliminaryVictory:conflictHarvestRequests("victory","preliminary"),
  defeat:conflictHarvestRequests("defeat","full")
};`, requestSandbox);
assert.deepEqual(JSON.parse(JSON.stringify(requestSandbox.results)), {
  fullVictory: [
    { kind: "clash", clashPhase: "full", count: 1 },
    { kind: "choice", count: 3 },
  ],
  preliminaryVictory: [
    { kind: "clash", clashPhase: "preliminary", count: 1 },
    { kind: "choice", count: 3 },
  ],
  defeat: [{ kind: "choice", count: 3 }],
});
assert.match(aibp, /data-conflict-outcome="victory"/);
assert.match(aibp, /data-conflict-outcome="defeat"/);
const completeConflict = functionSlice(aibp, "  function completeConflict(outcome) {");
assert.match(completeConflict, /conflictHarvestRequests\(outcome,\s*state\.battle\.clashPhase\)/);
assert.match(completeConflict, /KF_MODULE_BRIDGE\?\.recordHarvestReceipt\?\./);
assert.match(completeConflict, /state\.battle\.clashPhase\s*===\s*"preliminary"/);
assert.match(completeConflict, /handoff\?\.returnUrl|\/modules\/map\//,
  "a successful preliminary Clash returns to the interrupted map/rest flow");
assert.match(completeConflict, /KF_MODULE_BRIDGE\?\.openHarvest\?\./,
  "a full Clash aftermath opens Harvest after queuing its receipt");

// Delve records story/rule Scavenge without leaving the map, while expedition failure routes to Harvest.
for (const id of ["recordMapScavenge", "mapScavengeDialog", "mapScavengeForm", "mapScavengeKind", "mapScavengeCount", "failExpedition"]) {
  assert.match(mapIndex, new RegExp(`id="${id}"`), `Map must expose ${id}`);
}
const mapScavengeHandler = map.slice(map.indexOf('$("#recordMapScavenge")'), map.indexOf('$("#failExpedition")'));
assert.match(mapScavengeHandler, /KF_MODULE_BRIDGE\?\.recordHarvestReceipt\?\./);
assert.match(mapScavengeHandler, /source:\s*"map"/);
assert.match(mapScavengeHandler, /kind:\s*"choice"/);
assert.match(mapScavengeHandler, /kind:\s*"category"/);
const failExpeditionHandler = map.slice(map.indexOf('$("#failExpedition")'), map.indexOf('addEventListener("kf:module-state"'));
assert.match(failExpeditionHandler, /KF_MODULE_BRIDGE\?\.flush\?\./);
assert.match(failExpeditionHandler, /KF_MODULE_BRIDGE\?\.openHarvest\?\./);

// New campaigns persist the same root-level Harvest aggregate that the root page edits.
assert.match(api, /'harvest'\s*=>\s*\[\s*'schemaVersion'\s*=>\s*1\s*,\s*'status'\s*=>\s*'collecting'/,
  "default_campaign_state must initialize the root Harvest aggregate for new and copied campaigns");
assert.match(api, /'harvestInbox'=>\(object\)\[\]/);
assert.match(api, /function validate_harvest_state\(mixed \$value\): void/);
assert.match(api, /str_starts_with\(\$path,'harvestInbox\.'\)\)validate_harvest_receipt\(\$value\)/);
assert.match(api, /resolution'=>'merged-additive'/,
  "concurrent Harvest snapshots preserve additive receipts and physical Loot cards");
assert.match(api, /function remap_harvest_member_keys\(mixed \$value,array \$sheetMap\): mixed/);
assert.match(api, /\$state\['harvest'\]=remap_harvest_member_keys\(\$state\['harvest'\],\$sheetMap\)/,
  "campaign import must remap persisted Harvest owners to imported Knight sheet ids");
assert.match(api, /in_array\(\$path,\['partyManager','harvest'\],true\) \? 500_000/,
  "Harvest aggregate sync must allow its bounded receipt and history payload");

const encounterBridgeVersion = cacheVersion(encounterIndex, /module-bridge\.js\?v=(\d+)/, "Encounter bridge");
const aibpBridgeVersion = cacheVersion(aibpIndex, /module-bridge\.js\?v=(\d+)/, "AIBP bridge");
const mapBridgeVersion = cacheVersion(mapIndex, /module-bridge\.js\?v=(\d+)/, "Map bridge");
assert.ok(encounterBridgeVersion >= 15, "Encounter must load the server-inbox Harvest bridge build");
assert.equal(aibpBridgeVersion, encounterBridgeVersion,
  "Encounter and AIBP must use the same Harvest-capable bridge cache version");
assert.equal(mapBridgeVersion, encounterBridgeVersion,
  "Map, Encounter and AIBP must use the same Harvest-capable bridge cache version");
assert.ok(cacheVersion(encounterIndex, /data-original-app="app\.js\?v=(\d+)"/, "Encounter app") >= 26);
assert.ok(cacheVersion(aibpIndex, /data-original-app="app\.js\?v=(\d+)"/, "AIBP app") >= 101);
assert.ok(cacheVersion(mapIndex, /data-original-app="app\.js\?v=(\d+)"/, "Map app") >= 104);

console.log("harvest integration: root UI, idempotent bridge, Delve/Encounter/Clash receipts, routing and API defaults verified");
