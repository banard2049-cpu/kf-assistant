"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");
const nodes = new Map();
const node = selector => {
  if (!nodes.has(selector)) nodes.set(selector, { innerHTML: "", value: "", textContent: "", addEventListener() {} });
  return nodes.get(selector);
};
const context = vm.createContext({
  window: { addEventListener() {} }, console, Date, Math, setTimeout, clearTimeout,
  localStorage: { getItem: () => null, setItem() {} },
  document: { querySelector: node, querySelectorAll: () => [] }
});
const load = file => vm.runInContext(read(file), context, { filename: file });
for (const file of [
  "public/monster-labels.js", "public/modules/aibp/data/monster-data.js",
  "public/modules/encounter/data/encounter-data.js", "public/modules/encounter/encounter-catalog.js",
  "public/modules/encounter/encounter-view.js", "public/modules/map/data/map-data.js",
  "public/modules/map/map-view.js"
]) load(file);
const labels = context.window.KFMonsterLabels;
const encounters = context.window.KF_ENCOUNTER_DATA.monsters;
const sourceData = [context.window.KF_MONSTER_DATA, context.window.KF_ENCOUNTER_DATA, context.window.KF_MOD_DATA];
const originalData = JSON.stringify(sourceData);
for (const monster of [...encounters, ...context.window.KF_MONSTER_DATA.monsters, ...context.window.KF_MOD_DATA.monsters]) {
  assert.match(labels.name(monster), /[\u3400-\u9fff]/, `${monster.id} has a Chinese name`);
  assert.equal(labels.name(monster), labels.name(monster.name), "IDs and persisted English names resolve equally");
  assert.match(labels.rank(monster), /[\u3400-\u9fff]/, `${monster.id} has a Chinese rank`);
  assert.ok(labels.matches(monster, monster.name.toUpperCase()), "English search stays available");
  assert.ok(labels.matches(monster, labels.name(monster)), "Chinese search works");
}
assert.deepEqual(["mob", "vassal", "king", "devil", "dragon"].map(labels.tier), ["杂兵", "封臣", "国王", "恶魔", "巨龙"]);
// Every monster name must match the Chinese title printed on its sheet.
const cardNames = {
  M_BogWitch: "沼泽地女巫",
  M_DevilAncientDusk: "远古薄暮恶魔",
  M_DevilSmeltedFears: "熔怖恶魔",
  M_Eggknight: "蛋蛋骑士",
  M_FirstmenLictor: "先民巡猎手",
  M_FirstmenWarriors: "先民战士",
  M_HauntOf: "乌特勒班幽灵",
  M_Ironcast: "铁铸骷髅",
  M_KnightFen: "污泥骑士",
  M_Knighteater: "食士师",
  M_PalebloodWorms: "白血蠕虫",
  M_Panzerdragon: "装甲巨龙弗尔德",
  M_Panzergeists: "装甲幽鬼",
  M_Pumpkinhead: "南瓜头精怪",
  M_PuppetKing: "傀儡王埃德尔哈特",
  M_Ratwolves: "狼鼠狼",
  M_Stonemason: "石匠骑士",
  M_KingLaidLow: "俯伏王",
  M_Toadragon: "大沼泽蟾蜍龙",
  M_WhiteApe: "巨白猿魔",
  M_WingedNightmare: "展翅魔",
  M_YoungDevour: "幼年贪食巨龙"
};
for (const [id, expected] of Object.entries(cardNames)) {
  assert.equal(labels.name(id), expected, `${id} 的显示名必须与中文卡面一致`);
}
assert.equal(labels.name("Unknown Monster"), "Unknown Monster");
assert.equal(labels.name(null), "");
assert.equal(labels.tier("unknown"), "unknown");
assert.equal(labels.name("Puppet King Edelhardt"), labels.name("M_PuppetKing"));
assert.equal(labels.text("建立 Bog Witch 的 AI/BP"), `建立 ${labels.name("M_BogWitch")} 的 AI/BP`);

// Real encounter renderers must translate old saves without changing the raw names.
const app = read("public/modules/encounter/app.js");
const end = app.lastIndexOf("  renderApp();");
assert.ok(end > 0);
vm.runInContext(app.slice(0, end) + `
  window.labelTest = { monsterRail, setupPanel, positionPanel, blankState,
    set(value) { state = normalize(value); }, get() { return state; } };
})();`, context);
const runtime = context.window.labelTest;
for (const monster of encounters.filter(item => !item.special)) {
  runtime.set({ ...runtime.blankState(), monsterId: monster.id });
  const html = runtime.setupPanel();
  assert.ok(html.includes(`<h2>${labels.name(monster)}</h2>`));
  assert.ok(html.includes(labels.rank(monster)));
  assert.ok(runtime.monsterRail().includes(`data-monster="${monster.id}"`));
}
runtime.set({ ...runtime.blankState(), monsterId: "M_BogWitch", phase: "position",
  monsters: [{ id: "saved-piece", name: "Bog Witch", space: "8", facing: 0 }] });
assert.ok(runtime.positionPanel().includes(labels.name("M_BogWitch")));
assert.equal(runtime.get().monsters[0].name, "Bog Witch", "saved names remain canonical");

// The console selector displays Chinese but submits the original name to the bridge.
const main = read("public/app.js");
context.$ = node;
context.esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
context.knightSheets = () => [];
context.gameSettings = {};
const start = main.indexOf("function availableEncounterMonsters(");
const finish = main.indexOf("function renderEncounter(){", start);
vm.runInContext(main.slice(0, main.indexOf("const $ =")) + main.slice(start, finish), context);
context.renderEncounterChoices("Bog Witch");
assert.ok(node("#encounterMonster").innerHTML.includes(`value="Bog Witch">${labels.name("M_BogWitch")} · ${labels.rank("M_BogWitch")}`));
assert.equal(node("#encounterMonster").value, "Bog Witch");

// One mapping edit changes every consumer at its next render.
labels.monsters.M_BogWitch.zh = "测试女巫";
labels.tiers.vassal = "测试封臣";
runtime.set({ ...runtime.blankState(), monsterId: "M_BogWitch" });
assert.ok(runtime.setupPanel().includes("测试女巫"));
assert.ok(runtime.monsterRail().includes("测试封臣"));
context.renderEncounterChoices("Bog Witch");
assert.ok(node("#encounterMonster").innerHTML.includes("测试女巫 · 测试封臣"));
const data = context.window.KF_MOD_DATA;
const district = data.kingdomRules.SK.districts[0].id;
const board = context.window.KFMapView.renderKingdomBoard({ data, state: {
  kingdom: "SK", maps: { SK: { districtWheel: { [district]: "M_BogWitch" }, districtWheelLevels: { [district]: 2 } } }
} });
assert.ok(board.includes("测试女巫 · 测试封臣 · 等级 2"));
assert.equal(JSON.stringify(sourceData), originalData, "localization must never mutate catalogs or identity fields");

for (const file of ["public/index.html", ...["aibp", "map", "encounter", "display"].map(module => `public/modules/${module}/index.html`), "public/modules/encounter/attack-editor.html"]) {
  const html = read(file);
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1].split("?")[0]);
  assert.ok(scripts[0].endsWith("monster-labels.js"), `${file} loads the shared labels first`);
  for (const script of scripts) {
    const local = script.startsWith("/") ? path.join(root, "public", script.slice(1)) : path.resolve(root, path.dirname(file), script);
    assert.ok(fs.existsSync(local), `${file} references existing script ${script}`);
  }
}
console.log("monster labels: all catalogs, Chinese ranks, bilingual search, old saves, shared renaming and script loading verified");
