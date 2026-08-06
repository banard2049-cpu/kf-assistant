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
  "public/modules/aibp/data/monster-data.js",
  "public/modules/aibp/data/level-config.js",
  "public/modules/aibp/data/mob-activation-config.js",
  "public/modules/aibp/data/boss-rule-config.js",
  "public/modules/aibp/data/conflict-setup-data.js",
  "public/modules/aibp/app.js"
]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

const api = context.window.KF_AIBP_TEST_API;
const battle = () => api.state().battle;
const revealedTrackCards = html => (html.match(/doppelganger-card-layer[^>]*>\s*<button class="card-button"/g) || []).length;
const styles = fs.readFileSync(path.join(root, "public/modules/aibp/styles.css"), "utf8");
assert.match(styles, /\.doppelganger-slot > span\s*\{[^}]*z-index:\s*20/s);

api.selectMonster("M_KnightFen");
battle().level = 1;
api.rebuild();
assert.strictEqual(battle().ruleState.doppelgangers.length, 1);
assert.strictEqual(battle().ruleState.doppelgangers[0].cards.length, 1);
api.defeatDoppelganger(battle().ruleState.doppelgangers[0].id);
assert.strictEqual(battle().ruleState.knightFen.armor, 0, "level 1 must not gain armor from a doppelganger death");

battle().level = 2;
api.rebuild();
assert.strictEqual(battle().ruleState.doppelgangers[0].cards.length, 1, "level 2 doppelgangers must still use one BP card");
api.defeatDoppelganger(battle().ruleState.doppelgangers[0].id);
assert.strictEqual(battle().ruleState.knightFen.armor, 1, "level 2 must gain armor from a doppelganger death");

battle().level = 4;
api.rebuild();
assert.strictEqual(battle().ruleState.doppelgangers.length, 2, "level 4 conflict setup must spawn two doppelgangers");
assert.ok(battle().ruleState.doppelgangers.every(item => item.cards.length === 2));
assert.strictEqual(battle().ruleState.doppelgangers.flatMap(item => item.cards).length, 4);
api.renderApp();
const levelFourHtml = element("#app").innerHTML;
assert.strictEqual((levelFourHtml.match(/doppelganger-card-stack paired/g) || []).length, 2);

battle().level = 3;
api.rebuild();
assert.strictEqual(battle().ruleState.doppelgangers.length, 1, "conflict setup must spawn one doppelganger");
assert.strictEqual(battle().ruleState.doppelgangers[0].cards.length, 2, "level 3+ doppelgangers must stack two BP cards");

const doppel = battle().ruleState.doppelgangers[0];
const strength = doppel.cards.reduce((sum, id) =>
  sum + context.window.KF_BOSS_RULE_CONFIG.M_KnightFen.bpStrength[id], 0
);
api.renderApp();
let html = element("#app").innerHTML;
assert.ok(html.includes('aria-label="拟身骑士杂兵轨"'));
assert.ok(html.includes(`总强度 ${strength}`));
assert.ok(html.includes(`data-defeat-doppel="${doppel.id}"`));
assert.ok(html.includes(`data-flip-doppel="${doppel.id}"`));
assert.ok(html.includes("doppelganger-card-stack paired"));
assert.ok(html.includes(">翻面</button>"));
assert.ok(!html.includes(">攻击失败</button>"));
assert.strictEqual(revealedTrackCards(html), 0);
assert.strictEqual(api.renderBossRules(), "", "the old doppelganger panel must be removed");

api.toggleDoppelgangerCards(doppel.id);
assert.strictEqual(doppel.revealed, true);
assert.strictEqual(battle().ruleState.doppelPreviewCard, doppel.cards[0]);
api.renderApp();
html = element("#app").innerHTML;
assert.ok(html.includes(">翻回背面</button>"));
assert.strictEqual(revealedTrackCards(html), 2, "both BP cards must flip face-up together");
const revealedState = api.validateState(JSON.parse(JSON.stringify(api.state())));
assert.strictEqual(revealedState.battle.ruleState.doppelgangers[0].revealed, true);
api.toggleDoppelgangerCards(doppel.id);
assert.strictEqual(doppel.revealed, false);
assert.strictEqual(battle().ruleState.doppelPreviewCard, "");
api.renderApp();
html = element("#app").innerHTML;
assert.ok(html.includes(">翻面</button>"));
assert.strictEqual(revealedTrackCards(html), 0, "both BP cards must flip face-down together");

api.defeatDoppelganger(doppel.id);
assert.strictEqual(battle().ruleState.doppelgangers.length, 0);
assert.ok(battle().bpDamage.length >= 2);
assert.strictEqual(battle().ruleState.knightFen.armor, 1, "level 2+ must gain one armor per doppelganger death");
const restored = api.validateState(JSON.parse(JSON.stringify(api.state())));
assert.strictEqual(restored.battle.ruleState.knightFen.armor, 1);
api.renderApp();
html = element("#app").innerHTML;
assert.ok(html.includes("吸收亡者盔甲指示物 ×1"));
assert.ok(html.includes('data-auto-armor-slot="absorb-the-fallen"'));
assert.ok(html.includes('style="left:96%;top:8%"'));
api.undo();
assert.strictEqual(battle().ruleState.knightFen.armor, 0);
assert.strictEqual(battle().ruleState.doppelgangers.length, 1);
api.defeatDoppelganger(doppel.id);

const deckBeforeSpawn = Array.from(battle().bpDeck);
api.spawnDoppelganger();
assert.strictEqual(battle().ruleState.doppelgangers.length, 1);
assert.strictEqual(battle().bpDeck.length, deckBeforeSpawn.length - 2);
api.undo();
assert.strictEqual(battle().ruleState.doppelgangers.length, 0);
assert.deepStrictEqual(Array.from(battle().bpDeck), deckBeforeSpawn);

console.log("Knight of the Fen: paired BP flipping, visible slot badge, level 4 setup, and armor passed.");
