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
const sidebarScrollPosition = renderSource.indexOf('class="sidebar-scroll stack"');
const nextStepPosition = renderSource.indexOf('id="nextStep"');
const toolDeckPosition = renderSource.indexOf('class="tool-deck"');
const mapShellPosition = renderSource.indexOf('class="panel map-shell"');
const kingdomPanelPosition = renderSource.indexOf('${kingdomPanel()}');
const partyOverviewPosition = renderSource.indexOf('${partyOverviewPanel()}');

assert.ok(priorityPosition >= 0, "priority resolution area must remain in the host sidebar");
assert.ok(historyPosition >= 0 && historyPosition < sidebarScrollPosition && sidebarScrollPosition < priorityPosition,
  "recent history must render above and outside the scrolling priority area");
assert.ok(nextStepPosition > historyPosition && nextStepPosition < sidebarScrollPosition,
  "flow control must stay with recent history outside the scrolling sidebar");
assert.ok(toolDeckPosition > priorityPosition, "host tools must render below priority resolution");
assert.ok(mapShellPosition >= 0 && partyOverviewPosition > mapShellPosition && kingdomPanelPosition > partyOverviewPosition,
  "the kingdom panel module must render below the map and party overview");
assert.doesNotMatch(renderSource, /class="map-status"/,
  "the removed map status badges must not render above the map");
assert.equal((renderSource.match(/id="nextStep"/g) || []).length, 1,
  "the current host layout must render one flow control button");
assert.doesNotMatch(indexSource, /id="stepNav"/,
  "the removed round-step navigation must not leave an empty container");
assert.doesNotMatch(appSource, /\$\("#stepNav"\)/,
  "the map app must not render the removed round-step navigation");
assert.match(appSource, /let kingdomPanelDialogOpen = false;/,
  "the kingdom panel dialog must track whether the user explicitly left it open");
assert.match(appSource, /function openKingdomPanelDialog\(\)[\s\S]*?kingdomPanelDialogOpen = true;[\s\S]*?if \(dialog && !dialog\.open\) dialog\.showModal\(\);/,
  "opening the kingdom panel must persist across rerenders");
assert.match(appSource, /function closeKingdomPanelDialog\(\)[\s\S]*?kingdomPanelDialogOpen = false;/,
  "only the explicit close action must clear the open state");
assert.match(appSource, /\$\("#kingdomPanelDialog"\)\?\.addEventListener\("cancel", event => event\.preventDefault\(\)\);/,
  "Escape must not dismiss the kingdom panel");
assert.doesNotMatch(appSource, /\$\("#kingdomPanelDialog"\)\?\.addEventListener\("click"/,
  "clicking the kingdom panel backdrop must not dismiss it");
assert.match(appSource, /function explorationToolsPanel\(\) \{\s+return `\$\{explorationPanel\(\)\}\$\{scoutingPanel\(\)\}`;/,
  "exploration deck and point of interest controls must render above scouting controls");
assert.doesNotMatch(stylesSource, /\.step-nav/,
  "styles for the removed round-step navigation must be deleted");
assert.match(stylesSource, /\.map-heading \{[\s\S]*?gap: 8px;[\s\S]*?padding: 4px 8px;/,
  "the map heading must stay vertically compact");
assert.match(stylesSource, /\.map-actions button\.small \{[\s\S]*?min-height: 28px;/,
  "map view controls must use compact button heights");
assert.match(stylesSource, /\.host-sidebar \{\s+position: sticky;\s+top: 46px;[\s\S]*?max-height: calc\(100vh - 46px\);/,
  "the host sidebar must clear only the unified campaign bar");
assert.match(stylesSource, /\.delve-tracks-sticky \{[\s\S]*?top: 46px;/,
  "the sticky delve tracks must clear only the unified campaign bar");
assert.match(stylesSource, /@media \(max-width: 1179px\) \{[\s\S]*?\.host-sidebar \{ display: contents; \}[\s\S]*?\.history-panel \{ grid-row: 1; position: sticky;/,
  "recent history and round action must stick at the top of the single-column layout");
assert.match(stylesSource, /\.tool-tabs \{[\s\S]*?padding: 0;[\s\S]*?border: 0;[\s\S]*?background: transparent;/,
  "the tab strip must not add a second frame around the tab buttons");
assert.ok(Number(indexSource.match(/app\.js\?v=(\d+)/)?.[1]) >= 115);
assert.ok(Number(indexSource.match(/href="styles\.css\?v=(\d+)/)?.[1]) >= 83);

console.log("map host layout: pinned history and flow control above priority resolution and host tools verified");
