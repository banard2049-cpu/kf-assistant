"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const publicDir = path.resolve(__dirname, "../public");
const dataDir = path.join(publicDir, "modules/encounter/data");
const manifest = JSON.parse(fs.readFileSync(path.join(dataDir, "special-encounters.json"), "utf8"));
const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(dataDir, "encounter-data.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(publicDir, "modules/encounter/encounter-view.js"), "utf8"), context);
const data = context.window.KF_ENCOUNTER_DATA;
const view = context.window.KFEncounterView;
const plain = value => JSON.parse(JSON.stringify(value));
const sorted = points => plain(points).map(point => point.join(",")).sort();

// Independently transcribed from the six printed card faces. Grid coordinates
// start at zero; a 2x2 model's origin is its upper-left black footprint cell.
const printed = {
  "0032": {
    name: "Crazed Modmaker Tree", page: 33, number: 9, tier: "dragon",
    count: 1, hit: "7+", size: 2, facing: 0, model: "M_DevilSmeltedFears",
    success: "X", positioning: "center", origin: [1, 2],
    red: [[0,2],[0,4],[0,5],[1,0],[1,1],[1,5],[2,0],[2,4],[2,5],[3,0],[3,1],[3,3]],
  },
  "0531": {
    name: "Manybody of the Junkheap", page: 34, number: 8, tier: "vassal",
    count: 1, hit: "8+", size: 2, facing: 90, model: "M_DevilSmeltedFears",
    success: 3, origin: [1, 2],
    red: [[0,1],[1,0],[1,1],[1,4],[2,1],[2,4],[2,5],[3,4]],
  },
  "0932": {
    name: "Phantasmal Workers", page: 36, number: 6, tier: "mob",
    count: 2, hit: "10+", size: 1, facing: 90, model: "M_Panzergeists",
    success: 3, origin: [2, 1], red: [[1,2],[2,2]],
  },
  "7012": {
    name: "Wretchflayer Tree", page: 44, number: 10, tier: "dragon",
    count: 1, hit: "7+", size: 2, facing: 0, model: "M_DevilSmeltedFears",
    success: "X", positioning: "center", origin: [1, 2],
    red: [[0,0],[0,2],[0,4],[0,5],[1,0],[1,1],[1,5],[2,1],[2,4],[2,5],[3,0],[3,1],[3,2],[3,4],[3,5]],
  },
  "7416": {
    name: "Fused-Flesh Goliath", page: 46, number: 9, tier: "vassal",
    count: 1, hit: "9+", size: 2, facing: 90, model: "M_DevilSmeltedFears",
    success: 3, origin: [1, 2],
    red: [[0,1],[0,3],[1,1],[1,4],[2,4],[3,1],[3,3],[3,5]],
  },
  "7912": {
    name: "Frightful Specters", page: 47, number: 7, tier: "mob",
    count: 3, hit: "11+", size: 1, facing: 90, model: "M_Panzergeists",
    success: 3, origin: [2, 1], red: [[1,2],[2,2],[2,3]],
  },
};

const specs = manifest.cards.filter(card => card.code.startsWith("TSF-"));
const monsters = data.monsters.filter(monster => monster.special?.code?.startsWith("TSF-"));
const codes = Object.keys(printed).map(cipher => `TSF-${cipher}`).sort();
assert.deepEqual(specs.map(card => card.code).sort(), codes, "all six codex source cards are present once");
assert.deepEqual(plain(monsters.map(monster => monster.special.code)).sort(), codes, "all six codex runtime cards are present once");
assert.ok(!data.monsters.some(monster => monster.id === "Special_TSF-0832"), "0832 is a Full Clash, not the Workers encounter");

for (const [cipher, expected] of Object.entries(printed)) {
  const code = `TSF-${cipher}`;
  const spec = specs.find(card => card.code === code);
  const monster = monsters.find(item => item.special.code === code);
  const special = monster.special;
  const level = monster.encounterLevels[0];
  const offsets = expected.red.map(([r, c]) => [r - expected.origin[0], c - expected.origin[1]]);

  assert.equal(monster.id, `Special_${code}`, code);
  assert.equal(monster.name, expected.name, code);
  assert.equal(spec.name, expected.name, code);
  assert.equal(monster.category, "special", code);
  assert.equal(monster.type, expected.tier === "mob" ? "mob" : "boss", code);
  assert.equal(monster.encounterLevels.length, 1, code);
  assert.equal(level.level, 1, code);
  assert.equal(level.tier, expected.tier, code);
  assert.equal(spec.tier, expected.tier, code);
  assert.equal(level.cardId, `Codex:TenThousandSucculentFears:${cipher}`, code);
  assert.equal(spec.cardId, level.cardId, code);
  assert.equal(special.scope, "campaign", code);
  assert.equal(spec.scope, "campaign", code);
  assert.equal(special.knightId, null, code + " has no knight restriction");
  assert.equal(spec.knightId, null, code);
  assert.equal(special.solo, undefined, code + " permits the whole party");
  assert.equal(special.countRange, undefined, code + " uses a fixed printed count");
  assert.equal(special.positioning, expected.positioning, code + " center placement applies only to trees");
  assert.equal(spec.positioning, expected.positioning, code);
  assert.equal(special.baseMonsterId, expected.model, code + " printed model icon");
  assert.equal(spec.baseMonsterId, expected.model, code);
  assert.equal(special.usesGenericToken, false, code);
  assert.equal(spec.usesGenericToken, false, code);
  assert.equal(monster.avatar, data.monsters.find(item => item.id === expected.model).avatar, code);
  assert.equal(level.attackPatternVerified, true, code);
  assert.deepEqual(sorted(spec.attackPattern), sorted(offsets), code + " source grid matches printed red cells");
  assert.deepEqual(sorted(level.attackPattern), sorted(offsets), code + " runtime grid matches printed red cells");
  assert.equal(spec.attackFacing, expected.facing, code);
  assert.equal(level.attackFacing, expected.facing, code);
  if (expected.size === 2) {
    // All four boss-card board diagrams show 6x4 filled cells, including the
    // two left columns that a normal vassal encounter leaves hollow.
    assert.equal(spec.boardKind, "vassal", code + " source board diagram");
    assert.deepEqual(spec.boardLockedSpaces, [], code + " source uses every printed board cell");
    assert.equal(level.boardKind, "vassal", code + " runtime uses the 6x4 boss board");
    assert.deepEqual(plain(level.boardLockedSpaces), [], code + " runtime unlocks every printed board cell");
    const board = view.boardData(data, level);
    assert.equal(view.boardKind(level), "vassal", code);
    assert.equal(board.cols, 6, code);
    assert.equal(board.rows, 4, code);
    assert.equal(Array.from({ length: 24 }, (_, i) => i + 1).filter(space => !view.isUnavailableBoardSpace(space, board, level.tier)).length, 24, code + " all 24 cells usable");
    const rendered = view.renderBoard({ data, monster, level, state: {}, interactive: false });
    const cells = [...rendered.matchAll(/<span class="space read-only ([^"]*)"/g)];
    assert.equal(cells.length, 24, code + " read-only board has 24 cells");
    assert.equal(cells.filter(cell => !/\binactive\b/.test(cell[1])).length, 24, code + " read-only board unlocks all 24 cells");
  }
  for (const [field, value] of Object.entries({ monsterCount: expected.count, monsterSize: expected.size, hit: expected.hit, success: expected.success, partial: null })) {
    assert.equal(spec[field], value, `${code} source ${field}`);
    assert.equal(level.stats[field], value, `${code} runtime ${field}`);
  }
  assert.equal(spec.shieldMark, "X", code);
  assert.deepEqual(plain(special.source), spec.source, code + " preserves source provenance");
  assert.equal(special.source.kind, "local-scan", code);
  assert.equal(special.source.bookTitle, "万种多肉恐惧", code);
  assert.equal(special.source.fileName, "万种多肉恐惧（76.pdf", code);
  assert.equal(special.source.storyCipher, cipher, code);
  assert.equal(special.source.pdfPage, expected.page, code);
  assert.equal(special.source.printedPage, expected.page - 1, code);
  assert.equal(special.source.cardNumber, expected.number, code);
  assert.match(special.source.sha256, /^[a-f0-9]{64}$/, code);
  assert.equal(special.source.dpi, 600, code);
  const [x0, y0, x1, y1] = special.source.cropPdfPoints;
  assert.ok(x0 >= 0 && y0 >= 0 && x1 > x0 && y1 > y0, code + " valid source crop");

  assert.equal(level.side, "face", code);
  assert.equal(level.image.width, 1, code);
  assert.equal(level.image.height, 1, code);
  assert.equal(level.image.index, 0, code);
  assert.match(level.image.face, new RegExp(`/assets/cards/special-encounters/${code.toLowerCase()}\\.png(?:\\?|$)`), code);
  const imagePath = path.join(publicDir, level.image.face.split("?")[0]);
  assert.ok(fs.existsSync(imagePath), code + " source-rendered card exists");
  const png = fs.readFileSync(imagePath);
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", code + " PNG signature");
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  assert.ok(width >= 1000 && height >= 1700, code + " retains source scan detail");
  assert.ok(Math.abs(width / height - level.image.aspect) < 0.0001, code + " card aspect matches PNG dimensions");
}

const normalVassal = { tier: "vassal" };
const normalBoard = view.boardData(data, normalVassal);
assert.equal(Array.from({ length: 24 }, (_, i) => i + 1).filter(space => !view.isUnavailableBoardSpace(space, normalBoard, normalVassal.tier)).length, 16, "normal vassal encounters retain their 16 usable cells");
const normalRendered = view.renderBoard({ data, level: normalVassal, state: {}, interactive: false });
const normalCells = [...normalRendered.matchAll(/<span class="space read-only ([^"]*)"/g)];
assert.equal(normalCells.length, 24, "normal vassal read-only board retains its full diagram");
assert.equal(normalCells.filter(cell => !/\binactive\b/.test(cell[1])).length, 16, "normal vassal read-only board still locks the left two columns");

console.log("codex encounters: six independent printed grids, models, counts, thresholds, source pages, scan assets and 24-cell boss boards verified");
