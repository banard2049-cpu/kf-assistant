const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const nodes = new Map();
const makeNode = () => ({
  innerHTML: "", textContent: "", hidden: false, value: "", dataset: {},
  classList: { add() {}, remove() {}, toggle() {} },
  addEventListener() {}, querySelectorAll() { return []; }, closest() { return this; },
});
const nodeFor = selector => {
  if (!nodes.has(selector)) nodes.set(selector, makeNode());
  return nodes.get(selector);
};
const context = vm.createContext({
  console, structuredClone, Date, Math, JSON, Blob, URL,
  document: { querySelector: nodeFor, querySelectorAll: () => [], createElement: makeNode },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  confirm: () => true,
  setTimeout: (callback, delay) => { const timer = setTimeout(callback, delay); timer.unref(); return timer; },
  clearTimeout,
});
context.window = context;
Object.assign(context, { KF_AIBP_TESTING: true, KF_CAMPAIGN_KINGDOM: "sunken", KF_CLASH_PHASE: "full" });
for (const file of [
  "data/monster-data.js", "data/localized-traits.js", "data/localized-sheets.js",
  "data/level-config.js", "data/mob-activation-config.js", "data/boss-rule-config.js",
  "data/conflict-setup-data.js", "../display/data/conflict-board-data.js", "app.js",
]) vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });

const api = context.KF_AIBP_TEST_API;
const state = () => api.state().battle;
const monster = () => context.KF_MONSTER_DATA.monsters.find(item => item.id === state().monsterId);
const ids = kind => Array.from(monster().cards.filter(card => card.kind === kind), card => card.id);
const kindOf = id => monster().cards.find(card => card.id === id)?.kind;
const kinds = zone => Array.from(state()[zone], kindOf);
const plain = value => JSON.parse(JSON.stringify(value));
function prepare(id = "M_Ironcast", level = 1, deck = ["AI1"], discard = []) {
  api.selectMonster(id);
  state().level = level;
  state().clashPhase = "full";
  api.rebuild();
  const offsets = {};
  const next = kind => ids(kind)[(offsets[kind] = (offsets[kind] || 0) + 1) - 1];
  Object.assign(state(), {
    aiDeck: deck.map(next), aiDiscard: discard.map(next), aiRemoved: [],
    bpTrack: [], bpRemoved: [], bpDamage: [], bpDamageTypes: {},
    singleWounds: 0, doubleWounds: 0, activeAI: "", activeBP: "",
    mobActivations: [], activeMobActivationId: "", aiPromotionBonusStep: 0,
  });
}
function place(kind, index = 0, markers = 0, side = "face") {
  while (state().bpTrack.length <= index) state().bpTrack.push({ id: "" });
  const used = new Set(state().bpTrack.map(slot => slot.id));
  const id = ids(kind).find(id => !used.has(id));
  assert.ok(id);
  state().bpTrack[index] = { id, revealed: true, side, markers,
    markerTokens: markers ? { "token-01": markers } : {}, decoy: false };
  return id;
}
function defeat(rank, action = "defeat") {
  const id = place("BP" + rank);
  api.selectMob(0);
  api.settle("bp", action);
  return id;
}
function assertValid() {
  const save = plain(api.state());
  save.encounters = {};
  assert.doesNotThrow(() => api.validateState(save));
}

// 中规 P61-62：全部普通杂兵的 BP3 都是双重损伤，并执行最低阶 AI -> AI3。
for (const mob of ["M_Ironcast", "M_FirstmenWarriors", "M_FirstmenLictor",
  "M_HauntOf", "M_PalebloodWorms", "M_Panzergeists", "M_Ratwolves"]) {
  for (const action of ["defeat", "critical"]) {
    prepare(mob, 1, ["AI3"], ["AI1", "AI2"]);
    const bp = defeat(3, action);
    assert.deepEqual(kinds("aiRemoved"), ["AI1"], mob + " BP3 搜索全局最低阶 AI");
    assert.equal(state().aiDiscard.length, 0);
    assert.deepEqual(kinds("aiDeck").sort(), ["AI2", "AI3", "AI3"]);
    assert.ok(state().bpDamage.includes(bp));
    assert.equal(state().singleWounds, 0);
    assert.equal(state().doubleWounds, 1);
    assertValid();
  }
}

// 缺阶逐行递进；同阶搜索优先牌组，移除弃牌后才将弃牌洗回。
for (const [rank, deck, expectedRemoved] of [
  [1, ["AI2"], "AI2"], [1, ["AI3"], "AI3"], [2, ["AI1"], "AI1"],
]) {
  prepare("M_Ironcast", 1, deck);
  defeat(rank);
  assert.deepEqual(kinds("aiRemoved"), [expectedRemoved]);
  assert.deepEqual(kinds("aiDeck"), ["AI3"]);
}
prepare("M_Ironcast", 1, ["AI1", "AI2"], ["AI1"]);
const deckAi = state().aiDeck[0], discardAi = state().aiDiscard[0];
defeat(1);
assert.deepEqual(Array.from(state().aiRemoved), [deckAi]);
assert.deepEqual(Array.from(state().aiDiscard), [discardAi]);
prepare("M_Ironcast", 1, ["AI1"], ["AI3"]);
defeat(1);
assert.equal(state().aiDiscard.length, 0, "新 AI 成为唯一牌时洗回弃牌");
assert.deepEqual(kinds("aiDeck").sort(), ["AI2", "AI3"]);

// 供应耗尽的永久加成、手动 AI3 晋升、保存与单次撤销。
prepare();
state().aiRemoved = ids("AI2");
const bp = place("BP1");
api.selectMob(0);
const before = plain(state());
api.settle("bp", "defeat");
assert.equal(state().aiPromotionBonusStep, 1);
assert.ok(state().aiRemoved.includes(before.aiDeck[0]));
assertValid();
api.undo();
assert.deepEqual(plain(state()), before);
assert.equal(state().activeBP, bp);
prepare("M_Ironcast", 1, ["AI3"]);
api.promoteLowest("ai");
assert.deepEqual(kinds("aiRemoved"), ["AI3"]);
assert.deepEqual(kinds("aiDeck"), ["AI3"]);
prepare("M_Ironcast", 1, ["AI3"]);
state().aiRemoved = ids("AI3").slice(1);
api.promoteLowest("ai");
assert.equal(state().aiPromotionBonusStep, 1);

// 险恶用心只覆盖移除源牌；BP1 即使只剩 AI3，也仍加入 AI2。
for (const [rank, expected] of [[1, "AI2"], [2, "AI3"], [3, "AI3"]]) {
  prepare("M_HauntOf", 2, ["AI3"]);
  defeat(rank);
  assert.deepEqual(kinds("aiRemoved"), ["AI3"]);
  assert.deepEqual(kinds("aiDeck"), [expected]);
}
prepare("M_HauntOf", 2, ["AI1"]);
state().aiRemoved = ids("AI3");
defeat(2);
assert.equal(state().aiPromotionBonusStep, 1, "险恶用心仍执行耗尽加成");

// 装甲倾泻：被击破时也替代晋升，放在存活的最低阶 BP，整次击破可撤销。
prepare("M_Panzergeists", 2);
state().aiRemoved = ids("AI2");
place("BP2", 1);
place("BP1", 2);
place("BP1");
api.selectMob(0);
const beforePanzer = plain(state());
api.settle("bp", "defeat");
assert.equal(state().bpTrack[2].markerTokens["token-armor"], 1);
assert.equal(state().bpTrack[1].markerTokens["token-armor"], undefined);
assert.equal(state().aiPromotionBonusStep, 0);
assert.deepEqual(Array.from(state().aiDeck), beforePanzer.aiDeck, "替代效果不移除 AI");
assert.equal(state().singleWounds, 1);
api.undo();
assert.deepEqual(plain(state()), beforePanzer);

// 浴血奋战分别覆盖 AI 晋升与生成的 BP 供应耗尽，且不凭空生成卡或损伤。
for (const trigger of ["ai", "bp", "manual"]) {
  prepare("M_PalebloodWorms");
  place("BP1", 1);
  if (trigger === "ai" || trigger === "manual") state().aiRemoved = ids("AI2");
  if (trigger === "bp") state().bpRemoved = ids("BP2");
  if (trigger === "manual") api.promoteLowest("ai");
  else { defeat(1); api.completeMobAction(); }
  assert.equal(state().bpTrack[1].markerTokens["token-blood"], 1, trigger);
  assert.equal(state().aiPromotionBonusStep, 0);
  assert.equal(state().singleWounds, trigger === "manual" ? 0 : 1);
  assertValid();
}

// 南瓜幼体：3 枚指示物使用最高阶晋升规则；成体受伤仍只翻面加标记。
prepare("M_Pumpkinhead", 1, ["AI1"]);
place("BPS", 0, 3, "back");
api.selectMob(0);
api.settle("bp", "defeat");
assert.deepEqual(kinds("aiRemoved"), ["AI1"]);
assert.deepEqual(kinds("aiDeck"), ["AI3"]);
assert.equal(state().singleWounds, 1);
prepare("M_Pumpkinhead");
const pumpkin = place("BPS");
api.selectMob(0);
api.settle("bp", "defeat");
assert.equal(state().bpTrack[0].id, pumpkin);
assert.equal(state().bpTrack[0].side, "back");
assert.equal(state().bpTrack[0].markers, 1);
assert.equal(state().bpDamage.length, 0);
assert.equal(state().aiRemoved.length, 0);

// 翼生梦魇：固定 BP 不移动；AI3 顶牌时即使只有 AI3 也必须晋升。
prepare("M_WingedNightmare", 1, ["AI3"], ["AI3"]);
api.resolveWingedNightmareAttack(true);
assert.deepEqual(kinds("aiRemoved"), ["AI3"]);
assert.equal(state().singleWounds, 1);
assert.equal(state().bpDamage.length, 1);
assert.equal(kindOf(state().bpDamage[0]), undefined, "固定 BP 不进入损伤堆叠，改用通用损伤");
assertValid();
prepare("M_WingedNightmare", 1, ["AI1"], ["AI1"]);
state().aiRemoved = ids("AI2");
api.resolveWingedNightmareAttack(true);
assert.equal(state().aiPromotionBonusStep, 1);
assert.equal(state().bpTrack.length, 0);

console.log("mob-promotion.test.cjs: 9 mobs, rank fallback, BP3, supply traits, special BP, save and undo passed");
