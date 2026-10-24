"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const context = { window: {}, esc: String, asset: value => value };
for (const file of [
  "public/modules/aibp/data/monster-data.js", "public/modules/map/data/map-data.js",
  "public/modules/encounter/data/encounter-data.js", "public/modules/display/data/conflict-board-data.js",
  "public/modules/encounter/encounter-view.js"
]) vm.runInNewContext(read(file), context, { filename: file });
function extract(source, name) {
  const start = source.indexOf(`  function ${name}(`);
  const end = source.indexOf("\n  }", start) + 4;
  assert.ok(start >= 0 && end > start, name);
  return source.slice(start, end);
}
const host = read("public/modules/aibp/app.js");
const mirror = read("public/modules/display/app.js");
const mapHost = read("public/modules/map/app.js");
const mapView = read("public/modules/map/map-view.js");
for (const [source, names] of [
  [host, ["cropStyle", "conflictAssetSrc", "conflictTerrainCardFaceHtml", "foolCardFaceHtml"]],
  [mirror, ["aibpAsset", "displayAsset", "cardArt", "terrainCardsFor", "terrainCardFace"]],
  [mapHost, ["cardStyle"]], [mapView, ["explorationCardStyle"]]
]) for (const name of names) vm.runInNewContext(extract(source, name), context);

const sizes = new Map();
function imageSize(uri) {
  if (sizes.has(uri)) return sizes.get(uri);
  const buffer = fs.readFileSync(path.join(root, "public", uri.split(/[?#]/)[0]));
  if (buffer.readUInt32BE(0) === 0x89504e47) {
    const size = [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
    sizes.set(uri, size);
    return size;
  }
  assert.equal(buffer.readUInt16BE(0), 0xffd8, `image format: ${uri}`);
  let offset = 2;
  while (offset < buffer.length) {
    assert.equal(buffer[offset++], 0xff);
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset++];
    const length = buffer.readUInt16BE(offset);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      const size = [buffer.readUInt16BE(offset + 5), buffer.readUInt16BE(offset + 3)];
      sizes.set(uri, size);
      return size;
    }
    offset += length;
  }
  throw new Error(`JPEG dimensions missing: ${uri}`);
}
const close = (a, b, label) => assert.ok(Math.abs(a - b) < 1e-6, `${label}: ${a} != ${b}`);
const variable = (style, name) => Number(style.match(new RegExp(`--${name}:([^;%]+)`))?.[1]);
function geometry(image, side, sharedBack = false) {
  const uri = image[side];
  const [width, height] = imageSize(uri);
  const crop = image[`${side}Crop`];
  if (!crop) {
    assert.ok(sharedBack || (Number(image.width) < 2 && Number(image.height) < 2), `uncut card side: ${uri}`);
    return null;
  }
  const cellWidth = crop.cellWidth || width / crop.width;
  const cellHeight = crop.cellHeight || height / crop.height;
  close(crop.width, width / cellWidth, `${uri} native width`);
  close(crop.height, height / cellHeight, `${uri} native height`);
  const left = (width - cellWidth) * (crop.x || 0) / 100;
  const top = (height - cellHeight) * (crop.y || 0) / 100;
  assert.ok(left >= -1e-6 && top >= -1e-6, uri);
  assert.ok(left + cellWidth <= width + 1e-6 && top + cellHeight <= height + 1e-6, uri);
  close(left, Math.round(left), `${uri} source column alignment`);
  close(top, Math.round(top), `${uri} source row alignment`);
  return crop;
}
let checked = 0;
function verifyMonsterCards() {
  for (const monster of context.window.KF_MONSTER_DATA.monsters) {
    for (const card of monster.cards) for (const side of ["face", "back"]) {
      const image = card.image;
      if (!image?.[side]) continue;
      const crop = geometry(image, side);
      const style = context.cropStyle(image, side);
      const sharedStyle = context.cardArt(card, side);
      if (crop) {
        close(variable(style, "cols"), crop.width, `${card.id} host width`);
        close(variable(style, "rows"), crop.height, `${card.id} host height`);
        close(variable(style, "x"), crop.x || 0, `${card.id} host x`);
        close(variable(style, "y"), crop.y || 0, `${card.id} host y`);
        assert.ok(sharedStyle.includes(`background-size:${crop.width * 100}% ${crop.height * 100}%`));
        assert.ok(sharedStyle.includes(`background-position:${crop.x || 0}% ${crop.y || 0}%`));
        close(variable(style, "card-aspect"), crop.aspect, `${card.id} aspect`);
      }
      assert.ok(style.includes(image[side]) && sharedStyle.includes(image[side]));
      checked += 1;
    }
  }
}
verifyMonsterCards();
vm.runInNewContext(read("public/modules/aibp/data/localized-traits.js"), context);
vm.runInNewContext(read("public/modules/aibp/data/localized-sheets.js"), context);
verifyMonsterCards();

for (const rules of Object.values(context.window.KF_MOD_DATA.kingdomRules)) {
  for (const category of ["exploration", "specialExploration", "deepFog"]) {
    for (const card of rules[category] || []) for (const side of ["face", "back"]) {
      const image = card.image, crop = geometry(image, side, side === "back" && !image.uniqueBack);
      const style = context.cardStyle(image, side);
      const sharedStyle = context.explorationCardStyle(image, side, "");
      assert.ok(style.includes(image[side]) && sharedStyle.includes(image[side]));
      if (crop) for (const [name, expected] of [["cols", crop.width], ["rows", crop.height], ["x", crop.x], ["y", crop.y]]) {
        close(variable(style, name), expected, `${card.id} map ${name}`);
        close(variable(sharedStyle, `exploration-${name}`), expected, `${card.id} map viewer ${name}`);
      }
      checked += 1;
    }
  }
}
for (const monster of context.window.KF_ENCOUNTER_DATA.monsters) {
  for (const level of monster.encounterLevels) for (const side of ["face", "back"]) {
    const image = level.image;
    if (!image?.[side]) continue;
    const crop = geometry(image, side);
    const html = context.window.KFEncounterView.renderCard(level, side, "");
    assert.ok(html.includes(image[side]), `${monster.id} encounter source`);
    if (crop) {
      const style = html.match(/style="width:([^%]+)%;height:([^%]+)%;left:([^%]+)%;top:([^%;]+)%/);
      assert.ok(style, "encounter image geometry");
      close(Number(style[1]), crop.width * 100, `${monster.id} encounter width`);
      close(Number(style[2]), crop.height * 100, `${monster.id} encounter height`);
      close(Number(style[3]), (1 - crop.width) * crop.x, `${monster.id} encounter left`);
      close(Number(style[4]), (1 - crop.height) * crop.y, `${monster.id} encounter top`);
    }
    if (image.colorCorrection?.channelGain) assert.ok(html.includes("feColorMatrix") || html.includes("feComponentTransfer"));
    if (image.cornerRadiusRatio) assert.ok(html.includes("border-radius:"));
    checked += 1;
  }
}
const conflict = context.window.KF_CONFLICT_BOARD_DATA;
assert.deepEqual(JSON.parse(JSON.stringify(conflict)), JSON.parse(read("public/modules/display/data/conflict-board-data.json")));
for (const [kind, cards] of [["terrain", Object.values(conflict.terrainCards.byAsset)], ["fool", conflict.foolDeck.cards]]) {
  for (const card of cards) {
    const crop = geometry(card.image, "face");
    assert.ok(crop);
    const html = kind === "terrain" ? context.conflictTerrainCardFaceHtml(card) : context.foolCardFaceHtml(card);
    const sharedHtml = kind === "terrain" ? context.terrainCardFace(card) : html;
    for (const markup of [html, sharedHtml]) {
      assert.ok(markup.includes(card.image.face));
      close(variable(markup, "card-sheet-width"), crop.width * 100, `${card.cardId} conflict width`);
      close(variable(markup, "card-sheet-height"), crop.height * 100, `${card.cardId} conflict height`);
      close(variable(markup, "card-left"), (1 - crop.width) * crop.x, `${card.cardId} conflict left`);
      close(variable(markup, "card-top"), (1 - crop.height) * crop.y, `${card.cardId} conflict top`);
    }
    checked += 1;
  }
}
assert.ok(context.terrainCardsFor([{ asset: "Rubble2" }, { asset: "RubbleLM" }]).length === 1, "terrain variants still reuse one card");
assert.match(read("public/modules/encounter/app.js"), /KFEncounterView\.renderCard\(card, level\.side \|\| "face", ""\)/, "preview uses the same rendering and color correction as the board");
console.log(`card atlas crops: ${checked} rendered sides; ${sizes.size} images; pairing, native scale, both screens, localization, encounter corrections and terrain reuse verified`);
