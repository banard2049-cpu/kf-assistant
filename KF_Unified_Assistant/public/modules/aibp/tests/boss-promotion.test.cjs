const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const nodes = new Map();
const makeNode = () => ({
  innerHTML: "",
  textContent: "",
  hidden: false,
  value: "",
  dataset: {},
  listeners: {},
  classList: { add() {}, remove() {}, toggle() {} },
  addEventListener(event, callback) { this.listeners[event] = callback; },
  querySelectorAll() { return []; },
  closest() { return this; },
  click() { this.listeners.click?.(); },
});
const nodeFor = selector => {
  if (!nodes.has(selector)) nodes.set(selector, makeNode());
  return nodes.get(selector);
};
const storage = new Map();
const context = vm.createContext({
  console,
  structuredClone,
  Date,
  Math: Object.create(Math),
  JSON,
  Blob,
  URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} },
  document: {
    querySelector: nodeFor,
    querySelectorAll: () => [],
    createElement: makeNode,
  },
  localStorage: {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
  },
  confirm: () => true,
  setTimeout: (callback, delay) => {
    const timer = setTimeout(callback, delay);
    timer.unref();
    return timer;
  },
  clearTimeout,
});
context.window = context;
context.window.KF_AIBP_TESTING = true;
context.window.KF_CAMPAIGN_KINGDOM = "sunken";
context.window.KF_CLASH_PHASE = "full";

for (const relative of [
  "data/monster-data.js",
  "data/localized-traits.js",
  "data/localized-sheets.js",
  "data/level-config.js",
  "data/mob-activation-config.js",
  "data/boss-rule-config.js",
  "data/conflict-setup-data.js",
  "../display/data/conflict-board-data.js",
  "app.js",
]) {
  vm.runInContext(fs.readFileSync(path.join(root, relative), "utf8"), context, { filename: relative });
}

const api = context.window.KF_AIBP_TEST_API;
const state = () => api.state().battle;
const rebuild = (phase, level = state().level) => {
  state().clashPhase = phase;
  state().level = level;
  api.rebuild();
};


// 首领晋升规则回归：缺阶回退、AI3、供应耗尽、洗回、陨落骑士、AI0。
const monster = () => context.window.KF_MONSTER_DATA.monsters.find(m => m.id === state().monsterId);
const ids = kind => Array.from(monster().cards.filter(card => card.kind === kind), card => card.id);
const kindOf = id => monster().cards.find(card => card.id === id)?.kind;
const kinds = zone => Array.from(state()[zone], kindOf);
function prepare(id = "M_BogWitch", level = 1) {
  api.selectMonster(id);
  rebuild("full", level);
  Object.assign(state(), {
    aiDeck: [], aiDiscard: [], aiRemoved: [],
    bpDeck: [], bpDiscard: [], bpRemoved: [], bpDamage: [], bpDamageTypes: {},
    activeAI: "", activeBP: "", singleWounds: 0, doubleWounds: 0,
    aiPromotionBonusStep: 0,
  });
  state().ruleState.doppelgangers = [];
  state().ruleState.ruleCard = "";
}
function hit(rank, action = "defeat", cardId = ids("BP" + rank)[0]) {
  assert.ok(cardId);
  state().activeBP = "";
  state().bpDeck = [cardId, ...state().bpDeck.filter(id => id !== cardId)];
  api.draw("bp");
  api.settle("bp", action);
}
function assertValid() {
  const raw = JSON.parse(JSON.stringify(api.state()));
  raw.encounters = {};
  api.validateState(raw);
}

prepare();
const missingAi1Source = ids("AI2")[0];
state().aiDeck = [missingAi1Source];
hit(1);
assert.deepEqual(Array.from(state().aiRemoved), [missingAi1Source]);
assert.deepEqual(kinds("aiDeck"), ["AI3"], "没有 AI1 时按 AI2 晋升");
assert.equal(state().singleWounds, 1);
assertValid();
api.undo();
assert.deepEqual(Array.from(state().aiDeck), [missingAi1Source]);

prepare();
state().aiDeck = [ids("AI3")[0]];
hit(1);
assert.deepEqual(kinds("aiRemoved"), ["AI3"], "连续缺 AI1/AI2 时采用 BP3 的 AI 晋升");
assert.deepEqual(kinds("aiDeck"), ["AI3"]);
prepare();
state().aiDeck = [ids("AI1")[0]];
hit(2);
assert.deepEqual(kinds("aiRemoved"), ["AI1"], "缺 AI2 时按下一行移除全局最低阶");
assert.deepEqual(kinds("aiDeck"), ["AI3"]);

for (const action of ["defeat", "critical"]) {
  prepare();
  const ai3 = ids("AI3")[0];
  state().aiDeck = [ai3];
  state().bpDeck = [ids("BP1")[0]];
  hit(3, action);
  assert.deepEqual(Array.from(state().aiRemoved), [ai3], "BP3 可移除最低阶 AI3");
  assert.deepEqual(kinds("aiDeck"), ["AI3"]);
  assert.equal(state().doubleWounds, 1);
  assertValid();
}

// 搜索相同阶数时优先牌组；BP3 则先找全局最低阶，再在该阶内优先牌组。
prepare();
const deckAi1 = ids("AI1")[0], discardAi1 = ids("AI1")[1];
state().aiDeck = [deckAi1, ids("AI2")[0]];
state().aiDiscard = [discardAi1];
hit(1);
assert.deepEqual(Array.from(state().aiRemoved), [deckAi1]);
assert.deepEqual(Array.from(state().aiDiscard), [discardAi1]);
prepare();
const lowestDiscard = ids("AI1")[0], otherDiscard = ids("AI2")[1];
state().aiDeck = [ids("AI2")[0]];
state().aiDiscard = [lowestDiscard, otherDiscard];
hit(3);
assert.deepEqual(Array.from(state().aiRemoved), [lowestDiscard]);
assert.equal(state().aiDiscard.length, 0);
assert.ok(state().aiDeck.includes(otherDiscard));

// 新插入卡是唯一有效卡时，将弃牌洗回。AI0 不计作可晋升卡。
prepare();
const bpDiscard = ids("BP3")[0], aiDiscard = ids("AI3")[0];
state().bpDiscard = [bpDiscard];
state().aiDeck = [ids("AI1")[0]];
state().aiDiscard = [aiDiscard];
hit(1);
assert.equal(state().bpDiscard.length, 0);
assert.ok(state().bpDeck.includes(bpDiscard));
assert.equal(state().aiDiscard.length, 0);
assert.ok(state().aiDeck.includes(aiDiscard));
assertValid();
prepare();
state().bpDeck = [ids("BP1")[0]];
state().bpDiscard = [ids("BP2")[0]];
hit(3);
assert.equal(state().bpDiscard.length, 0, "BP3 移除最后一张牌后，插入新卡也应洗回弃牌");
assert.deepEqual(kinds("bpDeck").sort(), ["BP2", "BP3", "BP3"].sort());
assert.equal(kindOf(state().bpDeck.at(-1)), "BP3", "普通 BP3 最后回到牌底");

prepare("M_Toadragon");
const opening = ids("AI0")[0];
state().aiDeck = [opening, ids("AI1")[0]];
state().aiDiscard = [ids("AI3")[0]];
context.Math.random = () => 0;
hit(1);
assert.equal(state().aiDeck[0], opening, "晋升插牌和洗牌后 AI0 仍在顶部");
assert.equal(state().aiDiscard.length, 0);
assertValid();
delete context.Math.random;

// 耗尽目标供应：仍移除晋升源，永久加成依序累积、保存、撤销、重置。
prepare();
state().aiRemoved = ids("AI2");
state().aiDeck = [ids("AI1")[0]];
hit(1);
assert.equal(state().aiPromotionBonusStep, 1);
assert.equal(state().aiDeck.length, 0);
assert.ok(state().aiRemoved.includes(ids("AI1")[0]));
assert.match(nodes.get("#app").innerHTML, /data-ai-promotion-bonus[\s\S]*每个命中 \+1 活力损失/);
assertValid();
const saved = api.validateState(JSON.parse(JSON.stringify({...api.state(), encounters: {}})));
assert.equal(saved.battle.aiPromotionBonusStep, 1);
const legacy = JSON.parse(JSON.stringify(saved));
legacy.encounters = {};
delete legacy.battle.aiPromotionBonusStep;
assert.equal(api.validateState(legacy).battle.aiPromotionBonusStep, 0, "旧存档默认无永久加成");
legacy.battle.aiPromotionBonusStep = 2.5;
assert.equal(api.validateState(legacy).battle.aiPromotionBonusStep, 2, "加成进度必须为整数");
api.undo();
assert.equal(state().aiPromotionBonusStep, 0);
assert.ok(state().aiDeck.includes(ids("AI1")[0]));
for (let step = 1; step <= 4; step++) {
  state().aiRemoved = ids("AI2");
  state().aiDeck = [ids("AI1")[0]];
  hit(1, "defeat", ids("BP1")[step - 1]);
  assert.equal(state().aiPromotionBonusStep, step);
}
assert.match(nodes.get("#app").innerHTML, /每个命中 \+1 活力损失 · \+1 命中要求 · \+1 闪避骰 · \+1 AT/);
rebuild("full");
assert.equal(state().aiPromotionBonusStep, 0);

prepare();
state().aiDeck = [ids("AI3")[0]];
state().aiRemoved = ids("AI3").slice(1);
hit(3);
assert.equal(state().aiDeck.length, 0);
assert.equal(state().aiPromotionBonusStep, 1, "AI3 供应耗尽也应获得加成");

// BP 供应耗尽不移除最低 BP，AI 仍独立晋升。
prepare();
state().bpRemoved = ids("BP3").slice(1);
state().bpDeck = [ids("BP1")[0]];
state().bpDiscard = [ids("BP2")[0]];
state().aiDeck = [ids("AI1")[0]];
hit(3);
assert.ok(state().bpDeck.includes(ids("BP1")[0]));
assert.equal(state().bpDiscard.length, 0);
assert.deepEqual(kinds("aiDeck"), ["AI3"]);
assertValid();

// 陨落骑士：分别晋升最低 BP 和最低 AI，BP 供应为空也不阻断 AI。
for (const emptyBpSupply of [false, true]) {
  prepare("M_PuppetKing");
  state().bpDeck = [ids("BP2")[0]];
  if (emptyBpSupply) state().bpRemoved = ids("BP3");
  state().aiDeck = [ids("AI1")[0]];
  api.damagePuppetFallenKnight();
  api.damagePuppetFallenKnight();
  assert.deepEqual(kinds("aiRemoved"), ["AI1"]);
  assert.deepEqual(kinds("aiDeck"), ["AI2"]);
  assert.deepEqual(kinds("bpRemoved"), emptyBpSupply ? ids("BP3").map(() => "BP3") : ["BP2"]);
  assert.equal(state().singleWounds, 1);
  assertValid();
}
prepare("M_PuppetKing");
state().aiDeck = [ids("AI3")[0]];
api.damagePuppetFallenKnight();
api.damagePuppetFallenKnight();
assert.deepEqual(kinds("aiRemoved"), ["AI3"], "陨落骑士没有低阶 BP 时仍晋升 AI3");

// 手动 AI 晋升使用相同的最高阶与耗尽处理。
prepare();
state().aiDeck = [ids("AI3")[0]];
api.promoteLowest("ai");
assert.deepEqual(kinds("aiRemoved"), ["AI3"]);
assert.deepEqual(kinds("aiDeck"), ["AI3"]);
prepare();
state().aiDeck = [ids("AI1")[0]];
state().aiRemoved = ids("AI2");
api.promoteLowest("ai");
assert.equal(state().aiPromotionBonusStep, 1);

// 所有 13 个首领：正常 BP 使用通用规则，幼龙与装甲巨龙保留特殊处理。
const bossIds = [
  "M_BogWitch", "M_DevilAncientDusk", "M_DevilSmeltedFears", "M_Eggknight",
  "M_KnightFen", "M_Knighteater", "M_Panzerdragon", "M_PuppetKing",
  "M_Stonemason", "M_KingLaidLow", "M_Toadragon", "M_WhiteApe", "M_YoungDevour",
];
for (const bossId of bossIds) {
  prepare(bossId);
  const rule = context.window.KF_BOSS_RULE_CONFIG[bossId];
  const normalBp = ids("BP1").find(id => !rule?.fingers?.[id]);
  state().aiDeck = [ids("AI1")[0]];
  const aiBefore = Array.from(state().aiDeck);
  hit(1, "defeat", normalBp);
  if (bossId === "M_YoungDevour" || bossId === "M_Panzerdragon") {
    assert.deepEqual(Array.from(state().aiDeck), aiBefore, bossId + " 不执行击伤晋升");
    assert.equal(state().aiRemoved.length, 0);
    assert.equal(state().aiPromotionBonusStep, 0);
  } else {
    assert.deepEqual(kinds("aiRemoved"), ["AI1"], bossId + " 移除等阶 AI");
    assert.deepEqual(kinds("aiDeck"), ["AI2"], bossId + " 加入高阶 AI");
    assert.equal(state().singleWounds, 1);
  }
  assertValid();
}
prepare("M_WhiteApe");
const thickSkin = context.window.KF_BOSS_RULE_CONFIG.M_WhiteApe.cards.thickSkin;
state().aiDeck = [ids("AI1")[0]];
hit(0, "defeat", thickSkin);
assert.equal(state().aiRemoved.length, 0);
assert.equal(state().singleWounds, 0);
for (const bossId of ["M_Knighteater", "M_Stonemason"]) {
  prepare(bossId, 4);
  state().aiDeck = [ids("AI1")[0]];
  if (bossId === "M_Knighteater") state().ruleState.knighteater.berserk = true;
  else {
    state().ruleState.stonemason.direction = "front";
    state().ruleState.stonemason.armor.front = 2;
  }
  hit(1);
  assert.equal(state().singleWounds, 0);
  assert.equal(state().aiRemoved.length, 0);
  assert.equal(state().aiPromotionBonusStep, 0);
}
console.log("boss-promotion.test.cjs: all promotion regressions and 13 boss branches passed");
