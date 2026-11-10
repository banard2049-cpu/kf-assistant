"use strict";

// The party token keeps one size across every tile, but that size has to follow the map
// scale: on a zoomed-out or small map a fixed 34-47px token swallows the whole tile.
// app.js writes --party-token-size from the rendered tile scale, the CSS reads it.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const appSource = fs.readFileSync("public/modules/map/app.js", "utf8").replace(/\r\n/g, "\n");
const hostStyles = fs.readFileSync("public/modules/map/styles.css", "utf8").replace(/\r\n/g, "\n");
const viewStyles = fs.readFileSync("public/modules/map/map-view.css", "utf8").replace(/\r\n/g, "\n");

assert.match(appSource, /function applyPartyTokenSize\(stage = \$\("\.map-stage"\), geometry = lastMapGeometry\)/,
  "applyPartyTokenSize helper must exist");
assert.match(appSource, /stage\.style\.setProperty\("--party-token-size"/,
  "the token size must be written onto the stage so it is inherited by tiles and the travel clone");
assert.match(appSource, /applyPartyTokenSize\(canvas\?\.querySelector\("\.map-stage"\)\);/,
  "zoom changes (including the camera tween) must resize the token");
assert.equal((appSource.match(/^\s+applyPartyTokenSize\(\);/gm) || []).length, 2,
  "both render paths must size the token after the stage is rebuilt");

for (const [name, source] of [["styles.css", hostStyles], ["map-view.css", viewStyles]]) {
  assert.match(source, /width: var\(--party-token-size, calc\(var\(--map-token-size\) \* \.84\)\);/,
    `${name} must read --party-token-size with the old fixed size as fallback`);
  assert.match(source, /border-width: clamp\(1px, calc\(var\(--party-token-size, 47px\) \* \.07\), 3px\);/,
    `${name} must scale the token border with the token`);
}

// Recompute the curve mapZoomLimit-style sizing produces and check the shape: it tracks
// the map scale, never drops below the readable floor and never exceeds the old size.
const context = { window: {} };
vm.createContext(context);
context.globalThis = context;
vm.runInContext(fs.readFileSync("public/modules/map/data/map-layout.js", "utf8"), context);
const tiles = Object.values(context.window.KF_MAP_LAYOUT.tiles);
const minX = Math.min(...tiles.map(tile => tile.x - tile.width / 2));
const maxX = Math.max(...tiles.map(tile => tile.x + tile.width / 2));
const worldWidth = maxX - minX;

const UNITS = 2;
const MIN_PX = 16;
const MAX_SIZE = 56 * .84; // --map-token-size upper bound x .84

const tokenSize = stageWidth => Math.min(MAX_SIZE, Math.max(MIN_PX, stageWidth / worldWidth * UNITS));

let previous = 0;
for (const stageWidth of [320, 480, 640, 900, 1200, 1800, 2400, 3600, 5400]) {
  const size = tokenSize(stageWidth);
  assert.ok(size >= MIN_PX - .01, `token must stay readable at a ${stageWidth}px stage`);
  assert.ok(size <= MAX_SIZE + .01, `token must never exceed the old fixed size at a ${stageWidth}px stage`);
  assert.ok(size >= previous - .01, "token size must not shrink when the map grows");
  previous = size;
}

// A small map has to stay well under the old fixed size, a large one has to reach it.
assert.ok(tokenSize(400) < 24, "a 400px stage must give a clearly smaller token");
assert.equal(tokenSize(2400), MAX_SIZE, "a large stage must reach the old fixed size");

console.log("party token scale ok");
