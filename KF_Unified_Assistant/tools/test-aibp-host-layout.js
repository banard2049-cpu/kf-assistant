"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const styles = fs.readFileSync("public/modules/aibp/styles.css", "utf8").replace(/\r\n/g, "\n");
const index = fs.readFileSync("public/modules/aibp/index.html", "utf8");
const app = fs.readFileSync("public/modules/aibp/app.js", "utf8");

assert.match(styles, /\.topbar \{[\s\S]*?top: 46px;[\s\S]*?gap: 12px; padding: 4px 12px;/,
  "the AI/BP header must stay compact and clear the unified campaign bar");
assert.match(styles, /\.topbar-title-group > div \{[\s\S]*?display: flex;[\s\S]*?white-space: nowrap;/,
  "the bilingual AI/BP title must remain on one compact line");
assert.match(styles, /\.directory-header-toggle \{[\s\S]*?width: 30px;[\s\S]*?height: 30px;/,
  "the directory toggle must use the compact size");
assert.match(styles, /\.topbar \.button \{[\s\S]*?min-height: 28px;/,
  "AI/BP header actions must use compact button heights");
assert.match(styles, /\.topbar \{\s+min-height: 40px;/,
  "the themed AI/BP header must not restore the former 64px height");
const stylesheetVersion = Number(index.match(/styles\.css\?v=(\d+)/)?.[1]);
assert.ok(stylesheetVersion >= 71, "the stylesheet version must invalidate caches for the action-complete highlight");
assert.match(app, /<div class="conflict-board-layout">[\s\S]*?data-kf-keywords-mount[\s\S]*?<\/div>/,
  "the keyword panel must dock beside the conflict board");
assert.match(app, /KFKeywords\?\.mount\?\.\(document\.querySelector\("\[data-kf-keywords-mount\]"\)\)/,
  "each render must move the keyword panel into the board mount point");
assert.match(styles, /\.conflict-board-layout \{ display: grid; grid-template-columns: minmax\(0, 1538px\) minmax\(480px, 1fr\);/,
  "the keyword rail must fill remaining space beside the capped board");
assert.match(styles, /\.terrain-control-workspace \{ display: grid; grid-template-columns: minmax\(0, 1250px\) 260px;/,
  "the conflict board must use the enlarged 1250px canvas");
assert.match(styles, /\.fool-card-face,\.fool-card-back \{[^}]*width: 116px;/,
  "the fool deck preview must be enlarged alongside the board");
assert.match(styles, /\.squire-clues \{ flex: 0 0 360px;/,
  "the squire sidebar must retain its width");
assert.match(styles, /\.conflict-board-keywords \{[\s\S]*?position: sticky;/,
  "the keyword rail must stay in view beside the board");

console.log("aibp host layout: compact title and action bar verified");
