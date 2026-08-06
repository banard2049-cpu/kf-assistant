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
  "public/modules/aibp/data/localized-traits.js",
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
const monster = () => context.window.KF_MONSTER_DATA.monsters.find(item => item.id === battle().monsterId);
const card = id => monster().cards.find(item => item.id === id);
const idsOfKind = kind => Array.from(monster().cards).filter(item => item.kind === kind).map(item => item.id);
const zoneKinds = zone => Array.from(battle()[zone], id => card(id)?.kind);

function configurePromotionCase({ level, bpKind, deckKinds, discardKinds = [] }) {
  battle().level = level;
  api.rebuild();
  const offsets = {};
  const nextId = kind => {
    offsets[kind] = (offsets[kind] || 0) + 1;
    return idsOfKind(kind)[offsets[kind] - 1];
  };
  const b = battle();
  b.aiDeck = deckKinds.map(nextId);
  b.aiDiscard = discardKinds.map(nextId);
  b.aiRemoved = [];
  b.bpTrack = [{
    id: idsOfKind(bpKind)[0], revealed: false, side: "face",
    markers: 0, markerTokens: {}, decoy: false
  }];
  b.bpDamage = [];
  b.mobActivations = [];
  b.activeAI = "";
  b.activeBP = "";
  return b;
}

function defeatConfiguredMob() {
  api.selectMob(0);
  api.settleMob("defeat");
}

api.selectMonster("M_HauntOf");
api.rebuild();
assert.deepStrictEqual(JSON.parse(JSON.stringify(monster().pools)), {
  AI1: 6, AI2: 6, AI3: 6, BP1: 3, BP2: 3, SIG: 1, BP3: 3
});
assert.strictEqual(monster().cards.filter(card => card.kind === "BP2").length, 3);
assert.strictEqual(monster().cards.filter(card => card.kind === "BP3").length, 3);
for (let index = 0; index < 3; index++) {
  api.selectMob(index);
  api.settleMob("defeat");
}

assert.strictEqual(battle().ruleState.etherealUnity.counter, 3);
assert.match(battle().ruleState.ruleNotice, /已达到阈值/);
const restored = api.validateState(JSON.parse(JSON.stringify(api.state())));
assert.strictEqual(restored.battle.ruleState.etherealUnity.counter, 3);

api.renderApp();
const html = element("#app").innerHTML;
assert.ok(html.includes('data-ethereal-unity-resolve'));
assert.strictEqual((html.match(/data-ethereal-unity-resolve/g) || []).length, 1);
assert.ok(html.includes("interactive-auto-token must-resolve"));
assert.ok(html.includes("聚合灵体通用指示物 ×3，点击结算并生成 3 只新鬼影"));
assert.ok(!html.includes("mob-rule-panel"));
assert.ok(!html.includes("当前命中修正"));
assert.ok(!html.includes(">结算并生成 3 只鬼影</button>"));

api.resolveEtherealUnity();
assert.strictEqual(battle().ruleState.etherealUnity.counter, 0);
const respawned = battle().bpTrack.filter(slot => slot.id);
assert.strictEqual(respawned.length, 3);
assert.ok(respawned.every(slot => card(slot.id)?.kind === "BP2"));
assert.deepStrictEqual([...battle().mobActivations.map(token => token.position)].sort((a, b) => a - b), [0, 1]);
assert.match(battle().ruleState.ruleNotice, /患者牌组顶部 3 张卡/);

for (let index = 0; index < 3; index++) {
  api.selectMob(index);
  api.settleMob("defeat");
}
api.resolveEtherealUnity();
const secondWave = battle().bpTrack.filter(slot => slot.id);
assert.strictEqual(secondWave.length, 3);
assert.ok(secondWave.every(slot => card(slot.id)?.kind === "BP3"), "BP3 must not spawn until the BP2 wave is defeated");

api.undo();
assert.strictEqual(battle().ruleState.etherealUnity.counter, 3);
assert.strictEqual(battle().bpTrack.filter(slot => slot.id).length, 0);

configurePromotionCase({ level: 1, bpKind: "BP2", deckKinds: ["AI1", "AI2"] });
defeatConfiguredMob();
assert.strictEqual(card(battle().aiRemoved[0])?.kind, "AI2", "level 1 must keep standard BP2 promotion");
assert.deepStrictEqual(zoneKinds("aiDeck").sort(), ["AI1", "AI3"]);

configurePromotionCase({ level: 2, bpKind: "BP2", deckKinds: ["AI2"], discardKinds: ["AI1", "AI2"] });
api.selectMob(0);
const beforeGrimGift = {
  aiDeck: Array.from(battle().aiDeck),
  aiDiscard: Array.from(battle().aiDiscard),
  aiRemoved: Array.from(battle().aiRemoved)
};
api.settleMob("defeat");
assert.strictEqual(card(battle().aiRemoved[0])?.kind, "AI1", "level 2 BP2 must remove the lowest AI");
assert.deepStrictEqual(zoneKinds("aiDeck").sort(), ["AI2", "AI2", "AI3"], "BP2 must still introduce AI3");
assert.strictEqual(battle().aiDiscard.length, 0, "removing from discard must reshuffle the remaining discard");
api.undo();
assert.deepStrictEqual(Array.from(battle().aiDeck), beforeGrimGift.aiDeck);
assert.deepStrictEqual(Array.from(battle().aiDiscard), beforeGrimGift.aiDiscard);
assert.deepStrictEqual(Array.from(battle().aiRemoved), beforeGrimGift.aiRemoved);

configurePromotionCase({ level: 2, bpKind: "BP1", deckKinds: ["AI1", "AI2"] });
defeatConfiguredMob();
assert.strictEqual(card(battle().aiRemoved[0])?.kind, "AI1");
assert.deepStrictEqual(zoneKinds("aiDeck").sort(), ["AI2", "AI2"], "BP1 must still introduce AI2");

const deckPriority = configurePromotionCase({
  level: 2, bpKind: "BP2", deckKinds: ["AI1", "AI2"], discardKinds: ["AI1"]
});
const deckAi1 = deckPriority.aiDeck.find(id => card(id)?.kind === "AI1");
const discardAi1 = deckPriority.aiDiscard[0];
defeatConfiguredMob();
assert.ok(battle().aiRemoved.includes(deckAi1), "the deck copy must be removed before the discard copy");
assert.ok(battle().aiDiscard.includes(discardAi1), "discard must remain untouched when the lowest AI exists in deck");

console.log("Haunts of Utrebant: Ethereal Unity and level 2+ Grim Gift promotion passed.");
