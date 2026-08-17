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
  "public/modules/display/data/conflict-board-data.js",
  "public/modules/aibp/app.js"
]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

const api = context.window.KF_AIBP_TEST_API;
const state = () => api.state();
const battle = () => state().battle;
const monster = () => context.window.KF_MONSTER_DATA.monsters.find(item => item.id === battle().monsterId);
const card = id => monster().cards.find(item => item.id === id);
const ranks = (ids, prefix) => ids.map(id => card(id)?.kind).filter(kind => kind?.startsWith(prefix)).sort();

function select(id, level = 1) {
  api.selectMonster(id);
  battle().level = level;
  api.rebuild();
}

select("M_Pumpkinhead", 1);
const pumpkinLayout = context.window.KF_CONFLICT_BOARD_DATA.layouts.find(item => item.id === battle().conflictBoard.layoutId);
const defaultTerrainCount = pumpkinLayout.placements.filter(item => item.kind === "terrain").length;
assert.strictEqual(battle().conflictBoard.terrain.length, defaultTerrainCount, "新冲突必须生成可编辑 TTS 地形状态");
const legacyTerrainSave = JSON.parse(JSON.stringify(state()));
delete legacyTerrainSave.battle.conflictBoard.terrain;
delete legacyTerrainSave.battle.conflictBoard.showStarts;
const migratedTerrainSave = api.validateState(legacyTerrainSave);
assert.strictEqual(migratedTerrainSave.battle.conflictBoard.terrain.length, defaultTerrainCount, "旧存档必须自动补齐 TTS 地形");
battle().conflictBoard.terrain[0].rotation = 90;
battle().conflictBoard.terrain[0].flipped = true;
const terrainSave = JSON.parse(JSON.stringify(state()));
terrainSave.encounters = {};
const terrainRoundTrip = api.validateState(terrainSave);
assert.strictEqual(terrainRoundTrip.battle.conflictBoard.terrain[0].rotation, 90, "地形旋转必须持久化");
assert.strictEqual(terrainRoundTrip.battle.conflictBoard.terrain[0].flipped, true, "地形翻面必须持久化");
assert.ok(api.resetConflictTerrain(), "地形重置必须可执行");
assert.strictEqual(battle().conflictBoard.terrain.length, defaultTerrainCount, "地形重置必须恢复 TTS 默认布局");
assert.strictEqual(battle().conflictBoard.showStarts, true, "地形重置必须恢复初始位置");

select("M_YoungDevour", 1);
assert.deepStrictEqual([...battle().ruleState.phaseIds], ["M_YoungDevour:Trait:38", "M_YoungDevour:Trait:39", "M_YoungDevour:Trait:40"]);
const youngAiBefore = ranks(battle().aiDeck, "AI");
api.draw("bp");
api.settle("bp", "defeat");
assert.strictEqual(battle().singleWounds, 1);
assert.deepStrictEqual(ranks(battle().aiDeck, "AI"), youngAiBefore, "幼龙击伤不得晋升 AI");
api.advanceDevourStage();
assert.strictEqual(battle().ruleState.phaseIndex, 1);
assert.ok(!ranks(battle().aiDeck, "AI").includes("AI1"));
assert.ok(ranks(battle().aiDeck, "AI").includes("AI2"));
api.undo();
assert.strictEqual(battle().ruleState.phaseIndex, 0, "阶段推进必须可撤销");
select("M_YoungDevour", 2);
battle().bpDeck = ["M_YoungDevour:BP3:13"];
const youngCriticalAi = ranks(battle().aiDeck, "AI");
api.draw("bp");
api.settle("bp", "critical");
assert.strictEqual(battle().doubleWounds, 1);
assert.deepStrictEqual(ranks(battle().aiDeck, "AI"), youngCriticalAi, "幼龙暴击也不得晋升 AI");

select("M_WhiteApe", 1);
assert.strictEqual(battle().ruleState.guardians.count, 2, "冲突设置必须包含 2 名先民护卫");
api.startWhiteApeRound();
assert.strictEqual(battle().ruleState.guardians.count, 3, "等级 1 新回合应生成 1 名护卫");
assert.strictEqual(battle().ruleState.pendingCoordinatedAttacks, 1);
api.resolveGuardianAttack();
for (let index = 0; index < 4; index++) {
  api.draw("bp");
  api.settle("bp", "defeat");
}
assert.strictEqual(battle().ruleState.reinforcementTokens, 4, "累计 4 次受伤应达到增援阈值");
api.resolveWhiteReinforcement();
assert.strictEqual(battle().ruleState.guardians.count, 4, "结算增援应生成第 4 名护卫");
assert.strictEqual(battle().ruleState.pendingCoordinatedAttacks, 1);
api.resolveGuardianAttack();
assert.strictEqual(battle().ruleState.pendingCoordinatedAttacks, 0);

select("M_WhiteApe", 3);
const thickSkin = context.window.KF_BOSS_RULE_CONFIG.M_WhiteApe.cards.thickSkin;
assert.strictEqual(battle().bpDeck[0], thickSkin);
const whiteAiBefore = ranks(battle().aiDeck, "AI");
api.draw("bp");
api.settle("bp", "defeat");
assert.strictEqual(battle().singleWounds + battle().doubleWounds, 0);
assert.deepStrictEqual(ranks(battle().aiDeck, "AI"), whiteAiBefore);
assert.strictEqual(battle().ruleState.thickSkinSetAside, true);
api.startWhiteApeRound();
assert.strictEqual(battle().bpDeck[0], thickSkin);
assert.strictEqual(battle().ruleState.guardians.count, 4);
api.resolveGuardianAttack();
api.startWhiteApeRound();
api.resolveGuardianAttack();
api.startWhiteApeRound();
assert.strictEqual(battle().ruleState.guardians.count, 5, "等级 3 护卫上限应为 5");

select("M_KnightFen", 3);
assert.strictEqual(battle().ruleState.doppelgangers[0].cards.length, 2, "等级 3+ 的拟身骑士应使用 2 张 BP");
assert.strictEqual(battle().ruleState.doppelgangers.length, 1, "conflict setup must spawn one doppelganger");
const doppelId = battle().ruleState.doppelgangers[0].id;
const doppelStrength = battle().ruleState.doppelgangers[0].cards.reduce((sum, id) =>
  sum + context.window.KF_BOSS_RULE_CONFIG.M_KnightFen.bpStrength[id], 0
);
api.renderApp();
const fenTrackHtml = element("#app").innerHTML;
assert.ok(fenTrackHtml.includes('aria-label="拟身骑士杂兵轨"'));
assert.ok(fenTrackHtml.includes(`总强度 ${doppelStrength}`));
assert.strictEqual(api.renderBossRules(), "", "the old doppelganger boss panel must be replaced by the mob track");
api.toggleDoppelgangerCards(doppelId);
assert.strictEqual(battle().ruleState.doppelgangers[0].revealed, true);
assert.strictEqual(battle().ruleState.doppelPreviewCard, battle().ruleState.doppelgangers[0].cards[0]);
api.renderApp();
assert.ok(element("#app").innerHTML.includes(">翻回背面</button>"));
api.defeatDoppelganger(doppelId);
assert.strictEqual(battle().ruleState.doppelgangers.length, 0);
assert.ok(battle().bpDamage.length >= 2);
assert.strictEqual(battle().ruleState.knightFen.armor, 1);
const fenDeckBefore = battle().bpDeck.length;
api.spawnDoppelganger();
assert.strictEqual(battle().ruleState.doppelgangers.length, 1);
assert.strictEqual(battle().bpDeck.length, fenDeckBefore - 2);
battle().bpDeck = battle().bpDeck.slice(0, 1);
api.spawnDoppelganger();
assert.strictEqual(battle().conflictStatus, "failed");

select("M_PuppetKing", 1);
const ring = "M_PuppetKing:BP1:2";
battle().bpDeck = [ring];
api.draw("bp");
api.settle("bp", "defeat");
assert.strictEqual(battle().singleWounds + battle().doubleWounds, 0, "前两指不应加入伤口");
const indexFinger = "M_PuppetKing:BP2:9";
battle().bpDeck = [indexFinger];
api.draw("bp");
api.settle("bp", "defeat");
assert.strictEqual(battle().singleWounds, 1);
api.damagePuppetFallenKnight();
assert.strictEqual(battle().ruleState.puppetKing.fallenKnightTokens, 1);
api.damagePuppetFallenKnight();
assert.strictEqual(battle().ruleState.puppetKing.fallenKnightTokens, 0);
assert.strictEqual(battle().singleWounds, 2);
battle().level = 4;
api.rebuild();
battle().aiDeck = ["M_PuppetKing:AI1:20", "M_PuppetKing:AI1:23"];
api.revealPuppetTopTwo();
assert.deepStrictEqual([...battle().ruleState.aiChoiceIds], ["M_PuppetKing:AI1:20", "M_PuppetKing:AI1:23"]);
assert.strictEqual(battle().ruleState.recommendedAiId, "", "新版选择器不应代替玩家推荐 AI");
api.choosePuppetAi("M_PuppetKing:AI1:23");
api.settle("ai", "discard");
battle().aiDeck = ["M_PuppetKing:AI1:20", "M_PuppetKing:AI1:21"];
api.revealPuppetTopTwo();
assert.strictEqual(battle().ruleState.aiChoiceMode, "choose");
api.executePuppetRoutine();
assert.strictEqual(battle().ruleState.ruleCard, "M_PuppetKing:SIG:38");

select("M_BogWitch", 1);
api.draw("ai");
api.attachBogAi("测试骑士");
assert.strictEqual(battle().ruleState.aiAttachments.length, 1);
assert.strictEqual(battle().aiDiscard.length, 0);
api.draw("ai");
api.attachBogAi("测试骑士");
assert.strictEqual(battle().ruleState.aiAttachments.length, 2);
assert.strictEqual(battle().aiDiscard.length, 0, "同一骑士可以保留多张附着 AI");
const attachmentId = battle().ruleState.aiAttachments[0].id;
api.returnBogAttachment(attachmentId);
assert.strictEqual(battle().ruleState.aiAttachments.length, 1);
assert.strictEqual(battle().aiDiscard.length, 1);
battle().aiDeck = [];
battle().aiDiscard = [];
api.draw("ai");
assert.strictEqual(battle().conflictStatus, "failed");

select("M_BogWitch", 3);
const originalBpOrder = [...battle().bpDeck];
api.hiddenBogBpTop(2);
assert.strictEqual(battle().bpDeck[0], originalBpOrder[2]);
assert.deepStrictEqual([...battle().bpDeck.slice(1)], [originalBpOrder[0], originalBpOrder[1], ...originalBpOrder.slice(3)]);
battle().ruleState.cookieTokens = 3;
api.settleCookieCrumbs();
assert.strictEqual(card(battle().ruleState.ruleCard).kind, "SIG");
api.completeRuleCard();
battle().ruleState.cookieTokens = 9;
api.settleCookieCrumbs();
assert.strictEqual(card(battle().ruleState.ruleCard).kind, "SIG");
api.completeRuleCard();
assert.ok(/^AI/.test(card(battle().ruleState.ruleCard).kind), "Cookie 9+ 应在标志行为后继续 AI 顶牌");
api.completeRuleCard();

select("M_Panzerdragon", 1);
const panzerAiBefore = ranks(battle().aiDeck, "AI");
api.draw("bp");
api.settle("bp", "defeat");
assert.strictEqual(battle().singleWounds + battle().doubleWounds, 0);
assert.deepStrictEqual(ranks(battle().aiDeck, "AI"), panzerAiBefore);
assert.strictEqual(battle().ruleState.ruleCard, "M_Panzerdragon:Trait:39");
api.completeRuleCard();
api.changePanzerArmor("field", 3);
api.migratePanzerArmor();
assert.deepStrictEqual(JSON.parse(JSON.stringify(battle().ruleState.panzerArmor)), { field: 0, dragon: 3, remnant: 0 });

select("M_Toadragon", 1);
assert.strictEqual(api.renderBossRules(), "", "蟾蜍龙不应渲染当前 Boss 专用操作区");
const toadTop = battle().aiDeck[0];
const toadName = card(toadTop).name;
api.discardTopAi(1);
const hiddenDiscard = api.renderAiDiscard();
assert.ok(hiddenDiscard.includes("background-image"));
assert.ok(!hiddenDiscard.includes("data-preview"));
assert.ok(!hiddenDiscard.includes(toadName));
assert.ok(!hiddenDiscard.includes(toadTop));
api.favoriteChild();
const favoriteId = battle().ruleState.ruleCard;
assert.ok(favoriteId);
api.completeRuleCard();
assert.ok(battle().aiDiscard.includes(favoriteId));
assert.ok(!api.renderAiDiscard().includes(favoriteId));

select("M_DevilAncientDusk", 3);
battle().ruleState.patient.deck = ["PATIENT:A:1", "PATIENT:A:2", "PATIENT:C:1", "PATIENT:C:2"];
api.ancientBargain(4, "测试骑士");
assert.strictEqual(battle().ruleState.ancientDusk.disaster, 1);
assert.deepStrictEqual([...battle().ruleState.patient.queue], ["A", "C"]);
api.resolvePatientEffect();
api.resolvePatientEffect();
api.resolvePatientEffect();
assert.strictEqual(battle().ruleState.ancientDusk.pillars, 2);
assert.strictEqual(battle().ruleState.patient.deck.length, 4, "抽到 C 后应将 Patient 弃牌洗回牌组");
assert.strictEqual(battle().ruleState.patient.discard.length, 0);
api.undo();
assert.strictEqual(battle().ruleState.patient.stage, "resolving", "Patient 结算必须可撤销");

select("M_DevilSmeltedFears", 3);
api.setKnightSeverity("测试骑士", 4);
battle().ruleState.patient.deck = ["PATIENT:E:1", "PATIENT:F:1", "PATIENT:B:1"];
api.drawSmeltedPatient("测试骑士");
api.drawSmeltedPatient("测试骑士");
api.drawSmeltedPatient("测试骑士");
assert.deepStrictEqual([...battle().ruleState.patient.queue], ["B", "F", "E"]);
api.resolvePatientEffect();
api.resolvePatientEffect("accept");
api.resolvePatientEffect();
assert.strictEqual(battle().ruleState.smeltedFears.ironTitheArmor, 2);
assert.strictEqual(battle().ruleState.severityByKnight["测试骑士"], 5);
assert.strictEqual(battle().ruleState.patient.stage, "idle");
battle().ruleState.patient.deck = ["PATIENT:A:1"];
battle().ruleState.patient.discard = ["PATIENT:C:1"];
api.drawSmeltedPatient("囚徒");
api.resolvePatientEffect();
assert.strictEqual(battle().ruleState.smeltedFears.imprisonedKnight, "囚徒");
assert.strictEqual(battle().ruleState.patient.discard.length, 0, "Patient A 应回洗弃牌");
api.toggleSmeltedGate("囚徒");
assert.ok(battle().ruleState.smeltedFears.gateHolders.includes("囚徒"));
api.smeltedEquipmentEvent();
assert.strictEqual(battle().ruleState.smeltedFears.suffocationEvents, 1);

select("M_Eggknight", 2);
assert.deepStrictEqual(JSON.parse(JSON.stringify(battle().ruleState.eggknight.armor)), { 1: 2, 2: 3, 3: 4 });
api.changeEggArmor(3, -1, true);
assert.strictEqual(battle().ruleState.eggknight.jacked, 1);
api.changeEggArmor(2, -1, false);
assert.strictEqual(battle().ruleState.eggknight.jacked, 2);
api.recordP2WoundCounters(monster(), 2);
assert.strictEqual(battle().ruleState.eggknight.counter, 2);
api.recordP2WoundCounters(monster(), 1);
assert.strictEqual(battle().ruleState.eggknight.counter, 3, "还击达到阈值后必须保留指示物，等待玩家触发");
assert.match(battle().ruleState.ruleNotice, /已达到阈值/);
api.triggerEggCounter();
assert.strictEqual(battle().ruleState.eggknight.counter, 0, "触发还击后清除全部还击指示物");
assert.strictEqual(card(battle().ruleState.ruleCard).kind, "SIG", "触发还击应展示标志行为");
assert.strictEqual(battle().ruleState.ruleCardReason, "还击：标志行为");
api.completeRuleCard();

select("M_Knighteater", 4);
api.toggleKnighteaterBerserk(true);
const eaterAiBefore = ranks(battle().aiDeck, "AI");
battle().bpDeck = [battle().bpDeck.find(id => card(id).kind === "BP1")];
api.draw("bp");
api.settle("bp", "defeat");
assert.strictEqual(battle().singleWounds + battle().doubleWounds, 0, "等级 4 暴走食骑者不得被击伤");
assert.deepStrictEqual(ranks(battle().aiDeck, "AI"), eaterAiBefore, "食骑者免伤时不得晋升 AI");
api.changeKnighteaterResource("meat", 4);
api.resolveWolfDown("高战意骑士");
assert.strictEqual(battle().ruleState.knighteater.berserk, false);
assert.strictEqual(battle().ruleState.knighteater.priorityTarget, "高战意骑士");

select("M_Stonemason", 3);
api.changeStonemasonArmor("front", 2);
api.setStonemasonDirection("front");
battle().bpDeck = [battle().bpDeck.find(id => card(id).kind === "BP1")];
api.draw("bp");
api.settle("bp", "defeat");
assert.strictEqual(battle().singleWounds + battle().doubleWounds, 0, "2+ 方向盔甲应拦截击伤");
api.changeStonemasonArmor("right", 1);
api.changeStonemasonArmor("back", 1);
battle().ruleState.stonemason.armor.front = 1;
api.endStonemasonRound("left");
assert.strictEqual(battle().ruleState.stonemason.armorLocked, true, "第四节点应触发本轮盔甲锁定");
assert.deepStrictEqual(JSON.parse(JSON.stringify(battle().ruleState.stonemason.armor)), { front: 0, right: 0, back: 0, left: 0 });

select("M_KingLaidLow", 4);
battle().ruleState.kingLaidLow.livingKnights = ["甲", "乙"];
api.setKingCurse("甲");
api.kingKnightDied("甲");
assert.strictEqual(battle().ruleState.kingLaidLow.curseHolder, "乙");
battle().singleWounds = 4;
battle().doubleWounds = 1;
api.recordP2WoundCounters(monster(), 1);
assert.strictEqual(battle().ruleState.kingLaidLow.vpCreated, true);
api.kingVpAction("乙", "climb", true);
assert.strictEqual(battle().ruleState.kingLaidLow.vpOccupant, "乙");

api.remember();
const runtimeDuplicate = battle().aiDeck[0];
battle().aiDiscard.push(runtimeDuplicate);
api.commit();
assert.ok(!battle().aiDiscard.includes(runtimeDuplicate), "运行时重复区域应自动回滚");

const roundTrip = api.validateState(JSON.parse(JSON.stringify(state())));
assert.strictEqual(roundTrip.version, 10);
assert.throws(() => api.validateState({ ...roundTrip, version: 9 }), /旧版存档不兼容/);
const duplicate = JSON.parse(JSON.stringify(roundTrip));
duplicate.battle.aiDiscard.push(duplicate.battle.aiDeck[0]);
assert.throws(() => api.validateState(duplicate), /同时出现在多个区域/);

select("M_DevilAncientDusk", 1);
const patientRaw = JSON.parse(JSON.stringify(state()));
patientRaw.encounters = {};
patientRaw.selectedMonsterId = patientRaw.battle.monsterId;
const patientSave = api.validateState(patientRaw);
const duplicatePatient = JSON.parse(JSON.stringify(patientSave));
duplicatePatient.encounters = {};
duplicatePatient.battle.ruleState.patient.discard.push(duplicatePatient.battle.ruleState.patient.deck[0]);
assert.throws(() => api.validateState(duplicatePatient), /Patient 卡同时出现在多个区域/);

for (const [id, expectedText] of [
  ["M_DevilSmeltedFears", "窖牢"],
  ["M_Eggknight", "Jacked"],
  ["M_Knighteater", "开始暴走"],
  ["M_Stonemason", "磁力聚甲"]
]) {
  select(id, 4);
  const panel = api.renderBossRules();
  assert.ok(panel.includes("boss-rule-panel"), `${id} 应渲染专用规则区`);
  assert.ok(panel.includes(expectedText), `${id} 专用规则区缺少关键操作`);
}
select("M_DevilAncientDusk", 4);
assert.strictEqual(api.renderBossRules(), "", "远古薄暮恶魔使用主战斗区规则，不渲染独立操作面板");
select("M_KingLaidLow", 4);
assert.strictEqual(api.renderBossRules(), "", "俯伏王不应渲染当前 Boss 专用操作区");

select("M_Eggknight", 2);
api.renderApp();
let autoArmorHtml = element("#app").innerHTML;
assert.match(autoArmorHtml, /<div class="egg-rule-line">[\s\S]*data-egg-headbutt="3"[\s\S]*>还击 [\s\S]*>Jacked /,
  "盔甲数量、头槌弃甲、还击与 Jacked 应按顺序位于同一操作行");
assert.ok(autoArmorHtml.includes("data-egg-counter-slot"), "还击为 0 时，大卡还击特性旁应显示通用指示物放置位");
assert.ok(autoArmorHtml.includes('style="left:24.3%;top:74.0%"'), "还击指示物放置位应对准大卡还击特性");
api.changeEggCounter(3);
api.renderApp();
autoArmorHtml = element("#app").innerHTML;
assert.ok(autoArmorHtml.includes("data-egg-counter-token"), "还击累计后应在大卡上显示通用指示物");
assert.ok(autoArmorHtml.includes("interactive-auto-token must-resolve"), "还击达到 3 时，大卡指示物应高亮立即处理");
assert.ok(autoArmorHtml.includes("还击通用指示物 ×3，点击触发标志行为"));
api.triggerEggCounter();
api.renderApp();
autoArmorHtml = element("#app").innerHTML;
assert.ok(autoArmorHtml.includes("SIGNATURE · Eggknight"), "触发还击应展示 SIG 反面的 SIGNATURE");
api.completeRuleCard();
assert.ok(autoArmorHtml.includes("data-monster-directory"), "页面应渲染可折叠怪物目录");
assert.ok(!autoArmorHtml.includes("data-monster-directory open"), "怪物目录首次进入应默认收起");
assert.ok(autoArmorHtml.includes("directory-collapsed"), "收起目录时必须释放主内容宽度");
const lastMonsterId = context.window.KF_MONSTER_DATA.monsters.at(-1).id;
assert.ok(autoArmorHtml.includes(`data-monster="${lastMonsterId}"`), "怪物目录必须包含最后一个怪物入口");
assert.ok(autoArmorHtml.includes('data-auto-armor-slot="bp1"'), "蛋蛋骑士 BP1 空槽应自动填充盔甲 Token");
assert.ok(autoArmorHtml.includes('style="left:57.1%;top:40.2%"'), "蛋蛋骑士自动盔甲应对准 BP1 印刷槽位");
assert.ok(autoArmorHtml.includes('title="盔甲 · bp1 ×2"'));
assert.ok(autoArmorHtml.includes('title="盔甲 · bp2 ×3"'));
assert.ok(autoArmorHtml.includes('title="盔甲 · bp3 ×4"'));
assert.strictEqual(battle().sheetTokens.length, 0, "自动盔甲 Token 不应写入手动大卡 Token 状态");
api.changeEggArmor(1, -2, false);
api.renderApp();
autoArmorHtml = element("#app").innerHTML;
assert.ok(!autoArmorHtml.includes('data-auto-armor-slot="bp1"'), "空盔甲槽不应继续显示 Token");
assert.ok(autoArmorHtml.includes('data-auto-armor-slot="bp2"'));
assert.ok(autoArmorHtml.includes('data-auto-armor-slot="jacked"'), "Jacked 应以盔甲指示物显示在大卡对应特性旁");
assert.ok(autoArmorHtml.includes('style="left:96.2%;top:10.4%"'), "Jacked 盔甲指示物应对准大卡 Jacked 特性");
api.undo();
api.renderApp();
assert.ok(element("#app").innerHTML.includes('title="盔甲 · bp1 ×2"'), "自动盔甲槽变化必须可撤销");

select("M_Stonemason", 3);
api.renderApp();
assert.ok(!element("#app").innerHTML.includes("data-auto-armor-slot="), "无盔甲的石匠节点不应显示 Token");
api.changeStonemasonArmor("front", 2);
api.changeStonemasonArmor("right", 1);
api.renderApp();
autoArmorHtml = element("#app").innerHTML;
assert.ok(autoArmorHtml.includes('title="盔甲 · front ×2"'), "石匠正面节点应按计数自动填充");
assert.ok(autoArmorHtml.includes('data-auto-armor-slot="right"'));
assert.ok(autoArmorHtml.includes('style="left:78.3%;top:61.6%"'), "石匠右侧节点盔甲应对准对应印刷槽位");
assert.ok(!autoArmorHtml.includes('data-auto-armor-slot="back"'));
api.changeStonemasonArmor("front", -2);
api.renderApp();
assert.ok(!element("#app").innerHTML.includes('data-auto-armor-slot="front"'), "石匠节点清空后应移除自动 Token");
assert.strictEqual(battle().sheetTokens.length, 0, "石匠自动盔甲 Token 不应进入存档状态");

select("M_Eggknight", 2);
api.setSheetTokenCount("token-armor", 3);
const armorSheetTokens = battle().sheetTokens.filter(token => token.assetId === "token-armor");
assert.strictEqual(armorSheetTokens.length, 1, "同类盔甲 Token 应聚合为一个可拖动堆叠");
assert.strictEqual(armorSheetTokens[0].count, 3);
api.renderApp();
assert.ok(element("#app").innerHTML.includes("httpssteamusercontentaakamaihdnetugc10253072582350080078E89257D8FD942C3FA0350726E80F48FC7AEF6B99.png"));
assert.ok(element("#app").innerHTML.includes("token-square"));
api.undo();
assert.strictEqual(battle().sheetTokens.filter(token => token.assetId === "token-armor").length, 0, "盔甲 Token 数量调整必须可撤销");

select("M_FirstmenWarriors", 1);
api.renderApp();
let mobTrackHtml = element("#app").innerHTML;
const sheetStagePosition = mobTrackHtml.indexOf("data-sheet-stage");
const mobTrackPosition = mobTrackHtml.indexOf('aria-label="杂兵 BP 轨"');
const aibpPanelPosition = mobTrackHtml.indexOf('class="panel aibp-panel"');
assert.ok(sheetStagePosition >= 0 && sheetStagePosition < mobTrackPosition && mobTrackPosition < aibpPanelPosition,
  "杂兵 BP 轨必须位于怪物大卡正下方、AI/BP 操作区上方");
assert.ok(mobTrackHtml.includes('data-mob-marker="0"'), "每张非空杂兵 BP 必须提供标记控件");
assert.ok(mobTrackHtml.includes("data-mob-marker-asset"), "杂兵 BP 轨必须提供完整标记类型选择器");
assert.ok(!mobTrackHtml.includes("data-mob-count"), "杂兵数量必须由冲突设置固定，不应继续提供手动输入");
api.changeMobMarker(0, "token-armor", 2);
assert.strictEqual(battle().bpTrack[0].markerTokens["token-armor"], 2);
assert.strictEqual(battle().bpTrack[0].markers, 0, "非通用标记不得计入南瓜头规则计数");
const markerRoundTrip = api.validateState(JSON.parse(JSON.stringify(state())));
assert.strictEqual(markerRoundTrip.battle.bpTrack[0].markerTokens["token-armor"], 2, "多类型 BP 标记必须支持存档恢复");
api.changeMobMarker(0, "token-01", 1);
assert.strictEqual(battle().bpTrack[0].markers, 1);
api.renderApp();
mobTrackHtml = element("#app").innerHTML;
assert.ok(mobTrackHtml.includes("mob-bp-marker"), "杂兵 BP 标记必须覆盖显示在卡面上");
assert.ok(mobTrackHtml.includes("httpssteamusercontentaakamaihdnetugc10792521070177147F375BA9D7F1EF7C2ABAA9D04F55839FA6FC24A94.jpg"));
assert.ok(mobTrackHtml.includes("httpssteamusercontentaakamaihdnetugc10253072582350080078E89257D8FD942C3FA0350726E80F48FC7AEF6B99.png"), "卡面必须同时显示不同类型的 BP 标记");
api.undo();
assert.strictEqual(battle().bpTrack[0].markers, 0, "杂兵 BP 标记变化必须可撤销");
assert.strictEqual(battle().bpTrack[0].markerTokens["token-armor"], 2, "撤销一种标记不得移除其他类型");

const expectedMobBp = {
  M_Ratwolves: { BP1: 4 },
  M_Pumpkinhead: { BPS: 6 },
  M_PalebloodWorms: { BP1: 4 },
  M_FirstmenWarriors: { BP1: 6 },
  M_HauntOf: { BP1: 3 },
  M_Panzergeists: { BP1: 5, BP2: 3, BP3: 2 },
  M_FirstmenLictor: { BP1: 8, BP2: 2 },
  M_Ironcast: { BP1: 4, BP2: 3, BP3: 1 }
};

for (const [monsterId, expected] of Object.entries(expectedMobBp)) {
  select(monsterId, 1);
  const occupied = battle().bpTrack.filter(slot => slot.id);
  const actual = {};
  for (const slot of occupied) {
    const kind = card(slot.id)?.kind;
    actual[kind] = (actual[kind] || 0) + 1;
  }
  const expectedTotal = Object.values(expected).reduce((total, count) => total + count, 0);
  assert.strictEqual(occupied.length, expectedTotal, `${monsterId} 初始杂兵数量必须匹配冲突设置`);
  assert.strictEqual(battle().mobCount, expectedTotal, `${monsterId} 固定数量摘要必须匹配冲突设置`);
  assert.deepStrictEqual(actual, expected, `${monsterId} 初始 BP 阶级配比必须匹配冲突设置`);
}

select("M_Pumpkinhead", 1);
const pumpkinSlots = battle().bpTrack.filter(slot => slot.id);
const pumpkinSaplings = pumpkinSlots.filter(slot => slot.side === "back");
assert.strictEqual(pumpkinSlots.length, 6);
assert.strictEqual(pumpkinSaplings.length, 2, "南瓜头初始必须随机设置恰好 2 张幼苗面");
assert.strictEqual(pumpkinSlots.filter(slot => slot.side === "face").length, 4);
assert.ok(pumpkinSlots.every(slot => slot.revealed), "南瓜头初始双面 BP 必须显示当前面");
assert.ok(pumpkinSaplings.every(slot => slot.markers === 1 && slot.markerTokens["token-01"] === 1),
  "每张初始幼苗 BP 必须带 1 枚通用指示物");
assert.ok(pumpkinSlots.filter(slot => slot.side === "face").every(slot => slot.markers === 0),
  "南瓜头正面 BP 初始不得带幼苗指示物");

select("M_WingedNightmare", 1);
assert.strictEqual(battle().mobCount, 1);
assert.strictEqual(battle().bpTrack.length, 0, "翼生梦魇固定 BPS 不进入杂兵轨");
api.resolveWingedNightmareAttack(true);
assert.strictEqual(battle().singleWounds, 1, "翼生梦魇 BPS 击伤应按普通杂兵伤口结算");
assert.strictEqual(battle().bpTrack.length, 0, "翼生梦魇固定 BPS 击伤后仍不进入杂兵轨");
assert.strictEqual(battle().conflictStatus, "active", "翼生梦魇不得触发生态灾难失败");

select("M_Pumpkinhead", 1);
for (let count = 0; count < 4; count++) api.changeMobMarker(0, "token-01", 1);
assert.strictEqual(battle().bpTrack[0].markers, 4);
assert.strictEqual(battle().conflictStatus, "failed", "南瓜头 BP 达到 4 枚通用标记必须触发生态灾难失败");
api.undo();
assert.strictEqual(battle().conflictStatus, "active", "南瓜头标记失败必须可撤销");

const configured = new Set(Object.keys(context.window.KF_BOSS_RULE_CONFIG));
const unconfiguredBosses = context.window.KF_MONSTER_DATA.monsters.filter(item => item.type === "boss" && !configured.has(item.id));
assert.strictEqual(unconfiguredBosses.length, 0, "全部 Boss 都应拥有规则配置");

console.log("Boss 规则行为测试通过：P0/P1/P2 专用结算、失败、撤销、隐藏弃牌与存档校验。\n");
