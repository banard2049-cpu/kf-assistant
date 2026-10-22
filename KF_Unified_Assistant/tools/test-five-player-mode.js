"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

// Five-player optional rule (rulebook p.77): party of five, leader target clue, modules follow.
const read = file => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const mainApp = read("public/app.js");
const mainIndex = read("public/index.html");
const bridge = read("public/modules/module-bridge.js");
const mapApp = read("public/modules/map/app.js");
const mapView = read("public/modules/map/map-view.js");
const encounterApp = read("public/modules/encounter/app.js");
const api = read("public/api.php");

// Main page: the optional rule and the party limit.
assert.match(mainIndex, /<input id="fivePlayerRule" type="checkbox"> 启用五人模式可选规则（规则书 P77）/);
assert.match(mainApp, /const partyLimit=\(\)=>gameSettings\.fivePlayer\?5:4;/);
assert.match(mainApp, /return party\.slice\(0,partyLimit\(\)\);/);
assert.match(mainApp, /const needed=Math\.max\(0,partyLimit\(\)-party\.length\)/, "squires fill the party up to five");
assert.match(mainApp, /campaignOp\("optionalRules\.fivePlayer",gameSettings\.fivePlayer\)/);
const helpersStart = mainApp.indexOf("function normalizedParty(");
const helpersEnd = mainApp.indexOf("\nfunction commitParty(", helpersStart);
const context = {};
vm.runInNewContext(`
  const squireCatalog = [{ id: "bartos" }, { id: "caelia" }, { id: "helse" }];
  const knightSheets = () => ["k1", "k2", "k3", "k4", "k5", "k6"].map(id => ({ id }));
  let gameSettings = { leaderSheetId: "k1", fivePlayer: false };
  const partyLimit = () => gameSettings.fivePlayer ? 5 : 4;
  let campaignState = { party: [], squires: [] };
  ${mainApp.slice(helpersStart, helpersEnd)}
  const four = normalizedParty(["k2", "k3", "k4", "k5", "k6"]);
  const fourSquires = normalizedSquires(["k1", "k2"]);
  gameSettings.fivePlayer = true;
  const five = normalizedParty(["k2", "k3", "k4", "k5", "k6"]);
  const fiveSquires = normalizedSquires(["k1", "k2"]);
  result = { four, fourSquires, five, fiveSquires };
`, context);
const party = JSON.parse(JSON.stringify(context.result));
assert.deepEqual(party.four, ["k1", "k2", "k3", "k4"], "four seats without the rule, leader first");
assert.deepEqual(party.five, ["k1", "k2", "k3", "k4", "k5"], "five seats with the rule");
assert.equal(party.fourSquires.length, 2);
assert.equal(party.fiveSquires.length, 3, "two knights are topped up by three squires in five-player mode");

// Bridge: party limit, squire fill and the options handed to every module.
assert.match(bridge, /const partyLimit = fivePlayer \? 5 : 4;/);
assert.match(bridge, /party = \[\.\.\.new Set\(party\)\]\.slice\(0, partyLimit\);/);
assert.match(bridge, /Math\.max\(0, partyLimit - partyKnights\.length\)/);
assert.match(bridge, /fivePlayer: fivePlayer && window\.KF_CAMPAIGN_PARTY\.length >= 5,/,
  "five-player rules apply only with a fifth member (a rogue roster never has one)");
assert.match(bridge, /localStorage\.setItem\(optionsKey, JSON\.stringify\(window\.KF_CAMPAIGN_OPTIONS\)\)/);
assert.match(encounterApp, /const roster = campaignParty\(\)\.slice\(0, partyLimit\(\)\);/);
assert.match(mapApp, /const roster = campaignParty\(\)\.slice\(0, partyLimit\(\)\);/);
assert.match(mapView, /\.slice\(0, 5\);/, "the second screen lists up to five clue trackers");
assert.match(api, /'conflictBoard','accursed'\];/, "the second screen receives the Accursed Persistence side");

// Map: with five members and nobody on a quest the leader takes a random target clue.
const leaderStart = mapApp.indexOf("  function fivePlayerClueLeader(");
const leaderEnd = mapApp.indexOf("\n\n  function ", mapApp.indexOf("  function assignClueRequirements(", leaderStart) + 10);
assert.ok(leaderStart >= 0 && leaderEnd > leaderStart, "five-player clue helpers not found");
const clueContext = {};
vm.runInNewContext(`
  const CLUES = [["martial"], ["errant"], ["historic"], ["mystic"]];
  const shuffle = values => [...values].reverse();
  const window = { KF_CAMPAIGN_OPTIONS: { fivePlayer: true, leaderSheetId: "s2" } };
  const fivePlayerMode = () => window.KF_CAMPAIGN_OPTIONS.fivePlayer === true;
  const state = { mainKnightId: "" };
  const knight = (id, memberType = "knight") => ({ id, sheetId: id, memberType, name: id, primary: "", secondary: "", clues: { martial: 0, errant: 0, historic: 0, mystic: 0 } });
  const clueAssignmentKnights = () => [];
  ${mapApp.slice(leaderStart, leaderEnd)}
  const five = ["s1", "s2", "s3", "s4"].map(id => knight(id)).concat(knight("sq", "squire"));
  const fiveResult = assignClueRequirements(five);
  const four = ["s1", "s2", "s3", "s4"].map(id => knight(id));
  const fourResult = assignClueRequirements(four);
  state.mainKnightId = "s1";
  const questLeader = fivePlayerClueLeader(["s2", "s3", "s4", "s5", "sq"].map(id => knight(id)));
  state.mainKnightId = "";
  window.KF_CAMPAIGN_OPTIONS.fivePlayer = false;
  const offResult = assignClueRequirements(["s1", "s2", "s3", "s4", "s5"].map(id => knight(id)));
  result = { five, fiveLeader: fiveResult.leader?.id, four, fourLeader: fourResult.leader, questLeader, offResult };
`, clueContext);
const clues = JSON.parse(JSON.stringify(clueContext.result));
const leader = clues.five.find(item => item.id === clues.fiveLeader);
assert.equal(clues.fiveLeader, "s2", "the campaign leader takes the five-player target clue");
assert.equal(leader.fivePlayerTarget, true);
assert.equal(leader.secondary, "", "the leader collects a single target clue");
assert.equal(leader.clues[leader.primary], 0, "the target clue is recorded without handing out a token");
const drawing = clues.five.filter(item => item.id !== "s2");
assert.equal(new Set(drawing.map(item => item.primary)).size, 4, "the other four draw distinct primary clues");
assert.ok(drawing.every(item => item.secondary && item.secondary !== item.primary && !item.fivePlayerTarget));
assert.equal(clues.fourLeader, null, "four members never trigger the leader rule");
assert.equal(clues.questLeader, null, "someone on the main quest means the normal clue rules apply");
assert.equal(clues.offResult.ok, false, "five members without the rule still cannot share four clue colours");
assert.match(mapApp, /队长目标\$\{esc\(clueName\(knight\.primary\)\)\} \$\{Math\.max\(0, Number\(knight\.clues\[knight\.primary\]\) \|\| 0\)\}\/5/,
  "the clue panel shows the leader's progress towards five");

console.log("five-player mode: party of five, squire fill, leader target clue and module options verified");
