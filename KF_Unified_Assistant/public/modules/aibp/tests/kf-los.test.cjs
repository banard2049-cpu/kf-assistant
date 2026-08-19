// KF 视线与有效射程测试。逐条覆盖中规 1.06 P50 的视线条款与 P57 的射程条款。
// 运行：node KF_Unified_Assistant/public/modules/aibp/tests/kf-los.test.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({ console, Math, JSON, Number, Set, Map, Array, Object, String, Boolean, Error });
context.window = context;
for (const relative of [
  "data/terrain-keywords.js",
  "../display/data/conflict-board-data.js",
  "kf-los.js",
]) {
  vm.runInContext(fs.readFileSync(path.join(root, relative), "utf8"), context, { filename: relative });
}

const T = context.window.KF_TERRAIN_KEYWORDS;
const LOS = context.window.KF_LOS;
const BOARD = context.window.KF_CONFLICT_BOARD_DATA;

const terrain = (asset, rowStart, rowEnd, columnStart, columnEnd, rotation = 180, extra = {}) =>
  ({ id: `${asset}-${rowStart}-${columnStart}`, kind: "terrain", asset, rowStart, rowEnd, columnStart, columnEnd, rotation, ...extra });
const at = (row, column) => ({ row, column });

// ---- 地形关键词 ---------------------------------------------------------
assert.equal(T.cards.length, 15, "卡表应有 15 张地形卡");
assert.equal(
  [...new Set(T.obscuringAssets().map(asset => T.info(asset).cardId))].sort((a, b) => a - b).join(","),
  "23600,23602,23603,23608,23614",
  "带遮蔽的应且仅应为残垣断壁/石柱/蠕虫地洞/大红树/塔这 5 张卡");
assert.equal(T.isObscuring("PrimalRemnant"), false, "原始残余是障碍但不带遮蔽");
assert.equal(T.isObscuring("RottenStump"), false, "腐烂树桩是障碍但不带遮蔽");
assert.equal(T.info("Bloodgeyser").keywords.length, 0, "血泉卡面没有关键词行");
assert.equal(T.isBlindSpot("Tower"), false, "塔不是盲点");
assert.equal(T.cardById(23611).treatedAsBlindSpot, true, "王座卡面写明被视为盲点");

// L 形板块只占外接矩形里的 4 格。
assert.equal(T.occupiedCells(terrain("RuinedWallL", 4, 6, 5, 6, 0)).length, 4,
  "L 形残垣断壁只占 4 格，不是外接矩形的 6 格");
assert.equal(T.occupiedCells(terrain("RuinedWallL", 4, 6, 5, 6, 0)).map(c => `${c.column},${c.row}`).join(" "),
  "5,4 5,5 5,6 6,6", "L 形原生朝向应占左列三格加右下角一格");
assert.equal(T.normalizeRotation(null), 0, "rotation 为 null 时必须归一化为 0");

// 全部布局的 435 个地形 placement 都能对上遮罩，这是旋转约定正确的证据。
let placements = 0;
for (const layout of BOARD.layouts || []) {
  for (const placement of layout.placements || []) {
    if (placement.kind !== "terrain") continue;
    placements += 1;
    const mask = T.orientedMask(placement.asset, placement.rotation, placement.flipped);
    assert.ok(mask, `布局 ${layout.id} 的 ${placement.asset} 必须在地形表里`);
    assert.equal(mask.length, placement.rowEnd - placement.rowStart + 1,
      `${placement.id} 遮罩行数必须与外接矩形一致`);
    assert.equal(mask[0].length, placement.columnEnd - placement.columnStart + 1,
      `${placement.id} 遮罩列数必须与外接矩形一致`);
    for (const cell of T.occupiedCells(placement)) {
      assert.ok(LOS.inBoard(cell.column, cell.row), `${placement.id} 的占格不得越出版图`);
    }
  }
}
assert.equal(placements, 435, "30 个布局共应有 435 个地形 placement");

// ---- 视线：P50 逐条条款 -------------------------------------------------
// 空版图：全部 140 格都能看到。
{
  const occ = LOS.buildOccluders([]);
  assert.equal(LOS.computeLosMap([at(5, 5)], occ).visible.length, 140,
    "空版图上 14x10=140 格全部可见");
}

// 条款一：连线穿过遮蔽地形板块的格子 -> 不是 LoS。
// 石柱在 (row 5, col 6)，源 (5,4) 看目标 (5,8)：水平连线必然穿过该格所在行。
{
  const occ = LOS.buildOccluders([terrain("Column", 5, 5, 6, 6)]);
  assert.equal(LOS.hasLos([at(5, 4)], at(5, 8), occ), false,
    "连线穿过遮蔽格时不是 LoS");
  // 同一条线换成障碍地形则不受影响。
  const stump = LOS.buildOccluders([terrain("RottenStump", 5, 6, 6, 7)]);
  assert.equal(stump.obscuring.size, 0, "障碍地形不进入遮挡集合");
  assert.equal(LOS.hasLos([at(5, 4)], at(5, 9), stump), true,
    "障碍不会阻挡视线（P84 超级穿身条目原文）");
}

// 条款二：连线与遮蔽地形板块的边缘共线 -> 不是 LoS。
// 源与目标同列、遮蔽正好夹在中间时，走内部的线穿过该格，而唯一的两条替代线
// （x=5 与 x=6）分别贴着该格的左右边缘 —— 共线，也不成立，因此整体没有 LoS。
// 这是共线条款最干净的隔离场景：如果共线被误判为通过，这里就会变成 true。
{
  const occ = LOS.buildOccluders([terrain("Column", 5, 5, 6, 6)]);
  assert.equal(LOS.hasLos([at(4, 6)], at(6, 6), occ), false,
    "贴着遮蔽板块边缘的连线与其共线，不是 LoS");
  // 整行遮蔽墙同样不可跨越。
  const wall = [];
  for (let column = 4; column <= 10; column += 1) wall.push(terrain("Column", 5, 5, column, column));
  const walled = LOS.buildOccluders(wall);
  assert.equal(LOS.hasLos([at(6, 7)], at(4, 7), walled), false,
    "整行遮蔽墙不可跨越");
  // 但墙边的走廊内部是畅通的，不能过度遮挡。
  assert.equal(LOS.hasLos([at(6, 5)], at(6, 9), walled), true,
    "紧贴墙下方的走廊内部仍有 LoS，不得过度遮挡");
  const corridor = [...wall];
  for (let column = 4; column <= 10; column += 1) corridor.push(terrain("Column", 7, 7, column, column));
  assert.equal(LOS.hasLos([at(6, 5)], at(6, 9), LOS.buildOccluders(corridor)), true,
    "上下都是墙的一格宽走廊，其内部连线仍是 LoS");
}

// 条款三：连线仅穿过遮蔽地形板块角点 -> 是 LoS。
// 单个石柱在 (5,6)。源 (4,5) 的右下角 (5,4) 到目标 (6,7) 的左上角 (6,5)，
// 这条线恰好擦过石柱的左上角点 (5,4)..(6,5) 对角，只碰角点不算遮挡。
{
  const occ = LOS.buildOccluders([terrain("Column", 5, 5, 6, 6)]);
  assert.equal(LOS.hasLos([at(4, 5)], at(6, 7), occ), true,
    "仅穿过遮蔽板块角点时仍是 LoS");
}

// 条款四：连线穿过两个要素斜角相连的共同角点 -> 不是 LoS（对角夹角）。
// 两块石柱斜角相邻：(row5,col6) 与 (row6,col7)，共用角点 lattice (6,5)。
// 源与目标要放在这条「闭合」对角的两侧且足够远，否则可以绕过角点，夹角就管不到。
{
  const occ = LOS.buildOccluders([
    terrain("Column", 5, 5, 6, 6),
    terrain("Column", 6, 6, 7, 7),
  ]);
  assert.equal(LOS.hasLos([at(7, 5)], at(4, 8), occ), false,
    "穿过两块遮蔽斜角相连的共同角点时不是 LoS");
  assert.equal(LOS.hasLos([at(8, 4)], at(3, 9), occ), false,
    "更远处跨越同一夹角同样不是 LoS");
  /*
   * 另一条对角上的两格「只在角点相接」，因此也看不到彼此：
   * (row6,col6) 与 (row5,col7) 恰好是共用角点 (6,5) 的另一对角，二者之间的任何
   * 连线都必须从这个已被两块遮蔽封死的点挤过去，符合条款四。
   * 早先我把这里当成「敞开的对角」写成了 true，那是误解 —— 斜角相邻的两块遮蔽
   * 会把该角点完全封死，另一条对角并不因此变得可通。
   */
  assert.equal(LOS.hasLos([at(6, 6)], at(5, 7), occ), false,
    "只在被封死角点相接的两格之间没有 LoS");
  // 非过度遮挡对照：同侧、不需要穿过该角点的连线必须仍然成立。
  assert.equal(LOS.hasLos([at(6, 5)], at(4, 5), occ), true,
    "同在夹角一侧的连线不受影响");
  assert.equal(LOS.hasLos([at(7, 7)], at(9, 9), occ), true,
    "夹角右下方同侧的连线不受影响");
  assert.equal(LOS.hasLos([at(3, 7)], at(2, 9), occ), true,
    "夹角右上方同侧的连线不受影响");
  // 把其中一块换成障碍，夹角就不成立了。
  const mixed = LOS.buildOccluders([
    terrain("Column", 5, 5, 6, 6),
    terrain("PrimalRemnant", 6, 6, 7, 7),
  ]);
  assert.equal(LOS.hasLos([at(7, 5)], at(4, 8), mixed), true,
    "斜角的另一块是障碍而非遮蔽时，不构成夹角遮挡");
}

// 斜角相连的遮蔽连成一串时，整条对角线都不可穿越 —— 夹角条款的累积效果。
{
  const chain = [];
  for (let k = 0; k < 10; k += 1) chain.push(terrain("Column", 1 + k, 1 + k, 3 + k, 3 + k));
  const occ = LOS.buildOccluders(chain);
  assert.equal(occ.obscuring.size, 10, "斜链 row1-10 / col3-12 全在版图内，应落下 10 个遮蔽格");
  assert.equal(LOS.hasLos([at(6, 2)], at(3, 9), occ), false,
    "斜角相连的遮蔽链不可穿越");
  assert.equal(LOS.hasLos([at(8, 3)], at(9, 6), occ), true,
    "同侧目标不受斜链影响");
}

// 条款五：位于遮蔽板块上的单位，指向或来自其的连线不被该板块遮挡（整块豁免）。
{
  // 2x2 大红树在 row 4-5 / col 6-7，单位站在其中一格上。
  const occ = LOS.buildOccluders([terrain("GreatMangrove", 4, 5, 6, 7)]);
  assert.equal(occ.obscuring.size, 4, "2x2 大红树应占 4 个遮蔽格");
  assert.equal(LOS.hasLos([at(4, 6)], at(4, 10), occ), true,
    "站在遮蔽板块上时，该板块的全部格子都不遮挡自己的连线");
  // 豁免只对自己所站的那一块生效，另一块照常遮挡。
  const two = LOS.buildOccluders([
    terrain("GreatMangrove", 4, 5, 6, 7),
    terrain("Column", 4, 4, 10, 10),
  ]);
  assert.equal(LOS.hasLos([at(4, 6)], at(4, 12), two), false,
    "豁免不应扩散到另一块遮蔽板块");
}

/*
 * 规则书 P50 视线示例的回归测试。
 * 图注原文：「视线示例：蛋骑士只能看到屠夫骑士，看不到其他骑士。」
 * 几何按图示量取（版图格线间距 85.3px，已用网格叠加校对）：
 *   蛋骑士 2×2 足迹：column 2-3 / row 4-5
 *   遮蔽地形 L 形 4 格：(row3,col6) (row4,col6) (row5,col6) (row5,col7)
 *     —— 正是 RuinedWallL / RubbleL 那种 2×3 外接矩形只占 4 格的 L 形遮罩。
 *   下方两座立柱：(row7,col7) 与 (row8,col6)，二者斜角相邻。
 *   四名骑士：屠夫(row2,col8)、(row4,col8)、(row5,col10)、(row8,col7)
 * 三条被打叉的连线各自命中不同条款：
 *   通往 (row4,col8) 的线沿 y=3 走，与 (row4,col6) 的上边缘共线 -> 条款二；
 *   通往 (row5,col10) 的线沿 y=5 走，与 (row5,col6/col7) 的下边缘共线 -> 条款二；
 *   通往 (row8,col7) 的斜线终于格点 (6,7)，那正是两座立柱斜角相连的共同角点
 *     -> 条款四（挤角），书上的 ✕ 就画在这个角点上。
 * 这一条同时是挤角公式方向的独立验证：该线 di=3、dj=2（di*dj>0），
 * 必须挑中 (col7,row7) 与 (col6,row8) 这两格才会被判为遮挡；若沿用 y 轴向上
 * 坐标系的旧公式会挑到另一条对角线，本断言就会失败。
 * 图注给出的结论是权威部分，格子坐标是我按 85.3px 格距对图示量取并逐格核对的。
 */
{
  const cells = [[3, 6], [4, 6], [5, 6], [5, 7], [7, 7], [8, 6]];
  const occ = LOS.buildOccluders(cells.map(([row, column], i) => ({
    id: `p50-${i}`, kind: "terrain", asset: "Column",
    rowStart: row, rowEnd: row, columnStart: column, columnEnd: column, rotation: 180,
  })));
  assert.equal(occ.obscuring.size, 6, "P50 示例应有 6 个遮蔽格");
  const eggknight = [at(4, 2), at(4, 3), at(5, 2), at(5, 3)];
  assert.equal(LOS.hasLos(eggknight, at(2, 8), occ), true,
    "P50：蛋骑士能看到屠夫骑士");
  assert.equal(LOS.hasLos(eggknight, at(4, 8), occ), false,
    "P50：与遮蔽格上边缘共线，看不到该骑士");
  assert.equal(LOS.hasLos(eggknight, at(5, 10), occ), false,
    "P50：与遮蔽格下边缘共线，看不到该骑士");
  assert.equal(LOS.hasLos(eggknight, at(8, 7), occ), false,
    "P50：斜线挤过两座立柱斜角相连的共同角点，看不到底部骑士");
  // 反证：拆掉其中一座立柱，挤角条件不再成立，这条线就该通了。
  // 这保证上面那条断言是被挤角条款挡住的，而不是被别的东西顺手挡住的。
  {
    const oneLess = LOS.buildOccluders(cells.filter(([r, c]) => !(r === 8 && c === 6))
      .map(([row, column], i) => ({
        id: `p50b-${i}`, kind: "terrain", asset: "Column",
        rowStart: row, rowEnd: row, columnStart: column, columnEnd: column, rotation: 180,
      })));
    assert.equal(LOS.hasLos(eggknight, at(8, 7), oneLess), true,
      "只剩一座立柱时不构成挤角，底部骑士应可见");
  }
}

// 条款六：盲点与攀爬点永远都不视作在怪物的视线内（目标侧硬否决）。
{
  const occ = LOS.buildOccluders([]);
  const blindspots = new context.Set([LOS.cellKey(8, 5)]);
  assert.equal(LOS.hasLos([at(5, 5)], at(5, 8), occ), true, "无遮挡时本应可见");
  assert.equal(LOS.hasLos([at(5, 5)], at(5, 8), occ, { blindspots }), false,
    "盲点永远不视作在视线内，先于几何判定");
  assert.equal(LOS.computeLosMap([at(5, 5)], occ, { blindspots }).visible.length, 139,
    "盲点应从视线图里剔除");
}

// 被摧毁的遮蔽板块不再遮挡（塔/残垣断壁被摧毁后替换为瓦砾堆）。
{
  const alive = LOS.buildOccluders([terrain("Tower", 5, 6, 6, 7)]);
  const dead = LOS.buildOccluders([terrain("Tower", 5, 6, 6, 7, 180, { destroyed: true })]);
  assert.equal(alive.obscuring.size, 4, "完好的塔占 4 个遮蔽格");
  assert.equal(dead.obscuring.size, 0, "被摧毁的塔不再遮蔽");
}

// L 形遮蔽必须按遮罩遮挡，缺角那一格不遮挡。
{
  // RuinedWallL 原生朝向占 (4,5) (5,5) (6,5) (6,6)，缺 (4,6) 与 (5,6)。
  const occ = LOS.buildOccluders([terrain("RuinedWallL", 4, 6, 5, 6, 0)]);
  assert.equal(occ.obscuring.size, 4, "L 形残垣断壁只有 4 个遮蔽格");
  assert.equal(occ.obscuring.has(LOS.cellKey(6, 4)), false,
    "L 形的缺角格 (row4,col6) 不应是遮蔽格");
}

// PLACEHOLDER_RANGE_TESTS
