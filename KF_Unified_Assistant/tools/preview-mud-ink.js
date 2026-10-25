"use strict";
// Scratch preview: dump monster attack-cell ink variants to one HTML page for a browser screenshot.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = name => fs.readFileSync(path.join(root, "public/modules/encounter", name), "utf8");
const context = { window: {} };
for (const name of ["data/encounter-data.js", "encounter-brush-paths.js", "encounter-monster-ink.js", "encounter-view.js"]) {
  vm.runInNewContext(read(name), context, { filename: name });
}
const view = context.window.KFEncounterView;
const data = context.window.KF_ENCOUNTER_DATA;
const board = data.boards.vassal;
const css = fs.readFileSync(path.join(root, "public/modules/encounter/encounter-view.css"), "utf8")
  .split("\n").filter(line => /ink|board-ink/.test(line)).join("\n");

const cells = [2, 3, 4, 5, 8, 9, 10, 11];
const cases = [];
const add = (id, seeds) => seeds.forEach(seed => cases.push({ id, seed }));
add("M_KnightFen", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
add("M_Knighteater", [1, 2, 3]);
add("M_PalebloodWorms", [1, 2]);
add("M_PuppetKing", [1]);
add("M_KingLaidLow", [1]);

const cards = cases.map(({ id, seed }, index) => {
  const svg = view.renderBoardInk(new Map(), cells, board, {
    monsterInk: id, warningSeed: seed, attackFacing: 0, attackOrder: cells,
  }).replace(/^<svg /, '<svg width="600" height="400" ');
  const motif = svg.match(/data-monster-motif="([^"]+)"|data-warning-style="([^"]+)"/);
  return `<figure><figcaption>${index + 1}. ${id} seed ${seed} · ${motif ? motif[1] || motif[2] : ""}</figcaption>${svg}</figure>`;
}).join("");

fs.writeFileSync(path.join(root, "..", "output", "mud-ink-preview.html"),
  `<!doctype html><meta charset="utf-8"><style>
  body { margin: 0; padding: 16px; background: #17130f; color: #e9dcc4; font: 14px/1.4 sans-serif; }
  .grid { display: grid; grid-template-columns: repeat(3, 620px); gap: 14px; }
  figure { margin: 0; background: #0d0b09; border: 1px solid #3a2f24; padding: 6px; }
  figcaption { color: #c9a86a; font-size: 13px; margin-bottom: 4px; }
  svg { background: #1d1712; display: block; }
  ${css}
</style><div class="grid">${cards}</div>`, "utf8");
console.log("wrote tmp/mud-ink-preview.html", cases.length, "cases");
