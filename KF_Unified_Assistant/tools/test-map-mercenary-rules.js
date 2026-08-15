"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const rules = require("../public/modules/map/mercenary-rules.js");

assert.deepEqual(rules.ROGUES.map(card => [card.id, card.level, card.value]), [
  ["rogue-1", 1, 3],
  ["rogue-2", 2, 5],
  ["rogue-3", 3, 9]
]);
assert.deepEqual(rules.MAGES.map(card => [card.id, card.level, card.value]), [
  ["mage-1", 1, 3],
  ["mage-2", 2, 5],
  ["mage-3", 3, 9]
]);
assert.deepEqual(rules.ROGUES.map(card => card.catalogId), ["mercenary:26609", "mercenary:26610", "mercenary:26611"],
  "map Rogue rules must join the canonical Outpost catalog IDs");
assert.deepEqual(rules.MAGES.map(card => card.catalogId), ["mercenary:26606", "mercenary:26607", "mercenary:26608"],
  "map Mage rules must join the canonical Outpost catalog IDs");
assert.equal(rules.CARDS.length, 6);
assert.ok(rules.ROGUES.every(card => card.role === "rogue"));
assert.ok(rules.MAGES.every(card => card.role === "mage"));
for (const card of rules.CARDS) {
  for (const face of ["A", "B"]) {
    const asset = path.join(__dirname, "..", "public", "modules", "map", rules.CATALOG[card.id].faces[face].image);
    assert.ok(fs.existsSync(asset), `${card.id} ${face} image must exist`);
    assert.ok(fs.statSync(asset).size > 100_000, `${card.id} ${face} image must contain the cropped card`);
  }
}
const mapIndex = fs.readFileSync(path.join(__dirname, "..", "public", "modules", "map", "index.html"), "utf8");
assert.ok(
  mapIndex.indexOf("mercenary-rules.js") < mapIndex.indexOf("../module-bridge.js"),
  "mercenary rules must load before the bridge starts app.js"
);

const migrated = rules.normalizeState(null, []);
assert.deepEqual(migrated, { usage: {}, pendingAction: null, updatedAt: 0 });
assert.equal(Object.hasOwn(rules, "hire"), false, "map rules must not own Outpost hiring");
assert.equal(Object.hasOwn(rules, "availableCards"), false, "map rules must not expose a competing market catalog");

const mageContext = {
  currentTileId: "current",
  exploredTileIds: ["current", "adjacent", "other-district", "adjacent-poi", "poi"],
  adjacentTileIds: ["adjacent", "adjacent-poi"],
  currentDistrict: "north",
  tileDistricts: {
    current: "north",
    adjacent: "north",
    "other-district": "south",
    "adjacent-poi": "north",
    poi: "north"
  },
  pointOfInterestTileIds: ["adjacent-poi", "poi"]
};
assert.deepEqual(rules.mageTargetIds("mage-1", mageContext), ["adjacent", "adjacent-poi"]);
assert.deepEqual(rules.mageTargetIds("mage-2", mageContext), ["adjacent", "adjacent-poi", "poi"]);
assert.deepEqual(rules.mageTargetIds("mage-3", mageContext), ["adjacent-poi", "poi"]);
assert.deepEqual(rules.mageTargetIds("mercenary:26606", mageContext), ["adjacent", "adjacent-poi"],
  "map actions must accept the canonical Outpost mercenary ID");
assert.deepEqual(rules.mageTargetIds("rogue-1", mageContext), []);

const levelOne = rules.redrawExploration("ignored", ["replacement", "next"]);
assert.deepEqual(levelOne, {
  current: "replacement",
  deck: ["next"],
  discarded: ["ignored"]
});
assert.equal(rules.redrawExploration("ignored", []), null, "redraw requires a replacement card");

const levelTwoAction = rules.beginExplorationChoice("rogue-2", ["a", "b", "c"]);
assert.deepEqual(levelTwoAction.drawn, ["a", "b"]);
assert.deepEqual(
  rules.commitExplorationChoice(levelTwoAction, ["a", "b", "c"], "b"),
  { current: "b", deck: ["c"], discarded: ["a"] }
);
assert.equal(
  rules.commitExplorationChoice(levelTwoAction, ["changed", "b", "c"], "b"),
  null,
  "a stale pending choice cannot rewrite a changed deck"
);

const levelThreeAction = rules.beginExplorationChoice("rogue-3", ["a", "b", "c", "d"]);
assert.deepEqual(levelThreeAction.drawn, ["a", "b", "c"]);
assert.deepEqual(
  rules.commitExplorationChoice(levelThreeAction, ["a", "b", "c", "d"], "b", "c"),
  { current: "b", deck: ["a", "d"], discarded: ["c"], returned: ["a"] }
);
assert.equal(
  rules.commitExplorationChoice(levelThreeAction, ["a", "b", "c"], "b", "b"),
  null,
  "the resolved card and discarded card must differ"
);
assert.equal(rules.beginExplorationChoice("rogue-3", ["a", "b"]), null, "level 3 requires three cards");

assert.deepEqual(rules.encounterSkip("rogue-1", "destination", ["origin", "destination"]), {
  action: "skip-and-backtrack",
  targetTileId: "origin",
  suppress: false
});
assert.deepEqual(rules.encounterSkip("rogue-2", "destination", ["origin", "destination"]), {
  action: "skip-and-backtrack",
  targetTileId: "origin",
  suppress: false
});
assert.equal(
  rules.encounterSkip("rogue-2", "destination", ["unrelated", "other"]),
  null,
  "backtracking requires a recent route ending at the encounter tile"
);
assert.deepEqual(rules.encounterSkip("rogue-3", "destination", []), {
  action: "skip",
  targetTileId: "destination",
  suppress: true
});

const normalized = rules.normalizeState({
  usage: {
    "mercenary:26609": { face: "B", status: "active" },
    "mercenary:26610": { face: "A", status: "discarded" },
    "mercenary:not-hired": { face: "B", status: "active" },
  },
  pendingAction: null,
}, ["mercenary:26609", "mercenary:26610"]);
assert.deepEqual(normalized, {
  usage: {
    "mercenary:26609": { face: "B", status: "active" },
    "mercenary:26610": { face: "A", status: "discarded" },
  },
  pendingAction: null,
  updatedAt: 0,
});
assert.equal(rules.drawCount("mercenary:26611"), 3,
  "Rogue exploration helpers must accept canonical Outpost IDs");

console.log("map mercenary rules: all assertions passed");
