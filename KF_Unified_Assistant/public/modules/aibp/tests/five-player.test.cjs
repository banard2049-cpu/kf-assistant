const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Five-player mode (rulebook p.77): the Accursed Persistence trait BP and the fifth knight start.
const root = path.resolve(__dirname, "..");
const makeNode = () => ({
  innerHTML: "", textContent: "", hidden: false, value: "", dataset: {},
  classList: { add() {}, remove() {}, toggle() {} },
  addEventListener() {}, querySelectorAll() { return []; }, closest() { return this; }, click() {},
});
const nodes = new Map();
const nodeFor = selector => {
  if (!nodes.has(selector)) nodes.set(selector, makeNode());
  return nodes.get(selector);
};
const storage = new Map();
const toasts = [];
const context = vm.createContext({
  console, structuredClone, Date, Math, JSON, Blob,
  URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} },
  document: { querySelector: nodeFor, querySelectorAll: () => [], createElement: makeNode },
  localStorage: {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
  },
  confirm: () => true,
  setTimeout: (callback, delay) => { const timer = setTimeout(callback, delay); timer.unref(); return timer; },
  clearTimeout,
});
context.window = context;
context.window.KF_AIBP_TESTING = true;
context.window.KF_CAMPAIGN_KINGDOM = "sunken";
context.window.KF_CLASH_PHASE = "full";
context.window.KF_CAMPAIGN_OPTIONS = { fivePlayer: true, leaderSheetId: "s1" };
context.window.KF_CAMPAIGN_PARTY = ["stoneface", "kara", "renholder", "paracelsa", "ser-ubar"]
  .map((knightId, index) => ({ id: `s${index + 1}`, sheetId: `s${index + 1}`, knightId, type: "knight", name: knightId }));

for (const relative of [
  "data/monster-data.js", "data/localized-traits.js", "data/localized-sheets.js", "data/level-config.js",
  "data/mob-activation-config.js", "data/boss-rule-config.js", "data/conflict-setup-data.js",
  "../display/data/conflict-board-data.js", "app.js",
]) {
  vm.runInContext(fs.readFileSync(path.join(root, relative), "utf8"), context, { filename: relative });
}
const nodeToast = nodeFor("#toast");
const api = context.window.KF_AIBP_TEST_API;
const battle = () => api.state().battle;
const plain = value => JSON.parse(JSON.stringify(value));

// A boss clash in five-player mode starts with the trait BP on its active side.
const boss = context.window.KF_MONSTER_DATA.monsters.find(monster =>
  !["M_Ratwolves", "M_PalebloodWorms"].includes(monster.id) && monster.cards.some(card => card.kind === "BP1")
  && monster.cards.some(card => card.kind === "SIG") && context.window.KF_CONFLICT_BOARD_DATA.layouts.some(layout => layout.monsterId === monster.id));
api.selectMonster(boss.id);
api.rebuild();
assert.deepEqual(plain(battle().accursed), { side: "active", lastKnight: false }, "五人模式的冲突开局加入生效面的被诅咒的执念");

// While it is active, attacks resolve against it: no BP is drawn.
const deckBefore = battle().bpDeck.length;
api.draw("bp");
assert.equal(battle().activeBP, "", "执念生效时不能抽 BP");
assert.equal(battle().bpDeck.length, deckBefore, "执念生效时 BP 牌组不变");
assert.match(nodeToast.textContent, /被诅咒的执念生效中/, "提示改为对执念结算");
assert.match(api.renderAccursed(), /AT<\/strong> = 0（还没有已揭示的 BP）/, "没有已揭示的 BP 时 AT 为 0");

// Wound: flips, no escalation, nothing added to the wound stack.
const woundsBefore = battle().singleWounds + battle().doubleWounds * 2;
const aiBefore = plain(battle().aiDeck).sort();
api.resolveAccursed("wound");
assert.equal(battle().accursed.side, "dormant", "造成损伤后翻到休眠面");
assert.equal(battle().singleWounds + battle().doubleWounds * 2, woundsBefore, "对执念造成损伤不计入损伤堆叠");
assert.deepEqual(plain(battle().aiDeck).sort(), aiBefore, "对执念造成损伤不晋升");
assert.match(api.renderAccursed(), /怪物轮开始：翻回生效面/);

// Dormant: BPs can be drawn again, and the monster round flips it back.
api.draw("bp");
assert.ok(battle().activeBP, "执念休眠时照常抽 BP");
api.settle("bp", "discard");
api.flipAccursedForRound();
assert.equal(battle().accursed.side, "active", "怪物轮开始时翻回生效面");
assert.ok(api.accursedRevealedBps().length >= 1, "弃牌堆里的 BP 算作已揭示");
assert.match(api.renderAccursed(), /取下列已揭示 BP 中最高的 AT/, "有已揭示的 BP 时列出它们以确定 AT");

// Fail: chain break, the signature routine is shown, then it flips.
api.resolveAccursed("fail");
const signature = boss.cards.find(card => card.kind === "SIG");
assert.equal(battle().ruleState.ruleCard, signature.id, "未造成损伤时立即展示标志行为");
assert.equal(battle().accursed.side, "dormant");
api.completeRuleCard?.();

// Critical: flips without escalation and announces the bonus attack.
api.flipAccursedForRound();
api.resolveAccursed("critical");
assert.equal(battle().accursed.side, "dormant");
assert.match(battle().ruleState.ruleNotice, /额外攻击/, "关键损伤提示可进行一次额外攻击");

// One knight left: it goes dormant and the monster round no longer flips it.
api.flipAccursedForRound();
api.setAccursedLastKnight(true);
assert.deepEqual(plain(battle().accursed), { side: "dormant", lastKnight: true });
api.flipAccursedForRound();
assert.equal(battle().accursed.side, "dormant", "只剩一名骑士时不再翻回");

// Undo restores the previous side.
api.setAccursedLastKnight(false);
api.flipAccursedForRound();
assert.equal(battle().accursed.side, "active");
api.undo();
assert.equal(battle().accursed.side, "dormant", "翻面可以撤销");

// Saved data keeps the trait BP; undo above already reloaded the battle through the normalizer.
assert.deepEqual(plain(api.state()).battle.accursed, { side: "dormant", lastKnight: false }, "存档数据包含执念当前的一面");

// A clash saved before five-player mode existed gets the trait BP when it is loaded.
const legacy = plain(api.state());
const legacyId = legacy.selectedMonsterId || legacy.battle.monsterId;
delete legacy.battle.accursed;
if (legacy.encounters?.[legacyId]) delete legacy.encounters[legacyId].battle.accursed;
const restored = api.validateState(legacy);
assert.deepEqual(plain(restored.battle.accursed), { side: "active", lastKnight: false },
  "五人模式下载入旧冲突会补上被诅咒的执念");

// The fifth knight starts on a free square beside another knight.
const board = battle().conflictBoard;
assert.equal(board.extraPlacements.length, 1, "五人模式在版图上补一个骑士起始位");
const extra = board.extraPlacements[0];
const layout = context.window.KF_CONFLICT_BOARD_DATA.layouts.find(item => item.id === board.layoutId);
const occupied = layout.placements.some(item => extra.rowStart >= item.rowStart && extra.rowStart <= item.rowEnd
  && extra.columnStart >= item.columnStart && extra.columnStart <= item.columnEnd);
assert.equal(occupied, false, "第五名骑士的起始格是空格");
const besideKnight = layout.placements.filter(item => item.kind === "knight")
  .some(item => Math.abs(item.rowStart - extra.rowStart) + Math.abs(item.columnStart - extra.columnStart) === 1);
assert.ok(besideKnight, "第五名骑士放在任一骑士旁边");
assert.equal(board.knightAssignments.length, 5, "五名骑士都分配了起始位");
assert.ok(board.knightAssignments.some(item => item.placementId === extra.id), "第五名骑士分配到补充的起始位");

// Mob clash: the active trait BP also stops revealing a mob BP.
const mob = context.window.KF_MONSTER_DATA.monsters.find(monster => monster.id === "M_PalebloodWorms");
api.selectMonster(mob.id);
api.rebuild();
assert.equal(battle().accursed.side, "active");
const occupiedSlot = battle().bpTrack.findIndex(slot => slot.id && !slot.revealed);
api.selectMob(occupiedSlot);
assert.equal(battle().activeBP, "", "执念生效时不翻开杂兵 BP");
assert.equal(battle().bpTrack[occupiedSlot].revealed, false);
api.resolveAccursed("wound");
api.startMobRound();
assert.equal(battle().accursed.side, "active", "杂兵新回合（怪物轮开始）时执念翻回生效面");

// Four-player clashes are unchanged.
context.window.KF_CAMPAIGN_OPTIONS = { fivePlayer: false, leaderSheetId: "s1" };
context.window.KF_CAMPAIGN_PARTY = context.window.KF_CAMPAIGN_PARTY.slice(0, 4);
api.selectMonster(boss.id);
api.rebuild();
assert.equal(battle().accursed, null, "四人局没有被诅咒的执念");
assert.equal(battle().conflictBoard.extraPlacements.length, 0, "四人局不补骑士起始位");
assert.equal(api.renderAccursed(), "", "四人局不显示执念面板");

console.log("AIBP five-player mode: Accursed Persistence sides, attack redirection, flips, fifth knight start verified");
