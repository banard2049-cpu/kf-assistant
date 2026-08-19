/*
 * kf-overlay.js 的测试。跑法：node tests/kf-overlay.test.cjs
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = path.join(__dirname, "..");
const context = vm.createContext({ console, Math, JSON, Number, Set, Map, Array, Object, String, Boolean, Error, RegExp });
context.window = context;
context.self = context;
for (const file of [
  "data/terrain-keywords.js",
  "../display/data/conflict-board-data.js",
  "kf-los.js",
  "kf-facing.js",
  "kf-overlay.js",
]) {
  vm.runInContext(fs.readFileSync(path.join(dir, file), "utf8"), context, { filename: file });
}
const LOS = context.window.KF_LOS;
const OV = context.window.KF_OVERLAY;
assert.ok(LOS && OV, "视线模块与叠加层模块都应挂到 window 上");

const boardData = context.window.KF_CONFLICT_BOARD_DATA;
assert.ok(boardData && boardData.layouts && boardData.layouts.length, "应能读到冲突版图布局数据");

const deps = { los: LOS };
const keysOf = (ov, predicate) => {
  const out = [];
  for (let row = 1; row <= 10; row += 1) {
    for (let column = 1; column <= 14; column += 1) {
      if (predicate(ov.classesAt(column, row), column, row)) out.push(`${column},${row}`);
    }
  }
  return out;
};
const at = (row, column) => ({ row, column });

// ---- 设置规整化 ----------------------------------------------------------
{
  const d = OV.normalizeSettings(undefined);
  assert.equal(d.sourceCell, null);
  assert.equal(d.targetCell, null);
  assert.equal(d.sourceMode, "boss");
  assert.equal(d.move, 5);
  assert.equal(d.los, true, "视线层默认开");
  assert.equal(OV.LAYERS.join(","), "los,path", "kfboss 叠加层包含视线与寻路");

  const dirty = OV.normalizeSettings({
    sourceCell: { row: 0, column: 99 },
    targetCell: { row: 99, column: 0 },
    sourceMode: "dragon",
    move: 99,
    sourceId: "legacy-monster",
    bandId: "ranged2-4",
    range: true,
    facing: true,
    los: "yes",
  });
  assert.equal(dirty.sourceCell, null, "越界起点应被丢弃");
  assert.equal(dirty.targetCell, null, "越界目标应被丢弃");
  assert.equal(dirty.sourceMode, "boss", "非法模式应回落 Boss");
  assert.equal(dirty.move, 5, "非法移动值应回落默认");
  assert.equal(dirty.los, true, "非布尔值应回落默认");
  assert.equal("sourceId" in dirty, false, "旧固定视点字段不再保留");
  assert.equal("range" in dirty, false, "射程字段不再保留");
  assert.equal("bandId" in dirty, false, "射程带字段不再保留");

  const ok = OV.normalizeSettings({ sourceCell: { row: 5, column: 7 }, targetCell: { row: 5, column: 9 }, sourceMode: "knight", move: 8, los: false, path: true });
  assert.equal(`${ok.sourceCell.column},${ok.sourceCell.row}`, "7,5");
  assert.equal(`${ok.targetCell.column},${ok.targetCell.row}`, "9,5");
  assert.equal(ok.sourceMode, "knight");
  assert.equal(ok.move, 8);
  assert.equal(ok.los, false);
  assert.equal(ok.path, true);
}

// ---- 无起点时必须安全降级 ------------------------------------------------
{
  const ov = OV.computeOverlay({ terrain: [] }, [], deps);
  assert.equal(ov.active, false, "没有起点时叠加层不激活");
  assert.equal(ov.classesAt(1, 1).length, 0, "不激活时不产出任何类名");
  assert.equal(ov.cellState(1, 1), null);
  assert.equal(ov.counts.visible, 0);
}

// ---- 旧接口兼容 ----------------------------------------------------------
{
  const placements = [
    { id: "a", kind: "monster" }, { id: "b", kind: "knight" },
    { id: "c", kind: "terrain" }, { id: "d", kind: "number" }, { id: "e", kind: "special" },
  ];
  assert.equal(OV.sourceCandidates(placements).map(item => item.id).join(" "), "a b",
    "sourceCandidates 仅作为旧脚本兼容保留");
  const two = OV.footprintCells({ rowStart: 5, rowEnd: 6, columnStart: 7, columnEnd: 8 });
  assert.equal(two.map(c => `${c.column},${c.row}`).join(" "), "7,5 8,5 7,6 8,6");
}

// ---- 空版图：全可见，没有 kf-ov-blocked ----------------------------------
{
  const ov = OV.computeOverlay({ terrain: [], overlay: { sourceCell: at(5, 7), los: true } }, [], deps);
  assert.equal(ov.active, true);
  assert.equal(ov.source.kind, "cell", "视线起点应是棋盘格，而不是怪物/骑士 placement");
  assert.equal(ov.counts.visible, 140, "空版图上 140 格全可见");
  assert.equal(keysOf(ov, cls => cls.includes("kf-ov-blocked")).length, 0, "空版图不该有被遮挡格");
  assert.equal(keysOf(ov, cls => cls.includes("kf-ov-source")).join(" "), "7,5",
    "视线起点应正好是点选的单格");
  const generated = keysOf(ov, cls => cls.length).flatMap(key => ov.classesAt(...key.split(",").map(Number))).join(" ");
  assert.equal(/kf-ov-(range|attack|front|rear)/.test(generated), false,
    "kfboss 叠加层不应生成射程或朝向类");
}

// ---- Boss / 骑士模式：按当前 Boss 大小生成足迹 ----------------------------
{
  const boss = { id: "boss", kind: "monster", rowStart: 2, rowEnd: 3, columnStart: 2, columnEnd: 4 };
  const tiny = { id: "minion", kind: "monster", rowStart: 8, rowEnd: 8, columnStart: 8, columnEnd: 8 };
  const bossOv = OV.computeOverlay({ terrain: [], overlay: { sourceCell: at(5, 7), los: true } }, [tiny, boss], deps);
  assert.equal(bossOv.footprint.label, "Boss 3×2", "Boss 模式应读取当前布局最大怪物足迹");
  assert.equal(keysOf(bossOv, cls => cls.includes("kf-ov-source")).join(" "),
    "7,5 8,5 9,5 7,6 8,6 9,6", "Boss 3×2 起点应展开为完整足迹");
  assert.equal(bossOv.distanceAt(7, 5), 0, "Boss 足迹中的格子距离应为 0");
  assert.equal(bossOv.distanceAt(10, 7), 2, "Boss 外的距离应取到任一实际占格的最小正交距离");
  assert.equal(bossOv.counts.visible, LOS.computeLosMap([
    at(5, 7), at(5, 8), at(5, 9), at(6, 7), at(6, 8), at(6, 9),
  ], LOS.buildOccluders([])).visible.length);

  const knightOv = OV.computeOverlay({ terrain: [], overlay: { sourceCell: at(5, 7), sourceMode: "knight", los: true } }, [boss], deps);
  assert.equal(knightOv.footprint.label, "骑士 1×1");
  assert.equal(keysOf(knightOv, cls => cls.includes("kf-ov-source")).join(" "), "7,5",
    "骑士模式固定 1 格");
  assert.equal(knightOv.distanceAt(9, 6), 3, "骑士模式距离应从单格骑士计算");

  const clamped = OV.computeOverlay({ terrain: [], overlay: { sourceCell: at(10, 14), los: true } }, [boss], deps);
  assert.equal(keysOf(clamped, cls => cls.includes("kf-ov-source")).join(" "),
    "12,9 13,9 14,9 12,10 13,10 14,10", "大 Boss 点到边缘时足迹应夹在棋盘内");
}

// ---- 寻路：参考 ATO，Boss 足迹朝 1 格骑士目标移动到近战距离 -----------------
{
  const sourceCell = at(5, 5);
  const terrain = [
    { id: "wall", kind: "terrain", asset: "Column", rowStart: 5, rowEnd: 5, columnStart: 6, columnEnd: 6, rotation: 0 },
    { id: "well", kind: "terrain", asset: "Well", rowStart: 4, rowEnd: 5, columnStart: 8, columnEnd: 9, rotation: 0 },
    { id: "rubble", kind: "terrain", asset: "Rubble2", rowStart: 3, rowEnd: 4, columnStart: 5, columnEnd: 6, rotation: 0 },
  ];
  const ov = OV.computeOverlay({ terrain, overlay: { sourceCell, targetCell: at(5, 7), sourceMode: "knight", path: true, los: false } }, [], deps);
  assert.equal(ov.movement.found, true, "有效目标应找到路径");
  assert.equal(ov.counts.pathCost, 1, "ATO 规则到相邻骑士目标即停止");
  assert.equal(ov.counts.path, 1, "路径步数应只统计移动到近战距离的步数");
  assert.equal(ov.classesAt(6, 5).includes("kf-ov-path"), true, "寻路是路线提示，障碍格不应导致无路");
  assert.equal(ov.classesAt(8, 4).includes("kf-ov-path"), false, "不在最短路径上的格子不应被画出");
  assert.equal(ov.classesAt(7, 5).includes("kf-ov-target"), true, "目标格应单独标出");
  assert.equal(ov.cellState(7, 5).path, false, "骑士目标格不是 Boss 的落点");
  assert.equal(ov.cellState(4, 5).path, false, "不在最短路径上的可走格不应被画成可达范围");
}
{
  const terrain = [
    { id: "rubble", kind: "terrain", asset: "Rubble2", rowStart: 3, rowEnd: 4, columnStart: 5, columnEnd: 6, rotation: 0 },
  ];
  const ov = OV.computeOverlay({ terrain, overlay: { sourceCell: at(5, 5), targetCell: at(3, 5), sourceMode: "knight", path: true, los: false } }, [], deps);
  assert.equal(ov.movement.found, true, "困难地形中的目标仍应可寻路");
  assert.equal(ov.counts.pathCost, 1, "困难地形不影响 ATO 式路线步数");
  assert.equal(ov.cellState(5, 4).pathCost, 1);
  assert.equal(ov.cellState(5, 3).pathCost, null, "骑士目标格只标目标，不作为 Boss 落点");
}
{
  const terrain = [
    { id: "well", kind: "terrain", asset: "Well", rowStart: 4, rowEnd: 5, columnStart: 8, columnEnd: 9, rotation: 0 },
  ];
  const ov = OV.computeOverlay({ terrain, overlay: { sourceCell: at(5, 7), targetCell: at(4, 8), sourceMode: "knight", path: true, los: false } }, [], deps);
  assert.equal(ov.movement.found, true, "目标落在沟壑/障碍上也应按点击目标给出路线");
  assert.equal(ov.counts.pathCost, 1);
  assert.equal(ov.movement.rules.length, 2, "斜向接近时应给出横优先/纵优先两条规则路线");
  assert.equal(ov.classesAt(8, 4).includes("kf-ov-target"), true, "目标格应照常标出");
  assert.equal(ov.classesAt(8, 5).includes("kf-ov-path-a"), true, "横向优先路线应单独分色");
  assert.equal(ov.classesAt(7, 4).includes("kf-ov-path-b"), true, "纵向优先路线应单独分色");
  assert.equal(ov.classesAt(8, 5).includes("kf-ov-final-a"), true, "横向优先最终位置应标出");
  assert.equal(ov.classesAt(7, 4).includes("kf-ov-final-b"), true, "纵向优先最终位置应标出");
  assert.equal(ov.classesAt(8, 5).includes("kf-ov-facing-up"), true, "横向优先终点应给出朝向");
  assert.equal(ov.classesAt(7, 4).includes("kf-ov-facing-right"), true, "纵向优先终点应给出朝向");
}
{
  const boss = { id: "boss", kind: "monster", rowStart: 1, rowEnd: 2, columnStart: 1, columnEnd: 2 };
  const terrain = [
    { id: "wall", kind: "terrain", asset: "Column", rowStart: 5, rowEnd: 5, columnStart: 7, columnEnd: 7, rotation: 0 },
  ];
  const ov = OV.computeOverlay({ terrain, overlay: { sourceCell: at(5, 5), targetCell: at(5, 8), path: true, los: false } }, [boss], deps);
  assert.equal(ov.movement.found, true, "2×2 Boss 应能按目标重建路线");
  assert.equal(ov.classesAt(7, 5).includes("kf-ov-path"), true, "路线提示不因地形阻挡而消失");
  assert.equal(ov.cellState(6, 5).source, true, "Boss 自身足迹应保留为起点");
  assert.equal(keysOf(ov, cls => cls.includes("kf-ov-target")).join(" "), "8,5", "目标必须是 1 格骑士，不按 Boss 足迹展开");
  assert.equal(ov.cellState(8, 5).path, false, "Boss 到相邻后停下，不覆盖骑士目标格");
  assert.equal(ov.counts.pathCost, 1, "2×2 Boss 应按足迹边缘到骑士目标的距离计步");
}

// ---- 遮挡层：P50 那组遮蔽应与 kf-los 逐格一致 -----------------------------
{
  const terrain = [[3, 6], [4, 6], [5, 6], [5, 7], [7, 7], [8, 6]].map(([row, column], i) => ({
    id: `t${i}`, kind: "terrain", asset: "Column",
    rowStart: row, rowEnd: row, columnStart: column, columnEnd: column, rotation: 180,
  }));
  const sourceCell = at(4, 2);
  const boardState = { terrain, overlay: { sourceCell, los: true } };
  const ov = OV.computeOverlay(boardState, [], deps);
  const expected = LOS.computeLosMap([sourceCell], LOS.buildOccluders(terrain));
  assert.equal(ov.counts.visible, expected.visible.length, "叠加层可见数应来自同一套 LoS 几何");
  let mismatches = 0;
  for (let row = 1; row <= 10; row += 1) {
    for (let column = 1; column <= 14; column += 1) {
      const key = LOS.cellKey(column, row);
      const blocked = ov.classesAt(column, row).includes("kf-ov-blocked");
      if (blocked !== !expected.grid[key]) mismatches += 1;
    }
  }
  assert.equal(mismatches, 0, "每格遮挡类名必须与 kf-los 结果一致");
  assert.equal(ov.classesAt(2, 4).includes("kf-ov-source"), true, "起点格应被标出");

  const off = OV.computeOverlay({ terrain, overlay: { sourceCell, los: false } }, [], deps);
  assert.equal(keysOf(off, cls => cls.includes("kf-ov-blocked")).length, 0, "关掉视线层就不画遮挡");
  assert.equal(keysOf(off, cls => cls.includes("kf-ov-source")).join(" "), "2,4",
    "关闭遮挡后仍保留起点标记");
}

// ---- 真实布局数据全量跑一遍，确保不抛错 ----------------------------------
{
  let checked = 0;
  for (const layout of boardData.layouts) {
    const terrain = layout.placements.filter(item => item.kind === "terrain");
    for (const sourceCell of [at(1, 1), at(5, 7), at(10, 14)]) {
      const targetCell = at(5, 7);
      const ov = OV.computeOverlay({ terrain, overlay: { sourceCell, targetCell, los: true, path: true } }, layout.placements, deps);
      assert.equal(ov.active, true, `${layout.id}/${sourceCell.column},${sourceCell.row} 应激活`);
      assert.ok(ov.counts.visible >= 1 && ov.counts.visible <= 140, "可见格数应在 1..140");
      assert.ok(ov.counts.path >= 0 && ov.counts.path <= 140, "路径步数应在 0..140");
      assert.equal(ov.cellState(sourceCell.column, sourceCell.row).los, true, "起点自身格必须可见");
      assert.equal(ov.cellState(0, 1), null);
      assert.equal(ov.classesAt(15, 1).length, 0);
      checked += 1;
    }
  }
  assert.ok(checked >= 90, `应覆盖足够多的布局起点，实际 ${checked}`);
  console.log(`真实布局起点覆盖：${checked} 个`);
}

console.log("kf-overlay.test.cjs 全部通过");
