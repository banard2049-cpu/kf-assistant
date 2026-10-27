// Local integration fixture. All browser profiles and screenshots stay in D:/.../tmp.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const vm = require("node:vm");
const { chromium } = require("playwright");
const publicRoot = path.resolve(__dirname,"../public");
const scratch = path.resolve(__dirname,"../../tmp/withergraal-browser");
fs.mkdirSync(scratch,{recursive:true});
process.env.TEMP=scratch;process.env.TMP=scratch;process.env.TMPDIR=scratch;
const c={window:{}};vm.createContext(c);
for(const file of ["withergraal-data.js","data.js"])vm.runInContext(fs.readFileSync(path.join(publicRoot,"modules/rogue",file),"utf8"),c);
const rules=c.window.KF_ROGUE_RULES;
const clone=x=>JSON.parse(JSON.stringify(x));
const approvedMap=require("./rogue-map-approved-2026-10-27.json");
const previousMap=require("./rogue-map-before-approved-2026-10-27.json");
const mapRows=nodes=>clone(nodes).map(node=>({id:node.id,level:node.level,reward:node.reward,resurrection:node.resurrection,devotion:node.devotion??0,withered:Boolean(node.withered),links:[...node.links].sort()})).sort((a,b)=>a.id.localeCompare(b.id));
const campaignId="withergraal-browser";
let revision=1;
let state={schemaVersion:2,kingdom:"stone",party:[],squires:[],modules:{},presentation:{scene:"rogue",settings:{conflictRotation:0,conflictBoardVisible:false}}};
function bundle(run){return {...clone(run),schemaVersion:2,campaignId,activeSlotId:"run-a",slots:[{id:"run-a",title:"测试肉鸽",state:clone(run)}]};}
function baseRun(){const r=rules.freshState();r.status="active";r.sharedRevives=87;r.graalSighs=3;r.roster=[{id:"rogue-1",knightId:"kara",name:"Kara",alive:true,gold:47,rewards:[],notes:"保留备注",attributes:{might:2}},{id:"rogue-2",knightId:"stoneface",name:"Stoneface",alive:true,gold:12,rewards:[],attributes:{}}];r.nodes.find(n=>n.id==="sunken-01").cleared=true;return r;}
state.modules.roguePath=bundle(baseRun());
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".jpg":"image/jpeg",".png":"image/png",".webp":"image/webp",".json":"application/json"};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,"http://localhost");
  if(url.pathname==="/api.php"){
    let body="";req.on("data",x=>body+=x);req.on("end",()=>{
      const route=url.searchParams.get("route");let value;
      if(route==="auth/me")value={user:{id:"browser-user"}};
      else if(route.startsWith("campaigns/"))value={campaign:{id:campaignId,name:"Withergraal 测试",state,revision}};
      else if(route==="sheets")value={sheets:[]};
      else if(route==="user-settings")value={settings:{}};
      else if(route==="display-state")value={campaign:{id:campaignId,name:"Withergraal 测试",revision},modules:state.modules,presentation:state.presentation};
      else if(route==="campaign-sync"){
        const data=JSON.parse(body||"{}");
        for(const op of data.operations||[]){const keys=op.path.split(".");let target=state;for(const key of keys.slice(0,-1))target=target[key]||=( {} );target[keys.at(-1)]=op.value;revision++;}
        value={state,revision,conflicts:[]};
      }else value={};
      res.writeHead(200,{"Content-Type":"application/json","Cache-Control":"no-store"});res.end(JSON.stringify(value));
    });return;
  }
  let relative=decodeURIComponent(url.pathname).replace(/^\/+/,"");if(!relative||relative.endsWith("/"))relative+="index.html";
  const file=path.resolve(publicRoot,relative);
  if(!file.startsWith(publicRoot+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"Content-Type":mime[path.extname(file)]||"application/octet-stream"});fs.createReadStream(file).pipe(res);
});
(async()=>{
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,executablePath:process.env.KF_TEST_BROWSER||"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",env:{...process.env,TEMP:scratch,TMP:scratch,TMPDIR:scratch},args:[`--disk-cache-dir=${path.join(scratch,"browser-cache")}`]});
  const errors=[];
  let context;
  const open=async()=>{if(context)await context.close();context=await browser.newContext({viewport:{width:1500,height:1000}});await context.addInitScript(id=>localStorage.setItem("kfActiveCampaign",id),campaignId);const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));return page;};
  const flush=page=>page.evaluate(()=>window.KF_MODULE_BRIDGE.flush());
  try{
    const advancedEntry=clone(state.modules.roguePath);
    const basic=rules.freshState();basic.status="active";basic.roster=baseRun().roster;
    // An existing revision-one run can carry its old graph in both runtime
    // nodes and mapConfig. The newly approved full map must replace both once.
    assert.equal(rules.applyMapConfig(basic,previousMap),true);
    basic.basicLinksRevision=1;delete basic.advancedMapRevision;
    const basicNode=rules.getStageNodes(basic).find(n=>n.level===3&&n.reward==="technique");
    basic.pendingBattle={nodeId:basicNode.id,monsterId:"M_Toadragon",monster:"Toadragon of the Great Marsh",level:1,roll:10};
    state.modules.roguePath=bundle(basic);revision++;
    let page=await open();await page.goto(base+"/modules/rogue/");
    assert.equal(await page.locator('a[href="editor.html"]').isVisible(),false,"the maintenance editor entry stays hidden in the release UI");
    await page.locator("#resolveVictory").click();
    assert.match(await page.locator("#rewardChoiceHint").textContent(),/每名骑士各从当前或更低等级/);
    const lowerBasic=basic.roster.map(member=>rules.basicRewardOptions(basic,basicNode,member).find(option=>option.level===1));
    for(let index=0;index<basic.roster.length;index++)await page.locator(`[data-reward-choice="${basic.roster[index].id}"]`).selectOption(lowerBasic[index].id);
    await flush(page);await page.reload();
    await page.locator("[data-reward-choice]").first().waitFor();
    for(let index=0;index<basic.roster.length;index++)assert.equal(await page.locator(`[data-reward-choice="${basic.roster[index].id}"]`).inputValue(),lowerBasic[index].id,"each knight's lower-level choice survives reload");
    await page.locator("#rewardChoiceModal").screenshot({path:path.join(scratch,"base-reward-lower-level.png")});
    await page.locator("#confirmRewardChoices").click();await page.locator("#rewardChoiceModal").waitFor({state:"hidden"});await flush(page);
    const basicSettled=clone(state.modules.roguePath.slots[0].state);
    assert.equal(basicSettled.basicLinksRevision,rules.BASIC_LINKS_REVISION,"the browser persists the approved basic map revision");
    assert.equal(basicSettled.advancedMapRevision,1,"the browser persists the approved advanced map revision");
    assert.deepEqual(mapRows(basicSettled.nodes),mapRows(approvedMap.nodes),"all 190 approved node fields and links survive refresh and sync");
    assert.deepEqual(mapRows(basicSettled.mapConfig.nodes),mapRows(approvedMap.nodes),"the stale saved template cannot restore superseded inferred links");
    for(let index=0;index<basic.roster.length;index++){
      assert.equal(basicSettled.roster[index].rewards.length,1);
      assert.equal(basicSettled.roster[index].rewards[0].level,1);
      assert.equal(basicSettled.roster[index].rewards[0].nodeLevel,3);
      assert.equal(basicSettled.claimedRewards[lowerBasic[index].id],true);
    }
    const nextBasic=rules.getStageNodes(basicSettled).find(n=>n.level===3&&n.reward==="technique"&&n.id!==basicNode.id);
    basicSettled.pendingBattle={nodeId:nextBasic.id,monsterId:"M_Toadragon",monster:"Toadragon of the Great Marsh",level:1,roll:10};
    state.modules.roguePath=bundle(basicSettled);revision++;
    page=await open();await page.goto(base+"/modules/rogue/");await page.locator("#resolveVictory").click();
    for(let index=0;index<basic.roster.length;index++)assert.ok(!(await page.locator(`[data-reward-choice="${basic.roster[index].id}"] option`).evaluateAll(options=>options.map(option=>option.value))).includes(lowerBasic[index].id),"claimed lower-level rewards are removed from the next victory's choices");
    state.modules.roguePath=advancedEntry;revision++;
    page=await open();await page.goto(base+"/modules/rogue/");
    await page.locator("#continueWithergraal").waitFor({state:"visible"});
    assert.equal(await page.locator("#runStatus").textContent(),"战役胜利","an existing save with one cleared V endpoint wins without clearing every branch");
    await page.locator("#continueWithergraal").click();
    await page.waitForFunction(()=>document.querySelector("#mapTitle").textContent.includes("进阶肉鸽"));
    const colouredMap=await page.locator("#routeMapImage").evaluate(async image=>{
      await image.decode();const canvas=document.createElement("canvas");canvas.width=100;canvas.height=70;
      const ctx=canvas.getContext("2d");ctx.drawImage(image,0,0,100,70);
      const pixels=ctx.getImageData(0,0,100,70).data;let coloured=0;
      for(let index=0;index<pixels.length;index+=4)if(Math.max(pixels[index],pixels[index+1],pixels[index+2])-Math.min(pixels[index],pixels[index+1],pixels[index+2])>15)coloured++;
      return coloured;
    });
    assert.ok(colouredMap>500,"the displayed Withergraal map is coloured rather than the monochrome print sheet");
    assert.equal(await page.locator("#reviveCount").textContent(),"20");
    assert.equal(await page.locator("#sighCount").textContent(),"3");
    assert.equal(await page.locator("[data-node]").count(),86);
    await flush(page);await page.reload();
    await page.waitForFunction(()=>document.querySelector("#mapTitle").textContent.includes("进阶肉鸽"));
    assert.equal(await page.locator("#continueWithergraal").isVisible(),false);
    await page.locator("#mapStageSelect").selectOption("rosegraal");
    assert.equal(await page.locator("[data-node]").count(),102);
    await page.locator("#mapStageSelect").selectOption("withergraal");
    await page.locator('[data-sheet-member="rogue-1"]').click();
    assert.match(await page.locator("#sheetSubtitle").textContent(),/终盘游戏/);
    assert.match(await page.locator(".sheet-growth").textContent(),/战意 Passion/);
    assert.match(await page.locator(".sheet-growth").textContent(),/烈度上限 Heat Limit/);
    assert.match(await page.locator(".sheet-growth").textContent(),/灾祸耐限 Bane Limit/);
    assert.match(await page.locator("#sheetBody").textContent(),/保留备注/);
    await page.locator("#closeSheet").click();
    await page.screenshot({path:path.join(scratch,"route.png"),fullPage:true});
    const advanced=clone(state.modules.roguePath.slots[0].state);
    assert.equal(advanced.stage,"withergraal");
    assert.equal(rules.getStageNodes(advanced,"rosegraal").filter(n=>n.reward!=="start"&&n.cleared).length,1,"continuation retains the single completed endpoint and untouched branches");
    // Seed a real printed mastery node as a pending win, then test the actual
    // resolution and saved reward form rather than synthesizing its outcome.
    const node=rules.getStageNodes(advanced).find(n=>n.reward==="mastery"&&n.level===8&&n.devotion>0);
    advanced.status="active";advanced.sharedRevives=0;advanced.pendingBattle={nodeId:node.id,monsterId:"M_YoungDevour",monster:"Young Devour Dragon",level:5,roll:1};
    advanced.nodes.forEach(n=>{if(n.stage==="withergraal")n.cleared=n.reward==="start";});
    state.modules.roguePath=bundle(advanced);revision++;
    page=await open();await page.goto(base+"/modules/rogue/");
    await page.locator("#resolveVictory").click();
    await page.locator("[data-advanced-name]").fill("Browser Mastery");
    await page.locator("[data-advanced-member]").selectOption("rogue-2");
    await flush(page);await page.reload();
    await page.locator("[data-advanced-name]").waitFor({state:"visible"});
    assert.equal(await page.locator("[data-advanced-name]").inputValue(),"Browser Mastery");
    assert.equal(await page.locator("[data-advanced-member]").inputValue(),"rogue-2");
    assert.equal(await page.locator("#reviveCount").textContent(),"0","withered wins do not create minimum revives");
    await page.locator("#confirmRewardChoices").click();
    await page.locator("#rewardChoiceModal").waitFor({state:"hidden"});await flush(page);
    const settled=state.modules.roguePath.slots[0].state;
    assert.equal(settled.roster[0].devotion,node.devotion);
    assert.equal(settled.roster[1].devotion,node.devotion);
    assert.equal(settled.roster[1].rewards.at(-1).text,"精通：Browser Mastery");
    assert.equal(settled.roster[0].rewards.length,0);
    assert.equal(Object.keys(settled.advancedClaims).length,1);
    assert.equal(settled.status,"active","living knights can continue even with no shared revives");
    await page.reload();await page.locator("#mapTitle").waitFor();await flush(page);
    assert.equal(Object.keys(state.modules.roguePath.slots[0].state.advancedClaims).length,1);
    // Higher-level nodes can select an unclaimed lower-level reward, with
    // its translated symbol and source table retained throughout save/reload.
    const statRun=clone(settled);
    const statNode=rules.getStageNodes(statRun).find(n=>n.level===9&&n.reward==="stat");
    statRun.pendingBattle={nodeId:statNode.id,monsterId:"M_Toadragon",monster:"Toadragon of the Great Marsh",level:6,roll:10};
    state.modules.roguePath=bundle(statRun);revision++;
    page=await open();await page.goto(base+"/modules/rogue/");
    await page.locator("#resolveVictory").click();
    await page.locator('[name="advanced-reward"][value="wither-8-stat-2"]').check();
    assert.match(await page.locator("#rewardChoiceBody").textContent(),/8 级 · 烈度上限 Heat Limit \+2/);
    assert.match(await page.locator("#rewardChoiceHint").textContent(),/当前或更低等级/);
    await page.locator("[data-advanced-member]").selectOption("rogue-2");await flush(page);
    await page.reload();await page.locator('[name="advanced-reward"][value="wither-8-stat-2"]').waitFor();
    assert.equal(await page.locator('[name="advanced-reward"][value="wither-8-stat-2"]').isChecked(),true);
    assert.equal(await page.locator("[data-advanced-member]").inputValue(),"rogue-2");
    for(const href of await page.locator('#rewardChoiceHint a').evaluateAll(links=>links.map(link=>link.href))){
      const response=await page.request.get(href);assert.equal(response.status(),200);assert.match(response.headers()["content-type"],/^image\/png/);
    }
    await page.locator("#rewardChoiceModal").screenshot({path:path.join(scratch,"reward-symbols.png")});
    await page.locator("#confirmRewardChoices").click();await page.locator("#rewardChoiceModal").waitFor({state:"hidden"});await flush(page);
    const statSettled=clone(state.modules.roguePath.slots[0].state);
    assert.equal(statSettled.roster[1].growth.symbolHExclaim,2);
    assert.equal(statSettled.roster[1].rewards.at(-1).level,8);
    assert.equal(statSettled.roster[1].rewards.at(-1).nodeLevel,9);
    const moneyNode=rules.getStageNodes(statSettled).find(n=>n.level===7&&n.reward==="princess");
    statSettled.pendingBattle={nodeId:moneyNode.id,monsterId:"M_Toadragon",monster:"Toadragon of the Great Marsh",level:4,roll:10};
    state.modules.roguePath=bundle(statSettled);revision++;
    page=await open();await page.goto(base+"/modules/rogue/");await page.locator("#resolveVictory").click();
    await page.locator('[name="advanced-reward"][value="wither-7-princess-1"]').check();
    assert.equal(await page.locator("[data-advanced-member]").count(),0,"unlocking Slawia is a team reward");
    await page.locator("[data-advanced-alternative]").selectOption("1");
    await page.locator("[data-advanced-member]").selectOption("rogue-2");await flush(page);await page.reload();
    await page.locator("[data-advanced-alternative]").waitFor();
    assert.equal(await page.locator("[data-advanced-alternative]").inputValue(),"1");
    assert.equal(await page.locator("[data-advanced-member]").inputValue(),"rogue-2");
    await page.locator("[data-advanced-alternative]").selectOption("0");
    assert.equal(await page.locator("[data-advanced-member]").count(),0,"switching back to Slawia removes the personal money recipient");
    await page.locator("[data-advanced-alternative]").selectOption("1");
    await page.locator("#rewardChoiceModal").screenshot({path:path.join(scratch,"reward-money.png")});
    await page.locator("#confirmRewardChoices").click();await page.locator("#rewardChoiceModal").waitFor({state:"hidden"});await flush(page);
    const moneySettled=state.modules.roguePath.slots[0].state;
    assert.equal(moneySettled.roster[0].gold,47);
    assert.equal(moneySettled.roster[1].gold,42);
    assert.equal(moneySettled.advancedClaims["wither-7-princess-1"].alternative,1);
    assert.deepEqual(moneySettled.unlockedPrincesses,[]);
    // A true high-level handoff must arrive at AI/BP without being clamped.
    await page.evaluate(id=>localStorage.setItem("kfRogueHandoff",JSON.stringify({id:"postgame-request",campaignId:id,roguePath:true,slotId:"run-a",stage:"withergraal",postgame:true,nodeId:"postgame-node",monsterId:"M_Toadragon",monster:"Toadragon of the Great Marsh",level:9,createdAt:Date.now(),rogueRoster:[{id:"rogue-1",knightId:"kara",type:"knight",name:"Kara"}]})),campaignId);
    await page.goto(base+"/modules/aibp/");
    await page.locator('[data-level]').waitFor({state:"attached"});
    await page.waitForFunction(()=>document.querySelector('[data-level]')?.value==="9");
    assert.equal(await page.locator(".postgame-reference-card").count(),8,"seven cumulative trait groups plus current stat row");
    await page.locator('[data-preview="postgame-toadragon-9-traits"]').click();
    await page.locator(".postgame-preview-modal").waitFor({state:"visible"});
    const image=page.locator(".postgame-preview-modal .crop-card");
    assert.ok(await image.count());
    await page.locator(".postgame-preview-modal").screenshot({path:path.join(scratch,"trait-preview.png")});
    await page.locator('button[data-close-modal]').click();await flush(page);
    await page.screenshot({path:path.join(scratch,"boss.png"),fullPage:true});
    const stacked=await page.locator(".postgame-reference-card").evaluateAll(elements=>{
      const rects=elements.map(element=>element.getBoundingClientRect());
      return rects.some((a,index)=>rects.some((b,other)=>other!==index&&Math.abs(a.left-b.left)<2&&b.top>=a.bottom));
    });
    assert.equal(stacked,true,"short level traits stack vertically in compact columns");
    await page.locator(".postgame-reference-gallery").screenshot({path:path.join(scratch,"traits.png")});
    await page.locator(".postgame-reference-gallery").evaluate(element=>element.scrollIntoView({block:"start"}));
    await page.evaluate(()=>scrollBy(0,-80));
    await page.screenshot({path:path.join(scratch,"traits-viewport.png")});
    state.presentation.scene="conflict";
    const display=await context.newPage();display.on("pageerror",e=>errors.push(e.message));
    await display.goto(base+"/modules/display/?campaignId="+campaignId);
    await display.locator("[data-postgame-card]").first().waitFor();
    assert.equal(await display.locator("[data-postgame-card]").count(),8);
    assert.equal(await display.locator(".display-mob-slot [data-postgame-card]").count(),8,"postgame traits use empty mob-track slots first");
    assert.equal(await display.locator(".postgame-reference-cards [data-postgame-card]").count(),0,"packed traits are not repeated below the track");
    assert.equal(await display.locator("[data-postgame-card]").evaluateAll(elements=>{
      const rects=elements.map(element=>element.getBoundingClientRect());
      return rects.some((a,index)=>rects.some((b,other)=>other!==index&&Math.abs(a.left-b.left)<2&&b.top>=a.bottom));
    }),true,"second-screen traits also stack vertically");
    assert.match(await display.locator(".postgame-replacement-notes").textContent(),/Dirge/);
    await display.screenshot({path:path.join(scratch,"display.png"),fullPage:true});

    // A selected appendix image behaves like a saved, movable panel token.
    const placedId="postgame-toadragon-9-traits";
    await page.locator(`.postgame-reference-card [data-sheet-trait-toggle="${placedId}"]`).click();
    const placed=page.locator(`[data-sheet-trait="${placedId}"]`);
    await placed.waitFor({state:"visible"});
    assert.equal(await placed.locator("img").getAttribute("src"),"/assets/aibp/postgame/toadragon-9-traits.png");
    await placed.locator(`[data-sheet-trait-preview="${placedId}"]`).click();
    await page.locator(".postgame-preview-modal").waitFor({state:"visible"});
    await page.locator('button[data-close-modal]').click();
    await placed.locator(`[data-sheet-trait-resize="${placedId}"][data-delta="4"]`).click();
    assert.equal(await placed.evaluate(element=>parseFloat(element.style.width)),32);
    await placed.scrollIntoViewIfNeeded();
    const beforeDrag=await placed.evaluate(element=>({x:parseFloat(element.style.left),y:parseFloat(element.style.top)}));
    const dragImage=await placed.locator("img").boundingBox();
    const stage=await page.locator("[data-sheet-stage]").boundingBox();
    await page.mouse.move(dragImage.x+dragImage.width*.4,dragImage.y+dragImage.height*.7);
    await page.mouse.down();
    await page.mouse.move(dragImage.x+dragImage.width*.4+stage.width*.1,dragImage.y+dragImage.height*.7+stage.height*.07,{steps:8});
    await page.mouse.up();
    const moved=await placed.evaluate(element=>({x:parseFloat(element.style.left),y:parseFloat(element.style.top),width:parseFloat(element.style.width)}));
    assert.ok(moved.x>beforeDrag.x+5,"dragging changes the saved panel position");
    assert.ok(moved.y>beforeDrag.y+3,"vertical dragging follows the source panel");
    await page.waitForFunction(({id,x,y})=>{
      const trait=JSON.parse(localStorage.getItem("kf-aibp-assistant-v1")||"{}").battle?.sheetTraits?.find(item=>item.cardId===id);
      return trait?.x===x&&trait?.y===y&&trait?.width===32;
    },{id:placedId,...moved});
    await flush(page);
    assert.deepEqual(state.modules.aibp.battle.sheetTraits,[{cardId:placedId,...moved}],
      "the campaign sync carries position and width");
    await page.reload();await placed.waitFor({state:"visible"});
    assert.deepEqual(await placed.evaluate(element=>({x:parseFloat(element.style.left),y:parseFloat(element.style.top),width:parseFloat(element.style.width)})),moved,
      "refresh restores the original image size and placement");
    await display.waitForFunction(id=>document.querySelector(`.boss-sheet-trait[data-postgame-card="${id}"]`),placedId);
    const mirrored=display.locator(`.boss-sheet-trait[data-postgame-card="${placedId}"]`);
    assert.deepEqual(await mirrored.evaluate(element=>({x:parseFloat(element.style.left),y:parseFloat(element.style.top),width:parseFloat(element.style.width)})),moved,
      "the second screen uses the same panel-relative coordinates and size");
    assert.equal(await display.locator(`[data-postgame-card="${placedId}"]`).count(),1,
      "a placed image is not duplicated in track slots or the reference gallery");
    assert.equal(await display.locator("[data-postgame-card]").count(),8,
      "moving an image onto the panel preserves every unlocked reference");
    await page.locator("[data-sheet-stage]").screenshot({path:path.join(scratch,"panel-trait.png")});
    await display.locator(".boss-sheet-stage").screenshot({path:path.join(scratch,"display-panel-trait.png")});
    await placed.locator(`[data-sheet-trait-remove="${placedId}"]`).click();
    await placed.waitFor({state:"detached"});
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem("kf-aibp-assistant-v1")||"{}").battle?.sheetTraits?.length===0);
    await flush(page);
    await mirrored.waitFor({state:"detached"});
    assert.equal(await display.locator(`[data-postgame-card="${placedId}"]`).count(),1,
      "removing a panel image restores its track/reference placement");
    assert.equal(await display.locator(".display-mob-slot [data-postgame-card]").count(),8);

    // The current level's stat row must support the same placement controls.
    const statId="postgame-toadragon-9-level";
    await page.locator(`.postgame-reference-card [data-sheet-trait-toggle="${statId}"]`).click();
    const stat=page.locator(`[data-sheet-trait="${statId}"]`);
    await stat.waitFor({state:"visible"});
    assert.equal(await stat.locator("img").getAttribute("src"),"/assets/aibp/postgame/toadragon-9-level.png");
    await stat.locator('[data-sheet-trait-resize][data-delta="4"]').click();
    await stat.scrollIntoViewIfNeeded();
    const statImage=await stat.locator("img").boundingBox();
    const statStage=await page.locator("[data-sheet-stage]").boundingBox();
    await page.mouse.move(statImage.x+statImage.width*.4,statImage.y+statImage.height*.7);
    await page.mouse.down();
    await page.mouse.move(statImage.x+statImage.width*.4+statStage.width*.12,statImage.y+statImage.height*.7+statStage.height*.06,{steps:8});
    await page.mouse.up();
    const statPosition=await stat.evaluate(element=>({x:parseFloat(element.style.left),y:parseFloat(element.style.top),width:parseFloat(element.style.width)}));
    assert.ok(statPosition.x>25&&statPosition.y>20,"the level stat image can be dragged");
    assert.equal(statPosition.width,32);
    await page.waitForFunction(({id,x,y,width})=>{
      const placement=JSON.parse(localStorage.getItem("kf-aibp-assistant-v1")||"{}").battle?.sheetTraits?.find(item=>item.cardId===id);
      return placement?.x===x&&placement?.y===y&&placement?.width===width;
    },{id:statId,...statPosition});
    await flush(page);await page.reload();await stat.waitFor({state:"visible"});
    assert.deepEqual(await stat.evaluate(element=>({x:parseFloat(element.style.left),y:parseFloat(element.style.top),width:parseFloat(element.style.width)})),statPosition,
      "refresh preserves the level stat image's placement and size");
    const mirroredStat=display.locator(`.boss-sheet-trait[data-postgame-card="${statId}"]`);
    await mirroredStat.waitFor({state:"visible"});
    assert.deepEqual(await mirroredStat.evaluate(element=>({x:parseFloat(element.style.left),y:parseFloat(element.style.top),width:parseFloat(element.style.width)})),statPosition);
    assert.equal(await display.locator(`[data-postgame-card="${statId}"]`).count(),1,"placed stats do not duplicate in the second-screen track");
    assert.equal(await stat.evaluate(element=>getComputedStyle(element).backgroundColor),"rgba(0, 0, 0, 0)","the level overlay container is transparent");
    assert.notEqual(await stat.locator("img").evaluate(element=>getComputedStyle(element).clipPath),"none");
    assert.equal(await mirroredStat.locator("img").evaluate(element=>getComputedStyle(element).backgroundColor),"rgba(0, 0, 0, 0)");
    assert.notEqual(await mirroredStat.locator("img").evaluate(element=>getComputedStyle(element).clipPath),"none");
    await stat.scrollIntoViewIfNeeded();await page.mouse.move(0,0);
    const maskedRect=await stat.locator("img").boundingBox();
    const paperSample={x:Math.floor(maskedRect.x+maskedRect.width*.9),y:Math.floor(maskedRect.y+maskedRect.height*.95),width:2,height:2};
    const visiblePaper=await page.screenshot({clip:paperSample});
    await stat.evaluate(element=>element.style.visibility="hidden");
    const underlyingPanel=await page.screenshot({clip:paperSample});
    await stat.evaluate(element=>element.style.visibility="");
    assert.ok(visiblePaper.equals(underlyingPanel),"the old white paper margin reveals the unchanged Boss panel beneath it");
    await page.locator("[data-sheet-stage]").screenshot({path:path.join(scratch,"panel-level.png")});
    await display.locator(".boss-sheet-stage").screenshot({path:path.join(scratch,"display-panel-level.png")});
    if(!await page.locator("[data-deck-config]").evaluate(element=>element.open))await page.locator("[data-deck-config] summary").click();
    await page.locator('[data-level]').fill("8");
    await stat.waitFor({state:"detached"});
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem("kf-aibp-assistant-v1")||"{}").battle?.level===8);
    await flush(page);await mirroredStat.waitFor({state:"detached"});
    await display.waitForFunction(()=>document.querySelector('[data-postgame-card="postgame-toadragon-8-level"]'));
    assert.equal(await display.locator(`[data-postgame-card="${statId}"]`).count(),0,"changing level removes the old stat image");
    // Level changes re-render and close the deck configuration disclosure.
    if(!await page.locator("[data-deck-config]").evaluate(element=>element.open))await page.locator("[data-deck-config] summary").click();
    await page.locator('[data-level]').fill("9");
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem("kf-aibp-assistant-v1")||"{}").battle?.level===9);
    await flush(page);
    await display.waitForFunction(()=>document.querySelector('[data-postgame-card="postgame-toadragon-9-level"]'));
    assert.equal(await display.locator(".display-mob-slot [data-postgame-card]").count(),8,"the current stat row returns to the reference track");

    const displayBattle=state.modules.aibp.battle;
    const savedTrack=clone(displayBattle.bpTrack);
    const bpId=await display.evaluate(()=>window.KF_MONSTER_DATA.monsters.find(monster=>monster.id==="M_Toadragon").cards.find(card=>/^BP[123]$/.test(card.kind)).id);
    displayBattle.bpTrack=Array.from({length:10},()=>({id:bpId,occupied:true,revealed:false,side:"face",markerTokens:{}}));
    await display.waitForFunction(()=>document.querySelectorAll(".display-mob-slot.occupied").length===10);
    assert.equal(await display.locator(".display-mob-slot.occupied [data-postgame-card]").count(),0,"actual BP slots are never replaced by reference traits");
    assert.equal(await display.locator("[data-postgame-card]").count(),8,"traits remain available when all ten BP slots are occupied");
    state.presentation.settings.conflictBoardVisible=true;revision++;
    await display.waitForFunction(()=>document.querySelector(".conflict-scene:not(.board-hidden)"));
    assert.equal(await display.locator("[data-postgame-card]").count(),8,"showing the board preserves every unlocked trait");
    assert.equal(await display.locator(".display-track-terrain, .conflict-side-primary .conflict-terrain-card").count(),2,"terrain remains available when traits use track slots");
    assert.ok(await display.locator('[aria-label="轨道外地形参考"] .conflict-terrain-card').count(),"terrain that does not fit the track is shown below it");
    await display.screenshot({path:path.join(scratch,"display-board.png"),fullPage:true});
    displayBattle.bpTrack=savedTrack;
    // Mobile sheet and reward controls must fit the viewport.
    await page.goto(base+"/modules/rogue/");await page.setViewportSize({width:390,height:844});
    await page.locator('[data-sheet-member="rogue-1"]').click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:path.join(scratch,"mobile.png")});
    // A victory cannot send an extinct party into another clash. The final
    // reward is still claimable before the exhausted run becomes lost.
    const exhausted=clone(settled);
    const exhaustedNode=rules.getStageNodes(exhausted).find(n=>n.level===12&&n.reward==="legendary"&&n.resurrection===0);
    exhausted.sharedRevives=0;
    exhausted.pendingBattle={nodeId:exhaustedNode.id,monsterId:"M_Toadragon",monster:"Toadragon of the Great Marsh",level:9,roll:10};
    state.modules.roguePath=bundle(exhausted);revision++;
    page=await open();await page.goto(base+"/modules/rogue/");
    await page.locator('#casualtySelect input[type="checkbox"]').first().waitFor({state:"visible"});
    assert.equal(await page.locator('#casualtySelect input[type="checkbox"]').count(),2);
    for(const casualty of await page.locator('#casualtySelect input[type="checkbox"]').all())await casualty.check();
    await page.locator("#resolveVictory").click();
    await page.locator("#rewardChoiceModal").waitFor({state:"visible"});
    await page.locator("#confirmRewardChoices").click();
    await page.locator("#rewardChoiceModal").waitFor({state:"hidden"});await flush(page);
    assert.equal(await page.locator("#runStatus").textContent(),"战役失败","zero living knights and zero revives ends an exhausted advanced run after its reward");
    assert.equal(await page.locator(".rogue-node.available").count(),0,"an exhausted party cannot start an empty-roster clash");
    await page.reload();await page.locator("#runStatus").waitFor();
    assert.equal(await page.locator("#runStatus").textContent(),"战役失败","exhaustion survives refresh");
    const completed=clone(exhausted);
    rules.getStageNodes(completed).forEach(n=>n.cleared=n.id!==exhaustedNode.id);
    state.modules.roguePath=bundle(completed);revision++;
    page=await open();await page.goto(base+"/modules/rogue/");
    await page.locator('#casualtySelect input[type="checkbox"]').first().waitFor({state:"visible"});
    for(const casualty of await page.locator('#casualtySelect input[type="checkbox"]').all())await casualty.check();
    await page.locator("#resolveVictory").click();
    await page.locator("#rewardChoiceModal").waitFor({state:"visible"});
    await page.locator("#confirmRewardChoices").click();
    await page.locator("#rewardChoiceModal").waitFor({state:"hidden"});await flush(page);
    assert.equal(await page.locator("#runStatus").textContent(),"战役胜利","clearing the final node retains the existing campaign victory condition");
    assert.deepEqual(errors,[]);
    console.log(`Withergraal browser passed: continuation, preserved party, reward reload, devotion, high-level handoff, traits, second screen and mobile. Screenshots: ${scratch}`);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
