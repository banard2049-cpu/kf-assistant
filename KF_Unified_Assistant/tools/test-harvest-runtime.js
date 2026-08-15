"use strict";

const assert = require("node:assert/strict");
const runtime = require("../public/data/harvest-runtime.js");

const copy = value => JSON.parse(JSON.stringify(value));

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

const knightA = "knight:alric";
const knightB = "knight:kara";
const squire = "squire:caelia";

const context = deepFreeze({
  expeditionId: "expedition:sunken:7",
  kingdom: "sunken",
  leaderKey: knightB,
  members: [
    { key: knightA, kind: "knight", name: "Alric", tier: "mob" },
    { key: squire, kind: "squire", name: "Caelia", tier: "vassal" },
    { key: knightB, kind: "knight", name: "Kara", tier: "vassal" },
  ],
});

const lootCard = (id, cardId, category) => ({
  id,
  catalogId: id,
  cardId,
  category,
  name: id,
  goldByTier: { mob: 1, vassal: 2, king: 3, devil: 4, dragon: 5 },
});

const data = deepFreeze({
  schemaVersion: 1,
  cards: [
    lootCard("loot:full-clash:1", 106700, "full-clash"),
    lootCard("loot:full-clash:2", 106701, "full-clash"),
    lootCard("loot:kingdom:1", 106704, "kingdom-gear"),
    lootCard("loot:kingdom:2", 106705, "kingdom-gear"),
    lootCard("loot:kingdom:3", 106706, "kingdom-gear"),
    lootCard("loot:kingdom:4", 106707, "kingdom-gear"),
    lootCard("loot:consumable:1", 106708, "consumable-gear"),
    lootCard("loot:upgrade:1", 106712, "upgrade"),
    lootCard("loot:upgrade:2", 106713, "upgrade"),
    lootCard("loot:upgrade:3", 106714, "upgrade"),
    lootCard("loot:upgrade:4", 106715, "upgrade"),
  ],
  gearCards: [
    {
      catalogId: "gear:sunken:ratwolves-blade",
      name: "Ratwolves Blade",
      tier: "mob",
      gearType: "weapon",
      rewardCategory: "kingdom-gear",
      kingdoms: ["sunken"],
    },
  ],
});

function apply(state, action, message) {
  const snapshot = copy(state);
  const next = runtime.applyHarvestAction(state, action, context, data);
  assert.deepEqual(state, snapshot, `${message}: transition mutated its input`);
  assert.notStrictEqual(next, state, `${message}: valid transition must return a new state`);
  return next;
}

function reject(state, action, message) {
  const snapshot = copy(state);
  const next = runtime.applyHarvestAction(state, action, context, data);
  assert.strictEqual(next, state, message);
  assert.deepEqual(state, snapshot, `${message}: rejected action mutated its input`);
  return state;
}

const viewOf = state => runtime.getHarvestView(state, context, data);
const lootByCatalog = (state, catalogId) => viewOf(state).loot.find(item => item.catalogId === catalogId);
const lootId = (state, catalogId) => lootByCatalog(state, catalogId)?.id;

function receipt(id, category, count, source = "encounter") {
  return {
    id,
    source,
    sourceRef: `${source}:resolution:7`,
    label: `${source} Scavenge`,
    requests: [{ id: `${id}:request`, kind: "category", category, count }],
  };
}

// The entire module is exercised through its three public functions.
let state = runtime.ensureHarvest(null, context, data);
assert.equal(state.schemaVersion, 1);
assert.deepEqual(runtime.ensureHarvest(state, context, data), state, "ensureHarvest must be value-idempotent");
let view = viewOf(state);
assert.equal(view.state.status, "collecting");
assert.deepEqual(view.loot, []);
assert.equal(view.commonQuota, 3, "two Knights and one Squire have three normal Common Goods choices");
assert.equal(view.canLock, false, "an empty Harvest cannot be completed from the always-visible sidebar");
assert.equal(view.canComplete, false);

// Source receipts are replay-safe and provide the only category/count authority.
const firstKingdomReceipt = receipt("receipt:encounter:kingdom", "kingdom-gear", 2);
state = apply(state, { type: "record-receipt", receipt: firstKingdomReceipt }, "record Encounter reward receipt");
reject(
  state,
  { type: "record-receipt", receipt: copy(firstKingdomReceipt) },
  "replaying the same receipt is an identity no-op",
);
reject(
  state,
  { type: "record-receipt", receipt: { ...firstKingdomReceipt, label: "forged replacement" } },
  "a receipt id cannot be reused with different content",
);
reject(
  state,
  { type: "add-loot-card", receiptId: firstKingdomReceipt.id, requestIndex: 0, catalogId: "loot:upgrade:1" },
  "Loot outside the receipt category is rejected",
);
state = apply(state, { type: "add-loot-card", receiptId: firstKingdomReceipt.id, requestIndex: 0, catalogId: "loot:kingdom:1" }, "add first Kingdom Loot");
state = apply(state, { type: "add-loot-card", receiptId: firstKingdomReceipt.id, requestIndex: 0, catalogId: "loot:kingdom:2" }, "add second Kingdom Loot");
reject(
  state,
  { type: "add-loot-card", receiptId: firstKingdomReceipt.id, requestIndex: 0, catalogId: "loot:kingdom:3" },
  "a receipt cannot exceed its card count",
);

const secondKingdomReceipt = receipt("receipt:aibp:kingdom", "kingdom-gear", 2, "aibp");
state = apply(state, { type: "record-receipt", receipt: secondKingdomReceipt }, "record AIBP reward receipt");
reject(
  state,
  { type: "add-loot-card", receiptId: secondKingdomReceipt.id, requestIndex: 0, catalogId: "loot:kingdom:1" },
  "one physical Loot card cannot satisfy two receipts",
);
state = apply(state, { type: "add-loot-card", receiptId: secondKingdomReceipt.id, requestIndex: 0, catalogId: "loot:kingdom:3" }, "add third Kingdom Loot");
state = apply(state, { type: "add-loot-card", receiptId: secondKingdomReceipt.id, requestIndex: 0, catalogId: "loot:kingdom:4" }, "add fourth Kingdom Loot");

const upgradeReceipt = receipt("receipt:map:upgrade", "upgrade", 4, "map");
state = apply(state, { type: "record-receipt", receipt: upgradeReceipt }, "record map reward receipt");
for (const catalogId of ["loot:upgrade:1", "loot:upgrade:2", "loot:upgrade:3", "loot:upgrade:4"]) {
  state = apply(state, { type: "add-loot-card", receiptId: upgradeReceipt.id, requestIndex: 0, catalogId }, `add ${catalogId}`);
}
const cancelledUpgradeId = lootId(state, "loot:upgrade:2");
state = apply(state, { type: "remove-loot-card", lootId: cancelledUpgradeId }, "cancel a Loot card before allocation");
assert.equal(lootByCatalog(state, "loot:upgrade:2"), undefined);
state = apply(state, { type: "add-loot-card", receiptId: upgradeReceipt.id, requestIndex: 0, catalogId: "loot:upgrade:2" }, "replace the cancelled physical card");
reject(state, { type: "remove-loot-card", lootId: "missing-loot" }, "removing an unknown Loot card is an identity no-op");

const consumableReceipt = receipt("receipt:story:consumable", "consumable-gear", 1, "map");
state = apply(state, { type: "record-receipt", receipt: consumableReceipt }, "record Consumable reward receipt");
state = apply(state, { type: "add-loot-card", receiptId: consumableReceipt.id, requestIndex: 0, catalogId: "loot:consumable:1" }, "add Consumable Loot");
assert.equal(viewOf(state).loot.length, 9);

// Successful Free Roam adds one choice per successful Knight; Squires add quota but never own Loot.
state = apply(state, { type: "set-activity", memberKey: knightA, activity: "free-roam-success" }, "mark Alric Free Roam success");
assert.equal(viewOf(state).commonQuota, 4);
state = apply(state, { type: "set-activity", memberKey: knightB, activity: "free-roam-success" }, "mark Kara Free Roam success");
assert.equal(viewOf(state).commonQuota, 5);
reject(state, { type: "set-activity", memberKey: knightB, activity: "free-roam-success" }, "setting the same activity twice is an identity no-op");
reject(state, { type: "set-activity", memberKey: squire, activity: "free-roam-success" }, "a Squire cannot receive a Knight activity result");

for (const [catalogId, memberKey] of [
  ["loot:kingdom:1", knightA],
  ["loot:kingdom:2", knightB],
  ["loot:kingdom:3", knightA],
  ["loot:kingdom:4", knightB],
  ["loot:upgrade:1", knightA],
]) {
  state = apply(state, { type: "set-common-owner", lootId: lootId(state, catalogId), memberKey }, `choose ${catalogId} as Common Good`);
}
reject(
  state,
  { type: "set-common-owner", lootId: lootId(state, "loot:upgrade:2"), memberKey: knightB },
  "Common Goods cannot exceed the derived quota",
);
reject(
  state,
  { type: "set-common-owner", lootId: lootId(state, "loot:kingdom:1"), memberKey: squire },
  "a Squire contributes quota but cannot own a Common Good",
);

const cancelledCommonId = lootId(state, "loot:upgrade:1");
state = apply(state, { type: "set-common-owner", lootId: cancelledCommonId, memberKey: "" }, "empty memberKey cancels a Common Good choice");
assert.equal(lootByCatalog(state, "loot:upgrade:1").allocation, "unassigned");
state = apply(state, { type: "set-common-owner", lootId: cancelledCommonId, memberKey: knightA }, "restore a cancelled Common Good choice");
const clearedCommonId = lootId(state, "loot:kingdom:4");
state = apply(state, { type: "clear-common-owner", lootId: clearedCommonId }, "explicit clear action also cancels a Common Good choice");
reject(state, { type: "clear-common-owner", lootId: clearedCommonId }, "clearing an unassigned card is an identity no-op");
state = apply(state, { type: "set-common-owner", lootId: clearedCommonId, memberKey: knightB }, "restore explicitly cleared Common Good");

// Lock requires both the party quota and each Knight's personal one/two-card entitlement.
const reassignedCommonId = lootId(state, "loot:kingdom:2");
state = apply(state, { type: "set-common-owner", lootId: reassignedCommonId, memberKey: knightA }, "temporarily move Kara's personal Common Good");
assert.equal(viewOf(state).canLock, false);
assert.deepEqual(viewOf(state).unmetKnights, [{ memberKey: knightB, required: 2, chosen: 1 }]);
reject(state, { type: "lock-common-goods" }, "global quota alone cannot bypass a Knight's personal entitlement");
state = apply(state, { type: "set-common-owner", lootId: reassignedCommonId, memberKey: knightB }, "restore Kara's personal Common Good");

// Lock requires all receipts filled and exactly the derived Common Goods count.
assert.equal(viewOf(state).canLock, true);
state = apply(state, { type: "lock-common-goods" }, "lock Common Goods");
view = viewOf(state);
assert.equal(view.state.status, "drafting");
assert.equal(view.commonChosen, 5);
const scrapChoices = ["loot:upgrade:4", "loot:consumable:1", "loot:upgrade:3", "loot:upgrade:2"];
for (const [index, catalogId] of scrapChoices.entries()) {
  assert.equal(viewOf(state).nextScrapMember.key, [knightB, knightA, knightB, knightA][index], "Spare Scrap drafting starts with the captain and skips Squires");
  state = apply(state, { type: "draft-scrap", lootId: lootId(state, catalogId) }, `draft ${catalogId} as Spare Scrap`);
}
assert.equal(viewOf(state).state.status, "allocating");
assert.deepEqual(scrapChoices.map(catalogId => lootByCatalog(state, catalogId).assignedMemberKey), [knightB, knightA, knightB, knightA]);
reject(
  state,
  { type: "set-common-owner", lootId: lootId(state, "loot:kingdom:1"), memberKey: knightB },
  "Common Goods ownership is frozen after lock",
);
reject(state, { type: "remove-loot-card", lootId: lootId(state, "loot:kingdom:1") }, "Loot cannot be removed after lock");
reject(state, { type: "set-activity", memberKey: knightA, activity: "quest" }, "activity authority is frozen after lock");

// Redemption legality depends on allocation kind, and completion requires every active Loot card.
const commonOne = lootId(state, "loot:kingdom:1");
const firstScrap = lootId(state, "loot:consumable:1");
reject(state, { type: "set-redemption", lootId: commonOne, kind: "gamble" }, "a Common Good cannot be gambled");
reject(
  state,
  { type: "set-redemption", lootId: firstScrap, kind: "gear", catalogId: "gear:sunken:ratwolves-blade" },
  "Spare Scrap cannot redeem gear",
);
state = apply(
  state,
  { type: "set-redemption", lootId: commonOne, kind: "gear", catalogId: "gear:sunken:ratwolves-blade", note: "Ratwolves Blade" },
  "redeem Common Good for gear",
);
for (const catalogId of ["loot:kingdom:2", "loot:kingdom:3", "loot:kingdom:4", "loot:upgrade:1"]) {
  state = apply(state, { type: "set-redemption", lootId: lootId(state, catalogId), kind: "gold" }, `redeem ${catalogId} for gold`);
}
state = apply(state, { type: "set-redemption", lootId: firstScrap, kind: "gamble", note: "赌博结算后已按结果处理" }, "gamble Spare Scrap");
for (const catalogId of ["loot:upgrade:2", "loot:upgrade:3", "loot:upgrade:4"]) {
  state = apply(state, { type: "set-redemption", lootId: lootId(state, catalogId), kind: "gold" }, `redeem ${catalogId} Spare Scrap for gold`);
}
assert.equal(viewOf(state).canComplete, true, "Harvest completes only after every active Loot card is legally redeemed");
state = apply(state, { type: "set-redemption", lootId: commonOne, kind: "gear", catalogId: "", note: "" }, "store an incomplete gear redemption draft");
assert.equal(viewOf(state).canComplete, false, "an empty equipment/manual result cannot finish Harvest");
reject(state, { type: "complete" }, "Harvest rejects an incomplete equipment redemption");
state = apply(state, { type: "set-redemption", lootId: commonOne, kind: "gear", catalogId: "gear:sunken:ratwolves-blade", note: "Ratwolves Blade" }, "finish the equipment redemption record");
assert.equal(viewOf(state).canComplete, true);

state = apply(state, { type: "complete", at: "2026-08-14T08:00:00.000Z" }, "complete Harvest");
assert.equal(viewOf(state).state.status, "complete");
reject(state, { type: "complete", at: "2026-08-14T08:01:00.000Z" }, "completed Harvest cannot complete twice");
state = apply(state, { type: "reopen" }, "reopen completed Harvest for redemption correction");
assert.equal(viewOf(state).state.status, "allocating");
assert.equal(viewOf(state).canComplete, true, "reopen preserves legal allocations and redemptions");
reject(state, { type: "reopen" }, "an allocating Harvest cannot be reopened again");

state = apply(state, { type: "reset" }, "reset for the next expedition");
view = viewOf(state);
assert.equal(view.state.status, "collecting");
assert.deepEqual(view.loot, []);
assert.deepEqual(view.receipts, []);
reject(state, { type: "set-activity", memberKey: knightA, activity: "quest" }, "only the expedition leader can be the Quest Knight");
state = apply(state, { type: "set-activity", memberKey: knightB, activity: "quest" }, "the expedition leader may be the Quest Knight");
assert.equal(viewOf(state).state.activities[knightB], "quest");
reject(state, { type: "unknown-action" }, "unknown actions are identity no-ops");

// When Loot is scarcer than the personal entitlement total, available Common
// Goods must be spread across as many Knights as possible rather than stacked
// on one recipient.
const shortContext = deepFreeze({
  leaderKey: "knight:one",
  members: ["one", "two", "three", "four"].map(id => ({ key: `knight:${id}`, kind: "knight", name: id, tier: "mob" })),
});
let shortState = runtime.ensureHarvest(null, shortContext, data);
const shortReceipt = { id: "receipt:short", source: "aibp", label: "Scavenge 3", requests: [{ kind: "choice", count: 3 }] };
shortState = runtime.applyHarvestAction(shortState, { type: "record-receipt", receipt: shortReceipt }, shortContext, data);
for (const catalogId of ["loot:kingdom:1", "loot:kingdom:2", "loot:kingdom:3"]) shortState = runtime.applyHarvestAction(shortState, { type: "add-loot-card", receiptId: shortReceipt.id, requestIndex: 0, catalogId }, shortContext, data);
for (const item of shortState.loot) shortState = runtime.applyHarvestAction(shortState, { type: "set-common-owner", lootId: item.id, memberKey: "knight:one" }, shortContext, data);
let shortView = runtime.getHarvestView(shortState, shortContext, data);
assert.equal(shortView.canLock, false);
assert.deepEqual(shortView.unmetKnights, [{ memberKey: "", label: "不同骑士", required: 3, chosen: 1 }]);
for (const [index, memberKey] of ["knight:one", "knight:two", "knight:three"].entries()) shortState = runtime.applyHarvestAction(shortState, { type: "set-common-owner", lootId: shortState.loot[index].id, memberKey }, shortContext, data);
shortView = runtime.getHarvestView(shortState, shortContext, data);
assert.equal(shortView.canLock, true, "scarce Common Goods cover different Knights first");

// A finite Loot source can run out. Remaining Scavenge is ignored instead of
// permanently blocking Harvest.
let exhausted = runtime.ensureHarvest(null, context, data);
const overdrawnClash = {
  id: "receipt:clash:overdrawn",
  source: "aibp",
  label: "Full Clash Scavenge 3",
  requests: [{ id: "clash", kind: "clash", clashPhase: "full", count: 3 }],
};
exhausted = apply(exhausted, { type: "record-receipt", receipt: overdrawnClash }, "record an overdrawn clash receipt");
for (const catalogId of ["loot:full-clash:1", "loot:full-clash:2"]) {
  exhausted = apply(exhausted, { type: "add-loot-card", receiptId: overdrawnClash.id, requestIndex: 0, catalogId }, `take finite ${catalogId}`);
}
let exhaustedView = viewOf(exhausted);
assert.equal(exhaustedView.outstanding, 0, "unavailable physical Loot cards do not leave an impossible open slot");
assert.equal(exhaustedView.ignoredSlots, 1);
assert.equal(exhaustedView.receipts[0].requests[0].ignoredSlots, 1);
for (const [catalogId, memberKey] of [["loot:full-clash:1", knightA], ["loot:full-clash:2", knightB]]) {
  exhausted = apply(exhausted, { type: "set-common-owner", lootId: lootId(exhausted, catalogId), memberKey }, `assign exhausted-source ${catalogId}`);
}
assert.equal(viewOf(exhausted).canLock, true, "source exhaustion counts as a resolved receipt");

function completedSingleReceipt(receiptId) {
  const singleReceipt = receipt(receiptId, "consumable-gear", 1);
  let current = runtime.ensureHarvest(null, context, data);
  current = apply(current, { type: "record-receipt", receipt: singleReceipt }, `${receiptId}: record`);
  current = apply(current, { type: "add-loot-card", receiptId, requestIndex: 0, catalogId: "loot:consumable:1" }, `${receiptId}: add card`);
  current = apply(current, { type: "set-common-owner", lootId: lootId(current, "loot:consumable:1"), memberKey: knightA }, `${receiptId}: assign owner`);
  current = apply(current, { type: "lock-common-goods" }, `${receiptId}: lock`);
  current = apply(current, { type: "set-redemption", lootId: lootId(current, "loot:consumable:1"), kind: "gold" }, `${receiptId}: redeem`);
  current = apply(current, { type: "complete", at: "2026-08-14T09:00:00.000Z" }, `${receiptId}: complete`);
  return { current, singleReceipt };
}

// A late receipt safely reopens collection and invalidates allocations made
// from the old, incomplete Loot pool.
let late = runtime.ensureHarvest(null, context, data);
const firstLateReceipt = receipt("receipt:late:first", "consumable-gear", 1);
late = apply(late, { type: "record-receipt", receipt: firstLateReceipt }, "late setup: record first receipt");
late = apply(late, { type: "add-loot-card", receiptId: firstLateReceipt.id, requestIndex: 0, catalogId: "loot:consumable:1" }, "late setup: add first card");
late = apply(late, { type: "set-common-owner", lootId: lootId(late, "loot:consumable:1"), memberKey: knightA }, "late setup: assign first card");
late = apply(late, { type: "lock-common-goods" }, "late setup: lock allocation");
const lateReceipt = receipt("receipt:late:upgrade", "upgrade", 1);
late = apply(late, { type: "record-receipt", receipt: lateReceipt }, "record a receipt after allocation started");
assert.equal(viewOf(late).state.status, "collecting");
assert.equal(lootByCatalog(late, "loot:consumable:1").allocation, "unassigned");
assert.equal(lootByCatalog(late, "loot:consumable:1").resolution, null);
assert.equal(viewOf(late).outstanding, 1);
assert.equal(viewOf(late).canComplete, false);

// A receipt from the next expedition starts a fresh aggregate, while replaying
// an old receipt id remains an idempotent no-op.
const completedCycle = completedSingleReceipt("receipt:cycle:one");
reject(completedCycle.current, { type: "record-receipt", receipt: completedCycle.singleReceipt }, "an old receipt replay does not reset a completed cycle");
const nextCycleReceipt = receipt("receipt:cycle:two", "consumable-gear", 1);
const nextCycle = apply(completedCycle.current, { type: "record-receipt", receipt: nextCycleReceipt }, "a new receipt starts the next Harvest aggregate");
assert.equal(viewOf(nextCycle).state.status, "collecting");
assert.deepEqual(viewOf(nextCycle).receipts.map(item => item.id), [nextCycleReceipt.id]);
assert.deepEqual(viewOf(nextCycle).loot, []);
assert.equal(viewOf(nextCycle).receipts[0].requests[0].availableCards.some(card => card.catalogId === "loot:consumable:1"), true, "the finite deck is fresh for the next expedition");

assert.deepEqual(context, copy(context), "runtime never mutates integration context");
assert.deepEqual(data, copy(data), "runtime never mutates catalogs");

console.log("harvest runtime: receipts, finite Loot, activities, Common Goods, Spare Scrap, redemption and correction verified");
