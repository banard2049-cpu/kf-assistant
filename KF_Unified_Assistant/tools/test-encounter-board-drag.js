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
assert.doesNotMatch(viewSource, /board\.mirror|direction:rtl|mirrorClass/,
  "board cells and footprints use image coordinates directly");

assert.match(appSource, /function bindBoardDrag\(\) \{/, "the encounter board binds pointer dragging");
assert.match(appSource, /bindBoardDrag\(\);/, "render binding starts the board drag handler");
assert.match(appSource, /event\.target\.closest\("\.piece\[data-piece\], \[data-select-piece\], \[data-select-custom-piece\], \[data-add-piece-icon\]"\)/,
  "dragging starts on a board piece or picker entry, not on an empty space");
assert.match(appSource, /window\.addEventListener\("pointermove", onMove, \{ passive: false \}\)/,
  "dragging follows the pointer");
assert.match(appSource, /piece-drag-ghost/, "dragging shows a floating copy of the piece");
assert.match(appSource, /\.space\.drop-target/, "dragging highlights the target footprint");
assert.match(appSource, /state\.selectedPiece = current\.key;/, "a dropped piece stays selected");

// Both stylesheets render 2- and 3-cell bosses from the image's top-left anchor.
for (const [name, css] of [["styles.css", stylesSource], ["encounter-view.css", boardStyles]]) {
  assert.match(css, /\.piece\.footprint-2 \{[^}]*border-radius: 50%/, `${name}: 2×2 boss is round`);
  assert.match(css, /\.piece\.footprint-3 \{[^}]*border-radius: 50%/, `${name}: 3×3 boss is round`);
  assert.doesNotMatch(css, /\.piece\.mirror/, `${name}: no reversed footprint styles remain`);
  assert.match(css, /\.piece-drag-ghost \{/, `${name}: drag ghost has stable styling`);
  assert.match(css, /\.space\.drop-target \{/, `${name}: drop target has a visible state`);
  assert.match(css, /\.piece \{[^}]*pointer-events: auto/, `${name}: pieces receive pointer input`);
}

for (const file of ["encounter-view.css", "encounter-view.js"]) {
  const version = source => source.match(new RegExp(`${file.replace(".", "\\.")}\\?v=(\\d+)`))?.[1];
  assert.ok(version(indexSource), `${file} has a cache version`);
  assert.equal(version(indexSource), version(displayIndex), `second screen uses the same ${file} version`);
}
assert.match(indexSource, /styles\.css\?v=\d+/, "encounter stylesheet has a cache version");
assert.match(indexSource, /app\.js\?v=\d+/, "encounter app has a cache version");

const coveredStart = appSource.indexOf("  function coveredSpaces(");
const coveredEnd = appSource.indexOf("\n  function movementAnchorForClick(", coveredStart);
const dragStart = appSource.indexOf("  function boardCellFromPoint(");
const dragEnd = appSource.indexOf("\n  function bindBoardDrag(", dragStart);
assert.ok(coveredStart >= 0 && coveredEnd > coveredStart, "coveredSpaces function not found");
assert.ok(dragStart >= 0 && dragEnd > dragStart, "drag geometry helpers not found");

const context = {};
vm.runInNewContext(`
  const board = { cols: 6, rows: 4 };
  const blockedSpaces = new Set([1, 2, 7, 8, 13, 14, 19, 20]);
  const boardData = () => board;
  const isUnavailableBoardSpace = space => blockedSpaces.has(Number(space));
  const pieceFootprint = piece => piece.kind === "monster" ? 2 : 1;
  const grid = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 400 }) };
  ${appSource.slice(coveredStart, coveredEnd)}
  ${appSource.slice(dragStart, dragEnd)}
  column5 = boardCellFromPoint(450, 50, grid);
  column1 = boardCellFromPoint(50, 50, grid);
  bossAnchor = dragAnchorFor(350, 150, 2, board, [], "boss", grid);
  bossCovered = coveredSpaces(bossAnchor, 2, board);
  bossHovered = boardCellFromPoint(350, 150, grid);
  blockedByBoss = dragAnchorFor(350, 50, 1, board, [{ id: "boss", space: "3", kind: "monster" }], "knight", grid);
  inactiveColumn = dragAnchorFor(50, 50, 1, board, [], "knight", grid);
  blockedSpaces.add(3);
  blockedSpace = dragAnchorFor(250, 50, 1, board, [], "knight", grid);
`, context);

assert.equal(context.column5, 5, "image column five is cell five");
assert.equal(context.column1, 1, "the image's leftmost column is column one");
assert.equal(context.bossAnchor, "10", "a 2×2 boss snaps around the cell under the pointer");
assert.deepEqual(Array.from(context.bossCovered), [10, 11, 16, 17], "the boss footprint stays square on the board");
assert.ok(context.bossCovered.includes(context.bossHovered), "the boss always covers the cell under the pointer");
assert.equal(context.blockedByBoss, "", "a knight cannot be dropped onto a boss footprint");
assert.equal(context.inactiveColumn, "", "pieces cannot be dropped on the dimmed columns");
assert.equal(context.blockedSpace, "", "pieces cannot be dropped on a blocked board space");

console.log("encounter board drag: boss and knight pieces drag by pointer, multi-cell bosses are round and aligned");
