"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const appSource = fs.readFileSync("public/modules/encounter/app.js", "utf8").replace(/\r\n/g, "\n");
const stylesSource = fs.readFileSync("public/modules/encounter/styles.css", "utf8").replace(/\r\n/g, "\n");
const indexSource = fs.readFileSync("public/modules/encounter/index.html", "utf8");
const blockedStart = appSource.indexOf("  function isUnavailableBoardSpace(");
const blockedEnd = appSource.indexOf("\n  function spaceSymbols(", blockedStart);
const coveredStart = appSource.indexOf("  function coveredSpaces(");
const coveredEnd = appSource.indexOf("\n  function rotateAttackOffset(", coveredStart);
assert.ok(blockedStart >= 0 && blockedEnd > blockedStart, "blocked-space helper not found");
assert.ok(coveredStart >= 0 && coveredEnd > coveredStart, "movement helpers not found");

const context = {};
vm.runInNewContext(`
  const boardData = () => ({ cols: 5, rows: 3 });
  const tier = () => "mob";
  const pieceFootprint = () => 1;
  ${appSource.slice(blockedStart, blockedEnd)}
  ${appSource.slice(coveredStart, coveredEnd)}
  mobOneBlocked = isUnavailableBoardSpace(1, { cols: 5, rows: 3 }, "mob");
  mobFifteenBlocked = isUnavailableBoardSpace(15, { cols: 5, rows: 3 }, "mob");
  mobTwoBlocked = isUnavailableBoardSpace(2, { cols: 5, rows: 3 }, "mob");
  vassalOneBlocked = isUnavailableBoardSpace(1, { cols: 6, rows: 4 }, "vassal");
  moveToOne = movementAnchorForClick("1", 1, { cols: 5, rows: 3 }, 5, [], { id: "k1", space: "" });
  moveToTwo = movementAnchorForClick("2", 1, { cols: 5, rows: 3 }, 5, [], { id: "k1", space: "" });
`, context);

assert.equal(context.mobOneBlocked, true);
assert.equal(context.mobFifteenBlocked, true);
assert.equal(context.mobTwoBlocked, false);
assert.equal(context.vassalOneBlocked, false);
assert.equal(context.moveToOne, "", "movement rejects mob space 1");
assert.equal(context.moveToTwo, "2", "movement keeps normal mob spaces available");
assert.match(appSource, /isUnavailableBoardSpace\(piece\.space, savedBoard, savedTier\)/,
  "saved pieces on blocked mob spaces are removed during load");
assert.match(appSource, /unavailable \? "unavailable"/,
  "blocked spaces receive a visible unavailable state");
assert.match(appSource, /杂兵版图的 1、15 格不能放置棋子/,
  "direct movement attempts are rejected with the board rule");
assert.match(stylesSource, /\.space\.unavailable \{/,
  "blocked mob spaces have a stable visual treatment");
assert.match(indexSource, /styles\.css\?v=14/);
assert.match(indexSource, /app\.js\?v=26/);

console.log("encounter mob board: spaces 1 and 15 reject all pieces");
