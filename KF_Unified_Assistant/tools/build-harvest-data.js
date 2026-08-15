"use strict";

const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(projectRoot, "..", "..");
const source = JSON.parse(fs.readFileSync(path.join(workspaceRoot, "content", "core.zh-cn", "loot.json"), "utf8"));
const imageRoot = path.join(workspaceRoot, "refs", "Mods", "Images");
const assetRoot = path.join(projectRoot, "public", "assets", "harvest");
const output = path.join(projectRoot, "public", "data", "harvest-data.js");

const findImage = fragment => {
  const file = fs.readdirSync(imageRoot).find(name => name.includes(fragment));
  if (!file) throw new Error(`Missing loot image containing ${fragment}`);
  return path.join(imageRoot, file);
};

fs.mkdirSync(assetRoot, { recursive: true });
fs.copyFileSync(findImage("B66685DF68A32B2C691C9FAA73AD3E039CFDC"), path.join(assetRoot, "loot-front.jpg"));
fs.copyFileSync(findImage("27ECE53A503397A9DED8B92E1E7A6BF8453A1CB57"), path.join(assetRoot, "loot-back.jpg"));

const categoryMeta = {
  "full-clash": { name: "完全冲突战利品", shortName: "完全冲突", gold: [3, 4, 6, 8, 10] },
  "exhibition-clash": { name: "初步冲突战利品", shortName: "初步冲突", gold: [3, 4, 6, 8, 10] },
  "kingdom-gear": { name: "王国装备战利品", shortName: "王国装备", gold: [2, 3, 4, 5, 6] },
  "consumable-gear": { name: "消耗品装备战利品", shortName: "消耗品", gold: [1, 1, 2, 3, 4] },
  upgrade: { name: "改装战利品", shortName: "改装", gold: [2, 3, 4, 5, 6] },
};
const tiers = ["mob", "vassal", "king", "devil", "dragon"];
const aspect = 470 / 740;
const cards = source.cards.map(card => {
  const meta = categoryMeta[card.category];
  if (!meta) throw new Error(`Unknown loot category ${card.category}`);
  return {
    id: card.id,
    catalogId: card.id,
    cardId: card.cardId,
    guid: card.guid,
    slot: card.slot,
    category: card.category,
    name: `${meta.name} ${card.slot + 1}`,
    nameZhCn: meta.name,
    shortName: meta.shortName,
    goldByTier: Object.fromEntries(tiers.map((tier, index) => [tier, meta.gold[index]])),
    art: {
      asset: "/assets/harvest/loot-front.jpg",
      crop: { column: card.slot % 4, row: Math.floor(card.slot / 4), columns: 4, rows: 4 },
      aspect,
      scale: 1,
    },
    backArt: {
      asset: "/assets/harvest/loot-back.jpg",
      crop: { column: 0, row: 0, columns: 1, rows: 1 },
      aspect,
      scale: 1,
    },
  };
});

const data = {
  schemaVersion: 1,
  source: {
    packId: source.packId,
    version: source.version,
    rulePages: [68, 69],
    customDeckId: source.tts.customDeckId,
  },
  tiers,
  tierNames: { mob: "杂兵", vassal: "封臣", king: "国王", devil: "恶魔", dragon: "巨龙" },
  categories: categoryMeta,
  cards,
};

const body = `(function(root,factory){\n  const data=factory();\n  if(typeof module==="object"&&module.exports)module.exports=data;\n  if(root)root.KF_HARVEST_DATA=data;\n})(typeof globalThis!=="undefined"?globalThis:this,function(){\n  "use strict";\n  return ${JSON.stringify(data, null, 2)};\n});\n`;
fs.writeFileSync(output, body, "utf8");
console.log(`harvest data: ${cards.length} loot cards generated`);
