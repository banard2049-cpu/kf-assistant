"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const appSource = fs.readFileSync("public/modules/encounter/app.js", "utf8").replace(/\r\n/g, "\n");
const stylesSource = fs.readFileSync("public/modules/encounter/styles.css", "utf8");
const indexSource = fs.readFileSync("public/modules/encounter/index.html", "utf8");
const start = appSource.indexOf("  function setPlacementRoll(");
const end = appSource.indexOf("\n  function tier(", start);
assert.ok(start >= 0 && end > start, "setPlacementRoll function not found");

const helperSource = appSource.slice(start, end);
const context = {};
vm.runInNewContext(`${helperSource};
  knight = { roll: "old", space: "8", facing: 90 };
  knightResult = setPlacementRoll(knight, "knight", 0, "new");
  monster = { roll: "first", rolls: ["first", "second"], space: "4" };
  monsterSecondResult = setPlacementRoll(monster, "monster", 1, "new-second");
  monsterAfterSecond = JSON.stringify(monster);
  monsterFirstResult = setPlacementRoll(monster, "monster", 0, "new-first");
  missingResult = setPlacementRoll(null, "knight", 0, "new");
`, context);

assert.equal(context.knightResult, true);
assert.deepEqual(JSON.parse(JSON.stringify(context.knight)), { roll: "new", space: "8", facing: 90 });
assert.equal(context.monsterSecondResult, true);
assert.deepEqual(JSON.parse(context.monsterAfterSecond), { roll: "first", rolls: ["first", "new-second"], space: "4" });
assert.equal(context.monsterFirstResult, true);
assert.deepEqual(JSON.parse(JSON.stringify(context.monster)), { roll: "new-first", rolls: ["new-first", "new-second"], space: "4" });
assert.equal(context.missingResult, false);

assert.match(appSource, /data-reroll-die=/, "die face has a reroll action");
assert.match(appSource, /\$\$\("\[data-reroll-die\]"\)/, "reroll action has a click handler");
assert.match(appSource, /setPlacementRoll\(item, type, index, roll\(type\)\)/, "click rerolls only the selected die with the correct die type");
assert.match(stylesSource, /\.die-result\s*\{/, "clickable die has stable button styling");
assert.match(indexSource, /app\.js\?v=24/, "encounter app cache version is updated");

console.log("encounter die reroll assertions passed");
