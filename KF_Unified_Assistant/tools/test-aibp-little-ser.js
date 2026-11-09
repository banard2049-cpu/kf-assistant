"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
class FakeElement {
  constructor() {
    this.dataset = {};
    this.hidden = false;
    this.innerHTML = "";
    this.textContent = "";
    this.value = "";
    this.max = "4";
  }
  addEventListener() {}
  closest() { return this; }
}

const elements = new Map();
const element = selector => {
  if (!elements.has(selector)) elements.set(selector, new FakeElement());
  return elements.get(selector);
};
const storage = new Map();
const context = vm.createContext({
  window: { KF_AIBP_TESTING: true, KF_CAMPAIGN_PARTY: [] },
  document: {
    querySelector: selector => element(selector),
    querySelectorAll: () => [],
    createElement: () => new FakeElement()
  },
  localStorage: {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key)
  },
  console,
  setTimeout,
  clearTimeout,
  confirm: () => true,
  Blob,
  URL
});

for (const file of [
  "public/monster-labels.js",
  "public/modules/aibp/data/monster-data.js",
  "public/modules/aibp/data/level-config.js",
  "public/modules/aibp/data/mob-activation-config.js",
  "public/modules/aibp/data/boss-rule-config.js",
  "public/modules/aibp/data/conflict-setup-data.js",
  "public/modules/display/data/conflict-board-data.js",
  "public/modules/aibp/app.js"
]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

const api = context.window.KF_AIBP_TEST_API;
const battle = () => api.state().battle;
assert.doesNotMatch(api.sheetTokenTools(battle()), /data-token-count="little-ser"/);
api.setSheetTokenCount("little-ser", 1);
assert.ok(!battle().sheetTokens.some(token => token.assetId === "little-ser"));
context.window.KF_CAMPAIGN_PARTY = [{ type: "knight", knightId: "ser-sonch" }];
assert.match(api.sheetTokenTools(battle()), /data-token-count="little-ser"/);
api.setSheetTokenCount("little-ser", 5);
const monkey = battle().sheetTokens.find(token => token.assetId === "little-ser");
assert.equal(monkey.count, 1);
assert.match(api.sheetTokenLayer(battle()), /little-ser.png\?v=5/);
monkey.x = 41; monkey.y = 72; api.commit();
const restored = api.validateState(JSON.parse(JSON.stringify(api.state()))).battle.sheetTokens.find(token => token.assetId === "little-ser");
assert.equal(restored.x, 41); assert.equal(restored.y, 72); assert.equal(restored.count, 1);
api.setSheetTokenCount("little-ser", 0);
assert.ok(!battle().sheetTokens.some(token => token.assetId === "little-ser"));
api.setSheetTokenCount("little-ser", 1);
context.window.KF_CAMPAIGN_PARTY = [];
api.commit();
assert.ok(!battle().sheetTokens.some(token => token.assetId === "little-ser"), "departing Sonch removes the marker before publishing");
context.window.KF_CAMPAIGN_PARTY = [{ type: "squire", knightId: "ser-sonch" }];
assert.doesNotMatch(api.sheetTokenTools(battle()), /data-token-count="little-ser"/);
console.log("Boss sheet Little Ser availability, singleton, placement and persistence passed");

