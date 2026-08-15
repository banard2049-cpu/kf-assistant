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
const characterData=window.KF_CHARACTER_DATA;
const characterRuntime=window.KF_CHARACTER_RUNTIME;
const mercenaryRuntime=window.KF_MERCENARY_RULES;
const harvestData=window.KF_HARVEST_DATA;
const harvestRuntime=window.KF_HARVEST_RUNTIME;
const characterTierNames={starter:"起始",mob:"杂兵",vassal:"封臣",king:"国王",devil:"恶魔",dragon:"巨龙"};
const characterTierOrder={starter:0,mob:1,vassal:2,king:3,devil:4,dragon:5};
const characterZoneNames={ready:"手牌",cooldown:"冷却",delay:"延迟",discard:"弃置"};
const runtimeCardSides={};
const outpostFilters={tier:"all",type:"all",search:""};
const outpostDistrictCatalog=[
  {id:"mercenary-guild",name:"佣兵工会",en:"MERCENARY GUILD",summary:"雇佣本次远征可用的佣兵；全队最多四名。",target:"outpostMercenarySection",interactive:true},
  {id:"scouts-guild",name:"斥候工会",en:"SCOUTS GUILD",summary:"雇佣当前及更低层次的斥候，并结算本王国的前哨增益。",target:"outpostScoutingSection"},
  {id:"saints-altar",name:"圣徒圣坛",en:"SAINTS ALTAR",summary:"弃置符合要求的虔信指示物，获得已解锁的所选圣徒卡。"},
  {id:"inn",name:"旅店",en:"INN",summary:"选择旅店效果，或投掷 d10 并结算对应结果。"},
  {id:"merchant-workshop",name:"商人工坊",en:"MERCHANT WORKSHOP",summary:"购买商人装备与消耗品，或按规则重铸装备。",target:"outpostGearSection",interactive:true},
  {id:"notice-board",name:"公告板",en:"NOTICE BOARD",summary:"为队伍签订一份符合当前层次的委托。",target:"outpostContractsSection"},
];
const outpostKingdomOverviewCatalog={
  sunken:{asset:"/assets/outpost/sunken-outpost-overview.png",label:"沉没舰队前哨站 · 王国书原版六分区总览"},
  stone:{asset:"/assets/outpost/stone-outpost-overview.png",label:"半毁堡垒前哨站 · 王国书原版六分区总览"},
};
const outpostRulebookPageCatalog={
  sunken:[
    {asset:"/assets/outpost/sunken-outpost-1.png",label:"沉没舰队前哨站：佣兵工会与斥候工会"},
    {asset:"/assets/outpost/sunken-outpost-2.png",label:"沉没舰队前哨站：圣徒圣坛、旅店、商人工坊与公告板"},
  ],
  stone:[
    {asset:"/assets/outpost/stone-outpost-1.png",label:"半毁堡垒前哨站：佣兵工会与斥候工会"},
    {asset:"/assets/outpost/stone-outpost-2.png",label:"半毁堡垒前哨站：斥候、圣徒圣坛、旅店与商人工坊"},
    {asset:"/assets/outpost/stone-outpost-3.png",label:"半毁堡垒前哨站：商人工坊、公告板与整装出发"},
  ],
};
const outpostDetailPageCatalog={
  sunken:{
    scouting:[{asset:"/assets/outpost/sunken-scouting.png",label:"沉没王国 · Scouting 完整侦察表"}],
    contracts:[
      {asset:"/assets/outpost/sunken-contracts-1.png",label:"沉没王国 · Contracts 委托页 1"},
      {asset:"/assets/outpost/sunken-contracts-2.png",label:"沉没王国 · Contracts 委托页 2"},
      {asset:"/assets/outpost/sunken-contracts-3.png",label:"沉没王国 · Contracts 委托页 3"},
    ],
  },
  stone:{
    scouting:[{asset:"/assets/outpost/stone-scouting.png",label:"巨石公国 · Scouting 完整侦察表"}],
    contracts:[
      {asset:"/assets/outpost/stone-contracts-1.png",label:"巨石公国 · Contracts 委托页 1"},
      {asset:"/assets/outpost/stone-contracts-2.png",label:"巨石公国 · Contracts 委托页 2"},
      {asset:"/assets/outpost/stone-contracts-3.png",label:"巨石公国 · Contracts 委托页 3"},
    ],
  },
};
const TTS_CARD_UNIT=120;
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
  if(!res.ok)throw new Error(data.error||"请求失败");
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
async function flushCampaignOperations(){
  clearTimeout(campaignSaveTimer);const deadline=Date.now()+1800;
  while(navigator.onLine&&(campaignSyncing||campaignPending.some(item=>item.campaignId===activeCampaign))&&Date.now()<deadline){
    if(campaignSyncing)await new Promise(resolve=>setTimeout(resolve,40));else await syncCampaign();
  }
}
function hydrateGameSettings(){if(!campaignState)return;gameSettings={leaderSheetId:campaignState.leaderSheetId||"",kingdom:campaignState.kingdom||"sunken",districts:(campaignState.kingdom||"sunken")==="sunken"?3:4,devourDragon:Boolean(campaignState.optionalRules?.devourDragon)}}
function setCampaignKingdom(value){const kingdom=value==="stone"?"stone":"sunken";gameSettings.kingdom=kingdom;gameSettings.districts=kingdom==="sunken"?3:4;campaignOp("kingdom",kingdom);return kingdom}
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
async function showApp(){
  $("#authView").classList.add("hidden");$("#appView").classList.remove("hidden");$("#currentUser").textContent=user.username;await Promise.all([loadCampaigns(),loadSharedSettings()]);await refreshLists();
  const requested=new URLSearchParams(location.search).get("module");if(["outpost","party","harvest"].includes(requested))showModule(requested);
}
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
  let party=[...new Set((Array.isArray(input)?input:[]).filter(id=>valid.has(id)))],seenKnights=new Set();
  party=party.filter(id=>{const knightId=sheetKnightId(sheets.find(sheet=>sheet.id===id))||id;if(seenKnights.has(knightId))return false;seenKnights.add(knightId);return true});
  if(leader&&valid.has(leader)){const leaderKnight=sheetKnightId(sheets.find(sheet=>sheet.id===leader));party=party.filter(id=>id!==leader&&(!leaderKnight||sheetKnightId(sheets.find(sheet=>sheet.id===id))!==leaderKnight));party.unshift(leader)}
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
    const checked=party.includes(sheet.id),isLeader=sheet.id===leader;
    return `<label class="party-knight ${isLeader?"leader":""}"><input type="checkbox" data-party-sheet="${sheet.id}" ${checked?"checked":""} ${isLeader?"disabled":""}><span>${esc(sheet.state?.knight||sheet.title)}${isLeader?" · 主骑士":""}</span></label>`;
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
function hideGameViews(){$$("#outpostModule,#partyModule,#mapModule,#encounterModule,#aibpModule,#harvestModule").forEach(el=>el.classList.add("hidden"))}
function showOverview(){
  viewMode="overview";hideGameViews();$("#sheetForm").classList.add("hidden");$("#emptyState").classList.add("hidden");$("#overview").classList.remove("hidden");setActiveModuleNav();
  const virtueNames={bravery:"勇",tenacity:"顽",sagacity:"睿",fortitude:"坚",might:"威",insight:"洞"};
  $("#overviewGrid").innerHTML=sheets.map(sheet=>{const s=sheet.state||{},story=s.story||[],done=story.reduce((n,c)=>n+(c.quest?1:0)+(c.investigations||[]).filter(i=>i.attempted).length,0);
    const virtues=Object.entries(s.virtues||{}).map(([k,v])=>`<span title="${k}">${virtueNames[k]||k} <b>${v.value??0}</b></span>`).join("");
    const valid=isKnightSheet(sheet),leader=valid&&gameSettings.leaderSheetId===sheet.id;
    return `<article class="overview-card" data-open-sheet="${sheet.id}" tabindex="0"><header><div><small>${esc(sheet.title)}</small><h2>${leader?'<span class="leader-name-mark" aria-label="当前主游戏骑士">♜</span> ':''}${esc(s.knight||"未命名骑士")}</h2>${!valid?'<span class="leader-ribbon">此身份属于侍从，旧档案仅保留数据</span>':""}</div><span class="chapter-badge">${Math.min(5,Math.floor(done/4)+1)} 章</span></header><div class="overview-resources"><span>灾祸 <b>${s.bane??0}</b></span><span>金钱 <b>${s.gold??0}</b></span><span>旁证 <b>${s.leads??0}</b></span><span>叹息 <b>${s.sigh??0}</b></span></div><div class="overview-virtues">${virtues}</div><section class="overview-notes"><strong>笔记</strong><p>${s.notes?esc(s.notes):'<span class="subtle">暂无笔记</span>'}</p></section><footer><span>故事进度 ${done}/20</span><div class="progress"><i style="width:${done/20*100}%"></i></div><button class="button" data-edit-sheet="${sheet.id}">打开记录表</button>${valid&&!leader?`<button class="button leader-button" data-leader-sheet="${sheet.id}">设为主游戏骑士</button>`:""}</footer></article>`}).join("")||'<div class="overview-empty"><div class="crest">♜</div><h2>还没有骑士档案</h2><p>建立第一张记录表，开始你的故事。</p></div>';
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
  if(viewMode==="outpost")renderOutpost();
  if(viewMode==="party")renderPartyManager();
  if(viewMode==="map")renderMap();
  if(viewMode==="encounter")renderEncounter();
  if(viewMode==="aibp")renderAIBP();
  if(viewMode==="harvest")renderHarvest();
}
function partyManagerDescriptors(){
  const party=normalizedParty();if(!party.length)return [];
  return [
    ...party.map(id=>{const sheet=sheets.find(item=>item.id===id),sourceId=sheetKnightId(sheet);return {key:`knight:${id}`,kind:"knight",sourceId,name:sheet?.state?.knight||sheet?.title||sourceId,inventory:(sheet?.state?.armory||[]).filter(Boolean)}}),
    ...normalizedSquires(party).map(id=>{const item=squireCatalog.find(entry=>entry.id===id);return {key:`squire:${id}`,kind:"squire",sourceId:id,name:item?.name||item?.en||id}})
  ];
}
function ensurePartyManagerState(){
  if(!characterData||!characterRuntime)return null;
  const descriptors=partyManagerDescriptors(),before=campaignState.partyManager;
  const next=characterRuntime.ensureManager(before,descriptors,characterData);
  if(JSON.stringify(before)!==JSON.stringify(next))campaignOp("partyManager",next);
  return campaignState.partyManager;
}
function savePartyManager(next,message=""){
  campaignOp("partyManager",next);renderPartyManager();if(message)toast(message);
}
function saveSharedMercenaryState(next){
  campaignOp("modules.map",{...(campaignState.modules?.map||{}),mercenaries:next});
}
function saveOutpostManager(next,message=""){
  campaignOp("partyManager",next);
  const current=campaignState.modules?.map?.mercenaries;
  if(current&&typeof current==="object"){
    const hiredIds=(next.outpost?.mercenaries||[]).map(item=>item.catalogId),pruned=mercenaryRuntime.normalizeState(current,hiredIds);
    if(JSON.stringify(pruned)!==JSON.stringify(current)){mercenaryRuntime.touchState(pruned);saveSharedMercenaryState(pruned)}
  }
  renderOutpost();if(message)toast(message);
}
function outpostSheetTier(sheet){return Math.max(1,Math.min(5,Math.floor(talePosition(sheet).row/4)+1))}
function renderOutpostDistricts(kingdom){
  const kingdomName=kingdom==="stone"?"巨石公国":"沉没王国";
  return outpostDistrictCatalog.map((district,index)=>{
    const href=district.target?`#${district.target}`:"#outpostKingdomOverview",mode=district.interactive?"页面内可操作":district.target?"查看完整原页":"查看王国书总览";
    return `<a class="outpost-district-card ${district.interactive?"interactive":"reference"}" href="${href}" data-outpost-district="${district.id}">
      <span class="outpost-district-index">${String(index+1).padStart(2,"0")}</span><small>${district.en}</small><strong>${district.name}</strong>
      <p>${district.summary}</p><em>${kingdomName} · ${mode}</em>
    </a>`;
  }).join("");
}
function renderOutpostKingdomOverview(kingdom){
  const page=outpostKingdomOverviewCatalog[kingdom]||outpostKingdomOverviewCatalog.sunken;
  return `<figure><a href="${page.asset}" target="_blank" rel="noopener"><img src="${page.asset}" alt="${page.label}"></a><figcaption><span>ILLUSTRATED KINGDOM BOOK</span><strong>${page.label}</strong><small>原版美术页包含佣兵工会、斥候工会、圣徒圣坛、旅店、商人工坊与公告板。</small></figcaption></figure>`;
}
function renderOutpostRulebookPages(kingdom){
  return (outpostRulebookPageCatalog[kingdom]||outpostRulebookPageCatalog.sunken).map((page,index)=>`<figure class="outpost-rulebook-page">
    <a href="${page.asset}" target="_blank" rel="noopener"><img src="${page.asset}" alt="${page.label}" loading="lazy"></a>
    <figcaption><span>规则原页 ${index+1}</span><strong>${page.label}</strong></figcaption>
  </figure>`).join("");
}
function renderOutpostDetailPages(kingdom,kind){
  const pages=outpostDetailPageCatalog[kingdom]?.[kind]||outpostDetailPageCatalog.sunken[kind]||[];
  return pages.map((page,index)=>`<figure class="outpost-detail-page">
    <a href="${page.asset}" target="_blank" rel="noopener"><img src="${page.asset}" alt="${page.label}" loading="lazy"></a>
    <figcaption><span>${kind==="scouting"?"SCOUTING":`CONTRACTS ${index+1}/${pages.length}`}</span><strong>${page.label}</strong><small>点击查看高清原页</small></figcaption>
  </figure>`).join("");
}
function outpostUnlockTokens(){
  const values=[];
  for(const sheet of knightSheets())for(const item of Array.isArray(sheet.state?.mercenaries)?sheet.state.mercenaries:[]){
    if(item&&typeof item==="object")values.push(item.catalogId,item.cardId,item.name,item.nameZhCn);
    else values.push(item);
  }
  return values.filter(value=>value!==null&&value!==undefined&&String(value).trim());
}
function outpostContext(manager){
  const memberKeys=partyManagerDescriptors().map(item=>item.key);
  const memberTiers={};
  for(const member of Object.values(manager?.members||{})){
    if(member.kind==="knight"){
      const sheet=sheets.find(item=>member.key===`knight:${item.id}`);memberTiers[member.key]=sheet?outpostSheetTier(sheet):1;
    }else{
      const source=characterData?.squires?.[member.sourceId],tier=source?.tiers?.find(item=>item.id===member.tierId)?.tier;
      memberTiers[member.key]=characterTierOrder[tier]||1;
    }
  }
  const leader=sheets.find(item=>item.id===(campaignState?.leaderSheetId||gameSettings.leaderSheetId));
  return {kingdom:campaignState?.kingdom||gameSettings.kingdom||"sunken",leaderTier:leader?outpostSheetTier(leader):1,memberKeys,memberTiers,unlockedMercenaryIds:outpostUnlockTokens()};
}
function outpostReasonText(reason){
  return ({
    "wrong-kingdom":"仅在另一王国前哨可用","not-unlocked":"尚未在骑士记录中解锁","tier-too-high":"超过当前成员层次","mercenary-limit":"全队已达到 4 名佣兵上限","squire-weapon-only":"侍从只能借用商人武器","already-owned":"该实体装备已在成员装备区",
  })[reason]||"当前不可选择";
}
function outpostMemberOption(member,selected,disabled=false,reason=""){
  const suffix=member.kind==="squire"?"侍从":"骑士",note=reason?` · ${outpostReasonText(reason)}`:"";
  return `<option value="${esc(member.key)}" ${selected?"selected":""} ${disabled&&!selected?"disabled":""}>${esc(member.name)} · ${suffix}${esc(note)}</option>`;
}
function outpostAssignmentSelect(item,kind){
  const assignment=item.assignment,selectedKey=assignment?.assignedMemberKey||"",members=kind==="mercenary"
    ?item.members
    :item.memberOptions;
  const regularOptions=members.map(member=>outpostMemberOption(member,member.key===selectedKey,kind==="mercenary"?item.disabled:member.disabled,kind==="mercenary"?item.reason:member.reason)).join("");
  const loanOptions=kind==="gear"?(item.loanOptions||[]).map(option=>`<option value="${esc(option.key)}" ${assignment?.ownerMemberKey===option.ownerMemberKey&&assignment?.assignedMemberKey===option.assignedMemberKey?"selected":""} ${option.disabled?"disabled":""}>${esc(option.name)} · 侍从（由 ${esc(option.ownerName)} 持有并借出${option.reason?` · ${outpostReasonText(option.reason)}`:""}）</option>`).join(""):"";
  const options=regularOptions+(loanOptions?`<optgroup label="侍从借用（需确认卡面侍从属性）">${loanOptions}</optgroup>`:"");
  const label=kind==="mercenary"?"分配负责人（能力仍为全队共享）":"分配装备给成员";
  const disabled=!assignment&&(kind==="mercenary"?item.disabled:![...members,...(item.loanOptions||[])].some(member=>!member.disabled));
  return `<label class="outpost-assignment"><span>${label}</span><select data-outpost-${kind}="${esc(item.card.catalogId)}" aria-label="${label}" ${disabled?"disabled":""}><option value="">${assignment?"取消选择":"选择成员"}</option>${options}</select></label>`;
}
function outpostMercenaryCard(item,members){
  const card=item.card,assignment=item.assignment,roleAssignment=item.roleAssignment,locked=item.disabled&&!assignment,status=assignment&&item.reason?`${outpostReasonText(item.reason)}，请取消或切回对应王国`:assignment?`已由 ${members.find(member=>member.key===assignment.assignedMemberKey)?.name||"成员"} 负责`:roleAssignment?`同名佣兵已选择`:(locked?outpostReasonText(item.reason):"可雇佣");
  const view={...item,members};
  return `<article class="outpost-card outpost-mercenary-card ${assignment?"selected":""} ${locked?"locked":""}" data-outpost-card="${esc(card.catalogId)}">
    <header><div><small>${card.kingdom==="sunken"?"SUNKEN KINGDOM":card.kingdom==="stone"?"PRINCIPALITY OF STONE":`LEVEL ${card.level}`}</small><h3>${esc(card.nameZhCn||card.name)}${card.level?` ${card.level} 级`:""}</h3></div><div class="outpost-card-badges"><span class="outpost-cost">${Number(card.cost)||0} 金钱</span>${assignment?'<span class="outpost-selected-mark">已雇佣</span>':""}</div></header>
    <div class="outpost-card-visual">${runtimeFlippableArt(card.art,card.backArt,`outpost:mercenary:${card.catalogId}`,`${card.nameZhCn||card.name}佣兵`)}</div>
    <p class="outpost-card-status">${esc(status)}</p>${outpostAssignmentSelect(view,"mercenary")}
  </article>`;
}
function outpostHiredMercenary(item,members){
  const card=item.card,assignment=item.assignment,owner=members.find(member=>member.key===assignment?.assignedMemberKey),warning=item.reason?outpostReasonText(item.reason):"";
  return `<article class="outpost-hired-mercenary ${warning?"warning":""}" data-outpost-hired="${esc(card.catalogId)}">
    <span class="outpost-hired-level">${card.level?`L${card.level}`:"SP"}</span><div><strong>${esc(card.nameZhCn||card.name)}</strong><small>负责人：${esc(owner?.name||"成员")}</small></div>${warning?`<em>${esc(warning)}</em>`:""}
  </article>`;
}
function outpostGearCard(item,memberByKey){
  const card=item.card,assignment=item.assignment,recipient=assignment?memberByKey[assignment.assignedMemberKey]:null,owner=assignment?memberByKey[assignment.ownerMemberKey]:null;
  return `<article class="outpost-card outpost-gear-card ${assignment?"selected":""}" data-outpost-card="${esc(card.catalogId)}">
    <header><div><small>${esc(characterTierNames[card.tier]||card.tier)} · ${card.gearType==="armor"?"防具":"武器"}</small><h3 title="${esc(card.name)}">${esc(card.name)}</h3></div>${assignment?'<span class="outpost-selected-mark">已选</span>':""}</header>
    <div class="outpost-card-visual">${runtimeFlippableArt(card.art,card.backArt,`outpost:gear:${card.catalogId}`,`${card.name}商人装备`)}</div>
    <p class="outpost-card-status">${recipient?(recipient.kind==="squire"?`由 ${esc(owner?.name||"骑士")} 持有，借给 ${esc(recipient.name)}`:`已分配给 ${esc(recipient.name)}`):item.existingOwner?`已由 ${esc(item.existingOwner.name)} 持有`:"从卡面确认价格与槽位"}</p>${outpostAssignmentSelect(item,"gear")}
  </article>`;
}
function renderOutpost(){
  resetRuntimeCardPreview();
  const kingdom=campaignState?.kingdom||gameSettings.kingdom||"sunken",kingdomName=kingdom==="stone"?"巨石公国":"沉没王国";
  $("#outpostKingdomSelect").value=kingdom;
  $("#outpostKingdomOverview").innerHTML=renderOutpostKingdomOverview(kingdom);
  $("#outpostDistricts").innerHTML=renderOutpostDistricts(kingdom);
  $("#outpostRulebookPages").innerHTML=renderOutpostRulebookPages(kingdom);
  $("#outpostScoutingPages").innerHTML=renderOutpostDetailPages(kingdom,"scouting");
  $("#outpostContractPages").innerHTML=renderOutpostDetailPages(kingdom,"contracts");
  $("#outpostScoutingTitle").textContent=`${kingdomName} · 侦察表`;
  $("#outpostContractTitle").textContent=`${kingdomName} · 公告板委托`;
  $("#outpostRulebookTitle").textContent=`${kingdomName} · 中文规则对照`;
  const poolKingdom=campaignState?.monsterPool?.kingdom,poolMismatch=Boolean(campaignState?.monsterPool?.cards?.length&&poolKingdom&&poolKingdom!==kingdom),warning=$("#outpostKingdomWarning");
  warning.classList.toggle("hidden",!poolMismatch);warning.textContent=poolMismatch?`现有怪物池仍属于${poolKingdom==="stone"?"巨石公国":"沉没王国"}。本次切换不会清空它，请回到骑士团总览重新抽取当前王国怪物池。`:"";
  const descriptors=partyManagerDescriptors(),empty=$("#outpostEmpty"),content=$("#outpostContent");
  if(!characterData||!characterRuntime?.getOutpostView){empty.classList.remove("hidden");content.classList.add("hidden");empty.innerHTML="<h2>前哨数据未加载</h2>";return}
  if(!descriptors.length){$("#outpostSummary").textContent="尚未组队";empty.classList.remove("hidden");content.classList.add("hidden");empty.innerHTML='<div class="crest">♜</div><h2>请先组建出征队伍</h2><p>前哨的佣兵与装备需要分配给本次出征的骑士或侍从。</p><button type="button" class="primary" data-module-return-overview>前往组队</button>';return}
  empty.classList.add("hidden");content.classList.remove("hidden");
  const manager=ensurePartyManagerState(),context=outpostContext(manager),view=characterRuntime.getOutpostView(manager,context,characterData),members=view.members||[];
  const activeKingdomName=view.kingdom==="stone"?"巨石公国":"沉没王国";
  $("#outpostSummary").textContent=`${activeKingdomName} · 佣兵 ${view.outpost.mercenaries.length}/4 · 装备 ${view.outpost.merchantGear.length}`;
  const hiredMercenaries=view.mercenaries.filter(item=>item.assignment);
  $("#outpostHiredMercenaries").innerHTML=hiredMercenaries.map(item=>outpostHiredMercenary(item,members)).join("")||'<p class="outpost-hired-empty">尚未雇佣佣兵</p>';
  const visibleMercenaries=view.mercenaries.filter(item=>item.assignment||item.card.kingdom==="both"||item.card.kingdom===view.kingdom).sort((left,right)=>Number(Boolean(right.assignment))-Number(Boolean(left.assignment)));
  $("#outpostMercenaries").innerHTML=visibleMercenaries.map(item=>outpostMercenaryCard(item,members)).join("")||'<p class="subtle">当前没有可用佣兵。</p>';
  $("#outpostGearTier").value=outpostFilters.tier;$("#outpostGearType").value=outpostFilters.type;$("#outpostGearSearch").value=outpostFilters.search;
  const search=outpostFilters.search.trim().toLowerCase(),gear=view.merchantGear.filter(item=>(outpostFilters.tier==="all"||item.card.tier===outpostFilters.tier)&&(outpostFilters.type==="all"||item.card.gearType===outpostFilters.type)&&(!search||String(item.card.name||"").toLowerCase().includes(search)));
  $("#outpostMerchantGear").innerHTML=gear.map(item=>outpostGearCard(item,view.memberByKey)).join("")||'<p class="subtle">没有符合筛选条件的商人装备。</p>';
  $("#clearOutpostSelections").disabled=!view.outpost.mercenaries.length&&!view.outpost.merchantGear.length;
}
function harvestContext(){
  const tiers=["mob","vassal","king","devil","dragon"],descriptors=partyManagerDescriptors(),members=descriptors.map(member=>{
    if(member.kind!=="knight")return {...member,tier:"mob"};
    const sheetId=member.key.slice("knight:".length),sheet=sheets.find(item=>item.id===sheetId),tier=tiers[Math.max(0,Math.min(4,outpostSheetTier(sheet)-1))];
    return {...member,sheetId,tier};
  });
  const requestedLeader=`knight:${campaignState.leaderSheetId||""}`,leaderKey=members.some(member=>member.key===requestedLeader)?requestedLeader:members.find(member=>member.kind==="knight")?.key||"";
  return {members,leaderKey,kingdom:campaignState.kingdom||"sunken"};
}
function harvestHandoffValue(){
  try{
    const scopedKey=`kfHarvestHandoff:${activeCampaign}`,scoped=localStorage.getItem(scopedKey),legacy=localStorage.getItem("kfHarvestHandoff"),value=JSON.parse(scoped||legacy||"null");
    if(!scoped&&legacy&&value?.campaignId===activeCampaign){localStorage.setItem(scopedKey,legacy);localStorage.removeItem("kfHarvestHandoff")}
    return value?.campaignId===activeCampaign?{...value,storageKey:scopedKey}:null;
  }catch{return null}
}
function ensureHarvestState(){
  if(!harvestRuntime||!harvestData)return null;
  const context=harvestContext(),before=campaignState.harvest;let next;
  try{next=harvestRuntime.ensureHarvest(before,context,harvestData)}catch{next=harvestRuntime.ensureHarvest(null,context,harvestData);toast("收获记录版本无效，已恢复为空白收集阶段")}
  const handoff=harvestHandoffValue();
  if(handoff){for(const receipt of handoff.receipts||[])next=harvestRuntime.applyHarvestAction(next,{type:"record-receipt",receipt},context,harvestData);localStorage.removeItem(handoff.storageKey)}
  for(const [inboxId,receipt] of Object.entries(campaignState.harvestInbox||{}))if(receipt&&typeof receipt==="object"){
    next=harvestRuntime.applyHarvestAction(next,{type:"record-receipt",receipt},context,harvestData);campaignOp(`harvestInbox.${inboxId}`,null);
  }
  if(JSON.stringify(before)!==JSON.stringify(next))campaignOp("harvest",next);
  return campaignState.harvest;
}
function saveHarvest(next,message=""){campaignOp("harvest",next);renderHarvest();if(message)toast(message)}
const harvestActivityNames={quest:"任务",investigation:"调查","free-roam-success":"自由漫游成功","free-roam-failure":"自由漫游未成功"};
function harvestRequestLabel(request){
  if(request.kind==="choice")return "普通搜刮";
  if(request.kind==="clash")return request.clashPhase==="preliminary"?"初步冲突搜刮":"完全冲突搜刮";
  return harvestData.categories?.[request.category]?.name||request.category||"指定搜刮";
}
function harvestReceiptMarkup(receipt,state){
  const requests=receipt.requests.map((request,index)=>{
    const options=request.availableCards.map(card=>`<option value="${esc(card.catalogId)}">${esc(card.nameZhCn||card.name)} · #${card.cardId}</option>`).join("");
    const exhausted=request.ignoredSlots?` · 牌堆耗尽，忽略 ${request.ignoredSlots}`:"";
    return `<div class="harvest-request ${request.openSlots===0?"complete":""}"><span><strong>${esc(harvestRequestLabel(request))}</strong><small>${request.used} / ${request.count}${exhausted}</small></span>${state.status==="collecting"&&request.openSlots>0?`<select data-harvest-loot-add="${esc(receipt.id)}|${index}" aria-label="为 ${esc(receipt.label)} 选择战利品"><option value="">选择战利品卡…</option>${options}</select>`:""}</div>`;
  }).join("");
  return `<article class="harvest-receipt ${receipt.openSlots?"pending":"complete"}"><header><div><small>${esc(receipt.source.toUpperCase())}</small><strong>${esc(receipt.label)}</strong></div><span>${receipt.openSlots?`待选 ${receipt.openSlots}`:receipt.ignoredSlots?`已完成 · 忽略 ${receipt.ignoredSlots}`:"已完成"}</span></header>${requests}${state.status==="collecting"&&!state.loot.some(item=>item.sourceReceiptId===receipt.id)?`<button type="button" class="remove-row" data-harvest-receipt-remove="${esc(receipt.id)}" aria-label="移除搜刮收据">×</button>`:""}</article>`;
}
function harvestActivityMarkup(view){
  const leaderKey=harvestContext().leaderKey;
  return view.knights.map(member=>{
    const options=Object.entries(harvestActivityNames).map(([value,label])=>`<option value="${value}" ${view.state.activities[member.key]===value?"selected":""} ${value==="quest"&&leaderKey&&member.key!==leaderKey?"disabled":""}>${label}</option>`).join("");
    return `<label class="harvest-activity"><span><strong>${esc(member.name)}</strong><small>${member.key===leaderKey?"队长 · ":""}${esc(harvestData.tierNames?.[member.tier]||member.tier)}</small></span><select data-harvest-activity="${esc(member.key)}" ${view.state.status!=="collecting"?"disabled":""}>${options}</select></label>`;
  }).join("");
}
function harvestResolutionOptions(item){
  const gold=`兑换金钱（${item.computedGold}）`,options=item.allocation==="common"?[["","选择兑换方式"],["gear","兑换对应装备"],["gold",gold],["manual","其他 / 手工记录"]]:[["","选择兑换方式"],["gold",gold],["gamble","用于王国赌博"],["manual","其他 / 手工记录"]];
  return options.map(([value,label])=>`<option value="${value}" ${item.resolution?.kind===value?"selected":""}>${label}</option>`).join("");
}
function harvestLootMarkup(item,view){
  const state=view.state,memberOptions=view.knights.map(member=>`<option value="${esc(member.key)}" ${item.assignedMemberKey===member.key?"selected":""}>${esc(member.name)}</option>`).join("");
  let controls="";
  if(state.status==="collecting")controls=`<label class="harvest-owner">公共战果归属<select data-harvest-common-owner="${esc(item.id)}" ${item.allocation==="discarded"?"disabled":""}><option value="">暂不选择</option>${memberOptions}</select></label><label class="harvest-discard"><input type="checkbox" data-harvest-discard="${esc(item.id)}" ${item.allocation==="discarded"?"checked":""}> 欺骗恶习 / 规则效果弃置</label><button type="button" class="remove-row" data-harvest-loot-remove="${esc(item.id)}" aria-label="移除战利品卡">×</button>`;
  else if(item.allocation==="discarded")controls='<p class="harvest-loot-state">已在分配前弃置</p>';
  else if(state.status==="drafting")controls=item.allocation==="common"?`<p class="harvest-loot-state"><strong>公共战果</strong> · ${esc(item.member?.name||item.assignedMemberKey||"未指定")}</p>`:`<p class="harvest-loot-state">轮到 <strong>${esc(view.nextScrapMember?.name||view.nextScrapMember?.key||"骑士")}</strong> 选择</p><button type="button" class="primary" data-harvest-scrap-draft="${esc(item.id)}">选择此卡作为回收材料</button>`;
  else{
    const placeholder=item.resolution?.kind==="gear"?"必填：具体装备名称或编号":item.resolution?.kind==="gamble"?"必填：赌博结果；返还卡牌须继续兑换":item.resolution?.kind==="manual"?"必填：规则依据与最终结算结果":"可选备注";
    controls=`<p class="harvest-loot-state"><strong>${item.allocation==="common"?"公共战果":"回收材料"}</strong> · ${esc(item.member?.name||item.assignedMemberKey||"未指定")}</p><select data-harvest-redemption="${esc(item.id)}" ${state.status==="complete"?"disabled":""}>${harvestResolutionOptions(item)}</select><input data-harvest-redemption-note="${esc(item.id)}" maxlength="300" value="${esc(item.resolution?.note||"")}" placeholder="${placeholder}" ${item.resolution?.kind&&item.resolution.kind!=="gold"?'aria-required="true"':""} ${state.status==="complete"?"disabled":""}>`;
  }
  return `<article class="harvest-loot-card ${item.allocation}"><header><div><small>${esc(item.card.shortName||item.card.category)}</small><strong>${esc(item.card.nameZhCn||item.card.name)}</strong></div><span>#${item.card.cardId}</span></header><div class="harvest-card-visual">${runtimeFlippableArt(item.card.art,item.card.backArt,`harvest:${item.id}`,item.card.nameZhCn||item.card.name,"harvest-card-art")}</div><div class="harvest-loot-controls">${controls}</div></article>`;
}
function renderHarvest(){
  resetRuntimeCardPreview();const empty=$("#harvestEmpty"),content=$("#harvestContent");
  if(!harvestRuntime||!harvestData){empty.classList.remove("hidden");content.classList.add("hidden");empty.innerHTML="<h2>收获数据未加载</h2>";return}
  const context=harvestContext();if(!context.members.some(member=>member.kind==="knight")){empty.classList.remove("hidden");content.classList.add("hidden");empty.innerHTML='<div class="crest">♜</div><h2>请先组建出征队伍</h2><p>收获分配至少需要一名骑士。</p><button type="button" class="primary" data-module-return-overview>前往组队</button>';return}
  empty.classList.add("hidden");content.classList.remove("hidden");const state=ensureHarvestState(),view=harvestRuntime.getHarvestView(state,context,harvestData),labels={collecting:"汇总战利品",drafting:"轮流挑选回收材料",allocating:"兑换结算",complete:"本次远征已结束"};
  $("#harvestSummary").textContent=`${labels[state.status]} · ${view.loot.length} 张卡`;
  $$("#harvestPhaseGuide [data-harvest-step]").forEach((item,index)=>{const phaseState=state.status==="drafting"?"allocating":state.status,current=["collecting","allocating","complete"].indexOf(phaseState),position=["collecting","allocating","complete"].indexOf(item.dataset.harvestStep);item.classList.toggle("active",position===current);item.classList.toggle("done",position<current)});
  $("#harvestReceipts").innerHTML=view.receipts.map(receipt=>harvestReceiptMarkup(receipt,state)).join("")||'<p class="subtle">尚无搜刮收据。遭遇中的搜刮会累积到这里；也可手工记录规则或故事给予的搜刮。</p>';
  $("#harvestActivities").innerHTML=harvestActivityMarkup(view);
  const unmet=view.unmetKnights.map(item=>`${item.label||view.memberByKey[item.memberKey]?.name||item.memberKey} 尚需 ${item.required-item.chosen} 张`).join("、");
  $("#harvestQuotaHint").textContent=`公共战果额度 ${view.commonChosen}/${view.commonRequired}（${view.knights.length} 名骑士 + ${view.squires.length} 名侍从${view.knights.some(member=>state.activities[member.key]==="free-roam-success")?" + 自由漫游奖励":""}）${unmet?` · ${unmet}`:""}`;
  $("#harvestLoot").innerHTML=view.loot.map(item=>harvestLootMarkup(item,view)).join("")||'<div class="harvest-loot-empty"><strong>战利品卡组为空</strong><span>先按搜刮收据加入实体战利品卡。</span></div>';
  const settlement=Object.entries(view.goldTotals).map(([key,value])=>`<li><strong>${esc(view.memberByKey[key]?.name||key)}</strong><span>金钱 +${value}</span></li>`).join(""),other=view.loot.filter(item=>item.resolution&&item.resolution.kind!=="gold").map(item=>`<li><strong>${esc(item.member?.name||"队伍")}</strong><span>${item.resolution.kind==="gear"?"装备":item.resolution.kind==="gamble"?"赌博":"其他"}${item.resolution.note?` · ${esc(item.resolution.note)}`:""}</span></li>`).join("");
  $("#harvestSettlement").innerHTML=settlement||other?`<ul>${settlement}${other}</ul><p>这是结算核对摘要，不会自动覆盖骑士记录表。</p>`:'<p class="subtle">完成公共战果分配后，在每张卡下记录兑换结果。</p>';
  $("#lockHarvestGoods").hidden=state.status!=="collecting";$("#lockHarvestGoods").disabled=!view.canLock;$("#completeHarvest").hidden=state.status!=="allocating";$("#completeHarvest").disabled=!view.canComplete;$("#reopenHarvest").hidden=state.status!=="complete";$("#resetHarvest").hidden=state.status!=="complete";$(".harvest-manual-receipt").classList.toggle("hidden",state.status!=="collecting");
}
function runtimeAtlasArt(art,label,className=""){
  if(!art?.asset||!art.crop)return '<div class="runtime-card-placeholder">无卡图</div>';
  const {column,row,columns,rows}=art.crop,px=columns>1?column/(columns-1)*100:0,py=rows>1?row/(rows-1)*100:0;
  const aspect=Number(art.aspect)>0?Number(art.aspect):2.5/3.5,scale=Number(art.scale)>0?Number(art.scale):1,cardWidth=TTS_CARD_UNIT*scale;
  return `<div class="runtime-card-art ${esc(className)}" role="img" aria-label="${esc(label)}" tabindex="0" data-runtime-card-preview data-card-aspect="${aspect}" data-tts-scale="${scale}" style="--atlas-image:url('${esc(art.asset)}');--atlas-size-x:${columns*100}%;--atlas-size-y:${rows*100}%;--atlas-pos-x:${px}%;--atlas-pos-y:${py}%;--card-aspect:${aspect};--tts-scale:${scale};--card-width:${cardWidth}px"></div>`;
}
let runtimeCardPreviewSource=null,runtimeHoveredPreviewCard=null,runtimeFocusedPreviewCard=null,runtimeCardPreviewFrame=0;
function hideRuntimeCardPreview(){
  const preview=$("#runtimeCardPreview");runtimeCardPreviewSource=null;if(!preview)return;preview.hidden=true;preview.setAttribute("aria-hidden","true");preview.replaceChildren();
}
function resetRuntimeCardPreview(){
  runtimeHoveredPreviewCard=null;runtimeFocusedPreviewCard=null;if(runtimeCardPreviewFrame)cancelAnimationFrame(runtimeCardPreviewFrame);runtimeCardPreviewFrame=0;hideRuntimeCardPreview();
}
function showRuntimeCardPreview(card){
  const preview=$("#runtimeCardPreview");if(!preview||!card)return;
  const aspect=Number(card.dataset.cardAspect)||2.5/3.5,source=card.getBoundingClientRect(),margin=14,gap=14;
  const width=Math.max(1,Math.min(420,innerWidth-margin*2,(innerHeight-margin*2)*aspect,Math.max(240,source.width*2.15))),height=width/aspect;
  let left=source.right+gap;
  if(left+width>innerWidth-margin)left=source.left-gap-width;
  if(left<margin)left=Math.max(margin,(innerWidth-width)/2);
  const top=Math.max(margin,Math.min(innerHeight-margin-height,source.top+(source.height-height)/2));
  const clone=card.cloneNode(true);clone.removeAttribute("tabindex");clone.removeAttribute("data-runtime-card-preview");
  preview.replaceChildren(clone);preview.style.width=`${width}px`;preview.style.left=`${left}px`;preview.style.top=`${top}px`;preview.hidden=false;preview.setAttribute("aria-hidden","true");runtimeCardPreviewSource=card;
}
function syncRuntimeCardPreview(){
  const focused=runtimeFocusedPreviewCard?.isConnected?runtimeFocusedPreviewCard:null,hovered=runtimeHoveredPreviewCard?.isConnected?runtimeHoveredPreviewCard:null,card=focused||hovered;
  runtimeFocusedPreviewCard=focused;runtimeHoveredPreviewCard=hovered;if(card)showRuntimeCardPreview(card);else hideRuntimeCardPreview();
}
function scheduleRuntimeCardPreviewSync(){
  if(runtimeCardPreviewFrame)cancelAnimationFrame(runtimeCardPreviewFrame);runtimeCardPreviewFrame=requestAnimationFrame(()=>{runtimeCardPreviewFrame=0;syncRuntimeCardPreview()});
}
function runtimeEffectText(effect){
  const tokens={opening:"开式",closing:"闭式",fire:"火力",break:"破甲",cantrip:"戏法","improved-diversion":"高级扰乱",hope:"希望"};
  const keywords={reposition:"调整位置",soak:"吸收",reflex:"反射","improved-rush":"高级冲锋",rush:"冲锋",hide:"隐藏",braced:"支撑",motivate:"激励"};
  if(effect.kind==="knight-pool-token")return `${tokens[effect.token]||effect.token} ${effect.value||""}`.trim();
  if(effect.kind==="power-bonus")return `强度 +${effect.value||0}`;
  if(effect.kind==="heroic-keyword"||effect.kind==="keyword")return `${keywords[effect.keyword]||effect.keyword}${effect.value?` ${effect.value}`:""}`;
  return String(effect.nameZhCn||effect.kind||"效果").replaceAll("-"," ");
}
function runtimeMemberSource(member){return member.kind==="knight"?characterData.knights[member.sourceId]:characterData.squires[member.sourceId]}
function renderRuntimeAttributes(member,embedded=false){
  const fields=[
    ["vigor","活力","VIGOR"],["passion","战意","PASSION"],["heat","烈度","HEAT"],["bane","灾祸","BANE"]
  ];
  const tracks=fields.map(([field,label,en])=>{const value=member.attributes[field]||{current:0,max:0};return `<label class="runtime-track" data-track-field="${field}"><span>${label}<small>${en}</small></span><input aria-label="${label}当前值" data-runtime-attribute="${field}" data-runtime-part="current" type="number" min="0" max="99" value="${value.current}"><b>/</b><input aria-label="${label}上限" data-runtime-attribute="${field}" data-runtime-part="max" type="number" min="0" max="99" value="${value.max}"></label>`}).join("");
  const singles=`<label class="runtime-track single" data-track-field="movement"><span>移速<small>SPEED</small></span><input aria-label="移速" data-runtime-attribute="movement" data-runtime-part="value" type="number" min="0" max="99" value="${member.attributes.movement||0}"></label><label class="runtime-track single" data-track-field="heatRefresh"><span>烈度刷新<small>HEAT REFRESH</small></span><input aria-label="烈度刷新" data-runtime-attribute="heatRefresh" data-runtime-part="value" type="number" min="0" max="99" value="${member.attributes.heatRefresh||0}"></label>`;
  const danger=member.curves?.peril?.danger||"unharmed",dangerField=`<label class="knight-danger-track" data-track-field="danger"><span>危险阈值<small>PERIL THRESHOLD</small></span><select data-runtime-curve-field="peril|danger"><option value="unharmed" ${danger==="unharmed"?"selected":""}>无伤</option><option value="light" ${danger==="light"?"selected":""}>轻型</option><option value="heavy" ${danger==="heavy"?"selected":""}>重型</option><option value="lethal" ${danger==="lethal"?"selected":""}>致命</option><option value="judicium" ${danger==="judicium"?"selected":""}>审判</option></select></label>`;
  if(embedded){
    const heading=member.kind==="squire"?"<small>ATTRIBUTES</small><strong>侍从属性</strong>":"<small>ATTRIBUTES</small><strong>骑士属性</strong>";
    return `<section class="knight-track-panel ${member.kind==="squire"?"squire-track-panel":""}"><div class="knight-zone-heading">${heading}</div><div class="knight-board-track-grid">${tracks}${singles}${member.kind==="knight"?dangerField:""}</div></section>`;
  }
  return `<section class="runtime-panel"><header><div><small>ATTRIBUTES</small><h2>属性</h2></div></header><div class="runtime-track-grid">${tracks}${singles}</div></section>`;
}
function runtimeTierSelect(member,primary=false){
  const source=runtimeMemberSource(member),select=`<select data-runtime-tier aria-label="选择侍从等级卡">${(source?.tiers||[]).map(item=>`<option value="${esc(item.id)}" ${item.id===member.tierId?"selected":""}>${characterTierNames[item.tier]||item.tier}</option>`).join("")}</select>`;
  return primary?`<label class="knight-card-selector"><span>等级卡</span>${select}</label>`:`<label class="runtime-tier-select">等级卡${select}</label>`;
}
function renderRuntimeCurves(member,embedded=false){
  const source=runtimeMemberSource(member);
  const tier=source?.tiers.find(item=>item.id===member.tierId)||source?.tiers?.[0],steps=(tier?.heroicArc||[]).map(step=>`<li class="${Number(member.attributes.passion.current)>=Number(step.passion)?"active":""}"><strong>战意 ${step.passion}</strong><span>${(step.effects||[]).map(runtimeEffectText).map(esc).join(" · ")||"依侍从卡结算"}</span></li>`).join("");
  const card=`<div class="squire-runtime-card ${steps?"has-steps":"card-only"}">${runtimeAtlasArt(tier?.art,`${member.name} ${tier?.tier||""}`)}${steps?`<ol class="squire-heroic-steps">${steps}</ol>`:""}</div>`;
  if(embedded)return `<section class="knight-board-zone squire-card-zone"><div class="knight-zone-heading"><small>SQUIRE CARD</small><strong>${characterTierNames[tier?.tier]||"侍从"}等级卡</strong></div>${card}</section>`;
  return `<section class="runtime-panel runtime-curves"><header><div><small>SQUIRE CARD</small><h2>侍从等级卡 / 英勇曲线</h2></div>${runtimeTierSelect(member)}</header>${card}</section>`;
}
function runtimeFlippableArt(frontArt,backArt,key,label,className=""){
  const canFlip=Boolean(backArt?.asset&&backArt?.crop&&(backArt.asset!==frontArt?.asset||JSON.stringify(backArt.crop)!==JSON.stringify(frontArt?.crop))),side=canFlip&&runtimeCardSides[key]==="back"?"back":"front",art=side==="back"?backArt:frontArt;
  const scale=Number(art?.scale)>0?Number(art.scale):1,aspect=Number(art?.aspect)>0?Number(art.aspect):2.5/3.5;
  return `<div class="runtime-flippable-card" style="--tts-scale:${scale};--card-aspect:${aspect};--card-width:${TTS_CARD_UNIT*scale}px">${runtimeAtlasArt(art,`${label}${side==="back"?"背面":"正面"}`,className)}${canFlip?`<button type="button" class="runtime-flip-button" data-runtime-card-flip="${esc(key)}">${side==="back"?"切到正面":"切到背面"}</button>`:""}</div>`;
}
function renderKnightCoreCards(member){
  const source=runtimeMemberSource(member),pick=(items,id,fallback)=>(items||[]).find(item=>item.id===id)||fallback||{},portrait=pick(source?.portraits,member.portraitId,source?.portrait),profession=pick(source?.professions,member.professionId,source?.profession),heroic=pick(source?.heroicArcs,member.curves.heroic.optionId,source?.heroicArc),peril=pick(source?.perilArcs,member.curves.peril.optionId,source?.perilArc);
  const selector=(kind,label,items,current)=>`<label class="knight-card-selector"><span>${esc(label)}</span><select data-runtime-knight-card="${kind}">${(items||[]).map(item=>`<option value="${esc(item.id)}" ${item.id===current.id?"selected":""}>${esc(item.name)}</option>`).join("")}</select></label>`;
  const primarySelectors=`<div class="knight-primary-selectors" role="group" aria-label="骑士卡牌与装备选择">${selector("portrait","肖像",source?.portraits,portrait)}${selector("profession","职业",source?.professions,profession)}${selector("heroic","英勇曲线",source?.heroicArcs,heroic)}${selector("peril","危险曲线",source?.perilArcs,peril)}${runtimeEquipmentAddSelect(member,true)}</div>`;
  const professionZone=`<section class="knight-board-zone knight-profession-zone"><div class="knight-zone-heading"><small>TALENT / PROFESSION</small><strong>${esc(profession.name||source?.role?.en||"骑士")}</strong></div>${runtimeFlippableArt(profession.art,profession.backArt,`${member.key}:profession`,`${member.name} 职业`,"knight-profession-art")}<p>${esc(source?.role?.zhCn||"")} · ${esc(source?.role?.en||"")}</p></section>`;
  const heroicZone=`<section class="knight-arc-zone heroic-zone"><div class="knight-zone-heading"><small>HEROIC ARC</small><strong>${esc(heroic.name||"")}</strong></div>${runtimeAtlasArt(heroic.art,`${member.name} 英勇曲线`,"knight-curve-art")}</section>`;
  const perilZone=`<section class="knight-arc-zone peril-zone"><div class="knight-zone-heading"><small>PERIL ARC</small><strong>${esc(peril.name||"")}</strong></div>${runtimeAtlasArt(peril.art,`${member.name} 危险曲线`,"knight-curve-art")}</section>`;
  const curvesZone=`<section class="knight-board-zone knight-curves-zone" aria-label="英勇与危险曲线"><div class="knight-arc-row">${heroicZone}${perilZone}</div></section>`;
  const portraitZone=`<section class="knight-board-zone knight-portrait-zone"><div class="knight-zone-heading"><small>PORTRAIT CARD</small><strong>${esc(member.name)}</strong></div>${runtimeFlippableArt(portrait.art,portrait.backArt,`${member.key}:portrait`,`${member.name} 肖像`,"knight-portrait-art")}</section>`;
  return `<section class="runtime-panel knight-board-core"><div class="knight-board-deck">${primarySelectors}${portraitZone}${professionZone}${curvesZone}${renderRuntimeAttributes(member,true)}${renderRuntimeEquipment(member,true)}</div></section>`;
}
function runtimeEquipmentCard(member,item){
  const source=runtimeMemberSource(member),fixed=source?.startingGear?.fixed||[];
  const itemName=String(item?.name||"").toLowerCase();
  return (characterData.gearCards||[]).find(card=>String(card.catalogId)===String(item?.catalogId)||String(card.cardId)===String(item?.cardId))||fixed.find(card=>String(card.cardId)===String(item?.cardId)||String(card.name||"").toLowerCase()===itemName)||characterData.gear?.[itemName]||null;
}
function runtimeLoadoutOptions(member,kind,targetId){
  const manager=campaignState?.partyManager;
  if(!manager||typeof characterRuntime?.getLoadoutOptions!=="function")return [];
  const request={kind};if(targetId!==undefined)request.targetId=targetId;
  const options=characterRuntime.getLoadoutOptions(manager,member.key,request,characterData);
  return Array.isArray(options)?options:[];
}
function runtimeLoadoutReasonText(reason,card){
  const value=String(reason||"").trim();if(!value)return "";if(/[\u3400-\u9fff]/.test(value))return value;
  const key=value.toLowerCase().replace(/[\s_]+/g,"-");
  if(key==="already-used")return card?.targetType?"已附加到其他装备":card?.gearType?"已装备":"已在手牌或卡区";
  const labels={
    "already-equipped":"已装备","equipment-already-used":"已装备","duplicate-equipment":"已装备",
    "already-in-hand":"已在手牌或卡区","technique-already-used":"已在手牌或卡区","duplicate-technique":"已在手牌或卡区",
    "upgrade-already-used":"已附加到其他装备","already-attached":"已附加到其他装备","upgrade-incompatible":"升级不兼容","incompatible-upgrade":"升级不兼容",
    "merchant-equipment":"商人装备不可升级","merchant-gear":"商人装备不可升级","merchant-not-upgradeable":"商人装备不可升级","not-upgradeable":"该装备不可升级",
    "incompatible":"类型不匹配","type-mismatch":"类型不匹配","gear-type-mismatch":"类型不匹配","incompatible-type":"类型不匹配","target-missing":"目标不存在"
  };
  return labels[key]||"当前不可选择";
}
function runtimeLoadoutOptionMarkup(options,{emptyLabel="",forceEmpty=false}={}){
  const values=Array.isArray(options)?options:[],hasEmpty=values.some(option=>String(option.catalogId)===""),hasSelected=values.some(option=>option.selected);
  const empty=emptyLabel&&(forceEmpty||!hasEmpty)?`<option value="" ${forceEmpty||!hasSelected?"selected":""}>${esc(emptyLabel)}</option>`:"";
  return empty+values.filter(option=>!(forceEmpty&&String(option.catalogId)==="")).map(option=>{const reason=option.disabled?runtimeLoadoutReasonText(option.reason,option.card):"",suffix=reason?` · ${reason}`:"";return `<option value="${esc(option.catalogId)}" ${option.selected&&!forceEmpty?"selected":""} ${option.disabled?"disabled":""} title="${esc(reason)}">${esc(option.label||option.card?.name||option.catalogId)}${esc(suffix)}</option>`}).join("");
}
function runtimeLoadoutCanSelect(options){return options.some(option=>!option.disabled&&String(option.catalogId)!=="")}
function runtimeLoadoutSelected(options){return options.find(option=>option.selected)||null}
function runtimeEquipmentAddSelect(member,primary=false){
  const options=runtimeLoadoutOptions(member,"equipment"),select=`<select class="runtime-loadout-add" data-runtime-equipment-add aria-label="从目录添加装备" title="添加装备" ${runtimeLoadoutCanSelect(options)?"":"disabled"}>${runtimeLoadoutOptionMarkup(options,{emptyLabel:primary?"选择装备":"＋ 添加装备",forceEmpty:true})}</select>`;
  return primary?`<label class="knight-card-selector knight-equipment-add-selector"><span>添加装备</span>${select}</label>`:select;
}
function runtimeEquipmentSelect(item,options){
  const selected=runtimeLoadoutSelected(options),label=selected?.label||selected?.card?.name||item.name||"装备";
  return `<select data-runtime-equipment-card="${esc(item.id)}" aria-label="替换装备 ${esc(label)}" title="替换装备" ${options.length?"":"disabled"}>${options.length?runtimeLoadoutOptionMarkup(options):`<option selected>${esc(label)}</option>`}</select>`;
}
function runtimeUpgradeSelect(item,options){
  return `<select data-runtime-equipment-upgrade="${esc(item.id)}" aria-label="附加或拆下装备升级" title="附加升级">${runtimeLoadoutOptionMarkup(options,{emptyLabel:"无升级"})}</select>`;
}
function renderRuntimeEquipment(member,embedded=false){
  const addSelect=runtimeEquipmentAddSelect(member);
  const items=(member.equipment||[]).map(item=>{
    const equipmentOptions=runtimeLoadoutOptions(member,"equipment",item.id),selectedEquipment=runtimeLoadoutSelected(equipmentOptions),card=selectedEquipment?.card||(member.kind==="knight"?runtimeEquipmentCard(member,item):null),catalogId=selectedEquipment?.catalogId||card?.catalogId||item.catalogId||item.cardId||item.id,name=card?.name||selectedEquipment?.label||item.name||"装备";
    const upgradeOptions=runtimeLoadoutOptions(member,"upgrade",item.id),selectedUpgrade=runtimeLoadoutSelected(upgradeOptions),upgrade=selectedUpgrade?.card;
    const charges=Math.max(0,Number(item.charges?.current??item.charges??item.chargeCount??item.currentCharges??0)||0),discarded=Boolean(item.discarded);
    const stack=`<div class="runtime-equipment-stack-slot"><div class="runtime-equipment-stack ${upgrade?.art?"has-upgrade":""}"><div class="runtime-equipment-card-layer">${card?.art?runtimeFlippableArt(card.art,card.backArt,`${member.key}:gear:${item.id}:${catalogId}`,name,"runtime-equipment-art"):""}</div>${upgrade?.art?`<div class="runtime-equipment-upgrade-layer">${runtimeAtlasArt(upgrade.art,`${name} 附加升级 ${selectedUpgrade.label||upgrade.name||""}`,"runtime-equipment-upgrade-art")}</div>`:""}</div></div>`;
    const action=(kind,label,icon,disabled=false)=>{const iconMarkup=icon.startsWith("/")?`<img class="runtime-equipment-action-icon" src="${esc(icon)}" alt="" aria-hidden="true">`:`<span aria-hidden="true">${icon}</span>`;return `<button type="button" class="runtime-equipment-action" data-runtime-equipment-action="${kind}" data-runtime-equipment-id="${esc(item.id)}" aria-label="${esc(label)}" title="${esc(label)}" ${disabled?"disabled":""}>${iconMarkup}</button>`};
    const chargeIcon=characterData.chargeTokenAsset?`<img src="${esc(characterData.chargeTokenAsset)}" alt="" aria-hidden="true">`:`<span aria-hidden="true">◇</span>`;
    const controls=`<div class="runtime-equipment-controls"><span title="${esc(name)}">${esc(name)}</span><div class="runtime-equipment-actions" role="group" aria-label="${esc(name)} 装备操作">${action("toggle-ready",item.ready?"横置装备":"恢复装备","/assets/icons/equipment-exhaust.png",discarded)}${action("toggle-discarded",discarded?"从弃置区拾回":"弃置装备","/assets/icons/equipment-discard.png")}<span class="runtime-equipment-charges" aria-label="当前充能 ${charges}">${action("charge-down","弃置 1 充能","/assets/icons/equipment-spend-charge.png",charges<=0)}<span class="runtime-charge-count">${chargeIcon}<output>${charges}</output></span>${action("charge-up","增加 1 充能","＋")}</span><button type="button" class="remove-row" data-runtime-equipment-remove="${esc(item.id)}" aria-label="永久移除 ${esc(name)}" title="永久移除">×</button></div></div>`;
    return `<article class="runtime-equipment ${card?.art?"has-art":""} ${item.ready?"ready":"stowed"} ${discarded?"discarded":""}">${stack}<div class="runtime-equipment-selectors">${runtimeEquipmentSelect(item,equipmentOptions)}${runtimeUpgradeSelect(item,upgradeOptions)}</div>${controls}</article>`;
  }).join("");
  if(embedded)return `<section class="knight-board-zone knight-equipment-zone ${member.kind==="squire"?"squire-equipment-zone":""}"><div class="knight-zone-heading"><small>EQUIPMENT</small><strong>${member.kind==="squire"?"借用装备":"装备"}</strong></div><div class="runtime-equipment-list">${items||'<p class="subtle">暂无装备</p>'}</div></section>`;
  return `<section class="runtime-panel ${member.kind==="knight"?"knight-equipment-rack":""}"><header><div><small>EQUIPMENT RACK</small><h2>${member.kind==="squire"?"借用装备":"装备卡架"}</h2></div>${addSelect}</header><div class="runtime-equipment-list">${items||'<p class="subtle">尚未记录装备</p>'}</div></section>`;
}
function renderRuntimeHand(member){
  if(member.kind!=="knight")return "";
  const source=runtimeMemberSource(member),techniqueSource=card=>(source?.techniques||[]).find(item=>String(item.catalogId)===String(card.catalogId)||String(item.cardId)===String(card.cardId||card.id));
  const addOptions=runtimeLoadoutOptions(member,"technique"),addSelect=`<select class="runtime-loadout-add" data-runtime-card-add aria-label="从目录添加招数" title="添加招数" ${runtimeLoadoutCanSelect(addOptions)?"":"disabled"}>${runtimeLoadoutOptionMarkup(addOptions,{emptyLabel:"＋ 添加招数",forceEmpty:true})}</select>`;
  const zoneIcons={ready:"✦",cooldown:"/assets/icons/hand-cooldown.png",delay:"/assets/icons/hand-delay.png",discard:"/assets/icons/hand-discard.png"},zoneIcon=zone=>zoneIcons[zone].startsWith("/")?`<img class="runtime-zone-icon-image" src="${zoneIcons[zone]}" alt="">`:zoneIcons[zone],cardsOutsideHand=characterRuntime.ZONES.some(zone=>zone!=="ready"&&(member.hand[zone]||[]).length);
  const handActions=`<span class="runtime-hand-actions"><button type="button" data-runtime-hand-action="advance-technique-zone" title="按肖像卡刷新值推进卡区"><span aria-hidden="true">↻</span> 自动流转</button><button type="button" data-runtime-hand-action="return-all-techniques" title="将所有招数移回手牌" ${cardsOutsideHand?"":"disabled"}><span aria-hidden="true">⇤</span> 全部回手牌</button></span>`;
  const zones=characterRuntime.ZONES.map(zone=>{const cards=member.hand[zone]||[],contents=cards.map(card=>{
    const techniqueOptions=runtimeLoadoutOptions(member,"technique",card.id),selectedTechnique=runtimeLoadoutSelected(techniqueOptions),original=selectedTechnique?.card||techniqueSource(card),catalogId=selectedTechnique?.catalogId||original?.catalogId||card.catalogId||card.cardId||card.id,name=original?.name||original?.front||selectedTechnique?.label||card.name||card.front||"未命名招数";
    const techniqueSelect=`<select data-runtime-card-catalog="${esc(card.id)}" aria-label="替换招数 ${esc(name)}" title="替换招数" ${techniqueOptions.length?"":"disabled"}>${techniqueOptions.length?runtimeLoadoutOptionMarkup(techniqueOptions):`<option selected>${esc(name)}</option>`}</select>`;
    return `<article class="runtime-technique ${original?.art?"has-art":""}">${original?.art?runtimeFlippableArt(original.art,original.backArt,`${member.key}:technique:${card.id}:${catalogId}`,name,"runtime-technique-art"):""}<div class="runtime-technique-controls"><strong>${esc(name)}</strong>${techniqueSelect}<select data-runtime-card-zone="${esc(card.id)}" aria-label="移动招数 ${esc(name)}"><option value="ready" ${zone==="ready"?"selected":""}>手牌</option><option value="cooldown" ${zone==="cooldown"?"selected":""}>冷却</option><option value="delay" ${zone==="delay"?"selected":""}>延迟</option><option value="discard" ${zone==="discard"?"selected":""}>弃置</option></select><button type="button" class="remove-row" data-runtime-card-remove="${esc(card.id)}" aria-label="移除招数">×</button></div></article>`;
  }).join("");return `<section class="runtime-hand-zone zone-${zone} ${cards.length?"":"empty"}" data-hand-zone="${zone}"><header><strong><span class="runtime-zone-icon ${zone==="ready"?"":"has-image"}" data-runtime-zone-icon="${zone}" aria-hidden="true">${zoneIcon(zone)}</span>${zone==="ready"?"招数手牌":characterZoneNames[zone]}</strong><span class="runtime-hand-zone-tools"><small>${cards.length} 张</small>${zone==="ready"?`${addSelect}${handActions}`:""}</span></header><div>${contents||'<p class="subtle">空</p>'}</div></section>`}).join("");
  return `<section class="runtime-panel runtime-hand knight-technique-rack" aria-label="招数手牌与卡区"><div class="runtime-hand-grid">${zones}</div></section>`;
}
function renderKnightRoundGuide(){
  return `<nav class="knight-turn-guide" aria-label="骑士轮阶段中文引导"><header><small>KNIGHT ROUND</small><strong>骑士轮引导</strong></header><ol class="knight-round-stages"><li data-knight-round-step="start"><span class="knight-round-step-index">1</span><div><strong>骑士轮开始</strong><small>结算所有轮开始触发</small></div></li><li data-knight-round-step="turn"><span class="knight-round-step-index">2</span><div><strong>逐名完成骑士 / 侍从回合 · 出场顺序自定</strong><small><span data-knight-turn-step="refresh"><b>刷新</b><em data-refresh-step="heat">烈度降低刷新值</em><i>→</i><em data-refresh-step="cooldown">冷却 X 张回手</em><i>→</i><em data-refresh-step="delay">延迟全进冷却</em><u>弃置不动</u></span><span class="knight-turn-guide-divider">·</span><span data-knight-turn-step="actions" aria-label="行动顺序自选"><b>行动顺序自选</b><em data-knight-turn-action="combat">战斗 ×1</em><span>/</span><em data-knight-turn-action="movement">移动 ×1</em><em data-knight-turn-action="free" title="不同免费行动不限；同一免费行动每回合最多一次；不能插入正在结算的行动">自由行动：行动前 / 之间 / 后</em></span><i>→</i><span data-knight-turn-step="end"><b>回合结束</b><em>玩家声明结束</em></span></small></div></li><li data-knight-round-step="end"><span class="knight-round-step-index">3</span><div><strong>骑士轮结束</strong><small>全员完成后结算轮结束触发</small></div></li></ol></nav>`;
}
function renderSquireBoard(member,manager){
  const selectors=`<div class="knight-primary-selectors squire-primary-selectors" role="group" aria-label="侍从等级卡与装备选择">${runtimeTierSelect(member,true)}${runtimeEquipmentAddSelect(member,true)}</div>`;
  return `<div class="squire-board-shell">${renderKnightPool(manager)}${renderHiredMercenaries(manager)}<section class="runtime-panel squire-board-core"><div class="squire-board-deck">${selectors}${renderRuntimeCurves(member,true)}${renderRuntimeAttributes(member,true)}${renderRuntimeEquipment(member,true)}</div></section></div>`;
}
function renderHiredMercenaries(manager){
  const assignments=Array.isArray(manager?.outpost?.mercenaries)?manager.outpost.mercenaries:[],catalog=characterData.mercenaries||[];
  const lifecycleState=mercenaryRuntime.normalizeState(campaignState.modules?.map?.mercenaries,assignments.map(item=>item.catalogId)),usage=lifecycleState.usage;
  const cards=assignments.map(assignment=>{
    const card=catalog.find(item=>item.catalogId===assignment.catalogId);if(!card)return "";
    const lifecycle=usage[assignment.catalogId]||{},face=lifecycle.face==="B"?"B":"A",discarded=lifecycle.status==="discarded",member=manager.members?.[assignment.assignedMemberKey];
    const art=face==="B"?(card.backArt||card.art):card.art,label=`${card.nameZhCn||card.name} ${card.level||1}级 ${face}面`;
    return `<article class="hired-mercenary-card ${discarded?"discarded":""}" data-hired-mercenary="${esc(card.catalogId)}"><div class="hired-mercenary-art">${runtimeAtlasArt(art,label)}<span>${face} 面${discarded?" · 已弃置":""}</span></div><div class="hired-mercenary-copy"><strong>${esc(card.nameZhCn||card.name)} ${card.level||1}级</strong><small>负责人：${esc(member?.name||assignment.assignedMemberKey||"未指定")}</small><div class="hired-mercenary-actions"><button type="button" data-hired-mercenary-flip="${esc(card.catalogId)}">翻至 ${face==="A"?"B":"A"} 面</button><button type="button" class="${discarded?"":"danger"}" data-hired-mercenary-discard="${esc(card.catalogId)}">${discarded?"取回":"弃置"}</button></div></div></article>`;
  }).join("");
  return `<section class="hired-mercenary-strip" aria-label="当前已雇佣佣兵"><header><small>HIRED MERCENARIES</small><strong>当前已雇佣佣兵</strong><span>${assignments.length} / 4</span></header><div class="hired-mercenary-list">${cards||'<p class="hired-mercenary-empty">尚未雇佣佣兵；请在前哨阶段选择。</p>'}</div></section>`;
}
function renderKnightBoard(member,manager){return `<div class="knight-board-shell">${renderKnightRoundGuide()}${renderKnightCoreCards(member)}${renderKnightPool(manager)}${renderHiredMercenaries(manager)}${renderRuntimeHand(member)}</div>`}
function mettleRollName(value){return value==="critical-chance"?"关键机会":value==="critical-miss"?"关键失手":String(value)}
function renderMettleManager(manager){
  const mettle=manager.mettle,current=mettle.current?characterData.mettle.cards[mettle.current.cardId]:null;
  const currentMarkup=current?`<article class="mettle-current-card">${runtimeAtlasArt(current.art,`胆识 ${mettleRollName(current.roll)}`)}<div><small>${characterTierNames[current.tier]||current.tier} · ${current.clue}</small><h3>${mettleRollName(current.roll)}</h3><dl><div><dt>强度</dt><dd>${current.power}</dd></div><div><dt>潜力</dt><dd>${current.potential}</dd></div><div><dt>闪避</dt><dd>${current.hitsEvaded}</dd></div><div><dt>命中技能</dt><dd>${current.hitSkill}</dd></div><div><dt>强度技能</dt><dd>${current.powerSkill}</dd></div></dl></div></article>`:'<div class="mettle-empty"><span>◇</span><strong>尚未抽取胆识</strong><small>所有侍从共用这一副牌库</small></div>';
  const locked=Object.values(characterData.mettle.cards).filter(card=>!mettle.unlocked.includes(card.id)).sort((a,b)=>a.slot-b.slot);
  $("#mettleManagerPanel").innerHTML=`<section class="runtime-panel"><header><div><small>SHARED METTLE</small><h2>共享胆识牌库</h2></div><span class="runtime-count">牌库 ${mettle.drawPile.length} · 弃牌 ${mettle.discardPile.length}</span></header>${currentMarkup}<div class="mettle-buttons"><button type="button" class="primary" data-runtime-mettle="draw" ${current?"disabled":""}>抽取胆识</button><button type="button" class="button" data-runtime-mettle="finish" ${current?"":"disabled"}>完成行动</button><button type="button" class="button" data-runtime-mettle="shuffle" ${current?"disabled":""}>洗牌</button><button type="button" class="danger" data-runtime-mettle="reset">重置起始牌库</button></div><div class="mettle-upgrade"><label class="squire-leads-field">侍从旁证<input data-runtime-squire-leads type="number" min="0" max="99999" value="${manager.squireLeads||0}"></label><label>解锁胆识卡<select id="mettleUpgradeSelect"><option value="">选择未解锁卡牌</option>${locked.map(card=>`<option value="${esc(card.id)}">${characterTierNames[card.tier]||card.tier} · ${card.clue} · ${mettleRollName(card.roll)}</option>`).join("")}</select></label><button type="button" class="button" data-runtime-mettle="upgrade" ${locked.length&&(manager.squireLeads||0)>=5?"":"disabled"}>花费 5 侍从旁证解锁</button><p>加入新卡后，自动移除同线索类型中一张最低层次胆识卡，并扣除 5 点侍从旁证。</p></div></section>`;
}
function runtimeKnightPoolIcon(token){
  const icon=token?.iconAsset||token?.icon||token?.art;
  const normalizedCrop=token?.iconCrop;
  if(typeof icon==="string"&&normalizedCrop){
    const x=Math.max(0,Math.min(1,Number(normalizedCrop.x)||0)),y=Math.max(0,Math.min(1,Number(normalizedCrop.y)||0)),width=Math.max(.01,Math.min(1-x,Number(normalizedCrop.width)||1)),height=Math.max(.01,Math.min(1-y,Number(normalizedCrop.height)||1)),sizeX=100/width,sizeY=100/height,positionX=width>=1?0:x/(1-width)*100,positionY=height>=1?0:y/(1-height)*100;
    return `<span class="knight-pool-icon-texture" aria-hidden="true" style="--token-image:url('${esc(icon)}');--token-size-x:${sizeX.toFixed(4)}%;--token-size-y:${sizeY.toFixed(4)}%;--token-pos-x:${positionX.toFixed(4)}%;--token-pos-y:${positionY.toFixed(4)}%"></span>`;
  }
  if(typeof icon==="string")return `<img src="${esc(icon)}" alt="">`;
  if(!icon?.asset)return `<span class="knight-pool-icon-fallback" aria-hidden="true">◇</span>`;
  const crop=icon.crop;
  if(!crop)return `<img src="${esc(icon.asset)}" alt="">`;
  const columns=Math.max(1,Number(crop.columns)||1),rows=Math.max(1,Number(crop.rows)||1),column=Math.max(0,Number(crop.column)||0),row=Math.max(0,Number(crop.row)||0),px=columns===1?0:column/(columns-1)*100,py=rows===1?0:row/(rows-1)*100;
  return `<span class="knight-pool-icon-atlas" aria-hidden="true" style="--atlas-image:url('${esc(icon.asset)}');--atlas-size-x:${columns*100}%;--atlas-size-y:${rows*100}%;--atlas-pos-x:${px}%;--atlas-pos-y:${py}%"></span>`;
}
function renderKnightPool(manager){
  const rawDefinitions=characterData.knightPoolTokens||[],definitions=Array.isArray(rawDefinitions)?rawDefinitions:Object.entries(rawDefinitions).map(([id,token])=>typeof token==="object"?{id,...token}:{id,name:token}),pool=manager.knightPool||{},fallbackNames={opening:"开式",closing:"闭式",fire:"火力",break:"破甲",cantrip:"戏法","improved-diversion":"高级扰乱",hope:"希望"};
  const countFor=tokenId=>{const entry=pool[tokenId]??pool.tokens?.[tokenId]??0;return Math.max(0,Number(typeof entry==="object"?entry.count??entry.value:entry)||0)},ordinaryTotal=definitions.filter(token=>token.kind==="knight").reduce((sum,token)=>sum+countFor(token.id),0);
  const renderTokens=tokens=>tokens.map(token=>{const count=countFor(token.id),name=token.nameZhCn||token.zhCn||token.label||token.name||fallbackNames[token.id]||token.id;return `<article class="knight-pool-token ${token.kind==="resource"?"resource":""} ${count?"active":""}" data-knight-pool-token="${esc(token.id)}">${runtimeKnightPoolIcon(token)}<span><small>${esc(name)}</small><strong aria-label="${esc(name)}数量">${count}</strong></span><div class="knight-pool-stepper"><button type="button" data-runtime-knight-pool-action="decrement" data-runtime-knight-pool-token="${esc(token.id)}" aria-label="减少 1 个${esc(name)}" ${count?"":"disabled"}>−</button><button type="button" data-runtime-knight-pool-action="increment" data-runtime-knight-pool-token="${esc(token.id)}" aria-label="增加 1 个${esc(name)}">＋</button></div></article>`}).join(""),ordinary=definitions.filter(token=>token.kind==="knight"),resources=definitions.filter(token=>token.kind==="resource");
  const groups=`<div class="knight-pool-group"><span class="knight-pool-group-label">骑士指示物</span><div class="knight-pool-tokens">${renderTokens(ordinary)||'<span class="subtle">暂无指示物</span>'}</div></div>${resources.length?`<div class="knight-pool-group resource"><span class="knight-pool-group-label">共享资源<small>清理时保留</small></span><div class="knight-pool-tokens">${renderTokens(resources)}</div></div>`:""}`;
  return `<section class="knight-pool-strip" aria-label="共享骑士池"><div class="knight-pool-title"><small>KNIGHT POOL</small><strong>共享骑士池</strong></div><div class="knight-pool-groups">${groups}</div><button type="button" class="knight-pool-clear" data-runtime-knight-pool-action="clear" ${ordinaryTotal?"":"disabled"} title="Magic、Fleisch 与 Zeal 资源会保留">清理骑士指示物</button></section>`;
}
function renderPartyManager(){
  resetRuntimeCardPreview();
  const descriptors=partyManagerDescriptors();
  if(!characterData||!characterRuntime){$("#partyMemberTabs").innerHTML="";$("#partyMemberPanel").innerHTML='<div class="overview-empty"><h2>角色运行数据未加载</h2></div>';$("#mettleManagerPanel").innerHTML="";return}
  if(!descriptors.length){$("#partyManagerSummary").textContent="尚未组队";$("#partyMemberTabs").innerHTML="";$("#partyMemberPanel").innerHTML='<div class="overview-empty"><div class="crest">♜</div><h2>请先组建出征队伍</h2><p>回到骑士团总览，选择主游戏骑士与本次出征成员。</p><button type="button" class="primary" data-module-return-overview>前往组队</button></div>';$("#mettleManagerPanel").innerHTML="";return}
  const manager=ensurePartyManagerState(),member=manager.members[manager.activeMemberKey],source=runtimeMemberSource(member);
  $(".character-manager-grid").classList.toggle("knight-layout",member.kind==="knight");
  $("#mettleManagerPanel").classList.toggle("hidden",member.kind==="knight");
  $("#partyManagerSummary").textContent=`${descriptors.filter(item=>item.kind==="knight").length} 名骑士 · ${descriptors.filter(item=>item.kind==="squire").length} 名侍从`;
  $("#partyMemberTabs").innerHTML=descriptors.map(item=>`<button type="button" class="party-member-tab ${item.key===manager.activeMemberKey?"active":""}" data-runtime-member="${esc(item.key)}"><img src="/assets/heroes/${esc(item.sourceId)}-avatar.jpg" alt=""><span><small>${item.kind==="knight"?"骑士":"侍从"}</small><strong>${esc(item.name)}</strong></span></button>`).join("");
  $("#partyMemberPanel").innerHTML=`<header class="runtime-member-head"><div><p class="eyebrow">${member.kind==="knight"?"KNIGHT WORKSPACE":"SQUIRE WORKSPACE"}</p><h2>${esc(member.name)}</h2><span>${member.kind==="knight"?esc(source?.role?.zhCn||source?.role?.en||"骑士"):esc(`${characterTierNames[source?.tiers.find(item=>item.id===member.tierId)?.tier]||"侍从"}等级卡`)}</span></div><button type="button" class="danger" data-runtime-member-reset>重置该成员</button></header>${member.kind==="knight"?renderKnightBoard(member,manager):renderSquireBoard(member,manager)}`;
  if(member.kind==="knight")$("#mettleManagerPanel").innerHTML="";else renderMettleManager(manager);
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
  $("#leaderSelect").innerHTML='<option value="">请选择</option>'+eligible.map(s=>`<option value="${s.id}">${esc(s.state?.knight||s.title)}</option>`).join("");
  $("#leaderSelect").value=leader?.id||"";$("#kingdomSelect").value=gameSettings.kingdom||"sunken";gameSettings.districts=gameSettings.kingdom==="sunken"?3:4;$("#districtCount").textContent=gameSettings.kingdom==="sunken"?"沉没王国：3":"巨石王国：4";
  if($("#devourDragonRule"))$("#devourDragonRule").checked=Boolean(gameSettings.devourDragon);
  const pos=talePosition(leader);$("#talePosition").textContent=leader?`第 ${pos.chapter} 章 · ${pos.label}${pos.empty?"（尚无标记，按起始行）":""}`:"请选择主游戏骑士";
  const pool=leader?poolForRow(pos.row,gameSettings.kingdom):[];
  $("#autoPoolPreview").innerHTML=leader?pool.map(card=>`<span class="pool-preview-card">${monsterAvatarMarkup(card.name,"pool-preview-avatar")}<span><strong>${esc(card.name)}</strong><small>Lv.${card.level}</small></span></span>`).join(""):"选择主游戏骑士后自动生成";
  renderPartyBuilder();
}
function readGameSettings(){gameSettings.leaderSheetId=$("#leaderSelect").value;gameSettings.kingdom=$("#kingdomSelect").value;gameSettings.districts=gameSettings.kingdom==="sunken"?3:4;gameSettings.devourDragon=Boolean($("#devourDragonRule")?.checked);return gameSettings}
async function saveGameSettings(){readGameSettings();campaignOp("leaderSheetId",gameSettings.leaderSheetId);setCampaignKingdom(gameSettings.kingdom);campaignOp("optionalRules.devourDragon",gameSettings.devourDragon);commitParty(campaignState.party||[]);showOverview();toast("主游戏与出征队伍已保存")}
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
  $("#monsterPool").innerHTML=`<strong>${esc(leader?.state?.knight||leader?.title||"主骑士")} · 比对卡第 ${pos.row+1} 行 · 牌池 ${pool.cards.length} 张</strong>${dragonNotice}<div class="pool-cards">${(pool.districts||[]).map((c,i)=>`<button class="monster-card ${c.devourDragonBound?"devour-bound":""}" type="button" data-original-encounter="${i}" title="打开 ${esc(c.name)} 遭遇">${monsterAvatarMarkup(c.name)}<span><small>区域 ${i+1}${c.devourDragonBound?" · 巨兽之腹":""}</small><strong>${esc(c.name)}</strong><b>Lv.${c.level}</b></span></button>`).join("")}</div>`;
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
$("#authMode").onclick=()=>{isRegister=!isRegister;$("#authSubmit").textContent=isRegister?"注册":"登录";$("#authMode").textContent=isRegister?"已有账号？登录":"没有账号？注册";$("#authPassword").autocomplete=isRegister?"new-password":"current-password"};
$("#authForm").onsubmit=async e=>{e.preventDefault();try{const route=isRegister?"register":"login";const data=await api(`/api/auth/${route}`,{method:"POST",body:JSON.stringify({username:$("#authUsername").value,password:$("#authPassword").value})});user=data.user;await showApp()}catch(err){$("#authHint").textContent=err.message}};
$("#logoutButton").onclick=async()=>{await api("/api/auth/logout",{method:"POST"});user=null;active=null;state=null;campaigns=[];activeCampaign=null;campaignState=null;sharedSettings={storyMarkers:{},passwords:[]};sharedSettingsDirty=false;renderPermanentStoryMarkers();renderPasswordRecords();showAuth()};
$("#menuButton").onclick=()=>{$("#sidebar").classList.add("open");$("#scrim").classList.add("open")};$("#closeSidebar").onclick=$("#scrim").onclick=closeSidebar;
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
$(".module-nav").onclick=async e=>{
  const link=e.target.closest('a[href^="/modules/"]');
  if(link){e.preventDefault();await flushCampaignOperations();location.href=link.href;return}
  const button=e.target.closest("[data-module]");if(button)button.dataset.module==="overview"?showOverview():showModule(button.dataset.module);
};
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
  const used=new Set(sheets.map(sheet=>sheetKnightId(sheet)).filter(Boolean)),available=knightCatalog.filter(item=>!used.has(item.id));
  if(!available.length)return toast("当前战役中的骑士档案已经齐全");
  $("#newKnightGallery").innerHTML=knightCatalog.map(item=>`<button class="knight-choice ${item.id===available[0].id?"selected":""}" type="button" role="radio" aria-checked="${item.id===available[0].id}" data-knight-choice="${item.id}" ${used.has(item.id)?"disabled":""}><img src="/assets/heroes/${item.id}-avatar.jpg" alt=""><span>${esc(item.name)}</span></button>`).join("");
  $("#newKnightIdentity").value=available[0].id;
  $("#newKnightTitle").value="";$("#newKnightTitle").placeholder=`默认：${available[0].name}`;$("#newKnightPlayer").value="";$("#newKnightDialog").showModal();
}
$("#newSheet").onclick=openNewKnightDialog;
$("#closeKnightDialog").onclick=$("#cancelKnightDialog").onclick=()=>$("#newKnightDialog").close();
$("#newKnightGallery").onclick=e=>{const choice=e.target.closest("[data-knight-choice]");if(!choice||choice.disabled)return;$("#newKnightIdentity").value=choice.dataset.knightChoice;$$("[data-knight-choice]",$("#newKnightGallery")).forEach(button=>{const selected=button===choice;button.classList.toggle("selected",selected);button.setAttribute("aria-checked",String(selected))});$("#newKnightTitle").placeholder=`默认：${knightCatalog.find(item=>item.id===choice.dataset.knightChoice)?.name||"骑士名"}`};
$("#newKnightForm").onsubmit=async e=>{
  e.preventDefault();
  try{
    const d=await api("/api/sheets",{method:"POST",body:JSON.stringify({campaignId:activeCampaign,knightId:$("#newKnightIdentity").value,title:$("#newKnightTitle").value,player:$("#newKnightPlayer").value})});
    $("#newKnightDialog").close();await refreshLists();await openSheet(d.sheet.id);toast(`已建立 ${d.sheet.state.knight} 的骑士档案`);
  }catch(error){toast(error.message)}
};
$("#sheetTitle").onchange=async e=>{if(!active)return;await api(`/api/sheets/${active}`,{method:"PATCH",body:JSON.stringify({title:e.target.value})});refreshLists()};
$("#deleteSheet").onclick=async()=>{if(confirm("将这张档案移入回收站？30 天内可以恢复。")){await api(`/api/sheets/${active}/trash`,{method:"POST"});active=null;await refreshLists()}};
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
$("#outpostModule").addEventListener("pointerover",e=>{
  if(!matchMedia("(hover:hover)").matches)return;const card=e.target.closest?.("[data-runtime-card-preview]"),related=e.relatedTarget;if(!card||(related instanceof Node&&card.contains(related)))return;runtimeHoveredPreviewCard=card;syncRuntimeCardPreview();
});
$("#outpostModule").addEventListener("pointerout",e=>{
  const card=e.target.closest?.("[data-runtime-card-preview]"),related=e.relatedTarget;if(!card||(related instanceof Node&&card.contains(related)))return;if(runtimeHoveredPreviewCard===card)runtimeHoveredPreviewCard=null;syncRuntimeCardPreview();
});
$("#outpostModule").addEventListener("focusin",e=>{const card=e.target.closest?.("[data-runtime-card-preview]");if(card){runtimeFocusedPreviewCard=card;syncRuntimeCardPreview()}});
$("#outpostModule").addEventListener("focusout",e=>{const card=e.target.closest?.("[data-runtime-card-preview]"),related=e.relatedTarget;if(!card||(related instanceof Node&&card.contains(related)))return;if(runtimeFocusedPreviewCard===card)runtimeFocusedPreviewCard=null;syncRuntimeCardPreview()});
$("#outpostModule").addEventListener("click",e=>{
  if(e.target.closest("[data-module-return-overview]")){showOverview();return}
  const flip=e.target.closest("[data-runtime-card-flip]");if(flip){const key=flip.dataset.runtimeCardFlip;runtimeCardSides[key]=runtimeCardSides[key]==="back"?"front":"back";renderOutpost();return}
  if(e.target.closest("#clearOutpostSelections")){
    const manager=ensurePartyManagerState();if(!manager||!confirm("清空本次前哨选择？已分配的商人装备也会从成员装备区移除。"))return;
    saveOutpostManager(characterRuntime.applyOutpostAction(manager,{type:"clear-outpost"},outpostContext(manager),characterData),"本次前哨选择已清空");
  }
});
$("#outpostModule").addEventListener("change",e=>{
  if(e.target.matches("#outpostKingdomSelect")){const kingdom=setCampaignKingdom(e.target.value);renderOutpost();toast(`当前战役王国已切换为${kingdom==="stone"?"巨石公国":"沉没王国"}`);return}
  if(e.target.matches("#outpostGearTier")){outpostFilters.tier=e.target.value;renderOutpost();return}
  if(e.target.matches("#outpostGearType")){outpostFilters.type=e.target.value;renderOutpost();return}
  const manager=ensurePartyManagerState();if(!manager)return;const context=outpostContext(manager);
  if(e.target.matches("[data-outpost-mercenary]")){
    const next=characterRuntime.applyOutpostAction(manager,{type:"assign-mercenary",catalogId:e.target.dataset.outpostMercenary,memberKey:e.target.value},context,characterData);
    if(next===manager){renderOutpost();toast("该佣兵当前不可选择");return}saveOutpostManager(next,e.target.value?"佣兵负责人已记录；能力仍由全队共享":"佣兵已从本次远征移除");return;
  }
  if(e.target.matches("[data-outpost-gear]")){
    const value=e.target.value;let memberKey=value,ownerMemberKey=value,squireEligibilityConfirmed=false;
    if(value.startsWith("loan|")){
      [,ownerMemberKey,memberKey]=value.split("|");
      if(!confirm("规则要求该商人武器卡面带有侍从属性。确认该卡符合条件，并由所选骑士持有后借给侍从？")){renderOutpost();return}
      squireEligibilityConfirmed=true;
    }
    const next=characterRuntime.applyOutpostAction(manager,{type:"assign-merchant-gear",catalogId:e.target.dataset.outpostGear,memberKey,ownerMemberKey,squireEligibilityConfirmed},context,characterData);
    if(next===manager){renderOutpost();toast("该装备无法分配给所选成员");return}saveOutpostManager(next,e.target.value?"商人装备已分配并加入成员装备区":"商人装备已取消分配");
  }
});
$("#outpostGearSearch").addEventListener("input",e=>{outpostFilters.search=e.target.value;renderOutpost()});
$("#harvestModule").addEventListener("pointerover",e=>{
  if(!matchMedia("(hover:hover)").matches)return;const card=e.target.closest?.("[data-runtime-card-preview]"),related=e.relatedTarget;if(!card||(related instanceof Node&&card.contains(related)))return;runtimeHoveredPreviewCard=card;syncRuntimeCardPreview();
});
$("#harvestModule").addEventListener("pointerout",e=>{
  const card=e.target.closest?.("[data-runtime-card-preview]"),related=e.relatedTarget;if(!card||(related instanceof Node&&card.contains(related)))return;if(runtimeHoveredPreviewCard===card)runtimeHoveredPreviewCard=null;syncRuntimeCardPreview();
});
$("#harvestModule").addEventListener("focusin",e=>{const card=e.target.closest?.("[data-runtime-card-preview]");if(card){runtimeFocusedPreviewCard=card;syncRuntimeCardPreview()}});
$("#harvestModule").addEventListener("focusout",e=>{const card=e.target.closest?.("[data-runtime-card-preview]"),related=e.relatedTarget;if(!card||(related instanceof Node&&card.contains(related)))return;if(runtimeFocusedPreviewCard===card)runtimeFocusedPreviewCard=null;syncRuntimeCardPreview()});
$("#harvestModule").addEventListener("click",e=>{
  if(e.target.closest("[data-module-return-overview]")){showOverview();return}
  const context=harvestContext(),state=ensureHarvestState();if(!state)return;const apply=(action,message="")=>{const next=harvestRuntime.applyHarvestAction(state,action,context,harvestData);if(next===state){renderHarvest();if(message)toast(message);return}saveHarvest(next,message)};
  const flip=e.target.closest("[data-runtime-card-flip]");if(flip){const key=flip.dataset.runtimeCardFlip;runtimeCardSides[key]=runtimeCardSides[key]==="back"?"front":"back";renderHarvest();return}
  const receiptRemove=e.target.closest("[data-harvest-receipt-remove]");if(receiptRemove){apply({type:"remove-receipt",receiptId:receiptRemove.dataset.harvestReceiptRemove},"搜刮收据已移除");return}
  const lootRemove=e.target.closest("[data-harvest-loot-remove]");if(lootRemove){apply({type:"remove-loot-card",lootId:lootRemove.dataset.harvestLootRemove},"战利品卡已移出本次远征");return}
  const scrapDraft=e.target.closest("[data-harvest-scrap-draft]");if(scrapDraft){apply({type:"draft-scrap",lootId:scrapDraft.dataset.harvestScrapDraft},"已按队长起顺序选择回收材料");return}
  if(e.target.closest("#addHarvestReceipt")){
    const value=$("#harvestScavengeKind").value,count=Math.max(1,Math.min(16,Number($("#harvestScavengeCount").value)||1)),request=value==="choice"?{kind:"choice",count}:value.endsWith("-clash")?{kind:"clash",clashPhase:value==="exhibition-clash"?"preliminary":"full",count}:{kind:"category",category:value,count},label=`手工记录 · ${harvestRequestLabel(request)} ${count}`;
    apply({type:"record-receipt",receipt:{id:`manual-${compatibleUuid().replaceAll("-","")}`,source:"manual",label,createdAt:new Date().toISOString(),requests:[request]}},"搜刮收据已记录");return;
  }
  if(e.target.closest("#lockHarvestGoods")){apply({type:"lock-common-goods"},"公共战果已确认，剩余卡牌已从队长起顺序分配");return}
  if(e.target.closest("#completeHarvest")){if(confirm("确认已将摘要中的金钱、装备及其他奖励手工同步到对应骑士记录，并结束本次远征？"))apply({type:"complete",at:new Date().toISOString()},"收获阶段已完成；下一次远征从展望阶段开始");return}
  if(e.target.closest("#reopenHarvest")){apply({type:"reopen"},"兑换记录已重新开放");return}
  if(e.target.closest("#resetHarvest")){if(confirm("清空当前收获记录并开始新的远征记录？"))apply({type:"reset"},"已开始新的收获记录");return}
});
$("#harvestModule").addEventListener("change",e=>{
  const context=harvestContext(),state=ensureHarvestState();if(!state)return;const apply=(action,message="")=>{const next=harvestRuntime.applyHarvestAction(state,action,context,harvestData);if(next===state){renderHarvest();if(message)toast(message);return}saveHarvest(next,message)};
  if(e.target.matches("[data-harvest-loot-add]")){
    if(!e.target.value)return;const[receiptId,requestIndex]=e.target.dataset.harvestLootAdd.split("|");apply({type:"add-loot-card",receiptId,requestIndex:Number(requestIndex),catalogId:e.target.value},"战利品卡已加入本次 Loot Deck");return;
  }
  if(e.target.matches("[data-harvest-activity]")){apply({type:"set-activity",memberKey:e.target.dataset.harvestActivity,activity:e.target.value});return}
  if(e.target.matches("[data-harvest-common-owner]")){apply({type:"set-common-owner",lootId:e.target.dataset.harvestCommonOwner,memberKey:e.target.value},e.target.value?"公共战果归属已更新":"公共战果选择已取消");return}
  if(e.target.matches("[data-harvest-discard]")){apply({type:"discard-loot-card",lootId:e.target.dataset.harvestDiscard,discard:e.target.checked},e.target.checked?"战利品已按规则弃置":"战利品已恢复到公共战果");return}
  if(e.target.matches("[data-harvest-redemption]")){
    if(!e.target.value){renderHarvest();return}const article=e.target.closest(".harvest-loot-card"),note=article?.querySelector("[data-harvest-redemption-note]")?.value||"";apply({type:"set-redemption",lootId:e.target.dataset.harvestRedemption,kind:e.target.value,note},"兑换结果已记录");return;
  }
  if(e.target.matches("[data-harvest-redemption-note]")){
    const article=e.target.closest(".harvest-loot-card"),select=article?.querySelector("[data-harvest-redemption]");if(select?.value)apply({type:"set-redemption",lootId:e.target.dataset.harvestRedemptionNote,kind:select.value,note:e.target.value});
  }
});
$("#partyModule").addEventListener("pointerover",e=>{
  if(!matchMedia("(hover:hover)").matches)return;const card=e.target.closest?.("[data-runtime-card-preview]"),related=e.relatedTarget;if(!card||(related instanceof Node&&card.contains(related)))return;runtimeHoveredPreviewCard=card;syncRuntimeCardPreview();
});
$("#partyModule").addEventListener("pointerout",e=>{
  const card=e.target.closest?.("[data-runtime-card-preview]"),related=e.relatedTarget;if(!card||(related instanceof Node&&card.contains(related)))return;if(runtimeHoveredPreviewCard===card)runtimeHoveredPreviewCard=null;syncRuntimeCardPreview();
});
$("#partyModule").addEventListener("focusin",e=>{const card=e.target.closest?.("[data-runtime-card-preview]");if(card){runtimeFocusedPreviewCard=card;syncRuntimeCardPreview()}});
$("#partyModule").addEventListener("focusout",e=>{const card=e.target.closest?.("[data-runtime-card-preview]"),related=e.relatedTarget;if(!card||(related instanceof Node&&card.contains(related)))return;if(runtimeFocusedPreviewCard===card)runtimeFocusedPreviewCard=null;syncRuntimeCardPreview()});
addEventListener("resize",scheduleRuntimeCardPreviewSync);addEventListener("scroll",scheduleRuntimeCardPreviewSync,true);
$("#partyModule").addEventListener("click",e=>{
  if(e.target.closest("[data-module-return-overview]")){showOverview();return}
  const manager=ensurePartyManagerState();if(!manager)return;
  const mercenaryFlip=e.target.closest("[data-hired-mercenary-flip]"),mercenaryDiscard=e.target.closest("[data-hired-mercenary-discard]");
  if(mercenaryFlip||mercenaryDiscard){
    const assignments=manager.outpost?.mercenaries||[],hiredIds=assignments.map(item=>item.catalogId),catalogId=(mercenaryFlip||mercenaryDiscard).dataset[mercenaryFlip?"hiredMercenaryFlip":"hiredMercenaryDiscard"];
    const next=mercenaryRuntime.normalizeState(campaignState.modules?.map?.mercenaries,hiredIds);
    if(next.pendingAction&&mercenaryFlip){toast("请先完成盗贼探索牌选择");return}
    if(next.pendingAction&&mercenaryDiscard&&!confirm("当前有尚未完成的盗贼选牌。仍要弃置佣兵并取消该选择吗？"))return;
    const changed=mercenaryFlip?mercenaryRuntime.flipMercenary(next,catalogId,hiredIds):mercenaryRuntime.discardMercenary(next,catalogId,hiredIds);
    if(changed){saveSharedMercenaryState(next);renderPartyManager();toast(mercenaryFlip?"佣兵已翻面":next.usage[catalogId]?.status==="discarded"?"佣兵已弃置":"佣兵已取回")}
    return;
  }
  const tab=e.target.closest("[data-runtime-member]");if(tab){const next=structuredClone(manager);next.activeMemberKey=tab.dataset.runtimeMember;savePartyManager(next);return}
  const member=manager.members[manager.activeMemberKey];if(!member)return;
  const applyRuntime=(action,message)=>savePartyManager(characterRuntime.applyRuntimeAction(manager,manager.activeMemberKey,action,characterData),message);
  const flip=e.target.closest("[data-runtime-card-flip]");if(flip){const key=flip.dataset.runtimeCardFlip;runtimeCardSides[key]=runtimeCardSides[key]==="back"?"front":"back";renderPartyManager();return}
  if(e.target.closest("[data-runtime-member-reset]")){
    if(!confirm(`重置 ${member.name} 的本次出征属性、装备和卡区？`))return;
    const descriptor=partyManagerDescriptors().find(item=>item.key===manager.activeMemberKey);if(descriptor)savePartyManager(characterRuntime.resetMember(manager,manager.activeMemberKey,descriptor,characterData),`${member.name} 已重置`);return;
  }
  const removeGear=e.target.closest("[data-runtime-equipment-remove]");if(removeGear){savePartyManager(characterRuntime.removeEquipment(manager,manager.activeMemberKey,removeGear.dataset.runtimeEquipmentRemove),"装备已移除");return}
  const removeCard=e.target.closest("[data-runtime-card-remove]");if(removeCard){savePartyManager(characterRuntime.removeTechnique(manager,manager.activeMemberKey,removeCard.dataset.runtimeCardRemove),"招数已移除");return}
  const equipmentAction=e.target.closest("[data-runtime-equipment-action]");if(equipmentAction){
    const equipmentId=equipmentAction.dataset.runtimeEquipmentId,action=equipmentAction.dataset.runtimeEquipmentAction;
    if(action==="toggle-ready")applyRuntime({kind:"toggle-equipment-ready",equipmentId},"装备横置状态已更新");
    if(action==="toggle-discarded")applyRuntime({kind:"toggle-equipment-discarded",equipmentId},"装备弃置状态已更新");
    if(action==="charge-down"||action==="charge-up"){const delta=action==="charge-up"?1:-1;applyRuntime({kind:"change-equipment-charges",equipmentId,delta},delta>0?"装备充能已增加":"已弃置 1 点装备充能")}
    return;
  }
  const handAction=e.target.closest("[data-runtime-hand-action]");if(handAction){
    const action=handAction.dataset.runtimeHandAction;
    if(action==="advance-technique-zone")applyRuntime({kind:"advance-technique-zone"},"招数卡区已按刷新值流转");
    if(action==="return-all-techniques")applyRuntime({kind:"return-all-techniques"},"所有招数已回到手牌");
    return;
  }
  const poolAction=e.target.closest("[data-runtime-knight-pool-action]");if(poolAction){
    const action=poolAction.dataset.runtimeKnightPoolAction;
    if(action==="clear")applyRuntime({kind:"clear-knight-pool"},"骑士指示物已清理，共享资源已保留");
    if(action==="increment"||action==="decrement"){const tokenId=poolAction.dataset.runtimeKnightPoolToken,delta=action==="increment"?1:-1;applyRuntime({kind:"adjust-knight-pool",tokenId,delta},"共享骑士池已更新")}
    return;
  }
  const mettleButton=e.target.closest("[data-runtime-mettle]");if(!mettleButton)return;
  const action=mettleButton.dataset.runtimeMettle;
  if(action==="draw")savePartyManager(characterRuntime.drawMettle(manager,characterData),"已抽取胆识卡");
  if(action==="finish")savePartyManager(characterRuntime.finishMettle(manager,characterData),"胆识行动已完成");
  if(action==="shuffle")savePartyManager(characterRuntime.shuffleMettle(manager),"胆识牌库已洗牌");
  if(action==="reset"&&confirm("重置为 18 张起始胆识牌？已解锁胆识卡会从本次战役牌库移除。"))savePartyManager(characterRuntime.resetMettle(manager,characterData),"胆识牌库已重置");
  if(action==="upgrade"){
    const cardId=$("#mettleUpgradeSelect").value;if(!cardId)return toast("请选择要解锁的胆识卡");
    if((manager.squireLeads||0)<5)return toast("侍从旁证不足 5 点");
    savePartyManager(characterRuntime.upgradeMettle(manager,cardId,characterData),"已解锁胆识卡并扣除 5 点侍从旁证");
  }
});
$("#partyModule").addEventListener("change",e=>{
  const manager=ensurePartyManagerState();if(!manager)return;const key=manager.activeMemberKey;
  if(e.target.matches("[data-runtime-attribute]")){savePartyManager(characterRuntime.setResource(manager,key,e.target.dataset.runtimeAttribute,e.target.dataset.runtimePart,Number(e.target.value)||0));return}
  if(e.target.matches("[data-runtime-squire-leads]")){savePartyManager(characterRuntime.setSquireLeads(manager,Number(e.target.value)||0));return}
  if(e.target.matches("[data-runtime-tier]")){savePartyManager(characterRuntime.setSquireTier(manager,key,e.target.value,characterData),"侍从等级卡已切换");return}
  if(e.target.matches("[data-runtime-knight-card]")){delete runtimeCardSides[`${key}:${e.target.dataset.runtimeKnightCard}`];savePartyManager(characterRuntime.setKnightCard(manager,key,e.target.dataset.runtimeKnightCard,e.target.value,characterData),"骑士卡已切换");return}
  if(e.target.matches("[data-runtime-curve-field]")){const[curve,field]=e.target.dataset.runtimeCurveField.split("|");savePartyManager(characterRuntime.setCurveField(manager,key,curve,field,e.target.value));return}
  if(e.target.matches("[data-runtime-equipment-add]")){if(!e.target.value)return;savePartyManager(characterRuntime.setLoadoutSelection(manager,key,{kind:"equipment",catalogId:e.target.value},characterData),"装备已添加");return}
  if(e.target.matches("[data-runtime-equipment-card]")){savePartyManager(characterRuntime.setLoadoutSelection(manager,key,{kind:"equipment",targetId:e.target.dataset.runtimeEquipmentCard,catalogId:e.target.value},characterData),"装备已替换");return}
  if(e.target.matches("[data-runtime-equipment-upgrade]")){savePartyManager(characterRuntime.setLoadoutSelection(manager,key,{kind:"upgrade",targetId:e.target.dataset.runtimeEquipmentUpgrade,catalogId:e.target.value},characterData),e.target.value?"装备升级已附加":"装备升级已拆下");return}
  if(e.target.matches("[data-runtime-card-add]")){if(!e.target.value)return;savePartyManager(characterRuntime.setLoadoutSelection(manager,key,{kind:"technique",catalogId:e.target.value},characterData),"招数已加入手牌");return}
  if(e.target.matches("[data-runtime-card-catalog]")){savePartyManager(characterRuntime.setLoadoutSelection(manager,key,{kind:"technique",targetId:e.target.dataset.runtimeCardCatalog,catalogId:e.target.value},characterData),"招数已替换");return}
  if(e.target.matches("[data-runtime-card-zone]")){savePartyManager(characterRuntime.moveTechnique(manager,key,e.target.dataset.runtimeCardZone,e.target.value),`招数已移至${characterZoneNames[e.target.value]}`)}
});
$("#printButton").onclick=()=>window.print();
addEventListener("online",()=>{setSave("正在同步…");sync();syncCampaign();if(sharedSettingsDirty)saveSharedSettings()});addEventListener("offline",()=>setSave("离线暂存",true));
setInterval(()=>{if(!user)return;if(viewMode==="edit"&&active&&!pending.length&&navigator.onLine)openSheet(active);else if(viewMode==="overview"&&navigator.onLine)refreshLists()},15000);
initOffline().finally(()=>loadSession().catch(e=>toast(e.message)));
