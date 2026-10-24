"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const read = name => fs.readFileSync(`public/modules/encounter/${name}`, "utf8");
const plain = value => JSON.parse(JSON.stringify(value));
const storage = new Map();
const elements = new Map();
const context = vm.createContext({
  window: { addEventListener() {}, KF_CAMPAIGN_PARTY: [{ id: "sheet-1", knightId: "ser-sonch", name: "Sonch", type: "knight" }] },
  document: {
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, { addEventListener() {}, innerHTML: "", textContent: "" });
      return elements.get(selector);
    },
    querySelectorAll: () => []
  },
  localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
  setTimeout: () => 0, clearTimeout() {}
});
for (const file of ["data/encounter-data.js", "encounter-catalog.js", "encounter-view.js"]) vm.runInContext(read(file), context);
const app = read("app.js");
const end = app.lastIndexOf("  renderApp();");
assert.ok(end > 0);
vm.runInContext(app.slice(0, end) + `
  window.testEncounter = { addCustomPiece, handleSpace, moveSelectedPieceOffBoard, undo, customPieceControls, save,
    set(value) { state = normalize(value); }, get() { return state; } };
})();`, context);
const runtime = context.window.testEncounter;
const view = context.window.KFEncounterView;
const mob = context.window.KF_ENCOUNTER_DATA.monsters.find(monster => monster.encounterLevels.some(level => level.tier === "mob"));
const mobLevel = mob.encounterLevels.find(level => level.tier === "mob");
const initial = { ...plain(runtime.get()), monsterId: mob.id, level: mobLevel.level, phase: "position", selectedPiece: "", monsters: [] };
runtime.set(initial);

assert.equal(view.pieceIcons[0].id, "monkey", "the monkey is the first palette choice");
assert.equal(runtime.addCustomPiece("", "monkey"), true);
const monkeyId = runtime.get().customPieces[0].id;
assert.equal(runtime.get().selectedPiece, `custom:${monkeyId}`);
runtime.handleSpace("1");
assert.equal(runtime.get().customPieces[0].space, "", "icons respect blocked board cells");
runtime.handleSpace("2");
assert.equal(runtime.get().customPieces[0].space, "2");
runtime.handleSpace("3");
assert.equal(runtime.get().customPieces[0].space, "3", "a placed icon can move to another cell");
runtime.undo();
assert.equal(runtime.get().customPieces[0].space, "2", "undo restores the icon's previous cell");
assert.equal(runtime.get().customPieces[0].iconId, "monkey", "undo preserves the icon identity");
runtime.addCustomPiece("", "monkey");
assert.equal(runtime.get().customPieces.length, 1, "Little Ser is a single companion token");

assert.equal(runtime.addCustomPiece("", "token-04"), true);
runtime.handleSpace("2");
assert.equal(runtime.get().customPieces[1].space, "2", "Little Ser does not block another token's placement");
assert.equal(runtime.get().customPieces[0].space, "3", "Little Ser moves to the nearest legal empty cell");
runtime.get().selectedPiece = `custom:${runtime.get().customPieces[1].id}`;
runtime.handleSpace("4");
assert.equal(runtime.get().customPieces[1].space, "4", "repeated icons keep independent positions");
const saved = JSON.parse(storage.get("kf-encounter-assistant-v1"));
runtime.set(saved);
assert.deepEqual(plain(runtime.get().customPieces).map(piece => [piece.iconId, piece.space]), [["monkey", "3"], ["token-04", "4"]], "saved icon identities and positions survive reload/import");

for (const interactive of [true, false]) {
  const markup = view.renderBoard({ state: runtime.get(), data: context.window.KF_ENCOUNTER_DATA, interactive });
  assert.equal((markup.match(/src="\/assets\/tokens\/little-ser\.png\?v=5"/g) || []).length, 1, "host and second screen render the transparent upright Little Ser image");
  assert.match(markup, /class="custom-piece-image free"[^>]*alt="小猴子"/);
  assert.doesNotMatch(markup, /🐒|🔥/u, "invented emoji tokens are removed");
}
const controls = runtime.customPieceControls();
assert.match(controls, /data-add-piece-icon="monkey"/);
assert.match(controls, /添加小猴子 Token/);
assert.match(controls, /id="deleteCustomPiece"/);

runtime.moveSelectedPieceOffBoard();
assert.equal(runtime.get().customPieces[1].space, "", "icons can be moved off the board");
assert.equal(runtime.get().customPieces[1].iconId, "token-04");
for (const phase of ["monster", "knight"]) {
  runtime.get().phase = phase;
  runtime.handleSpace("4");
  assert.equal(runtime.get().customPieces[1].space, "4", `icons remain placeable during ${phase} phase`);
  runtime.moveSelectedPieceOffBoard();
}
runtime.set({ ...initial, customPieces: [{ id: "legacy", name: "旧棋子", space: "3" }, { id: "invalid", name: "<标记>", iconId: "invalid" }, { id: "icon-only", iconId: "monkey" }] });
assert.equal(runtime.get().customPieces[0].name, "旧棋子", "legacy text pieces survive");
assert.equal(runtime.get().customPieces[1].iconId, "", "unknown icons safely fall back to text");
assert.match(view.customPieceVisual(runtime.get().customPieces[1]), /&lt;标记&gt;/);
assert.equal(runtime.get().customPieces[2].name, "小猴子", "icon-only imports receive a readable name");
assert.equal(runtime.addCustomPiece("", "missing"), false);
runtime.set({ ...initial, selectedPiece: "monster:m1", monsters: [{ id: "m1", name: "怪物", space: "" }], customPieces: [{ id: "little-ser", name: "小猴子", iconId: "monkey", space: "2" }] });
runtime.handleSpace("2");
assert.equal(runtime.get().monsters[0].space, "2", "Little Ser does not block a model's placement");
assert.equal(runtime.get().customPieces[0].space, "3", "a displaced Little Ser avoids blocked mob cell 1");
runtime.undo();
assert.equal(runtime.get().customPieces[0].space, "2", "undo restores a displaced Little Ser together with the model");
runtime.set({ ...initial, customPieces: Array.from({ length: 20 }, (_, i) => ({ id: `c${i}`, name: "目标" })) });
assert.equal(runtime.addCustomPiece("", "monkey"), false, "icon and text pieces share the existing limit");
runtime.set({ ...initial, customPieces: [{ id: "monkey", name: "小猴子", iconId: "monkey", space: "2" }, { id: "fire", name: "火焰", iconId: "token-11", space: "3" }] });
runtime.get().knights = [];
assert.doesNotMatch(runtime.customPieceControls(), /data-add-piece-icon="monkey"/, "the monkey choice is hidden when Sonch is absent from the encounter");
assert.equal(runtime.addCustomPiece("", "monkey"), false, "a hidden monkey cannot be added programmatically");
runtime.save(false);
assert.deepEqual(plain(runtime.get().customPieces).map(piece => piece.iconId), ["token-11"], "a departing Sonch removes only his monkey pieces");
context.window.KF_CAMPAIGN_PARTY = [{ id: "sheet-1", knightId: "stoneface", name: "石面", type: "knight" }];
runtime.set(saved);
assert.ok(runtime.get().customPieces.every(piece => piece.iconId !== "monkey"), "reload/import cannot restore a monkey without Sonch");
runtime.get().knights[0].heroId = "ser-sonch";
assert.doesNotMatch(runtime.customPieceControls(), /data-add-piece-icon="monkey"/, "changing another knight's model does not unlock Sonch's monkey");
assert.equal(runtime.addCustomPiece("", "token-11"), true, "other icon types remain available without Sonch");
const bossApp = fs.readFileSync("public/modules/aibp/app.js", "utf8");
const bossArray = bossApp.match(/const TOKEN_ASSETS = (\[[\s\S]*?\n  \])\.map/)[1];
const bossTokens = vm.runInNewContext(`${bossArray}.map(([id, name, file, shape = "round"]) => ({ id, name, shape, src: \`/assets/tokens/\${file}\` }))`);
assert.deepEqual(plain(view.pieceIcons.filter(icon => icon.id !== "monkey").map(({ id, name, shape, src }) => ({ id, name, shape, src }))), plain(bossTokens), "all twenty encounter tokens use exactly the Boss battle files and IDs");
assert.equal(view.pieceIcons[0].knightId, "ser-sonch");
assert.ok(view.pieceIcons.every(icon => fs.existsSync(`public${icon.src.split("?")[0]}`)), "every palette image is available locally");
console.log("encounter icon pieces: placement, movement, undo, persistence, limits, second screen and Sonch-only monkey passed");
