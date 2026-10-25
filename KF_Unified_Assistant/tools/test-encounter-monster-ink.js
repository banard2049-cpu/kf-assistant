"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const read = name => fs.readFileSync(`public/modules/encounter/${name}`, "utf8");
const context = { window: {} };
for (const name of ["data/encounter-data.js", "encounter-brush-paths.js", "encounter-monster-ink.js", "encounter-view.js"]) vm.runInNewContext(read(name), context);
const view = context.window.KFEncounterView, data = context.window.KF_ENCOUNTER_DATA;
const appSource = read("app.js"), range = { isUnavailableBoardSpace: (cell, board) => view.isUnavailableBoardSpace(cell, board, range.tier) };
vm.runInNewContext(appSource.slice(appSource.indexOf("  function rotateAttackOffset("), appSource.indexOf("  function calculatedAttackTargets(")) + "\nthis.targets = monsterAttackTargets;", range);
const ids = ["M_Toadragon", "M_Panzerdragon", "M_YoungDevour", "M_PuppetKing", "M_DevilSmeltedFears", "M_Eggknight", "M_Knighteater", "M_PalebloodWorms", "M_KingLaidLow", "M_KnightFen"];
const normalized = html => html.replace(/encounter-ink-\d+/g, "encounter-ink-stable");
const fixtures = [];
for (const id of ids) {
  const monster = data.monsters.find(item => item.id === id), level = monster.encounterLevels[0], board = view.boardData(data, level);
  range.tier = level.tier;
  const size = view.monsterFootprint(level), poses = {};
  for (const facing of [0,90,180,270]) {
    let best = null;
    for (let row=0; row<=board.rows-size; row++) for (let col=0; col<=board.cols-size; col++) {
      const cells = Array.from({length:size*size},(_,i)=>(row+Math.floor(i/size))*board.cols+col+i%size+1);
      if(cells.some(cell=>view.isUnavailableBoardSpace(cell,board,level.tier))) continue;
      const piece = { id:`${id}-fixture`, name:monster.name, space:String(row*board.cols+col+1), facing, rolls:["sword"] };
      const targets = range.targets(piece,level,board,size);
      if(!best || targets.length>best.targets.length) best={piece,targets};
    }
    assert.ok(best?.targets.length,`${id}:${facing} has a visible range`);
    poses[facing]=best;
    const state={monsterId:id,level:level.level,phase:"monster",monsters:[best.piece],targets:best.targets};
    const main = view.renderBoard({state,data,monster,level}), display = view.renderBoard({state,data,monster,level,interactive:false});
    const ink = html=>html.match(/<svg class="board-ink"[\s\S]*?<\/svg>/)[0];
    assert.equal(normalized(ink(main)),normalized(ink(display)),`${id}:${facing} main/display marks match`);
    assert.ok(!/NaN|Infinity/.test(main),`${id}:${facing} has finite pen geometry`);
    assert.match(main,id==="M_Panzerdragon"?/data-dragon-phrase=/:new RegExp(`data-monster-ink="${id}"`));
    if(id==="M_YoungDevour"&&main.includes('data-monster-motif="two-rows-of-teeth"')) {
      const toothCells=new Set([...main.matchAll(/data-tooth-cell="(\d+)"/g)].map(match=>Number(match[1])));
      assert.deepEqual([...toothCells].sort((a,b)=>a-b),[...best.targets].map(Number).sort((a,b)=>a-b),"every devour-dragon attack cell has its own teeth");
    }
    if(id==="M_KnightFen"&&main.includes('data-monster-motif="mud-poop"')) {
      const poopCells=new Set([...main.matchAll(/data-poop-cell="(\d+)"/g)].map(match=>Number(match[1])));
      assert.deepEqual([...poopCells].sort((a,b)=>a-b),[...best.targets].map(Number).sort((a,b)=>a-b),"poop symbols fill every mud-knight attack cell");
      const sizes=[...main.matchAll(/data-poop-size="([^"]+)"/g)].map(match=>Number(match[1]));
      const angles=[...main.matchAll(/data-poop-angle="([^"]+)"/g)].map(match=>Number(match[1]));
      assert.ok(Math.max(...sizes)/Math.min(...sizes)>1.7,"poop symbols have visibly different sizes");
      assert.ok(new Set(angles.map(angle=>Math.floor(angle/45))).size>=3,"poop symbols rotate in multiple directions");
    }
    if(id==="M_Toadragon") {
      const eyeCount=[...main.matchAll(/data-toad-eye="true"/g)].length;
      assert.ok(eyeCount>=best.targets.length*12,"toad eyes densely cover the whole range before the caption");
      assert.ok(main.indexOf('data-toad-background="true"')<main.indexOf('data-special-text='),"the caption is painted over the eye background");
    }
    if(["M_Knighteater","M_PalebloodWorms"].includes(id)) assert.match(main.match(/<g class="ink-warning ink-monster-special"[^>]+>/)[0],/style="opacity:\.96"/,"dense text keeps its stronger opacity");
    assert.equal(normalized(ink(main)),normalized(view.renderBoardInk(new Map(),best.targets.map(Number),board,view.boardInkOptions(state,monster,level))),"selection refresh keeps the same monster marks");
    const allocated=[...main.matchAll(/data-ink-layer="attack" data-ink-kind="attack" data-ink-cells="([^"]+)"/g)].flatMap(m=>m[1].split(',').map(Number));
    assert.deepEqual(allocated.sort((a,b)=>a-b),[...best.targets].map(Number).sort((a,b)=>a-b),"all selected cells retain the correct outer contour");
  }
  fixtures.push({id,name:monster.name,avatar:monster.avatar,level,board,poses});
}
const glyphContext={};
const source=read("encounter-view.js");
vm.runInNewContext(source.slice(source.indexOf("  const INK_WARNING_GLYPHS"),source.indexOf("  function inkWarningGlyph("))+"\nthis.glyphs={...INK_WARNING_GLYPHS,...INK_WARNING_EXTRAS.base,...INK_DRAGON_GLYPHS,...INK_MONSTER_GLYPHS};",glyphContext);
for(const character of new Set("咕嘎蹦跳铁离子攻城炮五指不行如来神掌冲击波椅能坐骇物牛逼开放世界FUFU王好想玩XX蛋好吃血肉世是嚼失时事市视试室诗")) assert.ok(glyphContext.glyphs[character],`glyph exists for ${character}`);
// The shi pool and the compact latin word must have real pen strokes; a missing glyph
// silently falls back to an exclamation mark while keeping the requested data attribute.
for (const character of "食屎尸十石师士shi") assert.ok(glyphContext.glyphs[character], `hand-written glyph exists for ${character}`);
// 尸 is the glyph the shi pool got wrong most often: it used to close the left side into a
// triangle (unreadable). It must stay three open strokes with the right side folded down.
{
  const strokes = glyphContext.glyphs["尸"];
  const closed = stroke => Math.hypot(stroke[0][0] - stroke.at(-1)[0], stroke[0][1] - stroke.at(-1)[1]) < 2;
  assert.equal(strokes.length, 3, "尸 stays a three-stroke glyph");
  assert.ok(strokes.every(stroke => !closed(stroke)), "尸 has no closed contour");
  assert.ok(strokes.some(stroke => Math.max(...stroke.map(point => point[0])) > 65
    && Math.max(...stroke.map(point => point[1])) > 35), "尸 folds its top bar down on the right");
  assert.ok(strokes.some(stroke => Math.max(...stroke.map(point => point[1])) > 80), "尸's 撇 reaches the bottom");
}
// 师 previously dropped 巾's left vertical, so the right half read as 帅. The glyph
// needs its three verticals: the left 丨, 巾's left 丨 and the long centre 丨.
{
  const strokes = glyphContext.glyphs["师"];
  const size = stroke => [Math.max(...stroke.map(point => point[0])) - Math.min(...stroke.map(point => point[0])),
    Math.max(...stroke.map(point => point[1])) - Math.min(...stroke.map(point => point[1]))];
  const verticals = strokes.filter(stroke => { const [width, height] = size(stroke); return width < 8 && height > 30; });
  assert.ok(verticals.length >= 3, "师 keeps its three vertical strokes");
  assert.ok(verticals.some(stroke => stroke.every(([x]) => x > 35 && x < 50)),
    "师's 巾 left stroke is drawn as its own vertical");
}
const devour=fixtures.find(item=>item.id==="M_YoungDevour"),devourPose=devour.poses[90],devourStyles=new Set();
for(let seed=1;seed<=24;seed++) {
  const options={monsterInk:devour.id,warningSeed:seed,attackFacing:90};
  const html=view.renderBoardInk(new Map(),devourPose.targets.map(Number),devour.board,options);
  const motif=html.match(/data-monster-motif="([^"]+)"/)[1];devourStyles.add(motif);
  assert.equal(normalized(html),normalized(view.renderBoardInk(new Map(),devourPose.targets.map(Number),devour.board,options)),"the devour style stays stable when selecting or dragging");
  if(motif==="two-rows-of-teeth") {
    const toothCells=new Set([...html.matchAll(/data-tooth-cell="(\d+)"/g)].map(match=>Number(match[1])));
    assert.equal(JSON.stringify([...toothCells].sort((a,b)=>a-b)),
      JSON.stringify(devourPose.targets.map(Number).sort((a,b)=>a-b)),
      "the original teeth style still covers every attack cell");
  } else {
    assert.match(html,/style="opacity:\.96"/);
    assert.match(html,/data-dense-layout="continuous"/);
    assert.match(html,motif==="dense-eat"?/data-special-text="吃"/:motif==="dense-meat"?/data-special-text="肉肉"/:/data-special-text="嚼"/);
    if(motif==="dense-chew")assert.match(html,/data-warning-glyph="嚼"/,"the chew style is drawn with the hand-written 嚼 glyph");
  }
}
assert.deepEqual([...devourStyles].sort(),["dense-chew","dense-eat","dense-meat","two-rows-of-teeth"]);
const mud=fixtures.find(item=>item.id==="M_KnightFen"),mudPose=Object.values(mud.poses).sort((a,b)=>b.targets.length-a.targets.length)[0],mudStyles=new Set();
const mudTexts={"mud-fen-abbr":"FEN!","mud-fen-cn":"粪！"};
for(let seed=1;seed<=60;seed++) {
  const html=view.renderBoardInk(new Map(),mudPose.targets.map(Number),mud.board,{monsterInk:mud.id,warningSeed:seed});
  assert.ok(!/NaN|Infinity/.test(html));
  const motif=html.match(/data-monster-motif="([^"]+)"/)[1];mudStyles.add(motif);
  if(motif==="mud-poop") {
    const poopCells=new Set([...html.matchAll(/data-poop-cell="(\d+)"/g)].map(match=>Number(match[1])));
    assert.equal(JSON.stringify([...poopCells].sort((a,b)=>a-b)),JSON.stringify(mudPose.targets.map(Number).sort((a,b)=>a-b)));
  } else {
    assert.match(html,new RegExp(`data-special-text="${mudTexts[motif]}"`));
    assert.match(html,/style="opacity:\.96"/);
    // The mud knight writes with the same pen strokes as the other bosses (吃/血/好吃),
    // not with the latin brush-font outlines used for the "shi" jokes.
    const glyphs=[...html.matchAll(/data-warning-glyph="([^"]+)"/g)].map(match=>match[1]);
    const expected=[...new Set([...mudTexts[motif]].map(char=>char==="！"?"!":char))].sort();
    assert.deepEqual([...new Set(glyphs)].sort(),expected,"mud lettering draws every letter with a pen glyph");
    assert.doesNotMatch(html,/data-brush-glyph|<text\b|font-family/);
  }
  assert.equal(normalized(html),normalized(view.renderBoardInk(new Map(),mudPose.targets.map(Number),mud.board,{monsterInk:mud.id,warningSeed:seed})),"mud writing stays stable while selecting or dragging");
}
assert.deepEqual([...mudStyles].sort(),["mud-fen-abbr","mud-fen-cn","mud-poop"]);
const eater=fixtures.find(item=>item.id==="M_Knighteater"),eaterPose=Object.values(eater.poses).sort((a,b)=>b.targets.length-a.targets.length)[0],eaterStyles=new Set(),shiChars=new Set();
for(let seed=1;seed<=60;seed++) {
  const html=view.renderBoardInk(new Map(),eaterPose.targets.map(Number),eater.board,{monsterInk:eater.id,warningSeed:seed});
  assert.ok(!/NaN|Infinity/.test(html));
  const motif=html.match(/data-monster-motif="([^"]+)"/)[1];eaterStyles.add(motif);
  if(motif==="dense-tasty")assert.match(html,/data-special-text="好吃"/);
  if(motif==="dense-shi") {
    assert.match(html,/data-special-text="shi"/);
    assert.match(html,/data-dense-compact="true"/,"the three shi letters are set tightly");
    assert.doesNotMatch(html,/data-warning-missing="true"/,"every shi letter has a hand-written glyph");
    const letters=[...new Set([...html.matchAll(/data-warning-glyph="([^"]+)"/g)].map(match=>match[1]))].sort();
    assert.deepEqual(letters,["h","i","s"],"the compact shi word is hand-written");
  }
  if(motif==="dense-shi-random") {
    assert.match(html,/data-special-text="读音shi"/);
    assert.doesNotMatch(html,/data-brush-glyph=/,"the random shi pool keeps the hand-written pen strokes");
    assert.doesNotMatch(html,/data-warning-missing="true"/,"the shi pool has hand-written glyphs for every character");
    assert.doesNotMatch(html,/data-warning-glyph="!"/,"the shi pool never falls back to an exclamation mark");
    for(const match of html.matchAll(/data-warning-glyph="([^"]+)"/g))shiChars.add(match[1]);
  }
  assert.match(html,/rotate\(/);
  if(motif!=="dense-tasty") {
    const angles=[...html.matchAll(/data-brush-glyph="[^"]+"[^>]*transform="translate\([^"]+\) rotate\((-?[\d.]+)\)/g)].map(match=>Math.abs(Number(match[1])));
    assert.ok(angles.every(angle=>angle<=10),"shi lettering stays in regular rows");
    assert.doesNotMatch(html,/font-family:KaiTi|<text\b/);
  }
}
assert.deepEqual([...eaterStyles].sort(),["dense-shi","dense-shi-random","dense-tasty"]);
for(const character of "食屎尸十石师士是世失时事市视试室诗")assert.ok(shiChars.has(character),`random shi pool includes ${character}`);
const toad=fixtures.find(item=>item.id==="M_Toadragon"), pose=toad.poses[90];
const toadPhrases=new Set();
for(let seed=1;seed<=20;seed++) {
  const toadInk=view.renderBoardInk(new Map(),pose.targets.map(Number),toad.board,{monsterInk:toad.id,attackFacing:90,warningSeed:seed});
  const captions=[...toadInk.matchAll(/data-special-text="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(new Set(captions).size,1,"only one toad caption is selected at a time");
  captions.forEach(text=>toadPhrases.add(text));
}
assert.deepEqual([...toadPhrases].sort(),["咕咕嘎嘎","蹦蹦跳跳"].sort());
for(const id of ["M_Knighteater","M_PalebloodWorms"]) {
  const item=fixtures.find(f=>f.id===id), pose=Object.values(item.poses).sort((a,b)=>b.targets.length-a.targets.length)[0];
  const html=view.renderBoardInk(new Map(),pose.targets.map(Number),item.board,{monsterInk:id,warningSeed:17});
  const boxes=[...html.matchAll(/data-warning-box="([^"]+)"/g)].map(match=>match[1].split(',').map(Number));
  const selected=new Set(pose.targets.map(Number)),at=(x,y)=>Math.floor(y/100)*item.board.cols+Math.floor(x/100)+1;
  assert.ok(boxes.some(([x,y,w,h])=>{
    const a=at(x+2,y+h/2),b=at(x+w-2,y+h/2),c=at(x+w/2,y+2),d=at(x+w/2,y+h-2);
    return (a!==b&&selected.has(a)&&selected.has(b))||(c!==d&&selected.has(c)&&selected.has(d));
  }),"dense writing can continue across adjacent selected cells");
}
const observed={M_PuppetKing:new Set(),M_KingLaidLow:new Set()};
for(const id of Object.keys(observed)) {
  const item=fixtures.find(f=>f.id===id), pose=Object.values(item.poses).sort((a,b)=>b.targets.length-a.targets.length)[0];
  for(let seed=1;seed<=40;seed++) {
    const html=view.renderBoardInk(new Map(),pose.targets.map(Number),item.board,{monsterInk:id,attackFacing:(pose.piece.facing-item.level.attackFacing+360)%360,warningSeed:seed,attackOrder:pose.targets.map(Number)});
    for(const match of html.matchAll(/data-warning-glyph="([^"]+)"/g)) observed[id].add(match[1]);
    if(id==="M_KingLaidLow") {
      const caption=html.match(/data-special-text="([^"]+)"/)[1];
      const letters=[...html.matchAll(/data-warning-glyph="([^"]+)"/g)].map(match=>match[1]);
      assert.equal(letters.slice(0,[...caption].length).join(''),caption,"laid-low captions follow physical reading order");
      const match=html.match(/data-special-text-cells="([^"]+)"/);
      assert.ok(match,"laid-low captions occupy a complete straight strip");
      const allocated=match[1].split(',').map(Number);
      assert.deepEqual(allocated,[...allocated].sort((a,b)=>a-b),"the strip starts at the top or left");
    }
  }
}
for(const glyph of "五指不行如来神掌冲击波") assert.ok(observed.M_PuppetKing.has(glyph),`puppet phrase pool contains ${glyph}`);
for(const glyph of "椅子能坐骇物牛逼开放世界FU王好想玩X") assert.ok(observed.M_KingLaidLow.has(glyph),`laid-low phrase pool contains ${glyph}`);
for(let seed=1;seed<=30;seed++) {
  const item=fixtures.find(f=>f.id==="M_PuppetKing");
  const opts={monsterInk:item.id,attackFacing:0,warningSeed:seed};
  const full=view.renderBoardInk(new Map(),[3,5,10,12,16],item.board,opts).match(/data-special-text="([^"]+)"/)[1];
  for(const cells of [[3,5,10,12],[3,5,10],[3,5]]) {
    const shortened=view.renderBoardInk(new Map(),cells,item.board,opts).match(/data-special-text="([^"]+)"/)[1];
    assert.equal(shortened.replace(/!/g,''),full.replace(/!/g,''),"short puppet ranges retain every text character");
    assert.ok([...shortened].length<=cells.length||!shortened.includes('!'),"punctuation is removed before compressing words");
    assert.ok(!shortened.startsWith('!'),"the leading exclamation mark is removed first");
  }
}
const unknown=view.renderBoardInk(new Map(),[1,2],data.boards.vassal,{monsterInk:"unknown"});
assert.match(unknown,/data-warning-style="mixed"/);
if(process.env.KF_INK_FIXTURES) fs.writeFileSync(process.env.KF_INK_FIXTURES,JSON.stringify(fixtures),"utf8");
console.log("monster ink: ten monsters, four facings, rotated mud variants, random shi writing, phrase/glyph pools, contours and main/display consistency passed");
