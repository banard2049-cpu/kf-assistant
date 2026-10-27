"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const elements = new Map();
function element(selector) {
  if (!elements.has(selector)) elements.set(selector, {
    dataset: {}, listeners: {}, hidden: false, innerHTML: "", textContent: "", value: "",
    addEventListener(name, listener) { this.listeners[name] = listener; },
    querySelectorAll() { return []; },
    closest() { return this; },
  });
  return elements.get(selector);
}
const storage = new Map();
const windowEvents = new Map();
const context = vm.createContext({
  window: {
    KF_AIBP_TESTING: true, KF_CAMPAIGN_PARTY: [],
    addEventListener(name, listener) { windowEvents.set(name, listener); },
  },
  document: { querySelector: element, querySelectorAll: () => [], createElement: () => element("created") },
  localStorage: {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
  },
  console, Blob, URL, confirm: () => true,
  setTimeout(callback, delay) { const timer = setTimeout(callback, delay); timer.unref(); return timer; },
  clearTimeout,
});
for (const file of [
  "public/monster-labels.js",
  "public/modules/aibp/data/monster-data.js",
  "public/modules/aibp/data/localized-traits.js",
  "public/modules/aibp/data/localized-sheets.js",
  "public/modules/aibp/data/level-config.js",
  "public/modules/aibp/data/postgame-config.js",
  "public/modules/aibp/data/mob-activation-config.js",
  "public/modules/aibp/data/boss-rule-config.js",
  "public/modules/aibp/data/conflict-setup-data.js",
  "public/modules/display/data/conflict-board-data.js",
  "public/modules/aibp/app.js",
]) vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });

const api = context.window.KF_AIBP_TEST_API;
const postgame = context.window.KF_POSTGAME_RULES;
const battle = () => api.state().battle;
function select(id, level) {
  api.selectMonster(id);
  battle().level = level;
  api.rebuild();
}
function roundTrip() {
  const raw = JSON.parse(JSON.stringify(api.state()));
  raw.encounters = {};
  raw.history = [];
  return api.validateState(raw).battle;
}
function assertRenderedReferences(id, level, scenario) {
  api.renderApp();
  const expected = postgame.traitsFor(id, level);
  const ids = [...api.activeReferenceIds()];
  const html = element("#app").innerHTML;
  const label = `${id} level ${level} (${scenario})`;
  for (const row of postgame.DATA[id] || []) {
    const unlocked = row.level <= level;
    assert.equal(ids.includes(row.trait.id), unlocked, `${label}: ${row.trait.id} threshold`);
    assert.equal(html.includes(`data-preview="${row.trait.id}"`), unlocked,
      `${label}: ${row.trait.id} rendered threshold`);
    assert.equal(ids.includes(row.reference.id), row.level === level,
      `${label}: only the current stat row belongs to references`);
    assert.equal(html.includes(`data-preview="${row.reference.id}"`), row.level === level,
      `${label}: only the current stat row is rendered`);
  }
  expected.forEach(card => assert.ok(ids.includes(card.id), `${label}: cumulative trait included`));
}
function loadBattleAtLevel(level) {
  const raw = JSON.parse(JSON.stringify(api.state()));
  raw.battle.level = level;
  raw.encounters = {};
  raw.history = [];
  Object.assign(api.state(), api.validateState(raw));
  assert.equal(battle().level, level, "direct import preserves the requested level");
}

// Every data row must survive the same loader used by import and synchronization.
for (const [id, rows] of Object.entries(context.window.KF_LEVEL_CONFIG)) {
  const maximum = Math.max(...rows.map(row => row.level));
  select(id, maximum);
  assert.equal(api.maxLevel(), maximum, `${id}: maximum comes from level values`);
  for (const row of rows.filter(row => row.level > 4)) {
    battle().level = row.level;
    assert.equal(roundTrip().level, row.level, `${id}: level ${row.level} must not be truncated`);
    assert.equal(api.levelInfo(row.level).hit, row.hit);
  }
  assert.equal(api.normalizeLevel(maximum + 99), maximum);
  assert.equal(api.normalizeLevel(maximum - 0.2), Math.max(1, maximum - 1));
  assert.equal(api.normalizeLevel(-1), 1);
  assert.equal(api.levelInfo(maximum + 1), null, "missing rows must never become level 1");

  if (!postgame.DATA[id]?.length) continue;
  // Exercise the actual renderer at every appendix threshold, including the
  // loader path and a downward change after higher-level traits were visible.
  for (const { level: threshold } of postgame.DATA[id]) {
    const lower = Math.max(1, threshold - 1);
    for (const level of new Set([lower, threshold, Math.min(maximum, threshold + 1)])) {
      battle().level = level;
      assertRenderedReferences(id, level, `threshold ${threshold}`);
    }
    battle().level = 1;
    api.renderApp();
    loadBattleAtLevel(threshold);
    assertRenderedReferences(id, threshold, "direct load");
    battle().level = maximum;
    api.renderApp();
    battle().level = lower;
    assertRenderedReferences(id, lower, `downgrade below ${threshold}`);
  }
  battle().level = maximum;
  const trait = postgame.traitsFor(id, maximum)[0];
  api.showPreview(trait);
  assert.ok(element("#modal").innerHTML.includes(trait.image.face), "original trait crop can be enlarged");
  assert.ok(element("#modal").innerHTML.includes("postgame-preview-modal"));
  assert.ok(![...battle().aiDeck, ...battle().bpDeck].some(id => id === trait.id), "reference traits never join card decks");
}

// Appendix traits are optional panel pieces, separate from card decks and tokens.
select("M_Toadragon", 9);
const panelTrait = postgame.traitsFor("M_Toadragon", 9).at(-1);
const earlierTrait = postgame.traitsFor("M_Toadragon", 9)[0];
const statReference = postgame.levelReferenceFor("M_Toadragon", 9);
const previousStatReference = postgame.levelReferenceFor("M_Toadragon", 8);
assert.deepEqual([...battle().sheetTraits], [], "new encounters do not place traits automatically");
api.renderApp();
assert.ok(element("#app").innerHTML.includes(`data-sheet-trait-toggle="${panelTrait.id}"`));
assert.ok(element("#app").innerHTML.includes(`data-sheet-trait-toggle="${statReference.id}"`),
  "the current level's stat row can be placed on the panel");
const decksBeforePlacement = JSON.stringify([battle().aiDeck, battle().bpDeck, battle().sheetTokens]);
api.setSheetTrait(panelTrait.id, true);
assert.equal(battle().sheetTraits.length, 1);
assert.equal(battle().sheetTraits[0].cardId, panelTrait.id);
assert.ok(element("#app").innerHTML.includes(`data-sheet-trait="${panelTrait.id}"`));
assert.equal(JSON.stringify([battle().aiDeck, battle().bpDeck, battle().sheetTokens]), decksBeforePlacement,
  "placing a reference image does not alter the active decks or token counters");
let historySize = api.state().history.length;
api.setSheetTrait(panelTrait.id, true);
api.setSheetTrait(previousStatReference.id, true);
api.setSheetTrait("postgame-pumpkinhead-5-traits", true);
api.setSheetTrait("nonexistent-trait", true);
assert.equal(battle().sheetTraits.length, 1, "duplicates, non-current stat rows and foreign or unknown cards are rejected");
assert.equal(api.state().history.length, historySize, "rejected placements do not consume undo steps");

api.setSheetTrait(statReference.id, true);
assert.equal(battle().sheetTraits.length, 2, "current stats can sit beside special traits");
api.resizeSheetTrait(statReference.id, 4);
const statPlacement = battle().sheetTraits.find(item => item.cardId === statReference.id);
Object.assign(statPlacement, { x: 60, y: 70 });
assert.deepEqual(JSON.parse(JSON.stringify(roundTrip().sheetTraits.find(item => item.cardId === statReference.id))),
  { cardId: statReference.id, x: 60, y: 70, width: 32 }, "placed stats retain position and size after save/import");
assert.ok(element("#app").innerHTML.includes(`data-sheet-trait="${statReference.id}"`));
assert.ok(element("#app").innerHTML.includes('class="sheet-trait level-reference"'),
  "placed stats use a transparent container");
assert.ok(element("#app").innerHTML.includes(`clip-path:${statReference.image.clipPath}`),
  "the stat image's paper margin is clipped in the panel and reference gallery");
api.showPreview(statReference);
assert.ok(element("#modal").innerHTML.includes(`clip-path:${statReference.image.clipPath}`),
  "enlarging a level image also preserves the transparent paper margin");
api.setSheetTrait(statReference.id, false);
api.undo();
assert.equal(battle().sheetTraits.find(item => item.cardId === statReference.id).width, 32,
  "removing the stat image can be undone");
api.setSheetTrait(statReference.id, false);
api.resizeSheetTrait(panelTrait.id, 4);
assert.equal(battle().sheetTraits[0].width, 32);
api.undo();
assert.equal(battle().sheetTraits[0].width, 28, "resizing is undoable");
Object.assign(battle().sheetTraits[0], { x: 45, y: 55, width: 32 });
assert.deepEqual(JSON.parse(JSON.stringify(roundTrip().sheetTraits)), [
  { cardId: panelTrait.id, x: 45, y: 55, width: 32 },
], "save/import retains the selected image, position and size");

// Exercise pointer movement without a browser, including the undo snapshot.
const dragListeners = new Map();
const dragNode = {
  dataset: { sheetTrait: panelTrait.id }, style: {},
  classList: { add() {}, remove() {} },
  closest: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 400 }) }),
  addEventListener: (name, handler) => dragListeners.set(name, handler),
  removeEventListener: name => dragListeners.delete(name),
  setPointerCapture() {}, hasPointerCapture: () => false,
};
const dragStart = () => api.startSheetTraitDrag({
  button: 0, pointerId: 3, clientX: 450, clientY: 220,
  target: { closest: () => null }, currentTarget: dragNode, preventDefault() {},
});
historySize = api.state().history.length;
dragStart();
dragListeners.get("pointerup")({ pointerId: 3 });
assert.equal(api.state().history.length, historySize, "a pointer click does not add an undo step");
dragStart();
dragListeners.get("pointermove")({ pointerId: 4, clientX: 600, clientY: 240 });
assert.equal(battle().sheetTraits[0].x, 45, "another pointer cannot move the selected trait");
dragListeners.get("pointermove")({ pointerId: 3, clientX: 550, clientY: 240 });
dragListeners.get("pointerup")({ pointerId: 3 });
assert.equal(battle().sheetTraits[0].x, 55);
assert.equal(battle().sheetTraits[0].y, 60);
assert.equal(api.state().history.length, historySize + 1, "one drag adds one undo step");
api.undo();
assert.equal(battle().sheetTraits[0].x, 45);
assert.equal(battle().sheetTraits[0].y, 55);
api.setSheetTrait(panelTrait.id, false);
assert.equal(battle().sheetTraits.length, 0);
api.undo();
assert.equal(battle().sheetTraits[0].cardId, panelTrait.id, "removal is undoable");
assert.equal(battle().sheetTraits[0].x, 45, "undo restores the original position");

const dirtyPlacementState = JSON.parse(JSON.stringify(api.state()));
dirtyPlacementState.encounters = {};
dirtyPlacementState.history = [];
dirtyPlacementState.battle.sheetTraits.push(
  { cardId: panelTrait.id, x: 99, y: 99, width: 50 },
  { cardId: previousStatReference.id, x: 50, y: 50, width: 28 },
  { cardId: "postgame-pumpkinhead-5-traits", x: 50, y: 50, width: 28 },
  null,
);
assert.equal(api.validateState(dirtyPlacementState).battle.sheetTraits.length, 1,
  "import filters duplicate, foreign and invalid pieces");
delete dirtyPlacementState.battle.sheetTraits;
assert.equal(api.validateState(dirtyPlacementState).battle.sheetTraits.length, 0,
  "older saves migrate without placing traits");
dirtyPlacementState.battle.sheetTraits = [{ cardId: panelTrait.id, x: 45, y: 55, width: 32 }];
dirtyPlacementState.battle.monsterId = "M_Pumpkinhead";
assert.equal(api.validateState(dirtyPlacementState).battle.sheetTraits.length, 0,
  "a trait cannot leak onto a different monster's panel");

api.setSheetTrait(statReference.id, true);
loadBattleAtLevel(8);
assert.ok(!battle().sheetTraits.some(item => item.cardId === statReference.id),
  "changing the level drops the previous level's stat image");
api.setSheetTrait(previousStatReference.id, true);
assert.ok(battle().sheetTraits.some(item => item.cardId === previousStatReference.id),
  "the new current level's stat image becomes placeable");
loadBattleAtLevel(9);
assert.ok(!battle().sheetTraits.some(item => item.cardId === previousStatReference.id),
  "an older stat image is also removed on a level increase");
api.setSheetTrait(earlierTrait.id, true);
loadBattleAtLevel(earlierTrait.minLevel);
assert.deepEqual([...battle().sheetTraits.map(item => item.cardId)], [earlierTrait.id],
  "lowering the level removes locked images while retaining unlocked selections");
historySize = api.state().history.length;
api.setSheetTrait(panelTrait.id, true);
assert.equal(battle().sheetTraits.length, 1, "a higher-level trait cannot be selected before it unlocks");
assert.equal(api.state().history.length, historySize);
loadBattleAtLevel(1);
assert.equal(battle().sheetTraits.length, 0, "a base-level encounter has no appendix trait placements");

select("M_DevilSmeltedFears", 6);
let before = battle().ruleState.smeltedFears.devilArmor;
api.smeltedFerrobaptism();
assert.equal(battle().ruleState.smeltedFears.devilArmor - before, 3);
select("M_DevilSmeltedFears", 7);
before = battle().ruleState.smeltedFears.devilArmor;
api.smeltedFerrobaptism();
assert.equal(battle().ruleState.smeltedFears.devilArmor - before, 6, "Drowning in Sin doubles Ferrobaptism");
select("M_DevilSmeltedFears", 10);
before = battle().ruleState.smeltedFears.ironTitheArmor;
api.bargainDiscardSmeltedArmor();
assert.equal(battle().ruleState.smeltedFears.ironTitheArmor, before, "Bowels of Hell prevents the old armor transfer");
assert.match(battle().ruleState.ruleNotice, /不放入窖牢/);
assert.match(element("#app").innerHTML, /aria-label="讲价弃置 1 枚盔甲（不放入窖牢）"/,
  "the level 10 control must not promise the disabled armor transfer");
const patient = battle().ruleState.patient;
patient.stage = "resolving";
patient.queue = ["C"];
patient.target = "测试骑士";
api.resolvePatientEffect();
assert.equal(battle().ruleState.smeltedFears.ironTitheArmor, before,
  "level 10 Patient C/D/E/F armor discards must also bypass the Oubliette");

select("M_PuppetKing", 5);
battle().activeBP = "M_PuppetKing:BP1:2";
battle().bpDeck = battle().bpDeck.filter(id => id !== battle().activeBP);
api.settle("bp", "defeat");
assert.equal(battle().singleWounds, 1, "Hand of the Master disables the old terrain-only finger wound");
assert.ok(!battle().bpRemoved.includes("M_PuppetKing:BP1:2"));
assert.match(battle().ruleState.ruleNotice, /Hand of the Master/);

select("M_Eggknight", 5);
battle().ruleState.eggknight.jacked = 26;
api.changeEggArmor(1, -1);
assert.match(battle().ruleState.ruleNotice, /27\+：被攻击命中时立即死亡/);
assert.match(element("#app").innerHTML, /14\+：Braced 与 Rocksteady 失效/);
select("M_Eggknight", 6);
api.renderApp();
assert.match(element("#app").innerHTML, /Humpty Supercharge 已禁用 Humpty Fate 与 Hardboiled/);

select("M_Knighteater", 6);
battle().ruleState.knighteater.berserk = true;
battle().ruleState.knighteater.meat = 0;
api.resolveWolfDown();
assert.match(battle().ruleState.ruleNotice, /狼吞虎咽 4/);
assert.match(battle().ruleState.ruleNotice, /Profane Hunger/);

select("M_Panzerdragon", 7);
api.migratePanzerArmor();
assert.match(battle().ruleState.ruleNotice, /Scouring Scurries/);
assert.match(battle().ruleState.ruleNotice, /Despiser of Man/);

select("M_BogWitch", 9);
battle().clashPhase = "preliminary";
api.rebuild();
api.renderApp();
assert.match(element("#app").innerHTML, /等级附录未列展览初伤，请按规则手动设置/);
windowEvents.get("kf:aibp-handoff")({ detail: { stage: "withergraal", postgame: true } });
assert.equal(battle().postgame, true);
assert.equal(battle().rogueStage, "withergraal");
assert.equal(roundTrip().postgame, true);
assert.equal(roundTrip().rogueStage, "withergraal");

console.log("Postgame AI/BP integration passed: levels, cumulative references, panel traits, drag/resize/undo, save/load and replaced rules.");
