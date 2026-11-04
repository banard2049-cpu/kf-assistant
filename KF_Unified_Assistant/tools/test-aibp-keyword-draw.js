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

const notices = [];
context.window.KFKeywords = { notify: words => notices.push(Array.from(words)), setPersistent() {}, setCardDataError() {} };
context.window.KFCardKeywords = { ready: Promise.resolve({}), words: ids => Array.from(ids), traits: () => [] };
(async () => {
  api.selectMonster("M_BogWitch");
  const battle = api.state().battle;
  const id = "M_BogWitch:AI1:18";
  battle.activeAI = ""; battle.aiDeck = [id]; battle.aiDiscard = [];
  notices.length = 0;
  api.draw("ai");
  await Promise.resolve();
  assert.deepStrictEqual(notices.at(-1), [id], "draw emits the drawn card");
  battle.activeAI = ""; battle.aiDeck = [id];
  api.draw("ai");
  await Promise.resolve();
  assert.deepStrictEqual(notices.at(-1), [id], "drawing same card again emits again");
  const emitted = notices.length;
  api.draw("ai");
  await Promise.resolve();
  assert.equal(notices.length, emitted, "blocked draw does not emit");
  api.selectMonster("M_Eggknight");
  assert.deepStrictEqual(notices.at(-1), [], "switching battle clears notice");
  api.selectMonster("M_KnightFen");
  const fen = api.state().battle;
  fen.bpDeck = fen.bpDeck.filter(id => !["M_KnightFen:BP1:1", "M_KnightFen:BP1:2"].includes(id));
  fen.bpDiscard = fen.bpDiscard.filter(id => !["M_KnightFen:BP1:1", "M_KnightFen:BP1:2"].includes(id));
  fen.ruleState.doppelgangers = [{ id: "test-doppel", cards: ["M_KnightFen:BP1:1", "M_KnightFen:BP1:2"], revealed: false }];
  notices.length = 0;
  api.toggleDoppelgangerCards("test-doppel");
  await Promise.resolve();
  assert.deepStrictEqual(notices.at(-1), ["M_KnightFen:BP1:1", "M_KnightFen:BP1:2"], "revealing face-down BP cards reports their keywords");
  const revealCount = notices.length;
  api.toggleDoppelgangerCards("test-doppel");
  await Promise.resolve();
  assert.equal(notices.length, revealCount, "turning cards face down does not reveal keywords again");
  api.selectMonster("M_PuppetKing");
  const puppet = api.state().battle;
  const choices = ["M_PuppetKing:AI1:20", "M_PuppetKing:AI1:21"];
  puppet.activeAI = ""; puppet.ruleState.aiChoiceIds = []; puppet.aiDeck = [...choices];
  notices.length = 0;
  api.revealPuppetTopTwo();
  await Promise.resolve();
  assert.deepStrictEqual(notices.at(-1), choices, "revealing two Puppet King cards reports both");
  api.selectMonster("M_Toadragon");
  const toad = api.state().battle;
  toad.activeAI = ""; toad.ruleState.ruleCard = ""; toad.aiDeck = ["M_Toadragon:AI1:19"];
  notices.length = 0;
  api.favoriteChild();
  await Promise.resolve();
  assert.deepStrictEqual(notices.at(-1), ["M_Toadragon:AI1:19"], "favorite child reveals a card and reports it");
  toad.ruleState.ruleCard = ""; toad.aiDeck = ["M_Toadragon:AI1:20"];
  notices.length = 0;
  api.discardTopAi(1);
  await Promise.resolve();
  assert.equal(notices.length, 0, "face-down discards do not leak keywords");
  console.log("keyword draw and battle switching passed");
})().catch(error => { console.error(error); process.exitCode = 1; });
