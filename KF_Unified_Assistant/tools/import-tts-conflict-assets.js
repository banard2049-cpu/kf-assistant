"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULT_SAVE = "E:/Document/My Games/Tabletop Simulator/Mods/Workshop/(Don)KF 1.8.json";
const DEFAULT_CACHE = "E:/Document/My Games/Tabletop Simulator/Mods/Images";
const PUBLIC_ROOT = path.resolve(__dirname, "../public/modules/display");
const DATA_ROOT = path.join(PUBLIC_ROOT, "data");
const ASSET_ROOT = path.join(PUBLIC_ROOT, "assets/conflict");
const BOARD_URL = "https://steamusercontent-a.akamaihd.net/ugc/16850804953734550429/D9D2F39AE9D45A6B70F318F6D032EEACE2C2BF26/";
const TERRAIN_CARD_ASSETS = {
  Bloodgeyser: "Bloodgeyser",
  Campfire: "Campfire",
  Column: "Column",
  GreatMangrove: "Great Mangrove",
  LooseString: "Loose String",
  Paleburrow: "Paleburrow",
  PrimalRemnant: "Primal Remnant",
  RottenStump: "Rotten Stump",
  Rubble2: "Rubble",
  Rubble4: "Rubble",
  RubbleL: "Rubble",
  RubbleLM: "Rubble",
  RuinedWall4: "Ruined Wall",
  RuinedWallL: "Ruined Wall",
  RuinedWallLM: "Ruined Wall",
  Rut: "Rut",
  Rut2: "Rut",
  SlimyThrone: "Slimy Throne",
  Swamp: "Swamp",
  Swamp2: "Swamp",
  Tower: "Tower",
  Well: "Bottomless Well",
};

function tokenize(source, offset = 0) {
  const tokens = [];
  let index = offset;
  while (index < source.length) {
    const rest = source.slice(index);
    const whitespace = rest.match(/^\s+/);
    if (whitespace) { index += whitespace[0].length; continue; }
    const comment = rest.match(/^--[^\r\n]*/);
    if (comment) { index += comment[0].length; continue; }
    const string = rest.match(/^(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/);
    if (string) {
      const raw = string[0];
      tokens.push({ type: "string", value: raw.slice(1, -1).replace(/\\([\\"'])/g, "$1") });
      index += raw.length;
      continue;
    }
    const number = rest.match(/^-?(?:\d+\.\d+|\d+|\.\d+)/);
    if (number) { tokens.push({ type: "number", value: Number(number[0]) }); index += number[0].length; continue; }
    const identifier = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (identifier) { tokens.push({ type: "identifier", value: identifier[0] }); index += identifier[0].length; continue; }
    if ("{}[]=,;".includes(source[index])) {
      tokens.push({ type: source[index], value: source[index] });
      index += 1;
      continue;
    }
    throw new Error(`Unsupported Lua token near: ${source.slice(index, index + 40)}`);
  }
  return tokens;
}

function parseLuaValue(tokens, start = 0) {
  let index = start;
  const peek = value => tokens[index]?.type === value;
  const take = value => {
    if (!peek(value)) throw new Error(`Expected ${value}, got ${tokens[index]?.type || "EOF"}`);
    return tokens[index++];
  };
  function parseValue() {
    const token = tokens[index];
    if (!token) throw new Error("Unexpected end of Lua value");
    if (token.type === "string" || token.type === "number") { index += 1; return token.value; }
    if (token.type === "identifier") {
      index += 1;
      if (token.value === "true") return true;
      if (token.value === "false") return false;
      if (token.value === "nil") return null;
      return token.value;
    }
    if (token.type === "{") return parseTable();
    throw new Error(`Unexpected Lua token ${token.type}`);
  }
  function parseTable() {
    take("{");
    const array = [];
    const keyed = {};
    let hasKeys = false;
    while (!peek("}")) {
      if (peek("[")) {
        take("[");
        const key = parseValue();
        take("]"); take("=");
        keyed[String(key)] = parseValue();
        hasKeys = true;
      } else if (peek("identifier") && tokens[index + 1]?.type === "=") {
        const key = take("identifier").value;
        take("=");
        keyed[key] = parseValue();
        hasKeys = true;
      } else {
        array.push(parseValue());
      }
      if (peek(",") || peek(";")) index += 1;
      else if (!peek("}")) throw new Error(`Expected table separator, got ${tokens[index]?.type}`);
    }
    take("}");
    if (!hasKeys) return array;
    array.forEach((value, itemIndex) => { keyed[String(itemIndex + 1)] = value; });
    return keyed;
  }
  return { value: parseValue(), next: index };
}

function extractLuaTable(lua, name) {
  const match = new RegExp(`(?:local\\s+)?${name}\\s*=\\s*\\{`).exec(lua);
  if (!match) throw new Error(`Lua table not found: ${name}`);
  const brace = lua.indexOf("{", match.index);
  let depth = 0;
  let quote = "";
  let escaped = false;
  let end = -1;
  for (let index = brace; index < lua.length; index += 1) {
    const char = lua[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === "-" && lua[index + 1] === "-") {
      index = lua.indexOf("\n", index);
      if (index < 0) break;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}" && --depth === 0) { end = index + 1; break; }
  }
  if (end < 0) throw new Error(`Unclosed Lua table: ${name}`);
  return parseLuaValue(tokenize(lua.slice(brace, end))).value;
}

function walkObjects(objects, visit) {
  for (const object of objects || []) {
    visit(object);
    walkObjects(object.ContainedObjects, visit);
  }
}

function objectIndex(objects) {
  const index = new Map();
  walkObjects(objects, object => {
    if (object.GUID && !index.has(object.GUID)) index.set(object.GUID, object);
  });
  return index;
}

function assetUrl(object) {
  const candidate = object?.ContainedObjects?.[0] || object;
  return candidate?.CustomImage?.ImageURL || candidate?.CustomImage?.ImageSecondaryURL || candidate?.CustomTexture?.ImageURL || "";
}

function normalizedUrl(value) {
  return String(value).replace(/[^A-Za-z0-9]/g, "").toLowerCase();
}

function cacheIndex(cacheRoot) {
  return fs.readdirSync(cacheRoot, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => ({ name: entry.name, normalized: path.parse(entry.name).name.toLowerCase() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function findCachedFile(url, cacheRoot, files) {
  const key = normalizedUrl(url);
  const match = files.find(file => file.normalized === key) || files.find(file => file.normalized.startsWith(key));
  if (!match) throw new Error(`TTS cache file not found for ${url}`);
  return path.join(cacheRoot, match.name);
}

function imageDimensions(buffer) {
  if (buffer.slice(1, 4).toString("ascii") === "PNG") {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      const length = buffer.readUInt16BE(offset + 2);
      if (!Number.isFinite(length) || length < 2) break;
      offset += length + 2;
    }
  }
  throw new Error("Unsupported or corrupt PNG/JPEG asset");
}

function inspectFile(filename) {
  const buffer = fs.readFileSync(filename);
  return {
    ...imageDimensions(buffer),
    bytes: buffer.length,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
  };
}

function safeName(name, extension) {
  return `${name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase()}${extension.toLowerCase()}`;
}

function parseRef(ref) {
  const points = String(ref).split("-").map(value => {
    const match = /^([A-J])(1[0-4]|[1-9])$/.exec(value);
    if (!match) throw new Error(`Invalid clash grid reference: ${ref}`);
    // The printed TTS board runs J to A from top to bottom.
    return { row: 11 - (match[1].charCodeAt(0) - 64), column: Number(match[2]) };
  });
  const end = points[1] || points[0];
  return {
    rowStart: Math.min(points[0].row, end.row), rowEnd: Math.max(points[0].row, end.row),
    columnStart: Math.min(points[0].column, end.column), columnEnd: Math.max(points[0].column, end.column),
  };
}

function placementKind(name) {
  if (name === "KnightStart") return "knight";
  if (/^Number\d+$/.test(name)) return "number";
  if (["Armor", "FallenKnight", "RedSapling", "LictorDecoy"].includes(name)) return "special";
  if (["Bloodgeyser", "Paleburrow", "RuinedWall4", "RuinedWallL", "Rubble4", "Rubble2", "RubbleL", "Rut", "Rut2", "Swamp", "Swamp2", "PrimalRemnant", "Campfire", "GreatMangrove", "LooseString", "SlimyThrone", "Well", "RottenStump", "Tower", "Column", "RubbleLM", "RuinedWallLM"].includes(name)) return "terrain";
  return "monster";
}

function normalizeLayout(kingdom, label, entries, monsterTagMap, orientationMap) {
  const monsterId = monsterTagMap[label] || label.replace(/^Clash\s+/, "");
  const levelVariant = /Level1$/i.test(label) ? "1" : /Level2\+$/i.test(label) ? "2+" : "all";
  return {
    id: `${kingdom}:${monsterId}:${levelVariant}`,
    label,
    monsterId,
    kingdom,
    levelVariant,
    placements: entries.map((entry, index) => {
      const [asset, ref, orientation = "N"] = entry;
      const kind = placementKind(asset);
      return {
        id: `${asset}-${index + 1}`,
        kind,
        asset,
        ref,
        ...parseRef(ref),
        orientation,
        rotation: Object.prototype.hasOwnProperty.call(orientationMap, orientation) ? orientationMap[orientation] : null,
        layer: { terrain: 10, special: 30, number: 35, knight: 40, monster: 50 }[kind],
      };
    }),
  };
}

function writeStableJson(filename, value) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, `${JSON.stringify(value, null, 2)}\n`);
}

function run(options = {}) {
  const savePath = path.resolve(options.save || process.env.KF_TTS_SAVE || DEFAULT_SAVE);
  const cacheRoot = path.resolve(options.cache || process.env.KF_TTS_IMAGE_CACHE || DEFAULT_CACHE);
  const save = JSON.parse(fs.readFileSync(savePath, "utf8"));
  const setup = save.ObjectStates.find(object => object.Nickname === "CLASH SETUP SCRIPT");
  if (!setup?.LuaScript) throw new Error("CLASH SETUP SCRIPT object not found");

  const kingdoms = extractLuaTable(setup.LuaScript, "kingdoms");
  const spawnBags = extractLuaTable(setup.LuaScript, "spawnBags");
  const monsterTagMap = extractLuaTable(setup.LuaScript, "monsterTagMap");
  const orientationMap = extractLuaTable(setup.LuaScript, "orientationMap");
  const objects = objectIndex(save.ObjectStates);
  const cacheFiles = cacheIndex(cacheRoot);
  fs.mkdirSync(ASSET_ROOT, { recursive: true });
  fs.mkdirSync(path.join(ASSET_ROOT, "terrain"), { recursive: true });

  const boardSource = findCachedFile(BOARD_URL, cacheRoot, cacheFiles);
  const boardTarget = path.join(ASSET_ROOT, `board-source${path.extname(boardSource).toLowerCase()}`);
  fs.copyFileSync(boardSource, boardTarget);
  const manifestAssets = [{
    id: "board-source", kind: "board", sourceUrl: BOARD_URL,
    cacheFile: path.basename(boardSource), publicPath: `assets/conflict/${path.basename(boardTarget)}`,
    ...inspectFile(boardSource),
  }];

  const usedNames = new Set();
  for (const layouts of Object.values(kingdoms)) {
    for (const entries of Object.values(layouts)) entries.forEach(entry => usedNames.add(entry[0]));
  }
  const publicAssets = {};
  [...usedNames].sort().forEach(name => {
    const guid = spawnBags[name];
    const object = objects.get(guid);
    const url = assetUrl(object);
    if (!url) return;
    const source = findCachedFile(url, cacheRoot, cacheFiles);
    const filename = safeName(name, path.extname(source));
    const target = path.join(ASSET_ROOT, "terrain", filename);
    fs.copyFileSync(source, target);
    publicAssets[name] = `assets/conflict/terrain/${filename}`;
    manifestAssets.push({
      id: name, kind: placementKind(name), guid, sourceUrl: url,
      cacheFile: path.basename(source), publicPath: publicAssets[name], ...inspectFile(source),
    });
  });

  let terrainCardBag = null;
  walkObjects(save.ObjectStates, object => {
    if (!terrainCardBag && object.Nickname === "地形卡组") terrainCardBag = object;
  });
  const terrainCardDeck = terrainCardBag?.ContainedObjects?.find(object =>
    object.Name === "Deck" && object.CustomDeck && Array.isArray(object.ContainedObjects)
  );
  const terrainCardDeckDefinition = Object.values(terrainCardDeck?.CustomDeck || {})[0];
  if (!terrainCardDeckDefinition?.FaceURL) throw new Error("TTS terrain card deck not found");
  const terrainCardSource = findCachedFile(terrainCardDeckDefinition.FaceURL, cacheRoot, cacheFiles);
  const terrainCardTarget = path.join(ASSET_ROOT, `terrain-card-sheet${path.extname(terrainCardSource).toLowerCase()}`);
  fs.copyFileSync(terrainCardSource, terrainCardTarget);
  const terrainCardMeta = inspectFile(terrainCardSource);
  const terrainCardColumns = Number(terrainCardDeckDefinition.NumWidth) || 10;
  const terrainCardRows = Number(terrainCardDeckDefinition.NumHeight) || 2;
  const terrainCardsByName = new Map((terrainCardDeck.ContainedObjects || []).map(card => [card.Nickname, card]));
  const terrainCardsByAsset = {};
  for (const [asset, cardName] of Object.entries(TERRAIN_CARD_ASSETS)) {
    if (!usedNames.has(asset)) continue;
    const card = terrainCardsByName.get(cardName);
    const cardId = Number(card?.CardID);
    const cardIndex = cardId % 100;
    if (!Number.isInteger(cardId) || cardIndex < 0 || cardIndex >= terrainCardColumns * terrainCardRows) {
      throw new Error(`TTS terrain card missing or invalid: ${cardName}`);
    }
    terrainCardsByAsset[asset] = {
      cardId,
      label: cardName,
      column: cardIndex % terrainCardColumns,
      row: Math.floor(cardIndex / terrainCardColumns),
    };
  }
  const terrainCardPublicPath = `assets/conflict/${path.basename(terrainCardTarget)}`;
  manifestAssets.push({
    id: "terrain-card-sheet", kind: "terrain-card-sheet", sourceUrl: terrainCardDeckDefinition.FaceURL,
    cacheFile: path.basename(terrainCardSource), publicPath: terrainCardPublicPath, ...terrainCardMeta,
  });

  const kingdomNames = { "sunken kingdom": "sunken", "principality of stone": "stone" };
  const layouts = Object.entries(kingdoms).flatMap(([name, kingdomLayouts]) =>
    Object.entries(kingdomLayouts).map(([label, entries]) => normalizeLayout(kingdomNames[name.toLowerCase()] || name, label, entries, monsterTagMap, orientationMap))
  ).sort((a, b) => a.id.localeCompare(b.id));
  const boardMeta = manifestAssets[0];
  const data = {
    version: 1,
    source: { saveFile: path.basename(savePath), scriptGuid: setup.GUID },
    grid: { rows: 10, columns: 14, labels: "A-J x 1-14", ttsOrigin: { x: -48.91, y: 1.25, z: 1.05 }, ttsStep: { x: 1.995, z: 1.995 } },
    board: { asset: boardMeta.publicPath, width: boardMeta.width, height: boardMeta.height, crop: { x: 748, y: 340, width: 5328, height: 3808 } },
    terrainCards: {
      sheet: { asset: terrainCardPublicPath, width: terrainCardMeta.width, height: terrainCardMeta.height, columns: terrainCardColumns, rows: terrainCardRows },
      byAsset: terrainCardsByAsset,
    },
    randomOrientations: { R: [0, 90, 180, 270], K: [180, 270] },
    orientationMap,
    assets: publicAssets,
    layouts,
  };
  const manifest = {
    version: 1,
    source: { saveFile: path.basename(savePath), imageCache: path.basename(cacheRoot) },
    assets: manifestAssets.sort((a, b) => a.id.localeCompare(b.id)),
  };
  writeStableJson(path.join(DATA_ROOT, "conflict-board-data.json"), data);
  writeStableJson(path.join(DATA_ROOT, "conflict-assets-manifest.json"), manifest);
  fs.writeFileSync(path.join(DATA_ROOT, "conflict-board-data.js"), `window.KF_CONFLICT_BOARD_DATA=${JSON.stringify(data)};\n`);
  return { layouts: layouts.length, assets: manifestAssets.length, data, manifest };
}

if (require.main === module) {
  const result = run();
  console.log(`Imported ${result.layouts} layouts and ${result.assets} original TTS image assets.`);
}

module.exports = { tokenize, parseLuaValue, extractLuaTable, parseRef, imageDimensions, normalizeLayout, run };
