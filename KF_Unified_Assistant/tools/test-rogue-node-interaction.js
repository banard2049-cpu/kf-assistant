"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const modulePath = path.join(__dirname, "../public/modules/rogue");
const dataSource = fs.readFileSync(path.join(modulePath, "data.js"), "utf8");
const appSource = fs.readFileSync(path.join(modulePath, "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(modulePath, "index.html"), "utf8");
const settle = () => new Promise(resolve => setImmediate(resolve));

// Only the DOM surface used by this module is needed. Running the complete app
// keeps the checks on its real event handlers, save flow and battle handoff.
class Element {
  constructor(attributes = {}) {
    this.attributes = { ...attributes };
    this.dataset = {};
    this.style = {};
    this.children = [];
    this.listeners = new Map();
    this.value = attributes.value || "";
    this.disabled = Object.hasOwn(attributes, "disabled");
    this.htmlWrites = 0;
    for (const [name, value] of Object.entries(attributes)) {
      if (name.startsWith("data-")) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    }
    const classes = new Set((attributes.class || "").split(/\s+/).filter(Boolean));
    this.classList = {
      contains: name => classes.has(name),
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      toggle: (name, force) => {
        const enabled = force === undefined ? !classes.has(name) : Boolean(force);
        enabled ? classes.add(name) : classes.delete(name);
        return enabled;
      },
    };
  }
  set innerHTML(value) {
    this.htmlWrites += 1;
    this.html = value;
    this.children = [...value.matchAll(/<(?:button|input|select)\b([^>]*)>/g)].map(match => {
      const attributes = Object.fromEntries([...match[1].matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map(attribute => [attribute[1], attribute[2] || ""]));
      return new Element(attributes);
    });
  }
  get innerHTML() { return this.html || ""; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(name, listener) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(listener);
  }
  dispatch(name, extra = {}) {
    if (name === "click" && this.disabled) return;
    const event = { type: name, target: this, currentTarget: this, detail: 1, preventDefault() {}, ...extra };
    for (const listener of this.listeners.get(name) || []) listener(event);
  }
  querySelectorAll(selector) { return findElements(this.children, selector); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

function findElements(elements, selector) {
  const descendants = elements.flatMap(element => [element, ...element.children]);
  if (selector.includes(" ")) {
    const [parent, ...rest] = selector.split(/\s+/);
    return findElements(elements, parent).flatMap(element => element.querySelectorAll(rest.join(" ")));
  }
  return descendants.filter(element => {
    if (selector.startsWith("#")) return element.attributes.id === selector.slice(1);
    if (selector.startsWith(".")) return selector.slice(1).split(".").every(name => element.classList.contains(name));
    const attributes = [...selector.matchAll(/\[([\w-]+)(?:=(?:"([^"]*)"|([^\]]*)))?\]/g)];
    return attributes.length > 0 && attributes.every(([, name, quoted, unquoted]) => {
      const expected = quoted ?? unquoted;
      return Object.hasOwn(element.attributes, name) && (expected === undefined || element.attributes[name] === expected);
    }) && (!selector.endsWith(":checked") || element.checked);
  });
}

function boot(patch = () => {}) {
  const elements = [...indexSource.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => new Element({ id }));
  const document = {
    querySelectorAll: selector => findElements(elements, selector),
    querySelector: selector => findElements(elements, selector)[0] || null,
    addEventListener() {},
  };
  const context = { window: {}, document };
  vm.createContext(context);
  vm.runInContext(dataSource, context);
  const rules = context.window.KF_ROGUE_RULES;
  const initial = rules.freshState();
  initial.status = "active";
  initial.roster = [{ id: "knight-1", knightId: "fleischritter", name: "Test Knight", alive: true, gold: 10, rewards: [] }];
  patch(initial);
  const storage = new Map([
    // Real legacy saves wrote the current run as well as the global slot list.
    // Its matching run proves those slots belong to this restored campaign.
    ["kf-rogue-path-v2", JSON.stringify(initial)],
    ["kf-rogue-path-slots-v1", JSON.stringify([
      { id: "slot-a", title: "A", state: initial },
      { id: "slot-b", title: "B", state: initial },
    ])],
    ["kf-rogue-path-active-slot-v1", "slot-a"],
  ]);
  const calls = { random: 0, saves: 0, navigations: 0, flushes: 0 };
  context.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => { calls.saves += 1; storage.set(key, String(value)); },
  };
  context.location = {
    set href(value) { calls.navigations += 1; this.lastHref = value; },
  };
  context.confirm = () => true;
  context.window.addEventListener = () => {};
  context.window.KF_MODULE_BRIDGE = { flush: () => { calls.flushes += 1; return Promise.resolve(); } };
  context.window.KF_ROGUE_RULES = {
    ...rules,
    randomResult: (...args) => { calls.random += 1; return rules.randomResult(...args.slice(0, 2), 1); },
  };
  vm.runInContext(appSource, context);
  calls.saves = 0;
  const get = selector => document.querySelector(selector);
  const node = id => get(`[data-node="${id}"]`);
  const availableIds = initial.nodes.filter(item => !item.cleared && item.links.includes("S")).map(item => item.id);
  const saved = () => JSON.parse(storage.get("kf-rogue-path-v2"));
  return {
    calls, get, node, availableIds, initial, saved, storage, context,
    async click(element, detail = 1) { element.dispatch("click", { detail }); await settle(); },
    async change(element, value) { element.value = value; element.dispatch("change"); await settle(); },
  };
}

async function main() {
  {
    const app = boot();
    const migrated = app.saved();
    assert.equal(migrated.schemaVersion, 2, "legacy storage migrates to a campaign-owned slot bundle");
    assert.equal(migrated.activeSlotId, "slot-a", "migration keeps the selected legacy run");
    assert.deepEqual(migrated.slots.map(slot => slot.id), ["slot-a", "slot-b"], "migration preserves inactive legacy runs");
    assert.equal(migrated.status, migrated.slots[0].state.status, "the top-level active run stays compatible with the second screen");
    assert.equal(migrated.slots[0].state.slots, undefined, "individual runs do not recursively contain the bundle");
    const id = app.availableIds[0];
    const target = app.node(id);
    const mapWrites = app.get("#nodeLayer").htmlWrites;
    await app.click(target);
    assert.equal(app.calls.random, 0, "preview must not roll a boss");
    assert.equal(app.calls.saves, 0, "preview must not write campaign progress");
    assert.equal(app.calls.navigations, 0, "preview must stay on the map");
    assert.equal(app.storage.has("kfRogueHandoff"), false, "preview must not create a battle handoff");
    assert.equal(target.classList.contains("node-selected"), true, "the preview node is visibly selected");
    assert.equal(target.getAttribute("aria-pressed"), "true", "selection is exposed to assistive technology");
    assert.match(app.get("#nodeInfo").innerHTML, /奖励/, "preview shows the reward");
    assert.equal(app.get("#nodeLayer").htmlWrites, mapWrites, "selection must preserve the double-click target");
    assert.equal(app.node(id), target, "preview keeps the same button in the DOM");
    await app.click(target);
    assert.equal(app.calls.random, 1, "a second click starts a battle");
    assert.equal(app.calls.navigations, 1);
    assert.equal(app.context.location.lastHref, "/modules/aibp/");
    assert.equal(app.saved().pendingBattle.nodeId, id);
    assert.equal(JSON.parse(app.storage.get("kfRogueHandoff")).nodeId, id);
    await app.click(target, 3);
    target.dispatch("dblclick", { detail: 2 });
    await settle();
    assert.equal(app.calls.random, 1, "extra clicks must not roll a second pending battle");
    assert.equal(app.saved().history.filter(item => item.type === "battle-start").length, 1);
  }
  {
    const app = boot();
    const target = app.node(app.availableIds[0]);
    target.dispatch("click", { detail: 1 });
    target.dispatch("click", { detail: 2 });
    target.dispatch("dblclick", { detail: 2 });
    await settle();
    assert.equal(app.calls.random, 1, "a browser double-click starts exactly one battle");
    assert.equal(app.calls.navigations, 1);
    assert.equal(app.calls.flushes, 1);
  }
  {
    const app = boot();
    const [a, b] = app.availableIds;
    await app.click(app.node(a));
    await app.click(app.node(b));
    assert.equal(app.calls.random, 0, "switching nodes first previews the new node");
    assert.equal(app.node(a).getAttribute("aria-pressed"), "false");
    assert.equal(app.node(b).getAttribute("aria-pressed"), "true");
    await app.click(app.node(b));
    assert.equal(app.saved().pendingBattle.nodeId, b, "confirmation starts the currently previewed node");
  }
  {
    const app = boot(state => { state.nodes.find(node => node.id === "stone-01").cleared = true; });
    const locked = app.initial.nodes.find(node => node.id !== "S" && !node.cleared && !node.links.includes("S") && !node.links.includes("stone-01"));
    for (const id of [locked.id, "stone-01"]) {
      assert.equal(app.node(id).disabled, false, "unavailable nodes still allow reward previews");
      await app.click(app.node(id));
      await app.click(app.node(id));
      assert.equal(app.node(id).getAttribute("aria-pressed"), "true");
    }
    assert.equal(app.calls.random, 0, "locked and completed nodes never start a battle");
    assert.equal(app.calls.navigations, 0);
  }
  for (const pendingType of ["pendingBattle", "pendingRewardChoice"]) {
    const app = boot(state => {
      state[pendingType] = pendingType === "pendingBattle"
        ? { nodeId: "stone-14", monster: "Test Boss", level: 1, roll: 1 }
        : { nodeId: "stone-14", rewardRevives: 1, casualties: [], spentRevives: 0, options: ["technique"] };
    });
    const target = app.node(app.availableIds[0]);
    await app.click(target);
    await app.click(target);
    assert.equal(app.calls.random, 0, `${pendingType} prevents starting another battle`);
    assert.equal(app.calls.navigations, 0);
  }
  {
    const app = boot(state => {
      state.pendingRewardChoice = { nodeId: "stone-14", rewardRevives: 1, casualties: [], spentRevives: 0, options: ["technique"] };
    });
    const id = app.availableIds[0];
    await app.click(app.node(id));
    assert.equal(app.node(id).getAttribute("aria-pressed"), "true", "a node can be previewed while rewards await confirmation");
    app.get("[data-reward-choice]").value = "Crunchy Batter";
    await app.click(app.get("#confirmRewardChoices"));
    assert.equal(app.saved().pendingRewardChoice, null);
    assert.equal(app.node(id).getAttribute("aria-pressed"), "false", "confirming rewards clears previews made while waiting");
    await app.click(app.node(id));
    assert.equal(app.calls.random, 0, "the next node needs a fresh preview after reward settlement");
    await app.click(app.node(id));
    assert.equal(app.calls.random, 1, "the next node can then be confirmed normally");
  }
  for (const status of ["won", "lost"]) {
    const app = boot(state => { state.status = status; });
    const target = app.node(app.availableIds[0]);
    await app.click(target);
    await app.click(target);
    assert.equal(app.calls.random, 0, `a ${status} campaign allows previews without starting battles`);
  }
  {
    const app = boot();
    const id = app.availableIds[0];
    await app.click(app.node(id));
    await app.change(app.get("#rogueSaveSelect"), "slot-b");
    await app.click(app.node(id));
    assert.equal(app.calls.random, 0, "switching saves clears the previous click confirmation");
    await app.click(app.node(id));
    assert.equal(app.calls.random, 1);
  }
  {
    const app = boot();
    const id = app.availableIds[0];
    await app.click(app.node(id));
    await app.click(app.get("#newRun"));
    await app.click(app.get(".knight-choice"));
    await app.click(app.get("#startRun"));
    assert.equal(app.node(id).getAttribute("aria-pressed"), "false", "a new campaign starts without an old preview selection");
    await app.click(app.node(id));
    assert.equal(app.calls.random, 0, "the new campaign requires its own first preview click");
  }
  {
    const app = boot();
    const [a, b] = app.availableIds;
    await app.click(app.node(a));
    await app.click(app.get("#toggleLinkEditor"));
    await app.click(app.node(a));
    await app.click(app.node(b));
    await app.click(app.node(b));
    assert.equal(app.calls.random, 0, "link editing never starts a battle");
    await app.click(app.get("#toggleLinkEditor"));
    await app.click(app.node(a));
    assert.equal(app.calls.random, 0, "leaving link editing requires a fresh preview");
  }
  {
    const app = boot();
    const id = app.availableIds[0];
    await app.click(app.node(id));
    await app.click(app.node(id));
    await app.click(app.get("#resolveDefeat"));
    await app.click(app.node(id));
    assert.equal(app.calls.random, 1, "retrying a defeated node starts with a fresh preview");
    await app.click(app.node(id));
    assert.equal(app.calls.random, 2, "the defeated node can still be confirmed for another battle");
  }
  console.log("rogue node interaction: preview, confirmation, double-click and battle guards passed");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
