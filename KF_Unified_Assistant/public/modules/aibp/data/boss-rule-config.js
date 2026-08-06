// Boss-only exceptions transcribed from the Chinese monster panels.
// Patient artwork is not present in the source data, so the standard A-F pairs use stable virtual IDs.
window.KF_BOSS_RULE_CONFIG = {
  M_DevilAncientDusk: {
    kind: "ancient-dusk",
    actions: ["set-severity", "ancient-bargain", "resolve-patient", "ancient-round"],
    patientCards: ["A", "B", "C", "D", "E", "F"].flatMap(letter => [1, 2].map(copy => ({
      id: `PATIENT:${letter}:${copy}`, letter
    }))),
    severityBands: [
      { min: 0, max: 2, wound: "light" },
      { min: 3, max: 5, wound: "heavy" },
      { min: 6, max: 8, wound: "fatal" },
      { min: 9, max: 9, wound: "judgment" }
    ]
  },
  M_DevilSmeltedFears: {
    kind: "smelted-fears",
    actions: ["change-armor", "bargain-discard-armor"],
    patientCards: ["A", "B", "C", "D", "E", "F"].flatMap(letter => [1, 2].map(copy => ({
      id: `PATIENT:${letter}:${copy}`, letter
    }))),
    severityBands: [
      { min: 0, max: 2, wound: "light" },
      { min: 3, max: 5, wound: "heavy" },
      { min: 6, max: 8, wound: "fatal" },
      { min: 9, max: 9, wound: "judgment" }
    ]
  },
  M_Eggknight: {
    kind: "eggknight",
    actions: ["discard-armor", "headbutt-armor"],
    armorSlots: [1, 2, 3],
    jackedThresholds: [2, 5, 9]
  },
  M_Knighteater: {
    kind: "knighteater",
    actions: ["change-meat", "wolf-down", "change-armor", "set-berserk"]
  },
  M_Stonemason: {
    kind: "stonemason",
    actions: ["set-direction", "monster-round", "ruin", "buried-alive", "ferrospikes"],
    directions: ["front", "right", "back", "left"]
  },
  M_KingLaidLow: {
    kind: "king-laid-low",
    actions: ["set-curse", "knight-died", "bow", "climb-vp", "hold-vp", "drill"],
    vpWoundThreshold: 6
  },
  M_BogWitch: {
    kind: "bog-witch",
    aiPolicy: { attachable: true, failWhenExhausted: true },
    actions: ["attach-ai", "return-attached-ai", "hidden-bp-top", "cookie-crumbs"],
    labels: { title: "咒术与饼干碎屑" }
  },
  M_KnightFen: {
    kind: "doppelgangers",
    specialZone: "doppelgangers",
    woundStrategy: "resolve-stacked-bp",
    actions: ["spawn-doppelganger", "defeat-doppelganger"],
    bpStrength: {
      "M_KnightFen:BP1:0": 3, "M_KnightFen:BP1:1": 5,
      "M_KnightFen:BP1:2": 4, "M_KnightFen:BP1:3": 3,
      "M_KnightFen:BP1:4": 4, "M_KnightFen:BP1:5": 4,
      "M_KnightFen:BP2:6": 5, "M_KnightFen:BP2:7": 6,
      "M_KnightFen:BP2:8": 6, "M_KnightFen:BP2:9": 5,
      "M_KnightFen:BP2:10": 5, "M_KnightFen:BP2:11": 5,
      "M_KnightFen:BP3:12": 8, "M_KnightFen:BP3:13": 7,
      "M_KnightFen:BP3:14": 8, "M_KnightFen:BP3:15": 9,
      "M_KnightFen:BP3:16": 9, "M_KnightFen:BP3:17": 7
    },
    cards: {
      engulfed: "M_KnightFen:Trait:39",
      quickSummons: "M_KnightFen:Trait_SK:40",
      recycledArmor: "M_KnightFen:Trait_POS:41"
    }
  },
  M_Panzerdragon: {
    kind: "panzer-colony",
    specialZone: "panzer-targets",
    woundStrategy: "no-boss-wound-or-promotion",
    actions: ["attack-field", "attack-dragon", "attack-remnant", "migrate-armor"],
    cards: {
      field: "M_Panzerdragon:Trait:38",
      mortalRetribution: "M_Panzerdragon:Trait:39",
      remnant: "M_Panzerdragon:Trait:40"
    },
    labels: { field: "虫阵", dragon: "巨龙", remnant: "残余" }
  },
  M_PuppetKing: {
    kind: "puppet-king",
    specialZone: "fallen-knight-trait",
    actions: ["damage-fallen-knight", "change-armor"],
    cards: {
      fallenKnight: "M_PuppetKing:Trait:39",
      command: "M_PuppetKing:Trait:40"
    },
    aiPriority: {
      command: [
        "M_PuppetKing:AI1:23", "M_PuppetKing:AI1:24", "M_PuppetKing:AI1:25",
        "M_PuppetKing:AI2:29", "M_PuppetKing:AI2:30", "M_PuppetKing:AI2:31",
        "M_PuppetKing:AI3:34", "M_PuppetKing:AI3:35", "M_PuppetKing:AI3:36", "M_PuppetKing:AI3:37"
      ],
      routineCard: "M_PuppetKing:SIG:38"
    },
    fingers: {
      "M_PuppetKing:BP1:2": { order: 1, name: "无名指", effect: "terrain-1", promote: false },
      "M_PuppetKing:BP1:3": { order: 2, name: "小指", effect: "terrain-2", promote: false },
      "M_PuppetKing:BP2:9": { order: 3, name: "食指", effect: "single", promote: true },
      "M_PuppetKing:BP2:10": { order: 4, name: "中指", effect: "single", promote: true },
      "M_PuppetKing:BP3:14": { order: 5, name: "拇指", effect: "double", promote: true }
    }
  },
  M_Toadragon: {
    kind: "hidden-ai-discard",
    hiddenAiDiscard: true,
    hiddenBpDiscard: true,
    actions: ["discard-top-ai", "favorite-child"]
  },
  M_WhiteApe: {
    kind: "white-ape",
    initialZone: "bp-deck-top",
    woundStrategy: "set-aside-no-wound-or-promotion",
    actions: ["boss-round", "spawn-white-guardian", "pass-guardian-bp", "coordinated-attack"],
    cards: {
      thickSkin: "M_WhiteApe:BPS:0",
      guardian: "M_WhiteApe:Trait:38",
      coordinatedAttack: "M_WhiteApe:Trait:39"
    }
  },
  M_YoungDevour: {
    kind: "devour-stages",
    initialZone: "stage-track",
    noWoundPromotion: true,
    woundStrategy: "wound-without-ai-or-bp-promotion",
    actions: ["advance-stage"],
    stages: [
      { id: "M_YoungDevour:Trait:38", name: "高空飞行", tier: 1 },
      { id: "M_YoungDevour:Trait:39", name: "低空漂浮", tier: 2 },
      { id: "M_YoungDevour:Trait:40", name: "落地", tier: 3, fullOnly: true }
    ]
  }
};
