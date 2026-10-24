"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const appSource = fs.readFileSync("public/modules/encounter/app.js", "utf8").replace(/\r\n/g, "\n");
const viewSource = fs.readFileSync("public/modules/encounter/encounter-view.js", "utf8").replace(/\r\n/g, "\n");
const stylesSource = fs.readFileSync("public/modules/encounter/styles.css", "utf8").replace(/\r\n/g, "\n");
const boardStyles = fs.readFileSync("public/modules/encounter/encounter-view.css", "utf8").replace(/\r\n/g, "\n");
const indexSource = fs.readFileSync("public/modules/encounter/index.html", "utf8");
const displayIndex = fs.readFileSync("public/modules/display/index.html", "utf8");

// Every board piece exposes its state key, so pointer handling can resolve the dragged piece.
assert.match(viewSource, /data-piece="\$\{pieceKey\}"/, "board pieces expose a draggable piece key");
assert.match(viewSource, /board\.mirror && footprint > 1 \? " mirror" : ""/,
  "multi-cell footprints know when the board columns are mirrored");

assert.match(appSource, /function bindBoardDrag\(\) \{/, "the encounter board binds pointer dragging");
assert.match(appSource, /bindBoardDrag\(\);/, "render binding starts the board drag handler");
assert.match(appSource, /event\.target\.closest\("\.piece\[data-piece\]"\)/,
  "dragging starts on a board piece, not on an empty space");
assert.match(appSource, /window\.addEventListener\("pointermove", onMove, \{ passive: false \}\)/,
  "dragging follows the pointer");
assert.match(appSource, /piece-drag-ghost/, "dragging shows a floating copy of the piece");
assert.match(appSource, /\.space\.drop-target/, "dragging highlights the target footprint");
assert.match(appSource, /state\.selectedPiece = current\.key;/, "a dropped piece stays selected");

// Both stylesheets render 2- and 3-cell bosses as circles and mirror their footprint.
for (const [name, css] of [["styles.css", stylesSource], ["encounter-view.css", boardStyles]]) {
  assert.match(css, /\.piece\.footprint-2 \{[^}]*border-radius: 50%/, `${name}: 2×2 boss is round`);
  assert.match(css, /\.piece\.footprint-3 \{[^}]*border-radius: 50%/, `${name}: 3×3 boss is round`);
  assert.match(css, /\.piece\.mirror \{ left: auto; right: 7%; \}/,
    `${name}: mirrored footprints grow leftwards from their anchor`);
  assert.match(css, /\.piece-drag-ghost \{/, `${name}: drag ghost has stable styling`);
  assert.match(css, /\.space\.drop-target \{/, `${name}: drop target has a visible state`);
  assert.match(css, /\.piece \{[^}]*pointer-events: auto/, `${name}: pieces receive pointer input`);
}

assert.match(indexSource, /encounter-view\.css\?v=5/, "encounter view stylesheet cache version is updated");
assert.match(indexSource, /encounter-view\.js\?v=10/, "encounter view script cache version is updated");
assert.match(indexSource, /styles\.css\?v=19/, "encounter stylesheet cache version is updated");
assert.match(indexSource, /app\.js\?v=33/, "encounter app cache version is updated");
assert.match(displayIndex, /encounter-view\.css\?v=5/, "second screen uses the updated view stylesheet");
assert.match(displayIndex, /encounter-view\.js\?v=10/, "second screen uses the updated view script");

const coveredStart = appSource.indexOf("  function coveredSpaces(");
const coveredEnd = appSource.indexOf("\n  function movementAnchorForClick(", coveredStart);
const dragStart = appSource.indexOf("  function boardCellFromPoint(");
const dragEnd = appSource.indexOf("\n  function bindBoardDrag(", dragStart);
assert.ok(coveredStart >= 0 && coveredEnd > coveredStart, "coveredSpaces function not found");
assert.ok(dragStart >= 0 && dragEnd > dragStart, "drag geometry helpers not found");

const context = {};
vm.runInNewContext(`
  let board = { cols: 6, rows: 4, mirror: true };
  const blockedSpaces = new Set();
  const boardData = () => board;
  const isUnavailableBoardSpace = space => blockedSpaces.has(Number(space));
  const pieceFootprint = piece => piece.kind === "monster" ? 2 : 1;
  const grid = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 400 }) };
  ${appSource.slice(coveredStart, coveredEnd)}
  ${appSource.slice(dragStart, dragEnd)}
  mirroredColumn4 = boardCellFromPoint(450, 50, grid);
  mirroredColumn0 = boardCellFromPoint(50, 50, grid);
  board = { cols: 6, rows: 4, mirror: false };
  plainColumn4 = boardCellFromPoint(450, 50, grid);
  board = { cols: 6, rows: 4, mirror: true };
  bossAnchor = dragAnchorFor(350, 150, 2, 4, board, [], "boss", grid);
  bossCovered = coveredSpaces(bossAnchor, 2, board);
  bossHovered = boardCellFromPoint(350, 150, grid);
  blockedByBoss = dragAnchorFor(250, 50, 1, 4, board, [{ id: "boss", space: "3", kind: "monster" }], "knight", grid);
  inactiveColumn = dragAnchorFor(50, 50, 1, 4, board, [], "knight", grid);
  blockedSpaces.add(3);
  blockedSpace = dragAnchorFor(350, 50, 1, 4, board, [], "knight", grid);
`, context);

assert.equal(context.mirroredColumn4, 2, "mirrored boards map the visual column back to its space number");
assert.equal(context.mirroredColumn0, 6, "mirrored boards start numbering on the visual right");
assert.equal(context.plainColumn4, 5, "unmirrored boards number columns left to right");
assert.equal(context.bossAnchor, "9", "a 2×2 boss snaps around the cell under the pointer");
assert.deepEqual(Array.from(context.bossCovered), [9, 10, 15, 16], "the boss footprint stays square on the board");
assert.ok(context.bossCovered.includes(context.bossHovered), "the boss always covers the cell under the pointer");
assert.equal(context.blockedByBoss, "", "a knight cannot be dropped onto a boss footprint");
assert.equal(context.inactiveColumn, "", "pieces cannot be dropped on the dimmed columns");
assert.equal(context.blockedSpace, "", "pieces cannot be dropped on a blocked board space");

console.log("encounter board drag: boss and knight pieces drag by pointer, multi-cell bosses are round and aligned");
