"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (...segments) => fs.readFileSync(path.join(root, ...segments), "utf8").replace(/\r\n/g, "\n");
const encounter = read("public", "modules", "encounter", "app.js");
const aibp = read("public", "modules", "aibp", "app.js");
const map = read("public", "modules", "map", "app.js");
const bridge = read("public", "modules", "module-bridge.js");

function functionSlice(source, signature) {
  const start = source.indexOf(signature);
  assert.ok(start >= 0, `${signature} not found`);
  const next = source.indexOf("\n  function ", start + signature.length);
  return source.slice(start, next >= 0 ? next : source.length);
}

function pureFunctionSlice(source, name) {
  const match = source.match(new RegExp(`  function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}`));
  assert.ok(match, `function ${name} not found`);
  return match[0];
}

// A standalone Encounter receives a fresh persisted identity after each reset, while a
// map-started Encounter continues to use the handoff id for replay-safe delivery.
const encounterBlank = functionSlice(encounter, "  function blankState() {");
const encounterComplete = functionSlice(encounter, "  async function completeEncounter() {");
assert.match(encounterBlank, /encounterInstanceId:\s*uid\(\)/,
  "each newly-created standalone Encounter needs a persisted unique instance id");
assert.match(encounterComplete, /encounterReceiptSourceRef\(handoff\)/,
  "Encounter receipts must prefer the stable map handoff id, then the standalone instance id");
assert.doesNotMatch(encounterComplete, /currentMonster\(\)\.id\s*\|\|\s*currentMonster\(\)\.name/,
  "monster identity is not unique enough for repeated standalone Encounter receipts");
const encounterIdentityHelper = pureFunctionSlice(encounter, "encounterReceiptSourceRef");
const encounterIdentitySandbox = {};
vm.runInNewContext(`${encounterIdentityHelper}\nthis.identities={
  firstStandalone: encounterReceiptSourceRef(null, { encounterInstanceId: "standalone-1" }),
  secondStandalone: encounterReceiptSourceRef(null, { encounterInstanceId: "standalone-2" }),
  firstMapDelivery: encounterReceiptSourceRef({ id: "map-handoff-1" }, { encounterInstanceId: "local-1" }),
  replayedMapDelivery: encounterReceiptSourceRef({ id: "map-handoff-1" }, { encounterInstanceId: "local-2" }),
};`, encounterIdentitySandbox);
assert.deepEqual(JSON.parse(JSON.stringify(encounterIdentitySandbox.identities)), {
  firstStandalone: "standalone-1",
  secondStandalone: "standalone-2",
  firstMapDelivery: "map-handoff-1",
  replayedMapDelivery: "map-handoff-1",
});

// Time 8 through 15 is the preliminary-Clash window. Both the map handoff and the
// module bootstrap must agree so cached/campaign state cannot override the explicit route.
const mapPhaseHelper = pureFunctionSlice(map, "clashPhaseFromTime");
const bridgePhaseHelper = pureFunctionSlice(bridge, "phaseFromMapTime");
const phaseSandbox = {};
vm.runInNewContext(`${mapPhaseHelper}\n${bridgePhaseHelper}\nthis.phaseResults=[0,7,8,9,15,16,20].map(value => ({
  value,
  map: clashPhaseFromTime(value),
  bridge: phaseFromMapTime(value),
}));`, phaseSandbox);
assert.deepEqual(JSON.parse(JSON.stringify(phaseSandbox.phaseResults)), [
  { value: 0, map: "full", bridge: "full" },
  { value: 7, map: "full", bridge: "full" },
  { value: 8, map: "preliminary", bridge: "preliminary" },
  { value: 9, map: "preliminary", bridge: "preliminary" },
  { value: 15, map: "preliminary", bridge: "preliminary" },
  { value: 16, map: "full", bridge: "full" },
  { value: 20, map: "full", bridge: "full" },
]);
const openWheelConflict = functionSlice(map, "  async function openKingdomWheelMonster(");
assert.match(openWheelConflict, /clashPhase:\s*destination\s*===\s*"conflict"\s*\?\s*clashPhaseFromTime\(state\.trackers\.time\)/,
  "map-to-AIBP handoff must carry the Clash phase explicitly");
const applyAibpHandoff = functionSlice(bridge, "  function applyAibpHandoff() {");
assert.match(applyAibpHandoff, /handoff\.clashPhase/,
  "AIBP bootstrap must prefer the explicit handoff Clash phase");
assert.match(bridge, /"kf-map-host-v8"/,
  "offline AIBP bootstrap must inspect the current map storage generation");
assert.match(bridge, /handoffPhase[\s\S]*window\.KF_CLASH_PHASE = handoffPhase/,
  "an explicit handoff phase must take precedence even before AIBP app initialization");
const aibpHandoffListener = aibp.slice(aibp.indexOf('window.addEventListener?.("kf:aibp-handoff"'));
assert.match(aibpHandoffListener, /event\.detail\?\.clashPhase/);
assert.match(aibpHandoffListener, /state\.battle\.clashPhase = requestedPhase/,
  "a reused offline battle must be rebuilt to the explicit handoff phase");
assert.match(aibpHandoffListener, /initializeBattle\(monsterById\(state\.battle\.monsterId\)\)/);

// Route matrix: only a preliminary victory resumes Delve/Rest. A preliminary defeat
// is an expedition failure and therefore enters Harvest just like both full outcomes.
const destinationHelper = pureFunctionSlice(aibp, "conflictHarvestDestination");
const routeSandbox = {};
vm.runInNewContext(`${destinationHelper}\nthis.routes={
  preliminaryVictory: conflictHarvestDestination("victory", "preliminary"),
  preliminaryDefeat: conflictHarvestDestination("defeat", "preliminary"),
  fullVictory: conflictHarvestDestination("victory", "full"),
  fullDefeat: conflictHarvestDestination("defeat", "full"),
};`, routeSandbox);
assert.deepEqual(JSON.parse(JSON.stringify(routeSandbox.routes)), {
  preliminaryVictory: "map",
  preliminaryDefeat: "harvest",
  fullVictory: "harvest",
  fullDefeat: "harvest",
});
const completeConflict = functionSlice(aibp, "  function completeConflict(outcome) {");
assert.match(completeConflict, /conflictHarvestDestination\(result,\s*phase\)/);
assert.match(completeConflict, /destination\s*===\s*"harvest"/);
assert.match(completeConflict, /openHarvest/);
assert.match(completeConflict, /handoff\?\.returnUrl\s*\|\|\s*"\/modules\/map\/"/);

const requestHelper = pureFunctionSlice(aibp, "conflictHarvestRequests");
async function runConflictRoute(outcome, clashPhase) {
  const events = [];
  const sandbox = {
    state: { battle: { monsterId: "monster-1", clashPhase }, updatedAt: 17 },
    monsterById: () => ({ id: "monster-1", name: "Test Monster" }),
    currentConflictHandoff: () => ({ id: "handoff-1", returnUrl: "/modules/map/" }),
    confirm: () => true,
    location: { href: "" },
    Promise,
    window: {
      KF_MODULE_BRIDGE: {
        recordHarvestReceipt: receipt => events.push(["receipt", JSON.parse(JSON.stringify(receipt))]),
        flush: () => { events.push(["flush"]); },
        openHarvest: () => { events.push(["harvest"]); },
      },
    },
  };
  vm.runInNewContext(`${requestHelper}\n${destinationHelper}\n${completeConflict}\nthis.completeConflict=completeConflict;`, sandbox);
  await sandbox.completeConflict(outcome);
  return { events, href: sandbox.location.href };
}

(async () => {
  const preliminaryVictory = await runConflictRoute("victory", "preliminary");
  assert.deepEqual(preliminaryVictory.events.map(event => event[0]), ["receipt", "flush"]);
  assert.equal(preliminaryVictory.href, "/modules/map/");

  for (const [outcome, clashPhase] of [
    ["defeat", "preliminary"],
    ["victory", "full"],
    ["defeat", "full"],
  ]) {
    const result = await runConflictRoute(outcome, clashPhase);
    assert.deepEqual(result.events.map(event => event[0]), ["receipt", "flush", "harvest"],
      `${clashPhase} ${outcome} must enter Harvest after persisting its receipt`);
    assert.equal(result.href, "");
  }

  console.log("harvest route matrix: Encounter identities, Clash phase window and aftermath destinations verified");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
