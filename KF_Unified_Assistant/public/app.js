const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
["kf-assistant-campaign-v1","kf-assistant-campaign-slots-v1","kf-assistant-active-slot-v1"].forEach(key=>localStorage.removeItem(key));
const virtueMeta = [
  ["bravery","勇敢","BRAVERY","懦弱 COWARDICE"],["tenacity","顽强","TENACITY","失信 DISHONOR"],
  ["sagacity","睿智","SAGACITY","欺骗 DUPLICITY"],["fortitude","坚韧","FORTITUDE","冷漠 DISREGARD"],
  ["might","威武","MIGHT","残忍 CRUELTY"],["insight","洞察","INSIGHT","背叛 TREACHERY"]
];
let user=null,sheets=[],trash=[],active=null,state=null,revision=0,canRegister=false,isRegister=false,search="",saveTimer=null,syncing=false,viewMode="overview",gameSettings={leaderSheetId:"",kingdom:"sunken",districts:3,devourDragon:false};
let campaigns=[],activeCampaign=null,campaignState=null,campaignRevision=0,campaignSyncing=false,campaignSaveTimer=null;
let sharedSettings={storyMarkers:{},passwords:[]},sharedSettingsSaveTimer=null,sharedSettingsDirty=false;
let activeSquireSlot=-1;
const campaignPending=[];
const knightCatalog=[
  ["stoneface","Stoneface"],["fleischritter","Fleischritter"],["renholder","Renholder"],
  ["ser-sonch","Ser Sonch"],["paracelsa","Paracelsa"],["ser-ubar","Ser Ubar"],["kara","Kara"]
].map(([id,name])=>({id,name}));
const squireCatalog=[
  {id:"bartos",name:"巴尔托什",en:"Bartos"},{id:"caelia",name:"凯莉娅",en:"Caelia"},
  {id:"helse",name:"赫尔塞",en:"Helse"},{id:"fabio",name:"法比奥",en:"Fabio"},
  {id:"bianca",name:"比安卡",en:"Bianca"},{id:"murmur",name:"穆尔穆",en:"Murmur"},
  {id:"ralof",name:"拉福尔",en:"Ralof"},{id:"vratlada",name:"芙拉特兰姬",en:"Vratlada"}
];
const permanentStoryMarkerGroups=[
  {id:"fear",label:"万千恐惧 · 施瓦茨莱希",items:[
    ["fear-traitors-crossing","6-11","Traitor's Crossing"],
    ["fear-fated-pilgrimage","12-18","Fated Pilgrimage"],
    ["fear-solitary-confinement","19-25","Solitary Confinement"],
    ["fear-defiances-spoils","40-46","Defiance's Spoils"],
    ["fear-in-tandem","61-67","In Tandem"],
    ["fear-heartburn","68-74","Heartburn"],
    ["fear-escape-cage-flesh","89-94","Escape This Cage of Flesh"],
    ["fear-profane-terror","95-100","Profane Terror"]
  ]},
  {id:"sunken",label:"沉没王国",items:[
    ["sunken-02-sundered-hope","4-6","2. Sundered Hope"],
    ["sunken-07-rotten-core","19-21","7. Rotten to the Core"],
    ["sunken-08-weight-guilt","22-24","8. Weight of Guilt"],
    ["sunken-10-life-raft","28-30","10. Life Raft"],
    ["sunken-16-burden-knowledge","49-52","16. The Burden of Knowledge"],
    ["sunken-18-wheels-progress","57-60","18. Wheels of Progress"],
    ["sunken-20-frail-foundations","65-68","20. Frail Foundations"],
    ["sunken-22-mudskippers","72-74","22. Mudskippers"],
    ["sunken-24-divine-compassion","78-80","24. Divine Compassion"],
    ["sunken-25-buried-truths","81-83","25. Buried Truths"],
    ["sunken-26-shrunken-kingdom","84-86","26. Shrunken Kingdom"],
    ["sunken-27-before-mast","87-89","27. Before the Mast"],
    ["sunken-29-high-stakes","93-95","29. High Stakes"],
    ["sunken-30-idle-playthings","96-100","30. Idle Playthings in the Devil's Hands"],
    ["sunken-extra-inspire-me","","啊，赐予我灵感吧"],
    ["sunken-extra-avoid-muddy-road","","避开泥泞之路"],
    ["sunken-extra-defy-demonic-rule","","反抗魔权"]
  ]},
  {id:"stone",label:"石之公国 · 巨石公国",items:[
    ["stone-07-pestilence","19-21","7. Pestilence"],
    ["stone-08-fractured-shell","22-24","8. Fractured Shell"],
    ["stone-10-prized-possession","28-30","10. Prized Possession"],
    ["stone-13-mortsafe","37-40","13. Mortsafe"],
    ["stone-18-ghostly-duel","57-60","18. A Ghostly Duel"],
    ["stone-21-stone-man","69-71","21. The Stone Man"],
    ["stone-24-trade","78-80","24. The Trade"],
    ["stone-25-infested-keep","81-83","25. Infested Keep"],
    ["stone-27-alloy-chivalry","87-89","27. Alloy Chivalry"],
    ["stone-28-heavy-water","90-92","28. Heavy Water"],
    ["stone-29-eaves-drip-kindness","93-95","29. Eaves-drip Kindness"],
    ["stone-extra-search-ubar","","追寻乌尔班"],
    ["stone-extra-pumpkin-plague","","南瓜成灾"]
  ]}
];
const permanentStoryMarkerIds=new Set(permanentStoryMarkerGroups.flatMap(group=>group.items.map(item=>item[0])));
const sheetKnightId=sheet=>sheet?.state?.knightId||knightCatalog.find(item=>item.name.toLowerCase()===(sheet?.state?.knight||"").toLowerCase())?.id||"";
const isKnightSheet=sheet=>knightCatalog.some(item=>item.id===sheetKnightId(sheet));
const knightSheets=()=>sheets.filter(isKnightSheet);
const bestiaryMonsters=[
  "Panzergeists","Ironcast Dead","Eggknight","Stonemason Knight","Puppetking Edelhardt","Devil of the Smelted Fears","Panzerdragon Veldr",
  "Ratwolves","Winged Nightmare","Paleblood Worms","Pumpkinhead Monstrosities","Knight of the Fen","Knighteater","Young Devour Dragon",
  "Firstmen Warriors","Firstmen Lictor Hunters","Haunts of Utrebant","White Ape Troll","Bog Witch","The King Laid Low","Devil of the Ancient Dusk","Toadragon of the Great Marsh"
];
const bestiaryRows=[
  "111....1.11...11.1....","1111...1.111..1111....","1.11...211111..1111...",".2.1...212.11.221.1...",
  "222....2122.1.22.21...","2222....222...2222....","2.22...32.222...222...",".3.21..323.22.332.21..",
  "333.1..3.3322.33.321..","333.1..4333...3333.1..","3.332..43.33....33.2..",".4.321.43..33.4.3.321.",
  "44.321...4433.44..321.","444.31...44.3.4444331.","4.4.32..444....444.32.","..44321.4..4.1..44.321",
  "...4421.4..441....4421","...4431.4..441....4431","...4432.4..442....4432","...4432.4..442....4432"
];
function poolForRow(row,kingdom){
  const encoded=bestiaryRows[Math.max(0,Math.min(19,row))]||bestiaryRows[0];
  return [...encoded].map((value,index)=>({name:bestiaryMonsters[index],level:Number(value)||0,index}))
    .filter(card=>card.level&&(kingdom==="stone"?card.index<=13:card.index>=7)).map(({name,level,index})=>({name,level,index,tier:monsterTier(name,level)}));
}
const shuffleList=(values,random=Math.random)=>{
  const result=[...values];
  for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}
  return result;
};
function compatibleUuid(){
  const source=globalThis.crypto;
  if(typeof source?.randomUUID==="function")return source.randomUUID();
  const bytes=new Uint8Array(16);
  if(typeof source?.getRandomValues==="function")source.getRandomValues(bytes);
  else for(let index=0;index<bytes.length;index++)bytes[index]=Math.floor(Math.random()*256);
  bytes[6]=(bytes[6]&15)|64;
  bytes[8]=(bytes[8]&63)|128;
  const hex=[...bytes].map(value=>value.toString(16).padStart(2,"0")).join("");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
const monsterRecord=name=>window.KF_MONSTER_DATA?.monsters?.find(monster=>monster.name===name);
const encounterRecord=name=>window.KF_ENCOUNTER_DATA?.monsters?.find(monster=>monster.name===name);
const monsterTier=(name,level)=>encounterRecord(name)?.encounterLevels?.find(item=>Number(item.level)===Number(level))?.tier||"";
const DEVOUR_DRAGON_CARD="devour-dragon-arrives";
function drawMonsterPoolCards(source,count,enabled,random=Math.random){
  const deck=shuffleList(enabled?[...source,{kind:DEVOUR_DRAGON_CARD,name:"贪食巨龙来了！"}]:source,random),selected=[];
  let drawn=false;
  while(deck.length&&selected.length<count){
    const card=deck.pop();
    if(card.kind===DEVOUR_DRAGON_CARD){drawn=true;continue}
    selected.push({...card});
  }
  const eligible=selected.map((card,index)=>({card,index})).filter(({card})=>!["king","dragon"].includes(card.tier||monsterTier(card.name,card.level)));
  let boundIndex=null;
  if(drawn&&eligible.length)boundIndex=eligible[Math.floor(random()*eligible.length)].index;
  if(boundIndex!==null)selected[boundIndex]={...selected[boundIndex],devourDragonBound:true,conflictLocation:"巨兽之腹"};
  return {selected,rule:{enabled:Boolean(enabled),drawn,boundIndex,boundMonster:boundIndex===null?"":selected[boundIndex].name,conflictLocation:boundIndex===null?"":"巨兽之腹"}};
}
const monsterAvatar=name=>{
  const source=encounterRecord(name)?.avatar||monsterRecord(name)?.avatar||"";
  return source?`/${String(source).replace(/^\/+/,"")}`:"";
};
const monsterAvatarMarkup=(name,className="monster-avatar")=>{
  const source=monsterAvatar(name);
  return source
    ?`<img class="${className}" src="${esc(source)}" alt="${esc(name)} 头像" loading="lazy">`
    :`<span class="${className} monster-avatar-fallback" aria-hidden="true">?</span>`;
};
const cardLabel=card=>typeof card==="string"?card:(card?.name||card?.kind||card?.id||"未知卡牌");
function initializeTtsBattle(name,level){
  const monster=monsterRecord(name);if(!monster)return null;
  const count=kind=>Number(monster.pools?.[kind]||0);
  const counts={AI1:Math.min(6,count("AI1")),AI2:0,AI3:0,BP1:monster.type==="mob"?count("BP1"):Math.min(6,count("BP1")),BP2:0,BP3:0};
  const levelInfo=(window.KF_LEVEL_CONFIG?.[monster.id]||[]).find(item=>item.level===Number(level))||null;
  for(let step=0;step<Number(levelInfo?.promotion||0);step++)for(const prefix of ["AI","BP"]){
    if(counts[`${prefix}1`]>0){counts[`${prefix}1`]--;counts[`${prefix}2`]++}
    else if(counts[`${prefix}2`]>0){counts[`${prefix}2`]--;counts[`${prefix}3`]++}
  }
  const build=kinds=>shuffleList(kinds.flatMap(kind=>shuffleList(monster.cards.filter(card=>card.kind===kind)).slice(0,counts[kind]||0).map(card=>({id:card.id,name:card.name,kind:card.kind}))));
  const ai=build(["AI1","AI2","AI3"]),ai0=monster.cards.find(card=>card.kind==="AI0");
  if(ai0)ai.unshift({id:ai0.id,name:ai0.name,kind:ai0.kind});
  const bpKinds=monster.type==="mob"?(count("BPS")?["BPS"]:["BP1"]):["BP1","BP2","BP3"];
  const bp=monster.type==="mob"?shuffleList(monster.cards.filter(card=>bpKinds.includes(card.kind)).map(card=>({id:card.id,name:card.name,kind:card.kind}))):build(bpKinds);
  return {monster:name,monsterId:monster.id,level:Number(level),ai,bp,activeAI:null,activeBP:null,discard:[],bpDamage:[],wounds:[],promotion:Number(levelInfo?.promotion||0),stats:levelInfo,undo:null,history:[{at:new Date().toISOString(),text:`按 TTS 数据建立 ${name} Lv.${level} 的 AI/BP`}]};
}
function mapKingdom(){
  return (campaignState?.kingdom||campaignState?.map?.activeKingdom)==="stone"?"POS":"SK";
}
function mapTilesForKingdom(){return window.KF_MOD_DATA?.maps?.[mapKingdom()]?.tiles||[]}
const campaignMapKey=()=>campaignState?.kingdom==="stone"?"stone":"sunken";
const campaignMapPath=field=>`map.kingdoms.${campaignMapKey()}.${field}`;
function campaignMapState(){
  const map=campaignState?.map||{},nested=map.kingdoms?.[campaignMapKey()];
  return nested||{tiles:map.tiles||[],partyTile:map.partyTile||"",markers:map.markers||[],round:map.round||0};
}
const clientId=localStorage.kfClientId||(localStorage.kfClientId=compatibleUuid().replace(/-/g,""));
const pending=[];
let offlineDb=null;
const openOfflineDb=()=>new Promise((resolve,reject)=>{
  const request=indexedDB.open("kf-knight-sheet",1);
  request.onupgradeneeded=()=>request.result.createObjectStore("sync");
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)
});
const idbGet=key=>new Promise((resolve,reject)=>{const r=offlineDb.transaction("sync").objectStore("sync").get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
const idbSet=(key,value)=>new Promise((resolve,reject)=>{const tx=offlineDb.transaction("sync","readwrite");tx.objectStore("sync").put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
async function initOffline(){try{offlineDb=await openOfflineDb();const saved=await idbGet("pending"),campaignSaved=await idbGet("campaign-pending");if(Array.isArray(saved))pending.push(...saved);if(Array.isArray(campaignSaved))campaignPending.push(...campaignSaved);if(pending.length)sync();if(campaignPending.length)syncCampaign()}catch(e){console.warn("离线队列不可用",e)}}
const persistPending=()=>offlineDb&&idbSet("pending",pending).catch(()=>{});
const persistCampaignPending=()=>offlineDb&&idbSet("campaign-pending",campaignPending).catch(()=>{});
const api=async(path,options={})=>{
  const raw=path.replace(/^\/api\/?/,""),parts=raw.split("?"),target=`/api.php?route=${encodeURIComponent(parts[0])}${parts[1]?`&${parts[1]}`:""}`;
  const res=await fetch(target,{credentials:"same-origin",headers:{"Content-Type":"application/json",...(options.headers||{})},...options});
  const data=await res.json().catch(()=>({}));
  if(!res.ok){const error=new Error(data.error||"请求失败");error.status=res.status;error.data=data;throw error;}
  return data;
};
const normalizePermanentStoryMarkers=value=>Object.fromEntries(Object.entries(value&&typeof value==="object"&&!Array.isArray(value)?value:{})
  .filter(([id,checked])=>permanentStoryMarkerIds.has(id)&&checked===true));
const passwordSymbols={dot:{label:"点",glyph:"•"},filled:{label:"实心反三角",glyph:"▼"},outline:{label:"空心反三角",glyph:"▽"}};
const passwordSymbolOrder=Object.keys(passwordSymbols);
const normalizePasswordRecords=value=>{
  const seen=new Set();
  return (Array.isArray(value)?value:[]).slice(0,100).flatMap(record=>{
    if(!record||typeof record!=="object")return [];
    const id=typeof record.id==="string"&&/^[A-Za-z0-9_-]{8,100}$/.test(record.id)?record.id:"";
    if(!id||seen.has(id))return [];seen.add(id);
    const matrix=Array.from({length:6},(_,index)=>passwordSymbolOrder.includes(record.matrix?.[index])?record.matrix[index]:"dot");
    const number=String(record.number??"").replace(/\D/g,"").slice(0,8);
    return [{id,matrix,number}];
  });
};
const sharedSettingsCacheKey=()=>`kf-user-settings-${user?.id||"guest"}`;
const cacheSharedSettings=dirty=>localStorage.setItem(sharedSettingsCacheKey(),JSON.stringify({settings:sharedSettings,dirty:Boolean(dirty)}));
function renderPermanentStoryMarkers(){
  const markers=normalizePermanentStoryMarkers(sharedSettings.storyMarkers),total=permanentStoryMarkerIds.size,checked=Object.keys(markers).length;
  sharedSettings.storyMarkers=markers;
  $("#permanentStoryMarkerCount").textContent=`${checked} / ${total}`;
  $("#permanentStoryMarkerGroups").innerHTML=permanentStoryMarkerGroups.map(group=>{
    const groupChecked=group.items.filter(([id])=>markers[id]).length;
    return `<details class="permanent-story-marker-group">
      <summary><strong>${esc(group.label)}</strong><span>${groupChecked} / ${group.items.length}</span></summary>
      <div class="permanent-story-marker-list">${group.items.map(([id,roll,title])=>`<label class="permanent-story-marker-item">
        <input type="checkbox" data-permanent-story-marker="${esc(id)}" ${markers[id]?"checked":""}>
        <span class="permanent-story-marker-box" aria-hidden="true"></span>
        <span class="permanent-story-marker-copy"><strong>${esc(title)}</strong><small>${roll?`d100 ${esc(roll)}`:"追加故事"}</small></span>
      </label>`).join("")}</div>
    </details>`;
  }).join("");
}
function renderPasswordRecords(){
  sharedSettings.passwords=normalizePasswordRecords(sharedSettings.passwords);
  $("#passwordRecordCount").textContent=String(sharedSettings.passwords.length);
  $("#passwordRecords").innerHTML=sharedSettings.passwords.length?sharedSettings.passwords.map((record,index)=>`<article class="password-record" data-password-record="${esc(record.id)}">
    <div class="password-matrix" role="group" aria-label="密码 ${index+1} 的二行三列矩阵">${record.matrix.map((symbol,cell)=>`<button type="button" class="password-cell password-cell-${symbol}" data-password-cell="${cell}" aria-label="第 ${Math.floor(cell/3)+1} 行第 ${cell%3+1} 列：${passwordSymbols[symbol].label}" title="点击切换符号">${passwordSymbols[symbol].glyph}</button>`).join("")}</div>
    <label class="password-number"><span>对应数字</span><input data-password-number inputmode="numeric" pattern="[0-9]*" maxlength="8" value="${esc(record.number)}" aria-label="密码 ${index+1} 对应的数字"></label>
    <button type="button" class="remove-row no-print" data-remove-password aria-label="删除密码 ${index+1}">×</button>
  </article>`).join(""):`<p class="password-empty">尚未记录密码</p>`;
}
async function saveSharedSettings(){
  clearTimeout(sharedSettingsSaveTimer);sharedSettingsSaveTimer=null;
  const storyMarkers=normalizePermanentStoryMarkers(sharedSettings.storyMarkers),passwords=normalizePasswordRecords(sharedSettings.passwords);sharedSettings={storyMarkers,passwords};cacheSharedSettings(true);setSave(navigator.onLine?"保存账号记录中…":"账号记录离线暂存",!navigator.onLine);
  if(!navigator.onLine){sharedSettingsDirty=true;return}
  try{await api("/api/user-settings",{method:"PATCH",body:JSON.stringify({storyMarkers,passwords})});sharedSettingsDirty=false;cacheSharedSettings(false);setSave("已保存")}
  catch(error){sharedSettingsDirty=true;cacheSharedSettings(true);setSave("账号记录等待同步",true)}
}
function queueSharedSettingsSave(){sharedSettingsDirty=true;cacheSharedSettings(true);clearTimeout(sharedSettingsSaveTimer);sharedSettingsSaveTimer=setTimeout(saveSharedSettings,300)}
async function loadSharedSettings(){
  let cached=null;try{cached=JSON.parse(localStorage.getItem(sharedSettingsCacheKey())||"null")}catch{}
  try{
    const data=await api("/api/user-settings"),remote={storyMarkers:normalizePermanentStoryMarkers(data.settings?.storyMarkers),passwords:normalizePasswordRecords(data.settings?.passwords)};
    sharedSettings=cached?.dirty?{storyMarkers:normalizePermanentStoryMarkers(cached.settings?.storyMarkers),passwords:normalizePasswordRecords(cached.settings?.passwords)}:remote;
    sharedSettingsDirty=Boolean(cached?.dirty);cacheSharedSettings(sharedSettingsDirty);renderPermanentStoryMarkers();renderPasswordRecords();if(sharedSettingsDirty)queueSharedSettingsSave();
  }catch(error){sharedSettings={storyMarkers:normalizePermanentStoryMarkers(cached?.settings?.storyMarkers),passwords:normalizePasswordRecords(cached?.settings?.passwords)};sharedSettingsDirty=Boolean(cached);renderPermanentStoryMarkers();renderPasswordRecords();if(cached)setSave("账号记录离线暂存",true)}
}
const toast=(message)=>{const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(el.t);el.t=setTimeout(()=>el.classList.remove("show"),2600)};
const setSave=(text,bad=false)=>{const el=$("#saveState");el.textContent=text;el.style.color=bad?"#f2b0a7":""};
const download=(name,data)=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
const pathGet=(root,path)=>path.split(".").reduce((v,k)=>v?.[k],root);
const pathSet=(root,path,value)=>{const keys=path.split(".");let t=root;for(let i=0;i<keys.length-1;i++){if(!t[keys[i]]||typeof t[keys[i]]!=="object")t[keys[i]]={};t=t[keys[i]]}t[keys.at(-1)]=value};
const op=(path,value)=>{
  pathSet(state,path,value);pending.push({id:compatibleUuid().replace(/-/g,""),sheetId:active,clientId,path,value,baseRevision:revision});
  persistPending();cacheSheet();setSave(navigator.onLine?"保存中…":"离线暂存",!navigator.onLine);clearTimeout(saveTimer);saveTimer=setTimeout(sync,450);
};
const cacheSheet=()=>active&&localStorage.setItem(`kf-sheet-${active}`,JSON.stringify({state,revision}));
async function sync(){
  if(syncing||!active||!pending.length||!navigator.onLine)return;
  const batch=pending.filter(item=>item.sheetId===active).slice(0,200);if(!batch.length)return;
  const batchIds=new Set(batch.map(item=>item.id));for(let i=pending.length-1;i>=0;i--)if(batchIds.has(pending[i].id))pending.splice(i,1);
  syncing=true;
  try{const data=await api("/api/sync",{method:"POST",body:JSON.stringify({sheetId:active,operations:batch})});state=data.state;revision=data.revision;const summary=sheets.find(s=>s.id===active);if(summary)summary.state=structuredClone(state);cacheSheet();if(data.conflicts?.length)toast(`已合并 ${data.conflicts.length} 项跨设备修改`);setSave("已保存");renderValues()}
  catch(e){pending.unshift(...batch);setSave("等待网络",true)}
  finally{persistPending();syncing=false;if(pending.length)setTimeout(sync,600)}
}
function campaignOp(path,value){
  pathSet(campaignState,path,value);campaignPending.push({id:compatibleUuid().replace(/-/g,""),campaignId:activeCampaign,clientId,path,value,baseRevision:campaignRevision});
  persistCampaignPending();setSave(navigator.onLine?"保存中…":"离线暂存",!navigator.onLine);clearTimeout(campaignSaveTimer);campaignSaveTimer=setTimeout(syncCampaign,350);
}
async function syncCampaign(){
  if(campaignSyncing||!activeCampaign||!campaignPending.length||!navigator.onLine)return;
  const batch=campaignPending.filter(item=>item.campaignId===activeCampaign).slice(0,200);if(!batch.length)return;
  const ids=new Set(batch.map(item=>item.id));for(let i=campaignPending.length-1;i>=0;i--)if(ids.has(campaignPending[i].id))campaignPending.splice(i,1);
  campaignSyncing=true;
  try{const data=await api("/api/campaign-sync",{method:"POST",body:JSON.stringify({campaignId:activeCampaign,operations:batch})});
    const mergedState=data.state;campaignPending.filter(item=>item.campaignId===activeCampaign).forEach(item=>pathSet(mergedState,item.path,item.value));
    campaignState=mergedState;campaignRevision=data.revision;hydrateGameSettings();setSave("已保存");renderCurrentModule();if(data.conflicts?.length)toast(`已合并 ${data.conflicts.length} 项战役修改`)}
  catch(e){campaignPending.unshift(...batch);setSave("等待网络",true)}
  finally{persistCampaignPending();campaignSyncing=false;if(campaignPending.length)setTimeout(syncCampaign,600)}
}
function hydrateGameSettings(){if(!campaignState)return;gameSettings={leaderSheetId:campaignState.leaderSheetId||"",kingdom:campaignState.kingdom||"sunken",districts:(campaignState.kingdom||"sunken")==="sunken"?3:4,devourDragon:Boolean(campaignState.optionalRules?.devourDragon)};renderPresentationControls()}
function presentationSettings(){return {mapScale:100,conflictScale:100,conflictRotation:90,conflictSwapped:false,conflictBoardVisible:true,...(campaignState?.presentation?.settings||{})}}
function portraitConflictRotation(value){const normalized=((Number(value)%360)+360)%360;return [0,90,180,270].includes(normalized)?normalized:90}
function renderPresentationControls(){
  const settings=presentationSettings();if(!$("#mapScale"))return;
  $("#mapScale").value=String(settings.mapScale);$("#mapScaleValue").textContent=`${settings.mapScale}%`;
  $("#conflictScale").value=String(settings.conflictScale);$("#conflictScaleValue").textContent=`${settings.conflictScale}%`;
  const conflictRotation=portraitConflictRotation(settings.conflictRotation);
  $("#rotateConflict").dataset.rotation=String(conflictRotation);
  $("#rotateConflict").title=`AI/BP 区域当前 ${conflictRotation}°，点击旋转 90°（含大牌展示栏）`;
  $("#rotateConflict").setAttribute("aria-label",`旋转第二屏 AI/BP 区域 90 度（含大牌展示栏），当前 ${conflictRotation} 度`);
  $("#swapConflict").classList.toggle("active",Boolean(settings.conflictSwapped));
  $("#toggleConflictBoard").classList.toggle("active",settings.conflictBoardVisible!==false);
  $("#toggleConflictBoard").textContent=settings.conflictBoardVisible===false?"○":"◉";
}
async function loadCampaigns(preferred){
  const data=await api("/api/campaigns");campaigns=data.campaigns;
  activeCampaign=preferred||localStorage.kfActiveCampaign||activeCampaign||data.defaultCampaignId||campaigns[0]?.id;
  if(!campaigns.some(c=>c.id===activeCampaign))activeCampaign=campaigns[0]?.id;
  localStorage.kfActiveCampaign=activeCampaign||"";renderCampaignSelect();
  if(activeCampaign){const detail=await api(`/api/campaigns/${activeCampaign}`);campaignState=detail.campaign.state;campaignRevision=detail.campaign.revision;hydrateGameSettings();if(campaignPending.some(item=>item.campaignId===activeCampaign))syncCampaign()}
}
function renderCampaignSelect(){$("#campaignSelect").innerHTML=campaigns.map(c=>`<option value="${c.id}" ${c.id===activeCampaign?"selected":""}>${esc(c.name)}</option>`).join("")}
async function loadSession(){
  const [{user:u},{registration}]=await Promise.all([api("/api/auth/me"),api("/api/config")]);user=u;canRegister=registration;
  if(user)showApp();else showAuth();
}
function showAuth(){$("#authView").classList.remove("hidden");$("#appView").classList.add("hidden");$("#authMode").classList.toggle("hidden",!canRegister);$("#authHint").textContent=canRegister?"":"服务器已关闭新用户注册"}
async function showApp(){$("#authView").classList.add("hidden");$("#appView").classList.remove("hidden");$("#currentUser").textContent=user.username;await Promise.all([loadCampaigns(),loadSharedSettings()]);await refreshLists()}
async function refreshLists(){
  const suffix=`&campaignId=${encodeURIComponent(activeCampaign)}`;const [a,b]=await Promise.all([api(`/api/sheets?overview=1${suffix}`),api(`/api/sheets?trash=1${suffix}`)]);sheets=a.sheets;trash=b.sheets;renderLists();
  if(active&&!sheets.some(s=>s.id===active)){active=null;state=null}
  if(viewMode==="overview"||!active)showOverview();
}
function renderLists(){
  const build=(items,deleted)=>items.filter(s=>s.title.toLowerCase().includes(search.toLowerCase())).map(s=>`<button class="sheet-item ${s.id===active?"active":""}" data-sheet="${s.id}" data-deleted="${deleted}"><strong>${esc(s.title)}</strong><small>${deleted?"可恢复":new Date(s.updated_at).toLocaleString()}</small></button>`).join("");
  $("#sheetList").innerHTML=build(sheets,false)||'<p class="subtle">暂无档案</p>';$("#trashList").innerHTML=build(trash,true)||'<p class="subtle">回收站为空</p>';
}
async function openSheet(id){
  try{const data=await api(`/api/sheets/${id}`);active=id;state=data.sheet.state;revision=data.sheet.revision;viewMode="edit";localStorage.setItem(`kf-sheet-${id}`,JSON.stringify({state,revision}));renderAll(data.sheet.title);closeSidebar();sync()}
  catch(e){const cached=JSON.parse(localStorage.getItem(`kf-sheet-${id}`)||"null");if(cached){active=id;state=cached.state;revision=cached.revision;renderAll("离线档案");setSave("离线暂存",true)}else toast(e.message)}
}
function showEmpty(){$("#overview").classList.add("hidden");$("#emptyState").classList.remove("hidden");$("#sheetForm").classList.add("hidden")}
function normalizedParty(input=campaignState?.party||[]){
  const valid=new Set(knightSheets().map(sheet=>sheet.id)),leader=gameSettings.leaderSheetId;
  let party=[...new Set((Array.isArray(input)?input:[]).filter(id=>valid.has(id)))];
  if(leader&&valid.has(leader)){const leaderCount=party.filter(id=>id===leader).length;party=party.filter(id=>id!==leader);party.unshift(...Array(Math.max(1,leaderCount)).fill(leader))}
  return party.slice(0,4);
}
function normalizedSquires(party,current=campaignState?.squires||[]){
  const needed=Math.max(0,4-party.length),available=squireCatalog;
  const result=[];
  for(const id of Array.isArray(current)?current:[]){
    if(result.length>=needed)break;
    if(available.some(item=>item.id===id)&&!result.includes(id))result.push(id);
  }
  for(const item of available)if(result.length<needed&&!result.includes(item.id))result.push(item.id);
  return result;
}
function commitParty(input){
  const party=normalizedParty(input),squires=normalizedSquires(party);
  campaignOp("party",party);campaignOp("squires",squires);renderPartyBuilder();
}
function renderPartyBuilder(){
  const leader=gameSettings.leaderSheetId,party=normalizedParty();
  if(!leader||!knightSheets().some(sheet=>sheet.id===leader)){
    $("#partySummary").textContent="尚未组队";$("#partyKnights").innerHTML='<p class="rule-note">先选择主游戏骑士，再组建本次出征队伍。</p>';$("#squireSlots").innerHTML="";return;
  }
  const squires=normalizedSquires(party);
  $("#partySummary").textContent=`${party.length} 名骑士 ＋ ${squires.length} 名侍从`;
  $("#partyKnights").innerHTML=knightSheets().map(sheet=>{
    const count=party.filter(id=>id===sheet.id).length,isLeader=sheet.id===leader;
    return `<label class="party-knight ${isLeader?"leader":""}"><input type="checkbox" data-party-sheet="${sheet.id}" ${count?"checked":""} ${isLeader?"disabled":""}><span>${esc(sheet.title||sheet.state?.knight||"未命名骑士")}${isLeader?" · 主骑士":""}</span></label>`;
  }).join("");
  $("#squireSlots").innerHTML=squires.length?squires.map((id,index)=>{
    const item=squireCatalog.find(entry=>entry.id===id);
    return `<div class="squire-slot"><strong>席位 ${party.length+index+1} · 侍从</strong><button class="squire-picker" type="button" data-squire-picker="${index}"><img src="/assets/heroes/${id}-avatar.jpg" alt=""><span>${esc(item?.name||id)}<small>${esc(item?.en||"")} · 点击更换</small></span></button></div>`;
  }).join(""):'<div class="party-complete">4 名骑士已齐，无需侍从补位。</div>';
}
function openSquireDialog(index){
  const party=normalizedParty(),squires=normalizedSquires(party),selectedId=squires[index];if(!selectedId)return;
  activeSquireSlot=index;const used=new Set(squires.filter((_,i)=>i!==index));
  $("#squireGallery").innerHTML=squireCatalog.map(item=>`<button class="knight-choice ${item.id===selectedId?"selected":""}" type="button" role="radio" aria-checked="${item.id===selectedId}" data-squire-choice="${item.id}" ${used.has(item.id)?"disabled":""}><img src="/assets/heroes/${item.id}-avatar.jpg" alt=""><span>${esc(item.name)} · ${esc(item.en)}</span></button>`).join("");
  $("#squireDialog").showModal();
}
function hideGameViews(){$$("#mapModule,#encounterModule,#aibpModule").forEach(el=>el.classList.add("hidden"))}
function showOverview(){
  viewMode="overview";hideGameViews();$("#sheetForm").classList.add("hidden");$("#emptyState").classList.add("hidden");$("#overview").classList.remove("hidden");setActiveModuleNav();
  const virtueNames={bravery:"勇",tenacity:"顽",sagacity:"睿",fortitude:"坚",might:"威",insight:"洞"};
  $("#overviewGrid").innerHTML=sheets.map(sheet=>{const s=sheet.state||{},story=s.story||[],done=story.reduce((n,c)=>n+(c.quest?1:0)+(c.investigations||[]).filter(i=>i.attempted).length,0);
    const virtues=Object.entries(s.virtues||{}).map(([k,v])=>`<span title="${k}">${virtueNames[k]||k} <b>${v.value??0}</b></span>`).join("");
    const valid=isKnightSheet(sheet),leader=valid&&gameSettings.leaderSheetId===sheet.id;
    return `<article class="overview-card" data-open-sheet="${sheet.id}" tabindex="0"><header><div><small>${esc(s.knight||"未命名身份")}</small><h2>${leader?'<span class="leader-name-mark" aria-label="当前主游戏骑士">♜</span> ':''}${esc(sheet.title||s.knight||"未命名骑士")}</h2>${!valid?'<span class="leader-ribbon">此身份属于侍从，旧档案仅保留数据</span>':""}</div><span class="chapter-badge">${Math.min(5,Math.floor(done/4)+1)} 章</span></header><div class="overview-resources"><span>灾祸 <b>${s.bane??0}</b></span><span>金钱 <b>${s.gold??0}</b></span><span>旁证 <b>${s.leads??0}</b></span><span>叹息 <b>${s.sigh??0}</b></span></div><div class="overview-virtues">${virtues}</div><section class="overview-notes"><strong>笔记</strong><p>${s.notes?esc(s.notes):'<span class="subtle">暂无笔记</span>'}</p></section><footer><span>故事进度 ${done}/20</span><div class="progress"><i style="width:${done/20*100}%"></i></div><button class="button" data-edit-sheet="${sheet.id}">打开记录表</button>${valid&&!leader?`<button class="button leader-button" data-leader-sheet="${sheet.id}">设为主游戏骑士</button>`:""}</footer></article>`}).join("")||'<div class="overview-empty"><div class="crest">♜</div><h2>还没有骑士档案</h2><p>建立第一张记录表，开始你的故事。</p></div>';
  renderEncounterBuilder();
  renderMonsterPool();
}
function showModule(name){
  viewMode=name;$("#overview").classList.add("hidden");$("#sheetForm").classList.add("hidden");$("#emptyState").classList.add("hidden");hideGameViews();
  $(`#${name}Module`)?.classList.remove("hidden");setActiveModuleNav();renderCurrentModule();closeSidebar();
}
function setActiveModuleNav(){$$(".module-nav [data-module]").forEach(button=>button.classList.toggle("active",button.dataset.module===viewMode))}
function renderCurrentModule(){
  if(!campaignState)return;
  if(viewMode==="overview")return showOverview();
  if(viewMode==="map")renderMap();
  if(viewMode==="encounter")renderEncounter();
  if(viewMode==="aibp")renderAIBP();
}
function renderMap(){
  const m=campaignMapState(),districts=campaignState.monsterPool?.districts||[];$("#districtWheel").innerHTML=districts.map((card,index)=>`<article class="district-card">${monsterAvatarMarkup(card.name,"district-monster-avatar")}<div class="district-monster-copy"><strong>区域 ${index+1}</strong><span>${esc(card.name)} <b>Lv.${card.level}</b></span></div><button class="button" data-start-district="${index}">开始遭遇</button></article>`).join("")||"<p>请先在骑士团总览生成怪物池。</p>";
  $("#partyTile").value=m.partyTile||"";$("#mapRound").value=m.round||0;$("#mapMarkers").innerHTML=(m.markers||[]).map((marker,index)=>`<span class="tag">${esc(marker)} <button data-remove-marker="${index}">×</button></span>`).join("");
  const available=mapTilesForKingdom(),known=new Set(m.tiles||[]);
  $("#mapTileSelect").innerHTML=available.filter(tile=>!known.has(tile.id)).map(tile=>`<option value="${esc(tile.id)}">${esc(tile.id)} · ${tile.size}</option>`).join("")||"<option value=''>本王国板块已全部加入</option>";
  $("#mapTiles").innerHTML=[...(m.tiles||[])].map(id=>available.find(tile=>tile.id===id)).filter(Boolean).map(tile=>`<figure class="map-tile"><img loading="lazy" src="/${esc(tile.image.face)}" alt="${esc(tile.id)}"><figcaption><span>${esc(tile.id)} · ${esc(tile.size)}</span><button title="移除板块" data-remove-tile="${esc(tile.id)}">×</button></figcaption></figure>`).join("")||"<p>尚未加入地图板块。</p>";
}
function renderEncounter(){
  const e=campaignState.encounter||{};$("#encounterMonster").innerHTML=bestiaryMonsters.map(name=>`<option ${e.monster===name?"selected":""}>${name}</option>`).join("");$("#encounterLevel").value=String(e.level||1);$("#encounterType").value=e.type||"normal";
  const monster=encounterRecord(e.monster),level=monster?.encounterLevels?.find(item=>item.level===Number(e.level)),stats=level?.stats||{};
  const facts=level?`<div class="encounter-facts"><span>数量 <b>${stats.monsterCount??"—"}</b></span><span>体型 <b>${stats.monsterSize??"—"}</b></span><span>命中 <b>${stats.hit||"—"}</b></span><span>成功值 <b>${stats.success??"—"}</b></span><span>部分成功 <b>${stats.partial??"—"}</b></span></div><p class="attack-pattern">攻击格：${(level.attackPattern||[]).map(point=>`[${point.join(", ")}]`).join(" ")||"依遭遇卡"}</p>`:"";
  $("#encounterStatus").textContent=e.active?"进行中":"未开始";$("#activeEncounter").innerHTML=e.active?`<h3>${esc(e.monster)} · Lv.${e.level}</h3><p>${e.type==="ambush"?"伏击":e.type==="special"?"特殊遭遇":"普通遭遇"} · ${esc(e.phase||"setup")}</p>${facts}`:"<p>当前没有活动遭遇。</p>";
  $("#encounterBoardNotes").value=e.board?.notes||"";$("#encounterCasualties").value=e.resultDetails?.casualties||"";$("#encounterRewards").value=e.resultDetails?.rewards||"";$$(".encounter-results button").forEach(button=>button.disabled=!e.active);
}
function renderAIBP(){
  const a=campaignState.aibp||{};$("#aibpMonster").textContent=a.monster?`${a.monster} · Lv.${a.level}`:"等待遭遇";
  $("#aiDeck").innerHTML=`${a.activeAI?`<span class="playing-card active-card">当前：${esc(cardLabel(a.activeAI))}</span>`:""}<small class="deck-count">牌库 ${a.ai?.length||0} · 弃牌 ${a.discard?.length||0}</small>${(a.ai||[]).slice(0,6).map(card=>`<span class="playing-card">${esc(cardLabel(card))}</span>`).join("")||(!a.activeAI?"<p>开始遭遇后初始化。</p>":"")}`;
  $("#bpDeck").innerHTML=`${a.activeBP?`<span class="playing-card active-card">当前：${esc(cardLabel(a.activeBP))}</span>`:""}<small class="deck-count">牌库 ${a.bp?.length||0} · 损伤 ${a.wounds?.length||0}</small>${(a.bp||[]).slice(0,6).map(card=>`<span class="playing-card">${esc(cardLabel(card))}</span>`).join("")||(!a.activeBP?"<p>暂无 BP 记录。</p>":"")}`;$("#promotionLevel").value=a.promotion||0;
  $("#aibpHistory").innerHTML=(a.history||[]).slice().reverse().map(item=>`<div class="event-item">${esc(item.text)}<small>${new Date(item.at).toLocaleString()}</small></div>`).join("");
}
const investigationHasNumber=value=>value!==""&&value!==null&&value!==undefined&&value!==false;
function talePosition(sheet){
  const story=sheet?.state?.story||[];let deepest=-1;
  story.forEach((c,ci)=>{if(c.quest)deepest=Math.max(deepest,ci*4);(c.investigations||[]).forEach((v,ii)=>{if(investigationHasNumber(v.success))deepest=Math.max(deepest,ci*4+ii+1)})});
  const row=deepest<0?0:deepest;return {row,chapter:Math.floor(row/4)+1,label:row%4===0?"任务":`调查 ${row%4}`,empty:deepest<0};
}
function renderEncounterBuilder(){
  const eligible=knightSheets(),leader=eligible.find(s=>s.id===gameSettings.leaderSheetId);
  $("#leaderSelect").innerHTML='<option value="">请选择</option>'+eligible.map(s=>`<option value="${s.id}">${esc(s.title||s.state?.knight||"未命名骑士")}</option>`).join("");
  $("#leaderSelect").value=leader?.id||"";$("#kingdomSelect").value=gameSettings.kingdom||"sunken";gameSettings.districts=gameSettings.kingdom==="sunken"?3:4;$("#districtCount").textContent=gameSettings.kingdom==="sunken"?"沉没王国：3":"巨石王国：4";
  if($("#devourDragonRule"))$("#devourDragonRule").checked=Boolean(gameSettings.devourDragon);
  const pos=talePosition(leader);$("#talePosition").textContent=leader?`第 ${pos.chapter} 章 · ${pos.label}${pos.empty?"（尚无标记，按起始行）":""}`:"请选择主游戏骑士";
  const pool=leader?poolForRow(pos.row,gameSettings.kingdom):[];
  $("#autoPoolPreview").innerHTML=leader?pool.map(card=>`<span class="pool-preview-card">${monsterAvatarMarkup(card.name,"pool-preview-avatar")}<span><strong>${esc(card.name)}</strong><small>Lv.${card.level}</small></span></span>`).join(""):"选择主游戏骑士后自动生成";
  renderPartyBuilder();
}
function readGameSettings(){gameSettings.leaderSheetId=$("#leaderSelect").value;gameSettings.kingdom=$("#kingdomSelect").value;gameSettings.districts=gameSettings.kingdom==="sunken"?3:4;gameSettings.devourDragon=Boolean($("#devourDragonRule")?.checked);return gameSettings}
async function saveGameSettings(){readGameSettings();campaignOp("leaderSheetId",gameSettings.leaderSheetId);campaignOp("kingdom",gameSettings.kingdom);campaignOp("optionalRules.devourDragon",gameSettings.devourDragon);commitParty(campaignState.party||[]);showOverview();toast("主游戏与出征队伍已保存")}
function generateMonsterPool(){
  readGameSettings();const leader=knightSheets().find(s=>s.id===gameSettings.leaderSheetId);if(!leader)return toast("请先选择主游戏骑士");
  if(campaignState.monsterPool?.cards?.length&&!confirm("重新生成会替换当前区域怪物。继续吗？"))return;
  const pos=talePosition(leader),source=poolForRow(pos.row,gameSettings.kingdom);if(!source.length)return toast("当前故事行没有可用怪物");
  campaignOp("optionalRules.devourDragon",gameSettings.devourDragon);
  const result=drawMonsterPoolCards(source,gameSettings.districts,gameSettings.devourDragon);
  saveMonsterPool(source,result.selected,pos,result.rule);
}
function saveMonsterPool(source,selected,pos,devourDragon={enabled:gameSettings.devourDragon,drawn:false,boundIndex:null,boundMonster:"",conflictLocation:""}){
  const leader=knightSheets().find(s=>s.id===gameSettings.leaderSheetId),previous=campaignState.monsterPool||{},history=[...(previous.history||[])];if(previous.cards?.length)history.push({at:new Date().toISOString(),kingdom:previous.kingdom,row:previous.row,cards:previous.cards,districts:previous.districts,devourDragon:previous.devourDragon});
  const districts=selected.map((card,index)=>({...card,district:index+1})),pool={kingdom:gameSettings.kingdom,row:pos.row,cards:source,districts,devourDragon,history:history.slice(-10)};
  campaignOp("kingdom",gameSettings.kingdom);campaignOp("monsterPool",pool);campaignOp("map.activeKingdom",gameSettings.kingdom);
  renderMonsterPool(pool,leader,pos);renderEncounterBuilder();
}
function openMonsterPoolDialog(){
  readGameSettings();const leader=knightSheets().find(s=>s.id===gameSettings.leaderSheetId);if(!leader)return toast("请先选择主游戏骑士");
  const pos=talePosition(leader),source=poolForRow(pos.row,gameSettings.kingdom);if(source.length<gameSettings.districts)return toast("当前故事行没有足够的可选怪物");
  const current=campaignState.monsterPool?.row===pos.row&&campaignState.monsterPool?.kingdom===gameSettings.kingdom?campaignState.monsterPool.districts||[]:[];
  $("#monsterPoolChoices").innerHTML=Array.from({length:gameSettings.districts},(_,district)=>`<label>区域 ${district+1}<select data-pool-choice="${district}">${source.map((card,index)=>`<option value="${card.index}" ${card.index===(current[district]?.index??source[district]?.index)?"selected":""}>${esc(card.name)} · Lv.${card.level}</option>`).join("")}</select></label>`).join("");
  $("#monsterPoolDialog").showModal();
}
function saveChosenMonsterPool(){
  readGameSettings();const leader=knightSheets().find(s=>s.id===gameSettings.leaderSheetId);if(!leader)return toast("请先选择主游戏骑士");
  const pos=talePosition(leader),source=poolForRow(pos.row,gameSettings.kingdom),choices=$$("[data-pool-choice]",$("#monsterPoolChoices")).map(select=>Number(select.value));
  if(new Set(choices).size!==choices.length)return toast("每个区域需要选择不同的怪物");
  const selected=choices.map(index=>source.find(card=>card.index===index));if(selected.some(card=>!card))return toast("怪物选项已变化，请重新选择");
  if(campaignState.monsterPool?.cards?.length&&!confirm("自选结果会替换当前区域怪物。继续吗？"))return;
  saveMonsterPool(source,selected,pos);$("#monsterPoolDialog").close();toast("自选怪物池已保存");
}
function renderMonsterPool(pool=campaignState?.monsterPool,leader=knightSheets().find(s=>s.id===gameSettings.leaderSheetId),pos=leader?talePosition(leader):{row:0}){
  if(!pool?.cards?.length){$("#monsterPool").classList.add("hidden");return}$("#monsterPool").classList.remove("hidden");
  const dragonNotice=pool.devourDragon?.drawn?`<div class="devour-dragon-notice"><strong>贪食巨龙来了！</strong><span>${pool.devourDragon.boundMonster?`已与 ${esc(pool.devourDragon.boundMonster)} 绑定；该怪物的冲突在巨兽之腹中进行。`:"本次抽到的均为国王或巨龙，没有进行绑定。"}</span></div>`:"";
  $("#monsterPool").innerHTML=`<strong>${esc(leader?.title||leader?.state?.knight||"主骑士")} · 比对卡第 ${pos.row+1} 行 · 牌池 ${pool.cards.length} 张</strong>${dragonNotice}<div class="pool-cards">${(pool.districts||[]).map((c,i)=>`<button class="monster-card ${c.devourDragonBound?"devour-bound":""}" type="button" data-original-encounter="${i}" title="打开 ${esc(c.name)} 遭遇">${monsterAvatarMarkup(c.name)}<span><small>区域 ${i+1}${c.devourDragonBound?" · 巨兽之腹":""}</small><strong>${esc(c.name)}</strong><b>Lv.${c.level}</b></span></button>`).join("")}</div>`;
}
function renderAll(title){
  hideGameViews();$("#overview").classList.add("hidden");$("#emptyState").classList.add("hidden");$("#sheetForm").classList.remove("hidden");$("#sheetTitle").value=title;setActiveModuleNav();
  $("#virtues").innerHTML=virtueMeta.map(([k,cn,en,vice])=>`<div class="virtue"><img class="virtue-icon" src="assets/sheet-icons/${k}.png" alt="" aria-hidden="true"><div class="virtue-name"><strong>${cn} <small>${en}</small></strong><span>${vice}</span></div><input data-path="virtues.${k}.value" type="number" min="-99" max="99"><div class="vice-checks">${[0,1,2,3].map(i=>check(`virtues.${k}.vice.${i}`,"box-check",`${vice} ${i+1}`)).join("")}</div></div>`).join("");
  const chapterRanks=[["杂兵","MOBS"],["封臣","VASSAL"],["国王","KING"],["恶魔","DEVIL"],["巨龙","DRAGON"]];
  $("#story").innerHTML=state.story.map((c,ci)=>{
    const [rankCn,rankEn]=chapterRanks[ci]||["层级","RANK"];
    return `<div class="chapter"><div class="chapter-rank"><strong>${rankCn}</strong><small>${rankEn}</small><span>层次</span></div><div class="chapter-table"><div class="chapter-head"><span>第${"一二三四五"[ci]}章</span><em>任务</em>${check(`story.${ci}.quest`,"box-check","任务")}</div>${c.investigations.map((v,ii)=>`<div class="investigation"><span>调查 ${ii+1}</span><input class="investigation-number" data-path="story.${ci}.investigations.${ii}.success" data-investigation-success type="number" min="0" max="99" step="1" inputmode="numeric" aria-label="调查 ${ii+1} 数字">${check(`story.${ci}.investigations.${ii}.attempted`,"box-check","已进行")}</div>`).join("")}</div></div>`;
  }).join("");
  $("#sheetKnightIdentity").value=state.knight||knightCatalog.find(item=>item.id===state.knightId)?.name||"";
  renderRapport();renderMatrix();["armory","saints","mercenaries"].forEach(renderList);renderValues();renderLists()
}
const check=(path,cls,label,enabled=true)=>`<label class="${cls}" title="${label}"><input data-path="${path}" type="checkbox" ${enabled?"":"disabled"}><span>${cls==="matrix-check"?label:""}</span></label>`;
const investigationSuccessValue=value=>{
  if(value===false||value==null||value==="")return "";
  const numeric=value===true?1:Number(value);
  return Number.isFinite(numeric)?Math.max(0,Math.min(99,Math.trunc(numeric))):""
};
function rapportHearts(value){
  if(Array.isArray(value))return [0,1,2].map(index=>Boolean(value[index]));
  const count=Math.max(0,Math.min(3,Number(value)||0));
  return [0,1,2].map(index=>index<count)
}
function renderRapport(){$("#rapport").innerHTML=state.rapport.map((r,i)=>`<div class="rapport-row"><input data-path="rapport.${i}.knight" placeholder="骑士姓名" maxlength="80"><div class="hearts">${[1,2,3].map(n=>`<label class="heart-check"><input type="checkbox" data-heart="${i}.${n}"><span></span></label>`).join("")}</div><input data-path="rapport.${i}.favor" placeholder="恩惠" maxlength="300"><button type="button" class="remove-row no-print" data-remove-rapport="${i}" aria-label="删除亲和力">×</button></div>`).join("")}
function renderMatrix(){
  const unlocked=Boolean(state.choicesUnlocked);$("#matrixLock").textContent=unlocked?"锁定矩阵":"解锁矩阵";$("#matrixLock").classList.toggle("unlocked",unlocked);$("#choices").classList.toggle("locked",!unlocked);
  $("#choices").innerHTML=[...Array.from({length:30},(_,i)=>String(i+1).padStart(2,"0")),...Array.from({length:10},(_,i)=>`E${i+1}`)].map(k=>check(`choices.${k}`,"matrix-check",k,unlocked)).join("");
  $("#successes").innerHTML=Array.from({length:25},(_,i)=>`${Math.floor(i/5)+1}-${i%5+1}`).map(k=>check(`successfulInvestigations.${k}`,"matrix-check",k)).join("")
}
function renderList(name){const arr=state[name];$(`#${name}`).innerHTML=arr.map((v,i)=>`<div class="list-row"><input data-path="${name}.${i}" maxlength="300"><button type="button" class="remove-row no-print" data-remove-list="${name}.${i}">×</button></div>`).join("")}
function renderValues(){
  if(!state)return;$$("[data-path]",$("#sheetForm")).forEach(el=>{const v=pathGet(state,el.dataset.path);if(document.activeElement===el)return;if(el.type==="checkbox")el.checked=Boolean(v);else el.value=el.hasAttribute("data-investigation-success")?investigationSuccessValue(v):v??""});
  $$("[data-heart]").forEach(el=>{const[i,n]=el.dataset.heart.split(".").map(Number);el.checked=rapportHearts(state.rapport[i]?.hearts)[n-1]})
}
function esc(s){const d=document.createElement("div");d.textContent=s;return d.innerHTML}
function closeSidebar(){$("#sidebar").classList.remove("open");$("#scrim").classList.remove("open")}
function secondScreenUrl(){
  if(window.KFAndroidFiles?.lanDisplayUrl)return String(window.KFAndroidFiles.lanDisplayUrl(activeCampaign||"")||"");
  return new URL(`/modules/display/?campaignId=${encodeURIComponent(activeCampaign||"")}`,location.href).href
}
function refreshDisplayUrlHint(){const output=$("#displayUrlHint");if(!output)return;const url=secondScreenUrl();output.textContent=url||"请连接 Wi-Fi 或开启手机热点"}
$("#authMode").onclick=()=>{isRegister=!isRegister;$("#authSubmit").textContent=isRegister?"注册":"登录";$("#authMode").textContent=isRegister?"已有账号？登录":"没有账号？注册";$("#authPassword").autocomplete=isRegister?"new-password":"current-password"};
$("#authForm").onsubmit=async e=>{e.preventDefault();try{const route=isRegister?"register":"login";const data=await api(`/api/auth/${route}`,{method:"POST",body:JSON.stringify({username:$("#authUsername").value,password:$("#authPassword").value})});user=data.user;await showApp()}catch(err){$("#authHint").textContent=err.message}};
$("#logoutButton").onclick=async()=>{await api("/api/auth/logout",{method:"POST"});user=null;active=null;state=null;campaigns=[];activeCampaign=null;campaignState=null;sharedSettings={storyMarkers:{},passwords:[]};sharedSettingsDirty=false;renderPermanentStoryMarkers();renderPasswordRecords();showAuth()};
$("#menuButton").onclick=()=>{$("#sidebar").classList.add("open");$("#scrim").classList.add("open");refreshDisplayUrlHint()};$("#closeSidebar").onclick=$("#scrim").onclick=closeSidebar;
$("#searchSheets").oninput=e=>{search=e.target.value;renderLists()};
$("#permanentStoryMarkerGroups").onchange=e=>{const input=e.target.closest("[data-permanent-story-marker]");if(!input)return;const id=input.dataset.permanentStoryMarker;if(!permanentStoryMarkerIds.has(id))return;if(input.checked)sharedSettings.storyMarkers[id]=true;else delete sharedSettings.storyMarkers[id];renderPermanentStoryMarkers();queueSharedSettingsSave()};
$("#addPasswordRecord").onclick=()=>{sharedSettings.passwords.push({id:compatibleUuid().replace(/-/g,""),matrix:Array(6).fill("dot"),number:""});renderPasswordRecords();queueSharedSettingsSave()};
$("#passwordRecords").addEventListener("click",e=>{
  const row=e.target.closest("[data-password-record]");if(!row)return;const index=sharedSettings.passwords.findIndex(record=>record.id===row.dataset.passwordRecord);if(index<0)return;
  const cell=e.target.closest("[data-password-cell]");if(cell){const position=Number(cell.dataset.passwordCell),current=sharedSettings.passwords[index].matrix[position],next=passwordSymbolOrder[(passwordSymbolOrder.indexOf(current)+1)%passwordSymbolOrder.length];sharedSettings.passwords[index].matrix[position]=next;renderPasswordRecords();queueSharedSettingsSave();return}
  if(e.target.closest("[data-remove-password]")){sharedSettings.passwords.splice(index,1);renderPasswordRecords();queueSharedSettingsSave()}
});
$("#passwordRecords").addEventListener("input",e=>{const input=e.target.closest("[data-password-number]"),row=e.target.closest("[data-password-record]");if(!input||!row)return;const record=sharedSettings.passwords.find(item=>item.id===row.dataset.passwordRecord);if(!record)return;const cleaned=input.value.replace(/\D/g,"").slice(0,8);if(input.value!==cleaned)input.value=cleaned;record.number=cleaned;queueSharedSettingsSave()});
$("#sheetList").onclick=e=>{const b=e.target.closest("[data-sheet]");if(b)openSheet(b.dataset.sheet)};
$("#overviewButton").onclick=()=>{showOverview();closeSidebar()};
$(".module-nav").onclick=e=>{const button=e.target.closest("[data-module]");if(button)button.dataset.module==="overview"?showOverview():showModule(button.dataset.module)};
$("#campaignSelect").onchange=async e=>{await syncCampaign();active=null;state=null;await loadCampaigns(e.target.value);await refreshLists();showOverview()};
$("#newCampaign").onclick=async()=>{const name=prompt("新战役名称","新的 KF 战役");if(!name)return;const data=await api("/api/campaigns",{method:"POST",body:JSON.stringify({name})});await loadCampaigns(data.campaign.id);await refreshLists();showOverview()};
$("#renameCampaign").onclick=async()=>{const current=campaigns.find(c=>c.id===activeCampaign),name=prompt("战役名称",current?.name||"");if(!name)return;await api(`/api/campaigns/${activeCampaign}`,{method:"PATCH",body:JSON.stringify({name})});await loadCampaigns(activeCampaign);toast("战役已重命名")};
$("#copyCampaign").onclick=async()=>{if(!confirm("复制当前战役及其中全部骑士？"))return;const data=await api(`/api/campaigns/${activeCampaign}/copy`,{method:"POST"});await loadCampaigns(data.id);await refreshLists();showOverview();toast("战役副本已建立")};
$("#trashCampaign").onclick=async()=>{if(!confirm("将当前战役移入回收站？"))return;await api(`/api/campaigns/${activeCampaign}/trash`,{method:"POST"});await loadCampaigns();await refreshLists();showOverview()};
$("#restoreCampaign").onclick=async()=>{
  const data=await api("/api/campaigns?trash=1"),items=data.campaigns||[];if(!items.length)return toast("战役回收站为空");
  const answer=prompt(`输入要恢复的序号：\n${items.map((item,index)=>`${index+1}. ${item.name}`).join("\n")}`,"1"),index=Number(answer)-1;if(!items[index])return;
  await api(`/api/campaigns/${items[index].id}/restore`,{method:"POST"});await loadCampaigns(items[index].id);await refreshLists();showOverview();toast("战役已恢复")
};
$("#overview").onclick=e=>{const leader=e.target.closest("[data-leader-sheet]");if(leader){e.stopPropagation();gameSettings.leaderSheetId=leader.dataset.leaderSheet;$("#leaderSelect").value=gameSettings.leaderSheetId;saveGameSettings();return}const target=e.target.closest("[data-edit-sheet],[data-open-sheet]");if(target)openSheet(target.dataset.editSheet||target.dataset.openSheet)};
$("#overview").onkeydown=e=>{if((e.key==="Enter"||e.key===" ")&&e.target.matches("[data-open-sheet]")){e.preventDefault();openSheet(e.target.dataset.openSheet)}};
$("#overviewNew").onclick=()=>$("#newSheet").click();
$("#openDisplay").onclick=()=>{const url=secondScreenUrl();if(!url)return toast("请先连接 Wi-Fi 或开启手机热点");if(window.KFAndroidFiles?.openExternalUrl)window.KFAndroidFiles.openExternalUrl(url);else window.open(url,"kf-second-screen","noopener")};
$("#copyDisplayUrl").onclick=async()=>{const url=secondScreenUrl();if(!url)return toast("请先连接 Wi-Fi 或开启手机热点");try{await navigator.clipboard.writeText(url);toast(`第二屏局域网地址已复制：${url}`)}catch{toast("无法访问剪贴板")}};
$("#mapScale").oninput=e=>{$("#mapScaleValue").textContent=`${e.target.value}%`};
$("#mapScale").onchange=e=>campaignOp("presentation.settings.mapScale",Math.max(50,Math.min(200,Number(e.target.value)||100)));
$("#conflictScale").oninput=e=>{$("#conflictScaleValue").textContent=`${e.target.value}%`};
$("#conflictScale").onchange=e=>campaignOp("presentation.settings.conflictScale",Math.max(50,Math.min(200,Number(e.target.value)||100)));
$("#rotateConflict").onclick=()=>{const settings=presentationSettings();campaignOp("presentation.settings.conflictRotation",(portraitConflictRotation(settings.conflictRotation)+90)%360);renderPresentationControls()};
$("#swapConflict").onclick=()=>{const settings=presentationSettings();campaignOp("presentation.settings.conflictSwapped",!settings.conflictSwapped);renderPresentationControls()};
$("#toggleConflictBoard").onclick=()=>{const settings=presentationSettings();campaignOp("presentation.settings.conflictBoardVisible",settings.conflictBoardVisible===false);renderPresentationControls()};
$("#leaderSelect").onchange=e=>{gameSettings.leaderSheetId=e.target.value;campaignOp("leaderSheetId",gameSettings.leaderSheetId);commitParty(campaignState.party||[]);renderEncounterBuilder()};
$("#kingdomSelect").onchange=e=>{gameSettings.kingdom=e.target.value;renderEncounterBuilder()};
$("#devourDragonRule").onchange=e=>{gameSettings.devourDragon=e.target.checked};
$("#partyKnights").onchange=e=>{
  const input=e.target.closest("[data-party-sheet]");if(!input)return;
  let party=normalizedParty();
  if(input.checked){if(party.length>=4){input.checked=false;return toast("出征队伍最多 4 名角色");}party.push(input.dataset.partySheet)}
  else party=party.filter(id=>id!==input.dataset.partySheet);
  commitParty(party);
};
$("#squireSlots").onclick=e=>{const button=e.target.closest("[data-squire-picker]");if(button)openSquireDialog(Number(button.dataset.squirePicker))};
$("#closeSquireDialog").onclick=()=>$("#squireDialog").close();
$("#squireGallery").onclick=e=>{
  const choice=e.target.closest("[data-squire-choice]");if(!choice||choice.disabled||activeSquireSlot<0)return;
  const party=normalizedParty(),squires=normalizedSquires(party);squires[activeSquireSlot]=choice.dataset.squireChoice;
  campaignOp("squires",normalizedSquires(party,squires));$("#squireDialog").close();activeSquireSlot=-1;renderPartyBuilder();
};
$("#saveGameSettings").onclick=()=>saveGameSettings().catch(e=>toast(e.message));
$("#generatePool").onclick=generateMonsterPool;
$("#choosePool").onclick=openMonsterPoolDialog;
$("#closeMonsterPoolDialog").onclick=$("#cancelMonsterPoolDialog").onclick=()=>$("#monsterPoolDialog").close();
$("#monsterPoolForm").onsubmit=e=>{e.preventDefault();saveChosenMonsterPool()};
$("#undoPool").onclick=()=>{const current=campaignState.monsterPool||{},history=[...(current.history||[])],previous=history.pop();if(!previous)return toast("没有可撤销的怪物池");const restored={kingdom:previous.kingdom||campaignState.kingdom,row:previous.row,cards:previous.cards,districts:previous.districts,devourDragon:previous.devourDragon,history};campaignOp("monsterPool",restored);renderMonsterPool(restored);renderEncounterBuilder();toast("已恢复上一组区域怪物")};
$("#trashList").onclick=async e=>{const b=e.target.closest("[data-sheet]");if(b&&confirm("恢复这张档案？")){await api(`/api/sheets/${b.dataset.sheet}/restore`,{method:"POST"});refreshLists()}};
function openNewKnightDialog(){
  const first=knightCatalog[0];
  if(!first)return toast("暂无可用骑士");
  $("#newKnightGallery").innerHTML=knightCatalog.map(item=>`<button class="knight-choice ${item.id===first.id?"selected":""}" type="button" role="radio" aria-checked="${item.id===first.id}" data-knight-choice="${item.id}"><img src="/assets/heroes/${item.id}-avatar.jpg" alt=""><span>${esc(item.name)}</span></button>`).join("");
  $("#newKnightIdentity").value=first.id;
  $("#newKnightTitle").value="";$("#newKnightTitle").placeholder=`默认：${first.name}`;$("#newKnightPlayer").value="";$("#newKnightDialog").showModal();
}
$("#newSheet").onclick=openNewKnightDialog;
$("#closeKnightDialog").onclick=$("#cancelKnightDialog").onclick=()=>$("#newKnightDialog").close();
$("#newKnightGallery").onclick=e=>{const choice=e.target.closest("[data-knight-choice]");if(!choice||choice.disabled)return;$("#newKnightIdentity").value=choice.dataset.knightChoice;$$("[data-knight-choice]",$("#newKnightGallery")).forEach(button=>{const selected=button===choice;button.classList.toggle("selected",selected);button.setAttribute("aria-checked",String(selected))});$("#newKnightTitle").placeholder=`默认：${knightCatalog.find(item=>item.id===choice.dataset.knightChoice)?.name||"骑士名"}`};
$("#newKnightForm").onsubmit=async e=>{
  e.preventDefault();
  try{
    const d=await api("/api/sheets",{method:"POST",body:JSON.stringify({campaignId:activeCampaign,knightId:$("#newKnightIdentity").value,title:$("#newKnightTitle").value,player:$("#newKnightPlayer").value})});
    $("#newKnightDialog").close();await refreshLists();await openSheet(d.sheet.id);toast(`已建立 ${d.sheet.title} 的骑士档案`);
  }catch(error){toast(error.message)}
};
$("#sheetTitle").onchange=async e=>{if(!active)return;await api(`/api/sheets/${active}`,{method:"PATCH",body:JSON.stringify({title:e.target.value})});refreshLists()};
$("#deleteSheet").onclick=async()=>{if(confirm("将这张档案移入回收站？30 天内可以恢复。")){await api(`/api/sheets/${active}/trash`,{method:"POST"});active=null;await refreshLists()}};
function knightExportPayload(){return {format:"kf-unified-knight",schemaVersion:1,exportedAt:new Date().toISOString(),sheet:{title:$("#sheetTitle").value||state?.knight||"骑士档案",state:structuredClone(state)}}}
$("#exportKnight").onclick=()=>{if(!state)return toast("请先打开一张骑士档案");download(`kf-knight-${state.knightId||"sheet"}.json`,knightExportPayload());toast("骑士档案已导出")};
$("#importKnightFile").onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const payload=JSON.parse(await file.text());if(payload?.format!=="kf-unified-knight"||payload?.schemaVersion!==1||!payload?.sheet?.state)throw new Error("只支持 KF 骑士档案（版本 1）");const knightId=payload.sheet.state.knightId;if(!knightCatalog.some(item=>item.id===knightId))throw new Error("导入文件包含无效的骑士身份");await sync();let result;try{result=await api("/api/sheet-import",{method:"POST",body:JSON.stringify(payload)})}catch(error){if(error.status!==409||!error.data?.sheetId||!confirm(`${error.message}\n是否覆盖现有的${payload.sheet.state.knight||"骑士"}档案？`))throw error;result=await api("/api/sheet-import",{method:"POST",body:JSON.stringify({...payload,replaceSheetId:error.data.sheetId})})}await refreshLists();await openSheet(result.sheet.id);toast(result.replaced?"骑士档案已覆盖导入":"骑士档案已导入")}catch(err){toast(err.message)}finally{e.target.value=""}};
$("#sheetForm").addEventListener("input",e=>{const el=e.target;if(!el.dataset.path)return;let value=el.type==="checkbox"?el.checked:el.type==="number"&&el.hasAttribute("data-investigation-success")&&el.value===""?"":el.type==="number"?Math.max(Number(el.min||-999),Math.min(Number(el.max||99999),Number(el.value)||0)):el.value;
  op(el.dataset.path,value);renderValues()
});
$("#sheetForm").addEventListener("click",e=>{const h=e.target.closest("[data-heart]");if(h){e.preventDefault();const[i,n]=h.dataset.heart.split(".").map(Number),hearts=rapportHearts(state.rapport[i]?.hearts);hearts[n-1]=!hearts[n-1];op(`rapport.${i}.hearts`,hearts);renderValues()}
  const rr=e.target.closest("[data-remove-rapport]");if(rr){state.rapport.splice(Number(rr.dataset.removeRapport),1);op("rapport",[...state.rapport]);renderRapport();renderValues()}
  const rl=e.target.closest("[data-remove-list]");if(rl){const[name,index]=rl.dataset.removeList.split(".");state[name].splice(Number(index),1);op(name,[...state[name]]);renderList(name);renderValues()}
});
$("#addRapport").onclick=()=>{state.rapport.push({knight:"",hearts:[false,false,false],favor:""});op("rapport",[...state.rapport]);renderRapport();renderValues()};
$("#matrixLock").onclick=()=>{op("choicesUnlocked",!Boolean(state.choicesUnlocked));renderMatrix();renderValues();toast(state.choicesUnlocked?"抉择矩阵已解锁":"抉择矩阵已锁定")};
$$(".add-list").forEach(b=>b.onclick=()=>{state[b.dataset.list].push("");op(b.dataset.list,[...state[b.dataset.list]]);renderList(b.dataset.list);renderValues()});
$("#exportAll").onclick=async()=>download("kf-unified-save.json",await api(`/api/campaign-export?campaignId=${encodeURIComponent(activeCampaign)}`));
$("#importFile").onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text()),created=await api("/api/campaign-import",{method:"POST",body:JSON.stringify(data)});await Promise.all([loadCampaigns(created.id),loadSharedSettings()]);await refreshLists();showOverview();toast("存档导入完成，账号共享记录已合并")}catch(err){toast(err.message)}finally{e.target.value=""}};
$("#partyTile").onchange=e=>campaignOp(campaignMapPath("partyTile"),e.target.value.trim());$("#mapRound").onchange=e=>campaignOp(campaignMapPath("round"),Math.max(0,Number(e.target.value)||0));
$("#advanceMapRound").onclick=()=>{campaignOp(campaignMapPath("round"),(campaignMapState().round||0)+1);renderMap()};
$("#addMarker").onclick=()=>{const marker=prompt("标记名称");if(marker){campaignOp(campaignMapPath("markers"),[...(campaignMapState().markers||[]),marker]);renderMap()}};
$("#mapMarkers").onclick=e=>{const button=e.target.closest("[data-remove-marker]");if(button){const markers=[...(campaignMapState().markers||[])];markers.splice(Number(button.dataset.removeMarker),1);campaignOp(campaignMapPath("markers"),markers);renderMap()}};
$("#revealMapTile").onclick=()=>{const id=$("#mapTileSelect").value;if(!id)return;const current=campaignMapState(),tiles=[...(current.tiles||[])];if(!tiles.includes(id))tiles.push(id);campaignOp(campaignMapPath("tiles"),tiles);if(!current.partyTile)campaignOp(campaignMapPath("partyTile"),id);renderMap()};
$("#mapTiles").onclick=e=>{const button=e.target.closest("[data-remove-tile]");if(!button)return;const tiles=(campaignMapState().tiles||[]).filter(id=>id!==button.dataset.removeTile);campaignOp(campaignMapPath("tiles"),tiles);renderMap()};
$("#districtWheel").onclick=e=>{const button=e.target.closest("[data-start-district]");if(!button)return;const card=campaignState.monsterPool.districts[Number(button.dataset.startDistrict)];openEncounterAssistant(card.name,card.level,"normal")};
function openEncounterAssistant(monster,level,type){
  const encounter=encounterRecord(monster);
  localStorage.setItem("kfEncounterHandoff",JSON.stringify({
    id:compatibleUuid(),campaignId:activeCampaign,source:"overview",
    monsterId:encounter?.id||"",monster,level:Number(level)||1,type:type||"normal",returnUrl:"/"
  }));
  location.href="/modules/encounter/"
}
function startEncounterFrom(monster,level,type){openEncounterAssistant(monster,level,type)}
$("#startEncounter").onclick=()=>startEncounterFrom($("#encounterMonster").value,Number($("#encounterLevel").value),$("#encounterType").value);
$(".encounter-results").onclick=async e=>{const button=e.target.closest("[data-result]");if(!button)return;const data=await api("/api/encounters/complete",{method:"POST",body:JSON.stringify({campaignId:activeCampaign,result:button.dataset.result,casualties:$("#encounterCasualties").value,rewards:$("#encounterRewards").value})});campaignState=data.state;campaignRevision++;renderEncounter();toast("遭遇结果已保存")};
$("#encounterBoardNotes").onchange=e=>campaignOp("encounter.board",{...(campaignState.encounter?.board||{}),notes:e.target.value});
function pushAIBP(text,changes={}){const a=campaignState.aibp||{},before=structuredClone({ai:a.ai||[],bp:a.bp||[],activeAI:a.activeAI||null,activeBP:a.activeBP||null,discard:a.discard||[],bpDamage:a.bpDamage||[],wounds:a.wounds||[],promotion:a.promotion||0}),history=[...(a.history||[]),{at:new Date().toISOString(),text}].slice(-30);campaignOp("aibp.undo",before);Object.entries(changes).forEach(([path,value])=>campaignOp(`aibp.${path}`,value));campaignOp("aibp.history",history);renderAIBP()}
$("#drawAI").onclick=()=>{const a=campaignState.aibp||{};if(a.activeAI)return toast("请先弃置当前 AI");const ai=[...(a.ai||[])],card=ai.shift();if(card)pushAIBP(`抽取 ${cardLabel(card)}`,{ai,activeAI:card});else toast("AI 牌库为空")};
$("#discardAI").onclick=()=>{const a=campaignState.aibp||{},card=a.activeAI;if(card)pushAIBP(`弃置 ${cardLabel(card)}`,{activeAI:null,discard:[...(a.discard||[]),card]});else toast("当前没有 AI")};
$("#drawBP").onclick=()=>{const a=campaignState.aibp||{};if(a.activeBP)return toast("请先处理当前 BP");const bp=[...(a.bp||[])],card=bp.shift();if(card)pushAIBP(`揭示 ${cardLabel(card)}`,{bp,activeBP:card});else toast("BP 牌库为空")};
$("#addWound").onclick=()=>{const a=campaignState.aibp||{},wounds=[...(a.wounds||[]),{at:new Date().toISOString(),card:a.activeBP||null}];pushAIBP(`记录第 ${wounds.length} 处损伤`,{wounds,activeBP:null})};
$("#promotionLevel").onchange=e=>pushAIBP(`晋升调整为 ${e.target.value}`,{promotion:Math.max(0,Math.min(4,Number(e.target.value)||0))});
$("#undoAIBP").onclick=()=>{const a=campaignState.aibp||{},before=a.undo;if(!before)return toast("没有可撤销的 AI/BP 操作");Object.entries(before).forEach(([key,value])=>campaignOp(`aibp.${key}`,value));campaignOp("aibp.undo",null);campaignOp("aibp.history",[...(a.history||[]),{at:new Date().toISOString(),text:"撤销上一步操作"}].slice(-30));renderAIBP();toast("已撤销上一步 AI/BP 操作")};
$("#printButton").onclick=()=>window.print();
addEventListener("online",()=>{setSave("正在同步…");sync();syncCampaign();if(sharedSettingsDirty)saveSharedSettings()});addEventListener("offline",()=>setSave("离线暂存",true));
setInterval(()=>{if(!user)return;if(viewMode==="edit"&&active&&!pending.length&&navigator.onLine)openSheet(active);else if(viewMode==="overview"&&navigator.onLine)refreshLists()},15000);
initOffline().finally(()=>loadSession().catch(e=>toast(e.message)));
