(() => {
  "use strict";

  const knight = (id, name) => ({ id, name });
  const KNIGHTS = Object.freeze([
    knight("fleischritter", "Fleischritter"), knight("kara", "Kara"),
    knight("ser-sonch", "Ser Sonch"), knight("renholder", "Renholder"),
    knight("paracelsa", "Paracelsa"), knight("ser-ubar", "Ser Ubar"),
    knight("stoneface", "Stoneface"),
  ]);
  const ATTRIBUTE_KEYS = Object.freeze(["might", "fortitude", "insight", "sagacity", "bravery", "tenacity"]);

  // The source pages are displayed side by side. Coordinates are normalized to
  // the individual page so the same manifest works at every image size.
  const makeNodes = (kingdom, prefix, points, levels, rewards) => points.map((point, index) => ({
    id: `${prefix}-${String(index + 1).padStart(2, "0")}`,
    kingdom, level: levels[index % levels.length], resurrection: levels[index % levels.length],
    reward: rewards[index % rewards.length], x: point[0], y: point[1], page: kingdom === "sunken" ? 0 : 1,
    cleared: false,
    links: [],
  }));

  const sunkenPoints = [[602,95],[791,95],[896,149],[736,170],[536,194],[888,248],[658,261],[507,305],[765,320],[888,356],[618,378],[733,441],[885,448],[547,471],[812,528],[668,542],[896,594],[524,595],[780,654],[649,655],[896,716],[526,726],[744,749],[869,801],[642,815],[385,834],[223,842],[521,863],[764,868],[882,898],[129,918],[259,946],[590,952],[422,956],[743,970],[881,1028],[633,1042],[296,1043],[446,1060],[129,1072],[773,1091],[592,1137],[262,1142],[896,1142],[448,1170],[716,1195],[129,1216],[303,1236],[536,1241],[849,1247],[666,1292]];
  // Re-extracted from the node circles in rosegraal-tree.jpg (right page is
  // normalized to its 993×1404 page area).  The S hub is the large circle at
  // (149,705); the right-page ordinary circle at (200,491) remains in the
  // manifest separately.
  const stonePoints = [[439,182],[621,230],[250,260],[454,290],[692,316],[563,362],[363,364],[804,368],[198,370],[492,433],[687,437],[335,490],[812,490],[200,491],[608,504],[473,527],[727,569],[222,600],[859,606],[608,614],[433,621],[760,664],[319,674],[470,708],[608,720],[863,751],[735,757],[246,795],[380,801],[501,811],[651,822],[815,850],[586,898],[382,916],[216,920],[728,926],[851,945],[504,971],[637,1019],[268,1024],[791,1053],[494,1070],[369,1086],[642,1124],[207,1162],[772,1174],[364,1189],[542,1193],[674,1278],[245,1284],[415,1290]];
  // User-approved basic map. Copy values exactly; do not infer branch links.
  const BASIC_MAP_SOURCE=Object.freeze({file:"kf-rogue-map-2026-10-27 (3).json",sha256:"b4c5cf37623f3471d7da5ff3e8825da8f9ce927d59401d8f8751bb4bfbe7c55c"});
  const BASIC_LINKS_REVISION=2;
  const ADVANCED_MAP_REVISION=1;
  const LABEL_OVERRIDES_KEY="kf-rogue-label-overrides-v1";
  const approvedBasicRows=[
    ["sunken-01",5,"gear",5,0,false,["sunken-05"]],
    ["sunken-02",4,"class",4,0,false,["sunken-03","sunken-04"]],
    ["sunken-03",5,"class",5,0,false,["sunken-02"]],
    ["sunken-04",4,"peril",4,0,false,["sunken-02","sunken-07"]],
    ["sunken-05",4,"technique",4,0,false,["sunken-01","sunken-07","sunken-08"]],
    ["sunken-06",3,"technique",3,0,false,["sunken-09","sunken-10"]],
    ["sunken-07",3,"gear",3,0,false,["sunken-04","sunken-05","sunken-09"]],
    ["sunken-08",5,"wild",5,0,false,["sunken-05"]],
    ["sunken-09",3,"class",3,0,false,["sunken-06","sunken-07"]],
    ["sunken-10",2,"class",2,0,false,["sunken-06","sunken-13","stone-09"]],
    ["sunken-11",3,"heroic",3,0,false,["sunken-12","sunken-14"]],
    ["sunken-12",2,"technique",2,0,false,["sunken-11","sunken-15"]],
    ["sunken-13",1,"heroic",1,0,false,["sunken-10","sunken-15","stone-14"]],
    ["sunken-14",2,"class",2,0,false,["sunken-16","sunken-11"]],
    ["sunken-15",1,"peril",1,0,false,["sunken-12","sunken-13","sunken-19"]],
    ["sunken-16",2,"sigh",2,0,false,["sunken-14","sunken-18","sunken-20"]],
    ["sunken-17",1,"peril",1,0,false,["S","stone-14"]],
    ["sunken-18",2,"peril",2,0,false,["sunken-16","sunken-22"]],
    ["sunken-19",1,"technique",1,0,false,["sunken-15","sunken-20","sunken-21"]],
    ["sunken-20",1,"class",1,0,false,["sunken-16","sunken-19","sunken-23"]],
    ["sunken-21",1,"heroic",1,0,false,["sunken-19","S"]],
    ["sunken-22",2,"class",2,0,false,["sunken-18","sunken-26"]],
    ["sunken-23",2,"technique",2,0,false,["sunken-20","sunken-28","sunken-29"]],
    ["sunken-24",1,"technique",1,0,false,["sunken-29","S"]],
    ["sunken-25",3,"technique",3,0,false,["sunken-33","sunken-34"]],
    ["sunken-26",3,"peril",3,0,false,["sunken-22","sunken-27","sunken-38"]],
    ["sunken-27",4,"gear",4,0,false,["sunken-26","sunken-32"]],
    ["sunken-28",3,"heroic",3,0,false,["sunken-23","sunken-34"]],
    ["sunken-29",1,"virtue",1,0,false,["sunken-23","sunken-24","sunken-35"]],
    ["sunken-30",1,"gear",1,0,false,["sunken-35","sunken-41","stone-35"]],
    ["sunken-31",5,"peril",5,0,false,["sunken-32"]],
    ["sunken-32",4,"class",4,0,false,["sunken-27","sunken-31"]],
    ["sunken-33",2,"heroic",2,0,false,["sunken-25","sunken-35","sunken-39"]],
    ["sunken-34",4,"class",4,0,false,["sunken-25","sunken-28"]],
    ["sunken-35",1,"class",1,0,false,["sunken-29","sunken-30","sunken-33"]],
    ["sunken-36",2,"wild",2,0,false,["sunken-44","stone-40","stone-45"]],
    ["sunken-37",3,"peril",3,0,false,["sunken-39","sunken-42"]],
    ["sunken-38",4,"sigh",4,0,false,["sunken-26","sunken-40","sunken-43"]],
    ["sunken-39",3,"heroic",3,0,false,["sunken-33","sunken-37"]],
    ["sunken-40",5,"virtue",5,0,false,["sunken-38"]],
    ["sunken-41",2,"peril",2,0,false,["sunken-30","sunken-50"]],
    ["sunken-42",4,"technique",4,0,false,["sunken-37","sunken-45","sunken-46"]],
    ["sunken-43",5,"heroic",5,0,false,["sunken-38"]],
    ["sunken-44",2,"class",2,0,false,["sunken-36","sunken-50"]],
    ["sunken-45",4,"gear",4,0,false,["sunken-42","sunken-48"]],
    ["sunken-46",4,"heroic",4,0,false,["sunken-42","sunken-49","sunken-51"]],
    ["sunken-47",5,"heroic",5,0,false,["sunken-48"]],
    ["sunken-48",4,"peril",4,0,false,["sunken-45","sunken-47"]],
    ["sunken-49",5,"technique",5,0,false,["sunken-46"]],
    ["sunken-50",3,"sigh",3,0,false,["sunken-41","sunken-44"]],
    ["sunken-51",5,"class",5,0,false,["sunken-46"]],
    ["stone-01",5,"peril",5,0,false,["stone-04"]],
    ["stone-02",5,"heroic",5,0,false,["stone-04"]],
    ["stone-03",3,"wild",3,0,false,["stone-07","stone-09"]],
    ["stone-04",4,"peril",4,0,false,["stone-01","stone-02","stone-06"]],
    ["stone-05",4,"class",4,0,false,["stone-06","stone-08"]],
    ["stone-06",3,"virtue",3,0,false,["stone-04","stone-05","stone-10"]],
    ["stone-07",2,"technique",2,0,false,["stone-03","stone-12"]],
    ["stone-08",4,"heroic",4,0,false,["stone-05","stone-13"]],
    ["stone-09",2,"class",2,0,false,["stone-03","sunken-10"]],
    ["stone-10",3,"technique",3,0,false,["stone-06","stone-11"]],
    ["stone-11",3,"peril",3,0,false,["stone-10","stone-15"]],
    ["stone-12",2,"gear",2,0,false,["stone-07","stone-14","stone-16"]],
    ["stone-13",5,"technique",5,0,false,["stone-08"]],
    ["stone-14",1,"technique",1,0,false,["stone-12","sunken-13","sunken-17"]],
    ["stone-15",2,"class",2,0,false,["stone-11","stone-16","stone-20"]],
    ["stone-16",1,"sigh",1,0,false,["stone-12","stone-15","stone-21"]],
    ["stone-17",3,"technique",3,0,false,["stone-20","stone-25"]],
    ["stone-18",1,"virtue",1,0,false,["stone-21","S"]],
    ["stone-19",5,"class",5,0,false,["stone-22"]],
    ["stone-20",2,"heroic",2,0,false,["stone-15","stone-17"]],
    ["stone-21",1,"class",1,0,false,["stone-16","stone-18","stone-24"]],
    ["stone-22",4,"wild",4,0,false,["stone-19","stone-26","stone-27"]],
    ["stone-23",1,"gear",1,0,false,["stone-29","S"]],
    ["stone-24",2,"gear",2,0,false,["stone-21","stone-25","stone-30"]],
    ["stone-25",2,"peril",2,0,false,["stone-17","stone-24"]],
    ["stone-26",5,"technique",5,0,false,["stone-22"]],
    ["stone-27",3,"heroic",3,0,false,["stone-22","stone-31","stone-32"]],
    ["stone-28",1,"technique",1,0,false,["stone-35","S"]],
    ["stone-29",1,"peril",1,0,false,["stone-23","stone-30","stone-34"]],
    ["stone-30",2,"virtue",2,0,false,["stone-24","stone-29","stone-33"]],
    ["stone-31",3,"peril",3,0,false,["stone-27","stone-36"]],
    ["stone-32",4,"technique",4,0,false,["stone-27","stone-37"]],
    ["stone-33",2,"heroic",2,0,false,["stone-30","stone-36","stone-38"]],
    ["stone-34",1,"wild",1,0,false,["stone-29","stone-40","stone-42"]],
    ["stone-35",1,"heroic",1,0,false,["stone-28","stone-40","sunken-30"]],
    ["stone-36",2,"technique",2,0,false,["stone-31","stone-33"]],
    ["stone-37",4,"class",4,0,false,["stone-32","stone-41"]],
    ["stone-38",3,"virtue",3,0,false,["stone-33","stone-39"]],
    ["stone-39",4,"class",4,0,false,["stone-38","stone-42"]],
    ["stone-40",1,"class",1,0,false,["stone-34","stone-35","sunken-36"]],
    ["stone-41",5,"virtue",5,0,false,["stone-37"]],
    ["stone-42",2,"class",2,0,false,["stone-34","stone-39"]],
    ["stone-43",3,"class",3,0,false,["stone-45","stone-48"]],
    ["stone-44",4,"virtue",4,0,false,["stone-46","stone-48","stone-49"]],
    ["stone-45",3,"gear",3,0,false,["stone-43","sunken-36"]],
    ["stone-46",5,"peril",5,0,false,["stone-44"]],
    ["stone-47",4,"class",4,0,false,["stone-48","stone-51"]],
    ["stone-48",4,"technique",4,0,false,["stone-43","stone-44","stone-47"]],
    ["stone-49",5,"gear",5,0,false,["stone-44"]],
    ["stone-50",5,"sigh",5,0,false,["stone-51"]],
    ["stone-51",4,"heroic",4,0,false,["stone-47","stone-50"]],
    ["S",0,"start",0,0,false,["stone-18","stone-23","stone-28","sunken-17","sunken-21","sunken-24"]]
  ];
  const approvedBasicById=new Map(approvedBasicRows.map(([id,level,reward,resurrection,devotion,withered,links])=>[id,{id,level,reward,resurrection,devotion,withered,links}]));
  const makeExact=(points,kingdom)=>points.map((point,index)=>{
    const id=`${kingdom}-${String(index+1).padStart(2,"0")}`,value=approvedBasicById.get(id);
    if(!value)throw new Error(`Missing approved basic node: ${id}`);
    return {...value,stage:"rosegraal",kingdom,page:kingdom==="sunken"?0:1,x:point[0]/993,y:point[1]/1404,cleared:false,links:[...value.links]};
  });
  const nodes=[...makeExact(sunkenPoints,"sunken"),...makeExact(stonePoints,"stone"),{...approvedBasicById.get("S"),stage:"rosegraal",kingdom:"stone",page:1,x:149/993,y:705/1404,cleared:false,links:[...approvedBasicById.get("S").links]}];
  const sourceNodes=nodes.map(node=>({...node,links:[...node.links]}));
  const WITHER = window.KF_WITHERGRAAL_DATA || {NODES:[],TABLE:{},REWARDS:[],GROWTH_LABELS:{},GROWTH_ICONS:{}};
  const ALL_NODES = [...nodes,...WITHER.NODES];
  const STAGES = Object.freeze({
    rosegraal:{id:"rosegraal",title:"玫瑰圣杯路径",image:"/assets/rogue/rosegraal-tree.jpg",startNodeId:"S",pageCount:2},
    withergraal:{id:"withergraal",title:"枯萎圣杯 · 进阶肉鸽",image:"/assets/rogue/withergraal-tree.jpg?v=2",startNodeId:"wither-S",pageCount:2},
  });
  const stageMeta = stage => STAGES[stage] || STAGES.rosegraal;
  const getStageNodes = (state, stage=state?.stage||"rosegraal") => (state?.nodes||ALL_NODES).filter(n=>(n.stage||"rosegraal")===stage);
  // These are the printed V endpoints. Keep their identity independent of
  // editable node labels and links: reaching any one ends the basic path.
  const ROSEGRAAL_FINISH_NODE_IDS = Object.freeze([
    "sunken-01","sunken-03","sunken-08","sunken-31","sunken-40","sunken-43","sunken-47","sunken-49","sunken-51",
    "stone-01","stone-02","stone-13","stone-19","stone-26","stone-41","stone-46","stone-49","stone-50",
  ]);
  const stageComplete = (state,stage=state.stage||"rosegraal") => {
    const list=getStageNodes(state,stage).filter(n=>n.reward!=="start");
    return stage==="rosegraal"
      ? list.some(n=>n.cleared&&ROSEGRAAL_FINISH_NODE_IDS.includes(n.id))
      : list.length>0&&list.every(n=>n.cleared);
  };
  const isAvailable = (state,node) => Boolean(node && (node.stage||"rosegraal")===(state.stage||"rosegraal") && node.reward!=="start" && !node.cleared && !state.pendingBattle && !state.pendingRewardChoice && state.status==="active" && node.links.some(id=>state.nodes.some(other=>other.id===id&&other.cleared)));
  const canEnterWithergraal = state => state.stage!=="withergraal" && !state.postgame && !state.pendingBattle && !state.pendingRewardChoice && WITHER.NODES.length>0 && (state.status==="won"||stageComplete(state,"rosegraal"));
  function enterWithergraal(state) {
    if(!canEnterWithergraal(state))return false;
    state.stage="withergraal";state.postgame=true;state.status="active";state.sharedRevives=20;
    state.nodes.forEach(n=>{if(n.id==="wither-S")n.cleared=true;});
    state.roster.forEach(m=>{m.postgame=true;});
    state.history.push({at:Date.now(),type:"withergraal-start",sharedRevives:20});
    return true;
  }
  // The core Rogue's Path reward rule permits the node's level or lower;
  // Withergraal changes the recipient to the party, not this level range.
  const advancedRewardOptions = (state,node) => WITHER.REWARDS.filter(r=>r.level<=Number(node?.level)&&r.category===node?.reward&&!state.advancedClaims?.[r.id]);
  const advancedRewardBoon = (option,choice={}) => {
    if(!option?.alternatives)return option;
    const index=Number(choice.alternative??0);
    return Number.isInteger(index)?option.alternatives[index]:null;
  };
  const advancedRewardNeedsMember = (option,choice={}) => Boolean(option&&(!["princess","saint"].includes(option.category)||advancedRewardBoon(option,choice)?.gold));
  function claimAdvancedReward(state,node,choice) {
    const option=advancedRewardOptions(state,node).find(r=>r.id===choice?.rewardId);
    if(!option)return {ok:false,message:"请选择尚未领取的奖励。"};
    const boon=advancedRewardBoon(option,choice);
    if(!boon)return {ok:false,message:"请选择有效的奖励选项。"};
    const needsMember=advancedRewardNeedsMember(option,choice);
    const member=needsMember?state.roster.find(m=>m.id===choice.memberId):null;
    if(needsMember&&!member)return {ok:false,message:"请选择领取奖励的骑士。"};
    const actualName=String(choice.name||"").trim().slice(0,120);
    if(option.requiresName){
      if(!actualName)return {ok:false,message:"请填写实际抽到的精通名称。"};
      const key=actualName.toLocaleLowerCase().replace(/\s+/g," ");
      if(Object.values(state.advancedClaims||{}).some(c=>c.category==="mastery"&&c.name?.toLocaleLowerCase().replace(/\s+/g," ")===key))return {ok:false,message:"队伍已经获得这项精通，请重新抽取。"};
    }
    const text=option.requiresName?`精通：${actualName}`:boon.text;
    if(member){
      member.growth=member.growth||{};
      Object.entries(boon.bonuses||{}).forEach(([key,value])=>{member.growth[key]=(Number(member.growth[key])||0)+value;});
      if(boon.gold)member.gold=(Number(member.gold)||0)+boon.gold;
      const canonical = value => String(value || "").toLocaleLowerCase().replace(/[’‘]/g,"'").replace(/[^\p{L}\p{N}]/gu,"");
      const catalogName = option.text === "Sword of a Sunken Legacy" ? "Sword Of A Sunked Legacy" : option.text;
      const equipment = option.category === "legendary" ? window.KF_EQUIPMENT_DATA?.cards?.find(card => card.tier === "Legendary" && canonical(card.name) === canonical(catalogName)) : null;
      member.rewards.push({key:option.id,stage:"withergraal",level:option.level,nodeLevel:node.level,category:option.category,text,icon:boon.icon||"",...(equipment?{equipmentId:equipment.id,cardId:equipment.cardId}:{})});
    }
    if(option.category==="princess"&&!boon.gold)state.unlockedPrincesses=[...new Set([...(state.unlockedPrincesses||[]),boon.unlockPrincess||boon.text])];
    if(option.category==="saint")state.unlockedSaints=[...new Set([...(state.unlockedSaints||[]),option.text])];
    state.advancedClaims=state.advancedClaims||{};
    state.advancedClaims[option.id]={nodeId:node.id,level:option.level,nodeLevel:node.level,memberId:member?.id||null,category:option.category,name:option.requiresName?actualName:boon.text,text,...(option.alternatives?{alternative:Number(choice.alternative??0)}:{}),at:Date.now()};
    return {ok:true,text:`${member?`${member.name}：`:"队伍解锁："}${text}`};
  }

  const entry = (id, level) => ({ id, level });
  const table = {
    1: {
      stone: [["M_Ironcast",1],["M_Ironcast",1],["M_Panzergeists",1],["M_Eggknight",1],["M_Eggknight",1],["M_PalebloodWorms",1],["M_Pumpkinhead",1],["M_Stonemason",1],["M_WingedNightmare",1],["M_Knighteater",1]],
      sunken: [["M_FirstmenWarriors",1],["M_FirstmenWarriors",1],["M_FirstmenLictor",1],["M_WhiteApe",1],["M_WhiteApe",1],["M_HauntOf",1],["M_PalebloodWorms",1],["M_KnightFen",1],["M_Ratwolves",2],["M_BogWitch",1]],
    },
    2: {
      stone: [["M_Ironcast",2],["M_Ironcast",2],["M_Panzergeists",2],["M_WingedNightmare",2],["M_PalebloodWorms",2],["M_Eggknight",2],["M_Eggknight",2],["M_Stonemason",2],["M_Ratwolves",3],["M_Knighteater",2]],
      sunken: [["M_FirstmenWarriors",2],["M_FirstmenWarriors",2],["M_FirstmenLictor",2],["M_WingedNightmare",2],["M_Pumpkinhead",2],["M_WhiteApe",2],["M_WhiteApe",2],["M_HauntOf",2],["M_KnightFen",2],["M_BogWitch",2]],
    },
    3: {
      stone: [["M_Ironcast",3],["M_Ratwolves",4],["M_Eggknight",3],["M_Eggknight",3],["M_PuppetKing",1],["M_PuppetKing",1],["M_Panzergeists",3],["M_WingedNightmare",3],["M_Stonemason",3],["M_Stonemason",3]],
      sunken: [["M_FirstmenWarriors",3],["M_HauntOf",3],["M_WhiteApe",3],["M_WhiteApe",3],["M_KingLaidLow",1],["M_KingLaidLow",1],["M_FirstmenLictor",3],["M_Pumpkinhead",3],["M_KnightFen",3],["M_KnightFen",3]],
    },
    4: {
      stone: [["M_Panzergeists",4],["M_Pumpkinhead",4],["M_Eggknight",4],["M_Eggknight",4],["M_PuppetKing",3],["M_PuppetKing",3],["M_DevilSmeltedFears",1],["M_DevilSmeltedFears",1],["M_Knighteater",3],["M_PalebloodWorms",4]],
      sunken: [["M_FirstmenLictor",4],["M_HauntOf",4],["M_WhiteApe",4],["M_WhiteApe",4],["M_KingLaidLow",3],["M_KingLaidLow",3],["M_DevilAncientDusk",1],["M_DevilAncientDusk",1],["M_BogWitch",3],["M_WingedNightmare",4]],
    },
    5: {
      stone: [["M_Stonemason",4],["M_KnightFen",4],["M_PuppetKing",4],["M_PuppetKing",4],["M_DevilSmeltedFears",3],["M_DevilSmeltedFears",3],["M_DevilSmeltedFears",3],["M_Panzerdragon",1],["M_Panzerdragon",1],["M_YoungDevour",1]],
      sunken: [["M_BogWitch",4],["M_Knighteater",4],["M_KingLaidLow",4],["M_KingLaidLow",4],["M_DevilAncientDusk",3],["M_DevilAncientDusk",3],["M_DevilAncientDusk",3],["M_Toadragon",1],["M_Toadragon",1],["M_YoungDevour",1]],
    },
  };

  const rewardRows = {
    1: {
      "fleischritter": { class:"Fervid Meal Technique", heroic:"Feuerkoch", peril:"Feuerkoch", technique:["Crunchy Batter","Stick in Their Throat"], virtue:"+1 Fortitude", gear:"Cleaver Sword", wild:"+1 Rapport with a chosen Knight" },
      "kara": { class:"Picking Your Battles Technique", heroic:"Thrill-Seeker", peril:"Thrill-Seeker", technique:["Dodge and Weave","Fleet of Foot"], virtue:"+1 Bravery", gear:"Reclaimed Spear", wild:"+1 Rapport with a chosen Knight" },
      "ser-sonch": { class:"Quick, Find Me a Weak Spot! Technique", heroic:"Gravestalker", peril:"Gravestalker", technique:["Bulwark","Corrente di Battaglia Style"], virtue:"+1 Bravery", gear:"Storied Blade", wild:"Tier 2 Bard Mercenary" },
      "renholder": { class:"Brain over Brawn Technique", heroic:"Illusionist", peril:"Illusionist", technique:["Dazzling Light","Mirage"], virtue:"+1 Sagacity", gear:"Wide-brimmed Wizard's Hat", wild:"+1 Rapport with a chosen Knight" },
      "paracelsa": { class:"The Fire of my Faith Technique", heroic:"Faithful", peril:"Faithful", technique:["Righteous Hand of God","Evade the Devil’s Snare"], virtue:"+1 Insight", gear:"Mantle of the Faithful", wild:"+1 Rapport with a chosen Knight" },
      "ser-ubar": { class:"Monkey See Technique", heroic:"Simianthrope", peril:"Simianthrope", technique:["Cold Open","Knuckle Charge"], virtue:"+1 Tenacity", gear:"Helm of the Silent Witness", wild:"Tier 2 Healer Mercenary" },
      "stoneface": { class:"Impossible to Ignore Technique", heroic:"Good, Strong Hands", peril:"Good, Strong Hands", technique:["Unshakeable","Get Clear!"], virtue:"+1 Tenacity", gear:"Stalagmight", wild:"+1 Rapport with a chosen Knight" },
    },
    2: {
      "fleischritter": { class:["Fleischjäger Portrait and Talent","Meat Shield Technique","Braise for Impact Technique","Fleischkrieger Portrait and Talent","Prized Morsel Technique","You Won’t Like Me When I’m Hangry Technique"], heroic:["Fleischjäger","Fleischkrieger"], peril:["Fleischjäger","Fleischkrieger"], technique:["Sizzling Striga","Mise En Place"], virtue:"+1 Bravery", gear:"Great Antler Helm", wild:"+1 Rapport with a chosen Knight" },
      "kara": { class:["Wilder Errant Portrait and Talent","I’ll Finish What You Started Technique","Cunning Misdirection Technique","Kingsguard Portrait and Talent","Move Up! Technique","You Can Do It! Technique"], heroic:["Wilder Errant","Kingsguard"], peril:["Wilder Errant","Kingsguard"], technique:["Keep on Rolling","Survival Hack"], virtue:"+1 Insight", gear:"Wilder Cloak", wild:"+1 Rapport with a chosen Knight" },
      "ser-sonch": { class:["Vaunted Folk Tale Portrait and Talent","Veteran’s Insight Technique","Carrot and Stick Technique","Exemplary Leader Portrait and Talent","One for All Technique","Friend in Need Technique"], heroic:["Vaunted Folk Tale","Exemplary Leader"], peril:["Vaunted Folk Tale","Exemplary Leader"], technique:["Veteran’s Orders","Simian Squire"], virtue:"+1 Might", gear:"Blinder Helm", wild:"+1 Rapport with a chosen Knight" },
      "renholder": { class:["Luxite Portrait and Talent","Luxite Purification Technique","Burning Barrage Technique","Tenebrist Portrait and Talent","Dark Augury Technique","Shadow Manipulation Technique"], heroic:["Luxite","Tenebrist"], peril:["Luxite","Tenebrist"], technique:["Inspiring Light","Gaze Beyond the Veil"], virtue:"+1 Sagacity", gear:"Bluesteel Sword", wild:"+1 Rapport with a chosen Knight" },
      "paracelsa": { class:["Truthseeker Portrait and Talent","Theocratic Warfare Technique","Ours is the Hope Technique","Fireheart Zealot Portrait and Talent","Rewarded for my Trials Technique","Second Chance Technique"], heroic:["Truthseeker","Fireheart Zealot"], peril:["Truthseeker","Fireheart Zealot"], technique:["Armed with Truth","Flee From Evil"], virtue:"+1 Bravery", gear:"Imperial Templar's Kite Shield", wild:"Devote to Saint Linde" },
      "ser-ubar": { class:["Primal Warrior Portrait and Talent","Force of Nature Technique","The Heart Relentless Technique","Simian Strategist Portrait and Talent","Warcry Technique","Great Ape Flex Technique"], heroic:["Primal Warrior","Simian Strategist"], peril:["Primal Warrior","Simian Strategist"], technique:["Exploit Flaw","Primal Leap"], virtue:"+1 Sagacity", gear:"Aegis of Averted Eyes", wild:"+1 Rapport with a chosen Knight" },
      "stoneface": { class:["Obedient Son Portrait and Talent","Scrape Clean Technique","Hammerthrow Momentum Technique","Rebellious Child Portrait and Talent","Eshin Ishitsugi Technique","Avalanche Hammerstrike Technique"], heroic:["Obedient Son","Rebellious Child"], peril:["Obedient Son","Rebellious Child"], technique:["Danger Zone","Hard Headed"], virtue:"+1 Tenacity", gear:"Ruinous Polehammer", wild:"+5" },
    },
  };
  rewardRows[3] = {
    "fleischritter": { class:"Distracting Bait Technique", heroic:"Metzger", peril:"Metzger", technique:["Panflip","Nothing Goes To Waste"], virtue:"+2 Bravery", gear:"Paired Cleavers", wild:"Devote to Saint Eudes" },
    "kara": { class:"Crusader's Strike Technique", heroic:"Wildwalker", peril:"Wildwalker", technique:["Avert a Dire Fate","Rebuke, Reposition, Retaliate!"], virtue:"+2 Bravery", gear:"Masterforged Shield", wild:"+5" },
    "ser-sonch": { class:"Double Roll Technique", heroic:"The Man, Made Myth", peril:"The Man, Made Myth", technique:["Leader's Instinct","Time to Shine"], virtue:"+1 Insight & +1 Fortitude", gear:"Brash Carapace", wild:"+1 Rapport with a chosen Knight" },
    "renholder": { class:"Placeholder Technique", heroic:"Theurgist", peril:"Theurgist", technique:["Shadowslip","Infernal Bargain"], virtue:"+2 Insight", gear:"Wyrdweave Garb", wild:"+5" },
    "paracelsa": { class:"Blinding Faith Technique", heroic:"Questioner", peril:"Questioner", technique:["Scion of the Light","Shield of Faith"], virtue:"+2 Tenacity", gear:"Questing Champion's Chain Armor", wild:"+1 Rapport with a chosen Knight" },
    "ser-ubar": { class:"Canopy Swing Technique", heroic:"Ape Militant", peril:"Ape Militant", technique:["Fiery Eyes, Golden Pupils","Bestial Stamina"], virtue:"+1 Tenacity & +1 Sagacity", gear:["Laxlaw's Dual Standard (Rigid)","Laxlaw's Dual Standard (Pliant)"], wild:"+1 Rapport with a chosen Knight" },
    "stoneface": { class:"Go Beyond! Technique", heroic:"Marble Marionette", peril:"Marble Marionette", technique:["Unstoppable Force","Take the Hit"], virtue:"+2 Might", gear:"Plate of the Sleeping Giant", wild:"+1 Rapport with a chosen Knight" },
  };
  rewardRows[4] = {
    "fleischritter": { class:["Teufelsjäger Portrait and Talent","White Meat Power Punch Technique","The Power of Bacon Compels You! Technique","Schwarzesser Portrait and Talent","Butcher’s Twine Technique","Meat Puppet Technique"], heroic:["Teufelsjäger","Schwarzesser"], peril:["Teufelsjäger","Schwarzesser"], technique:["Just a Fleisch Wound","Stick to the Recipe"], virtue:"+2 Might", gear:"Pighead Talisman", wild:"+2 Rapport with a chosen Knight" },
    "kara": { class:["Oathbreaker Portrait and Talent","Dice with the Devil Technique","Knight in Shining Armor Technique","Steadfast Portrait and Talent","Oath of Valor Technique","Just Like We Practised Technique"], heroic:["Oathbreaker","Steadfast"], peril:["Oathbreaker","Steadfast"], technique:["Act on Instinct","Master the Terrain"], virtue:"+2 Tenacity", gear:"Wilder Plate", wild:"+2 Rapport with a chosen Knight" },
    "ser-sonch": { class:["Hero to the People Portrait and Talent","Tag Team Technique","Friend Indeed Technique","Fameseeker Portrait and Talent","Knowing Is Half the Battle Technique","Know Thine Enemy Technique"], heroic:["Hero to the People","Fameseeker"], peril:["Hero to the People","Fameseeker"], technique:["Lead by Example","Chaos Monkey"], virtue:"+2 Tenacity", gear:"Gloryseeker's Cape", wild:"+2 Rapport with a chosen Knight" },
    "renholder": { class:["Harmonized Soul Portrait and Talent","Chiaroscuro Technique","Blackfire Technique","Luxfire Magus Portrait and Talent","The Maelstrom Within Technique","Doublestrike Enchantment Technique"], heroic:["Harmonized Soul","Luxfire Magus"], peril:["Harmonized Soul","Luxfire Magus"], technique:["Soulscorch","Incandescent Aura"], virtue:"+2 Sagacity", gear:"Torchbearer's Swordstaff", wild:"Tier 3 Mage Mercenary" },
    "paracelsa": { class:["Inquisitor Portrait and Talent","The Just Blade of Kain Technique","Through the Fires of Anatiocha Technique","Apostate Portrait and Talent","Inquisitor’s Pursuit Technique","Power of the Pious Technique"], heroic:["Inquisitor","Apostate"], peril:["Inquisitor","Apostate"], technique:["Become a Stumbling Block","Spare Not The Rod"], virtue:"+2 Bravery", gear:"The Bastard of the Church", wild:"+2 Rapport with a chosen Knight" },
    "ser-ubar": { class:["Rising Ape Portrait and Talent","Eye of the Storm Technique","Adrenaline Rush Technique","Beast Tamer Portrait and Talent","Untouchable Technique","Skull Crack Technique"], heroic:["Rising Ape","Beast Tamer"], peril:["Rising Ape","Beast Tamer"], technique:["Mind over Body","Fist of the Firstmen"], virtue:"+1 Tenacity & +1 Sagacity", gear:"Uncompromising Justice", wild:"Tier 3 Warrior Mercenary" },
    "stoneface": { class:["No Strings on Me Portrait and Talent","I’ll Be Your Rock Technique","Skipping Stone Technique","Mangiarovina Portrait and Talent","Rock, Meet Hard Place Technique","Memories of Who I Was Technique"], heroic:["No Strings on Me","Mangiarovina"], peril:["No Strings on Me","Mangiarovina"], technique:["Solid Outside, Human Inside","Unassailable"], virtue:"+2 Fortitude", gear:"Shield of the Defiant", wild:"Tier 3 Rogue Mercenary" },
  };
  rewardRows[5] = {
    "fleischritter": { class:"Filleting Frenzy Technique", heroic:"Meisterschlächter", peril:"Meisterschlächter", technique:["Maillard Reaction","Butcher's Bargain"], virtue:"+1 Fortitude & +1 Might", gear:"Trophy Armor", wild:"Tier 3 Warrior Mercenary" },
    "kara": { class:"Know Thyself Technique", heroic:"Knight of the Grand Kingdoms", peril:"Knight of the Grand Kingdoms", technique:["Can't Catch Me!","Living Weapon"], virtue:"+2 Fortitude", gear:"Horn Bow", wild:"Tier 3 Rogue Mercenary" },
    "ser-sonch": { class:"Call an Undertaker! Technique", heroic:"Enduring Legend", peril:"Enduring Legend", technique:["Bastion","Fleur de Bataille Style"], virtue:"+2 Sagacity", gear:"Camaraderie Blades", wild:"Tier 3 Bard Mercenary" },
    "renholder": { class:"Power Overwhelming Technique", heroic:"Hermetic Master", peril:"Hermetic Master", technique:["Final Flash","Shadows Between Worlds"], virtue:"+2 Fortitude", gear:"Lightgrasp", wild:"+2 Rapport with a chosen Knight" },
    "paracelsa": { class:"Divine Intervention Technique", heroic:"Reverent", peril:"Reverent", technique:["Nothing Shall Stay My Hand","Not Your Time"], virtue:"+2 Insight", gear:"Blade of the First Sacrament", wild:"Tier 3 Healer Mercenary" },
    "ser-ubar": { class:"Inner Turmoil Technique", heroic:"Champion of Utrebant", peril:"Champion of Utrebant", technique:["Feral Aggression","Simian Sprint"], virtue:"+2 Might", gear:"Mantle of the First Sin", wild:"+2 Rapport with a chosen Knight" },
    "stoneface": { class:"My Turn Technique", heroic:"Tableau Vivant", peril:"Tableau Vivant", technique:["Vita Ex Mortis","Split the Heavens"], virtue:"+2 Tenacity", gear:"Terracotta Emblem", wild:"+2 Rapport with a chosen Knight" },
  };
  const genericReward = (level, id, category) => {
    if (Number(level) > 5) throw new RangeError("进阶奖励必须使用团队奖励池");
    const row = rewardRows[level]?.[id] || rewardRows[2]?.[id] || rewardRows[1].fleischritter;
    const value = row[category];
    return (Array.isArray(value) ? value[0] : value) || `Level ${level} ${category} reward`;
  };
  const rewardOptions = (level, id, category) => {
    if (Number(level) > 5) throw new RangeError("进阶奖励必须使用团队奖励池");
    const row = rewardRows[level]?.[id] || rewardRows[2]?.[id] || rewardRows[1].fleischritter;
    const value = row[category];
    return Array.isArray(value) ? [...value] : (value ? [value] : [`Level ${level} ${category} reward`]);
  };
  function basicRewardOptions(state,node,member) {
    if(!member||node?.reward==="sigh")return [];
    const options=[];
    for(let level=Math.min(5,Math.trunc(Number(node?.level)||0));level>=1;level--){
      const value=rewardRows[level]?.[member.knightId]?.[node.reward];
      if(!value)continue;
      const values=Array.isArray(value)?value:[value];
      // Rigid/Pliant are two forms under one printed Gear checkbox.
      const groups=node.reward==="gear"?[values]:values.map(text=>[text]);
      for(const group of groups){
        const key=text=>`${member.id}:${level}:${node.reward}:${text}`;
        // Earlier builds swapped these two Knights' IV technique cells.
        // Respect the already-consumed checkbox without rewriting inventories.
        const priorNames=level===4&&node.reward==="technique"?{
          paracelsa:{"Become a Stumbling Block":"Mind over Body","Spare Not The Rod":"Fist of the Firstmen"},
          "ser-ubar":{"Mind over Body":"Become a Stumbling Block","Fist of the Firstmen":"Spare Not The Rod"},
        }[member.knightId]:null;
        const claimed=group.some(text=>[text,priorNames?.[text]].filter(Boolean).some(name=>state.claimedRewards?.[key(name)]||member.rewards?.some(reward=>reward.key===key(name))));
        if(!claimed)options.push({id:key(group[0]),level,text:group.join(" / "),rewards:group,keys:group.map(key)});
      }
    }
    return options;
  }

  function randomResult(level, kingdom, roll) {
    const list = table[level]?.[kingdom] || WITHER.TABLE[level]?.[kingdom];
    if(!list)throw new RangeError(`没有等级 ${level} / ${kingdom} 的肉鸽遭遇表`);
    const value = Math.max(1, Math.min(10, Math.trunc(Number(roll) || Math.floor(Math.random() * 10) + 1)));
    const [id, resultLevel] = list[value - 1];
    return { roll: value, monsterId: id, level: resultLevel };
  }

  // A map configuration contains no campaign progress, party or rewards.
  function createMapConfig(mapNodes) {
    return {schemaVersion:1,nodes:(Array.isArray(mapNodes)?mapNodes:[]).map(node=>({
      id:node.id,level:node.level,reward:node.reward,resurrection:node.resurrection,
      devotion:node.devotion??0,
      withered:node.reward==="start"||node.stage!=="withergraal"?false:(typeof node.withered==="boolean"?node.withered:node.resurrection===0),
      links:Array.isArray(node.links)?[...node.links]:[],
    }))};
  }
  function validateMapConfig(raw) {
    const errors=[];
    const fail=message=>({ok:false,config:null,errors:[message]});
    if(!raw||typeof raw!=="object"||Array.isArray(raw)||raw.schemaVersion!==1)return fail("地图配置版本无效。");
    if(!Array.isArray(raw.nodes)||raw.nodes.length!==ALL_NODES.length)return fail(`地图配置必须包含完整的 ${ALL_NODES.length} 个节点。`);
    const defaults=new Map(ALL_NODES.map(node=>[node.id,node])),provided=new Map();
    const basicRewards=new Set(["heroic","class","peril","technique","gear","virtue","wild","sigh"]);
    const advancedRewards=new Set(["stat","mastery","princess","saint","legendary","sigh"]);
    for(const node of raw.nodes){
      if(!node||typeof node!=="object"||Array.isArray(node)||typeof node.id!=="string"||!defaults.has(node.id)){errors.push("地图配置含未知节点。");continue;}
      if(provided.has(node.id)){errors.push(`${node.id} 重复出现。`);continue;}
      provided.set(node.id,node);
      const base=defaults.get(node.id),start=base.reward==="start",advanced=base.stage==="withergraal";
      if(start){
        if(node.level!==0||node.reward!=="start"||node.resurrection!==0||node.devotion!==0||node.withered!==false)errors.push(`${node.id} 起点的等级、奖励和资源固定。`);
      }else{
        if(!Number.isInteger(node.level)||node.level<(advanced?6:1)||node.level>(advanced?12:5))errors.push(`${node.id} 等级超出当前阶段范围。`);
        if(!(advanced?advancedRewards:basicRewards).has(node.reward))errors.push(`${node.id} 奖励类型与阶段不符。`);
        if(typeof node.withered!=="boolean"||(!advanced&&node.withered))errors.push(`${node.id} 枯萎状态无效。`);
      }
      for(const key of ["resurrection","devotion"])if(!Number.isSafeInteger(node[key])||node[key]<0)errors.push(`${node.id} ${key==="resurrection"?"复活":"虔信"}必须是非负整数。`);
      if(!advanced&&node.devotion!==0)errors.push(`${node.id} 基础节点不能发放虔信。`);
      if(!Array.isArray(node.links)||node.links.length>=ALL_NODES.length){errors.push(`${node.id} 连线列表无效。`);continue;}
      const seen=new Set();
      for(const id of node.links){
        if(typeof id!=="string"||!defaults.has(id)){errors.push(`${node.id} 连接了未知节点。`);continue;}
        if(id===node.id)errors.push(`${node.id} 不能连接自身。`);
        if(seen.has(id))errors.push(`${node.id} 连线重复。`);
        seen.add(id);
        if(defaults.get(id).stage!==base.stage)errors.push(`${node.id} 不能跨基础、进阶阶段连线。`);
      }
    }
    if(provided.size!==defaults.size)errors.push("地图配置缺少节点或含重复节点。");
    for(const [id,node] of provided){
      if(!Array.isArray(node.links)||node.links.length>=ALL_NODES.length)continue;
      for(const target of node.links)if(provided.has(target)&&Array.isArray(provided.get(target).links)&&!provided.get(target).links.includes(id))errors.push(`${id} ↔ ${target} 必须双向连接。`);
    }
    if(errors.length)return {ok:false,config:null,errors};
    return {ok:true,config:{schemaVersion:1,nodes:ALL_NODES.map(base=>{
      const node=provided.get(base.id);
      return {id:node.id,level:node.level,reward:node.reward,resurrection:node.resurrection,devotion:node.devotion,withered:node.withered,links:[...node.links]};
    })},errors:[]};
  }
  function applyMapConfig(state,raw) {
    const checked=validateMapConfig(raw);
    if(!checked.ok||!state||typeof state!=="object"||!Array.isArray(state.nodes))return false;
    const byId=new Map(state.nodes.map(node=>[node?.id,node]));
    if(byId.size!==ALL_NODES.length||state.nodes.length!==ALL_NODES.length||checked.config.nodes.some(node=>!byId.has(node.id)))return false;
    for(const node of checked.config.nodes)Object.assign(byId.get(node.id),{...node,links:[...node.links]});
    state.mapConfig=checked.config;
    state.linksEdited=true;
    state.basicLinksRevision=BASIC_LINKS_REVISION;
    state.advancedMapRevision=ADVANCED_MAP_REVISION;
    state.defaultLinks=state.nodes.map(node=>({id:node.id,links:[...node.links]}));
    return true;
  }

  function freshState() {
    const graph = ALL_NODES.map(node => ({ ...node, links: [...node.links], cleared: node.id === "S" }));
    return {
      schemaVersion: 2, stage:"rosegraal", postgame:false, status: "setup", roster: [], sharedRevives: 5, graalSighs: 0, nodes: graph, linksEdited: false, basicLinksRevision:BASIC_LINKS_REVISION,advancedMapRevision:ADVANCED_MAP_REVISION,
      advancedClaims:{},unlockedPrincesses:[],unlockedSaints:[],
      pendingBattle: null, pendingRewardChoice: null, currentNodeId: null, claimedRewards: {}, rewards: [], history: [],
      createdAt: Date.now(), updatedAt: Date.now(), lastResolution: null,
    };
  }

  function normalizeState(raw) {
    const base = freshState();
    if (!raw || typeof raw !== "object") return base;
    const result = { ...base, ...raw };
    result.schemaVersion=2;
    result.stage=raw.stage==="withergraal"?"withergraal":"rosegraal";
    result.postgame=result.stage==="withergraal"||raw.postgame===true;
    // Adopt the user's approved maps once, including old saved templates.
    // Each stage tracks adoption separately; later deliberate edits remain.
    const migrateBasicMap=!(Number(raw.basicLinksRevision)>=BASIC_LINKS_REVISION);
    const migrateAdvancedMap=!(Number(raw.advancedMapRevision)>=ADVANCED_MAP_REVISION);
    const savedNodes=Array.isArray(raw.nodes)?raw.nodes:[];
    result.basicLinksRevision=BASIC_LINKS_REVISION;
    result.advancedMapRevision=ADVANCED_MAP_REVISION;
    const savedById = new Map(savedNodes.filter(node=>node&&typeof node.id==="string").map(node=>[node.id,node]));
    const baseById = new Map(base.nodes.map(node=>[node.id,node]));
    const useSavedLinks=node=>raw.linksEdited&&!(migrateAdvancedMap&&node.stage==="withergraal")&&!(migrateBasicMap&&node.stage==="rosegraal");
    result.nodes = base.nodes.map(node => {
      const saved = savedById.get(node.id);
      const links=useSavedLinks(node)&&Array.isArray(saved?.links)
        ? [...new Set(saved.links.filter(id=>id!==node.id&&baseById.get(id)?.stage===node.stage))]
        : [...node.links];
      return { ...node, cleared: node.reward==="start" ? (node.stage==="rosegraal"||result.postgame) : Boolean(saved?.cleared), links };
    });
    // Normalize undirected custom paths once. A saved endpoint also controls
    // edges to nodes missing from an older save (for example the new stage).
    result.nodes.forEach((left,index)=>result.nodes.slice(index+1).forEach(right=>{
      if(left.stage!==right.stage)return;
      const savedLeft=savedById.get(left.id),savedRight=savedById.get(right.id);
      const hasLeft=useSavedLinks(left)&&Array.isArray(savedLeft?.links);
      const hasRight=useSavedLinks(right)&&Array.isArray(savedRight?.links);
      const linked=hasLeft||hasRight
        ? (hasLeft&&savedLeft.links.includes(right.id))||(hasRight&&savedRight.links.includes(left.id))
        : base.nodes[index].links.includes(right.id);
      if(linked){
        if(!left.links.includes(right.id))left.links.push(right.id);
        if(!right.links.includes(left.id))right.links.push(left.id);
      }else{
        left.links=left.links.filter(id=>id!==right.id);
        right.links=right.links.filter(id=>id!==left.id);
      }
    }));
    result.linksEdited = Boolean(raw.linksEdited);
    if(result.linksEdited)result.defaultLinks=result.nodes.map(node=>({id:node.id,links:[...node.links]}));
    else delete result.defaultLinks;
    result.roster = Array.isArray(raw.roster) ? raw.roster.slice(0, 4).map(member => ({
      ...member,
      player: String(member?.player || ""),
      gold: Math.max(0, Number(member?.gold) || 0),
      alive: member?.alive !== false,
      rewards: Array.isArray(member?.rewards) ? member.rewards : [],
      notes: String(member?.notes || ""),
      postgame:result.postgame||member?.postgame===true,
      devotion:Math.max(0,Math.trunc(Number(member?.devotion)||0)),
      growth:Object.fromEntries(Object.keys(WITHER.GROWTH_LABELS).map(key=>[key,Math.max(0,Number(member?.growth?.[key])||0)])),
      attributes: Object.fromEntries(ATTRIBUTE_KEYS.map(key => [key, Math.max(0, Number(member?.attributes?.[key]) || 0)])),
    })) : [];
    result.sharedRevives = Math.max(0, Math.min(999, Number(raw.sharedRevives) || 0));
    result.graalSighs = Math.max(0, Math.min(999, Number(raw.graalSighs) || 0));
    result.claimedRewards = raw.claimedRewards && typeof raw.claimedRewards === "object" ? raw.claimedRewards : {};
    result.advancedClaims=raw.advancedClaims&&typeof raw.advancedClaims==="object"&&!Array.isArray(raw.advancedClaims)?raw.advancedClaims:{};
    result.unlockedPrincesses=Array.isArray(raw.unlockedPrincesses)?raw.unlockedPrincesses.filter(s=>typeof s==="string"):[];
    result.unlockedSaints=Array.isArray(raw.unlockedSaints)?raw.unlockedSaints.filter(s=>typeof s==="string"):[];
    // Clarify earlier symbol-only entries without re-applying any growth or
    // money. The existing checkbox IDs and saved numeric values stay intact.
    const rewardById=new Map(WITHER.REWARDS.map(option=>[option.id,option]));
    const refreshRewardRecord=(record,option,claim=record)=>{
      if(!record||!option)return record;
      const alternative=option.alternatives
        ? (Number.isInteger(claim?.alternative)?claim.alternative:(option.id==="wither-9-stat-4"&&/魔法|魔力|magic/i.test(claim?.text||record.text||"")?1:0))
        : undefined;
      const boon=advancedRewardBoon(option,{alternative})||option;
      return {...record,level:option.level,...(option.requiresName?{}:{text:boon.text,...(Object.hasOwn(record,"name")?{name:boon.text}:{})}),...(option.alternatives?{alternative}:{})};
    };
    result.advancedClaims=Object.fromEntries(Object.entries(result.advancedClaims).map(([id,claim])=>[id,refreshRewardRecord(claim,rewardById.get(id))]));
    result.roster.forEach(member=>{
      member.rewards=member.rewards.map(record=>refreshRewardRecord(record,rewardById.get(record?.key),result.advancedClaims[record?.key]||record));
    });
    result.pendingRewardChoice = raw.pendingRewardChoice && typeof raw.pendingRewardChoice === "object" ? raw.pendingRewardChoice : null;
    result.rewards = Array.isArray(raw.rewards) ? raw.rewards.slice(-100) : [];
    result.history = Array.isArray(raw.history) ? raw.history.slice(-100) : [];
    // A saved, validated configuration is authoritative over bundled defaults,
    // legacy label overrides and old inferred-link migrations on both screens.
    if(Object.hasOwn(raw,"mapConfig")){
      const checked=validateMapConfig(raw.mapConfig);
      if(checked.ok){
        const config=checked.config;
        if(migrateBasicMap||migrateAdvancedMap){
          const approved=new Map(createMapConfig(ALL_NODES).nodes.map(node=>[node.id,node]));
          config.nodes=config.nodes.map(node=>(node.id.startsWith("wither-")?migrateAdvancedMap:migrateBasicMap)?approved.get(node.id):node);
        }
        applyMapConfig(result,config);
      }else delete result.mapConfig;
    }
    if(result.stage==="rosegraal"&&result.status!=="setup"&&!result.pendingBattle&&!result.pendingRewardChoice&&stageComplete(result,"rosegraal"))result.status="won";
    return result;
  }

  window.KF_ROGUE_RULES = Object.freeze({ KNIGHTS, NODES: nodes, ALL_NODES, WITHER_NODES:WITHER.NODES, SOURCE_NODES: sourceNodes, BASIC_MAP_SOURCE, BASIC_LINKS_REVISION, ADVANCED_MAP_REVISION, TABLE:{...table,...WITHER.TABLE}, ATTRIBUTE_KEYS, rewardRows, genericReward, rewardOptions, basicRewardOptions, randomResult, freshState, normalizeState, LABEL_OVERRIDES_KEY,createMapConfig,validateMapConfig,applyMapConfig,
    STAGES,ROSEGRAAL_FINISH_NODE_IDS,stageMeta,getStageNodes,stageComplete,isAvailable,canEnterWithergraal,enterWithergraal,advancedRewardOptions,advancedRewardBoon,advancedRewardNeedsMember,claimAdvancedReward,GROWTH_LABELS:WITHER.GROWTH_LABELS,GROWTH_HELP:WITHER.GROWTH_HELP||{},GROWTH_ICONS:WITHER.GROWTH_ICONS });
})();
