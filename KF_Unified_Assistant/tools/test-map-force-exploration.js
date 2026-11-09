"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync("public/modules/map/app.js", "utf8").replace(/\r\n/g, "\n");
const start = source.indexOf("  function drawExplorationCard(");
const end = source.indexOf("\n\n  // Drag a marker", start);
assert.ok(start >= 0 && end > start);
const context = { state: { step: 3, round: 2, mercenaries: { pendingAction: null } } };
vm.runInNewContext(`
  const exp = { deck: ["one", "two"], current: null, resolvedRound: 2, peek: true, scouting: {} };
  const current = { exploration: exp };
  const mapState = () => current;
  const scoutingState = () => exp.scouting;
  const toast = () => {};
  const snapshot = () => {};
  const clearScoutingPeek = () => {};
  const addLog = () => {};
  const save = () => {};
  ${source.slice(start, end)}
  drawExplorationCard();
  ordinaryBlocked = exp.current === null && exp.deck.length === 2;
  drawExplorationCard(true);
  forcedDraw = exp.current === "one" && exp.deck.length === 1 && exp.forcedCurrent && exp.resolvedRound === 2;
  drawExplorationCard(true);
  currentPreserved = exp.current === "one" && exp.deck.length === 1;
  exp.current = null;
  state.mercenaries.pendingAction = {};
  drawExplorationCard(true);
  pendingPreserved = exp.current === null && exp.deck.length === 1;
  state.mercenaries.pendingAction = null;
  exp.scouting.reordering = true;
  drawExplorationCard(true);
  reorderPreserved = exp.current === null && exp.deck.length === 1;
`, context);
for (const name of ["ordinaryBlocked", "forcedDraw", "currentPreserved", "pendingPreserved", "reorderPreserved"]) {
  assert.equal(context[name], true, name);
}
assert.match(source, /if \(!wasSpecial && !wasForced\) exp\.resolvedRound = state\.round/);
assert.match(source, /state\.step !== 2 && !exp\.forcedCurrent/);
assert.match(source, /const primaryActionId = active \? "resolveExploration" : forceDraw \? "forceDrawExploration" : "drawExploration"/);
assert.match(source, /const primaryActionLabel = active \? "确认效果" : forceDraw \? "强制抽牌" : "抽牌"/);
assert.doesNotMatch(source, /<button id="forceDrawExploration"/);
console.log("forced exploration draw: passed");
