"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const workspaceRoot = path.resolve(__dirname, "..", "..", "..");
const sourceRoot = process.argv[2] ? path.resolve(process.argv[2]) : workspaceRoot;
const output = path.resolve(__dirname, "..", "public", "data", "character-runtime-data.js");
const ttsImages = path.join(sourceRoot, "refs", "Mods", "Images");
const publicCardAssets = path.resolve(__dirname, "..", "public", "assets", "characters", "knight-cards");
const publicTokenAssets = path.resolve(__dirname, "..", "public", "assets", "characters", "knight-tokens");
const publicHeroAssets = path.resolve(__dirname, "..", "public", "assets", "heroes");

const readJson = relativePath => JSON.parse(fs.readFileSync(path.join(sourceRoot, relativePath), "utf8"));
const setups = readJson(path.join("content", "catalog", "knight-setups.json"));
const display = readJson(path.join("content", "catalog", "knight-card-display.json"));
const characterAssets = readJson(path.join("content", "catalog", "character-assets.json"));
const ttsWorkshop = readJson(path.join("refs", "Mods", "Workshop", "Kingdoms Forlorn 1.9.1.json"));
const squires = readJson(path.join("content", "squires.core", "squire-cards.json"));
const mettle = readJson(path.join("content", "core.zh-cn", "mettle.json"));

const squireAliases = { vrathlada: "vratlada" };
const localSquireId = sourceId => squireAliases[sourceId.replace(/^squire\./, "")] || sourceId.replace(/^squire\./, "");
const imageIndex = new Map(fs.readdirSync(ttsImages).map(file => [path.parse(file).name.toLowerCase(), file]));
const webAssetByUrl = new Map();
const tokenAssetByUrl = new Map();
const existingHeroAssetByKey = new Map(
  fs.readdirSync(publicHeroAssets).map(file => [path.parse(file).name.toLowerCase(), `/assets/heroes/${file}`]),
);
const imageDimensionsByAsset = new Map();
const ttsObjectByGuid = new Map();

function indexTtsObjects(object) {
  if (!object || typeof object !== "object") return;
  if (object.GUID && !ttsObjectByGuid.has(object.GUID)) ttsObjectByGuid.set(object.GUID, object);
  for (const child of object.ContainedObjects || []) indexTtsObjects(child);
  for (const child of object.ChildObjects || []) indexTtsObjects(child);
}
for (const object of ttsWorkshop.ObjectStates || []) indexTtsObjects(object);

function jpegDimensions(buffer) {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1];
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
    }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) break;
    offset += 2 + length;
  }
  throw new Error("Unable to read JPEG dimensions");
}

function imageDimensions(asset) {
  if (imageDimensionsByAsset.has(asset)) return imageDimensionsByAsset.get(asset);
  const file = path.resolve(__dirname, "..", "public", asset.replace(/^\//, ""));
  const buffer = fs.readFileSync(file);
  let dimensions;
  if (buffer.subarray(1, 4).toString("ascii") === "PNG") {
    dimensions = { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  } else if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    dimensions = jpegDimensions(buffer);
  } else {
    throw new Error(`Unsupported card image format: ${asset}`);
  }
  imageDimensionsByAsset.set(asset, dimensions);
  return dimensions;
}

function ttsScale(object) {
  const x = Number(object?.Transform?.scaleX);
  const z = Number(object?.Transform?.scaleZ);
  return Number.isFinite(x) && Number.isFinite(z) ? Math.max(x, z) : 1;
}

function cardArtMetadata(asset, crop, object) {
  const dimensions = imageDimensions(asset);
  const aspect = (dimensions.width / Number(crop.columns)) / (dimensions.height / Number(crop.rows));
  return { asset, crop, aspect: Number(aspect.toFixed(6)), scale: ttsScale(object) };
}

const sourceObject = card => ttsObjectByGuid.get(card?.guid || card?.GUID);
const cardArt = (card, asset) => card ? cardArtMetadata(asset, card.artwork.crop, sourceObject(card)) : null;
const cacheKey = url => String(url || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
function localCardAsset(url) {
  if (!url) return null;
  if (webAssetByUrl.has(url)) return webAssetByUrl.get(url);
  const existingHeroAsset = existingHeroAssetByKey.get(cacheKey(url));
  if (existingHeroAsset) {
    webAssetByUrl.set(url, existingHeroAsset);
    return existingHeroAsset;
  }
  const sourceFile = imageIndex.get(cacheKey(url));
  if (!sourceFile) throw new Error(`Missing cached TTS card image: ${url}`);
  fs.mkdirSync(publicCardAssets, { recursive: true });
  const extension = path.extname(sourceFile).toLowerCase() || ".jpg";
  const fileName = `${crypto.createHash("sha256").update(url).digest("hex").slice(0, 16)}${extension}`;
  fs.copyFileSync(path.join(ttsImages, sourceFile), path.join(publicCardAssets, fileName));
  const webPath = `/assets/characters/knight-cards/${fileName}`;
  webAssetByUrl.set(url, webPath);
  return webPath;
}
function localTokenAsset(url) {
  if (!url) return null;
  if (tokenAssetByUrl.has(url)) return tokenAssetByUrl.get(url);
  const sourceFile = imageIndex.get(cacheKey(url));
  if (!sourceFile) throw new Error(`Missing cached TTS token image: ${url}`);
  fs.mkdirSync(publicTokenAssets, { recursive: true });
  const extension = path.extname(sourceFile).toLowerCase() || ".png";
  const fileName = `${crypto.createHash("sha256").update(url).digest("hex").slice(0, 16)}${extension}`;
  fs.copyFileSync(path.join(ttsImages, sourceFile), path.join(publicTokenAssets, fileName));
  const webPath = `/assets/characters/knight-tokens/${fileName}`;
  tokenAssetByUrl.set(url, webPath);
  return webPath;
}
const ttsCardArt = (card, side = "face") => card
  ? cardArtMetadata(localCardAsset(card.artwork[`${side}Url`]), card.artwork.crop, sourceObject(card))
  : null;
const cleanOptionName = value => String(value || "").trim();
const cardNames = value => {
  const [front = "", ...rest] = cleanOptionName(value).split("/");
  return { name: front.trim(), backName: rest.join("/").trim() };
};
const tierFromTags = tags => String((tags || []).find(tag => tag.startsWith("TIER_")) || "").replace(/^TIER_/, "").toLowerCase();
const optionId = (kind, card) => `${kind}:${card.GUID}`;
const objectCardArt = (card, customDecks, side = "face") => {
  const deckId = String(Math.floor(Number(card.CardID) / 100));
  const slot = Number(card.CardID) - Number(deckId) * 100;
  const deck = customDecks?.[deckId];
  if (!deck) throw new Error(`Missing CustomDeck ${deckId} for ${card.Nickname || card.GUID}`);
  const uniqueBack = side !== "back" || deck.UniqueBack;
  return cardArtMetadata(
    localCardAsset(deck[side === "back" ? "BackURL" : "FaceURL"]),
    {
      column: uniqueBack ? slot % Number(deck.NumWidth) : 0,
      row: uniqueBack ? Math.floor(slot / Number(deck.NumWidth)) : 0,
      columns: uniqueBack ? Number(deck.NumWidth) : 1,
      rows: uniqueBack ? Number(deck.NumHeight) : 1,
    },
    card,
  );
};
function knightTtsRoot(sourceId) {
  const character = characterAssets.characters.find(item => item.id === `knight.${sourceId}`);
  const rootIndex = Number(character?.provenance?.rootLocator?.match(/ObjectStates\/(\d+)/)?.[1]);
  const root = ttsWorkshop.ObjectStates?.[rootIndex];
  if (!root) throw new Error(`Missing TTS knight box for ${sourceId}`);
  return root;
}
function knightPortraitOptions(sourceId) {
  const root = knightTtsRoot(sourceId);
  const portraits = [];
  const visit = (object, inheritedDecks = {}) => {
    const customDecks = {...inheritedDecks, ...(object.CustomDeck || {})};
    if (object.Name === "Deck" && /\bPortrait cards\b/i.test(cleanOptionName(object.Nickname))) {
      for (const card of object.ContainedObjects || []) {
        if (card.Name !== "Card" || !card.Tags?.includes("Portrait")) continue;
        portraits.push({
          id: optionId("portrait", card),
          cardId: Number(card.CardID),
          art: objectCardArt(card, {...customDecks, ...(card.CustomDeck || {})}),
        });
      }
      return;
    }
    for (const child of object.ContainedObjects || []) visit(child, customDecks);
  };
  visit(root);
  return portraits.sort((a, b) => a.cardId - b.cardId);
}
function knightCardOptions(sourceId) {
  const root = knightTtsRoot(sourceId);
  const groups = { profession: [], heroic: [], peril: [], technique: [] };
  const seen = new Set();
  const visit = (object, inheritedDecks = {}) => {
    const customDecks = {...inheritedDecks, ...(object.CustomDeck || {})};
    const tag = object.Tags?.find(value => ["Knight_Talent", "Heroic_Arc", "Peril_Arc", "Knight_Technique"].includes(value));
    const kind = tag === "Knight_Talent" ? "profession" : tag === "Heroic_Arc" ? "heroic" : tag === "Peril_Arc" ? "peril" : tag === "Knight_Technique" ? "technique" : "";
    if (object.Name === "Card" && kind) {
      const art = objectCardArt(object, customDecks);
      const key = `${kind}|${cleanOptionName(object.Nickname).toLowerCase()}|${art.asset}|${JSON.stringify(art.crop)}`;
      if (!seen.has(key)) {
        seen.add(key);
        const names = cardNames(object.Nickname);
        groups[kind].push({
          id: kind === "technique" ? `technique:${sourceId}:${object.CardID}` : optionId(kind, object),
          catalogId: kind === "technique" ? `technique:${sourceId}:${object.CardID}` : undefined,
          cardId: object.CardID,
          name: kind === "technique" ? names.name : cleanOptionName(object.Nickname),
          ...(kind === "technique" ? { front: names.name, back: names.backName, category: cleanOptionName(object.Description) || "其他" } : {}),
          art,
          backArt: objectCardArt(object, customDecks, "back"),
        });
      }
    }
    for (const child of object.ContainedObjects || []) visit(child, customDecks);
  };
  visit(root);
  for (const values of Object.values(groups)) values.sort((a, b) => a.name.localeCompare(b.name, "en"));
  return groups;
}

function collectTtsCardCatalog(tag) {
  const cards = new Map();
  const visit = (object, inheritedDecks = {}) => {
    const customDecks = {...inheritedDecks, ...(object.CustomDeck || {})};
    if (object.Name === "Card" && object.Tags?.includes(tag)) {
      const current = cards.get(Number(object.CardID));
      const candidate = { object, customDecks };
      const currentScore = current ? (cleanOptionName(current.object.Nickname).includes("/") ? 2 : 0) + (current.object.Tags?.length || 0) : -1;
      const candidateScore = (cleanOptionName(object.Nickname).includes("/") ? 2 : 0) + (object.Tags?.length || 0);
      if (!current || candidateScore > currentScore) cards.set(Number(object.CardID), candidate);
    }
    for (const child of object.ContainedObjects || []) visit(child, customDecks);
    for (const child of object.ChildObjects || []) visit(child, customDecks);
  };
  for (const object of ttsWorkshop.ObjectStates || []) visit(object);
  return [...cards.values()].sort((a, b) => Number(a.object.CardID) - Number(b.object.CardID));
}

function collectTtsCardsById(cardIds) {
  const wanted = new Set(cardIds.map(Number));
  const cards = new Map();
  const visit = (object, inheritedDecks = {}) => {
    const customDecks = {...inheritedDecks, ...(object.CustomDeck || {})};
    const cardId = Number(object.CardID);
    if (object.Name === "Card" && wanted.has(cardId) && !cards.has(cardId)) {
      cards.set(cardId, {object, customDecks});
    }
    for (const child of object.ContainedObjects || []) visit(child, customDecks);
    for (const child of object.ChildObjects || []) visit(child, customDecks);
  };
  for (const object of ttsWorkshop.ObjectStates || []) visit(object);
  return cards;
}

const mercenaryDefinitions = [
  { cardId: 26600, name: "Bard", nameZhCn: "吟游诗人", level: 1, cost: 3, kingdom: "both" },
  { cardId: 26601, name: "Bard", nameZhCn: "吟游诗人", level: 2, cost: 4, kingdom: "both" },
  { cardId: 26602, name: "Bard", nameZhCn: "吟游诗人", level: 3, cost: 7, kingdom: "both" },
  { cardId: 26603, name: "Healer", nameZhCn: "医师", level: 1, cost: 2, kingdom: "both" },
  { cardId: 26604, name: "Healer", nameZhCn: "医师", level: 2, cost: 4, kingdom: "both" },
  { cardId: 26605, name: "Healer", nameZhCn: "医师", level: 3, cost: 8, kingdom: "both" },
  { cardId: 26606, name: "Mage", nameZhCn: "法师", level: 1, cost: 3, kingdom: "both" },
  { cardId: 26607, name: "Mage", nameZhCn: "法师", level: 2, cost: 5, kingdom: "both" },
  { cardId: 26608, name: "Mage", nameZhCn: "法师", level: 3, cost: 9, kingdom: "both" },
  { cardId: 26609, name: "Rogue", nameZhCn: "盗贼", level: 1, cost: 3, kingdom: "both" },
  { cardId: 26610, name: "Rogue", nameZhCn: "盗贼", level: 2, cost: 5, kingdom: "both" },
  { cardId: 26611, name: "Rogue", nameZhCn: "盗贼", level: 3, cost: 9, kingdom: "both" },
  { cardId: 26612, name: "Warrior", nameZhCn: "战士", level: 1, cost: 2, kingdom: "both" },
  { cardId: 26613, name: "Warrior", nameZhCn: "战士", level: 2, cost: 5, kingdom: "both" },
  { cardId: 26614, name: "Warrior", nameZhCn: "战士", level: 3, cost: 8, kingdom: "both" },
  { cardId: 26615, name: "Swamp Strider", nameZhCn: "沼地摆渡人", level: 1, cost: 3, kingdom: "sunken" },
  { cardId: 26616, name: "Ruin Stalker", nameZhCn: "废墟追踪者", level: 1, cost: 6, kingdom: "stone" },
];
const mercenaryTtsCards = collectTtsCardsById(mercenaryDefinitions.map(card => card.cardId));
const mercenaries = mercenaryDefinitions.map(definition => {
  const source = mercenaryTtsCards.get(definition.cardId);
  if (!source) throw new Error(`Missing TTS mercenary card ${definition.cardId}`);
  const catalogId = `mercenary:${definition.cardId}`;
  return {
    id: catalogId,
    catalogId,
    ...definition,
    art: objectCardArt(source.object, source.customDecks),
    backArt: objectCardArt(source.object, source.customDecks, "back"),
  };
});

const gearCards = collectTtsCardCatalog("GEAR_Armor_and_Weapon").map(({object, customDecks}) => {
  const names = cardNames(object.Nickname);
  const gearType = String(object.GMNotes) === "4" ? "armor" : ["1", "2"].includes(String(object.GMNotes)) ? "weapon" : "unknown";
  const isMerchant = object.Tags?.includes("GEAR_Merchant") || false;
  return {
    id: `gear:${object.CardID}`,
    catalogId: `gear:${object.CardID}`,
    cardId: object.CardID,
    name: names.name,
    backName: names.backName,
    tier: tierFromTags(object.Tags),
    gearType,
    isMerchant,
    upgradeable: !isMerchant,
    art: objectCardArt(object, customDecks),
    backArt: objectCardArt(object, customDecks, "back"),
  };
});
const knighvesDisplayCard = display.knights.flatMap(knight => knight.cards).find(card => Number(card.cardId) === 33100);
if (knighvesDisplayCard && !gearCards.some(card => Number(card.cardId) === 33100)) gearCards.unshift({
  id: "gear:33100",
  catalogId: "gear:33100",
  cardId: 33100,
  name: "Knighves",
  backName: "",
  tier: "starter",
  gearType: "weapon",
  isMerchant: false,
  upgradeable: true,
  art: ttsCardArt(knighvesDisplayCard),
  backArt: ttsCardArt(knighvesDisplayCard, "back"),
});
const gearByCardId = new Map(gearCards.map(card => [Number(card.cardId), card]));

const gearUpgrades = collectTtsCardCatalog("GEAR_Upgrade").map(({object, customDecks}) => ({
  id: `upgrade:${object.CardID}`,
  catalogId: `upgrade:${object.CardID}`,
  cardId: object.CardID,
  name: cleanOptionName(object.Nickname),
  tier: tierFromTags(object.Tags),
  targetType: String(object.GMNotes) === "4" ? "armor" : "weapon",
  art: objectCardArt(object, customDecks),
  backArt: objectCardArt(object, customDecks, "back"),
}));

const ttsTokenAsset = guid => {
  const object = ttsObjectByGuid.get(guid);
  const url = object?.CustomImage?.ImageURL || object?.CustomMesh?.DiffuseURL;
  if (!url) throw new Error(`Missing TTS token icon for ${guid}`);
  return localTokenAsset(url);
};
const knightPoolTokens = [
  { id: "opening", name: "Opening", nameZhCn: "机会", kind: "knight", sourceGuid: "ebf2af" },
  { id: "closing", name: "Closing", nameZhCn: "空挡", kind: "knight", sourceGuid: "d98e45" },
  { id: "cantrip", name: "Cantrip", nameZhCn: "戏法", kind: "knight", sourceGuid: "9518ae" },
  { id: "spell", name: "Spell", nameZhCn: "咒语", kind: "knight", sourceGuid: "e2a0bf" },
  { id: "rouse", name: "Rouse", nameZhCn: "激昂", kind: "knight", sourceGuid: "2a5901" },
  { id: "diversion", name: "Diversion", nameZhCn: "扰乱", kind: "knight", sourceGuid: "56ce8a" },
  { id: "improved-diversion", name: "Improved Diversion", nameZhCn: "高级扰乱", kind: "knight", sourceGuid: "7c7964" },
  { id: "break", name: "Break", nameZhCn: "破甲", kind: "knight", sourceGuid: "90b2d1" },
  { id: "power", name: "Power", nameZhCn: "强度", kind: "knight", sourceGuid: "8e75d1" },
  { id: "sunder", name: "Sunder", nameZhCn: "断破", kind: "knight", sourceGuid: "c664db" },
  { id: "fire", name: "Fire", nameZhCn: "火焰", kind: "knight", sourceGuid: "c16a33" },
  { id: "hope", name: "Hope", nameZhCn: "希望", kind: "knight", sourceGuid: "c505c0" },
  { id: "black", name: "Black", nameZhCn: "黑破", kind: "knight", sourceGuid: "1c18c3" },
  { id: "magic", name: "Magic", nameZhCn: "魔力", kind: "resource", sourceGuid: "d09637", iconCrop: { x: 0.018743, y: 0.018136, width: 0.473645, height: 0.473339 } },
  { id: "fleisch", name: "Fleisch", nameZhCn: "肉肉", kind: "resource", sourceGuid: "0245d8", iconCrop: { x: 0.037603, y: 0.043988, width: 0.595743, height: 0.583743 } },
  { id: "zeal", name: "Zeal", nameZhCn: "狂热", kind: "resource", sourceGuid: "3ab920", iconCrop: { x: 0.025175, y: 0.032297, width: 0.653033, height: 0.653742 } },
].map(token => {
  const iconAsset = ttsTokenAsset(token.sourceGuid);
  return {...token, icon: iconAsset, iconAsset};
});
const chargeTokenAsset = ttsTokenAsset("e033c8");

const portraitRefreshByKnight = {
  fleischritter: [3, 4, 5],
  kara: [3, 4, 5],
  paracelsa: [2, 3, 4],
  renholder: [3, 4, 6],
  "ser-sonch": [3, 4, 5],
  stoneface: [2, 3, 4],
  "ser-ubar": [3, 4, 5],
};

const knightData = Object.fromEntries(setups.knights.map(setup => {
  const sourceId = setup.id.replace(/^knight\./, "");
  const cards = display.knights.find(knight => knight.id === setup.id)?.cards || [];
  const byId = cardId => cards.find(card => card.cardId === cardId);
  const portraitCardIds = (setup.portraitCardIds || []).map(Number);
  const startingPortraitCard = byId(portraitCardIds.find(cardId => cardId % 2 === 0));
  const startingOverviewCard = byId(portraitCardIds.find(cardId => cardId % 2 === 1));
  const advancedPortraits = knightPortraitOptions(sourceId);
  const refreshValues = portraitRefreshByKnight[sourceId];
  if (!startingPortraitCard || !startingOverviewCard || advancedPortraits.length !== 2 || !refreshValues) {
    throw new Error(`Incomplete portrait catalog for ${sourceId}`);
  }
  const portraits = [
    {
      id: `portrait:${startingPortraitCard.guid}`,
      cardId: startingPortraitCard.cardId,
      backCardId: startingOverviewCard.cardId,
      name: "初始肖像",
      cardRefresh: refreshValues[0],
      art: ttsCardArt(startingPortraitCard),
      backArt: ttsCardArt(startingOverviewCard),
    },
    ...advancedPortraits.map((portrait, index) => ({
      ...portrait,
      name: index === 0 ? "封臣级肖像" : "恶魔级肖像",
      cardRefresh: refreshValues[index + 1],
    })),
  ];
  const options = knightCardOptions(sourceId);
  const starter = (group, entry) => options[group].find(item => item.name.toLowerCase() === cleanOptionName(entry.name).toLowerCase()) || options[group].find(item => Number(item.cardId) === Number(entry.cardId));
  const profession = starter("profession", setup.talentAndArcs.talent);
  const heroicArc = starter("heroic", setup.talentAndArcs.heroicArc);
  const perilArc = starter("peril", setup.talentAndArcs.perilArc);
  return [sourceId, {
    id: sourceId,
    name: display.knights.find(knight => knight.id === setup.id)?.name || sourceId,
    role: setup.role,
    portrait: portraits[0] || null,
    portraits,
    profession: profession || {...setup.talentAndArcs.talent,art:ttsCardArt(byId(setup.talentAndArcs.talent.cardId)),backArt:ttsCardArt(byId(setup.talentAndArcs.talent.cardId), "back")},
    professions: options.profession,
    heroicArc: heroicArc || {...setup.talentAndArcs.heroicArc,art:cardArt(byId(setup.talentAndArcs.heroicArc.cardId), "/assets/characters/knight-arcs.jpg")},
    heroicArcs: options.heroic,
    perilArc: perilArc || {...setup.talentAndArcs.perilArc,art:cardArt(byId(setup.talentAndArcs.perilArc.cardId), "/assets/characters/knight-arcs.jpg")},
    perilArcs: options.peril,
    techniques: options.technique,
    startingTechniqueIds: setup.startingTechniques.map(card => options.technique.find(option => Number(option.cardId) === Number(card.cardId))?.catalogId).filter(Boolean),
    startingGear: {
      ...setup.startingGear,
      fixed: setup.startingGear.fixed.map(card => ({
        ...card,
        ...(gearByCardId.get(Number(card.cardId)) || {}),
        name: card.name || gearByCardId.get(Number(card.cardId))?.name || "",
        art: gearByCardId.get(Number(card.cardId))?.art || ttsCardArt(byId(card.cardId)),
        backArt: gearByCardId.get(Number(card.cardId))?.backArt || ttsCardArt(byId(card.cardId), "back"),
      })),
    },
  }];
}));

const gear = Object.fromEntries(gearCards.map(card => [card.name.trim().toLowerCase(), card]));

const publicNames = Object.fromEntries(squires.squires.map(squire => [squire.id, squire.name]));
const tierOrder = { mob: 1, vassal: 2, king: 3, devil: 4, dragon: 5 };
const squireData = {};
for (const card of squires.faces.filter(card => card.kind === "tier-card")) {
  const id = localSquireId(card.squireId);
  if (!squireData[id]) squireData[id] = { id, name: publicNames[card.squireId] || id, tiers: [] };
  squireData[id].tiers.push({
    id: card.id.replace("squire.vrathlada.", "squire.vratlada."),
    tier: card.tier,
    cardId: card.cardId,
    statistics: card.statistics,
    heroicArc: card.rules?.heroicArc || [],
    activeAbilities: card.rules?.activeAbilities || [],
    passiveAbilities: card.rules?.passiveAbilities || [],
    art: cardArtMetadata(
      "/assets/characters/squire-cards.jpg",
      { column: card.slot % 10, row: Math.floor(card.slot / 10), columns: 10, rows: 4 },
      sourceObject(card),
    ),
  });
}
for (const squire of Object.values(squireData)) squire.tiers.sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]);

const mettleCards = Object.fromEntries(mettle.cards.map(card => [card.id, {
  ...card,
  art: cardArtMetadata(
    "/assets/characters/mettle-cards.jpg",
    { column: card.slot % 10, row: Math.floor(card.slot / 10), columns: 10, rows: 4 },
    sourceObject(card),
  ),
}]));

const data = {
  schemaVersion: 2,
  sources: {
    characters: setups.ttsSourceId,
    squires: squires.version,
    mettle: mettle.version,
  },
  knights: knightData,
  gear,
  gearCards,
  gearUpgrades,
  mercenaries,
  knightPoolTokens,
  chargeTokenAsset,
  squires: squireData,
  mettle: {
    startingCardIds: mettle.startingDeck.cardIds,
    cards: mettleCards,
    tierOrder,
  },
};

const source = `/* Generated by tools/build-character-runtime-data.js. */\n(function(root,factory){const data=factory();if(typeof module===\"object\"&&module.exports)module.exports=data;if(root)root.KF_CHARACTER_DATA=data;})(typeof globalThis!==\"undefined\"?globalThis:this,function(){return ${JSON.stringify(data)};});\n`;
fs.writeFileSync(output, source, "utf8");
console.log(`Wrote ${output}`);
