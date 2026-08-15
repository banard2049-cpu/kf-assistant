"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const data = require("../public/data/harvest-data.js");

assert.equal(data.schemaVersion, 1);
assert.deepEqual(data.source, {
  packId: "core.zh-cn",
  version: "1.06",
  rulePages: [68, 69],
  customDeckId: 1067,
});
assert.deepEqual(data.tiers, ["mob", "vassal", "king", "devil", "dragon"]);
assert.equal(data.cards.length, 16, "the physical Loot deck has exactly sixteen cards");
assert.equal(new Set(data.cards.map(card => card.catalogId)).size, 16);
assert.equal(new Set(data.cards.map(card => card.cardId)).size, 16);
assert.deepEqual(data.cards.map(card => card.cardId), Array.from({ length: 16 }, (_, index) => 106700 + index));

const expectedCategories = {
  "full-clash": { count: 2, gold: [3, 4, 6, 8, 10] },
  "exhibition-clash": { count: 2, gold: [3, 4, 6, 8, 10] },
  "kingdom-gear": { count: 4, gold: [2, 3, 4, 5, 6] },
  "consumable-gear": { count: 4, gold: [1, 1, 2, 3, 4] },
  upgrade: { count: 4, gold: [2, 3, 4, 5, 6] },
};
for (const [category, expected] of Object.entries(expectedCategories)) {
  const cards = data.cards.filter(card => card.category === category);
  assert.equal(cards.length, expected.count, `${category} card count`);
  for (const card of cards) {
    assert.deepEqual(data.tiers.map(tier => card.goldByTier[tier]), expected.gold, `${category} gold table`);
    assert.equal(card.art.asset, "/assets/harvest/loot-front.jpg");
    assert.equal(card.backArt.asset, "/assets/harvest/loot-back.jpg");
    assert.equal(card.art.crop.columns, 4);
    assert.equal(card.art.crop.rows, 4);
    assert.ok(Math.abs(card.art.aspect - 470 / 740) < 1e-9);
    assert.equal(card.backArt.aspect, card.art.aspect);
  }
}

for (const asset of ["loot-front.jpg", "loot-back.jpg"]) {
  const file = path.join(__dirname, "..", "public", "assets", "harvest", asset);
  assert.ok(fs.existsSync(file), `${asset} must ship with the web app`);
  assert.ok(fs.statSync(file).size > 100_000, `${asset} must contain the authoritative TTS image`);
}

console.log("harvest data: authoritative sixteen-card Loot deck, categories, gold table and local atlas assets verified");
