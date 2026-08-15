"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync("public/modules/map/app.js", "utf8").replace(/\r\n/g, "\n");
const stylesSource = fs.readFileSync("public/modules/map/styles.css", "utf8").replace(/\r\n/g, "\n");
const imageStart = appSource.indexOf("  function mercenaryCardImage(");
const imageEnd = appSource.indexOf("\n\n  function mercenaryExplorationChoice(", imageStart);

assert.ok(imageStart >= 0 && imageEnd > imageStart, "mercenary card image renderer not found");

const imageRenderer = appSource.slice(imageStart, imageEnd);
assert.match(imageRenderer, /data-mercenary-card-preview/,
  "every mercenary card image must opt in to the enlarged preview");
assert.match(imageRenderer, /tabindex="0"/,
  "mercenary cards must expose the same preview to keyboard focus");
assert.match(stylesSource, /\.mercenary-card-image\[data-mercenary-card-preview\]\s*\{[^}]*cursor:\s*zoom-in/s,
  "mercenary card art must advertise that it can be enlarged");
assert.match(stylesSource, /\.mercenary-card-image\[data-mercenary-card-preview\]:hover\s*\{/,
  "hovering mercenary card art must activate preview feedback");
assert.match(stylesSource, /\.mercenary-card-image\[data-mercenary-card-preview\]:focus-visible\s*\{/,
  "keyboard focus must activate preview feedback");
assert.match(stylesSource, /\.mercenary-card-preview\s*\{[^}]*position:\s*fixed[^}]*pointer-events:\s*none/s,
  "the enlarged preview must float outside layout and never intercept selection controls");
assert.match(appSource, /addEventListener\("pointerover"[\s\S]{0,700}data-mercenary-card-preview/,
  "the map host must open the enlarged card from cursor hover");
assert.match(appSource, /addEventListener\("focusin"[\s\S]{0,500}data-mercenary-card-preview/,
  "the map host must open the enlarged card from keyboard focus");

assert.doesNotMatch(appSource, /data-hire-mercenary=/,
  "the map must not expose a second hiring workflow outside the Outpost");
assert.match(appSource, /data-mercenary-flip=/,
  "hired mercenary cards must retain their manual flip action");
assert.match(appSource, /data-mercenary-discard=/,
  "hired mercenary cards must retain their discard action");
assert.match(appSource, /data-mercenary-target=/,
  "active mage cards must retain their destination selector");
assert.match(appSource, /data-mercenary-move=/,
  "active mage cards must retain their movement action");

console.log("map mercenary card preview: hover, focus and selection interaction assertions passed");
