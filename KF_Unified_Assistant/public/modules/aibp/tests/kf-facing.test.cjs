"use strict";
/*
 * kf-facing.js 的规则一致性测试。
 * 核心断言来自规则书 P49-P50「怪物朝向」：
 *   - 前方是越过正面外边缘的整个半平面（长直线横跨版图）
 *   - 后部只是背面紧邻的一排，2×2 足迹恰好 2 格（图示原文）
 */
const assert = require("assert");
const path = require("path");
const FACING = require(path.join(__dirname, "..", "kf-facing.js"));

const monster = (rowStart, rowEnd, columnStart, columnEnd, extra = {}) =>
  Object.assign({ kind: "monster", rowStart, rowEnd, columnStart, columnEnd }, extra);

// --- 朝向数值约定：0=北=row 递减，与 styles.css 的 .facing-0 箭头朝上一致 ---
assert.equal(FACING.VECTORS[0].dRow, -1, "朝向 0 必须指向版图上方（row 递减）");
assert.equal(FACING.VECTORS[180].dRow, 1, "朝向 180 必须指向版图下方");
assert.equal(FACING.VECTORS[90].dColumn, 1, "朝向 90 必须指向右方（column 递增）");
assert.equal(FACING.VECTORS[270].dColumn, -1, "朝向 270 必须指向左方");
assert.equal(FACING.cardinalFacing(null), 0, "空朝向归一为 0");
assert.equal(FACING.cardinalFacing(-90), 270, "负角度归一到 0-359");

// --- 足迹：怪物只会占 1/4/9 格 ---
assert.equal(FACING.footprint(monster(5, 6, 7, 8)).cells.length, 4, "2×2 足迹应为 4 格");
assert.equal(FACING.footprint(monster(5, 5, 7, 7)).cells.length, 1, "1×1 足迹应为 1 格");
assert.equal(FACING.footprint(monster(4, 6, 6, 8)).cells.length, 9, "3×3 足迹应为 9 格");

// --- 后部：2×2 足迹恰好 2 格（P50 图示原文「2 个橙色格子为后部」）---
{
  const box = FACING.footprint(monster(5, 6, 7, 8));
  for (const facing of [0, 90, 180, 270]) {
    assert.equal(FACING.rearCells(box, facing).length, 2,
      `2×2 足迹在朝向 ${facing} 时后部必须是 2 格`);
  }
  // 朝北时背面在下方，后部是 row 7 的两格。
  assert.equal(FACING.rearCells(box, 0).map(c => `${c.column},${c.row}`).join(" "), "7,7 8,7",
    "朝北的后部应为足迹下方紧邻的两格");
  // 朝南时背面在上方。
  assert.equal(FACING.rearCells(box, 180).map(c => `${c.column},${c.row}`).join(" "), "7,4 8,4",
    "朝南的后部应为足迹上方紧邻的两格");
  // 朝东时背面在左侧。
  assert.equal(FACING.rearCells(box, 90).map(c => `${c.column},${c.row}`).join(" "), "6,5 6,6",
    "朝东的后部应为足迹左侧紧邻的两格");
  assert.equal(FACING.rearCells(box, 270).map(c => `${c.column},${c.row}`).join(" "), "9,5 9,6",
    "朝西的后部应为足迹右侧紧邻的两格");
}

// 3×3 足迹后部 3 格；1×1 足迹后部 1 格。
assert.equal(FACING.rearCells(FACING.footprint(monster(4, 6, 6, 8)), 0).length, 3,
  "3×3 足迹后部应为 3 格");
assert.equal(FACING.rearCells(FACING.footprint(monster(5, 5, 7, 7)), 0).length, 1,
  "1×1 足迹后部应为 1 格");

// 后部越出版图边界时应被裁掉，而不是产生非法格。
assert.equal(FACING.rearCells(FACING.footprint(monster(10, 10, 7, 7)), 0).length, 0,
  "足迹贴着最后一行时朝北的后部在版图外，应为空");

// --- 前方是半平面，横跨整块版图 ---
{
  const map = FACING.computeFacingMap(monster(5, 6, 7, 8, { orientation: "N", rotation: 0 }));
  assert.equal(map.facing, 0, "orientation N 应解析为朝向 0");
  // 朝北：正面外边缘是 row 5 的上边，因此 row 1..4 全部是前方 = 4 行 × 14 列。
  assert.equal(map.front.length, 4 * 14, "朝北时前方应为 row 1-4 的全部 56 格");
  // 前方必须横跨整块版图，而不是只有足迹所在的两列。
  assert.equal(map.isFront(1, 4), true, "前方半平面应包含足迹列之外的最左列");
  assert.equal(map.isFront(14, 1), true, "前方半平面应包含版图对角的远端格");
  assert.equal(map.isFront(7, 5), false, "足迹自身不是前方");
  assert.equal(map.isFront(7, 7), false, "背面方向不是前方");
  // 与足迹同排但在其列范围之外的格子并没有越过正面外边缘，属于后方而非前方。
  assert.equal(map.zoneAt(1, 5), "back", "与足迹同排、列外的格子属于后方");
  assert.equal(map.zoneAt(14, 6), "back", "与足迹同排、列外的格子属于后方（另一侧同理）");
  // 后方 = 剩下的格子（总 140 - 前方 56 - 足迹 4）。
  assert.equal(map.back.length, 140 - 4 * 14 - 4, "后方应为除前方与足迹外的其余格子");
  assert.equal(map.front.length + map.back.length + map.footprintCells.length, 140,
    "前方 + 后方 + 足迹必须正好覆盖版图 140 格");
  // 后部是后方的子集，且远小于后方。
  assert.equal(map.rear.length, 2, "2×2 足迹后部为 2 格");
  for (const cell of map.rear) {
    assert.equal(map.zoneAt(cell.column, cell.row), "back", "后部格子必须落在后方一侧");
  }
  assert.ok(map.rear.length < map.back.length, "后部只是后方的一小部分，二者不可混用");
}

// 朝东：正面外边缘是 column 8 的右边，column 9..14 为前方。
{
  const map = FACING.computeFacingMap(monster(5, 6, 7, 8, { orientation: "E", rotation: 90 }));
  assert.equal(map.facing, 90);
  assert.equal(map.front.length, 6 * 10, "朝东时前方应为 column 9-14 的全部 60 格");
  assert.equal(map.isFront(9, 1), true, "朝东前方应横跨所有行");
  assert.equal(map.isFront(8, 5), false, "足迹自身不是前方");
  assert.equal(map.isRear(6, 5), true, "朝东的后部在足迹左侧");
}

// --- 分区互斥且完备：四个朝向、三种足迹全覆盖检查 ---
for (const box of [monster(5, 5, 7, 7), monster(5, 6, 7, 8), monster(4, 6, 6, 8)]) {
  for (const facing of [0, 90, 180, 270]) {
    const map = FACING.computeFacingMap(box, { facing });
    let counts = { front: 0, back: 0, footprint: 0 };
    for (let row = 1; row <= 10; row += 1) {
      for (let column = 1; column <= 14; column += 1) counts[map.zoneAt(column, row)] += 1;
    }
    assert.equal(counts.front + counts.back + counts.footprint, 140,
      "每个格子必须恰好属于一个分区");
    assert.equal(counts.footprint, map.footprintCells.length, "足迹格数应与分区统计一致");
    assert.equal(counts.front, map.front.length, "前方格数应与分区统计一致");
  }
}

// --- 随机朝向：R/K 不能被当成确定朝向，也不能默默退化成 0 ---
{
  const map = FACING.computeFacingMap(monster(5, 6, 7, 8, { orientation: "R", rotation: null }));
  assert.equal(map.facing, null, "随机朝向 R 未指定结果时 facing 必须为 null");
  assert.equal(map.random, true, "随机朝向应被标记出来");
  assert.equal(map.choices.join(","), "0,90,180,270", "R 的候选朝向为四个方向");
  assert.equal(map.front.length, 0, "朝向未定时不得给出前方");
  assert.equal(map.rear.length, 0, "朝向未定时不得给出后部");
  assert.equal(map.zoneAt(7, 4), null, "朝向未定时分区应为 null");

  const k = FACING.computeFacingMap(monster(5, 6, 7, 8, { orientation: "K", rotation: null }));
  assert.equal(k.choices.join(","), "180,270", "K 的候选朝向只有两个方向");

  // 指定 override 后应正常计算。
  const fixed = FACING.computeFacingMap(monster(5, 6, 7, 8, { orientation: "R", rotation: null }), { facing: 180 });
  assert.equal(fixed.facing, 180, "override 应覆盖随机朝向");
  assert.equal(fixed.random, false, "override 后不再是待定状态");
  assert.equal(fixed.front.length, 4 * 14, "朝南时前方应为 row 7-10 的全部 56 格");
}

// --- 与真实版图数据对照：所有怪物摆放都能被解析，且非随机朝向必须落在四个正交方向 ---
{
  const vm = require("vm");
  const fs = require("fs");
  const context = vm.createContext({ window: {}, console, module: { exports: {} } });
  const boardPath = path.join(__dirname, "..", "..", "display", "data", "conflict-board-data.js");
  vm.runInContext(fs.readFileSync(boardPath, "utf8"), context, { filename: boardPath });
  const DATA = context.window.KF_CONFLICT_BOARD_DATA || context.KF_CONFLICT_BOARD_DATA;
  const layouts = Object.values(DATA.layouts);

  let total = 0;
  let random = 0;
  for (const layout of layouts) {
    for (const placement of layout.placements || []) {
      if (placement.kind !== "monster") continue;
      total += 1;
      const map = FACING.computeFacingMap(placement);
      const box = map.box;
      const span = box.rowEnd - box.rowStart + 1;
      const width = box.columnEnd - box.columnStart + 1;
      assert.ok([1, 2, 3].includes(span) && span === width,
        `怪物足迹应为 1/4/9 格的正方形，实际 ${width}×${span}（${placement.id}）`);
      if (map.facing === null) {
        random += 1;
        assert.equal(map.random, true, `${placement.id} 朝向未定时必须标记为随机`);
      } else {
        assert.ok([0, 90, 180, 270].includes(map.facing),
          `${placement.id} 的朝向必须是正交方向，实际 ${map.facing}`);
        assert.equal(map.rear.length > 0 || box.rowStart === 1 || box.rowEnd === 10
          || box.columnStart === 1 || box.columnEnd === 14, true,
          `${placement.id} 的后部只有在贴边时才允许为空`);
        assert.equal(map.front.length + map.back.length + map.footprintCells.length, 140,
          `${placement.id} 的分区必须覆盖整块版图`);
      }
    }
  }
  assert.equal(total, 86, `版图数据应有 86 个怪物摆放，实际 ${total}`);
  assert.ok(random > 0, "应存在随机朝向的怪物摆放（orientation R/K）");
}
