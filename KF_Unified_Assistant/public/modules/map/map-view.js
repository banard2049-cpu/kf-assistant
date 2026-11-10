(() => {
  "use strict";
  const monsterLabel = value => window.KFMonsterLabels?.name(value) ?? (typeof value === "string" ? value : value?.name || value?.id || "");
  const monsterRank = value => window.KFMonsterLabels?.rank(value) ?? "";

  const TTS_CARD_HEIGHT = 3.06;
  const TOKEN_SLOTS = [
    [12.5, 12.5], [37.5, 12.5], [62.5, 12.5], [87.5, 12.5],
    [12.5, 87.5], [37.5, 87.5], [62.5, 87.5], [87.5, 87.5],
    [12.5, 37.5], [12.5, 62.5], [87.5, 37.5], [87.5, 62.5],
    [37.5, 37.5], [62.5, 37.5], [37.5, 62.5], [62.5, 62.5]
  ];
  // Overlay marker diameter in map units (a tile edge is 2–8 units).
  const MARKER_TOKEN_UNITS = .62;
  // Path markers that snap onto a passage between two tiles; shortcuts link distant tiles instead.
  const PASSAGE_MARKER_TYPES = Object.freeze(["armored", "triple-armored", "fog", "blocked"]);
  const CLUES = Object.freeze([
    ["martial", "武艺", "/assets/tokens/红-token.png?v=1"],
    ["errant", "游侠", "/assets/tokens/绿-token.png?v=1"],
    ["historic", "历史", "/assets/tokens/黄-token.png?v=1"],
    ["mystic", "神秘", "/assets/tokens/蓝-token.png?v=1"]
  ]);
  const HERO_IDS = Object.freeze([
    "stoneface", "fleischritter", "renholder", "ser-sonch", "paracelsa", "ser-ubar", "kara",
    "bartos", "caelia", "helse", "fabio", "bianca", "murmur", "ralof", "vratlada"
  ]);
  const HERO_NAMES_ZH = Object.freeze({
    stoneface: "石面", fleischritter: "血肉骑士", renholder: "伦霍尔德", "ser-sonch": "桑奇爵士",
    paracelsa: "帕拉塞尔萨", "ser-ubar": "乌巴爵士", kara: "卡拉",
    bartos: "巴尔托什", caelia: "凯莉娅", helse: "赫尔塞", fabio: "法比奥",
    bianca: "比安卡", murmur: "穆尔穆", ralof: "拉福尔", vratlada: "芙拉特兰姬"
  });
  const PATH_MARKERS = new Map([
    ["armored", "单联装甲门"], ["triple-armored", "三联装甲门"],
    ["fog", "弥雾"], ["blocked", "其他阻挡"], ["shortcut", "已解锁捷径"]
  ]);
  const TILE_MARKERS = new Map([
    ...CLUES.map(([id, name]) => [id, `${name}线索`]),
    ["surge", "涌水标记"], ["flood", "洪水标记"], ["rubble", "瓦砾"],
    ["generic", "通用标记"]
  ]);
  const KINGDOM_PANEL_ZONES = Object.freeze({
    SK: {
      active: { x: 72.5, y: 50, width: 31 },
      monsterSlots: {
        drowned: { x: 14.6, y: 80.9, width: 9.4 },
        marsh: { x: 25.7, y: 64, width: 9.4 },
        mud: { x: 36.3, y: 82.1, width: 9.4 }
      }
    },
    POS: {
      active: { x: 72.5, y: 50, width: 31 },
      monsterSlots: {
        noble: { x: 14, y: 64.5, width: 9.4 },
        craftsman: { x: 31, y: 63.3, width: 9.4 },
        merchant: { x: 20.2, y: 82.5, width: 9.4 },
        port: { x: 38.1, y: 80.8, width: 9.4 }
      }
    }
  });

  const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const record = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const list = value => Array.isArray(value) ? value : [];
  const asset = (source, base = "") => {
    const value = String(source || "");
    if (!value || /^(?:[a-z]+:|\/)/i.test(value)) return value;
    return `${base}${value}`;
  };
  const tileLabel = item => item ? `${item.size === "EXTRA" ? "支线" : item.size}-${item.number}` : "未知";
  const tileSize = item => {
    const height = TTS_CARD_HEIGHT * (Number(item.scale) || 1);
    return { width: height * (Number(item.image?.aspect) || .6657), height };
  };
  const ttsAngle = item => (((Number(item.rotation) || 180) - 180 + 540) % 360) - 180;
  const pathKey = (left, right) => [left, right].sort().join("|");
  // Aligned layout: exact shared rectangles and the artwork's rectification mesh.
  const mapLayout = () => globalThis.KF_MAP_LAYOUT || null;
  const alignedTile = item => {
    const aligned = mapLayout()?.tiles?.[item?.id];
    return aligned && Number.isFinite(aligned.x) && Number.isFinite(aligned.y) && aligned.width > 0 && aligned.height > 0
      ? aligned : null;
  };
  // Centre and unrotated size in map units; the aligned layout wins over the raw TTS transform.
  const tileGeometry = item => {
    const aligned = alignedTile(item);
    if (aligned) return { x: aligned.x, y: aligned.y, width: aligned.width, height: aligned.height };
    const size = tileSize(item);
    return { x: item.x, y: item.y, width: size.width, height: size.height };
  };

  // Saved percentages refer to the source artwork. Keep markers attached to that
  // artwork after rectification, and invert the same mesh when a marker is dropped.
  function tileWarpPoint(box, point, inverse = false) {
    const mesh = box?.warp;
    if (!mesh) return { x: clamp(point.x, 0, 100), y: clamp(point.y, 0, 100) };
    const x = clamp(point.x, 0, 100) / 100;
    const y = clamp(point.y, 0, 100) / 100;
    const columns = mesh.x.length;
    const interpolate = (points, weights) => ({
      x: points.reduce((sum, p, i) => sum + p[0] * weights[i], 0) * 100,
      y: points.reduce((sum, p, i) => sum + p[1] * weights[i], 0) * 100
    });
    for (let row = 0; row < mesh.y.length - 1; row++) {
      if (!inverse && (y < mesh.y[row] || y > mesh.y[row + 1])) continue;
      for (let col = 0; col < columns - 1; col++) {
        if (!inverse && (x < mesh.x[col] || x > mesh.x[col + 1])) continue;
        const source = [[mesh.x[col], mesh.y[row]], [mesh.x[col + 1], mesh.y[row]],
          [mesh.x[col], mesh.y[row + 1]], [mesh.x[col + 1], mesh.y[row + 1]]];
        const target = [mesh.points[row * columns + col], mesh.points[row * columns + col + 1],
          mesh.points[(row + 1) * columns + col], mesh.points[(row + 1) * columns + col + 1]];
        for (const indices of [[0, 1, 3], [0, 3, 2]]) {
          const from = indices.map(i => (inverse ? target : source)[i]);
          const [a, b, c] = from;
          const denominator = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
          const wa = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / denominator;
          const wb = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / denominator;
          const weights = [wa, wb, 1 - wa - wb];
          if (weights.every(value => value >= -1e-8)) {
            return interpolate(indices.map(i => (inverse ? source : target)[i]), weights);
          }
        }
      }
    }
    return { x: x * 100, y: y * 100 };
  }

  function openTileLinks(origin, markers) {
    if (!origin) return [];
    const linked = new Set(list(origin.neighbors));
    for (const marker of markers) {
      if (marker.type !== "shortcut" || !marker.to) continue;
      if (marker.from === origin.id) linked.add(marker.to);
      if (marker.to === origin.id) linked.add(marker.from);
    }
    return [...linked].filter(tileId => !markers.some(marker =>
      marker.to && pathKey(marker.from, marker.to) === pathKey(origin.id, tileId) && marker.type !== "shortcut"
    ));
  }

  function legalTileIds(state, data) {
    const current = record(state.maps?.[state.kingdom]);
    const origin = list(data.maps?.[state.kingdom]?.tiles).find(item => item.id === current.current);
    return openTileLinks(origin, list(current.pathMarkers)).filter(tileId =>
      list(current.placed).includes(tileId) && current.tileState?.[tileId] !== "explored"
    );
  }

  function markerSource(type, data) {
    if (type === "fog") return "/assets/tokens/httpssteamusercontentaakamaihdnetugc107925210701773996ECA849F992C7EA67C78D97A03A7992F61BD241B.png";
    const clue = CLUES.find(([id]) => id === type);
    return clue?.[2] || data.tokens?.markers?.[type] || data.tokens?.markers?.generic || "";
  }

  function markerLabel(marker) {
    if (marker?.type === "custom") return [...String(marker.text || "").trim()].slice(0, 12).join("") || "自定义标记";
    return TILE_MARKERS.get(marker?.type) || marker?.type || "板块标记";
  }

  function savedTokenPosition(item, kind, tileId) {
    const value = kind === "path" ? item?.positions?.[tileId] : item?.position;
    if (!Number.isFinite(value?.x) || !Number.isFinite(value?.y)) return null;
    return { x: clamp(value.x, 0, 100), y: clamp(value.y, 0, 100) };
  }

  function mapToken(source, label, item, kind, tileId, index, assetBase, interactive, box) {
    const position = savedTokenPosition(item, kind, tileId);
    const fallback = TOKEN_SLOTS[index % TOKEN_SLOTS.length];
    const x = position?.x ?? fallback[0];
    const y = position?.y ?? fallback[1];
    const display = tileWarpPoint(box, { x, y });
    const data = interactive
      ? `draggable="false" data-map-token="${esc(item.id)}" data-token-kind="${kind}" data-token-tile="${esc(tileId)}" data-token-x="${x}" data-token-y="${y}"`
      : `aria-hidden="true" data-display-token-kind="${kind}"`;
    if (kind === "tile" && item.type === "custom") {
      return `<span class="map-token custom-map-token" title="${esc(label)}" style="left:${display.x}%;top:${display.y}%" ${data}>${esc(label)}</span>`;
    }
    return source
      ? `<img class="token-icon map-token" src="${esc(asset(source, assetBase))}" alt="${esc(label)}" title="${esc(label)}" style="left:${display.x}%;top:${display.y}%" ${data}>`
      : "";
  }

  function partyIdentity(state, party, mainlineKnight) {
    const members = list(party);
    const selected = mainlineKnight || list(state.knights).find(knight => knight.id === state.mainKnightId && knight.memberType !== "squire") || null;
    const member = selected
      ? members.find(item => item.id === selected.sheetId || item.sheetId === selected.sheetId || item.name === selected.name)
      : members.find(item => item.type !== "squire") || members[0] || null;
    const knight = selected || list(state.knights).find(item =>
      item.sheetId === member?.id || item.sheetId === member?.sheetId || (!item.sheetId && item.name === member?.name)
    ) || list(state.knights)[0];
    return { member, knight, name: member?.name || knight?.name || "当前队伍" };
  }

  function heroIdFromName(value) {
    const normalized = String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return HERO_IDS.find(id => id.replace(/[^a-z0-9]/g, "") === normalized) || "";
  }

  function knightDisplayName(knight) {
    const id = knight?.heroId || (knight?.memberType === "squire" ? knight?.squireId : knight?.knightId) || heroIdFromName(knight?.name);
    if (HERO_NAMES_ZH[id]) return HERO_NAMES_ZH[id];
    const name = String(knight?.name || "").split("·")[0].replace(/\s*（侍从）\s*$/, "").trim();
    return /[\u3400-\u9fff]/.test(name) ? name : "骑士";
  }

  function partyMarker(tileId, state, current, options, box) {
    const { member, knight, name } = partyIdentity(state, options.party, options.mainlineKnight);
    const memberPortraitId = member?.type === "squire" ? member.squireId : member?.knightId;
    const knightPortraitId = knight?.heroId || (knight?.memberType === "squire" ? knight?.squireId : knight?.knightId);
    const portraitId = memberPortraitId || knightPortraitId || heroIdFromName(name);
    const { x, y, defaultCorner } = partyPosition(current, box);
    const display = tileWarpPoint(box, { x, y });
    const attrs = options.interactive === false
      ? `aria-label="当前队伍：${esc(name)}"`
      : `aria-label="当前队伍：${esc(name)}" title="当前队伍：${esc(name)}（可拖动）" data-map-token="party" data-token-kind="party" data-token-tile="${esc(tileId)}" data-token-x="${x}" data-token-y="${y}"`;
    return `<span class="party-location-token${defaultCorner ? " default-corner" : ""}" role="img" ${attrs} style="left:${display.x}%;top:${display.y}%">
      ${portraitId
        ? `<img src="/assets/heroes/${esc(portraitId)}-avatar.jpg?v=story-1" alt="" draggable="false">`
        : `<span class="party-location-fallback" aria-hidden="true">${esc(name.slice(0, 1) || "?")}</span>`}
    </span>`;
  }

  function partyPosition(current, box) {
    const saved = current.partyPositions?.[box.item.id];
    if (!Number.isFinite(saved?.x) && !Number.isFinite(saved?.y)) {
      const corner = worldToTileLocal(box, {
        x: box.x - box.halfWidth / 2,
        y: box.y + box.halfHeight / 2
      });
      return { ...corner, defaultCorner: true };
    }
    return {
      x: Number.isFinite(saved?.x) ? clamp(saved.x, 0, 100) : 50,
      y: Number.isFinite(saved?.y) ? clamp(saved.y, 0, 100) : 50
    };
  }

  // World geometry of the visible map: every tile's centre, size and rotated half extents in map
  // units, plus the stage window. Rendering and marker hit-testing share it so they always agree.
  function stageGeometry(state, data) {
    const current = record(state.maps?.[state.kingdom]);
    const kingdom = record(data.maps?.[state.kingdom]);
    const all = list(kingdom.tiles).filter(item => Number.isFinite(item.x) && Number.isFinite(item.y));
    const placed = new Set(list(current.placed));
    const shown = all.filter(item => current.showAll || placed.has(item.id));
    const geometrySource = current.showAll ? all : shown;
    if (!geometrySource.length) return null;
    const boxes = new Map(all.map(item => {
      const geometry = tileGeometry(item);
      const angle = ttsAngle(item);
      const radians = angle * Math.PI / 180;
      const face = current.showAll || (current.tileState?.[item.id] || "hidden") !== "hidden";
      return [item.id, {
        item, ...geometry, angle,
        warp: face ? alignedTile(item)?.warp : null,
        halfWidth: Math.abs(Math.cos(radians)) * geometry.width / 2 + Math.abs(Math.sin(radians)) * geometry.height / 2,
        halfHeight: Math.abs(Math.sin(radians)) * geometry.width / 2 + Math.abs(Math.cos(radians)) * geometry.height / 2
      }];
    }));
    const extent = geometrySource.map(item => boxes.get(item.id));
    const pad = 1.2;
    const minX = Math.min(...extent.map(box => box.x - box.halfWidth)) - pad;
    const maxX = Math.max(...extent.map(box => box.x + box.halfWidth)) + pad;
    const minY = Math.min(...extent.map(box => box.y - box.halfHeight)) - pad;
    const maxY = Math.max(...extent.map(box => box.y + box.halfHeight)) + pad;
    return { current, all, shown, boxes, minX, minY, worldWidth: maxX - minX, worldHeight: maxY - minY };
  }

  // Tile-local percentages (the rotated tile's own frame, as tokens have always been stored)
  // to world units and back.
  function tileLocalToWorld(box, point) {
    const display = tileWarpPoint(box, point);
    const dx = (display.x / 100 - .5) * box.width;
    const dy = (display.y / 100 - .5) * box.height;
    const radians = box.angle * Math.PI / 180;
    return {
      x: box.x + dx * Math.cos(radians) - dy * Math.sin(radians),
      y: box.y + dx * Math.sin(radians) + dy * Math.cos(radians)
    };
  }

  function worldToTileLocal(box, point) {
    const dx = point.x - box.x;
    const dy = point.y - box.y;
    const radians = box.angle * Math.PI / 180;
    const localX = dx * Math.cos(radians) + dy * Math.sin(radians);
    const localY = -dx * Math.sin(radians) + dy * Math.cos(radians);
    const source = tileWarpPoint(box, { x: (localX / box.width + .5) * 100, y: (localY / box.height + .5) * 100 }, true);
    return { x: Number(source.x.toFixed(2)), y: Number(source.y.toFixed(2)) };
  }

  function tileAtWorld(geometry, point) {
    if (!geometry) return null;
    return geometry.shown.map(item => geometry.boxes.get(item.id)).find(box =>
      Math.abs(point.x - box.x) <= box.halfWidth && Math.abs(point.y - box.y) <= box.halfHeight
    ) || null;
  }

  function boxesTouch(left, right, tolerance = .25) {
    const gapX = Math.max(left.x - left.halfWidth, right.x - right.halfWidth) - Math.min(left.x + left.halfWidth, right.x + right.halfWidth);
    const gapY = Math.max(left.y - left.halfHeight, right.y - right.halfHeight) - Math.min(left.y + left.halfHeight, right.y + right.halfHeight);
    return (Math.abs(gapX) <= tolerance && gapY <= -.25) || (Math.abs(gapY) <= tolerance && gapX <= -.25);
  }

  // Where the path between two tiles crosses their shared edge. Aligned data gives the printed
  // exit; otherwise the middle of the shared edge of two touching tiles.
  function passagePoint(geometry, a, b) {
    const left = geometry?.boxes.get(a);
    const right = geometry?.boxes.get(b);
    if (!left || !right) return null;
    const aligned = alignedTile(left.item) && alignedTile(right.item)
      ? list(mapLayout()?.passages).find(passage => pathKey(passage.a, passage.b) === pathKey(a, b))
      : null;
    if (aligned) return { x: aligned.x, y: aligned.y, axis: aligned.axis };
    if (!boxesTouch(left, right)) return null;
    const gapX = Math.max(left.x - left.halfWidth, right.x - right.halfWidth) - Math.min(left.x + left.halfWidth, right.x + right.halfWidth);
    const gapY = Math.max(left.y - left.halfHeight, right.y - right.halfHeight) - Math.min(left.y + left.halfHeight, right.y + right.halfHeight);
    if (gapX > gapY) {
      const [west, east] = left.x < right.x ? [left, right] : [right, left];
      const top = Math.max(left.y - left.halfHeight, right.y - right.halfHeight);
      const bottom = Math.min(left.y + left.halfHeight, right.y + right.halfHeight);
      return { x: (west.x + west.halfWidth + east.x - east.halfWidth) / 2, y: (top + bottom) / 2, axis: "v", estimated: true };
    }
    const [north, south] = left.y < right.y ? [left, right] : [right, left];
    const west = Math.max(left.x - left.halfWidth, right.x - right.halfWidth);
    const east = Math.min(left.x + left.halfWidth, right.x + right.halfWidth);
    return { x: (west + east) / 2, y: (north.y + north.halfHeight + south.y - south.halfHeight) / 2, axis: "h", estimated: true };
  }

  // Passages a path marker can snap to: path-connected pairs of tiles that are both on the map.
  function mapPassages(state, data, geometry = stageGeometry(state, data)) {
    if (!geometry) return [];
    const shown = new Set(geometry.shown.map(item => item.id));
    const seen = new Set();
    const passages = [];
    for (const item of geometry.shown) {
      for (const neighbor of list(item.neighbors)) {
        const key = pathKey(item.id, neighbor);
        if (!shown.has(neighbor) || seen.has(key)) continue;
        seen.add(key);
        const point = passagePoint(geometry, item.id, neighbor);
        if (point) passages.push({ a: item.id, b: neighbor, ...point });
      }
    }
    return passages;
  }

  function nearestPassage(passages, point, maxDistance = .9) {
    let best = null;
    for (const passage of list(passages)) {
      const distance = Math.hypot(passage.x - point.x, passage.y - point.y);
      if (distance <= maxDistance && (!best || distance < best.distance)) best = { ...passage, distance };
    }
    return best;
  }

  // World position of a map marker: bound path markers sit on their passage, everything else is
  // stored in its tile's local frame (legacy unbound path markers keep their per-tile position).
  function markerWorldPosition(geometry, marker, kind, index = 0) {
    if (kind === "path" && marker.to) {
      const passage = passagePoint(geometry, marker.from, marker.to);
      if (passage) return passage;
      const from = geometry.boxes.get(marker.from);
      const to = geometry.boxes.get(marker.to);
      if (from && to) return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    }
    const tileId = kind === "path" ? marker.from : marker.tileId;
    const box = geometry.boxes.get(tileId);
    if (!box) return null;
    const saved = savedTokenPosition(marker, kind, tileId);
    const fallback = TOKEN_SLOTS[index % TOKEN_SLOTS.length];
    return tileLocalToWorld(box, saved || { x: fallback[0], y: fallback[1] });
  }

  function renderMarkerLayer(geometry, data, options, now) {
    const current = geometry.current;
    const shown = new Set(geometry.shown.map(item => item.id));
    const interactive = options.interactive !== false;
    const toStage = point => ({
      left: (point.x - geometry.minX) / geometry.worldWidth * 100,
      top: (point.y - geometry.minY) / geometry.worldHeight * 100
    });
    const size = MARKER_TOKEN_UNITS / geometry.worldWidth * 100;
    const perTile = new Map();
    const entries = [];
    for (const marker of list(current.tileMarkers)) {
      if (!shown.has(marker.tileId)) continue;
      const index = perTile.get(marker.tileId) || 0;
      perTile.set(marker.tileId, index + 1);
      entries.push({ marker, kind: "tile", index, label: markerLabel(marker) });
    }
    for (const marker of list(current.pathMarkers)) {
      if (!shown.has(marker.from) || (marker.to && !shown.has(marker.to))) continue;
      const index = perTile.get(marker.from) || 0;
      perTile.set(marker.from, index + 1);
      entries.push({ marker, kind: "path", index, label: PATH_MARKERS.get(marker.type) || marker.type });
    }
    const tokens = entries.map(({ marker, kind, index, label }) => {
      const point = markerWorldPosition(geometry, marker, kind, index);
      if (!point) return "";
      const { left, top } = toStage(point);
      const arrival = kind === "path"
        ? Math.max(mapMotion.arrivals.get(marker.from) ?? -Infinity, mapMotion.arrivals.get(marker.to) ?? -Infinity)
        : mapMotion.arrivals.get(marker.tileId) ?? -Infinity;
      const emerging = Number.isFinite(arrival) ? " emerging-from-fog" : "";
      const delay = emerging ? `;--arrival-delay:${arrival - now}ms` : "";
      const style = `left:${left}%;top:${top}%;--marker-size:${size}%${delay}`;
      const attrs = interactive
        ? `draggable="false" data-map-marker="${esc(marker.id)}" data-marker-kind="${kind}" data-marker-type="${esc(marker.type)}" title="${esc(label)}（可拖动，拖回右侧标记栏即删除）"`
        : `aria-hidden="true" data-display-marker-kind="${kind}"`;
      const bound = kind === "path" && marker.to ? " on-passage" : "";
      if (kind === "tile" && marker.type === "custom") {
        return `<span class="map-marker-token custom-marker-token${emerging}" style="${style}" ${attrs}>${esc(label)}</span>`;
      }
      const source = markerSource(marker.type, data);
      return source
        ? `<img class="map-marker-token${bound}${emerging}" src="${esc(asset(source, options.assetBase))}" alt="${esc(label)}" style="${style}" ${attrs}>`
        : "";
    }).join("");
    return `<div class="map-marker-layer${interactive ? "" : " read-only"}">${tokens}</div>`;
  }

  const mapMotion = {
    kingdom: null, showAll: false, placed: new Set(), hidden: new Set(),
    arrivals: new Map(), reveals: new Map(), partyTile: null, partyPoint: null, partyLinks: [], travel: null
  };
  const TILE_ARRIVAL_MS = 2300;
  const TILE_REVEAL_MS = 2400;
  const TILE_FLIP_MS = TILE_REVEAL_MS * .36; // map-flip-back finishes at 36%.
  const PARTY_TRAVEL_MS = 700;
  // Hold the token on the tile it came from until the destination fog has mostly
  // cleared, so the party walks in on a readable tile instead of mid-dissolve.
  const PARTY_AFTER_FOG = .5;
  let partyView = null;

  function partyMotionRemaining() {
    if (!partyView?.stage.isConnected || !window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return 0;
    const travelEnd = (mapMotion.travel?.started ?? -Infinity) + PARTY_TRAVEL_MS;
    const revealEnd = (mapMotion.reveals.get(mapMotion.partyTile) ?? -Infinity) + TILE_REVEAL_MS;
    const neighbors = list(partyView.geometry.boxes.get(mapMotion.partyTile)?.item.neighbors);
    const placementEnd = Math.max(...neighbors.map(id => (mapMotion.arrivals.get(id) ?? -Infinity) + TILE_ARRIVAL_MS));
    return Math.max(0, Math.max(travelEnd, revealEnd, placementEnd) - Date.now());
  }

  function displayedPartyPoint() {
    if (!partyView?.stage.isConnected || !partyView.token) return null;
    const { stage, geometry, token, traveler } = partyView;
    const travelerStyle = traveler?.isConnected ? getComputedStyle(traveler) : null;
    const inTransit = travelerStyle?.visibility === "visible";
    const marker = (inTransit ? traveler : token).getBoundingClientRect();
    const map = stage.getBoundingClientRect();
    if (!map.width || !map.height) return null;
    return {
      x: geometry.minX + (marker.left + marker.width / 2 - map.left) / map.width * geometry.worldWidth,
      y: geometry.minY + (marker.top + marker.height / 2 - map.top) / map.height * geometry.worldHeight,
      opacity: inTransit ? Number(travelerStyle.opacity) : 1
    };
  }

  function updateMapMotion(kingdom, geometry, now) {
    const { current, boxes } = geometry;
    const placed = new Set(list(current.placed));
    const hidden = new Set([...placed].filter(id => (current.tileState?.[id] || "hidden") === "hidden"));
    const partyTile = current.current;
    const box = current.showAll || placed.has(partyTile) ? boxes.get(partyTile) : null;
    const partyPoint = box ? tileLocalToWorld(box, partyPosition(current, box)) : null;
    const partyLinks = openTileLinks(box?.item, list(current.pathMarkers));
    const newMap = mapMotion.kingdom !== kingdom || (partyView && !partyView.stage.isConnected);
    const animateTiles = !newMap && !current.showAll && !mapMotion.showAll;

    if (animateTiles) {
      for (const id of mapMotion.hidden) {
        if (placed.has(id) && !hidden.has(id)) mapMotion.reveals.set(id, now);
      }
      for (const [id, start] of mapMotion.reveals) {
        if (!placed.has(id) || hidden.has(id) || now - start >= TILE_REVEAL_MS) mapMotion.reveals.delete(id);
      }
    } else {
      mapMotion.arrivals.clear();
      mapMotion.reveals.clear();
    }
    if (newMap) {
      mapMotion.travel = null;
    } else if (mapMotion.partyTile !== partyTile) {
      const originVisible = current.showAll || placed.has(mapMotion.partyTile);
      // Check the links at departure, before a tile reveal can add printed doors.
      // A freshly revealed tile holds the token back until its fog has cleared;
      // backtracking onto an already known tile has no reveal entry and moves at once.
      const reveal = mapMotion.reveals.get(partyTile);
      const fogWait = reveal === undefined ? 0 : Math.max(0, reveal + TILE_REVEAL_MS * PARTY_AFTER_FOG - now);
      mapMotion.travel = partyPoint && mapMotion.partyPoint && originVisible
        ? { from: displayedPartyPoint() || mapMotion.partyPoint, glide: mapMotion.partyLinks.includes(partyTile), started: now + fogWait }
        : null;
    }
    if (animateTiles) {
      const partyArrival = Math.max(now, (mapMotion.travel?.started ?? -Infinity) + PARTY_TRAVEL_MS);
      const partyNeighbors = list(box?.item.neighbors);
      for (const id of hidden) {
        if (mapMotion.placed.has(id)) continue;
        let start = partyNeighbors.includes(id) ? partyArrival : now;
        for (const [source, reveal] of mapMotion.reveals) {
          if (list(boxes.get(source)?.item.neighbors).includes(id)) start = Math.max(start, reveal + TILE_FLIP_MS);
        }
        mapMotion.arrivals.set(id, start);
      }
    }
    for (const [id, start] of mapMotion.arrivals) {
      if (!hidden.has(id) || now - start >= TILE_ARRIVAL_MS) mapMotion.arrivals.delete(id);
    }
    if (!partyPoint || (mapMotion.travel && now - mapMotion.travel.started >= PARTY_TRAVEL_MS)) mapMotion.travel = null;
    Object.assign(mapMotion, { kingdom, showAll: Boolean(current.showAll), placed, hidden, partyTile, partyPoint, partyLinks });
  }

  function tileEdgeCoverage(box, neighbors) {
    const left = box.x - box.halfWidth, right = box.x + box.halfWidth;
    const top = box.y - box.halfHeight, bottom = box.y + box.halfHeight;
    const width = right - left, height = bottom - top;
    const coverage = { left: [], right: [], top: [], bottom: [] };
    const edgeTolerance = 1e-5;
    for (const other of neighbors) {
      if (other === box) continue;
      const west = other.x - other.halfWidth, east = other.x + other.halfWidth;
      const north = other.y - other.halfHeight, south = other.y + other.halfHeight;
      const x = [Math.max(0, (west - left) / width), Math.min(1, (east - left) / width)];
      const y = [Math.max(0, (north - top) / height), Math.min(1, (south - top) / height)];
      if (y[0] < y[1]) {
        if (Math.abs(left - east) <= edgeTolerance) coverage.left.push(y);
        if (Math.abs(right - west) <= edgeTolerance) coverage.right.push(y);
      }
      if (x[0] < x[1]) {
        if (Math.abs(top - south) <= edgeTolerance) coverage.top.push(x);
        if (Math.abs(bottom - north) <= edgeTolerance) coverage.bottom.push(x);
      }
    }
    return coverage;
  }

  function tileEdgeFogMask(box, neighbors) {
    if (box.angle % 90 !== 0) return "";
    const masks = [];
    const sides = ["top", "right", "bottom", "left"];
    const turns = (box.angle / 90 + 4) % 4;
    const coverage = tileEdgeCoverage(box, neighbors);
    const depth = "var(--edge-fog-depth)";
    for (const [index, worldSide] of sides.entries()) {
      const localIndex = (index - turns + 4) % 4;
      const side = sides[localIndex];
      const vertical = side === "left" || side === "right";
      const reverse = turns === 2 || turns === (index % 2 === 0 ? 1 : 3);
      const ranges = reverse ? coverage[worldSide].map(([a, b]) => [1 - b, 1 - a]) : coverage[worldSide];
      const addCap = (point, before) => {
        const cap = "var(--edge-fog-cap)";
        const anchor = `${point * 100}${vertical ? "cqh" : "cqw"}`;
        const position = before ? `calc(${anchor} - ${cap})` : anchor;
        const corner = vertical ? `${side} ${before ? "bottom" : "top"}` : `${before ? "right" : "left"} ${side}`;
        const placement = vertical ? `${side} -3px top ${position} / ${depth} ${cap}` : `left ${position} ${side} -3px / ${cap} ${depth}`;
        masks.push(`radial-gradient(ellipse 100% 100% at ${corner}, var(--edge-fog-cap-stops)) ${placement} no-repeat content-box no-clip`);
      };
      let cursor = 0;
      ranges.sort(([a], [b]) => a - b).push([1, 1]);
      for (const [start, end] of ranges) {
        const gap = start - cursor;
        if (gap > 1e-5) {
          // Mask-position percentages refer to the space left over after sizing the mask.
          const offset = cursor === 0 ? "0%" : `${cursor / (1 - gap) * 100}%`;
          const length = `${gap * 100}%`;
          const placement = vertical ? `${side} -3px top ${offset} / ${depth} ${length}` : `left ${offset} ${side} -3px / ${length} ${depth}`;
          masks.push(`linear-gradient(to ${sides[(localIndex + 2) % 4]}, var(--edge-fog-stops)) ${placement} no-repeat content-box no-clip`);
          if (cursor > 1e-5) addCap(cursor, true);
          if (start < 1 - 1e-5) addCap(start, false);
        }
        cursor = Math.max(cursor, end);
      }
    }
    return masks.join(",");
  }

  function renderMapStage(options = {}) {
    const state = record(options.state);
    const data = record(options.data);
    const geometry = stageGeometry(state, data);
    if (!geometry) {
      mapMotion.kingdom = null;
      return "";
    }
    const { current, shown, minX, minY, worldWidth, worldHeight } = geometry;
    const now = Date.now();
    updateMapMotion(state.kingdom, geometry, now);
    const partyDelay = mapMotion.travel ? `;--party-delay:${mapMotion.travel.started - now}ms` : "";
    const legal = new Set(Array.isArray(options.legalTileIds) ? options.legalTileIds : legalTileIds(state, data));
    const randomHighlights = new Set(list(current.randomTileHighlights));
    const interactive = options.interactive !== false;
    const visibleBoxes = shown.map(item => geometry.boxes.get(item.id));
    const fogClouds = [];
    const cards = shown.map(item => {
      const box = geometry.boxes.get(item.id);
      const arrival = mapMotion.arrivals.get(item.id);
      const arrivalDelay = arrival === undefined ? "" : `;--arrival-delay:${arrival - now}ms`;
      if (arrivalDelay) {
        const left = (box.x - box.halfWidth - minX) / worldWidth * 100;
        const top = (box.y - box.halfHeight - minY) / worldHeight * 100;
        const width = 2 * box.halfWidth / worldWidth * 100;
        const height = 2 * box.halfHeight / worldHeight * 100;
        fogClouds.push(`<div class="map-arrival-fog" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%${arrivalDelay}"></div>`);
      }
      const status = current.tileState?.[item.id] || "hidden";
      const face = current.showAll || status !== "hidden";
      const selected = current.selected === item.id;
      const reveal = mapMotion.reveals.get(item.id);
      const revealDelay = reveal === undefined ? "" : `;--reveal-delay:${reveal - now}ms`;
      const source = (face ? alignedTile(item)?.face : null) || item.image?.[face ? "face" : "back"] || item.image?.face;
      const fogSize = `width:${2 * box.halfWidth / box.width * 100}%;height:${2 * box.halfHeight / box.height * 100}%`;
      // Selection must not change the artwork itself: the outline is the only marker,
      // so the selected tile keeps the same edge fog as every other tile.
      const edgeFogMask = tileEdgeFogMask(box, visibleBoxes);
      const imageClass = edgeFogMask ? "map-tile-image map-edge-fade" : "map-tile-image";
      const imageMask = edgeFogMask ? ` style="--edge-fog-mask:${edgeFogMask}"` : "";
      const monsters = list(current.monsters).filter(marker => marker.tileId === item.id);
      const classes = [
        "map-tile", selected ? "selected" : "", current.current === item.id ? "current" : "",
        legal.has(item.id) && !current.showAll ? "legal" : "", status === "revealed" ? "revealed-unexplored" : "",
        randomHighlights.has(item.id) ? "random-highlight" : "", arrivalDelay ? "emerging-from-fog" : "", interactive ? "" : "read-only"
      ].filter(Boolean).join(" ");
      const angle = box.angle;
      const mapTokens = monsters.map(marker => ({
        record: marker, kind: "monster", source: data.tokens?.monsters?.[marker.monsterId] || "",
        label: monsterLabel(list(data.monsters).find(monster => monster.id === marker.monsterId)) || marker.monsterId
      }));
      const tag = interactive ? "button" : "div";
      const attributes = interactive
        ? `type="button" data-tile="${esc(item.id)}" title="${esc(tileLabel(item))}"`
        : `role="img" aria-label="${esc(tileLabel(item))}"`;
      return `<${tag} class="${classes}" ${attributes} data-map-tile-id="${esc(item.id)}" data-angle="${angle}"
        style="left:${(box.x - box.width / 2 - minX) / worldWidth * 100}%;top:${(box.y - box.height / 2 - minY) / worldHeight * 100}%;width:${box.width / worldWidth * 100}%;height:${box.height / worldHeight * 100}%;transform:rotate(${angle}deg);--counter-rotation:${-angle}deg${arrivalDelay}${revealDelay}">
        <img class="${imageClass}" src="${esc(asset(source, options.assetBase))}" alt="${esc(tileLabel(item))}" draggable="false"${imageMask}>
        ${revealDelay ? `<span class="map-flip-back" aria-hidden="true"><img class="${imageClass}" src="${esc(asset(item.image?.back || item.image?.face, options.assetBase))}" alt="" draggable="false"${imageMask}></span>
          <span class="map-arrival-fog map-reveal-fog" aria-hidden="true" style="${fogSize}"></span>` : ""}
        ${current.current === item.id ? partyMarker(item.id, state, current, options, box) : ""}
        ${mapTokens.map((entry, index) => mapToken(entry.source, entry.label, entry.record, entry.kind, item.id, index, options.assetBase, interactive, box)).join("")}
      </${tag}>`;
    }).join("");
    const fogLayer = fogClouds.length ? `<div class="map-arrival-fog-layer" aria-hidden="true">${fogClouds.join("")}</div>` : "";
    return `<div class="map-stage" style="aspect-ratio:${worldWidth}/${worldHeight};--arrival-duration:${TILE_ARRIVAL_MS}ms;--reveal-duration:${TILE_REVEAL_MS}ms;--party-duration:${PARTY_TRAVEL_MS}ms${partyDelay}">${cards}${fogLayer}${renderMarkerLayer(geometry, data, options, now)}</div>`;
  }

  let activeMapStage = null;
  let mapFogTexture;

  async function bakeMapFogTexture(source) {
    try {
      const image = new Image();
      image.src = source;
      await image.decode();
      await new Promise(resolve => {
        if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(resolve, { timeout: 1500 });
        else window.setTimeout(resolve, 100);
      });

      const canvas = document.createElement("canvas");
      canvas.width = 3600;
      canvas.height = 2400;
      const context = canvas.getContext("2d");
      if (!context) return "";
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", .95));
      canvas.width = 0;
      if (blob?.type !== "image/webp") return "";

      const url = URL.createObjectURL(blob);
      try {
        const texture = new Image();
        texture.src = url;
        await texture.decode();
        return `url("${url}")`;
      } catch {
        URL.revokeObjectURL(url);
      }
    } catch {
      // Keep the CSS background if this browser cannot bake or display WebP.
    }
    return "";
  }

  function applyMapFogTexture(viewport) {
    if (!mapFogTexture) {
      const background = getComputedStyle(viewport).backgroundImage;
      const source = /^url\("([^"]*\/fog-complex\.svg(?:\?[^"]*)?)"\)$/.exec(background)?.[1];
      if (!source) return;
      // Cache the conversion, including a failed attempt, for this page.
      mapFogTexture = bakeMapFogTexture(source);
    }
    mapFogTexture.then(background => {
      if (background && viewport.isConnected) viewport.style.backgroundImage = background;
    });
  }

  function bindPartyTravel(stage, geometry) {
    const token = stage.querySelector(".party-location-token");
    partyView = { stage, geometry, token };
    const travel = mapMotion.travel;
    if (!travel || !token || !window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
    const elapsed = Date.now() - travel.started;
    if (elapsed >= PARTY_TRAVEL_MS) return;

    const { minX, minY, worldWidth, worldHeight, boxes } = geometry;
    const box = boxes.get(mapMotion.partyTile);
    const layer = document.createElement("div");
    layer.className = "map-party-travel-layer";
    layer.setAttribute("aria-hidden", "true");
    const traveler = document.createElement("div");
    traveler.className = "map-party-traveler";
    traveler.classList.toggle("relocating", !travel.glide);
    traveler.style.setProperty("--party-start-opacity", travel.from.opacity ?? 1);
    // Match the destination tile's sizing container while the token crosses tile boundaries.
    traveler.style.width = `${box.width / worldWidth * 100}%`;
    traveler.style.height = `${box.height / worldHeight * 100}%`;
    for (const [key, point] of [["from", travel.from], ["to", mapMotion.partyPoint]]) {
      traveler.style.setProperty(`--party-${key}-x`, `${(point.x - minX) / worldWidth * 100}%`);
      traveler.style.setProperty(`--party-${key}-y`, `${(point.y - minY) / worldHeight * 100}%`);
    }
    const clone = token.cloneNode(true);
    clone.removeAttribute("data-map-token");
    clone.style.left = "50%";
    clone.style.top = "50%";
    traveler.append(clone);
    layer.append(traveler);
    stage.append(layer);
    token.classList.add("party-in-transit");
    partyView.traveler = traveler;
    traveler.addEventListener("animationend", () => {
      token.classList.remove("party-in-transit");
      layer.remove();
    }, { once: true });
  }

  function alignMapFog(viewport, stage, patches) {
    const background = getComputedStyle(viewport);
    const frame = viewport.getBoundingClientRect();
    // The scrollable fog starts at the viewport's padding edge. Use that same
    // origin for each patch so it joins the surrounding texture.
    const originX = frame.left + viewport.clientLeft - viewport.scrollLeft;
    const originY = frame.top + viewport.clientTop - viewport.scrollTop;
    const bounds = Array.from(patches, patch => patch.getBoundingClientRect());
    stage.style.setProperty("--fog-image", background.backgroundImage);
    stage.style.setProperty("--fog-color", background.backgroundColor);
    stage.style.setProperty("--fog-size", background.backgroundSize);
    patches.forEach((patch, index) => {
      patch.style.setProperty("--fog-x", `${originX - bounds[index].left}px`);
      patch.style.setProperty("--fog-y", `${originY - bounds[index].top}px`);
    });
  }

  // Separately clipped images can expose a subpixel fringe at their shared
  // edge. Paint a narrow copy of the edge artwork underneath that fringe;
  // tile geometry, hit areas, marker coordinates and printed exits stay fixed.
  function bindMapStage(stage, geometry) {
    activeMapStage?.dispose();
    activeMapStage = null;
    partyView?.traveler?.parentElement?.remove();
    partyView?.token?.classList.remove("party-in-transit");
    partyView = null;
    if (!stage || !geometry) return;
    const viewport = stage.closest(".map-board, .map-viewport");
    if (viewport) applyMapFogTexture(viewport);
    bindPartyTravel(stage, geometry);
    const nodes = [...stage.querySelectorAll("[data-map-tile-id]")].map(node => ({
      node, box: geometry.boxes.get(node.dataset.mapTileId)
    })).filter(item => item.box);
    const byId = new Map(nodes.map(item => [item.box.item.id, item]));
    const underlay = document.createElement("div");
    underlay.className = "map-seam-underlay";
    underlay.setAttribute("aria-hidden", "true");
    underlay.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:0";
    const seams = list(mapLayout()?.seams).filter(seam => byId.has(seam.a) && byId.has(seam.b)).map(seam => {
      const owner = byId.get(seam.a), other = byId.get(seam.b);
      const strip = document.createElement("div"), art = document.createElement("div");
      strip.style.cssText = "position:absolute;overflow:hidden";
      const arrival = Math.max(mapMotion.arrivals.get(seam.a) ?? -Infinity, mapMotion.arrivals.get(seam.b) ?? -Infinity);
      if (Number.isFinite(arrival)) {
        strip.className = "map-seam-emerging";
        strip.style.setProperty("--arrival-delay", `${arrival - Date.now()}ms`);
      }
      art.style.cssText = "position:absolute;left:0;top:0;transform-origin:0 0;container-type:size";
      const image = owner.node.querySelector(".map-tile-image").cloneNode(false);
      image.classList.replace("map-tile-image", "map-seam-image");
      image.alt = "";
      Object.assign(image.style, { display: "block", width: "100%", height: "100%", maxWidth: "none" });
      art.append(image);
      strip.append(art);
      underlay.append(strip);
      return { ...seam, owner, other, strip, art };
    });
    const fogPatches = stage.querySelectorAll(".map-arrival-fog");
    const fogViewport = fogPatches.length && viewport;
    if (!seams.length && !fogViewport) return;
    if (seams.length) stage.prepend(underlay);
    const update = () => {
      if (!stage.isConnected) return;
      if (fogViewport) alignMapFog(fogViewport, stage, fogPatches);
      if (!seams.length) return;
      const ratio = window.devicePixelRatio || 1;
      const rect = stage.getBoundingClientRect();
      if (!(rect.width > 0 && rect.height > 0)) return;
      const coordinate = value => Math.round(value * 1e7) / 1e7;
      const pixelX = value => Math.round((rect.left + (coordinate(value) - geometry.minX) / geometry.worldWidth * rect.width) * ratio) / ratio - rect.left;
      const pixelY = value => Math.round((rect.top + (coordinate(value) - geometry.minY) / geometry.worldHeight * rect.height) * ratio) / ratio - rect.top;
      const paints = new Map();
      for (const { box } of nodes) {
        if (box.angle % 90 !== 0) continue;
        const width = box.width / geometry.worldWidth * rect.width;
        const height = box.height / geometry.worldHeight * rect.height;
        const nativeWidth = Math.max(1, Math.round(width));
        const nativeHeight = Math.max(1, Math.round(height));
        const radians = box.angle * Math.PI / 180;
        const cosine = Math.round(Math.cos(radians)), sine = Math.round(Math.sin(radians));
        const a = cosine * width / nativeWidth, b = sine * width / nativeWidth;
        const c = -sine * height / nativeHeight, d = cosine * height / nativeHeight;
        const x = (box.x - geometry.minX) / geometry.worldWidth * rect.width - (a * nativeWidth + c * nativeHeight) / 2;
        const y = (box.y - geometry.minY) / geometry.worldHeight * rect.height - (b * nativeWidth + d * nativeHeight) / 2;
        paints.set(box.item.id, { a, b, c, d, x, y, nativeWidth, nativeHeight });
      }
      // GPU clipping can still soften a boundary at fractional Windows display
      // scaling. Back only a narrow shared seam with the same artwork; the
      // visible tile bounds and exits stay fixed. Keep the seam away from the
      // underlay's own clipping edge so that edge cannot create another fringe.
      const bleed = 1 / ratio;
      for (const seam of seams) {
        const p = paints.get(seam.a), a = seam.owner.box, b = seam.other.box;
        if (!p) continue;
        const vertical = seam.axis === "v";
        const left = vertical ? pixelX(a.x + a.halfWidth) - bleed * 3 : pixelX(Math.max(a.x - a.halfWidth, b.x - b.halfWidth));
        const top = vertical ? pixelY(Math.max(a.y - a.halfHeight, b.y - b.halfHeight)) : pixelY(a.y + a.halfHeight) - bleed * 3;
        const width = vertical ? bleed * 6 : pixelX(Math.min(a.x + a.halfWidth, b.x + b.halfWidth)) - left;
        const height = vertical ? pixelY(Math.min(a.y + a.halfHeight, b.y + b.halfHeight)) - top : bleed * 6;
        Object.assign(seam.strip.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
        seam.art.style.width = `${p.nativeWidth}px`;
        seam.art.style.height = `${p.nativeHeight}px`;
        seam.art.style.transform = `matrix(${p.a},${p.b},${p.c},${p.d},${p.x - left + (vertical ? bleed * 4 : 0)},${p.y - top + (vertical ? 0 : bleed * 4)})`;
      }
    };
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    const fogZoomObserver = fogViewport ? new MutationObserver(() => alignMapFog(fogViewport, stage, fogPatches)) : null;
    if (fogViewport) {
      observer.observe(fogViewport);
      fogZoomObserver.observe(fogViewport, { attributes: true, attributeFilter: ["style"] });
    }
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    activeMapStage = { dispose() {
      observer.disconnect();
      fogZoomObserver?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      underlay.remove();
    } };
    update();
  }

  function explorationCardById(data, kingdom, cardId) {
    const rules = record(data.kingdomRules?.[kingdom]);
    return [...list(rules.exploration), ...list(rules.specialExploration)].find(item => item.id === cardId) || null;
  }

  function explorationCardStyle(image, side = "face", assetBase = "") {
    if (!image) return "";
    const crop = image[`${side}Crop`];
    const usesAtlas = Boolean(crop) || side !== "back" || image.uniqueBack === true;
    const metadata = crop || image;
    const columns = usesAtlas ? Math.max(1, Number(metadata.width) || 1) : 1;
    const rows = usesAtlas ? Math.max(1, Number(metadata.height) || 1) : 1;
    const index = usesAtlas ? Math.max(0, Number(metadata.index) || 0) : 0;
    const x = metadata.x ?? (columns > 1 ? (index % columns) / (columns - 1) * 100 : 0);
    const y = metadata.y ?? (rows > 1 ? Math.floor(index / columns) / (rows - 1) * 100 : 0);
    return `--exploration-image:url("${esc(asset(image[side] || image.face, assetBase))}");--exploration-cols:${columns};--exploration-rows:${rows};--exploration-x:${x}%;--exploration-y:${y}%;--exploration-aspect:${Number(metadata.aspect || image.aspect) || .702}`;
  }

  function explorationEffectMarkers(state, data, slotKey, assetBase) {
    const current = record(state.maps?.[state.kingdom]);
    return list(current.exploration?.effectMarkers?.[slotKey]).map((marker, index) => {
      const source = markerSource(marker.type, data);
      if (!source) return "";
      const fallback = TOKEN_SLOTS[index % TOKEN_SLOTS.length];
      const x = Number.isFinite(marker.x) ? clamp(marker.x, 0, 100) : fallback[0];
      const y = Number.isFinite(marker.y) ? clamp(marker.y, 0, 100) : fallback[1];
      return `<img class="display-exploration-marker" src="${esc(asset(source, assetBase))}" alt="" style="left:${x}%;top:${y}%">`;
    }).join("");
  }

  function renderExplorationCard(options = {}) {
    const state = record(options.state);
    const data = record(options.data);
    const item = options.card || explorationCardById(data, state.kingdom, options.cardId);
    if (!item?.image) return "";
    const slotKey = String(options.slotKey || "");
    return `<div class="display-exploration-card" role="img" aria-label="${esc(item.name)}" title="${esc(item.name)}">
      <div class="display-exploration-card-art" style='${explorationCardStyle(item.image, options.side || "face", options.assetBase)}'></div>
      <div class="display-exploration-marker-layer">${slotKey ? explorationEffectMarkers(state, data, slotKey, options.assetBase) : ""}</div>
    </div>`;
  }

  function renderDistrictExplorationCards(options = {}) {
    const state = record(options.state);
    const data = record(options.data);
    const current = record(state.maps?.[state.kingdom]);
    const rules = record(data.kingdomRules?.[state.kingdom]);
    const effects = record(current.exploration?.districtEffects);
    return list(rules.districts).map(district => {
      const item = explorationCardById(data, state.kingdom, effects[district.id]);
      return `<article class="display-district-effect ${item ? "occupied" : "empty"}" data-district="${esc(district.id)}">
        <header><strong>${esc(district.name)}</strong><span>${item ? esc(item.name) : "空卡位"}</span></header>
        ${item ? renderExplorationCard({ state, data, card:item, slotKey:`district:${district.id}`, assetBase:options.assetBase }) : '<div class="display-district-effect-empty">无区域效果</div>'}
      </article>`;
    }).join("");
  }

  function renderKingdomBoard(options = {}) {
    const state = record(options.state);
    const data = record(options.data);
    const current = record(state.maps?.[state.kingdom]);
    const rules = record(data.kingdomRules?.[state.kingdom]);
    const board = rules.panel;
    if (!board) return "";
    const activeCard = explorationCardById(data, state.kingdom, current.exploration?.activeEffect);
    const activeZone = KINGDOM_PANEL_ZONES[state.kingdom]?.active;
    const activeEffect = activeCard && activeZone ? `<figure class="kingdom-active-exploration" style="--active-x:${activeZone.x}%;--active-y:${activeZone.y}%;--active-width:${activeZone.width}%">
      ${renderExplorationCard({ state, data, card:activeCard, slotKey:"active", assetBase:options.assetBase })}
    </figure>` : "";
    const zones = KINGDOM_PANEL_ZONES[state.kingdom]?.monsterSlots || {};
    const wheel = rules.districts ? list(rules.districts).map(district => {
      const monsterId = current.districtWheel?.[district.id];
      const zone = zones[district.id];
      if (!monsterId || !zone) return "";
      const monster = list(data.monsters).find(item => item.id === monsterId);
      const source = data.tokens?.monsters?.[monsterId] || "";
      const level = Math.max(1, Number(current.districtWheelLevels?.[district.id]) || 1);
      const location = String(current.districtWheelLocations?.[district.id] || "");
      const label = `${district.name} · ${monsterLabel(monster) || monsterId} · ${monsterRank(monster)} · 等级 ${level}${location ? ` · ${location}` : ""}`;
      return `<span class="kingdom-monster-wheel-token read-only" style="--token-x:${zone.x}%;--token-y:${zone.y}%;--token-width:${zone.width}%" title="${esc(label)}">
        ${source ? `<img src="${esc(asset(source, options.assetBase))}" alt="${esc(label)}">` : `<span class="kingdom-monster-wheel-fallback">${esc((monsterLabel(monster) || "?").slice(0, 1))}</span>`}
      </span>`;
    }).join("") : "";
    const markers = list(current.kingdomMarkers).map(marker => {
      const source = markerSource(marker.type, data);
      const label = TILE_MARKERS.get(marker.type) || marker.type || "标记";
      const x = clamp(Number(marker.x) || 50, 2, 98);
      const y = clamp(Number(marker.y) || 50, 2, 98);
      return `<span class="kingdom-board-marker read-only" style="left:${x}%;top:${y}%" title="${esc(label)}">
        ${source ? `<img class="kingdom-board-marker-image" src="${esc(asset(source, options.assetBase))}" alt="${esc(label)}">` : `<span class="kingdom-board-marker-fallback">${esc(label.slice(0, 1) || "?")}</span>`}
      </span>`;
    }).join("");
    return `<div class="kingdom-board-scene read-only" aria-label="${esc(data.maps?.[state.kingdom]?.label || state.kingdom)}王国版图">
      <img src="${esc(asset(board, options.assetBase))}" alt="王国版图">${activeEffect}${wheel}${markers}
    </div>`;
  }

  function renderClueTracking(options = {}) {
    const state = record(options.state);
    const knights = list(state.knights)
      .filter(knight => !state.mainKnightId || knight.id !== state.mainKnightId)
      .slice(0, 5);
    if (!knights.length) return '<p class="display-empty-copy">暂无骑士线索记录</p>';
    const clueSlot = (knight, id, role) => {
      const clue = CLUES.find(([clueId]) => clueId === id);
      const name = clue?.[1] || "未指定";
      const icon = clue?.[2] || "";
      const amount = id ? Math.max(0, Number(knight.clues?.[id]) || 0) : 0;
      return `<span class="display-clue-value ${id ? `clue-${esc(id)}` : "empty"}" data-clue-role="${role}" aria-label="${esc(role === "primary" ? "主要" : "次要")}${esc(name)}线索 ${amount}">
        ${icon ? `<img class="clue-token-icon" src="${esc(asset(icon, options.assetBase))}" alt="">` : '<span class="clue-token-placeholder" aria-hidden="true"></span>'}
        <strong>${amount}</strong>
      </span>`;
    };
    return `<div class="display-clue-list">${knights.map(knight => `<article class="display-clue-knight">
      <div class="display-clue-heading"><strong>${esc(knightDisplayName(knight))}</strong></div>
      <div class="display-clue-values">${clueSlot(knight, knight.primary, "primary")}${knight.fivePlayerTarget ? '<span class="display-clue-goal" aria-label="目标 4 枚">/4</span>' : clueSlot(knight, knight.secondary, "secondary")}</div>
    </article>`).join("")}</div>`;
  }

  function renderDelveTracks(options = {}) {
    const state = options.state || {};
    const data = options.data || {};
    const limits = options.limits || data.kingdomRules?.[state.kingdom]?.limits || { threat: 9, curse: 4, time: 16 };
    const icons = data.tokens?.tracks || {};
    const notesByTrack = state.trackNotes || {};
    const interactive = options.interactive !== false;
    const maxNoteLength = Math.max(1, Number(options.maxNoteLength) || 40);
    const threatHunt = { 3: 1, 4: 2, 7: 1, 8: 1, 9: 2 };
    const tracks = [
      ["threat", "威胁", value => threatHunt[value] ? `追猎 ${threatHunt[value]}` : ""],
      ["curse", "诅咒", () => ""],
      ["time", "时间", value => value === 8 ? "初步" : value === 16 ? "完全" : ""]
    ];
    const trackMarkup = tracks.map(([id, label, eventLabel]) => {
      const value = Math.max(0, Math.round(Number(state.trackers?.[id]) || 0));
      const limit = Math.max(0, Number(limits[id]) || 0);
      const notes = notesByTrack[id] || {};
      const selectedNotePosition = Math.min(limit, value);
      const selectedNote = notes[String(selectedNotePosition)] || "";
      const editor = interactive ? `<form class="track-note-editor" data-track-note-form="${id}">
        <details class="track-note-position-picker">
          <summary data-track-note-summary="${id}" title="已选数值 ${selectedNotePosition}">${selectedNotePosition}</summary>
          <div class="track-note-position-options" role="group" aria-label="${label}轨道标记数值">
            ${Array.from({ length: limit + 1 }, (_, cell) => `<label><input type="checkbox" data-track-note-value="${id}" value="${cell}" ${cell === selectedNotePosition ? "checked" : ""}><span>${cell}</span></label>`).join("")}
          </div>
        </details>
        <input data-track-note-text="${id}" maxlength="${maxNoteLength}" value="${esc(selectedNote)}" placeholder="标记内容" aria-label="${label}轨道标记内容">
        <button type="submit" class="small secondary">保存</button>
        <button type="button" class="small danger" data-track-note-clear="${id}" ${selectedNote ? "" : "disabled"}>清除</button>
      </form>` : "";
      const cells = Array.from({ length: limit + 1 }, (_, cell) => {
        const marker = eventLabel(cell);
        const note = notes[String(cell)] || "";
        const description = [`${label} ${cell}`, marker, note].filter(Boolean).join("，");
        const className = `delve-track-cell${cell === value ? " active" : ""}${marker ? " event-cell" : ""}${note ? " noted" : ""}`;
        const content = `<span class="track-cell-note">${note ? esc(note) : ""}</span><span class="track-number">${cell}</span><small class="track-event-label">${marker ? esc(marker) : ""}</small>`;
        return interactive
          ? `<button type="button" class="${className}" data-track-cell="${id}" data-track-value="${cell}" aria-label="${esc(description)}" aria-pressed="${cell === value}" title="${esc(description)}">${content}</button>`
          : `<span class="${className}" aria-label="${esc(description)}" title="${esc(description)}">${content}</span>`;
      }).join("");
      return `<div class="delve-track track-${id}${value > limit ? " over-limit" : ""}">
        <div class="delve-track-heading">
          <span class="delve-track-logo">${icons[id] ? `<img src="${esc(asset(icons[id], options.assetBase))}?v=3" alt="">` : ""}</span>
          <span class="delve-track-status"><strong class="delve-track-name">${label}</strong><small>当前 ${value}${value > limit ? " · 已溢出" : ""}</small></span>
          ${editor}
        </div>
        <div class="delve-track-scroll"><div class="delve-track-cells" style="--track-cells:${limit + 1}">${cells}</div></div>
      </div>`;
    }).join("");
    return `<section class="panel delve-tracks-panel ${interactive ? "" : "read-only"}">
      <div class="delve-tracks">${trackMarkup}</div>
    </section>`;
  }

  window.KFMapView = Object.freeze({
    CLUES, PASSAGE_MARKER_TYPES, MARKER_TOKEN_UNITS, legalTileIds, renderMapStage, bindMapStage, partyMotionRemaining, renderKingdomBoard, renderExplorationCard,
    renderDistrictExplorationCards, renderClueTracking, renderDelveTracks, tileLabel,
    stageGeometry, tileGeometry, tileAtWorld, tileWarpPoint, tileLocalToWorld, worldToTileLocal, passagePoint, mapPassages, nearestPassage
  });
})();
