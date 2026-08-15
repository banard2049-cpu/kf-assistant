"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const rules = require("../public/modules/map/mercenary-rules.js");

const read = file => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const mapIndex = read("public/modules/map/index.html");
const mapApp = read("public/modules/map/app.js");
const bridge = read("public/modules/module-bridge.js");
const rootApp = read("public/app.js");

// Public map lifecycle seam: hiring is owned by the Outpost; map state stores only
// a sparse face/discard ledger for canonical hired mercenary IDs.
assert.equal(typeof rules.projectHired, "function", "mercenary rules must project the Outpost roster into the map");
assert.equal(typeof rules.flipMercenary, "function", "mercenary rules must expose the manual flip action");
assert.equal(typeof rules.discardMercenary, "function", "mercenary rules must expose the manual discard action");

const hired = [
  { catalogId: "mercenary:26600", assignedMemberKey: "knight:kara" },
  { catalogId: "mercenary:26610", assignedMemberKey: "squire:caelia" },
];
const hiredSnapshot = structuredClone(hired);
const hiredIds = hired.map(item => item.catalogId);
const usage = rules.createState();

assert.deepEqual(usage, { usage: {}, pendingAction: null, updatedAt: 0 }, "new map state must not duplicate an active/discard roster");
assert.deepEqual(rules.projectHired(hired, usage), [
  { ...hired[0], face: "A", status: "active" },
  { ...hired[1], face: "A", status: "active" },
], "every Outpost hire must appear on the map with a default front face");

assert.equal(rules.flipMercenary(usage, "mercenary:26610", hiredIds), true);
const flippedAt = usage.updatedAt;
assert.ok(flippedAt > 0, "manual lifecycle changes must carry a conflict-merge timestamp");
assert.deepEqual(rules.projectHired(hired, usage)[1], {
  ...hired[1], face: "B", status: "active",
}, "flipping a hired mercenary must expose its back face");
assert.equal(rules.discardMercenary(usage, "mercenary:26610", hiredIds), true);
assert.ok(usage.updatedAt > flippedAt, "each later lifecycle change must advance its merge timestamp");
assert.deepEqual(rules.projectHired(hired, usage)[1], {
  ...hired[1], face: "B", status: "discarded",
}, "discarding must preserve the hired identity and its current face");
assert.deepEqual(hired, hiredSnapshot, "map flip/discard actions must never rewrite the Outpost assignment source");
assert.equal(rules.flipMercenary(usage, "mercenary:not-hired", hiredIds), false);
assert.equal(rules.discardMercenary(usage, "mercenary:not-hired", hiredIds), false);

const orphaned = rules.normalizeState({
  usage: {
    "mercenary:not-hired": { face: "B", status: "active" },
    "mercenary:26610": { face: "B", status: "discarded" },
  },
  pendingAction: null,
}, hiredIds);
assert.deepEqual(Object.keys(orphaned.usage), ["mercenary:26610"], "map state must drop usage for mercenaries not hired at the Outpost");
assert.deepEqual(rules.projectHired([], orphaned), [], "legacy/local map state alone must never create a hired mercenary");
assert.equal(Object.hasOwn(orphaned, "active"), false);
assert.equal(Object.hasOwn(orphaned, "discard"), false);

// Map UI seam: the header opens the real Outpost, while the mercenary panel is
// a roster/usage view only. It must not reintroduce a second hiring workflow.
assert.match(mapIndex, /id="openOutpostButton"[^>]*>[^<]*前哨阶段[^<]*<\/button>/,
  "the map header must provide a direct Outpost entry");
assert.match(mapApp, /#openOutpostButton[\s\S]{0,260}KF_MODULE_BRIDGE\?\.flush\?\.[\s\S]{0,180}location\.href\s*=\s*["']\/\?module=outpost["']/,
  "opening the Outpost from the map must flush map state before navigation");

const panelStart = mapApp.indexOf("  function mercenaryPanel(");
const panelEnd = mapApp.indexOf("\n\n  function ", panelStart + 10);
assert.ok(panelStart >= 0 && panelEnd > panelStart, "map mercenary panel renderer not found");
const panel = mapApp.slice(panelStart, panelEnd);
assert.match(panel, /KF_MAP_UPSTREAM[^\n]*mercenaries|mercenaries[^\n]*KF_MAP_UPSTREAM/,
  "the map mercenary panel must read the Outpost roster projected by the bridge");
assert.doesNotMatch(panel, /availableCards|data-hire-mercenary|可雇佣/,
  "the map mercenary panel must not list or hire available mercenaries");
assert.doesNotMatch(mapApp, /data-hire-mercenary/,
  "no map event path may hire a mercenary outside the Outpost");
assert.match(panel, /data-mercenary-flip=/, "each hired mercenary must expose a flip control");
assert.match(panel, /data-mercenary-discard=/, "each hired mercenary must expose a discard control");
assert.match(mapApp, /data-mercenary-flip[\s\S]{0,900}flipMercenary/,
  "the map flip control must use the mercenary lifecycle seam");
assert.match(mapApp, /data-mercenary-discard[\s\S]{0,900}discardMercenary/,
  "the map discard control must use the mercenary lifecycle seam");
assert.match(mapApp, /let partialMercenaries\s*=\s*null[\s\S]{0,420}saved\?\.version\s*==\s*null[\s\S]{0,220}partialMercenaries\s*=\s*saved\.mercenaries[\s\S]{0,100}continue/,
  "a lifecycle-only server slice must be retained while the map looks for a complete legacy save");
assert.match(mapApp, /partialMercenaries[\s\S]{0,180}normalizeState\(partialMercenaries,\s*hiredMercenaryIds\(\)\)[\s\S]{0,120}return saved/,
  "a character-page lifecycle change must be merged into a migrated legacy map");

// Bridge seam: only the normalized Outpost assignments are exposed to the map.
const exposeStart = bridge.indexOf("  function exposeMapUpstream(");
const exposeEnd = bridge.indexOf("\n\n  function ", exposeStart + 10);
assert.ok(exposeStart >= 0 && exposeEnd > exposeStart, "map upstream bridge function not found");
const exposeMapUpstream = bridge.slice(exposeStart, exposeEnd);
assert.match(exposeMapUpstream, /partyManager[^\n]*outpost[^\n]*mercenaries|mercenaries[^\n]*partyManager[^\n]*outpost/,
  "the bridge must project hired mercenaries from partyManager.outpost");
assert.match(exposeMapUpstream, /mercenaries\s*[:,]/,
  "the bridge payload must expose the hired mercenary roster to the map");

// Character workspace seam: Knights and Squires render the same shared hired
// roster, derived once from manager.outpost rather than copied onto each member.
const hiredRendererStart = rootApp.indexOf("function renderHiredMercenaries(");
const hiredRendererEnd = rootApp.indexOf("\nfunction ", hiredRendererStart + 10);
assert.ok(hiredRendererStart >= 0 && hiredRendererEnd > hiredRendererStart, "shared hired mercenary renderer not found");
const hiredRenderer = rootApp.slice(hiredRendererStart, hiredRendererEnd);
assert.match(hiredRenderer, /manager/);
assert.match(hiredRenderer, /outpost|(?:getOutpostView)/,
  "the shared character roster must derive from the Outpost aggregate");
assert.match(hiredRenderer, /mercenaries/);
assert.match(hiredRenderer, /runtimeAtlasArt/,
  "character pages must show each hired mercenary's card art");
assert.match(hiredRenderer, /normalizeState\(campaignState\.modules\?\.map\?\.mercenaries,\s*assignments\.map/,
  "character pages must normalize legacy map lifecycle data before showing a face or action label");
assert.match(hiredRenderer, /data-hired-mercenary-flip=/,
  "character pages must expose the shared mercenary flip action");
assert.match(hiredRenderer, /data-hired-mercenary-discard=/,
  "character pages must expose the shared mercenary discard action");
assert.match(rootApp, /const mercenaryFlip=[^\n]*data-hired-mercenary-flip[\s\S]{0,1100}flipMercenary/,
  "character-page flips must update the shared map lifecycle ledger");
assert.match(rootApp, /const mercenaryFlip=[^\n]*data-hired-mercenary-discard[\s\S]{0,1100}discardMercenary/,
  "character-page discards must update the shared map lifecycle ledger");
assert.match(rootApp, /campaignOp\("modules\.map",\s*\{[\s\S]{0,180}mercenaries:next/,
  "character pages and the map bridge must write the same conflict-detection path");
assert.doesNotMatch(rootApp, /campaignOp\("modules\.map\.mercenaries"/,
  "a child-path write can be silently overwritten by the map bridge's parent-path save");
assert.match(rootApp, /module-nav[\s\S]{0,420}flushCampaignOperations\(\)[\s\S]{0,160}location\.href/,
  "leaving the character or Outpost page for a submodule must flush shared lifecycle changes first");
assert.match(rootApp, /next\.pendingAction[\s\S]{0,500}请先完成盗贼探索牌选择/,
  "character pages must not flip through an unresolved Rogue card choice");
assert.match(rootApp, /function saveOutpostManager[\s\S]{0,700}mercenaryRuntime\.normalizeState\(current,hiredIds\)[\s\S]{0,240}saveSharedMercenaryState\(pruned\)/,
  "removing an Outpost hire must prune its stale face/discard lifecycle");

const squireStart = rootApp.indexOf("function renderSquireBoard(");
const squireEnd = rootApp.indexOf("\nfunction renderKnightBoard", squireStart);
const knightStart = squireEnd;
const knightEnd = rootApp.indexOf("\nfunction ", knightStart + 10);
assert.ok(squireStart >= 0 && squireEnd > squireStart && knightEnd > knightStart, "character board renderers not found");
assert.match(rootApp.slice(squireStart, squireEnd), /renderHiredMercenaries\(manager\)/,
  "Squire pages must show the shared hired mercenary roster");
assert.match(rootApp.slice(knightStart, knightEnd), /renderHiredMercenaries\(manager\)/,
  "Knight pages must show the shared hired mercenary roster");

console.log("shared mercenary flow: Outpost authority, map lifecycle, navigation and character visibility verified");
