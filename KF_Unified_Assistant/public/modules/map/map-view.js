(() => {
  "use strict";

  const TTS_CARD_HEIGHT = 3.06;
  const TOKEN_SLOTS = [
    [12.5, 12.5], [37.5, 12.5], [62.5, 12.5], [87.5, 12.5],
    [12.5, 87.5], [37.5, 87.5], [62.5, 87.5], [87.5, 87.5],
    [12.5, 37.5], [12.5, 62.5], [87.5, 37.5], [87.5, 62.5],
    [37.5, 37.5], [62.5, 37.5], [37.5, 62.5], [62.5, 62.5]
  ];
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
    ["generic", "通用标记"], ["quest", "任务标记"]
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

  function legalTileIds(state, data) {
    const current = record(state.maps?.[state.kingdom]);
    const origin = list(data.maps?.[state.kingdom]?.tiles).find(item => item.id === current.current);
    if (!origin) return [];
    const linked = new Set(list(origin.neighbors));
    for (const marker of list(current.pathMarkers)) {
      if (marker.type !== "shortcut" || !marker.to) continue;
      if (marker.from === current.current) linked.add(marker.to);
      if (marker.to === current.current) linked.add(marker.from);
    }
    const pathKey = (left, right) => [left, right].sort().join("|");
    const blocked = tileId => list(current.pathMarkers).some(marker =>
      marker.to && pathKey(marker.from, marker.to) === pathKey(current.current, tileId) && marker.type !== "shortcut"
    );
    return [...linked].filter(tileId =>
      list(current.placed).includes(tileId) && current.tileState?.[tileId] !== "explored" && !blocked(tileId)
    );
  }

  function markerSource(type, data) {
    if (type === "fog") return "/assets/tokens/fog.png";
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

  function mapToken(source, label, item, kind, tileId, index, assetBase, interactive) {
    const position = savedTokenPosition(item, kind, tileId);
    const fallback = TOKEN_SLOTS[index % TOKEN_SLOTS.length];
    const x = position?.x ?? fallback[0];
    const y = position?.y ?? fallback[1];
    const data = interactive
      ? `draggable="false" data-map-token="${esc(item.id)}" data-token-kind="${kind}" data-token-tile="${esc(tileId)}" data-token-x="${x}" data-token-y="${y}"`
      : `aria-hidden="true" data-display-token-kind="${kind}"`;
    if (kind === "tile" && item.type === "custom") {
      return `<span class="map-token custom-map-token" title="${esc(label)}" style="left:${x}%;top:${y}%" ${data}>${esc(label)}</span>`;
    }
    return source
      ? `<img class="token-icon map-token" src="${esc(asset(source, assetBase))}" alt="${esc(label)}" title="${esc(label)}" style="left:${x}%;top:${y}%" ${data}>`
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

  function partyMarker(tileId, state, current, options) {
    const { member, knight, name } = partyIdentity(state, options.party, options.mainlineKnight);
    const memberPortraitId = member?.type === "squire" ? member.squireId : member?.knightId;
    const knightPortraitId = knight?.heroId || (knight?.memberType === "squire" ? knight?.squireId : knight?.knightId);
    const portraitId = memberPortraitId || knightPortraitId || heroIdFromName(name);
    const saved = current.partyPositions?.[tileId];
    const x = Number.isFinite(saved?.x) ? clamp(saved.x, 0, 100) : 50;
    const y = Number.isFinite(saved?.y) ? clamp(saved.y, 0, 100) : 50;
    const attrs = options.interactive === false
      ? `aria-label="当前队伍：${esc(name)}"`
      : `aria-label="当前队伍：${esc(name)}" title="当前队伍：${esc(name)}（可拖动）" data-map-token="party" data-token-kind="party" data-token-tile="${esc(tileId)}" data-token-x="${x}" data-token-y="${y}"`;
    return `<span class="party-location-token" role="img" ${attrs} style="left:${x}%;top:${y}%">
      ${portraitId
        ? `<img src="/assets/heroes/${esc(portraitId)}-avatar.jpg" alt="" draggable="false">`
        : `<span class="party-location-fallback" aria-hidden="true">${esc(name.slice(0, 1) || "?")}</span>`}
    </span>`;
  }

  function renderMapStage(options = {}) {
    const state = record(options.state);
    const data = record(options.data);
    const current = record(state.maps?.[state.kingdom]);
    const kingdom = record(data.maps?.[state.kingdom]);
    const all = list(kingdom.tiles).filter(item => Number.isFinite(item.x) && Number.isFinite(item.y));
    const placed = new Set(list(current.placed));
    const shown = all.filter(item => current.showAll || placed.has(item.id));
    const geometrySource = current.showAll ? all : shown;
    if (!geometrySource.length) return "";
    const geometry = geometrySource.map(item => {
      const size = tileSize(item);
      const radians = ttsAngle(item) * Math.PI / 180;
      return {
        item,
        bx: Math.abs(Math.cos(radians)) * size.width / 2 + Math.abs(Math.sin(radians)) * size.height / 2,
        by: Math.abs(Math.sin(radians)) * size.width / 2 + Math.abs(Math.cos(radians)) * size.height / 2
      };
    });
    const pad = 1.2;
    const minX = Math.min(...geometry.map(row => row.item.x - row.bx)) - pad;
    const maxX = Math.max(...geometry.map(row => row.item.x + row.bx)) + pad;
    const minY = Math.min(...geometry.map(row => row.item.y - row.by)) - pad;
    const maxY = Math.max(...geometry.map(row => row.item.y + row.by)) + pad;
    const worldWidth = maxX - minX;
    const worldHeight = maxY - minY;
    const legal = new Set(Array.isArray(options.legalTileIds) ? options.legalTileIds : legalTileIds(state, data));
    const randomHighlights = new Set(list(current.randomTileHighlights));
    const interactive = options.interactive !== false;
    const cards = shown.map(item => {
      const size = tileSize(item);
      const status = current.tileState?.[item.id] || "hidden";
      const face = current.showAll || status !== "hidden";
      const source = item.image?.[face ? "face" : "back"] || item.image?.face;
      const monsters = list(current.monsters).filter(marker => marker.tileId === item.id);
      const tileMarkers = list(current.tileMarkers).filter(marker => marker.tileId === item.id);
      const pathMarkers = list(current.pathMarkers).filter(marker => marker.from === item.id || marker.to === item.id);
      const classes = [
        "map-tile", current.selected === item.id ? "selected" : "", current.current === item.id ? "current" : "",
        legal.has(item.id) && !current.showAll ? "legal" : "", status === "revealed" ? "revealed-unexplored" : "",
        randomHighlights.has(item.id) ? "random-highlight" : "", interactive ? "" : "read-only"
      ].filter(Boolean).join(" ");
      const angle = ttsAngle(item);
      const mapTokens = [
        ...tileMarkers.map(marker => ({ record: marker, kind: "tile", source: markerSource(marker.type, data), label: markerLabel(marker) })),
        ...pathMarkers.map(marker => ({ record: marker, kind: "path", source: markerSource(marker.type, data), label: PATH_MARKERS.get(marker.type) || marker.type })),
        ...monsters.map(marker => ({
          record: marker, kind: "monster", source: data.tokens?.monsters?.[marker.monsterId] || "",
          label: list(data.monsters).find(monster => monster.id === marker.monsterId)?.name || marker.monsterId
        }))
      ];
      const tag = interactive ? "button" : "div";
      const attributes = interactive
        ? `type="button" data-tile="${esc(item.id)}" title="${esc(tileLabel(item))}"`
        : `role="img" aria-label="${esc(tileLabel(item))}"`;
      return `<${tag} class="${classes}" ${attributes} data-angle="${angle}"
        style="left:${(item.x - size.width / 2 - minX) / worldWidth * 100}%;top:${(item.y - size.height / 2 - minY) / worldHeight * 100}%;width:${size.width / worldWidth * 100}%;height:${size.height / worldHeight * 100}%;transform:rotate(${angle}deg);--counter-rotation:${-angle}deg">
        <img class="map-tile-image" src="${esc(asset(source, options.assetBase))}" alt="${esc(tileLabel(item))}" draggable="false">
        ${current.current === item.id ? partyMarker(item.id, state, current, options) : ""}
        ${mapTokens.map((entry, index) => mapToken(entry.source, entry.label, entry.record, entry.kind, item.id, index, options.assetBase, interactive)).join("")}
      </${tag}>`;
    }).join("");
    return `<div class="map-stage" style="aspect-ratio:${worldWidth}/${worldHeight}">${cards}</div>`;
  }

  function explorationCardById(data, kingdom, cardId) {
    const rules = record(data.kingdomRules?.[kingdom]);
    return [...list(rules.exploration), ...list(rules.specialExploration)].find(item => item.id === cardId) || null;
  }

  function explorationCardStyle(image, side = "face", assetBase = "") {
    if (!image) return "";
    const usesAtlas = side !== "back" || image.uniqueBack === true;
    const columns = usesAtlas ? Math.max(1, Number(image.width) || 1) : 1;
    const rows = usesAtlas ? Math.max(1, Number(image.height) || 1) : 1;
    const index = usesAtlas ? Math.max(0, Number(image.index) || 0) : 0;
    const x = columns > 1 ? (index % columns) / (columns - 1) * 100 : 0;
    const y = rows > 1 ? Math.floor(index / columns) / (rows - 1) * 100 : 0;
    return `--exploration-image:url("${esc(asset(image[side] || image.face, assetBase))}");--exploration-cols:${columns};--exploration-rows:${rows};--exploration-x:${x}%;--exploration-y:${y}%;--exploration-aspect:${Number(image.aspect) || .702}`;
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
      const label = `${district.name} · ${monster?.name || monsterId} · Lv.${level}${location ? ` · ${location}` : ""}`;
      return `<span class="kingdom-monster-wheel-token read-only" style="--token-x:${zone.x}%;--token-y:${zone.y}%;--token-width:${zone.width}%" title="${esc(label)}">
        ${source ? `<img src="${esc(asset(source, options.assetBase))}" alt="${esc(label)}">` : `<span class="kingdom-monster-wheel-fallback">${esc((monster?.name || "?").slice(0, 1))}</span>`}
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
      .slice(0, 4);
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
      <div class="display-clue-values">${clueSlot(knight, knight.primary, "primary")}${clueSlot(knight, knight.secondary, "secondary")}</div>
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

  window.KFMapView = Object.freeze({ CLUES, legalTileIds, renderMapStage, renderKingdomBoard, renderExplorationCard, renderDistrictExplorationCards, renderClueTracking, renderDelveTracks, tileLabel });
})();
