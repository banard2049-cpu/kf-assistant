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
    this.classList = {
      add: (...names) => names.forEach(name => this.classes.add(name)),
      remove: (...names) => names.forEach(name => this.classes.delete(name)),
      toggle: (name, force) => force ? this.classes.add(name) : this.classes.delete(name)
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
  setAttribute() {}
  removeAttribute() {}
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
  window.dragTest = { bindBoardDrag, undo, boardData, calculatedAttackTargets,
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
    monsters: [{ id: "m1", name: "怪物", space: monsterSpace, facing: 90 }], customPieces });
  const grid = new Element({}, { left: 100, top: 100, width: 500, height: 300 });
  const cells = new Map();
  grid.querySelector = selector => {
    if (!cells.has(selector)) cells.set(selector, new Element());
    return cells.get(selector);
  };
  grid.querySelectorAll = () => [...cells.values()].filter(node => node.classes.has("drop-target"));
  const removeZone = new Element({}, { left: 100, top: 70, width: 100, height: 52 });
  scene = { grid, removeZone, cells, sources: sources.map(dataset => new Element(dataset)),
    elements: new Map([[".board-grid", grid], ["#boardRemoveZone", removeZone]]) };
  runtime.bindBoardDrag();
  return scene;
}
function point(space) {
  const board = runtime.boardData();
  const col = (Number(space) - 1) % board.cols;
  return { clientX: 100 + ((board.mirror ? board.cols - 1 - col : col) + .5) * 500 / board.cols,
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
  assertClean();
}
setup({ tier: "vassal", sources: [{ selectPiece: "knight:k1" }] });
begin(); hover(5); drop(5);
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

console.log("encounter picker drag: creation, placement, removal, cancellation, collisions, limits, footprints, persistence and undo passed");
