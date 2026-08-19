/*
 * KF 怪物朝向 / 前方 / 后部（规则书 P49-P50「怪物朝向 Monster Facing」）
 *
 * 原文（P49）：
 *   「每只怪物都有朝向，即其前方方向。有些目标选择语句或其他游戏要素会引用怪物的
 *     前方或后方。要确定其他游戏要素是否在怪物前方，沿其模型正面部分所占的格子外
 *     边缘画一条长直线，在沿朝向方向超过此直线的一侧所有的格子都视作前方（下图中
 *     白色部分），另一侧为后方。」
 *   「后部 Rear 仅指怪物背后相邻的版图格子（背后为与朝向方向相反的方向），在怪物
 *     图示中以 R 符号表示。」
 *   图示注解：「白色格子为前方、2 个橙色格子为后部。」——2×2 足迹的后部正好 2 格。
 *
 * 因此三个概念必须严格区分，不可混用：
 *   前方 (front)  = 半平面。沿朝向越过「正面外边缘」这条长直线的所有格子，横跨整块
 *                   版图，不限于足迹所在的列/行。
 *   后方 (back)   = 前方的补集里、除足迹本身之外的另一侧，同样是半平面。
 *   后部 (rear)   = 只有紧贴足迹背面的那一排相邻格，数量等于足迹的宽度。
 * 「后部」是「后方」的一个很小的子集，规则里用途也不同（前方用于目标选择，
 *  后部本身无规则，只被涉及骑士位置的效果引用）。
 *
 * 朝向数值约定（与 app.js 的 cardinalFacing + styles.css 的 .facing-* 一致，已核对）：
 *   0 = 北 = ▲ 朝上 = row 递减（KF 第 1 行在版图顶部）
 *   90 = 东 = row 不变、column 递增
 *   180 = 南 = row 递增
 *   270 = 西 = column 递减
 * 注意 KF 的 row 向下增大，与 y 轴向上的坐标系相反，写方向向量时不要照抄别处的公式。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KF_FACING = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const COLUMNS = 14;
  const ROWS = 10;

  const cellKey = (column, row) => `${column},${row}`;
  const inBoard = (column, row) => column >= 1 && column <= COLUMNS && row >= 1 && row <= ROWS;

  // 朝向 -> 单位方向向量。dRow 为负表示向版图上方（第 1 行）走。
  const VECTORS = {
    0: { dColumn: 0, dRow: -1, name: "北", label: "上" },
    90: { dColumn: 1, dRow: 0, name: "东", label: "右" },
    180: { dColumn: 0, dRow: 1, name: "南", label: "下" },
    270: { dColumn: -1, dRow: 0, name: "西", label: "左" },
  };

  const ORIENTATION_MAP = { N: 0, E: 90, S: 180, W: 270 };
  // 版图数据里 orientation 为 R/K 时表示随机朝向，rotation 会是 null，必须由调用方指定。
  const RANDOM_ORIENTATIONS = { R: [0, 90, 180, 270], K: [180, 270] };

  const cardinalFacing = value => {
    const normalized = ((Number(value) || 0) % 360 + 360) % 360;
    return Math.round(normalized / 90) % 4 * 90;
  };

  const isRandomOrientation = orientation =>
    typeof orientation === "string" && Object.prototype.hasOwnProperty.call(RANDOM_ORIENTATIONS, orientation.toUpperCase());

  /*
   * 解析朝向，返回 {facing, random, choices}。
   * facing 为 null 表示这个摆放本身没有确定朝向（随机朝向且调用方没给出结果）。
   */
  function resolveFacing(placement, override) {
    if (override !== undefined && override !== null) {
      return { facing: cardinalFacing(override), random: false, choices: null };
    }
    const orientation = placement?.orientation;
    if (typeof orientation === "string") {
      const upper = orientation.toUpperCase();
      if (Object.prototype.hasOwnProperty.call(ORIENTATION_MAP, upper)) {
        return { facing: ORIENTATION_MAP[upper], random: false, choices: null };
      }
      if (isRandomOrientation(upper)) {
        return { facing: null, random: true, choices: RANDOM_ORIENTATIONS[upper].slice() };
      }
    }
    if (placement?.rotation === null || placement?.rotation === undefined) {
      return { facing: null, random: false, choices: null };
    }
    return { facing: cardinalFacing(placement.rotation), random: false, choices: null };
  }

  // 足迹：摆放占据的所有格子（1 起始，含端点）。怪物只会是 1/4/9 格的正方形。
  function footprint(placement) {
    const rowStart = Math.min(placement.rowStart, placement.rowEnd);
    const rowEnd = Math.max(placement.rowStart, placement.rowEnd);
    const columnStart = Math.min(placement.columnStart, placement.columnEnd);
    const columnEnd = Math.max(placement.columnStart, placement.columnEnd);
    const cells = [];
    for (let row = rowStart; row <= rowEnd; row += 1) {
      for (let column = columnStart; column <= columnEnd; column += 1) cells.push({ row, column });
    }
    return { rowStart, rowEnd, columnStart, columnEnd, cells };
  }

  /*
   * 正面外边缘所在的「格线」，以及该方向上足迹的跨度。
   * 以朝向 0（北）为例：正面是 rowStart 那一排，外边缘是 rowStart 的上边，
   * 因此 row < rowStart 的格子都在前方。
   */
  function frontEdge(box, facing) {
    if (facing === 0) return { axis: "row", ahead: -1, edge: box.rowStart };
    if (facing === 180) return { axis: "row", ahead: 1, edge: box.rowEnd };
    if (facing === 270) return { axis: "column", ahead: -1, edge: box.columnStart };
    return { axis: "column", ahead: 1, edge: box.columnEnd };
  }

  /*
   * 单个格子相对朝向的分区：front / back / footprint。
   * 判定只看那条「长直线」的哪一侧，因此与足迹的列/行跨度无关：
   * 例如怪物朝北占 row 5-6、column 7-8 时，(column 1, row 5) 并不在正面外边缘之外，
   * 它属于后方，而不是前方 —— 前方只包含 row < 5 的格子。
   */
  function zoneOf(cell, box, facing) {
    if (cell.row >= box.rowStart && cell.row <= box.rowEnd
      && cell.column >= box.columnStart && cell.column <= box.columnEnd) return "footprint";
    const { axis, ahead, edge } = frontEdge(box, facing);
    const value = axis === "row" ? cell.row : cell.column;
    // 越过正面外边缘的一侧是前方，横跨整块版图（长直线），不限于足迹的列/行。
    if (ahead < 0 ? value < edge : value > edge) return "front";
    return "back";
  }

  /*
   * 后部：仅足迹背面紧邻的一排格子，宽度等于足迹在垂直于朝向方向上的跨度。
   * 2×2 足迹 -> 2 格，与 P50 图示「2 个橙色格子为后部」一致。
   */
  function rearCells(box, facing) {
    const cells = [];
    if (facing === 0) {
      for (let column = box.columnStart; column <= box.columnEnd; column += 1) cells.push({ row: box.rowEnd + 1, column });
    } else if (facing === 180) {
      for (let column = box.columnStart; column <= box.columnEnd; column += 1) cells.push({ row: box.rowStart - 1, column });
    } else if (facing === 90) {
      for (let row = box.rowStart; row <= box.rowEnd; row += 1) cells.push({ row, column: box.columnStart - 1 });
    } else {
      for (let row = box.rowStart; row <= box.rowEnd; row += 1) cells.push({ row, column: box.columnEnd + 1 });
    }
    return cells.filter(cell => inBoard(cell.column, cell.row));
  }

  /*
   * 计算整块版图的朝向分区。返回：
   *   facing / vector / random / choices
   *   box / footprintCells
   *   front / back：格子数组（不含足迹本身）
   *   rear：后部格子数组
   *   grid[row][column] = "front" | "back" | "footprint"
   *   zoneAt(column,row) / isFront / isRear
   * facing 为 null（随机朝向未定）时 front/back/rear 均为空，grid 全为 null，
   * 由调用方决定是提示玩家选朝向还是逐个候选朝向分别计算。
   */
  function computeFacingMap(placement, options = {}) {
    const box = footprint(placement);
    const resolved = resolveFacing(placement, options.facing);
    const facing = resolved.facing;
    const base = {
      facing,
      vector: facing === null ? null : VECTORS[facing],
      random: resolved.random,
      choices: resolved.choices,
      box,
      footprintCells: box.cells,
    };
    if (facing === null) {
      const grid = [];
      for (let row = 1; row <= ROWS; row += 1) grid.push(new Array(COLUMNS + 1).fill(null));
      return Object.assign(base, {
        front: [], back: [], rear: [], rearKeys: new Set(), frontKeys: new Set(),
        grid,
        zoneAt: () => null,
        isFront: () => false,
        isRear: () => false,
      });
    }

    const front = [];
    const back = [];
    const grid = [];
    for (let row = 1; row <= ROWS; row += 1) {
      const line = new Array(COLUMNS + 1).fill(null);
      for (let column = 1; column <= COLUMNS; column += 1) {
        const zone = zoneOf({ row, column }, box, facing);
        line[column] = zone;
        if (zone === "front") front.push({ row, column });
        else if (zone === "back") back.push({ row, column });
      }
      grid.push(line);
    }
    const rear = rearCells(box, facing);
    const rearKeys = new Set(rear.map(cell => cellKey(cell.column, cell.row)));
    const frontKeys = new Set(front.map(cell => cellKey(cell.column, cell.row)));
    return Object.assign(base, {
      front,
      back,
      rear,
      rearKeys,
      frontKeys,
      grid,
      zoneAt: (column, row) => (inBoard(column, row) ? grid[row - 1][column] : null),
      isFront: (column, row) => frontKeys.has(cellKey(column, row)),
      isRear: (column, row) => rearKeys.has(cellKey(column, row)),
    });
  }

  return {
    COLUMNS,
    ROWS,
    VECTORS,
    ORIENTATION_MAP,
    RANDOM_ORIENTATIONS,
    cardinalFacing,
    isRandomOrientation,
    resolveFacing,
    footprint,
    frontEdge,
    zoneOf,
    rearCells,
    computeFacingMap,
    cellKey,
    inBoard,
  };
});
