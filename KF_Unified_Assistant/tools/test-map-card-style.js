"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("public/modules/map/app.js", "utf8").replace(/\r\n/g, "\n");
const start = source.indexOf("  function cardStyle(");
const end = source.indexOf("\n\n  function cardView(", start);
assert.ok(start >= 0 && end > start, "cardStyle function not found");

const cardStyleSource = source.slice(start, end);
function styleFor(image, side) {
  const context = { image, side };
  vm.runInNewContext(`${cardStyleSource}; result = cardStyle(image, side);`, context);
  return context.result;
}

const uniqueBackStyle = styleFor({
  face: "face.jpg", back: "back.jpg", width: 10, height: 3, index: 13,
  uniqueBack: true, aspect: .702
}, "back");
assert.match(uniqueBackStyle, /--cols:10;--rows:3/);
assert.match(uniqueBackStyle, /--x:33\.33333333333333%;--y:50%/);

const sharedBackStyle = styleFor({
  face: "face.jpg", back: "shared-back.jpg", width: 10, height: 2, index: 13,
  uniqueBack: false, aspect: .635
}, "back");
assert.match(sharedBackStyle, /--image:url\("shared-back\.jpg"\);--cols:1;--rows:1;--x:0%;--y:0%/);

const faceStyle = styleFor({
  face: "face.jpg", back: "shared-back.jpg", width: 10, height: 2, index: 13,
  uniqueBack: false, aspect: .635
}, "face");
assert.match(faceStyle, /--cols:10;--rows:2/);

const dataContext = { window: {} };
vm.runInNewContext(fs.readFileSync("public/modules/map/data/map-data.js", "utf8"), dataContext);
for (const [kingdom, rules] of Object.entries(dataContext.window.KF_MOD_DATA.kingdomRules)) {
  const exploration = rules.exploration[0];
  const fog = rules.deepFog[0];
  assert.equal(exploration.image.uniqueBack, true, `${kingdom} exploration backs use an atlas`);
  assert.equal(fog.image.uniqueBack, false, `${kingdom} fog cards use a shared back`);
  assert.match(styleFor(exploration.image, "back"), /--cols:10;--rows:3/);
  assert.match(styleFor(fog.image, "back"), /--cols:1;--rows:1;--x:0%;--y:0%/);
}

console.log("map card style: unique and shared card back assertions passed");
