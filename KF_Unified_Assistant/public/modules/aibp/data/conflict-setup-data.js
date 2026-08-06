window.KF_CONFLICT_SETUPS = {
  standard: [
    "放置冲突版图，并确保不会移动下方的王国地图。",
    "洗混伤亡牌组，准备骑士与资源指示物、命中骰和强度骰。",
    "保留远征期间产生的骑士属性变化，并将所有招数卡翻至冲突面。",
    "沿用远征开始时确定的骑士配置。",
    "放置怪物面板、惯常行为、标志行为，并准备 AI、BP 与特质牌。",
    "若设置时发生晋升，按 AI 0 牌的说明将其放到 AI 牌组顶部。",
    "按怪物面板放置激活指示物。",
    "按照当前怪物的冲突图放置地形、骑士与怪物。",
    "将首要目标交给战意最高的骑士，并放置其余配件。",
    "初步冲突：按怪物面板放置初步损伤，不触发晋升。"
  ],
  aftermath: [
    {
      title: "1. 伤亡",
      items: [
        ["死亡", "若有骑士死亡，将其复活，并把红色资源恢复至最大值。当前正在进行调查或自由漫游的每名复活骑士失去一半线索，向上取整。"],
        ["属性重置", "所有骑士将绿色、蓝色和红色属性，以及对应轨道的上限，重置为各自的初始值。"]
      ]
    },
    {
      title: "2. 休整",
      items: [
        ["招数", "将冷却区、延迟区和弃牌区中的所有招数牌返回手牌。"],
        ["状况", "所有骑士弃置全部状况牌和状况指示物。"],
        ["灾厄", "每名骑士弃置 2 枚灾厄指示物。"],
        ["其他指示物", "弃置所有通用、修正和骑士指示物。"],
        ["装备", "重置所有已耗竭的装备。收回全部已弃置的非消耗品装备；已弃置的消耗品在远征结束前仍留在弃牌区，远征结束后加入商人牌组。所有非消耗品装备恢复全部充能。"]
      ]
    },
    {
      title: "3. 战利品",
      items: [
        ["胜利搜索", "若赢得本次冲突，执行“冲突搜寻 1”和“搜寻 3”。"],
        ["遗弃搜索", "若输掉本次冲突，执行“搜寻 3”。"]
      ]
    },
    {
      title: "4. 继续前进",
      items: [
        ["有骑士正在执行任务", "前往指定的故事段落；若不确定，请查看引导你进入本次冲突的故事段落。"],
        ["没有骑士正在执行任务", "若胜利：展示冲突进入休息，完整冲突进入战利品阶段。若失败：远征失败，然后进入战利品阶段。"]
      ]
    }
  ],
  monsters: [
    {
      id: "M_Ratwolves",
      mapsByKingdom: {
        sunken: "assets/conflict-maps/ratwolves-sunken.jpg",
        stone: "assets/conflict-maps/ratwolves-stone.jpg"
      },
      name: "鼠狼群",
      en: "Ratwolves",
      kingdom: "both",
      type: "杂兵",
      initialBp: { BP1: 4 },
      pages: [38, 39],
      tiles: ["立柱 ×8", "2×2 瓦砾 ×1", "L 形瓦砾 ×1"],
      steps: [
        "给全部鼠狼模型套上编号底环。将 1-4 号鼠狼随机放到图示编号位置，并按箭头确定朝向。",
        "随机排序 4 张 BP 1，背面朝上放到杂兵轨 1-4 格。",
        "按所在王国取用特质牌：石之公国使用“Parasite Bed”，沉没王国使用“Bile and Poison”。",
        "继续执行本场特质牌带来的额外冲突设置。"
      ],
      notes: ["图示中的数字同时对应模型底环与杂兵轨位置。"]
    },
    {
      id: "M_WingedNightmare",
      mapsByKingdom: {
        sunken: "assets/conflict-maps/winged-nightmare-sunken.jpg",
        stone: "assets/conflict-maps/winged-nightmare-stone.jpg"
      },
      name: "翼生梦魇",
      en: "Winged Nightmare",
      kingdom: "both",
      type: "杂兵",
      initialBp: { BPS: 1 },
      conditionalCards: [
        { id: "M_WingedNightmare:BPX:2", minLevel: 2, zone: "reference" }
      ],
      pages: [40, 41],
      tilesByKingdom: {
        sunken: ["立柱 ×15", "L 形瓦砾 ×4", "1×2 车辙 ×4", "无底井 ×1"],
        stone: ["立柱 ×15", "L 形瓦砾 ×4", "2×2 瓦砾 ×2", "无底井 ×1"]
      },
      steps: [
        "将翼生梦魇模型放到图示位置，并按箭头确定朝向。",
        "将“Wide Wings”BP 牌正面朝上固定放在 BP 抽取区域；它不会移动或翻面。",
        "完全冲突等级 2 及以上：将“Bloody Defiance”BP 特质牌放在怪物面板旁；初步冲突忽略该特质。",
        "继续执行本场特质牌带来的额外冲突设置。"
      ],
      notes: ["地图和所需地形会根据当前战役王国自动切换。"]
    },
    {
      id: "M_Pumpkinhead",
      mapsByKingdom: {
        sunken: "assets/conflict-maps/pumpkinheads-sunken.jpg",
        stone: "assets/conflict-maps/pumpkinheads-stone.jpg"
      },
      name: "南瓜头精怪",
      en: "Pumpkinhead Monstrosities",
      kingdom: "both",
      type: "杂兵",
      initialBp: { BPS: 6 },
      initialBpSides: { back: 2, face: 4 },
      initialBpRevealed: true,
      initialGenericMarkersOnBack: 1,
      pages: [42, 43],
      tilesByKingdom: {
        sunken: ["营火 ×1", "1×2 沼泽 ×8", "红色幼苗指示物 ×2"],
        stone: ["营火 ×1", "立柱 ×16", "红色幼苗指示物 ×2"]
      },
      steps: [
        "取出全部 BP，随机将其中 2 张翻至幼苗面，再把所有 BP 随机放到杂兵轨 1-6 格。",
        "给 4 个南瓜头模型和 2 枚红色幼苗指示物套上/放上与杂兵轨 BP 类型对应的编号。",
        "将编号 1-6 的模型与幼苗随机放到图示位置，并按箭头确定朝向。",
        "按所在王国取用特质牌：石之公国使用“Floraforge Fury”，沉没王国使用“Venomous Quagmire”。",
        "把未使用的幼苗指示物和愚者牌组放在怪物面板旁；杂兵轨上的每张幼苗 BP 各放 1 枚通用指示物。",
        "继续执行本场特质牌带来的额外冲突设置。"
      ]
    },
    {
      id: "M_KnightFen",
      mapsByKingdom: {
        sunken: "assets/conflict-maps/knight-fen-sunken.jpg",
        stone: "assets/conflict-maps/knight-fen-stone.jpg"
      },
      name: "沼泽骑士",
      en: "Knight of the Fen",
      kingdom: "both",
      type: "首领",
      pages: [44, 45],
      tiles: ["1×2 沼泽 ×6", "L 形瓦砾 ×3", "2×2 瓦砾 ×2"],
      steps: [
        "将沼泽骑士模型放到图示位置，并按箭头确定朝向。",
        "把“Engulfed”特质牌与 6 枚 Doppelknight 指示物放在怪物面板旁。",
        "按所在王国取用特质牌：石之公国使用“Recycled Armor”，沉没王国使用“Quick Summons”。",
        "继续执行本场特质牌带来的额外冲突设置。"
      ]
    },
    {
      id: "M_PalebloodWorms",
      mapsByKingdom: {
        sunken: "assets/conflict-maps/paleblood-worms-sunken.jpg",
        stone: "assets/conflict-maps/paleblood-worms-stone.jpg"
      },
      name: "苍血蠕虫",
      en: "Paleblood Worms",
      kingdom: "both",
      type: "杂兵",
      initialBp: { BP1: 4 },
      pages: [46, 47],
      tiles: ["立柱 ×5", "L 形残墙 ×2", "苍白地穴 ×10", "血泉 ×1"],
      steps: [
        "给全部苍血蠕虫模型套上编号底环。将 1-4 号模型随机放到图示编号位置，并按箭头确定朝向。",
        "随机排序 4 张 BP 1，背面朝上放到杂兵轨 1-4 格。",
        "把鲜血指示物放在怪物面板旁。",
        "继续执行本场特质牌带来的额外冲突设置。"
      ],
      notes: ["本场使用带编号的地形；建议按图在地形上放同号通用指示物，便于识别。"],
      aftermathExtras: [["血液指示物", "弃置所有血液指示物。"]]
    },
    {
      id: "M_FirstmenWarriors",
      map: "assets/conflict-maps/firstmen-warriors.jpg",
      name: "先民战士",
      en: "Firstmen Warriors",
      kingdom: "both",
      type: "杂兵",
      initialBp: { BP1: 6 },
      pages: [48, 49],
      tiles: ["1×2 沼泽 ×8", "2×2 沼泽 ×1", "大红树 ×3", "2×2 瓦砾 ×2", "L 形瓦砾 ×1"],
      steps: [
        "给全部先民战士模型套上编号底环。将 1-6 号模型随机放到图示编号位置，并按箭头确定朝向。",
        "随机排序 6 张 BP 1，背面朝上放到杂兵轨 1-6 格。",
        "继续执行本场特质牌带来的额外冲突设置。",
        "将本场未使用的所有 Battle Tactics 牌放到一旁。"
      ],
      notes: ["本场使用带编号的地形；建议按图放置同号通用指示物作为提醒。"]
    },
    {
      id: "M_HauntOf",
      map: "assets/conflict-maps/haunts-utrebant.jpg",
      name: "乌特雷班特鬼影",
      en: "Haunts of Utrebant",
      kingdom: "both",
      type: "杂兵",
      initialBp: { BP1: 3 },
      pages: [50, 51],
      tiles: ["1×2 沼泽 ×8", "2×2 沼泽 ×4", "L 形残墙 ×2", "1×4 残墙 ×1"],
      steps: [
        "给全部乌特雷班特鬼影模型套上编号底环。将 1-3 号模型随机放到图示编号位置，并按箭头确定朝向。",
        "随机排序 3 张 BP 1，背面朝上放到杂兵轨 1-3 格。",
        "把愚者牌组放在怪物面板旁。",
        "继续执行本场特质牌带来的额外冲突设置。"
      ]
    },
    {
      id: "M_WhiteApe",
      map: "assets/conflict-maps/white-ape-troll.jpg",
      name: "巨白猿魔",
      en: "White Ape Troll",
      kingdom: "both",
      type: "首领",
      pages: [52, 53],
      tiles: ["1×2 沼泽 ×8", "2×2 沼泽 ×1", "大红树 ×3"],
      steps: [
        "将巨白猿魔放到图示位置，再把 2 个先民战士放到与它相邻的图示位置；全部按箭头确定朝向。",
        "本场冲突期间，这 2 个先民战士模型视为先民护卫。",
        "将“Thick Skin”BP 放到 BP 牌组顶部。",
        "把“Coordinated Attack”牌放在怪物面板旁，并将“Firstman Guardian”共享 BP 放到先民护卫杂兵轨最左侧。",
        "继续执行本场特质牌带来的额外冲突设置。"
      ]
    },
    {
      id: "M_KingLaidLow",
      map: "assets/conflict-maps/king-laid-low.jpg",
      name: "沉沦之王",
      en: "The King Laid Low",
      kingdom: "both",
      type: "首领",
      pages: [54, 55],
      tiles: ["2×2 车辙 ×4", "L 形残墙 ×2", "1×4 残墙 ×1"],
      steps: [
        "将沉沦之王模型放到图示位置。",
        "查看 Minor Mortis 牌组最底部的牌，按其左下角箭头方向旋转怪物，以确定初始朝向。",
        "冲突开始时：随机一名骑士从状况牌组获得休眠面“Malédiction”牌。",
        "继续执行本场特质牌带来的额外冲突设置。"
      ],
      aftermathExtras: [["其他", "持有“Malédiction”的骑士弃置该牌。"]]
    },
    {
      id: "M_DevilAncientDusk",
      mapsByLevel: {
        "1": "assets/conflict-maps/devil-ancient-dusk-l1.jpg",
        "2+": "assets/conflict-maps/devil-ancient-dusk-l2.jpg"
      },
      name: "远古薄暮恶魔",
      en: "Devil of the Ancient Dusk",
      kingdom: "sunken",
      type: "首领",
      pages: [56, 57],
      tilesByLevel: {
        "1": ["立柱 ×15", "1×2 沼泽 ×10"],
        "2+": ["立柱 ×14", "1×2 沼泽 ×10"]
      },
      steps: [
        "将远古薄暮恶魔模型放到对应等级的图示位置。",
        "查看 Minor Mortis 牌组最底部的牌，按其左下角箭头方向旋转怪物，以确定初始朝向。",
        "把愚者牌组放在怪物面板旁。",
        "继续执行本场特质牌带来的额外冲突设置。"
      ],
      notes: ["第 1 级与第 2 级以上使用不同版图和立柱数量；切换等级后务必核对对应原图。"]
    },
    {
      id: "M_Toadragon",
      map: "assets/conflict-maps/toadragon.jpg",
      name: "大沼泽蟾龙",
      en: "Toadragon of the Great Marsh",
      kingdom: "both",
      type: "首领",
      pages: [58, 59],
      tiles: ["大红树 ×3", "1×2 沼泽 ×7"],
      steps: [
        "将大沼泽蟾龙模型放到图示位置，并按箭头确定朝向。",
        "把 Divine Target 指示物和 6 枚 Toadlet 指示物放在怪物面板旁。",
        "继续执行本场特质牌带来的额外冲突设置。"
      ]
    },
    {
      id: "M_Knighteater",
      map: "assets/conflict-maps/knighteater.jpg",
      name: "食骑者",
      en: "Knighteater",
      kingdom: "both",
      type: "首领",
      pages: [50, 51],
      tiles: ["立柱 ×16"],
      steps: [
        "将食骑者模型放到图示位置。查看 Minor Mortis 牌组最底部的牌：若左下角箭头朝上或朝下，食骑者朝下；若箭头朝左或朝右，食骑者朝左。",
        "按所在王国取用特质牌：石之公国使用“Iron Confines”，沉没王国使用“Adaptable”。",
        "继续执行本场特质牌带来的额外冲突设置。"
      ]
    },
    {
      id: "M_YoungDevour",
      map: "assets/conflict-maps/young-devour-dragon.jpg",
      name: "幼年吞噬巨龙",
      en: "Young Devour Dragon",
      kingdom: "both",
      type: "首领",
      pages: [52, 53],
      tiles: ["塔楼 ×3", "L 形残墙 ×3", "直形残墙 ×2"],
      steps: [
        "将幼年吞噬巨龙模型放到图示位置。查看 Minor Mortis 牌组最底部的牌，并按其左下角箭头旋转模型以确定初始朝向。",
        "把 Divine Target 指示物和愚者牌组放在怪物面板旁。",
        "继续执行本场特质牌带来的额外冲突设置。"
      ]
    },
    {
      id: "M_Panzergeists",
      map: "assets/conflict-maps/panzergeists.jpg",
      name: "装甲幽灵",
      en: "Panzergeists",
      kingdom: "stone",
      type: "杂兵",
      initialBp: { BP1: 5, BP2: 3, BP3: 2 },
      pages: [54, 55],
      tiles: ["立柱 ×8", "L 形瓦砾 ×4", "O 形瓦砾 ×1"],
      steps: [
        "给全部装甲幽灵模型套上编号底环。将 1-10 号模型随机放到图示编号位置，并按箭头确定朝向；部分模型放置在立柱地形上。",
        "随机排序全部 10 张 BP，背面朝上放到杂兵轨 1-10 格。",
        "按图示位置在版图上放置 10 枚盔甲指示物。",
        "继续执行本场特质牌带来的额外冲突设置。"
      ],
      notes: ["本场有模型直接放在地形上，设置时请同时核对编号与高度位置。"]
    },
    {
      id: "M_Stonemason",
      map: "assets/conflict-maps/stonemason-knight.jpg",
      name: "石匠骑士",
      en: "Stonemason Knight",
      kingdom: "stone",
      type: "首领",
      pages: [56, 57],
      tiles: ["立柱 ×11", "O 形瓦砾 ×3"],
      steps: [
        "将石匠骑士模型放到图示位置，并按箭头确定朝向。",
        "继续执行本场特质牌带来的额外冲突设置。"
      ]
    },
    {
      id: "M_FirstmenLictor",
      map: "assets/conflict-maps/firstmen-lictor-hunters.jpg",
      name: "先民执政官猎手",
      en: "Firstmen Lictor Hunters",
      kingdom: "sunken",
      type: "杂兵",
      initialBp: { BP1: 8, BP2: 2 },
      pages: [58, 59],
      tiles: ["1×2 沼泽 ×10", "大红树 ×3"],
      steps: [
        "将 8 张 BP 1 和 2 张 BP 2 随机排序，背面朝上放到杂兵轨 1-10 格。",
        "随机选取编号底环并套到 4 个先民执政官猎手模型上。把这些编号模型放到图示编号位置，其余猎手放到其余图示位置；全部按箭头确定朝向。",
        "继续执行本场特质牌带来的额外冲突设置，并将本场未使用的所有 Battle Tactics 牌放到一旁。"
      ],
      notes: ["本场有模型和指示物放在地形上；带编号的地形建议放置同号通用指示物作为提醒。"]
    },
    {
      id: "M_BogWitch",
      map: "assets/conflict-maps/bog-witch.jpg",
      name: "沼泽女巫",
      en: "Bog Witch",
      kingdom: "sunken",
      type: "首领",
      pages: [60, 61],
      tiles: ["O 形沼泽 ×4", "腐朽树桩 ×2"],
      steps: [
        "将沼泽女巫模型放到图示位置，并按箭头确定朝向。",
        "把 Mud Wisp 指示物放在怪物面板旁。",
        "继续执行本场特质牌带来的额外冲突设置。"
      ]
    },
    {
      id: "M_Ironcast",
      map: "assets/conflict-maps/ironcast-dead.jpg",
      name: "铁铸亡者",
      en: "Ironcast Dead",
      kingdom: "stone",
      type: "杂兵",
      initialBp: { BP1: 4, BP2: 3, BP3: 1 },
      pages: [48, 49],
      tiles: ["立柱 ×8", "2×2 瓦砾 ×1", "L 形瓦砾 ×1"],
      steps: [
        "给全部铁铸亡者模型套上编号底环。将 1-8 号模型随机放到图示编号位置，并按箭头确定朝向。",
        "将 4 张 BP 1、3 张 BP 2 和 1 张 BP 3 随机排序，背面朝上放到杂兵轨 1-8 格。",
        "继续执行本场特质牌带来的额外冲突设置。"
      ]
    },
    {
      id: "M_Eggknight",
      map: "assets/conflict-maps/eggknight.jpg",
      name: "蛋蛋骑士",
      en: "Eggknight",
      kingdom: "stone",
      type: "首领",
      pages: [50, 51],
      tiles: ["立柱 ×8"],
      steps: [
        "将蛋蛋骑士模型放到图示位置。查看 Minor Mortis 牌组最底部的牌，并按其左下角箭头旋转模型以确定初始朝向。",
        "继续执行本场特质牌带来的额外冲突设置。"
      ]
    },
    {
      id: "M_PuppetKing",
      map: "assets/conflict-maps/puppet-king-edelhardt.jpg",
      name: "木偶王埃德尔哈特",
      en: "Puppet King Edelhardt",
      kingdom: "stone",
      type: "首领",
      pages: [52, 53],
      tiles: ["立柱 ×10"],
      steps: [
        "将木偶王埃德尔哈特模型放到图示位置，并按箭头确定朝向。",
        "把“Fallen Knight”BP 牌放在 BP 牌组旁，把“The King Commands: Come to Me”AI 牌放在 AI 牌组旁。",
        "继续执行本场特质牌带来的额外冲突设置。"
      ]
    },
    {
      id: "M_DevilSmeltedFears",
      map: "assets/conflict-maps/devil-smelted-fears.jpg",
      name: "熔怖恶魔",
      en: "Devil of the Smelted Fears",
      kingdom: "stone",
      type: "首领",
      pages: [54, 55],
      tiles: ["立柱 ×10"],
      steps: [
        "将熔怖恶魔模型放到图示位置，并按箭头确定朝向。",
        "把“Smelter Oubliette”特质牌、Panzer Gate 指示物和愚者牌组放在怪物面板旁。",
        "继续执行本场特质牌带来的额外冲突设置。"
      ]
    },
    {
      id: "M_Panzerdragon",
      map: "assets/conflict-maps/panzerdragon-veldr.jpg",
      name: "装甲巨龙维尔德",
      en: "Panzerdragon Veldr",
      kingdom: "stone",
      type: "首领",
      pages: [56, 57],
      tiles: ["立柱 ×10", "Primal Remnant ×1"],
      steps: [
        "将装甲巨龙维尔德模型放到图示位置，并按箭头确定朝向。",
        "把“Field of Parasites”BP 牌和“Primal Remnant”BP 牌放在怪物面板旁。",
        "把 Divine Target 指示物和愚者牌组放在怪物面板旁。",
        "继续执行本场特质牌带来的额外冲突设置。"
      ]
    }
  ]
};

const KF_CONFLICT_FLAVOR_TEXT = {
  M_Ratwolves: {
    quote: "“鼠形怪物无处不在。只要有人烟，它们的巢穴便会蔓延。世上最该畏惧的，是鼠后！要是让她嗅到你的气味，愿乌尔班保佑你！”",
    source: "——博格弗里格村的农夫佩蒂尔",
    paragraphs: [
      "王国中任何人都会告诉你，只要有食物可供搜刮，就会有鼠狼出没。城市、城镇与农庄都会引来这些害兽。它们的名字虽未揭示其起源，却准确概括了它们的本性：凶悍、贪食、成群狩猎。发现一只龇牙的鼠兽，附近必有更多同类正在合围，只等一场能填饱肚子的轻松杀戮。",
      "眼前这头扭曲生物的斑驳皮毛下绷着筋肉。更多鼠狼的尖啸与低吼从侧翼传来，包围圈正在收紧。你只能举起武器迎战。"
    ]
  },
  M_WingedNightmare: {
    quote: "“若你育有七女而无一子，便数一数幼女左手的手指。若为五指，圣父神手仍庇护着你；若为六指，那便是从恩典中减去一数的受诅之兆，灾厄必降于此女。”",
    source: "——《贝雷德韦特圣咏》5:11",
    paragraphs: [
      "带有‘恶魔印记’第六指的女婴虽极罕见，却被视为可怖凶兆。牧师通常会绑住孩子的双腿，将她投入最深的水中。每次有据可查的处置都以溺亡告终，然而传言说孩子会再次浮上水面，长出蝠翼飞向天空，而被绑在一起的双腿则化作蜿蜒蛇尾。",
      "仰望面前的翼生怪物时，你几乎要相信这些故事。梦魇狭窄而空洞的胸腔发出撕裂耳膜的尖啸，随后以骇人速度俯冲而下，利爪张开，直取你的血肉。"
    ]
  },
  M_Pumpkinhead: {
    quote: "“善待土地，勤加耕作，施水滋养，丰收时土地也必回报于人。若掠夺土地、过度索取，饥饿终将千倍归来，张开饥渴之口，露出讥笑之容。”",
    source: "——《拉德贡迪斯福音》中的一节",
    paragraphs: [
      "有人声称南瓜头是巴斯菲尔丰饶男爵领园艺炼金师失控的实验，但关于这种蹒跚多首怪物的传说远早于该男爵领，甚至可能早于先祖时代。",
      "你仍能在躯体上看见原主可怜的脸。橙色肿瘤般的增生物挤压着头骨，将其压入胸腔，只留下一张凝固在痛苦与恐惧中的扭曲面孔。然而原主早已失去控制。新生的‘头颅’以空洞眼窝望向你，嘴巴张得更大，怪物高举武器，沉重地逼近。"
    ]
  },
  M_KnightFen: {
    quote: "“祖父让这片土地依海而立，父辈却在刀剑下交出了部族；祖父曾在你们的海中洗剑，而父辈之罪，将由我们的伤口洗净。”",
    source: "——古老的乌特雷班特行军歌；东风吹过‘高贵亡者沼地’时仍可听见",
    paragraphs: [
      "被称作沼泽骑士的蹒跚生物充满谜团。它们无口可言、无脸可表情，却总带着一种强烈的渴望。它们披戴被乌特雷班特泥沼吞没的阵亡士兵之兵甲，仿佛迫切想成为某种存在。它们是试图忆起前生的亡魂，还是模仿沼泽所吞噬躯体的其他东西？无论答案为何，它们已离开沼泽边界，永无止境地搜寻。",
      "也许它今天终于找到了目标。眼前生物怀着阴森而暴烈的意图逼近，背上长出一条形态近似却并不正确的手臂，挥舞锈蚀长剑。它所有的饥渴与欲望，此刻都集中在夺取你的性命上。"
    ]
  },
  M_PalebloodWorms: {
    quote: "“伤口若任其溃烂，便会发臭生蛆。人类的罪亦是如此；亵渎散发的恶臭，连圣父的耐心也会被冒犯。而在那伤口之中，蛆虫清晰可见。”",
    source: "——异端者克罗斯特的安布罗斯神父讲道录",
    paragraphs: [
      "苍血蠕虫之名足以令医师胆寒。边境诸郡的医生与锯骨师时常被迫截去被这种扭动物啃噬的肢体；其毒液会把鲜红血液变成苍白乳脓，在血肉深处引发腐败。蠕虫日渐扩散，在地下向四方掘进。它们对血液的偏爱暗示其可能来自埃辛，是血之神权国骇人圣礼的副产物，但无人能够确定。",
      "你只知道脚下地面正因十余条臃肿蛇形躯体经过而起伏。它们会从何处破土而出难以预料，而你必须提防那致命毒咬。"
    ]
  },
  M_FirstmenWarriors: {
    quote: "“除了人类自身，再没有比先民更残酷凶暴的动物。真正的问题是：究竟是谁从谁那里学会了愤怒与暴力？猿，还是人？”",
    source: "——阿纳提奥卡大宣讲师提里安",
    paragraphs: [
      "树冠间的叫声、铁甲的碰撞、瘦长身躯掠过枝叶的沙响，是旅人遭先民包围前仅有的警告。凶恶的灵长类动物呼号咆哮，露出适合撕肉的长犬齿，捶打胸膛进行原始示威。",
      "有人认为先民一直盘踞在乌特雷班特边缘，也有人认为深雾降临、王国陷入混乱后它们才开始现身。唯一确定的是，眼前这些战士装备精良、数量众多，而且渴求鲜血。"
    ]
  },
  M_HauntOf: {
    quote: "“多数人会说乌特雷班特奠基于坚石与工业，事实却是它建立在前人尸骨之上。为了这颗闪耀的绿色宝石，一代又一代人杀戮并被杀。夏勒莱昂宣称此地是他的王国？这片土地从表层到最深处，不过是一层又一层墓园。”",
    source: "——阿纳塔利亚冒险者行会的奥伦提乌斯·舍恩",
    paragraphs: [
      "乌特雷班特沼地遍布幽灵、幻影与鬼怪的传说。有人看见先祖女祭司沿着被遗忘的小径游荡，有人看见先民的影子搜寻受害者，也有许多人在幽影脸上认出挚爱。无人知道这些究竟是逝者残响、重现并威胁生者的过去，还是仅仅借用熟悉外形的别种存在。",
      "你来不及寻找答案。闪烁身影乘着不可感知的风飘近，其中一个抬起手，掌中浮现长弯刀。你必须立刻防御。"
    ]
  },
  M_WhiteApe: {
    quote: "“我可以告诉你猿巨人的事。它们是猴人里巨大笨重的怪胎，吞食战猿和指挥战猿一样寻常。可一旦遇上一头会思考、会谋划、会制定策略的猿巨人，那才是真正的麻烦。”",
    source: "——艾森瓦尔德食肉教团梅茨格·霍沃德回忆录",
    paragraphs: [
      "先民有诸多亚种：狡猾而长臂的橙毛种常成为执政官猎手；灰褐毛种更重群体与部族；面部花纹怪异、残忍而诡计多端的则成为卜者。而在它们之中还存在蛮兽：毛色污白，皮肤因累累伤疤而增厚硬化，下颚垂涎，只渴望血肉。",
      "你或许会把眼前巨兽当作供人驱使的愚钝攻城槌，但那双充血眼睛里闪烁着聪明而恶毒的光。厚得几乎只剩疤痕的皮肤和隆起肌肉预示着苦战，周围也已响起先民同伙不断逼近的呼号。"
    ]
  },
  M_KingLaidLow: {
    quote: "“曲背王啊，为何高声哭号？重担如此可怖，面目如此污浊！低头吧，恶徒；低头吧，暴君！繁星天空属于我们，其中没有一颗属于你！”",
    source: "——边境诸郡的古老童谣，常由乌特雷班特流亡者后裔传唱",
    paragraphs: [
      "仍记得夏勒莱昂王统治的人已寥寥无几，乌特雷班特人的出逃也成了遥远记忆，但他的故事仍从孩童口中流传。孩子们常把一个倒霉鬼推倒在泥地里，高唱童谣末两句，却不曾思考前文所说的受诅之王。",
      "如今，一团蹒跚肉丘从泥沼升起，腐烂王座压在背上，蛆白的手紧握偷来的权杖，鹿头骨的角间卡着乌特雷班特王冠。泥浆下传出痛苦哭泣的低鸣，所有可悲哀伤凝成一声。沉沦之王渴望把自己从淤泥中拔出，而你们的尸体或许正是他所需的支点。"
    ]
  },
  M_DevilAncientDusk: {
    quote: "“旅人，你玩过‘面孔游戏’吗？那是关于真相与谎言的游戏。我们二人来玩一局吧，看谁能保住面具，又是谁最深处的真相会被剥开，暴露在所有人眼前……”",
    source: "——十字路口赌徒的挑战",
    paragraphs: [
      "乌特雷班特历史中充满游荡恶魔的故事。它总以面具遮脸，或为黄金、或为阴影、或为血肉。远古薄暮恶魔常现身于求知者面前，殷勤地许诺他们渴望的答案，却索取骇人的代价。当地人总警告旅客提防沼泽中雾气笼罩的十字路口。",
      "如今恶魔栖在先祖方尖碑碎片上，黄金面具闪烁，群蛇如光环般绕着头骨扭动。它伸出六指之手向你招引，要你上前，用交易换取性命。"
    ]
  },
  M_Toadragon: {
    quote: "“愿贪食者承受自身欲望，愿亵渎神圣与古老之物者遭报。它们曾吞噬过去，如今便让它们吞噬自己的未来。愿幼崽成为其食粮、其后裔、其饥渴；愿它们因此灭绝，让贪婪成为毁灭。”",
    source: "——刻在黑色金字神塔上的先祖诅咒",
    paragraphs: [
      "乌特雷班特无尽沼地因雷鸣般的蛙叫而震颤，一道巨大翼影穿过树林。它并非飞翔，而是靠粗壮肌肉发达的腿猛然跃进；圆鼓躯体中，成千上万被吞下的幼崽仍在蠕动。",
      "大沼泽蟾龙是令人作呕的庞然怪物，绿色黏液覆盖的皮肤如污秽玻璃般闪光。细小豆眼在眼窝中转动，牢牢锁住你；随即，一条宽如树干的舌头以惊人速度射来。"
    ]
  },
  M_Knighteater: {
    quote: "“世上有些野兽，其饥饿远超自然。吃得越多，欲望越盛。食肉教团教导我们克制胃口，只取足以壮大自身之物，不可无度吞噬。而这些生物，这些畸变体，就是毫无理智的饥饿化身。”",
    source: "——克罗斯特食肉教团的炉母埃莉诺",
    paragraphs: [
      "笼罩整个王国的绝对寂静，是食骑者临近最可靠的征兆。它们体型庞大、近似人形，行动却异常隐秘；光是它们出现，便足以驱散其他居民。食骑者残暴而贪婪，能轻易咬碎盔甲、甲壳与骨头。银色背甲裂缝间不断淌下猎物鲜血，仿佛那正是维系它们的养分。",
      "你来不及深究。眼前那张毫无表情的死亡面具下看不见神色，却能清楚感到它的憎恨。无论盔甲下面究竟是什么，它都以无法解释的狂怒厌恶你和同伴。怪物发出低沉喉吼，开始冲锋。"
    ]
  },
  M_YoungDevour: {
    quote: "“尼普利亚人过去常说，雷声是巨大吞噬巨龙肚腹的轰鸣。等你亲眼见识一头幼龙能吃掉多少东西，就会明白他们为何这样说。”",
    source: "——边境公国两名农夫之间的闲谈",
    paragraphs: [
      "吞噬巨龙是传说中的庞然巨兽。幸而如今人们遇见的通常只是幼体；在远古时代，它们能长得如山岳般巨大。这些怪物穿云翱翔，如鱼群般在天际游弋。随着成长，它们会降得更低，寻找更大的猎物；最终身体重到无法飞行，只能爬过大地，在身后留下翻裂的深沟。",
      "眼前个体尚未进入最终阶段，仍保持灵活并停留空中。宽阔巨翼在张开时遮蔽天空，双眼牢牢锁住你，巨口露出层层锯齿。它发出如雷霆炸裂的咆哮，声浪震耳欲聋，闪电也在怪物周围劈落。"
    ]
  },
  M_Panzergeists: {
    quote: "“艾森瓦尔德的铁匠把心与灵魂都倾入锻造；每一枚铆钉是一句祈祷，每一层折钢是一段传说。血肉耗尽后，他们的灵魂仍不愿离去，又有什么奇怪？圣父许诺的恩典，反而成了太沉重的负担。”",
    source: "——拾荒者工坊首席修补匠埃丝特的沉思录",
    paragraphs: [
      "石之公国的街道也许已再无生者，却仍有事物徘徊在霜冻钢铁之间：由盔甲、工具与武器松散拼合而成的躯体，被哀号亡魂维系。它们生前的主人早已腐朽，靴子却仍继续行走。",
      "这些幽灵造物喀哒作响地蹒跚逼近，每一步都伴随金属摩擦。疲惫甲片之间渗出幽绿雾气，如饥饿手指般伸向你，渴求一具新的躯壳。"
    ]
  },
  M_Stonemason: {
    quote: "“最高塔中，末日将临；国王之士，踏步而行。石匠之锤，将钟声敲响；凯尔德里格堡垒之下，沉睡之王终将醒来。”",
    source: "——疯先知布拉汉的预言",
    paragraphs: [
      "艾森瓦尔德的建造者几近神话。他们是石之公国高塔、铸造厂与要塞的伟大建筑师和工程师。为纪念其功绩，人们以钢铁铸成巨像，赋予他们某种不朽；许多雕像只举着一只手，掌中握有锤子、凿子或其他工具。",
      "如今，一些庞大雕像开始在艾森瓦尔德街道行走。是圣父赋予了它们生命，还是另有力量？眼前巨像高得超出常理，动作速度也不应属于如此重量。它挥下武器，空气中响起沉闷低吼。那声音没有从任何嘴巴发出，却熟悉得令人不安。"
    ]
  },
  M_FirstmenLictor: {
    quote: "“本森最先失踪。我们以为他只是滑进了沼泽，这种事并不少见。接着西奥博尔德和曼宁也没了，像被灌木丛吞掉一样。一个接一个，整支队伍都消失了！那天只有我走出沼泽。可我并不是逃出来的——那些猿故意放我走。它们要我警告其他人，它们能做什么。”",
    source: "——乌特雷班特龙骑兵团雷亚德·贝利中士",
    paragraphs: [
      "先民是沉没王国森林与沼泽的主人，其中没有谁比执政官猎手更擅长潜行与迅速穿越复杂地形。它们极少被人看清，而关于遭遇它们的故事大多以同样方式结束。",
      "你勉强捕捉到一丝动静，转身时，成百个不断移动的身影像剥去伪装般显露出宽阔的皮革面孔。短粗手指举起吹管，一枚毒镖钉入你刚刚站立之处的树干。没有时间犹豫，只能立刻行动。"
    ]
  },
  M_BogWitch: {
    quote: "“远离甜面包铺成的小径，否则泥母会带走你。不要追随泥沼鬼火，否则老巫婆赫克森费尔会抓住你。听父母的话，否则女巫会把你丢进坩埚！”",
    source: "——乌特雷班特大人用来告诫孩子的迷信话语",
    paragraphs: [
      "沉没王国的人只敢低声提及沼泽女巫，唯恐说出名字便会招来邪眼。据说她们聚集在沼地中，伪装成腐烂老树桩或恶臭苔藓。所经之处，诅咒与毒素都会污染土地。",
      "如今你面对的是一名古老乌特雷班特女巫。她从泥浆中升起，如即将胀裂的臭角蘑菇；枯灰皮肉藏在层层淤泥与黏液下，颈间串着的指骨碰撞作响，低低奏出末日般忧郁的节拍。"
    ]
  },
  M_Ironcast: {
    quote: "“我以生命起誓效忠艾森瓦尔德，为她战斗，为她赴死。我的剑永不钝，我的盾永不屈。我们是艾森卫，是包覆家园、抵御一切威胁的甲胄。”",
    source: "——艾森卫服役誓言",
    paragraphs: [
      "合金起义之前，艾森卫军团如钢墙般守护埃德尔哈特王的领地。如今，他们的尸体却在白雪覆盖的公国荒道上跋涉。这些亡者曾在内战最后岁月守护木偶王的统治，如今又开始行军，却不再遵从将军或暴君的命令。它们排成怪异阵形，循着毫无意义的路线移动，又像受某种数字驱使般反复涌向同一处。",
      "你来不及思考究竟是什么在指引它们。最前方的蹒跚亡者已经冲来，干瘪头骨内裂开一排锯齿，原本的眼窝里只剩黝黑深洞。"
    ]
  },
  M_Eggknight: {
    quote: "“蛋蛋骑士令我困惑。它像人一样行走，行为却不像任何有理智的生物。它凭本能行动，像野兽般极具领地意识；可一旦失去目标，又会变得阴郁而毫无作为。我不知道该把它当动物猎杀，还是当人猎杀。”",
    source: "——边境诸郡寻路者猎人大师鲁弗斯",
    paragraphs: [
      "进入石之公国的定居者常逃回文明世界，至少还活着并能开口的人都会谈到头戴卵形头盔的巨大臃肿骑士。这些庞大近人形生物游荡在受石之诅咒的王国中，任何靠近其路径的人都会遭到凶猛攻击。",
      "有人说，就在怪物冲锋之前，能从装甲壳深处听见一个声音，仿佛在呼唤早已死去的矿工。可眼前蛋蛋骑士已经发动冲锋，它沉重脚步的轰鸣淹没了其他一切声音。"
    ]
  },
  M_PuppetKing: {
    quote: "“疲惫老王，坐在疲惫王座；疲惫古堡，孤独而立。木偶王的守卫随丝线起舞，木偶王枯萎的目光，切莫直视。”",
    source: "——阿尼齐诺最后的言语，石之公国一名愚人",
    paragraphs: [
      "埃德尔哈特王曾以铁腕统治自己的领地，从征服者城堡牢牢掌控石之公国，意志坚定、统治不屈。但合金起义后，他未能适应时代摧毁其人民与王国的方式。有人说是年岁与距离侵蚀了他的心智，也有人认为正是部下的背叛令他彻底崩溃。",
      "如今曾经的巨人缩在征服者王座上，凹陷双眼疯狂游移，佝偻躯体垂在装甲上，如裹着骸骨的薄皮。铠甲手指抓过暴露的肌腱，发出干涩刺耳的笑声。‘狂妄！跪在你们的王前！跪下！’他尖叫着。石头发出断裂声，一个形似骑士的东西从天花板坠下；更多坠落其旁，周围尽是腐败战士。"
    ]
  },
  M_DevilSmeltedFears: {
    quote: "“凭借工艺，艾森瓦尔德人成为战场大师。他们的钢铁坚不可摧，骑士亦然。他们的信条是忠诚、勇气与坚韧熔成的合金。可若把这些从战场上剥去，最后还剩下什么？”",
    source: "——艾森瓦尔德难民中一位长者的沉思",
    paragraphs: [
      "你首先察觉到的是熔怖恶魔身上的气味：甜腻血腥、腐败与高温尸体的臭味。血肉贴上你的舌头，黑烟薄雾灌入肺腑。对于骑士而言，这气味意味着遍地废墟与焦黑死者；对于不曾受训的人，它只意味着一件事：死亡就在附近。",
      "恶魔俯视着你。肌肉虬结的躯体披挂零碎钢铁，以铁链与钩具胡乱固定；一根独角从一颗半腐、剥皮的头骨中弯出，面部只剩裸骨。空气穿过孔洞，发出充满恐惧的凡人叹息。‘给刀刃的新鲜血肉，’恶魔低声道，‘真令人愉悦。’它随即冲来，而你必须把那足以吞没理智的恐惧关在心门之外。"
    ]
  },
  M_Panzerdragon: {
    quote: "“巨龙将冶金的秘密赐予莫德与奥多塞里克。他们为巨龙打造至精甲胄，以千层折钢锻成，坚如龙鳞。自那日起，人与龙以不可断裂的锁链结成一体。”",
    source: "——王室委托撰写的《艾森瓦尔德锻炉编年史》",
    paragraphs: [
      "这个概念本身便足够邪恶：一头巨龙披着艾森瓦尔德锻炉所能打造的最精良盔甲，而那甲胄似乎还在其体内筑巢。最可怕的并非这种不公，而是它竟然合乎某种道理。铁束双翼伸展时，无数甲片彼此滑动；巨爪踏地，能像屠刀切肉般撕开岩石；尾端晨星横扫，为这具杀戮机器补上最后武器。",
      "装甲巨龙张开颚部，露出通往无尽深渊般的漆黑口腔，咆哮震耳欲聋。在那原始低吼背后，你还听见持续不断的摩擦与嗡鸣，如同成千上万只翅膀以协调而明确的目的同时振动。"
    ]
  }
};

const KF_CONFLICT_ORIGINALS = {
  M_Ratwolves: {
    byKingdom: {
      sunken: { src: "assets/conflict-originals/ratwolves-sunken.jpg", label: "沉没王国 ClearScan · PDF 23-24 页" },
      stone: { src: "assets/conflict-originals/ratwolves-stone.jpg", label: "巨石公国 ClearScan · PDF 25-26 页" }
    }
  },
  M_WingedNightmare: {
    byKingdom: {
      sunken: { src: "assets/conflict-originals/winged-nightmare-sunken.jpg", label: "沉没王国 ClearScan · PDF 25-26 页" },
      stone: { src: "assets/conflict-originals/winged-nightmare-stone.jpg", label: "巨石公国 ClearScan · PDF 27-28 页" }
    }
  },
  M_Pumpkinhead: {
    byKingdom: {
      sunken: { src: "assets/conflict-originals/pumpkinheads-sunken.jpg", label: "沉没王国 ClearScan · PDF 27-28 页" },
      stone: { src: "assets/conflict-originals/pumpkinheads-stone.jpg", label: "巨石公国 ClearScan · PDF 29-30 页" }
    }
  },
  M_KnightFen: {
    byKingdom: {
      sunken: { src: "assets/conflict-originals/knight-fen-sunken.jpg", label: "沉没王国 ClearScan · PDF 29-30 页" },
      stone: { src: "assets/conflict-originals/knight-fen-stone.jpg", label: "巨石公国 ClearScan · PDF 31-32 页" }
    }
  },
  M_PalebloodWorms: {
    byKingdom: {
      sunken: { src: "assets/conflict-originals/paleblood-worms-sunken.jpg", label: "沉没王国 ClearScan · PDF 31-32 页" },
      stone: { src: "assets/conflict-originals/paleblood-worms-stone.jpg", label: "巨石公国 ClearScan · PDF 33-34 页" }
    }
  },
  M_FirstmenWarriors: { default: { src: "assets/conflict-originals/firstmen-warriors.jpg", label: "沉没王国 ClearScan · PDF 33-34 页" } },
  M_HauntOf: { default: { src: "assets/conflict-originals/haunts-utrebant.jpg", label: "沉没王国 ClearScan · PDF 35-36 页" } },
  M_WhiteApe: { default: { src: "assets/conflict-originals/white-ape-troll.jpg", label: "沉没王国 ClearScan · PDF 37-38 页" } },
  M_KingLaidLow: { default: { src: "assets/conflict-originals/king-laid-low.jpg", label: "沉没王国 ClearScan · PDF 39-40 页" } },
  M_DevilAncientDusk: { default: { src: "assets/conflict-originals/devil-ancient-dusk.jpg", label: "沉没王国 ClearScan · PDF 41-42 页" } },
  M_Toadragon: { default: { src: "assets/conflict-originals/toadragon.jpg", label: "沉没王国 ClearScan · PDF 43-44 页" } },
  M_Knighteater: { default: { src: "assets/conflict-originals/knighteater.jpg", label: "万千恐惧 ClearScan · PDF 39-40 页" } },
  M_YoungDevour: { default: { src: "assets/conflict-originals/young-devour-dragon.jpg", label: "万千恐惧 ClearScan · PDF 41-42 页" } },
  M_Panzergeists: { default: { src: "assets/conflict-originals/panzergeists.jpg", label: "万千恐惧 ClearScan · PDF 43-44 页" } },
  M_Stonemason: { default: { src: "assets/conflict-originals/stonemason-knight.jpg", label: "万千恐惧 ClearScan · PDF 45-46 页" } },
  M_FirstmenLictor: { default: { src: "assets/conflict-originals/firstmen-lictor-hunters.jpg", label: "万千恐惧 ClearScan · PDF 47-48 页" } },
  M_BogWitch: { default: { src: "assets/conflict-originals/bog-witch.jpg", label: "万千恐惧 ClearScan · PDF 49-50 页" } },
  M_Ironcast: { default: { src: "assets/conflict-originals/ironcast-dead.jpg", label: "巨石公国 ClearScan · PDF 35-36 页" } },
  M_Eggknight: { default: { src: "assets/conflict-originals/eggknight.jpg", label: "巨石公国 ClearScan · PDF 37-38 页" } },
  M_PuppetKing: { default: { src: "assets/conflict-originals/puppet-king-edelhardt.jpg", label: "巨石公国 ClearScan · PDF 39-40 页" } },
  M_DevilSmeltedFears: { default: { src: "assets/conflict-originals/devil-smelted-fears.jpg", label: "巨石公国 ClearScan · PDF 41-42 页" } },
  M_Panzerdragon: { default: { src: "assets/conflict-originals/panzerdragon-veldr.jpg", label: "巨石公国 ClearScan · PDF 43-44 页" } }
};

for (const monster of window.KF_CONFLICT_SETUPS.monsters) {
  monster.flavor = KF_CONFLICT_FLAVOR_TEXT[monster.id] || null;
  monster.original = KF_CONFLICT_ORIGINALS[monster.id] || null;
}
