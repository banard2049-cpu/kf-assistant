"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const appSource = fs.readFileSync("public/app.js", "utf8").replace(/\r\n/g, "\n");
const styleSource = fs.readFileSync("public/styles.css", "utf8");
const apiSource = fs.readFileSync("public/api.php", "utf8");
const indexSource = fs.readFileSync("public/index.html", "utf8");

const helperStart = appSource.indexOf("const investigationSuccessValue=");
const helperEnd = appSource.indexOf("\nfunction rapportHearts(", helperStart);
const taleStart = appSource.indexOf("const investigationHasNumber=");
const taleEnd = appSource.indexOf("\nfunction renderEncounterBuilder(", taleStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, "investigation number normalizer not found");
assert.ok(taleStart >= 0 && taleEnd > taleStart, "tale position helper not found");

const context = {};
vm.runInNewContext(`
  ${appSource.slice(helperStart, helperEnd)}
  normalized = [false, true, null, "", -3, 3.9, 150, "7", "invalid"].map(investigationSuccessValue);

  ${appSource.slice(taleStart, taleEnd)}
  const story = Array.from({ length: 5 }, () => ({
    quest: false,
    investigations: Array.from({ length: 3 }, () => ({ attempted: false, success: "" }))
  }));
  emptyPosition = talePosition({ state: { story } });
  story[0].investigations[1].success = 0;
  zeroPosition = talePosition({ state: { story } });
  story[1].investigations[2].attempted = true;
  attemptedOnlyPosition = talePosition({ state: { story } });
  story[1].investigations[0].success = 17;
  numericPosition = talePosition({ state: { story } });
`, context);

assert.deepEqual(Array.from(context.normalized), ["", 1, "", "", 0, 3, 99, 7, ""]);
assert.deepEqual(JSON.parse(JSON.stringify(context.emptyPosition)), { row: 0, chapter: 1, label: "任务", empty: true });
assert.deepEqual(JSON.parse(JSON.stringify(context.zeroPosition)), { row: 2, chapter: 1, label: "调查 2", empty: false });
assert.deepEqual(JSON.parse(JSON.stringify(context.attemptedOnlyPosition)), { row: 2, chapter: 1, label: "调查 2", empty: false });
assert.deepEqual(JSON.parse(JSON.stringify(context.numericPosition)), { row: 5, chapter: 2, label: "调查 1", empty: false });
assert.match(appSource, /investigationHasNumber\(v\.success\)/);
assert.doesNotMatch(appSource, /if\(v\.attempted\)/);
assert.match(appSource, /class="investigation-number"[^>]+data-investigation-success[^>]+type="number"[^>]+min="0"[^>]+max="99"/);
assert.doesNotMatch(appSource, /check\(`story\.\$\{ci\}\.investigations\.\$\{ii\}\.success`/);
assert.match(appSource, /hasAttribute\("data-investigation-success"\)\?investigationSuccessValue\(v\)/);
assert.match(appSource, /hasAttribute\("data-investigation-success"\)&&el\.value===""\?""/);
assert.match(styleSource, /\.investigation\{grid-template-columns:minmax\(0,1fr\) 42px 28px/);
assert.match(styleSource, /\.paper input\.investigation-number\{[^}]*text-align:center/);
assert.match(styleSource, /\.investigation\{grid-template-columns:minmax\(0,1fr\) 8mm 5mm/);
assert.match(apiSource, /\['attempted'=>false,'success'=>''\]/);
assert.ok(apiSource.includes("preg_match('/^story\\.\\d+\\.investigations\\.\\d+\\.success$/',$path)"));
assert.ok(apiSource.includes("$value!=='' && (!is_int($value) || $value<0 || $value>99)"));
assert.match(indexSource, /\/styles\.css\?v=58/);
assert.match(indexSource, /\/app\.js\?v=57/);

console.log("knight sheet investigations: first cell stores a bounded number");
