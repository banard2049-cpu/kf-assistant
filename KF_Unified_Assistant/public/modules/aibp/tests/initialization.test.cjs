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
  classList: { add() {}, remove() {}, toggle() {} },
  addEventListener() {},
  querySelectorAll() { return []; },
  closest() { return this; },
  click() {},
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

assert.doesNotMatch(api.renderBossRules(), /BOSS RULES|当前 Boss 专用操作/,
  "所有 Boss 专用面板都不应显示共用标题文字");

assert.ok(fs.existsSync(path.join(root, "assets/traits-zh/devour-dragon-belly.png")),
  "巨兽之腹特质图必须位于 AIBP 本地资源目录");
state().conflictLocation = "巨兽之腹";
api.renderApp();
let devourDragonHtml = nodes.get("#app").innerHTML;
assert.ok(devourDragonHtml.includes("has-devour-dragon-trait"),
  "拥有“贪食巨龙来了！”状态时，大卡应预留右侧特质图区域");
assert.ok(devourDragonHtml.includes("assets/traits-zh/devour-dragon-belly.png"),
  "拥有“贪食巨龙来了！”状态时，大卡右侧应显示巨兽之腹特质图");
state().conflictLocation = "";
api.renderApp();
devourDragonHtml = nodes.get("#app").innerHTML;
assert.ok(!devourDragonHtml.includes("devour-dragon-belly.png"),
  "未拥有“贪食巨龙来了！”状态时，不应显示巨兽之腹特质图");

api.selectMonster("M_Panzergeists");
const panzergeists = context.window.KF_MONSTER_DATA.monsters.find(monster => monster.id === "M_Panzergeists");
const exhaustPanzergeistAi2Supply = () => {
  const ai2Supply = panzergeists.cards.filter(card => card.kind === "AI2")
    .map(card => card.id)
    .filter(id => !state().aiDeck.includes(id) && !state().aiDiscard.includes(id) && !state().aiRemoved.includes(id));
  state().aiRemoved.push(...ai2Supply);
};
rebuild("full", 1);
exhaustPanzergeistAi2Supply();
api.promoteLowest("ai");
assert.ok(state().bpTrack.filter(slot => slot.id).every(slot => !slot.markerTokens["token-armor"]),
  "等级 1 的装甲幽鬼在 AI 晋升供应为空时不应触发装甲倾泻");

rebuild("full", 2);
exhaustPanzergeistAi2Supply();
const panzergeistBpRanks = state().bpTrack.map(slot => ({
  rank: Number(panzergeists.cards.find(card => card.id === slot.id)?.kind.match(/^BP([123])$/)?.[1] || 0)
}));
const lowestPanzergeistBpRank = Math.min(...panzergeistBpRanks.filter(item => item.rank).map(item => item.rank));
const lowestPanzergeistBpIndex = panzergeistBpRanks.findIndex(item => item.rank === lowestPanzergeistBpRank);
api.promoteLowest("ai");
assert.equal(state().bpTrack[lowestPanzergeistBpIndex].markerTokens["token-armor"], 1,
  "等级 2+ 的装甲幽鬼在 AI 晋升供应为空时，应在最低阶且最左侧的 BP 上放置盔甲指示物");
assert.equal(state().bpTrack.filter(slot => slot.markerTokens["token-armor"]).length, 1,
  "装甲倾泻每次晋升只应影响一张 BP");
assert.match(state().ruleState.ruleNotice, /装甲倾泻.*AI2 晋升供应为空.*最低阶 BP1/,
  "装甲倾泻应显示替代晋升的目标和原因");
api.undo();
assert.ok(state().bpTrack.filter(slot => slot.id).every(slot => !slot.markerTokens["token-armor"]),
  "撤销装甲倾泻时应移除本次放置的盔甲指示物");
state().aiRemoved = [...new Set([...state().aiRemoved, ...state().aiDeck, ...state().aiDiscard])];
state().aiDeck = [];
state().aiDiscard = [];
api.promoteLowest("ai");
assert.equal(state().bpTrack[lowestPanzergeistBpIndex].markerTokens["token-armor"], 1,
  "等级 2+ 的装甲幽鬼没有任何低阶 AI 可晋升时，也应触发装甲倾泻");
assert.match(state().ruleState.ruleNotice, /没有 AI 可供晋升/,
  "没有低阶 AI 时，装甲倾泻提示应说明替代原因");
rebuild("full", 2);

const pumpkinheadData = context.window.KF_MONSTER_DATA.monsters.find(monster => monster.id === "M_Pumpkinhead");
const pumpkinheadTraits = pumpkinheadData.cards.filter(card => card.kind === "Trait_SK" || card.kind === "Trait_POS");
assert.equal(pumpkinheadTraits.length, 2, "南瓜头精应只有两张不同王国的 Trait");
assert.equal(pumpkinheadTraits.map(card => card.id).sort().join(","),
  "M_Pumpkinhead:Trait_POS:25,M_Pumpkinhead:Trait_SK:24");
assert.equal(pumpkinheadData.pools.Trait_SK, 1);
assert.equal(pumpkinheadData.pools.Trait_POS, 1);

const expectedComponentCounts = {
  M_BogWitch: [18, 19, 0, 37],
  M_DevilAncientDusk: [19, 18, 0, 37],
  M_DevilSmeltedFears: [19, 18, 1, 38],
  M_Eggknight: [19, 18, 0, 37],
  M_FirstmenLictor: [18, 19, 6, 43],
  M_FirstmenWarriors: [19, 18, 3, 40],
  M_HauntOf: [19, 9, 0, 28],
  M_Ironcast: [19, 18, 0, 37],
  M_KingLaidLow: [19, 18, 0, 37],
  M_KnightFen: [19, 18, 3, 40],
  M_Knighteater: [18, 19, 2, 39],
  M_PalebloodWorms: [13, 12, 0, 25],
  M_Panzerdragon: [20, 18, 3, 41],
  M_Panzergeists: [10, 11, 0, 21],
  M_Pumpkinhead: [14, 6, 2, 22],
  M_PuppetKing: [19, 18, 2, 39],
  M_Ratwolves: [11, 9, 2, 22],
  M_Stonemason: [18, 19, 0, 37],
  M_Toadragon: [20, 18, 0, 38],
  M_WhiteApe: [19, 18, 3, 40],
  M_WingedNightmare: [16, 1, 1, 18],
  M_YoungDevour: [18, 20, 3, 41],
};
const ttsfMonsterIds = new Set([
  "M_BogWitch", "M_FirstmenLictor", "M_Knighteater",
  "M_Panzergeists", "M_Stonemason", "M_YoungDevour",
]);
for (const monster of context.window.KF_MONSTER_DATA.monsters) {
  const kinds = monster.cards.filter(card => card.kind !== "EncounterCard").map(card => card.kind);
  const ai = ttsfMonsterIds.has(monster.id)
    ? kinds.filter(kind => /^AI[1-3]$/.test(kind)).length
    : kinds.filter(kind => /^AI[0-3]$/.test(kind)).length + kinds.filter(kind => kind === "SIG").length;
  const bp = ttsfMonsterIds.has(monster.id)
    ? kinds.filter(kind => /^BP/.test(kind) || kind === "SIG" || kind === "AI0").length
    : kinds.filter(kind => /^BP[1-3]$/.test(kind)).length
      + (monster.id === "M_WhiteApe" ? 0 : kinds.filter(kind => kind === "BPS").length);
  const trait = kinds.filter(kind => /^Trait/.test(kind)).length
    + kinds.filter(kind => kind === "BPX").length
    + (monster.id === "M_WhiteApe" ? kinds.filter(kind => kind === "BPS").length : 0);
  assert.deepEqual([ai, bp, trait, kinds.length], expectedComponentCounts[monster.id],
    `${monster.name} 的 AI/BP/Trait/总数应与组件表一致`);
}
const smelterOubliette = context.window.KF_MONSTER_DATA.monsters
  .find(monster => monster.id === "M_DevilSmeltedFears").cards
  .find(card => card.kind === "Trait" && card.name === "Smelter Oubliette");
assert.ok(smelterOubliette, "熔怖恶魔应包含图集第 37 格的 Smelter Oubliette Trait");
assert.equal(smelterOubliette.image.index, 37);

const stateBeforeAiCountAudit = JSON.parse(JSON.stringify(api.state()));
api.selectMonster("M_DevilAncientDusk");
const ancientDuskRules = api.renderBossRules();
assert.equal(ancientDuskRules, "", "远古薄暮恶魔不应渲染任何 Boss 专属操作区");
api.renderApp();
assert.doesNotMatch(nodes.get("#app").innerHTML, /boss-rule-panel|恶魔讨价还价|当前 Patient/,
  "远古薄暮恶魔主界面不应包含 Boss 专属操作面板");
api.selectMonster("M_DevilSmeltedFears");
let smeltedFearsRules = api.renderBossRules();
assert.doesNotMatch(smeltedFearsRules,
  /data-p2-severity|smelted-draw|smelted-stop|ferrobaptism|smelted-equipment|set-oubliette|toggle-gate|当前 Patient|Disaster|窒息事件|囚牢|门禁/,
  "熔铸恐惧恶魔原有 Boss 专属操作应全部移除");
assert.match(smeltedFearsRules, /data-p2-counter="smelted:devilArmor"/,
  "熔铸恐惧恶魔应显示盔甲指示物计数");
assert.match(smeltedFearsRules, /data-rule-action="smelted-bargain-armor"/,
  "熔铸恐惧恶魔应提供讲价弃置盔甲操作");
assert.match(smeltedFearsRules, /class="button secondary smelted-bargain-button"[^>]+aria-label="讲价弃置 1 枚盔甲到窖牢"[^>]*>&#8594;<\/button>/,
  "讲价弃置盔甲操作应显示为带有完整无障碍说明的向右箭头");
assert.match(smeltedFearsRules, /<span>窖牢<\/span>/,
  "熔铸恐惧恶魔应以中文展示窖牢");
assert.doesNotMatch(smeltedFearsRules, />Smelter Oubliette</,
  "熔铸恐惧恶魔操作区不应继续显示 Smelter Oubliette 英文名称");
assert.doesNotMatch(smeltedFearsRules, /smelter-oubliette-card|Trait · Smelter Oubliette/,
  "Smelter Oubliette 不应再显示为卡牌");
assert.equal((smeltedFearsRules.match(/class="smelted-armor-icon"/g) || []).length, 2,
  "盔甲与窖牢展示区前都应显示盔甲 Token");
assert.equal((smeltedFearsRules.match(/class="smelted-armor-count"/g) || []).length, 2,
  "盔甲与窖牢的数量都应覆盖显示在 Token 上");
const initialSmeltedArmor = api.state().battle.ruleState.smeltedFears.devilArmor;
api.changeSmeltedArmor("devilArmor", 1);
assert.equal(api.state().battle.ruleState.smeltedFears.devilArmor, initialSmeltedArmor + 1,
  "盔甲指示物应能增加");
assert.equal(api.state().battle.ruleState.ruleNotice, "",
  "手动增减恶魔盔甲时不应显示额外规则提示");
api.changeSmeltedArmor("devilArmor", -1);
assert.equal(api.state().battle.ruleState.smeltedFears.devilArmor, initialSmeltedArmor,
  "盔甲指示物应能减少");
api.bargainDiscardSmeltedArmor();
assert.equal(api.state().battle.ruleState.smeltedFears.devilArmor, initialSmeltedArmor - 1,
  "讲价弃置应减少当前盔甲");
assert.equal(api.state().battle.ruleState.smeltedFears.ironTitheArmor, 1,
  "讲价弃置的盔甲应累计到窖牢");
assert.equal(api.state().battle.ruleState.ruleNotice, "",
  "讲价弃置后不应显示额外规则提示");
smeltedFearsRules = api.renderBossRules();
assert.match(smeltedFearsRules, /data-smelter-oubliette-count>1<\/strong>/,
  "讲价弃置后窖牢区域应显示盔甲数量");

api.selectMonster("M_WhiteApe");
rebuild("full", 1);
assert.equal(state().ruleState.guardians.count, 2,
  "White Ape Troll 冲突开始时应有 2 名先民护卫");
assert.equal(state().ruleState.guardians.slots.join(","), "true,true,false,false,false,false",
  "White Ape Troll 的初始护卫应占据杂兵轨最左侧两个编号位");
assert.equal(state().ruleState.guardians.carrier, 0,
  "Firstman Guardian 共享 BP 初始应位于杂兵轨最左侧");
let whiteApeRules = api.renderBossRules();
assert.equal((whiteApeRules.match(/data-guardian-slot=/g) || []).length, 6,
  "White Ape Troll Boss 专用区应显示固定 6 格先民护卫杂兵轨");
assert.equal((whiteApeRules.match(/guardian-track-slot[^\"]*locked/g) || []).length, 2,
  "White Ape Troll 等级 1 的第 5、6 格应因护卫上限 4 而锁定");
const firstGuardianSlot = whiteApeRules.indexOf('data-guardian-slot="0"');
const secondGuardianSlot = whiteApeRules.indexOf('data-guardian-slot="1"');
const guardianBpCard = whiteApeRules.indexOf('data-preview="M_WhiteApe:Trait:38"');
assert.ok(firstGuardianSlot >= 0 && guardianBpCard > firstGuardianSlot && guardianBpCard < secondGuardianSlot,
  "Firstman Guardian 共享 BP 应显示在杂兵轨最左侧第 1 格");
assert.match(whiteApeRules, /class="crop-card guardian-track-card track-card"/,
  "Firstman Guardian 共享 BP 应使用与标准杂兵 BP 相同的 track-card 尺寸类");
const aibpStyles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
assert.match(aibpStyles,
  /\.guardian-mob-track\s*\{[\s\S]*?grid-auto-columns:\s*clamp\(170px,\s*15vw,\s*220px\)/,
  "先民护卫轨道列宽应与标准杂兵 BP 轨道一致");
assert.ok(fs.existsSync(path.join(root, "assets/guardians/firstman-guardian-placeholder.png")),
  "未持有共享 BP 的先民护卫占位图必须位于 AIBP 本地资源目录");
assert.equal((whiteApeRules.match(/assets\/guardians\/firstman-guardian-placeholder\.png/g) || []).length, 1,
  "初始时只有未持卡的护卫 2 应显示先民护卫占位图");
assert.match(whiteApeRules, /data-rule-action="spawn-white-guardian"/,
  "White Ape Troll 应提供先民护卫特殊生成操作");
api.renderApp();
assert.match(nodes.get("#app").innerHTML,
  /data-white-reinforcement-slot style="left:72\.5%;top:23\.5%"/,
  "增援抵达应在巨白猿魔大卡对应特质区域显示空计数入口");
assert.doesNotMatch(nodes.get("#app").innerHTML, /data-white-vengeance-slot|data-white-vengeance-token/,
  "等级 1 不应显示为部落复仇计数");
assert.doesNotMatch(whiteApeRules, /<span class="badge">复仇/,
  "等级 1 Boss 操作区不应显示为部落复仇计数");

const whiteApe = context.window.KF_MONSTER_DATA.monsters.find(item => item.id === "M_WhiteApe");
const whiteNormalBp = whiteApe.cards.find(card => card.kind === "BP1");
const whiteDoubleBp = whiteApe.cards.find(card => card.kind === "BP3");
const whiteThickSkin = whiteApe.cards.find(card => card.id === "M_WhiteApe:BPS:0");
api.recordBossWoundCounters(whiteApe, whiteNormalBp.id, 1);
assert.equal(state().ruleState.reinforcementTokens, 1,
  "巨白猿魔受到普通损伤时应累计 1 枚增援抵达指示物");
api.recordBossWoundCounters(whiteApe, whiteDoubleBp.id, 2);
assert.equal(state().ruleState.reinforcementTokens, 3,
  "巨白猿魔受到双重损伤时应累计 2 枚增援抵达指示物");
api.recordBossWoundCounters(whiteApe, whiteThickSkin.id, 0);
assert.equal(state().ruleState.reinforcementTokens, 4,
  "厚皮 BP 被击伤时应累计 1 枚增援抵达指示物");
assert.equal(state().ruleState.guardians.count, 2,
  "增援抵达达到阈值后不应在当前行动内自动生成护卫");
assert.equal(state().ruleState.pendingCoordinatedAttacks, 0,
  "增援抵达达到阈值后应等待用户点击结算");
api.renderApp();
assert.match(nodes.get("#app").innerHTML, /data-white-reinforcement-token/,
  "增援抵达自动计数应显示在巨白猿魔大卡上");
assert.match(nodes.get("#app").innerHTML, /must-resolve/,
  "增援抵达达到 4 后应高亮为待结算状态");

state().activeAI = state().aiDeck[0];
api.resolveWhiteReinforcement();
assert.equal(state().ruleState.reinforcementTokens, 4,
  "当前行动未完成时不能清除增援抵达指示物");
assert.equal(state().ruleState.guardians.count, 2,
  "当前行动未完成时不能生成增援护卫");
state().activeAI = "";
api.resolveWhiteReinforcement();
assert.equal(state().ruleState.reinforcementTokens, 0,
  "点击结算增援抵达后应清除全部指示物");
assert.equal(state().ruleState.guardians.count, 3,
  "点击结算增援抵达后应生成 1 名先民护卫");
assert.equal(state().ruleState.guardians.carrier, 2,
  "增援抵达生成的新护卫应成为本次协同攻击的执行者");
assert.equal(state().ruleState.pendingCoordinatedAttacks, 1,
  "增援抵达生成的新护卫应有 1 次待执行协同攻击");
api.undo();
assert.equal(state().ruleState.reinforcementTokens, 4,
  "撤销增援抵达结算应恢复全部指示物");
assert.equal(state().ruleState.guardians.count, 2,
  "撤销增援抵达结算应移除刚生成的护卫");
assert.equal(state().ruleState.pendingCoordinatedAttacks, 0,
  "撤销增援抵达结算应清除刚加入的待执行协同攻击");

rebuild("full", 1);

api.startWhiteApeRound();
assert.equal(state().ruleState.guardians.count, 3,
  "White Ape Troll 怪物轮开始时应只生成 1 名新护卫");
assert.equal(state().ruleState.guardians.slots[2], true,
  "怪物轮生成的新护卫应进入最左侧可用编号位");
assert.equal(state().ruleState.pendingCoordinatedAttacks, 1,
  "怪物轮生成后，当前持卡护卫应有 1 次待执行的协同攻击");
assert.match(state().ruleState.ruleNotice, /大红树相邻.*尽量靠近巨白猿魔.*护卫 1 待执行协同攻击/,
  "怪物轮生成提示应包含特殊放置要求与当前协同攻击护卫");

api.resolveGuardianAttack();
assert.equal(state().ruleState.pendingCoordinatedAttacks, 0,
  "确认协同攻击后应清除本次待执行攻击");
assert.equal(state().ruleState.guardians.carrier, 1,
  "护卫 1 执行协同攻击后，共享 BP 应传给下一名护卫");
api.passGuardianBp();
assert.equal(state().ruleState.guardians.carrier, 2,
  "手动传递 BP 时应优先传给右侧下一名护卫");
api.passGuardianBp();
assert.equal(state().ruleState.guardians.carrier, 0,
  "当前护卫右侧没有可用位置时，共享 BP 应放回杂兵轨最左侧");
assert.match(state().ruleState.ruleNotice, /右侧没有.*杂兵轨最左侧/,
  "共享 BP 回到最左侧时应显示明确提示");
api.passGuardianBp();
assert.equal(state().ruleState.guardians.carrier, 1,
  "共享 BP 从最左侧再次传递时应找到右侧下一名护卫");
const whiteSingleBeforeDefeat = state().singleWounds;
const whiteDoubleBeforeDefeat = state().doubleWounds;
const whiteAiBeforeDefeat = [...state().aiDeck, ...state().aiDiscard, ...state().aiRemoved].sort().join(",");
const whiteBpBeforeDefeat = [...state().bpDeck, ...state().bpDiscard, ...state().bpRemoved].sort().join(",");
api.defeatGuardian(1);
assert.equal(state().ruleState.guardians.slots[1], false,
  "护卫死亡后应保留其编号空位，不应压缩杂兵轨编号");
assert.equal(state().ruleState.vengeanceTokens, 0,
  "等级 1 的先民护卫死亡时不应累计为部落复仇指示物");
assert.equal(state().ruleState.guardians.carrier, 2,
  "持卡护卫 2 死亡后，共享 BP 应传给下一名护卫 3");
assert.equal(state().singleWounds, whiteSingleBeforeDefeat,
  "先民护卫死亡不应加入单重损伤");
assert.equal(state().doubleWounds, whiteDoubleBeforeDefeat,
  "先民护卫死亡不应加入双重损伤");
assert.equal([...state().aiDeck, ...state().aiDiscard, ...state().aiRemoved].sort().join(","), whiteAiBeforeDefeat,
  "先民护卫死亡不应执行 AI 晋升");
assert.equal([...state().bpDeck, ...state().bpDiscard, ...state().bpRemoved].sort().join(","), whiteBpBeforeDefeat,
  "先民护卫死亡不应执行 BP 晋升");
api.defeatGuardian(2);
assert.equal(state().ruleState.guardians.carrier, 0,
  "持卡护卫之后没有下一名护卫时，共享 BP 应移回杂兵轨最左侧");

api.spawnWhiteGuardian();
assert.equal(state().ruleState.guardians.slots[1], true,
  "特殊生成应填入杂兵轨最左侧可用编号位");
assert.match(state().ruleState.ruleNotice, /大红树相邻.*不执行晋升.*不加入任何损伤牌/,
  "特殊生成提示应包含放置规则及无损伤、无晋升说明");

rebuild("full", 2);
api.renderApp();
assert.match(nodes.get("#app").innerHTML,
  /data-white-vengeance-slot style="left:72\.5%;top:88%"/,
  "等级 2 应在为部落复仇特质区域显示空计数入口");
assert.match(api.renderBossRules(), /<span class="badge">复仇 0\/5<\/span>/,
  "等级 2 的为部落复仇阈值应为 5");
api.defeatGuardian(1);
assert.equal(state().ruleState.vengeanceTokens, 1,
  "等级 2+ 的先民护卫死亡时应累计 1 枚为部落复仇指示物");
api.renderApp();
assert.match(nodes.get("#app").innerHTML, /data-white-vengeance-token/,
  "为部落复仇计数应自动显示在巨白猿魔大卡上");
api.changeWhiteVengeanceCounter(4);
assert.equal(state().ruleState.vengeanceTokens, 5,
  "等级 2 的为部落复仇应在 5 枚时达到阈值");
api.renderApp();
assert.match(nodes.get("#app").innerHTML,
  /data-white-vengeance-token[\s\S]*?must-resolve[^>]*style="left:72\.5%;top:88%"/,
  "为部落复仇达到阈值后应在大卡上高亮为待结算");
state().activeAI = state().aiDeck[0];
api.resolveWhiteVengeance();
assert.equal(state().ruleState.vengeanceTokens, 5,
  "当前行动未完成时不能清除为部落复仇指示物");
state().activeAI = "";
const vengeanceAiTop = state().aiDeck[0];
api.resolveWhiteVengeance();
assert.equal(state().ruleState.vengeanceTokens, 0,
  "结算为部落复仇后应清除全部指示物");
assert.equal(state().ruleState.ruleCard, vengeanceAiTop,
  "结算为部落复仇后应打开 AI 牌组顶牌");
assert.match(state().ruleState.ruleCardReason, /为部落复仇/,
  "为部落复仇打开的 AI 顶牌应标记触发原因");
api.undo();
assert.equal(state().ruleState.vengeanceTokens, 5,
  "撤销为部落复仇结算应恢复全部指示物");
assert.equal(state().ruleState.ruleCard, "",
  "撤销为部落复仇结算应关闭刚打开的 AI 顶牌");

rebuild("full", 3);
api.startWhiteApeRound();
assert.equal(state().ruleState.guardians.count, 4,
  "White Ape Troll 等级 3+ 怪物轮开始时应生成 2 名新护卫");
assert.equal(state().ruleState.guardians.slots.slice(2, 4).join(","), "true,true",
  "等级 3+ 每轮生成的两名护卫应依次进入最左侧空位");
assert.equal(state().ruleState.pendingCoordinatedAttacks, 1,
  "等级 3+ 每轮生成两名护卫后仍应只执行 1 次协同攻击");
assert.match(state().ruleState.ruleNotice,
  /特殊生成 2 只.*护卫 3.*大红树相邻.*护卫 4.*大红树相邻.*护卫 1 待执行协同攻击/,
  "等级 3+ 怪物轮提示应列出两名新护卫的放置要求");
api.resolveGuardianAttack();
api.startWhiteApeRound();
assert.equal(state().ruleState.guardians.count, 5,
  "等级 3 的护卫只剩一个空位时每轮最多生成到上限 5");
assert.match(state().ruleState.ruleNotice, /特殊生成 1 只.*护卫已达等级上限 5/,
  "两只生成受到上限限制时应提示实际生成数量");
api.resolveGuardianAttack();

rebuild("full", 3);
assert.equal(api.whiteVengeanceThreshold(), 4,
  "等级 3 的为部落复仇阈值应降为 4");
state().level = 4;
assert.equal(api.whiteVengeanceThreshold(), 3,
  "等级 4+ 的为部落复仇阈值应降为 3");
state().level = 3;
for (let count = 0; count < 4; count++) api.spawnWhiteGuardian();
assert.equal(state().ruleState.guardians.count, 5,
  "White Ape Troll 等级 3 的先民护卫上限应为 5");
assert.equal(state().ruleState.guardians.slots[5], false,
  "White Ape Troll 等级 3 不应使用第 6 个护卫槽");
for (let count = 0; count < 4; count++) api.recordWhiteReinforcement(1);
api.resolveWhiteReinforcement();
assert.equal(state().ruleState.reinforcementTokens, 0,
  "护卫达到上限时结算增援抵达仍应清除全部指示物");
assert.equal(state().ruleState.guardians.count, 5,
  "护卫达到上限时增援抵达不应生成新护卫");
assert.equal(state().ruleState.guardians.carrier, 1,
  "护卫达到上限时应改由当前持卡护卫右侧的下一名护卫执行协同攻击");
assert.equal(state().ruleState.pendingCoordinatedAttacks, 1,
  "护卫达到上限时仍应加入 1 次待执行协同攻击");
assert.match(state().ruleState.ruleNotice, /已达等级上限 5.*改由护卫 2 待执行协同攻击/,
  "护卫达到上限时应明确提示替代执行协同攻击的护卫");
api.resolveGuardianAttack();
const legacyWhiteApeBattle = JSON.parse(JSON.stringify(state()));
legacyWhiteApeBattle.ruleState.guardians = { count: 3, carrier: 1 };
const normalizedWhiteApeBattle = api.validateState({
  version: 10,
  selectedMonsterId: "M_WhiteApe",
  battle: legacyWhiteApeBattle,
  history: [],
  encounters: {},
}).battle;
assert.equal(normalizedWhiteApeBattle.ruleState.guardians.slots.join(","), "true,true,true,false,false,false",
  "旧存档中的护卫数量应迁移为固定编号杂兵轨槽位");

api.selectMonster("M_PuppetKing");
rebuild("full", 1);
let puppetKingRules = api.renderBossRules();
assert.match(puppetKingRules, /class="puppet-rule-layout"[\s\S]*class="puppet-fallen-module"[\s\S]*class="puppet-armor-module"/,
  "Puppet King Boss 专用区应只展示左侧陨落骑士与右侧盔甲计数");
assert.match(puppetKingRules, /data-preview="M_PuppetKing:Trait:39"/,
  "Puppet King Boss 专用区应展示 Trait · 陨落骑士卡");
assert.match(puppetKingRules, /data-rule-action="damage-puppet-fallen"/,
  "陨落骑士卡应提供造成损伤操作");
assert.match(puppetKingRules, /class="puppet-fallen-header"[\s\S]*<details class="puppet-fallen-details">[\s\S]*<\/details>[\s\S]*data-rule-action="damage-puppet-fallen"/,
  "陨落骑士卡折叠入口与损伤按钮应同行，且损伤按钮位于最右侧");
assert.match(puppetKingRules, /<details class="puppet-fallen-details">[\s\S]*<summary>BP 卡<\/summary>/,
  "陨落骑士 BP 卡应使用默认关闭的折叠区域");
assert.doesNotMatch(puppetKingRules, /<details class="puppet-fallen-details" open/,
  "陨落骑士 BP 卡不应默认展开");
assert.equal((puppetKingRules.match(/data-puppet-armor/g) || []).length, 2,
  "右侧盔甲计数应提供增加和减少操作");
assert.doesNotMatch(puppetKingRules, /add-fallen|puppet-top-two|puppet-routine|finger-key|special-track/,
  "Puppet King 原有加入陨落骑士、奉命行事、手指对照和陨落骑士列表应全部移除");

const puppetKindCount = (zone, kind) => state()[zone].filter(id =>
  context.window.KF_MONSTER_DATA.monsters.find(monster => monster.id === "M_PuppetKing")
    .cards.find(card => card.id === id)?.kind === kind
).length;
const puppetSingleBefore = state().singleWounds;
const puppetDamageBefore = state().bpDamage.length;
const puppetAi2Before = puppetKindCount("aiDeck", "AI2");
const puppetBp2Before = puppetKindCount("bpDeck", "BP2");
api.damagePuppetFallenKnight();
assert.equal(state().ruleState.puppetKing.fallenKnightTokens, 1,
  "陨落骑士第一次受到损伤后应放置 1 枚通用指示物");
assert.equal(state().singleWounds, puppetSingleBefore,
  "陨落骑士第一次受到损伤不应加入 Boss 损伤");
puppetKingRules = api.renderBossRules();
assert.match(puppetKingRules, /class="puppet-fallen-token"[\s\S]*<strong>1<\/strong>/,
  "陨落骑士卡上应覆盖显示当前通用指示物");

api.damagePuppetFallenKnight();
assert.equal(state().ruleState.puppetKing.fallenKnightTokens, 0,
  "陨落骑士累计 2 枚通用指示物后应弃置全部指示物");
assert.equal(state().singleWounds, puppetSingleBefore + 1,
  "陨落骑士累计 2 枚通用指示物后应加入 1 张单重损伤");
assert.equal(state().bpDamage.length, puppetDamageBefore + 1,
  "陨落骑士结算产生的单重损伤应进入损伤牌堆");
assert.equal(puppetKindCount("aiDeck", "AI2"), puppetAi2Before + 1,
  "陨落骑士结算后应晋升 1 张 AI");
assert.equal(puppetKindCount("bpDeck", "BP2"), puppetBp2Before + 1,
  "陨落骑士结算后应晋升 1 张 BP");
assert.match(state().ruleState.ruleNotice, /弃置全部指示物.*加入 1 张单重损伤并晋升 1 次/,
  "陨落骑士结算应显示完整提示");
api.undo();
assert.equal(state().ruleState.puppetKing.fallenKnightTokens, 1,
  "撤销陨落骑士结算应恢复第 1 枚通用指示物");
assert.equal(state().singleWounds, puppetSingleBefore,
  "撤销陨落骑士结算应移除本次单重损伤");

rebuild("full", 1);
for (let count = 0; count < 4; count++) api.changePuppetArmor(1);
assert.equal(state().ruleState.puppetKing.armor, 4,
  "Puppet King 右侧盔甲计数应累计到 4");
puppetKingRules = api.renderBossRules();
assert.match(puppetKingRules, /class="smelted-armor-count">4<\/strong>[\s\S]*class="badge danger-badge">4\/5<\/span>/,
  "第 4 枚盔甲时应显示临界状态");
api.changePuppetArmor(1);
assert.equal(state().ruleState.puppetKing.armor, 0,
  "Puppet King 盔甲达到 5 时应弃置全部盔甲指示物");
assert.match(state().ruleState.ruleNotice, /所有骑士获得灾祸 5/,
  "Puppet King 盔甲达到 5 时应提示所有骑士灾祸 5");
assert.equal(nodes.get("#toast").textContent, "所有骑士获得灾祸 5",
  "Puppet King 盔甲达到 5 时应弹出即时提示");
api.undo();
assert.equal(state().ruleState.puppetKing.armor, 4,
  "撤销灾祸 5 结算应恢复 4 枚盔甲指示物");

rebuild("full", 3);
const levelThreePuppetAi = state().aiDeck[0];
api.draw("ai");
assert.equal(state().activeAI, levelThreePuppetAi,
  "Puppet King 等级 3 点击抽 AI 时仍应正常抽取牌组顶牌");
assert.equal(state().ruleState.aiChoiceIds.length, 0,
  "Puppet King 等级 3 不应进入双 AI 待选状态");

rebuild("full", 4);
const levelFourPuppetChoices = state().aiDeck.slice(0, 2);
api.draw("ai");
assert.equal(state().activeAI, "",
  "Puppet King 等级 4 点击抽 AI 后不应直接激活其中一张");
assert.deepEqual(state().ruleState.aiChoiceIds, levelFourPuppetChoices,
  "Puppet King 等级 4 点击抽 AI 后应展示牌组顶端两张牌");
assert.ok(levelFourPuppetChoices.every(id => !state().aiDeck.includes(id)),
  "Puppet King 等级 4 的两张待选 AI 应暂时移出牌组");
api.renderApp();
const levelFourPuppetHtml = nodes.get("#app").innerHTML;
assert.equal((levelFourPuppetHtml.match(/data-choose-puppet-ai=/g) || []).length, 2,
  "Puppet King 等级 4 的 AI 待选区应显示两个可执行选项");
assert.match(levelFourPuppetHtml, /data-rule-action="puppet-routine">惯常<\/button>/,
  "Puppet King 等级 4 的 AI 待选区应始终允许选择惯常");

const selectedPuppetAi = levelFourPuppetChoices[1];
api.choosePuppetAi(selectedPuppetAi);
assert.equal(state().activeAI, selectedPuppetAi,
  "Puppet King 等级 4 应允许自由选择第二张 AI 执行");
assert.equal(state().aiDeck[0], levelFourPuppetChoices[0],
  "选择第二张 AI 后，第一张应放回牌组顶");
api.undo();
assert.equal(state().ruleState.aiChoiceIds.join(","), levelFourPuppetChoices.join(","),
  "撤销 AI 选择后应恢复两张待选牌");
api.executePuppetRoutine();
assert.equal(state().aiDeck.slice(0, 2).join(","), levelFourPuppetChoices.join(","),
  "选择惯常后，两张 AI 应按原顺序放回牌组顶");
assert.equal(state().ruleState.ruleCard, "M_PuppetKing:SIG:38",
  "选择惯常后应展示 Puppet King 的惯常行动卡");
assert.match(state().ruleState.ruleCardReason, /惯常行动/,
  "选择惯常后应标明当前规则卡来源");

const legacyPuppetBattle = JSON.parse(JSON.stringify(state()));
delete legacyPuppetBattle.ruleState.puppetKing;
legacyPuppetBattle.ruleState.fallenKnights = [{ id: "legacy-fallen", wounds: 1 }];
const legacyPuppetChoices = legacyPuppetBattle.aiDeck.splice(0, 2);
legacyPuppetBattle.ruleState.aiChoiceIds = [...legacyPuppetChoices];
legacyPuppetBattle.ruleState.recommendedAiId = legacyPuppetChoices[0];
const normalizedPuppetBattle = api.validateState({
  version: 10,
  selectedMonsterId: "M_PuppetKing",
  battle: legacyPuppetBattle,
  history: [],
  encounters: {},
}).battle;
assert.equal(normalizedPuppetBattle.ruleState.puppetKing.fallenKnightTokens, 1,
  "旧 Puppet King 存档中已受伤的陨落骑士应迁移为 1 枚通用指示物");
assert.equal(normalizedPuppetBattle.ruleState.aiChoiceIds.join(","), legacyPuppetChoices.join(","),
  "Puppet King 存档中的待选 AI 应在重新载入后继续保留");
assert.ok(legacyPuppetChoices.every(id => !normalizedPuppetBattle.aiDeck.includes(id)),
  "重新载入 Puppet King 存档时，待选 AI 不应同时回到牌组");

api.selectMonster("M_Knighteater");
const knighteater = context.window.KF_MONSTER_DATA.monsters.find(item => item.id === "M_Knighteater");
state().level = 1;
state().ruleState.knighteater.brute = 0;
state().ruleState.ruleNotice = "";
const knighteaterRules = api.renderBossRules();
assert.match(knighteaterRules, /data-rule-action="toggle-berserk"/,
  "Knighteater 专用操作区应保留暴走按钮");
assert.match(knighteaterRules, /data-p2-counter="eater:armor"/,
  "Knighteater 专用操作区应保留盔甲指示物增减");
assert.match(knighteaterRules, /class="smelted-armor-token"/,
  "Knighteater 盔甲指示物应复用熔怖恶魔的 Token 样式");
assert.doesNotMatch(knighteaterRules,
  /data-p2-counter="eater:meat"|data-eater-target|eater-meatbait|wolf-down|rule-counter-grid|肉饵|狼吞虎咽/,
  "Knighteater 专用操作区不应保留肉块、凶残、目标或狼吞虎咽控件");
api.renderApp();
assert.doesNotMatch(nodes.get("#app").innerHTML, /data-auto-armor-slot="首要目标"/,
  "Knighteater 未暴走时大卡上不应显示首要目标指示物");
assert.doesNotMatch(nodes.get("#app").innerHTML, /data-knighteater-brute-slot|data-knighteater-brute-token/,
  "等级 1 的 Knighteater 不应显示凶残通用指示物计数");
api.recordP2WoundCounters(knighteater, 1);
assert.equal(state().ruleState.knighteater.brute, 0,
  "等级 1 的 Knighteater 受到损伤时不应累计凶残");
api.toggleKnighteaterBerserk(true);
api.renderApp();
assert.match(nodes.get("#app").innerHTML,
  /data-auto-armor-slot="首要目标"[^>]+style="left:25%;top:50%"/,
  "等级 1 的 Knighteater 暴走时应在左侧大卡中央显示首要目标指示物");
assert.match(nodes.get("#app").innerHTML, /10792521070176964E460F00E6C698AFEB4F862A2B09A8B61D30EB2CD\.png/,
  "Knighteater 首要目标指示物应使用指定图标");
api.toggleKnighteaterBerserk(false);
api.renderApp();
assert.doesNotMatch(nodes.get("#app").innerHTML, /data-auto-armor-slot="首要目标"/,
  "Knighteater 停止暴走后应从大卡移除首要目标指示物");
assert.equal(state().ruleState.knighteater.priorityTarget, "",
  "移除优先目标输入后，停止暴走应清空 Boss 优先目标");
state().level = 2;
api.renderApp();
assert.match(nodes.get("#app").innerHTML,
  /data-knighteater-brute-slot style="left:72%;top:47\.5%"/,
  "等级 2+ 应在 Knighteater 的凶残特质旁显示通用指示物入口");
api.toggleKnighteaterBerserk(true);
api.renderApp();
assert.match(nodes.get("#app").innerHTML,
  /data-auto-armor-slot="首要目标"[^>]+style="left:25%;top:50%"/,
  "等级 2+ 的 Knighteater 暴走时仍应在左侧大卡中央显示首要目标指示物");
api.toggleKnighteaterBerserk(false);
api.changeKnighteaterBruteCounter(1);
api.renderApp();
assert.equal(state().ruleState.knighteater.brute, 1,
  "点击凶残特质旁的通用指示物应累计计数");
assert.match(nodes.get("#app").innerHTML,
  /data-knighteater-brute-token[^>]+style="left:72%;top:47\.5%"/,
  "凶残通用指示物应显示在大卡特质旁");
api.changeKnighteaterResource("armor", 1);
assert.equal(state().ruleState.knighteater.armor, 1,
  "Knighteater 盔甲控件应能添加盔甲指示物");
assert.equal(state().ruleState.knighteater.brute, 2,
  "等级 2+ 获得盔甲时应同步累计凶残");
assert.equal(state().ruleState.ruleNotice, "",
  "添加未达到凶残阈值的盔甲时不应显示额外提示框");
api.changeKnighteaterBruteCounter(1);
assert.equal(state().ruleState.knighteater.brute, 0,
  "凶残达到 3 后应清除全部凶残指示物");
assert.equal(state().ruleState.knighteater.armor, 0,
  "凶残达到 3 后应清除全部盔甲指示物");
assert.match(state().ruleState.ruleNotice, /执行食骑者标志行为/,
  "凶残达到 3 后应提示执行食骑者标志行为");
api.selectMonster("M_Stonemason");
state().ruleState.stonemason.armor = { front: 2, right: 1, back: 0, left: 3 };
state().ruleState.stonemason.direction = "right";
const stonemasonRules = api.renderBossRules();
assert.match(stonemasonRules, /class="stonemason-armor-grid"/,
  "Stonemason should use the dedicated four-direction armor layout");
assert.equal((stonemasonRules.match(/class="smelted-armor-token"/g) || []).length, 4,
  "All four Stonemason directions should use graphical armor tokens");
assert.equal((stonemasonRules.match(/10253072582350080078E89257D8FD942C3FA0350726E80F48FC7AEF6B99/g) || []).length, 4,
  "All four Stonemason controls should render the armor token asset");
assert.match(stonemasonRules, /stonemason-armor-module is-current" aria-current="true">\s*<span class="stonemason-armor-label">右方节点/,
  "The current Stonemason attack direction should be highlighted");
assert.match(stonemasonRules, /data-p2-counter="stone:front" data-delta="-1"/,
  "The restyled Stonemason controls should retain their counter actions");
assert.doesNotMatch(stonemasonRules, /class="rule-counter-grid"/,
  "Stonemason armor should no longer use plain numeric counter boxes");
for (const monster of context.window.KF_MONSTER_DATA.monsters) {
  const cardCounts = monster.cards.reduce((counts, card) => {
    counts[card.kind] = (counts[card.kind] || 0) + 1;
    return counts;
  }, {});
  for (const [kind, count] of Object.entries(cardCounts)) {
    assert.equal(Number(monster.pools[kind] || 0), count,
      `${monster.id} ${kind} 卡池数量应与实际卡牌一致`);
  }
  const sigCards = monster.cards.filter(card => card.kind === "SIG");
  assert.equal(sigCards.length, 1, `${monster.id} 应有且仅有一张双面 SIG 卡`);
  assert.ok(sigCards[0].image.face, `${monster.id} SIG 应有 ROUTINE 正面`);
  assert.ok(sigCards[0].image.back, `${monster.id} SIG 应有 SIGNATURE 反面`);
  assert.notEqual(sigCards[0].image.face, sigCards[0].image.back,
    `${monster.id} SIG 的 ROUTINE 与 SIGNATURE 不应使用同一张图片`);
  for (const kind of ["AI0", "AI1", "AI2", "AI3"]) {
    assert.equal(Number(monster.pools[kind] || 0), Number(cardCounts[kind] || 0),
      `${monster.id} ${kind} 卡池数量应与实际卡牌一致`);
  }
  api.selectMonster(monster.id);
  rebuild("full", 1);
  const initialAiCounts = [...state().aiDeck, ...state().aiDiscard].reduce((counts, id) => {
    const kind = monster.cards.find(card => card.id === id)?.kind;
    counts[kind] = (counts[kind] || 0) + 1;
    return counts;
  }, {});
  const expectedInitialAi = { AI1: Number(monster.pools.AI1 || 0), AI2: 0, AI3: 0 };
  const isMobMonster = Boolean(context.window.KF_MOB_ACTIVATIONS[monster.id]);
  const levelOnePromotion = isMobMonster ? 0 : Number(
    context.window.KF_LEVEL_CONFIG[monster.id]?.find(item => item.level === 1)?.promotion || 0
  );
  for (let step = 0; step < levelOnePromotion; step++) {
    if (expectedInitialAi.AI1 > 0) {
      expectedInitialAi.AI1--;
      expectedInitialAi.AI2++;
    } else if (expectedInitialAi.AI2 > 0) {
      expectedInitialAi.AI2--;
      expectedInitialAi.AI3++;
    }
  }
  assert.equal(Number(initialAiCounts.AI0 || 0), Number(monster.pools.AI0 || 0),
    `${monster.id} 等级 1 的 AI0 数量错误`);
  for (const kind of ["AI1", "AI2", "AI3"]) {
    assert.equal(Number(initialAiCounts[kind] || 0), expectedInitialAi[kind],
      `${monster.id} 等级 1 的 ${kind} 数量错误`);
  }
}
Object.keys(api.state()).forEach(key => { delete api.state()[key]; });
Object.assign(api.state(), stateBeforeAiCountAudit);

const stateBeforeAi0Audit = JSON.parse(JSON.stringify(api.state()));
const ai0MonsterIds = ["M_Panzerdragon", "M_Toadragon", "M_YoungDevour"];
const ai0SettlementActions = ["discard", "bottom", "removed"];
for (const [index, monsterId] of ai0MonsterIds.entries()) {
  api.selectMonster(monsterId);
  rebuild("full", 1);
  const monster = context.window.KF_MONSTER_DATA.monsters.find(item => item.id === monsterId);
  const ai0Ids = monster.cards.filter(card => card.kind === "AI0").map(card => card.id);
  assert.ok(ai0Ids.length, `${monsterId} 测试需要 AI0`);
  assert.deepEqual(new Set(state().aiDeck.slice(0, ai0Ids.length)), new Set(ai0Ids),
    `${monsterId} 建立冲突时所有 AI0 都应位于 AI 牌组顶部`);

  api.draw("ai");
  const activeAi0 = state().activeAI;
  assert.equal(monster.cards.find(card => card.id === activeAi0)?.kind, "AI0",
    `${monsterId} 第一次抽取 AI 应得到 AI0`);
  api.renderApp();
  const ai0Html = nodes.get("#app").innerHTML;
  assert.match(ai0Html, /data-settle="ai:removed"[^>]*>结算并移出游戏<\/button>/,
    "AI0 激活时应显示专用结算按钮");
  assert.doesNotMatch(ai0Html, /data-settle="ai:discard"|data-settle="ai:bottom"/,
    "AI0 激活时不应提供弃置或置底操作");

  api.settle("ai", ai0SettlementActions[index]);
  assert.equal(state().activeAI, "", "AI0 结算后应清除当前 AI");
  assert.ok(state().aiRemoved.includes(activeAi0), "AI0 第一次结算后应移出游戏");
  assert.ok(!state().aiDeck.includes(activeAi0) && !state().aiDiscard.includes(activeAi0),
    "AI0 结算后不应进入抽牌堆或弃牌堆");
}

api.selectMonster("M_YoungDevour");
rebuild("full", 1);
const ruleAi0 = state().aiDeck.shift();
state().ruleState.ruleCard = ruleAi0;
api.completeRuleCard();
assert.ok(state().aiRemoved.includes(ruleAi0), "通过专用规则结算的 AI0 也应移出游戏");
assert.ok(!state().aiDiscard.includes(ruleAi0), "通过专用规则结算的 AI0 不应进入弃牌堆");
Object.keys(api.state()).forEach(key => { delete api.state()[key]; });
Object.assign(api.state(), stateBeforeAi0Audit);

api.selectMonster("M_BogWitch");
rebuild("full", 1);
assert.equal(state().singleWounds, 0, "完全冲突不应加入初步损伤");
assert.deepEqual([...state().bpDamage], []);

rebuild("preliminary", 1);
assert.equal(state().singleWounds, 2, "沼泽女巫等级 1 应加入 2 张 SW");
assert.equal(state().doubleWounds, 0);
assert.equal(state().bpDamage.length, 2);
assert.ok(state().bpDamage.every(id => id.startsWith("WOUND:single:")));

rebuild("preliminary", 3);
assert.equal(state().singleWounds, 4, "等级 3 初步损伤应为 4 张 SW");
const promotedAiCounts = state().aiDeck.reduce((result, id) => {
  const kind = context.window.KF_MONSTER_DATA.monsters
    .find(monster => monster.id === state().monsterId).cards.find(card => card.id === id)?.kind;
  result[kind] = (result[kind] || 0) + 1;
  return result;
}, {});
assert.equal(promotedAiCounts.AI1, 5);
assert.equal(promotedAiCounts.AI2, 1, "初始 SW 不应造成额外晋升");

api.remember();
state().clashPhase = "full";
api.rebuild(true);
assert.equal(state().singleWounds, 0);
api.undo();
assert.equal(state().clashPhase, "preliminary", "撤销重建应恢复冲突阶段");
assert.equal(state().singleWounds, 4, "撤销重建应恢复初始 SW");

const expectedMobExhibitionWounds = {
  M_Ratwolves: [1, 2, 2, 2],
  M_WingedNightmare: [0, 0, 0, 0],
  M_Pumpkinhead: [1, 2, 2, 2],
  M_PalebloodWorms: [1, 2, 2, 2],
  M_FirstmenWarriors: [1, 2, 2, 2],
  M_HauntOf: [1, 2, 2, 2],
  M_Panzergeists: [1, 2, 2, 2],
  M_FirstmenLictor: [1, 2, 2, 2],
  M_Ironcast: [1, 2, 2, 2],
};
for (const [monsterId, expectedByLevel] of Object.entries(expectedMobExhibitionWounds)) {
  api.selectMonster(monsterId);
  expectedByLevel.forEach((expected, index) => {
    const level = index + 1;
    rebuild("preliminary", level);
    assert.equal(state().singleWounds, expected, `${monsterId} 等级 ${level} 初步冲突 SW 数量错误`);
    assert.equal(state().doubleWounds, 0);
    assert.equal(state().bpDamage.length, expected);
    assert.ok(state().bpDamage.every(id => id.startsWith("WOUND:single:")));
  });
}

context.window.KF_CLASH_PHASE = "preliminary";
api.selectMonster("M_YoungDevour");
assert.equal(state().clashPhase, "preliminary", "新冲突应采用地图建议阶段");
context.window.KF_CLASH_PHASE = "full";

rebuild("preliminary", 1);
assert.deepEqual([...state().ruleState.phaseIds], [
  "M_YoungDevour:Trait:38",
  "M_YoungDevour:Trait:39",
], "初步冲突应只有高空飞行和低空漂浮阶段");
let devourStageHtml = api.renderBossRules();
assert.equal((devourStageHtml.match(/class="rule-track-item /g) || []).length, 2,
  "初步冲突的 Boss 状态区应显示两个文字阶段");
assert.doesNotMatch(devourStageHtml, /data-preview="M_YoungDevour:Trait:/,
  "Boss 状态区不应显示阶段卡");
api.renderApp();
assert.match(nodes.get("#app").innerHTML,
  /data-young-devour-stage-card="M_YoungDevour:Trait:38"/,
  "初步冲突开始时应把高空飞行放在大卡指定位置");

rebuild("full", 1);
assert.deepEqual([...state().ruleState.phaseIds], [
  "M_YoungDevour:Trait:38",
  "M_YoungDevour:Trait:39",
  "M_YoungDevour:Trait:40",
], "完全冲突还应包含落地阶段");
devourStageHtml = api.renderBossRules();
assert.equal((devourStageHtml.match(/class="rule-track-item /g) || []).length, 3,
  "完全冲突的 Boss 状态区应显示三个文字阶段");
assert.match(devourStageHtml, /高空飞行[\s\S]*低空漂浮[\s\S]*落地/,
  "完全冲突的专用阶段轨应显示落地");
assert.doesNotMatch(devourStageHtml, /data-preview="M_YoungDevour:Trait:/,
  "完全冲突的 Boss 状态区也不应显示阶段卡");
api.renderApp();
assert.match(nodes.get("#app").innerHTML,
  /data-young-devour-stage-card="M_YoungDevour:Trait:38"/,
  "完全冲突开始时应把高空飞行放在大卡指定位置");
api.advanceDevourStage();
api.advanceDevourStage();
assert.equal(state().ruleState.phaseIndex, 2, "完全冲突应能推进到落地阶段");
devourStageHtml = api.renderBossRules();
assert.match(devourStageHtml,
  /class="rule-track-item active[\s\S]*<strong>落地<\/strong>/,
  "推进两次后 Boss 状态区应标记落地阶段");
api.renderApp();
assert.match(nodes.get("#app").innerHTML,
  /data-young-devour-stage-card="M_YoungDevour:Trait:40"/,
  "推进两次后大卡指定位置应切换为落地卡");

rebuild("preliminary", 2);
assert.ok(!state().ruleState.phaseIds.includes("M_YoungDevour:Trait:40"),
  "即使等级 2+，初步冲突也不应加入落地阶段");

const expectedMobs = {
  M_Ratwolves: { BP1: 4 },
  M_WingedNightmare: {},
  M_Pumpkinhead: { BPS: 6 },
  M_PalebloodWorms: { BP1: 4 },
  M_FirstmenWarriors: { BP1: 6 },
  M_HauntOf: { BP1: 3 },
  M_Panzergeists: { BP1: 5, BP2: 3, BP3: 2 },
  M_FirstmenLictor: { BP1: 8, BP2: 2 },
  M_Ironcast: { BP1: 4, BP2: 3, BP3: 1 },
};
for (const [monsterId, expected] of Object.entries(expectedMobs)) {
  api.selectMonster(monsterId);
  assert.equal(state().conflictStatus, "active", `${monsterId}配置应通过校验`);
  const monster = context.window.KF_MONSTER_DATA.monsters.find(item => item.id === monsterId);
  const actual = state().bpTrack.filter(slot => slot.id).reduce((result, slot) => {
    const kind = monster.cards.find(card => card.id === slot.id).kind;
    result[kind] = (result[kind] || 0) + 1;
    return result;
  }, {});
  assert.deepEqual(actual, expected, `${monsterId}初始 BP 组合错误`);
}

const lictor = context.window.KF_MONSTER_DATA.monsters.find(monster => monster.id === "M_FirstmenLictor");
const basicLictorTactics = new Set([
  "M_FirstmenLictor:Trait:38",
  "M_FirstmenLictor:Trait:39",
  "M_FirstmenLictor:Trait:42",
]);
const advancedLictorTactics = new Set([
  "M_FirstmenLictor:Trait:37",
  "M_FirstmenLictor:Trait:40",
  "M_FirstmenLictor:Trait:41",
]);
api.selectMonster("M_FirstmenLictor");
for (const level of [1, 2, 3, 4]) {
  rebuild("full", level);
  const expectedTactics = level >= 3 ? advancedLictorTactics : basicLictorTactics;
  assert.ok(expectedTactics.has(state().mobTacticCard),
    `Firstmen Lictor Hunters 等级 ${level} 应抽取正确等级的战术卡`);
  assert.equal(state().bpTrack.filter(slot => slot.id).length, 10,
    "初始战术卡不应替换或占用 1-10 号 BP 槽");
  const initialDecoys = state().bpTrack.filter(slot => slot.id && slot.decoy);
  assert.equal(initialDecoys.length, 6,
    `Firstmen Lictor Hunters 等级 ${level} 初始应随机设置 6 张诱匿 BP`);
  assert.ok(initialDecoys.every(slot => !slot.revealed),
    "初始诱匿 BP 应保持面朝下");
  assert.equal(state().ruleState.lictorDecoyTokens, 0,
    "初始设置的 6 张诱匿 BP 不应增加 Taunt & Decoy 通用标记");
  assert.ok(!api.activeReferenceIds().includes(state().mobTacticCard),
    "抽出的战术卡不应在特质参考区重复显示");
  api.renderApp();
  const lictorHtml = nodes.get("#app").innerHTML;
  const tacticPosition = lictorHtml.indexOf('class="mob-slot mob-tactic-slot"');
  const firstBpPosition = lictorHtml.indexOf('class="mob-slot ', tacticPosition + 1);
  assert.ok(tacticPosition >= 0 && firstBpPosition > tacticPosition,
    "随机战术卡应展示在 BP 轨最左侧");
  assert.match(lictorHtml, new RegExp(`data-preview="${state().mobTacticCard}"`),
    "BP 轨上的战术卡应可点击查看大图");
  if (level >= 3) assert.match(lictorHtml, /<span>高级战术<\/span>/);
  else assert.doesNotMatch(lictorHtml, /<span>基础战术<\/span>/);
}
const savedLictorTactic = state().mobTacticCard;
const normalizedLictorBattle = api.validateState({
  version: 10,
  selectedMonsterId: "M_FirstmenLictor",
  battle: JSON.parse(JSON.stringify(state())),
  history: [],
  encounters: {},
}).battle;
assert.equal(normalizedLictorBattle.mobTacticCard, savedLictorTactic,
  "载入存档时应保留已经抽出的战术卡");
const legacyLictorBattle = JSON.parse(JSON.stringify(state()));
delete legacyLictorBattle.mobTacticCard;
legacyLictorBattle.lictorTacticCard = savedLictorTactic;
assert.equal(api.validateState({
  version: 10,
  selectedMonsterId: "M_FirstmenLictor",
  battle: legacyLictorBattle,
  history: [],
  encounters: {},
}).battle.mobTacticCard, savedLictorTactic, "旧猎手存档的战术卡应自动迁移");
assert.equal(lictor.cards.filter(card => basicLictorTactics.has(card.id)).length, 3);
assert.equal(lictor.cards.filter(card => advancedLictorTactics.has(card.id)).length, 3);

const hiddenNormalIndex = state().bpTrack.findIndex(slot => slot.id && !slot.decoy);
const hiddenNormalSlot = state().bpTrack[hiddenNormalIndex];
assert.ok(hiddenNormalIndex >= 0, "初始 10 张 BP 中应有 4 张非诱匿 BP");
assert.equal(hiddenNormalSlot.revealed, false);
assert.equal(hiddenNormalSlot.side, "face");
api.toggleLictorDecoy(hiddenNormalIndex);
assert.equal(hiddenNormalSlot.decoy, true, "面朝下的猎手 BP 应能设为诱匿");
assert.equal(hiddenNormalSlot.side, "face", "未揭示的 BP 设为诱匿时不应翻面");
assert.equal(state().ruleState.lictorDecoyTokens, 1,
  "首次设为诱匿时应在 Taunt & Decoy 特质处增加通用标记");
assert.match(nodes.get("#app").innerHTML, /data-auto-armor-slot="Taunt &amp; Decoy"/,
  "Taunt & Decoy 累计值应显示为大卡上的自动通用标记");
assert.match(nodes.get("#app").innerHTML, /class="mob-decoy-badge">诱匿/,
  "诱匿 BP 应显示状态标记");
api.toggleLictorDecoy(hiddenNormalIndex);
assert.equal(hiddenNormalSlot.decoy, false, "诱匿 BP 应能恢复普通状态");
assert.equal(state().ruleState.lictorDecoyTokens, 1,
  "解除诱匿不应扣除特质上累计的通用标记");
hiddenNormalSlot.revealed = true;
api.toggleLictorDecoy(hiddenNormalIndex);
assert.equal(hiddenNormalSlot.decoy, true);
assert.equal(hiddenNormalSlot.side, "back", "已揭示的 BP 设为诱匿时应立即翻面");
assert.equal(state().ruleState.lictorDecoyTokens, 2,
  "恢复普通状态后再次成为诱匿应继续累计通用标记");
const normalizedDecoyBattle = api.validateState({
  version: 10,
  selectedMonsterId: "M_FirstmenLictor",
  battle: JSON.parse(JSON.stringify(state())),
  history: [],
  encounters: {},
}).battle;
assert.equal(normalizedDecoyBattle.bpTrack[hiddenNormalIndex].decoy, true, "存档应保留 BP 的诱匿状态");
assert.equal(normalizedDecoyBattle.ruleState.lictorDecoyTokens, 2,
  "存档应保留 Taunt & Decoy 的通用标记数量");

const warriorTactics = new Set([
  "M_FirstmenWarriors:Trait:37",
  "M_FirstmenWarriors:Trait:38",
  "M_FirstmenWarriors:Trait:39",
]);
api.selectMonster("M_FirstmenWarriors");
for (const level of [1, 2, 3, 4]) {
  rebuild("full", level);
  assert.ok(warriorTactics.has(state().mobTacticCard),
    `Firstmen Warriors 等级 ${level} 应始终抽取基础战术卡`);
  assert.equal(state().bpTrack.filter(slot => slot.id).length, 6,
    "Firstmen Warriors 的战术卡不应占用初始 6 张 BP");
  assert.ok([...warriorTactics].every(id => !api.activeReferenceIds().includes(id)),
    "Firstmen Warriors 未使用的基础战术应从特质参考区隐藏");
  api.renderApp();
  const warriorHtml = nodes.get("#app").innerHTML;
  const tacticPosition = warriorHtml.indexOf('class="mob-slot mob-tactic-slot"');
  const firstBpPosition = warriorHtml.indexOf('class="mob-slot ', tacticPosition + 1);
  assert.ok(tacticPosition >= 0 && firstBpPosition > tacticPosition,
    "Firstmen Warriors 的战术卡应展示在 BP 轨最左侧");
  assert.match(warriorHtml, new RegExp(`data-preview="${state().mobTacticCard}"`));
  assert.doesNotMatch(warriorHtml, /<span>基础战术<\/span>|<span>高级战术<\/span>/,
    "Firstmen Warriors 的战术卡左上角不应显示等级标签");
}
const savedWarriorTactic = state().mobTacticCard;
const normalizedWarriorBattle = api.validateState({
  version: 10,
  selectedMonsterId: "M_FirstmenWarriors",
  battle: JSON.parse(JSON.stringify(state())),
  history: [],
  encounters: {},
}).battle;
assert.equal(normalizedWarriorBattle.mobTacticCard, savedWarriorTactic,
  "Firstmen Warriors 存档应保留抽出的基础战术卡");

const warriorCompanionIds = ["M_WhiteApe:BP2:12", "M_WhiteApe:AI2:30"];
api.renderApp();
const warriorCompanionHtml = nodes.get("#app").innerHTML;
const warriorTacticPosition = warriorCompanionHtml.indexOf('class="mob-slot mob-tactic-slot"');
const muscularChestPosition = warriorCompanionHtml.indexOf('data-preview="M_WhiteApe:BP2:12"');
const rampageStrikePosition = warriorCompanionHtml.indexOf('data-preview="M_WhiteApe:AI2:30"');
const numberedBpPosition = warriorCompanionHtml.indexOf('data-mob="0"');
assert.ok(warriorTacticPosition >= 0
  && muscularChestPosition > warriorTacticPosition
  && rampageStrikePosition > muscularChestPosition
  && numberedBpPosition > rampageStrikePosition,
"Firstmen Warriors 的战术卡、MUSCULAR CHEST、RAMPAGE STRIKE 应依次显示在编号 BP 左侧");
assert.match(warriorCompanionHtml, /BP2 · MUSCULAR CHEST/);
assert.match(warriorCompanionHtml, /AI2 · RAMPAGE STRIKE/);
assert.match(warriorCompanionHtml, /data-warrior-muscular-defeat/);
assert.equal(state().ruleState.firstmenWarriors.muscularChestMarkers, 0,
  "MUSCULAR CHEST 初始时不应有通用标记");
assert.doesNotMatch(warriorCompanionHtml, /warrior-companion-markers/,
  "MUSCULAR CHEST 初始时不应显示通用标记");
for (const id of warriorCompanionIds) {
  for (const zone of ["aiDeck", "aiDiscard", "aiRemoved", "bpDeck", "bpDiscard", "bpDamage", "bpRemoved"]) {
    assert.ok(!state()[zone].includes(id), `${id} 不应进入 ${zone}`);
  }
  assert.ok(!state().bpTrack.some(slot => slot.id === id), `${id} 不应进入普通 BP 轨道或参与晋升`);
  assert.notEqual(state().activeAI, id);
  assert.notEqual(state().activeBP, id);
}

const singleWoundsBeforeMuscularChest = state().singleWounds;
api.defeatWarriorMuscularChest();
assert.equal(state().ruleState.firstmenWarriors.muscularChestMarkers, 1,
  "击败 MUSCULAR CHEST 应放置一枚通用标记");
assert.equal(state().singleWounds, singleWoundsBeforeMuscularChest + 1,
  "击败 MUSCULAR CHEST 应增加一个单重损伤");
assert.ok(!state().bpDiscard.includes(warriorCompanionIds[0]) && !state().bpRemoved.includes(warriorCompanionIds[0]),
  "MUSCULAR CHEST 被击败后应留在原位而非弃置或移除");
api.renderApp();
assert.match(nodes.get("#app").innerHTML, /class="warrior-companion-markers"[\s\S]*<strong>×1<\/strong>/,
  "MUSCULAR CHEST 应在卡上显示累计的通用标记");
assert.match(nodes.get("#app").innerHTML, /data-preview="M_WhiteApe:BP2:12"/,
  "MUSCULAR CHEST 被击败后仍应显示在固定槽位");
const normalizedMuscularChestBattle = api.validateState({
  version: 10,
  selectedMonsterId: "M_FirstmenWarriors",
  battle: JSON.parse(JSON.stringify(state())),
  history: [],
  encounters: {},
}).battle;
assert.equal(normalizedMuscularChestBattle.ruleState.firstmenWarriors.muscularChestMarkers, 1,
  "存档应保留 MUSCULAR CHEST 的通用标记数量");

for (let index = 0; index < 3; index++) api.defeatWarriorMuscularChest();
assert.equal(state().ruleState.firstmenWarriors.muscularChestMarkers, 4);
assert.equal(state().singleWounds, singleWoundsBeforeMuscularChest + 4);
api.defeatWarriorMuscularChest();
assert.equal(state().ruleState.firstmenWarriors.muscularChestMarkers, 4,
  "MUSCULAR CHEST 最多只能累计四枚通用标记");
assert.equal(state().singleWounds, singleWoundsBeforeMuscularChest + 4,
  "达到四枚标记后再次结算不应继续增加损伤");
api.renderApp();
assert.match(nodes.get("#app").innerHTML, /data-warrior-muscular-defeat disabled/,
  "达到四枚标记后应禁用结算击败按钮");

const allMonsterCards = context.window.KF_MONSTER_DATA.monsters.flatMap(monster => monster.cards);
for (const id of warriorCompanionIds) {
  api.showPreview(allMonsterCards.find(card => card.id === id));
  assert.doesNotMatch(nodes.get("#modal").innerHTML, /data-preview-move=/,
    `${id} 的预览不应提供牌堆移动、弃置或移除操作`);
}

rebuild("full", 2);
const levelTwoWarriorBp = state().bpTrack.findIndex(slot => slot.id);
api.selectMob(levelTwoWarriorBp);
api.settleMob("defeat");
assert.equal(state().ruleState.firstmenWarriors.retributionMarkers, 0,
  "等级 2 的 Firstmen Warriors 不应启用战术反击计数");

rebuild("full", 3);
assert.equal(state().ruleState.firstmenWarriors.retributionMarkers, 0);
api.addWound("single");
api.addWound("double");
assert.equal(state().ruleState.firstmenWarriors.retributionMarkers, 0,
  "单重和双重损伤卡进入损伤堆叠时不应计入战术反击");
assert.equal(state().bpDamage.filter(id => id.startsWith("WOUND:")).length, 2,
  "测试应确实加入一张单重和一张双重损伤卡");

const firstRetributionBp = state().bpTrack.findIndex(slot => slot.id);
api.selectMob(firstRetributionBp);
api.settleMob("defeat");
assert.equal(state().ruleState.firstmenWarriors.retributionMarkers, 1,
  "一张 BP 卡进入损伤堆叠时，战术反击应只累计一枚指示物");
api.renderApp();
assert.match(nodes.get("#app").innerHTML, /战术反击通用指示物 ×1\/4/,
  "战术反击计数应显示在怪物大卡对应特质旁");
assert.match(nodes.get("#app").innerHTML, /style="left:97%;top:28\.7%"/,
  "战术反击通用指示物应位于规则文字右侧，避免遮挡正文");
const normalizedRetributionBattle = api.validateState({
  version: 10,
  selectedMonsterId: "M_FirstmenWarriors",
  battle: JSON.parse(JSON.stringify(state())),
  history: [],
  encounters: {},
}).battle;
assert.equal(normalizedRetributionBattle.ruleState.firstmenWarriors.retributionMarkers, 1,
  "存档应保留尚未达到阈值的战术反击指示物");

for (let defeated = 0; defeated < 3; defeated++) {
  const nextWarriorBp = state().bpTrack.findIndex(slot => slot.id);
  api.selectMob(nextWarriorBp);
  api.settleMob("defeat");
}
assert.equal(state().ruleState.firstmenWarriors.retributionMarkers, 0,
  "第 4 张 BP 卡进入损伤堆叠后应清除全部战术反击指示物");
assert.match(state().ruleState.ruleNotice, /战术反击达到 4.*长音呼嚎.*激活一次巨白猿魔/,
  "达到四张时应提醒在当前行动后触发长音呼嚎并激活巨白猿魔");
api.renderApp();
assert.doesNotMatch(nodes.get("#app").innerHTML, /战术反击通用指示物 ×[1-4]\/4/,
  "战术反击结算提醒后大卡旁不应残留自动指示物");

api.selectMonster("M_Ratwolves");
rebuild("full", 1);
api.renderApp();
const mobMarkerHtml = nodes.get("#app").innerHTML;
assert.doesNotMatch(mobMarkerHtml, /mob-track-toolbar/,
  "杂兵 BP 标记种类不应再使用独立的右侧选择区");
assert.match(mobMarkerHtml, /class="mob-marker-type-picker"/,
  "BP 卡下方的 Token 展示应作为标记种类选择器");
assert.match(mobMarkerHtml, /data-mob-marker-asset/,
  "点击 BP 卡下方 Token 时应能选择标记种类");
const firstMobMarkerSelectHtml = mobMarkerHtml
  .match(/<select data-mob-marker-asset[^>]*>([\s\S]*?)<\/select>/)?.[1] || "";
const mobMarkerAssetIds = [...firstMobMarkerSelectHtml.matchAll(/<option value="([^"]+)"/g)]
  .map(match => match[1]);
const sheetTokenAssetIds = [...mobMarkerHtml.matchAll(/data-token-count="([^"]+)"/g)]
  .map(match => match[1]);
assert.deepEqual(mobMarkerAssetIds, sheetTokenAssetIds,
  "BP 可添加的 Token 种类和顺序应与大卡完全一致");

api.selectMonster("M_PalebloodWorms");
rebuild("full", 1);
api.renderApp();
const palebloodMarkerHtml = nodes.get("#app").innerHTML;
const bloodTokenFile = "httpssteamusercontentaakamaihdnetugc121471199374279135890AFE0D6E4BBFE4427554C0AF999D31C14D91B1E7.png";
assert.ok(fs.existsSync(path.join(root, "assets", "tokens", bloodTokenFile)),
  "血液指示物图片必须位于 AIBP Token 资产目录");
assert.match(palebloodMarkerHtml, /<option value="token-blood" selected>血液<\/option>/,
  "苍血蠕虫 BP 应默认选中血液指示物");
const firstPalebloodBp = state().bpTrack.findIndex(slot => slot.id);
api.changeMobMarker(firstPalebloodBp, "token-blood", 1);
assert.equal(state().bpTrack[firstPalebloodBp].markerTokens["token-blood"], 1,
  "苍血蠕虫 BP 应能独立记录血液指示物");
const normalizedPalebloodBattle = api.validateState({
  version: 10,
  selectedMonsterId: "M_PalebloodWorms",
  battle: JSON.parse(JSON.stringify(state())),
  history: [],
  encounters: {},
}).battle;
assert.equal(normalizedPalebloodBattle.bpTrack[firstPalebloodBp].markerTokens["token-blood"], 1,
  "存档恢复应保留苍血蠕虫 BP 上的血液指示物");
api.renderApp();
assert.ok(nodes.get("#app").innerHTML.includes(bloodTokenFile),
  "苍血蠕虫 BP 卡面应叠加显示血液指示物图片");
api.undo();
assert.equal(state().bpTrack[firstPalebloodBp].markerTokens["token-blood"], undefined,
  "血液指示物的放置必须可撤销");

api.changeMobMarker(firstPalebloodBp, "token-blood", 2);
const palebloodMonster = context.window.KF_MONSTER_DATA.monsters
  .find(monster => monster.id === "M_PalebloodWorms");
state().bpRemoved = palebloodMonster.cards
  .filter(card => card.kind === "BP2")
  .map(card => card.id);
const palebloodTrackIdsBeforePromotion = state().bpTrack.map(slot => slot.id);
const occupiedPalebloodSlots = state().bpTrack.filter(slot => slot.id);
api.promoteLowest("bp");
assert.deepEqual(state().bpTrack.map(slot => slot.id), palebloodTrackIdsBeforePromotion,
  "供应为空时不应替换苍血蠕虫 BP");
assert.equal(state().bpTrack[firstPalebloodBp].markerTokens["token-blood"], 3,
  "供应为空时应在已有血液数量上增加 1 枚");
assert.ok(occupiedPalebloodSlots.every(slot => slot.markerTokens["token-blood"] >= 1),
  "供应为空时应在杂兵轨每张非空 BP 上各放置 1 枚血液指示物");
assert.match(state().ruleState.ruleNotice, /BP2 晋升供应为空.*全部 4 张 BP.*各放置 1 枚血液指示物/,
  "供应为空时应显示苍血蠕虫的替代晋升效果");
api.undo();
assert.equal(state().bpTrack[firstPalebloodBp].markerTokens["token-blood"], 2,
  "撤销替代晋升时应一次移除本次放置的全部血液指示物");
assert.ok(state().bpTrack.filter((slot, index) => slot.id && index !== firstPalebloodBp)
  .every(slot => !slot.markerTokens["token-blood"]),
  "撤销替代晋升不应影响此前已有的血液指示物");

rebuild("full", 3);
const initialScabArmorSlots = state().bpTrack.filter(slot => slot.id);
assert.equal(initialScabArmorSlots.length, 4, "三级苍血蠕虫测试应有 4 张初始 BP");
assert.ok(initialScabArmorSlots.every(slot => slot.markerTokens["token-blood"] === 1),
  "三级以上冲突开始时应在所有初始 BP 上各放置 1 枚血液指示物");
api.renderApp();
assert.match(nodes.get("#app").innerHTML, /血痂护甲.*每枚血液使该 BP 的 AT 降低 1/,
  "三级以上应在杂兵轨上方显示血痂护甲规则摘要");

const defeatedScabArmorIndex = state().bpTrack.findIndex(slot => slot.id);
api.selectMob(defeatedScabArmorIndex);
api.settleMob("defeat");
api.spawnMob("interval");
assert.equal(state().bpTrack[defeatedScabArmorIndex].markerTokens["token-blood"], 1,
  "三级以上冲突中生成的苍血蠕虫 BP 应自动获得 1 枚血液指示物");
api.renderApp();
assert.doesNotMatch(nodes.get("#app").innerHTML, /paleblood-at-modifier|AT -1/,
  "血痂护甲不应在 BP 卡面叠加 AT 数值标签");

rebuild("full", 2);
assert.ok(state().bpTrack.filter(slot => slot.id).every(slot => !slot.markerTokens["token-blood"]),
  "二级冲突的初始 BP 不应触发血痂护甲");
api.renderApp();
assert.doesNotMatch(nodes.get("#app").innerHTML, /class="mob-rule-note"/,
  "二级冲突不应显示血痂护甲规则摘要");

api.selectMonster("M_Ratwolves");
rebuild("full", 1);
const firstReadyActivation = state().mobActivations
  .filter(token => !token.used && state().bpTrack[token.position]?.id)
  .sort((left, right) => left.position - right.position)[0];
const expectedMobAi = state().aiDeck[0];
const expectedMobAiFace = context.window.KF_MONSTER_DATA.monsters
  .find(monster => monster.id === "M_Ratwolves").cards
  .find(card => card.id === expectedMobAi).image.face;
assert.doesNotThrow(() => api.resolveMobActivation(firstReadyActivation.id),
  "杂兵 AI 指示物第一次点击不应报错");
assert.equal(state().activeMobActivationId, firstReadyActivation.id,
  "第一次点击应立即进入该杂兵激活");
assert.equal(state().activeAI, expectedMobAi,
  "第一次点击应立即显示 AI 牌组顶牌");
assert.ok(nodes.get("#app").innerHTML.includes(expectedMobAiFace),
  "第一次点击后当前 AI 卡面应立即渲染");
api.settle("ai", "discard");
assert.equal(state().activeMobActivationId, "", "结算 AI 后应完成杂兵激活");
assert.ok(firstReadyActivation.used, "结算 AI 后激活指示物应翻至已用面");

api.selectMonster("M_Ratwolves");
const ratSetup = context.window.KF_CONFLICT_SETUPS.monsters.find(item => item.id === "M_Ratwolves");
const savedInitialBp = ratSetup.initialBp;
delete ratSetup.initialBp;
assert.match(api.mobSetup().error, /缺少 initialBp/, "缺失配置必须报错而不是使用兜底数量");
api.rebuild();
assert.equal(state().conflictStatus, "failed", "非法配置必须阻止建立冲突");
ratSetup.initialBp = savedInitialBp;
api.rebuild();
assert.equal(state().conflictStatus, "active");

const ratwolves = context.window.KF_MONSTER_DATA.monsters.find(item => item.id === "M_Ratwolves");
const ratWoundsBeforeRebirth = state().singleWounds;
api.selectMob(0);
api.settleMob("defeat");
assert.equal(ratwolves.cards.find(card => card.id === state().bpTrack[0].id)?.kind, "BP2",
  "BP1 狼鼠死亡并完成当前行动后应优先生成高一阶 BP2");
assert.equal(state().singleWounds, ratWoundsBeforeRebirth + 1,
  "新生狼鼠生成前应照常完成原狼鼠的损伤结算");
assert.equal(state().ruleState.ratwolves.pendingSignature, true,
  "生成新狼鼠后应进入待执行标志行为状态");
assert.match(state().ruleState.ruleNotice, /随机一名骑士相邻同伴.*最靠近场边且无障碍.*位移其他模型.*标志行为/,
  "新生狼鼠提示应包含完整的模型放置和标志行为规则");
api.renderApp();
assert.match(nodes.get("#app").innerHTML, /class="mob-rule-note ratwolf-rebirth-note"[\s\S]*data-ratwolf-signature-complete/,
  "杂兵轨应显示新生狼鼠的放置提示和完成标志行为按钮");
api.selectMob(1);
assert.equal(state().activeBP, "", "新生狼鼠完成标志行为前不应允许选择其他 BP");
api.completeRatwolfSignature();
assert.equal(state().ruleState.ratwolves.pendingSignature, false,
  "确认后应解除新生狼鼠的标志行为锁定");

ratSetup.initialBp = { BP1: 3 };
api.rebuild();
for (const card of ratwolves.cards.filter(card => card.kind === "BP2")) api.moveAibpCard(card.id, "removed");
api.selectMob(0);
api.settleMob("defeat");
assert.equal(ratwolves.cards.find(card => card.id === state().bpTrack[0].id)?.kind, "BP1",
  "高一阶供应耗尽时应优先生成同阶狼鼠");
assert.equal(state().ruleState.ratwolves.rankSource, "同阶");
api.completeRatwolfSignature();

ratSetup.initialBp = { BP2: 3 };
api.rebuild();
for (const card of ratwolves.cards.filter(card => card.kind === "BP3")) api.moveAibpCard(card.id, "removed");
api.selectMob(0);
api.settleMob("defeat");
assert.equal(ratwolves.cards.find(card => card.id === state().bpTrack[0].id)?.kind, "BP1",
  "高一阶和同阶供应均耗尽时应生成低一阶狼鼠");
assert.equal(state().ruleState.ratwolves.rankSource, "低一阶");
api.completeRatwolfSignature();
ratSetup.initialBp = savedInitialBp;
api.rebuild();

api.selectMonster("M_WingedNightmare");
const winged = context.window.KF_MONSTER_DATA.monsters.find(item => item.id === "M_WingedNightmare");
const wideWingsId = "M_WingedNightmare:BPS:1";
const bloodyDefianceId = "M_WingedNightmare:BPX:2";
const wingedCardKind = id => winged.cards.find(card => card.id === id)?.kind;
const wingedActiveCounts = () => [...state().aiDeck, ...state().aiDiscard].reduce((counts, id) => {
  const kind = wingedCardKind(id);
  counts[kind] = (counts[kind] || 0) + 1;
  return counts;
}, {});
const moveWingedAiToDiscardTop = kind => {
  const id = [...state().aiDeck, ...state().aiDiscard].find(cardId => wingedCardKind(cardId) === kind);
  assert.ok(id, `测试需要一张 ${kind}`);
  state().aiDeck = state().aiDeck.filter(cardId => cardId !== id);
  state().aiDiscard = state().aiDiscard.filter(cardId => cardId !== id);
  state().aiDiscard.push(id);
  return id;
};
const assertWideWingsFixed = () => {
  for (const zone of ["aiDeck", "aiDiscard", "aiRemoved", "bpDeck", "bpDiscard", "bpDamage", "bpRemoved"]) {
    assert.ok(!state()[zone].includes(wideWingsId), `Wide Wings 不应进入 ${zone}`);
  }
  assert.ok(!state().bpTrack.some(slot => slot.id === wideWingsId), "Wide Wings 不应进入杂兵 BP 轨");
  assert.notEqual(state().activeBP, wideWingsId);
};

assert.equal(state().bpTrack.length, 0, "翼生梦魇不应创建杂兵 BP 轨");
assert.equal(state().mobActivations.length, 0, "翼生梦魇不应创建杂兵激活指示物");
assert.equal(state().bpDeck.length, 0, "Wide Wings 不应作为可抽取 BP");
assert.equal(state().aiDiscard.length, 1, "冲突开始时 AI 弃牌堆应立即获得牌组顶 1 张 AI");
assertWideWingsFixed();

api.renderApp();
const wingedHtml = nodes.get("#app").innerHTML;
assert.match(wingedHtml, /PERMANENT BP/);
assert.match(wingedHtml, /data-preview="M_WingedNightmare:BPS:1"/,
  "Wide Wings 应永久正面显示在 BP 区域");
assert.match(wingedHtml, /data-winged-attack="fail"/);
assert.match(wingedHtml, /data-winged-attack="success"/);
assert.match(wingedHtml, /data-winged-ai-response/);
assert.doesNotMatch(wingedHtml, /aria-label="杂兵 BP 轨"/);
assert.doesNotMatch(wingedHtml, /id="startMobRound"|data-settle="bp:flip"|data-spawn-mode=|data-promote="bp"/,
  "翼生梦魇不应显示杂兵回合、翻面、生成或 BP 晋升操作");

const woundsBeforeFailure = state().singleWounds;
api.resolveWingedNightmareAttack(false);
assert.equal(state().singleWounds, woundsBeforeFailure, "未击伤不应改变损伤堆");
assertWideWingsFixed();

const ai1Before = wingedActiveCounts();
api.resolveWingedNightmareAttack(true);
let promotedCounts = wingedActiveCounts();
assert.equal(state().singleWounds, woundsBeforeFailure + 1, "击伤应加入 1 张单重损伤");
assert.ok(state().bpDamage.at(-1).startsWith("WOUND:single:"), "击伤应加入独立的单重损伤牌");
assert.equal(Number(promotedCounts.AI1 || 0), ai1Before.AI1 - 1, "AI1 顶牌应按 BP1 方式晋升 AI1");
assert.equal(promotedCounts.AI2, Number(ai1Before.AI2 || 0) + 1, "AI1 顶牌应加入 AI2");
assertWideWingsFixed();

moveWingedAiToDiscardTop("AI2");
const ai2Before = wingedActiveCounts();
api.resolveWingedNightmareAttack(true);
promotedCounts = wingedActiveCounts();
assert.equal(Number(promotedCounts.AI2 || 0), ai2Before.AI2 - 1, "AI2 顶牌应按 BP2 方式晋升 AI2");
assert.equal(promotedCounts.AI3, Number(ai2Before.AI3 || 0) + 1, "AI2 顶牌应加入 AI3");

moveWingedAiToDiscardTop("AI3");
const ai3Before = wingedActiveCounts();
api.resolveWingedNightmareAttack(true);
promotedCounts = wingedActiveCounts();
assert.equal(Number(promotedCounts.AI1 || 0), ai3Before.AI1 - 1, "AI3 顶牌应按 BP3 方式晋升最低阶 AI");
assert.equal(promotedCounts.AI3, ai3Before.AI3 + 1, "AI3 顶牌应增加 AI3");
assertWideWingsFixed();

const responseTop = state().aiDiscard.at(-1);
api.resolveWingedAiResponse();
assert.equal(state().aiDiscard.at(-1), responseTop, "AI Response 不应移动 AI 弃牌堆顶卡");
assert.ok(nodes.get("#modal").innerHTML.includes(winged.cards.find(card => card.id === responseTop).image.face),
  "AI Response 应显示 AI 弃牌堆顶卡面");
assert.doesNotMatch(nodes.get("#modal").innerHTML, /data-preview-move/,
  "AI Response 预览不应允许移动弃牌堆顶卡");

state().aiDiscard = [];
const automaticDiscard = state().aiDeck[0];
api.commit();
assert.equal(state().aiDiscard.at(-1), automaticDiscard, "AI 弃牌堆为空时应立即弃置 AI 牌组顶牌");
assert.ok(!state().aiDeck.includes(automaticDiscard));
assertWideWingsFixed();

api.showPreview(winged.cards.find(card => card.id === wideWingsId));
assert.doesNotMatch(nodes.get("#modal").innerHTML, /data-preview-move/,
  "Wide Wings 预览不应提供移动操作");
state().clashPhase = "full";
state().level = 1;
assert.ok(!api.activeReferenceIds().includes("M_WingedNightmare:BPX:2"));
state().level = 2;
assert.ok(api.activeReferenceIds().includes("M_WingedNightmare:BPX:2"));

rebuild("full", 2);
assert.equal(state().ruleState.wingedNightmare.bloodyDefiance, false);
for (let index = 0; index < 5; index++) api.addWound("single");
api.renderApp();
assert.match(nodes.get("#app").innerHTML,
  /class="aibp-pending"><button class="card-button" data-preview="M_WingedNightmare:BPS:1"/,
  "达到阈值前应继续攻击 Wide Wings");
api.resolveWingedNightmareAttack(true);
assert.equal(state().singleWounds, 6, "第 6 次击伤应正常加入单重损伤");
assert.equal(state().conflictStatus, "active", "不屈顽抗触发后冲突应继续进行");
assert.equal(state().ruleState.wingedNightmare.bloodyDefiance, true,
  "等级 2+ 完全冲突达到第 6 个损伤时应触发不屈顽抗");
assert.ok(!api.activeReferenceIds().includes(bloodyDefianceId),
  "触发后 Bloody Defiance 不应在特质参考区重复显示");
api.renderApp();
assert.match(nodes.get("#app").innerHTML,
  /class="aibp-pending"><button class="card-button" data-preview="M_WingedNightmare:BPX:2"/,
  "触发后 BP 区应由 Bloody Defiance 覆盖 Wide Wings");
api.showPreview(winged.cards.find(card => card.id === bloodyDefianceId));
assert.doesNotMatch(nodes.get("#modal").innerHTML, /data-preview-move/,
  "Bloody Defiance 作为固定 BP 时不应提供移动操作");
const bloodyDefianceWounds = state().singleWounds;
api.resolveWingedNightmareAttack(true);
assert.equal(state().singleWounds, bloodyDefianceWounds + 1,
  "不屈顽抗触发后仍应能继续攻击 Bloody Defiance");
assert.equal(state().ruleState.wingedNightmare.bloodyDefiance, true);

rebuild("preliminary", 2);
assert.ok(!api.activeReferenceIds().includes(bloodyDefianceId), "初步冲突应忽略 Bloody Defiance");
for (let index = 0; index < 5; index++) api.addWound("single");
api.resolveWingedNightmareAttack(true);
assert.equal(state().ruleState.wingedNightmare.bloodyDefiance, false,
  "初步冲突达到第 6 个损伤也不应触发不屈顽抗");
api.renderApp();
assert.match(nodes.get("#app").innerHTML,
  /class="aibp-pending"><button class="card-button" data-preview="M_WingedNightmare:BPS:1"/,
  "初步冲突应始终保留 Wide Wings");

api.selectMonster("M_Pumpkinhead");
const pumpkinSlots = state().bpTrack.filter(slot => slot.id);
assert.equal(pumpkinSlots.filter(slot => slot.side === "back").length, 2);
assert.equal(pumpkinSlots.filter(slot => slot.side === "face").length, 4);
assert.ok(pumpkinSlots.filter(slot => slot.side === "back")
  .every(slot => slot.revealed && slot.markers === 1 && slot.markerTokens["token-01"] === 1));

api.selectMonster("M_Ironcast");
const ironcast = context.window.KF_MONSTER_DATA.monsters.find(item => item.id === "M_Ironcast");
rebuild("full", 1);
assert.ok(state().bpTrack.filter(slot => slot.id).every(slot => !slot.markerTokens["token-armor"]),
  "铁铸亡者的初始 BP 不应自动获得盔甲指示物");
api.spawnMob("interval");
const ironcastBp1 = state().bpTrack.filter(slot =>
  ironcast.cards.find(card => card.id === slot.id)?.kind === "BP1"
).length;
assert.equal(ironcastBp1, 5, "间隔生成必须优先使用剩余 BP1");
assert.equal(state().bpTrack.filter(slot => slot.markerTokens["token-armor"] === 1).length, 0,
  "等级 1 的铁铸亡者生成 BP 时不应获得盔甲指示物");

rebuild("full", 3);
api.spawnMob("interval");
assert.equal(state().bpTrack.filter(slot => slot.markerTokens["token-armor"] === 1).length, 1,
  "等级 3 的铁铸亡者生成 BP 时应自动获得 1 枚盔甲指示物");
const manualIroncastBp = ironcast.cards.find(card => /^BP[1-3]$/.test(card.kind)
  && !state().bpTrack.some(slot => slot.id === card.id));
api.moveAibpCard(manualIroncastBp.id, "mob-left");
assert.equal(state().bpTrack.filter(slot => slot.markerTokens["token-armor"] === 1).length, 2,
  "等级 3 手动放入杂兵轨的新铁铸亡者 BP 也应自动获得盔甲指示物");

rebuild("full", 1);
api.renderApp();
assert.doesNotMatch(nodes.get("#app").innerHTML, /data-ironcast-necrofusion-slot|data-ironcast-necrofusion-token/,
  "等级 1 不应显示或触发亡骸融合计数");
const levelOneIroncastBp3 = state().bpTrack.findIndex(slot =>
  ironcast.cards.find(card => card.id === slot.id)?.kind === "BP3"
);
api.selectMob(levelOneIroncastBp3);
api.settleMob("critical");
assert.equal(state().ruleState.ironcast.necrofusion, 0,
  "等级 1 的铁铸亡者受到双重损伤时不应累计亡骸融合");

rebuild("full", 2);
api.renderApp();
assert.match(nodes.get("#app").innerHTML, /data-ironcast-necrofusion-slot/,
  "等级 2 的铁铸亡者应在亡骸融合特质位置显示计数入口");
assert.match(nodes.get("#app").innerHTML,
  /data-ironcast-necrofusion-slot style="left:16\.0%;top:66\.5%"/,
  "亡骸融合计数入口应位于特质正文下方的留白处");
const levelTwoIroncastBp3 = state().bpTrack.findIndex(slot =>
  ironcast.cards.find(card => card.id === slot.id)?.kind === "BP3"
);
api.selectMob(levelTwoIroncastBp3);
api.settleMob("critical");
assert.equal(state().ruleState.ironcast.necrofusion, 2,
  "等级 2 的铁铸亡者受到双重损伤时应累计 2 枚亡骸融合指示物");
const nextIroncast = state().bpTrack.findIndex(slot => slot.id);
api.selectMob(nextIroncast);
api.settleMob("defeat");
assert.equal(state().ruleState.ironcast.necrofusion, 3,
  "亡骸融合应按每重损伤自动累计到阈值");
assert.match(nodes.get("#app").innerHTML, /data-ironcast-necrofusion-token/,
  "亡骸融合自动计数应显示在怪物大卡上");
const ironcastCountBeforeNecrofusion = state().bpTrack.filter(slot => slot.id).length;
api.resolveIroncastNecrofusion();
assert.equal(state().ruleState.ironcast.necrofusion, 0,
  "结算亡骸融合后应清除全部指示物");
assert.equal(state().bpTrack.filter(slot => slot.id).length, ironcastCountBeforeNecrofusion + 1,
  "结算亡骸融合后应生成 1 只铁铸骷髅");
assert.equal(state().bpTrack.filter(slot => slot.markerTokens["token-armor"] === 1).length, 0,
  "等级 2 的亡骸融合生成 BP 时不应获得盔甲指示物");
assert.doesNotMatch(state().ruleState.ruleNotice, /带有盔甲指示物/,
  "等级 2 的亡骸融合结算提示不应声称新 BP 带有盔甲");
assert.match(state().ruleState.ruleNotice, /距离首要目标最近的瓦砾空格.*立刻执行一次标志行为/,
  "亡骸融合结算提示应包含模型放置与标志行为");

api.selectMonster("M_KingLaidLow");
rebuild("full", 1);
api.recordP2WoundCounters(context.window.KF_MONSTER_DATA.monsters.find(item => item.id === "M_KingLaidLow"), 2);
api.renderApp();
assert.equal(state().ruleState.kingLaidLow.putrid, 0,
  "等级 1 的俯伏王受到双重损伤时不应累计腐臭赎罪");
assert.doesNotMatch(nodes.get("#app").innerHTML, /data-king-putrid-(?:slot|token|control|delta)/,
  "等级 1 的俯伏王不应显示腐臭赎罪指示物控件");

rebuild("full", 2);
api.renderApp();
assert.match(nodes.get("#app").innerHTML,
  /data-king-putrid-slot style="left:73\.5%;top:41\.0%"/,
  "等级 2+ 应在右侧大卡的腐臭赎罪特质上显示通用指示物入口");
assert.equal(api.renderBossRules(), "",
  "俯伏王不应显示当前 Boss 专用操作面板");
const kingLaidLow = context.window.KF_MONSTER_DATA.monsters.find(item => item.id === "M_KingLaidLow");
api.recordP2WoundCounters(kingLaidLow, 2);
assert.equal(state().ruleState.kingLaidLow.putrid, 2,
  "俯伏王受到双重损伤时应累计 2 枚腐臭赎罪指示物");
api.recordP2WoundCounters(kingLaidLow, 2);
assert.equal(state().ruleState.kingLaidLow.putrid, 4,
  "腐臭赎罪达到阈值后应保留全部指示物等待点击结算");
api.renderApp();
assert.match(nodes.get("#app").innerHTML, /data-king-putrid-token/,
  "腐臭赎罪计数应以通用指示物显示在怪物大卡上");
assert.match(nodes.get("#app").innerHTML, /must-resolve[^>]*style="left:73\.5%;top:41%"/,
  "腐臭赎罪达到 4 后应突出显示为可点击结算状态");
api.resolveKingPutridPenance();
assert.equal(state().ruleState.kingLaidLow.putrid, 0,
  "点击结算腐臭赎罪后应清除全部指示物");
assert.equal(state().ruleState.ruleCard, kingLaidLow.cards.find(card => card.kind === "SIG").id,
  "点击结算腐臭赎罪后应打开俯伏王标志行为卡");
assert.match(state().ruleState.ruleCardReason, /腐臭赎罪：标志行为/,
  "腐臭赎罪触发的卡面应明确标记为标志行为");

api.selectMonster("M_Toadragon");
assert.equal(api.renderBossRules(), "",
  "蟾蜍龙不应显示当前 Boss 专用操作面板");

api.selectMonster("M_Ratwolves");
assert.ok(api.activeReferenceIds().some(id => id.includes(":Trait_SK:")));
assert.ok(!api.activeReferenceIds().some(id => id.includes(":Trait_POS:")));
context.window.KF_CAMPAIGN_KINGDOM = "stone";
assert.ok(api.activeReferenceIds().some(id => id.includes(":Trait_POS:")));
assert.ok(!api.activeReferenceIds().some(id => id.includes(":Trait_SK:")));

const exported = JSON.parse(JSON.stringify(api.state()));
exported.version = 10;
exported.battle.clashPhase = "preliminary";
exported.encounters = {};
assert.equal(api.validateState(exported).battle.clashPhase, "preliminary");
exported.version = 9;
assert.throws(() => api.validateState(exported), /旧版存档不兼容/);

api.selectMonster("M_BogWitch");
rebuild("preliminary", 1);
api.renderApp();
const rendered = nodes.get("#app").innerHTML;
assert.match(rendered, /初步冲突 · SW ×2/);
assert.match(rendered, /value="preliminary" selected/);
assert.match(rendered, /data-rule-action="cookie-crumbs" disabled/,
  "等级 1 的沼地女巫不应激活 Cookie Crumbs");
assert.doesNotMatch(rendered, /<span class="badge">Cookie/,
  "Boss 操作区不应重复显示 Cookie Crumbs 计数");
const aiPendingStart = rendered.indexOf('<div class="aibp-pending">');
const aiPendingEnd = rendered.indexOf("</div>", aiPendingStart);
const aiPendingHtml = rendered.slice(aiPendingStart, aiPendingEnd);
assert.doesNotMatch(aiPendingHtml, /ROUTINE · Bog Witch/, "AI 空位不应显示 SIG 的 ROUTINE 正面");
assert.match(aiPendingHtml, /SIGNATURE · Bog Witch/, "AI 空位应只显示 SIG 的 SIGNATURE 反面");
assert.doesNotMatch(aiPendingHtml, /data-preview-side="face"/);
assert.match(aiPendingHtml, /data-preview-side="back"/);
assert.doesNotMatch(aiPendingHtml, /暂无卡牌/);
assert.match(rendered, /ROUTINE · Bog Witch/, "SIG 正面仍应显示在参考牌区域");
assert.match(rendered, /SIGNATURE · Bog Witch/, "SIG 反面仍应显示在参考牌区域");
state().bpDeck.forEach((id, index) => {
  const level = context.window.KF_MONSTER_DATA.monsters.find(item => item.id === "M_BogWitch")
    .cards.find(card => card.id === id).kind.replace("BP", "");
  assert.ok(rendered.includes(`<option value="${index}">候选 ${index + 1}（等级 ${level}）</option>`),
    `面朝下 BP 候选 ${index + 1} 应显示等级`);
});
assert.equal(state().ruleState.bogWitch.position, 0, "沼地女巫指示物应从最左侧沼地位置开始");
assert.equal((rendered.match(/data-bog-position=/g) || []).length, 3, "沼地女巫大卡应提供三个可标记位置");
assert.match(rendered, /class="bog-position-slot active"[\s\S]*data-bog-position="0"/,
  "沼地女巫的当前标记应显示在最左侧位置");
api.setBogWitchPosition(2);
assert.equal(state().ruleState.bogWitch.position, 2, "沼地女巫指示物应能移动到指定位置");
api.renderApp();
assert.match(nodes.get("#app").innerHTML, /class="bog-position-slot active"[\s\S]*data-bog-position="2"/,
  "移动后的沼地女巫标记应显示在对应大卡位置");
api.undo();
assert.equal(state().ruleState.bogWitch.position, 0, "沼地位置移动应支持撤销");
for (const holder of ["沼地女巫", "测试骑士"]) {
  const attachedCards = [];
  for (let index = 0; index < 2; index++) {
    api.draw("ai");
    attachedCards.push(state().activeAI);
    api.attachBogAi(holder);
  }
  const holderAttachments = state().ruleState.aiAttachments.filter(item => item.holder === holder);
  assert.equal(holderAttachments.length, 2, `${holder}应允许附着多张 AI`);
  assert.deepEqual(holderAttachments.map(item => item.cardId), attachedCards,
    `${holder}的新附着 AI 不应替换或丢弃已有附着 AI`);
  assert.ok(attachedCards.every(id => !state().aiDiscard.includes(id)),
    `${holder}的附着 AI 不应进入弃牌堆`);
}
api.draw("bp");
api.settle("bp", "defeat");
assert.equal(state().ruleState.cookieTokens, 0, "等级 1 的沼地女巫受伤时不应累计 Cookie Crumbs");

rebuild("full", 3);
api.draw("bp");
const cookieBpRank = Number(context.window.KF_MONSTER_DATA.monsters.find(item => item.id === "M_BogWitch")
  .cards.find(card => card.id === state().activeBP).kind.replace("BP", ""));
api.settle("bp", "defeat");
const expectedCookieTokens = cookieBpRank === 3 ? 2 : 1;
assert.equal(state().ruleState.cookieTokens, expectedCookieTokens,
  "等级 3 的沼地女巫应按损伤值自动累计 Cookie Crumbs");
const cookieSheetHtml = nodes.get("#app").innerHTML;
assert.match(cookieSheetHtml, /data-auto-armor-slot="Cookie Crumbs"/,
  "Cookie Crumbs 累计值应作为自动通用标记显示在大卡特质位置");
assert.ok(cookieSheetHtml.includes(`Cookie Crumbs ×${expectedCookieTokens}`));
assert.match(rendered, /Precision\+/, "正面精准标记应显示为 Precision+");
assert.match(rendered, /Precision-/, "负面精准标记应显示为 Precision-");
for (const [positive, negative] of [
  ["Precision+", "Precision-"],
  ["AT+", "AT-"],
  ["Speed+", "Speed-"],
  ["To-Hit+", "To-Hit-"],
]) {
  const positiveIndex = rendered.indexOf(`title="${positive}"`);
  const negativeIndex = rendered.indexOf(`title="${negative}"`);
  assert.ok(positiveIndex >= 0, `${positive} 应出现在标记列表中`);
  assert.ok(negativeIndex > positiveIndex, `${negative} 应排列在 ${positive} 后面`);
  const choicesBetween = (rendered.slice(positiveIndex, negativeIndex).match(/class="sheet-token-choice"/g) || []).length;
  assert.equal(choicesBetween, 1, `${positive} 和 ${negative} 应相邻排列`);
}
for (const removedTokenId of ["token-02", "token-03", "token-05", "token-07", "token-10", "token-12", "token-13", "token-14", "token-15", "token-evasion-minus", "token-23", "token-24", "token-28"]) {
  assert.ok(!rendered.includes(`value="${removedTokenId}"`), `${removedTokenId} 不应继续显示在标记列表中`);
}
const swImage = context.window.KF_MONSTER_DATA.wounds.single.image.face;
assert.equal(rendered.split(swImage).length - 1, 2, "损伤区应渲染 2 张真实 SW 卡面");

rebuild("full", 1);
const aiCard = state().aiDeck[1];
api.moveAibpCard(aiCard, "top");
assert.equal(state().aiDeck[0], aiCard, "AI 卡应能置于抽牌堆顶部");
api.moveAibpCard(aiCard, "bottom");
assert.equal(state().aiDeck.at(-1), aiCard, "AI 卡应能置于抽牌堆底部");
api.moveAibpCard(aiCard, "discard");
assert.ok(!state().aiDeck.includes(aiCard));
assert.equal(state().aiDiscard.at(-1), aiCard, "AI 卡应能从抽牌堆移入弃牌堆");
api.moveAibpCard(aiCard, "shuffle");
assert.ok(state().aiDeck.includes(aiCard), "弃牌堆中的 AI 卡应能洗回抽牌堆");
assert.ok(!state().aiDiscard.includes(aiCard));
api.moveAibpCard(aiCard, "removed");
assert.ok(state().aiRemoved.includes(aiCard), "AI 卡应能直接移入移除区");
assert.ok(!state().aiDeck.includes(aiCard));

api.draw("ai");
const activeAi = state().activeAI;
api.moveAibpCard(activeAi, "discard");
assert.equal(state().activeAI, "", "移动当前 AI 后应清除待处理状态");
assert.ok(!state().aiDeck.includes(activeAi));
assert.ok(state().aiDiscard.includes(activeAi));

const monster = context.window.KF_MONSTER_DATA.monsters.find(item => item.id === state().monsterId);
const supplyBp = monster.cards.find(card => card.kind === "BP3" && !state().bpDeck.includes(card.id));
assert.ok(supplyBp, "测试需要一张未使用的 BP3 供应牌");
api.moveAibpCard(supplyBp.id, "top");
assert.equal(state().bpDeck[0], supplyBp.id, "BP 供应牌应能直接置于抽牌堆顶部");
assert.doesNotThrow(() => api.validateState(api.state()), "移动卡牌后各区域不应出现重复 ID");

api.showPreview(supplyBp);
const previewHtml = nodes.get("#modal").innerHTML;
for (const label of ["放到抽牌堆顶部", "放到抽牌堆底部", "洗入抽牌堆", "弃置", "移除"]) {
  assert.match(previewHtml, new RegExp(label), `大图弹层应显示“${label}”操作`);
}
assert.doesNotMatch(previewHtml, /放置到最左侧杂兵轨道/, "首领 BP 不应显示杂兵轨放置操作");

const bogWitchSig = context.window.KF_MONSTER_DATA.monsters
  .find(item => item.id === "M_BogWitch").cards.find(card => card.kind === "SIG");
api.selectMonster("M_BogWitch");
api.showPreview(bogWitchSig, "face");
assert.match(nodes.get("#modal").innerHTML, /ROUTINE · Bog Witch/);
assert.ok(nodes.get("#modal").innerHTML.includes(bogWitchSig.image.face));
api.showPreview(bogWitchSig, "back");
assert.match(nodes.get("#modal").innerHTML, /SIGNATURE · Bog Witch/);
assert.ok(nodes.get("#modal").innerHTML.includes(bogWitchSig.image.back));

api.selectMonster("M_Ratwolves");
const removedMobBp = state().bpTrack[0].id;
const movedMobBp = state().bpTrack[1].id;
api.moveAibpCard(removedMobBp, "removed");
assert.ok(state().bpRemoved.includes(removedMobBp), "杂兵 BP 应能直接移入移除区");
api.moveAibpCard(movedMobBp, "mob-left");
assert.equal(state().bpTrack[0].id, movedMobBp, "杂兵 BP 应放到最左侧空轨道");
assert.ok(!state().bpTrack.slice(1).some(slot => slot.id === movedMobBp), "移动后杂兵 BP 不应重复存在");
api.showPreview(context.window.KF_MONSTER_DATA.monsters.find(item => item.id === "M_Ratwolves").cards.find(card => card.id === movedMobBp));
assert.match(nodes.get("#modal").innerHTML, /放置到最左侧杂兵轨道/, "杂兵 BP 应显示最左侧轨道操作");
assert.doesNotThrow(() => api.validateState(api.state()), "杂兵 BP 移动后状态应保持有效");

api.selectMonster("M_Eggknight");
api.setSheetTokenCount("token-armor", 3);
let manualArmorTokens = state().sheetTokens.filter(token => token.assetId === "token-armor");
assert.equal(manualArmorTokens.length, 1, "通用护甲应保存为一个可拖动的指示物堆");
assert.equal(manualArmorTokens[0].count, 3, "通用护甲指示物堆应保留完整数量");
api.setSheetTokenCount("token-armor", 8);
manualArmorTokens = state().sheetTokens.filter(token => token.assetId === "token-armor");
assert.equal(manualArmorTokens.length, 1, "增加通用护甲不应产生多个独立位置");
assert.equal(manualArmorTokens[0].count, 8, "通用护甲数量不应被限制为两枚");
api.renderApp();
const armorTokenHtml = nodes.get("#app").innerHTML;
assert.match(armorTokenHtml, /data-sheet-token="[^"]+"[\s\S]*?sheet-token-quantity">x8<\/span>/,
  "通用护甲应在大卡上渲染为可拖动的 x8 堆叠");
for (const slot of ["bp1", "bp2", "bp3"]) {
  assert.ok(armorTokenHtml.includes(`data-auto-armor-slot="${slot}"`),
    `蛋蛋骑士 ${slot} 的专属护甲应与通用护甲分开保留`);
}

api.selectMonster("M_Panzerdragon");
let panzerRules = api.renderBossRules();
assert.match(panzerRules, /class="panzer-panel-layout"[\s\S]*class="panzer-trait-row"[\s\S]*class="panzer-controls-panel"/,
  "装甲巨龙的三张 Trait 应位于左区，三组护甲操作应位于右区");
assert.equal((panzerRules.match(/class="panzer-armor-module"/g) || []).length, 3,
  "装甲巨龙的三个目标应各自拥有独立护甲模块");
assert.equal((panzerRules.match(/class="smelted-armor-icon"/g) || []).length, 3,
  "装甲巨龙的三组盔甲应使用与熔怖恶魔一致的指示物样式");
assert.equal((panzerRules.match(/class="crop-card panzer-trait-card"/g) || []).length, 3,
  "装甲巨龙 Boss 专用操作区应显示三张 Trait 卡");
for (const traitId of ["M_Panzerdragon:Trait:38", "M_Panzerdragon:Trait:39", "M_Panzerdragon:Trait:40"]) {
  assert.ok(panzerRules.includes(`data-preview="${traitId}"`), `${traitId} 应可在 Boss 专用操作区点击预览`);
}
assert.match(panzerRules, /虫阵[\s\S]*巨龙[\s\S]*残余[\s\S]*循环迁移/,
  "装甲巨龙面板应清晰展示三个目标与盔甲迁移操作");
api.changePanzerArmor("field", 2);
api.changePanzerArmor("dragon", 3);
api.changePanzerArmor("remnant", 2);
assert.equal(state().ruleState.panzerRetributionArmor, 0, "增加三处盔甲不应影响现行现报弃甲堆");
for (const target of ["field", "dragon", "remnant"]) api.changePanzerArmor(target, -1);
assert.equal(state().ruleState.panzerRetributionArmor, 3, "从三处弃置的盔甲都应自动放到现行现报上");
panzerRules = api.renderBossRules();
assert.match(panzerRules, /data-panzer-trait="dragon"[\s\S]*class="panzer-retribution-token "[\s\S]*class="smelted-armor-count">3<\/strong>/,
  "现行现报卡上应显示累计弃置的盔甲堆");
api.migratePanzerArmor();
assert.equal(state().ruleState.panzerRetributionArmor, 3, "循环迁移盔甲不应计入弃置");
api.changePanzerArmor("field", 5);
for (let index = 0; index < 5; index++) api.changePanzerArmor("field", -1);
assert.equal(state().ruleState.panzerRetributionArmor, 8, "现行现报弃甲堆应累计到 8 枚");
panzerRules = api.renderBossRules();
assert.match(panzerRules, /class="panzer-retribution-token ready"[\s\S]*data-rule-action="clear-panzer-retribution"/,
  "现行现报满 8 枚后，盔甲堆应变为可点击的清空按钮");
assert.notEqual(state().ruleState.ruleNotice, "", "测试前提：装甲巨龙操作已生成规则提示内容");
assert.doesNotMatch(panzerRules, /class="rule-notice"/,
  "装甲巨龙 Boss 专用操作区无论提示内容为何都不应显示黄色框");
const fieldArmorAtCapacity = state().ruleState.panzerArmor.field;
api.changePanzerArmor("field", -1);
assert.equal(state().ruleState.panzerArmor.field, fieldArmorAtCapacity,
  "现行现报满 8 枚时不应继续从三处弃置盔甲");
api.clearPanzerRetributionArmor();
assert.equal(state().ruleState.panzerRetributionArmor, 0, "点击满 8 枚的盔甲堆应一次弃置全部指示物");
assert.equal(state().ruleState.ruleNotice, "", "弃置现行现报的 8 枚盔甲后不应显示黄色提示框");

const bosses = context.window.KF_MONSTER_DATA.monsters.filter(item => item.type === "boss");
for (const boss of bosses) {
  api.selectMonster(boss.id);
  rebuild("full", 1);
  for (const type of ["ai", "bp"]) {
    const ids = state()[`${type}Deck`];
    const currentPileHtml = api.renderPileView(type, "current");
    assert.equal((currentPileHtml.match(/data-guarded-preview=/g) || []).length, ids.length,
      `${boss.name} 的当前 ${type.toUpperCase()} 牌组应全部默认隐藏并要求确认`);
    assert.equal((currentPileHtml.match(/class="crop-card hidden-card"/g) || []).length, ids.length,
      `${boss.name} 的当前 ${type.toUpperCase()} 牌组应只显示卡背`);
    assert.doesNotMatch(currentPileHtml, /data-preview=/,
      `${boss.name} 的当前 ${type.toUpperCase()} 牌组不应绕过确认直接预览`);
  }
}

api.selectMonster("M_Toadragon");
rebuild("full", 1);
const guardedAiId = state().aiDeck[0];
nodes.get("#modal").hidden = true;
context.window.confirm = () => false;
assert.equal(api.showGuardedPreview(guardedAiId, "ai-current"), false,
  "取消确认时不应查看 Boss 当前 AI");
assert.equal(nodes.get("#modal").hidden, true,
  "取消确认时卡牌预览弹层应保持关闭");
context.window.confirm = () => true;
assert.equal(api.showGuardedPreview(guardedAiId, "ai-current"), true,
  "确认执意查看后应允许打开 Boss 当前 AI");
assert.equal(nodes.get("#modal").hidden, false,
  "确认执意查看后应显示卡牌预览弹层");

const toadBpDiscardId = state().bpDeck[0];
const toadBpDiscardCard = context.window.KF_MONSTER_DATA.monsters
  .find(item => item.id === "M_Toadragon").cards.find(card => card.id === toadBpDiscardId);
api.moveAibpCard(toadBpDiscardId, "discard");
const toadBpDiscardHtml = api.renderPileView("bp", "discard");
assert.match(toadBpDiscardHtml, /class="crop-card hidden-card"/,
  "蟾蜍龙 BP 弃牌堆应只显示卡背");
assert.ok(toadBpDiscardHtml.includes(toadBpDiscardCard.image.back),
  "蟾蜍龙 BP 弃牌堆应使用对应卡背");
assert.doesNotMatch(toadBpDiscardHtml, /data-preview=|data-guarded-preview=/,
  "蟾蜍龙 BP 弃牌堆应完全禁止点击查看");

api.selectMonster("M_Ratwolves");
rebuild("full", 1);
assert.match(api.renderPileView("ai", "current"), /data-preview=/,
  "杂兵的当前 AI 牌组不应套用 Boss 隐藏规则");

const horizontalTerrain = { id: "rotation-test", asset: "Swamp", rowStart: 4, rowEnd: 4, columnStart: 6, columnEnd: 7, rotation: 180, flipped: false, layer: 10 };
const rightTurnTerrain = api.rotateConflictTerrain(horizontalTerrain, 90);
assert.equal(rightTurnTerrain.rotation, 270, "右转必须顺时针增加 90 度");
assert.equal(rightTurnTerrain.rowEnd - rightTurnTerrain.rowStart + 1, 2, "横向 1x2 地形右转后必须占用 2 行");
assert.equal(rightTurnTerrain.columnEnd - rightTurnTerrain.columnStart + 1, 1, "横向 1x2 地形右转后必须占用 1 列");
const leftTurnTerrain = api.rotateConflictTerrain(horizontalTerrain, -90);
assert.equal(leftTurnTerrain.rotation, 90, "左转必须逆时针减少 90 度");
assert.equal(leftTurnTerrain.rowEnd - leftTurnTerrain.rowStart + 1, 2, "横向 1x2 地形左转后必须占用 2 行");
assert.equal(leftTurnTerrain.columnEnd - leftTurnTerrain.columnStart + 1, 1, "横向 1x2 地形左转后必须占用 1 列");
const edgeTurnTerrain = api.rotateConflictTerrain({ ...horizontalTerrain, columnStart: 13, columnEnd: 14 }, 90);
assert.ok(edgeTurnTerrain.rowStart >= 1 && edgeTurnTerrain.rowEnd <= 10 && edgeTurnTerrain.columnStart >= 1 && edgeTurnTerrain.columnEnd <= 14,
  "地形旋转后必须按 ATO 规则重新吸附在版图边界内");

api.selectMonster("M_Toadragon");
rebuild("full", 1);
api.renderApp();
const conflictBoardHtml = nodes.get("#app").innerHTML;
assert.match(conflictBoardHtml, /terrain-control-start monster[\s\S]*terrain-start-arrow facing-(0|90|180|270)/,
  "冲突版图中的 Boss 必须显示明确的上下左右朝向");
assert.doesNotMatch(conflictBoardHtml, /terrain-start-arrow[^>]*rotate\((45|135|225|315)deg\)/,
  "冲突版图中的 Boss 不得显示斜向箭头");

console.log("AIBP initialization tests passed");
