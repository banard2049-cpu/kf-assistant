"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const data = require("../public/data/character-runtime-data.js");

const styles = fs.readFileSync("public/styles.css", "utf8");
const app = fs.readFileSync("public/app.js", "utf8");
const stoneface = data.knights.stoneface;

function closeTo(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 0.001, `${message}: expected ${expected}, received ${actual}`);
}

closeTo(stoneface.profession.art.aspect, 852.8 / (1796 / 3), "profession art must use its atlas cell ratio");
assert.equal(stoneface.portrait.art.scale, 2, "portrait TTS scale");
assert.ok(stoneface.portrait.art.aspect > 0, "portrait must expose its atlas cell ratio");
closeTo(stoneface.heroicArc.art.aspect, 470 / 740, "heroic arc must use its atlas cell ratio");
closeTo(stoneface.perilArc.art.aspect, 470 / 740, "peril arc must use its atlas cell ratio");
closeTo(stoneface.techniques[0].art.aspect, 730 / 1040, "technique must use its atlas cell ratio");
closeTo(stoneface.startingGear.fixed[0].art.aspect, 959 / 1499, "equipment must use its source ratio");
closeTo(data.squires.bartos.tiers[0].art.aspect, 820 / 1410, "squire card must use its atlas cell ratio");
closeTo(data.mettle.cards["mettle.mystic.starter.01"].art.aspect, 470 / 740, "mettle card must use its atlas cell ratio");

assert.equal(stoneface.profession.art.scale, 1, "profession TTS scale");
assert.equal(stoneface.heroicArc.art.scale, 1, "heroic arc TTS scale");
assert.equal(stoneface.perilArc.art.scale, 1, "peril arc TTS scale");
assert.equal(stoneface.techniques[0].art.scale, 1.45, "technique TTS scale");
assert.equal(stoneface.startingGear.fixed[0].art.scale, 1, "equipment TTS scale");
assert.equal(data.squires.bartos.tiers[0].art.scale, 2, "squire TTS scale");
assert.equal(data.mettle.cards["mettle.mystic.starter.01"].art.scale, 1, "mettle TTS scale");

assert.match(app, /--card-aspect:/, "card renderer must expose the source aspect ratio");
assert.match(app, /--tts-scale:/, "card renderer must expose the TTS scale");
assert.match(styles, /aspect-ratio:var\(--card-aspect\)/, "card CSS must preserve source ratio");
assert.match(app, /--card-width:/, "card renderer must calculate width from the TTS scale");
assert.match(styles, /var\(--card-width\)/, "card CSS must use the TTS-derived width");
assert.doesNotMatch(styles, /\.runtime-card-art[^}]*aspect-ratio:2\.5\/3\.5/, "card CSS must not force one ratio on every card");

console.log("character card layout: atlas ratios and TTS scales verified");
