/* 巨兽之腹 · 起始位置打标工具
 * 编辑逻辑 1:1 复刻 aibp app.js 的“编辑地形模式”（conflictBoardEditor / moveConflictTerrain /
 * rotateConflictTerrain / startConflictTerrainDrag）。区别：这里所有 placement（含骑士/怪物/编号
 * 初始位）都可编辑，而 aibp 里初始位只读。
 */
(function () {
  "use strict";

  const ROWS = 10, COLS = 14;
  const ASSET_BASE = "../KF_Unified_Assistant/public";
  const STORAGE_KEY = "kf-devour-terrain-editor-v4";
  const DEFAULTS = window.KF_BELLY_BOARD_DATA;
  const ASSET_MAP = window.KF_CONFLICT_BOARD_DATA?.assets || {};
  // 随机朝向表（对齐 aibp）：N=固定，R=四向随机，K=随机 180/270。
  const RANDOM_ORIENTATIONS = window.KF_CONFLICT_BOARD_DATA?.randomOrientations || { R: [0, 90, 180, 270], K: [180, 270] };
  const ORIENTATION_OPTIONS = [
    { value: "N", label: "固定（按当前旋转）" },
    { value: "R", label: "随机 · 四向 (R)" },
    { value: "K", label: "随机 · 180/270 (K)" },
  ];

  const $ = id => document.getElementById(id);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

  let data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || JSON.parse(JSON.stringify(DEFAULTS));
  let selectedId = "";
  let showCoords = false;

  /* ---------- 资源解析（对齐 aibp conflictAssetSrc） ---------- */
  function assetSrc(asset) {
    const value = String(asset || "");
    const source = ASSET_MAP[value] || (value.includes("/") ? value.replace(/^\/+/, "") : "");
    if (!source) return "";
    if (/^(?:[a-z]+:|\/)/i.test(source)) return ASSET_BASE + source;
    return `${ASSET_BASE}/assets/${source.replace(/^assets\//, "")}`;
  }

  function terrainLabel(asset) {
    return String(asset || "地形").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/(\D)(\d+)/g, "$1 $2");
  }

  const cardinalFacing = value => Math.round((((Number(value) || 0) % 360 + 360) % 360) / 90) % 4 * 90;
  const facingClass = value => `facing-${cardinalFacing(value)}`;
  const mobClass = value => (Number.isInteger(Number(value)) && value >= 1 && value <= 10 ? `mob-${value}` : "");
  const cellRef = (row, column) => `${String.fromCharCode(64 + row)}${column}`;

  // 下拉按 label 归并：一组一条，编辑写入整组（共用一套摆放）。
  function currentLabel() {
    return $("layoutSelect").value;
  }
  function currentLayout() {
    const layouts = data.layouts || [];
    return layouts.find(layout => layout.label === currentLabel()) || layouts[0];
  }
  function groupMembers(layout = currentLayout()) {
    return (data.layouts || []).filter(item => item.label === layout.label);
  }
  // 把代表布局的摆放深拷贝到同组其它布局，实现整组强制统一。
  function syncGroup() {
    const rep = currentLayout();
    groupMembers(rep).forEach(layout => {
      if (layout !== rep) layout.placements = JSON.parse(JSON.stringify(rep.placements));
    });
  }

  /* ---------- 几何（对齐 aibp conflictTerrainGeometry / snap / move / rotate） ---------- */
  function geometry(placement) {
    const rowSpan = placement.rowEnd - placement.rowStart + 1;
    const columnSpan = placement.columnEnd - placement.columnStart + 1;
    const quarterTurn = Math.abs(Number(placement.rotation || 0)) % 180 === 90;
    return {
      rowSpan, columnSpan,
      centerRow: (placement.rowStart + placement.rowEnd) / 2,
      centerColumn: (placement.columnStart + placement.columnEnd) / 2,
      artRowSpan: quarterTurn ? columnSpan : rowSpan,
      artColumnSpan: quarterTurn ? rowSpan : columnSpan,
    };
  }

  function snap(value, span, maximum) {
    const offset = span % 2 === 0 ? .5 : 0;
    const snapped = Math.round(Number(value) - offset) + offset;
    return clamp(snapped, (span + 1) / 2, maximum - (span - 1) / 2);
  }

  function moveTo(placement, targetRow, targetColumn) {
    const rowSpan = placement.rowEnd - placement.rowStart + 1;
    const columnSpan = placement.columnEnd - placement.columnStart + 1;
    const centerRow = snap(targetRow, rowSpan, ROWS);
    const centerColumn = snap(targetColumn, columnSpan, COLS);
    const rowStart = Math.round(centerRow - (rowSpan - 1) / 2);
    const columnStart = Math.round(centerColumn - (columnSpan - 1) / 2);
    return { ...placement, rowStart, rowEnd: rowStart + rowSpan - 1, columnStart, columnEnd: columnStart + columnSpan - 1 };
  }

  function rotate(placement, delta) {
    const geo = geometry(placement);
    const rotated = {
      ...placement,
      rowEnd: placement.rowStart + geo.columnSpan - 1,
      columnEnd: placement.columnStart + geo.rowSpan - 1,
      rotation: ((placement.rotation || 0) + delta + 360) % 360,
    };
    return moveTo(rotated, geo.centerRow, geo.centerColumn);
  }

  /* ---------- 渲染（对齐 aibp conflictTerrainPlacementHtml / start 渲染） ---------- */
  function placementHtml(placement, selected) {
    const geo = geometry(placement);
    if (placement.kind === "terrain") {
      const src = assetSrc(placement.asset);
      return `<button type="button" class="terrain-control-placement ${selected ? "selected" : ""}" data-id="${esc(placement.id)}"
        aria-label="${esc(terrainLabel(placement.asset))}" title="${esc(terrainLabel(placement.asset))}"
        style="left:${(geo.centerColumn - .5) / COLS * 100}%;top:${(geo.centerRow - .5) / ROWS * 100}%;width:${geo.artColumnSpan / COLS * 100}%;height:${geo.artRowSpan / ROWS * 100}%;transform:translate(-50%,-50%) rotate(${placement.rotation || 0}deg);--terrain-layer:${placement.layer || 10}">
        <img src="${esc(src)}" alt="" style="transform:scaleX(${placement.flipped ? -1 : 1})">
      </button>`;
    }
    // 初始位（骑士 / 怪物 / 编号）——渲染为 token，但同样可选中/拖动/旋转。
    const rotation = placement.rotation || 0;
    const arrow = ["knight", "monster"].includes(placement.kind)
      ? `<span class="terrain-start-arrow ${facingClass(rotation)}" aria-hidden="true">▲</span>` : "";
    let inner;
    if (placement.kind === "knight") {
      inner = `<img src="${esc(assetSrc(placement.asset))}" alt="">${arrow}`;
    } else if (placement.kind === "number") {
      inner = `<img class="terrain-control-number-image" src="${esc(assetSrc(placement.asset))}" alt="${esc(placement.asset)}">`;
    } else {
      inner = `${arrow}${esc(terrainLabel(placement.asset))}`;
    }
    return `<button type="button" class="terrain-control-start ${placement.kind} ${selected ? "selected" : ""}" data-id="${esc(placement.id)}"
      aria-label="${esc(terrainLabel(placement.asset))}" title="${esc(terrainLabel(placement.asset))}"
      style="left:${(placement.columnStart - 1) / COLS * 100}%;top:${(placement.rowStart - 1) / ROWS * 100}%;width:${geo.columnSpan / COLS * 100}%;height:${geo.rowSpan / ROWS * 100}%">
      <i class="${mobClass(placement.number)}">${inner}</i>
    </button>`;
  }

  function gridHtml() {
    let cells = "";
    for (let row = 1; row <= ROWS; row++) {
      for (let column = 1; column <= COLS; column++) {
        cells += `<span>${showCoords ? `<b>${cellRef(row, column)}</b>` : ""}</span>`;
      }
    }
    return cells;
  }

  function boardCropStyle() {
    const board = data.board;
    const crop = board?.crop;
    if (!board || !crop) return "";
    return `--board-image-width:${board.width / crop.width * 100}%;--board-image-height:${board.height / crop.height * 100}%;--board-image-left:${-crop.x / crop.width * 100}%;--board-image-top:${-crop.y / crop.height * 100}%`;
  }

  /* ---------- 选中面板 ---------- */
  function selectionPanel() {
    const layout = currentLayout();
    const placement = layout.placements.find(item => item.id === selectedId);
    ["rotLeft", "rotRight", "flip", "del"].forEach(id => { $(id).disabled = !placement; });
    if (placement) $("flip").classList.toggle("active", Boolean(placement.flipped));
    if (!placement) {
      $("selection").innerHTML = '<span class="empty">点击版图上的对象进行编辑。</span>';
      return;
    }
    const orientation = placement.orientation || "N";
    const isRandom = Array.isArray(RANDOM_ORIENTATIONS[orientation]);
    $("selection").innerHTML = `<strong>${esc(terrainLabel(placement.asset))}</strong>
      <span>${esc(placement.kind)} · 第 ${placement.columnStart} 列 · ${cellRef(placement.rowStart, placement.columnStart)} · ${placement.rotation || 0}°${placement.flipped ? " · 反面" : ""}${isRandom ? " · 随机朝向" : ""}</span>
      <div class="row">
        <label>起始行<input id="r1" type="number" min="1" max="${ROWS}" value="${placement.rowStart}"></label>
        <label>起始列<input id="c1" type="number" min="1" max="${COLS}" value="${placement.columnStart}"></label>
        <label>结束行<input id="r2" type="number" min="1" max="${ROWS}" value="${placement.rowEnd}"></label>
        <label>结束列<input id="c2" type="number" min="1" max="${COLS}" value="${placement.columnEnd}"></label>
      </div>
      <label style="display:grid;gap:4px;font-size:11px">朝向模式
        <select id="orientSel">${ORIENTATION_OPTIONS.map(option => `<option value="${option.value}"${option.value === orientation ? " selected" : ""}>${esc(option.label)}</option>`).join("")}</select>
      </label>
      ${isRandom ? `<button id="rerollOne" class="button" style="margin-top:2px">🎲 重掷此对象朝向</button>` : ""}`;
    $("orientSel").onchange = event => editSelected(item => {
      const next = { ...item, orientation: event.target.value };
      if (Array.isArray(RANDOM_ORIENTATIONS[next.orientation])) next.rotation = rerollOrientation(next);
      return next;
    });
    if (isRandom) $("rerollOne").onclick = () => editSelected(item => ({ ...item, rotation: rerollOrientation(item) }));
    ["r1", "c1", "r2", "c2"].forEach(id => {
      $(id).onchange = event => editSelected(item => {
        const value = clamp(event.target.value, 1, id[0] === "r" ? ROWS : COLS);
        const next = { ...item };
        if (id === "r1") next.rowStart = Math.min(value, next.rowEnd);
        if (id === "r2") next.rowEnd = Math.max(value, next.rowStart);
        if (id === "c1") next.columnStart = Math.min(value, next.columnEnd);
        if (id === "c2") next.columnEnd = Math.max(value, next.columnStart);
        return next;
      });
    });
  }

  /* ---------- 编辑 + 同步（对齐 aibp editSelectedTerrain，同步逻辑按 id） ---------- */
  function editSelected(transform) {
    const layout = currentLayout();
    const index = layout.placements.findIndex(item => item.id === selectedId);
    if (index < 0) return;
    const next = transform({ ...layout.placements[index] });
    layout.placements[index] = next;
    syncGroup();
    render();
  }

  /* ---------- 拖动（对齐 aibp startConflictTerrainDrag） ---------- */
  function startDrag(event) {
    if (event.button !== undefined && event.button !== 0) return;
    const node = event.currentTarget;
    const boardNode = $("board");
    const placement = currentLayout().placements.find(item => item.id === node.dataset.id);
    if (!placement) return;
    selectedId = placement.id;
    let preview = { ...placement };
    let moved = false;

    const move = pointerEvent => {
      const rect = boardNode.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const column = clamp(Math.floor((pointerEvent.clientX - rect.left) / rect.width * COLS) + 1, 1, COLS);
      const row = clamp(Math.floor((pointerEvent.clientY - rect.top) / rect.height * ROWS) + 1, 1, ROWS);
      const next = moveTo({ ...placement }, row, column);
      if (next.rowStart === preview.rowStart && next.columnStart === preview.columnStart) return;
      preview = next;
      const geo = geometry(preview);
      if (placement.kind === "terrain") {
        node.style.left = `${(geo.centerColumn - .5) / COLS * 100}%`;
        node.style.top = `${(geo.centerRow - .5) / ROWS * 100}%`;
      } else {
        node.style.left = `${(preview.columnStart - 1) / COLS * 100}%`;
        node.style.top = `${(preview.rowStart - 1) / ROWS * 100}%`;
      }
      moved = true;
      pointerEvent.preventDefault();
    };
    const finish = pointerEvent => {
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", finish);
      node.removeEventListener("pointercancel", finish);
      node.classList.remove("dragging");
      if (node.hasPointerCapture?.(pointerEvent.pointerId)) node.releasePointerCapture(pointerEvent.pointerId);
      if (moved) editSelected(() => preview);
      else render();
    };

    node.classList.add("dragging");
    node.setPointerCapture?.(event.pointerId);
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", finish);
    node.addEventListener("pointercancel", finish);
  }

  /* ---------- 随机朝向重掷（对齐 aibp 重置地图时的 resolvedOrientations 逻辑） ---------- */
  function rerollOrientation(placement) {
    const choices = RANDOM_ORIENTATIONS[placement.orientation];
    if (!Array.isArray(choices) || !choices.length) return placement.rotation || 0;
    return choices[Math.floor(Math.random() * choices.length)];
  }

  // 重掷当前布局里所有随机朝向对象。sync 开启时同步到同 ID 对象。
  function rerollLayout() {
    const layout = currentLayout();
    let count = 0;
    layout.placements.forEach(placement => {
      if (!Array.isArray(RANDOM_ORIENTATIONS[placement.orientation])) return;
      placement.rotation = rerollOrientation(placement);
      count++;
    });
    syncGroup();
    render();
    return count;
  }

  /* ---------- 新增对象 ---------- */
  function assetCatalog() {
    const map = new Map();
    (data.layouts || []).forEach(layout => (layout.placements || []).forEach(placement => {
      if (placement.kind === "terrain" && !map.has(placement.asset)) map.set(placement.asset, placement);
    }));
    return [...map.values()].sort((a, b) => a.asset.localeCompare(b.asset));
  }

  function addTerrain() {
    const asset = $("assetSelect").value;
    const template = assetCatalog().find(item => item.asset === asset);
    if (!template) return;
    const rowSpan = template.rowEnd - template.rowStart + 1;
    const columnSpan = template.columnEnd - template.columnStart + 1;
    const id = `terrain-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const placement = moveTo({ id, kind: "terrain", asset, rowStart: 1, rowEnd: rowSpan, columnStart: 1, columnEnd: columnSpan, ref: "", orientation: "N", rotation: template.rotation ?? 0, flipped: false, layer: 10 }, 5, 7);
    currentLayout().placements.push(placement);
    selectedId = id;
    syncGroup();
    render();
  }

  /* ---------- 主渲染 ---------- */
  function render() {
    const layout = currentLayout();
    if (!layout.placements.some(item => item.id === selectedId)) selectedId = "";
    const members = groupMembers(layout);
    const monsters = members.map(item => item.monsterId).filter(Boolean).join("、");
    $("layoutMeta").innerHTML = `<strong>${esc(layout.label)}</strong><br>怪物：${esc(monsters || layout.monsterId)}<br>${esc(layout.notes || "")}<br><small>${layout.placements.length} 个对象 · 共用于 ${members.length} 个布局（整组统一）</small>`;
    $("boardImage").src = assetSrc(data.board?.asset);
    $("board").setAttribute("style", boardCropStyle());
    $("grid").innerHTML = gridHtml();
    $("placements").innerHTML = layout.placements.map(item => placementHtml(item, item.id === selectedId)).join("");
    $("toggleCoords").textContent = showCoords ? "隐藏格子位置" : "显示格子位置";
    $("toggleCoords").classList.toggle("active", showCoords);
    $("placements").querySelectorAll("[data-id]").forEach(node => {
      node.addEventListener("pointerdown", startDrag);
      node.addEventListener("click", event => {
        event.stopPropagation();
        selectedId = selectedId === node.dataset.id ? "" : node.dataset.id;
        render();
      });
    });
    selectionPanel();
    $("jsonPreview").value = JSON.stringify(data, null, 2);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  /* ---------- 事件绑定 ---------- */
  $("board").addEventListener("click", event => {
    if (event.target.closest("[data-id]")) return;
    if (!selectedId) return;
    const rect = $("board").getBoundingClientRect();
    const column = clamp(Math.floor((event.clientX - rect.left) / rect.width * COLS) + 1, 1, COLS);
    const row = clamp(Math.floor((event.clientY - rect.top) / rect.height * ROWS) + 1, 1, ROWS);
    editSelected(placement => moveTo(placement, row, column));
  });
  $("layoutSelect").onchange = () => { selectedId = ""; render(); };
  $("rotLeft").onclick = () => editSelected(placement => rotate(placement, -90));
  $("rotRight").onclick = () => editSelected(placement => rotate(placement, 90));
  $("flip").onclick = () => editSelected(placement => ({ ...placement, flipped: !placement.flipped }));
  $("del").onclick = () => {
    const layout = currentLayout();
    layout.placements = layout.placements.filter(item => item.id !== selectedId);
    selectedId = "";
    syncGroup();
    render();
  };
  $("toggleCoords").onclick = () => { showCoords = !showCoords; render(); };
  $("rerollAll").onclick = () => { const count = rerollLayout(); if (!count) alert("当前布局没有标记为随机朝向（R/K）的对象。"); };
  $("addTerrain").onclick = addTerrain;
  $("resetBtn").onclick = () => { if (confirm("恢复默认布局？")) { data = JSON.parse(JSON.stringify(DEFAULTS)); selectedId = ""; init(); } };
  $("exportBtn").onclick = () => {
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    anchor.download = "belly-board-custom.json";
    anchor.click();
  };
  $("importBtn").onclick = () => $("fileInput").click();
  $("fileInput").onchange = event => {
    const reader = new FileReader();
    reader.onload = () => { try { data = JSON.parse(reader.result); selectedId = ""; init(); } catch (error) { alert("JSON 解析失败：" + error.message); } };
    reader.readAsText(event.target.files[0]);
  };

  function init() {
    const seen = new Set();
    $("layoutSelect").innerHTML = (data.layouts || []).filter(layout => {
      if (seen.has(layout.label)) return false;
      seen.add(layout.label);
      return true;
    }).map(layout => {
      const count = groupMembers(layout).length;
      return `<option value="${esc(layout.label)}">${esc(layout.label)}${count > 1 ? `（${count} 布局共用）` : ""}</option>`;
    }).join("");
    $("assetSelect").innerHTML = assetCatalog().map(item => `<option value="${esc(item.asset)}">${esc(terrainLabel(item.asset))}</option>`).join("");
    render();
  }

  init();
})();
