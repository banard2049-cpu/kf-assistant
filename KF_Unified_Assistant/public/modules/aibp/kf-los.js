/*
 * kf-los.js — KF 视线(LoS)与有效射程引擎。几何核心移植自 atonew/aibp/battle_los.js，
 * 规则全部改按《Kingdoms Forlorn》中规 1.06 重写，不沿用 ATO 的地形目录与关键词。
 *
 * 视线（P50 原文）：从攻击者所占格子的任意一角，到目标所占格子的任意一角，
 * 能否画出至少一条未被遮挡的连线。被遮挡的判定：
 *   · 连线穿过了遮蔽地形板块的格子       -> 不是 LoS
 *   · 连线与遮蔽地形板块的边缘共线       -> 不是 LoS
 *   · 连线仅穿过遮蔽地形板块角点         -> 是 LoS
 *   · 连线穿过两个要素斜角相连的共同角点 -> 不是 LoS（对角"夹角"）
 *   · 盲点与攀爬点永远都不视作在怪物的视线内
 *   · 一个模型永远都不会遮挡到其自身或到其他模型的连线
 *   · 位于遮蔽地形板块上的骑士或怪物，指向或来自其的连线不会被其所在的板块遮挡
 *
 * 只有「遮蔽」阻挡视线。P83 术语表与 P84 超级穿身条目都写明「障碍不会阻挡视线与射程」，
 * 所以遮挡集合只读 KF_TERRAIN_KEYWORDS 的 blocksSight，障碍/沟壑/困难地形一律不入集合。
 * ATO 的红墙、高地、云层在 KF 没有对应物，全部删除。
 *
 * 有效射程（P57 原文）：「有效射程就是攻击者与目标之间的距离，按格数计。只可沿正交方向
 * 计算，不可沿斜角方向计算。除非地形效果有特别说明，可穿过地形板块来测距。」
 * 即曼哈顿距离，且地形不影响测距。近战=相邻；延伸 X = 1..X（也可打相邻）；
 * 远程 X-Y = X..Y（大部分远程武器无法攻击相邻目标）。射程范围图是菱形，不是方形。
 *
 * 几何用整数「角点格网」：版图格子(column c, row r)占据 x∈[c-1,c]、y∈[r-1,r] 的单位方格，
 * 角点下标 i∈0..COLUMNS、j∈0..ROWS。row 1 在版图顶部（与 conflict-board-data 一致）。
 * 所有源/目标角点都是整数格点，因此判定是精确的，不存在浮点容差问题。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.KF_LOS = api;
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";

  const COLUMNS = 14;
  const ROWS = 10;

  const cellKey = (column, row) => `${column},${row}`;
  const inBoard = (column, row) => column >= 1 && column <= COLUMNS && row >= 1 && row <= ROWS;

  const terrainApi = () => (typeof window !== "undefined" ? window.KF_TERRAIN_KEYWORDS : null);

  // ---- 遮挡模型 ----------------------------------------------------------
  // terrain 为布局/存档里的地形 placement 数组。返回：
  //   obscuring: Set<cellKey>  所有遮蔽格
  //   cellTile:  Map<cellKey, tileId>   格 -> 所属板块
  //   tileCells: Map<tileId, cellKey[]> 板块 -> 全部格
  // cellTile/tileCells 用来实现整块豁免：单位站在遮蔽板块的任一格上时，
  // 该板块的**全部**格子都不遮挡它的连线，而不只是它脚下那一格。
  function buildOccluders(terrain, options) {
    const api = (options && options.terrain) || terrainApi();
    const obscuring = new Set();
    const cellTile = new Map();
    const tileCells = new Map();
    (terrain || []).forEach((placement, index) => {
      if (!placement || (placement.kind && placement.kind !== "terrain")) return;
      // 显式覆盖优先（塔/残垣断壁被摧毁后替换为瓦砾堆，不再遮蔽）。
      const blocks = placement.obscuring != null
        ? Boolean(placement.obscuring)
        : (!placement.destroyed && Boolean(api && api.isObscuring(placement.asset)));
      if (!blocks) return;
      const tileId = placement.id != null ? placement.id : `#${index}`;
      const keys = [];
      const cells = api && api.occupiedCells ? api.occupiedCells(placement) : [];
      for (const { row, column } of cells) {
        if (!inBoard(column, row)) continue;
        const key = cellKey(column, row);
        obscuring.add(key);
        cellTile.set(key, tileId);
        keys.push(key);
      }
      if (keys.length) tileCells.set(tileId, keys);
    });
    return { obscuring, cellTile, tileCells };
  }

  const hasObscuring = (occ, column, row) => occ.obscuring.has(cellKey(column, row));

  // ---- 几何核心 ----------------------------------------------------------
  // 收集线段与格网线（x 或 y 取整数处）的交点参数 t∈[0,1]，升序去重。
  function gatherCrossings(ai, aj, di, dj) {
    const ts = new Set([0, 1]);
    const addRange = (start, delta) => {
      if (delta === 0) return;
      const lo = Math.min(start, start + delta);
      const hi = Math.max(start, start + delta);
      for (let v = Math.ceil(lo); v <= Math.floor(hi); v += 1) {
        const t = (v - start) / delta;
        if (t > 0 && t < 1) ts.add(t);
      }
    };
    addRange(ai, di);
    addRange(aj, dj);
    return [...ts].sort((a, b) => a - b);
  }

  // 对角夹角：线段在内部格点 (x,y) 处从两个斜角相连格子之间挤过去。
  // 角点 (x,y) 周围四格（注意 row 向下增大）：
  //   左上 = (column x,   row y)      右上 = (column x+1, row y)
  //   左下 = (column x,   row y+1)    右下 = (column x+1, row y+1)
  // di*dj>0 的线从左上穿向右下，因此它是从「右上 + 左下」这条对角之间挤过去；
  // di*dj<0 的线从左下穿向右上，则是从「左上 + 右下」之间挤过去。
  // 被挤的那两格都是遮蔽且都未豁免 -> 不是 LoS。
  function pinchBlocked(x, y, di, dj, occ, exempt) {
    const a = di * dj > 0 ? { column: x + 1, row: y } : { column: x, row: y };
    const b = di * dj > 0 ? { column: x, row: y + 1 } : { column: x + 1, row: y + 1 };
    return hasObscuring(occ, a.column, a.row) && !exempt(a.column, a.row)
      && hasObscuring(occ, b.column, b.row) && !exempt(b.column, b.row);
  }

  // 轴对齐线段正好走在格网线上 —— 这就是「与遮蔽板块边缘共线」那一条：
  // 线两侧任一格是遮蔽（且未豁免）即不是 LoS。
  function axisBlocked(ai, aj, bi, bj, occ, exempt) {
    if (aj === bj) { // 水平，沿 y = aj
      const j = aj;
      const lo = Math.min(ai, bi);
      const hi = Math.max(ai, bi);
      for (let i = lo; i < hi; i += 1) {
        const column = i + 1;
        if (hasObscuring(occ, column, j) && !exempt(column, j)) return true;
        if (hasObscuring(occ, column, j + 1) && !exempt(column, j + 1)) return true;
      }
    } else { // 垂直，沿 x = ai
      const i = ai;
      const lo = Math.min(aj, bj);
      const hi = Math.max(aj, bj);
      for (let j = lo; j < hi; j += 1) {
        const row = j + 1;
        if (hasObscuring(occ, i, row) && !exempt(i, row)) return true;
        if (hasObscuring(occ, i + 1, row) && !exempt(i + 1, row)) return true;
      }
    }
    return false;
  }

  function segmentBlocked(ai, aj, bi, bj, occ, exempt) {
    const di = bi - ai;
    const dj = bj - aj;
    if (di === 0 && dj === 0) return true; // 退化：不是有效连线
    if (di === 0 || dj === 0) return axisBlocked(ai, aj, bi, bj, occ, exempt);
    const steps = gatherCrossings(ai, aj, di, dj);
    // (1) 穿过遮蔽格：逐段取中点采样，中点必然严格落在某一格内部。
    for (let k = 0; k < steps.length - 1; k += 1) {
      const tm = (steps[k] + steps[k + 1]) / 2;
      const column = Math.floor(ai + di * tm) + 1;
      const row = Math.floor(aj + dj * tm) + 1;
      if (hasObscuring(occ, column, row) && !exempt(column, row)) return true;
    }
    /*
     * (2) 对角夹角：在所有既是整数 x 又是整数 y 的格点处判定，含线段两端。
     *     仅穿过单个角点不算遮挡，所以这里必须要求两格同时遮蔽。
     *     端点同样要查：P50 视线示例里那条通往底部骑士的连线，正好终止于两座立柱
     *     斜角相连的共同角点上，书中的 ✕ 就画在该端点，判定为没有 LoS。
     *     换言之「穿过角点」只要求该角点落在连线上，不要求连线继续延伸出去。
     *     源格/目标格自身所在的整块遮蔽板块由 exempt 豁免，不会因此自锁。
     */
    for (let k = 0; k < steps.length; k += 1) {
      const t = steps[k];
      const x = ai + di * t;
      const y = aj + dj * t;
      if (Number.isInteger(x) && Number.isInteger(y) && pinchBlocked(x, y, di, dj, occ, exempt)) return true;
    }
    return false;
  }

  // ---- 公开 API ----------------------------------------------------------
  const normalizeCell = cell => {
    if (!cell) return null;
    const row = Number(cell.row != null ? cell.row : cell.r);
    const column = Number(cell.column != null ? cell.column : cell.c);
    return Number.isFinite(row) && Number.isFinite(column) ? { row, column } : null;
  };

  const normalizeCells = cells => (Array.isArray(cells) ? cells : [cells])
    .map(normalizeCell).filter(Boolean);

  // 一组格子的全部角点（整数格点），去重。
  function cornersOf(cells) {
    const found = new Map();
    for (const { row, column } of cells) {
      for (const [i, j] of [[column - 1, row - 1], [column, row - 1], [column - 1, row], [column, row]]) {
        found.set(`${i},${j}`, { i, j });
      }
    }
    return [...found.values()];
  }

  // 源（格子数组）到单个目标格是否有 LoS。
  // options.blindspots: Set<cellKey>，盲点与攀爬点。P50——盲点与攀爬点永远都不视作
  // 在怪物的视线内——这是目标侧的硬否决，先于任何几何判定，也不受豁免影响。
  function hasLos(sourceCells, target, occ, options) {
    const source = normalizeCells(sourceCells);
    const goal = normalizeCell(target);
    if (!source.length || !goal) return false;
    const blindspots = options && options.blindspots;
    if (blindspots && blindspots.has(cellKey(goal.column, goal.row))) return false;
    // 整块豁免：源/目标所在遮蔽板块的全部格子都不遮挡这条连线。
    const exemptSet = new Set();
    const addExemption = ({ row, column }) => {
      const key = cellKey(column, row);
      exemptSet.add(key);
      const tileId = occ.cellTile ? occ.cellTile.get(key) : undefined;
      if (tileId === undefined) return;
      for (const tileKey of occ.tileCells.get(tileId) || []) exemptSet.add(tileKey);
    };
    source.forEach(addExemption);
    addExemption(goal);
    const exempt = (column, row) => exemptSet.has(cellKey(column, row));
    for (const s of cornersOf(source)) {
      for (const t of cornersOf([goal])) {
        if (!segmentBlocked(s.i, s.j, t.i, t.j, occ, exempt)) return true;
      }
    }
    return false;
  }

  // 全版图视线图。返回 { grid: {cellKey: bool}, visible: [{row, column}] }。
  function computeLosMap(sourceCells, occ, options) {
    const source = normalizeCells(sourceCells);
    const grid = {};
    const visible = [];
    for (let row = 1; row <= ROWS; row += 1) {
      for (let column = 1; column <= COLUMNS; column += 1) {
        const seen = hasLos(source, { row, column }, occ, options);
        grid[cellKey(column, row)] = seen;
        if (seen) visible.push({ row, column });
      }
    }
    return { grid, visible };
  }

  // ---- 有效射程 ----------------------------------------------------------
  // P57：距离按格数计，只可沿正交方向，不可沿斜角方向 -> 曼哈顿距离。
  // 「可穿过地形板块来测距」-> 测距完全不看地形，与视线相互独立。
  const distance = (a, b) => Math.abs(a.column - b.column) + Math.abs(a.row - b.row);

  // 多格怪物取到脚印任一格的最近距离。
  function distanceToSource(sourceCells, target) {
    let best = Infinity;
    for (const cell of sourceCells) {
      const d = distance(cell, target);
      if (d < best) best = d;
    }
    return best;
  }

  // 射程带。melee=相邻(1..1)；reach X=1..X（延伸武器同样可以攻击相邻目标）；
  // ranged X-Y=X..Y（大部分远程武器无法攻击相邻目标，所以 X 通常 >1）。
  const MELEE = { min: 1, max: 1, kind: "melee", label: "近战（相邻）" };
  const reach = x => ({ min: 1, max: Math.max(1, Number(x) || 1), kind: "reach", label: `延伸 ${x}` });
  const ranged = (x, y) => {
    const min = Math.max(0, Number(x) || 0);
    const max = Math.max(min, Number(y) || min);
    return { min, max, kind: "ranged", label: `远程 ${min}-${max}` };
  };

  // 解析 "相邻" / "近战" / "延伸 2" / "Reach 2" / "远程 3-4" / "Ranged 3-4" / 数字。
  function parseBand(spec) {
    if (spec == null) return MELEE;
    if (typeof spec === "object" && spec.min != null) return spec;
    if (typeof spec === "number") return spec <= 1 ? MELEE : reach(spec);
    const text = String(spec).trim();
    if (/^(相邻|近战|melee)$/i.test(text)) return MELEE;
    const rangedMatch = text.match(/(?:远程|ranged)\s*(\d+)\s*[-–~至]\s*(\d+)/i);
    if (rangedMatch) return ranged(Number(rangedMatch[1]), Number(rangedMatch[2]));
    const reachMatch = text.match(/(?:延伸|reach)\s*(\d+)/i);
    if (reachMatch) return reach(Number(reachMatch[1]));
    const plain = text.match(/^(\d+)\s*[-–~至]\s*(\d+)$/);
    if (plain) return ranged(Number(plain[1]), Number(plain[2]));
    const single = text.match(/^(\d+)$/);
    if (single) return Number(single[1]) <= 1 ? MELEE : reach(Number(single[1]));
    return MELEE;
  }

  const inBand = (band, d) => d >= band.min && d <= band.max;

  // 全版图射程图。射程只看曼哈顿距离，不看地形也不看视线。
  function computeRangeMap(sourceCells, spec) {
    const source = normalizeCells(sourceCells);
    const band = parseBand(spec);
    const grid = {};
    const inRange = [];
    for (let row = 1; row <= ROWS; row += 1) {
      for (let column = 1; column <= COLUMNS; column += 1) {
        const target = { row, column };
        const hit = source.length ? inBand(band, distanceToSource(source, target)) : false;
        grid[cellKey(column, row)] = hit;
        if (hit) inRange.push(target);
      }
    }
    return { grid, visible: inRange, inRange, band };
  }

  // 攻击合规 = 在射程内 且 有 LoS（P57：没有到目标的 LoS 就无法执行一次攻击）。
  function canAttack(sourceCells, target, occ, spec, options) {
    const source = normalizeCells(sourceCells);
    const goal = normalizeCell(target);
    if (!source.length || !goal) return false;
    const band = parseBand(spec);
    if (!inBand(band, distanceToSource(source, goal))) return false;
    return hasLos(source, goal, occ, options);
  }

  // 射程与视线的交集，保留给需要攻击合规判定的旧脚本/其他模块。
  function computeAttackMap(sourceCells, occ, spec, options) {
    const source = normalizeCells(sourceCells);
    const los = computeLosMap(source, occ, options);
    const range = computeRangeMap(source, spec);
    const grid = {};
    const attackable = [];
    for (let row = 1; row <= ROWS; row += 1) {
      for (let column = 1; column <= COLUMNS; column += 1) {
        const key = cellKey(column, row);
        const hit = Boolean(los.grid[key] && range.grid[key]);
        grid[key] = hit;
        if (hit) attackable.push({ row, column });
      }
    }
    return { grid, attackable, los, range, band: range.band };
  }

  return {
    COLUMNS,
    ROWS,
    cellKey,
    inBoard,
    buildOccluders,
    cornersOf,
    hasLos,
    computeLosMap,
    distance,
    distanceToSource,
    bands: { MELEE, reach, ranged },
    parseBand,
    inBand,
    computeRangeMap,
    canAttack,
    computeAttackMap,
  };
});
