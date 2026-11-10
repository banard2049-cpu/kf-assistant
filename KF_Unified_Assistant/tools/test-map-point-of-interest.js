"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync("public/modules/map/data/map-data.js", "utf8"), context);
vm.runInContext(fs.readFileSync("public/modules/map/point-of-interest-rules.js", "utf8"), context);
const rules = context.window.KF_POINT_OF_INTEREST_RULES;
const data = context.window.KF_MOD_DATA;
const plain = value => JSON.parse(JSON.stringify(value));

assert.ok(rules, "the map must expose its point-of-interest rules");

const tiles = Object.values(data.maps).flatMap(map => map.tiles);
assert.equal(tiles.length, 125, "the catalog covers both complete local kingdoms");
const counts = tiles.reduce((result, tile) => {
  const points = rules.tilePoints(tile.id);
  if (points.some(point => point.type === "number")) result.numeric += 1;
  if (points.some(point => point.type === "name" && !point.printedWithoutIcon)) result.named += 1;
  if (points.some(point => point.type === "name" && point.printedWithoutIcon)) result.printed += 1;
  if (!points.length) result.empty += 1;
  return result;
}, { numeric: 0, named: 0, printed: 0, empty: 0 });
assert.deepEqual(counts, { numeric: 31, named: 6, printed: 4, empty: 84 },
  "numeric points, named points, and printed story labels must retain their separate meanings");

assert.deepEqual(plain(rules.tilePoints("SK_Tile_M:3")), [{ type: "number", value: 2 }],
  "the user's numbered example is interest point 2, rather than a path exit number");
assert.equal(rules.tilePoints("SK_Tile_L:1")[0].name, "Signs of Struggle",
  "the user's cathedral example retains the printed story title");
assert.equal(rules.tilePoints("POS_Tile_M:6")[0].name, "A Guard’s Statue",
  "the stone kingdom's named interest point retains its spelling");
for (const tileId of ["SK_Tile_EXTRA:7", "SK_Tile_EXTRA:17", "POS_Tile_EXTRA:3", "POS_Tile_EXTRA:17"]) {
  const points = rules.tilePoints(tileId);
  assert.equal(points.length, 1);
  assert.equal(points[0].name, "Tension in the Air");
  assert.equal(points[0].printedWithoutIcon, true,
    `${tileId}: a printed story title without a diamond must remain identifiable`);
}
assert.deepEqual(plain(rules.tilePoints("SK_Tile_EXTRA:12")), [],
  "Geyser M8 is a map label, not a story interest point");
assert.deepEqual(plain(rules.tilePoints("SK_Tile_S:1")), [],
  "an exploration cipher alone must not create an interest-point reminder");
assert.deepEqual(plain(rules.tilePoints("unknown-tile")), []);

const cardById = id => Object.values(data.kingdomRules)
  .flatMap(kingdom => [...kingdom.exploration, ...kingdom.specialExploration])
  .find(card => card.id === id);
for (const [id, expected] of [
  ["SK:EXP:23909", 3], ["SK:EXP:23905", 4], ["SK:EXP:23903", 0],
  ["POS:EXP:31116", 0], ["POS:EXP:31106", 4], ["POS:EXP:31102", 5]
]) {
  assert.equal(rules.modifier(cardById(id)), expected, `${id}: use its verified printed modifier`);
}
assert.equal(rules.modifier(null), null, "an empty deck does not imply modifier zero");
assert.equal(rules.modifier({ id: "unknown-card", poi: "POI5" }), null,
  "an unverified card cannot supply a guessed modifier");
assert.equal(rules.modifier({ ...cardById("SK:EXP:23909"), special: true }), null,
  "a special exploration card has no usable numeric modifier");
for (const kingdom of Object.values(data.kingdomRules)) {
  for (const card of kingdom.exploration) {
    assert.ok(Number.isInteger(rules.modifier(card)), `${card.id}: every normal exploration card has a verified modifier`);
  }
  for (const card of kingdom.specialExploration) {
    assert.equal(rules.modifier(card), null, `${card.id}: special cards must not silently supply a numeric modifier`);
  }
}

const topCard = { ...cardById("SK:EXP:23909") };
const reminder = rules.capture("SK_Tile_M:3", 7, topCard);
assert.equal(reminder.tileId, "SK_Tile_M:3");
assert.equal(reminder.round, 7);
assert.equal(reminder.cardId, "SK:EXP:23909");
assert.equal(reminder.modifier, 3);
assert.equal(reminder.acknowledged, false);
assert.equal(reminder.points[0].value, 2);
assert.equal(reminder.points[0].result, 5,
  "a numeric story result adds the tile number to the exploration-card modifier");

topCard.id = "SK:EXP:23905";
topCard.poi = "POI4";
assert.equal(reminder.cardId, "SK:EXP:23909");
assert.equal(reminder.modifier, 3);
assert.equal(reminder.points[0].result, 5,
  "drawing or replacing the top exploration card cannot alter the captured story result");

for (const unusableCard of [null, { id: "unknown-card" }, { ...cardById("SK:EXP:23909"), special: true }]) {
  const pending = rules.capture("SK_Tile_M:3", 7, unusableCard);
  assert.ok(pending, "numeric points remain available for manual completion without a usable top card");
  assert.equal(pending.modifier, null);
  assert.equal(pending.points[0].result, null,
    "an unavailable modifier must never silently resolve as zero");
}
const named = rules.capture("SK_Tile_L:1", 7, cardById("SK:EXP:23909"));
assert.equal(named.cardId, null);
assert.equal(named.modifier, null);
assert.equal(named.points[0].name, "Signs of Struggle");
assert.equal(rules.capture("SK_Tile_L:1", 7, null).points[0].name, "Signs of Struggle",
  "named stories remain usable with an empty exploration deck");
assert.equal(rules.capture("SK_Tile_S:1", 7, topCard), null,
  "tiles without a point or printed story title do not queue a story reminder");

assert.equal(rules.currentReminder(reminder, { step: 3, round: 7, tileId: "SK_Tile_M:3" }), reminder);
for (const position of [
  { step: 0, round: 7, tileId: "SK_Tile_M:3" },
  { step: 1, round: 7, tileId: "SK_Tile_M:3" },
  { step: 2, round: 7, tileId: "SK_Tile_M:3" },
  { step: 3, round: 8, tileId: "SK_Tile_M:3" },
  { step: 3, round: 7, tileId: "SK_Tile_M:1" }
]) {
  assert.equal(rules.currentReminder(reminder, position), null,
    "reminders belong only to the captured round, tile, and story phase");
}
assert.equal(rules.currentReminder(null, { step: 3, round: 7, tileId: "SK_Tile_M:3" }), null);
reminder.acknowledged = true;
assert.equal(rules.currentReminder(reminder, { step: 3, round: 7, tileId: "SK_Tile_M:3" }), reminder,
  "a confirmed reminder remains visible as a record of the story result");

const restored = rules.normalize(plain(reminder));
assert.equal(restored.round, 7);
assert.equal(restored.modifier, 3);
assert.equal(restored.acknowledged, true);
assert.equal(restored.points[0].result, 5,
  "save/reload retains the captured modifier and confirmation");
const repaired = rules.normalize({ ...plain(reminder), points: [{ type: "name", name: "wrong story" }] });
assert.equal(repaired.points[0].type, "number");
assert.equal(repaired.points[0].value, 2,
  "restored points must come from the verified tile catalog");
assert.equal(repaired.points[0].result, 5);
assert.equal(rules.normalize(null), null);
assert.equal(rules.normalize({ ...plain(reminder), tileId: "unknown-tile" }), null);
assert.equal(rules.normalize({ ...plain(reminder), round: 0 }), null);

// A manual correction changes only the lookup result. The captured tile and
// top-card details must remain available after a save/reload or a reversal.
assert.deepEqual(plain(reminder.manualResults), [null]);
const originalReminder = plain(reminder);
const increased = rules.adjustResult(reminder, 0, 1);
assert.equal(increased.points[0].result, 6, "the plus control advances the table result by one");
assert.deepEqual(plain(increased.manualResults), [6]);
assert.equal(rules.result("SK", increased.points[0]).name, "Shapes in the Dark",
  "a correction resolves the effect from the newly selected table entry");
for (const field of ["tileId", "round", "cardId", "modifier"]) {
  assert.equal(increased[field], reminder[field], `${field}: a manual result preserves its original capture`);
}
assert.equal(increased.points[0].value, 2);
assert.deepEqual(plain(reminder), originalReminder, "adjusting a result must not mutate the previous state");
assert.equal(rules.normalize(plain(increased)).points[0].result, 6,
  "manual results survive JSON export and save normalization");
assert.deepEqual(plain(rules.normalize(plain(increased)).manualResults), [6]);
const decreased = rules.adjustResult(reminder, 0, -1);
assert.equal(decreased.points[0].result, 4, "the minus control reduces the table result by one");
assert.deepEqual(plain(decreased.manualResults), [4]);
const automaticAgain = rules.adjustResult(increased, 0, -1);
assert.equal(automaticAgain.points[0].result, 5);
assert.deepEqual(plain(automaticAgain.manualResults), [null],
  "returning to the automatic result removes an unnecessary manual override");

for (const boundary of [1, 9]) {
  const atBoundary = rules.normalize({ ...plain(reminder), manualResults: [boundary] });
  const direction = boundary === 1 ? -1 : 1;
  assert.equal(rules.adjustResult(atBoundary, 0, direction).points[0].result, boundary,
    "manual result controls stop at the kingdom table's first and last entries");
}
for (const invalid of [undefined, null, {}, "6", [null], [0], [10], [-1], [1.5], ["6"], [true], [Infinity]]) {
  const imported = rules.normalize({ ...plain(reminder), manualResults: invalid });
  assert.equal(imported.points[0].result, 5, "malformed saved overrides fall back to the captured automatic result");
  assert.deepEqual(plain(imported.manualResults), [null]);
}
const importedOverride = rules.normalize({
  ...plain(reminder), manualResults: [7, 9], points: [{ type: "number", value: 8, result: 9 }]
});
assert.equal(importedOverride.points[0].value, 2, "manual overrides cannot replace the verified tile number");
assert.equal(importedOverride.points[0].result, 7);
assert.deepEqual(plain(importedOverride.manualResults), [7], "only existing numeric points accept saved overrides");
const namedOverride = rules.normalize({ ...plain(named), manualResults: [6] });
assert.equal(namedOverride.points[0].name, "Signs of Struggle");
assert.deepEqual(plain(namedOverride.manualResults), [null]);
assert.deepEqual(plain(rules.adjustResult(namedOverride, 0, 1)), plain(namedOverride),
  "named interest points cannot be turned into numeric table entries");

const unknownModifier = rules.capture("SK_Tile_M:3", 7, null);
const manuallyCompleted = rules.adjustResult(unknownModifier, 0, 1);
assert.equal(manuallyCompleted.points[0].result, 3,
  "an explicit first adjustment uses the tile number when no automatic result is available");
assert.equal(manuallyCompleted.modifier, null, "manual completion must not invent the missing card modifier");
assert.equal(manuallyCompleted.cardId, null);
assert.equal(unknownModifier.points[0].result, null, "a missing modifier stays unresolved until a user adjustment");
assert.equal(rules.normalize(plain(manuallyCompleted)).points[0].result, 3);
assert.equal(rules.adjustResult(unknownModifier, 0, -1).points[0].result, 1);
for (const [index, delta] of [[-1, 1], [1, 1], [0.5, 1], ["0", 1], [0, 0], [0, 2], [0, -2], [0, "1"], [0, NaN]]) {
  assert.deepEqual(plain(rules.adjustResult(reminder, index, delta)), plain(rules.normalize(reminder)),
    "invalid indices and non-unit adjustments leave the reminder unchanged");
}
assert.equal(rules.adjustResult(null, 0, 1), null);

for (const kingdom of ["SK", "POS"]) {
  for (let number = 1; number <= 9; number += 1) {
    const result = rules.result(kingdom, { type: "number", result: number });
    assert.ok(result, `${kingdom} ${number}: the kingdom panel has this numbered result`);
    assert.equal(result.number, number);
    for (const field of ["title", "name", "text"]) {
      assert.equal(typeof result[field], "string");
      assert.ok(result[field].trim(), `${kingdom} ${number}: ${field} is not empty`);
    }
    assert.deepEqual(plain(rules.result(kingdom, { type: "name", name: result.name })), plain(result),
      `${kingdom} ${number}: the printed name resolves to the same kingdom-panel entry`);
  }
}
const skPump = rules.result("SK", { type: "number", result: 5 });
assert.equal(skPump.name, "An Ancient Pump");
assert.match(skPump.text, /弃置.*涌水/);
const stoneCart = rules.result("POS", { type: "number", result: 5 });
assert.equal(stoneCart.name, "Splintered Cart");
assert.match(stoneCart.text, /4.*金钱/);
assert.match(stoneCart.text, /DEVIL.*12.*金钱/);
assert.equal(rules.result("SK", { type: "number", result: 2 }).name, "Signs of Struggle");
assert.equal(rules.result("POS", { type: "number", result: 2 }).name, "An Overlooked Alleyway");
assert.equal(rules.result("SK", { type: "name", name: "Signs of Struggle" }).number, 2);
assert.equal(rules.result("POS", { type: "name", name: "Signs of Struggle" }).number, 3);
assert.deepEqual(plain(rules.result("POS", { type: "name", name: "A Guard's Statue" })),
  plain(rules.result("POS", { type: "name", name: "A Guard’s Statue" })),
  "straight and typographic apostrophes identify the same printed story name");
for (const [kingdom, point] of [
  ["missing-kingdom", { type: "number", result: 2 }],
  ["SK", { type: "number", result: 0 }],
  ["POS", { type: "number", result: 10 }],
  ["SK", { type: "number", result: null }],
  ["SK", { type: "number", value: 2 }],
  ["POS", { type: "name", name: "unknown-story" }]
]) {
  assert.equal(rules.result(kingdom, point), null,
    "a missing kingdom, unknown table entry, or unavailable result must never show a guessed effect");
}

// Exercise the real travel/step helpers with the pure catalog. This checks the
// timing at which a board settlement captures its top card, rather than merely
// checking that the relevant function names occur in the app source.
const appSource = fs.readFileSync("public/modules/map/app.js", "utf8").replace(/\r\n/g, "\n");
function appFunction(name) {
  const start = appSource.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, `${name}: map app helper exists`);
  const end = appSource.indexOf("\n  function ", start + 1);
  assert.ok(end > start, `${name}: helper has an extractable function boundary`);
  return appSource.slice(start, end);
}
const appContext = {
  POI_RULES: rules,
  cardCatalog: Object.fromEntries(Object.values(data.kingdomRules)
    .flatMap(kingdom => [...kingdom.exploration, ...kingdom.specialExploration])
    .map(card => [card.id, card]))
};
vm.createContext(appContext);
vm.runInContext(`
  const STEPS = ["旅行", "王国板块", "探索", "故事"];
  const STEP_TOOL = ["travel", "tile", "exploration"];
  const MERCENARY_RULES = { normalizeState: value => value };
  const deepCopy = value => JSON.parse(JSON.stringify(value));
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const normalizeTrackers = value => value;
  const normalizeTrackNotes = value => value;
  const tile = id => ({ id });
  const tileLabel = item => item.id;
  const card = id => cardCatalog[id] || null;
  const messages = [];
  const logs = [];
  const saves = [];
  const addLog = text => logs.push(text);
  const save = shouldRender => saves.push(shouldRender);
  const checkLimits = () => {};
  const toastNode = { hidden: true };
  const $ = selector => selector === "#toast" ? toastNode : null;
  const clearTimeout = () => {};
  const toast = (text, duration) => { messages.push({ text, duration }); toastNode.hidden = false; };
  const scoutingState = exp => exp.scouting;
  const clearScoutingPeek = exp => { exp.scouting.lastPeek = []; };
  let activeTool = "tile";
  let focusStoryReminder = false;
  let state = {
    kingdom: "SK", step: 1, round: 7,
    trackers: { time: 0, threat: 0 }, trackNotes: {},
    mercenaries: { pendingAction: null }, knights: [], maps: {}
  };
  const mapState = () => state.maps[state.kingdom];
  const shortestPath = (from, to) => [from, to];
  const changeThreat = amount => { state.trackers.threat += amount; };
  const makeMap = tileId => ({
    current: tileId, selected: tileId, tileMeta: {}, tileState: {},
    pointOfInterestReminder: null, history: [], travelRoute: [],
    encounterSuppressions: [], pendingEncounter: null, tileResolution: null,
    fog: { active: false },
    exploration: {
      deck: ["SK:EXP:23909", "SK:EXP:23905"], current: null,
      resolvedRound: null, peek: false,
      scouting: { reordering: false, lastPeek: [] }
    }
  });
  const visibleReminder = () => POI_RULES.currentReminder(mapState().pointOfInterestReminder,
    { step: state.step, round: state.round, tileId: mapState().current });
  ${[
    "setCurrentTile", "enterStep", "canSkipTravelStep", "skipTravelStep",
    "canSkipExplorationStep", "skipExplorationStep", "snapshot", "snapshotMap",
    "undo", "finalizeTileResolution", "advanceBacktrack", "resolveBacktrack", "roundStepAction",
    "storyPointOfInterestReminder", "storyStepReminderText", "adjustStoryPointOfInterest"
  ].map(appFunction).join("\n")}

  state.maps.SK = makeMap("SK_Tile_M:3");
  finalizeTileResolution({ tileId: "SK_Tile_M:3", district: "mud" });
  settled = deepCopy({ step: state.step, map: mapState(), visible: visibleReminder() });
  mapState().exploration.deck.shift();
  mapState().exploration.resolvedRound = state.round;
  normalStepAction = roundStepAction();
  enterStep(3);
  afterDraw = deepCopy(visibleReminder());
  normalToast = ({ text: storyStepReminderText() });
  normalLog = logs.at(-1);
  const messageCount = messages.length;
  const logCount = logs.length;
  enterStep(3);
  sameStepMessageCount = messages.length - messageCount;
  sameStepLogCount = logs.length - logCount;

  snapshot("确认兴趣点");
  mapState().pointOfInterestReminder.acknowledged = true;
  undo();
  afterUndo = deepCopy(visibleReminder());

  const correctionHistoryLength = mapState().history.length;
  const correctionDeck = deepCopy(mapState().exploration.deck);
  adjustStoryPointOfInterest(0, 1);
  correctedStory = deepCopy(visibleReminder());
  correctionLog = logs.at(-1);
  correctionSaved = saves.at(-1);
  correctionSnapshotCount = mapState().history.length - correctionHistoryLength;
  correctionDeckUnchanged = JSON.stringify(mapState().exploration.deck) === JSON.stringify(correctionDeck);
  undo();
  correctedThenUndone = deepCopy(visibleReminder());
  adjustStoryPointOfInterest(0, -1);
  decreasedStory = deepCopy(visibleReminder());
  undo();

  mapState().pointOfInterestReminder = POI_RULES.normalize({ ...visibleReminder(), manualResults: [9] });
  const beforeBoundary = { history: mapState().history.length, logs: logs.length, saves: saves.length };
  adjustStoryPointOfInterest(0, 1);
  boundaryActionUnchanged = beforeBoundary.history === mapState().history.length
    && beforeBoundary.logs === logs.length && beforeBoundary.saves === saves.length;
  const beforeHiddenCorrection = deepCopy(mapState());
  state.step = 2;
  adjustStoryPointOfInterest(0, -1);
  hiddenCorrectionUnchanged = JSON.stringify(mapState()) === JSON.stringify(beforeHiddenCorrection);

  state.maps.SK = makeMap("SK_Tile_M:3");
  state.step = 1;
  finalizeTileResolution({ tileId: "SK_Tile_M:3", district: "mud" });
  skipExplorationStep();
  afterSkipExploration = deepCopy({ step: state.step, reminder: visibleReminder() });
  skippedToast = ({ text: storyStepReminderText() });

  state.round += 1;
  enterStep(0);
  hiddenAfterStory = toastNode.hidden;
  resolveBacktrack("SK_Tile_M:1");
  advanceBacktrack();
  skipExplorationStep();
  afterBacktrack = visibleReminder();
  backtrackToast = ({ text: storyStepReminderText() });

  state.round += 1;
  state.step = 0;
  skipTravelStep();
  skipExplorationStep();
  afterSkipTravel = visibleReminder();
  skipTravelToast = ({ text: storyStepReminderText() });

  state.round += 1;
  state.step = 1;
  mapState().current = "SK_Tile_L:1";
  finalizeTileResolution({ tileId: "SK_Tile_L:1", district: "drowned" });
  skipExplorationStep();
  namedAfterTravel = deepCopy(visibleReminder());
  namedToast = ({ text: storyStepReminderText() });

  state.round += 1;
  state.step = 1;
  mapState().current = "SK_Tile_S:1";
  finalizeTileResolution({ tileId: "SK_Tile_S:1", district: "mud" });
  skipExplorationStep();
  noPoiToast = ({ text: storyStepReminderText() });

  state.kingdom = "POS";
  state.maps.POS = makeMap("POS_Tile_L:2");
  state.step = 1;
  finalizeTileResolution({ tileId: "POS_Tile_L:2", district: "noble" });
  skipExplorationStep();
  stoneNamedToast = ({ text: storyStepReminderText() });
`, appContext);

assert.equal(appContext.settled.step, 2);
assert.equal(appContext.settled.visible, null, "a board settlement does not show story UI during exploration");
assert.equal(appContext.settled.map.tileState["SK_Tile_M:3"], "explored");
assert.equal(appContext.settled.map.pointOfInterestReminder.modifier, 3);
assert.equal(appContext.afterDraw.modifier, 3);
assert.equal(appContext.afterDraw.points[0].result, 5,
  "normal exploration draws must retain the modifier captured during the preceding board settlement");
assert.match(appContext.normalToast.text, /进入故事步骤/);
assert.match(appContext.normalToast.text, /阅读本轮故事段落.*时间事件/);
assert.match(appContext.normalToast.text, /沉没王国/);
assert.match(appContext.normalToast.text, /2\s*\+\s*3\s*=\s*5/);
assert.match(appContext.normalToast.text, /An Ancient Pump/);
assert.match(appContext.normalToast.text, /弃置.*涌水/);
assert.equal(appContext.sameStepMessageCount, 0, "story reminders use the priority panel instead of a toast");
assert.equal(appContext.normalLog, appContext.normalToast.text,
  "the same complete story reminder remains available in the history after its toast disappears");
assert.equal(appContext.sameStepMessageCount, 0, "rerendering or re-entering the same story step does not repeat the toast");
assert.equal(appContext.sameStepLogCount, 0, "the same story step does not duplicate history entries");
assert.equal(appContext.hiddenAfterStory, true, "leaving story hides its old reminder immediately");
assert.equal(appContext.normalStepAction.disabled, false,
  "a resolved normal exploration card can advance to the story phase");
assert.equal(appContext.afterUndo.acknowledged, false,
  "the map's normal undo snapshot restores the unconfirmed story reminder");
assert.equal(appContext.afterUndo.points[0].result, 5);
assert.equal(appContext.correctedStory.points[0].result, 6);
assert.equal(appContext.correctionSnapshotCount, 1, "each actual correction records one normal map undo snapshot");
assert.equal(appContext.correctionSaved, true, "manual corrections save immediately and rerender the result");
assert.equal(appContext.correctionDeckUnchanged, true, "correcting a result does not draw or reorder exploration cards");
assert.match(appContext.correctionLog, /手动修正.*6/,
  "recent history retains the user's corrected lookup result");
assert.match(appContext.correctionLog, /Shapes in the Dark/,
  "recent history includes the corrected entry's effect");
assert.equal(appContext.correctedThenUndone.points[0].result, 5);
assert.deepEqual(plain(appContext.correctedThenUndone.manualResults), [null],
  "undo restores the captured automatic result and removes the manual correction");
assert.equal(appContext.decreasedStory.points[0].result, 4);
assert.equal(appContext.boundaryActionUnchanged, true,
  "an out-of-range click adds no redundant undo snapshot, history entry, or save");
assert.equal(appContext.hiddenCorrectionUnchanged, true,
  "an adjustment cannot change a reminder outside its own story phase");
assert.equal(appContext.afterSkipExploration.step, 3);
assert.equal(appContext.afterSkipExploration.reminder.points[0].result, 5,
  "skipping the exploration draw still exposes the board's captured story reminder");
assert.match(appContext.skippedToast.text, /2\s*\+\s*3\s*=\s*5/);
assert.equal(appContext.afterBacktrack, null,
  "backtracking through explored terrain must not reuse last round's interest point");
assert.equal(appContext.afterSkipTravel, null,
  "remaining on an old tile must not manufacture a new board-settlement reminder");
for (const notification of [appContext.backtrackToast, appContext.skipTravelToast, appContext.noPoiToast]) {
  assert.match(notification.text, /进入故事步骤/,
    "the story phase still announces itself without any new interest point");
  assert.doesNotMatch(notification.text, /兴趣点|An Ancient Pump|Signs of Struggle/,
    "backtracking or a plain tile must not append a stale interest-point result");
}
assert.equal(appContext.namedAfterTravel.points[0].name, "Signs of Struggle");
assert.equal(appContext.namedAfterTravel.cardId, null);
for (const notification of [appContext.namedToast, appContext.stoneNamedToast]) {
  assert.match(notification.text, /Signs of Struggle/);
  assert.match(notification.text, /搜刮\s*1/,
    "named interest points include the actual kingdom-panel effect in the toast");
}
assert.match(appContext.stoneNamedToast.text, /巨石公国/);

console.log("map point of interest: both kingdom result tables, captured modifiers, manual +/- corrections, bounds, story history, backtracking, undo, and save recovery passed");
