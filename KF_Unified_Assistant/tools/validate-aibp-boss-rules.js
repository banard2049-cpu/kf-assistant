"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({ window: {} });

for (const file of [
  "public/modules/aibp/data/monster-data.js",
  "public/modules/aibp/data/boss-rule-config.js"
]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

const data = context.window.KF_MONSTER_DATA;
const rules = context.window.KF_BOSS_RULE_CONFIG;
const expected = new Set([
  "M_DevilAncientDusk", "M_DevilSmeltedFears", "M_Eggknight", "M_KingLaidLow",
  "M_Knighteater", "M_Stonemason",
  "M_BogWitch", "M_KnightFen", "M_Panzerdragon", "M_PuppetKing",
  "M_Toadragon", "M_WhiteApe", "M_YoungDevour"
]);
const failures = [];

const actual = Object.keys(rules);
for (const id of expected) if (!rules[id]) failures.push(`缺少 Boss 配置：${id}`);
for (const id of actual) if (!expected.has(id)) failures.push(`非目标 Boss 不应配置：${id}`);

const owners = new Map();
function collectCardIds(value, output = []) {
  if (typeof value === "string" && /^M_[^:]+:[^:]+:\d+$/.test(value)) output.push(value);
  else if (Array.isArray(value)) value.forEach(item => collectCardIds(item, output));
  else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (/^M_[^:]+:[^:]+:\d+$/.test(key)) output.push(key);
      collectCardIds(item, output);
    }
  }
  return output;
}

for (const [monsterId, rule] of Object.entries(rules)) {
  const monster = data.monsters.find(item => item.id === monsterId);
  if (!monster) {
    failures.push(`未知 Boss：${monsterId}`);
    continue;
  }
  const known = new Set(monster.cards.map(card => card.id));
  const ids = [...new Set(collectCardIds(rule))];
  for (const id of ids) {
    if (!known.has(id)) failures.push(`${monsterId} 引用了不存在的卡：${id}`);
    const owner = owners.get(id);
    if (owner && owner !== monsterId) failures.push(`${id} 同时属于 ${owner} 与 ${monsterId}`);
    owners.set(id, monsterId);
  }
  if (!rule.kind || !Array.isArray(rule.actions)) failures.push(`${monsterId} 缺少 kind/actions 声明`);
  if (rule.patientCards) {
    const patientIds = rule.patientCards.map(card => card.id);
    if (patientIds.length !== 12 || new Set(patientIds).size !== 12) {
      failures.push(`${monsterId} Patient 牌组必须包含 12 个稳定且唯一的 ID`);
    }
    const letters = rule.patientCards.map(card => card.letter).sort().join("");
    if (letters !== "AABBCCDDEEFF") failures.push(`${monsterId} Patient 字母组成不正确`);
  }
}

if (rules.M_YoungDevour?.noWoundPromotion !== true) failures.push("幼年贪食巨龙必须禁用受伤晋升");
if (rules.M_Toadragon?.hiddenAiDiscard !== true) failures.push("蟾蜍龙必须隐藏 AI 弃牌");
if (rules.M_WhiteApe?.initialZone !== "bp-deck-top") failures.push("巨白猿魔厚皮初始区必须是 BP 顶");

if (failures.length) {
  console.error(failures.map(message => `- ${message}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Boss 规则配置校验通过：${actual.length} 个 Boss，${owners.size} 个卡牌引用。`);
}
