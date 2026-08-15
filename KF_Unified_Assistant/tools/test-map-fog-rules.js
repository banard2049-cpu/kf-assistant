"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const fogRules = require("../public/modules/map/fog-rules.js");

const fog = {
  deck: ["top", "next"],
  discard: [],
  current: "start",
  route: [],
  used: [],
  total: 0,
  intensity: 2,
  correctedEver: false,
  hazardPending: false,
  baneFull: 0
};

const start = fogRules.makeEntry("start", { fogValue: -1, hazard: true });
fogRules.start(fog, start);
assert.equal(fog.route.length, 1, "the starting card counts toward fog intensity");
assert.equal(fog.total, -1, "negative labeled fog values are preserved");
assert.equal(fog.hazardPending, false, "the starting card never resolves its hazard");
assert.deepEqual({ x: start.x, y: start.y, heading: fog.heading }, { x: 0, y: 0, heading: 0 });

const stay = fogRules.makeEntry("stay", { fogValue: 1, hazard: true });
fogRules.place(fog, stay, false);
assert.equal(fog.hazardPending, false, "hazards are ignored before the first course correction");
assert.deepEqual({ x: stay.x, y: stay.y }, { x: 1, y: 0 }, "staying extends the current heading");

fog.intensity = 3;
const corrected = fogRules.makeEntry("corrected", { fogValue: 2, hazard: true }, true);
fogRules.place(fog, corrected, true, 1);
assert.deepEqual(fog.route.map(item => item.cardId), ["stay", "corrected"]);
assert.deepEqual(fog.used.map(item => item.cardId), ["start", "stay", "corrected"]);
assert.equal(fog.hazardPending, true, "the card drawn during course correction resolves its hazard");
assert.deepEqual({ x: corrected.x, y: corrected.y, heading: fog.heading }, { x: 1, y: -1, heading: 3 });

fog.hazardPending = false;
const afterCorrection = fogRules.makeEntry("after", { fogValue: 1, hazard: false });
fogRules.place(fog, afterCorrection, false);
assert.deepEqual({ x: afterCorrection.x, y: afterCorrection.y }, { x: 1, y: -2 });
fog.baneFull = 1;
assert.equal(fogRules.updateTotal(fog), 5, "each full bane marker adds one to the final fog value");
assert.equal(fogRules.outcome(fog), "grave");
fog.baneFull = 0;
assert.equal(fogRules.outcome(fog), "perfect");

const lowest = fogRules.lowestEntries(fog);
assert.deepEqual(lowest.map(item => item.cardId), ["stay", "after"]);

assert.equal(fogRules.discardTop(fog), "top");
assert.deepEqual(fog.deck, ["next"]);
assert.deepEqual(fog.discard, ["top"]);

const reshuffleFog = {
  deck: ["a", "b", "c"],
  discard: ["top", "discarded-2"],
  current: "current-card",
  used: [{ cardId: "used-card" }]
};
assert.equal(fogRules.reshuffleDeck(reshuffleFog, values => values.reverse()), 5);
assert.deepEqual(reshuffleFog.deck, ["discarded-2", "top", "c", "b", "a"]);
assert.deepEqual(reshuffleFog.discard, [], "discarded cards are returned to the deck");
assert.equal(reshuffleFog.current, "current-card", "reshuffling does not touch the current card");
assert.deepEqual(reshuffleFog.used, [{ cardId: "used-card" }], "reshuffling does not touch placed fog cards");
assert.equal(fogRules.reshuffleDeck({ deck: ["only"], discard: [] }, values => values), 0, "single-card decks are ignored");
const discardOnlyFog = { deck: [], discard: ["only"] };
assert.equal(fogRules.reshuffleDeck(discardOnlyFog, values => values), 1, "a lone discarded card can return to the deck");
assert.deepEqual(discardOnlyFog, { deck: ["only"], discard: [] });

fogRules.returnUsed(fog, { ...stay }, values => values);
assert.deepEqual(fog.deck, ["next", "start", "corrected", "after"]);

const blockedFog = {
  route: [{ cardId: "pivot", value: 1, x: 0, y: 0 }],
  used: [
    { cardId: "pivot", value: 1, x: 0, y: 0 },
    { cardId: "occupied", value: 1, x: 1, y: 0 }
  ],
  heading: 0,
  baneFull: 0,
  correctedEver: false
};
assert.equal(fogRules.canPlace(blockedFog, false), false, "cards cannot overlap while staying");
assert.equal(fogRules.canPlace(blockedFog, true, 0, "right"), true);
const rightTurn = fogRules.makeEntry("right", { fogValue: 2 }, true);
assert.equal(fogRules.place(blockedFog, rightTurn, true, 0, "right"), true);
assert.deepEqual({ x: rightTurn.x, y: rightTurn.y, heading: blockedFog.heading }, { x: 0, y: 1, heading: 1 });

const legacyFog = {
  route: [{ cardId: "a", value: 1 }, { cardId: "b", value: 2 }],
  used: [{ cardId: "a", value: 1 }, { cardId: "b", value: 2 }, { cardId: "old", value: 0 }]
};
fogRules.normalizeLayout(legacyFog);
assert.deepEqual(legacyFog.route.map(item => [item.x, item.y]), [[0, 0], [1, 0]]);
assert.equal(new Set(legacyFog.used.map(item => `${item.x},${item.y}`)).size, 3);

const appSource = fs.readFileSync("public/modules/map/app.js", "utf8");
const indexSource = fs.readFileSync("public/modules/map/index.html", "utf8");
assert.match(appSource, /id="fogReshuffleDeck"/, "fog panel exposes the reshuffle action");
assert.match(appSource, /FOG_RULES\.reshuffleDeck\(fog, shuffle\)/, "fog reshuffle action uses the tested rule");
assert.match(indexSource, /fog-rules\.js\?v=6/, "fog rules cache version is updated");
assert.match(indexSource, /app\.js\?v=110/, "map app cache version is updated");

console.log("map fog rules: all assertions passed");
