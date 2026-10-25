"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const plain = value => JSON.parse(JSON.stringify(value));

// A small event/geometry surface runs the real encounter handlers and state mutations.
class Element {
  constructor(dataset = {}, rect = {}) {
    this.dataset = dataset;
    this.rect = { left: 0, top: 0, width: 50, height: 50, ...rect };
    this.rect.right = this.rect.left + this.rect.width;
    this.rect.bottom = this.rect.top + this.rect.height;
    this.listeners = new Map();
    this.classes = new Set();
    this.attributes = new Map();
    this.classList = {
      add: (...names) => names.forEach(name => this.classes.add(name)),
      remove: (...names) => names.forEach(name => this.classes.delete(name)),
      toggle: (name, force) => force ? this.classes.add(name) : this.classes.delete(name),
      [Symbol.iterator]: () => this.classes.values()
    };
    this.style = { setProperty() {} };
    this.isConnected = true;
  }
  addEventListener(type, fn, capture = false) {
    const entries = this.listeners.get(type) || [];
    entries.push({ fn, capture: capture === true });
    this.listeners.set(type, entries);
  }
  removeEventListener(type, fn) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter(entry => entry.fn !== fn));
  }
  fire(type, values = {}) {
    const event = { type, target: this, pointerId: 1, pointerType: "mouse", button: 0, clientX: 750, clientY: 450,
      preventDefault() { this.defaultPrevented = true; },
      stopImmediatePropagation() { this.stopped = true; }, ...values };
    const entries = [...(this.listeners.get(type) || [])].sort((a, b) => Number(b.capture) - Number(a.capture));
    for (const { fn } of entries) { fn(event); if (event.stopped) break; }
    return event;
  }
  closest() { return this; }
  getBoundingClientRect() { return this.rect; }
  setPointerCapture() {}
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
  cloneNode() { const node = new Element(this.dataset, this.rect); node.classes = new Set(this.classes); return node; }
  remove() { this.isConnected = false; }
}

const shell = new Map(["#app", "#undo", "#exportSave", "#importSave", "#importFile", "#newEncounter", "#toast", "#saveStatus"].map(key => [key, new Element()]));
const storage = new Map();
const timers = [];
const ghosts = [];
const window = new Element();
window.KF_CAMPAIGN_PARTY = [{ id: "sheet-1", knightId: "ser-sonch", name: "Sonch", type: "knight" }];
let scene;
const context = vm.createContext({
  window,
  document: {
    querySelector: selector => scene?.elements.get(selector) || shell.get(selector) || null,
    querySelectorAll: () => scene?.sources || [],
    createElement: () => new Element(),
    body: { appendChild: node => ghosts.push(node) }
  },
  localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
  setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {}
});
const read = file => fs.readFileSync(`public/modules/encounter/${file}`, "utf8");
for (const file of ["data/encounter-data.js", "encounter-catalog.js", "encounter-view.js"]) vm.runInContext(read(file), context);
const app = read("app.js");
vm.runInContext(app.slice(0, app.lastIndexOf("  renderApp();")) + `
  renderApp = () => {};
  window.dragTest = { bindBoardDrag, undo, boardData, calculatedAttackTargets, monsterAttackTargets,
    get: () => state, set: value => { state = normalize(value); } };
})();`, context);
const runtime = window.dragTest;
const initial = plain(runtime.get());
const monsters = window.KF_ENCOUNTER_DATA.monsters;

function setup({ tier = "mob", customPieces = [], monsterSpace = "", knightSpace = "", sources = [{}] } = {}) {
  while (timers.length) timers.shift()();
  const monster = monsters.find(item => item.encounterLevels.some(level => level.tier === tier));
  const level = monster.encounterLevels.find(item => item.tier === tier);
  runtime.set({ ...initial, monsterId: monster.id, level: level.level, phase: "position", history: [], log: [],
    selectedPiece: "knight:k1", knights: [{ ...initial.knights[0], id: "k1", space: knightSpace }],
    monsters: [{ id: "m1", name: "怪物", space: monsterSpace, facing: 90, rolls: ["sword", "cup"] }], customPieces });
  const grid = new Element({}, { left: 100, top: 100, width: 500, height: 300 });
  const cells = new Map(Array.from({ length: runtime.boardData().cols * runtime.boardData().rows }, (_, index) => {
    const cell = new Element({ space: String(index + 1) });
    return [index + 1, cell];
  }));
  const boardPieces = [...runtime.get().monsters.map(item => ({ ...item, kind: "monster" })),
    ...runtime.get().knights.map(item => ({ ...item, kind: "knight" })),
    ...runtime.get().customPieces.map(item => ({ ...item, kind: "custom" }))]
    .filter(item => item.space).map(item => new Element({ piece: `${item.kind}:${item.id}` }));
  let ink = null;
  grid.querySelector = selector => {
    if (selector === ".board-ink") return ink;
    return cells.get(Number(selector.match(/data-space="(\d+)"/)?.[1])) || null;
  };
  grid.querySelectorAll = selector => {
    if (selector === ".piece[data-piece]") return boardPieces;
    if (selector === ".space") return [...cells.values()];
    return [...cells.values()].filter(node => node.classes.has("drop-target"));
  };
  grid.insertAdjacentHTML = (position, html) => {
    assert.equal(position, "beforeend");
    if (!html) return;
    ink = new Element();
    ink.innerHTML = html;
    ink.remove = () => { ink = null; };
  };
  const removeZone = new Element({}, { left: 100, top: 70, width: 100, height: 52 });
  scene = { grid, removeZone, cells, boardPieces, sources: sources.map(dataset => new Element(dataset)),
    elements: new Map([[".board-grid", grid], ["#boardRemoveZone", removeZone]]) };
  runtime.bindBoardDrag();
  return scene;
}
function point(space) {
  const board = runtime.boardData();
  const col = (Number(space) - 1) % board.cols;
  return { clientX: 100 + (col + .5) * 500 / board.cols,
    clientY: 100 + (Math.floor((Number(space) - 1) / board.cols) + .5) * 300 / board.rows };
}
function begin(node = scene.sources[0], values = {}) { node.fire("pointerdown", values); }
function hover(space, values = {}) { window.fire("pointermove", { ...point(space), ...values }); }
function drop(space, values = {}) { window.fire("pointerup", { ...point(space), ...values }); }
function assertClean() {
  assert.equal(scene.grid.querySelectorAll().length, 0, "drop hints are cleared");
  assert.ok(!scene.removeZone.classes.has("drop-target"), "remove hint is cleared");
  assert.ok(ghosts.every(node => !node.isConnected), "floating previews are removed");
  for (const type of ["pointermove", "pointerup", "pointercancel", "keydown", "blur"]) {
    assert.equal(window.listeners.get(type)?.length || 0, 0, `${type} listeners are released`);
  }
}

// Pressing a model immediately previews its selection and matching dice, without replacing nodes or saving.
const matchingCells = () => [...scene.cells].filter(([, node]) => node.classes.has("match")).map(([number]) => number);
for (const kind of ["monster", "knight"]) {
  setup({ tier: "vassal", sources: [{ selectPiece: "monster:m1" }, { selectPiece: "knight:k1" }] });
  runtime.get().knights[0].roll = "double-sword";
  runtime.get().selectedPiece = kind === "monster" ? "knight:k1" : "monster:m1";
  const before = plain(runtime.get());
  const oldSaved = storage.get("kf-encounter-assistant-v1");
  const source = scene.sources[kind === "monster" ? 0 : 1];
  const otherSource = scene.sources[kind === "monster" ? 1 : 0];
  otherSource.classes.add("selected");
  begin(source);
  assert.ok(source.classes.has("selected"), "the pressed model is selected before the first move");
  assert.equal(source.attributes.get("aria-pressed"), "true");
  assert.ok(!otherSource.classes.has("selected"), "the old selection clears immediately");
  assert.equal(otherSource.attributes.get("aria-pressed"), "false");
  const bossMatches = [3, 4, 10, 17, 23, 24];
  const knightMatches = [12, 16, 21];
  assert.deepEqual(matchingCells(), kind === "monster" ? bossMatches : knightMatches);
  const ink = scene.grid.querySelector(".board-ink");
  assert.ok(ink?.innerHTML.includes('data-ink-layer="match"'), "the hand-drawn placement overlay updates too");
  if (kind === "monster") {
    assert.match(ink.innerHTML, /data-ink-kind="1" data-ink-cells="4"/);
    assert.match(ink.innerHTML, /data-ink-kind="2" data-ink-cells="3"/);
  }
  assert.deepEqual(plain(runtime.get()), before, "preview selection does not change game state");
  assert.equal(storage.get("kf-encounter-assistant-v1"), oldSaved, "preview selection does not save");
  hover(18);
  window.fire("keydown", { key: "Escape" });
  assert.ok(otherSource.classes.has("selected"), "cancellation restores the original selection");
  assert.deepEqual(matchingCells(), kind === "monster" ? knightMatches : bossMatches);
  assert.deepEqual(plain(runtime.get()), before);
  assertClean();
}

// A model grabbed on the board uses the same live preview and retains its pointer-capture node.
setup({ tier: "vassal", monsterSpace: "3", sources: [{ selectPiece: "monster:m1" }, { selectPiece: "knight:k1" }] });
const boardBoss = scene.boardPieces.find(node => node.dataset.piece === "monster:m1");
scene.grid.fire("pointerdown", { target: boardBoss, ...point(3) });
assert.ok(boardBoss.classes.has("selected"));
assert.ok(scene.sources[0].classes.has("selected"));
assert.equal(scene.boardPieces[0], boardBoss, "the live token is not replaced to refresh the overlay");
window.fire("pointercancel");
assert.ok(!boardBoss.classes.has("selected"));
assert.ok(scene.sources[1].classes.has("selected"));
assertClean();

// Palette dragging creates and places exactly one token, as one undoable operation.
setup({ sources: [{ addPieceIcon: "token-04" }] });
let clicks = 0;
scene.sources[0].addEventListener("click", () => clicks++);
begin(); hover(2);
assert.equal(runtime.get().customPieces.length, 0, "previewing does not create a token");
assert.equal(runtime.get().history.length, 0, "previewing does not save an undo entry");
assert.equal(scene.grid.querySelectorAll().length, 1, "valid destination is highlighted");
drop(3);
assert.equal(runtime.get().customPieces[0].space, "3", "release coordinates determine the final destination");
assert.equal(runtime.get().customPieces[0].iconId, "token-04");
assert.equal(runtime.get().selectedPiece, `custom:${runtime.get().customPieces[0].id}`);
assert.equal(runtime.get().history.length, 1);
assert.equal(JSON.parse(storage.get("kf-encounter-assistant-v1")).customPieces[0].space, "3");
assert.ok(scene.sources[0].fire("click").defaultPrevented, "synthetic click is consumed");
assert.equal(clicks, 0, "drag release cannot also add a second token");
assertClean();
runtime.undo();
assert.equal(runtime.get().customPieces.length, 0, "one undo removes the newly dragged token");

for (const end of ["pointercancel", "escape", "blur"]) {
  setup({ sources: [{ addPieceIcon: "token-04" }] });
  const before = plain(runtime.get());
  begin(); hover(2);
  if (end === "escape") window.fire("keydown", { key: "Escape" });
  else window.fire(end, point(2));
  assert.deepEqual(plain(runtime.get()), before, `${end} cancels without changing state`);
  assertClean();
}
for (const target of [1, 15, 4, 0]) {
  setup({ monsterSpace: "4", sources: [{ addPieceIcon: "token-04" }] });
  const before = plain(runtime.get());
  begin(); hover(target); drop(target);
  assert.deepEqual(plain(runtime.get()), before, "blocked, occupied and outside drops preserve state");
  assertClean();
}
setup({ customPieces: Array.from({ length: 20 }, (_, i) => ({ id: `c${i}`, name: "目标", space: "" })), sources: [{ addPieceIcon: "token-04" }] });
begin(); hover(2); drop(2);
assert.equal(runtime.get().customPieces.length, 20, "dragging respects the token limit");
assert.equal(runtime.get().history.length, 0);
assertClean();

// Existing text tokens and models can be placed directly from their selection cards.
setup({ customPieces: [{ id: "text", name: "目标", space: "" }], sources: [{ selectCustomPiece: "text" }] });
begin(undefined, { pointerType: "touch" }); hover(2, { pointerType: "touch" }); drop(2, { pointerType: "touch" });
assert.equal(runtime.get().customPieces[0].space, "2");
assertClean();
for (const kind of ["knight", "monster"]) {
  setup({ sources: [{ selectPiece: `${kind}:${kind === "knight" ? "k1" : "m1"}` }] });
  begin(); hover(3); drop(3);
  assert.equal(runtime.get()[kind === "knight" ? "knights" : "monsters"][0].space, "3");
  assertClean();
}
for (const tier of ["vassal", "dragon"]) {
  setup({ tier, sources: [{ selectPiece: "monster:m1" }] });
  begin(); hover(3); drop(3);
  assert.ok(runtime.get().monsters[0].space, `${tier} footprints can be dragged from the picker`);
  assert.deepEqual(plain(runtime.get().targets), plain(runtime.calculatedAttackTargets()));
  const boss = runtime.get().monsters[0];
  const maximum = Math.max(...[0, 90, 180, 270].map(facing => runtime.monsterAttackTargets({ ...boss, facing }).length));
  assert.equal(runtime.get().targets.length, maximum, `${tier} picker drops choose the greatest attack coverage`);
  assertClean();
}
setup({ tier: "vassal", sources: [{ selectPiece: "knight:k1" }] });
begin(); hover(2); drop(2);
assert.equal(runtime.get().knights[0].space, "", "inactive columns reject picker drops");
assert.equal(runtime.get().history.length, 0);
assertClean();

// Little Ser remains unique, and displaced companions move within the same undo entry.
setup({ customPieces: [{ id: "ser", name: "小猴子", iconId: "monkey", space: "2" }], sources: [{ addPieceIcon: "monkey" }] });
begin(); hover(3); drop(3);
assert.equal(runtime.get().customPieces.length, 1);
assert.equal(runtime.get().customPieces[0].space, "3");
runtime.undo();
assert.equal(runtime.get().customPieces[0].space, "2");
assertClean();
setup({ customPieces: [{ id: "ser", name: "小猴子", iconId: "monkey", space: "2" }], sources: [{ addPieceIcon: "token-04" }] });
begin(); hover(2); drop(2);
assert.equal(runtime.get().customPieces[1].space, "2");
assert.notEqual(runtime.get().customPieces[0].space, "2");
runtime.undo();
assert.equal(runtime.get().customPieces.length, 1);
assert.equal(runtime.get().customPieces[0].space, "2");
assertClean();

// Removing uses the dragged identity, preserves the token, and restores both position and selection on undo.
for (const fromBoard of [false, true]) {
  setup({ customPieces: [{ id: "token", name: "Bane", iconId: "token-04", space: "3" }],
    sources: fromBoard ? [] : [{ selectCustomPiece: "token" }] });
  const node = fromBoard ? new Element({ piece: "custom:token" }, { left: 300, top: 100, width: 86, height: 86 }) : scene.sources[0];
  if (fromBoard) scene.grid.fire("pointerdown", { target: node, ...point(3) });
  else begin(node);
  window.fire("pointermove", { clientX: 150, clientY: 95 });
  assert.ok(scene.removeZone.classes.has("drop-target"), "remove zone wins when it overlaps the grid");
  window.fire("pointerup", { clientX: 150, clientY: 95 });
  assert.equal(runtime.get().customPieces[0].space, "");
  assert.equal(runtime.get().customPieces[0].iconId, "token-04", "removal preserves token identity");
  assert.equal(runtime.get().selectedPiece, "custom:token");
  assert.equal(runtime.get().history.length, 1);
  assertClean();
  runtime.undo();
  assert.equal(runtime.get().customPieces[0].space, "3");
  assert.equal(runtime.get().selectedPiece, "knight:k1");
}
setup({ monsterSpace: "3", sources: [{ selectPiece: "monster:m1" }] });
runtime.get().targets = runtime.calculatedAttackTargets();
const targets = plain(runtime.get().targets);
begin(); window.fire("pointermove", { clientX: 150, clientY: 95 }); window.fire("pointerup", { clientX: 150, clientY: 95 });
assert.equal(runtime.get().monsters[0].space, "");
assert.deepEqual(plain(runtime.get().targets), []);
runtime.undo();
assert.equal(runtime.get().monsters[0].space, "3");
assert.deepEqual(plain(runtime.get().targets), targets);
assertClean();

setup({ sources: [{ addPieceIcon: "token-04" }] });
begin(); window.fire("pointermove", { clientX: 150, clientY: 95 }); window.fire("pointerup", { clientX: 150, clientY: 95 });
assert.equal(runtime.get().customPieces.length, 0, "dropping an unused palette token into the remove zone creates nothing");
assert.equal(runtime.get().history.length, 0);
assertClean();

// Boss placement checks are also applied to pointer previews and actual drops.
setup({ tier: "vassal", sources: [{ selectPiece: "monster:m1" }] });
const bossBoard = runtime.boardData();
const originalSymbols = bossBoard.spaces;
bossBoard.spaces = Array.from({ length: 24 }, (_, i) => i === 2 ? { sword: 1 } : i === 3 ? { cup: 1 } : {});
const beforeInvalidBossDrop = plain(runtime.get());
begin(); hover(24);
assert.equal(scene.grid.querySelectorAll().length, 0, "invalid boss footprints are not previewed as legal");
drop(24);
assert.deepEqual(plain(runtime.get()), beforeInvalidBossDrop, "invalid boss drops leave the saved position and history untouched");
assertClean();
begin(); hover(3); drop(3);
assert.equal(runtime.get().monsters[0].space, "3", "a matching double-die footprint can be dropped");
assertClean();
bossBoard.spaces = originalSymbols;

// Dropping another boss can reorient the first one to maximize their combined, non-duplicated range.
setup({ tier: "vassal", monsterSpace: "3", sources: [{ selectPiece: "monster:m2" }] });
runtime.get().monsters.push({ id: "m2", name: "Boss 2", space: "", facing: 0, rolls: ["blank", "blank"] });
bossBoard.spaces = Array.from({ length: 24 }, () => ({}));
begin(); hover(22); drop(22);
assert.equal(runtime.get().monsters[1].space, "16");
assert.deepEqual(plain(runtime.get().monsters.map(item => item.facing)), [180, 0]);
assert.equal(runtime.get().targets.length, 7);
assertClean();
runtime.undo();
assert.deepEqual(plain(runtime.get().monsters.map(({ space, facing }) => ({ space, facing }))), [
  { space: "3", facing: 90 }, { space: "", facing: 0 }
]);
bossBoard.spaces = originalSymbols;

console.log("encounter picker drag: creation, placement, removal, cancellation, collisions, limits, footprints, dice validation, persistence and undo passed");
