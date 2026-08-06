"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const appSource = fs.readFileSync("public/app.js", "utf8").replace(/\r\n/g, "\n");
const apiSource = fs.readFileSync("public/api.php", "utf8").replace(/\r\n/g, "\n");
const indexSource = fs.readFileSync("public/index.html", "utf8");

const catalogStart = appSource.indexOf("const permanentStoryMarkerGroups=");
const catalogEnd = appSource.indexOf("\nconst sheetKnightId=", catalogStart);
assert.ok(catalogStart >= 0 && catalogEnd > catalogStart, "permanent story marker catalog not found");

const context = {};
vm.runInNewContext(`${appSource.slice(catalogStart, catalogEnd)}\nresult=permanentStoryMarkerGroups;ids=[...permanentStoryMarkerIds];`, context);
const groups = JSON.parse(JSON.stringify(context.result));
const ids = JSON.parse(JSON.stringify(context.ids));

assert.deepEqual(groups.map(group => [group.id, group.items.length]), [["fear", 8], ["sunken", 17], ["stone", 13]]);
assert.equal(ids.length, 38, "all permanent story marker IDs must be unique");
assert.equal(new Set(ids).size, 38, "permanent story marker IDs must not repeat");

const titles = groups.flatMap(group => group.items.map(item => item[2]));
for (const title of [
  "Traitor's Crossing", "Profane Terror", "Sundered Hope", "Idle Playthings in the Devil's Hands",
  "Pestilence", "Eaves-drip Kindness", "追寻乌尔班", "南瓜成灾", "啊，赐予我灵感吧", "避开泥泞之路", "反抗魔权"
]) assert.ok(titles.some(item => item.includes(title)), `missing permanent story marker: ${title}`);

const passwordStart = appSource.indexOf("const passwordSymbols=");
const passwordEnd = appSource.indexOf("\nconst sharedSettingsCacheKey=", passwordStart);
assert.ok(passwordStart >= 0 && passwordEnd > passwordStart, "password record normalizer not found");
const passwordContext = {};
vm.runInNewContext(`${appSource.slice(passwordStart, passwordEnd)}\nresult=normalizePasswordRecords([{id:"password_record_1",matrix:["filled","outline","bad"],number:"00A42"}]);`, passwordContext);
assert.deepEqual(JSON.parse(JSON.stringify(passwordContext.result)), [{
  id: "password_record_1",
  matrix: ["filled", "outline", "dot", "dot", "dot", "dot"],
  number: "0042"
}]);

assert.match(appSource, /api\("\/api\/user-settings"/);
assert.match(appSource, /data-permanent-story-marker=/);
assert.match(appSource, /const passwordSymbols=\{dot:/);
assert.match(appSource, /data-password-cell=/);
assert.match(appSource, /class="overview-notes"/);
assert.match(appSource, /s\.notes\?esc\(s\.notes\)/);
assert.match(appSource, /class="leader-name-mark"/);
assert.doesNotMatch(appSource, /♜ 当前主游戏骑士/);
assert.doesNotMatch(appSource, />当前主骑士</);
assert.match(appSource, /passwords:normalizePasswordRecords/);
assert.match(appSource, /await Promise\.all\(\[loadCampaigns\(\),loadSharedSettings\(\)\]\)/);
assert.match(apiSource, /\$route === 'user-settings' && \$method === 'GET'/);
assert.match(apiSource, /\$route === 'user-settings' && \$method === 'PATCH'/);
assert.match(apiSource, /'shared'=>public_user_settings\(load_user_settings/);
assert.match(apiSource, /function normalize_password_records/);
assert.match(apiSource, /'passwords'=>normalize_password_records/);
assert.match(apiSource, /array_merge\(normalize_password_records/);
assert.match(apiSource, /array_replace\(normalize_story_markers[\s\S]*?\$importedStoryMarkers\)/);
assert.match(indexSource, /id="permanentStoryMarkers"/);
assert.match(indexSource, /id="passwordRecords"/);
assert.match(indexSource, /id="accountPasswords"/);
assert.doesNotMatch(indexSource, /class="panel password-panel"/);
assert.ok(indexSource.indexOf('id="overviewGrid"') < indexSource.indexOf('id="encounterBuilder"'), "knight overview cards must appear before the encounter pool");
assert.match(indexSource, /0 \/ 38/);
assert.match(indexSource, /app\.js\?v=19/);
assert.match(indexSource, /styles\.css\?v=14/);

console.log("account-shared records: 38 story markers and password matrices, export and import merge verified");
