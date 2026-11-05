const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// 白猿魔「厚皮」是双面卡：正面是 BP，背面承载每个怪物轮都要读的规则。
// 背面必须常驻在「标志行为与特质 · 地形」参考区，并且可以点开预览背面。

const root = path.resolve(__dirname, "..");
const nodes = new Map();
const makeNode = () => ({
  innerHTML: "",
  textContent: "",
  hidden: false,
  value: "",
  dataset: {},
  classList: { add() {}, remove() {}, toggle() {} },
  addEventListener() {},
  querySelectorAll() { return []; },
  closest() { return this; },
  click() {}
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
    createElement: makeNode
  },
  localStorage: {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key)
  },
  confirm: () => true,
  setTimeout: (callback, delay) => {
    const timer = setTimeout(callback, delay);
    timer.unref();
    return timer;
  },
  clearTimeout
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
  "app.js"
]) {
  vm.runInContext(fs.readFileSync(path.join(root, relative), "utf8"), context, { filename: relative });
}

const api = context.window.KF_AIBP_TEST_API;
const battle = () => api.state().battle;
const render = () => {
  api.renderApp();
  return nodes.get("#app").innerHTML;
};
const whiteApeCard = id => context.window.KF_MONSTER_DATA.monsters
  .find(monster => monster.id === "M_WhiteApe").cards.find(card => card.id === id);

api.selectMonster("M_WhiteApe");
api.rebuild();
let html = render();

const panelIndex = html.indexOf("标志行为与特质");
const thickSkinIndex = html.indexOf("thick-skin-reference-card");
assert.ok(panelIndex >= 0, "白猿魔应显示参考区");
assert.ok(thickSkinIndex > panelIndex, "厚皮背面应位于「标志行为与特质 · 地形」区块内");
assert.match(html, /background-image:url\("\/assets\/cards\/backs\/white-ape\/back-18\.jpg"\)/,
  "厚皮背面应使用 back-18.jpg");
assert.match(html, /data-preview="M_WhiteApe:BPS:0" data-preview-side="back"/,
  "厚皮背面应可点击预览背面");
assert.match(html, /厚皮（背面）/, "厚皮背面应带有中文标题");
assert.match(html, /怪物轮开始时置于堆顶/, "未击伤时应提示厚皮的回合开始规则");

// 击伤后卡牌移到牌堆旁，参考区提示应切换
battle().ruleState.thickSkinSetAside = true;
html = render();
assert.match(html, /牌堆旁/, "厚皮被击伤后参考区应标注牌堆旁状态");
assert.match(html, /下一个怪物轮开始时回到 BP 牌堆顶/, "击伤后应提示下个怪物轮回到堆顶");
battle().ruleState.thickSkinSetAside = false;

// 背面预览不能被 face 兜底覆盖
api.showPreview(whiteApeCard("M_WhiteApe:BPS:0"), "back");
const modal = nodes.get("#modal").innerHTML;
assert.match(modal, /back-18\.jpg/, "厚皮预览应显示背面图");
assert.match(modal, /厚皮 · THICK SKIN（背面）/, "厚皮预览标题应为背面");

// 厚皮可以暴击结算：置于牌堆旁、不加伤、不晋升，并提示额外攻击
api.selectMonster("M_WhiteApe");
api.rebuild();
api.draw("bp");
assert.equal(battle().activeBP, "M_WhiteApe:BPS:0", "白猿魔首张 BP 应为厚皮");
html = render();
const criticalButton = html.match(/<button[^>]*data-settle="bp:critical"[^>]*>/)[0];
assert.ok(!criticalButton.includes("disabled"), "厚皮作为当前 BP 时应可点击暴击");
const discardButton = html.match(/<button[^>]*data-settle="bp:discard"[^>]*>/)[0];
assert.ok(discardButton.includes("disabled"), "厚皮仍不可弃置（卡背要求忽略与牌堆的互动）");

api.settle("bp", "critical");
assert.equal(battle().ruleState.thickSkinSetAside, true, "厚皮暴击后应置于牌堆旁");
assert.equal(battle().activeBP, "", "暴击结算后不应残留当前 BP");
assert.equal(battle().singleWounds + battle().doubleWounds * 2, 0, "厚皮不进损伤堆");
assert.equal(battle().bpDamage.length, 0, "厚皮不应加入损伤牌");
assert.match(battle().ruleState.ruleNotice, /额外攻击/, "暴击应提示可立即执行一次额外攻击");

// 击伤仍然可用，但不带额外攻击提示
api.rebuild();
api.draw("bp");
api.settle("bp", "defeat");
assert.equal(battle().ruleState.thickSkinSetAside, true, "击伤同样置于牌堆旁");
assert.doesNotMatch(battle().ruleState.ruleNotice, /额外攻击/, "击伤不应提示额外攻击");

// 其他 Boss 不应出现厚皮
api.selectMonster("M_BogWitch");
api.rebuild();
assert.doesNotMatch(render(), /thick-skin-reference-card/, "非白猿魔不应出现厚皮背面卡");

console.log("thick-skin tests passed: 背面常驻参考区、击伤状态切换、背面预览、暴击结算、弃置仍禁用、其他 Boss 不受影响");
