"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const appSource = fs.readFileSync("public/modules/encounter/app.js", "utf8").replace(/\r\n/g, "\n");
const stylesSource = fs.readFileSync("public/modules/encounter/styles.css", "utf8");
const indexSource = fs.readFileSync("public/modules/encounter/index.html", "utf8");
const start = appSource.indexOf("  function positionPieceEntries(");
const end = appSource.indexOf("\n  function selectedPositionItem(", start);
assert.ok(start >= 0 && end > start, "positionPieceEntries function not found");

const helperSource = appSource.slice(start, end);
const context = {};
vm.runInNewContext(`
  let tierValue = "mob";
  const tier = () => tierValue;
  const state = {
    encounterType: "normal",
    dragonRoarDone: false,
    monsters: [{ id: "m1" }, { id: "m2" }],
    knights: [{ id: "k1" }, { id: "k2" }]
  };
  ${helperSource}
  normal = positionPieceEntries().map(entry => entry.key);
  state.encounterType = "ambush";
  ambush = positionPieceEntries().map(entry => entry.key);
  tierValue = "dragon";
  state.dragonRoarDone = true;
  dragonReposition = positionPieceEntries().map(entry => entry.key);
`, context);

assert.deepEqual(Array.from(context.normal), ["monster:m1", "monster:m2", "knight:k1", "knight:k2"]);
assert.deepEqual(Array.from(context.ambush), ["knight:k1", "knight:k2", "monster:m1", "monster:m2"]);
assert.deepEqual(Array.from(context.dragonReposition), ["knight:k1", "knight:k2"]);

assert.doesNotMatch(appSource, /id="selectedPiece"/, "placement model dropdown is removed");
assert.doesNotMatch(appSource, /\$\("#selectedPiece"\)/, "placement logic no longer depends on the dropdown");
assert.match(appSource, /data-select-piece=/, "every placement avatar exposes a selection action");
assert.match(appSource, /\$\$\("\[data-select-piece\]"\)/, "avatar selection has a click handler");
assert.match(appSource, /state\.selectedPiece = pieceChoices\[0\]\?\.key \|\| ""/, "first visible piece is selected by default");
assert.match(stylesSource, /\.placement-piece-picker\s*\{/, "piece picker has a stable responsive layout");
assert.match(stylesSource, /\.placement-piece-option\.selected\s*\{/, "selected piece has a visible state");
assert.match(appSource, /const memberDisplayName = item =>/, "squire names are reduced to the Chinese display name");
const helperStart = appSource.indexOf("const isSquireMember");
const helperEnd = appSource.indexOf("const memberOptions", helperStart);
const nameContext = {};
vm.runInNewContext(`${appSource.slice(helperStart, helperEnd)}
  result = [
    memberDisplayName({ memberType: "squire", name: "巴尔托什 · Bartos（侍从）" }),
    memberDisplayName({ memberType: "squire", name: "凯莉娅 · Caelia（侍从）" }),
    memberDisplayName({ memberType: "knight", name: "石面 · Stoneface" })
  ];`, nameContext);
assert.deepEqual(Array.from(nameContext.result), ["巴尔托什", "凯莉娅", "石面 · Stoneface"], "squire names drop English and 侍从; knight names stay unchanged");
assert.doesNotMatch(appSource, /item\.memberType === "squire" \? "侍从" : "骑士"/, "squire cards no longer print the 侍从 type label");
assert.match(appSource, /const meta = \[kindLabel, position\]\.filter\(Boolean\)\.join\(" · "\)/, "squire card meta falls back to the position only");
assert.match(indexSource, /styles\.css\?v=\d+/, "encounter stylesheet cache version is updated");
assert.match(indexSource, /data-original-app="app\.js\?v=\d+"/, "encounter app has a cache version");

console.log("encounter placement piece picker assertions passed");
