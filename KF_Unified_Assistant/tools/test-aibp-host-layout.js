"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const styles = fs.readFileSync("public/modules/aibp/styles.css", "utf8").replace(/\r\n/g, "\n");
const index = fs.readFileSync("public/modules/aibp/index.html", "utf8");

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
assert.match(index, /styles\.css\?v=61/);

console.log("aibp host layout: compact title and action bar verified");
