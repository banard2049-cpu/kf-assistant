(function(root,factory){
  const data=factory();
  if(typeof module==="object"&&module.exports)module.exports=data;
  if(root)root.KF_HARVEST_DATA=data;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  return {
  "schemaVersion": 1,
  "source": {
    "packId": "core.zh-cn",
    "version": "1.06",
    "rulePages": [
      68,
      69
    ],
    "customDeckId": 1067
  },
  "tiers": [
    "mob",
    "vassal",
    "king",
    "devil",
    "dragon"
  ],
  "tierNames": {
    "mob": "杂兵",
    "vassal": "封臣",
    "king": "国王",
    "devil": "恶魔",
    "dragon": "巨龙"
  },
  "categories": {
    "full-clash": {
      "name": "完全冲突战利品",
      "shortName": "完全冲突",
      "gold": [
        3,
        4,
        6,
        8,
        10
      ]
    },
    "exhibition-clash": {
      "name": "初步冲突战利品",
      "shortName": "初步冲突",
      "gold": [
        3,
        4,
        6,
        8,
        10
      ]
    },
    "kingdom-gear": {
      "name": "王国装备战利品",
      "shortName": "王国装备",
      "gold": [
        2,
        3,
        4,
        5,
        6
      ]
    },
    "consumable-gear": {
      "name": "消耗品装备战利品",
      "shortName": "消耗品",
      "gold": [
        1,
        1,
        2,
        3,
        4
      ]
    },
    "upgrade": {
      "name": "改装战利品",
      "shortName": "改装",
      "gold": [
        2,
        3,
        4,
        5,
        6
      ]
    }
  },
  "cards": [
    {
      "id": "core.loot.106700",
      "catalogId": "core.loot.106700",
      "cardId": 106700,
      "guid": "125eda",
      "slot": 0,
      "category": "full-clash",
      "name": "完全冲突战利品 1",
      "nameZhCn": "完全冲突战利品",
      "shortName": "完全冲突",
      "goldByTier": {
        "mob": 3,
        "vassal": 4,
        "king": 6,
        "devil": 8,
        "dragon": 10
      },
      "art": {
        "asset": "/assets/harvest/loot-front.jpg",
        "crop": {
          "column": 0,
          "row": 0,
          "columns": 4,
          "rows": 4
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      },
      "backArt": {
        "asset": "/assets/harvest/loot-back.jpg",
        "crop": {
          "column": 0,
          "row": 0,
          "columns": 1,
          "rows": 1
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      }
    },
    {
      "id": "core.loot.106701",
      "catalogId": "core.loot.106701",
      "cardId": 106701,
      "guid": "da0830",
      "slot": 1,
      "category": "full-clash",
      "name": "完全冲突战利品 2",
      "nameZhCn": "完全冲突战利品",
      "shortName": "完全冲突",
      "goldByTier": {
        "mob": 3,
        "vassal": 4,
        "king": 6,
        "devil": 8,
        "dragon": 10
      },
      "art": {
        "asset": "/assets/harvest/loot-front.jpg",
        "crop": {
          "column": 1,
          "row": 0,
          "columns": 4,
          "rows": 4
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      },
      "backArt": {
        "asset": "/assets/harvest/loot-back.jpg",
        "crop": {
          "column": 0,
          "row": 0,
          "columns": 1,
          "rows": 1
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      }
    },
    {
      "id": "core.loot.106702",
      "catalogId": "core.loot.106702",
      "cardId": 106702,
      "guid": "9223a3",
      "slot": 2,
      "category": "exhibition-clash",
      "name": "初步冲突战利品 3",
      "nameZhCn": "初步冲突战利品",
      "shortName": "初步冲突",
      "goldByTier": {
        "mob": 3,
        "vassal": 4,
        "king": 6,
        "devil": 8,
        "dragon": 10
      },
      "art": {
        "asset": "/assets/harvest/loot-front.jpg",
        "crop": {
          "column": 2,
          "row": 0,
          "columns": 4,
          "rows": 4
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      },
      "backArt": {
        "asset": "/assets/harvest/loot-back.jpg",
        "crop": {
          "column": 0,
          "row": 0,
          "columns": 1,
          "rows": 1
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      }
    },
    {
      "id": "core.loot.106703",
      "catalogId": "core.loot.106703",
      "cardId": 106703,
      "guid": "79f452",
      "slot": 3,
      "category": "exhibition-clash",
      "name": "初步冲突战利品 4",
      "nameZhCn": "初步冲突战利品",
      "shortName": "初步冲突",
      "goldByTier": {
        "mob": 3,
        "vassal": 4,
        "king": 6,
        "devil": 8,
        "dragon": 10
      },
      "art": {
        "asset": "/assets/harvest/loot-front.jpg",
        "crop": {
          "column": 3,
          "row": 0,
          "columns": 4,
          "rows": 4
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      },
      "backArt": {
        "asset": "/assets/harvest/loot-back.jpg",
        "crop": {
          "column": 0,
          "row": 0,
          "columns": 1,
          "rows": 1
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      }
    },
    {
      "id": "core.loot.106704",
      "catalogId": "core.loot.106704",
      "cardId": 106704,
      "guid": "0dc8b7",
      "slot": 4,
      "category": "kingdom-gear",
      "name": "王国装备战利品 5",
      "nameZhCn": "王国装备战利品",
      "shortName": "王国装备",
      "goldByTier": {
        "mob": 2,
        "vassal": 3,
        "king": 4,
        "devil": 5,
        "dragon": 6
      },
      "art": {
        "asset": "/assets/harvest/loot-front.jpg",
        "crop": {
          "column": 0,
          "row": 1,
          "columns": 4,
          "rows": 4
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      },
      "backArt": {
        "asset": "/assets/harvest/loot-back.jpg",
        "crop": {
          "column": 0,
          "row": 0,
          "columns": 1,
          "rows": 1
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      }
    },
    {
      "id": "core.loot.106705",
      "catalogId": "core.loot.106705",
      "cardId": 106705,
      "guid": "616848",
      "slot": 5,
      "category": "kingdom-gear",
      "name": "王国装备战利品 6",
      "nameZhCn": "王国装备战利品",
      "shortName": "王国装备",
      "goldByTier": {
        "mob": 2,
        "vassal": 3,
        "king": 4,
        "devil": 5,
        "dragon": 6
      },
      "art": {
        "asset": "/assets/harvest/loot-front.jpg",
        "crop": {
          "column": 1,
          "row": 1,
          "columns": 4,
          "rows": 4
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      },
      "backArt": {
        "asset": "/assets/harvest/loot-back.jpg",
        "crop": {
          "column": 0,
          "row": 0,
          "columns": 1,
          "rows": 1
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      }
    },
    {
      "id": "core.loot.106706",
      "catalogId": "core.loot.106706",
      "cardId": 106706,
      "guid": "6c7442",
      "slot": 6,
      "category": "kingdom-gear",
      "name": "王国装备战利品 7",
      "nameZhCn": "王国装备战利品",
      "shortName": "王国装备",
      "goldByTier": {
        "mob": 2,
        "vassal": 3,
        "king": 4,
        "devil": 5,
        "dragon": 6
      },
      "art": {
        "asset": "/assets/harvest/loot-front.jpg",
        "crop": {
          "column": 2,
          "row": 1,
          "columns": 4,
          "rows": 4
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      },
      "backArt": {
        "asset": "/assets/harvest/loot-back.jpg",
        "crop": {
          "column": 0,
          "row": 0,
          "columns": 1,
          "rows": 1
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      }
    },
    {
      "id": "core.loot.106707",
      "catalogId": "core.loot.106707",
      "cardId": 106707,
      "guid": "5a020f",
      "slot": 7,
      "category": "kingdom-gear",
      "name": "王国装备战利品 8",
      "nameZhCn": "王国装备战利品",
      "shortName": "王国装备",
      "goldByTier": {
        "mob": 2,
        "vassal": 3,
        "king": 4,
        "devil": 5,
        "dragon": 6
      },
      "art": {
        "asset": "/assets/harvest/loot-front.jpg",
        "crop": {
          "column": 3,
          "row": 1,
          "columns": 4,
          "rows": 4
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      },
      "backArt": {
        "asset": "/assets/harvest/loot-back.jpg",
        "crop": {
          "column": 0,
          "row": 0,
          "columns": 1,
          "rows": 1
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      }
    },
    {
      "id": "core.loot.106708",
      "catalogId": "core.loot.106708",
      "cardId": 106708,
      "guid": "abdd98",
      "slot": 8,
      "category": "consumable-gear",
      "name": "消耗品装备战利品 9",
      "nameZhCn": "消耗品装备战利品",
      "shortName": "消耗品",
      "goldByTier": {
        "mob": 1,
        "vassal": 1,
        "king": 2,
        "devil": 3,
        "dragon": 4
      },
      "art": {
        "asset": "/assets/harvest/loot-front.jpg",
        "crop": {
          "column": 0,
          "row": 2,
          "columns": 4,
          "rows": 4
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      },
      "backArt": {
        "asset": "/assets/harvest/loot-back.jpg",
        "crop": {
          "column": 0,
          "row": 0,
          "columns": 1,
          "rows": 1
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      }
    },
    {
      "id": "core.loot.106709",
      "catalogId": "core.loot.106709",
      "cardId": 106709,
      "guid": "ef2bc7",
      "slot": 9,
      "category": "consumable-gear",
      "name": "消耗品装备战利品 10",
      "nameZhCn": "消耗品装备战利品",
      "shortName": "消耗品",
      "goldByTier": {
        "mob": 1,
        "vassal": 1,
        "king": 2,
        "devil": 3,
        "dragon": 4
      },
      "art": {
        "asset": "/assets/harvest/loot-front.jpg",
        "crop": {
          "column": 1,
          "row": 2,
          "columns": 4,
          "rows": 4
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      },
      "backArt": {
        "asset": "/assets/harvest/loot-back.jpg",
        "crop": {
          "column": 0,
          "row": 0,
          "columns": 1,
          "rows": 1
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      }
    },
    {
      "id": "core.loot.106710",
      "catalogId": "core.loot.106710",
      "cardId": 106710,
      "guid": "78ec40",
      "slot": 10,
      "category": "consumable-gear",
      "name": "消耗品装备战利品 11",
      "nameZhCn": "消耗品装备战利品",
      "shortName": "消耗品",
      "goldByTier": {
        "mob": 1,
        "vassal": 1,
        "king": 2,
        "devil": 3,
        "dragon": 4
      },
      "art": {
        "asset": "/assets/harvest/loot-front.jpg",
        "crop": {
          "column": 2,
          "row": 2,
          "columns": 4,
          "rows": 4
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      },
      "backArt": {
        "asset": "/assets/harvest/loot-back.jpg",
        "crop": {
          "column": 0,
          "row": 0,
          "columns": 1,
          "rows": 1
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      }
    },
    {
      "id": "core.loot.106711",
      "catalogId": "core.loot.106711",
      "cardId": 106711,
      "guid": "ce97cc",
      "slot": 11,
      "category": "consumable-gear",
      "name": "消耗品装备战利品 12",
      "nameZhCn": "消耗品装备战利品",
      "shortName": "消耗品",
      "goldByTier": {
        "mob": 1,
        "vassal": 1,
        "king": 2,
        "devil": 3,
        "dragon": 4
      },
      "art": {
        "asset": "/assets/harvest/loot-front.jpg",
        "crop": {
          "column": 3,
          "row": 2,
          "columns": 4,
          "rows": 4
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      },
      "backArt": {
        "asset": "/assets/harvest/loot-back.jpg",
        "crop": {
          "column": 0,
          "row": 0,
          "columns": 1,
          "rows": 1
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      }
    },
    {
      "id": "core.loot.106712",
      "catalogId": "core.loot.106712",
      "cardId": 106712,
      "guid": "5574ad",
      "slot": 12,
      "category": "upgrade",
      "name": "改装战利品 13",
      "nameZhCn": "改装战利品",
      "shortName": "改装",
      "goldByTier": {
        "mob": 2,
        "vassal": 3,
        "king": 4,
        "devil": 5,
        "dragon": 6
      },
      "art": {
        "asset": "/assets/harvest/loot-front.jpg",
        "crop": {
          "column": 0,
          "row": 3,
          "columns": 4,
          "rows": 4
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      },
      "backArt": {
        "asset": "/assets/harvest/loot-back.jpg",
        "crop": {
          "column": 0,
          "row": 0,
          "columns": 1,
          "rows": 1
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      }
    },
    {
      "id": "core.loot.106713",
      "catalogId": "core.loot.106713",
      "cardId": 106713,
      "guid": "f7153e",
      "slot": 13,
      "category": "upgrade",
      "name": "改装战利品 14",
      "nameZhCn": "改装战利品",
      "shortName": "改装",
      "goldByTier": {
        "mob": 2,
        "vassal": 3,
        "king": 4,
        "devil": 5,
        "dragon": 6
      },
      "art": {
        "asset": "/assets/harvest/loot-front.jpg",
        "crop": {
          "column": 1,
          "row": 3,
          "columns": 4,
          "rows": 4
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      },
      "backArt": {
        "asset": "/assets/harvest/loot-back.jpg",
        "crop": {
          "column": 0,
          "row": 0,
          "columns": 1,
          "rows": 1
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      }
    },
    {
      "id": "core.loot.106714",
      "catalogId": "core.loot.106714",
      "cardId": 106714,
      "guid": "fd2512",
      "slot": 14,
      "category": "upgrade",
      "name": "改装战利品 15",
      "nameZhCn": "改装战利品",
      "shortName": "改装",
      "goldByTier": {
        "mob": 2,
        "vassal": 3,
        "king": 4,
        "devil": 5,
        "dragon": 6
      },
      "art": {
        "asset": "/assets/harvest/loot-front.jpg",
        "crop": {
          "column": 2,
          "row": 3,
          "columns": 4,
          "rows": 4
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      },
      "backArt": {
        "asset": "/assets/harvest/loot-back.jpg",
        "crop": {
          "column": 0,
          "row": 0,
          "columns": 1,
          "rows": 1
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      }
    },
    {
      "id": "core.loot.106715",
      "catalogId": "core.loot.106715",
      "cardId": 106715,
      "guid": "ad3e0a",
      "slot": 15,
      "category": "upgrade",
      "name": "改装战利品 16",
      "nameZhCn": "改装战利品",
      "shortName": "改装",
      "goldByTier": {
        "mob": 2,
        "vassal": 3,
        "king": 4,
        "devil": 5,
        "dragon": 6
      },
      "art": {
        "asset": "/assets/harvest/loot-front.jpg",
        "crop": {
          "column": 3,
          "row": 3,
          "columns": 4,
          "rows": 4
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      },
      "backArt": {
        "asset": "/assets/harvest/loot-back.jpg",
        "crop": {
          "column": 0,
          "row": 0,
          "columns": 1,
          "rows": 1
        },
        "aspect": 0.6351351351351351,
        "scale": 1
      }
    }
  ]
};
});
