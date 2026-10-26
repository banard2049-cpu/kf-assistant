"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = name => fs.readFileSync(name, "utf8").replace(/\r\n/g, "\n");
const context = { window: {}, console, setTimeout, clearTimeout, Date, Math };
vm.createContext(context);
vm.runInContext(read("public/monster-labels.js"), context);
vm.runInContext(read("public/modules/encounter/data/encounter-data.js"), context);
vm.runInContext(read("public/modules/encounter/encounter-catalog.js"), context);
vm.runInContext(read("public/modules/encounter/encounter-view.js"), context);
const data = context.window.KF_ENCOUNTER_DATA;
const catalog = context.window.KFEncounterCatalog;
const special = data.monsters.filter(monster => monster.category === "special");
const campaignSpecials = special.filter(monster => monster.special.scope === "campaign");
const knightSpecials = special.filter(monster => monster.special.scope !== "campaign");
const campaignPages = { "TSF-0032": 32, "TSF-0531": 33, "TSF-0932": 35, "TSF-7012": 43, "TSF-7416": 45, "TSF-7912": 46 };
assert.equal(data.monsters.length - special.length, 22);
assert.equal(knightSpecials.length, 10);
assert.equal(campaignSpecials.length, 6);
assert.deepEqual(JSON.parse(JSON.stringify(campaignSpecials.map(monster => monster.special.code))).sort(), Object.keys(campaignPages).sort());
for (const monster of campaignSpecials) {
  assert.equal(monster.special.knightId, null, `${monster.id} is independent of the leader`);
  assert.equal(monster.special.source.bookTitle, "万种多肉恐惧");
  assert.equal(monster.special.source.printedPage, campaignPages[monster.special.code]);
  if (monster.type === "boss") {
    const level = monster.encounterLevels[0];
    const board = context.window.KFEncounterView.boardData(data, level);
    assert.equal(board.src, data.boards.vassal.src, "codex bosses use the printed shared board");
    assert.equal(board.cols * board.rows, 24);
    const playable = Array.from({ length: 24 }, (_, index) => index + 1)
      .filter(space => !context.window.KFEncounterView.isUnavailableBoardSpace(space, board, level.tier));
    assert.equal(playable.length, 24, `${monster.id} retains all printed board cells`);
  }
}
const normalVassal = data.monsters.find(monster => monster.id === "M_BogWitch").encounterLevels[0];
const normalBoard = context.window.KFEncounterView.boardData(data, normalVassal);
assert.equal(Array.from({ length: 24 }, (_, index) => index + 1)
  .filter(space => !context.window.KFEncounterView.isUnavailableBoardSpace(space, normalBoard, normalVassal.tier)).length, 16,
"ordinary vassals retain their printed locked columns");
// The numbered red cells are transcribed independently from the printed grids.
const grids = {
  F4: { origin: [2, 2], red: [[1,1],[1,2],[1,3],[1,4],[2,1],[2,4],[3,1],[3,4]], base: "M_Eggknight", facing: 0, size: 2 },
  F3: { origin: [1, 2], red: [[1,1],[1,3]], base: "M_Pumpkinhead", facing: 0, size: 1 },
  F2: { origin: [2, 1], red: [[1,1],[2,2]], base: "M_FirstmenWarriors", facing: 0, size: 1 },
  K1: { origin: [1, 1], red: [[1,2]], base: null, facing: 90, size: 1 },
  K4: { origin: [4, 3], red: [[2,3],[3,2],[3,4],[4,1],[4,5],[5,2],[5,3],[5,4]], base: null, facing: 0, size: 1 },
  P2: { origin: [2, 2], red: [[1,3],[3,1]], base: null, facing: 0, size: 1 },
  P5: { origin: [2, 2], red: [[1,1],[1,3]], base: null, facing: 0, size: 1 },
  R5: { origin: [2, 1], red: [[1,0],[1,1],[1,2],[2,0],[2,2],[3,0],[3,1],[3,2]], base: "M_FirstmenWarriors", facing: 0, size: 1 },
  S4: { origin: [2, 1], red: [[1,2],[2,2],[2,3],[3,2],[3,3],[4,3]], base: null, facing: 90, size: 1 },
  U1: { origin: [1, 1], red: [[1,2]], base: null, facing: 90, size: 1 },
};
const plain = value => JSON.parse(JSON.stringify(value));
const sorted = points => plain(points).map(point => point.join(",")).sort();
for (const monster of knightSpecials) {
  const { code } = monster.special, expected = grids[code], level = monster.encounterLevels[0];
  assert.equal(monster.encounterLevels.length, 1, code);
  assert.deepEqual(sorted(level.attackPattern), sorted(expected.red.map(([r,c]) => [r-expected.origin[0],c-expected.origin[1]])), code);
  assert.equal(level.attackFacing, expected.facing, code);
  assert.equal(level.stats.monsterSize, expected.size, code);
  assert.equal(monster.special.baseMonsterId, expected.base, code);
  assert.equal(monster.special.usesGenericToken, !expected.base, code);
  if (expected.base) assert.equal(monster.avatar, data.monsters.find(m => m.id === expected.base).avatar);
  if (!expected.base && code !== 'P5') assert.equal(monster.avatar, code === 'K1' ? '/assets/tokens/httpssteamusercontentaakamaihdnetugc107925210701772985157F1FFBF1B6B3122574EAC077DF071EEAECD0A.jpg' : '/assets/tokens/generic.png', code + ' uses the Boss token asset');
}
for (const monster of special) {
  const { code } = monster.special, level = monster.encounterLevels[0];
  const file = path.join("public", level.image.face.split('?')[0]);
  assert.ok(fs.existsSync(file), file);
  const png = fs.readFileSync(file);
  assert.equal(png.toString("ascii", 1, 4), "PNG");
  assert.ok(Math.abs(png.readUInt32BE(16)/png.readUInt32BE(20)-level.image.aspect)<.0001);
  const cardMarkup = context.window.KFEncounterView.renderCard(level, 'face');
  assert.ok(cardMarkup.includes(level.image.face), code + ' second-screen card');
  assert.ok(cardMarkup.includes(`aspect-ratio:${level.image.aspect}`), code + ' second-screen aspect');
  const boardMarkup = context.window.KFEncounterView.renderBoard({data,monster,level,state:{phase:'monster',monsters:[{id:'m',space:'8',name:monster.name}],targets:['9']},interactive:false});
  assert.ok(boardMarkup.includes(monster.avatar), code + ' second-screen model/token');
  assert.ok(boardMarkup.includes('space read-only'), code + ' second-screen board');
}
const changeling = special.find(monster => monster.special.code === 'P5');
assert.equal(changeling.special.avatarSource.kind, 'borrowed-guise');
assert.equal(changeling.special.avatarSource.evidence.pdfPage, 109);
assert.equal(changeling.special.usesGenericToken, true, 'a display portrait does not change the printed token rule');
assert.equal(changeling.special.baseMonsterId, null, 'a borrowed guise does not create a base-monster match');
const guise = fs.readFileSync(path.join('public', changeling.avatar.split('?')[0]));
assert.equal(guise.toString('ascii', 1, 4), 'PNG');
assert.equal(guise.readUInt32BE(16), guise.readUInt32BE(20), 'portrait crop stays square');
const counts = { fleischritter: 3, kara: 2, paracelsa: 2, renholder: 1, "ser-sonch": 1, "ser-ubar": 1, stoneface: 0 };
const party = Object.keys(counts).map(knightId => ({ id: `sheet-${knightId}`, knightId, name: knightId, type: "knight" }));
for (const [knightId, count] of Object.entries(counts)) {
  const leader = catalog.leaderKnightId(party, `sheet-${knightId}`);
  const available = catalog.available(data.monsters, leader).filter(m => m.special);
  assert.equal(available.length, count + campaignSpecials.length, knightId);
  assert.ok(available.every(m => m.special.scope === "campaign" || m.special.knightId === knightId));
}
assert.equal(catalog.available(data.monsters, "").length, 22 + campaignSpecials.length, "campaign specials are available without a leader");
assert.deepEqual(catalog.available(special, "").map(monster => monster.id).sort(), campaignSpecials.map(monster => monster.id).sort());
assert.equal(catalog.available([{ category: "special", special: { knightId: null } }], "").length, 0, "a missing knight restriction alone does not make a card public");
assert.equal(catalog.leaderKnightId([{ id: "s", type: "squire", knightId: "kara" }], "s"), "");
context.window.KF_CAMPAIGN_PARTY = party;
context.window.KF_CAMPAIGN_OPTIONS = { leaderSheetId: "sheet-fleischritter" };
context.localStorage = { getItem: () => null, setItem: () => {} };
context.document = { querySelector: () => ({ addEventListener() {} }), querySelectorAll: () => [] };
context.window.addEventListener = () => {};
const app = read("public/modules/encounter/app.js");
const end = app.lastIndexOf("  renderApp();");
assert.ok(end > 0);
vm.runInContext(app.slice(0, end) + `
  renderApp = () => {};
  window.testEncounter = { blankState, normalize, stats, preparePieces, calculatedAttackTargets, monsterRail, setupPanel,
    positionPanel, rerollPlacementDice, handleSpace, moveSelectedPieceOffBoard, confirmPlacement, bind,
    placementRule: () => bossPlacementRule("monster", state.monsters[0]),
    set(value) { state = normalize(value); }, get() { return state; } };
})();`, context);
const runtime = context.window.testEncounter;
const setLeader = knightId => { context.window.KF_CAMPAIGN_OPTIONS.leaderSheetId = `sheet-${knightId}`; };
const select = code => runtime.set({ ...plain(runtime.blankState()), monsterId: `Special_${code}`, phase: "setup" });
const specialGroupTag = () => runtime.monsterRail().match(/<details[^>]*id="specialEncounters"[^>]*>/)?.[0] || "";
assert.ok(specialGroupTag(), "special encounters have an accessible native disclosure");
assert.ok(!specialGroupTag().includes(" open"), "special encounters start collapsed independently of the whole rail");
const originalDocument = context.document;
const railEvents = {}, specialEvents = {};
const specialDisclosure = { open: false, addEventListener(type, handler) { specialEvents[type] = handler; } };
const railToggle = { addEventListener(type, handler) { railEvents[type] = handler; } };
context.document = { querySelector: selector => ({ "#specialEncounters": specialDisclosure, "#toggleMonsterRail": railToggle }[selector] || null), querySelectorAll: () => [] };
runtime.bind();
railEvents.click();
assert.ok(!runtime.monsterRail().includes('monster-rail collapsed'), "the whole rail still expands independently");
assert.ok(!specialGroupTag().includes(" open"));
assert.match(runtime.monsterRail(), /<\/details><section class="monster-group"><h3>常规遭遇战<\/h3>/, "regular encounters stay outside the special disclosure");
specialDisclosure.open = true;
specialEvents.toggle({ currentTarget: specialDisclosure });
select("F3");
assert.ok(specialGroupTag().includes(" open"), "opening specials survives card selection and rerendering");
railEvents.click(); railEvents.click();
assert.ok(specialGroupTag().includes(" open"), "toggling the whole rail preserves the special group state");
specialDisclosure.open = false;
specialEvents.toggle({ currentTarget: specialDisclosure });
assert.ok(!specialGroupTag().includes(" open"), "closing specials is preserved on subsequent renders");
context.document = originalDocument;
select("F4"); runtime.preparePieces();
assert.equal(runtime.get().monsters.length, 1);
runtime.get().monsters[0].space = "10"; // Image row 2, column 4, within the printed Vassal area.
assert.deepEqual(plain(runtime.calculatedAttackTargets()).sort(), ["3","4","5","6","9","12","15","18"].sort(), "F4 uses its own 2x2 footprint range");
runtime.get().monsters[0].facing = 90;
assert.deepEqual(plain(runtime.calculatedAttackTargets()).sort(), ["4","5","6","12","18","22","23","24"].sort(), "F4 range rotates around its whole footprint in printed orientation");
setLeader("stoneface");
runtime.set({ ...plain(runtime.get()), phase: "monster", monsters: [{ id: "old", space: "9" }] });
assert.equal(runtime.get().phase, "setup");
assert.equal(runtime.get().monsters.length, 0);
assert.ok(!runtime.get().monsterId.startsWith("Special_"), "a saved special cannot bypass the current leader");
assert.ok(!runtime.monsterRail().includes('data-monster="Special_F4"'), "having other knights in the party does not unlock their specials");
for (const monster of campaignSpecials) assert.ok(runtime.monsterRail().includes(`data-monster="${monster.id}"`));
setLeader("kara"); select("K1");
runtime.set({ ...plain(runtime.get()), specialMonsterCount: 10 }); runtime.preparePieces();
assert.equal(runtime.get().monsters.length, 10);
runtime.set({ ...plain(runtime.get()), specialMonsterCount: 100 }); assert.equal(runtime.stats().monsterCount, 10);
runtime.set({ ...plain(runtime.get()), specialMonsterCount: -2 }); assert.equal(runtime.stats().monsterCount, 1);
select("K4"); runtime.preparePieces();
assert.deepEqual(plain(runtime.get().knights).map(k => k.sheetId), ["sheet-kara"], "Kara's duel excludes allies");
runtime.set({ ...plain(runtime.blankState()), monsterId: "M_Eggknight" }); runtime.preparePieces();
assert.equal(runtime.get().knights.length, 4, "normal encounter restores the campaign party");
setLeader("ser-sonch"); select("S4"); runtime.preparePieces();
runtime.get().monsters[0].space = "8"; runtime.get().monsters[0].facing = 90;
assert.deepEqual(plain(runtime.calculatedAttackTargets()).sort(), ["4","9","10","14"].sort(), "S4 uses printed right-facing range and clips the board edge and absent corner");
runtime.get().monsters[0].facing = 0;
assert.deepEqual(plain(runtime.calculatedAttackTargets()).sort(), ["2","3","4"].sort(), "S4 rotates its asymmetric pattern to face up");
assert.ok(runtime.setupPanel().includes("骑士书第 41 页"), "existing knight-book source labels stay available");
for (const monster of campaignSpecials) {
  select(monster.special.code); runtime.preparePieces();
  assert.equal(runtime.get().monsterId, monster.id, `${monster.id} can be selected with any leader`);
  assert.equal(runtime.get().encounterType, "special");
  assert.equal(runtime.get().monsters.length, monster.encounterLevels[0].stats.monsterCount);
  assert.equal(runtime.get().knights.length, 4, "campaign encounters keep the full party");
  const panel = runtime.setupPanel();
  assert.ok(panel.includes(`万种多肉恐惧第 ${campaignPages[monster.special.code]} 页`), `${monster.id} identifies its source book`);
  assert.ok(panel.includes(monster.special.note), `${monster.id} shows its setup and positioning note`);
  const saved = { ...plain(runtime.get()), phase: "monster" };
  for (const leaderSheetId of ["", "sheet-stoneface", "sheet-kara"]) {
    context.window.KF_CAMPAIGN_OPTIONS.leaderSheetId = leaderSheetId;
    runtime.set(saved);
    assert.equal(runtime.get().monsterId, monster.id, `${monster.id} survives a leader change to ${leaderSheetId || "none"}`);
    assert.equal(runtime.get().phase, "monster", "campaign encounter progress is retained");
    assert.equal(runtime.get().monsters.length, saved.monsters.length, "campaign encounter pieces are retained");
  }
}
for (const code of ["TSF-0032", "TSF-7012"]) {
  select(code); runtime.preparePieces();
  const tree = runtime.get().monsters[0];
  assert.equal(runtime.stats().monsterSize, 2, `${code} uses the printed 2×2 tree footprint`);
  assert.equal(tree.space, "9", `${code} automatically occupies the center of its printed 6×4 board`);
  const monster = campaignSpecials.find(item => item.special.code === code);
  const board = context.window.KFEncounterView.boardData(data, monster.encounterLevels[0]);
  assert.equal(board.src, data.boards.vassal.src, "tree encounters use the printed shared 6×4 board");
  const secondScreen = context.window.KFEncounterView.renderBoard({ data, monster, level: monster.encounterLevels[0], state: runtime.get(), interactive: false });
  assert.ok(secondScreen.includes("--cols:6;--rows:4"), "the second screen honors the board override");
  assert.ok(!secondScreen.includes('class="space read-only inactive'), "all 24 printed tree-board cells remain available");
  assert.deepEqual(plain(tree.rolls), [], "fixed-center trees do not roll placement dice");
  assert.equal(tree.roll, "");
  assert.equal(runtime.get().selectedPiece, `knight:${runtime.get().knights[0].id}`, "the first knight is ready to place");
  runtime.get().phase = "position";
  const panel = runtime.positionPanel();
  assert.match(panel, /固定中央放置/);
  assert.match(panel, /重新投骑士放置骰/);
  assert.doesNotMatch(panel, /data-die="monster"|data-reroll-die="monster"|首领放置校验/);
  assert.equal(runtime.placementRule().requiredMatches, 0, "central positioning ignores matching monster dice");
  assert.deepEqual([...runtime.placementRule().anchors], ["9"]);
  runtime.get().selectedPiece = `monster:${tree.id}`;
  const beforeMove = JSON.stringify(runtime.get());
  runtime.handleSpace("1");
  assert.equal(JSON.stringify(runtime.get()), beforeMove, "clicking another anchor cannot move the fixed tree or add history");
  assert.equal(runtime.moveSelectedPieceOffBoard(), false, "the fixed tree cannot be removed during positioning");
  assert.equal(tree.space, "9");
  runtime.handleSpace("9");
  assert.equal(tree.facing, 90, "the fixed tree can still rotate");
  assert.equal(tree.space, "9");
  const beforeReroll = plain(tree);
  const lastFace = data.dice.faces[data.dice.faces.length - 1].id;
  runtime.get().knights.forEach((knight, index) => { knight.roll = data.dice.faces[0].id; knight.space = String(index + 1); });
  const knightSpaces = runtime.get().knights.map(knight => knight.space);
  const originalMath = context.Math;
  context.Math = Object.create(Math);
  context.Math.random = () => 0.9999;
  runtime.rerollPlacementDice();
  context.Math = originalMath;
  assert.deepEqual(plain(tree), beforeReroll, "reroll preserves the tree position, facing and empty dice");
  assert.ok(runtime.get().knights.every(knight => knight.roll === lastFace), "reroll updates every knight die");
  assert.deepEqual(runtime.get().knights.map(knight => knight.space), knightSpaces, "reroll preserves knight positions");
  runtime.set({ ...plain(runtime.get()), monsters: [{ ...plain(tree), space: "1", roll: lastFace, rolls: [lastFace] }] });
  assert.equal(runtime.get().monsters[0].space, "9", "restoring a positioning save repairs the central anchor");
  assert.deepEqual(plain(runtime.get().monsters[0].rolls), [], "restoring a positioning save clears stale monster dice");
  assert.equal(runtime.confirmPlacement(), true, "the centered tree requires no monster dice to confirm placement");
}
// The main page uses the same leader filter for its grouped selector and handoff.
const main = read("public/app.js").replace(/^import[^\n]*\n/gm, "");
const mainStart = main.indexOf("function availableEncounterMonsters(");
const mainEnd = main.indexOf("function renderEncounter(){", mainStart);
const controls = Object.fromEntries(["#encounterMonster","#encounterLevel","#encounterType"].map(key => [key, { innerHTML: "", value: "", disabled: false }]));
context.$ = key => controls[key];
context.esc = value => value;
context.knightSheets = () => [{ id: "main-kara", state: { knightId: "kara" } }, { id: "main-stoneface", state: { knightId: "stoneface" } }];
context.gameSettings = { leaderSheetId: "main-kara" };
vm.runInContext(main.slice(0, main.indexOf("const $ =")) + main.slice(mainStart, mainEnd), context);
context.renderEncounterChoices("Bounty Hunters");
assert.match(controls['#encounterMonster'].innerHTML, /optgroup label="特殊遭遇战"/);
assert.ok(!controls['#encounterMonster'].innerHTML.includes('Apex Eggknight'));
assert.equal(controls['#encounterType'].value, 'special');
context.gameSettings.leaderSheetId = 'main-stoneface';
context.renderEncounterChoices('Bounty Hunters');
assert.ok(!controls['#encounterMonster'].innerHTML.includes('Bounty Hunters'));
assert.match(controls['#encounterMonster'].innerHTML, /optgroup label="特殊遭遇战"/);
assert.equal(controls['#encounterType'].disabled, false);
assert.equal(controls['#encounterType'].value, 'normal');
context.gameSettings.leaderSheetId = '';
context.renderEncounterChoices(campaignSpecials[0].name);
assert.equal(controls['#encounterMonster'].value, campaignSpecials[0].name, "main-page selector accepts campaign cards without a leader");
assert.equal(controls['#encounterType'].disabled, true);
assert.equal(controls['#encounterType'].value, 'special');
for (const monster of campaignSpecials) assert.ok(controls['#encounterMonster'].innerHTML.includes(monster.name));
assert.ok(!controls['#encounterMonster'].innerHTML.includes('Bounty Hunters'));
console.log("special encounters: 10 knight cards, 6 campaign cards, card assets, leader filtering, saved-state gating, campaign source notes, fixed-center trees, board overrides, rotation, variable counts and solo duel verified");
