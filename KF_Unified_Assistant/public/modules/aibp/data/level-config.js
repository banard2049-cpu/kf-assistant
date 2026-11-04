// Extracted from the Chinese TTS monster panels and manually verified.
// Boss and mob entries include their full stat row. Mob levels 1-4 were
// transcribed from each monster's localized sheet.face/sheet.back images.
// exhibitionWounds is the cracked-stone value in the black stat row.
// promotion is the upward burst icon in the blue bonus row.
// An absent promotion icon means 0; Winged Nightmare's printed dash is 0 SW.
window.KF_LEVEL_CONFIG = {
  "M_Ratwolves": [
    { level: 1, hit: "6+", wounds: 4, exhibitionWounds: 1, promotion: 0, activations: ["2 AI"], bonuses: {"at": 0, "evasionDice": 0, "vigorLoss": 0, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 2, hit: "6+", wounds: 5, exhibitionWounds: 2, promotion: 0, activations: ["2 AI"], bonuses: {"at": 1, "evasionDice": 0, "vigorLoss": 1, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 3, hit: "7+", wounds: 5, exhibitionWounds: 2, promotion: 1, activations: ["2 AI"], bonuses: {"at": 2, "evasionDice": 0, "vigorLoss": 2, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 4, hit: "8+", wounds: 5, exhibitionWounds: 2, promotion: 1, activations: ["2 AI"], bonuses: {"at": 3, "evasionDice": 1, "vigorLoss": 2, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} }
  ],
  "M_WingedNightmare": [
    { level: 1, hit: "5+", wounds: 6, exhibitionWounds: 0, promotion: 0, activations: ["1 AI"], bonuses: {"at": 0, "evasionDice": 0, "vigorLoss": 0, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 2, hit: "7+", wounds: 6, exhibitionWounds: 0, promotion: 0, activations: ["1 AI"], bonuses: {"at": 1, "evasionDice": 0, "vigorLoss": 1, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 3, hit: "8+", wounds: 6, exhibitionWounds: 0, promotion: 1, activations: ["1 AI"], bonuses: {"at": 3, "evasionDice": 0, "vigorLoss": 2, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 4, hit: "10+", wounds: 6, exhibitionWounds: 0, promotion: 1, activations: ["1 AI"], bonuses: {"at": 5, "evasionDice": 1, "vigorLoss": 3, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} }
  ],
  "M_Pumpkinhead": [
    { level: 1, hit: "6+", wounds: 5, exhibitionWounds: 1, promotion: 0, activations: ["2 AI"], bonuses: {"at": 0, "evasionDice": 0, "vigorLoss": 0, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 2, hit: "7+", wounds: 6, exhibitionWounds: 2, promotion: 0, activations: ["2 AI"], bonuses: {"at": 3, "evasionDice": 0, "vigorLoss": 1, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 3, hit: "8+", wounds: 6, exhibitionWounds: 2, promotion: 0, activations: ["2 AI"], bonuses: {"at": 5, "evasionDice": 0, "vigorLoss": 3, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 4, hit: "9+", wounds: 6, exhibitionWounds: 2, promotion: 0, activations: ["2 AI"], bonuses: {"at": 6, "evasionDice": 0, "vigorLoss": 5, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} }
  ],
  "M_PalebloodWorms": [
    { level: 1, hit: "6+", wounds: 7, exhibitionWounds: 1, promotion: 0, activations: ["1 AI", "1 Signature"], bonuses: {"at": 0, "evasionDice": 0, "vigorLoss": 0, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 2, hit: "8+", wounds: 8, exhibitionWounds: 2, promotion: 0, activations: ["1 AI", "1 Signature"], bonuses: {"at": 1, "evasionDice": 0, "vigorLoss": 1, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 3, hit: "9+", wounds: 8, exhibitionWounds: 2, promotion: 1, activations: ["1 AI", "1 Signature"], bonuses: {"at": 1, "evasionDice": 0, "vigorLoss": 2, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 4, hit: "10+", wounds: 8, exhibitionWounds: 2, promotion: 1, activations: ["1 AI", "1 Signature"], bonuses: {"at": 3, "evasionDice": 0, "vigorLoss": 3, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} }
  ],
  "M_FirstmenWarriors": [
    { level: 1, hit: "6+", wounds: 7, exhibitionWounds: 1, promotion: 0, activations: ["2 AI"], bonuses: {"at": 0, "evasionDice": 0, "vigorLoss": 0, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 2, hit: "7+", wounds: 8, exhibitionWounds: 2, promotion: 0, activations: ["2 AI"], bonuses: {"at": 2, "evasionDice": 0, "vigorLoss": 1, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 3, hit: "8+", wounds: 8, exhibitionWounds: 2, promotion: 0, activations: ["2 AI"], bonuses: {"at": 3, "evasionDice": 0, "vigorLoss": 2, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 4, hit: "9+", wounds: 9, exhibitionWounds: 2, promotion: 1, activations: ["2 AI"], bonuses: {"at": 6, "evasionDice": 0, "vigorLoss": 3, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} }
  ],
  "M_HauntOf": [
    { level: 1, hit: "6+", wounds: 7, exhibitionWounds: 1, promotion: 0, activations: ["1 AI", "1 Signature"], bonuses: {"at": 0, "evasionDice": 0, "vigorLoss": 0, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 2, hit: "8+", wounds: 8, exhibitionWounds: 2, promotion: 0, activations: ["1 AI", "1 Signature"], bonuses: {"at": 2, "evasionDice": 0, "vigorLoss": 0, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 3, hit: "9+", wounds: 8, exhibitionWounds: 2, promotion: 0, activations: ["2 AI"], bonuses: {"at": 3, "evasionDice": 0, "vigorLoss": 1, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 4, hit: "10+", wounds: 9, exhibitionWounds: 2, promotion: 0, activations: ["2 AI"], bonuses: {"at": 5, "evasionDice": 0, "vigorLoss": 2, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} }
  ],
  "M_Panzergeists": [
    { level: 1, hit: "6+!", wounds: 7, exhibitionWounds: 1, promotion: 0, activations: ["1 AI", "1 Signature"], bonuses: {"at": 0, "evasionDice": 0, "vigorLoss": 0, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 2, hit: "7+!", wounds: 8, exhibitionWounds: 2, promotion: 0, activations: ["1 AI", "1 Signature"], bonuses: {"at": 2, "evasionDice": 0, "vigorLoss": 0, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 3, hit: "9+!", wounds: 8, exhibitionWounds: 2, promotion: 0, activations: ["1 AI", "1 Signature"], bonuses: {"at": 3, "evasionDice": 0, "vigorLoss": 1, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 4, hit: "10+!", wounds: 8, exhibitionWounds: 2, promotion: 1, activations: ["1 AI", "1 Signature"], bonuses: {"at": 4, "evasionDice": 0, "vigorLoss": 3, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} }
  ],
  "M_FirstmenLictor": [
    { level: 1, hit: "6+", wounds: 7, exhibitionWounds: 1, promotion: 0, activations: ["1 AI", "1 Signature"], bonuses: {"at": 0, "evasionDice": 0, "vigorLoss": 0, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 2, hit: "7+", wounds: 8, exhibitionWounds: 2, promotion: 0, activations: ["1 AI", "1 Signature"], bonuses: {"at": 1, "evasionDice": 0, "vigorLoss": 0, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 3, hit: "9+", wounds: 8, exhibitionWounds: 2, promotion: 1, activations: ["1 AI", "1 Signature"], bonuses: {"at": 3, "evasionDice": 0, "vigorLoss": 1, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 4, hit: "10+", wounds: 9, exhibitionWounds: 2, promotion: 2, activations: ["1 AI", "1 Signature"], bonuses: {"at": 5, "evasionDice": 0, "vigorLoss": 3, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} }
  ],
  "M_Ironcast": [
    { level: 1, hit: "5+", wounds: 7, exhibitionWounds: 1, promotion: 0, activations: ["1 AI", "1 Signature"], bonuses: {"at": 0, "evasionDice": 0, "vigorLoss": 0, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 2, hit: "6+", wounds: 8, exhibitionWounds: 2, promotion: 0, activations: ["1 AI", "1 Signature"], bonuses: {"at": 1, "evasionDice": 0, "vigorLoss": 1, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 3, hit: "8+", wounds: 8, exhibitionWounds: 2, promotion: 1, activations: ["1 AI", "1 Signature"], bonuses: {"at": 2, "evasionDice": 0, "vigorLoss": 3, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 4, hit: "9+", wounds: 8, exhibitionWounds: 2, promotion: 1, activations: ["1 AI", "1 Signature"], bonuses: {"at": 3, "evasionDice": 0, "vigorLoss": 6, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} }
  ],
  "M_BogWitch": [
    { level: 1, hit: "5+", wounds: 8, exhibitionWounds: 2, promotion: 0, activations: ["1 AI"], bonuses: {"at": 0, "evasionDice": 0, "vigorLoss": 0, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 2, hit: "6+", wounds: 10, exhibitionWounds: 4, promotion: 0, activations: ["1 AI"], bonuses: {"at": 1, "evasionDice": 0, "vigorLoss": 0, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 3, hit: "7+", wounds: 10, exhibitionWounds: 4, promotion: 1, activations: ["1 AI"], bonuses: {"at": 3, "evasionDice": 0, "vigorLoss": 1, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 4, hit: "10+", wounds: 10, exhibitionWounds: 4, promotion: 2, activations: ["1 AI"], bonuses: {"at": 5, "evasionDice": 0, "vigorLoss": 2, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} }
  ],
  "M_DevilAncientDusk": [
    { level: 1, hit: "10+", wounds: 10, exhibitionWounds: 3, promotion: 0, activations: ["1 AI", "1 Signature"], bonuses: {"at": 0, "evasionDice": 0, "vigorLoss": 0, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 2, hit: "11+", wounds: 10, exhibitionWounds: 3, promotion: 0, activations: ["1 AI", "1 Signature"], bonuses: {"at": 2, "evasionDice": 0, "vigorLoss": 1, "vigorLossPerHit": false, "intensity": 1, "intensityPerHit": false} },
    { level: 3, hit: "11+", wounds: 10, exhibitionWounds: 3, promotion: 0, activations: ["1 AI", "1 Signature"], bonuses: {"at": 3, "evasionDice": 0, "vigorLoss": 1, "vigorLossPerHit": false, "intensity": 1, "intensityPerHit": false} }
  ],
  "M_DevilSmeltedFears": [
    { level: 1, hit: "9+", wounds: 10, exhibitionWounds: 3, promotion: 0, activations: ["1 AI", "1 Signature"], bonuses: {"at": 0, "evasionDice": 0, "vigorLoss": 0, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 2, hit: "10+", wounds: 10, exhibitionWounds: 3, promotion: 0, activations: ["1 AI", "1 Signature"], bonuses: {"at": 1, "evasionDice": 0, "vigorLoss": 1, "vigorLossPerHit": false, "intensity": 1, "intensityPerHit": false} },
    { level: 3, hit: "11+", wounds: 10, exhibitionWounds: 3, promotion: 0, activations: ["1 AI", "1 Signature"], bonuses: {"at": 1, "evasionDice": 1, "vigorLoss": 1, "vigorLossPerHit": false, "intensity": 1, "intensityPerHit": false} }
  ],
  "M_Eggknight": [
    { level: 1, hit: "6+", wounds: 8, exhibitionWounds: 2, promotion: 0, activations: ["1 AI"], bonuses: {"at": 0, "evasionDice": 0, "vigorLoss": 0, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 2, hit: "7+", wounds: 10, exhibitionWounds: 4, promotion: 0, activations: ["1 AI"], bonuses: {"at": 2, "evasionDice": 0, "vigorLoss": 0, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 3, hit: "9+", wounds: 10, exhibitionWounds: 4, promotion: 1, activations: ["1 AI"], bonuses: {"at": 4, "evasionDice": 0, "vigorLoss": 1, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 4, hit: "11+", wounds: 10, exhibitionWounds: 4, promotion: 1, activations: ["1 AI"], bonuses: {"at": 6, "evasionDice": 0, "vigorLoss": 2, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} }
  ],
  "M_KnightFen": [
    { level: 1, hit: "6+", wounds: 8, exhibitionWounds: 2, promotion: 0, activations: ["1 AI"], bonuses: {"at": 0, "evasionDice": 0, "vigorLoss": 0, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 2, hit: "8+", wounds: 10, exhibitionWounds: 4, promotion: 0, activations: ["1 AI"], bonuses: {"at": 2, "evasionDice": 0, "vigorLoss": 1, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 3, hit: "9+", wounds: 10, exhibitionWounds: 4, promotion: 1, activations: ["1 AI"], bonuses: {"at": 3, "evasionDice": 0, "vigorLoss": 2, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 4, hit: "11+", wounds: 10, exhibitionWounds: 4, promotion: 2, activations: ["1 AI"], bonuses: {"at": 4, "evasionDice": 0, "vigorLoss": 4, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} }
  ],
  "M_Knighteater": [
    { level: 1, hit: "5+", wounds: 8, exhibitionWounds: 2, promotion: 0, activations: ["1 AI"], bonuses: {"at": 0, "evasionDice": 0, "vigorLoss": 0, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 2, hit: "6+", wounds: 10, exhibitionWounds: 4, promotion: 1, activations: ["1 AI"], bonuses: {"at": 2, "evasionDice": 0, "vigorLoss": 1, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 3, hit: "7+", wounds: 10, exhibitionWounds: 4, promotion: 1, activations: ["1 AI"], bonuses: {"at": 4, "evasionDice": 0, "vigorLoss": 2, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 4, hit: "8+", wounds: 10, exhibitionWounds: 4, promotion: 2, activations: ["1 AI"], bonuses: {"at": 6, "evasionDice": 0, "vigorLoss": 3, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} }
  ],
  "M_Panzerdragon": [
    { level: 1, hit: "10+", wounds: 10, exhibitionWounds: 4, promotion: 0, activations: ["2 AI"], bonuses: {"at": 0, "evasionDice": 0, "vigorLoss": 0, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 2, hit: "11+", wounds: 11, exhibitionWounds: 4, promotion: 1, activations: ["2 AI"], bonuses: {"at": 0, "evasionDice": 0, "vigorLoss": 0, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} }
  ],
  "M_PuppetKing": [
    { level: 1, hit: "7+", wounds: 10, exhibitionWounds: 3, promotion: 0, activations: ["1 AI", "1 Signature"], bonuses: {"at": 0, "evasionDice": 0, "vigorLoss": 0, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 2, hit: "7+", wounds: 10, exhibitionWounds: 3, promotion: 1, activations: ["1 AI", "1 Signature"], bonuses: {"at": 1, "evasionDice": 0, "vigorLoss": 1, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 3, hit: "8+", wounds: 10, exhibitionWounds: 3, promotion: 1, activations: ["1 AI", "1 Signature"], bonuses: {"at": 2, "evasionDice": 1, "vigorLoss": 1, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 4, hit: "9+", wounds: 10, exhibitionWounds: 3, promotion: 2, activations: ["1 AI", "1 Signature"], bonuses: {"at": 4, "evasionDice": 2, "vigorLoss": 2, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} }
  ],
  "M_Stonemason": [
    { level: 1, hit: "6+", wounds: 8, exhibitionWounds: 2, promotion: 0, activations: ["1 AI"], bonuses: {"at": 0, "evasionDice": 0, "vigorLoss": 0, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 2, hit: "7+", wounds: 10, exhibitionWounds: 4, promotion: 0, activations: ["1 AI"], bonuses: {"at": 1, "evasionDice": 0, "vigorLoss": 2, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 3, hit: "8+", wounds: 10, exhibitionWounds: 4, promotion: 1, activations: ["1 AI"], bonuses: {"at": 2, "evasionDice": 0, "vigorLoss": 3, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 4, hit: "10+", wounds: 10, exhibitionWounds: 4, promotion: 1, activations: ["1 AI"], bonuses: {"at": 3, "evasionDice": 0, "vigorLoss": 6, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} }
  ],
  "M_KingLaidLow": [
    { level: 1, hit: "8+", wounds: 10, exhibitionWounds: 3, promotion: 1, activations: ["1 AI", "1 Signature"], bonuses: {"at": 0, "evasionDice": 0, "vigorLoss": 0, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 2, hit: "9+", wounds: 10, exhibitionWounds: 3, promotion: 1, activations: ["1 AI", "1 Signature"], bonuses: {"at": 1, "evasionDice": 0, "vigorLoss": 1, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 3, hit: "10+", wounds: 10, exhibitionWounds: 3, promotion: 1, activations: ["1 AI", "1 Signature"], bonuses: {"at": 2, "evasionDice": 0, "vigorLoss": 1, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 4, hit: "10+", wounds: 10, exhibitionWounds: 3, promotion: 2, activations: ["1 AI", "1 Signature"], bonuses: {"at": 3, "evasionDice": 1, "vigorLoss": 2, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} }
  ],
  "M_Toadragon": [
    { level: 1, hit: "11+", wounds: 10, exhibitionWounds: 4, promotion: 0, activations: ["1 AI"], bonuses: {"at": 0, "evasionDice": 0, "vigorLoss": 0, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 2, hit: "11+", wounds: 11, exhibitionWounds: 4, promotion: 1, activations: ["1 AI"], bonuses: {"at": 2, "evasionDice": 0, "vigorLoss": 0, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} }
  ],
  "M_WhiteApe": [
    { level: 1, hit: "6+!", wounds: 6, exhibitionWounds: 1, promotion: 0, activations: ["1 AI"], bonuses: {"at": 0, "evasionDice": 0, "vigorLoss": 0, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 2, hit: "7+!", wounds: 8, exhibitionWounds: 3, promotion: 0, activations: ["1 AI"], bonuses: {"at": 2, "evasionDice": 0, "vigorLoss": 1, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 3, hit: "8+!", wounds: 8, exhibitionWounds: 3, promotion: 0, activations: ["1 AI"], bonuses: {"at": 3, "evasionDice": 0, "vigorLoss": 2, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 4, hit: "8+!", wounds: 8, exhibitionWounds: 3, promotion: 1, activations: ["1 AI"], bonuses: {"at": 6, "evasionDice": 0, "vigorLoss": 4, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} }
  ],
  "M_YoungDevour": [
    { level: 1, hit: "8+", wounds: 8, exhibitionWounds: 0, promotion: 0, activations: ["1 AI"], bonuses: {"at": 0, "evasionDice": 0, "vigorLoss": 0, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} },
    { level: 2, hit: "8+", wounds: 10, exhibitionWounds: 0, promotion: 0, activations: ["1 AI"], bonuses: {"at": 1, "evasionDice": 0, "vigorLoss": 0, "vigorLossPerHit": false, "intensity": 0, "intensityPerHit": false} }
  ]
};

// BEGIN GENERATED POSTGAME LEVELS
// Exact appendix rows, not extrapolated. Exhibition wounds are not printed in these tables.
(() => {
  const rows = {
  "M_Pumpkinhead": [
    {
      "level": 5,
      "hit": "9+",
      "wounds": 7,
      "promotion": 0,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 65
      },
      "bonuses": {
        "at": 9,
        "evasionDice": 1,
        "vigorLoss": 4,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 6,
      "hit": "10+",
      "wounds": 8,
      "promotion": 0,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 65
      },
      "bonuses": {
        "at": 9,
        "evasionDice": 1,
        "vigorLoss": 6,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 7,
      "hit": "10+",
      "wounds": 8,
      "promotion": 0,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 65
      },
      "bonuses": {
        "at": 10,
        "evasionDice": 2,
        "vigorLoss": 7,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 8,
      "hit": "11+",
      "wounds": 9,
      "promotion": 0,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 65
      },
      "bonuses": {
        "at": 11,
        "evasionDice": 2,
        "vigorLoss": 9,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 9,
      "hit": "12+",
      "wounds": 9,
      "promotion": 0,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 65
      },
      "bonuses": {
        "at": 12,
        "evasionDice": 3,
        "vigorLoss": 9,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    }
  ],
  "M_WingedNightmare": [
    {
      "level": 5,
      "hit": "10+",
      "wounds": 6,
      "promotion": 2,
      "activations": [
        "1 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 65
      },
      "bonuses": {
        "at": 8,
        "evasionDice": 1,
        "vigorLoss": 4,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 6,
      "hit": "11+",
      "wounds": 6,
      "promotion": 3,
      "activations": [
        "1 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 65
      },
      "bonuses": {
        "at": 9,
        "evasionDice": 1,
        "vigorLoss": 6,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 7,
      "hit": "12+",
      "wounds": 7,
      "promotion": 4,
      "activations": [
        "1 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 65
      },
      "bonuses": {
        "at": 10,
        "evasionDice": 2,
        "vigorLoss": 6,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 8,
      "hit": "13+",
      "wounds": 8,
      "promotion": 5,
      "activations": [
        "1 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 65
      },
      "bonuses": {
        "at": 11,
        "evasionDice": 2,
        "vigorLoss": 6,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 9,
      "hit": "14+",
      "wounds": 9,
      "promotion": 5,
      "activations": [
        "1 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 65
      },
      "bonuses": {
        "at": 12,
        "evasionDice": 3,
        "vigorLoss": 6,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    }
  ],
  "M_FirstmenWarriors": [
    {
      "level": 5,
      "hit": "10+",
      "wounds": 9,
      "promotion": 2,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 66
      },
      "bonuses": {
        "at": 8,
        "evasionDice": 1,
        "vigorLoss": 5,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 6,
      "hit": "10+",
      "wounds": 10,
      "promotion": 2,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 66
      },
      "bonuses": {
        "at": 9,
        "evasionDice": 1,
        "vigorLoss": 7,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 7,
      "hit": "11+",
      "wounds": 11,
      "promotion": 3,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 66
      },
      "bonuses": {
        "at": 10,
        "evasionDice": 2,
        "vigorLoss": 7,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 8,
      "hit": "12+",
      "wounds": 12,
      "promotion": 3,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 66
      },
      "bonuses": {
        "at": 12,
        "evasionDice": 2,
        "vigorLoss": 9,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 9,
      "hit": "12+",
      "wounds": 13,
      "promotion": 3,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 66
      },
      "bonuses": {
        "at": 14,
        "evasionDice": 2,
        "vigorLoss": 10,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    }
  ],
  "M_HauntOf": [
    {
      "level": 5,
      "hit": "10+",
      "wounds": 9,
      "promotion": 0,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 66
      },
      "bonuses": {
        "at": 8,
        "evasionDice": 1,
        "vigorLoss": 5,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 6,
      "hit": "11+",
      "wounds": 9,
      "promotion": 0,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 66
      },
      "bonuses": {
        "at": 9,
        "evasionDice": 1,
        "vigorLoss": 8,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 7,
      "hit": "12+",
      "wounds": 9,
      "promotion": 0,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 66
      },
      "bonuses": {
        "at": 10,
        "evasionDice": 2,
        "vigorLoss": 8,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 8,
      "hit": "13+",
      "wounds": 9,
      "promotion": 0,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 66
      },
      "bonuses": {
        "at": 12,
        "evasionDice": 3,
        "vigorLoss": 8,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 9,
      "hit": "14+",
      "wounds": 9,
      "promotion": 0,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 66
      },
      "bonuses": {
        "at": 14,
        "evasionDice": 3,
        "vigorLoss": 10,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    }
  ],
  "M_WhiteApe": [
    {
      "level": 5,
      "hit": "9+!",
      "wounds": 8,
      "promotion": 2,
      "activations": [
        "1 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 67
      },
      "bonuses": {
        "at": 9,
        "evasionDice": 1,
        "vigorLoss": 5,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 6,
      "hit": "10+!",
      "wounds": 9,
      "promotion": 3,
      "activations": [
        "1 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 67
      },
      "bonuses": {
        "at": 10,
        "evasionDice": 2,
        "vigorLoss": 6,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 7,
      "hit": "11+!",
      "wounds": 10,
      "promotion": 4,
      "activations": [
        "1 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 67
      },
      "bonuses": {
        "at": 11,
        "evasionDice": 2,
        "vigorLoss": 8,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 8,
      "hit": "12+!",
      "wounds": 11,
      "promotion": 5,
      "activations": [
        "1 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 67
      },
      "bonuses": {
        "at": 12,
        "evasionDice": 2,
        "vigorLoss": 10,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 9,
      "hit": "13+!",
      "wounds": 12,
      "promotion": 5,
      "activations": [
        "1 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 67
      },
      "bonuses": {
        "at": 13,
        "evasionDice": 3,
        "vigorLoss": 10,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    }
  ],
  "M_KingLaidLow": [
    {
      "level": 5,
      "hit": "10+",
      "wounds": 10,
      "promotion": 2,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 67
      },
      "bonuses": {
        "at": 5,
        "evasionDice": 1,
        "vigorLoss": 1,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 6,
      "hit": "11+",
      "wounds": 11,
      "promotion": 3,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 67
      },
      "bonuses": {
        "at": 7,
        "evasionDice": 1,
        "vigorLoss": 2,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 7,
      "hit": "12+",
      "wounds": 12,
      "promotion": 4,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 67
      },
      "bonuses": {
        "at": 8,
        "evasionDice": 1,
        "vigorLoss": 4,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 8,
      "hit": "12+",
      "wounds": 13,
      "promotion": 5,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 67
      },
      "bonuses": {
        "at": 8,
        "evasionDice": 2,
        "vigorLoss": 4,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 9,
      "hit": "13+",
      "wounds": 14,
      "promotion": 6,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 67
      },
      "bonuses": {
        "at": 10,
        "evasionDice": 2,
        "vigorLoss": 5,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    }
  ],
  "M_DevilAncientDusk": [
    {
      "level": 4,
      "hit": "13+",
      "wounds": 11,
      "promotion": 1,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 68
      },
      "bonuses": {
        "at": 5,
        "evasionDice": 1,
        "vigorLoss": 1,
        "vigorLossPerHit": true,
        "intensity": 1,
        "intensityPerHit": false
      }
    },
    {
      "level": 5,
      "hit": "13+",
      "wounds": 12,
      "promotion": 2,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 68
      },
      "bonuses": {
        "at": 6,
        "evasionDice": 2,
        "vigorLoss": 1,
        "vigorLossPerHit": false,
        "intensity": 1,
        "intensityPerHit": true
      }
    },
    {
      "level": 6,
      "hit": "14+",
      "wounds": 13,
      "promotion": 3,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 68
      },
      "bonuses": {
        "at": 7,
        "evasionDice": 2,
        "vigorLoss": 2,
        "vigorLossPerHit": false,
        "intensity": 1,
        "intensityPerHit": true
      }
    },
    {
      "level": 7,
      "hit": "15+",
      "wounds": 14,
      "promotion": 4,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 68
      },
      "bonuses": {
        "at": 9,
        "evasionDice": 2,
        "vigorLoss": 2,
        "vigorLossPerHit": false,
        "intensity": 2,
        "intensityPerHit": true
      }
    },
    {
      "level": 8,
      "hit": "15+",
      "wounds": 15,
      "promotion": 5,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 68
      },
      "bonuses": {
        "at": 9,
        "evasionDice": 3,
        "vigorLoss": 2,
        "vigorLossPerHit": false,
        "intensity": 2,
        "intensityPerHit": true
      }
    },
    {
      "level": 9,
      "hit": "16+",
      "wounds": 16,
      "promotion": 5,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 68
      },
      "bonuses": {
        "at": 10,
        "evasionDice": 3,
        "vigorLoss": 3,
        "vigorLossPerHit": false,
        "intensity": 2,
        "intensityPerHit": true
      }
    }
  ],
  "M_Toadragon": [
    {
      "level": 3,
      "hit": "11+",
      "wounds": 12,
      "promotion": 2,
      "activations": [
        "1 AI"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 69
      },
      "bonuses": {
        "at": 3,
        "evasionDice": 0,
        "vigorLoss": 1,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 4,
      "hit": "12+",
      "wounds": 12,
      "promotion": 3,
      "activations": [
        "1 AI"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 69
      },
      "bonuses": {
        "at": 5,
        "evasionDice": 1,
        "vigorLoss": 1,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 5,
      "hit": "12+",
      "wounds": 13,
      "promotion": 4,
      "activations": [
        "1 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 69
      },
      "bonuses": {
        "at": 7,
        "evasionDice": 1,
        "vigorLoss": 3,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 6,
      "hit": "13+",
      "wounds": 13,
      "promotion": 4,
      "activations": [
        "1 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 69
      },
      "bonuses": {
        "at": 7,
        "evasionDice": 2,
        "vigorLoss": 3,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 7,
      "hit": "13+",
      "wounds": 14,
      "promotion": 5,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 69
      },
      "bonuses": {
        "at": 8,
        "evasionDice": 3,
        "vigorLoss": 3,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 8,
      "hit": "14+",
      "wounds": 15,
      "promotion": 5,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 69
      },
      "bonuses": {
        "at": 9,
        "evasionDice": 3,
        "vigorLoss": 4,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 9,
      "hit": "15+",
      "wounds": 16,
      "promotion": 5,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "沉没的王国（69.pdf",
        "page": 69
      },
      "bonuses": {
        "at": 11,
        "evasionDice": 3,
        "vigorLoss": 5,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    }
  ],
  "M_Panzergeists": [
    {
      "level": 5,
      "hit": "10+!",
      "wounds": 8,
      "promotion": 1,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 71
      },
      "bonuses": {
        "at": 7,
        "evasionDice": 0,
        "vigorLoss": 6,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 6,
      "hit": "10+!",
      "wounds": 10,
      "promotion": 1,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 71
      },
      "bonuses": {
        "at": 8,
        "evasionDice": 1,
        "vigorLoss": 6,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 7,
      "hit": "11+!",
      "wounds": 10,
      "promotion": 1,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 71
      },
      "bonuses": {
        "at": 9,
        "evasionDice": 2,
        "vigorLoss": 8,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 8,
      "hit": "11+!",
      "wounds": 10,
      "promotion": 1,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 71
      },
      "bonuses": {
        "at": 10,
        "evasionDice": 3,
        "vigorLoss": 8,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 9,
      "hit": "12+!",
      "wounds": 10,
      "promotion": 1,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 71
      },
      "bonuses": {
        "at": 11,
        "evasionDice": 3,
        "vigorLoss": 8,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    }
  ],
  "M_Stonemason": [
    {
      "level": 5,
      "hit": "11+",
      "wounds": 10,
      "promotion": 1,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 71
      },
      "bonuses": {
        "at": 9,
        "evasionDice": 0,
        "vigorLoss": 5,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 6,
      "hit": "12+",
      "wounds": 11,
      "promotion": 3,
      "activations": [
        "1 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 71
      },
      "bonuses": {
        "at": 9,
        "evasionDice": 1,
        "vigorLoss": 5,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 7,
      "hit": "12+",
      "wounds": 12,
      "promotion": 4,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 71
      },
      "bonuses": {
        "at": 10,
        "evasionDice": 2,
        "vigorLoss": 6,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 8,
      "hit": "12+",
      "wounds": 13,
      "promotion": 5,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 71
      },
      "bonuses": {
        "at": 12,
        "evasionDice": 3,
        "vigorLoss": 6,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 9,
      "hit": "13+",
      "wounds": 14,
      "promotion": 5,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 71
      },
      "bonuses": {
        "at": 13,
        "evasionDice": 3,
        "vigorLoss": 7,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    }
  ],
  "M_Knighteater": [
    {
      "level": 5,
      "hit": "8+",
      "wounds": 10,
      "promotion": 2,
      "activations": [
        "1 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 72
      },
      "bonuses": {
        "at": 8,
        "evasionDice": 1,
        "vigorLoss": 3,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 6,
      "hit": "10+",
      "wounds": 10,
      "promotion": 2,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 72
      },
      "bonuses": {
        "at": 9,
        "evasionDice": 1,
        "vigorLoss": 7,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 7,
      "hit": "10+",
      "wounds": 12,
      "promotion": 4,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 72
      },
      "bonuses": {
        "at": 10,
        "evasionDice": 1,
        "vigorLoss": 7,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 8,
      "hit": "11+",
      "wounds": 13,
      "promotion": 5,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 72
      },
      "bonuses": {
        "at": 11,
        "evasionDice": 2,
        "vigorLoss": 7,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 9,
      "hit": "12+",
      "wounds": 14,
      "promotion": 5,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 72
      },
      "bonuses": {
        "at": 12,
        "evasionDice": 2,
        "vigorLoss": 9,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    }
  ],
  "M_FirstmenLictor": [
    {
      "level": 5,
      "hit": "10+",
      "wounds": 9,
      "promotion": 2,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 72
      },
      "bonuses": {
        "at": 8,
        "evasionDice": 1,
        "vigorLoss": 4,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 6,
      "hit": "10+",
      "wounds": 10,
      "promotion": 2,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 72
      },
      "bonuses": {
        "at": 8,
        "evasionDice": 2,
        "vigorLoss": 4,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 7,
      "hit": "10+",
      "wounds": "!",
      "promotion": 4,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 72
      },
      "bonuses": {
        "at": 10,
        "evasionDice": 1,
        "vigorLoss": 7,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 8,
      "hit": "11+",
      "wounds": "!",
      "promotion": 3,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 72
      },
      "bonuses": {
        "at": 10,
        "evasionDice": 2,
        "vigorLoss": 7,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 9,
      "hit": "12+",
      "wounds": "!",
      "promotion": 3,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 72
      },
      "bonuses": {
        "at": 12,
        "evasionDice": 3,
        "vigorLoss": 7,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    }
  ],
  "M_BogWitch": [
    {
      "level": 5,
      "hit": "10+",
      "wounds": 10,
      "promotion": 2,
      "activations": [
        "1 AI"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 73
      },
      "bonuses": {
        "at": 7,
        "evasionDice": 1,
        "vigorLoss": 3,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 6,
      "hit": "11+",
      "wounds": 11,
      "promotion": 3,
      "activations": [
        "1 AI"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 73
      },
      "bonuses": {
        "at": 8,
        "evasionDice": 1,
        "vigorLoss": 5,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 7,
      "hit": "12+",
      "wounds": 12,
      "promotion": 4,
      "activations": [
        "1 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 73
      },
      "bonuses": {
        "at": 9,
        "evasionDice": 2,
        "vigorLoss": 5,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 8,
      "hit": "12+",
      "wounds": 13,
      "promotion": 5,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 73
      },
      "bonuses": {
        "at": 11,
        "evasionDice": 2,
        "vigorLoss": 7,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 9,
      "hit": "13+",
      "wounds": 13,
      "promotion": 5,
      "activations": [
        "1 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 73
      },
      "bonuses": {
        "at": 12,
        "evasionDice": 2,
        "vigorLoss": 8,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 10,
      "hit": "13+",
      "wounds": 13,
      "promotion": 6,
      "activations": [
        "1 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 73
      },
      "bonuses": {
        "at": 13,
        "evasionDice": 4,
        "vigorLoss": 8,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    }
  ],
  "M_YoungDevour": [
    {
      "level": 3,
      "hit": "10+",
      "wounds": 12,
      "promotion": 0,
      "activations": [
        "1 AI"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 73
      },
      "bonuses": {
        "at": 3,
        "evasionDice": 1,
        "vigorLoss": 0,
        "vigorLossPerHit": false,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 4,
      "hit": "12+",
      "wounds": 12,
      "promotion": 0,
      "activations": [
        "1 AI"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 73
      },
      "bonuses": {
        "at": 5,
        "evasionDice": 1,
        "vigorLoss": 2,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 5,
      "hit": "12+",
      "wounds": 14,
      "promotion": 0,
      "activations": [
        "1 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 73
      },
      "bonuses": {
        "at": 7,
        "evasionDice": 1,
        "vigorLoss": 3,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 6,
      "hit": "12+",
      "wounds": 14,
      "promotion": 0,
      "activations": [
        "1 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 73
      },
      "bonuses": {
        "at": 7,
        "evasionDice": 2,
        "vigorLoss": 4,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 7,
      "hit": "13+",
      "wounds": 14,
      "promotion": 0,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 73
      },
      "bonuses": {
        "at": 8,
        "evasionDice": 3,
        "vigorLoss": 4,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 8,
      "hit": "14+",
      "wounds": 14,
      "promotion": 0,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 74
      },
      "bonuses": {
        "at": 9,
        "evasionDice": 4,
        "vigorLoss": 4,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 9,
      "hit": "15+",
      "wounds": 15,
      "promotion": 0,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "万种多肉恐惧（76.pdf",
        "page": 74
      },
      "bonuses": {
        "at": 10,
        "evasionDice": 4,
        "vigorLoss": 5,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    }
  ],
  "M_Ratwolves": [
    {
      "level": 5,
      "hit": "9+",
      "wounds": 5,
      "promotion": 1,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 65
      },
      "bonuses": {
        "at": 9,
        "evasionDice": 1,
        "vigorLoss": 5,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 6,
      "hit": "10+",
      "wounds": 6,
      "promotion": 1,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 65
      },
      "bonuses": {
        "at": 9,
        "evasionDice": 1,
        "vigorLoss": 7,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 7,
      "hit": "10+",
      "wounds": 6,
      "promotion": 2,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 65
      },
      "bonuses": {
        "at": 11,
        "evasionDice": 1,
        "vigorLoss": 10,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 8,
      "hit": "11+",
      "wounds": 7,
      "promotion": 2,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 65
      },
      "bonuses": {
        "at": 12,
        "evasionDice": 2,
        "vigorLoss": 10,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 9,
      "hit": "12+",
      "wounds": 8,
      "promotion": 2,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 65
      },
      "bonuses": {
        "at": 13,
        "evasionDice": 3,
        "vigorLoss": 10,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    }
  ],
  "M_PalebloodWorms": [
    {
      "level": 5,
      "hit": "10+",
      "wounds": 9,
      "promotion": 2,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 65
      },
      "bonuses": {
        "at": 8,
        "evasionDice": 1,
        "vigorLoss": 6,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 6,
      "hit": "10+",
      "wounds": 10,
      "promotion": 2,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 65
      },
      "bonuses": {
        "at": 9,
        "evasionDice": 1,
        "vigorLoss": 6,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 7,
      "hit": "11+",
      "wounds": 11,
      "promotion": 2,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 65
      },
      "bonuses": {
        "at": 10,
        "evasionDice": 1,
        "vigorLoss": 9,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 8,
      "hit": "11+",
      "wounds": 12,
      "promotion": 3,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 65
      },
      "bonuses": {
        "at": 12,
        "evasionDice": 2,
        "vigorLoss": 9,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 9,
      "hit": "12+",
      "wounds": 13,
      "promotion": 3,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 65
      },
      "bonuses": {
        "at": 14,
        "evasionDice": 2,
        "vigorLoss": 10,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    }
  ],
  "M_KnightFen": [
    {
      "level": 5,
      "hit": "11+",
      "wounds": 10,
      "promotion": 2,
      "activations": [
        "1 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 66
      },
      "bonuses": {
        "at": 7,
        "evasionDice": 0,
        "vigorLoss": 4,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 6,
      "hit": "12+",
      "wounds": 11,
      "promotion": 3,
      "activations": [
        "1 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 66
      },
      "bonuses": {
        "at": 8,
        "evasionDice": 0,
        "vigorLoss": 5,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 7,
      "hit": "12+",
      "wounds": 12,
      "promotion": 4,
      "activations": [
        "1 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 66
      },
      "bonuses": {
        "at": 8,
        "evasionDice": 0,
        "vigorLoss": 8,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 8,
      "hit": "12+",
      "wounds": 13,
      "promotion": 5,
      "activations": [
        "1 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 66
      },
      "bonuses": {
        "at": 9,
        "evasionDice": 1,
        "vigorLoss": 8,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 9,
      "hit": "13+",
      "wounds": 14,
      "promotion": 5,
      "activations": [
        "1 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 66
      },
      "bonuses": {
        "at": 10,
        "evasionDice": 2,
        "vigorLoss": 8,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    }
  ],
  "M_Ironcast": [
    {
      "level": 5,
      "hit": "9+",
      "wounds": 8,
      "promotion": 1,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 66
      },
      "bonuses": {
        "at": 9,
        "evasionDice": 0,
        "vigorLoss": 7,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 6,
      "hit": "10+",
      "wounds": 9,
      "promotion": 2,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 66
      },
      "bonuses": {
        "at": 10,
        "evasionDice": 1,
        "vigorLoss": 7,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 7,
      "hit": "10+",
      "wounds": 10,
      "promotion": 2,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 66
      },
      "bonuses": {
        "at": 11,
        "evasionDice": 2,
        "vigorLoss": 8,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 8,
      "hit": "11+",
      "wounds": 11,
      "promotion": 3,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 66
      },
      "bonuses": {
        "at": 12,
        "evasionDice": 2,
        "vigorLoss": 10,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 9,
      "hit": "12+",
      "wounds": 12,
      "promotion": 3,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 66
      },
      "bonuses": {
        "at": 13,
        "evasionDice": 2,
        "vigorLoss": 12,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    }
  ],
  "M_Eggknight": [
    {
      "level": 5,
      "hit": "11+",
      "wounds": 10,
      "promotion": 2,
      "activations": [
        "1 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 67
      },
      "bonuses": {
        "at": 9,
        "evasionDice": 1,
        "vigorLoss": 5,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 6,
      "hit": "12+",
      "wounds": 11,
      "promotion": 3,
      "activations": [
        "1 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 67
      },
      "bonuses": {
        "at": 9,
        "evasionDice": 2,
        "vigorLoss": 5,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 7,
      "hit": "12+",
      "wounds": 12,
      "promotion": 4,
      "activations": [
        "1 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 67
      },
      "bonuses": {
        "at": 10,
        "evasionDice": 2,
        "vigorLoss": 7,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 8,
      "hit": "12+",
      "wounds": 13,
      "promotion": 5,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 67
      },
      "bonuses": {
        "at": 12,
        "evasionDice": 2,
        "vigorLoss": 9,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 9,
      "hit": "13+",
      "wounds": 14,
      "promotion": 5,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 67
      },
      "bonuses": {
        "at": 13,
        "evasionDice": 3,
        "vigorLoss": 9,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    }
  ],
  "M_PuppetKing": [
    {
      "level": 5,
      "hit": "10+",
      "wounds": 10,
      "promotion": 2,
      "activations": [
        "1 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 67
      },
      "bonuses": {
        "at": 5,
        "evasionDice": 2,
        "vigorLoss": 1,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 6,
      "hit": "11+",
      "wounds": 11,
      "promotion": 3,
      "activations": [
        "1 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 67
      },
      "bonuses": {
        "at": 7,
        "evasionDice": 2,
        "vigorLoss": 2,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 7,
      "hit": "12+",
      "wounds": 12,
      "promotion": 4,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 67
      },
      "bonuses": {
        "at": 8,
        "evasionDice": 3,
        "vigorLoss": 3,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 8,
      "hit": "12+",
      "wounds": 13,
      "promotion": 5,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 67
      },
      "bonuses": {
        "at": 8,
        "evasionDice": 3,
        "vigorLoss": 4,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 9,
      "hit": "13+",
      "wounds": 14,
      "promotion": 5,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 67
      },
      "bonuses": {
        "at": 10,
        "evasionDice": 3,
        "vigorLoss": 5,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    }
  ],
  "M_DevilSmeltedFears": [
    {
      "level": 4,
      "hit": "13+",
      "wounds": 11,
      "promotion": 1,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 68
      },
      "bonuses": {
        "at": 5,
        "evasionDice": 1,
        "vigorLoss": 1,
        "vigorLossPerHit": true,
        "intensity": 1,
        "intensityPerHit": false
      }
    },
    {
      "level": 5,
      "hit": "12+",
      "wounds": 12,
      "promotion": 2,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 68
      },
      "bonuses": {
        "at": 6,
        "evasionDice": 2,
        "vigorLoss": 1,
        "vigorLossPerHit": false,
        "intensity": 1,
        "intensityPerHit": true
      }
    },
    {
      "level": 6,
      "hit": "12+",
      "wounds": 13,
      "promotion": 3,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 68
      },
      "bonuses": {
        "at": 3,
        "evasionDice": 2,
        "vigorLoss": 2,
        "vigorLossPerHit": false,
        "intensity": 1,
        "intensityPerHit": true
      }
    },
    {
      "level": 7,
      "hit": "13+",
      "wounds": 14,
      "promotion": 4,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 68
      },
      "bonuses": {
        "at": 4,
        "evasionDice": 2,
        "vigorLoss": 2,
        "vigorLossPerHit": false,
        "intensity": 2,
        "intensityPerHit": true
      }
    },
    {
      "level": 8,
      "hit": "13+",
      "wounds": 15,
      "promotion": 5,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 68
      },
      "bonuses": {
        "at": 5,
        "evasionDice": 3,
        "vigorLoss": 2,
        "vigorLossPerHit": false,
        "intensity": 2,
        "intensityPerHit": true
      }
    },
    {
      "level": 9,
      "hit": "14+",
      "wounds": 16,
      "promotion": 5,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 68
      },
      "bonuses": {
        "at": 5,
        "evasionDice": 3,
        "vigorLoss": 3,
        "vigorLossPerHit": false,
        "intensity": 2,
        "intensityPerHit": true
      }
    },
    {
      "level": 10,
      "hit": "15+",
      "wounds": 16,
      "promotion": 5,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 68
      },
      "bonuses": {
        "at": 6,
        "evasionDice": 3,
        "vigorLoss": 3,
        "vigorLossPerHit": false,
        "intensity": 3,
        "intensityPerHit": true
      }
    }
  ],
  "M_Panzerdragon": [
    {
      "level": 3,
      "hit": "11+",
      "wounds": 12,
      "promotion": 2,
      "activations": [
        "2 AI"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 69
      },
      "bonuses": {
        "at": 3,
        "evasionDice": 0,
        "vigorLoss": 1,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 4,
      "hit": "12+",
      "wounds": 12,
      "promotion": 3,
      "activations": [
        "2 AI"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 69
      },
      "bonuses": {
        "at": 5,
        "evasionDice": 1,
        "vigorLoss": 1,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 5,
      "hit": "12+",
      "wounds": 13,
      "promotion": 4,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 69
      },
      "bonuses": {
        "at": 7,
        "evasionDice": 1,
        "vigorLoss": 3,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 6,
      "hit": "13+",
      "wounds": 13,
      "promotion": 4,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 69
      },
      "bonuses": {
        "at": 7,
        "evasionDice": 2,
        "vigorLoss": 3,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 7,
      "hit": "13+",
      "wounds": 14,
      "promotion": 5,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 69
      },
      "bonuses": {
        "at": 8,
        "evasionDice": 3,
        "vigorLoss": 3,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 8,
      "hit": "14+",
      "wounds": 15,
      "promotion": 5,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 69
      },
      "bonuses": {
        "at": 9,
        "evasionDice": 3,
        "vigorLoss": 4,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    },
    {
      "level": 9,
      "hit": "15+",
      "wounds": 16,
      "promotion": 5,
      "activations": [
        "2 AI",
        "1 Signature"
      ],
      "exhibitionWoundsUnspecified": true,
      "source": {
        "file": "斯托恩公国（70.pdf",
        "page": 69
      },
      "bonuses": {
        "at": 10,
        "evasionDice": 3,
        "vigorLoss": 5,
        "vigorLossPerHit": true,
        "intensity": 0,
        "intensityPerHit": false
      }
    }
  ]
};
  for (const [id, additions] of Object.entries(rows)) {
    const existing = window.KF_LEVEL_CONFIG[id] || [];
    window.KF_LEVEL_CONFIG[id] = [...existing.filter(row => !additions.some(item => item.level === row.level)), ...additions].sort((a, b) => a.level - b.level);
  }
})();
// END GENERATED POSTGAME LEVELS
