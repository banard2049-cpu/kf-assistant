"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const appSource = fs.readFileSync("public/app.js", "utf8").replace(/\r\n/g, "\n");
const indexSource = fs.readFileSync("public/index.html", "utf8");
const mapSource = fs.readFileSync("public/modules/map/app.js", "utf8").replace(/\r\n/g, "\n");
const bridgeSource = fs.readFileSync("public/modules/module-bridge.js", "utf8");
const aibpSource = fs.readFileSync("public/modules/aibp/app.js", "utf8");

const shuffleStart = appSource.indexOf("const shuffleList=");
const shuffleEnd = appSource.indexOf("function compatibleUuid", shuffleStart);
const ruleStart = appSource.indexOf("const monsterTier=");
const ruleEnd = appSource.indexOf("const monsterAvatar=", ruleStart);
assert.ok(shuffleStart >= 0 && shuffleEnd > shuffleStart && ruleStart >= 0 && ruleEnd > ruleStart);

const context = {
  encounterRecord: name => ({
    encounterLevels: [{ level: 1, tier: name === "King" ? "king" : name === "Dragon" ? "dragon" : "mob" }]
  })
};
vm.runInNewContext(`
  ${appSource.slice(shuffleStart, shuffleEnd)}
  ${appSource.slice(ruleStart, ruleEnd)}
  normal = drawMonsterPoolCards([{name:"Mob",level:1,tier:"mob"},{name:"King",level:1,tier:"king"}], 1, false, () => 0);
  triggered = drawMonsterPoolCards([{name:"Mob",level:1,tier:"mob"},{name:"King",level:1,tier:"king"},{name:"Dragon",level:1,tier:"dragon"}], 2, true, () => 0);
  ineligible = drawMonsterPoolCards([{name:"King",level:1,tier:"king"},{name:"Dragon",level:1,tier:"dragon"}], 2, true, () => 0);
`, context);

assert.equal(context.normal.selected.length, 1);
assert.equal(context.normal.rule.drawn, false);
assert.equal(context.triggered.selected.length, 2, "special card must be replaced by an immediate extra draw");
assert.equal(context.triggered.rule.drawn, true);
assert.equal(context.triggered.rule.boundMonster, "Mob", "king and dragon cards must be excluded from binding");
assert.equal(context.triggered.selected.find(card => card.name === "Mob").conflictLocation, "巨兽之腹");
assert.equal(context.ineligible.rule.drawn, true);
assert.equal(context.ineligible.rule.boundIndex, null, "no binding is allowed when only kings or dragons were drawn");

assert.match(indexSource, /id="devourDragonRule"/);
assert.match(indexSource, /app\.js\?v=27/);
assert.match(appSource, /devourDragonBound:true,conflictLocation:"巨兽之腹"/);
assert.match(mapSource, /districtWheelLocations/);
assert.match(mapSource, /conflictLocation: destination === "conflict"/);
assert.match(bridgeSource, /new CustomEvent\("kf:aibp-handoff"/);
assert.match(aibpSource, /特殊冲突地点/);

console.log("devour dragon optional rule: draw replacement, eligible binding, map handoff and AIBP notice verified");
