"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync("public/modules/encounter/encounter-view.js", "utf8");
const context = { window: {} };
vm.runInNewContext(source, context);
const topology = {};
vm.runInNewContext(source.slice(source.indexOf("  function inkRegions("), source.indexOf("  const inkNoise"))
  + "\nthis.regions = inkRegions; this.loops = inkBoundaryLoops;", topology);
const plain = value => JSON.parse(JSON.stringify(value));
assert.deepEqual(plain(topology.regions([1, 2, 7], 6)), [[1, 2, 7]], "edge-connected cells share one outline");
assert.deepEqual(plain(topology.regions([1, 8], 6)), [[1], [8]], "diagonal contacts stay separate");
assert.deepEqual(plain(topology.regions([6, 7], 6)), [[6], [7]], "row wrapping never creates a connected region");
const rectangle = plain(topology.loops([1, 2], 6));
assert.equal(rectangle.length, 1);
assert.equal(rectangle[0].length, 6, "two adjacent cells have six outer unit edges, with no shared internal edge");
const concave = plain(topology.loops([1, 2, 7], 6));
assert.equal(concave.length, 1);
assert.equal(concave[0].length, 8, "L shapes trace the concave perimeter");
const ring = plain(topology.loops([1, 2, 3, 7, 9, 13, 14, 15], 6));
assert.equal(ring.length, 2, "an unselected hole is preserved");
assert.deepEqual(ring.map(loop => loop.length).sort((a, b) => a - b), [4, 12]);

// Exhaust every 3x3 subset and check that every painted edge borders an unselected cell.
for (let mask = 1; mask < 512; mask++) {
  const cells = Array.from({ length: 9 }, (_, i) => i + 1).filter(cell => mask & (1 << (cell - 1)));
  const selected = new Set(cells), expected = new Set();
  for (const cell of cells) {
    const x = (cell - 1) % 3, y = Math.floor((cell - 1) / 3);
    if (!selected.has(cell - 3)) expected.add(`${x},${y}>${x + 1},${y}`);
    if (x === 2 || !selected.has(cell + 1)) expected.add(`${x + 1},${y}>${x + 1},${y + 1}`);
    if (!selected.has(cell + 3)) expected.add(`${x + 1},${y + 1}>${x},${y + 1}`);
    if (!x || !selected.has(cell - 1)) expected.add(`${x},${y + 1}>${x},${y}`);
  }
  const actual = [];
  for (const region of topology.regions(cells, 3)) for (const loop of topology.loops(region, 3)) {
    loop.forEach((point, i) => actual.push(`${point.join(",")}>${loop[(i + 1) % loop.length].join(",")}`));
  }
  assert.equal(actual.length, expected.size, `mask ${mask}: no repeated or missing edges`);
  assert.deepEqual(new Set(actual), expected, `mask ${mask}: no internal edges or jumps`);
}

const view = context.window.KFEncounterView;
const board = { cols: 3, rows: 3, width: 300, height: 300, spaces: [{ sword: 1 }, { cup: 1 }, {}, {}, {}, {}, {}, {}, {}] };
const options = {
  board, level: { tier: "mob" }, data: { dice: { faces: [{ id: "s", match: { sword: 1 } }, { id: "c", match: { cup: 1 } }] } },
  state: { phase: "position", selectedPiece: "monster:m", monsters: [{ id: "m", space: "9", rolls: ["s", "c"] }], targets: ["4", "5", "7"] }
};
for (const interactive of [true, false]) {
  const html = view.renderBoard({ ...options, interactive });
  assert.match(html, /data-ink-layer="match" data-ink-kind="1" data-ink-cells="1"/, "first die has its own outline");
  assert.match(html, /data-ink-layer="match" data-ink-kind="2" data-ink-cells="2"/, "adjacent different colors keep separate outlines");
  assert.match(html, /class="ink-1"/);
  assert.match(html, /class="ink-2"/);
  assert.match(html, /data-ink-layer="attack" data-ink-kind="attack" data-ink-cells="4,5,7"/);
  assert.match(html, /data-warning-style="mixed"/, "attacks default to the handwritten warning mix");
  const attack = html.slice(html.indexOf('data-ink-layer="attack"'));
  assert.doesNotMatch(attack, /data-ink-style=/, "attack warnings never use the random cursive fill");
  assert.match(html, /data-ink-style="(?:fold|sweep|loops|signature|wave)"/, "cells use a mix of cursive pen paths");
  assert.match(html, /clip-rule="evenodd"/, "hatching is clipped to the region and leaves holes clear");
  assert.match(html, /class="ink-outline"/, "the outline is a varying-width brush ribbon");
  assert.match(html, /class="ink-hatching"/);
  assert.ok(!/NaN|Infinity/.test(html));
}
const sameColor = { ...options, board: { ...board, spaces: [{ sword: 1 }, { sword: 1 }, {}, {}, {}, {}, {}, {}, {}] } };
assert.match(view.renderBoard(sameColor), /data-ink-layer="match" data-ink-kind="1" data-ink-cells="1,2"/, "adjacent cells of the same color share one outer outline");
const first = view.renderBoard(options), second = view.renderBoard(options);
assert.notEqual(first.match(/id="(encounter-ink-[^"]+)"/)[1], second.match(/id="(encounter-ink-[^"]+)"/)[1], "each board has unique SVG clip IDs");
assert.equal(first.match(/class="ink-outline" d="([^"]+)"/)[1], second.match(/class="ink-outline" d="([^"]+)"/)[1], "brush strokes stay steady across rerenders");
const hatches = html => [...html.matchAll(/data-ink-style="[^"]+" data-ink-cell="[^"]+" d="([^"]+)"/g)].map(match => match[1]);
assert.deepEqual(hatches(first), hatches(second), "individual hand-drawn hatches stay steady across rerenders");
assert.equal(new Set(hatches(first)).size, hatches(first).length, "each hatch has its own pen path");
const fullBoard = { ...board, cols: 9, rows: 5, spaces: Array.from({ length: 45 }, () => ({ sword: 1 })) };
const full = view.renderBoard({ ...options, board: fullBoard });
const styles = [...full.matchAll(/data-ink-style="([^"]+)"/g)].map(match => match[1]);
assert.ok(new Set(styles).size >= 5, "random mixing supplies all five pen families across a large board");
assert.ok(!/NaN|Infinity/.test(full), "all pen geometry stays finite on the dragon board");
const cellInk = (html, cell) => [...html.matchAll(new RegExp(`data-ink-style="[^"]+" data-ink-cell="${cell}" d="([^"]+)"`, "g"))].map(match => match[1]);
const withoutNeighbor = view.renderBoard({ ...sameColor, board: { ...sameColor.board, spaces: [{ sword: 1 }, {}, {}, {}, {}, {}, {}, {}, {}] } });
assert.deepEqual(cellInk(view.renderBoard(sameColor), 1), cellInk(withoutNeighbor, 1), "a cell keeps its pen path when the neighboring region changes");
const singleton = view.renderBoardInk(new Map(), [4], board, { attackStyle: "urgent" });
assert.match(singleton, /data-warning-text="危"/);
const vertical = Array.from({ length: 24 }, (_, index) => view.renderBoardInk(new Map(), [1,4], board,
  { attackStyle: "vertical", warningSeed: index + 1 })).find(html => html.includes('data-warning-punctuation="surround"'));
assert.match(vertical, /data-warning-text="危险" data-warning-kind="word" data-warning-axis="vertical" data-warning-cells="1,4"/);
const boxes = [...vertical.matchAll(/data-warning-glyph="[危险]" data-warning-hand="[^"]+" data-warning-box="([^"]+)"/g)].map(match => match[1].split(",").map(Number));
assert.equal(boxes.length, 2);
assert.equal(boxes[0][0], boxes[1][0], "vertical words use the same x axis independently of punctuation");
assert.deepEqual(boxes[0].slice(2), boxes[1].slice(2), "vertical characters keep identical sizes");
assert.equal(boxes[1][1] - boxes[0][1], 100, "two-cell vertical words use a constant cell pitch");
for (const side of ["left", "right", "top", "bottom"]) assert.match(vertical, new RegExp(`data-warning-side="${side}"`));
for (const mode of ["urgent", "doom", "vertical", "bang", "mixed"]) {
  const warning = view.renderBoardInk(new Map(), [1,2,3,4,6,7,8,9], board, { attackStyle: mode });
  assert.match(warning, new RegExp(`data-warning-style="${mode}"`));
  const allocated = [...warning.matchAll(/data-warning-cells="([^"]+)"/g)].flatMap(match => match[1].split(",").map(Number));
  assert.deepEqual(allocated.sort((a,b)=>a-b), [1,2,3,4,6,7,8,9], "warning labels cover selected cells once and leave the hole clear");
  assert.ok(!/NaN|Infinity/.test(warning));
}
const words = new Set(), kinds = new Set(), hands = new Set(), angles = new Set(), dangerPaths = new Set(), punctuation = new Set();
for (let batch = 1; batch <= 24; batch++) {
  for (const cells of [[1], [2], [1,2], [1,2,3], [1,4,7]]) {
    const warning = view.renderBoardInk(new Map(), cells, board, { warningSeed: batch });
    for (const match of warning.matchAll(/data-warning-text="([^"]+)"/g)) words.add(match[1]);
    for (const match of warning.matchAll(/data-warning-kind="([^"]+)"/g)) kinds.add(match[1]);
    for (const match of warning.matchAll(/data-warning-punctuation="([^"]+)"/g)) punctuation.add(match[1]);
    for (const match of warning.matchAll(/data-warning-hand="([^"]+)"/g)) hands.add(match[1]);
    for (const match of warning.matchAll(/data-warning-angle="([^"]+)"/g)) angles.add(Math.round(Number(match[1]) / 30));
    for (const match of warning.matchAll(/data-warning-glyph="危"[^>]+><path d="([^"]+)"/g)) dangerPaths.add(match[1]);
    if (cells.length === 1 && warning.includes('data-warning-kind="fill"')) {
      const boxes = [...warning.matchAll(/data-warning-glyph="!" data-warning-hand="[^"]+" data-warning-box="([^"]+)"/g)].map(match => match[1].split(",").map(Number));
      assert.ok(boxes.length >= 5 && boxes.length <= 6, "a punctuation collage uses five or six marks instead of a nine-cell grid");
      const sizes = boxes.map(box => box[2]);
      assert.ok(Math.max(...sizes) / Math.min(...sizes) > 1.8, "collages combine visibly different punctuation sizes");
      const centers = boxes.map(box => [box[0] + box[2] / 2, box[1] + box[3] / 2]);
      assert.ok(new Set(centers.map(point => point[0].toFixed(1))).size >= 4, "collage marks do not form aligned columns");
      assert.ok(new Set(centers.map(point => point[1].toFixed(1))).size >= 4, "collage marks do not form aligned rows");
    }
  }
}
assert.deepEqual([...kinds].sort(), ["fill", "letter", "shout", "word"]);
assert.deepEqual([...hands].sort(), ["note", "round", "running"]);
assert.deepEqual([...punctuation].sort(), ["bookends", "surround"], "large paired exclamation marks remain in the random mix");
for (const cells of [[1,2], [1,4], [1,2,3], [1,4,7]]) {
  let paired;
  for (let batch = 1; batch <= 24 && !paired; batch++) {
    const html = view.renderBoardInk(new Map(), cells, board, { attackStyle: "urgent", warningSeed: batch });
    if (html.includes('data-warning-punctuation="bookends"')) paired = html;
  }
  assert.ok(paired, "both horizontal and vertical warning words can have paired large punctuation");
  assert.equal([...paired.matchAll(/data-warning-side="(?:before|after)"/g)].length, 2, "exactly one large exclamation mark goes before and after the word");
  const punctuationBoxes = [...paired.matchAll(/data-warning-glyph="!" data-warning-hand="[^"]+" data-warning-box="([^"]+)"/g)].map(match => match[1].split(",").map(Number));
  assert.ok(punctuationBoxes.every(box => box[2] === 72 && box[3] === 72), "paired punctuation retains its large size");
  const letterBoxes = [...paired.matchAll(/data-warning-glyph="[^!]" data-warning-hand="[^"]+" data-warning-box="([^"]+)"/g)].map(match => match[1].split(",").map(Number));
  assert.ok(letterBoxes.every(box => box[2] >= 54 && box[3] >= 54), "large punctuation leaves readable character sizes");
  if (cells[1] - cells[0] === board.cols) assert.ok(letterBoxes.every(box => box[0] === letterBoxes[0][0]), "paired punctuation preserves the vertical text axis");
}
for (const word of ["危", "危险", "死", "!", "!!!", "禁止入内", "此面向敌"]) assert.ok(words.has(word), `warning mix includes ${word}`);
assert.ok(angles.size >= 6, "punctuation uses horizontal, vertical, reversed and diagonal rotations");
assert.ok(dangerPaths.size >= 8, "the same character has multiple actual pen paths");
const warningMarkup = html => html.replace(/encounter-ink-\d+/g, "encounter-ink-stable");
assert.equal(warningMarkup(view.renderBoardInk(new Map(), [1,2,3,4,6,7,8,9], board)),
  warningMarkup(view.renderBoardInk(new Map(), [1,2,3,4,6,7,8,9], board)), "warning mix stays stable across rerenders");
for (let mask = 1; mask < 512; mask++) {
  const selected = Array.from({ length: 9 }, (_, index) => index + 1).filter(cell => mask & (1 << (cell - 1)));
  const warning = view.renderBoardInk(new Map(), selected, board);
  const allocated = [...warning.matchAll(/data-warning-cells="([^"]+)"/g)].flatMap(match => match[1].split(",").map(Number));
  assert.deepEqual(allocated.sort((a,b)=>a-b), selected, `warning ${mask}: no text allocated outside the selected shape`);
}
console.log("encounter ink: 511 shapes, aligned vertical words, seven warning contents, three hand families, rotated punctuation and stable rendering verified");
