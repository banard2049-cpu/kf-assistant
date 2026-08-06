"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const appSource = fs.readFileSync("public/modules/map/app.js", "utf8").replace(/\r\n/g, "\n");
const styleSource = fs.readFileSync("public/modules/map/styles.css", "utf8");
const indexSource = fs.readFileSync("public/modules/map/index.html", "utf8");
const helperStart = appSource.indexOf("  const EFFECT_MARKER_SLOTS = [");
const helperEnd = appSource.indexOf("  const KINGDOM_MARKER_STARTS = [", helperStart);

assert.ok(helperStart >= 0 && helperEnd > helperStart, "effect marker position helper not found");

const context = {};
vm.runInNewContext(`
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  ${appSource.slice(helperStart, helperEnd)}
  result = {
    fallback: effectMarkerPosition({}, 0),
    saved: effectMarkerPosition({ x: 37.5, y: 62.5 }, 4),
    clamped: effectMarkerPosition({ x: 140, y: -20 }, 2)
  };
`, context);

assert.equal(JSON.stringify(context.result.fallback), JSON.stringify({ x: 82, y: 18 }));
assert.equal(JSON.stringify(context.result.saved), JSON.stringify({ x: 37.5, y: 62.5 }));
assert.equal(JSON.stringify(context.result.clamped), JSON.stringify({ x: 100, y: 0 }));

assert.match(appSource, /\.map\(\(marker, index\) => \(\{ \.\.\.marker, \.\.\.effectMarkerPosition\(marker, index\) \}\)\)/,
  "saved effect markers must migrate to explicit coordinates");
assert.match(appSource, /data-effect-marker="\$\{esc\(marker\.id\)\}"/, "rendered effect markers need stable drag ids");
assert.match(appSource, /data-marker-x="\$\{x\}" data-marker-y="\$\{y\}"/, "rendered effect markers need coordinates");
assert.match(appSource, /id === "generic" \? "selected" : ""/, "generic must be the default effect marker");
assert.match(appSource, /markers\.push\(\{ id: uid\(\), type, \.\.\.position \}\)/, "new markers must persist their starting position");
assert.match(appSource, /\$\$\("\.effect-card-stage"\)\.forEach\(stage => \{/,
  "every active and district card stage must bind marker dragging");
assert.match(appSource, /stage\.addEventListener\("pointermove"/, "effect marker dragging must track pointer movement");
assert.match(appSource, /record\.x = Number\(effectMarkerDrag\.x\.toFixed\(2\)\)/, "dragged x coordinate must persist");
assert.match(appSource, /record\.y = Number\(effectMarkerDrag\.y\.toFixed\(2\)\)/, "dragged y coordinate must persist");
assert.match(appSource, /button\.dataset\.effectMarkerMoved === "true"/, "a completed drag must not trigger click-to-remove");
assert.match(appSource, /placedEffectCard\(item, "active"\)/, "active effect cards must use the draggable card renderer");
assert.match(appSource, /placedEffectCard\(item, `district:\$\{district\.id\}`\)/,
  "district effect cards must use the draggable card renderer");

assert.match(styleSource, /button\.effect-card-marker \{[\s\S]*cursor: grab;/);
assert.match(styleSource, /button\.effect-card-marker \{[\s\S]*touch-action: none;/);
assert.match(styleSource, /button\.effect-card-marker\.dragging \{/);
assert.match(styleSource, /button\.effect-card-marker \{[\s\S]*border-radius: 0;/,
  "effect marker assets must not be forced into circles");
assert.match(indexSource, /styles\.css\?v=59/);
assert.match(indexSource, /app\.js\?v=99/);

console.log("map effect markers: defaults, migration, dragging, persistence and styling verified");
