"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const source = fs.readFileSync("public/modules/map/app.js", "utf8").replace(/\r\n/g, "\n");
const start = source.indexOf("  function drawExplorationCard("), end = source.indexOf("\n\n  // Drag a marker", start);
assert.ok(start >= 0 && end > start);
vm.runInNewContext(`
 const state = { step: 2, round: 1, knights: [{ knightId: "ser-sonch" }], mercenaries: { pendingAction: null } };
 const exp = { deck: ["a", "b", "c"], discard: [], littleSer: true, current: null, scouting: {} };
 const current = { exploration: exp }, mapState = () => current, scoutingState = () => exp.scouting;
 const toast = () => {}, snapshot = () => {}, clearScoutingPeek = () => {}, addLog = () => {}, save = () => {}, card = id => ({ name: id });
 ${source.slice(start, end)}
 drawExplorationCard(); assert.equal(exp.littleSerChoice.drawn.join(), "a,b"); assert.equal(exp.deck.join(), "a,b,c");
 drawExplorationCard(); assert.equal(exp.deck.join(), "a,b,c"); chooseLittleSerCard(1);
 assert.equal(exp.current, "b"); assert.equal(exp.deck.join(), "c,a"); assert.equal(exp.discard.length, 0);
 exp.current = null; exp.deck = ["x"]; drawExplorationCard(); assert.equal(exp.current, null); assert.equal(exp.deck.join(), "x");
 exp.deck = ["x", "y"]; drawExplorationCard(true); chooseLittleSerCard(0);
 assert.equal(exp.current, "x"); assert.equal(exp.deck.join(), "y"); assert.equal(exp.forcedCurrent, true);
 exp.current = null; exp.deck = ["x", "y"]; state.knights = []; drawExplorationCard();
 assert.equal(exp.current, "x"); assert.equal(exp.deck.join(), "y");
`, { assert });
console.log("Little Ser exploration choice passed");
