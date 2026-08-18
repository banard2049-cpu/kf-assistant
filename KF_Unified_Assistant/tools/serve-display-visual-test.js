"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const publicRoot = path.resolve(__dirname, "../public");
const port = Number(process.env.KF_DISPLAY_PORT || 8128);
const readAssignedJson = filename => {
  const source = fs.readFileSync(filename, "utf8");
  return JSON.parse(source.slice(source.indexOf("=") + 1, source.lastIndexOf(";")));
};
const mapData = readAssignedJson(path.join(publicRoot, "modules/map/data/map-data.js"));
const encounterData = readAssignedJson(path.join(publicRoot, "modules/encounter/data/encounter-data.js"));
const monsterData = readAssignedJson(path.join(publicRoot, "modules/aibp/data/monster-data.js"));
const conflictData = require(path.join(publicRoot, "modules/display/data/conflict-board-data.json"));
const layout = conflictData.layouts.find(item => item.id === "stone:M_Pumpkinhead:all");
const conflictMonster = monsterData.monsters.find(item => item.id === "M_Pumpkinhead");
const conflictBp = conflictMonster.cards.filter(card => card.kind === "BPS");
const conflictAi = conflictMonster.cards.find(card => card.kind === "AI1");
const mapTiles = mapData.maps.SK.tiles.filter(tile => Number.isFinite(tile.x) && Number.isFinite(tile.y)).slice(0, 14);
const mapRules = mapData.kingdomRules.SK;
const activeExploration = mapRules.exploration.find(card => ["active","activation"].includes(card.effectType));
const districtExplorations = mapRules.exploration.filter(card => ["district","region"].includes(card.effectType));
const districtEffects = Object.fromEntries(mapRules.districts.map((district,index) => [district.id,districtExplorations[index]?.id || null]));
const fogCards = mapRules.deepFog.slice(0, 3);
const encounterMonster = encounterData.monsters.find(monster => monster.id === "M_Ratwolves") || encounterData.monsters[0];

const payload = {
  campaign: { id:"visual-test",name:"KF 第二屏视觉验收",revision:12,updatedAt:new Date().toISOString(),kingdom:"stone" },
  presentation: { scene:"conflict",updatedAt:new Date().toISOString(),sourceClientId:"visual-test",settings:{mapScale:100,conflictScale:100,conflictRotation:90,conflictSwapped:false,conflictBoardVisible:true} },
  modules: {
    map: { version:8,kingdom:"SK",step:2,round:4,mainKnightId:"k0",trackers:{time:7,threat:5,curse:2,unassignedClues:3},knights:[{id:"k0",name:"Renholder",heroId:"renholder",primary:"martial",secondary:"errant",clues:{martial:4,errant:3}},{id:"k1",name:"Stoneface",heroId:"stoneface",primary:"martial",secondary:"historic",clues:{martial:2,historic:1}},{id:"k2",name:"Kara",heroId:"kara",primary:"errant",secondary:"mystic",clues:{errant:3,mystic:2}},{id:"k3",name:"Paracelsa",heroId:"paracelsa",primary:"historic",secondary:"martial",clues:{historic:2,martial:1}}],maps:{SK:{placed:mapTiles.map(tile=>tile.id),tileState:Object.fromEntries(mapTiles.map((tile,index)=>[tile.id,index<8?"explored":"hidden"])),current:mapTiles[3]?.id,selected:mapTiles[3]?.id,showAll:false,partyPositions:{[mapTiles[3]?.id]:{x:52,y:48}},tileMarkers:[],pathMarkers:[],monsters:[],exploration:{activeEffect:activeExploration?.id||null,districtEffects,effectMarkers:{active:[{type:"generic",x:72,y:24}]}},fog:{active:false,target:mapTiles[4]?.id,total:4,intensity:3,started:true,current:null,used:fogCards.map((card,index)=>({cardId:card.id,value:card.fogValue,x:index<2?index:1,y:index<2?0:1})),route:fogCards.map((card,index)=>({cardId:card.id,value:card.fogValue,x:index<2?index:1,y:index<2?0:1}))}},POS:{}}},
    encounter: { version:1,monsterId:encounterMonster.id,level:encounterMonster.encounterLevels[0].level,phase:"monster",encounterType:"normal",knights:[{id:"k1",name:"Stoneface",heroId:"stoneface",space:"7",facing:1},{id:"k2",name:"Kara",heroId:"kara",space:"9",facing:2}],monsters:[{id:"m1",name:encounterMonster.name,space:"8",facing:3}],customPieces:[{id:"c1",name:"目标",space:"12",facing:0}],pool:{opportunity:2,break:1},scrapes:1,criticalUsed:false,dragonRoarDone:false,targets:["7","9"] },
    aibp: { version:10,selectedMonsterId:"M_Pumpkinhead",updatedAt:Date.now(),battle:{monsterId:"M_Pumpkinhead",level:2,clashPhase:"full",mobCount:6,aiDiscard:[],aiRemoved:[],bpDiscard:[],bpDamage:[],bpRemoved:[],bpTrack:Array.from({length:6},(_,index)=>index===0?{id:conflictBp[0]?.id||"",occupied:true,revealed:true,side:"face",markerTokens:{"token-01":2}}:index===1?{id:"",occupied:true,revealed:false,side:"face",markerTokens:{"token-armor":1}}:{id:"",occupied:false,revealed:false,side:"face",markerTokens:{}}),activeAI:conflictAi?.id||"",activeBP:conflictBp[0]?.id||"",mobTacticCard:"",mobActivations:[{id:"a1",type:"AI",position:0,used:false},{id:"a2",type:"SG",position:1,used:true}],sheetTokens:[{id:"sheet-token",assetId:"token-armor",count:2,x:72,y:34}],singleWounds:1,doubleWounds:0,ruleState:{promotionLevel:1},conflictStatus:"active",failureReason:"",conflictLocation:"",conflictBoard:{layoutId:layout.id,monsterId:"M_Pumpkinhead",kingdom:"stone",requestedKingdom:"stone",level:2,resolvedOrientations:{},terrain:layout.placements.filter(item=>item.kind==="terrain").map(item=>({...item,rotation:item.rotation||0,flipped:false})),showStarts:true,showCoordinates:true,activeFoolCardId:17108,mobAssignments:layout.placements.filter(item=>item.kind==="monster"||item.asset==="RedSapling").map((item,index)=>({placementId:item.id,number:index+1})),createdAt:new Date().toISOString()},aiDeckCount:8,bpDeckCount:0,aiDeckLevels:[1,1,1,1,2,2,2,3],bpDeckLevels:[],log:[]} },
  },
};

const mime = { ".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",".svg":"image/svg+xml" };
const server = http.createServer((request,response) => {
  const url = new URL(request.url,`http://127.0.0.1:${port}`);
  if (url.pathname === "/api.php") { response.writeHead(200,{"Content-Type":"application/json","ETag":"\"visual-test\""});response.end(JSON.stringify(payload));return; }
  let relative = decodeURIComponent(url.pathname).replace(/^\/+/,"");
  if (!relative || relative.endsWith("/")) relative += "index.html";
  const target = path.resolve(publicRoot,relative);
  if (!target.startsWith(publicRoot+path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) { response.writeHead(404);response.end("Not found");return; }
  let body = fs.readFileSync(target);
  if (relative === "modules/display/index.html") {
    const source = body.toString("utf8");
    const fixture = `<script>localStorage.setItem("kfActiveCampaign","visual-test");const __fixtureFetch=window.fetch.bind(window);window.fetch=(input,options)=>{if(String(input).startsWith("/api.php")){const copy=JSON.parse(${JSON.stringify(JSON.stringify(payload))});const params=new URLSearchParams(location.search);copy.presentation.scene=params.get("scene")||"conflict";copy.presentation.settings.conflictRotation=Number(params.get("rotation"))===270?270:90;copy.presentation.settings.conflictSwapped=params.get("swapped")==="1";copy.presentation.settings.conflictBoardVisible=params.get("board")!=="0";copy.modules.map.maps.SK.fog.active=params.get("fog")==="1";return Promise.resolve(new Response(JSON.stringify(copy),{status:200,headers:{"Content-Type":"application/json","ETag":"\\\"visual-test\\\""}}));}return __fixtureFetch(input,options);};</script>`;
    body = Buffer.from(source.replace(/(<script src="app\.js\?v=\d+"><\/script>)/,`${fixture}$1`));
  }
  response.writeHead(200,{"Content-Type":mime[path.extname(target).toLowerCase()]||"application/octet-stream","Cache-Control":"no-store"});response.end(body);
});
server.listen(port,"127.0.0.1",()=>console.log(`KF display visual fixture: http://127.0.0.1:${port}/modules/display/`));
