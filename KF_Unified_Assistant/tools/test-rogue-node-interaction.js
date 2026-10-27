"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const modulePath = path.join(__dirname, "../public/modules/rogue");
const withergraalSource = fs.readFileSync(path.join(modulePath, "withergraal-data.js"), "utf8");
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

function boot(patch = () => {}, savedStorage = null) {
  const elements = [...indexSource.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => new Element({ id }));
  const document = {
    querySelectorAll: selector => findElements(elements, selector),
    querySelector: selector => findElements(elements, selector)[0] || null,
    addEventListener() {},
  };
  const context = { window: {}, document };
  vm.createContext(context);
  vm.runInContext(withergraalSource, context);
  vm.runInContext(dataSource, context);
  const rules = context.window.KF_ROGUE_RULES;
  const initial = rules.freshState();
  initial.status = "active";
  initial.roster = [{ id: "knight-1", knightId: "fleischritter", name: "Test Knight", alive: true, gold: 10, rewards: [] }];
  patch(initial);
  const storage = savedStorage || new Map([
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
    calls, get, node, availableIds, initial, saved, storage, context, rules,
    reload() { return boot(() => {}, storage); },
    async click(element, detail = 1) { element.dispatch("click", { detail }); await settle(); },
    async change(element, value) { element.value = value; element.dispatch("change"); await settle(); },
  };
}

async function main() {
  {
    const app = boot(state => { state.nodes.find(node => node.id === "sunken-05").cleared = true; });
    await app.click(app.node("sunken-01"));
    await app.click(app.node("sunken-01"));
    await app.click(app.get("#resolveVictory"));
    assert.equal(app.saved().status, "active", "the V endpoint's current-or-lower gear choice must be confirmed first");
    const endpoint = app.saved().nodes.find(node => node.id === "sunken-01");
    const gear = app.rules.basicRewardOptions(app.saved(), endpoint, app.saved().roster[0]).find(option => option.level === 5);
    await app.change(app.get('[data-reward-choice="knight-1"]'), gear.id);
    await app.click(app.get("#confirmRewardChoices"));
    assert.equal(app.saved().status, "won", "one printed V endpoint wins the basic campaign");
    assert.equal(app.saved().nodes.filter(node => node.cleared && node.reward !== "start").length, 2, "victory does not require clearing other branches");
    assert.equal(app.get("#continueWithergraal").classList.contains("hidden"), false, "winning one V endpoint opens advanced continuation");
    const inactive = app.saved().slots.find(slot => slot.id === "slot-b").state;
    assert.equal(inactive.status, "active", "finishing one save does not finish another save");
    assert.equal(inactive.nodes.find(node => node.id === "sunken-01").cleared, false);
    await app.change(app.get("#rogueSaveSelect"), "slot-b");
    assert.equal(app.get("#continueWithergraal").classList.contains("hidden"), true, "an unfinished save has no continuation entry");
    await app.change(app.get("#rogueSaveSelect"), "slot-a");
    assert.equal(app.get("#continueWithergraal").classList.contains("hidden"), false, "switching back restores the completed save's entry");
  }
  {
    const app = boot(state => { state.nodes.find(node => node.id === "sunken-46").cleared = true; });
    await app.click(app.node("sunken-49"));
    await app.click(app.node("sunken-49"));
    await app.click(app.get("#resolveVictory"));
    assert.equal(app.saved().status, "active", "the endpoint reward is settled before the campaign wins");
    assert.equal(app.get("#rewardChoiceModal").classList.contains("hidden"), false);
    assert.equal(app.get("#continueWithergraal").classList.contains("hidden"), true, "pending endpoint rewards block continuation");
    app.get("[data-reward-choice]").value = app.rules.rewardOptions(5, "fleischritter", "technique")[0];
    await app.click(app.get("#confirmRewardChoices"));
    assert.equal(app.saved().status, "won");
    assert.equal(app.get("#continueWithergraal").classList.contains("hidden"), false);
  }
  {
    let app = boot(state => {
      state.roster.push({ id: "knight-2", knightId: "kara", name: "Second Knight", alive: true, gold: 10, rewards: [] });
      state.pendingBattle = { nodeId: "sunken-25", monster: "Test Boss", level: 3, roll: 1 };
    });
    await app.click(app.get("#resolveVictory"));
    const pending = app.saved();
    const node = pending.nodes.find(item => item.id === "sunken-25");
    const lower = app.rules.basicRewardOptions(pending, node, pending.roster[0]).find(option => option.level === 1 && option.text === "Crunchy Batter");
    const current = app.rules.basicRewardOptions(pending, node, pending.roster[1]).find(option => option.level === 3);
    assert.ok(lower && current, "each knight can choose from their own current-or-lower table");
    await app.change(app.get('[data-reward-choice="knight-1"]'), lower.id);
    await app.change(app.get('[data-reward-choice="knight-2"]'), current.id);
    assert.equal(app.saved().pendingRewardChoice.choices["knight-1"], lower.id);
    app = app.reload();
    assert.equal(app.saved().pendingRewardChoice.choices["knight-1"], lower.id, "a lower-level draft survives reload");
    assert.equal(app.saved().pendingRewardChoice.choices["knight-2"], current.id, "each knight's draft survives independently");
    assert.ok(app.get("#rewardChoiceBody").innerHTML.includes(`value="${lower.id}" selected`), "the restored lower-level option is shown selected");
    await app.click(app.get("#confirmRewardChoices"));
    const completed = app.saved();
    assert.equal(completed.pendingRewardChoice, null);
    assert.equal(completed.roster[0].rewards.at(-1).text, "Crunchy Batter");
    assert.equal(completed.roster[0].rewards.at(-1).level, 1, "reward record keeps the chosen table level");
    assert.equal(completed.roster[0].rewards.at(-1).nodeLevel, 3, "reward record also keeps the conquered node level");
    assert.equal(completed.roster[1].rewards.at(-1).level, 3);
    assert.equal(completed.claimedRewards[lower.keys[0]], true);
    const run = completed.slots.find(slot => slot.id === completed.activeSlotId).state;
    app = boot(state => {
      Object.assign(state, JSON.parse(JSON.stringify(run)));
      state.pendingBattle = { nodeId: "sunken-06", monster: "Test Boss", level: 3, roll: 1 };
    });
    await app.click(app.get("#resolveVictory"));
    const retry = app.saved();
    const retryNode = retry.nodes.find(item => item.id === "sunken-06");
    const firstOptions = app.rules.basicRewardOptions(retry, retryNode, retry.roster[0]);
    const secondOptions = app.rules.basicRewardOptions(retry, retryNode, retry.roster[1]);
    assert.equal(firstOptions.some(option => option.id === lower.id), false, "an already-claimed lower-level checkbox is removed");
    assert.ok(secondOptions.some(option => option.level === 1), "one knight's claim does not consume another knight's lower-level rewards");
    const beforeCounts = retry.roster.map(member => member.rewards.length);
    await app.change(app.get('[data-reward-choice="knight-1"]'), lower.id);
    await app.click(app.get("#confirmRewardChoices"));
    assert.notEqual(app.saved().pendingRewardChoice, null, "a stale consumed reward cannot finish settlement");
    assert.deepEqual(app.saved().roster.map(member => member.rewards.length), beforeCounts, "invalid choices cannot partially reward another knight");
    assert.match(app.get("#rewardChoiceError").textContent, /尚未领取/);
    await app.change(app.get('[data-reward-choice="knight-1"]'), firstOptions.find(option => option.level === 2).id);
    await app.click(app.get("#confirmRewardChoices"));
    const settledCounts = app.saved().roster.map(member => member.rewards.length);
    assert.deepEqual(settledCounts, beforeCounts.map(count => count + 1));
    await app.click(app.get("#confirmRewardChoices"));
    assert.deepEqual(app.saved().roster.map(member => member.rewards.length), settledCounts, "returning to confirmation never repeats grants");
  }
  {
    const app = boot(state => {
      state.roster.push({ id: "knight-2", knightId: "kara", name: "Second Knight", alive: true, gold: 10, rewards: [] });
      state.claimedRewards["knight-1:1:virtue:+1 Fortitude"] = true;
      state.claimedRewards["knight-1:2:virtue:+1 Bravery"] = true;
      state.pendingBattle = { nodeId: "stone-30", monster: "Test Boss", level: 2, roll: 1 };
    });
    await app.click(app.get("#resolveVictory"));
    assert.equal(app.get('[data-reward-choice="knight-1"]'), null, "an exhausted knight does not receive a replacement or duplicate reward");
    assert.match(app.get("#rewardChoiceBody").innerHTML, /Test Knight：该类可领奖励已全部领取/);
    const saved = app.saved();
    const node = saved.nodes.find(item => item.id === "stone-30");
    const lower = app.rules.basicRewardOptions(saved, node, saved.roster[1]).find(option => option.level === 1);
    await app.change(app.get('[data-reward-choice="knight-2"]'), lower.id);
    await app.click(app.get("#confirmRewardChoices"));
    assert.equal(app.saved().roster[0].rewards.length, 0);
    assert.equal(app.saved().roster[0].attributes.fortitude, 0);
    assert.equal(app.saved().roster[0].attributes.bravery, 0);
    assert.equal(app.saved().roster[1].attributes.bravery, 1, "the chosen lower-level virtue bonus is applied once to its own knight");
  }
  {
    const app = boot(state => {
      state.claimedRewards["knight-1:1:virtue:+1 Fortitude"] = true;
      state.claimedRewards["knight-1:2:virtue:+1 Bravery"] = true;
      state.pendingBattle = { nodeId: "stone-30", monster: "Test Boss", level: 2, roll: 1 };
    });
    await app.click(app.get("#resolveVictory"));
    assert.equal(app.saved().pendingRewardChoice, null, "an entirely exhausted pool settles without an empty choice modal");
    assert.equal(app.get("#rewardChoiceModal").classList.contains("hidden"), true);
    assert.equal(app.saved().roster[0].rewards.length, 0);
    assert.equal(app.saved().nodes.find(node => node.id === "stone-30").cleared, true);
  }
  {
    const app = boot();
    const id = app.availableIds[0];
    assert.equal(app.rules.ROSEGRAAL_FINISH_NODE_IDS.includes(id), false);
    await app.click(app.node(id));
    await app.click(app.node(id));
    await app.click(app.get("#resolveVictory"));
    assert.equal(app.saved().status, "active", "an ordinary completed node does not win the campaign");
    assert.equal(app.get("#continueWithergraal").classList.contains("hidden"), true);
  }
  {
    const app = boot(state => { state.nodes.find(node => node.id === "stone-50").cleared = true; });
    assert.equal(app.saved().status, "won", "loading a legacy active save with one V endpoint recognizes its victory");
    assert.equal(app.saved().stage, "rosegraal", "recognizing an old victory does not switch stages");
    assert.equal(app.get("#continueWithergraal").classList.contains("hidden"), false);
    await app.click(app.get("#continueWithergraal"));
    assert.equal(app.saved().stage, "withergraal");
    assert.equal(app.saved().sharedRevives, 20);
  }
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
    let app = boot();
    await app.click(app.get("#toggleLinkEditor"));
    await app.click(app.node("stone-01"));
    await app.click(app.node("stone-02"));
    await app.click(app.node("stone-02"));
    await app.click(app.node("stone-01"));
    await app.click(app.node("stone-04"));
    const editedGraph = app.saved().nodes.map(({ id, links }) => ({ id, links }));
    assert.ok(editedGraph.find(node => node.id === "stone-01").links.includes("stone-02"), "manual editing adds a new edge");
    assert.equal(editedGraph.find(node => node.id === "stone-01").links.includes("stone-04"), false, "manual editing removes an existing edge");
    app = app.reload();
    assert.deepEqual(app.saved().nodes.map(({ id, links }) => ({ id, links })), editedGraph, "reloading preserves added and removed edges");
    await app.click(app.get("#newRun"));
    await app.click(app.get(".knight-choice"));
    await app.click(app.get("#startRun"));
    assert.deepEqual(app.saved().nodes.map(({ id, links }) => ({ id, links })), editedGraph, "a new run inherits the manually edited graph");
    app = app.reload();
    assert.deepEqual(app.saved().nodes.map(({ id, links }) => ({ id, links })), editedGraph, "the inherited graph also survives a reload");
  }
  for (const resetStage of ["rosegraal", "withergraal"]) {
    let app = boot(state => {
      state.stage = resetStage;
      state.postgame = resetStage === "withergraal";
      for (const [a, b] of [["stone-01", "stone-02"], ["wither-stone-01", "wither-stone-02"]]) {
        state.nodes.find(node => node.id === a).links.push(b);
        state.nodes.find(node => node.id === b).links.push(a);
      }
      state.linksEdited = true;
      state.defaultLinks = state.nodes.map(({ id, links }) => ({ id, links: [...links] }));
      state.nodes.find(node => node.id === "stone-01").cleared = true;
      state.sharedRevives = 42;
      state.graalSighs = 3;
      state.roster[0].gold = 29;
      state.roster[0].notes = "保留我的战役记录";
      state.rewards.push({ title: "已领取", text: "保留奖励" });
      state.history.push({ type: "test-progress", at: 123 });
    });
    const run = () => app.saved().slots.find(slot => slot.id === app.saved().activeSlotId).state;
    const graph = value => value.nodes.map(({ id, links }) => ({ id, links }));
    const progress = value => {
      const { nodes, linksEdited, defaultLinks, updatedAt, ...fields } = value;
      return { ...fields, nodes: nodes.map(({ links, ...node }) => node) };
    };
    const before = run();
    const onResetStage = node => (node.id.startsWith("wither-") ? "withergraal" : "rosegraal") === resetStage;
    const otherStage = graph(before).filter(node => !onResetStage(node));
    await app.click(app.get("#resetLinks"));
    const after = run();
    assert.deepEqual(graph(after).filter(onResetStage), JSON.parse(JSON.stringify(app.rules.ALL_NODES.filter(onResetStage).map(({ id, links }) => ({ id, links })))), `${resetStage} reset restores the source map even when defaultLinks contains manual edits`);
    assert.deepEqual(graph(after).filter(node => !onResetStage(node)), otherStage, `${resetStage} reset leaves edits in the other stage intact`);
    assert.deepEqual(progress(after), progress(before), "reset preserves every campaign field and node completion flag");
    assert.equal(after.linksEdited, true, "edits in the other stage keep the custom graph enabled");
    assert.deepEqual(after.defaultLinks, graph(after), "new-run templates reflect the reset and the remaining edits");
    app = app.reload();
    assert.deepEqual(graph(run()), graph(after), "a reload does not resurrect the reset stage's old graph");
    await app.click(app.get("#newRun"));
    await app.click(app.get(".knight-choice"));
    await app.click(app.get("#startRun"));
    assert.deepEqual(graph(run()), graph(after), "new runs inherit the reset stage and the other stage's remaining edits");
  }
  {
    let app = boot(state => {
      state.nodes.find(node => node.id === "stone-01").links.push("stone-02");
      state.nodes.find(node => node.id === "stone-02").links.push("stone-01");
      state.linksEdited = true;
      state.defaultLinks = state.nodes.map(({ id, links }) => ({ id, links: [...links] }));
    });
    await app.click(app.get("#resetLinks"));
    assert.equal(app.saved().linksEdited, false, "reset clears the edit flag when all stages match the source map");
    assert.equal(app.saved().defaultLinks, undefined, "reset discards the old edited template when no custom edges remain");
    app = app.reload();
    assert.equal(app.saved().linksEdited, false, "the default graph remains default after a reload");
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
