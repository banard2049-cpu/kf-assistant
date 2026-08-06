"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const appSource = fs.readFileSync("public/modules/map/app.js", "utf8").replace(/\r\n/g, "\n");
const functionStart = appSource.indexOf("  function moveHunt(");
const functionEnd = appSource.indexOf("\n\n  function spawnThreatSeven(", functionStart);
assert.ok(functionStart >= 0 && functionEnd > functionStart, "moveHunt function not found");

const context = {};
vm.runInNewContext(`
  let current;
  let route;
  let adjacent;
  let encounterIds = [];
  let logs = [];
  const mapState = () => current;
  const adjacentFaceUpTileIds = () => adjacent;
  const shortestPath = () => route;
  const shuffle = values => [...values].reverse();
  const addLog = message => logs.push(message);
  const tile = id => ({ id, number: id });
  const tileLabel = item => item.id;
  const triggerPendingEncounter = id => encounterIds.push(id);
  ${appSource.slice(functionStart, functionEnd)}

  current = { current: "player", monsters: [{ id: "route-monster", tileId: "start" }] };
  adjacent = ["near-a", "near-b"];
  route = ["start", "middle", "player"];
  moveHunt(1);
  routedTile = current.monsters[0].tileId;

  current = { current: "player", monsters: [{ id: "fallback-monster", tileId: "isolated" }] };
  adjacent = ["near-a", "near-b"];
  route = [];
  moveHunt(2);
  fallbackTile = current.monsters[0].tileId;

  current = { current: "player", monsters: [{ id: "already-near", tileId: "near-a" }] };
  adjacent = ["near-a", "near-b"];
  route = [];
  moveHunt(1);
  alreadyAdjacentTile = current.monsters[0].tileId;
`, context);

assert.equal(context.routedTile, "middle", "a monster with a face-up route must move one step along it");
assert.equal(context.fallbackTile, "near-b", "a monster without a face-up route must move to a random player-adjacent tile");
assert.equal(context.alreadyAdjacentTile, "near-a", "a monster already adjacent to the player must remain there when no route exists");
assert.match(appSource, /shortestPath\(monster\.tileId, current\.current, \{ faceUpOnly: true, ignoreBlocking: true \}\)/,
  "monster routing must exclude face-down tiles");
assert.match(appSource, /const fallbackTileId = shuffle\(\[\.\.\.playerAdjacentTiles\]\)\[0\]/,
  "unroutable monsters must choose a random adjacent fallback");
assert.match(appSource, /怪物只能生成在正面朝上的王国板块/,
  "manual monster generation must reject face-down tiles");
assert.match(appSource, /怪物只能移动到正面朝上的王国板块/,
  "manual monster movement must reject face-down tiles");

console.log("map monster movement: face-up routing and random adjacent fallback verified");
