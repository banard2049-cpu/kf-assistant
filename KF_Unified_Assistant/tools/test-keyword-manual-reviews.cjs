"use strict";
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
const data = read("public/keyword-data/card-keywords.json").cards;
const dictionary = new Set(read("public/keyword-data/keywords.json").entries.map(item => item.id));
const manifest = new Map(read("card-ocr-manifest.json").map(item => [item.id, item.path]));
const shards = fs.readdirSync(path.join(root, "tools"))
  .filter(name => /^card-keyword-.*-(?:overrides|reviews)\.json$/.test(name))
  .map(name => `tools/${name}`);
const seen = new Set();
for (const shard of shards) {
  for (const [id, review] of Object.entries(read(shard).cards)) {
    assert.ok(!seen.has(id), `duplicate review ${id}`);
    seen.add(id);
    const images = review.images ? Object.values(review.images) :
      [typeof review.image === "object" ? review.image : {path: review.image, sha256: review.sha256}];
    assert.ok(images.some(image => manifest.get(id) === image.path), `image differs: ${id}`);
    assert.equal(new Set(review.keywords).size, review.keywords.length, `duplicate keyword: ${id}`);
    review.keywords.forEach(word => assert.ok(dictionary.has(word), `unknown keyword: ${id} ${word}`));
    assert.deepEqual(data[id], review.keywords, `generated index differs from reviewed card ${id}`);
    for (const item of images) {
      const image = path.join(root, "public", item.path.replace(/^\/+/, ""));
      if (fs.existsSync(image)) {
        const hash = crypto.createHash("sha256").update(fs.readFileSync(image)).digest("hex");
        assert.equal(hash, item.sha256, `reviewed card image changed: ${id}`);
      }
    }
  }
}
for (const id of manifest.keys()) {
  if (id.endsWith(":sheet-back")) continue; // Reviewed together with its sheet front.
  assert.ok(seen.has(id), `boss sheet or card is not reviewed: ${id}`);
}
console.log(`manual card review: ${seen.size} records verified`);
