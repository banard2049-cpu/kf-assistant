"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
function functionSource(source, name) {
  const start = source.indexOf(`  function ${name}(`);
  const end = source.indexOf("\n  }", start) + 4;
  assert.ok(start >= 0 && end > start, `${name} must exist`);
  return source.slice(start, end);
}
const context = { window: {} };
vm.runInNewContext(read("public/modules/aibp/data/monster-data.js"), context);
const host = read("public/modules/aibp/app.js");
const display = read("public/modules/display/app.js");
vm.runInNewContext([
  functionSource(host, "cropStyle"),
  functionSource(display, "aibpAsset"),
  functionSource(display, "cardArt")
].join("\n"), context);

function jpegSize(file) {
  const buffer = fs.readFileSync(file);
  assert.equal(buffer.readUInt16BE(0), 0xffd8, "back must be a JPEG");
  let offset = 2;
  while (offset < buffer.length) {
    assert.equal(buffer[offset++], 0xff);
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset++];
    const length = buffer.readUInt16BE(offset);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      return [buffer.readUInt16BE(offset + 5), buffer.readUInt16BE(offset + 3)];
    }
    offset += length;
  }
  throw new Error(`JPEG dimensions missing: ${file}`);
}
const property = (style, name) => Number(style.match(new RegExp(`--${name}:([^;%]+)`))?.[1]);
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-7, `${message}: ${actual} != ${expected}`);
const imageSizes = new Map();
let checked = 0;
function verifyCards() {
  for (const monster of context.window.KF_MONSTER_DATA.monsters) {
    for (const card of monster.cards) {
      const image = card.image;
      if (!image?.backCrop) continue;
      const crop = image.backCrop;
      if (!imageSizes.has(image.back)) imageSizes.set(image.back, jpegSize(path.join(root, "public", image.back)));
      const [width, height] = imageSizes.get(image.back);
      const style = context.cropStyle(image, "back");
      const mirror = context.cardArt(card, "back");
      const cols = property(style, "cols"), rows = property(style, "rows");
      const x = property(style, "x"), y = property(style, "y");
      const mirrorSize = mirror.match(/background-size:([^%]+)% ([^%]+)%/);
      const mirrorPosition = mirror.match(/background-position:([^%]+)% ([^%]+)%/);
      close(cols, width / crop.cellWidth, `${card.id} horizontal pixel scale`);
      close(rows, height / crop.cellHeight, `${card.id} vertical pixel scale`);
      close(cols * 100, Number(mirrorSize[1]), `${card.id} second-screen width`);
      close(rows * 100, Number(mirrorSize[2]), `${card.id} second-screen height`);
      close(x, Number(mirrorPosition[1]), `${card.id} second-screen offset x`);
      close(y, Number(mirrorPosition[2]), `${card.id} second-screen offset y`);
      // Lossless crops can retain context on both edges for chroma interpolation.
      const left = (cols - 1) * x / 100 * width / cols;
      const top = (rows - 1) * y / 100 * height / rows;
      close(left, Math.round(left), `${card.id} padding x`);
      close(top, Math.round(top), `${card.id} padding y`);
      assert.ok(left >= -1e-7 && left + crop.cellWidth <= width + 1e-7);
      assert.ok(top >= -1e-7 && top + crop.cellHeight <= height + 1e-7);
      close(property(style, "card-aspect"), crop.aspect, `${card.id} back aspect`);
      assert.ok(style.includes(image.back) && mirror.includes(image.back));
      const frontStyle = context.cropStyle(image, "face");
      const frontCrop = image.faceCrop || image;
      close(property(frontStyle, "cols"), frontCrop.width, `${card.id} front columns`);
      close(property(frontStyle, "rows"), frontCrop.height, `${card.id} front rows`);
      assert.ok(frontStyle.includes(image.face));
      checked += 1;
    }
  }
}
verifyCards();
assert.ok(checked > 0, "the optimized card backs must be exercised");

// Localized faces reset their grid to 1x1; their backs must retain an independent crop.
vm.runInNewContext(read("public/modules/aibp/data/localized-traits.js"), context);
vm.runInNewContext(read("public/modules/aibp/data/localized-sheets.js"), context);
verifyCards();
const legacy = { face: "front.jpg", back: "back.jpg", width: 10, height: 4, index: 37, aspect: .7 };
const legacyStyle = context.cropStyle(legacy, "back");
close(property(legacyStyle, "cols"), 10, "legacy back grid");
close(property(legacyStyle, "x"), 7 / 9 * 100, "legacy back column");
close(property(legacyStyle, "y"), 100, "legacy back row");

// All single-wound instances share one extracted cell. Its JPEG block padding
// must be hidden on both sides, and the independent double-wound card stays 1x1.
for (const [kind, wound] of Object.entries(context.window.KF_MONSTER_DATA.wounds)) {
  const image = wound.image;
  const [width, height] = jpegSize(path.join(root, "public", image.face));
  assert.equal(image.face, image.back, `${kind} wound uses the same art on both sides`);
  for (const side of ["face", "back"]) {
    const style = context.cropStyle(image, side);
    const mirror = context.cardArt(wound, side);
    const cols = property(style, "cols"), rows = property(style, "rows");
    const x = property(style, "x"), y = property(style, "y");
    close(cols, width / image.cellWidth, `${kind} wound horizontal scale`);
    close(rows, height / image.cellHeight, `${kind} wound vertical scale`);
    close((cols - 1) * x / 100 * width / cols, width - image.cellWidth, `${kind} wound padding x`);
    close((rows - 1) * y / 100 * height / rows, height - image.cellHeight, `${kind} wound padding y`);
    close(property(style, "card-aspect"), image.aspect, `${kind} wound original aspect`);
    assert.ok(mirror.includes(`background-size:${cols * 100}% ${rows * 100}%`));
    assert.ok(mirror.includes(`background-position:${x}% ${y}%`));
  }
}
assert.equal(context.window.KF_MONSTER_DATA.wounds.single.value, 1);
assert.equal(context.window.KF_MONSTER_DATA.wounds.double.value, 2);
console.log(`monster card backs: ${imageSizes.size} images; native pixel scale, padding, front crops, localization and both screens verified`);
