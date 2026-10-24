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
assert.equal(data.monsters.length - special.length, 22);
assert.equal(special.length, 10);
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
for (const monster of special) {
  const { code } = monster.special, expected = grids[code], level = monster.encounterLevels[0];
  assert.equal(monster.encounterLevels.length, 1, code);
  assert.deepEqual(sorted(level.attackPattern), sorted(expected.red.map(([r,c]) => [r-expected.origin[0],c-expected.origin[1]])), code);
  assert.equal(level.attackFacing, expected.facing, code);
  assert.equal(level.stats.monsterSize, expected.size, code);
  assert.equal(monster.special.baseMonsterId, expected.base, code);
  assert.equal(monster.special.usesGenericToken, !expected.base, code);
  if (expected.base) assert.equal(monster.avatar, data.monsters.find(m => m.id === expected.base).avatar);
  if (!expected.base && code !== 'P5') assert.equal(monster.avatar, code === 'K1' ? '/assets/tokens/httpssteamusercontentaakamaihdnetugc107925210701772985157F1FFBF1B6B3122574EAC077DF071EEAECD0A.jpg' : '/assets/tokens/generic.png', code + ' uses the Boss token asset');
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
  assert.equal(available.length, count, knightId);
  assert.ok(available.every(m => m.special.knightId === knightId));
}
assert.equal(catalog.available(data.monsters, "").length, 22, "no leader unlocks no specials");
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
  window.testEncounter = { blankState, normalize, stats, preparePieces, calculatedAttackTargets, monsterRail,
    set(value) { state = normalize(value); }, get() { return state; } };
})();`, context);
const runtime = context.window.testEncounter;
const setLeader = knightId => { context.window.KF_CAMPAIGN_OPTIONS.leaderSheetId = `sheet-${knightId}`; };
const select = code => runtime.set({ ...plain(runtime.blankState()), monsterId: `Special_${code}`, phase: "setup" });
select("F4"); runtime.preparePieces();
assert.equal(runtime.get().monsters.length, 1);
runtime.get().monsters[0].space = "9"; // 6 columns, anchor row 1 col 2.
assert.deepEqual(plain(runtime.calculatedAttackTargets()).sort(), ["2","3","4","5","8","11","14","17"].sort(), "F4 uses its own 2x2 footprint range");
runtime.get().monsters[0].facing = 90;
// The vassal board is mirrored, so the card diagram rotates in visual space: the 90° ring lands on
// the opposite side of the footprint from the old space-number mapping.
assert.deepEqual(plain(runtime.calculatedAttackTargets()).sort(), ["2","3","4","8","14","20","21","22"].sort(), "F4 range rotates around its whole footprint in printed orientation");
setLeader("stoneface");
runtime.set({ ...plain(runtime.get()), phase: "monster", monsters: [{ id: "old", space: "9" }] });
assert.equal(runtime.get().phase, "setup");
assert.equal(runtime.get().monsters.length, 0);
assert.ok(!runtime.get().monsterId.startsWith("Special_"), "a saved special cannot bypass the current leader");
assert.ok(!runtime.monsterRail().includes("特殊遭遇战"), "having other knights in the party does not unlock their specials");
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
assert.deepEqual(plain(runtime.calculatedAttackTargets()).sort(), ["4","9","10","14","15"].sort(), "S4 uses printed right-facing range and clips the board edge");
runtime.get().monsters[0].facing = 0;
assert.deepEqual(plain(runtime.calculatedAttackTargets()).sort(), ["2","3","4"].sort(), "S4 rotates its asymmetric pattern to face up");
// The main page uses the same leader filter for its grouped selector and handoff.
const main = read("public/app.js");
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
assert.ok(!controls['#encounterMonster'].innerHTML.includes('特殊遭遇战'));
assert.equal(controls['#encounterType'].disabled, false);
assert.equal(controls['#encounterType'].value, 'normal');
console.log("special encounters: all 10 card grids, base models/tokens, leader filtering, saved-state gating, rotation, variable counts and solo duel verified");
