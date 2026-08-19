/*
 * 叠加层渲染接线测试。跑法：node tests/kf-overlay-render.test.cjs
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(dir, "app.js"), "utf8").replace(/\r\n/g, "\n");

function extract(name) {
  const start = source.indexOf(`\n  function ${name}(`);
  assert.notEqual(start, -1, `app.js 里应存在 ${name}`);
  const end = source.indexOf("\n  }\n", start);
  assert.notEqual(end, -1, `${name} 应有闭合`);
  return source.slice(start, end + 4);
}

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

context.esc = value => String(value == null ? "" : value)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
context.conflictTerrainLabel = asset => `〈${asset}〉`;
context.foolCardById = () => null;
context.overlayPlacementMode = "";
vm.runInContext([
  "conflictGridCellRef",
  "conflictOverlayCellLabel",
  "conflictOverlayFacingLabel",
  "conflictOverlayPathDetailsHtml",
  "conflictOverlayMarkerHtml",
  "conflictOverlayMarkersHtml",
  "conflictOverlayToolsHtml",
  "conflictGridHtml",
].map(extract).join("\n"), context, { filename: "app.js#extract" });

const OV = context.window.KF_OVERLAY;
const gridSpans = html => html.match(/<span[^>]*>.*?<\/span>/g) || [];
const spanAt = (html, column, row) => gridSpans(html)[(row - 1) * 14 + (column - 1)];
const markers = html => html.match(/<i class="kf-ov-marker[^>]*>/g) || [];
const markerLayer = overlay => context.conflictOverlayMarkersHtml(overlay);
const classCount = (html, cls) => gridSpans(html).filter(span => {
  const match = span.match(/class="([^"]*)"/);
  return match && match[1].split(/\s+/).includes(cls);
}).length;

const pillar = { id: "t1", kind: "terrain", asset: "Column", rowStart: 5, rowEnd: 5, columnStart: 5, columnEnd: 5, rotation: 0 };
const boss = { id: "m1", kind: "monster", asset: "Eggknight", rowStart: 1, rowEnd: 2, columnStart: 1, columnEnd: 2, rotation: 0 };
const layout = { placements: [pillar, boss] };
const makeBoard = overlay => ({ terrain: [pillar], resolvedOrientations: {}, overlay, knightAssignments: [], mobAssignments: [] });
const overlayFor = boardState => OV.computeOverlay(boardState, layout.placements);

// ---- 网格结构不被叠加层破坏 ----------------------------------------------
{
  const boardState = makeBoard(null);
  const plain = context.conflictGridHtml(boardState, null);
  assert.equal(gridSpans(plain).length, 140, "网格应始终是 140 个 span");
  assert.equal(/kf-ov-/.test(plain), false, "没有叠加层时不应出现 kf-ov- 类名");
  assert.equal(gridSpans(context.conflictGridHtml(boardState)).length, 140);
}

// ---- Boss 模式按当前 Boss 足迹，骑士模式 1 格 -----------------------------
{
  const boardState = makeBoard({ sourceCell: { row: 5, column: 7 }, los: true });
  const html = context.conflictGridHtml(boardState, overlayFor(boardState));
  assert.ok(spanAt(html, 7, 5).includes("kf-ov-source"), "(7,5) 应标为视线起点");
  assert.ok(spanAt(html, 8, 6).includes("kf-ov-source"), "(8,6) 应属于 Boss 2×2 足迹");
  assert.equal(classCount(html, "kf-ov-source"), 4, "Boss 起点应按 2×2 足迹展开");
  assert.ok(spanAt(html, 7, 5).includes('class="kf-ov-distance">0</b>'), "Boss 足迹格应显示距离 0");
  assert.ok(spanAt(html, 9, 7).includes('class="kf-ov-distance">2</b>'), "每格应显示到 Boss 足迹的最小正交距离");
  assert.equal(gridSpans(html).length, 140, "圆圈不应成为网格子元素");
  assert.ok(markers(markerLayer(overlayFor(boardState))).some(item => item.includes("kf-ov-marker-source") && item.includes("left:") && item.includes("top:") && item.includes("width:") && item.includes("height:") && !item.includes("grid-column")),
    "Boss 起点应画一个跨 2×2 实际足迹的大圆");
  assert.equal(/kf-ov-(range|attack|front|rear)/.test(html), false, "kfboss 视线叠加层不应画射程/朝向类");

  const knightState = makeBoard({ sourceCell: { row: 5, column: 7 }, sourceMode: "knight", los: true });
  const knightHtml = context.conflictGridHtml(knightState, overlayFor(knightState));
  assert.equal(classCount(knightHtml, "kf-ov-source"), 1, "骑士模式应只有 1 格起点");
  assert.ok(spanAt(knightHtml, 9, 6).includes('class="kf-ov-distance">3</b>'), "骑士模式每格应显示到骑士的正交距离");
  assert.ok(markers(markerLayer(overlayFor(knightState))).some(item => item.includes("kf-ov-marker-source") && item.includes("width:") && item.includes("height:") && !item.includes("grid-column")), "骑士模式起点圆圈应只占 1 格");
  assert.equal(spanAt(knightHtml, 8, 5).includes("kf-ov-source"), false);
}

// ---- 遮挡类名与计算结果逐格一致 ------------------------------------------
{
  const terrain = [[3, 6], [4, 6], [5, 6], [5, 7], [7, 7], [8, 6]].map(([row, column], i) => ({
    id: `p${i}`, kind: "terrain", asset: "Column",
    rowStart: row, rowEnd: row, columnStart: column, columnEnd: column, rotation: 180,
  }));
  const sourceCell = { row: 4, column: 2 };
  const boardState = { terrain, resolvedOrientations: {}, overlay: { sourceCell, los: true }, knightAssignments: [], mobAssignments: [] };
  const ov = OV.computeOverlay(boardState, []);
  const html = context.conflictGridHtml(boardState, ov);
  let mismatches = 0;
  for (let row = 1; row <= 10; row += 1) {
    for (let column = 1; column <= 14; column += 1) {
      const expected = ov.classesAt(column, row).includes("kf-ov-blocked");
      if (spanAt(html, column, row).includes("kf-ov-blocked") !== expected) mismatches += 1;
    }
  }
  assert.equal(mismatches, 0, "每一格的遮挡类名都应与计算结果一致");
  assert.ok(spanAt(html, 2, 4).includes("kf-ov-source"), "起点格应进入网格");
}

// ---- 目标寻路类名进入网格 ------------------------------------------------
{
  const boardState = makeBoard({ sourceCell: { row: 5, column: 5 }, targetCell: { row: 2, column: 8 }, sourceMode: "knight", los: false, path: true });
  const html = context.conflictGridHtml(boardState, overlayFor(boardState));
  assert.ok(spanAt(html, 8, 3).includes("kf-ov-path-a"), "路线 A 应有独立颜色");
  assert.ok(spanAt(html, 7, 2).includes("kf-ov-path-b"), "路线 B 应有独立颜色");
  assert.ok(spanAt(html, 7, 3).includes("kf-ov-path-overlap"), "A/B 重叠部分应有第三种颜色");
  assert.ok(spanAt(html, 8, 2).includes("kf-ov-target"), "目标格应标为目标");
  assert.ok(markers(markerLayer(overlayFor(boardState))).some(item => item.includes("kf-ov-marker-target") && item.includes("left:") && item.includes("top:") && item.includes("width:") && item.includes("height:") && !item.includes("grid-column")),
    "骑士目标应画 1 格圆圈");
  assert.ok(markers(markerLayer(overlayFor(boardState))).some(item => item.includes("kf-ov-marker-final-a") && item.includes("kf-ov-marker-facing-0")),
    "路线 A 的 Boss 最终位置应有大圆和朝向");
  assert.ok(markers(markerLayer(overlayFor(boardState))).some(item => item.includes("kf-ov-marker-final-b") && item.includes("kf-ov-marker-facing-90")),
    "路线 B 的 Boss 最终位置应有大圆和朝向");
  assert.equal(spanAt(html, 8, 5).includes("kf-ov-path"), false, "不在最短路径上的可走格不应被标为可达");
  assert.equal(spanAt(html, 5, 5).includes("kf-ov-path"), false, "障碍格不应进入路径");
}

// ---- 叠加层与愚者牌、坐标共存 --------------------------------------------
{
  context.foolCardById = () => ({ spaces: ["A1"] });
  const boardState = makeBoard({ sourceCell: { row: 5, column: 7 }, los: true });
  const html = context.conflictGridHtml(boardState, overlayFor(boardState));
  assert.ok(spanAt(html, 1, 10).includes("fool-highlight"), "愚者牌高亮应仍在");
  assert.ok(html.includes('aria-label="愚者牌格位 A1"'), "愚者牌的 aria-label 不应被叠加层挤掉");
  context.foolCardById = () => null;

  const coordinateHtml = context.conflictGridHtml({ ...boardState, showCoordinates: true }, overlayFor(boardState));
  assert.ok(spanAt(coordinateHtml, 7, 5).includes("<b"), "开坐标时起点格里也要有标签");
  assert.ok(spanAt(coordinateHtml, 7, 5).includes("kf-ov-source"), "标签不应顶掉叠加类名");
}

// ---- 控件反映当前设置 ----------------------------------------------------
{
  const boardState = makeBoard({ sourceCell: { row: 5, column: 7 }, targetCell: { row: 7, column: 9 }, los: true, path: true, move: 6, range: true, bandId: "ranged2-4" });
  const tools = context.conflictOverlayToolsHtml(boardState, layout, overlayFor(boardState));
  assert.ok(tools.includes("7列F行"), "应显示当前棋盘格起点");
  assert.ok(tools.includes("9列D行"), "应显示当前棋盘格目标");
  assert.ok(tools.includes("Boss 2×2"), "Boss 模式应显示当前 Boss 大小");
  assert.ok(tools.includes("骑士 1×1"), "应能切换骑士模式");
  assert.ok(tools.includes('data-overlay-clear'), "应有清除起点按钮");
  assert.ok(tools.includes('data-overlay-clear-target'), "应有清除目标按钮");
  assert.ok(tools.includes('data-overlay-layer="los"'), "应有遮挡层按钮");
  assert.ok(tools.includes('data-overlay-layer="path"'), "应有寻路层按钮");
  assert.ok(tools.includes('data-overlay-mode="boss"'), "应有 Boss 模式按钮");
  assert.ok(tools.includes('data-overlay-mode="knight"'), "应有骑士模式按钮");
  assert.equal(tools.includes('data-overlay-move'), false, "目标寻路不应再显示可达范围移动输入");
  assert.ok(tools.includes("路线 <b>"), "开寻路层且有目标时应显示路线统计");
  assert.ok(tools.includes("步数 <b>"), "开寻路层且有目标时应显示路径步数");
  assert.ok(tools.includes("A终点 <b>"), "开寻路层且有目标时应显示 Boss 最终位置");
  assert.ok(tools.includes("A朝向 <b>"), "开寻路层且有目标时应显示 Boss 最终朝向");
  assert.equal(tools.includes("data-overlay-source"), false, "不应再有固定视点下拉");
  assert.equal(tools.includes("data-overlay-band"), false, "不应再有射程带下拉");
  assert.equal(tools.includes("射程"), false, "控制面板不应显示射程");
  assert.equal(tools.includes("可攻击"), false, "控制面板不应显示可攻击统计");
}

// ---- 寻路期间不能误点地形 -----------------------------------------------
{
  assert.match(source, /if \(overlayPlacementMode\) \{[\s\S]+sourceCell: \{ row, column \}, targetCell: null/,
    "Boss 或骑士只应在选中放置工具后落到棋盘上");
  assert.match(source, /if \(boardState\.overlay\.path\) \{\s+selectedTerrainId = "";\s+overlayPlacementMode = "";/,
    "开启寻路时应关闭 Boss/骑士放置模式");
  assert.match(source, /updateConflictOverlay\(\{ sourceMode, path: false, targetCell: null \}\)/,
    "开启 Boss/骑士放置时应关闭寻路并清除旧目标");
  assert.match(source, /if \(!settings\.path\) \{\s+if \(selectedTerrainId\) return editSelectedTerrain[\s\S]+return;\s+\}/,
    "未开启寻路也未选地形时，点击空格不应改变版图状态");
  assert.match(source, /if \(selectedTerrainId && selectedTerrainId !== button\.dataset\.terrainId\) return;/,
    "选中地形后点击其它地形应穿透到棋盘移动逻辑");
  assert.match(source, /function startConflictTerrainDrag\(event\)/,
    "地形应支持指针拖拽");
  assert.match(source, /addEventListener\('pointerdown', startConflictTerrainDrag\)/,
    "地形节点应接入拖拽处理");
  assert.match(fs.readFileSync(path.join(dir, "styles.css"), "utf8"), /terrain-control-placement\.dragging/,
    "拖拽中的地形应有可见状态");
  assert.match(source, /if \(!settings\.sourceCell\) return;\s+updateConflictOverlay\(\{ targetCell: \{ row, column \} \}\);/,
    "寻路开启但未放置起点时，点击空格也不应自动放置模型");
  assert.doesNotMatch(source, /targetCell: \{ row, column \}, path: true/,
    "点击棋盘不应自动开启寻路");
  assert.match(source, /if \(boardState\.overlay\.path\) \{\s+selectedTerrainId = "";/,
    "开启寻路时应取消当前地形选择");
  assert.match(fs.readFileSync(path.join(dir, "styles.css"), "utf8"), /terrain-control-placement\.path-active \{ pointer-events: none; \}/,
    "寻路期间地形覆盖物应让出棋盘点击");
}
{
  const boardState = makeBoard({ sourceCell: null });
  const tools = context.conflictOverlayToolsHtml(boardState, layout, overlayFor(boardState));
  assert.ok(tools.includes("起点：未设置") || tools.includes("未设置"), "无起点时应显示未设置状态");
  assert.ok(/data-overlay-clear[^>]*disabled/.test(tools), "无起点时清除按钮应禁用");
  assert.ok(/data-overlay-clear-target[^>]*disabled/.test(tools), "无目标时清除目标按钮应禁用");
}

// ---- CSS 与模块接线 ------------------------------------------------------
{
  const css = fs.readFileSync(path.join(dir, "styles.css"), "utf8");
  for (const cls of ["kf-ov-source", "kf-ov-target", "kf-ov-blocked", "kf-ov-path"]) {
    assert.ok(css.includes(`.terrain-control-grid span.${cls}`), `styles.css 应有 .${cls} 的网格样式`);
    assert.ok(css.includes(`.overlay-legend span.${cls}`), `styles.css 应有 .${cls} 的图例样式`);
  }
  for (const cls of ["kf-ov-path-a", "kf-ov-path-b", "kf-ov-path-overlap"]) {
    assert.ok(css.includes(`.terrain-control-grid span.${cls}`), `styles.css 应有 .${cls} 的网格样式`);
  }
  for (const cls of ["kf-ov-marker-source", "kf-ov-marker-target", "kf-ov-marker-final-a", "kf-ov-marker-final-b", "kf-ov-marker-facing-0"]) {
    assert.ok(css.includes(`.terrain-control-board .${cls}`), `styles.css 应有 .${cls} 的 marker 样式`);
  }
  assert.ok(css.includes(".overlay-origin-row"), "styles.css 应有起点行样式");
  assert.ok(css.includes('[data-overlay-layer="path"].active'), "开启寻路时按钮应有专用高对比状态色");
  assert.ok(css.includes('[data-overlay-layer="los"].active'), "开启遮挡时按钮应有专用高对比状态色");
  assert.ok(css.includes('[data-overlay-mode="boss"].active'), "Boss 放置模式应有开启状态色");
  assert.ok(css.includes('[data-overlay-mode="knight"].active'), "骑士放置模式应有开启状态色");
  const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
  assert.ok(html.includes("kf-overlay.js"), "index.html 应引入 kf-overlay.js");
  assert.ok(html.indexOf("kf-los.js") < html.indexOf("kf-overlay.js"), "kf-los 应先于 kf-overlay");
  assert.ok(html.indexOf("kf-overlay.js") < html.indexOf("module-bridge.js"), "叠加层模块应先于 app 载入");
}

// ---- 第二屏也要画同一套叠加层 --------------------------------------------
{
  const displayDir = path.join(dir, "../display");
  const displaySource = fs.readFileSync(path.join(displayDir, "app.js"), "utf8").replace(/\r\n/g, "\n");
  const displayHtml = fs.readFileSync(path.join(displayDir, "index.html"), "utf8");
  const displayCss = fs.readFileSync(path.join(displayDir, "styles.css"), "utf8");
  for (const file of ["kf-los.js", "kf-overlay.js", "terrain-keywords.js"]) {
    assert.ok(displayHtml.includes(file), `display/index.html 应引入 ${file}`);
  }
  assert.ok(displaySource.includes("KF_OVERLAY?.computeOverlay"), "display 应计算叠加层");
  assert.ok(/conflictGridHtml\(boardState\s*,\s*overlay\)/.test(displaySource), "display 应把叠加层传进网格");
  for (const cls of ["kf-ov-source", "kf-ov-target", "kf-ov-blocked", "kf-ov-path"]) {
    assert.ok(displayCss.includes(`.conflict-grid span.${cls}`), `display/styles.css 应有 .${cls}`);
  }
  for (const cls of ["kf-ov-path-a", "kf-ov-path-b", "kf-ov-path-overlap"]) {
    assert.ok(displayCss.includes(`.conflict-grid span.${cls}`), `display/styles.css 应有 .${cls}`);
  }
  for (const cls of ["kf-ov-marker-source", "kf-ov-marker-target", "kf-ov-marker-final-a", "kf-ov-marker-final-b", "kf-ov-marker-facing-0"]) {
    assert.ok(displayCss.includes(`.conflict-board .${cls}`), `display/styles.css 应有 .${cls}`);
  }
  const start = displaySource.indexOf("\n  function conflictGridHtml(");
  const body = displaySource.slice(start, displaySource.indexOf("\n  }\n", start) + 4);
  const cellRefStart = displaySource.indexOf("\n  function conflictGridCellRef(");
  const cellRef = displaySource.slice(cellRefStart, displaySource.indexOf("\n  }\n", cellRefStart) + 4);
  const markerHtmlStart = displaySource.indexOf("\n  function conflictOverlayMarkerHtml(");
  const markerHtml = displaySource.slice(markerHtmlStart, displaySource.indexOf("\n  }\n", markerHtmlStart) + 4);
  const markersHtmlStart = displaySource.indexOf("\n  function conflictOverlayMarkersHtml(");
  const markersHtml = displaySource.slice(markersHtmlStart, displaySource.indexOf("\n  }\n", markersHtmlStart) + 4);
  vm.runInContext(`${cellRef}\n${markerHtml}\n${markersHtml}\n${body.replace("conflictGridHtml", "displayConflictGridHtml")}`, context, { filename: "display/app.js#extract" });
  const boardState = makeBoard({ sourceCell: { row: 5, column: 7 }, targetCell: { row: 3, column: 7 }, sourceMode: "knight", los: true, path: true });
  const ov = overlayFor(boardState);
  const mine = context.conflictGridHtml(boardState, ov);
  const theirs = context.displayConflictGridHtml(boardState, ov);
  const classesOf = html => gridSpans(html).map(span => (span.match(/class="([^"]*)"/) || ["", ""])[1]);
  assert.equal(classesOf(theirs).join("|"), classesOf(mine).join("|"),
    "第二屏与主屏的每格类名必须逐格一致");
}

console.log("kf-overlay-render.test.cjs 全部通过");
