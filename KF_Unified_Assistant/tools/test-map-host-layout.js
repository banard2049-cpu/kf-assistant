"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync("public/modules/map/app.js", "utf8").replace(/\r\n/g, "\n");
const indexSource = fs.readFileSync("public/modules/map/index.html", "utf8");
const stylesSource = fs.readFileSync("public/modules/map/styles.css", "utf8").replace(/\r\n/g, "\n");
const renderStart = appSource.indexOf("  function render() {");
const renderEnd = appSource.indexOf("\n\n  function renderLegacy()", renderStart);

assert.ok(renderStart >= 0 && renderEnd > renderStart, "current map render function not found");

const renderSource = appSource.slice(renderStart, renderEnd);
const priorityPosition = renderSource.indexOf('class="sidebar-priority"');
const historyPosition = renderSource.indexOf('class="panel history-panel"');
const nextStepPosition = renderSource.indexOf('id="nextStep"');
const toolDeckPosition = renderSource.indexOf('class="tool-deck"');

assert.ok(priorityPosition >= 0, "priority resolution area must remain in the host sidebar");
assert.ok(historyPosition > priorityPosition, "recent history must follow any priority resolution");
assert.ok(nextStepPosition > historyPosition && nextStepPosition < toolDeckPosition,
  "flow control must move with recent history above the host tools");
assert.ok(toolDeckPosition > historyPosition, "host tools must render below recent history");
assert.equal((renderSource.match(/id="nextStep"/g) || []).length, 1,
  "the current host layout must render one flow control button");
assert.match(appSource, /function explorationToolsPanel\(\) \{\s+return `\$\{explorationPanel\(\)\}\$\{scoutingPanel\(\)\}`;/,
  "exploration deck and point of interest controls must render above scouting controls");
assert.match(stylesSource, /\.history-panel \{\s+position: sticky;\s+top: 0;[\s\S]*?align-self: start;/,
  "recent history and round action must stay pinned in the scrolling host sidebar");
assert.match(stylesSource, /@media \(max-width: 1179px\) \{[\s\S]*?\.history-panel \{ top: 104px; \}/,
  "the pinned controls must clear the sticky navigation in single-column layouts");
assert.match(stylesSource, /@media \(max-width: 759px\) \{[\s\S]*?\.history-panel \{ top: 52px; \}/,
  "the pinned controls must clear the compact mobile navigation");
assert.match(indexSource, /id="managePartyButton"[^>]*>骑士 \/ 侍从管理<\/button>/,
  "the delve host must expose direct knight and squire management");
const managePartyHandler = appSource.slice(appSource.indexOf('$("#managePartyButton")'), appSource.indexOf('$("#recordMapScavenge")'));
assert.match(managePartyHandler, /KF_MODULE_BRIDGE\?\.flush\?\./,
  "party navigation must flush the current map state first");
assert.match(managePartyHandler, /location\.href="\/\?module=party"/,
  "party navigation must open the integrated party manager");
assert.ok(managePartyHandler.indexOf("flush") < managePartyHandler.indexOf("location.href"),
  "map state must flush before leaving for party management");
assert.match(indexSource, /app\.js\?v=110/);
assert.match(indexSource, /styles\.css\?v=63/);

console.log("map host layout: priority, recent history, flow control and host tools order verified");
