"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const styles = fs.readFileSync("public/styles.css", "utf8");

assert.match(styles, /\.party-member-tab\{[^}]*color:var\(--ink\)/,
  "浅色成员标签必须显式使用深色文字，不能继承 game-module 的浅色前景色");
assert.match(styles, /\.character-manager\{[^}]*--runtime-muted:#5b5149/,
  "成员管理页的小字必须使用高对比度次要文字色");
assert.match(styles, /\.runtime-equipment\.stowed\{[^}]*color:#[0-9a-f]{6}/i,
  "收起装备应保留明确的深色文字");
assert.doesNotMatch(styles, /\.runtime-equipment\.stowed\{[^}]*opacity:/,
  "收起装备不能通过整体透明度降低文字对比度");

console.log("character manager contrast: light surfaces keep explicit dark text");
