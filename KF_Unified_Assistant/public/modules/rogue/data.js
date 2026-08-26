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
  const lv = [5,4,5,4,4,3,3,5,3,2,3,2,1,2,1,2,1,2,1,1,1,2,2,1,3,3,4,3,1,1,5,4,2,4,1,2,3,4,3,5,2,4,5,2,4,4,5,4,5,3,5];
  const rewards = ["gear","class","heroic","peril","technique","technique","gear","wild","class","class","heroic","technique","heroic","heroic","peril","sigh","peril","peril","technique","class","heroic","heroic","technique","technique","technique","peril","virtue","heroic","virtue","virtue","peril","heroic","heroic","heroic","heroic","wild","peril","virtue","heroic","virtue","peril","technique","heroic","heroic","virtue","heroic","heroic","peril","technique","virtue","class"];
  const makeExact = (points, kingdom, prefix, page, levels, rewardList) => points.map((p,i) => ({ id:`${prefix}-${String(i+1).padStart(2,"0")}`, kingdom, level:levels[i], resurrection:levels[i], reward:rewardList[i], x:p[0]/993, y:p[1]/1404, page, cleared:false, links:[] }));
  const stoneLv = [5,4,5,4,5,3,4,5,3,2,3,2,1,1,1,2,1,2,1,1,2,2,3,1,1,5,3,1,1,2,2,5,3,4,1,1,2,4,3,4,1,5,2,3,4,3,5,4,4,5,4];
  const stoneRewards = ["peril","heroic","wild","peril","class","virtue","peril","heroic","class","technique","technique","peril","gear","technique","technique","class","sigh","virtue","class","gear","class","class","class","technique","peril","class","virtue","peril","heroic","gear","peril","class","class","class","class","virtue","heroic","peril","class","virtue","class","virtue","class","gear","class","class","technique","class","virtue","gear","class"];
  const nodes = [...makeExact(sunkenPoints,"sunken","sunken",0,lv,rewards), ...makeExact(stonePoints,"stone","stone",1,stoneLv,stoneRewards)];
  // The audit page stores corrections in localStorage so the main route can
  // use them immediately without rewriting this bundled manifest.  Keep the
  // source manifest as the fallback for tests, exports, and fresh browsers.
  const LABEL_OVERRIDES_KEY = "kf-rogue-label-overrides-v1";
  const sourceNodes = nodes.map(node => ({ ...node }));
  function readLabelOverrides() {
    try {
      const raw = globalThis.localStorage?.getItem(LABEL_OVERRIDES_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch { return {}; }
  }
  const labelOverrides = readLabelOverrides();
  nodes.forEach(node => {
    const override = labelOverrides[node.id];
    if (!override || typeof override !== "object") return;
    const level = Number(override.level);
    if (Number.isInteger(level) && level >= 1 && level <= 5) {
      node.level = level;
      node.resurrection = level;
    }
    const reward = String(override.reward || "");
    if (["heroic", "class", "peril", "technique", "gear", "virtue", "wild", "sigh"].includes(reward)) node.reward = reward;
  });
  // Connections detected from the brown branch artwork between the measured
  // circle centres. Each pair is an index into the 102 ordinary-node manifest.
  const tracedEdges = [[0,4],[0,7],[1,2],[1,3],[1,6],[2,9],[3,6],[3,10],[4,6],[4,7],[5,8],[5,9],[5,12],[6,8],[6,9],[6,13],[8,15],[9,12],[9,16],[10,11],[10,14],[11,16],[11,19],[12,14],[12,18],[13,21],[14,22],[15,19],[16,19],[16,23],[18,28],[19,20],[19,24],[20,28],[20,29],[21,25],[22,27],[22,28],[22,34],[23,35],[24,29],[24,32],[24,36],[26,31],[26,37],[27,28],[27,33],[27,36],[28,40],[32,38],[34,41],[35,43],[35,45],[35,49],[36,41],[36,48],[37,39],[37,42],[40,50],[41,45],[42,46],[43,49],[44,47],[44,50],[45,48],[45,50],[51,54],[51,60],[52,54],[52,58],[53,57],[53,59],[53,64],[54,56],[55,56],[55,58],[55,60],[56,60],[56,66],[56,70],[57,62],[58,63],[58,65],[58,69],[59,68],[60,71],[61,65],[61,66],[62,64],[62,74],[63,69],[63,70],[65,70],[65,75],[66,71],[67,70],[67,75],[67,76],[67,77],[68,71],[68,79],[69,72],[69,82],[70,81],[71,74],[71,80],[72,76],[72,77],[72,81],[73,79],[73,84],[74,80],[74,83],[75,82],[75,86],[76,86],[77,83],[77,87],[79,84],[80,81],[80,83],[80,89],[81,86],[81,88],[82,87],[82,89],[83,88],[83,92],[83,94],[84,90],[85,90],[85,93],[87,91],[87,96],[88,89],[88,98],[93,95],[93,98],[93,101],[94,96],[94,98],[97,98],[97,101]];
  tracedEdges.forEach(([a,b])=>{ const left=nodes[a], right=nodes[b]; if(left&&!left.links.includes(right.id))left.links.push(right.id); if(right&&!right.links.includes(left.id))right.links.push(left.id); });
  // The printed S hub is an additional node (the right page has 51 ordinary
  // circles plus S). Four branches visibly leave it toward the upper-right,
  // right, lower-right and lower-left printed circles respectively.
  const start = { id:"S", kingdom:"stone", level:0, resurrection:0, reward:"start", x:149/993, y:705/1404, page:1, cleared:false, links:[] };
  start.links = ["stone-18", "stone-23", "stone-28", "stone-35"];
  start.links.forEach(id=>{ const other=nodes.find(n=>n.id===id); if(other&&!other.links.includes(start.id))other.links.push(start.id); });
  nodes.push(start);

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
    "paracelsa": { class:["Inquisitor Portrait and Talent","The Just Blade of Kain Technique","Through the Fires of Anatiocha Technique","Apostate Portrait and Talent","Inquisitor’s Pursuit Technique","Power of the Pious Technique"], heroic:["Inquisitor","Apostate"], peril:["Inquisitor","Apostate"], technique:["Mind over Body","Fist of the Firstmen"], virtue:"+2 Bravery", gear:"The Bastard of the Church", wild:"+2 Rapport with a chosen Knight" },
    "ser-ubar": { class:["Rising Ape Portrait and Talent","Eye of the Storm Technique","Adrenaline Rush Technique","Beast Tamer Portrait and Talent","Untouchable Technique","Skull Crack Technique"], heroic:["Rising Ape","Beast Tamer"], peril:["Rising Ape","Beast Tamer"], technique:["Become a Stumbling Block","Spare Not The Rod"], virtue:"+1 Tenacity & +1 Sagacity", gear:"Uncompromising Justice", wild:"Tier 3 Warrior Mercenary" },
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
    const row = rewardRows[level]?.[id] || rewardRows[2]?.[id] || rewardRows[1].fleischritter;
    const value = row[category];
    return (Array.isArray(value) ? value[0] : value) || `Level ${level} ${category} reward`;
  };
  const rewardOptions = (level, id, category) => {
    const row = rewardRows[level]?.[id] || rewardRows[2]?.[id] || rewardRows[1].fleischritter;
    const value = row[category];
    return Array.isArray(value) ? [...value] : (value ? [value] : [`Level ${level} ${category} reward`]);
  };

  function randomResult(level, kingdom, roll) {
    const list = table[level]?.[kingdom] || table[1][kingdom] || table[1].sunken;
    const value = Math.max(1, Math.min(10, Number(roll) || Math.floor(Math.random() * 10) + 1));
    const [id, resultLevel] = list[value - 1];
    return { roll: value, monsterId: id, level: resultLevel };
  }

  function freshState() {
    const graph = nodes.map(node => ({ ...node, links: [...node.links], cleared: node.id === "S" }));
    return {
      schemaVersion: 1, status: "setup", roster: [], sharedRevives: 5, graalSighs: 0, nodes: graph, linksEdited: false,
      pendingBattle: null, pendingRewardChoice: null, currentNodeId: null, claimedRewards: {}, rewards: [], history: [],
      createdAt: Date.now(), updatedAt: Date.now(), lastResolution: null,
    };
  }

  function normalizeState(raw) {
    const base = freshState();
    if (!raw || typeof raw !== "object") return base;
    const result = { ...base, ...raw };
    // Coordinates, page, rewards, levels and links belong to the printed map
    // and must never be restored from an older browser save.  Older saves may
    // contain the pre-extraction positions, which otherwise make the hitboxes
    // drift away from the artwork after a coordinate update.
    const savedNodes = Array.isArray(raw.nodes) ? raw.nodes : [];
    result.nodes = base.nodes.map(node => {
      const saved = savedNodes.find(item => item.id === node.id);
      const links = raw.linksEdited && Array.isArray(saved?.links)
        ? [...new Set(saved.links.filter(link => base.nodes.some(item => item.id === link) && link !== node.id))]
        : [...node.links];
      return { ...node, cleared: Boolean(saved?.cleared), links };
    });
    result.linksEdited = Boolean(raw.linksEdited);
    result.roster = Array.isArray(raw.roster) ? raw.roster.slice(0, 4).map(member => ({
      ...member,
      player: String(member?.player || ""),
      gold: Math.max(0, Number(member?.gold) || 0),
      alive: member?.alive !== false,
      rewards: Array.isArray(member?.rewards) ? member.rewards : [],
      notes: String(member?.notes || ""),
      attributes: Object.fromEntries(ATTRIBUTE_KEYS.map(key => [key, Math.max(0, Number(member?.attributes?.[key]) || 0)])),
    })) : [];
    result.sharedRevives = Math.max(0, Math.min(999, Number(raw.sharedRevives) || 0));
    result.graalSighs = Math.max(0, Math.min(999, Number(raw.graalSighs) || 0));
    result.claimedRewards = raw.claimedRewards && typeof raw.claimedRewards === "object" ? raw.claimedRewards : {};
    result.pendingRewardChoice = raw.pendingRewardChoice && typeof raw.pendingRewardChoice === "object" ? raw.pendingRewardChoice : null;
    result.rewards = Array.isArray(raw.rewards) ? raw.rewards.slice(-100) : [];
    result.history = Array.isArray(raw.history) ? raw.history.slice(-100) : [];
    return result;
  }

  window.KF_ROGUE_RULES = Object.freeze({ KNIGHTS, NODES: nodes, SOURCE_NODES: sourceNodes, TABLE: table, ATTRIBUTE_KEYS, rewardRows, genericReward, rewardOptions, randomResult, freshState, normalizeState, LABEL_OVERRIDES_KEY });
})();
