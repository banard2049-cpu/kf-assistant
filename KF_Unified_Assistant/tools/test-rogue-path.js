const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../public/modules/rogue/data.js"), "utf8"), context);
const rules = context.window.KF_ROGUE_RULES;

assert.strictEqual(rules.NODES.length, 103, "the two printed maps should expose all printed nodes plus S");
assert.strictEqual(new Set(rules.NODES.map(node => node.id)).size, 103, "node ids must be unique");
assert.ok(rules.NODES.some(node => node.id === "S" && Math.abs(node.x - 149 / 993) < 1e-6 && Math.abs(node.y - 705 / 1404) < 1e-6), "S must match the printed center");
for (const node of rules.NODES) for (const link of node.links) assert.ok(rules.NODES.some(other => other.id === link), `${node.id} has an invalid link`);
assert.ok(rules.NODES.some(node => node.id === "S" && node.cleared === false), "manifest start node is not mutated by source data");
for (const level of [1, 2, 3, 4, 5]) {
  for (const kingdom of ["stone", "sunken"]) {
    for (let roll = 1; roll <= 10; roll += 1) {
      const result = rules.randomResult(level, kingdom, roll);
      assert.ok(result.monsterId && result.level >= 1 && result.level <= 4, `${level}/${kingdom}/${roll} is invalid`);
    }
  }
}
assert.equal(rules.NODES.find(node => node.id === "stone-14").level, 1);
assert.equal(rules.NODES.find(node => node.id === "stone-14").reward, "technique");
assert.deepEqual(rules.rewardOptions(1, "fleischritter", "technique"), ["Crunchy Batter", "Stick in Their Throat"]);
assert.equal(rules.genericReward(1, "fleischritter", "technique"), "Crunchy Batter");
assert.ok(rules.rewardOptions(2, "kara", "class").length > 1, "level 2 class cells must preserve all table choices");
assert.ok(rules.rewardOptions(4, "stoneface", "class").length > 1, "level 4 class cells must preserve all table choices");
// L2/L4 print two arc names per cell (both portrait forms); other levels print one.
for (const id of rules.KNIGHTS.map(knight => knight.id)) {
  for (const category of ["heroic", "peril"]) {
    for (const level of [2, 4]) assert.equal(rules.rewardOptions(level, id, category).length, 2, `${id} L${level} ${category} must offer both printed arcs`);
    for (const level of [1, 3, 5]) assert.equal(rules.rewardOptions(level, id, category).length, 1, `${id} L${level} ${category} must be a single printed arc`);
  }
}
// Multi-entry cells that were previously flattened into one string.
assert.deepEqual(rules.rewardOptions(1, "stoneface", "technique"), ["Unshakeable", "Get Clear!"]);
assert.deepEqual(rules.rewardOptions(3, "fleischritter", "technique"), ["Panflip", "Nothing Goes To Waste"]);
assert.deepEqual(rules.rewardOptions(4, "renholder", "technique"), ["Soulscorch", "Incandescent Aura"]);
assert.deepEqual(rules.rewardOptions(5, "renholder", "technique"), ["Final Flash", "Shadows Between Worlds"]);
assert.deepEqual(rules.rewardOptions(5, "ser-sonch", "technique"), ["Bastion", "Fleur de Bataille Style"]);
// Every technique cell offers two moves to choose between (none was flattened).
for (const id of rules.KNIGHTS.map(knight => knight.id)) {
  for (const level of [1, 2, 3, 4, 5]) assert.equal(rules.rewardOptions(level, id, "technique").length, 2, `${id} L${level} technique must offer two moves`);
}
assert.equal(rules.rewardOptions(3, "ser-ubar", "gear").length, 2, "ser-ubar L3 gear prints Rigid and Pliant variants");
assert.ok(rules.rewardOptions(2, "stoneface", "class").includes("Hammerthrow Momentum Technique"), "stoneface L2 class keeps the full Hammerthrow Momentum name");
const initial = rules.freshState();
assert.strictEqual(initial.status, "setup");
assert.strictEqual(initial.sharedRevives, 5);
assert.strictEqual(initial.graalSighs, 0);
assert.strictEqual(initial.nodes.filter(node => node.cleared).length, 1);
assert.deepEqual(initial.nodes.find(node => node.id === "S").links, ["stone-18", "stone-23", "stone-28", "stone-35"]);
assert.equal(initial.nodes.find(node => node.id === "stone-14").x, 200 / 993);
assert.equal(initial.nodes.find(node => node.id === "stone-14").y, 491 / 1404);
const normalized = rules.normalizeState({ ...initial, sharedRevives: -20, roster: [1, 2, 3, 4, 5] });
assert.strictEqual(normalized.sharedRevives, 0);
assert.strictEqual(normalized.graalSighs, 0);
assert.strictEqual(normalized.roster.length, 4);
const stale = rules.normalizeState({ ...initial, nodes: initial.nodes.map(node => ({ ...node, x: 0, y: 0, cleared: node.id === "S" })) });
const canonicalStart = stale.nodes.find(node => node.id === "S");
assert.equal(canonicalStart.x, 149 / 993, "saved coordinates must not override the printed S position");
assert.equal(canonicalStart.y, 705 / 1404, "saved coordinates must not override the printed S position");
console.log("rogue path tests passed");
