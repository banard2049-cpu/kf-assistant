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
  Math,
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

// 回生按损伤堆叠顺序处理，扣除对应损伤且可撤销。
api.selectMonster("M_BogWitch");
rebuild("full", 1);
assert.match(nodes.get("#app").innerHTML, /data-heal[^>]*disabled>heal<\/button>/,
  "损伤堆叠为空时 heal 应禁用");
const emptyHealHistory = api.state().history.length;
api.heal();
assert.equal(api.state().history.length, emptyHealHistory, "空堆回生不应创建撤销记录");
api.addWound("single");
const bottomHealWound = state().bpDamage.at(-1);
api.addWound("double");
const topHealWound = state().bpDamage.at(-1);
api.renderApp();
assert.match(nodes.get("#app").innerHTML, /data-heal[^>]*(?<!disabled)>heal<\/button>/,
  "存在损伤时 BP 区应显示 heal 按钮");
nodes.get("[data-heal]").click();
assert.deepEqual(Array.from(state().bpDamage), [bottomHealWound], "首领回生只应取顶部卡");
assert.ok(state().bpRemoved.includes(topHealWound), "双重损伤卡应暂时移除");
assert.equal(state().singleWounds, 1, "回生双重卡不应减少单重损伤");
assert.equal(state().doubleWounds, 0, "回生双重卡应减少两点损伤");
assert.equal(state().bpDamageTypes[topHealWound], undefined, "移除后应清理损伤类型记录");
assert.ok(api.validateState(JSON.parse(JSON.stringify(api.state()))).battle.bpRemoved.includes(topHealWound),
  "被回生移除的损伤卡应保留在存档中");
api.undo();
assert.equal(state().bpDamage.at(-1), topHealWound, "撤销应恢复顶部卡与顺序");
assert.equal(state().doubleWounds, 1, "撤销应恢复双重损伤");
api.heal();
delete state().bpDamageTypes; // 旧存档没有损伤类型元数据。
api.heal();
assert.equal(state().singleWounds, 0, "旧存档的单重损伤卡也应正确回生");

const healedBossBp = state().bpDeck[0];
api.moveAibpCard(healedBossBp, "removed");
state().bpRemoved = state().bpRemoved.filter(id => id !== healedBossBp);
api.addWound("single", healedBossBp);
api.heal();
assert.ok(state().bpRemoved.includes(healedBossBp), "首领 BP 回生后应进入移除区");
assert.ok(!state().bpDeck.includes(healedBossBp), "回生 BP 不应回到首领牌组");

api.selectMonster("M_Ironcast");
rebuild("full", 1);
// 初始 BP 随机混有三个阶数；此组用例固定选择 BP1 来验证单重损伤。
state().bpTrack.sort((a, b) => Number(!a.id.includes(":BP1:")) - Number(!b.id.includes(":BP1:")));
api.selectMob(0);
api.settleMob("defeat");
api.selectMob(2);
api.settleMob("defeat");
const healedMobBp = state().bpDamage.at(-1);
api.selectMob(1);
const selectedBeforeHeal = state().activeBP;
api.heal();
assert.equal(state().bpTrack[0].id, healedMobBp, "回生应填最左空位而非原来的编号位");
assert.equal(state().bpTrack[2].id, "", "回生不应填更右侧空位");
assert.equal(state().bpTrack[0].revealed, false, "回生 BP 应面朝下");
assert.equal(state().singleWounds, 1, "回生的杂兵 BP 不再计入损伤");
assert.equal(state().activeBP, selectedBeforeHeal, "回生不应改变当前选中的其他杂兵");
assert.match(nodes.get("#app").innerHTML, /1 号数字底座环.*距回生效果来源最近的空格.*朝最多骑士方向/,
  "BP 区应显示模型编号、放置位置和朝向提示");
api.undo();
assert.equal(state().bpDamage.at(-1), healedMobBp, "撤销杂兵回生应恢复损伤堆叠");
assert.equal(state().bpTrack[0].id, "", "撤销应恢复最左空位");
assert.equal(state().singleWounds, 2, "撤销应恢复损伤计数");
const ironcastMonster = context.window.KF_MONSTER_DATA.monsters.find(monster => monster.id === "M_Ironcast");
for (const card of ironcastMonster.cards.filter(card => /^BP[123]$/.test(card.kind))) {
  if (state().bpTrack.every(slot => slot.id)) break;
  if (state().bpTrack.some(slot => slot.id === card.id) || state().bpDamage.includes(card.id)) continue;
  api.moveAibpCard(card.id, "mob-left");
}
assert.ok(state().bpTrack.every(slot => slot.id), "测试满轨分支前应填满轨道");
api.heal();
assert.ok(state().bpDiscard.includes(healedMobBp), "满轨回生应弃置 BP");
assert.equal(state().singleWounds, 1, "满轨弃置也应扣除对应损伤");
assert.match(state().healNotice, /杂兵轨已满.*不摆放模型/);
api.undo();
assert.equal(state().bpDamage.at(-1), healedMobBp, "满轨弃置应可撤销");

rebuild("full", 3);
state().bpTrack.sort((a, b) => Number(!a.id.includes(":BP1:")) - Number(!b.id.includes(":BP1:")));
api.selectMob(0);
api.settleMob("defeat");
const rank3HealBp = ironcastMonster.cards.find(card => card.kind === "BP3").id;
api.moveAibpCard(rank3HealBp, "mob-left");
api.addWound("single");
api.selectMob(0);
api.settleMob("defeat");
assert.equal(state().bpDamageTypes[rank3HealBp], "double", "杂兵 BP3 普通击伤应记录双重损伤");
const savedHeal = api.validateState(JSON.parse(JSON.stringify(api.state())));
assert.equal(savedHeal.battle.bpDamageTypes[rank3HealBp], "double", "实际损伤类型应在读档后保留");
api.heal();
assert.equal(state().singleWounds, 2, "回生杂兵 BP3 不应减少其他单重损伤");
assert.equal(state().doubleWounds, 0, "回生普通击伤的杂兵 BP3 应扣除双重损伤");
assert.equal(state().bpTrack[0].markerTokens["token-armor"], 1, "铁铸亡者回生应应用生成时的盔甲规则");
const beforeNonBpHeal = JSON.stringify(state());
api.heal();
assert.equal(JSON.stringify(state()), beforeNonBpHeal, "杂兵堆顶不是 BP 时应提示并保持状态");
assert.match(nodes.get("#toast").textContent, /顶部不是 BP/);
api.selectMob(0);
api.settleMob("critical");
const singleBeforeCriticalHeal = state().singleWounds;
assert.equal(state().doubleWounds, 1, "杂兵 BP3 暴击应加入双重损伤");
api.heal();
assert.equal(state().doubleWounds, 0, "杂兵 BP3 暴击回生应扣除对应双重损伤");
assert.equal(state().singleWounds, singleBeforeCriticalHeal, "暴击回生不应减少其他单重损伤");
api.rebuild();
assert.equal(state().healNotice, "", "重建冲突应清空回生提示");
assert.equal(Object.keys(state().bpDamageTypes).length, 0, "重建冲突应清空损伤类型记录");

// 规则书第 61 页：杂兵 BP3 普通击伤与关键损伤均计双重，BP1/BP2 均计单重。
for (const rank of [1, 2, 3]) {
  for (const action of ["defeat", "critical"]) {
    rebuild("full", 1);
    const bp = ironcastMonster.cards.find(card => card.kind === `BP${rank}`);
    api.moveAibpCard(state().bpTrack[0].id, "removed");
    api.moveAibpCard(bp.id, "mob-left");
    api.selectMob(0);
    const button = nodes.get("#app").innerHTML.match(/<button[^>]*data-settle="bp:defeat"[^>]*>/)?.[0];
    assert.ok(button && !button.includes("disabled"), `杂兵 BP${rank} 应统一使用击伤按钮`);
    assert.doesNotMatch(nodes.get("#app").innerHTML, /data-settle="bp:critical"/, "杂兵不需要单独的暴击按钮");
    api.settle("bp", action);
    assert.ok(state().bpDamage.includes(bp.id), `BP${rank} ${action} 应进入损伤堆叠`);
    assert.equal(state().singleWounds, rank < 3 ? 1 : 0);
    assert.equal(state().doubleWounds, rank === 3 ? 1 : 0);
    assert.equal(state().bpTrack[0].id, "", "被击败杂兵应移出轨道");
    api.undo();
    assert.equal(state().activeBP, bp.id, "撤销应恢复当前 BP");
    assert.equal(state().singleWounds + state().doubleWounds, 0, "撤销应恢复损伤计数");
  }
}

console.log("AIBP heal tests passed");
