"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"../public");
const c={window:{}};vm.createContext(c);
for(const file of ["level-config.js","postgame-config.js"])vm.runInContext(fs.readFileSync(path.join(root,"modules/aibp/data",file),"utf8"),c);
const rules=c.window.KF_POSTGAME_RULES, levels=c.window.KF_LEVEL_CONFIG;
function clipPoints(value){
  assert.match(value,/^polygon\(.+\)$/);
  const points=[...value.matchAll(/([\d.]+)% ([\d.]+)%/g)].map(match=>[Number(match[1]),Number(match[2])]);
  assert.ok(points.length>=4,"the level image needs a complete silhouette");
  assert.ok(points.every(point=>point.every(value=>Number.isFinite(value)&&value>=0&&value<=100)));
  return points;
}
function contains(points,x,y){
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const [a,b]=points[i],[c,d]=points[j];
    if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside;
  }
  return inside;
}
assert.equal(Object.keys(rules.DATA).length,22);
assert.equal(Object.values(rules.DATA).reduce((sum,rows)=>sum+rows.length,0),120);
const ids=new Set();let images=0;
for(const [monster,rows] of Object.entries(rules.DATA))for(const row of rows){
  const data=levels[monster].find(item=>item.level===row.level);
  assert.ok(data,`${monster} level ${row.level}: missing stat row`);
  assert.ok(data.hit && data.wounds!==undefined);
  assert.ok(Array.isArray(data.activations));
  assert.ok(Number.isInteger(data.promotion));
  assert.equal(data.exhibitionWoundsUnspecified,true);
  assert.equal(row.trait.image.clipPath,undefined,"special trait images keep their original rendering");
  const silhouette=clipPoints(row.reference.image.clipPath);
  assert.ok(contains(silhouette,6,45),`${monster} level ${row.level}: retain the red level badge`);
  assert.ok(contains(silhouette,90,40),`${monster} level ${row.level}: retain the right-hand black stat bar`);
  assert.ok(!contains(silhouette,90,99),`${monster} level ${row.level}: remove the bottom paper margin`);
  for(const card of [row.trait,row.reference]){
    assert.ok(!ids.has(card.id));ids.add(card.id);
    assert.equal(card.minLevel,row.level);
    assert.ok(card.source.file && card.source.page>0 && card.source.rect.length===4);
    assert.ok(card.width>100 && card.height>25);
    assert.ok(Math.abs(card.image.aspect-card.width/card.height)<1e-9);
    const file=path.resolve(root,"."+card.image.face);
    assert.ok(file.startsWith(path.join(root,"assets")+path.sep));
    if(!process.argv.includes("--metadata-only")){
      const bytes=fs.readFileSync(file);
      assert.equal(bytes.subarray(1,4).toString(),"PNG");
      assert.equal(bytes.readUInt32BE(16),card.width);
      assert.equal(bytes.readUInt32BE(20),card.height);
    }
    images++;
  }
  const before=rules.traitsFor(monster,row.level-1);
  const exact=rules.traitsFor(monster,row.level);
  assert.ok(!before.some(card=>card.id===row.trait.id));
  assert.ok(exact.some(card=>card.id===row.trait.id));
  const max=rules.traitsFor(monster,rules.maxLevel(monster));
  assert.ok(max.some(card=>card.id===row.trait.id));
  exact.filter(card=>!card.note?.includes("取代")).forEach(card=>assert.ok(!card.supersededBy || card.supersededBy.length));
}
assert.equal(images,240);
assert.equal(levels.M_BogWitch.find(row=>row.level===8).activations[0],"2 AI");
assert.equal(levels.M_BogWitch.find(row=>row.level===9).activations[0],"1 AI");
assert.equal(levels.M_FirstmenLictor.find(row=>row.level===7).wounds,"!");
assert.equal(rules.maxLevel("M_DevilSmeltedFears"),10);
assert.equal(rules.maxLevel("M_BogWitch"),10);
assert.ok(rules.traitsFor("M_DevilSmeltedFears",7).some(card=>card.minLevel===5&&card.supersededBy?.includes("Drowning in Sin")));
assert.ok(rules.traitsFor("M_Toadragon",3).every(card=>!card.supersededBy));
const toadragonStats=rules.levelReferenceFor("M_Toadragon",9);
const toadragonOutline=clipPoints(toadragonStats.image.clipPath);
assert.ok(contains(toadragonOutline,45/632*100,61/145*100),"keep the white numeral inside the red level badge");
assert.ok(contains(toadragonOutline,124/632*100,110/145*100),"keep the white icon inside the blue stat row");
assert.ok(!contains(toadragonOutline,440/632*100,140/145*100),"hide the original white paper below the stat row");
console.log(`Postgame assets passed: 22 monsters, 120 exact levels and CSS silhouettes, ${images} unchanged source images and cumulative thresholds.`);
