(() => {
  "use strict";

  // 统一显示映射：zh 必须与中文卡面标题一致（test-monster-labels.js 会校验）。
  // 改名只需编辑 zh；en、ID、tier 保持原始关联值。
  // 新怪物按相同格式追加；aliases 可填写其他英文拼写。
  const monsters = {
    M_BogWitch: {"en":"Bog Witch","zh":"沼泽地女巫","tier":"vassal"},
    M_DevilAncientDusk: {"en":"Devil of the Ancient Dusk","zh":"远古薄暮恶魔","tier":"devil"},
    M_DevilSmeltedFears: {"en":"Devil of the Smelted Fears","zh":"熔怖恶魔","tier":"devil"},
    M_Eggknight: {"en":"Eggknight","zh":"蛋蛋骑士","tier":"vassal"},
    M_FirstmenLictor: {"en":"Firstmen Lictor Hunters","zh":"先民巡猎手","tier":"mob"},
    M_FirstmenWarriors: {"en":"Firstmen Warriors","zh":"先民战士","tier":"mob"},
    M_HauntOf: {"en":"Haunts of Utrebant","zh":"乌特勒班幽灵","tier":"mob"},
    M_Ironcast: {"en":"Ironcast Dead","zh":"铁铸骷髅","tier":"mob"},
    M_KnightFen: {"en":"Knight of the Fen","zh":"污泥骑士","tier":"vassal"},
    M_Knighteater: {"en":"Knighteater","zh":"食士师","tier":"vassal"},
    M_PalebloodWorms: {"en":"Paleblood Worms","zh":"白血蠕虫","tier":"mob"},
    M_Panzerdragon: {"en":"Panzerdragon Veldr","zh":"装甲巨龙弗尔德","tier":"dragon"},
    M_Panzergeists: {"en":"Panzergeists","zh":"装甲幽鬼","tier":"mob"},
    M_Pumpkinhead: {"en":"Pumpkinhead Monstrosities","zh":"南瓜头精怪","tier":"mob"},
    M_PuppetKing: {"en":"Puppetking Edelhardt","zh":"傀儡王埃德尔哈特","tier":"king","aliases":["Puppet King Edelhardt"]},
    M_Ratwolves: {"en":"Ratwolves","zh":"狼鼠狼","tier":"mob"},
    M_Stonemason: {"en":"Stonemason Knight","zh":"石匠骑士","tier":"vassal"},
    M_KingLaidLow: {"en":"The King Laid Low","zh":"俯伏王","tier":"king"},
    M_Toadragon: {"en":"Toadragon of the Great Marsh","zh":"大沼泽蟾蜍龙","tier":"dragon"},
    M_WhiteApe: {"en":"White Ape Troll","zh":"巨白猿魔","tier":"vassal"},
    M_WingedNightmare: {"en":"Winged Nightmare","zh":"展翅魔","tier":"mob"},
    M_YoungDevour: {"en":"Young Devour Dragon","zh":"幼年贪食巨龙","tier":"dragon"},
    Special_F4: {"en":"Apex Eggknight","zh":"顶级蛋骑士","tier":"vassal"},
    Special_F3: {"en":"Plagued Pumpkinheads","zh":"染疫南瓜头","tier":"mob"},
    Special_F2: {"en":"Firstmen Oracle","zh":"先民神谕者","tier":"mob"},
    Special_K1: {"en":"Bounty Hunters","zh":"赏金猎人","tier":"mob"},
    Special_K4: {"en":"Grove Knight","zh":"林地骑士","tier":"mob"},
    Special_P2: {"en":"Questers","zh":"寻道者","tier":"mob"},
    Special_P5: {"en":"Changeling","zh":"变形者","tier":"mob"},
    Special_R5: {"en":"Soul-less Firstmen","zh":"无魂先民","tier":"mob"},
    Special_S4: {"en":"Guardian of the Pool of Tears","zh":"泪池守卫","tier":"mob"},
    Special_U1: {"en":"Ratman Gangster","zh":"鼠人匪徒","tier":"mob"},
  };
  const tiers = { mob: "杂兵", vassal: "封臣", king: "国王", devil: "恶魔", dragon: "巨龙", boss: "首领" };

  const normalize = value => String(value ?? "").trim().toLowerCase();
  function record(value) {
    if (value && typeof value === "object") {
      return monsters[value.id] || record(value.name);
    }
    const key = normalize(value);
    if (!key) return null;
    return monsters[value] || Object.values(monsters).find(item =>
      [item.en, item.zh, ...(item.aliases || [])].some(name => normalize(name) === key)
    ) || null;
  }
  function name(value) {
    return record(value)?.zh || (typeof value === "object" ? value?.nameZh || value?.name || value?.id || "" : String(value ?? ""));
  }
  function tier(value) {
    const key = normalize(value);
    return tiers[key] || String(value ?? "");
  }
  function rank(value) {
    return tier(record(value)?.tier || value?.encounterLevels?.[0]?.tier || value?.type || "");
  }
  function matches(value, query) {
    const item = record(value);
    return [name(value), item?.en, ...(item?.aliases || []), rank(value)]
      .some(label => normalize(label).includes(normalize(query)));
  }
  // For historical log messages and captions containing an English monster name.
  function text(value) {
    const names = Object.values(monsters).flatMap(item => [item.en, ...(item.aliases || [])]);
    const pattern = names.sort((a, b) => b.length - a.length)
      .map(label => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    return String(value ?? "").replace(new RegExp(pattern, "gi"), match => name(match));
  }
  window.KFMonsterLabels = { monsters, tiers, name, tier, rank, matches, text };
})();
