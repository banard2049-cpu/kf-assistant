"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const appSource = fs.readFileSync("public/modules/map/app.js", "utf8").replace(/\r\n/g, "\n");
const styleSource = fs.readFileSync("public/modules/map/styles.css", "utf8");
const indexSource = fs.readFileSync("public/modules/map/index.html", "utf8");
const dataContext = { window: {} };
vm.runInNewContext(fs.readFileSync("public/modules/map/data/map-data.js", "utf8"), dataContext);
const markerAssets = dataContext.window.KF_MOD_DATA.tokens.markers;
const textFunctionStart = appSource.indexOf("  function customMarkerText(");
const textFunctionEnd = appSource.indexOf("\n\n  function tileMarkerLabel(", textFunctionStart);

assert.ok(textFunctionStart >= 0 && textFunctionEnd > textFunctionStart, "customMarkerText function not found");

const context = {};
vm.runInNewContext(`
  const CUSTOM_MARKER_MAX_LENGTH = 12;
  ${appSource.slice(textFunctionStart, textFunctionEnd)}
  result = {
    trimmed: customMarkerText("  宝箱  "),
    limited: customMarkerText("一二三四五六七八九十十一十二十三")
  };
`, context);

assert.equal(context.result.trimmed, "宝箱", "custom marker text must be trimmed");
assert.equal([...context.result.limited].length, 12, "custom marker text must respect the UI limit");
assert.match(appSource, /id="customMarkerText"[^>]*maxlength="\$\{CUSTOM_MARKER_MAX_LENGTH\}"/);
assert.match(appSource, /id="addCustomTileMarker"/);
assert.match(appSource, /type: "custom", text/);
assert.match(appSource, /class="map-token custom-map-token"/);
assert.match(appSource, /data-remove-tile-marker/);
assert.match(styleSource, /\.map-tile \.custom-map-token \{/);
assert.match(styleSource, /overflow-wrap: anywhere;/);
const mapTokenRule = styleSource.match(/\.map-tile \.map-token \{([\s\S]*?)\n\}/)?.[1] || "";
assert.match(mapTokenRule, /border-radius: 0;/, "map tokens must retain their source silhouette");
assert.match(mapTokenRule, /object-fit: contain;/, "map tokens must retain their source proportions");
assert.match(mapTokenRule, /overflow: visible;/, "map token edges must not be clipped");
const tokenIconRule = styleSource.match(/\.token-icon \{([\s\S]*?)\n\}/)?.[1] || "";
assert.match(tokenIconRule, /border-radius: 0;/, "marker previews must retain their source silhouette");
assert.match(tokenIconRule, /background: transparent;/, "marker previews must not add a background");
const kingdomMarkerRule = styleSource.match(/\.kingdom-board-marker-image \{([\s\S]*?)\n\}/)?.[1] || "";
assert.match(kingdomMarkerRule, /border-radius: 0;/, "kingdom markers must retain their source silhouette");
assert.doesNotMatch(appSource, /token-palette/, "the all-marker preview must not be rendered");
assert.doesNotMatch(styleSource, /token-palette/, "the removed all-marker preview must not keep dead styles");
assert.doesNotMatch(appSource, /tokenShapeClass|token-flood/, "marker silhouettes must come from image alpha");
assert.doesNotMatch(styleSource, /token-flood/, "marker silhouettes must not be approximated with CSS clipping");
assert.match(appSource, /type === "fog"\) return "\/assets\/tokens\/fog\.png";/, "fog must use its transparent PNG");

for (const marker of ["surge", "flood", "generic", "quest"]) {
  assert.match(markerAssets[marker], /assets\/tokens\/[a-z-]+\.png$/, `${marker} must use a PNG asset`);
  const png = fs.readFileSync(`public/${markerAssets[marker].replace(/^\//, "")}`);
  assert.equal(png.subarray(1, 4).toString("ascii"), "PNG", `${marker} must reference a valid PNG file`);
  assert.equal(png[25], 6, `${marker} PNG must include an alpha channel`);
}
const fogPng = fs.readFileSync("public/assets/tokens/fog.png");
assert.equal(fogPng.subarray(1, 4).toString("ascii"), "PNG", "fog must reference a valid PNG file");
assert.equal(fogPng[25], 6, "fog PNG must include an alpha channel");

assert.match(indexSource, /styles\.css\?v=68/);
assert.match(indexSource, /data\/map-data\.js\?v=6/);
assert.match(indexSource, /app\.js\?v=108/);

console.log("map custom markers: input, text rendering, persistence shape and styling verified");
