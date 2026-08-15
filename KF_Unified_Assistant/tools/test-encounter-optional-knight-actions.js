"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync("public/modules/encounter/app.js", "utf8").replace(/\r\n/g, "\n");
const indexSource = fs.readFileSync("public/modules/encounter/index.html", "utf8");

assert.match(appSource, /<button class="primary" id="finishKnights">进入结算 →<\/button>/,
  "resolution button must remain enabled when knights have not acted");
assert.doesNotMatch(appSource, /id="finishKnights" \$\{state\.knights\.some/,
  "unfinished knight actions must not disable resolution");
assert.match(appSource, /也可保留尚未行动的骑士并直接进入结算/,
  "knight round instructions must explain that unfinished actions are optional");
assert.match(appSource, /state\.phase = "resolution", "进入遭遇战结算"/,
  "manual resolution entry must use a neutral log message");
assert.match(indexSource, /app\.js\?v=26/,
  "encounter app cache version must be refreshed");

console.log("encounter knight round: resolution remains available with unfinished actions");
