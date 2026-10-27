"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const publicRoot = path.resolve(__dirname, "../public");
const context = { window: {} };
vm.createContext(context);
for (const file of ["modules/equipment/data.js", "modules/rogue/withergraal-data.js", "modules/rogue/data.js"]) {
  vm.runInContext(fs.readFileSync(path.join(publicRoot, file), "utf8"), context);
}
const rules = context.window.KF_ROGUE_RULES;
const plain = value => JSON.parse(JSON.stringify(value));
const member = id => ({ id, knightId:"kara", name:id, gold:37, alive:true, rewards:[], notes:"kept", attributes:{might:2}, growth:{}, devotion:0 });
for (const stage of Object.keys(rules.STAGES)) {
  const nodes = rules.getStageNodes(rules.freshState(), stage);
  const byId = new Map(nodes.map(node => [node.id, node]));
  const reached = new Set([rules.stageMeta(stage).startNodeId]);
  const queue = [...reached];
  for (const id of queue) for (const link of byId.get(id).links) {
    assert.ok(byId.has(link), `${id}: cross-stage or invalid link ${link}`);
    assert.ok(byId.get(link).links.includes(id), `${id}: asymmetric link ${link}`);
    if (!reached.has(link)) { reached.add(link); queue.push(link); }
  }
  assert.equal(reached.size, nodes.length, `${stage}: every printed circle must be reachable`);
}
assert.equal(rules.WITHER_NODES.length, 87);
for (let level=6; level<=12; level++) for (const kingdom of ["stone","sunken"]) for (let roll=1; roll<=10; roll++) {
  const result = rules.randomResult(level, kingdom, roll);
  assert.equal(result.roll, roll);
  assert.ok(result.level>=3 && result.level<=9);
}
assert.equal(rules.randomResult(6,"stone",1).monsterId,"M_YoungDevour");
assert.equal(rules.randomResult(12,"stone",6).monsterId,"M_PuppetKing");
assert.equal(rules.randomResult(12,"stone",7).monsterId,"M_PuppetKing");
assert.throws(() => rules.randomResult(13,"stone",1), { name:"RangeError" });
assert.throws(() => rules.rewardOptions(8,"kara","stat"), { name:"RangeError" });

for(const id of rules.ROSEGRAAL_FINISH_NODE_IDS){
  const completed=rules.freshState();completed.status="active";
  completed.nodes.find(node=>node.id===id).cleared=true;
  assert.equal(rules.stageComplete(completed,"rosegraal"),true,`${id}: one printed V endpoint wins`);
  assert.ok(rules.getStageNodes(completed).some(node=>!node.cleared),"other branches need not be cleared");
  const restored=rules.normalizeState(plain(completed));
  assert.equal(restored.status,"won",`${id}: an already-cleared endpoint repairs an existing save`);
  assert.equal(restored.stage,"rosegraal","reload never enters the advanced stage automatically");
  assert.equal(rules.canEnterWithergraal(restored),true);
  completed.pendingRewardChoice={nodeId:id};
  assert.equal(rules.normalizeState(plain(completed)).status,"active","the endpoint reward must be completed before the run wins");
  assert.equal(rules.canEnterWithergraal(completed),false);
}
const unfinished=rules.freshState();unfinished.status="active";
unfinished.nodes.forEach(node=>node.cleared=!rules.ROSEGRAAL_FINISH_NODE_IDS.includes(node.id));
assert.equal(rules.stageComplete(unfinished,"rosegraal"),false,"clearing every nonterminal node does not win");
const edited=rules.freshState();
Object.assign(edited.nodes.find(node=>node.id==="sunken-01"),{level:1,links:["S","sunken-02"],cleared:true});
assert.equal(rules.stageComplete(edited,"rosegraal"),true,"edited labels or links cannot remove a printed endpoint's victory condition");
Object.assign(edited.nodes.find(node=>node.id==="sunken-01"),{cleared:false});
Object.assign(edited.nodes.find(node=>node.id==="sunken-02"),{level:5,links:["S"],cleared:true});
assert.equal(rules.stageComplete(edited,"rosegraal"),false,"a custom V label or leaf does not create a printed endpoint");

const run = rules.normalizeState({ ...rules.freshState(), schemaVersion:1, status:"active", roster:[member("a"),member("b")], sharedRevives:67, graalSighs:4 });
assert.equal(run.stage,"rosegraal");
assert.equal(rules.canEnterWithergraal(run), false);
rules.getStageNodes(run).forEach(node => node.cleared=true);
assert.equal(rules.canEnterWithergraal(run), true);
run.pendingRewardChoice={nodeId:"stone-01"};
assert.equal(rules.canEnterWithergraal(run), false);
run.pendingRewardChoice=null;
assert.equal(rules.enterWithergraal(run), true);
assert.equal(run.sharedRevives,20);
assert.equal(run.graalSighs,4);
assert.equal(run.roster[0].gold,37);
assert.equal(run.roster[0].notes,"kept");
assert.ok(run.roster.every(item=>item.postgame));
assert.equal(rules.enterWithergraal(run),false);
run.sharedRevives=13;
assert.equal(rules.normalizeState(plain(run)).sharedRevives,13,"reload must not reset revives to 20");
assert.ok(rules.getStageNodes(run,"rosegraal").every(node=>node.cleared));
assert.ok(rules.getStageNodes(run).some(node=>rules.isAvailable(run,node)));
assert.ok(!rules.getStageNodes(run,"rosegraal").some(node=>rules.isAvailable(run,node)));
assert.equal(rules.canEnterWithergraal(rules.normalizeState({...rules.freshState(),status:"won"})),true,"legacy won saves can continue");
const custom = rules.normalizeState({...rules.freshState(),linksEdited:true,nodes:[{id:"S",links:["stone-01"],cleared:true}]});
assert.deepEqual(plain(custom.nodes.find(node=>node.id==="S").links),["stone-01"]);

const statNode={id:"test-stat",level:6,reward:"stat",stage:"withergraal"};
const stat=rules.advancedRewardOptions(run,statNode).find(option=>option.bonuses?.maxVigor);
assert.equal(rules.claimAdvancedReward(run,statNode,{rewardId:stat.id,memberId:"a"}).ok,true);
assert.equal(run.roster[0].growth.maxVigor,1);
assert.equal(rules.claimAdvancedReward(run,statNode,{rewardId:stat.id,memberId:"b"}).ok,false);
const masteryNode={id:"test-mastery",level:8,reward:"mastery",stage:"withergraal"};
let options=rules.advancedRewardOptions(run,masteryNode);
assert.equal(options.length,4,"VIII includes the two unclaimed VI/VII slots and its own two slots");
options=options.filter(option=>option.level===8);
assert.equal(options.length,2,"VIII itself has two independent printed checkboxes");
assert.equal(rules.claimAdvancedReward(run,masteryNode,{rewardId:options[0].id,memberId:"a",name:""}).ok,false);
assert.equal(rules.claimAdvancedReward(run,masteryNode,{rewardId:options[0].id,memberId:"a",name:"First Mastery"}).ok,true);
assert.equal(rules.claimAdvancedReward(run,masteryNode,{rewardId:options[1].id,memberId:"b",name:" first   mastery "}).ok,false);
assert.equal(rules.claimAdvancedReward(run,masteryNode,{rewardId:options[1].id,memberId:"b",name:"Second Mastery"}).ok,true);
const princessNode={id:"test-princess",level:6,reward:"princess",stage:"withergraal"};
options=rules.advancedRewardOptions(run,princessNode);
const beforePrincess=run.roster[0].rewards.length;
assert.equal(rules.claimAdvancedReward(run,princessNode,{rewardId:options[0].id,memberId:"a"}).ok,true);
assert.deepEqual(plain(run.unlockedPrincesses),["Gwyneira"]);
assert.equal(run.roster[0].rewards.length,beforePrincess,"party unlocks must not be assigned to the form's remembered recipient");
const gearNode={id:"test-gear",level:10,reward:"legendary",stage:"withergraal"};
options=rules.advancedRewardOptions(run,gearNode);
assert.equal(rules.claimAdvancedReward(run,gearNode,{rewardId:options[0].id,memberId:"b"}).ok,true);
assert.ok(run.roster[1].rewards.at(-1).equipmentId,"legendary rewards retain the existing catalog ID");
const restored=rules.normalizeState(plain(run));
assert.equal(rules.advancedRewardOptions(restored,masteryNode).length,2,"VI/VII mastery slots remain claimable after VIII slots are used");
assert.equal(restored.roster[0].growth.maxVigor,1);
const alternateNode={id:"test-alternative",level:9,reward:"stat",stage:"withergraal"};
const alternate=rules.advancedRewardOptions(restored,alternateNode).find(option=>option.alternatives);
assert.equal(rules.claimAdvancedReward(restored,alternateNode,{rewardId:alternate.id,memberId:"a",alternative:1}).ok,true);
assert.equal(restored.roster[0].growth.magicLimit,1);
assert.equal(restored.roster[0].growth.zealThreshold,0);
assert.equal(rules.claimAdvancedReward(restored,alternateNode,{rewardId:alternate.id,memberId:"b",alternative:0}).ok,false,"one printed checkbox cannot grant both alternate boons");
for(const option of [...rules.advancedRewardOptions(restored,statNode)])assert.equal(rules.claimAdvancedReward(restored,statNode,{rewardId:option.id,memberId:"a"}).ok,true);
assert.equal(rules.advancedRewardOptions(restored,statNode).length,0,"a fully claimed team pool stays exhausted");

const pool=rules.normalizeState({...rules.freshState(),stage:"withergraal",roster:[member("a"),member("b")]});
const totals={stat:[4,8,12,16,20,24,28],mastery:[1,2,4,6,8,8,8],princess:[1,2,3,4,5,5,5],saint:[1,2,3,5,6,6,6],legendary:[0,0,0,0,4,10,16]};
for(const [category,counts] of Object.entries(totals))for(let level=6;level<=12;level++){
  assert.equal(rules.advancedRewardOptions(pool,{level,reward:category}).length,counts[level-6],`${category} at ${level}: current-or-lower pool`);
}
const highStat={id:"high-stat",stage:"withergraal",level:12,reward:"stat"};
const lower=rules.advancedRewardOptions(pool,highStat).find(option=>option.id==="wither-6-stat-1");
assert.equal(rules.claimAdvancedReward(pool,highStat,{rewardId:lower.id,memberId:"a"}).ok,true);
assert.equal(pool.roster[0].growth.symbolP,1);
assert.equal(pool.roster[0].rewards.at(-1).level,6,"record the reward's source level");
assert.equal(pool.roster[0].rewards.at(-1).nodeLevel,12,"retain the conquered node's level separately");
assert.match(pool.roster[0].rewards.at(-1).text,/战意 Passion/);
assert.equal(rules.claimAdvancedReward(pool,{...highStat,level:6},{rewardId:"wither-7-stat-1",memberId:"a"}).ok,false,"lower nodes cannot claim higher rewards");

const moneyNode={id:"money-node",stage:"withergraal",level:7,reward:"princess"};
const moneyId="wither-7-princess-1";
for(const alternative of [-1,2,.5,"invalid"]){
  const snapshot=JSON.stringify(pool);
  assert.equal(rules.claimAdvancedReward(pool,moneyNode,{rewardId:moneyId,alternative,memberId:"b"}).ok,false);
  assert.equal(JSON.stringify(pool),snapshot,"invalid alternatives cannot mutate rewards or money");
}
assert.equal(rules.claimAdvancedReward(pool,moneyNode,{rewardId:moneyId,alternative:1}).ok,false,"money allocation requires a recipient");
const slawiaRun=rules.normalizeState(plain(pool));
assert.equal(rules.claimAdvancedReward(slawiaRun,moneyNode,{rewardId:moneyId,alternative:0}).ok,true);
assert.deepEqual(plain(slawiaRun.unlockedPrincesses),["Slawia"]);
assert.equal(slawiaRun.roster[0].gold+slawiaRun.roster[1].gold,74);
assert.equal(rules.claimAdvancedReward(slawiaRun,moneyNode,{rewardId:moneyId,alternative:1,memberId:"b"}).ok,false);
assert.equal(rules.claimAdvancedReward(pool,moneyNode,{rewardId:moneyId,alternative:1,memberId:"b"}).ok,true);
assert.equal(pool.roster[0].gold,37);
assert.equal(pool.roster[1].gold,67,"the entire party gains only 30, allocated to the chosen knight");
assert.deepEqual(plain(pool.unlockedPrincesses),[]);
assert.equal(rules.claimAdvancedReward(pool,moneyNode,{rewardId:moneyId,alternative:0}).ok,false,"Slawia and money consume one shared checkbox");
const reloadedMoney=rules.normalizeState(plain(pool));
assert.equal(reloadedMoney.roster[1].gold,67,"normalization must not issue money twice");
assert.equal(reloadedMoney.advancedClaims[moneyId].alternative,1);

const old=plain(pool);
old.roster[0].growth.symbolP=7;
old.roster[0].rewards.find(item=>item.key===lower.id).text="永久 +1";
old.advancedClaims[lower.id].text="永久 +1";
old.advancedClaims["wither-9-stat-4"]={text:"魔法上限 +1",category:"stat",memberId:"a"};
old.roster[0].growth.magicLimit=4;
old.roster[0].rewards.push({key:"wither-9-stat-4",stage:"withergraal",text:"魔法上限 +1"});
const migrated=rules.normalizeState(old);
assert.equal(migrated.roster[0].growth.symbolP,7,"clarifying labels keeps manually edited growth");
assert.equal(migrated.roster[0].growth.magicLimit,4);
assert.match(migrated.roster[0].rewards.find(item=>item.key===lower.id).text,/战意 Passion/);
assert.match(migrated.roster[0].rewards.find(item=>item.key==="wither-9-stat-4").text,/Magic Limit/);
assert.equal(migrated.advancedClaims["wither-9-stat-4"].alternative,1,"legacy alternate selection stays on Magic Limit");
assert.match(rules.GROWTH_LABELS.symbolHExclaim,/烈度上限/);
assert.match(rules.GROWTH_LABELS.symbolCircleExclaim,/灾祸耐限/);
assert.match(rules.GROWTH_LABELS.symbolDragon,/移速/);
assert.match(rules.GROWTH_LABELS.symbolHArrows,/烈度刷新/);
assert.match(rules.GROWTH_LABELS.symbolSword,/强度/);
console.log("Withergraal rules passed: both graphs, encounter tables, migration, continuation and shared rewards.");
