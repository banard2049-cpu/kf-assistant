"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const clone=value=>JSON.parse(JSON.stringify(value));
const orderedConfig=config=>clone({...config,nodes:config.nodes.map(node=>({...node,links:[...node.links].sort()}))});
const approved=require("./rogue-map-approved-2026-10-27.json");
const approvedBasic=approved.nodes.filter(node=>!node.id.startsWith("wither-"));
function load(overrides={}){
  const context={window:{},localStorage:{getItem:key=>key==="kf-rogue-label-overrides-v1"?JSON.stringify(overrides):null}};
  vm.createContext(context);
  for(const file of ["withergraal-data.js","data.js"])vm.runInContext(fs.readFileSync(path.join(__dirname,"../public/modules/rogue",file),"utf8"),context);
  return context.window.KF_ROGUE_RULES;
}
const rules=load();
const initial=rules.freshState(),config=rules.createMapConfig(initial.nodes);
assert.equal(config.schemaVersion,1);
assert.equal(config.nodes.length,190);
assert.equal(rules.validateMapConfig(config).ok,true);
assert.deepEqual(clone(rules.validateMapConfig(config).config),clone(config));
assert.deepEqual(Object.keys(config).sort(),["nodes","schemaVersion"]);
for(const node of config.nodes)assert.deepEqual(Object.keys(node).sort(),["devotion","id","level","links","resurrection","reward","withered"]);

const edited=clone(config),get=id=>edited.nodes.find(node=>node.id===id);
Object.assign(get("sunken-02"),{level:1,reward:"wild",resurrection:0});
Object.assign(get("wither-stone-06"),{level:12,reward:"saint",resurrection:0,devotion:7,withered:true});
Object.assign(get("wither-sunken-01"),{resurrection:0,devotion:0,withered:false});
get("sunken-13").links.push("sunken-17");get("sunken-17").links.push("sunken-13");
const originalTarget=get("wither-stone-06").links[0];
get("wither-stone-06").links=get("wither-stone-06").links.filter(id=>id!==originalTarget);
get(originalTarget).links=get(originalTarget).links.filter(id=>id!=="wither-stone-06");
assert.equal(rules.validateMapConfig(edited).ok,true,"both stages can edit metadata, zero resources, withering and complete undirected links");
const run=rules.freshState();
run.status="active";run.sharedRevives=19;run.graalSighs=4;
run.roster=[{id:"knight-a",knightId:"kara",alive:true,gold:123,rewards:[{key:"existing-reward",text:"既有奖励"}],attributes:{might:3},growth:{symbolP:2}}];
run.claimedRewards={"already-claimed":true};run.advancedClaims={"some-shared-reward":{memberId:"knight-a"}};
run.pendingBattle={nodeId:"sunken-02",monsterId:"M_Toadragon",level:3,requestId:"keep-request"};
run.pendingRewardChoice={nodeId:"sunken-02",choices:{"knight-a":"existing-choice"}};
run.currentNodeId="sunken-02";
run.nodes.find(node=>node.id==="sunken-02").cleared=true;
run.history=[{type:"victory",nodeId:"sunken-02"}];
const before=clone(run),input=JSON.stringify(edited);
assert.equal(rules.applyMapConfig(run,edited),true);
assert.equal(JSON.stringify(edited),input,"applying cannot mutate the editor's input snapshot");
assert.equal(run.nodes.find(node=>node.id==="sunken-02").cleared,true);
for(const key of ["status","sharedRevives","graalSighs","roster","claimedRewards","advancedClaims","pendingBattle","pendingRewardChoice","currentNodeId","history","stage","postgame","createdAt","updatedAt"])assert.deepEqual(clone(run[key]),clone(before[key]),`${key} is campaign data, not map configuration`);
assert.equal(run.basicLinksRevision,2);
assert.equal(run.advancedMapRevision,1);
assert.equal(run.linksEdited,true);
assert.deepEqual(clone(run.defaultLinks),clone(run.nodes.map(node=>({id:node.id,links:[...node.links]}))));
run.mapConfig.nodes.find(node=>node.id==="sunken-02").links.push("sunken-05");
assert.ok(!run.nodes.find(node=>node.id==="sunken-02").links.includes("sunken-05"),"persisted configuration and runtime nodes do not share mutable link arrays");
rules.applyMapConfig(run,edited);
const reloaded=rules.normalizeState(clone(run));
for(const id of ["sunken-02","wither-stone-06","wither-sunken-01"]){
  const actual=reloaded.nodes.find(node=>node.id===id),expected=get(id);
  for(const key of ["level","reward","resurrection","devotion","withered","links"])assert.deepEqual(clone(actual[key]),clone(expected[key]),`${id}: ${key} survives reload`);
}
assert.deepEqual(clone(reloaded.pendingBattle),clone(run.pendingBattle));
assert.deepEqual(clone(reloaded.pendingRewardChoice),clone(run.pendingRewardChoice));
assert.deepEqual(clone(reloaded.claimedRewards),clone(run.claimedRewards));
assert.deepEqual(clone(rules.normalizeState(reloaded)),clone(reloaded),"configuration normalization is idempotent");
const preMigration=clone(run);preMigration.basicLinksRevision=1;
preMigration.advancedMapRevision=1;
const adopted=rules.normalizeState(preMigration);
for(const expected of approvedBasic){
  const actual=adopted.nodes.find(node=>node.id===expected.id);
  for(const key of ["level","reward","resurrection","devotion","withered"])assert.equal(actual[key],expected[key],`${expected.id}: the approved baseline replaces pre-revision-2 map settings`);
  assert.deepEqual([...actual.links].sort(),[...expected.links].sort());
  const saved=adopted.mapConfig.nodes.find(node=>node.id===expected.id);
  assert.deepEqual(clone(saved),clone(expected),"the saved template is upgraded along with runtime nodes");
}
for(const id of ["wither-stone-06","wither-sunken-01"]){
  const actual=adopted.nodes.find(node=>node.id===id),expected=get(id);
  for(const key of ["level","reward","resurrection","devotion","withered","links"])assert.deepEqual(clone(actual[key]),clone(expected[key]),"a basic baseline upgrade cannot modify advanced settings");
}
assert.deepEqual(clone(adopted.pendingBattle),clone(run.pendingBattle));
assert.deepEqual(clone(adopted.pendingRewardChoice),clone(run.pendingRewardChoice));
assert.deepEqual(clone(rules.normalizeState(adopted)),clone(adopted));
const oldBoth=clone(preMigration);delete oldBoth.advancedMapRevision;
const adoptedBoth=rules.normalizeState(oldBoth);
assert.deepEqual(orderedConfig(rules.createMapConfig(adoptedBoth.nodes)),orderedConfig(approved),"both old stage revisions adopt the full approved JSON");
assert.deepEqual(orderedConfig(adoptedBoth.mapConfig),orderedConfig(approved));
assert.equal(adoptedBoth.basicLinksRevision,2);assert.equal(adoptedBoth.advancedMapRevision,1);
assert.deepEqual(clone(adoptedBoth.pendingBattle),clone(run.pendingBattle));
assert.deepEqual(clone(adoptedBoth.pendingRewardChoice),clone(run.pendingRewardChoice));
assert.deepEqual(clone(rules.normalizeState(adoptedBoth)),clone(adoptedBoth));
const otherSlot=rules.freshState();
assert.notEqual(otherSlot.nodes.find(node=>node.id==="sunken-02").reward,"wild","another save never inherits an edited run by implicit mutation");
const newRun=rules.freshState();rules.applyMapConfig(newRun,reloaded.mapConfig);
assert.deepEqual(clone(newRun.roster),[]);
assert.equal(newRun.status,"setup");assert.equal(newRun.sharedRevives,5);
assert.equal(newRun.nodes.find(node=>node.id==="sunken-02").cleared,false,"explicit template inheritance starts new progress");
assert.equal(newRun.nodes.find(node=>node.id==="sunken-02").reward,"wild");
const withLegacyLabels=load({"sunken-02":{level:5,reward:"gear"}});
const labelReload=withLegacyLabels.normalizeState(clone(run));
assert.equal(labelReload.nodes.find(node=>node.id==="sunken-02").level,1);
assert.equal(labelReload.nodes.find(node=>node.id==="sunken-02").reward,"wild","a saved campaign map wins over browser-global legacy labels on every screen");

function reject(mutator,message){
  const candidate=clone(edited);mutator(candidate);
  const candidateBefore=JSON.stringify(candidate),target=clone(run),snapshot=JSON.stringify(target);
  const checked=rules.validateMapConfig(candidate);
  assert.equal(checked.ok,false,message);assert.ok(checked.errors.length);
  assert.equal(JSON.stringify(candidate),candidateBefore,"validation is pure");
  assert.equal(rules.applyMapConfig(target,candidate),false);
  assert.equal(JSON.stringify(target),snapshot,"invalid imports cannot partly modify a campaign");
  const corrupt=clone(run);corrupt.mapConfig=candidate;
  const normalized=rules.normalizeState(corrupt);
  assert.equal(normalized.mapConfig,undefined,"invalid stored configuration is ignored safely");
  assert.deepEqual(clone(normalized.pendingBattle),clone(run.pendingBattle));
  assert.equal(normalized.nodes.find(node=>node.id==="sunken-02").cleared,true);
}
reject(value=>{value.schemaVersion=2;},"unsupported schema");
reject(value=>{value.nodes.pop();},"incomplete node set");
reject(value=>{value.nodes[0].id="unknown";},"unknown ID");
reject(value=>{value.nodes[0].id=value.nodes[1].id;},"duplicate ID");
reject(value=>{value.nodes.find(node=>node.id==="S").level=1;},"start values are fixed");
reject(value=>{value.nodes.find(node=>node.id==="sunken-02").devotion=1;},"basic devotion is zero");
reject(value=>{value.nodes.find(node=>node.id==="sunken-02").withered=true;},"basic nodes cannot be withered");
reject(value=>{value.nodes.find(node=>node.id==="sunken-02").level=6;},"basic level range");
reject(value=>{value.nodes.find(node=>node.id==="wither-stone-06").level=5;},"advanced level range");
reject(value=>{value.nodes.find(node=>node.id==="wither-stone-06").reward="wild";},"stage reward categories");
reject(value=>{value.nodes[0].resurrection=-1;},"negative resource");
reject(value=>{value.nodes[0].resurrection=1.5;},"fractional resource");
reject(value=>{value.nodes[0].devotion=Infinity;},"non-finite resource");
reject(value=>{value.nodes[0].links.push(value.nodes[0].id);},"self edge");
reject(value=>{value.nodes[0].links.push(value.nodes[0].links[0]);},"duplicate edge");
reject(value=>{value.nodes[0].links.push("missing");},"missing target");
reject(value=>{value.nodes[0].links.push("wither-S");},"cross-stage edge");
reject(value=>{value.nodes.find(node=>node.id==="sunken-13").links.push("sunken-01");},"one-sided edge");
const isolated=clone(edited),isolatedNode=isolated.nodes.find(node=>node.id==="sunken-02");
for(const id of isolatedNode.links){const adjacent=isolated.nodes.find(node=>node.id===id);adjacent.links=adjacent.links.filter(link=>link!==isolatedNode.id);}
isolatedNode.links=[];
assert.equal(rules.validateMapConfig(isolated).ok,true,"isolated nodes are allowed for manual correction; the editor reports reachability warnings");
assert.equal(rules.applyMapConfig({nodes:[]},edited),false,"an incomplete runtime state cannot receive a partial map");
console.log("Rogue map configuration passed: complete imports, both stages, metadata, edges, progress isolation, migration, reload and legacy labels.");
