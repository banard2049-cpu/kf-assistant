// KF 地形卡关键词与占格数据（逐张核对卡面，不从 ATO 移植）。
// 卡面来源：public/assets/conflict/terrain-card-sheet.jpg（10 列 x 2 行，共 15 张，单卡 730x1040）。
// 占格遮罩来源：public/assets/conflict/terrain/*.png 的 alpha 通道统计（单格边长约 395.5px）。
//
// 规则依据（KF 中规 1.06 P83 术语表，原文）：
//   Obscuring 遮蔽：此板块会遮挡视线。
//   Obstacle 障碍：骑士不可经此板块移动。许多类移动技能与障碍地形会有互动。
// 结论：只有「遮蔽」阻挡视线；「障碍」「沟壑」「困难地形」都不阻挡视线，也不影响射程测量。
// 视线引擎构建遮挡集合时必须只读 blocksSight，绝不可把 obstacle 混进去。
//
// 全套 15 张卡中带「遮蔽」的只有 5 张：残垣断壁 / 石柱 / 蠕虫地洞 / 大红树 / 塔。
window.KF_TERRAIN_KEYWORDS = (() => {
  const OBSCURING = "遮蔽";
  const OBSTACLE = "障碍";
  const DESTRUCTIBLE = "可摧毁";
  const INDESTRUCTIBLE = "不可摧毁";
  const DIFFICULT = "困难地形";
  const CHASM = "沟壑";

  // sheet: [行, 列]，对应 terrain-card-sheet.jpg 的槽位。
  const cards = [
    {
      cardId: 23600, sheet: [0, 0], name: "残垣断壁", nameEn: "Ruined Wall",
      keywords: [DESTRUCTIBLE, OBSTACLE, OBSCURING],
      note: "被摧毁后替换为瓦砾堆。",
    },
    {
      cardId: 23601, sheet: [0, 1], name: "瓦砾堆", nameEn: "Rubble",
      keywords: [DIFFICULT],
      note: "主动移动经过时消耗减少 1；怪物位于其上 -1AT；骑士被强制移动至此遭受击倒。",
    },
    {
      cardId: 23602, sheet: [0, 2], name: "石柱", nameEn: "Column",
      keywords: [DESTRUCTIBLE, OBSTACLE, OBSCURING],
      note: "",
    },
    {
      cardId: 23603, sheet: [0, 3], name: "蠕虫地洞", nameEn: "Paleburrow",
      keywords: [CHASM, OBSCURING],
      note: "相邻骑士可弃置 1 个血标记，将 1 只场外苍血蠕虫引至此板块。",
    },
    {
      cardId: 23604, sheet: [0, 4], name: "凹坑", nameEn: "Rut",
      keywords: [INDESTRUCTIBLE],
      note: "覆盖其格子的武器获得沉重；怪物移动至此将其翻面。",
    },
    {
      cardId: 23605, sheet: [0, 5], name: "沼泽", nameEn: "Swamp",
      keywords: [DIFFICULT],
      note: "骑士在其上结束移动即死亡；经过时掷骰 +1 护甲骰；扈从结束或经过均死亡。",
    },
    {
      cardId: 23606, sheet: [0, 6], name: "原始残余", nameEn: "Primal Remnant",
      keywords: [INDESTRUCTIBLE, OBSTACLE],
      note: "始终与巨龙相邻并沿最短路径移动；碾过或结束其上的骑士死亡；护甲标记转入特性卡。不带遮蔽。",
    },
    {
      cardId: 23607, sheet: [0, 7], name: "篝火", nameEn: "Campfire",
      keywords: [INDESTRUCTIBLE],
      note: "相邻骑士可免费行动获取火焰标记；位于或经过时每件金属装备 -1，并弃置所有易燃。",
    },
    {
      cardId: 23608, sheet: [0, 8], name: "大红树", nameEn: "Great Mangrove",
      keywords: [INDESTRUCTIBLE, OBSTACLE, OBSCURING],
      note: "",
    },
    {
      cardId: 23609, sheet: [0, 9], name: "松散琴弦", nameEn: "Loose String",
      keywords: [DESTRUCTIBLE],
      note: "骑士在其上结束移动后被置于 VP 攀爬点，该板块移除。",
    },
    {
      cardId: 23610, sheet: [1, 0], name: "血泉", nameEn: "Bloodgeyser",
      keywords: [],
      note: "卡面没有任何关键词行。苍血蠕虫起始或结束于此在其 BP 放 1 个血标记；骑士起始或结束于此按属性弃置血标记。",
    },
    {
      cardId: 23611, sheet: [1, 1], name: "王座", nameEn: "Throne",
      keywords: [INDESTRUCTIBLE],
      note: "卡面写明「本地形板块被视为盲点」。骑士可免费行动王座跳跃，检定顽强(4+)：成功将板块与模型移至任意无地形空格，失败获得黏糊。",
      treatedAsBlindSpot: true,
    },
    {
      cardId: 23612, sheet: [1, 2], name: "无底之井", nameEn: "Bottomless Well",
      keywords: [INDESTRUCTIBLE, CHASM],
      note: "",
    },
    {
      cardId: 23613, sheet: [1, 3], name: "腐烂树桩", nameEn: "Rotten Stump",
      keywords: [DESTRUCTIBLE, OBSTACLE],
      note: "搜索免费行动掷骰：1-2 获得黏糊，3-10 移动至另一处腐烂树桩；与沼泽女巫有互动。不带遮蔽。",
    },
    {
      cardId: 23614, sheet: [1, 4], name: "塔", nameEn: "Tower",
      keywords: [DESTRUCTIBLE, OBSTACLE, OBSCURING],
      note: "被摧毁后替换为瓦砾堆；其上骑士将被强制移动时遭受冲撞且该移动无视所有障碍地形；坠击。",
    },
  ];

  // 布局里的 asset 名 -> [卡牌 ID, 原生朝向(rotation 0)的占格遮罩]。
  // 遮罩按「行在前、列在后」书写，X 为实际占格。L 形板块只占外接矩形里的 4 格，
  // 视线遮挡必须按遮罩算，不能按外接矩形算。
  const assetTable = {
    Bloodgeyser: [23610, ["XXX", "XXX", "XXX"]],
    Campfire: [23607, ["XX", "XX"]],
    Column: [23602, ["X"]],
    GreatMangrove: [23608, ["XX", "XX"]],
    LooseString: [23609, ["X"]],
    Paleburrow: [23603, ["X"]],
    PrimalRemnant: [23606, ["X"]],
    RottenStump: [23613, ["XX", "XX"]],
    Rubble2: [23601, ["XX", "XX"]],
    Rubble4: [23601, ["XXXX"]],
    RubbleL: [23601, ["X.", "X.", "XX"]],
    RubbleLM: [23601, [".X", ".X", "XX"]],
    RuinedWall4: [23600, ["XXXX"]],
    RuinedWallL: [23600, ["X.", "X.", "XX"]],
    RuinedWallLM: [23600, [".X", ".X", "XX"]],
    Rut: [23604, ["XX"]],
    Rut2: [23604, ["XX", "XX"]],
    Swamp: [23605, ["XX"]],
    Swamp2: [23605, ["XX", "XX"]],
    Tower: [23614, ["XX", "XX"]],
    Well: [23612, ["XX", "XX"]],
  };

  const byCardId = new Map(cards.map(card => [card.cardId, card]));
  const assets = new Map();
  for (const [asset, [cardId, mask]] of Object.entries(assetTable)) {
    const card = byCardId.get(cardId);
    if (!card) throw new Error(`terrain-keywords: 资源 ${asset} 指向不存在的卡牌 ${cardId}`);
    assets.set(asset, {
      asset,
      cardId,
      card,
      mask,
      width: mask[0].length,
      height: mask.length,
      keywords: card.keywords,
      blocksSight: card.keywords.includes(OBSCURING),
      blocksMovement: card.keywords.includes(OBSTACLE),
      difficult: card.keywords.includes(DIFFICULT),
      chasm: card.keywords.includes(CHASM),
      destructible: card.keywords.includes(DESTRUCTIBLE),
      blindSpot: card.treatedAsBlindSpot === true,
    });
  }

  // 布局数据里的 rotation 可能是 null，必须归一化成 0/90/180/270。
  const normalizeRotation = rotation => {
    const raw = Number(rotation);
    if (!Number.isFinite(raw)) return 0;
    const snapped = Math.round(raw / 90) * 90;
    return ((snapped % 360) + 360) % 360;
  };

  // CSS rotate() 正角度为顺时针，遮罩必须同向旋转：new[i][j] = old[h-1-j][i]。
  const rotateMaskOnce = mask => {
    const height = mask.length;
    const width = mask[0].length;
    const out = [];
    for (let i = 0; i < width; i += 1) {
      let row = "";
      for (let j = 0; j < height; j += 1) row += mask[height - 1 - j][i];
      out.push(row);
    }
    return out;
  };

  const flipMask = mask => mask.map(row => [...row].reverse().join(""));

  // 先在图片本地坐标里水平翻转，再整体旋转，与 app.js 的 rotate(...) + scaleX(-1) 叠加顺序一致。
  const orientedMask = (asset, rotation, flipped = false) => {
    const info = assets.get(asset);
    if (!info) return null;
    let mask = flipped ? flipMask(info.mask) : info.mask;
    const turns = normalizeRotation(rotation) / 90;
    for (let step = 0; step < turns; step += 1) mask = rotateMaskOnce(mask);
    return mask;
  };

  // 返回板块真正占用的格子（1 基，row 1 在版图顶部）。
  // 遮罩尺寸与外接矩形不符时退化为填满外接矩形，宁可多挡也不漏挡。
  const occupiedCells = placement => {
    if (!placement) return [];
    const rowStart = Number(placement.rowStart);
    const rowEnd = Number(placement.rowEnd);
    const columnStart = Number(placement.columnStart);
    const columnEnd = Number(placement.columnEnd);
    const rowSpan = rowEnd - rowStart + 1;
    const columnSpan = columnEnd - columnStart + 1;
    const cells = [];
    const mask = orientedMask(placement.asset, placement.rotation, placement.flipped);
    const usable = mask && mask.length === rowSpan && mask[0].length === columnSpan;
    for (let row = 0; row < rowSpan; row += 1) {
      for (let column = 0; column < columnSpan; column += 1) {
        if (usable && mask[row][column] !== "X") continue;
        cells.push({ row: rowStart + row, column: columnStart + column });
      }
    }
    return cells;
  };

  const info = asset => assets.get(asset) || null;
  const hasKeyword = (asset, keyword) => Boolean(assets.get(asset)?.keywords.includes(keyword));

  return {
    KEYWORDS: { OBSCURING, OBSTACLE, DESTRUCTIBLE, INDESTRUCTIBLE, DIFFICULT, CHASM },
    cards,
    cardById: cardId => byCardId.get(Number(cardId)) || null,
    assetNames: () => [...assets.keys()],
    info,
    hasKeyword,
    // 只有「遮蔽」阻挡视线。障碍/沟壑/困难地形都不阻挡。
    isObscuring: asset => Boolean(assets.get(asset)?.blocksSight),
    isObstacle: asset => Boolean(assets.get(asset)?.blocksMovement),
    isChasm: asset => Boolean(assets.get(asset)?.chasm),
    isDifficult: asset => Boolean(assets.get(asset)?.difficult),
    isBlindSpot: asset => Boolean(assets.get(asset)?.blindSpot),
    obscuringAssets: () => [...assets.values()].filter(item => item.blocksSight).map(item => item.asset),
    normalizeRotation,
    orientedMask,
    occupiedCells,
  };
})();

if (typeof module === "object" && module.exports) module.exports = window.KF_TERRAIN_KEYWORDS;
