"use strict";

// 中文卡面清单（tools/localized-card-assets.json）与磁盘文件、卡牌数据三者必须一致：
// 文件被改动、卡面被重新切回英文、或裁切参数被写回扫描留白，这里都会先炸掉。

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const publicRoot = path.join(root, "public");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "tools/localized-card-assets.json"), "utf8"));
const sha256 = buffer => crypto.createHash("sha256").update(buffer).digest("hex");

function jpegSize(file) {
  const buffer = fs.readFileSync(file);
  assert.equal(buffer.readUInt16BE(0), 0xffd8, `not a jpeg: ${file}`);
  let offset = 2;
  while (offset < buffer.length) {
    assert.equal(buffer[offset++], 0xff);
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset++];
    const length = buffer.readUInt16BE(offset);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      return { width: buffer.readUInt16BE(offset + 5), height: buffer.readUInt16BE(offset + 3) };
    }
    offset += length;
  }
  throw new Error(`JPEG dimensions missing: ${file}`);
}

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(publicRoot, "modules/aibp/data/monster-data.js"), "utf8"), context);
const monsters = context.window.KF_MONSTER_DATA.monsters;
const cardsById = new Map();
for (const monster of monsters) for (const card of monster.cards || []) cardsById.set(card.id, card);

assert.ok(Array.isArray(manifest.assets) && manifest.assets.length > 0, "manifest must list the localized faces");

let checked = 0;
for (const entry of manifest.assets) {
  const file = path.join(publicRoot, entry.face.replace(/^\//, ""));
  assert.ok(fs.existsSync(file), `missing localized face: ${entry.face}`);

  const buffer = fs.readFileSync(file);
  assert.equal(sha256(buffer), entry.sha256,
    `localized face changed (update tools/localized-card-assets.json on purpose): ${entry.face}`);

  const size = jpegSize(file);
  assert.deepEqual(size, { width: entry.width, height: entry.height }, `face size mismatch: ${entry.face}`);

  assert.ok(entry.cards.length > 0, `no cards listed for ${entry.face}`);
  for (const cardId of entry.cards) {
    const card = cardsById.get(cardId);
    assert.ok(card, `card missing from monster-data.js: ${cardId}`);
    assert.equal(card.image.face, entry.face, `${cardId} must use the localized face`);

    const crop = card.image.faceCrop;
    assert.ok(crop, `${cardId} faceCrop`);
    assert.deepEqual([crop.width, crop.height, crop.x, crop.y], [1, 1, 0, 0],
      `${cardId} crop must be full-bleed, not the atlas/scan crop`);
    assert.deepEqual([crop.cellWidth, crop.cellHeight], [entry.width, entry.height],
      `${cardId} crop cell size`);
    checked += 1;
  }
}

for (const monster of monsters) {
  for (const card of monster.cards || []) {
    assert.ok(!String(card.image?.face || "").includes("traits-zh"),
      `${card.id} still points at the removed traits-zh folder`);
  }
}

console.log(`localized card assets: ${manifest.assets.length} files, ${checked} cards, sha256 + full-bleed geometry verified`);
