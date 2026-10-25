"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = file => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const context = { window: {} };
vm.runInNewContext(source("public/modules/encounter/data/encounter-data.js"), context);
vm.runInNewContext(source("public/modules/encounter/encounter-view.js"), context);
const data = context.window.KF_ENCOUNTER_DATA;
const view = context.window.KFEncounterView;
const plain = value => JSON.parse(JSON.stringify(value));

// Transcribed from the three board images, reading each row visually left to right.
// S = sword, C = cup, _ = no symbols (including the two unusable mob corners).
const printedRows = {
  mob: ["_ C SS SC _", "SC S _ C SS", "C SS SC S _"],
  vassal: ["C SS C S SC _", "SC S SC C _ SS", "C SC _ SS S SC", "_ S SS SC C S"],
  dragon: [
    "_ SCCC SC _ SSSCC SCC SC _ _",
    "SCC _ _ _ C S _ SS SSC",
    "SSCCC _ S SS _ _ C _ _",
    "_ C _ _ _ SS S _ SCCC",
    "_ SSSCC SC SSCCC SSC _ SC _ _"
  ]
};
const symbolsFor = text => {
  const result = {};
  const swords = [...text].filter(symbol => symbol === "S").length;
  const cups = [...text].filter(symbol => symbol === "C").length;
  if (swords) result.sword = swords;
  if (cups) result.cup = cups;
  return result;
};
for (const [kind, rows] of Object.entries(printedRows)) {
  const board = data.boards[kind];
  const expected = rows.flatMap(row => {
    const cells = row.split(" ");
    return cells.map(symbolsFor);
  });
  assert.deepEqual(plain(board.spaces), expected, `${kind}: every cell matches the printed artwork`);
  assert.deepEqual(plain(data.boards.all.find(item => item.src === board.src).spaces), expected,
    `${kind}: fallback catalog agrees with the named board`);
}

const app = source("public/modules/encounter/app.js");
const between = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));
const matcherContext = { DATA: data };
vm.runInNewContext(`
  ${between("  const RED_DIE_FACES", "\n  const KEY")}
  ${between("  function faceMatchesSpace(", "\n  function positionPieceEntries(")}
  this.matches = faceMatchesSpace;
  this.whiteFaces = DRAGON_DIE_FACES;
`, matcherContext);
assert.equal(matcherContext.whiteFaces[0].match.sword, 3, "white face artwork has three swords");
assert.equal(matcherContext.whiteFaces[0].label, "三剑＋双杯");

// Test the real renderer as well as the app helper. Extra swords/cups must not
// match, and Hope-only dice match blank spaces after ignoring their Hope symbol.
const allFaces = [...data.dice.faces, ...matcherContext.whiteFaces];
for (const tier of ["mob", "vassal", "king", "devil", "dragon"]) {
  const board = data.boards[["king", "devil"].includes(tier) ? "vassal" : tier];
  for (const face of allFaces) {
    const state = { phase: "position", selectedPiece: "knight:test", knights: [{ id: "test", roll: face.id }] };
    const html = view.renderBoard({ state, data, level: { tier }, board });
    const actual = [...html.matchAll(/<button class="space ([^"]*)" data-space="(\d+)"/g)]
      .filter(([, classes]) => classes.split(" ").includes("match"))
      .map(([, , number]) => Number(number));
    const expected = board.spaces.flatMap((symbols, index) => {
      const exact = ["sword", "cup"].every(key => (symbols[key] || 0) === (face.match[key] || 0));
      assert.equal(matcherContext.matches(face.id, symbols), exact, `${face.id}: app matcher at ${tier} ${index + 1}`);
      return exact && !view.isUnavailableBoardSpace(index + 1, board, tier) ? [index + 1] : [];
    });
    assert.deepEqual(actual, plain(expected), `${tier} ${face.id}: renderer highlights exactly the active matching cells`);
  }
}
assert.equal(matcherContext.matches("unknown-face", {}), false);
assert.equal(matcherContext.matches("sword", { sword: 2 }), false);
assert.equal(matcherContext.matches("sword", { sword: 1, cup: 1 }), false);
assert.equal(matcherContext.matches("dragon-double-sword-double-cup", { sword: 3, cup: 2 }), true);

// The printed Help action gives Opening for swords and Break for cups.
const helpContext = {
  state: { knights: [{ id: "k", name: "Knight", space: "1" }], pool: { opportunity: 0, break: 0 } },
  spaceSymbols: () => ({ sword: 3, cup: 2 }),
  mutate: fn => fn(), finishMemberActionIfReady: () => {}
};
vm.runInNewContext(`${between("  function helpKnight(", "\n  function showAttack(")}\nhelpKnight("k");`, helpContext);
assert.deepEqual(helpContext.state.pool, { opportunity: 3, break: 2 });
assert.equal(helpContext.state.knights[0].done, true);
console.log("encounter symbols: 84 board cells, exact face highlights for all tiers, white face and Help verified");
