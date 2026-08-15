"use strict";

const assert = require("node:assert/strict");
const data = require("../public/data/character-runtime-data.js");
const runtime = require("../public/data/character-runtime.js");

const copy = value => JSON.parse(JSON.stringify(value));
const random = () => 0.25;
const knightKey = "knight:sheet-1";
const squireKey = "squire:caelia";
const descriptors = [
  { key: knightKey, kind: "knight", sourceId: "paracelsa", name: "Paracelsa", inventory: ["旅行斗篷"] },
  { key: squireKey, kind: "squire", sourceId: "caelia", name: "凯莉娅" },
];

let manager = runtime.ensureManager(null, descriptors, data, random);

assert.equal(manager.schemaVersion, 4);
assert.deepEqual(manager.knightPool, {}, "the Knight Pool is shared at manager scope");
assert.deepEqual(manager.outpost, { mercenaries: [], merchantGear: [] }, "new campaigns start with an empty shared outpost");
assert.equal(manager.activeMemberKey, knightKey);
assert.deepEqual(Object.keys(manager.members), [knightKey, squireKey]);
assert.equal(manager.members[knightKey].hand.ready.length, 5, "knight must load exactly five starting techniques");
assert.equal(new Set(manager.members[knightKey].hand.ready.map(card => card.catalogId)).size, 5);
assert.ok(manager.members[knightKey].equipment.some(item => item.name === "Knighves"));
assert.ok(manager.members[knightKey].equipment.some(item => item.name === "旅行斗篷"));
assert.ok(manager.members[knightKey].equipment.every(item => Object.hasOwn(item, "catalogId") && item.upgrade === null));
assert.ok(manager.members[knightKey].equipment.every(item => item.ready === true && item.discarded === false && item.charges === 0));
assert.equal(manager.members[squireKey].attributes.vigor.max, 9, "squire defaults to its lowest available tier");
assert.equal(manager.mettle.drawPile.length, 18, "Mettle starts with eighteen cards");
assert.equal(new Set(manager.mettle.drawPile).size, 18);

const paracelsa = data.knights.paracelsa;
const alternateProfession = paracelsa.professions.find(card => card.id !== manager.members[knightKey].professionId);
const alternatePortrait = paracelsa.portraits.find(card => card.id !== manager.members[knightKey].portraitId);
const alternateHeroic = paracelsa.heroicArcs.find(card => card.id !== manager.members[knightKey].curves.heroic.optionId);
const alternatePeril = paracelsa.perilArcs.find(card => card.id !== manager.members[knightKey].curves.peril.optionId);
manager = runtime.setKnightCard(manager, knightKey, "profession", alternateProfession.id, data);
manager = runtime.setKnightCard(manager, knightKey, "portrait", alternatePortrait.id, data);
manager = runtime.setKnightCard(manager, knightKey, "heroic", alternateHeroic.id, data);
manager = runtime.setKnightCard(manager, knightKey, "peril", alternatePeril.id, data);
assert.equal(manager.members[knightKey].professionId, alternateProfession.id);
assert.equal(manager.members[knightKey].portraitId, alternatePortrait.id);
assert.equal(manager.members[knightKey].curves.heroic.optionId, alternateHeroic.id);
assert.equal(manager.members[knightKey].curves.peril.optionId, alternatePeril.id);

manager = runtime.setResource(manager, knightKey, "vigor", "max", 8);
manager = runtime.setResource(manager, knightKey, "vigor", "current", 12);
assert.deepEqual(manager.members[knightKey].attributes.vigor, { current: 8, max: 8 }, "current resources cannot exceed max");

const firstTechnique = manager.members[knightKey].hand.ready[0];
manager = runtime.moveTechnique(manager, knightKey, firstTechnique.id, "cooldown");
assert.equal(manager.members[knightKey].hand.ready.length, 4);
assert.equal(manager.members[knightKey].hand.cooldown[0].id, firstTechnique.id);

const vassalTier = data.squires.caelia.tiers.find(tier => tier.tier === "vassal");
manager = runtime.setSquireTier(manager, squireKey, vassalTier.id, data);
assert.equal(manager.members[squireKey].attributes.vigor.max, 10);
assert.equal(manager.members[squireKey].attributes.heat.max, 4);

const beforeDraw = new Set(manager.mettle.drawPile);
manager = runtime.drawMettle(manager, data, random);
assert.ok(beforeDraw.has(manager.mettle.current.cardId));
assert.equal(manager.mettle.drawPile.length, 17);
manager = runtime.finishMettle(manager, data, random);
assert.equal(manager.mettle.current, null);
assert.equal(manager.mettle.drawPile.length + manager.mettle.discardPile.length, 18, "Mettle cards must not disappear");

const mobUpgrade = Object.values(data.mettle.cards).find(card => card.tier === "mob" && card.clue === "mystic");
const priorMysticStarterCount = manager.mettle.drawPile.concat(manager.mettle.discardPile)
  .map(id => data.mettle.cards[id]).filter(card => card.clue === "mystic" && card.tier === "starter").length;
manager = runtime.setSquireLeads(manager, 5);
manager = runtime.upgradeMettle(manager, mobUpgrade.id, data, random);
const activeIds = manager.mettle.drawPile.concat(manager.mettle.discardPile);
assert.ok(activeIds.includes(mobUpgrade.id), "unlocked card joins the Mettle deck");
assert.equal(activeIds.length, 18, "a Mettle upgrade replaces one lower-tier card");
assert.equal(manager.squireLeads, 0, "a Mettle upgrade costs five squire leads");
assert.equal(activeIds.map(id => data.mettle.cards[id]).filter(card => card.clue === "mystic" && card.tier === "starter").length, priorMysticStarterCount - 1);

function card(id, cardId, name, overrides = {}) {
  return {
    id,
    catalogId: id,
    cardId,
    name,
    backName: `${name} Back`,
    tier: "mob",
    art: null,
    backArt: null,
    ...overrides,
  };
}

const catalogData = copy(data);
catalogData.gearCards = [
  card("gear.weapon.alpha", 51001, "Alpha Blade", { gearType: "weapon", isMerchant: false, upgradeable: true }),
  card("gear.weapon.beta", 51002, "Beta Blade", { gearType: "weapon", isMerchant: false, upgradeable: true }),
  card("gear.armor.alpha", 51003, "Alpha Plate", { gearType: "armor", isMerchant: false, upgradeable: true }),
  card("gear.unknown.alpha", 51004, "Odd Relic", { gearType: "unknown", isMerchant: false, upgradeable: true }),
  card("gear.merchant.alpha", 51005, "Merchant Spear", { gearType: "weapon", isMerchant: true, upgradeable: false }),
  card("gear.merchant.beta", 51006, "Merchant Axe", { gearType: "weapon", isMerchant: true, upgradeable: false }),
  card("gear.merchant.armor", 51007, "Merchant Mail", { gearType: "armor", isMerchant: true, upgradeable: false }),
  card("gear.merchant.vassal", 51008, "Vassal Halberd", { gearType: "weapon", tier: "vassal", isMerchant: true, upgradeable: false }),
  card("gear.merchant.king", 51009, "Royal Plate", { gearType: "armor", tier: "king", isMerchant: true, upgradeable: false }),
];
catalogData.mercenaries = [
  card("mercenary.bard.1", 54001, "Bard", { nameZhCn: "吟游诗人", kingdom: "both", level: 1 }),
  card("mercenary.bard.2", 54002, "Bard", { nameZhCn: "吟游诗人", kingdom: "both", level: 2 }),
  card("mercenary.healer.1", 54003, "Healer", { nameZhCn: "医师", kingdom: "both", level: 1 }),
  card("mercenary.mage.1", 54004, "Mage", { nameZhCn: "法师", kingdom: "both", level: 1 }),
  card("mercenary.rogue.1", 54005, "Rogue", { nameZhCn: "盗贼", kingdom: "both", level: 1 }),
  card("mercenary.warrior.1", 54006, "Warrior", { nameZhCn: "战士", kingdom: "both", level: 1 }),
  card("mercenary.swamp.1", 54007, "Swamp Strider", { nameZhCn: "沼地摆渡人", kingdom: "sunken", level: 1 }),
  card("mercenary.ruin.1", 54008, "Ruin Stalker", { nameZhCn: "废墟追踪者", kingdom: "stone", level: 1 }),
];
catalogData.gearUpgrades = [
  card("upgrade.weapon.edge", 52001, "Keen Edge", { targetType: "weapon" }),
  card("upgrade.weapon.balance", 52002, "Perfect Balance", { targetType: "weapon" }),
  card("upgrade.armor.ward", 52003, "Runic Ward", { targetType: "armor" }),
];
catalogData.knights.paracelsa.techniques = [
  card("technique.paracelsa.one", 53001, "First Form", { front: "First Form", back: "First Riposte" }),
  card("technique.paracelsa.two", 53002, "Second Form", { front: "Second Form", back: "Second Riposte" }),
  card("technique.paracelsa.three", 53003, "Third Form", { front: "Third Form", back: "Third Riposte" }),
  card("technique.paracelsa.four", 53004, "Fourth Form", { front: "Fourth Form", back: "Fourth Riposte" }),
];
catalogData.knights.paracelsa.startingTechniqueIds = ["technique.paracelsa.one", "technique.paracelsa.two"];
catalogData.knights.paracelsa.portraits = catalogData.knights.paracelsa.portraits.map((portrait, index) => ({ ...portrait, cardRefresh: index + 1 }));
catalogData.knights.paracelsa.startingGear = {
  ...catalogData.knights.paracelsa.startingGear,
  fixed: [catalogData.gearCards[0], catalogData.gearCards[3]],
};

const catalogDescriptors = [
  { key: knightKey, kind: "knight", sourceId: "paracelsa", name: "Paracelsa", inventory: [] },
  { key: squireKey, kind: "squire", sourceId: "caelia", name: "凯莉娅" },
];
const freshCatalogManager = () => runtime.ensureManager(null, catalogDescriptors, catalogData, random);

// v1 migration keeps gameplay state, zones, instance ids, and custom entries.
const legacy = freshCatalogManager();
legacy.schemaVersion = 1;
legacy.squireLeads = 9;
legacy.members[knightKey].attributes.vigor = { current: 3, max: 7 };
legacy.members[knightKey].equipment[0] = {
  id: "legacy-gear",
  cardId: catalogData.gearCards[0].cardId,
  name: catalogData.gearCards[0].name,
  ready: false,
  chargeTokens: 4,
};
legacy.members[knightKey].equipment.push({ id: "legacy-custom-gear", name: "Old Keepsake", ready: true });
const legacyTechnique = legacy.members[knightKey].hand.ready.shift();
delete legacyTechnique.catalogId;
legacyTechnique.art = { obsolete: true };
legacy.members[knightKey].hand.cooldown.push(legacyTechnique);
legacy.members[knightKey].hand.ready.push({
  id: "legacy-custom-technique",
  name: "Old Trick",
  front: "Old Trick",
  back: "",
  custom: true,
  art: { obsolete: true },
});
const legacyMettle = copy(legacy.mettle);
const migrated = runtime.ensureManager(legacy, catalogDescriptors, catalogData, random);
assert.equal(migrated.schemaVersion, 4);
assert.deepEqual(migrated.knightPool, {});
assert.equal(migrated.squireLeads, 9);
assert.deepEqual(migrated.members[knightKey].attributes.vigor, { current: 3, max: 7 });
assert.deepEqual(migrated.mettle, legacyMettle);
assert.equal(migrated.members[knightKey].equipment[0].id, "legacy-gear");
assert.equal(migrated.members[knightKey].equipment[0].catalogId, "gear.weapon.alpha");
assert.equal(migrated.members[knightKey].equipment[0].ready, false);
assert.equal(migrated.members[knightKey].equipment[0].discarded, false);
assert.equal(migrated.members[knightKey].equipment[0].charges, 4);
assert.equal(Object.hasOwn(migrated.members[knightKey].equipment[0], "chargeTokens"), false);
assert.equal(migrated.members[knightKey].equipment[0].upgrade, null);
assert.equal(migrated.members[knightKey].equipment.at(-1).catalogId, null);
assert.equal(migrated.members[knightKey].equipment.at(-1).name, "Old Keepsake");
assert.equal(migrated.members[knightKey].hand.cooldown[0].id, legacyTechnique.id);
assert.equal(migrated.members[knightKey].hand.cooldown[0].catalogId, "technique.paracelsa.one");
assert.equal(Object.hasOwn(migrated.members[knightKey].hand.cooldown[0], "art"), false);
assert.equal(migrated.members[knightKey].hand.ready.at(-1).catalogId, null);
assert.equal(migrated.members[knightKey].hand.ready.at(-1).name, "Old Trick");
assert.deepEqual(runtime.ensureManager(migrated, catalogDescriptors, catalogData, random), migrated, "v4 normalization must be idempotent");
const v2 = copy(legacy);
v2.schemaVersion = 2;
v2.knightPool = { opening: 120, magic: -3 };
v2.members[knightKey].equipment[0].ready = true;
v2.members[knightKey].equipment[0].discarded = true;
const migratedV2 = runtime.ensureManager(v2, catalogDescriptors, catalogData, random);
assert.equal(migratedV2.schemaVersion, 4);
assert.deepEqual(migratedV2.knightPool, { opening: 99, magic: 0 });
assert.equal(migratedV2.members[knightKey].equipment[0].ready, false, "discarded state wins over contradictory legacy ready state");
assert.equal(migratedV2.members[knightKey].equipment[0].discarded, true);
assert.equal(migratedV2.members[knightKey].equipment[0].charges, 4);
const invalidPortrait = copy(migratedV2);
invalidPortrait.members[knightKey].portraitId = "portrait:removed-from-catalog";
const portraitRecovered = runtime.ensureManager(invalidPortrait, catalogDescriptors, catalogData, random);
assert.equal(portraitRecovered.members[knightKey].portraitId, catalogData.knights.paracelsa.portrait.id, "removed portrait ids fall back to the source portrait");
assert.throws(
  () => runtime.ensureManager({ ...migrated, schemaVersion: 5 }, catalogDescriptors, catalogData, random),
  /Unsupported character manager schema version: 5/,
);

// The outpost catalog exposes default, kingdom-specific, unlocked, and tier-gated mercenaries.
const baseOutpostContext = {
  kingdom: "sunken",
  leaderTier: 1,
  memberTiers: { [knightKey]: "vassal", [squireKey]: "mob" },
  unlockedMercenaryIds: [],
};
const mercenaryOption = (view, catalogId) => view.mercenaries.find(item => item.card.catalogId === catalogId);
const merchantOption = (view, catalogId) => view.merchantGear.find(item => item.card.catalogId === catalogId);
let outpostManager = freshCatalogManager();
let outpostView = runtime.getOutpostView(outpostManager, baseOutpostContext, catalogData);
assert.equal(mercenaryOption(outpostView, "mercenary.bard.1").disabled, false, "level-one mercenaries are available by default");
assert.equal(mercenaryOption(outpostView, "mercenary.bard.2").reason, "not-unlocked");
assert.equal(mercenaryOption(outpostView, "mercenary.swamp.1").disabled, false, "the current kingdom's special mercenary is available");
assert.equal(mercenaryOption(outpostView, "mercenary.ruin.1").reason, "wrong-kingdom");
const stoneView = runtime.getOutpostView(outpostManager, { ...baseOutpostContext, kingdom: "stone" }, catalogData);
assert.equal(mercenaryOption(stoneView, "mercenary.swamp.1").reason, "wrong-kingdom");
assert.equal(mercenaryOption(stoneView, "mercenary.ruin.1").disabled, false);
const selectedSunkenSpecial = runtime.applyOutpostAction(outpostManager, { type: "assign-mercenary", catalogId: "mercenary.swamp.1", memberKey: knightKey }, baseOutpostContext, catalogData);
const switchedKingdomView = runtime.getOutpostView(selectedSunkenSpecial, { ...baseOutpostContext, kingdom: "stone" }, catalogData);
assert.ok(mercenaryOption(switchedKingdomView, "mercenary.swamp.1").assignment, "a now-invalid selected special remains visible to the UI for individual cancellation");
assert.equal(mercenaryOption(switchedKingdomView, "mercenary.swamp.1").reason, "wrong-kingdom");
const unlockedButLowTierView = runtime.getOutpostView(outpostManager, {
  ...baseOutpostContext,
  unlockedMercenaryIds: ["mercenary.bard.2"],
}, catalogData);
assert.equal(mercenaryOption(unlockedButLowTierView, "mercenary.bard.2").reason, "tier-too-high");
const advancedOutpostContext = {
  ...baseOutpostContext,
  leaderTier: 3,
  unlockedMercenaryIds: ["mercenary.bard.2"],
};
outpostView = runtime.getOutpostView(outpostManager, advancedOutpostContext, catalogData);
assert.equal(mercenaryOption(outpostView, "mercenary.bard.2").disabled, false, "an unlocked card is available once its level is allowed");

// Only current expedition members may receive outpost cards, even if an older member snapshot remains persisted.
const staleMemberManager = copy(outpostManager);
staleMemberManager.members["knight:retired"] = { ...copy(staleMemberManager.members[knightKey]), key: "knight:retired", name: "Retired Knight" };
const activeMemberView = runtime.getOutpostView(staleMemberManager, { ...advancedOutpostContext, memberKeys: [knightKey, squireKey] }, catalogData);
assert.deepEqual(activeMemberView.members.map(member => member.key), [knightKey, squireKey]);
assert.strictEqual(
  runtime.applyOutpostAction(staleMemberManager, { type: "assign-mercenary", catalogId: "mercenary.bard.1", memberKey: "knight:retired" }, { ...advancedOutpostContext, memberKeys: [knightKey, squireKey] }, catalogData),
  staleMemberManager,
  "persisted members outside the current expedition cannot receive outpost cards",
);

// Up to four distinct mercenary roles may be hired; a higher card replaces the same named role.
for (const catalogId of ["mercenary.bard.1", "mercenary.healer.1", "mercenary.mage.1", "mercenary.rogue.1"]) {
  outpostManager = runtime.applyOutpostAction(outpostManager, { type: "assign-mercenary", catalogId, memberKey: knightKey }, advancedOutpostContext, catalogData);
}
assert.equal(outpostManager.outpost.mercenaries.length, 4);
outpostView = runtime.getOutpostView(outpostManager, advancedOutpostContext, catalogData);
assert.equal(mercenaryOption(outpostView, "mercenary.warrior.1").reason, "mercenary-limit");
assert.strictEqual(
  runtime.applyOutpostAction(outpostManager, { type: "assign-mercenary", catalogId: "mercenary.warrior.1", memberKey: squireKey }, advancedOutpostContext, catalogData),
  outpostManager,
  "a fifth mercenary is an identity no-op",
);
const sameNameReplaced = runtime.applyOutpostAction(outpostManager, {
  type: "assign-mercenary", catalogId: "mercenary.bard.2", memberKey: squireKey,
}, advancedOutpostContext, catalogData);
assert.equal(sameNameReplaced.outpost.mercenaries.length, 4);
assert.equal(sameNameReplaced.outpost.mercenaries.some(item => item.catalogId === "mercenary.bard.1"), false);
assert.deepEqual(
  sameNameReplaced.outpost.mercenaries.find(item => item.catalogId === "mercenary.bard.2"),
  { catalogId: "mercenary.bard.2", assignedMemberKey: squireKey },
);

// Merchant equipment availability follows each member's hierarchy and squire restrictions.
outpostView = runtime.getOutpostView(freshCatalogManager(), baseOutpostContext, catalogData);
let memberOption = merchantOption(outpostView, "gear.merchant.alpha").loanOptions.find(item => item.assignedMemberKey === squireKey && item.ownerMemberKey === knightKey);
assert.equal(memberOption.disabled, false, "a merchant weapon may be offered as a confirmed knight-owned squire loan");
memberOption = merchantOption(outpostView, "gear.merchant.armor").loanOptions.find(item => item.assignedMemberKey === squireKey && item.ownerMemberKey === knightKey);
assert.deepEqual({ disabled: memberOption.disabled, reason: memberOption.reason }, { disabled: true, reason: "squire-weapon-only" });
memberOption = merchantOption(outpostView, "gear.merchant.vassal").memberOptions.find(item => item.key === knightKey);
assert.equal(memberOption.disabled, false, "a vassal-tier member may take vassal merchant gear");
memberOption = merchantOption(outpostView, "gear.merchant.king").loanOptions.find(item => item.assignedMemberKey === squireKey && item.ownerMemberKey === knightKey);
assert.deepEqual({ disabled: memberOption.disabled, reason: memberOption.reason }, { disabled: true, reason: "squire-weapon-only" });
memberOption = merchantOption(outpostView, "gear.merchant.king").memberOptions.find(item => item.key === knightKey);
assert.deepEqual({ disabled: memberOption.disabled, reason: memberOption.reason }, { disabled: true, reason: "tier-too-high" });

// Assigning, reassigning, and cancelling merchant gear keeps member equipment synchronized.
let gearOutpostManager = freshCatalogManager();
const originalKnightEquipment = gearOutpostManager.members[knightKey].equipment.map(item => item.catalogId);
gearOutpostManager = runtime.applyOutpostAction(gearOutpostManager, {
  type: "assign-merchant-gear", catalogId: "gear.merchant.alpha", memberKey: knightKey,
}, baseOutpostContext, catalogData);
assert.equal(gearOutpostManager.members[knightKey].equipment.filter(item => item.catalogId === "gear.merchant.alpha").length, 1);
assert.equal(gearOutpostManager.members[squireKey].equipment.some(item => item.catalogId === "gear.merchant.alpha"), false);
gearOutpostManager = runtime.applyOutpostAction(gearOutpostManager, {
  type: "assign-merchant-gear", catalogId: "gear.merchant.alpha", memberKey: squireKey, ownerMemberKey: knightKey, squireEligibilityConfirmed: true,
}, baseOutpostContext, catalogData);
assert.equal(gearOutpostManager.members[knightKey].equipment.some(item => item.catalogId === "gear.merchant.alpha"), false);
assert.equal(gearOutpostManager.members[squireKey].equipment.filter(item => item.catalogId === "gear.merchant.alpha").length, 1);
gearOutpostManager = runtime.applyOutpostAction(gearOutpostManager, {
  type: "assign-merchant-gear", catalogId: "gear.merchant.alpha", memberKey: "",
}, baseOutpostContext, catalogData);
assert.equal(gearOutpostManager.outpost.merchantGear.length, 0);
assert.equal(Object.values(gearOutpostManager.members).some(member => member.equipment.some(item => item.catalogId === "gear.merchant.alpha")), false);
assert.deepEqual(gearOutpostManager.members[knightKey].equipment.map(item => item.catalogId), originalKnightEquipment);

// A squire rejects armor and replacing its one merchant weapon removes the earlier weapon everywhere.
let squireOutpostManager = freshCatalogManager();
assert.strictEqual(
  runtime.applyOutpostAction(squireOutpostManager, { type: "assign-merchant-gear", catalogId: "gear.merchant.armor", memberKey: squireKey, ownerMemberKey: knightKey, squireEligibilityConfirmed: true }, baseOutpostContext, catalogData),
  squireOutpostManager,
);
assert.strictEqual(
  runtime.applyOutpostAction(squireOutpostManager, { type: "assign-merchant-gear", catalogId: "gear.merchant.alpha", memberKey: squireKey, ownerMemberKey: knightKey }, baseOutpostContext, catalogData),
  squireOutpostManager,
  "a squire loan requires an explicit card-face Squire Attribute confirmation",
);
squireOutpostManager = runtime.applyOutpostAction(squireOutpostManager, {
  type: "assign-merchant-gear", catalogId: "gear.merchant.alpha", memberKey: squireKey, ownerMemberKey: knightKey, squireEligibilityConfirmed: true,
}, baseOutpostContext, catalogData);
const firstSquireWeaponState = squireOutpostManager;
squireOutpostManager = runtime.applyOutpostAction(squireOutpostManager, {
  type: "assign-merchant-gear", catalogId: "gear.merchant.beta", memberKey: squireKey, ownerMemberKey: knightKey, squireEligibilityConfirmed: true,
}, baseOutpostContext, catalogData);
assert.notStrictEqual(squireOutpostManager, firstSquireWeaponState);
assert.deepEqual(squireOutpostManager.outpost.merchantGear, [{ catalogId: "gear.merchant.beta", ownerMemberKey: knightKey, assignedMemberKey: squireKey, squireEligibilityConfirmed: true }]);
assert.equal(squireOutpostManager.members[squireKey].equipment.some(item => item.catalogId === "gear.merchant.alpha"), false);
assert.equal(squireOutpostManager.members[squireKey].equipment.filter(item => item.catalogId === "gear.merchant.beta").length, 1);

// Removing a squire from the active expedition clears the loan and its provenance-tracked equipment.
const withoutSquire = runtime.ensureManager(squireOutpostManager, catalogDescriptors.filter(item => item.key !== squireKey), catalogData, random);
assert.equal(withoutSquire.outpost.merchantGear.length, 0);
assert.equal(withoutSquire.members[squireKey].equipment.some(item => item.outpostAssignment), false);

// Persisted v3 outpost state migrates once, reconciles equipment once, and is then idempotent.
const persistedV3Outpost = copy(sameNameReplaced);
persistedV3Outpost.schemaVersion = 3;
persistedV3Outpost.outpost.merchantGear.push({ catalogId: "gear.merchant.alpha", assignedMemberKey: knightKey });
const ensuredOutpost = runtime.ensureManager(persistedV3Outpost, catalogDescriptors, catalogData, random);
assert.equal(ensuredOutpost.schemaVersion, 4);
assert.deepEqual(ensuredOutpost.outpost.merchantGear, [{ catalogId: "gear.merchant.alpha", ownerMemberKey: knightKey, assignedMemberKey: knightKey, squireEligibilityConfirmed: false }]);
assert.equal(ensuredOutpost.members[knightKey].equipment.filter(item => item.catalogId === "gear.merchant.alpha").length, 1);
assert.equal(ensuredOutpost.members[knightKey].equipment.find(item => item.catalogId === "gear.merchant.alpha").outpostAssignment.catalogId, "gear.merchant.alpha");
assert.deepEqual(
  runtime.ensureManager(ensuredOutpost, catalogDescriptors, catalogData, random),
  ensuredOutpost,
  "ensureManager must be idempotent for persisted outpost assignments",
);

// Clearing removes outpost selections and only their synchronized merchant equipment.
let clearableOutpost = runtime.setLoadoutSelection(ensuredOutpost, knightKey, { kind: "equipment", targetId: null, catalogId: "gear.merchant.beta" }, catalogData);
const retainedEquipment = Object.fromEntries(Object.entries(clearableOutpost.members).map(([key, member]) => [
  key, member.equipment.filter(item => !item.outpostAssignment).map(item => item.catalogId),
]));
clearableOutpost = runtime.applyOutpostAction(clearableOutpost, { type: "clear-outpost" }, advancedOutpostContext, catalogData);
assert.deepEqual(clearableOutpost.outpost, { mercenaries: [], merchantGear: [] });
assert.equal(Object.values(clearableOutpost.members).some(member => member.equipment.some(item => item.outpostAssignment)), false);
assert.equal(clearableOutpost.members[knightKey].equipment.some(item => item.catalogId === "gear.merchant.beta"), true, "clearing outpost provenance must not delete pre-existing merchant gear");
assert.deepEqual(Object.fromEntries(Object.entries(clearableOutpost.members).map(([key, member]) => [key, member.equipment.map(item => item.catalogId)])), retainedEquipment);
assert.strictEqual(runtime.applyOutpostAction(clearableOutpost, { type: "clear-outpost" }, advancedOutpostContext, catalogData), clearableOutpost);
const alreadyOwnedView = runtime.getOutpostView(clearableOutpost, baseOutpostContext, catalogData);
assert.equal(merchantOption(alreadyOwnedView, "gear.merchant.beta").memberOptions.find(item => item.key === knightKey).reason, "already-owned");
assert.strictEqual(
  runtime.applyOutpostAction(clearableOutpost, { type: "assign-merchant-gear", catalogId: "gear.merchant.beta", memberKey: squireKey, ownerMemberKey: knightKey, squireEligibilityConfirmed: true }, baseOutpostContext, catalogData),
  clearableOutpost,
  "an already-owned physical merchant card cannot be moved or deleted through the shop assignment path",
);
const retiredOwnerManager = copy(clearableOutpost);
retiredOwnerManager.members["knight:retired"] = { ...copy(retiredOwnerManager.members[knightKey]), key: "knight:retired", name: "Retired Owner" };
retiredOwnerManager.members[knightKey].equipment = retiredOwnerManager.members[knightKey].equipment.filter(item => item.catalogId !== "gear.merchant.beta");
assert.strictEqual(
  runtime.applyOutpostAction(retiredOwnerManager, { type: "assign-merchant-gear", catalogId: "gear.merchant.beta", memberKey: knightKey }, { ...baseOutpostContext, memberKeys: [knightKey, squireKey] }, catalogData),
  retiredOwnerManager,
  "a physical merchant card held by an inactive member remains unavailable to the active party",
);

// Every invalid or ineffectual outpost action preserves the exact manager reference.
const invalidOutpostManager = freshCatalogManager();
for (const action of [
  { type: "unknown-outpost-action" },
  { type: "assign-mercenary", catalogId: "missing", memberKey: knightKey },
  { type: "assign-mercenary", catalogId: "mercenary.bard.2", memberKey: knightKey },
  { type: "assign-mercenary", catalogId: "mercenary.bard.1", memberKey: "missing-member" },
  { type: "assign-mercenary", catalogId: "mercenary.bard.1", memberKey: "" },
  { type: "assign-merchant-gear", catalogId: "missing", memberKey: knightKey },
  { type: "assign-merchant-gear", catalogId: "gear.merchant.king", memberKey: knightKey },
  { type: "assign-merchant-gear", catalogId: "gear.merchant.armor", memberKey: squireKey },
  { type: "assign-merchant-gear", catalogId: "gear.merchant.alpha", memberKey: "missing-member" },
  { type: "assign-merchant-gear", catalogId: "gear.merchant.alpha", memberKey: "" },
]) {
  assert.strictEqual(runtime.applyOutpostAction(invalidOutpostManager, action, baseOutpostContext, catalogData), invalidOutpostManager);
}

// Catalog queries expose availability without leaking validation into the UI.
let catalogManager = freshCatalogManager();
let knight = catalogManager.members[knightKey];
assert.deepEqual(knight.hand.ready.map(item => item.catalogId), ["technique.paracelsa.one", "technique.paracelsa.two"]);
let options = runtime.getLoadoutOptions(catalogManager, knightKey, { kind: "equipment", targetId: null }, catalogData);
assert.equal(options.find(item => item.catalogId === "gear.weapon.alpha").disabled, true);
assert.equal(options.find(item => item.catalogId === "gear.weapon.beta").disabled, false);
options = runtime.getLoadoutOptions(catalogManager, knightKey, { kind: "equipment", targetId: knight.equipment[0].id }, catalogData);
assert.equal(options.find(item => item.catalogId === "gear.weapon.alpha").selected, true);
assert.equal(options.find(item => item.catalogId === "gear.weapon.alpha").disabled, false);
options = runtime.getLoadoutOptions(catalogManager, knightKey, { kind: "technique", targetId: null }, catalogData);
assert.equal(options.find(item => item.catalogId === "technique.paracelsa.one").disabled, true);
assert.equal(options.find(item => item.catalogId === "technique.paracelsa.three").disabled, false);
assert.deepEqual(runtime.getLoadoutOptions(catalogManager, squireKey, { kind: "technique", targetId: null }, catalogData), []);
const withLegacySelections = copy(catalogManager);
withLegacySelections.members[knightKey].equipment.push({ id: "custom-gear", catalogId: null, cardId: 51002, name: "Old Keepsake", ready: true, upgrade: null });
withLegacySelections.members[knightKey].hand.discard.push({ id: "custom-technique", catalogId: null, cardId: 53003, front: "Old Trick", back: "", name: "Old Trick", custom: true });
options = runtime.getLoadoutOptions(withLegacySelections, knightKey, { kind: "equipment", targetId: "custom-gear" }, catalogData);
assert.deepEqual(options[0], { catalogId: "", label: "自定义：Old Keepsake", card: null, selected: true, disabled: false, reason: "" });
assert.equal(runtime.getLoadoutOptions(withLegacySelections, knightKey, { kind: "equipment", targetId: null }, catalogData).some(item => item.catalogId === ""), false);
options = runtime.getLoadoutOptions(withLegacySelections, knightKey, { kind: "technique", targetId: "custom-technique" }, catalogData);
assert.deepEqual(options[0], { catalogId: "", label: "自定义：Old Trick", card: null, selected: true, disabled: false, reason: "" });
assert.equal(runtime.getLoadoutOptions(withLegacySelections, knightKey, { kind: "technique", targetId: null }, catalogData).some(item => item.catalogId === ""), false);

// Add and replace equipment by catalog id; duplicate and invalid writes are identity no-ops.
let before = catalogManager;
let beforeSnapshot = copy(before);
let changed = runtime.setLoadoutSelection(before, knightKey, { kind: "equipment", targetId: null, catalogId: "gear.weapon.beta" }, catalogData);
assert.notStrictEqual(changed, before);
assert.deepEqual(before, beforeSnapshot, "successful equipment selection must not mutate its input");
let addedGear = changed.members[knightKey].equipment.at(-1);
assert.equal(addedGear.catalogId, "gear.weapon.beta");
assert.equal(addedGear.ready, true);
assert.equal(addedGear.discarded, false);
assert.equal(addedGear.charges, 0);
assert.equal(addedGear.upgrade, null);
assert.strictEqual(runtime.setLoadoutSelection(changed, knightKey, { kind: "equipment", targetId: null, catalogId: "gear.weapon.beta" }, catalogData), changed);
assert.strictEqual(runtime.setLoadoutSelection(changed, knightKey, { kind: "equipment", targetId: null, catalogId: "missing" }, catalogData), changed);

catalogManager = freshCatalogManager();
const originalGear = catalogManager.members[knightKey].equipment[0];
catalogManager = runtime.toggleEquipment(catalogManager, knightKey, originalGear.id);
catalogManager = runtime.applyRuntimeAction(catalogManager, knightKey, { kind: "change-equipment-charges", equipmentId: originalGear.id, delta: 3 }, catalogData);
before = catalogManager;
beforeSnapshot = copy(before);
changed = runtime.setLoadoutSelection(before, knightKey, { kind: "equipment", targetId: originalGear.id, catalogId: "gear.weapon.beta" }, catalogData);
assert.deepEqual(before, beforeSnapshot);
assert.equal(changed.members[knightKey].equipment[0].id, originalGear.id);
assert.equal(changed.members[knightKey].equipment[0].catalogId, "gear.weapon.beta");
assert.equal(changed.members[knightKey].equipment[0].ready, false);
assert.equal(changed.members[knightKey].equipment[0].discarded, false);
assert.equal(changed.members[knightKey].equipment[0].charges, 3, "catalog replacement preserves runtime charge state");
assert.strictEqual(runtime.setLoadoutSelection(changed, knightKey, { kind: "equipment", targetId: originalGear.id, catalogId: "gear.unknown.alpha" }, catalogData), changed, "an already equipped catalog card cannot be duplicated");

// Technique replacement preserves instance identity, zone, and position.
catalogManager = freshCatalogManager();
const techniqueToReplace = catalogManager.members[knightKey].hand.ready[0];
catalogManager = runtime.moveTechnique(catalogManager, knightKey, techniqueToReplace.id, "cooldown");
before = catalogManager;
beforeSnapshot = copy(before);
changed = runtime.setLoadoutSelection(before, knightKey, { kind: "technique", targetId: techniqueToReplace.id, catalogId: "technique.paracelsa.three" }, catalogData);
assert.deepEqual(before, beforeSnapshot);
assert.equal(changed.members[knightKey].hand.cooldown.length, 1);
assert.equal(changed.members[knightKey].hand.cooldown[0].id, techniqueToReplace.id);
assert.equal(changed.members[knightKey].hand.cooldown[0].catalogId, "technique.paracelsa.three");
assert.strictEqual(runtime.setLoadoutSelection(changed, knightKey, { kind: "technique", targetId: techniqueToReplace.id, catalogId: "technique.paracelsa.two" }, catalogData), changed, "a technique already in another zone cannot be duplicated");
const withFourthTechnique = runtime.setLoadoutSelection(changed, knightKey, { kind: "technique", targetId: null, catalogId: "technique.paracelsa.four" }, catalogData);
assert.equal(withFourthTechnique.members[knightKey].hand.ready.at(-1).catalogId, "technique.paracelsa.four");
assert.strictEqual(runtime.setLoadoutSelection(withFourthTechnique, squireKey, { kind: "technique", targetId: null, catalogId: "technique.paracelsa.three" }, catalogData), withFourthTechnique);

// One compatible upgrade may be attached; unknown gear accepts either target type.
catalogManager = freshCatalogManager();
const weaponId = catalogManager.members[knightKey].equipment.find(item => item.catalogId === "gear.weapon.alpha").id;
const unknownId = catalogManager.members[knightKey].equipment.find(item => item.catalogId === "gear.unknown.alpha").id;
before = catalogManager;
beforeSnapshot = copy(before);
changed = runtime.setLoadoutSelection(before, knightKey, { kind: "upgrade", targetId: weaponId, catalogId: "upgrade.weapon.edge" }, catalogData);
assert.notStrictEqual(changed, before);
assert.deepEqual(before, beforeSnapshot);
assert.equal(changed.members[knightKey].equipment.find(item => item.id === weaponId).upgrade.catalogId, "upgrade.weapon.edge");
let replacedUpgrade = runtime.setLoadoutSelection(changed, knightKey, { kind: "upgrade", targetId: weaponId, catalogId: "upgrade.weapon.balance" }, catalogData);
assert.equal(replacedUpgrade.members[knightKey].equipment.find(item => item.id === weaponId).upgrade.catalogId, "upgrade.weapon.balance");
assert.strictEqual(runtime.setLoadoutSelection(replacedUpgrade, knightKey, { kind: "upgrade", targetId: weaponId, catalogId: "upgrade.armor.ward" }, catalogData), replacedUpgrade);
assert.strictEqual(runtime.setLoadoutSelection(replacedUpgrade, knightKey, { kind: "upgrade", targetId: unknownId, catalogId: "upgrade.weapon.balance" }, catalogData), replacedUpgrade, "one upgrade catalog card cannot be attached twice");
let unknownUpgraded = runtime.setLoadoutSelection(replacedUpgrade, knightKey, { kind: "upgrade", targetId: unknownId, catalogId: "upgrade.armor.ward" }, catalogData);
assert.equal(unknownUpgraded.members[knightKey].equipment.find(item => item.id === unknownId).upgrade.catalogId, "upgrade.armor.ward");

// Compatible equipment replacement retains an upgrade; incompatible replacement is atomic no-op.
catalogManager = freshCatalogManager();
const replaceId = catalogManager.members[knightKey].equipment.find(item => item.catalogId === "gear.weapon.alpha").id;
catalogManager = runtime.setLoadoutSelection(catalogManager, knightKey, { kind: "upgrade", targetId: replaceId, catalogId: "upgrade.weapon.edge" }, catalogData);
changed = runtime.setLoadoutSelection(catalogManager, knightKey, { kind: "equipment", targetId: replaceId, catalogId: "gear.weapon.beta" }, catalogData);
assert.equal(changed.members[knightKey].equipment.find(item => item.id === replaceId).upgrade.catalogId, "upgrade.weapon.edge");
assert.strictEqual(runtime.setLoadoutSelection(changed, knightKey, { kind: "equipment", targetId: replaceId, catalogId: "gear.armor.alpha" }, catalogData), changed);
assert.strictEqual(runtime.setLoadoutSelection(changed, knightKey, { kind: "equipment", targetId: replaceId, catalogId: "gear.merchant.alpha" }, catalogData), changed);

// Merchant gear cannot receive upgrades, detach accepts empty/null, and removal removes the nested upgrade.
let merchantState = runtime.setLoadoutSelection(freshCatalogManager(), knightKey, { kind: "equipment", targetId: null, catalogId: "gear.merchant.alpha" }, catalogData);
const merchantId = merchantState.members[knightKey].equipment.find(item => item.catalogId === "gear.merchant.alpha").id;
assert.strictEqual(runtime.setLoadoutSelection(merchantState, knightKey, { kind: "upgrade", targetId: merchantId, catalogId: "upgrade.weapon.edge" }, catalogData), merchantState);
options = runtime.getLoadoutOptions(merchantState, knightKey, { kind: "upgrade", targetId: merchantId }, catalogData);
assert.ok(options.filter(item => item.catalogId).every(item => item.disabled));
let detachable = runtime.setLoadoutSelection(freshCatalogManager(), knightKey, { kind: "upgrade", targetId: weaponId, catalogId: "upgrade.weapon.edge" }, catalogData);
let detached = runtime.setLoadoutSelection(detachable, knightKey, { kind: "upgrade", targetId: weaponId, catalogId: "" }, catalogData);
assert.equal(detached.members[knightKey].equipment.find(item => item.id === weaponId).upgrade, null);
assert.strictEqual(runtime.setLoadoutSelection(detached, knightKey, { kind: "upgrade", targetId: weaponId, catalogId: null }, catalogData), detached);
const upgradedForRemoval = runtime.setLoadoutSelection(freshCatalogManager(), knightKey, { kind: "upgrade", targetId: weaponId, catalogId: "upgrade.weapon.edge" }, catalogData);
const afterRemoval = runtime.removeEquipment(upgradedForRemoval, knightKey, weaponId);
assert.equal(afterRemoval.members[knightKey].equipment.some(item => item.id === weaponId), false);

// Upgrade options include detach, enforce compatibility, and expose cross-equipment occupancy.
options = runtime.getLoadoutOptions(unknownUpgraded, knightKey, { kind: "upgrade", targetId: unknownId }, catalogData);
assert.equal(options[0].catalogId, "");
assert.equal(options[0].selected, false);
assert.equal(options.find(item => item.catalogId === "upgrade.weapon.balance").disabled, true);
assert.equal(options.find(item => item.catalogId === "upgrade.armor.ward").selected, true);

// Refresh is one rule-level transition: return the first X cooldown cards, then move every delay card into cooldown.
let actionManager = freshCatalogManager();
actionManager = runtime.setLoadoutSelection(actionManager, knightKey, { kind: "technique", targetId: null, catalogId: "technique.paracelsa.three" }, catalogData);
actionManager = runtime.setLoadoutSelection(actionManager, knightKey, { kind: "technique", targetId: null, catalogId: "technique.paracelsa.four" }, catalogData);
const actionTechniques = Object.fromEntries(actionManager.members[knightKey].hand.ready.map(item => [item.catalogId, item.id]));
actionManager = runtime.moveTechnique(actionManager, knightKey, actionTechniques["technique.paracelsa.one"], "cooldown");
actionManager = runtime.moveTechnique(actionManager, knightKey, actionTechniques["technique.paracelsa.two"], "cooldown");
actionManager = runtime.moveTechnique(actionManager, knightKey, actionTechniques["technique.paracelsa.three"], "delay");
actionManager = runtime.moveTechnique(actionManager, knightKey, actionTechniques["technique.paracelsa.four"], "discard");
before = actionManager;
beforeSnapshot = copy(before);
actionManager = runtime.applyRuntimeAction(before, knightKey, { kind: "advance-technique-zone" }, catalogData);
assert.deepEqual(before, beforeSnapshot, "rule-level technique transitions must not mutate their input");
assert.deepEqual(actionManager.members[knightKey].hand.ready.map(item => item.catalogId), ["technique.paracelsa.one"]);
assert.deepEqual(actionManager.members[knightKey].hand.cooldown.map(item => item.catalogId), ["technique.paracelsa.two", "technique.paracelsa.three"], "delay cards enter cooldown only after cooldown refresh");
assert.deepEqual(actionManager.members[knightKey].hand.delay, []);
assert.deepEqual(actionManager.members[knightKey].hand.discard.map(item => item.catalogId), ["technique.paracelsa.four"], "refresh never returns discarded cards");
actionManager = runtime.applyRuntimeAction(actionManager, knightKey, { kind: "advance-techniques", cardRefresh: 1 }, catalogData);
assert.deepEqual(actionManager.members[knightKey].hand.ready.map(item => item.catalogId), ["technique.paracelsa.one", "technique.paracelsa.two"]);
assert.deepEqual(actionManager.members[knightKey].hand.cooldown.map(item => item.catalogId), ["technique.paracelsa.three"]);
actionManager = runtime.applyRuntimeAction(actionManager, knightKey, { kind: "return-all-techniques" }, catalogData);
assert.deepEqual(actionManager.members[knightKey].hand.ready.map(item => item.catalogId), [
  "technique.paracelsa.one", "technique.paracelsa.two", "technique.paracelsa.three", "technique.paracelsa.four",
]);
assert.ok(["cooldown", "delay", "discard"].every(zone => actionManager.members[knightKey].hand[zone].length === 0));
assert.strictEqual(runtime.applyRuntimeAction(actionManager, knightKey, { kind: "return-all-techniques" }, catalogData), actionManager, "an already reset hand is an identity no-op");

// Explicit refresh is a safe fallback while older portrait catalogs do not expose cardRefresh.
const noRefreshData = copy(catalogData);
for (const portrait of noRefreshData.knights.paracelsa.portraits) delete portrait.cardRefresh;
let fallbackRefresh = freshCatalogManager();
const fallbackIds = fallbackRefresh.members[knightKey].hand.ready.map(item => item.id);
fallbackRefresh = runtime.moveTechnique(fallbackRefresh, knightKey, fallbackIds[0], "cooldown");
fallbackRefresh = runtime.moveTechnique(fallbackRefresh, knightKey, fallbackIds[1], "cooldown");
fallbackRefresh = runtime.applyRuntimeAction(fallbackRefresh, knightKey, { kind: "advance-technique-zone", cardRefresh: 2 }, noRefreshData);
assert.equal(fallbackRefresh.members[knightKey].hand.ready.length, 2);
assert.equal(fallbackRefresh.members[knightKey].hand.cooldown.length, 0);

// Equipment stays owned while exhausted/discarded; its nested upgrade follows it and charge counts remain bounded.
let equipmentManager = freshCatalogManager();
const runtimeGearId = equipmentManager.members[knightKey].equipment[0].id;
equipmentManager = runtime.setLoadoutSelection(equipmentManager, knightKey, { kind: "upgrade", targetId: runtimeGearId, catalogId: "upgrade.weapon.edge" }, catalogData);
const attachedUpgrade = copy(equipmentManager.members[knightKey].equipment[0].upgrade);
equipmentManager = runtime.applyRuntimeAction(equipmentManager, knightKey, { kind: "toggle-equipment-ready", equipmentId: runtimeGearId }, catalogData);
assert.equal(equipmentManager.members[knightKey].equipment[0].ready, false, "ready=false and discarded=false represents an exhausted/sideways card");
assert.equal(equipmentManager.members[knightKey].equipment[0].discarded, false);
equipmentManager = runtime.applyRuntimeAction(equipmentManager, knightKey, { kind: "toggle-equipment-discarded", equipmentId: runtimeGearId }, catalogData);
assert.equal(equipmentManager.members[knightKey].equipment.length, 2, "discarding gear must not remove ownership");
assert.equal(equipmentManager.members[knightKey].equipment[0].discarded, true);
assert.equal(equipmentManager.members[knightKey].equipment[0].ready, false);
assert.deepEqual(equipmentManager.members[knightKey].equipment[0].upgrade, attachedUpgrade, "an attached upgrade follows its gear state");
assert.strictEqual(runtime.applyRuntimeAction(equipmentManager, knightKey, { kind: "toggle-equipment-ready", equipmentId: runtimeGearId }, catalogData), equipmentManager, "discarded gear cannot be readied");
equipmentManager = runtime.applyRuntimeAction(equipmentManager, knightKey, { kind: "restore-equipment", equipmentId: runtimeGearId }, catalogData);
assert.equal(equipmentManager.members[knightKey].equipment[0].discarded, false);
assert.equal(equipmentManager.members[knightKey].equipment[0].ready, true);
equipmentManager = runtime.applyRuntimeAction(equipmentManager, knightKey, { kind: "change-equipment-charges", equipmentId: runtimeGearId, delta: 120 }, catalogData);
assert.equal(equipmentManager.members[knightKey].equipment[0].charges, 99);
assert.strictEqual(runtime.applyRuntimeAction(equipmentManager, knightKey, { kind: "add-equipment-charge", equipmentId: runtimeGearId }, catalogData), equipmentManager, "charges clamp at 99");
equipmentManager = runtime.applyRuntimeAction(equipmentManager, knightKey, { kind: "spend-equipment-charge", equipmentId: runtimeGearId }, catalogData);
assert.equal(equipmentManager.members[knightKey].equipment[0].charges, 98);
equipmentManager = runtime.applyRuntimeAction(equipmentManager, knightKey, { kind: "change-equipment-charges", equipmentId: runtimeGearId, delta: -200 }, catalogData);
assert.equal(equipmentManager.members[knightKey].equipment[0].charges, 0);
assert.strictEqual(runtime.applyRuntimeAction(equipmentManager, knightKey, { kind: "spend-equipment-charge", equipmentId: runtimeGearId }, catalogData), equipmentManager, "charges cannot become negative");
equipmentManager = runtime.applyRuntimeAction(equipmentManager, knightKey, { kind: "change-equipment-charges", equipmentId: runtimeGearId, delta: 3 }, catalogData);
equipmentManager = runtime.applyRuntimeAction(equipmentManager, knightKey, { kind: "discard-equipment", equipmentId: runtimeGearId }, catalogData);
equipmentManager = runtime.applyRuntimeAction(equipmentManager, knightKey, { kind: "reset-equipment" }, catalogData);
assert.ok(equipmentManager.members[knightKey].equipment.every(item => item.ready && !item.discarded && item.charges === 0));

// Knights and squires adjust one shared pool. Clearing removes Knight tokens but preserves resource tokens.
const poolData = copy(catalogData);
poolData.knightPoolTokens = [
  { id: "configured-resource", kind: "resource" },
  { id: "configured-knight", kind: "knight" },
];
let poolManager = freshCatalogManager();
poolManager = runtime.applyRuntimeAction(poolManager, knightKey, { kind: "adjust-knight-pool", tokenId: "opening", delta: 2 }, poolData);
poolManager = runtime.applyRuntimeAction(poolManager, squireKey, { kind: "adjust-knight-pool", tokenId: "opening", delta: 1 }, poolData);
poolManager = runtime.applyRuntimeAction(poolManager, knightKey, { kind: "adjust-knight-pool", tokenId: "magic", delta: 3 }, poolData);
poolManager = runtime.applyRuntimeAction(poolManager, squireKey, { kind: "adjust-knight-pool", tokenId: "fleisch", delta: 2 }, poolData);
poolManager = runtime.applyRuntimeAction(poolManager, knightKey, { kind: "adjust-knight-pool", tokenId: "zeal", delta: 1 }, poolData);
poolManager = runtime.applyRuntimeAction(poolManager, knightKey, { kind: "adjust-knight-pool", tokenId: "configured-resource", delta: 4 }, poolData);
poolManager = runtime.applyRuntimeAction(poolManager, squireKey, { kind: "adjust-knight-pool", tokenId: "configured-knight", delta: 5 }, poolData);
assert.equal(poolManager.knightPool.opening, 3, "both member kinds write the same manager-level pool");
assert.ok(Object.values(poolManager.members).every(member => !Object.hasOwn(member, "knightPool")));
poolManager = runtime.applyRuntimeAction(poolManager, squireKey, { kind: "clear-knight-pool" }, poolData);
assert.deepEqual(poolManager.knightPool, { magic: 3, fleisch: 2, zeal: 1, "configured-resource": 4 });
before = poolManager;
poolManager = runtime.applyRuntimeAction(poolManager, knightKey, { kind: "adjust-knight-pool", tokenId: "magic", delta: 200 }, poolData);
assert.equal(poolManager.knightPool.magic, 99);
assert.deepEqual(before.knightPool, { magic: 3, fleisch: 2, zeal: 1, "configured-resource": 4 }, "pool writes are immutable");
poolManager = runtime.applyRuntimeAction(poolManager, knightKey, { kind: "adjust-knight-pool", tokenId: "magic", delta: -200 }, poolData);
assert.equal(poolManager.knightPool.magic, 0);
assert.strictEqual(runtime.applyRuntimeAction(poolManager, knightKey, { kind: "adjust-knight-pool", tokenId: "magic", delta: -1 }, poolData), poolManager);

console.log("character runtime: schema v4 migration, outpost rules, rule transitions, shared Knight Pool, equipment state, catalogs, upgrades, immutability and Mettle verified");
