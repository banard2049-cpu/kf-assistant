"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const appSource = fs.readFileSync("public/modules/encounter/app.js", "utf8").replace(/\r\n/g, "\n");
const viewSource = fs.readFileSync("public/modules/encounter/encounter-view.js", "utf8").replace(/\r\n/g, "\n");
const stylesSource = fs.readFileSync("public/modules/encounter/styles.css", "utf8").replace(/\r\n/g, "\n");
const indexSource = fs.readFileSync("public/modules/encounter/index.html", "utf8");
const start = appSource.indexOf("  function moveSelectedPieceOffBoard() {");
const end = appSource.indexOf("\n\n  function bind()", start);
assert.ok(start >= 0 && end > start, "moveSelectedPieceOffBoard function not found");

const context = {};
vm.runInNewContext(`
  const monster = { id: "m1", name: "Monster 1", space: "4" };
  const state = { selectedPiece: "monster:m1", targets: ["4", "5"] };
  const defaultSelectedPieceKey = () => "monster:m1";
  const pieceByKey = key => key === "monster:m1" ? monster : null;
  const calculatedAttackTargets = () => ["8"];
  let mutationMessage = "";
  let toastMessage = "";
  const mutate = (fn, message) => { fn(); mutationMessage = message; };
  const toast = message => { toastMessage = message; };
  ${appSource.slice(start, end)}
  firstResult = moveSelectedPieceOffBoard();
  firstSpace = monster.space;
  firstTargets = JSON.stringify(state.targets);
  firstMessage = mutationMessage;
  secondResult = moveSelectedPieceOffBoard();
  secondToast = toastMessage;
`, context);

assert.equal(context.firstResult, true);
assert.equal(context.firstSpace, "", "the selected piece leaves the board");
assert.deepEqual(JSON.parse(context.firstTargets), ["8"], "removing a monster recalculates attack range");
assert.equal(context.firstMessage, "Monster 1 移出遭遇版图");
assert.equal(context.secondResult, false, "an already removed piece is not mutated again");
assert.equal(context.secondToast, "请先选择版图上的棋子");
assert.match(viewSource, /id="boardRemoveZone" class="board-remove-zone"/,
  "the remove zone is rendered on every encounter board");
assert.match(appSource, /\$\("#boardRemoveZone"\)\?\.addEventListener\("click", moveSelectedPieceOffBoard\)/,
  "the remove zone uses the shared removal behavior");
assert.match(stylesSource, /\.board-remove-zone \{[\s\S]*?top: \.55rem;[\s\S]*?left: \.55rem;/,
  "the remove zone is anchored in the board's top-left corner");
assert.match(indexSource, /styles\.css\?v=14/);
assert.match(indexSource, /app\.js\?v=24/);

console.log("encounter remove zone: selected pieces leave the board and monster range updates");
