"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const crypto=require("node:crypto");
const audit=require("./rogue-map-audit.json");
const approved=require("./rogue-map-approved-2026-10-27.json");
const approvedBasic=approved.nodes.filter(node=>!node.id.startsWith("wither-"));
const moduleRoot=path.join(__dirname,"../public/modules/rogue");
const plain=value=>JSON.parse(JSON.stringify(value));
function load(overrides={}){
  const context={window:{},localStorage:{getItem:key=>key==="kf-rogue-label-overrides-v1"?JSON.stringify(overrides):null}};
  vm.createContext(context);
  for(const file of ["withergraal-data.js","data.js"])vm.runInContext(fs.readFileSync(path.join(moduleRoot,file),"utf8"),context);
  return context.window.KF_ROGUE_RULES;
}
const rules=load();
assert.equal(rules.BASIC_LINKS_REVISION,2,"the user-approved baseline has its own adoption revision");
assert.equal(rules.ADVANCED_MAP_REVISION,1,"the approved advanced baseline has its own adoption revision");
assert.equal(rules.BASIC_MAP_SOURCE.sha256,crypto.createHash("sha256").update(fs.readFileSync(path.join(__dirname,"rogue-map-approved-2026-10-27.json"))).digest("hex"),"the bundled source fingerprint identifies the exact approved file");
const edgeKey=(a,b)=>[a,b].sort().join("/");
let checkedNodes=0,checkedEdges=0;
for(const stage of ["rosegraal","withergraal"]){
  const reference=audit[stage];
  const prefix=stage==="withergraal"?"wither-":"";
  const nodeId=(kingdom,number)=>`${prefix}${kingdom}-${String(number).padStart(2,"0")}`;
  const start=stage==="withergraal"?"wither-S":"S";
  const actual=rules.getStageNodes(rules.freshState(),stage);
  const byId=new Map(actual.map(node=>[node.id,node]));
  for(const expected of approved.nodes.filter(node=>(node.id.startsWith("wither-")?"withergraal":"rosegraal")===stage)){
    const node=byId.get(expected.id);
    for(const key of ["level","reward","resurrection","devotion","withered"])assert.equal(node[key],expected[key],`${expected.id}: approved ${key}`);
    assert.deepEqual([...node.links].sort(),[...expected.links].sort(),`${expected.id}: approved links`);
  }
  assert.equal(actual.length,reference.sunken.length+reference.stone.length+1);
  for(const kingdom of ["sunken","stone"])reference[kingdom].forEach((row,index)=>{
    const id=nodeId(kingdom,index+1),node=byId.get(id);
    const approvedNode=stage==="rosegraal"?approvedBasic.find(node=>node.id===id):null;
    const [level,resurrection,devotion,symbol]=approvedNode?[row[0],approvedNode.resurrection,approvedNode.devotion,row[1]]:row;
    assert.ok(node,`${stage}: missing printed node ${id}`);
    assert.deepEqual([node.level,node.resurrection,node.devotion,node.reward],[level,resurrection,devotion,reference.legend[symbol]],`${id}: printed level, resources and reward`);
    assert.equal(node.kingdom,kingdom);
    assert.equal(node.stage,stage);
    assert.ok(node.x>0&&node.x<1&&node.y>0&&node.y<1,`${id}: page coordinates`);
    if(node.reward!=="sigh"){
      const options=stage==="rosegraal"
        ?rules.basicRewardOptions(rules.freshState(),node,{id:"audit-knight",knightId:"kara",rewards:[]})
        :rules.advancedRewardOptions(rules.freshState(),node);
      assert.ok(options.length,`${id}: the printed reward category must reach its reward table`);
    }
    checkedNodes++;
  });
  const edges=[];
  for(const kingdom of ["sunken","stone"]){
    edges.push(...reference.edges[kingdom].map(([a,b])=>[nodeId(kingdom,a),nodeId(kingdom,b)]));
    edges.push(...reference.edges.start[kingdom].map(number=>[start,nodeId(kingdom,number)]));
  }
  edges.push(...reference.edges.crossPageSunkenStone.map(([sunken,stone])=>[nodeId("sunken",sunken),nodeId("stone",stone)]));
  const expected=edges.map(([a,b])=>edgeKey(a,b)).sort();
  assert.equal(new Set(expected).size,expected.length,"the source audit cannot repeat an edge");
  const found=[...new Set(actual.flatMap(node=>node.links.map(link=>edgeKey(node.id,link))))].sort();
  assert.deepEqual(found,expected,`${stage}: every next-circle connection must match the reviewed original map`);
  for(const node of actual)for(const link of node.links){
    assert.ok(byId.get(link)?.links.includes(node.id),`${node.id}: invalid, cross-stage or asymmetric edge`);
  }
  checkedEdges+=edges.length;
}

assert.deepEqual(plain(rules.rewardOptions(4,"paracelsa","technique")),["Become a Stumbling Block","Spare Not The Rod"]);
assert.deepEqual(plain(rules.rewardOptions(4,"ser-ubar","technique")),["Mind over Body","Fist of the Firstmen"]);
for(const [knightId,oldName,newName] of [
  ["paracelsa","Mind over Body","Become a Stumbling Block"],["paracelsa","Fist of the Firstmen","Spare Not The Rod"],
  ["ser-ubar","Become a Stumbling Block","Mind over Body"],["ser-ubar","Spare Not The Rod","Fist of the Firstmen"],
]){
  const state=rules.freshState(),member={id:"legacy-knight",knightId,rewards:[]};
  state.claimedRewards[`${member.id}:4:technique:${oldName}`]=true;
  const before=JSON.stringify(state);
  assert.ok(!rules.basicRewardOptions(state,{level:4,reward:"technique"},member).some(option=>option.text===newName),"an old swapped-cell claim still consumes its original checkbox");
  assert.equal(JSON.stringify(state),before,"correcting a table does not rewrite previous inventory or grant replacements");
}
const stale=rules.freshState();
stale.status="active";stale.nodes.find(node=>node.id==="stone-22").cleared=true;
Object.assign(stale.nodes.find(node=>node.id==="stone-22"),{level:2,resurrection:2,reward:"class"});
const restored=rules.normalizeState(stale);
assert.deepEqual([restored.nodes.find(node=>node.id==="stone-22").level,restored.nodes.find(node=>node.id==="stone-22").reward],[4,"wild"]);
assert.equal(restored.nodes.find(node=>node.id==="stone-22").cleared,true,"source metadata updates retain completion flags");
const custom=load({"stone-22":{level:2,reward:"class"}});
assert.deepEqual([custom.NODES.find(node=>node.id==="stone-22").level,custom.NODES.find(node=>node.id==="stone-22").reward],[4,"wild"],"old browser-global labels cannot override the approved baseline");
assert.deepEqual([custom.SOURCE_NODES.find(node=>node.id==="stone-22").level,custom.SOURCE_NODES.find(node=>node.id==="stone-22").reward],[4,"wild"],"the source manifest remains separately inspectable");
const edited=rules.freshState();edited.linksEdited=true;
edited.nodes.find(node=>node.id==="wither-S").links.push("wither-stone-31");
edited.nodes.find(node=>node.id==="wither-stone-31").links.push("wither-S");
assert.ok(rules.normalizeState(edited).nodes.find(node=>node.id==="wither-S").links.includes("wither-stone-31"),"map corrections do not overwrite explicitly edited links");
const adjust=(state,a,b,connected)=>{
  const left=state.nodes.find(node=>node.id===a),right=state.nodes.find(node=>node.id===b);
  left.links=left.links.filter(id=>id!==b);right.links=right.links.filter(id=>id!==a);
  if(connected){left.links.push(b);right.links.push(a);}
};
const graph=(state,stage)=>[...new Set(state.nodes.filter(node=>node.stage===stage).flatMap(node=>node.links.map(link=>edgeKey(node.id,link))))].sort();
const approvedSnapshot=state=>state.nodes.filter(node=>node.stage==="rosegraal").map(node=>({id:node.id,level:node.level,reward:node.reward,resurrection:node.resurrection,devotion:node.devotion,withered:node.withered,links:[...node.links].sort()}));
const approvedRows=approvedBasic.map(node=>({...node,links:[...node.links].sort()}));
const previousBasic=require("./rogue-map-before-approved-2026-10-27.json").nodes.filter(node=>!node.id.startsWith("wither-"));
for(const revision of [undefined,0,1]){
  const legacy=rules.freshState();legacy.linksEdited=true;legacy.advancedMapRevision=1;
  if(revision===undefined)delete legacy.basicLinksRevision;else legacy.basicLinksRevision=revision;
  for(const previous of previousBasic)Object.assign(legacy.nodes.find(node=>node.id===previous.id),plain(previous));
  adjust(legacy,"wither-S","wither-stone-31",true);
  legacy.nodes.find(node=>node.id==="sunken-30").cleared=true;
  legacy.sharedRevives=7;legacy.graalSighs=3;
  legacy.claimedRewards={"saved-reward":true};
  legacy.pendingRewardChoice={nodeId:"sunken-30",choices:{"knight-a":"saved-choice"}};
  // A pre-adoption explicit map must update its basic half once too.
  legacy.mapConfig=rules.createMapConfig(legacy.nodes);
  const original=JSON.stringify(legacy),fixed=rules.normalizeState(legacy);
  assert.deepEqual(plain(approvedSnapshot(fixed)),plain(approvedRows),`revision ${revision}: every basic field and link adopts the approved JSON`);
  assert.equal(fixed.basicLinksRevision,2);
  assert.ok(fixed.nodes.find(node=>node.id==="wither-S").links.includes("wither-stone-31"),"advanced custom edges survive a basic baseline upgrade");
  assert.equal(fixed.nodes.find(node=>node.id==="sunken-30").cleared,true);
  assert.equal(fixed.sharedRevives,7);assert.equal(fixed.graalSighs,3);
  assert.deepEqual(fixed.claimedRewards,legacy.claimedRewards);
  assert.deepEqual(fixed.pendingRewardChoice,legacy.pendingRewardChoice);
  assert.equal(JSON.stringify(legacy),original,"migration cannot mutate the stored input");
  assert.deepEqual(plain(rules.normalizeState(fixed)),plain(fixed),"approved baseline adoption is idempotent");
}
const oldBoth=rules.freshState();oldBoth.linksEdited=true;oldBoth.basicLinksRevision=1;
delete oldBoth.advancedMapRevision;
for(const previous of require("./rogue-map-before-approved-2026-10-27.json").nodes)Object.assign(oldBoth.nodes.find(node=>node.id===previous.id),plain(previous));
adjust(oldBoth,"sunken-01","sunken-02",true);adjust(oldBoth,"wither-S","wither-stone-31",true);
oldBoth.mapConfig=rules.createMapConfig(oldBoth.nodes);
oldBoth.nodes.find(node=>node.id==="wither-sunken-17").cleared=true;oldBoth.sharedRevives=23;
const originalBoth=JSON.stringify(oldBoth),adoptedBoth=rules.normalizeState(oldBoth);
const orderedConfig=config=>plain({...config,nodes:config.nodes.map(node=>({...node,links:[...node.links].sort()}))});
const allRows=state=>orderedConfig(rules.createMapConfig(state.nodes));
assert.deepEqual(allRows(adoptedBoth),orderedConfig(approved),"old stored configs adopt both approved stages together");
assert.deepEqual(orderedConfig(adoptedBoth.mapConfig),orderedConfig(approved),"saved templates receive the same two-stage baseline");
assert.equal(adoptedBoth.advancedMapRevision,1);assert.equal(adoptedBoth.basicLinksRevision,2);
assert.equal(adoptedBoth.sharedRevives,23);assert.equal(adoptedBoth.nodes.find(node=>node.id==="wither-sunken-17").cleared,true);
assert.equal(JSON.stringify(oldBoth),originalBoth);assert.deepEqual(plain(rules.normalizeState(adoptedBoth)),plain(adoptedBoth));
const laterManual=rules.freshState();laterManual.linksEdited=true;
adjust(laterManual,"sunken-01","sunken-02",true);
adjust(laterManual,"wither-S","wither-stone-31",true);
const laterFixed=rules.normalizeState(laterManual);
assert.ok(laterFixed.nodes.find(node=>node.id==="sunken-01").links.includes("sunken-02"),"new basic changes remain editable after revision 2");
assert.ok(laterFixed.nodes.find(node=>node.id==="wither-S").links.includes("wither-stone-31"),"new advanced changes remain editable after advanced revision 1");
console.log(`Map audit passed: ${checkedNodes} encounter nodes, ${checkedEdges} printed connections, reward tables and legacy/custom saves.`);
