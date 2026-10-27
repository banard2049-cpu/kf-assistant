const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../public/modules/rogue/data.js"), "utf8"), context);
const rules = context.window.KF_ROGUE_RULES;

// The user's approved JSON is authoritative, independently of runtime data.
const approved = require("./rogue-map-approved-2026-10-27.json").nodes.filter(node => !node.id.startsWith("wither-"));
const routeId = (kingdom, number) => `${kingdom}-${String(number).padStart(2, "0")}`;
const expectedEdges = approved.flatMap(node => node.links.filter(id => node.id < id).map(id => [node.id,id]));
const expectedNeighbors = new Map(rules.NODES.map(node => [node.id, new Set()]));
for (const [a, b] of expectedEdges) {
  expectedNeighbors.get(a).add(b);
  expectedNeighbors.get(b).add(a);
}
const edgeKey = (a, b) => [a, b].sort().join("/");
const graphEdges = nodes => [...new Set(nodes.flatMap(node => node.links.map(id => edgeKey(node.id, id))))].sort();
const expectedEdgeKeys = expectedEdges.map(([a, b]) => edgeKey(a, b)).sort();
assert.equal(new Set(expectedEdgeKeys).size, expectedEdges.length, "the approved fixture must not repeat a path");
assert.deepEqual(graphEdges(rules.NODES), expectedEdgeKeys, "the complete basic graph must match the user's approved JSON");

assert.strictEqual(rules.NODES.length, 103, "the two printed maps should expose all printed nodes plus S");
assert.strictEqual(new Set(rules.NODES.map(node => node.id)).size, 103, "node ids must be unique");
assert.ok(rules.NODES.some(node => node.id === "S" && Math.abs(node.x - 149 / 993) < 1e-6 && Math.abs(node.y - 705 / 1404) < 1e-6), "S must match the printed center");
for (const node of rules.NODES) {
  assert.equal(new Set(node.links).size, node.links.length, `${node.id} repeats a link`);
  assert.ok(!node.links.includes(node.id), `${node.id} must not link to itself`);
  assert.deepEqual([...node.links].sort(), [...expectedNeighbors.get(node.id)].sort(), `${node.id} must have exactly its printed neighbors`);
  for (const link of node.links) {
    const other = rules.NODES.find(item => item.id === link);
    assert.ok(other, `${node.id} has an invalid link`);
    assert.ok(other.links.includes(node.id), `${node.id} / ${link} must be bidirectional`);
  }
}
const reachable = new Set(["S"]);
const queue = ["S"];
for (let index = 0; index < queue.length; index += 1) {
  for (const id of expectedNeighbors.get(queue[index])) if (!reachable.has(id)) {
    reachable.add(id);
    queue.push(id);
  }
}
assert.equal(reachable.size, 103, "all printed nodes must be reachable from S");
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
assert.deepEqual([...initial.nodes.find(node => node.id === "S").links].sort(), [...approved.find(node => node.id === "S").links].sort());
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

// Exercise unlocking against the independent fixture for every possible single
// cleared encounter. S remains completed, as it does in a real campaign.
const availableIds = state => [...state.nodes.filter(node => rules.isAvailable(state, node)).map(node => node.id)].sort();
const withOnlyCleared = id => {
  const state = rules.freshState();
  state.status = "active";
  state.nodes.forEach(node => { node.cleared = node.id === "S" || node.id === id; });
  return state;
};
for (const cleared of rules.NODES) {
  const state = withOnlyCleared(cleared.id);
  const expected = new Set([...expectedNeighbors.get("S"), ...expectedNeighbors.get(cleared.id)]);
  expected.delete("S");
  expected.delete(cleared.id);
  assert.deepEqual(availableIds(state), [...expected].sort(), `clearing ${cleared.id} must unlock exactly the adjacent encounters`);
}
const canReach = (state, id) => rules.isAvailable(state, state.nodes.find(node => node.id === id));
assert.ok(canReach(withOnlyCleared("stone-29"), "stone-30"), "the photographed stone-29 branch must unlock stone-30");
assert.ok(canReach(withOnlyCleared("stone-34"), "stone-42"), "the photographed stone-34 branch must unlock stone-42");
for (const [sunken, stone] of [[10,9],[13,14],[17,14],[30,35],[36,40],[36,45]]) {
  const a = routeId("sunken", sunken), b = routeId("stone", stone);
  assert.ok(canReach(withOnlyCleared(a), b), `${a} must unlock its cross-page neighbor ${b}`);
  assert.ok(canReach(withOnlyCleared(b), a), `${b} must unlock its cross-page neighbor ${a}`);
}
for (const [a, b] of [["sunken-36", "stone-40"], ["sunken-36", "stone-45"], ["stone-40", "stone-45"], ["sunken-30","sunken-36"]]) {
  assert.equal(canReach(withOnlyCleared(a), b), expectedNeighbors.get(a).has(b)||expectedNeighbors.get("S").has(b), "cross-page and badge-covered paths follow the approved graph");
}
for (const [cleared, skipped] of [["S", "stone-35"], ["sunken-01", "sunken-08"], ["sunken-02", "sunken-07"], ["stone-01", "stone-10"]]) {
  assert.equal(canReach(withOnlyCleared(cleared), skipped), false, `${cleared} must not skip directly to ${skipped}`);
}

const clone = value => JSON.parse(JSON.stringify(value));
const staleDefaults = clone(initial);
staleDefaults.defaultLinks = [{ id: "S", links: ["stone-35"] }];
staleDefaults.nodes.forEach(node => { node.links = []; });
const migratedDefaults = rules.normalizeState(staleDefaults);
assert.deepEqual(graphEdges(migratedDefaults.nodes), expectedEdgeKeys, "unedited old saves use the corrected printed graph");
assert.equal(migratedDefaults.defaultLinks, undefined, "stale defaultLinks must not be inherited by a new campaign");
assert.equal(migratedDefaults.linksEdited, false);

// New manual changes remain authoritative after the approved baseline migration.
const edited = clone(initial);
edited.linksEdited = true;
const removeEdge = (state, a, b) => {
  state.nodes.find(node => node.id === a).links = state.nodes.find(node => node.id === a).links.filter(id => id !== b);
  state.nodes.find(node => node.id === b).links = state.nodes.find(node => node.id === b).links.filter(id => id !== a);
};
removeEdge(edited, "sunken-33", "sunken-35");
removeEdge(edited, "stone-40", "stone-45");
edited.nodes.find(node => node.id === "sunken-01").links.push("sunken-02");
edited.nodes.find(node => node.id === "sunken-02").links.push("sunken-01");
edited.defaultLinks = [{ id: "S", links: [] }];
const editedEdgeKeys = graphEdges(edited.nodes);
const preserved = rules.normalizeState(edited);
assert.deepEqual(graphEdges(preserved.nodes), editedEdgeKeys, "manual edits after adopting the approved baseline must survive exactly");
for (const node of edited.nodes) assert.deepEqual(preserved.nodes.find(item => item.id === node.id).links, node.links, `${node.id} retains custom link order`);
assert.deepEqual(preserved.defaultLinks, preserved.nodes.map(node => ({ id: node.id, links: [...node.links] })), "new campaigns inherit the normalized custom graph");
assert.deepEqual(rules.normalizeState(preserved), preserved, "normalizing an edited graph twice is stable");
assert.deepEqual(graphEdges(rules.freshState().nodes), expectedEdgeKeys, "normalizing a custom save must not mutate bundled defaults");

const malformed = clone(initial);
malformed.linksEdited = true;
malformed.nodes.find(node => node.id === "sunken-01").links = ["sunken-01", "missing", "wither-S", "sunken-05", "sunken-05", 99, null];
malformed.nodes.find(node => node.id === "sunken-05").links = malformed.nodes.find(node => node.id === "sunken-05").links.filter(id => id !== "sunken-01");
malformed.nodes.find(node => node.id === "stone-01").links.push("stone-02");
const repaired = rules.normalizeState(malformed);
assert.deepEqual(repaired.nodes.find(node => node.id === "sunken-01").links, ["sunken-05"], "invalid, self and duplicate custom links are removed");
assert.ok(repaired.nodes.find(node => node.id === "sunken-05").links.includes("sunken-01"), "one-sided existing custom links are made bidirectional");
assert.ok(repaired.nodes.find(node => node.id === "stone-02").links.includes("stone-01"), "one-sided added custom links are made bidirectional");
assert.deepEqual(rules.normalizeState(repaired), repaired, "repairing malformed links is idempotent");

const rewardState=rules.freshState();
const rewardKnight={id:"reward-a",knightId:"ser-ubar",rewards:[]};
const otherKnight={id:"reward-b",knightId:"ser-ubar",rewards:[]};
const techNode={level:3,reward:"technique"};
let offered=rules.basicRewardOptions(rewardState,techNode,rewardKnight);
assert.equal(offered.length,6,"III techniques include both unclaimed options from each of I, II and III");
assert.deepEqual(offered.map(option=>option.level),[3,3,2,2,1,1]);
const lowerMove=offered.find(option=>option.level===1);
rewardState.claimedRewards[lowerMove.keys[0]]=true;
assert.equal(rules.basicRewardOptions(rewardState,techNode,rewardKnight).length,5,"claimed lower-level rewards are excluded");
assert.equal(rules.basicRewardOptions(rewardState,techNode,otherKnight).length,6,"each knight has an independent reward pool");
const virtueOptions=rules.basicRewardOptions(rewardState,{level:4,reward:"virtue"},rewardKnight);
const repeatedVirtues=virtueOptions.filter(option=>option.text==="+1 Tenacity & +1 Sagacity");
assert.equal(repeatedVirtues.length,2,"identical III/IV text represents two separately printed checkboxes");
assert.notEqual(repeatedVirtues[0].id,repeatedVirtues[1].id);
rewardState.claimedRewards[repeatedVirtues[0].keys[0]]=true;
assert.equal(rules.basicRewardOptions(rewardState,{level:4,reward:"virtue"},rewardKnight).filter(option=>option.text==="+1 Tenacity & +1 Sagacity").length,1);
let gearOptions=rules.basicRewardOptions(rewardState,{level:3,reward:"gear"},rewardKnight);
assert.equal(gearOptions.length,3);
const pairedGear=gearOptions.find(option=>option.level===3);
assert.equal(pairedGear.rewards.length,2,"Rigid/Pliant forms consume one selection");
rewardKnight.rewards.push({key:pairedGear.keys[1]});
gearOptions=rules.basicRewardOptions(rewardState,{level:3,reward:"gear"},rewardKnight);
assert.equal(gearOptions.some(option=>option.level===3),false,"a legacy claimed form consumes its entire printed checkbox");
assert.ok(rules.basicRewardOptions(rewardState,{level:1,reward:"class"},rewardKnight).every(option=>option.level===1),"lower nodes never offer higher-level rewards");
assert.equal(rules.basicRewardOptions(rewardState,{level:5,reward:"sigh"},rewardKnight).length,0,"Graal sighs do not use the knight reward table");
console.log("rogue path tests passed");
