(() => {
  "use strict";
  // KF_Withergraal_Sheets.pdf pp.1–2. Circle centres are in PDF points;
  // resources are independent of Clash level (withered nodes grant Devotion).
  const make = (kingdom, page, rows) => rows.map(([x,y,level,resurrection,devotion,reward],i) => ({
    id:`wither-${kingdom}-${String(i+1).padStart(2,"0")}`, stage:"withergraal", kingdom, page,
    x:x/595.276, y:y/841.89, level, resurrection, devotion, withered:resurrection===0,
    reward:({u:"stat",m:"mastery",p:"princess",s:"saint",g:"legendary",h:"sigh"})[reward], cleared:false, links:[],
  }));
  const sunken=make("sunken",0,[
    [362.18,77.09,12,0,0,"u"],[467.64,75.46,9,0,3,"m"],[529.33,110.33,10,0,5,"h"],
    [331.18,124.58,11,0,0,"g"],[438.58,123.59,9,0,3,"h"],[522.32,165.59,9,0,5,"s"],
    [390.73,171.46,10,20,0,"u"],[306.58,197.17,12,0,0,"g"],[452.64,206.21,8,0,2,"m"],
    [524.87,227.19,6,0,2,"s"],[367.58,239.59,8,0,2,"h"],[434.43,276.42,7,0,1,"u"],
    [521.95,277.59,6,6,0,"u"],[326.83,292.59,8,10,0,"u"],[482.08,324.58,6,0,1,"h"],
    [396.58,333.09,7,10,0,"m"],[387.8,397.42,6,6,0,"p"],[465.23,397.42,6,6,0,"u"],
    [317.98,431.84,9,15,0,"u"],[93.23,476.34,11,20,0,"u"],[514.23,481.42,6,6,0,"u"],
    [383.87,490.09,7,0,2,"s"],[236.58,499.59,10,20,0,"u"],[147.03,506.58,10,0,0,"p"],
    [314.07,517.19,8,0,2,"s"],[452.73,523.42,7,0,2,"u"],[90.41,547.84,12,0,0,"u"],
    [164.26,565.09,11,0,0,"g"],[352.98,566.58,7,6,0,"u"],[257.53,571.59,9,0,3,"p"],
    [375.48,610.33,8,0,2,"u"],[521.45,610.71,7,10,0,"h"],[185.49,620.58,10,0,5,"m"],
    [274.58,628.09,10,0,0,"g"],[87.53,637.83,11,0,0,"g"],[453.6,649.59,8,0,2,"p"],
    [349.18,675.09,9,0,0,"u"],[271.68,693.09,11,0,0,"u"],[427.01,708.59,8,10,0,"m"],
    [87.53,717.67,12,0,0,"g"],[189.78,728.34,12,0,0,"g"],[322.83,733.71,10,20,0,"g"],
    [396.23,761.42,9,15,0,"u"],
  ]);
  const stone=make("stone",1,[
    [263.67,125.59,10,0,5,"s"],[431.12,157.89,12,0,0,"u"],[154.04,167.71,7,0,2,"u"],
    [272.05,186.59,9,15,0,"h"],[406.85,202.09,10,20,0,"u"],[218.92,229.49,8,10,0,"m"],
    [335,227.59,9,0,3,"u"],[128.12,234.08,6,0,1,"p"],[474.17,231.34,11,20,0,"g"],
    [293.42,268.92,8,10,0,"u"],[405.4,270.92,10,0,5,"g"],[127.12,300.49,6,6,0,"u"],
    [203.64,300.59,7,0,2,"s"],[481.17,302.92,12,0,0,"g"],[360.32,309.92,9,0,0,"p"],
    [282.92,321.09,8,0,3,"u"],[426.92,346.59,11,0,0,"u"],[138.92,364.08,6,6,0,"h"],
    [261.14,374.42,7,0,1,"m"],[359.67,372.09,10,0,0,"m"],[196.11,401.09,6,0,1,"s"],
    [279.92,425.59,8,10,0,"h"],[359.52,433.58,9,15,0,"m"],[435.92,457.59,12,0,0,"g"],
    [153.67,475.34,6,0,1,"u"],[229.64,477.92,7,10,0,"u"],[297.72,484.69,8,0,2,"s"],
    [383.74,489.92,11,0,0,"u"],[475.64,504.92,11,0,0,"g"],[347.92,534.08,9,0,5,"s"],
    [137.92,547.09,6,6,0,"m"],[230.32,544.69,7,0,2,"h"],[428.67,552.42,10,0,0,"g"],
    [498.92,559.59,12,0,0,"u"],[300.92,580.09,8,0,3,"u"],[376.52,602.89,9,15,0,"u"],
    [167.52,606.49,7,6,0,"p"],[223.92,642.09,9,0,5,"s"],[311.64,678.92,10,0,5,"h"],
    [130.75,685.89,8,10,0,"p"],[219.42,700.59,10,0,0,"u"],[157.64,747.09,11,0,0,"g"],
    [250.64,759.08,12,0,0,"g"],
  ]);
  const nodes=[...sunken,...stone,{id:"wither-S",stage:"withergraal",kingdom:"stone",page:1,x:97.91/595.276,y:422.285/841.89,level:0,resurrection:0,devotion:0,withered:false,reward:"start",cleared:false,links:[]}];
  const link=(a,b)=>{const l=nodes.find(n=>n.id===a),r=nodes.find(n=>n.id===b);if(!l||!r)throw Error("Invalid Withergraal edge");if(!l.links.includes(b))l.links.push(b);if(!r.links.includes(a))r.links.push(a);};
  const edges=(kingdom,pairs)=>pairs.forEach(([a,b])=>link(`wither-${kingdom}-${String(a).padStart(2,"0")}`,`wither-${kingdom}-${String(b).padStart(2,"0")}`));
  // Exact advanced graph from the user-approved (3).json; do not infer forks.
  edges("sunken",[[1,4],[2,5],[3,6],[4,7],[4,8],[5,9],[6,9],[7,11],[9,12],[10,13],[11,16],[12,15],[13,15],[14,16],[15,18],[16,17],[17,21],[17,22],[18,21],[19,25],[20,24],[20,27],[21,32],[22,25],[22,26],[23,24],[23,30],[24,28],[25,30],[26,29],[26,32],[28,33],[29,31],[30,33],[30,34],[32,36],[33,35],[34,37],[34,38],[35,40],[36,39],[37,39],[38,41],[39,43],[42,43]]);
  edges("stone",[[1,4],[2,9],[3,6],[3,8],[4,7],[5,7],[5,9],[6,13],[7,10],[9,14],[10,13],[10,15],[11,15],[12,13],[12,18],[14,17],[15,16],[15,20],[16,19],[17,20],[17,24],[19,22],[20,23],[21,26],[22,23],[22,27],[24,28],[25,31],[26,27],[26,32],[27,30],[28,33],[29,33],[29,34],[30,33],[30,35],[31,37],[32,35],[32,37],[35,36],[36,39],[37,40],[38,40],[38,41],[39,41],[41,42],[42,43]]);
  [21].forEach(n=>link("wither-S",`wither-sunken-${String(n).padStart(2,"0")}`));
  [18,21,25].forEach(n=>link("wither-S",`wither-stone-${String(n).padStart(2,"0")}`));
  link("wither-sunken-10","wither-stone-08");
  link("wither-sunken-13","wither-stone-12");
  link("wither-sunken-32","wither-stone-40");
  const TABLE={
    6:{stone:[["M_YoungDevour",3],["M_PalebloodWorms",5],["M_WingedNightmare",5],["M_Ironcast",5],["M_Eggknight",5],["M_Stonemason",5],["M_Knighteater",5],["M_PuppetKing",5],["M_DevilSmeltedFears",4],["M_Panzerdragon",3]],sunken:[["M_YoungDevour",3],["M_Pumpkinhead",5],["M_HauntOf",5],["M_Ratwolves",5],["M_KnightFen",5],["M_Knighteater",5],["M_WhiteApe",5],["M_KingLaidLow",5],["M_DevilAncientDusk",4],["M_Toadragon",3]]},
    7:{stone:[["M_YoungDevour",4],["M_Panzergeists",5],["M_Ratwolves",6],["M_Pumpkinhead",6],["M_WingedNightmare",6],["M_Knighteater",6],["M_KnightFen",6],["M_Stonemason",6],["M_DevilSmeltedFears",5],["M_Panzerdragon",4]],sunken:[["M_YoungDevour",4],["M_FirstmenWarriors",5],["M_FirstmenLictor",5],["M_WingedNightmare",6],["M_PalebloodWorms",6],["M_Knighteater",6],["M_WhiteApe",6],["M_BogWitch",5],["M_DevilAncientDusk",5],["M_Toadragon",4]]},
    8:{stone:[["M_YoungDevour",5],["M_Panzergeists",6],["M_Ratwolves",7],["M_PalebloodWorms",7],["M_Ironcast",6],["M_KnightFen",7],["M_Knighteater",7],["M_Eggknight",6],["M_PuppetKing",6],["M_Panzerdragon",5]],sunken:[["M_YoungDevour",5],["M_FirstmenWarriors",6],["M_HauntOf",6],["M_FirstmenLictor",6],["M_Pumpkinhead",7],["M_Ratwolves",7],["M_KnightFen",7],["M_BogWitch",6],["M_KingLaidLow",6],["M_Toadragon",5]]},
    9:{stone:[["M_YoungDevour",6],["M_WingedNightmare",7],["M_Pumpkinhead",8],["M_PalebloodWorms",8],["M_KnightFen",8],["M_Ironcast",7],["M_Stonemason",7],["M_Eggknight",7],["M_DevilSmeltedFears",6],["M_Panzerdragon",6]],sunken:[["M_YoungDevour",6],["M_WingedNightmare",7],["M_FirstmenWarriors",7],["M_FirstmenLictor",7],["M_PalebloodWorms",8],["M_Pumpkinhead",8],["M_WhiteApe",7],["M_BogWitch",7],["M_DevilAncientDusk",6],["M_Toadragon",6]]},
    10:{stone:[["M_YoungDevour",7],["M_Panzergeists",7],["M_Ratwolves",8],["M_PalebloodWorms",9],["M_Ironcast",8],["M_Stonemason",8],["M_Eggknight",8],["M_PuppetKing",7],["M_DevilSmeltedFears",7],["M_Panzerdragon",7]],sunken:[["M_YoungDevour",7],["M_FirstmenWarriors",8],["M_HauntOf",7],["M_FirstmenLictor",8],["M_Ratwolves",8],["M_Knighteater",8],["M_BogWitch",8],["M_KingLaidLow",7],["M_DevilAncientDusk",7],["M_Toadragon",7]]},
    11:{stone:[["M_YoungDevour",8],["M_Panzergeists",8],["M_WingedNightmare",8],["M_Ratwolves",9],["M_Pumpkinhead",9],["M_KnightFen",9],["M_Stonemason",9],["M_PuppetKing",8],["M_DevilSmeltedFears",8],["M_Panzerdragon",8]],sunken:[["M_YoungDevour",8],["M_FirstmenWarriors",9],["M_FirstmenLictor",9],["M_HauntOf",8],["M_Ratwolves",9],["M_WhiteApe",8],["M_BogWitch",9],["M_KingLaidLow",8],["M_DevilAncientDusk",8],["M_Toadragon",8]]},
    12:{stone:[["M_YoungDevour",9],["M_Ironcast",9],["M_Panzergeists",9],["M_Knighteater",9],["M_Eggknight",9],["M_PuppetKing",9],["M_PuppetKing",9],["M_DevilSmeltedFears",9],["M_DevilSmeltedFears",9],["M_Panzerdragon",9]],sunken:[["M_YoungDevour",9],["M_WingedNightmare",9],["M_HauntOf",9],["M_Knighteater",9],["M_WhiteApe",9],["M_KingLaidLow",9],["M_KingLaidLow",9],["M_DevilAncientDusk",9],["M_DevilAncientDusk",9],["M_Toadragon",9]]},
  };
  const reward=(level,category,id,text,extra={})=>({id:`wither-${level}-${category}-${id}`,slot:id,level,category,text,...extra});
  const REWARDS=[];
  const add=(level,category,list)=>list.forEach((item,i)=>REWARDS.push(reward(level,category,i+1,typeof item==="string"?item:item.text,typeof item==="string"?{}:item)));
  const princesses={6:"Gwyneira",7:"Slawia",8:"Fiona",9:"Cassia",10:"Chantelle"};
  const saints={6:["Saint Hygia"],7:["Saint Kain"],8:["Saint Urbain"],9:["Saint Hieronymus","Saint Eudes"],10:["Saint Linde"]};
  for(let level=6;level<=10;level++){
    add(level,"princess",[level===7?{text:"Slawia / 30 黄金",alternatives:[{text:"Slawia",unlockPrincess:"Slawia"},{text:"30 黄金",gold:30}]}:princesses[level]]);add(level,"saint",saints[level]);
    add(level,"mastery",Array.from({length:level>=8?2:1},()=>({text:"随机精通",requiresName:true})));
  }
  // Every printed checkbox has a stable party-wide identity. The last IX
  // checkbox is one choice between two boons, not two independent rewards.
  // Storage keys remain stable so previously recorded growth is not lost.
  // Meanings checked against the core rulebook pp.17 and 100.
  // Chinese keywords follow A1 KF中规1.06 pp.17,66,90,93–94.
  // Magic Limit is absent from that glossary, so retain its original wording.
  const GROWTH_LABELS={maxVigor:"最大活力 Maximum Vigor",zealThreshold:"狂热阈值 Zeal Threshold",magicLimit:"Magic Limit",symbolP:"战意 Passion",symbolHExclaim:"烈度上限 Heat Limit",symbolCircleExclaim:"灾祸耐限 Bane Limit",symbolDragon:"移速 Speed",symbolDown:"卡牌刷新 Card Refresh",symbolHArrows:"烈度刷新 Heat Refresh",symbolCards:"手牌上限 Hand Limit",symbolSword:"强度 Power"};
  const GROWTH_HELP={maxVigor:"提高最大活力；不会仅因最大活力提高而自动提高当前活力。",zealThreshold:"提高狂热阈值。",magicLimit:"提高 Magic Limit。",symbolP:"永久战意加值。",symbolHExclaim:"提高烈度上限。",symbolCircleExclaim:"提高灾祸耐限。",symbolDragon:"提高一次移动行动最多可移动的格数。",symbolDown:"增加刷新步骤可刷新的卡牌数。",symbolHArrows:"增加刷新步骤失去的烈度。",symbolCards:"提高可持有的招数卡数量上限。",symbolSword:"增加强度加值，不增加强度骰数量。"};
  const stat=(key,amount,icon)=>({text:`${GROWTH_LABELS[key]} +${amount}`,bonuses:{[key]:amount},icon,help:GROWTH_HELP[key]});
  const stats={
    6:[stat("symbolP",1,"stat-p"),stat("symbolHExclaim",1,"stat-h-bang"),stat("maxVigor",1),stat("zealThreshold",1)],
    7:[stat("symbolP",1,"stat-p"),stat("symbolHExclaim",1,"stat-h-bang"),stat("maxVigor",1),stat("symbolCircleExclaim",1,"stat-circle-bang")],
    8:[stat("symbolP",1,"stat-p"),stat("symbolHExclaim",2,"stat-h-bang"),stat("symbolDragon",1,"stat-dragon"),stat("symbolDown",1,"stat-down")],
    9:[stat("symbolP",1,"stat-p"),stat("maxVigor",2),stat("symbolCircleExclaim",1,"stat-circle-bang"),{text:"狂热阈值 +1 / Magic Limit +1",alternatives:[stat("zealThreshold",1),stat("magicLimit",1)]}],
    10:[stat("symbolP",1,"stat-p"),stat("symbolHArrows",1,"stat-h-arrows"),stat("symbolDown",1,"stat-down"),stat("magicLimit",1)],
    11:[stat("symbolP",2,"stat-p"),stat("symbolCircleExclaim",1,"stat-circle-bang"),stat("symbolCards",1,"stat-cards"),stat("symbolSword",1,"stat-sword")],
    12:[stat("symbolCircleExclaim",1,"stat-circle-bang"),stat("symbolCards",1,"stat-cards"),stat("symbolHArrows",1,"stat-h-arrows"),stat("symbolSword",1,"stat-sword")],
  };
  Object.entries(stats).forEach(([level,list])=>add(Number(level),"stat",list));
  add(10,"legendary",["Chains of the Damned","Anointed Splinter of Forgotten Sin","Consecrated Dirk","The Law of Blood"]);
  add(11,"legendary",["King’s Reward","Infested Heart","Dragoon’s Pride","Sword of a Sunken Legacy","Skypiercer Lance","The Famisher"]);
  add(12,"legendary",["Blackscale Hornblade","Eudes-Blessed Lance","Scale-spike Armor","Reclaimed Bogpump","Voracious Blade","Fullplate of the Devourer"]);
  const GROWTH_ICONS=Object.fromEntries(Object.values(stats).flat().filter(r=>r.icon).map(r=>[Object.keys(r.bonuses)[0],r.icon]));
  window.KF_WITHERGRAAL_DATA=Object.freeze({NODES:nodes,TABLE,REWARDS,GROWTH_LABELS,GROWTH_HELP,GROWTH_ICONS,mapSource:{file:"kf-rogue-map-2026-10-27 (3).json",sha256:"b4c5cf37623f3471d7da5ff3e8825da8f9ce927d59401d8f8751bb4bfbe7c55c"},source:"KF_Withergraal.pdf pp.2–5; KF_Withergraal_Sheets.pdf pp.1–4; KF_Rulebook.pdf pp.17,76,100"});
})();
