/*
 * KF 冲突版图叠加层：把 kf-los 与寻路结果合成为「每格一组 CSS 类」。
 *
 * 这一层刻意不碰 DOM，只做纯数据合成，因此可以在 Node 里直接测。
 * app.js 只负责把 classesAt(column, row) 的结果拼到既有 .terrain-control-grid
 * 的 140 个 <span> 上——那批 span 已经是 row-major、14 列 10 行，几何与本模块
 * 完全一致，不需要另建定位层。
 *
 * 视点（source）是玩家在棋盘上点选的模型左上角：
 *   - 遮挡集合由 boardState.terrain 经 KF_LOS.buildOccluders 得到（只认遮蔽）。
 *   - 视点自身所在的遮蔽板块整块豁免，靠 KF_LOS 的 exempt 逻辑实现。
 *   - Boss 模式读取当前布局里最大的怪物 footprint；骑士模式固定 1×1。
 *   - 寻路参考 atonew/aibp/battle_los.js：当前模型足迹按横优先/纵优先两条
 *     规则路线朝 1 格骑士目标移动，进入近战距离（相邻）即停止。
 *
 * kfboss 没有射程，所以这里不再提供射程带/可攻击格合成；底层 kf-los.js 保留
 * 射程工具给其他模块兼容，但本叠加层只画视线遮挡与起点。
 * 盲点与攀爬点按用户要求不做（2026-08-18 范围决定）。
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.KF_OVERLAY = factory();
}(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const losApi = () => (typeof window !== "undefined" ? window.KF_LOS : null);

  const COLUMNS = 14;
  const ROWS = 10;
  const LAYERS = ["los", "path"];
  const MODES = ["boss", "knight"];
  const DEFAULTS = { sourceCell: null, targetCell: null, sourceMode: "boss", move: 5, los: true, path: false };
  const inBoard = (column, row) => column >= 1 && column <= COLUMNS && row >= 1 && row <= ROWS;
  const normalizeCell = cell => {
    if (!cell || typeof cell !== "object") return null;
    const row = Number(cell.row);
    const column = Number(cell.column);
    return Number.isInteger(row) && Number.isInteger(column) && inBoard(column, row) ? { row, column } : null;
  };

  // 叠加层设置的规整化，用于存档读回时挡住脏数据。
  function normalizeSettings(raw) {
    const out = { ...DEFAULTS };
    if (!raw || typeof raw !== "object") return out;
    const sourceCell = normalizeCell(raw.sourceCell);
    const targetCell = normalizeCell(raw.targetCell);
    if (sourceCell) out.sourceCell = sourceCell;
    if (targetCell) out.targetCell = targetCell;
    if (MODES.includes(raw.sourceMode)) out.sourceMode = raw.sourceMode;
    const move = Number(raw.move);
    if (Number.isInteger(move) && move >= 0 && move <= 20) out.move = move;
    for (const key of LAYERS) if (typeof raw[key] === "boolean") out[key] = raw[key];
    return out;
  }

  // 旧接口保留给外部测试/脚本兼容；新版 UI 不再从 placement 里选固定视点。
  function sourceCandidates(placements) {
    return (placements || []).filter(item => item && (item.kind === "monster" || item.kind === "knight"));
  }

  function footprintCells(placement) {
    const cells = [];
    if (!placement) return cells;
    for (let row = placement.rowStart; row <= placement.rowEnd; row += 1) {
      for (let column = placement.columnStart; column <= placement.columnEnd; column += 1) {
        cells.push({ row, column });
      }
    }
    return cells;
  }

  const clampOrigin = (cell, footprint) => ({
    row: Math.min(Math.max(1, cell.row), ROWS - footprint.height + 1),
    column: Math.min(Math.max(1, cell.column), COLUMNS - footprint.width + 1),
  });

  function bossFootprint(placements) {
    const monsters = (placements || []).filter(item => item && item.kind === "monster");
    let best = null;
    for (const monster of monsters) {
      const width = Math.max(1, Number(monster.columnEnd) - Number(monster.columnStart) + 1);
      const height = Math.max(1, Number(monster.rowEnd) - Number(monster.rowStart) + 1);
      const area = width * height;
      if (!best || area > best.area) best = { mode: "boss", width, height, area, label: `Boss ${width}×${height}` };
    }
    return best || { mode: "boss", width: 1, height: 1, area: 1, label: "Boss 1×1" };
  }

  function footprintFor(settings, placements) {
    if (settings.sourceMode === "knight") return { mode: "knight", width: 1, height: 1, area: 1, label: "骑士 1×1" };
    return bossFootprint(placements);
  }

  function sourceFromCell(cell, footprint) {
    if (!cell) return null;
    const origin = clampOrigin(cell, footprint);
    return {
      id: `cell-${origin.column}-${origin.row}-${footprint.width}x${footprint.height}`,
      kind: "cell",
      rowStart: origin.row,
      rowEnd: origin.row + footprint.height - 1,
      columnStart: origin.column,
      columnEnd: origin.column + footprint.width - 1,
    };
  }

  const terrainApi = () => (typeof window !== "undefined" ? window.KF_TERRAIN_KEYWORDS : null);

  function buildMovementMap(terrain, options) {
    const api = (options && options.terrain) || terrainApi();
    const blocked = new Set();
    const difficult = new Set();
    const cellKey = (options && options.cellKey) || ((column, row) => `${column},${row}`);
    (terrain || []).forEach(placement => {
      if (!placement || (placement.kind && placement.kind !== "terrain")) return;
      const cells = api && api.occupiedCells ? api.occupiedCells(placement) : [];
      const destroyed = placement.destroyed === true;
      const blocks = !destroyed && Boolean(api && (api.isObstacle(placement.asset) || api.isChasm(placement.asset)));
      const slows = !destroyed && Boolean(api && api.isDifficult(placement.asset));
      for (const { row, column } of cells) {
        if (!inBoard(column, row)) continue;
        const key = cellKey(column, row);
        if (blocks) blocked.add(key);
        if (slows) difficult.add(key);
      }
    });
    return { blocked, difficult };
  }

  function targetFromCell(cell) {
    const target = normalizeCell(cell);
    if (!target) return null;
    return {
      id: `knight-target-${target.column}-${target.row}`,
      kind: "knight-target",
      row: target.row,
      column: target.column,
      rowStart: target.row,
      rowEnd: target.row,
      columnStart: target.column,
      columnEnd: target.column,
    };
  }

  function footprintCellsForOrigin(origin, footprint) {
    const cells = [];
    if (!origin) return cells;
    for (let row = origin.row; row < origin.row + footprint.height; row += 1) {
      for (let column = origin.column; column < origin.column + footprint.width; column += 1) {
        cells.push({ row, column });
      }
    }
    return cells;
  }

  function footprintDeltaToTarget(origin, footprint, target) {
    const cells = footprintCellsForOrigin(origin, footprint);
    if (!origin || !target || !cells.length) {
      return { dx: 0, dy: 0, h: 0, v: 0, distance: Infinity, cells };
    }
    const c0 = origin.column;
    const c1 = origin.column + footprint.width - 1;
    const r0 = origin.row;
    const r1 = origin.row + footprint.height - 1;
    const dx = target.column < c0 ? target.column - c0 : (target.column > c1 ? target.column - c1 : 0);
    const dy = target.row < r0 ? target.row - r0 : (target.row > r1 ? target.row - r1 : 0);
    return { dx, dy, h: Math.abs(dx), v: Math.abs(dy), distance: Math.abs(dx) + Math.abs(dy), cells };
  }

  function facingFromStep(axis, sign) {
    if (axis === "h") return sign > 0 ? 90 : 270;
    return sign > 0 ? 180 : 0;
  }

  function facingToTarget(origin, footprint, target, fallback) {
    const delta = footprintDeltaToTarget(origin, footprint, target);
    if (delta.h > 0 && delta.v === 0) return facingFromStep("h", Math.sign(delta.dx));
    if (delta.v > 0 && delta.h === 0) return facingFromStep("v", Math.sign(delta.dy));
    return fallback;
  }

  function pathKey(origins) {
    return origins.map(cell => `${cell.column},${cell.row}`).join(">");
  }

  function buildMovementPath({ firstAxis, sourceOrigin, footprint, target, reach = 1 }) {
    const origins = [{ row: sourceOrigin.row, column: sourceOrigin.column }];
    let current = { row: sourceOrigin.row, column: sourceOrigin.column };
    let nextAxis = firstAxis;
    let steps = 0;
    let lastFacing = null;
    const maxSteps = COLUMNS + ROWS + footprint.width + footprint.height;
    const stopReach = Math.max(0, Math.floor(Number(reach) || 0));
    const done = () => footprintDeltaToTarget(current, footprint, target).distance <= stopReach;
    while (steps < maxSteps && !done()) {
      const delta = footprintDeltaToTarget(current, footprint, target);
      const hasH = delta.h > 0;
      const hasV = delta.v > 0;
      let axis = hasH && hasV ? nextAxis : (hasH ? "h" : "v");
      if (axis === "h" && !hasH) axis = "v";
      if (axis === "v" && !hasV) axis = "h";
      const sign = axis === "h" ? Math.sign(delta.dx) : Math.sign(delta.dy);
      if (!sign) break;
      const rawNext = axis === "h"
        ? { row: current.row, column: current.column + sign }
        : { row: current.row + sign, column: current.column };
      const next = clampOrigin(rawNext, footprint);
      if (next.row === current.row && next.column === current.column) break;
      current = next;
      origins.push({ row: current.row, column: current.column });
      lastFacing = facingFromStep(axis, sign);
      steps += 1;
      if (hasH && hasV) nextAxis = axis === "h" ? "v" : "h";
    }
    const finalDelta = footprintDeltaToTarget(current, footprint, target);
    return {
      id: firstAxis === "h" ? "horizontal-first" : "vertical-first",
      label: firstAxis === "h" ? "横向优先" : "纵向优先",
      kind: "rules",
      origins,
      footprints: origins.map(origin => footprintCellsForOrigin(origin, footprint)),
      steps,
      finalOrigin: current,
      finalFootprint: footprintCellsForOrigin(current, footprint),
      facing: finalDelta.distance <= stopReach ? facingToTarget(current, footprint, target, lastFacing) : lastFacing,
      stopReason: finalDelta.distance <= stopReach
        ? (steps === 0 ? "already-in-range" : "in-range")
        : "board-limit",
    };
  }

  function uniquePaths(paths) {
    const seen = new Set();
    return paths.filter(path => {
      const key = pathKey(path.origins);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function facingCellForPath(path) {
    const cells = path && path.finalFootprint ? path.finalFootprint : [];
    if (!cells.length) return null;
    const columns = cells.map(cell => cell.column);
    const rows = cells.map(cell => cell.row);
    const minColumn = Math.min(...columns);
    const maxColumn = Math.max(...columns);
    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    const centerColumn = Math.floor((minColumn + maxColumn) / 2);
    const centerRow = Math.floor((minRow + maxRow) / 2);
    if (path.facing === 90) return { row: centerRow, column: maxColumn };
    if (path.facing === 270) return { row: centerRow, column: minColumn };
    if (path.facing === 180) return { row: maxRow, column: centerColumn };
    return { row: minRow, column: centerColumn };
  }

  function computePathMap(sourceCells, target, footprint, LOS) {
    const origin = sourceCells.length ? { row: sourceCells[0].row, column: sourceCells[0].column } : null;
    const empty = {
      found: false,
      origins: [],
      path: [],
      grid: {},
      cost: null,
      costByOrigin: new Map(),
      costByCell: new Map(),
      pathCells: [],
      targetCells: [],
      rules: [],
    };
    if (!origin || !target) return empty;
    const canPlace = cell => footprintCellsForOrigin(cell, footprint).every(item => inBoard(item.column, item.row));
    if (!canPlace(origin)) return empty;
    const rules = uniquePaths([
      buildMovementPath({ firstAxis: "h", sourceOrigin: origin, footprint, target, reach: 1 }),
      buildMovementPath({ firstAxis: "v", sourceOrigin: origin, footprint, target, reach: 1 }),
    ]);
    const primary = rules[0] || null;
    const ruleMaps = rules.map((path, index) => {
      const routeKeys = new Set();
      const finalKeys = new Set(path.finalFootprint.map(cell => LOS.cellKey(cell.column, cell.row)));
      path.footprints.slice(1).forEach(footprintCellsAtStep => {
        for (const cell of footprintCellsAtStep) routeKeys.add(LOS.cellKey(cell.column, cell.row));
      });
      const facingCell = facingCellForPath(path);
      return {
        index,
        id: path.id,
        label: path.label,
        routeKeys,
        finalKeys,
        facingKey: facingCell ? LOS.cellKey(facingCell.column, facingCell.row) : null,
      };
    });
    const grid = {};
    const costByCell = new Map();
    for (let row = 1; row <= ROWS; row += 1) {
      for (let column = 1; column <= COLUMNS; column += 1) grid[LOS.cellKey(column, row)] = false;
    }
    for (const path of rules) {
      path.footprints.slice(1).forEach((footprintCellsAtStep, index) => {
        const cost = index + 1;
        for (const cell of footprintCellsAtStep) {
          const cellKey = LOS.cellKey(cell.column, cell.row);
          grid[cellKey] = true;
          if (!costByCell.has(cellKey) || costByCell.get(cellKey) > cost) costByCell.set(cellKey, cost);
        }
      });
    }
    const pathCells = [];
    for (const [key, cost] of costByCell.entries()) {
      const [column, row] = key.split(",").map(Number);
      pathCells.push({ row, column, cost });
    }
    return {
      found: Boolean(primary),
      origins: primary ? primary.origins : [],
      path: primary ? primary.origins.map((cell, index) => ({ ...cell, cost: index })) : [],
      grid,
      cost: primary ? primary.steps : null,
      costByOrigin: new Map((primary ? primary.origins : []).map((cell, index) => [LOS.cellKey(cell.column, cell.row), index])),
      costByCell,
      pathCells,
      targetCells: [{ row: target.row, column: target.column }],
      rules,
      ruleMaps,
      primary,
    };
  }

  /*
   * 合成叠加层。
   * 入参：
   *   boardState  battle.conflictBoard（要 terrain / overlay）
   *   placements  当前布局 placements，用来读取 Boss footprint
   *   deps        { los, terrain } 测试用注入；缺省走 window 上的全局
   * 返回：
   *   { settings, source, counts, classesAt, cellState }
   *   source 为空时 active=false，classesAt 恒返回空数组，渲染端可无脑调用。
   */
  function computeOverlay(boardState, placements, deps) {
    const LOS = (deps && deps.los) || losApi();
    const settings = normalizeSettings(boardState && boardState.overlay);
    const footprint = footprintFor(settings, placements);
    const source = sourceFromCell(normalizeCell(settings.sourceCell), footprint);
    const target = targetFromCell(settings.targetCell);
    const empty = {
      settings,
      footprint,
      source: null,
      target: null,
      active: false,
      counts: { visible: 0, path: 0, pathCost: null, routes: 0 },
      distanceAt: () => null,
      cellState: () => null,
      classesAt: () => [],
    };
    if (!LOS || !source) return empty;

    const cells = footprintCells(source);
    const occ = LOS.buildOccluders(boardState && boardState.terrain, deps && deps.terrain ? { terrain: deps.terrain } : undefined);
    const los = settings.los ? LOS.computeLosMap(cells, occ) : null;
    const targetCells = target ? [{ row: target.row, column: target.column }] : [];
    const movement = settings.path && target
      ? computePathMap(cells, target, footprint, LOS)
      : null;

    const footprintKeys = new Set(cells.map(cell => LOS.cellKey(cell.column, cell.row)));
    const targetKeys = new Set(targetCells.map(cell => LOS.cellKey(cell.column, cell.row)));
    const distance = {};
    for (let row = 1; row <= ROWS; row += 1) {
      for (let column = 1; column <= COLUMNS; column += 1) {
        const key = LOS.cellKey(column, row);
        distance[key] = Math.min(...cells.map(cell => Math.abs(column - cell.column) + Math.abs(row - cell.row)));
      }
    }
    const counts = {
      visible: los ? los.visible.length : 0,
      path: movement && movement.found ? Math.max(0, movement.path.length - 1) : 0,
      pathCost: movement && movement.found ? movement.cost : null,
      routes: movement && movement.found ? movement.rules.length : 0,
    };

    function cellState(column, row) {
      if (!LOS.inBoard(column, row)) return null;
      const key = LOS.cellKey(column, row);
      const inFootprint = footprintKeys.has(key);
      const inTarget = targetKeys.has(key);
      const seen = los ? Boolean(los.grid[key]) : null;
      const onPath = movement ? Boolean(movement.grid[key]) : null;
      const routeStates = movement
        ? movement.ruleMaps.map(rule => ({
          index: rule.index,
          path: rule.routeKeys.has(key),
          final: rule.finalKeys.has(key),
          facing: rule.facingKey === key,
          angle: movement.rules[rule.index] ? movement.rules[rule.index].facing : null,
        }))
        : [];
      return {
        key,
        column,
        row,
        distance: distance[key],
        source: inFootprint,
        target: inTarget,
        los: seen,
        path: onPath,
        pathA: Boolean(routeStates[0] && routeStates[0].path),
        pathB: Boolean(routeStates[1] && routeStates[1].path),
        pathOverlap: Boolean(routeStates[0] && routeStates[0].path && routeStates[1] && routeStates[1].path),
        finalA: Boolean(routeStates[0] && routeStates[0].final),
        finalB: Boolean(routeStates[1] && routeStates[1].final),
        finalOverlap: Boolean(routeStates[0] && routeStates[0].final && routeStates[1] && routeStates[1].final),
        facingA: Boolean(routeStates[0] && routeStates[0].facing),
        facingB: Boolean(routeStates[1] && routeStates[1].facing),
        facing: routeStates.find(route => route.facing)?.angle ?? null,
        routes: routeStates,
        pathCost: movement && movement.costByCell.has(key) ? movement.costByCell.get(key) : null,
      };
    }

    /*
     * 类名约定（样式见 styles.css 的 .terrain-control-grid span.kf-ov-*）：
     *   kf-ov-source    视线起点
     *   kf-ov-target    寻路目标
     *   kf-ov-blocked   开了视线层且该格没有 LoS
     *   kf-ov-path-a/b  开了寻路层且该格在 A/B 规则路线或最终足迹上
     *   kf-ov-facing-*  规则路线最终朝向箭头
     * 视线层只画「被遮挡」的格子：可见是常态，把常态涂满会盖掉版图美术。
     */
    function classesAt(column, row) {
      const state = cellState(column, row);
      if (!state) return [];
      const out = [];
      if (settings.path && state.path && !state.source && !state.target) {
        out.push("kf-ov-path");
        if (state.pathA) out.push("kf-ov-path-a");
        if (state.pathB) out.push("kf-ov-path-b");
        if (state.pathOverlap) out.push("kf-ov-path-overlap");
      }
      if (settings.path && (state.finalA || state.finalB) && !state.target) {
        out.push("kf-ov-final");
        if (state.finalA) out.push("kf-ov-final-a");
        if (state.finalB) out.push("kf-ov-final-b");
        if (state.finalOverlap) out.push("kf-ov-final-overlap");
      }
      if (settings.path && (state.facingA || state.facingB) && !state.target) {
        out.push("kf-ov-facing");
        if (state.facingA) out.push("kf-ov-facing-a");
        if (state.facingB) out.push("kf-ov-facing-b");
        if (state.facing === 0) out.push("kf-ov-facing-up");
        else if (state.facing === 90) out.push("kf-ov-facing-right");
        else if (state.facing === 180) out.push("kf-ov-facing-down");
        else if (state.facing === 270) out.push("kf-ov-facing-left");
      }
      if (settings.path && state.target && !state.source) out.push("kf-ov-target");
      if (state.source) out.push("kf-ov-source");
      if (settings.los && state.los === false) out.push("kf-ov-blocked");
      return out;
    }

    return { settings, footprint, source, target, active: true, counts, movement, distanceAt: (column, row) => distance[LOS.cellKey(column, row)] ?? null, cellState, classesAt };
  }

  return {
    LAYERS,
    MODES,
    DEFAULTS,
    normalizeSettings,
    sourceCandidates,
    footprintCells,
    bossFootprint,
    footprintFor,
    buildMovementMap,
    computeOverlay,
  };
}));
