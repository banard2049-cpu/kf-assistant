"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const read = path => fs.readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const app = read("public/modules/encounter/app.js");
const viewSource = read("public/modules/encounter/encounter-view.js");
const context = { window: {} };
vm.runInNewContext(read("public/modules/encounter/data/encounter-data.js"), context);
vm.runInNewContext(viewSource, context);
const data = context.window.KF_ENCOUNTER_DATA;
const view = context.window.KFEncounterView;
const board = data.boards.vassal;
const plain = value => JSON.parse(JSON.stringify(value));
const between = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));

assert.equal(Object.hasOwn(board, "mirror"), false);
assert.equal(board.mapScaleY, 1, "the board image keeps its original geometry");
assert.deepEqual(plain(board.inset), [6.9, 18.7, 8.5, 13.9], "grid edges are fixed to the printed image");
for (const code of [app, viewSource]) assert.doesNotMatch(code, /board\.mirror|direction:rtl|activeCols/);

for (const [tier, locked] of Object.entries({
  vassal: [1, 2, 7, 8, 13, 14, 19, 20], king: [1, 7, 13, 19], devil: []
})) {
  const html = view.renderBoard({ data, level: { tier }, state: { phase: "position" } });
  const cells = [...html.matchAll(/<button class="space ([^"]*)" data-space="(\d+)"([^>]*)>/g)];
  assert.deepEqual(cells.map(([, , n]) => Number(n)), Array.from({ length: 24 }, (_, i) => i + 1));
  assert.deepEqual(cells.filter(([, , , attributes]) => /disabled/.test(attributes)).map(([, , n]) => Number(n)), locked,
    `${tier}: lock exactly the printed left-hand expansion columns`);
  for (let n = 1; n <= 24; n++) assert.equal(view.isUnavailableBoardSpace(n, board, tier), locked.includes(n));
}

const targetsFor = (tier, facing = 0, anchor = "9") => {
  const test = { board, tierValue: tier, facing, anchor };
  vm.runInNewContext(`
    const boardData = () => board;
    const tier = () => tierValue;
    const monsterFootprint = () => 2;
    const currentLevel = () => ({ attackPattern: [[0, 2]], attackPatternVerified: true, attackFacing: 0 });
    const state = { monsters: [{ space: anchor, facing }] };
    ${between("  function isUnavailableBoardSpace(", "\n  function spaceSymbols(")}
    ${between("  function rotateAttackOffset(", "\n  function attackTargetsVisible(")}
    result = calculatedAttackTargets();
  `, test);
  return plain(test.result);
};
assert.deepEqual(targetsFor("vassal"), ["11"], "east attacks stay right of the 2x2 image anchor");
assert.deepEqual(targetsFor("vassal", 90), ["22"], "attacks rotate clockwise in image coordinates");
assert.deepEqual(targetsFor("vassal", 180), [], "attacks exclude the locked left expansion columns");
assert.deepEqual(targetsFor("king", 180), ["14"], "king can target the unlocked second column");

const upgraded = {
  monsters: [{ space: "2" }], knights: [{ space: "1" }], customPieces: [{ space: "7" }], targets: ["1", "7"]
};
const migration = { upgraded };
vm.runInNewContext(`${between("  function upgradeBoardCoordinates(", "\n  function normalize(")}
  upgradeBoardCoordinates(upgraded, "vassal", 2);`, migration);
assert.deepEqual(plain(upgraded), {
  boardLayoutVersion: 2,
  monsters: [{ space: "4" }], knights: [{ space: "6" }], customPieces: [{ space: "12" }], targets: ["6", "12"]
}, "old saves keep their physical model positions and attack cells");
const after = JSON.stringify(upgraded);
vm.runInNewContext(`${between("  function upgradeBoardCoordinates(", "\n  function normalize(")}
  upgradeBoardCoordinates(upgraded, "vassal", 2);`, migration);
assert.equal(JSON.stringify(upgraded), after, "coordinate upgrade only runs once");

const mob = data.monsters.find(item => item.type === "mob");
const mobHtml = view.renderBoard({ data, monster: mob, level: mob.encounterLevels[0], state: {
  phase: "position", monsterId: mob.id, monsters: [{ id: "mob-1", name: mob.name, space: "2", facing: 90 }]
} });
assert.match(mobHtml, /class="piece monster [^"]*monster-token-frame[^"]*" style="--token-facing:90deg"/,
  "minion tokens use the same pen ring and facing arrow as bosses");
const boss = data.monsters.find(item => item.type === "boss");
const bossHtml = view.renderBoard({ data, monster: boss, level: boss.encounterLevels[0], state: {
  phase: "position", monsterId: boss.id, monsters: [{ id: "boss-1", name: boss.name, space: "2", facing: 180 }]
} });
assert.match(bossHtml, /class="piece monster [^"]*boss-token-frame[^"]*" style="--token-facing:180deg"/,
  "boss tokens keep their existing pen ring class");
console.log("encounter image board: fixed grid, tier locks, attack directions, saved positions and token frames verified");
