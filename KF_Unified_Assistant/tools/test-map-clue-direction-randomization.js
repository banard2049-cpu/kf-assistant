"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const appSource = fs.readFileSync("public/modules/map/app.js", "utf8").replace(/\r\n/g, "\n");
const indexSource = fs.readFileSync("public/modules/map/index.html", "utf8");

const weightsStart = appSource.indexOf("  const EXTRA_CLUE_DIRECTION_WEIGHTS =");
const weightsEnd = appSource.indexOf("\n  ]);", weightsStart) + "\n  ]);".length;
const randomStart = appSource.indexOf("  function randomExtraClueDirection(");
const randomEnd = appSource.indexOf("\n\n  function clueName(", randomStart);
const collectStart = appSource.indexOf("  function collectTileClues(");
const collectEnd = appSource.indexOf("\n\n  function resolvePendingClueDirections(", collectStart);

assert.ok(weightsStart >= 0 && weightsEnd > weightsStart, "extra clue direction weights not found");
assert.ok(randomStart >= 0 && randomEnd > randomStart, "weighted direction helper not found");
assert.ok(collectStart >= 0 && collectEnd > collectStart, "tile clue collector not found");

const sandboxMath = Object.create(Math);
const context = { Math: sandboxMath };
vm.runInNewContext(`
  ${appSource.slice(weightsStart, weightsEnd)}
  ${appSource.slice(randomStart, randomEnd)}

  boundaries = [
    randomExtraClueDirection(0),
    randomExtraClueDirection(1 / 4 - Number.EPSILON),
    randomExtraClueDirection(1 / 4),
    randomExtraClueDirection(2 / 4),
    randomExtraClueDirection(3 / 4),
    randomExtraClueDirection(1)
  ];

  let awards = [];
  let logs = [];
  let rolls = [0.1, 0.3];
  let topCard = {
    id: "top-card",
    cluesByDirection: {
      north: "martial",
      south: "errant",
      west: "historic",
      east: "mystic"
    }
  };
  Math.random = () => rolls.shift();
  const mapState = () => ({ exploration: { deck: ["top-card"] } });
  const travelDirectionKey = () => "east";
  const card = () => topCard;
  const awardClueType = (clueType, details) => awards.push({ clueType, ...details });
  const addLog = message => logs.push(message);
  const directionName = direction => direction;
  ${appSource.slice(collectStart, collectEnd)}

  multipleResult = collectTileClues(3, "板块背面");
  multipleAwards = awards;
  multipleLogs = logs;

  awards = [];
  logs = [];
  rolls = [];
  singleResult = collectTileClues(1, "板块正面");
  singleAwards = awards;

  awards = [];
  topCard = { id: "incomplete", cluesByDirection: { east: "mystic" } };
  incompleteResult = collectTileClues(2, "板块背面");
  incompleteAwards = awards;
`, context);

assert.deepEqual(Array.from(context.boundaries), ["north", "north", "south", "west", "east", "east"]);
assert.deepEqual(JSON.parse(JSON.stringify(context.multipleResult)), {
  blocked: false,
  pending: 0,
  directions: ["east", "north", "south"]
});
assert.deepEqual(JSON.parse(JSON.stringify(context.multipleAwards)).map(item => [item.ordinal, item.direction, item.clueType]), [
  [1, "east", "mystic"],
  [2, "north", "martial"],
  [3, "south", "errant"]
]);
assert.match(context.multipleLogs.at(-1), /1／1／1／1/);
assert.deepEqual(JSON.parse(JSON.stringify(context.singleResult)), {
  blocked: false,
  pending: 0,
  directions: ["east"]
});
assert.equal(context.singleAwards.length, 1, "one clue still uses only the travel direction");
assert.equal(context.incompleteResult.blocked, true);
assert.equal(context.incompleteAwards.length, 0, "invalid directional data must not partially award clues");
assert.doesNotMatch(appSource, /data-resolve-extra-clue/);
assert.match(indexSource, /data-original-app="app\.js\?v=110"/);

console.log("map clue directions: equal-probability extra clues resolve automatically");
