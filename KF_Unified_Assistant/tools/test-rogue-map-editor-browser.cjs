// Local editor integration fixture. Browser state, downloads and screenshots stay on D:.
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const http=require("node:http");
const vm=require("node:vm");
const {chromium}=require("playwright");
const publicRoot=path.resolve(__dirname,"../public");
const scratch=path.resolve(__dirname,"../../tmp/rogue-map-editor");
fs.mkdirSync(scratch,{recursive:true});
process.env.TEMP=scratch;process.env.TMP=scratch;process.env.TMPDIR=scratch;
const context={window:{}};vm.createContext(context);
for(const file of ["withergraal-data.js","data.js"])vm.runInContext(fs.readFileSync(path.join(publicRoot,"modules/rogue",file),"utf8"),context);
const rules=context.window.KF_ROGUE_RULES;
const clone=value=>JSON.parse(JSON.stringify(value));
const approvedMap=require("./rogue-map-approved-2026-10-27.json");
const previousMap=require("./rogue-map-before-approved-2026-10-27.json");
const mapRows=nodes=>clone(nodes).map(node=>({id:node.id,level:node.level,reward:node.reward,resurrection:node.resurrection,devotion:node.devotion??0,withered:Boolean(node.withered),links:[...node.links].sort()})).sort((a,b)=>a.id.localeCompare(b.id));
const edgeCount=(nodes,prefix)=>new Set(nodes.filter(node=>node.id.startsWith("wither-")===prefix).flatMap(node=>node.links.map(target=>[node.id,target].sort().join("/")))).size;
const campaignId="rogue-map-editor-browser";
function run(id){
  const value=rules.freshState();value.stage="withergraal";value.postgame=true;value.status="active";
  value.partyName=`存档 ${id}`;value.sharedRevives=id==="A"?17:31;value.graalSighs=id==="A"?3:6;
  value.nodes.find(node=>node.id==="wither-S").cleared=true;
  value.nodes.find(node=>node.id==="sunken-30").cleared=true;
  value.roster=[{id:`knight-${id}`,knightId:"kara",name:`Kara ${id}`,player:`玩家 ${id}`,alive:true,gold:id==="A"?47:89,rewards:[{key:`saved-${id}`,text:"保留奖励"}],notes:"保留备注",attributes:{might:2},devotion:5}];
  value.claimedRewards={[`saved-${id}`]:true};value.history=[{text:`保留记录 ${id}`}];
  assert.equal(rules.applyMapConfig(value,previousMap),true);
  value.basicLinksRevision=1;delete value.advancedMapRevision;
  return value;
}
const initialA=run("A"),initialB=run("B");
let revision=1;
let state={schemaVersion:2,kingdom:"stone",party:[],squires:[],modules:{roguePath:{...clone(initialA),schemaVersion:2,campaignId,activeSlotId:"run-a",slots:[{id:"run-a",title:"存档 A",state:clone(initialA)},{id:"run-b",title:"存档 B",state:clone(initialB)}]}},presentation:{scene:"rogue",settings:{conflictRotation:0,conflictBoardVisible:false}}};
const slot=id=>state.modules.roguePath.slots.find(item=>item.id===id).state;
const normalized=id=>rules.normalizeState(clone(slot(id)));
const node=(value,id)=>value.nodes.find(item=>item.id===id);
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".jpg":"image/jpeg",".png":"image/png",".webp":"image/webp",".json":"application/json"};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,"http://localhost");
  if(url.pathname==="/api.php"){
    let body="";req.on("data",chunk=>body+=chunk);req.on("end",()=>{
      try{
        const route=url.searchParams.get("route");let value={};
        if(route==="auth/me")value={user:{id:"editor-browser-user"}};
        else if(route.startsWith("campaigns/"))value={campaign:{id:campaignId,name:"地图编辑器测试",state,revision}};
        else if(route==="sheets")value={sheets:[]};
        else if(route==="user-settings")value={settings:{}};
        else if(route==="display-state")value={campaign:{id:campaignId,name:"地图编辑器测试",revision},modules:state.modules,presentation:state.presentation};
        else if(route==="campaign-sync"){
          for(const operation of JSON.parse(body||"{}").operations||[]){
            const keys=operation.path.split(".");let target=state;
            for(const key of keys.slice(0,-1))target=target[key]||={};
            target[keys.at(-1)]=operation.value;revision++;
          }
          value={state,revision,conflicts:[]};
        }
        res.writeHead(200,{"Content-Type":"application/json","Cache-Control":"no-store"});res.end(JSON.stringify(value));
      }catch(error){res.writeHead(500,{"Content-Type":"application/json"});res.end(JSON.stringify({error:error.message}));}
    });return;
  }
  let relative=decodeURIComponent(url.pathname).replace(/^\/+/,"");if(!relative||relative.endsWith("/"))relative+="index.html";
  const file=path.resolve(publicRoot,relative);
  if(!file.startsWith(publicRoot+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"Content-Type":mime[path.extname(file)]||"application/octet-stream"});fs.createReadStream(file).pipe(res);
});
const waitFor=async(check,message)=>{for(let attempt=0;attempt<80;attempt++){if(check())return;await new Promise(resolve=>setTimeout(resolve,50));}assert.fail(message);};
const progress=value=>({sharedRevives:value.sharedRevives,graalSighs:value.graalSighs,roster:clone(value.roster),claimedRewards:clone(value.claimedRewards),history:clone(value.history),cleared:value.nodes.filter(item=>item.cleared).map(item=>item.id).sort()});
const comparableProgress=value=>{const current=rules.normalizeState(clone(value));return progress(current);};
(async()=>{
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  let browser;
  try{
    browser=await chromium.launch({headless:true,executablePath:process.env.KF_TEST_BROWSER||"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",env:{...process.env,TEMP:scratch,TMP:scratch,TMPDIR:scratch},downloadsPath:path.join(scratch,"downloads"),args:[`--disk-cache-dir=${path.join(scratch,"browser-cache")}`]});
    const browserContext=await browser.newContext({viewport:{width:1500,height:1050},acceptDownloads:true});
    browserContext.setDefaultTimeout(15000);
    await browserContext.addInitScript(id=>localStorage.setItem("kfActiveCampaign",id),campaignId);
    const errors=[];
    const page=await browserContext.newPage();page.on("pageerror",error=>errors.push(error.message));
    page.on("dialog",dialog=>dialog.accept());
    const flush=async()=>{await page.evaluate(()=>window.KF_MODULE_BRIDGE?.flush?.());};
    const selectNode=async id=>{await page.locator('[data-mode="inspect"]').click();await page.locator("#nodeFind").selectOption(id);};
    const hasNeighbor=async(a,b)=>{await selectNode(a);return (await page.locator(`#neighborList [data-remove-link="${b}"]`).count())>0;};
    const editEdge=async(mode,a,b)=>{
      await page.locator(`[data-mode="${mode}"]`).click();
      await page.locator(`#editorNodeLayer [data-node="${a}"]`).click();
      await page.locator(`#editorNodeLayer [data-node="${b}"]`).click();
    };
    const exportConfig=async()=>{
      const downloadPromise=page.waitForEvent("download");await page.locator("#exportMap").click();
      const download=await downloadPromise;
      const raw=JSON.parse(fs.readFileSync(await download.path(),"utf8"));
      const config=raw.mapConfig||raw.config||raw;
      assert.equal(rules.validateMapConfig(config).ok,true,"export contains a complete validated map configuration");
      for(const privateField of ["roster","sharedRevives","claimedRewards","cleared","pendingBattle"])assert.equal(JSON.stringify(raw).includes(`\"${privateField}\"`),false,`export cannot contain ${privateField}`);
      return clone(config);
    };
    const importConfig=async(config,name="map.json")=>{
      await page.locator("#importMap").setInputFiles({name,mimeType:"application/json",buffer:Buffer.from(typeof config==="string"?config:JSON.stringify(config))});
      await page.waitForTimeout(120);
    };
    // Loading an old campaign upgrades both saved slots without changing
    // their progress, then the main screen and second screen agree on edges.
    await page.goto(base+"/modules/rogue/");
    await page.locator('[data-node="wither-sunken-18"].locked').waitFor();await flush();
    for(const id of ["run-a","run-b"]){
      assert.deepEqual(mapRows(slot(id).nodes),mapRows(approvedMap.nodes),`${id}: runtime graph adopts the full approved map`);
      assert.deepEqual(mapRows(slot(id).mapConfig.nodes),mapRows(approvedMap.nodes),`${id}: template adopts the full approved map`);
      assert.equal(slot(id).basicLinksRevision,rules.BASIC_LINKS_REVISION);
      assert.equal(slot(id).advancedMapRevision,1);
      assert.equal(edgeCount(slot(id).nodes,false),114);assert.equal(edgeCount(slot(id).nodes,true),99);
    }
    const migrationDisplay=await browserContext.newPage();migrationDisplay.on("pageerror",error=>errors.push(error.message));
    await migrationDisplay.goto(base+`/modules/display/?campaignId=${campaignId}`);
    await migrationDisplay.locator('.display-rogue-node[data-node="wither-sunken-18"].locked').waitFor();
    const mainAvailable=await page.locator('.rogue-node.available').evaluateAll(nodes=>nodes.map(node=>node.dataset.node).sort());
    const displayAvailable=await migrationDisplay.locator('.display-rogue-node.available').evaluateAll(nodes=>nodes.map(node=>node.dataset.node).sort());
    assert.deepEqual(displayAvailable,mainAvailable,"both screens use the approved full map for availability");
    await migrationDisplay.close();
    const unchangedB=clone(slot("run-b").mapConfig);
    await page.goto(base+"/modules/rogue/editor.html");
    await page.locator('#editorSlotSelect option[value="run-a"]').waitFor({state:"attached"});
    await page.locator("#editorStage").selectOption("rosegraal");
    assert.equal(await hasNeighbor("sunken-13","sunken-17"),false);
    await editEdge("add","sunken-13","sunken-17");
    assert.equal(await hasNeighbor("sunken-13","sunken-17"),true);
    assert.equal(node(normalized("run-a"),"sunken-13").links.includes("sunken-17"),false,"draft edge changes are not persisted before Save");
    await page.locator("#undoEdit").click();assert.equal(await hasNeighbor("sunken-13","sunken-17"),false);
    await page.locator("#redoEdit").click();assert.equal(await hasNeighbor("sunken-13","sunken-17"),true);
    await editEdge("remove","sunken-13","sunken-17");assert.equal(await hasNeighbor("sunken-13","sunken-17"),false);
    await page.locator("#undoEdit").click();assert.equal(await hasNeighbor("sunken-13","sunken-17"),true);
    await editEdge("remove","sunken-01","sunken-05");assert.equal(await hasNeighbor("sunken-01","sunken-05"),false);
    await page.locator("#editorStage").selectOption("withergraal");
    await selectNode("wither-sunken-01");
    await page.locator("#nodeWithered").uncheck();
    await page.locator("#nodeLevel").fill("9");await page.locator("#nodeReward").selectOption("mastery");
    await page.locator("#nodeRevives").fill("11");
    if(await page.locator("#nodeDevotion").isEnabled())await page.locator("#nodeDevotion").fill("0");
    await page.locator("#applyNode").click();
    await selectNode("wither-sunken-02");
    await page.locator("#nodeWithered").check();
    await page.locator("#nodeLevel").fill("10");await page.locator("#nodeReward").selectOption("saint");
    if(await page.locator("#nodeRevives").isEnabled())await page.locator("#nodeRevives").fill("0");
    await page.locator("#nodeDevotion").fill("4");await page.locator("#applyNode").click();
    await page.locator("#applyScope").selectOption("slot");
    await page.screenshot({path:path.join(scratch,"editor-draft.png"),fullPage:true});
    await page.locator("#saveMap").click();await flush();
    await waitFor(()=>Boolean(slot("run-a").mapConfig),"selected map configuration did not synchronize");
    const savedA=normalized("run-a"),savedB=normalized("run-b");
    assert.ok(node(savedA,"sunken-13").links.includes("sunken-17"),"manual edits can restore a previously retracted connection");
    assert.ok(!node(savedA,"sunken-01").links.includes("sunken-05"));
    assert.deepEqual([node(savedA,"wither-sunken-01").level,node(savedA,"wither-sunken-01").reward,node(savedA,"wither-sunken-01").resurrection],[9,"mastery",11]);
    assert.deepEqual([node(savedA,"wither-sunken-02").level,node(savedA,"wither-sunken-02").reward,node(savedA,"wither-sunken-02").devotion,node(savedA,"wither-sunken-02").withered],[10,"saint",4,true]);
    assert.deepEqual(mapRows(savedB.mapConfig.nodes),mapRows(unchangedB.nodes),"save-to-slot must not apply edits to another slot");
    assert.ok(!node(savedB,"sunken-13").links.includes("sunken-17"));
    assert.deepEqual(comparableProgress(savedA),comparableProgress(initialA));
    assert.deepEqual(comparableProgress(savedB),comparableProgress(initialB));
    await page.reload();await page.locator('#editorSlotSelect option[value="run-a"]').waitFor({state:"attached"});
    await page.locator("#editorStage").selectOption("withergraal");await selectNode("wither-sunken-01");
    assert.equal(await page.locator("#nodeLevel").inputValue(),"9");
    assert.equal(await page.locator("#nodeReward").inputValue(),"mastery");
    assert.equal(await page.locator("#nodeRevives").inputValue(),"11");
    const backup=await exportConfig();
    const beforeMalformed=JSON.stringify(backup);
    await importConfig("{broken","broken.json");
    assert.equal(JSON.stringify(await exportConfig()),beforeMalformed,"malformed JSON must not replace the current draft");
    const crossStage=clone(backup);const from=crossStage.nodes.find(item=>item.id==="sunken-13"),to=crossStage.nodes.find(item=>item.id==="wither-sunken-01");
    from.links.push(to.id);to.links.push(from.id);
    await importConfig(crossStage,"invalid-cross-stage.json");
    assert.equal(JSON.stringify(await exportConfig()),beforeMalformed,"cross-stage links must be rejected without replacing the draft");
    await selectNode("wither-sunken-01");await page.locator("#nodeLevel").fill("11");await page.locator("#applyNode").click();
    await importConfig(backup,"restore-map.json");
    await selectNode("wither-sunken-01");assert.equal(await page.locator("#nodeLevel").inputValue(),"9","valid import restores the exported map");
    assert.equal(node(normalized("run-a"),"wither-sunken-01").level,9,"import remains a draft until Save");
    await page.locator("#nodeRevives").fill("12");await page.locator("#applyNode").click();
    await page.locator("#applyScope").selectOption("all");await page.locator("#saveMap").click();await flush();
    await waitFor(()=>Boolean(slot("run-b").mapConfig),"save-to-all did not synchronize the other slot");
    assert.equal(node(normalized("run-b"),"wither-sunken-01").resurrection,12);
    assert.ok(node(normalized("run-b"),"sunken-13").links.includes("sunken-17"));
    assert.deepEqual(comparableProgress(normalized("run-a")),comparableProgress(initialA));
    assert.deepEqual(comparableProgress(normalized("run-b")),comparableProgress(initialB));
    await page.locator("#editorSlotSelect").selectOption("run-b");
    await page.locator("#editorStage").selectOption("withergraal");await selectNode("wither-sunken-01");
    assert.equal(await page.locator("#nodeRevives").inputValue(),"12");
    await page.setViewportSize({width:390,height:920});await page.waitForTimeout(100);
    const dimensions=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(dimensions.scroll<=dimensions.client+1,JSON.stringify(dimensions));
    await page.screenshot({path:path.join(scratch,"editor-mobile.png"),fullPage:true});
    await page.setViewportSize({width:1500,height:1050});
    await page.goto(base+"/modules/rogue/");
    await page.locator('[data-node="wither-sunken-01"]').waitFor();
    assert.match(await page.locator('[data-node="wither-sunken-01"]').getAttribute("aria-label"),/等级 9/);
    assert.match(await page.locator('[data-node="wither-sunken-01"]').getAttribute("aria-label"),/12/);
    const display=await browserContext.newPage();display.on("pageerror",error=>errors.push(error.message));
    await display.goto(base+`/modules/display/?campaignId=${campaignId}`);
    await display.locator('.display-rogue-node[data-node="wither-sunken-01"]').waitFor();
    const displayTitle=await display.locator('.display-rogue-node[data-node="wither-sunken-01"]').getAttribute("title");
    assert.match(displayTitle,/等级 9/);assert.match(displayTitle,/复活 12/);assert.match(displayTitle,/精通/);
    await display.screenshot({path:path.join(scratch,"editor-second-screen.png"),fullPage:true});await display.close();
    const oldSlotCount=state.modules.roguePath.slots.length;
    await page.locator("#newRun").click();await flush();
    await waitFor(()=>state.modules.roguePath.slots.length===oldSlotCount+1,"new run did not inherit the editor map");
    const fresh=state.modules.roguePath.slots.find(item=>item.id===state.modules.roguePath.activeSlotId).state;
    assert.ok(fresh.mapConfig,"a new run inherits the saved map template");
    assert.equal(node(rules.normalizeState(fresh),"wither-sunken-01").resurrection,12);
    assert.equal(fresh.roster.length,0,"map inheritance does not copy the old party");
    // Browser-local editing has no campaign bundle. Its older raw saved map
    // and draft must upgrade too, while future local manual edits persist.
    const localContext=await browser.newContext({viewport:{width:1300,height:950},acceptDownloads:true});
    localContext.setDefaultTimeout(15000);
    await localContext.addInitScript(oldMap=>{
      if(localStorage.getItem("test-local-map-seeded"))return;
      localStorage.setItem("test-local-map-seeded","true");
      localStorage.setItem("kf-rogue-map-editor-local-v1",JSON.stringify(oldMap));
      localStorage.setItem("kf-rogue-map-editor-draft-v1:local:editor-local",JSON.stringify({schemaVersion:1,mapConfig:oldMap,base:"old-map"}));
    },previousMap);
    const localPage=await localContext.newPage();localPage.on("pageerror",error=>errors.push(error.message));
    localPage.on("dialog",dialog=>dialog.accept());
    await localPage.goto(base+"/modules/rogue/editor.html");
    await localPage.locator('#saveMap').filter({hasText:"保存到本机"}).waitFor();
    assert.match(await localPage.locator("#editorCounts").innerText(),/114 条连线/);
    await localPage.locator("#editorStage").selectOption("withergraal");
    assert.match(await localPage.locator("#editorCounts").innerText(),/99 条连线/);
    await localPage.locator("#saveMap").click();
    const localSaved=await localPage.evaluate(()=>JSON.parse(localStorage.getItem("kf-rogue-map-editor-local-v1")));
    assert.equal(localSaved.basicLinksRevision,rules.BASIC_LINKS_REVISION);assert.equal(localSaved.advancedMapRevision,1);
    assert.deepEqual(mapRows(localSaved.mapConfig.nodes),mapRows(approvedMap.nodes),"old standalone raw map and unversioned draft adopt the full approved map");
    await localPage.locator('[data-mode="add"]').click();
    await localPage.locator('[data-node="wither-S"]').click();await localPage.locator('[data-node="wither-sunken-18"]').click();
    await localPage.locator("#saveMap").click();await localPage.reload();
    await localPage.locator("#editorStage").selectOption("withergraal");
    await localPage.locator('[data-mode="inspect"]').click();await localPage.locator("#nodeFind").selectOption("wither-sunken-18");
    await localPage.locator('#neighborList [data-remove-link="wither-S"]').waitFor();
    assert.match(await localPage.locator("#editorCounts").innerText(),/100 条连线/);
    await localContext.close();
    assert.deepEqual(errors,[]);
    console.log(`Rogue map editor browser passed: approved full-map migration, standalone drafts, explicit add/remove, undo/redo, advanced fields, save/reload, slot/all scope, import/export validation, progress, main screen, second screen and mobile. Screenshots: ${scratch}`);
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
