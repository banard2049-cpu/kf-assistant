#!/usr/bin/env node
"use strict";

// Import the equipment preview catalog from a locally owned TTS save and image
// cache. No network requests are made and game images stay in ignored assets/.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const vm = require("node:vm");

const PUBLIC_ROOT = path.resolve(__dirname, "../public");
const DECK_GUID = "608c30";
const TIER_BAG_GUID = "03bc26";
const TIER_ORDER = ["Mob", "Vassal", "King", "Devil", "Dragon", "Legendary"];
// These three cards have blank TTS Nicknames. Their names were checked against
// the local Chinese card faces and English counterparts; apply only after all
// duplicate source cards have been merged and none supplied a name.
const EMPTY_NAME_CORRECTIONS = {
  33904: { name: "Lorica Segmentata", nameZh: "罗马式分段甲" },
  33906: { name: "Standard Spearmace", nameZh: "标准矛锤" },
  31624: { name: "Iron Crow", nameZh: "钢铁乌鸦" },
};
// A source Nickname drops "ed", splitting copies of the same named equipment.
const NAME_CORRECTIONS = {
  "weather leather armor": "Weathered Leather Armor",
};
const CATEGORY_SPECS = [
  ["SunkenKingdom", "沉没王国", "Sunken Kingdom", "kingdom"],
  ["PrincipalityOfStone", "石之公国", "Principality of Stone", "kingdom"],
  ["Toadragon", "M_Toadragon", "", "sunken"],
  ["BogWitch", "M_BogWitch", "", "sunken"],
  ["DevilOfTheAncientDusk", "M_DevilAncientDusk", "", "sunken"],
  ["KingLaidLow", "M_KingLaidLow", "", "sunken"],
  ["WhiteApeTroll", "M_WhiteApe", "", "sunken"],
  ["FirstmenLictors", "M_FirstmenLictor", "", "sunken"],
  ["FirstmenWarriors", "M_FirstmenWarriors", "", "sunken"],
  ["HauntsOfUtrebrant", "M_HauntOf", "", "sunken"],
  ["PanzerdragonVeldr", "M_Panzerdragon", "", "stone"],
  ["DevilOfTheSmeltedFears", "M_DevilSmeltedFears", "", "stone"],
  ["Eggknight", "M_Eggknight", "", "stone"],
  ["PuppetKing", "M_PuppetKing", "", "stone"],
  ["Stonemason", "M_Stonemason", "", "stone"],
  ["IroncastDead", "M_Ironcast", "", "stone"],
  ["Panzergeists", "M_Panzergeists", "", "stone"],
  ["YoungDevourDragon", "M_YoungDevour", "", "other"],
  ["Knighteater", "M_Knighteater", "", "other"],
  ["KnightOfTheFen", "M_KnightFen", "", "other"],
  ["PalebloodWorms", "M_PalebloodWorms", "", "other"],
  ["PumpkinheadMonstrosities", "M_Pumpkinhead", "", "other"],
  ["Ratwolves", "M_Ratwolves", "", "other"],
  ["WingedNightmare", "M_WingedNightmare", "", "other"],
  ["Upgrade", "升级装备", "Upgrade", "special"],
  ["Merchant", "商人装备", "Merchant", "special"],
  ["Consumable", "消耗品", "Consumable", "special"],
];

function walkObjects(objects, visit) {
  for (const object of objects || []) {
    visit(object);
    walkObjects(object.ContainedObjects, visit);
    for (const state of Object.values(object.States || {})) walkObjects([state], visit);
  }
}

function loadLabels() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(PUBLIC_ROOT, "monster-labels.js"), "utf8"), context);
  return context.window.KFMonsterLabels;
}

function imageDimensions(buffer) {
  if (buffer.length >= 24 && buffer.subarray(1, 4).toString("ascii") === "PNG") {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 < buffer.length) {
      if (buffer[offset++] !== 0xff) continue;
      while (buffer[offset] === 0xff) offset++;
      const marker = buffer[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      const length = buffer.readUInt16BE(offset);
      if (length < 2 || offset + length > buffer.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { width: buffer.readUInt16BE(offset + 5), height: buffer.readUInt16BE(offset + 3) };
      }
      offset += length;
    }
  }
  throw new Error("Only valid PNG/JPEG TTS cache images are supported");
}

const normalizedUrl = value => String(value).replace(/[^A-Za-z0-9]/g, "").toLowerCase();
const categoryTag = tag => tag === "GEAR_FirstmenWarrior" ? "GEAR_FirstmenWarriors" : tag;
const cleanName = value => String(value || "").trim();

// Pure catalog extraction. resolveImage(url) supplies a local path and image
// dimensions, so extraction is also usable in tests without writing resources.
function extractEquipment(save, labels, resolveImage) {
  const objects = new Map();
  walkObjects(save.ObjectStates, object => { if (object.GUID && !objects.has(object.GUID)) objects.set(object.GUID, object); });
  const deck = objects.get(DECK_GUID);
  const tierBag = objects.get(TIER_BAG_GUID);
  if (!deck?.ContainedObjects?.length) throw new Error(`Equipment deck ${DECK_GUID} is missing or empty`);
  if (!tierBag) throw new Error(`Equipment tier bag ${TIER_BAG_GUID} is missing`);
  const definitions = { ...(deck.CustomDeck || {}) };
  walkObjects(deck.ContainedObjects, object => Object.assign(definitions, object.CustomDeck || {}));

  function cardImage(card) {
    const cardId = Number(card.CardID);
    if (!Number.isInteger(cardId) || cardId < 0) throw new Error(`Invalid CardID for ${card.GUID}`);
    const definition = card.CustomDeck?.[Math.floor(cardId / 100)] || definitions[Math.floor(cardId / 100)];
    if (!definition) throw new Error(`No CustomDeck definition for card ${cardId}`);
    const columns = Number(definition.NumWidth);
    const rows = Number(definition.NumHeight);
    const index = cardId % 100;
    if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 1 || rows < 1 || index >= columns * rows) {
      throw new Error(`Card ${cardId} is outside its ${columns} × ${rows} atlas`);
    }
    const face = resolveImage(definition.FaceURL);
    const back = resolveImage(definition.BackURL);
    return {
      key: `${definition.FaceURL}|${cardId}`,
      image: {
        face: face.path, back: back.path, columns, rows, index,
        backIsAtlas: Boolean(definition.UniqueBack),
        cellWidth: face.width / columns, cellHeight: face.height / rows,
        backCellWidth: back.width / (definition.UniqueBack ? columns : 1),
        backCellHeight: back.height / (definition.UniqueBack ? rows : 1),
      },
    };
  }

  const byCard = new Map();
  let sourceCardCount = 0;
  walkObjects(deck.ContainedObjects, object => {
    if (!Number.isInteger(object.CardID)) return;
    sourceCardCount++;
    const { key, image } = cardImage(object);
    const tags = [...new Set(object.Tags || [])];
    const tier = TIER_ORDER.find(value => tags.includes(`TIER_${value}`)) || "Other";
    const orderText = cleanName(object.GMNotes);
    const order = orderText && Number.isFinite(Number(orderText)) ? Number(orderText) : 999;
    const name = cleanName(object.Nickname);
    const card = {
      id: object.GUID, cardId: object.CardID, name, description: cleanName(object.Description),
      categoryIds: [...new Set(tags.filter(tag => tag.startsWith("GEAR_")).map(categoryTag))],
      tier, order, tags, copies: 1, image,
    };
    const previous = byCard.get(key);
    if (!previous) byCard.set(key, card);
    else {
      previous.copies++;
      previous.categoryIds = [...new Set([...previous.categoryIds, ...card.categoryIds])];
      previous.tags = [...new Set([...previous.tags, ...card.tags])];
      if (!previous.name && name) previous.name = name;
      if (!previous.description && card.description) previous.description = card.description;
      previous.order = Math.min(previous.order, order);
    }
  });
  const cards = [...byCard.values()];
  for (const card of cards) {
    if (!card.name) {
      const correction = EMPTY_NAME_CORRECTIONS[card.cardId];
      if (correction) Object.assign(card, correction);
      else card.name = `未命名装备 #${card.cardId}`;
    }
    const correctedName = NAME_CORRECTIONS[card.name.toLowerCase()];
    if (correctedName) {
      card.originalName = card.name;
      card.name = correctedName;
    }
    const tier = TIER_ORDER.find(value => card.tags.includes(`TIER_${value}`));
    if (tier) card.tier = tier;
  }
  const categories = CATEGORY_SPECS.map(([id, label, nameEn, group]) => {
    const monster = labels.monsters[label];
    return { id: `GEAR_${id}`, name: monster?.zh || label, nameEn: monster?.en || nameEn, group };
  });
  const known = new Set(categories.map(category => category.id));
  for (const card of cards) for (const id of card.categoryIds) {
    if (!known.has(id)) {
      categories.push({ id, name: id.replace(/^GEAR_/, ""), nameEn: id.replace(/^GEAR_/, ""), group: "other" });
      known.add(id);
    }
  }
  const tiers = TIER_ORDER.map(id => ({ id, name: id === "Legendary" ? "传奇" : labels.tier(id), nameEn: id }));
  tiers.push({ id: "Other", name: "剧情装备", nameEn: "Story" });
  const tierCards = [];
  walkObjects(tierBag.ContainedObjects, object => {
    if (!Number.isInteger(object.CardID)) return;
    const tier = TIER_ORDER.find(value => cleanName(object.Nickname).toUpperCase() === `${value.toUpperCase()} GEAR`);
    if (!tier) return;
    tierCards.push({ id: object.GUID, cardId: object.CardID, tier, name: object.Nickname, image: cardImage(object).image });
  });
  const tierPosition = value => value === "Other" ? TIER_ORDER.length : TIER_ORDER.indexOf(value);
  cards.sort((a, b) => tierPosition(a.tier) - tierPosition(b.tier) || a.order - b.order || a.name.localeCompare(b.name, "en") || a.cardId - b.cardId);
  tierCards.sort((a, b) => tierPosition(a.tier) - tierPosition(b.tier));
  return { version: 1, source: { deckGuid: DECK_GUID, tierBagGuid: TIER_BAG_GUID, sourceCardCount }, categories, tiers, cards, tierCards };
}

function run(options = {}) {
  const saveInput = options.save || process.env.KF_TTS_SAVE;
  if (!saveInput) throw new Error("Use --save <TTS save.json> or set KF_TTS_SAVE");
  const savePath = path.resolve(saveInput);
  const imagesPath = path.resolve(options.images || process.env.KF_TTS_IMAGE_CACHE || path.join(path.dirname(savePath), "../Images"));
  const outputRoot = path.resolve(options.publicRoot || PUBLIC_ROOT);
  const assetRoot = path.join(outputRoot, "assets/equipment");
  const moduleRoot = path.join(outputRoot, "modules/equipment");
  const files = fs.readdirSync(imagesPath, { withFileTypes: true }).filter(entry => entry.isFile())
    .map(entry => ({ name: entry.name, key: path.parse(entry.name).name.toLowerCase() }));
  const images = new Map();
  const pendingImages = new Map();
  const resolveImage = url => {
    if (!url) throw new Error("Equipment card has no image URL");
    if (images.has(url)) return images.get(url);
    const key = normalizedUrl(url);
    const match = files.find(file => file.key === key) || files.find(file => file.key.startsWith(key));
    if (!match) throw new Error(`Local TTS image cache is missing ${url}`);
    const source = path.join(imagesPath, match.name);
    const buffer = fs.readFileSync(source);
    const dimensions = imageDimensions(buffer);
    const extension = buffer[0] === 0x89 ? ".png" : ".jpg";
    const digest = crypto.createHash("sha256").update(buffer).digest("hex");
    const filename = `${digest.slice(0, 20)}${extension}`;
    const asset = { path: `/assets/equipment/${filename}`, ...dimensions };
    images.set(url, asset);
    pendingImages.set(filename, buffer);
    return asset;
  };
  const save = JSON.parse(fs.readFileSync(savePath, "utf8"));
  const data = extractEquipment(save, loadLabels(), resolveImage);
  data.source.saveFile = path.basename(savePath);
  data.source.imageCount = pendingImages.size;
  // Resolve and validate the complete catalog before replacing any output.
  fs.mkdirSync(assetRoot, { recursive: true });
  fs.mkdirSync(moduleRoot, { recursive: true });
  for (const [filename, buffer] of pendingImages) {
    const destination = path.join(assetRoot, filename);
    if (!fs.existsSync(destination) || !fs.readFileSync(destination).equals(buffer)) fs.writeFileSync(destination, buffer);
  }
  fs.writeFileSync(path.join(moduleRoot, "data.js"), `// Generated by tools/import-tts-equipment.js from a local TTS save.\nwindow.KF_EQUIPMENT_DATA=${JSON.stringify(data, null, 2)};\n`, "utf8");
  return { data, imageCount: pendingImages.size };
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === "--help" || flag === "-h") return { help: true };
    if (!["--save", "--images"].includes(flag) || !args[index + 1] || args[index + 1].startsWith("--")) {
      throw new Error(`Unknown or incomplete argument: ${flag}`);
    }
    options[flag.slice(2)] = args[++index];
  }
  return options;
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) console.log("Usage: node tools/import-tts-equipment.js --save <save.json> [--images <Mods/Images>]\nImages default to ../Images beside the save; KF_TTS_SAVE and KF_TTS_IMAGE_CACHE are also supported.");
    else {
      const result = run(options);
      console.log(`Imported ${result.data.cards.length} unique equipment cards (${result.data.source.sourceCardCount} copies), ${result.data.categories.length} categories, ${result.data.tierCards.length} tier cards and ${result.imageCount} local images.`);
    }
  } catch (error) {
    console.error(`Equipment import failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { extractEquipment, imageDimensions, parseArgs, run };
