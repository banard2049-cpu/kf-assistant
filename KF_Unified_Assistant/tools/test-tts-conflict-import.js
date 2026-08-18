"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const importer = require("./import-tts-conflict-assets.js");

const root = path.resolve(__dirname, "../public/modules/display");
const dataPath = path.join(root, "data/conflict-board-data.json");
const manifestPath = path.join(root, "data/conflict-assets-manifest.json");
const beforeData = fs.readFileSync(dataPath, "utf8");
const beforeManifest = fs.readFileSync(manifestPath, "utf8");
const result = importer.run();
assert.strictEqual(fs.readFileSync(dataPath, "utf8"), beforeData, "repeated layout import must be byte-stable");
assert.strictEqual(fs.readFileSync(manifestPath, "utf8"), beforeManifest, "repeated manifest import must be byte-stable");

const data = result.data;
const manifest = result.manifest;
assert.deepStrictEqual({ width:data.board.width,height:data.board.height }, { width:7994,height:4553 });
assert.deepStrictEqual(data.board.crop, { x:748,y:340,width:5328,height:3808 });
assert.strictEqual(data.layouts.length, 30);
assert.deepStrictEqual(data.foolDeck.sheet, {
  asset:"assets/conflict/fool-card-sheet.jpg",width:2420,height:2232,columns:5,rows:3
});
assert.deepStrictEqual(data.foolDeck.back, {
  asset:"assets/conflict/fool-card-back.jpg",width:484,height:744
});
assert.strictEqual(data.foolDeck.cards.length, 15);
assert.deepStrictEqual(data.foolDeck.cards.find(card => card.cardId === 17104), {
  cardId:17104,label:"The Comet",spaces:["A7","J8"],column:4,row:0
});
assert.deepStrictEqual(data.foolDeck.cards.find(card => card.cardId === 17108), {
  cardId:17108,label:"Tenebrae",spaces:["A2"],column:3,row:1
});
assert.deepStrictEqual([...new Set(data.layouts.map(layout => layout.kingdom))].sort(), ["stone","sunken"]);
assert.deepStrictEqual(data.randomOrientations, { R:[0,90,180,270],K:[180,270] });
assert.deepStrictEqual(data.terrainCards.sheet, {
  asset:"assets/conflict/terrain-card-sheet.jpg",width:7300,height:2080,columns:10,rows:2
});
assert.deepStrictEqual(data.terrainCards.byAsset.Column, { cardId:23602,label:"Column",column:2,row:0 });
assert.deepStrictEqual(data.terrainCards.byAsset.Bloodgeyser, { cardId:23610,label:"Bloodgeyser",column:0,row:1 });
assert.strictEqual(data.terrainCards.byAsset.Rubble2.cardId, data.terrainCards.byAsset.RubbleLM.cardId);
assert.strictEqual(data.terrainCards.byAsset.RuinedWall4.cardId, data.terrainCards.byAsset.RuinedWallLM.cardId);

const stoneEggknight = data.layouts.find(layout => layout.id === "stone:M_Eggknight:all");
assert.deepStrictEqual(
  stoneEggknight.placements.find(placement => placement.ref === "D4"),
  { id:"Column-1",kind:"terrain",asset:"Column",ref:"D4",rowStart:7,rowEnd:7,columnStart:4,columnEnd:4,orientation:"S",rotation:180,layer:10 },
  "D4 must map to the seventh rendered row when J is at the top"
);
const stoneIroncast = data.layouts.find(layout => layout.id === "stone:M_Ironcast:all");
assert.strictEqual(stoneIroncast.placements.find(placement => placement.ref === "J7").rowStart, 1, "J must be the top rendered row");
assert.strictEqual(stoneIroncast.placements.find(placement => placement.ref === "A8").rowStart, 10, "A must be the bottom rendered row");

for (const layout of data.layouts) {
  assert.ok(layout.monsterId.startsWith("M_"), `${layout.id} must resolve to a monster id`);
  for (const placement of layout.placements) {
    assert.ok(placement.rowStart >= 1 && placement.rowEnd <= 10, `${layout.id}/${placement.ref} row out of bounds`);
    assert.ok(placement.columnStart >= 1 && placement.columnEnd <= 14, `${layout.id}/${placement.ref} column out of bounds`);
    if (["terrain","special","number"].includes(placement.kind)) {
      assert.ok(data.assets[placement.asset], `${layout.id} missing public asset ${placement.asset}`);
    }
    if (placement.kind === "terrain") assert.ok(data.terrainCards.byAsset[placement.asset], `${layout.id} missing terrain card ${placement.asset}`);
  }
}

for (const asset of manifest.assets) {
  const publicFile = path.join(root, asset.publicPath.replace(/^assets\/conflict\//, "assets/conflict/"));
  assert.ok(fs.existsSync(publicFile), `copied asset missing: ${asset.id}`);
  const buffer = fs.readFileSync(publicFile);
  assert.strictEqual(buffer.length, asset.bytes, `size mismatch: ${asset.id}`);
  assert.strictEqual(crypto.createHash("sha256").update(buffer).digest("hex"), asset.sha256, `SHA-256 mismatch: ${asset.id}`);
}

const snapshot = id => crypto.createHash("sha256").update(JSON.stringify(data.layouts.find(layout => layout.id === id))).digest("hex");
assert.strictEqual(snapshot("sunken:M_Ratwolves:all"), "d4b929982cd74099064299a9bfb7fea576c2b8788ebc106dce17eaa76480dfea");
assert.strictEqual(snapshot("stone:M_Ratwolves:all"), "fad1cfbabc8a5d06c5b8c91e468f9285ea9b9951aaacf44296c1f212484cee0a");
assert.strictEqual(snapshot("sunken:M_Pumpkinhead:all"), "6561e4d7e22961fd7d1defc927f76af2331c02e9a5d5da31c197bc3c82b55b96");
assert.strictEqual(snapshot("stone:M_Pumpkinhead:all"), "dd7d5ebfd0e5fe42e49f218389427377499886a1e80b484c23e0004cdbd871dc");
assert.strictEqual(snapshot("sunken:M_DevilAncientDusk:1"), "90d8d08e540c7c7f39baf512efb91e640987efc5d86e8df190c33b365c01f3ce");
assert.strictEqual(snapshot("sunken:M_DevilAncientDusk:2+"), "63ce9b1c85873e8274e2f52978726604a041618df8758a662bb1899ad3bae24f");

console.log("TTS conflict import: layouts, 40 original assets, terrain and fool cards, bounds, hashes and snapshots verified");
