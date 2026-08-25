"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const appSource = fs.readFileSync("public/modules/encounter/app.js", "utf8").replace(/\r\n/g, "\n");
const indexSource = fs.readFileSync("public/modules/encounter/index.html", "utf8");
const constantsStart = appSource.indexOf("  const RED_DIE_FACES");
const constantsEnd = appSource.indexOf("\n  const KEY", constantsStart);
const rollStart = appSource.indexOf("  function normalizeFace(");
const rollEnd = appSource.indexOf("\n  function setPlacementRoll(", rollStart);
const matchStart = appSource.indexOf("  function faceMatchesSpace(");
const matchEnd = appSource.indexOf("\n  function positionPieceEntries(", matchStart);

assert.ok(constantsStart >= 0 && constantsEnd > constantsStart, "die face definitions not found");
assert.ok(rollStart >= 0 && rollEnd > rollStart, "die roll helpers not found");
assert.ok(matchStart >= 0 && matchEnd > matchStart, "die matching helper not found");

const redFaces = [
  { id: "double-sword", match: { sword: 2 } },
  { id: "sword-cup-a", match: { sword: 1, cup: 1 } },
  { id: "blank", match: {} },
  { id: "cup", match: { cup: 1 } },
  { id: "sword", match: { sword: 1 } },
  { id: "sword-cup-b", match: { sword: 1, cup: 1 } },
];
const context = { DATA: { dice: { faces: redFaces } } };

vm.runInNewContext(`
  let tierValue = "dragon";
  const tier = () => tierValue;
  ${appSource.slice(constantsStart, constantsEnd)}
  ${appSource.slice(rollStart, rollEnd)}
  ${appSource.slice(matchStart, matchEnd)}
  dragonFacesJson = JSON.stringify(DRAGON_DIE_FACES);
  dragonMonsterFaceIds = dieFaces("monster").map(face => face.id);
  dragonKnightFaceIds = dieFaces("knight").map(face => face.id);
  migratedDragonFace = normalizeFace("double-sword", DRAGON_DIE_FACES);
  rolledDragonFaceIds = Array.from({ length: 60 }, () => roll("monster"));
  exactDragonMatch = faceMatchesSpace("dragon-double-sword-double-cup", { sword: 2, cup: 2 });
  insufficientDragonMatch = faceMatchesSpace("dragon-double-sword-double-cup", { sword: 1, cup: 2 });
  tierValue = "vassal";
  vassalMonsterFaceIds = dieFaces("monster").map(face => face.id);
`, context);

const dragonFaces = JSON.parse(context.dragonFacesJson);
const expectedMatches = [
  { sword: 2, cup: 2 },
  { sword: 2 },
  { sword: 1, cup: 1 },
  { sword: 1 },
  { sword: 1, cup: 2 },
  { sword: 2, cup: 1 },
];

assert.equal(dragonFaces.length, 6, "white dragon die has six faces");
assert.deepEqual(dragonFaces.map(face => face.match), expectedMatches);
assert.ok(context.dragonMonsterFaceIds.every(id => id.startsWith("dragon-")), "dragon monsters use the white die");
assert.deepEqual(Array.from(context.dragonKnightFaceIds), redFaces.map(face => face.id), "knights keep using the red die");
assert.deepEqual(Array.from(context.vassalMonsterFaceIds), redFaces.map(face => face.id), "non-dragon monsters keep using the red die");
assert.equal(context.migratedDragonFace, dragonFaces[0].id, "saved red face migrates by physical face index");
assert.ok(context.rolledDragonFaceIds.every(id => id.startsWith("dragon-")), "dragon rerolls stay on the white die");
assert.equal(context.exactDragonMatch, true);
assert.equal(context.insufficientDragonMatch, false);

for (const face of dragonFaces) {
  assert.ok(fs.existsSync(`public/${face.src.replace(/^\//, "")}`), `missing white die face asset: ${face.src}`);
}

assert.match(appSource, /怪物放置骰（白骰）/, "dragon monster die is identified in the UI");
assert.match(indexSource, /app\.js\?v=24/, "encounter app cache version is updated");

console.log("encounter dragon white die assertions passed");
