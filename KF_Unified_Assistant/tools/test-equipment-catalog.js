"use strict";

// Runs without a TTS save or game images: node tools/test-equipment-catalog.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { selectCards, groupCards, stackCards, cardCrop } = require("../public/modules/equipment/catalog.js");
const { extractEquipment, imageDimensions } = require("./import-tts-equipment.js");

const root = path.resolve(__dirname, "..");
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "public/modules/equipment/data.js"), "utf8"), context);
const data = JSON.parse(JSON.stringify(context.window.KF_EQUIPMENT_DATA));
const tierOrder = ["Mob", "Vassal", "King", "Devil", "Dragon", "Legendary"];
const ids = cards => cards.map(card => card.id);
const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-7,
  `${label}: expected ${expected}, got ${actual}`);

// The save contains extra physical copies and partially filled duplicate records.
// The browser catalog must retain metadata while presenting each card once.
assert.equal(data.cards.length, 335, "unique equipment count");
assert.equal(new Set(ids(data.cards)).size, 335, "stable browser IDs are unique");
assert.equal(new Set(data.cards.map(card => card.cardId)).size, 335, "TTS card IDs are unique");
assert.equal(data.source.sourceCardCount, 380);
assert.equal(data.cards.reduce((sum, card) => sum + card.copies, 0), 380, "all physical copies are accounted for");
assert.equal(data.categories.length, 27);
assert.equal(new Set(data.categories.map(category => category.id)).size, 27);
assert.deepEqual(data.tiers.map(tier => tier.id), [...tierOrder, "Other"]);
assert.deepEqual(data.tierCards.map(card => card.tier), tierOrder, "one explanation card for each standard tier");
assert.deepEqual(data.cards.filter(card => card.tier === "Other").map(card => card.cardId).sort(), [31600, 31601]);
assert.equal(selectCards(data, { category: "GEAR_FirstmenWarriors" }).length, 10,
  "the singular source tag must not hide two Firstmen cards");
const categoryIds = new Set(data.categories.map(category => category.id));
for (const card of data.cards) {
  assert.ok(card.name.trim(), `${card.cardId}: displayable name`);
  assert.ok(card.categoryIds.length, `${card.cardId}: source category survived deduplication`);
  assert.ok(Number.isInteger(card.copies) && card.copies > 0);
  for (const category of card.categoryIds) assert.ok(categoryIds.has(category), `${card.cardId}: known category ${category}`);
  assert.ok(data.tiers.some(tier => tier.id === card.tier), `${card.cardId}: known tier`);
}

// Source and tier selections intersect; multiple selected tiers form a union.
const category = "GEAR_Knighteater";
const mob = selectCards(data, { category, tiers: ["Mob"] });
const dragon = selectCards(data, { category, tiers: ["Dragon"] });
const union = selectCards(data, { category, tiers: ["Mob", "Dragon"] });
assert.ok(mob.length && dragon.length, "fixture has cards at both tiers");
assert.deepEqual(new Set(ids(union)), new Set([...ids(mob), ...ids(dragon)]));
assert.ok(union.every(card => card.categoryIds.includes(category) && ["Mob", "Dragon"].includes(card.tier)));
assert.deepEqual(ids(selectCards(data, { category, tiers: [] })), ids(selectCards(data, { category })),
  "clearing tier chips restores every tier");
assert.equal(selectCards(data, { category: "missing-category" }).length, 0);
assert.equal(selectCards(data, { category, tiers: ["Mob"], query: "不存在的装备" }).length, 0);

// Search terms can come from different metadata fields and must all match.
const parasite = data.cards.find(card => card.cardId === 31715);
assert.ok(parasite, "known named equipment");
assert.deepEqual(ids(selectCards(data, { query: "  PARASITE   sword  " })), [parasite.id]);
const chineseSourceName = data.categories.find(item => item.id === "GEAR_Knighteater").name;
assert.match(chineseSourceName, /[\u3400-\u9fff]/, "source category has a Chinese display name");
assert.deepEqual(ids(selectCards(data, { query: `${chineseSourceName} ${parasite.cardId}` })), [parasite.id],
  "Chinese source names and numeric card IDs are searchable together");
assert.deepEqual(ids(selectCards(data, { query: parasite.id.toUpperCase() })), [parasite.id], "GUID search is case insensitive");
assert.equal(selectCards(data, { query: `PARASITE sword ${parasite.cardId} impossible` }).length, 0,
  "search terms use AND, including unmatched final terms");
assert.deepEqual(ids(selectCards(data, { category: "GEAR_Knighteater", tiers: ["Dragon"], query: "PARASITE" })), [parasite.id]);
assert.equal(selectCards(data, { category: "GEAR_Knighteater", tiers: ["Mob"], query: "PARASITE sword" }).length, 0,
  "search does not bypass tier filters");

// Shuffle a small example so sorting is checked independently of generated order.
const sortData = {
  categories: [], tiers: [...tierOrder, "Other"].map(id => ({ id, name: id })),
  cards: [
    { id: "story", name: "A", tier: "Other", order: 0, categoryIds: [] },
    { id: "king", name: "A", tier: "King", order: 0, categoryIds: [] },
    { id: "mob-late", name: "A", tier: "Mob", order: 4, categoryIds: [] },
    { id: "mob-z", name: "Zebra", tier: "Mob", order: 2, categoryIds: [] },
    { id: "mob-a", name: "Alpha", tier: "Mob", order: 2, categoryIds: [] },
    { id: "mob-early", name: "Z", tier: "Mob", order: 1, categoryIds: [] },
    { id: "mob-unordered", name: "A", tier: "Mob", categoryIds: [] },
  ],
};
const beforeSort = JSON.stringify(sortData);
assert.deepEqual(ids(selectCards(sortData)), ["mob-early", "mob-a", "mob-z", "mob-late", "mob-unordered", "king", "story"],
  "sort by tier, numeric source order, then name; missing order goes last");
assert.equal(JSON.stringify(sortData), beforeSort, "selecting must not reorder or mutate source data");

for (const cards of [selectCards(data), union, selectCards(data, { query: "石之公国" }), []]) {
  const grouped = groupCards(data, cards);
  const flattened = grouped.flatMap(group => group.cards);
  assert.deepEqual(new Set(ids(flattened)), new Set(ids(cards)), "grouping preserves the selected set");
  assert.equal(flattened.length, cards.length, "grouping never drops or repeats a card");
  assert.ok(grouped.every(group => group.cards.length && group.cards.every(card => card.tier === group.id)));
}
assert.deepEqual(groupCards({ tiers: data.tiers.filter(tier => tier.id !== "Other") }, data.cards.filter(card => card.tier === "Other"))
  .map(group => [group.id, group.cards.length]), [["Other", 2]], "legacy tier lists still display story cards");

// Display stacks combine matching equipment while preserving every original
// CardID and image variant for individual inspection in the preview dialog.
const stackFixture = [
  { id: "first", name: "  ＩＲＯＮ   Crow ", tier: "Dragon", categoryIds: ["B", "A"], copies: 2, image: { face: "old.jpg" } },
  { id: "other", name: "Spear", tier: "Mob", categoryIds: ["A"], copies: 1 },
  { id: "second", name: "iron crow", tier: "Dragon", categoryIds: ["A", "B", "A"], copies: 3, image: { face: "new.jpg" } },
  { id: "other-tier", name: "Iron Crow", tier: "Mob", categoryIds: ["A", "B"], copies: 1 },
  { id: "other-source", name: "Iron Crow", tier: "Dragon", categoryIds: ["A"], copies: 1 },
  { id: "blank-one", name: "", tier: "Mob", categoryIds: ["A"], copies: 0 },
  { id: "blank-two", name: "  ", tier: "Mob", categoryIds: ["A"], copies: 1.5 },
  { id: "no-count", name: "Spear", tier: "Mob", categoryIds: ["A"] },
];
const beforeStack = JSON.stringify(stackFixture);
const fixtureStacks = stackCards(stackFixture);
assert.deepEqual(fixtureStacks.map(stack => stack.id), ["first", "other", "other-tier", "other-source", "blank-one", "blank-two"],
  "stack order follows first appearances; different tiers, sources and unnamed cards stay separate");
assert.deepEqual(ids(fixtureStacks[0].cards), ["first", "second"], "NFKC, case, whitespace and category order normalize for matching");
assert.equal(fixtureStacks[0].count, 5, "stack counts all source copies");
assert.equal(fixtureStacks[0].card, stackFixture[0], "the first card remains the stack face");
assert.equal(fixtureStacks[0].cards[1], stackFixture[2], "different image versions remain accessible as the original objects");
assert.equal(fixtureStacks[1].count, 2, "missing copy counts contribute one card");
assert.equal(fixtureStacks[4].count, 1, "zero copy counts fall back to one");
assert.equal(fixtureStacks[5].count, 1, "fractional copy counts fall back to one");
assert.equal(fixtureStacks.reduce((sum, stack) => sum + stack.count, 0), 11, "stacking conserves valid physical copy counts");
assert.equal(JSON.stringify(stackFixture), beforeStack, "stacking does not change source card metadata or category order");
assert.deepEqual(stackCards([]), [], "empty selections produce no stacks");

const allStacks = stackCards(selectCards(data));
assert.equal(allStacks.length, 302, "confirmed spelling aliases must share a display stack");
const allStackCards = allStacks.flatMap(stack => stack.cards);
assert.deepEqual(new Set(ids(allStackCards)), new Set(ids(data.cards)));
assert.equal(allStackCards.length, data.cards.length, "every original CardID belongs to exactly one display stack");
assert.equal(allStacks.reduce((sum, stack) => sum + stack.count, 0), 380, "display stacks retain all physical source copies");
const regionalMaps = stackCards(selectCards(data, { query: "Regional Map" }));
assert.equal(regionalMaps.length, 1);
assert.deepEqual(regionalMaps[0].cards.map(card => card.cardId).sort(), [31602, 31603]);
assert.equal(regionalMaps[0].count, 4, "both Regional Map IDs contain two source copies");
const leatherArmor = selectCards(data, { query: "Weathered Leather Armor" });
assert.deepEqual(leatherArmor.map(card => card.cardId).sort(), [31806, 31809],
  "canonical armor-name search finds both original card IDs");
assert.equal(leatherArmor.find(card => card.cardId === 31809).originalName, "Weather Leather Armor",
  "the source spelling survives the explicit name correction");
const leatherArmorStack = stackCards(leatherArmor);
assert.equal(leatherArmorStack.length, 1, "the missing -ed in the source name must not create a second stack");
assert.equal(leatherArmorStack[0].count, 2);
assert.deepEqual(leatherArmorStack[0].cards.map(card => card.cardId).sort(), [31806, 31809],
  "name correction must preserve both cards for preview");
const consumables = stackCards(selectCards(data, { category: "GEAR_Consumable" }));
assert.equal(consumables.length, 15, "thirty consumable IDs display as fifteen matching stacks");
assert.equal(consumables.reduce((sum, stack) => sum + stack.count, 0), 30);
const masks = stackCards(selectCards(data, { query: "Ancestral Ritual Mask" }));
assert.ok(masks.length > 1, "Ancestral Ritual Mask exists at several tiers");
assert.equal(masks.length, new Set(masks.map(stack => stack.card.tier)).size,
  "identical names at different equipment tiers must not share a stack");
for (const stack of allStacks) {
  assert.ok(stack.cards.every(card => card.tier === stack.card.tier), "one stack cannot span tiers");
  assert.equal(stack.count, stack.cards.reduce((sum, card) => sum + card.copies, 0));
}

// Check the actual CSS geometry: the selected source cell must fill one viewport.
function checkCropGeometry(image, back, column, row) {
  const crop = cardCrop(image, back);
  const [widthPercent, heightPercent] = crop.size.split(" ").map(Number.parseFloat);
  const [xPercent, yPercent] = crop.position.split(" ").map(Number.parseFloat);
  const columns = back && !image.backIsAtlas ? 1 : image.columns;
  const rows = back && !image.backIsAtlas ? 1 : image.rows;
  assert.equal(crop.url, back ? image.back : image.face);
  assert.equal(widthPercent, columns * 100);
  assert.equal(heightPercent, rows * 100);
  // A 200x300 viewport makes the oversized sheet (200*columns)x(300*rows).
  close((200 * columns - 200) * xPercent / 100, column * 200, "horizontal source offset");
  close((300 * rows - 300) * yPercent / 100, row * 300, "vertical source offset");
  assert.ok(Number.isFinite(xPercent) && Number.isFinite(yPercent), "one-cell axes must not produce NaN");
}
const atlas = { face: "/face.jpg", back: "/back.jpg", columns: 10, rows: 6, index: 19, backIsAtlas: true };
checkCropGeometry(atlas, false, 9, 1); // Last column, second row.
checkCropGeometry(atlas, true, 9, 1);
checkCropGeometry({ ...atlas, index: 59 }, true, 9, 5); // Final cell in the sheet.
checkCropGeometry({ ...atlas, backIsAtlas: false }, true, 0, 0); // Shared back is the entire image.
checkCropGeometry({ ...atlas, columns: 1, rows: 4, index: 2 }, false, 0, 2);
checkCropGeometry({ ...atlas, columns: 4, rows: 1, index: 3 }, false, 3, 0);
checkCropGeometry({ ...atlas, columns: 1, rows: 1, index: 0 }, false, 0, 0);
for (const card of [...data.cards, ...data.tierCards]) {
  const { image } = card;
  assert.ok(image.index >= 0 && image.index < image.columns * image.rows, `${card.cardId}: in-bounds cell`);
  assert.ok(image.cellWidth > 0 && image.cellHeight > 0 && image.backCellWidth > 0 && image.backCellHeight > 0);
  checkCropGeometry(image, false, image.index % image.columns, Math.floor(image.index / image.columns));
  checkCropGeometry(image, true, image.backIsAtlas ? image.index % image.columns : 0,
    image.backIsAtlas ? Math.floor(image.index / image.columns) : 0);
}

// Minimal in-memory saves exercise the real import API without a local TTS path.
const definition = { FaceURL: "face", BackURL: "back", NumWidth: 4, NumHeight: 3, UniqueBack: true };
const labels = { monsters: {}, tier: id => id };
const resolveImage = url => ({ path: `/assets/equipment/${url}.jpg`, width: 1200, height: 1800 });
const duplicate = { GUID: "blank", CardID: 1005, Nickname: "", Description: "", GMNotes: "", Tags: ["TIER_Mob"] };
const fixture = {
  ObjectStates: [{ GUID: "container", ContainedObjects: [
    { GUID: "608c30", CustomDeck: { 10: definition }, ContainedObjects: [
      duplicate,
      { ...duplicate, GUID: "named", Nickname: "Recovered Spear", Description: "Recovered description", GMNotes: "2",
        Tags: ["TIER_Mob", "GEAR_FirstmenWarrior"] },
      { ...duplicate, GUID: "copy", GMNotes: "5", Tags: ["TIER_Mob", "GEAR_SunkenKingdom"] },
      { GUID: "story", CardID: 1006, Nickname: "Story Hand", GMNotes: "1", Tags: ["TIER_Story", "GEAR_PrincipalityOfStone"] },
    ] },
    { GUID: "03bc26", ContainedObjects: tierOrder.map((tier, index) => ({
      GUID: `tier-${tier}`, CardID: (20 + index) * 100, Nickname: `${tier.toUpperCase()} GEAR`,
      CustomDeck: { [20 + index]: { ...definition, NumWidth: 1, NumHeight: 1, UniqueBack: false } },
    })) },
  ] }],
};
const beforeImport = JSON.stringify(fixture);
const extracted = extractEquipment(fixture, labels, resolveImage);
assert.equal(JSON.stringify(fixture), beforeImport, "pure extraction must not mutate the save");
assert.equal(extracted.source.sourceCardCount, 4);
assert.equal(extracted.cards.length, 2);
const recovered = extracted.cards.find(card => card.cardId === 1005);
assert.equal(recovered.copies, 3);
assert.equal(recovered.name, "Recovered Spear");
assert.equal(recovered.description, "Recovered description");
assert.equal(recovered.order, 2, "a blank early copy must not erase the real source order");
assert.deepEqual(new Set(recovered.categoryIds), new Set(["GEAR_FirstmenWarriors", "GEAR_SunkenKingdom"]));
assert.equal(recovered.image.index, 5);
assert.equal(recovered.image.cellWidth, 300);
assert.equal(recovered.image.cellHeight, 600);
assert.equal(recovered.image.backCellWidth, 300);
assert.equal(recovered.image.backCellHeight, 600);
assert.equal(extracted.cards.find(card => card.cardId === 1006).tier, "Other");
assert.deepEqual(extracted.tierCards.map(card => card.tier), tierOrder);
assert.equal(extracted.tierCards[0].image.backCellWidth, 1200, "shared back dimensions use the whole image");
assert.equal(extracted.tierCards[0].image.backCellHeight, 1800);
assert.throws(() => extractEquipment({ ObjectStates: [] }, labels, resolveImage), /deck.*missing or empty/i);
const invalidFixture = structuredClone(fixture);
invalidFixture.ObjectStates[0].ContainedObjects[0].ContainedObjects[0].CardID = 1012;
assert.throws(() => extractEquipment(invalidFixture, labels, resolveImage), /outside.*4.*3.*atlas/i,
  "reject an out-of-bounds CardID rather than silently show an adjacent image");

// A known source typo uses a narrow explicit alias, not fuzzy matching that
// could silently rename equipment which only happens to have a similar name.
const armorFixture = structuredClone(fixture);
const armorDeck = armorFixture.ObjectStates[0].ContainedObjects[0];
armorDeck.CustomDeck = { 318: { ...definition, NumWidth: 10, NumHeight: 5 } };
armorDeck.ContainedObjects = [
  { GUID: "armor-typo", CardID: 31809, Nickname: "Weather Leather Armor", Tags: ["TIER_Mob", "GEAR_Merchant"] },
  { GUID: "armor-correct", CardID: 31806, Nickname: "Weathered Leather Armor", Tags: ["TIER_Mob", "GEAR_Merchant"] },
  { GUID: "armor-other", CardID: 31808, Nickname: "Weather Leather Armor Lining", Tags: ["TIER_Mob", "GEAR_Merchant"] },
];
const beforeArmorImport = JSON.stringify(armorFixture);
const armorExtracted = extractEquipment(armorFixture, labels, resolveImage);
assert.equal(JSON.stringify(armorFixture), beforeArmorImport, "name correction must not edit the source save");
const correctedArmor = armorExtracted.cards.find(card => card.cardId === 31809);
assert.equal(correctedArmor.name, "Weathered Leather Armor");
assert.equal(correctedArmor.originalName, "Weather Leather Armor");
assert.equal(armorExtracted.cards.find(card => card.cardId === 31806).name, "Weathered Leather Armor");
assert.equal(armorExtracted.cards.find(card => card.cardId === 31806).originalName, undefined,
  "already-correct source names must remain untouched");
assert.equal(armorExtracted.cards.find(card => card.cardId === 31808).name, "Weather Leather Armor Lining");
assert.equal(armorExtracted.cards.find(card => card.cardId === 31808).originalName, undefined,
  "a longer similar equipment name must not trigger the spelling alias");
assert.equal(stackCards(armorExtracted.cards).length, 2);

// Validate native image dimensions only when ignored local assets are available.
// A clean checkout still checks every crop above using committed metadata.
const checkedImages = new Set();
let absentImages = 0;
for (const card of [...data.cards, ...data.tierCards]) for (const back of [false, true]) {
  const { image } = card;
  const url = back ? image.back : image.face;
  const key = `${url}|${back ? image.backCellWidth : image.cellWidth}|${back ? image.backCellHeight : image.cellHeight}`;
  if (checkedImages.has(key)) continue;
  checkedImages.add(key);
  assert.ok(url.startsWith("/assets/equipment/"), "equipment uses local, portable resource paths");
  const filename = path.join(root, "public", url);
  if (!fs.existsSync(filename)) { absentImages++; continue; }
  const dimensions = imageDimensions(fs.readFileSync(filename));
  const isAtlas = !back || image.backIsAtlas;
  close(dimensions.width / (isAtlas ? image.columns : 1), back ? image.backCellWidth : image.cellWidth, `${url}: cell width`);
  close(dimensions.height / (isAtlas ? image.rows : 1), back ? image.backCellHeight : image.cellHeight, `${url}: cell height`);
}

console.log(`equipment catalog: 335 unique cards / 380 copies, ${allStacks.length} display stacks, 27 categories, filters, search, sorting, grouping, stacks, crops and pure import verified; ${checkedImages.size - absentImages} local image geometries checked, ${absentImages} unavailable assets skipped`);
