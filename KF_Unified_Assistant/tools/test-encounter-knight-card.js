"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync("public/modules/encounter/app.js", "utf8").replace(/\r\n/g, "\n");
const indexSource = fs.readFileSync("public/modules/encounter/index.html", "utf8");
const start = appSource.indexOf("  function knightPanel() {");
const end = appSource.indexOf("\n  function resolutionPanel()", start);
assert.ok(start >= 0 && end > start, "knightPanel function not found");

const knightPanelSource = appSource.slice(start, end);
assert.match(knightPanelSource, /\$\{crop\(currentLevel\(\), currentLevel\(\)\.side\)\}/,
  "knight round must render the current monster card and side");
assert.match(knightPanelSource, /badge gold[^`]*\$\{currentMonster\(\)\.name\}/,
  "knight round identifies the monster shown on the card");
assert.match(indexSource, /app\.js\?v=24/, "encounter app cache version is updated");

console.log("encounter knight round: current monster card is visible");
