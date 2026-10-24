(() => {
  "use strict";

  // 中文卡面已经直接覆盖到 assets/cards/monster-faces/ 下的原路径，
  // monster-data.js 里的裁切参数也按满幅中文卡同步过了，这里只补中文卡名。
  const localizedTraits = {
    "M_Pumpkinhead:Trait_SK:24": "毒素泥地",
    "M_Pumpkinhead:Trait_POS:25": "花蕾怒放",
    "M_Ratwolves:Trait_POS:22": "寄生虫温床",
    "M_Ratwolves:Trait_SK:23": "胆汁毒素",
    "M_KnightFen:Trait_SK:40": "陡然涌现",
    "M_KnightFen:Trait_POS:41": "盔甲回收",
    "M_KnightFen:Trait:39": "包裹",
    "M_PuppetKing:Trait:40": "国王有令：上前",
    "M_PuppetKing:Trait:39": "陨落骑士",
    "M_FirstmenWarriors:Trait:39": "掠食者战术",
    "M_FirstmenWarriors:Trait:38": "集群战术",
    "M_FirstmenWarriors:Trait:37": "牧羊战术",
    "M_FirstmenLictor:Trait:40": "高级震慑战术",
    "M_FirstmenLictor:Trait:41": "高级毒素战术",
    "M_FirstmenLictor:Trait:37": "高级伏击战术",
    "M_FirstmenLictor:Trait:42": "游击队战术",
    "M_FirstmenLictor:Trait:39": "地面支援战术",
    "M_FirstmenLictor:Trait:38": "伏击战术",
    "M_Panzerdragon:Trait:39": "现行现报",
    "M_Panzerdragon:Trait:38": "寄生虫阵",
    "M_Panzerdragon:Trait:40": "原始残余",
    "M_WhiteApe:Trait:38": "先民护卫",
    "M_WhiteApe:Trait:39": "协同攻击",
    "M_Knighteater:Trait_POS:37": "钢铁禁锢",
    "M_Knighteater:Trait_SK:36": "利用环境",
    "M_YoungDevour:Trait:38": "高空飞行",
    "M_YoungDevour:Trait:39": "低空漂浮",
    "M_YoungDevour:Trait:40": "落地"
  };

  const monsters = window.KF_MONSTER_DATA?.monsters || [];
  const pumpkinhead = monsters.find(monster => monster.id === "M_Pumpkinhead");
  if (pumpkinhead) {
    const duplicateTraitIds = new Set([
      "M_Pumpkinhead:Trait_SK:23",
      "M_Pumpkinhead:Trait_POS:22"
    ]);
    pumpkinhead.cards = (pumpkinhead.cards || []).filter(card => !duplicateTraitIds.has(card.id));
    if (pumpkinhead.pools) {
      pumpkinhead.pools.Trait_SK = 1;
      pumpkinhead.pools.Trait_POS = 1;
    }
  }

  // The source mod groups all six advanced Haunts BP cards as BP2 even
  // though the final three card faces are printed BP3.
  const haunts = monsters.find(monster => monster.id === "M_HauntOf");
  if (haunts) {
    const bp3Ids = new Set([
      "M_HauntOf:BP2:6",
      "M_HauntOf:BP2:7",
      "M_HauntOf:BP2:8"
    ]);
    for (const card of haunts.cards || []) {
      if (!bp3Ids.has(card.id)) continue;
      card.kind = "BP3";
      card.name = String(card.name || "").replace(/^BP2/, "BP3");
    }
    if (haunts.pools) {
      haunts.pools.BP2 = 3;
      haunts.pools.BP3 = 3;
    }
  }

  for (const monster of monsters) {
    for (const card of monster.cards || []) {
      const name = localizedTraits[card.id];
      if (name) card.name = name;
    }
  }
})();
