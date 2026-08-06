(() => {
  "use strict";

  const DATA = window.KF_MOD_DATA;
  const FOG_RULES = window.KF_FOG_RULES;
  const MERCENARY_RULES = window.KF_MERCENARY_RULES;
  const SAVE_VERSION = 8;
  const SAVE_KEY = "kf-map-host-v8";
  const LEGACY_SAVE_KEYS = ["kf-map-host-v7", "kf-map-host-v6", "kf-map-host-v5"];
  const ENCOUNTER_HANDOFF_KEY = "kfEncounterHandoff";
  const TTS_CARD_HEIGHT = 3.06;
  const MAP_ZOOM_MIN = 1;
  const MAP_ZOOM_MAX = 6;
  const MAP_FOCUS_PADDING = 28;
  const CUSTOM_MARKER_MAX_LENGTH = 12;
  const TRACK_NOTE_MAX_LENGTH = 24;
  const STEPS = ["旅行", "王国板块", "探索", "故事"];
  const TOOL_TABS = [
    ["tile", "板块"],
    ["travel", "旅行"],
    ["encounter", "遭遇"],
    ["exploration", "探索"],
    ["mercenary", "佣兵"],
    ["party", "队伍"]
  ];
  const STEP_TOOL = ["travel", "tile", "exploration"];
  const TILE_REGION_CORRECTIONS = Object.freeze([
    { kingdom: "SK", tileId: "SK_Tile_EL:1", from: "drowned", to: "marsh" }
  ]);
  for (const correction of TILE_REGION_CORRECTIONS) {
    const item = DATA.maps?.[correction.kingdom]?.tiles?.find(tileItem => tileItem.id === correction.tileId);
    if (item?.rules?.region === correction.from) item.rules.region = correction.to;
  }
  const KINGDOM_PANEL_ZONES = Object.freeze({
    SK: {
      active: { x: 72.5, y: 50, width: 17 },
      wheelCenter: { x: 25.6, y: 75.7, width: 6.7 },
      monsterSlots: {
        drowned: { x: 14.6, y: 80.9, width: 9.4 },
        marsh: { x: 25.7, y: 64, width: 9.4 },
        mud: { x: 36.3, y: 82.1, width: 9.4 }
      }
    },
    POS: {
      active: { x: 72.5, y: 50, width: 17 },
      wheelCenter: { x: 26, y: 73, width: 6.7 },
      monsterSlots: {
        noble: { x: 14, y: 64.5, width: 9.4 },
        craftsman: { x: 31, y: 63.3, width: 9.4 },
        merchant: { x: 20.2, y: 82.5, width: 9.4 },
        port: { x: 38.1, y: 80.8, width: 9.4 }
      }
    }
  });
  const THREAT_HUNT = Object.freeze({ 3: 1, 4: 2, 7: 1, 8: 1, 9: 2 });
  const CLUES = [
    ["martial", "武艺", "assets/tokens/红-token.png?v=1"],
    ["errant", "游侠", "assets/tokens/绿-token.png?v=1"],
    ["historic", "历史", "assets/tokens/黄-token.png?v=1"],
    ["mystic", "神秘", "assets/tokens/蓝-token.png?v=1"]
  ];
  const DIRECTIONS = [
    ["north", "北"],
    ["east", "东"],
    ["south", "南"],
    ["west", "西"]
  ];
  const EXTRA_CLUE_DIRECTION_WEIGHTS = Object.freeze([
    ["north", 1],
    ["south", 1],
    ["west", 1],
    ["east", 1]
  ]);
  const PATH_MARKERS = [
    ["armored", "单联装甲门"],
    ["triple-armored", "三联装甲门"],
    ["fog", "弥雾"],
    ["blocked", "其他阻挡"],
    ["shortcut", "已解锁捷径"]
  ];
  const TILE_MARKERS = [
    ...CLUES.map(([id, name]) => [id, `${name}线索`]),
    ["surge", "涌水标记"],
    ["flood", "洪水标记"],
    ["rubble", "瓦砾"],
    ["generic", "通用标记"],
    ["quest", "任务标记"]
  ];
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
  const campaignParty = () => Array.isArray(window.KF_CAMPAIGN_PARTY) ? window.KF_CAMPAIGN_PARTY : [];
  const memberOptions = member => {
    const groups = [
      ["骑士", Array.isArray(window.KF_CAMPAIGN_KNIGHTS) ? window.KF_CAMPAIGN_KNIGHTS : []],
      ["侍从", Array.isArray(window.KF_CAMPAIGN_SQUIRES) ? window.KF_CAMPAIGN_SQUIRES : []],
    ];
    return `<option value="">请选择队伍成员</option>${groups.filter(([,items])=>items.length).map(([label,items])=>`<optgroup label="${label}">${items.map(item =>
      `<option value="${esc(item.id)}" ${(member.sheetId === item.id || (!member.sheetId && member.name === item.name)) ? "selected" : ""}>${esc(item.name)}${item.title && item.title !== item.name ? ` · ${esc(item.title)}` : ""}</option>`
    ).join("")}</optgroup>`).join("")}`;
  };
  const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const deepCopy = value => JSON.parse(JSON.stringify(value));
  const recordOrEmpty = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

  function shuffle(values) {
    const copy = [...values];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[other]] = [copy[other], copy[index]];
    }
    return copy;
  }

  function kingdomData(code = state.kingdom) {
    return DATA.maps[code];
  }

  function rules(code = state.kingdom) {
    return DATA.kingdomRules[code];
  }

  function tile(id, code = state.kingdom) {
    return kingdomData(code).tiles.find(item => item.id === id);
  }

  function tileLabel(item) {
    if (!item) return "未知";
    return `${item.size === "EXTRA" ? "支线" : item.size}-${item.number}`;
  }

  function card(id, code = state.kingdom) {
    const source = rules(code);
    return [...source.exploration, ...source.specialExploration, ...source.deepFog].find(item => item.id === id);
  }

  function fogCardValue(item) {
    return FOG_RULES.cardValue(item);
  }

  function makeFogEntry(cardId, corrected = false) {
    return FOG_RULES.makeEntry(cardId, card(cardId), corrected);
  }

  function updateFogTotal(fog) {
    return FOG_RULES.updateTotal(fog);
  }

  function fogOutcome(fog) {
    return FOG_RULES.outcome(fog);
  }

  function lowestFogEntries(fog) {
    return FOG_RULES.lowestEntries(fog);
  }

  function fogPeekState(fog = mapState().fog) {
    fog.peek ||= { source: "top", cards: [], destinations: [] };
    fog.peek.source = fog.peek.source === "bottom" ? "bottom" : "top";
    if (!Array.isArray(fog.peek.cards)) fog.peek.cards = [];
    if (!Array.isArray(fog.peek.destinations)) fog.peek.destinations = [];
    fog.peek.destinations = fog.peek.cards.map((_, index) =>
      ["bottom", "shuffle"].includes(fog.peek.destinations[index]) ? fog.peek.destinations[index] : "top"
    );
    return fog.peek;
  }

  function clearFogPeek(fog = mapState().fog) {
    fog.peek = { source: "top", cards: [], destinations: [] };
  }

  function fogPeekDestinationLabel(destination) {
    if (destination === "bottom") return "牌底";
    if (destination === "shuffle") return "洗回牌库";
    return "牌顶";
  }

  function fogPeekConfirmationLabel(peek) {
    const top = peek.destinations.filter(destination => destination === "top").length;
    const bottom = peek.destinations.filter(destination => destination === "bottom").length;
    const shuffled = peek.destinations.filter(destination => destination === "shuffle").length;
    return `确认放置（顶 ${top} · 底 ${bottom} · 洗 ${shuffled}）`;
  }

  function explorationEffectType(item) {
    const value = item?.effectType || "";
    if (value === "immediate" || value === "instant") return "instant";
    if (value === "region" || value === "district") return "district";
    if (value === "activation" || value === "active") return "active";
    return "instant";
  }

  function tileDistrict(tileId, current = mapState()) {
    return current.tileMeta?.[tileId]?.district
      || tile(tileId)?.rules?.region
      || "";
  }

  function currentMapDistrict() {
    const currentDistrict = tileDistrict(mapState().current);
    return rules().districts.some(d => d.id === currentDistrict) ? currentDistrict : "";
  }

  function explorationEffectDistrict() {
    const currentDistrict = currentMapDistrict();
    return rules().districts.some(d => d.id === currentDistrict)
      ? currentDistrict
      : rules().districts[0]?.id || "";
  }

  function markerToken(type) {
    if (type === "fog") return "assets/tokens/fog.png";
    const clue = CLUES.find(([id]) => id === type);
    if (clue) return clue[2];
    const tokens = DATA.tokens?.markers || {};
    return tokens[type] || tokens.generic || "";
  }

  function customMarkerText(value) {
    return [...String(value ?? "").trim()].slice(0, CUSTOM_MARKER_MAX_LENGTH).join("");
  }

  function tileMarkerLabel(marker) {
    if (marker?.type === "custom") return customMarkerText(marker.text) || "自定义标记";
    return TILE_MARKERS.find(([id]) => id === marker?.type)?.[1] || marker?.type || "板块标记";
  }

  function tileMarkerPreview(marker) {
    const label = tileMarkerLabel(marker);
    return marker?.type === "custom"
      ? `<span class="custom-marker-preview" title="${esc(label)}">${esc(label)}</span>`
      : tokenImage(markerToken(marker?.type), label);
  }

  function monsterToken(monsterId) {
    return DATA.tokens?.monsters?.[monsterId] || "";
  }

  function tokenImage(source, label, className = "") {
    return source
      ? `<img class="token-icon ${className}" src="${esc(source)}" alt="${esc(label)}" title="${esc(label)}">`
      : `<span class="token-fallback ${className}" title="${esc(label)}">●</span>`;
  }

  const TOKEN_SLOTS = [
    [12.5, 12.5], [37.5, 12.5], [62.5, 12.5], [87.5, 12.5],
    [12.5, 87.5], [37.5, 87.5], [62.5, 87.5], [87.5, 87.5],
    [12.5, 37.5], [12.5, 62.5], [87.5, 37.5], [87.5, 62.5],
    [37.5, 37.5], [62.5, 37.5], [37.5, 62.5], [62.5, 62.5]
  ];
  const EFFECT_MARKER_SLOTS = [
    [82, 18], [18, 82], [82, 82], [50, 50],
    [50, 18], [18, 50], [82, 50], [50, 82]
  ];

  function effectMarkerPosition(marker, index = 0) {
    const fallback = EFFECT_MARKER_SLOTS[index % EFFECT_MARKER_SLOTS.length];
    const x = Number(marker?.x);
    const y = Number(marker?.y);
    return {
      x: Number.isFinite(x) ? clamp(x, 0, 100) : fallback[0],
      y: Number.isFinite(y) ? clamp(y, 0, 100) : fallback[1]
    };
  }

  const KINGDOM_MARKER_STARTS = [
    [50, 50], [58, 50], [42, 50], [50, 58], [50, 42],
    [58, 58], [42, 58], [58, 42], [42, 42]
  ];

  function savedTokenPosition(record, kind, tileId) {
    const value = kind === "path" ? record.positions?.[tileId] : record.position;
    if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return null;
    return { x: clamp(value.x, 0, 100), y: clamp(value.y, 0, 100) };
  }

  function mapTokenImage(source, label, record, kind, tileId, index) {
    const position = savedTokenPosition(record, kind, tileId);
    const fallback = TOKEN_SLOTS[index % TOKEN_SLOTS.length];
    const x = position?.x ?? fallback[0];
    const y = position?.y ?? fallback[1];
    const tokenData = `draggable="false" data-map-token="${esc(record.id)}" data-token-kind="${kind}"
      data-token-tile="${esc(tileId)}" data-token-x="${x}" data-token-y="${y}"
      style="left:${x}%;top:${y}%"`;
    if (kind === "tile" && record.type === "custom") {
      return `<span class="map-token custom-map-token" title="${esc(label)}" aria-label="自定义标记：${esc(label)}"
        ${tokenData}>${esc(label)}</span>`;
    }
    if (!source) return "";
    return `<img class="token-icon map-token"
      src="${esc(source)}" alt="${esc(label)}" title="${esc(label)}"
      ${tokenData}>`;
  }

  function setTokenPosition(kind, id, tileId, position) {
    const current = mapState();
    if (kind === "party") {
      current.partyPositions ||= {};
      current.partyPositions[tileId] = position;
      return;
    }
    if (kind === "monster") {
      const record = current.monsters.find(item => item.id === id);
      if (record) record.position = position;
      return;
    }
    if (kind === "tile") {
      const record = current.tileMarkers.find(item => item.id === id);
      if (record) record.position = position;
      return;
    }
    const record = current.pathMarkers.find(item => item.id === id);
    if (!record) return;
    record.positions ||= {};
    record.positions[tileId] = position;
  }

  function initialPlaced(code, startId = kingdomData(code).start) {
    return [...new Set([startId, ...(tile(startId, code)?.neighbors || [])])];
  }

  function trackNoteText(value) {
    return [...String(value ?? "").trim()].slice(0, TRACK_NOTE_MAX_LENGTH).join("");
  }

  function normalizeTrackNotes(value) {
    const notes = { threat: {}, curse: {}, time: {} };
    for (const track of Object.keys(notes)) {
      const source = value?.[track];
      if (!source || typeof source !== "object" || Array.isArray(source)) continue;
      Object.entries(source).forEach(([position, text]) => {
        if (!/^\d+$/.test(position)) return;
        const note = trackNoteText(text);
        if (note) notes[track][String(Number(position))] = note;
      });
    }
    return notes;
  }

  function trackerValue(value) {
    return Math.max(0, Math.trunc(Number(value) || 0));
  }

  function normalizeTrackers(value) {
    return {
      threat: trackerValue(value?.threat),
      curse: trackerValue(value?.curse),
      time: trackerValue(value?.time),
      unassignedClues: trackerValue(value?.unassignedClues)
    };
  }

  function normalizeTrackNotePositions(values, limit) {
    const maximum = Math.max(0, Math.trunc(Number(limit) || 0));
    return [...new Set((Array.isArray(values) ? values : [])
      .map(Number)
      .filter(position => Number.isInteger(position) && position >= 0 && position <= maximum))]
      .sort((left, right) => left - right);
  }

  function selectedTrackNotePositions(form, key) {
    return normalizeTrackNotePositions(
      [...form.querySelectorAll(`[data-track-note-value="${key}"]:checked`)].map(input => input.value),
      rules().limits[key]
    );
  }

  function defaultMap(code, requestedStart = kingdomData(code).start) {
    const map = kingdomData(code);
    const rule = rules(code);
    const startId = tile(requestedStart, code) ? requestedStart : map.start;
    const placed = initialPlaced(code, startId);
    return {
      placed,
      tileState: Object.fromEntries(placed.map(id => [id, id === startId ? "explored" : "hidden"])),
      randomTileHighlights: [],
      startingTile: startId,
      current: startId,
      selected: startId,
      showAll: false,
      zoom: 1,
      autoFocus: true,
      scrollLeft: 0,
      scrollTop: 0,
      travelMode: "unexplored",
      travelRoute: [],
      tileResolution: null,
      tileMeta: {},
      pathMarkers: [],
      tileMarkers: [],
      partyPositions: {},
      kingdomMarkers: [],
      monsters: [],
      pendingEncounter: null,
      encounterSuppressions: [],
      districtWheel: Object.fromEntries(rule.districts.map(district => [district.id, ""])),
      districtWheelLevels: Object.fromEntries(rule.districts.map(district => [district.id, null])),
      districtWheelLocations: Object.fromEntries(rule.districts.map(district => [district.id, ""])),
      districtWheelSource: null,
      exploration: {
        deck: shuffle(rule.exploration.map(item => item.id)),
        discard: [],
        current: null,
        peek: false,
        poiAdjustment: 0,
        districtEffects: {},
        activeEffect: null,
        effectMarkers: {},
        resolvedRound: null,
        scouting: { surveyAddedCount: 0, lastPeek: [], reordering: false },
        pendingClueDirections: [],
        lastClueResolution: null
      },
      fog: {
        active: false,
        target: "",
        deck: shuffle(rule.deepFog.map(item => item.id)),
        discard: [],
        peek: { source: "top", cards: [], destinations: [] },
        current: null,
        route: [],
        used: [],
        total: 0,
        intensity: 0,
        hazardPending: false,
        started: false,
        correctedEver: false,
        baneHalf: false,
        baneFull: 0,
        heading: 0
      },
      storyQueue: [],
      explorationCodes: [],
      history: [],
      threatSevenSpawned: false,
      threatSevenPending: false,
      failed: ""
    };
  }

  function defaultState() {
    return {
      version: SAVE_VERSION,
      kingdom: "SK",
      step: 0,
      round: 1,
      taskMode: false,
      mainKnightId: "",
      trackers: normalizeTrackers(),
      trackNotes: normalizeTrackNotes(),
      maps: { SK: defaultMap("SK"), POS: defaultMap("POS") },
      knights: rosterKnights(),
      mercenaries: MERCENARY_RULES.createState(),
      log: []
    };
  }

  function rosterKnights(existing = []) {
    const roster = campaignParty().slice(0, 4);
    if (!roster.length) return [
      { id: uid(), name: "骑士 1", clues: { martial: 0, errant: 0, historic: 0, mystic: 0 }, primary: "", secondary: "", task: "" }
    ];
    return roster.map(member => {
      const previous = existing.find(item => item.sheetId === member.id || (!item.sheetId && item.name === member.name));
      return {
        id: previous?.id || uid(), sheetId: member.id, memberType: member.type || "knight", name: member.name,
        clues: { martial: 0, errant: 0, historic: 0, mystic: 0, ...(previous?.clues || {}) },
        primary: previous?.primary || "", secondary: previous?.secondary || "", task: previous?.task || ""
      };
    });
  }

  function applySavedTileRegionCorrections(saved) {
    for (const correction of TILE_REGION_CORRECTIONS) {
      const meta = saved.maps?.[correction.kingdom]?.tileMeta?.[correction.tileId];
      if (meta?.district === correction.from) meta.district = correction.to;
    }
    return saved;
  }

  function normalizeSavedMapState(saved) {
    saved.trackNotes = normalizeTrackNotes(saved.trackNotes);
    saved.trackers = normalizeTrackers(saved.trackers);
    Object.entries(saved.maps || {}).forEach(([code, current]) => {
      if (!current || typeof current !== "object") return;
      if (!Array.isArray(current.placed)) current.placed = [];
      current.tileState = recordOrEmpty(current.tileState);
      current.tileMeta = recordOrEmpty(current.tileMeta);
      current.districtWheel = recordOrEmpty(current.districtWheel);
      current.districtWheelLevels = recordOrEmpty(current.districtWheelLevels);
      current.districtWheelLocations = recordOrEmpty(current.districtWheelLocations);
      if (!Array.isArray(current.pathMarkers)) current.pathMarkers = [];
      current.pathMarkers.forEach(marker => {
        if (marker && typeof marker === "object" && Object.hasOwn(marker, "positions")) {
          marker.positions = recordOrEmpty(marker.positions);
        }
      });
      if (!Array.isArray(current.randomTileHighlights)) current.randomTileHighlights = [];
      current.randomTileHighlights = [...new Set(current.randomTileHighlights)]
        .filter(tileId => current.placed.includes(tileId) && tile(tileId, code));
      Object.entries(current.tileState).forEach(([tileId, status]) => {
        if (["revealed", "explored"].includes(status)) placeConnectedTiles(current, tileId, code);
      });
      current.zoom = clamp(Number(current.zoom) || 1, MAP_ZOOM_MIN, MAP_ZOOM_MAX);
      if (typeof current.autoFocus !== "boolean") current.autoFocus = true;
      if (!Array.isArray(current.kingdomMarkers)) current.kingdomMarkers = [];
      if (!Array.isArray(current.encounterSuppressions)) current.encounterSuppressions = [];
      current.partyPositions = recordOrEmpty(current.partyPositions);
      const fog = current.fog;
      if (fog && typeof fog === "object") {
        if (!Array.isArray(fog.deck)) fog.deck = [];
        if (!Array.isArray(fog.discard)) fog.discard = [];
        if (!fog.peek || typeof fog.peek !== "object" || Array.isArray(fog.peek)) {
          fog.peek = { source: "top", cards: [], destinations: [] };
        }
        fog.peek.source = fog.peek.source === "bottom" ? "bottom" : "top";
        if (!Array.isArray(fog.peek.cards)) fog.peek.cards = [];
        if (!Array.isArray(fog.peek.destinations)) fog.peek.destinations = [];
        fog.peek.destinations = fog.peek.cards.map((_, index) =>
          ["bottom", "shuffle"].includes(fog.peek.destinations[index]) ? fog.peek.destinations[index] : "top"
        );
        const expectedPeekCards = FOG_RULES.peekCards(fog.deck, fog.peek.cards.length, fog.peek.source);
        if (fog.peek.cards.some((cardId, index) => expectedPeekCards[index] !== cardId)) {
          fog.peek = { source: "top", cards: [], destinations: [] };
        }
        if (!Array.isArray(fog.route)) fog.route = [];
        if (!Array.isArray(fog.used)) fog.used = [...fog.route];
        fog.baneHalf = fog.baneHalf === true;
        fog.baneFull = Math.max(0, Math.trunc(Number(fog.baneFull) || 0));
        fog.hazardPending = fog.hazardPending === true;
        fog.correctedEver = fog.correctedEver === true;
        fog.started = fog.started === true;
        if (fog.active && fog.started && fog.current) {
          if (!fog.deck.includes(fog.current)) fog.deck.unshift(fog.current);
          fog.current = null;
        }
        FOG_RULES.normalizeLayout(fog);
        updateFogTotal(fog);
      }
      const exp = current.exploration;
      if (!exp) return;
      exp.districtEffects = recordOrEmpty(exp.districtEffects);
      exp.effectMarkers = recordOrEmpty(exp.effectMarkers);
      Object.entries(exp.effectMarkers).forEach(([slotKey, records]) => {
        if (!Array.isArray(records)) {
          delete exp.effectMarkers[slotKey];
          return;
        }
        exp.effectMarkers[slotKey] = records
          .filter(marker => marker && typeof marker === "object")
          .slice(0, EFFECT_MARKER_SLOTS.length)
          .map((marker, index) => ({ ...marker, ...effectMarkerPosition(marker, index) }));
      });
      if (!Object.hasOwn(exp, "resolvedRound")) exp.resolvedRound = null;
      if (!exp.scouting || typeof exp.scouting !== "object" || Array.isArray(exp.scouting)) {
        exp.scouting = { surveyAddedCount: 0, lastPeek: [], reordering: false };
      }
      exp.scouting.surveyAddedCount = Math.max(0, Number(exp.scouting.surveyAddedCount) || 0);
      if (!Array.isArray(exp.scouting.lastPeek)) exp.scouting.lastPeek = [];
      exp.scouting.reordering = exp.scouting.reordering === true;
    });
    saved.mercenaries = MERCENARY_RULES.normalizeState(saved.mercenaries);
    return saved;
  }

  function readState() {
    for (const key of [SAVE_KEY, ...LEGACY_SAVE_KEYS]) {
      try {
        const saved = JSON.parse(localStorage.getItem(key));
        if ([5, 6, 7, SAVE_VERSION].includes(saved?.version)) {
          saved.version = SAVE_VERSION;
          applySavedTileRegionCorrections(saved);
          normalizeSavedMapState(saved);
          saved.knights = rosterKnights(saved.knights);
          if (!saved.knights.some(knight => knight.id === saved.mainKnightId && knight.memberType !== "squire")) {
            saved.mainKnightId = "";
          }
          return saved;
        }
      } catch {
        // Try the next storage key before falling back to a new state.
      }
    }
    return defaultState();
  }

  let state = readState();
  let activeTool = STEP_TOOL[state.step] || (state.step === 3 ? "exploration" : "tile");
  let saveTimer = 0;
  let encounterNavigationTimer = 0;
  let pendingEncounterAutoStart = false;
  let kingdomPanelExpanded = true;
  let mapFocusFrame = 0;
  const mapState = () => state.maps[state.kingdom];
  const mainlineKnight = () => state.knights.find(knight =>
    knight.id === state.mainKnightId && knight.memberType !== "squire"
  ) || null;
  const activeMercenary = cardId => state.mercenaries.active.find(item => item.cardId === cardId) || null;
  const activeRogues = face => state.mercenaries.active.filter(item =>
    item.face === face && MERCENARY_RULES.CATALOG[item.cardId]?.role === "rogue"
  );

  function setCurrentTile(current, tileId) {
    if (current.current !== tileId) current.encounterSuppressions = [];
    current.current = tileId;
  }

  function placeConnectedTiles(current, tileId, code = state.kingdom) {
    const item = tile(tileId, code);
    if (!item) return [];
    const connected = (item.neighbors || []).filter(id => tile(id, code));
    current.placed = [...new Set([...current.placed, tileId, ...connected])];
    current.tileState[tileId] ||= "hidden";
    connected.forEach(id => { current.tileState[id] ||= "hidden"; });
    return connected;
  }

  function revealMapTile(current, tileId, code = state.kingdom) {
    placeConnectedTiles(current, tileId, code);
    if (current.tileState[tileId] !== "explored") current.tileState[tileId] = "revealed";
  }

  function forceMoveParty(tileId) {
    const destination = tile(tileId);
    if (!destination) return toast("目标板块不存在");
    const current = mapState();
    if (current.current === tileId) return toast("队伍已经位于该板块");
    const previousTileId = current.current;
    snapshot(`强制移动队伍至 ${tileLabel(destination)}`);
    current.placed = [...new Set([...current.placed, tileId])];
    current.tileState[tileId] ||= "hidden";
    setCurrentTile(current, tileId);
    current.selected = tileId;
    current.travelRoute = [previousTileId, tileId];
    addLog(`强制移动队伍：${tileLabel(tile(previousTileId))} → ${tileLabel(destination)}；未结算旅行、板块或探索效果`);
    save(true);
  }

  function mageTargets(cardId, current = mapState()) {
    const exploredTileIds = Object.entries(current.tileState || {})
      .filter(([, status]) => status === "explored")
      .map(([tileId]) => tileId)
      .filter(tileId => Boolean(tile(tileId)));
    return MERCENARY_RULES.mageTargetIds(cardId, {
      currentTileId: current.current,
      exploredTileIds,
      adjacentTileIds: tile(current.current)?.neighbors || [],
      currentDistrict: tileDistrict(current.current, current),
      tileDistricts: Object.fromEntries(exploredTileIds.map(tileId => [tileId, tileDistrict(tileId, current)])),
      pointOfInterestTileIds: exploredTileIds.filter(tileId => Boolean(current.tileMeta?.[tileId]?.poi))
    });
  }

  function mageMoveBlockReason(cardId, current = mapState()) {
    if (current.fog?.active) return "弥雾流程进行中，不能放置队伍。";
    if (current.tileResolution) return "请先完成当前王国板块结算。";
    if (current.pendingEncounter) return "请先完成当前遭遇。";
    if (state.mercenaries.pendingAction) return "请先完成盗贼探索牌选择。";
    if (!mageTargets(cardId, current).length) return "当前没有符合此法师等级的已探索目的地。";
    return "";
  }

  function encounterBacktrackTarget(current = mapState()) {
    const route = Array.isArray(current.travelRoute) ? current.travelRoute : [];
    return route.length >= 2 && route.at(-1) === current.current ? route.at(-2) : "";
  }

  function encounterRogues() {
    if (!mapState().pendingEncounter) return [];
    return activeRogues("B").filter(item =>
      ["skip", "skip-and-backtrack"].includes(MERCENARY_RULES.CATALOG[item.cardId]?.faces.B.action)
    );
  }

  function enterStep(index) {
    state.step = clamp(Math.trunc(Number(index) || 0), 0, STEPS.length - 1);
    activeTool = STEP_TOOL[state.step] || activeTool;
  }

  function canSkipTravelStep() {
    const current = mapState();
    return state.step === 0
      && !current.fog.active
      && !current.tileResolution
      && !current.pendingEncounter
      && !state.mercenaries.pendingAction;
  }

  function skipTravelStep() {
    if (!canSkipTravelStep()) return toast("当前有待处理的旅行、板块或遭遇，不能跳过移动");
    const current = mapState();
    snapshot("跳过移动阶段");
    current.travelRoute = [];
    enterStep(2);
    addLog(`跳过移动：队伍留在 ${tileLabel(tile(current.current))}，进入探索步骤`);
    save(true);
  }

  function canSkipExplorationStep() {
    const exp = mapState().exploration;
    return state.step === 2
      && exp.resolvedRound !== state.round
      && !exp.current
      && !state.mercenaries.pendingAction
      && !scoutingState(exp).reordering;
  }

  function skipExplorationStep() {
    if (!canSkipExplorationStep()) return toast("当前有待处理的探索牌或选牌操作，不能跳过抽牌");
    const exp = mapState().exploration;
    snapshot("跳过抽探索卡阶段");
    exp.resolvedRound = state.round;
    exp.peek = false;
    clearScoutingPeek(exp);
    enterStep(3);
    addLog("跳过抽探索卡：直接进入故事步骤");
    save(true);
  }

  function readEncounterHandoff() {
    try {
      return JSON.parse(localStorage.getItem(ENCOUNTER_HANDOFF_KEY) || "null");
    } catch {
      return null;
    }
  }

  function rotateDistrictWheel(current, direction = 1, count = 1, markManual = false) {
    ensureDistrictWheel(current, state.kingdom);
    const districts = rules().districts.map(item => item.id);
    const values = districts.map(id => current.districtWheel[id]);
    const levels = districts.map(id => current.districtWheelLevels[id]);
    const locations = districts.map(id => current.districtWheelLocations[id]);
    for (let index = 0; index < Math.max(1, Number(count) || 1); index += 1) {
      if (Number(direction) > 0) {
        values.unshift(values.pop());
        levels.unshift(levels.pop());
        locations.unshift(locations.pop());
      } else {
        values.push(values.shift());
        levels.push(levels.shift());
        locations.push(locations.shift());
      }
    }
    districts.forEach((id, index) => {
      current.districtWheel[id] = values[index];
      current.districtWheelLevels[id] = levels[index];
      current.districtWheelLocations[id] = locations[index];
    });
    if (markManual && current.districtWheelSource) current.districtWheelSource.manuallyAdjusted = true;
  }

  function encounterLevelFor(marker, current) {
    const district = rules().districts.find(item => current.districtWheel[item.id] === marker.monsterId);
    const level = district ? Number(current.districtWheelLevels[district.id]) : 0;
    return Number.isFinite(level) && level > 0 ? level : 1;
  }

  async function openPendingEncounter() {
    clearTimeout(encounterNavigationTimer);
    const current = mapState();
    const marker = current.monsters.find(item => item.id === current.pendingEncounter);
    if (!marker) {
      current.pendingEncounter = null;
      return save(true);
    }
    const campaignId = localStorage.getItem("kfActiveCampaign") || "";
    const existing = readEncounterHandoff();
    if (existing?.source === "map" && existing?.mapEncounter?.monsterTokenId === marker.id && !existing.completedEncounter) {
      await window.KF_MODULE_BRIDGE?.flush?.();
      location.href = "/modules/encounter/";
      return;
    }
    const monster = DATA.monsters.find(item => item.id === marker.monsterId);
    if (!monster) return toast("无法识别该怪物，不能自动建立遭遇");
    clearTimeout(saveTimer);
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    localStorage.setItem(ENCOUNTER_HANDOFF_KEY, JSON.stringify({
      id: uid(),
      campaignId,
      source: "map",
      monsterId: marker.monsterId,
      monster: monster.name,
      level: encounterLevelFor(marker, current),
      type: "normal",
      returnUrl: "/modules/map/",
      mapEncounter: {
        monsterTokenId: marker.id,
        interruptedKingdom: state.kingdom,
        interruptedStep: state.step,
        interruptedRound: state.round,
        tileId: current.current
      }
    }));
    await window.KF_MODULE_BRIDGE?.flush?.();
    location.href = "/modules/encounter/";
  }

  function schedulePendingEncounter() {
    clearTimeout(encounterNavigationTimer);
    if (!mapState().pendingEncounter) return;
    if (encounterRogues().length) {
      activeTool = "mercenary";
      render();
      toast("遭遇战待处理：可使用 B 面盗贼，或选择继续进入遭遇");
      return;
    }
    encounterNavigationTimer = setTimeout(openPendingEncounter, 180);
  }

  async function openKingdomWheelMonster(monsterId, level, districtId, destination, conflictLocation = "") {
    const monster = DATA.monsters.find(item => item.id === monsterId);
    if (!monster) return toast("无法识别该怪物，不能建立遭遇或冲突");
    const target = destination === "conflict" ? "/modules/aibp/" : "/modules/encounter/";
    const resolvedLevel = Math.max(1, Math.trunc(Number(level) || 1));
    clearTimeout(saveTimer);
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    localStorage.setItem(ENCOUNTER_HANDOFF_KEY, JSON.stringify({
      id: uid(),
      campaignId: localStorage.getItem("kfActiveCampaign") || "",
      source: "map-wheel",
      monsterId,
      monster: monster.name,
      level: resolvedLevel,
      type: "normal",
      returnUrl: "/modules/map/",
      mapWheel: {
        kingdom: state.kingdom,
        districtId,
        level: resolvedLevel,
        conflictLocation: destination === "conflict" ? String(conflictLocation || "") : ""
      }
    }));
    await window.KF_MODULE_BRIDGE?.flush?.();
    location.href = target;
  }

  function triggerPendingEncounter(markerId) {
    if (!markerId) return;
    const current = mapState();
    if (current.pendingEncounter) return;
    const marker = current.monsters.find(item => item.id === markerId);
    const suppressed = current.encounterSuppressions.some(item =>
      item.markerId === markerId && item.tileId === current.current && marker?.tileId === current.current
    );
    if (suppressed) return;
    current.pendingEncounter = markerId;
    pendingEncounterAutoStart = true;
  }

  function movePartyWithMage(cardId, targetTileId) {
    const current = mapState();
    const hired = activeMercenary(cardId);
    const definition = MERCENARY_RULES.CATALOG[cardId];
    if (!hired || definition?.role !== "mage") return toast("该法师当前不可用");
    const blockReason = mageMoveBlockReason(cardId, current);
    if (blockReason) return toast(blockReason);
    if (!mageTargets(cardId, current).includes(targetTileId)) return toast("所选板块不符合该法师的深入效果");

    const face = hired.face;
    const previousTileId = current.current;
    snapshot(`法师 ${definition.level} ${face} 放置队伍`);
    setCurrentTile(current, targetTileId);
    current.selected = targetTileId;
    const transition = MERCENARY_RULES.advance(state.mercenaries, cardId);
    addLog(`法师 ${definition.level} 级 ${face} 面：将队伍从 ${tileLabel(tile(previousTileId))} 放置到 ${tileLabel(tile(targetTileId))}，不消耗时间或威胁；${transition.to === "B" ? "翻至 B 面" : "B 面结算后弃置"}`);

    const destinationMonster = current.monsters.find(item => item.tileId === targetTileId);
    if (destinationMonster) triggerPendingEncounter(destinationMonster.id);
    save(true);
  }

  function skipPendingEncounter(cardId) {
    const current = mapState();
    const hired = activeMercenary(cardId);
    const definition = MERCENARY_RULES.CATALOG[cardId];
    const marker = current.monsters.find(item => item.id === current.pendingEncounter);
    if (!hired || hired.face !== "B" || !definition || !marker) return toast("该盗贼不能结算当前遭遇");
    const outcome = MERCENARY_RULES.encounterSkip(cardId, current.current, current.travelRoute);
    if (!outcome) return toast("没有最近旅行路线的上一板块，不能使用该效果");

    const monsterName = DATA.monsters.find(item => item.id === marker.monsterId)?.name || "怪物";
    const encounterTileId = current.current;
    snapshot(`盗贼 ${definition.level} B 忽略遭遇`);
    clearTimeout(encounterNavigationTimer);
    pendingEncounterAutoStart = false;
    current.pendingEncounter = null;

    const handoff = readEncounterHandoff();
    if (handoff?.source === "map" && handoff.mapEncounter?.monsterTokenId === marker.id) {
      localStorage.removeItem(ENCOUNTER_HANDOFF_KEY);
    }
    if (current.tileResolution?.stage === "complete-after-encounter") {
      finalizeTileResolution(current.tileResolution);
    }

    if (outcome.action === "skip-and-backtrack") {
      setCurrentTile(current, outcome.targetTileId);
      current.selected = outcome.targetTileId;
      current.travelRoute = [encounterTileId, outcome.targetTileId];
      addLog(`盗贼 ${definition.level} B：忽略 ${monsterName} 遭遇，怪物保留在 ${tileLabel(tile(encounterTileId))}，队伍无额外时间或威胁退回 ${tileLabel(tile(outcome.targetTileId))}`);
    } else {
      current.encounterSuppressions.push({ markerId: marker.id, tileId: encounterTileId });
      addLog(`盗贼 ${definition.level} B：在 ${tileLabel(tile(encounterTileId))} 忽略 ${monsterName} 遭遇；队伍离开前不再重复触发该怪物`);
    }
    MERCENARY_RULES.advance(state.mercenaries, cardId);
    save(true);
  }

  function consumeCompletedEncounter() {
    const handoff = readEncounterHandoff();
    if (!handoff?.completedEncounter || handoff.source !== "map" || !handoff.mapEncounter) return false;
    const activeCampaign = localStorage.getItem("kfActiveCampaign") || "";
    if (handoff.campaignId && handoff.campaignId !== activeCampaign) return false;
    const kingdom = handoff.mapEncounter.interruptedKingdom;
    if (!state.maps[kingdom]) return false;
    const current = state.maps[kingdom];
    const marker = current.monsters.find(item => item.id === handoff.mapEncounter.monsterTokenId);
    const monsterName = DATA.monsters.find(item => item.id === marker?.monsterId)?.name || handoff.monster || "怪物";
    snapshotMap(current, `完成 ${monsterName} 遭遇`);
    current.monsters = current.monsters.filter(item => item.id !== handoff.mapEncounter.monsterTokenId);
    current.pendingEncounter = null;
    rotateDistrictWheel(current, 1, 1, false);
    addLog(`完成 ${monsterName} 遭遇：移除怪物标记，地区轮盘顺时针移动 1 格，并保留当前地图进度`);
    if (current.tileResolution?.stage === "complete-after-encounter") {
      finalizeTileResolution(current.tileResolution);
    }
    localStorage.removeItem(ENCOUNTER_HANDOFF_KEY);
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  }

  function normalizedMonsterName(value) {
    return String(value || "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "");
  }

  function upstreamKingdom(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (["sk", "sunken", "sunken kingdom"].includes(normalized)) return "SK";
    if (["pos", "stone", "principality of stone"].includes(normalized)) return "POS";
    return "";
  }

  function upstreamMonsterPool() {
    const upstream = window.KF_MAP_UPSTREAM;
    if (!upstream || typeof upstream !== "object") return null;
    const pool = upstream.monsterPool && typeof upstream.monsterPool === "object"
      ? upstream.monsterPool
      : upstream;
    const districts = Array.isArray(pool.districts) ? pool.districts : [];
    const kingdom = upstreamKingdom(pool.kingdom || upstream.kingdom);
    return kingdom && districts.length ? { kingdom, districts } : null;
  }

  function ensureDistrictWheel(current, code) {
    const districtIds = rules(code).districts.map(district => district.id);
    current.districtWheel ||= {};
    current.districtWheelLevels ||= {};
    current.districtWheelLocations ||= {};
    districtIds.forEach(id => {
      if (typeof current.districtWheel[id] !== "string") current.districtWheel[id] = "";
      if (!(id in current.districtWheelLevels)) current.districtWheelLevels[id] = null;
      if (typeof current.districtWheelLocations[id] !== "string") current.districtWheelLocations[id] = "";
    });
  }

  function syncDistrictWheelFromUpstream({ force = false, notify = false } = {}) {
    const pool = upstreamMonsterPool();
    if (!pool || !state.maps[pool.kingdom]) {
      if (notify) toast("上层还没有可用的遭遇战怪物池");
      return false;
    }
    const current = state.maps[pool.kingdom];
    ensureDistrictWheel(current, pool.kingdom);
    current.districtWheelLocations ||= {};
    const ordered = [...pool.districts].sort((left, right) =>
      (Number(left?.district) || Number(left?.index) || 0) - (Number(right?.district) || Number(right?.index) || 0)
    );
    const signature = JSON.stringify([
      pool.kingdom,
      ordered.map(item => [Number(item?.district) || Number(item?.index) || 0, String(item?.name || ""), Number(item?.level) || 0, String(item?.conflictLocation || "")])
    ]);
    if (!force && current.districtWheelSource?.signature === signature) {
      return false;
    }

    const districtIds = rules(pool.kingdom).districts.map(district => district.id);
    const unresolved = [];
    let matched = 0;
    districtIds.forEach((districtId, index) => {
      const assignment = ordered[index];
      const suppliedId = String(assignment?.monsterId || assignment?.id || "");
      const monster = DATA.monsters.find(item => item.id === suppliedId)
        || DATA.monsters.find(item => normalizedMonsterName(item.name) === normalizedMonsterName(assignment?.name));
      current.districtWheel[districtId] = monster?.id || "";
      current.districtWheelLevels[districtId] = monster && Number.isFinite(Number(assignment?.level))
        ? Number(assignment.level)
        : null;
      current.districtWheelLocations[districtId] = monster ? String(assignment?.conflictLocation || "") : "";
      if (monster) matched += 1;
      else if (assignment?.name) unresolved.push(String(assignment.name));
    });
    current.districtWheelSource = {
      signature,
      importedAt: new Date().toISOString(),
      matched,
      total: districtIds.length,
      unresolved,
      manuallyAdjusted: false
    };
    addLog(`从上层遭遇战怪物池填充地区轮盘：${matched}/${current.districtWheelSource.total}`);
    if (notify) {
      toast(unresolved.length
        ? `已填充 ${matched} 个地区；${unresolved.length} 个怪物未匹配`
        : `地区轮盘已从上层填充（${matched} 个地区）`);
    }
    return true;
  }

  function save(shouldRender = false) {
    clearTimeout(saveTimer);
    if (shouldRender) localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    else saveTimer = setTimeout(() => localStorage.setItem(SAVE_KEY, JSON.stringify(state)), 80);
    if (shouldRender) {
      render();
      window.KF_MODULE_BRIDGE?.flush?.();
    }
    if (pendingEncounterAutoStart) {
      pendingEncounterAutoStart = false;
      if (mapState().pendingEncounter) schedulePendingEncounter();
    }
  }

  function saveCritical(shouldRender = true) {
    if (shouldRender) return save(true);
    clearTimeout(saveTimer);
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return window.KF_MODULE_BRIDGE?.flush?.();
  }

  function addLog(text) {
    state.log.unshift({ id: uid(), at: new Date().toISOString(), text });
    state.log = state.log.slice(0, 200);
  }

  function toast(text) {
    const node = $("#toast");
    node.textContent = text;
    node.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { node.hidden = true; }, 2600);
  }

  function snapshot(label) {
    snapshotMap(mapState(), label);
  }

  function snapshotMap(current, label) {
    current.history ||= [];
    current.history.push({
      label,
      map: { ...deepCopy(current), history: [] },
      trackers: deepCopy(state.trackers),
      trackNotes: deepCopy(state.trackNotes),
      mercenaries: deepCopy(state.mercenaries),
      step: state.step,
      round: state.round
    });
    current.history = current.history.slice(-20);
  }

  function undo() {
    const current = mapState();
    const item = current.history?.pop();
    if (!item) return toast("没有可撤销的地图结算");
    const remaining = current.history;
    state.maps[state.kingdom] = { ...item.map, history: remaining };
    state.trackers = normalizeTrackers(item.trackers);
    state.trackNotes = normalizeTrackNotes(item.trackNotes || state.trackNotes);
    state.mercenaries = MERCENARY_RULES.normalizeState(item.mercenaries || state.mercenaries);
    enterStep(item.step);
    state.round = item.round;
    addLog(`撤销：${item.label}`);
    save(true);
  }

  function pathKey(a, b) {
    return [a, b].sort().join("|");
  }

  function pathMarker(a, b) {
    return mapState().pathMarkers.find(item => item.to && pathKey(item.from, item.to) === pathKey(a, b));
  }

  function blocked(a, b) {
    const marker = pathMarker(a, b);
    return marker && marker.type !== "shortcut";
  }

  function linkedIds(id) {
    const linked = new Set(tile(id)?.neighbors || []);
    for (const marker of mapState().pathMarkers) {
      if (marker.type !== "shortcut" || !marker.to) continue;
      if (marker.from === id) linked.add(marker.to);
      if (marker.to === id) linked.add(marker.from);
    }
    return [...linked];
  }

  function tileIsFaceUp(tileId, current = mapState()) {
    return current.placed.includes(tileId)
      && ["revealed", "explored"].includes(current.tileState[tileId]);
  }

  function shortestPath(from, to, { exploredOnly = false, faceUpOnly = false, ignoreBlocking = false } = {}) {
    if (from === to) return [from];
    const current = mapState();
    const allowed = new Set(current.placed.filter(id =>
      (!exploredOnly || current.tileState[id] === "explored")
      && (!faceUpOnly || tileIsFaceUp(id, current))
    ));
    const queue = [[from]];
    const seen = new Set([from]);
    while (queue.length) {
      const route = queue.shift();
      const last = route.at(-1);
      for (const next of linkedIds(last)) {
        if (!allowed.has(next) || seen.has(next) || (!ignoreBlocking && blocked(last, next))) continue;
        const candidate = [...route, next];
        if (next === to) return candidate;
        seen.add(next);
        queue.push(candidate);
      }
    }
    return [];
  }

  function legalUnexplored() {
    const current = mapState();
    return linkedIds(current.current).filter(id =>
      current.placed.includes(id) &&
      current.tileState[id] !== "explored" &&
      !blocked(current.current, id)
    );
  }

  function eligibleFogTargets() {
    const current = mapState();
    const explored = new Set(Object.entries(current.tileState).filter(([, status]) => status === "explored").map(([id]) => id));
    return kingdomData().tiles.filter(item =>
      current.tileState[item.id] !== "explored" &&
      item.neighbors.some(neighbor => explored.has(neighbor))
    ).map(item => item.id);
  }

  function checkLimits() {
    const current = mapState();
    state.trackers = normalizeTrackers(state.trackers);
    const limits = rules().limits;
    const failures = [];
    if (state.trackers.threat > limits.threat) failures.push("威胁轨溢出");
    if (state.trackers.curse > limits.curse) failures.push("诅咒轨溢出");
    if (state.trackers.time > limits.time) failures.push("时间轨溢出");
    current.failed = failures.join("；");
    if (!state.taskMode && state.trackers.time >= 8 && !current.storyQueue.some(item => item.code === "TIME-8")) {
      current.storyQueue.push({ id: uid(), code: "TIME-8", text: "时间 8：检查初步冲突", read: false });
    }
    if (!state.taskMode && state.trackers.time >= 16 && !current.storyQueue.some(item => item.code === "TIME-16")) {
      current.storyQueue.push({ id: uid(), code: "TIME-16", text: "时间 16：检查完全冲突", read: false });
    }
  }

  function tileSize(item) {
    const height = TTS_CARD_HEIGHT * (Number(item.scale) || 1);
    return { width: height * (Number(item.image?.aspect) || .6657), height };
  }

  function ttsAngle(item) {
    const angle = (Number(item.rotation) || 180) - 180;
    return ((angle + 540) % 360) - 180;
  }

  function kingdomTileBounds(item) {
    if (!item || !Number.isFinite(item.x) || !Number.isFinite(item.y)) return null;
    const size = tileSize(item);
    const radians = ttsAngle(item) * Math.PI / 180;
    const halfWidth = Math.abs(Math.cos(radians)) * size.width / 2
      + Math.abs(Math.sin(radians)) * size.height / 2;
    const halfHeight = Math.abs(Math.sin(radians)) * size.width / 2
      + Math.abs(Math.cos(radians)) * size.height / 2;
    return {
      left: item.x - halfWidth,
      right: item.x + halfWidth,
      top: item.y - halfHeight,
      bottom: item.y + halfHeight
    };
  }

  function kingdomTilesAreAdjacent(leftTile, rightTile) {
    const left = kingdomTileBounds(leftTile);
    const right = kingdomTileBounds(rightTile);
    if (!left || !right) return false;
    const horizontalSeparation = Math.max(left.left, right.left) - Math.min(left.right, right.right);
    const verticalSeparation = Math.max(left.top, right.top) - Math.min(left.bottom, right.bottom);
    const horizontalOverlap = -horizontalSeparation;
    const verticalOverlap = -verticalSeparation;
    const edgeTolerance = .2;
    const minimumSharedEdge = .25;
    return (Math.abs(horizontalSeparation) <= edgeTolerance && verticalOverlap >= minimumSharedEdge)
      || (Math.abs(verticalSeparation) <= edgeTolerance && horizontalOverlap >= minimumSharedEdge);
  }

  function adjacentPlacedTileIds(tileId, current = mapState()) {
    const origin = tile(tileId);
    if (!origin) return [];
    return [...new Set(current.placed || [])]
      .filter(id => id !== tileId)
      .filter(id => kingdomTilesAreAdjacent(origin, tile(id)));
  }

  function adjacentFaceUpTileIds(tileId, current = mapState()) {
    return adjacentPlacedTileIds(tileId, current)
      .filter(id => tileIsFaceUp(id, current));
  }

  function partyLocationMarker(tileId) {
    const current = mapState();
    const party = campaignParty();
    const selectedKnight = mainlineKnight();
    const member = selectedKnight
      ? party.find(item => item.id === selectedKnight.sheetId || item.sheetId === selectedKnight.sheetId || item.name === selectedKnight.name)
      : party.find(item => item.type !== "squire") || party[0] || null;
    const knight = selectedKnight || state.knights.find(item =>
      item.sheetId === member?.id
      || item.sheetId === member?.sheetId
      || (!item.sheetId && item.name === member?.name)
    ) || state.knights[0];
    const name = member?.name || knight?.name || "当前队伍";
    const portraitId = member?.type === "squire" ? member.squireId : member?.knightId;
    const saved = current.partyPositions?.[tileId];
    const x = Number.isFinite(saved?.x) ? clamp(saved.x, 0, 100) : 50;
    const y = Number.isFinite(saved?.y) ? clamp(saved.y, 0, 100) : 50;
    return `<span class="party-location-token" role="img" aria-label="当前队伍：${esc(name)}" title="当前队伍：${esc(name)}（可拖动）"
      data-map-token="party" data-token-kind="party" data-token-tile="${esc(tileId)}"
      data-token-x="${x}" data-token-y="${y}" style="left:${x}%;top:${y}%">
      ${portraitId
        ? `<img src="/assets/heroes/${esc(portraitId)}-avatar.jpg" alt="" draggable="false">`
        : `<span class="party-location-fallback" aria-hidden="true">${esc(name.slice(0, 1) || "?")}</span>`}
    </span>`;
  }

  function mapSvg() {
    const current = mapState();
    const all = kingdomData().tiles.filter(item => Number.isFinite(item.x) && Number.isFinite(item.y));
    const shown = all.filter(item => current.showAll || current.placed.includes(item.id));
    const geometrySource = current.showAll ? all : shown;
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
    const legal = new Set(legalUnexplored());
    const randomHighlights = new Set(current.randomTileHighlights || []);
    const cards = shown.map(item => {
      const size = tileSize(item);
      const status = current.tileState[item.id] || "hidden";
      const face = current.showAll || status !== "hidden";
      const source = item.image?.[face ? "face" : "back"] || item.image?.face;
      const monsters = current.monsters.filter(marker => marker.tileId === item.id);
      const tileMarkers = current.tileMarkers.filter(marker => marker.tileId === item.id);
      const pathMarkers = current.pathMarkers.filter(marker => marker.from === item.id || marker.to === item.id);
      const classes = [
        "map-tile",
        current.selected === item.id ? "selected" : "",
        current.current === item.id ? "current" : "",
        legal.has(item.id) && !current.showAll ? "legal" : "",
        status === "revealed" ? "revealed-unexplored" : "",
        randomHighlights.has(item.id) ? "random-highlight" : ""
      ].filter(Boolean).join(" ");
      const angle = ttsAngle(item);
      const mapTokens = [
        ...tileMarkers.map(marker => ({
          record: marker,
          kind: "tile",
          source: markerToken(marker.type),
          label: tileMarkerLabel(marker)
        })),
        ...pathMarkers.map(marker => ({
          record: marker,
          kind: "path",
          source: markerToken(marker.type),
          label: PATH_MARKERS.find(([id]) => id === marker.type)?.[1] || marker.type
        })),
        ...monsters.map(marker => ({
          record: marker,
          kind: "monster",
          source: monsterToken(marker.monsterId),
          label: DATA.monsters.find(monster => monster.id === marker.monsterId)?.name || marker.monsterId
        }))
      ];
      return `<button class="${classes}" data-tile="${esc(item.id)}" title="${esc(tileLabel(item))}"
        data-angle="${angle}"
        style="left:${(item.x - size.width / 2 - minX) / worldWidth * 100}%;top:${(item.y - size.height / 2 - minY) / worldHeight * 100}%;width:${size.width / worldWidth * 100}%;height:${size.height / worldHeight * 100}%;transform:rotate(${angle}deg);--counter-rotation:${-angle}deg">
        <img class="map-tile-image" src="${esc(source)}" alt="${esc(tileLabel(item))}" draggable="false">
        ${current.current === item.id ? partyLocationMarker(item.id) : ""}
        ${mapTokens.map((entry, index) => mapTokenImage(entry.source, entry.label, entry.record, entry.kind, item.id, index)).join("")}
      </button>`;
    }).join("");
    return `<div class="map-stage" style="aspect-ratio:${worldWidth}/${worldHeight}">${cards}</div>`;
  }

  function keepPartyMarkerVisible(board, preferredPoint = null) {
    const marker = board?.querySelector(".party-location-token");
    if (!board || !marker) return;

    let markerRect = marker.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    const markerCenter = {
      x: (markerRect.left + markerRect.right) / 2,
      y: (markerRect.top + markerRect.bottom) / 2
    };
    const target = preferredPoint || {
      x: (boardRect.left + boardRect.right) / 2,
      y: (boardRect.top + boardRect.bottom) / 2
    };
    board.scrollLeft += markerCenter.x - target.x;
    board.scrollTop += markerCenter.y - target.y;

    markerRect = marker.getBoundingClientRect();
    const safeLeft = boardRect.left + MAP_FOCUS_PADDING;
    const safeRight = boardRect.right - MAP_FOCUS_PADDING;
    const safeTop = boardRect.top + MAP_FOCUS_PADDING;
    const safeBottom = boardRect.bottom - MAP_FOCUS_PADDING;
    if (markerRect.left < safeLeft) board.scrollLeft += markerRect.left - safeLeft;
    else if (markerRect.right > safeRight) board.scrollLeft += markerRect.right - safeRight;
    if (markerRect.top < safeTop) board.scrollTop += markerRect.top - safeTop;
    else if (markerRect.bottom > safeBottom) board.scrollTop += markerRect.bottom - safeBottom;
  }

  function setMapZoom(nextZoom) {
    const current = mapState();
    const board = $(".map-board");
    const canvas = board?.querySelector(".map-canvas");
    const marker = board?.querySelector(".party-location-token");
    let visiblePartyPoint = null;
    if (board && marker) {
      const boardRect = board.getBoundingClientRect();
      const markerRect = marker.getBoundingClientRect();
      const visible = markerRect.right > boardRect.left
        && markerRect.left < boardRect.right
        && markerRect.bottom > boardRect.top
        && markerRect.top < boardRect.bottom;
      if (visible) {
        visiblePartyPoint = {
          x: (markerRect.left + markerRect.right) / 2,
          y: (markerRect.top + markerRect.bottom) / 2
        };
      }
    }

    current.autoFocus = false;
    current.zoom = clamp(Number(nextZoom) || MAP_ZOOM_MIN, MAP_ZOOM_MIN, MAP_ZOOM_MAX);
    if (canvas) canvas.style.width = `${current.zoom * 100}%`;
    keepPartyMarkerVisible(board, visiblePartyPoint);
    current.scrollLeft = board?.scrollLeft || 0;
    current.scrollTop = board?.scrollTop || 0;
    $$(".zoom-badge").forEach(badge => badge.replaceChildren(`${Math.round(current.zoom * 100)}%`));
    $$('[data-zoom-slider]').forEach(slider => { slider.value = String(Math.round(current.zoom * 100)); });
    save();
  }

  function focusMapOnCurrent() {
    const current = mapState();
    const board = $(".map-board");
    const canvas = board?.querySelector(".map-canvas");
    const stage = canvas?.querySelector(".map-stage");
    if (!board || !canvas || !stage || current.showAll) return;

    const renderedTiles = [...stage.querySelectorAll("[data-tile]")];
    const currentTile = renderedTiles.find(node => node.dataset.tile === current.current);
    if (!currentTile || !board.clientWidth || !board.clientHeight) return;
    const currentRect = currentTile.getBoundingClientRect();
    const currentCenter = {
      x: (currentRect.left + currentRect.right) / 2,
      y: (currentRect.top + currentRect.bottom) / 2
    };
    const nearbyRadius = Math.max(currentRect.width, currentRect.height) * 2.75;
    const focusTiles = renderedTiles.filter(node => {
      const rect = node.getBoundingClientRect();
      const distance = Math.hypot(
        (rect.left + rect.right) / 2 - currentCenter.x,
        (rect.top + rect.bottom) / 2 - currentCenter.y
      );
      return node === currentTile || distance <= nearbyRadius;
    });

    const stageRect = stage.getBoundingClientRect();
    const tileRects = focusTiles.map(node => node.getBoundingClientRect());
    const bounds = {
      left: Math.min(...tileRects.map(rect => rect.left)),
      right: Math.max(...tileRects.map(rect => rect.right)),
      top: Math.min(...tileRects.map(rect => rect.top)),
      bottom: Math.max(...tileRects.map(rect => rect.bottom))
    };
    const focusWidth = Math.max(1, bounds.right - bounds.left);
    const focusHeight = Math.max(1, bounds.bottom - bounds.top);
    const availableWidth = Math.max(1, board.clientWidth - MAP_FOCUS_PADDING * 2);
    const availableHeight = Math.max(1, board.clientHeight - MAP_FOCUS_PADDING * 2);
    const scale = Math.min(availableWidth / focusWidth, availableHeight / focusHeight);
    const desiredStageWidth = stageRect.width * scale;
    current.zoom = clamp(desiredStageWidth / board.clientWidth, MAP_ZOOM_MIN, MAP_ZOOM_MAX);
    canvas.style.width = `${current.zoom * 100}%`;

    const focusedRects = focusTiles.map(node => node.getBoundingClientRect());
    const focusedBounds = {
      left: Math.min(...focusedRects.map(rect => rect.left)),
      right: Math.max(...focusedRects.map(rect => rect.right)),
      top: Math.min(...focusedRects.map(rect => rect.top)),
      bottom: Math.max(...focusedRects.map(rect => rect.bottom))
    };
    const boardRect = board.getBoundingClientRect();
    board.scrollLeft += (focusedBounds.left + focusedBounds.right) / 2
      - (boardRect.left + boardRect.right) / 2;
    board.scrollTop += (focusedBounds.top + focusedBounds.bottom) / 2
      - (boardRect.top + boardRect.bottom) / 2;
    current.scrollLeft = board.scrollLeft;
    current.scrollTop = board.scrollTop;
    $(".zoom-badge")?.replaceChildren(`${Math.round(current.zoom * 100)}%`);
    $$('[data-zoom-slider]').forEach(slider => { slider.value = String(Math.round(current.zoom * 100)); });
    save();
  }

  function scheduleMapFocus() {
    cancelAnimationFrame(mapFocusFrame);
    if (!mapState().autoFocus || mapState().showAll) return;
    mapFocusFrame = requestAnimationFrame(() => {
      mapFocusFrame = 0;
      focusMapOnCurrent();
    });
  }

  function cardStyle(image, side = "face") {
    if (!image) return "";
    const usesAtlas = side !== "back" || image.uniqueBack === true;
    const cols = usesAtlas ? Math.max(1, Number(image.width) || 1) : 1;
    const rows = usesAtlas ? Math.max(1, Number(image.height) || 1) : 1;
    const index = usesAtlas ? Math.max(0, Number(image.index) || 0) : 0;
    const x = cols > 1 ? (index % cols) / (cols - 1) * 100 : 0;
    const y = rows > 1 ? Math.floor(index / cols) / (rows - 1) * 100 : 0;
    return `--image:url("${image[side] || image.face}");--cols:${cols};--rows:${rows};--x:${x}%;--y:${y}%;--aspect:${image.aspect || .702}`;
  }

  function cardView(image, side = "face", extra = "") {
    return image ? `<div class="rule-card ${extra}" style='${cardStyle(image, side)}'></div>` : '<div class="muted">无卡面</div>';
  }

  function moveHunt(steps = 1) {
    const current = mapState();
    const playerAdjacentTiles = adjacentFaceUpTileIds(current.current, current);
    for (const monster of current.monsters) {
      for (let index = 0; index < steps; index += 1) {
        if (monster.tileId === current.current) break;
        const route = shortestPath(monster.tileId, current.current, { faceUpOnly: true, ignoreBlocking: true });
        if (route.length > 1) {
          monster.tileId = route[1];
          continue;
        }
        if (playerAdjacentTiles.includes(monster.tileId)) break;
        const fallbackTileId = shuffle([...playerAdjacentTiles])[0];
        if (fallbackTileId) {
          monster.tileId = fallbackTileId;
          addLog(`怪物无法沿正面朝上的王国板块接近队伍，随机移动到${tileLabel(tile(fallbackTileId))}`);
        } else {
          addLog("怪物无法沿正面朝上的王国板块移动，且队伍周围没有可用的正面板块");
        }
        break;
      }
      if (monster.tileId === current.current) triggerPendingEncounter(monster.id);
    }
  }

  function spawnThreatSeven(targetTileId, districtOverride = "") {
    const current = mapState();
    if (current.threatSevenSpawned) return true;
    ensureDistrictWheel(current, state.kingdom);
    const district = rules().districts.some(item => item.id === districtOverride)
      ? districtOverride
      : currentMapDistrict();
    const monsterId = district ? current.districtWheel[district] : "";
    const adjacentTiles = adjacentFaceUpTileIds(current.current, current);
    const target = adjacentTiles.includes(targetTileId) ? targetTileId : adjacentTiles[0];
    const districtName = rules().districts.find(item => item.id === district)?.name || "未识别地区";
    const monsterName = DATA.monsters.find(item => item.id === monsterId)?.name || "未指定怪物";

    if (!district || !monsterId || !target) {
      current.threatSevenPending = true;
      const reason = !district
        ? "当前板块地区未确定"
        : !monsterId
          ? `${districtName}在地区轮盘上没有怪物`
          : "当前板块没有正面朝上的相邻王国板块";
      addLog(`威胁首次达到 7+，但未生成怪物：${reason}`);
      toast(reason);
      return false;
    }

    const existingCount = current.monsters.filter(item => item.monsterId === monsterId).length;
    if (existingCount) current.monsters = current.monsters.filter(item => item.monsterId !== monsterId);
    current.monsters.push({ id: uid(), monsterId, tileId: target, source: "threat-seven" });
    current.threatSevenSpawned = true;
    current.threatSevenPending = false;
    addLog(`威胁首次达到 7+：当前板块属于${districtName}，按地区轮盘将${monsterName}${existingCount ? "从原位置移除并重新" : ""}生成到${tileLabel(tile(target))}`);
    return true;
  }

  function changeThreat(amount, deferHunt = false) {
    const current = mapState();
    const before = trackerValue(state.trackers.threat);
    const after = trackerValue(before + Number(amount || 0));
    state.trackers.threat = after;
    let huntSteps = 0;
    for (const [cell, steps] of Object.entries(THREAT_HUNT)) {
      if (before < Number(cell) && after >= Number(cell)) huntSteps += Number(steps) || 1;
    }
    if (before < 7 && after >= 7 && !current.threatSevenSpawned) current.threatSevenPending = true;
    if (deferHunt && current.tileResolution) current.tileResolution.huntSteps = (current.tileResolution.huntSteps || 0) + huntSteps;
    else if (huntSteps) moveHunt(huntSteps);
    checkLimits();
  }

  function monsterStepRequired(current = mapState()) {
    const threatSpawnDue = !current.threatSevenSpawned
      && (current.threatSevenPending || state.trackers.threat >= 7);
    return current.monsters.some(monster => Boolean(monster?.tileId)) || threatSpawnDue;
  }

  function beginTile(id) {
    const current = mapState();
    const item = tile(id);
    if (!item) return toast("目标板块不存在");
    const back = item?.rules?.back || {};
    snapshot(`前往 ${tileLabel(tile(id))}`);
    current.placed = [...new Set([...current.placed, id])];
    current.tileState[id] ||= "hidden";
    current.selected = id;
    current.travelRoute = [current.current, id];
    current.tileResolution = {
      tileId: id,
      stage: "back",
      backTime: typeof back.time === "number" ? back.time : 0,
      backThreat: typeof back.threat === "number" ? back.threat : 0,
      backClues: typeof back.clues === "number" ? back.clues : 0,
      backFogIntensity: typeof back.fogIntensity === "number" ? back.fogIntensity : 0,
      backIconTags: [...(back.iconTags || [])],
      backNotes: back.pathNotes || "",
      frontTime: 0,
      frontThreat: 0,
      frontClues: 0,
      district: item?.rules?.region || "",
      poi: "",
      code: "",
      notes: ""
    };
    enterStep(1);
    addLog(`开始结算 ${tileLabel(tile(id))}`);
    save(true);
  }

  function advanceTileResolution() {
    const current = mapState();
    const pending = current.tileResolution;
    if (!pending) return;
    if (pendingClueDirections().length) resolvePendingClueDirections();
    if (pending.stage === "back") {
      const clueResult = collectTileClues(pending.backClues, `${tileLabel(tile(pending.tileId))} 背面`);
      if (clueResult.blocked) return toast(clueResult.message);
      state.trackers.time += Number(pending.backTime) || 0;
      changeThreat(pending.backThreat, true);
      pending.stage = clueResult.pending ? "back-clues" : "resolve";
    } else if (pending.stage === "back-clues") {
      if (pendingClueDirections().length) return toast("请先按轻型伤亡牌确认全部额外线索方向");
      pending.stage = "resolve";
    } else if (["resolve", "flip", "spawn", "hunt", "front"].includes(pending.stage)) {
      const startingStage = pending.stage;

      if (["resolve", "flip"].includes(startingStage)) {
        revealMapTile(current, pending.tileId);
        setCurrentTile(current, pending.tileId);
      }
      if (startingStage === "spawn") placeConnectedTiles(current, pending.tileId);

      const splitAfterBc = ["resolve", "flip", "spawn"].includes(startingStage) && monsterStepRequired(current);
      if (splitAfterBc) {
        pending.monsterStepSplit = true;
        pending.stage = "hunt";
        addLog(`完成板块步骤 b-c：${tileLabel(tile(pending.tileId))}；等待结算 d-e`);
      } else {
        if (["resolve", "flip", "spawn", "hunt"].includes(startingStage)) {
          if (pending.huntSteps) moveHunt(pending.huntSteps);
          if ((current.threatSevenPending || state.trackers.threat >= 7) && !current.threatSevenSpawned) {
            spawnThreatSeven(pending.spawnTileId, pending.district);
          }
        }

        if (current.pendingEncounter) pending.stage = "complete-after-encounter";
        else finalizeTileResolution(pending);
      }
    } else if (pending.stage === "front-clues") {
      if (pendingClueDirections().length) return toast("请先按轻型伤亡牌确认全部额外线索方向");
      finalizeTileResolution(pending);
    }
    save(true);
  }

  function finalizeTileResolution(pending) {
    const current = mapState();
    current.tileMeta ||= {};
    current.tileMeta[pending.tileId] = {
      backTime: Number(pending.backTime) || 0,
      backThreat: Number(pending.backThreat) || 0,
      backClues: Number(pending.backClues) || 0,
      backFogIntensity: Number(pending.backFogIntensity) || 0,
      frontTime: Number(pending.frontTime) || 0,
      frontThreat: Number(pending.frontThreat) || 0,
      frontClues: Number(pending.frontClues) || 0,
      district: pending.district,
      poi: pending.poi,
      code: pending.code,
      notes: pending.notes
    };
    current.tileState[pending.tileId] = "explored";
    addLog(`完成板块结算：${tileLabel(tile(pending.tileId))}`);
    current.tileResolution = null;
    enterStep(2);
    checkLimits();
  }

  function resolveBacktrack(target) {
    const current = mapState();
    if (state.step !== 0 || current.fog.active) return toast("请先完成当前步骤，再结算走回头路");
    const route = shortestPath(current.current, target, { exploredOnly: true });
    if (route.length < 2) return toast("所选目标没有合法的已探索路线");
    snapshot(`走回头路至 ${tileLabel(tile(target))}`);
    current.travelRoute = route;
    setCurrentTile(current, target);
    state.trackers.time += 1;
    changeThreat(Math.max(0, route.length - 2));
    enterStep(2);
    addLog(`走回头路：${route.map(id => tileLabel(tile(id))).join(" → ")}；时间 +1，额外威胁 +${Math.max(0, route.length - 2)}`);
    save(true);
  }

  function explorationTopBack() {
    const top = card(mapState().exploration.deck[0]);
    return top ? cardView(top.image, "back") : '<div class="alert danger">探索牌组为空：远征失败</div>';
  }

  function travelDirectionKey() {
    const route = mapState().travelRoute;
    if (route.length < 2) return "";
    const from = tile(route.at(-2));
    const to = tile(route.at(-1));
    if (!from || !to) return "";
    const pathDirection = from.rules?.paths?.find(path => path.target === to.id)?.direction;
    const exactDirection = { N: "north", E: "east", S: "south", W: "west" }[pathDirection];
    if (exactDirection) return exactDirection;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "east" : "west";
    return dy >= 0 ? "south" : "north";
  }

  function directionName(direction) {
    return DIRECTIONS.find(([id]) => id === direction)?.[1] || "未记录";
  }

  function randomExtraClueDirection(randomValue = Math.random()) {
    const totalWeight = EXTRA_CLUE_DIRECTION_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);
    const normalized = Number.isFinite(Number(randomValue))
      ? Math.min(1 - Number.EPSILON, Math.max(0, Number(randomValue)))
      : 0;
    let ticket = normalized * totalWeight;
    for (const [direction, weight] of EXTRA_CLUE_DIRECTION_WEIGHTS) {
      if (ticket < weight) return direction;
      ticket -= weight;
    }
    return EXTRA_CLUE_DIRECTION_WEIGHTS.at(-1)[0];
  }

  function clueName(clueType) {
    return CLUES.find(([id]) => id === clueType)?.[1] || "未知线索";
  }

  function travelDirection() {
    return directionName(travelDirectionKey());
  }

  function pendingClueDirections() {
    const exp = mapState().exploration;
    exp.pendingClueDirections ||= [];
    return exp.pendingClueDirections;
  }

  function knightMatchesClue(knight, clueType) {
    if (knight.id === state.mainKnightId) return false;
    if (state.taskMode && knight.task) return knight.task === clueType;
    return knight.primary === clueType || knight.secondary === clueType;
  }

  function awardClueType(clueType, { direction, source, cardId, ordinal = 1 }) {
    const recipients = state.knights.filter(knight => knightMatchesClue(knight, clueType));
    recipients.forEach(knight => {
      knight.clues[clueType] = Math.max(0, Number(knight.clues[clueType]) || 0) + 1;
    });
    const result = {
      id: uid(),
      clueType,
      direction,
      source,
      cardId,
      ordinal,
      recipients: recipients.map(knight => knight.name),
      at: new Date().toISOString()
    };
    mapState().exploration.lastClueResolution = result;
    addLog(`${source}第 ${ordinal} 枚线索：${directionName(direction)}向为${clueName(clueType)}；${recipients.length ? `${recipients.map(knight => knight.name).join("、")}各获得 1 枚` : "没有队伍成员的线索需求匹配"}`);
    return result;
  }

  function collectTileClues(amount, source) {
    const count = Math.max(0, Math.trunc(Number(amount) || 0));
    if (!count) return { blocked: false, pending: 0 };
    const direction = travelDirectionKey();
    if (!direction) return { blocked: true, pending: 0, message: "没有最近旅行方向，无法按探索卡背确定线索" };
    const exp = mapState().exploration;
    const topCard = card(exp.deck[0]);
    if (!topCard || topCard.special || topCard.blankBack) {
      return { blocked: true, pending: 0, message: "探索卡组顶部不是普通探索卡；请先按规则结算或洗走特殊探索卡" };
    }
    const clueType = topCard.cluesByDirection?.[direction];
    if (!clueType) return { blocked: true, pending: 0, message: "顶部探索卡缺少该方向的线索标注" };
    if (count > 1 && EXTRA_CLUE_DIRECTION_WEIGHTS.some(([extraDirection]) => !topCard.cluesByDirection?.[extraDirection])) {
      return { blocked: true, pending: 0, message: "顶部探索卡缺少额外线索所需的方向标注" };
    }

    awardClueType(clueType, { direction, source, cardId: topCard.id, ordinal: 1 });
    const extraDirections = [];
    for (let ordinal = 2; ordinal <= count; ordinal += 1) {
      const extraDirection = randomExtraClueDirection();
      extraDirections.push(extraDirection);
      awardClueType(topCard.cluesByDirection[extraDirection], {
        direction: extraDirection,
        source,
        cardId: topCard.id,
        ordinal
      });
    }
    if (extraDirections.length) {
      addLog(`${source}额外 ${extraDirections.length} 枚线索按上／下／左／右 = 1／1／1／1 随机产生方向：${extraDirections.map(directionName).join("、")}`);
    }
    return { blocked: false, pending: 0, directions: [direction, ...extraDirections] };
  }

  function resolvePendingClueDirections() {
    const exp = mapState().exploration;
    const pending = [...pendingClueDirections()];
    if (!pending.length) return 0;
    const resolvedDirections = [];
    for (const item of pending) {
      const clueCard = card(item.cardId);
      const direction = randomExtraClueDirection();
      const clueType = clueCard?.cluesByDirection?.[direction];
      if (clueType) {
        awardClueType(clueType, {
          direction,
          source: item.source,
          cardId: item.cardId,
          ordinal: item.ordinal
        });
        resolvedDirections.push(direction);
      } else {
        addLog(`${item.source}第 ${item.ordinal} 枚线索无法自动结算：探索卡缺少${directionName(direction)}向标注`);
      }
    }
    exp.pendingClueDirections = [];
    addLog(`旧存档的 ${pending.length} 枚额外线索已按上／下／左／右 = 1／1／1／1 自动产生方向${resolvedDirections.length ? `：${resolvedDirections.map(directionName).join("、")}` : ""}`);
    return pending.length;
  }

  function pendingCluePanel() {
    const pending = pendingClueDirections();
    if (!pending.length) return "";
    return `<div class="alert">
      <strong>旧存档额外线索待自动结算</strong>
      <p class="tiny">继续当前板块结算后，将按上／下／左／右 = 1／1／1／1 自动产生方向。</p>
    </div>`;
  }

  function travelPanel() {
    const current = mapState();
    const legal = legalUnexplored();
    const explored = current.placed.filter(id => id !== current.current && current.tileState[id] === "explored");
    const startId = current.startingTile || kingdomData().start;
    const sizeOrder = { S: 0, M: 1, LS: 2, L: 3, EL: 4, EXTRA: 5 };
    const startTiles = [...kingdomData().tiles].sort((left, right) =>
      (sizeOrder[left.size] ?? 99) - (sizeOrder[right.size] ?? 99)
      || Number(left.number) - Number(right.number)
    );
    return `<section class="panel">
      <div class="panel-header"><div><div class="eyebrow">TRAVEL</div><h3>旅行</h3></div><span class="badge gold">当前位置 ${esc(tileLabel(tile(current.current)))}</span></div>
      <div class="fields">
        <label>起始板块<select id="startingTileSelect">${startTiles.map(item => `<option value="${esc(item.id)}" ${item.id === startId ? "selected" : ""}>${esc(tileLabel(item))}${item.id === startId ? " · 当前起点" : ""}</option>`).join("")}</select></label>
        <button id="applyStartingTile" class="secondary">以此板块重新开局</button>
      </div>
      <p class="tiny">更换起点会以所选板块为已探索板块，只生成它和相邻板块；不会作为游戏中的任意传送。</p>
      <p class="muted">绿色高亮板块可直接前往。单击只选中，双击才启动板块结算。</p>
      <div class="legend">${legal.map(id => `<button class="small" data-begin="${esc(id)}">${esc(tileLabel(tile(id)))}</button>`).join("") || '<span class="muted">没有可直接前往的未探索板块</span>'}</div>
      <div class="travel-action-list">
        <div class="travel-action-row">
          <label>走回头路目标<select id="backtrackTarget"><option value="">选择已探索板块</option>${explored.map(id => `<option value="${esc(id)}">${esc(tileLabel(tile(id)))}</option>`).join("")}</select></label>
          <button id="backtrackButton" class="secondary">结算走回头路</button>
        </div>
        <div class="travel-action-row">
          <label>弥雾目标<select id="fogTarget"><option value="">选择未探索板块</option>${eligibleFogTargets().map(id => `<option value="${esc(id)}">${esc(tileLabel(tile(id)))}</option>`).join("")}</select></label>
          <button id="startFogButton" class="secondary">进入弥雾</button>
        </div>
      </div>
      <div class="toolbar"><button id="skipTravelButton" class="secondary" ${canSkipTravelStep() ? "" : "disabled"}>跳过移动</button></div>
      ${current.travelRoute.length ? `<p class="tiny">最近路线：${current.travelRoute.map(id => esc(tileLabel(tile(id)))).join(" → ")}</p>` : ""}
    </section>`;
  }

  function tileResolutionPanel() {
    const pending = mapState().tileResolution;
    if (!pending) return "";
    const current = mapState();
    const labels = {
      back: "a. 结算板块背面全部图标",
      "back-clues": "a. 结算背面额外线索",
      resolve: "b-e. 完成板块正面流程",
      flip: "b-e. 完成板块正面流程",
      spawn: "b-e. 完成板块正面流程",
      hunt: "d-e. 结算怪物与板块正面流程",
      front: "b-e. 完成板块正面流程",
      "front-clues": "e. 结算正面额外线索",
      "complete-after-encounter": "b-e. 等待遭遇战结算"
    };
    const item = tile(pending.tileId);
    const resolvingClues = pending.stage === "back-clues" || pending.stage === "front-clues";
    const resolvingFront = ["resolve", "flip", "spawn", "hunt", "front"].includes(pending.stage);
    const waitingEncounter = pending.stage === "complete-after-encounter";
    const splittingBc = ["resolve", "flip", "spawn"].includes(pending.stage) && monsterStepRequired(current);
    const resolvingDe = pending.stage === "hunt";
    const threatSevenDue = resolvingDe
      && !current.threatSevenSpawned
      && (current.threatSevenPending || state.trackers.threat >= 7);
    const stageLabel = splittingBc ? "b-c. 翻开板块、移动队伍并放置连接板块" : labels[pending.stage];
    const waitingSteps = pending.monsterStepSplit ? "d-e" : "b-e";
    const adjacentTiles = adjacentFaceUpTileIds(pending.tileId, current);
    const selectedSpawnTile = adjacentTiles.includes(pending.spawnTileId) ? pending.spawnTileId : adjacentTiles[0] || "";
    const pendingDistrictName = rules().districts.find(district => district.id === pending.district)?.name || "未识别地区";
    const pendingMonsterId = mapState().districtWheel[pending.district] || "";
    const pendingMonsterName = DATA.monsters.find(monster => monster.id === pendingMonsterId)?.name || "地区轮盘未指定";
    return `<section class="panel resolution">
      <div class="panel-header"><div><div class="eyebrow">KINGDOM TILE</div><h3>${esc(stageLabel)}</h3></div><span class="badge gold">${esc(tileLabel(item))}</span></div>
      ${cardView(item.image, pending.stage.startsWith("back") ? "back" : "face", "tile-card")}
      ${pending.stage === "back" ? `<div class="fields">
        <label>时间<input id="backTime" type="number" min="0" value="${pending.backTime}"></label>
        <label>威胁<input id="backThreat" type="number" min="-1" value="${pending.backThreat}"></label>
        <label>线索<input id="backClues" type="number" min="0" value="${pending.backClues}"></label>
        <label>弥雾浓度<input id="backFogIntensity" type="number" min="0" value="${pending.backFogIntensity}"></label>
      </div>${pending.backNotes ? `<p class="tiny">人工标注：${esc(pending.backNotes)}</p>` : ""}` : ""}
      ${resolvingFront ? `<div class="resolution-sequence">
        <div><strong>b.</strong><span>翻开板块并移动队伍</span></div>
        <div><strong>c.</strong><span>放置其他路径相连板块</span></div>
        <div><strong>d.</strong><span>结算遭遇战怪物生成和移动</span></div>
        <div><strong>e.</strong><span>结算板块正面全部图标</span></div>
      </div>${splittingBc ? `<div class="alert"><strong>步骤 d 待结算：</strong>${current.monsters.length ? `地图上有 ${current.monsters.length} 个怪物` : "需要生成怪物"}，完成 b-c 后继续结算 d-e。</div>` : ""}${threatSevenDue ? `<div class="alert"><strong>首次威胁 7+：</strong>当前为${esc(pendingDistrictName)}，地区轮盘对应<strong>${esc(pendingMonsterName)}</strong>。先移动其他怪物，再生成此怪物。</div>
      <label>7+ 怪物生成位置（正面相邻板块）<select id="threatSevenSpawnTile">${adjacentTiles.length ? adjacentTiles.map(id => `<option value="${esc(id)}" ${id === selectedSpawnTile ? "selected" : ""}>${esc(tileLabel(tile(id)))}</option>`).join("") : '<option value="">没有可用的正面相邻板块</option>'}</select></label>` : ""}` : ""}
      ${waitingEncounter ? `<div class="alert">${waitingSteps} 已提交，正在等待遭遇战结算；返回地图后会自动完成板块步骤。</div>` : ""}
      ${!resolvingFront && !waitingEncounter && pending.stage !== "back" && !resolvingClues ? '<p class="muted">按规则顺序确认这一项后才能继续。</p>' : ""}
      ${resolvingClues ? pendingCluePanel() : ""}
      <div class="toolbar"><button id="advanceTileButton" ${waitingEncounter ? "disabled" : ""}>${waitingEncounter ? "等待遭遇战返回" : splittingBc ? "完成 b-c，进入 d-e" : resolvingDe ? "完成 d-e" : resolvingFront ? "一次完成 b-e" : pending.stage === "front-clues" ? "完成板块结算" : "完成 a，显示 b-e"}</button><button id="cancelTileButton" class="danger">取消并撤销</button></div>
    </section>`;
  }

  function unshownKingdomTiles(size = "") {
    const placed = new Set(mapState().placed || []);
    return kingdomData().tiles.filter(item => !placed.has(item.id) && (!size || item.size === size));
  }

  function randomKingdomTilePool(size = "") {
    const current = mapState();
    return kingdomData().tiles.filter(item =>
      (current.tileState[item.id] || "hidden") === "hidden" && (!size || item.size === size)
    );
  }

  function showKingdomTiles(tileIds, label = "展示王国板块", options = {}) {
    const current = mapState();
    const placed = new Set(current.placed || []);
    const items = [...new Set(tileIds)]
      .map(id => tile(id))
      .filter(item => item && (options.includePlacedHidden
        ? (current.tileState[item.id] || "hidden") === "hidden"
        : !placed.has(item.id)));
    if (!items.length) return toast("没有可展示的未揭示板块");

    snapshot(`${label}：${items.map(tileLabel).join("、")}`);
    items.forEach(item => {
      if (!placed.has(item.id)) current.placed.push(item.id);
      current.tileState[item.id] ||= "hidden";
    });
    current.placed = [...new Set(current.placed)];
    if (options.highlightRandom) current.randomTileHighlights = items.map(item => item.id);
    current.selected = items[0].id;
    current.showAll = false;
    addLog(`${label}：${items.map(tileLabel).join("、")}（背面朝上${options.highlightRandom ? "，紫框标记" : ""}）`);
    save(true);
  }

  function showKingdomTilesPanel() {
    const available = unshownKingdomTiles();
    const randomAvailable = randomKingdomTilePool();
    const sizes = [...new Set(kingdomData().tiles.map(item => item.size))];
    const counts = Object.fromEntries(sizes.map(size => [size, randomKingdomTilePool(size).length]));
    const defaultSize = sizes.find(size => counts[size] > 0) || sizes[0] || "";
    const specificDisabled = available.length ? "" : "disabled";
    const randomDisabled = randomAvailable.length ? "" : "disabled";
    return `<section class="panel kingdom-tile-show-panel">
      <div class="panel-header"><div><div class="eyebrow">SHOW KINGDOM TILES</div><h3>展示王国板块</h3></div><div class="legend"><span class="badge">未上图 ${available.length}</span><span class="badge random-highlight-badge">随机池 ${randomAvailable.length}</span></div></div>
      <p class="muted">指定未上图的板块，或从仍未揭示的同类型板块中随机抽取；随机池包含地图上已经背面朝上的板块。本次随机结果会以紫色框标记，且仍保持背面朝上。</p>
      <div class="kingdom-tile-show-grid">
        <div class="kingdom-tile-show-group">
          <strong>指定板块</strong>
          <div class="kingdom-tile-show-row">
            <label>板块<select id="showKingdomTileSelect" ${specificDisabled}>${available.length
              ? available.map(item => `<option value="${esc(item.id)}">${esc(tileLabel(item))}</option>`).join("")
              : '<option value="">已全部展示</option>'}</select></label>
            <button id="showSpecificKingdomTile" ${specificDisabled}>展示</button>
          </div>
        </div>
        <div class="kingdom-tile-show-group">
          <strong>随机展示</strong>
          <div class="kingdom-tile-show-row random">
            <label>类型<select id="showKingdomTileType" ${randomDisabled}>${sizes.map(size => `<option value="${esc(size)}" ${size === defaultSize ? "selected" : ""}>${esc(size)}（${counts[size]}）</option>`).join("")}</select></label>
            <label>数量<input id="showKingdomTileCount" type="number" min="1" max="${Math.max(1, counts[defaultSize] || 1)}" value="1" ${randomDisabled}></label>
            <button id="showRandomKingdomTiles" ${randomDisabled}>随机展示</button>
          </div>
          <p id="showKingdomTileAvailable" class="tiny">${defaultSize ? `${esc(defaultSize)} 类型随机池 ${counts[defaultSize]} 块` : "没有可用类型"}</p>
        </div>
      </div>
    </section>`;
  }

  function selectedTilePanel() {
    const current = mapState();
    const selected = tile(current.selected);
    const status = current.tileState[selected.id] || "hidden";
    const back = selected.rules?.back || {};
    const region = rules().districts.find(item => item.id === selected.rules?.region);
    return `<section class="panel">
      <div class="panel-header"><div><div class="eyebrow">SELECTED TILE</div><h3>${esc(tileLabel(selected))}</h3></div><span class="badge ${status === "explored" ? "green" : ""}">${status === "hidden" ? "面朝下未探索" : status === "revealed" ? "已揭示未探索" : "已探索"}</span></div>
      ${cardView(selected.image, current.showAll || status !== "hidden" ? "face" : "back", "tile-card")}
      <div class="legend">
        <span class="badge">时间 ${Number(back.time) || 0}</span>
        <span class="badge">威胁 ${typeof back.threat === "number" ? back.threat : 0}</span>
        <span class="badge">线索 ${Number(back.clues) || 0}</span>
        <span class="badge">弥雾 ${Number(back.fogIntensity) || 0}</span>
        ${region ? `<span class="badge gold">${esc(region.name)}</span>` : ""}
      </div>
      <div class="toolbar">
        <button id="selectedBeginButton">开始板块结算</button>
        <button id="earlyRevealButton" class="secondary" ${status === "hidden" && !current.showAll ? "" : "disabled"}>提前揭示</button>
        <button id="forceMovePartyButton" class="secondary" ${selected.id === current.current ? "disabled" : ""}>强制移动队伍至此</button>
      </div>
    </section>`;
  }

  function markerPanel() {
    const current = mapState();
    const selected = tile(current.selected);
    return `<section class="panel">
      <div class="panel-header"><div><div class="eyebrow">MARKERS</div><h3>阻挡、捷径与板块标记</h3></div></div>
      <div class="fields">
        <label>路径标记<select id="pathMarkerType">${PATH_MARKERS.map(([id, name]) => `<option value="${id}">${name}</option>`).join("")}</select></label>
        <button id="addPathMarker" class="secondary">添加到当前板块</button>
        <label>板块标记<select id="tileMarkerType">${TILE_MARKERS.map(([id, name]) => `<option value="${id}">${name}</option>`).join("")}</select></label>
        <button id="addTileMarker" class="secondary">添加板块标记</button>
        <label>自定义标记文字<input id="customMarkerText" maxlength="${CUSTOM_MARKER_MAX_LENGTH}" placeholder="例如：宝箱"></label>
        <button id="addCustomTileMarker" class="secondary">添加文字标记</button>
      </div>
      <div class="list">
        ${current.pathMarkers.map(item => `<div class="list-row"><span class="token-label">${tokenImage(markerToken(item.type), PATH_MARKERS.find(([id]) => id === item.type)?.[1] || item.type)}<span>${esc(PATH_MARKERS.find(([id]) => id === item.type)?.[1] || item.type)}：${esc(tileLabel(tile(item.from)))}${item.to ? ` ↔ ${esc(tileLabel(tile(item.to)))}` : ""}</span></span><button class="small danger" data-remove-path="${item.id}">删除</button></div>`).join("")}
        ${current.tileMarkers.map(item => `<div class="list-row"><span class="token-label">${tileMarkerPreview(item)}<span>${item.type === "custom" ? "自定义标记" : esc(tileMarkerLabel(item))}：${esc(item.type === "custom" ? `${tileMarkerLabel(item)} · ${tileLabel(tile(item.tileId))}` : tileLabel(tile(item.tileId)))}</span></span><button class="small danger" data-remove-tile-marker="${item.id}">删除</button></div>`).join("")}
      </div>
    </section>`;
  }

  function scoutingState(exp = mapState().exploration) {
    exp.scouting ||= { surveyAddedCount: 0, lastPeek: [], reordering: false };
    exp.scouting.surveyAddedCount = Math.max(0, Number(exp.scouting.surveyAddedCount) || 0);
    if (!Array.isArray(exp.scouting.lastPeek)) exp.scouting.lastPeek = [];
    exp.scouting.reordering = exp.scouting.reordering === true;
    return exp.scouting;
  }

  function clearScoutingPeek(exp = mapState().exploration) {
    const scouting = scoutingState(exp);
    scouting.lastPeek = [];
    scouting.reordering = false;
  }

  function containSameCards(left, right) {
    if (left.length !== right.length) return false;
    const counts = new Map();
    left.forEach(id => counts.set(id, (counts.get(id) || 0) + 1));
    for (const id of right) {
      const remaining = counts.get(id) || 0;
      if (!remaining) return false;
      counts.set(id, remaining - 1);
    }
    return true;
  }

  function surveyExplorationCards() {
    return rules().specialExploration.filter(item => item.special && /survey/i.test(item.name || ""));
  }

  function explorationCardsInUse(exp) {
    return new Set([
      ...exp.deck,
      ...exp.discard,
      exp.current,
      exp.activeEffect,
      ...Object.values(exp.districtEffects || {})
    ].filter(Boolean));
  }

  function addSpecialExplorationCards(sourceCards, count = Infinity) {
    const exp = mapState().exploration;
    const existing = explorationCardsInUse(exp);
    const additions = sourceCards
      .map(item => item.id)
      .filter(id => !existing.has(id))
      .slice(0, Math.max(0, Number(count) || 0));
    if (!additions.length) return [];
    exp.deck.push(...additions);
    safeShuffleExploration();
    return additions;
  }

  function scoutingPanel() {
    const current = mapState();
    const exp = current.exploration;
    const mercenaryPending = Boolean(state.mercenaries.pendingAction);
    const scouting = scoutingState(exp);
    const deckLocked = mercenaryPending || scouting.reordering;
    const start = tile(current.startingTile);
    const startNeighbors = (start?.neighbors || []).filter(id => tile(id));
    const surveys = surveyExplorationCards();
    const existing = explorationCardsInUse(exp);
    const availableSurveyCount = surveys.filter(item => !existing.has(item.id)).length;
    const lastPeek = scouting.lastPeek.map(id => card(id)).filter(Boolean);
    const defaultPeekCount = Math.min(3, Math.max(1, exp.deck.length));
    return `<section class="panel">
      <div class="panel-header"><div><div class="eyebrow">SCOUTING</div><h3>斥候操作</h3></div><span class="badge">Survey ${surveys.length - availableSurveyCount}/${surveys.length}</span></div>
      <div class="fields">
        <label>起始相邻板块<select id="scoutRevealTile">${startNeighbors.map(id => `<option value="${esc(id)}">${esc(tileLabel(tile(id)))}</option>`).join("")}</select></label>
        <button id="scoutRevealNeighbor" class="secondary" ${startNeighbors.length && !deckLocked ? "" : "disabled"}>揭示为未探索</button>
      </div>
      <div class="toolbar">
        <button id="scoutPeekTop3" class="small secondary" ${exp.deck.length && !deckLocked ? "" : "disabled"}>查看牌顶 3 张正面</button>
        ${[1, 2, 3].map(count => `<button class="small secondary" data-add-survey="${count}" ${availableSurveyCount >= count && !deckLocked ? "" : "disabled"}>洗入 ${count} 张 Survey</button>`).join("")}
      </div>
      <div class="fields scouting-reorder-fields">
        <label>自由查看数量<input id="scoutReorderCount" type="number" min="1" max="${Math.max(1, exp.deck.length)}" step="1" value="${defaultPeekCount}" ${deckLocked ? "disabled" : ""}></label>
        <button id="scoutStartReorder" class="secondary" ${exp.deck.length && !deckLocked ? "" : "disabled"}>查看并调整顺序</button>
      </div>
      ${lastPeek.length ? `
        <div class="scouting-peek-header"><strong>${scouting.reordering ? "调整牌顶顺序" : "牌顶正面"}</strong><span class="badge">${lastPeek.length} 张</span></div>
        <div class="scouting-peek-grid">${lastPeek.map((item, index) => `<div class="scouting-peek-card">
          <div class="scouting-peek-order"><span class="badge">第 ${index + 1} 张</span>${scouting.reordering ? `<span class="scouting-order-buttons">
            <button type="button" class="small secondary icon-button" data-scout-move="${index}" data-scout-offset="-1" title="上移" aria-label="将第 ${index + 1} 张牌上移" ${index ? "" : "disabled"}>&#8593;</button>
            <button type="button" class="small secondary icon-button" data-scout-move="${index}" data-scout-offset="1" title="下移" aria-label="将第 ${index + 1} 张牌下移" ${index < lastPeek.length - 1 ? "" : "disabled"}>&#8595;</button>
          </span>` : ""}</div>
          ${cardView(item.image, "face")}
          <strong class="scouting-card-name">${esc(item.name)}</strong>
        </div>`).join("")}</div>
        <div class="toolbar scouting-peek-actions">${scouting.reordering
          ? '<button id="scoutConfirmReorder" class="small">按当前顺序放回</button><button id="scoutCancelReorder" class="small secondary">取消调整</button>'
          : '<button id="scoutClosePeek" class="small secondary">收起</button>'}
        </div>
      ` : ""}
    </section>`;
  }

  function explorationPanel() {
    const current = mapState();
    const exp = current.exploration;
    const mercenaryPending = state.mercenaries.pendingAction;
    const scoutingReorderPending = scoutingState(exp).reordering;
    const deckLocked = mercenaryPending || scoutingReorderPending;
    exp.pendingClueDirections ||= [];
    const active = card(exp.current);
    const top = card(exp.deck[0]);
    const shown = active || top;
    const direction = travelDirectionKey();
    const directionalClue = top?.cluesByDirection?.[direction] || "";
    const selectedEffectType = explorationEffectType(active);
    const selectedEffectDistrict = explorationEffectDistrict();
    const primaryActionId = active ? "resolveExploration" : "drawExploration";
    const primaryActionLabel = active ? "确认效果" : "抽牌";
    const primaryActionDisabled = active
      ? state.step !== 2 || mercenaryPending
      : state.step !== 2 || exp.resolvedRound === state.round || !top || deckLocked;
    return `<section class="panel">
      <div class="panel-header"><div><div class="eyebrow">EXPLORATION DECK</div><h3>探索牌与兴趣点</h3></div><span class="badge">${exp.deck.length} 张 · 弃 ${exp.discard.length}</span></div>
      ${shown ? cardView(shown.image, active || exp.peek ? "face" : "back") : '<div class="alert danger">牌组为空：远征失败</div>'}
      <p class="tiny">${active ? `${esc(active.name)}${active.special ? " · 特殊探索牌：结算后继续抽牌" : ""}` : "顶部只显示背面；兴趣点可以看正面但不抽走。"}</p>
      <div class="alert">
        最近旅行方向：<strong>${travelDirection()}</strong>。
        ${top?.special || top?.blankBack
          ? "顶部是空白卡背的特殊探索牌，不能用于获取线索。"
          : direction && directionalClue
            ? `顶部普通探索卡在该方向为<strong>${clueName(directionalClue)}</strong>；结算板块线索图标时会自动给所有需求匹配的骑士。`
            : "尚不能确定方向线索。"}
        ${top && !top.blankBack ? `<div class="legend">${DIRECTIONS.map(([key, label]) => `<span class="badge">${label} ${clueName(top.cluesByDirection?.[key])}</span>`).join("")}</div>` : ""}
      </div>
      <div class="toolbar">
        <button id="shuffleExploration" class="small secondary" ${deckLocked ? "disabled" : ""}>洗混</button>
        <button id="addSpecialExploration" class="small secondary" ${rules().specialExploration.length && !deckLocked ? "" : "disabled"}>加入特殊探索牌</button>
        <button id="peekExploration" class="small secondary" ${active || !top || deckLocked ? "disabled" : ""}>${exp.peek ? "盖回" : "兴趣点窥牌"}</button>
        <button id="${primaryActionId}" class="small" ${primaryActionDisabled ? "disabled" : ""}>${primaryActionLabel}</button>
        <button id="skipExplorationButton" class="small secondary" ${canSkipExplorationStep() ? "" : "disabled"}>跳过抽探索卡</button>
      </div>
      ${active ? `<div class="fields">
        <label>效果类型<select id="effectType"><option value="instant" ${selectedEffectType === "instant" ? "selected" : ""}>立即</option><option value="district" ${selectedEffectType === "district" ? "selected" : ""}>地区</option><option value="active" ${selectedEffectType === "active" ? "selected" : ""}>激活</option></select></label>
        <label>地区<select id="effectDistrict">${rules().districts.map(d => `<option value="${d.id}" ${d.id === selectedEffectDistrict ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</select></label>
      </div>` : ""}
      ${mercenaryPending ? '<div class="alert"><strong>盗贼选牌尚未完成：</strong>请在佣兵面板确认或取消。</div>' : ""}
      ${scoutingReorderPending ? '<div class="alert"><strong>斥候正在调整牌序：</strong>请先确认放回或取消调整。</div>' : ""}
    </section>`;
  }

  function explorationToolsPanel() {
    return `${explorationPanel()}${scoutingPanel()}`;
  }

  function mercenaryCardImage(definition, face, extra = "") {
    const source = definition.faces[face]?.image;
    return `<img class="mercenary-card-image ${extra}" src="${esc(source)}" alt="${esc(definition.name)} ${definition.level} 级 ${face} 面">`;
  }

  function mercenaryExplorationChoice() {
    const pending = state.mercenaries.pendingAction;
    if (!pending) return "";
    const definition = MERCENARY_RULES.CATALOG[pending.cardId];
    if (!definition) return "";
    const options = pending.drawn.map((cardId, index) => {
      const item = card(cardId);
      return `<option value="${esc(cardId)}">${index + 1}. ${esc(item?.name || cardId)}</option>`;
    }).join("");
    return `<section class="mercenary-choice" aria-label="盗贼探索牌选择">
      <div class="panel-header"><div><div class="eyebrow">ROGUE DELVE</div><h3>盗贼 ${definition.level} · 选择探索牌</h3></div><span class="badge gold">A 面待结算</span></div>
      <div class="mercenary-exploration-grid">${pending.drawn.map((cardId, index) => {
        const item = card(cardId);
        return `<div class="mercenary-exploration-card"><span class="badge">${index + 1}</span>${cardView(item?.image, "face")}<strong>${esc(item?.name || cardId)}</strong></div>`;
      }).join("")}</div>
      <div class="fields">
        <label>结算<select id="mercenaryResolveCard">${options}</select></label>
        ${definition.level === 3 ? `<label>弃置<select id="mercenaryDiscardCard">${pending.drawn.map((cardId, index) => {
          const item = card(cardId);
          return `<option value="${esc(cardId)}" ${index === 1 ? "selected" : ""}>${index + 1}. ${esc(item?.name || cardId)}</option>`;
        }).join("")}</select></label>` : ""}
      </div>
      <div class="toolbar"><button id="confirmMercenaryChoice">确认选牌并翻至 B 面</button><button id="cancelMercenaryChoice" class="secondary">取消</button></div>
    </section>`;
  }

  function mercenaryPanel() {
    const mercenaries = state.mercenaries;
    const current = mapState();
    const exp = current.exploration;
    const available = MERCENARY_RULES.availableCards(mercenaries);
    const previousTileId = encounterBacktrackTarget(current);
    const pendingMarker = current.monsters.find(item => item.id === current.pendingEncounter);
    const pendingMonsterName = DATA.monsters.find(item => item.id === pendingMarker?.monsterId)?.name || "当前怪物";

    const activeCards = mercenaries.active.map(item => {
      const definition = MERCENARY_RULES.CATALOG[item.cardId];
      const face = definition.faces[item.face];
      let delveAction = "";
      let actionNote = "";

      if (definition.role === "rogue") {
        const count = MERCENARY_RULES.drawCount(item.cardId);
        const canUseA = item.face === "A"
          && state.step === 2
          && exp.resolvedRound !== state.round
          && !mercenaries.pendingAction
          && (definition.level === 1 ? Boolean(exp.current && exp.deck.length) : Boolean(!exp.current && exp.deck.length >= count));
        const encounterAction = item.face === "B" && current.pendingEncounter
          ? face.action
          : "";
        const encounterDisabled = encounterAction === "skip-and-backtrack" && !previousTileId;
        delveAction = item.face === "A"
          ? definition.level === 1
            ? `<button class="small" data-mercenary-redraw="${esc(item.cardId)}" ${canUseA ? "" : "disabled"}>忽略当前探索牌并重抽</button>`
            : `<button class="small" data-mercenary-choice="${esc(item.cardId)}" ${canUseA ? "" : "disabled"}>抽 ${count} 张并选择</button>`
          : encounterAction
            ? `<button class="small" data-mercenary-skip="${esc(item.cardId)}" ${encounterDisabled ? "disabled" : ""}>忽略 ${esc(pendingMonsterName)}${encounterAction === "skip-and-backtrack" ? "并退回" : ""}</button>`
            : '<span class="tiny">深入效果将在遭遇或伏击触发时可用。</span>';
        if (encounterDisabled) actionNote = "没有以当前板块结尾的最近旅行路线，不能执行退回效果。";
      } else {
        const targets = mageTargets(item.cardId, current);
        const blockReason = mageMoveBlockReason(item.cardId, current);
        delveAction = `<div class="mercenary-move-controls">
          <label>目的地<select data-mercenary-target="${esc(item.cardId)}" ${blockReason ? "disabled" : ""}>${targets.map(tileId => `<option value="${esc(tileId)}">${esc(tileLabel(tile(tileId)))}</option>`).join("")}</select></label>
          <button class="small" data-mercenary-move="${esc(item.cardId)}" ${blockReason ? "disabled" : ""}>放置队伍并结算</button>
        </div>`;
        actionNote = blockReason;
      }

      return `<article class="mercenary-card active role-${esc(definition.role)}">
        <div class="mercenary-card-visual">${mercenaryCardImage(definition, item.face)}<span class="mercenary-face-badge">${item.face} 面</span></div>
        <div class="mercenary-card-copy">
          <div class="panel-header"><div><div class="eyebrow">${esc(definition.en)} · LEVEL ${definition.level}</div><h3>${esc(definition.name)} ${definition.level} 级</h3></div><span class="badge gold">数值 ${definition.value}</span></div>
          <div class="mercenary-rule"><strong>深入</strong><p>${esc(face.delve)}</p></div>
          <div class="mercenary-rule"><strong>冲突</strong><p>${esc(face.conflict)}</p></div>
          <div class="mercenary-card-actions">${delveAction}<button class="small secondary" data-mercenary-conflict="${esc(item.cardId)}">冲突效果已人工结算</button></div>
          ${actionNote ? `<p class="tiny">${esc(actionNote)}</p>` : ""}
        </div>
      </article>`;
    }).join("");

    const availableCards = available.map(definition => `<article class="mercenary-card compact role-${esc(definition.role)}">
      ${mercenaryCardImage(definition, "A")}
      <div class="mercenary-card-copy">
        <div><div class="eyebrow">${esc(definition.en)} · LEVEL ${definition.level}</div><h3>${esc(definition.name)} ${definition.level} 级</h3></div>
        <p class="tiny">${esc(definition.faces.A.delve)}</p>
        <button class="small" data-hire-mercenary="${esc(definition.id)}">雇佣 · 数值 ${definition.value}</button>
      </div>
    </article>`).join("");

    const discardedCards = mercenaries.discard.map(cardId => {
      const definition = MERCENARY_RULES.CATALOG[cardId];
      return definition ? `<div class="mercenary-discard-card role-${esc(definition.role)}">${mercenaryCardImage(definition, "B")}<span>${esc(definition.name)} ${definition.level} · 已弃置</span></div>` : "";
    }).join("");

    return `<section class="panel mercenary-panel">
      <div class="panel-header"><div><div class="eyebrow">MERCENARIES</div><h3>佣兵</h3></div><span class="badge">${mercenaries.active.length} 雇佣 · ${mercenaries.discard.length} 弃置</span></div>
      ${current.pendingEncounter ? `<div class="alert"><strong>遭遇待处理：</strong>${esc(pendingMonsterName)}。可使用符合条件的 B 面盗贼，或从遭遇面板继续进入。</div>` : ""}
      ${mercenaryExplorationChoice()}
      <div class="mercenary-section"><h3>已雇佣</h3><div class="mercenary-active-list">${activeCards || '<p class="muted">尚未雇佣佣兵。</p>'}</div></div>
      <div class="mercenary-section"><h3>可雇佣</h3><div class="mercenary-market">${availableCards || '<p class="muted">没有可雇佣的佣兵。</p>'}</div></div>
      <div class="mercenary-section"><h3>弃牌</h3><div class="mercenary-discard">${discardedCards || '<p class="muted">弃牌区为空。</p>'}</div></div>
    </section>`;
  }

  function wheelAndMonsterPanel() {
    const current = mapState();
    ensureDistrictWheel(current, state.kingdom);
    const source = current.districtWheelSource;
    const upstreamAvailable = Boolean(upstreamMonsterPool());
    const selectedTileIsFaceUp = tileIsFaceUp(current.selected, current);
    return `<section class="panel">
      <div class="panel-header"><div><div class="eyebrow">DISTRICT WHEEL & HUNT</div><h3>地区轮盘与追击</h3></div>
        ${source ? `<span class="badge${source.unresolved?.length ? " danger" : ""}">上层已同步 ${source.matched}/${source.total}${source.manuallyAdjusted ? " · 已手动调整" : ""}</span>` : '<span class="badge">尚未从上层同步</span>'}
      </div>
      <div class="fields">
        ${rules().districts.map(d => `<label>${esc(d.name)}${Number.isFinite(current.districtWheelLevels[d.id]) ? `<small class="muted">上层 Lv.${current.districtWheelLevels[d.id]}${current.districtWheelLocations[d.id] ? ` · ${esc(current.districtWheelLocations[d.id])}` : ""}</small>` : ""}<select data-wheel="${d.id}"><option value="">未指定</option>${DATA.monsters.map(monster => `<option value="${monster.id}" ${current.districtWheel[d.id] === monster.id ? "selected" : ""}>${esc(monster.name)}</option>`).join("")}</select></label>`).join("")}
      </div>
      ${source?.unresolved?.length ? `<div class="alert danger">未匹配怪物：${source.unresolved.map(esc).join("、")}</div>` : ""}
      <div class="toolbar"><button id="syncDistrictWheel" class="small secondary" ${upstreamAvailable ? "" : "disabled"}>从上层刷新</button><label>轮换格数<input id="rotateCount" type="number" min="1" value="1" style="width:72px"></label><button class="small secondary" data-rotate="-1">逆时针</button><button class="small secondary" data-rotate="1">顺时针</button><button id="huntButton" class="small">追击 1 格</button></div>
      <div class="toolbar"><span class="badge ${current.threatSevenSpawned ? "green" : current.threatSevenPending ? "gold" : ""}">首次 7+：${current.threatSevenSpawned ? "已生成" : current.threatSevenPending ? "等待步骤 d" : "未触发"}</span><button id="resetThreatSeven" class="small secondary" ${current.threatSevenSpawned || current.threatSevenPending || state.trackers.threat >= 7 ? "" : "disabled"}>重新结算 7+ 生成</button></div>
      <p class="tiny">威胁 3、7、8：追猎 1；威胁 4、9：追猎 2。生成和追击只使用正面朝上的王国板块；无法沿正面板块接近队伍时，随机移到队伍相邻的正面板块。</p>
      <div class="fields">
        <label>怪物<select id="monsterSelect">${DATA.monsters.map(monster => `<option value="${monster.id}">${esc(monster.name)}</option>`).join("")}</select></label>
        <button id="spawnMonster" class="secondary" ${selectedTileIsFaceUp ? "" : "disabled"}>在所选正面板块生成</button>
      </div>
      <div class="list">${current.monsters.map(item => {
        const monsterName = DATA.monsters.find(monster => monster.id === item.monsterId)?.name || item.monsterId;
        return `<div class="list-row"><span class="token-label">${tokenImage(monsterToken(item.monsterId), monsterName)}<span>${esc(monsterName)} · ${esc(tileLabel(tile(item.tileId)))}</span></span><span class="toolbar"><button class="small secondary" data-move-monster="${item.id}" ${selectedTileIsFaceUp ? "" : "disabled"}>移到所选正面板块</button><button class="small danger" data-remove-monster="${item.id}">移除</button></span></div>`;
      }).join("") || '<span class="muted">地图上没有怪物</span>'}</div>
      ${current.pendingEncounter ? '<div class="alert"><strong>遭遇战待处理：</strong>若有可用的 B 面盗贼，会先在佣兵面板等待选择；否则首次触发时自动进入。完成遭遇后会自动处理怪物标记与地区轮盘。<button id="openPendingEncounter" class="small">继续进入遭遇</button></div>' : ""}
    </section>`;
  }

  function fogBoard(fog) {
    const entries = fog.used || [];
    if (!entries.length) return '<p class="muted">尚未建立弥雾路径</p>';
    const activeIds = new Set(fog.route.map(item => item.cardId));
    const currentId = fog.route.at(-1)?.cardId;
    const xs = entries.map(item => Number(item.x) || 0);
    const ys = entries.map(item => Number(item.y) || 0);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const columns = Math.max(...xs) - minX + 1;
    const rows = Math.max(...ys) - minY + 1;
    return `<div class="fog-board-shell"><div class="fog-board" style="--fog-columns:${columns};--fog-rows:${rows}">
      ${entries.map(item => {
        const isActive = activeIds.has(item.cardId);
        const isCurrent = item.cardId === currentId;
        const gridX = (Number(item.x) || 0) - minX + 1;
        const gridY = (Number(item.y) || 0) - minY + 1;
        return `<div class="fog-board-card ${isActive ? "active" : "flipped"} ${isCurrent ? "current" : ""}" style="grid-column:${gridX};grid-row:${gridY}" title="${isActive ? "当前直线路径" : "修正方向后翻回卡背"}">
          <span class="tiny">值 ${item.value}${item.hazard ? " · 侵害" : ""}</span>
          ${cardView(card(item.cardId)?.image, isActive ? "face" : "back", "fog-mini")}
          ${isCurrent ? '<span class="fog-party" title="队伍位置">队</span>' : ""}
        </div>`;
      }).join("")}
    </div></div>`;
  }

  function fogPanel() {
    const current = mapState();
    const fog = current.fog;
    const peek = fogPeekState(fog);
    const peekActive = peek.cards.length > 0;
    const peekCards = peek.cards.map(id => card(id));
    const defaultPeekCount = Math.min(3, Math.max(1, fog.deck.length));
    const active = card(fog.current);
    const pathValue = fog.route.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
    const outcome = fogOutcome(fog);
    const outcomeLabel = outcome === "perfect" ? "完美穿越" : outcome === "minor" ? "轻微惩罚" : outcome === "grave" ? "严重惩罚" : "";
    const lowest = lowestFogEntries(fog);
    const hazardEntry = fog.hazardPending ? fog.used.at(-1) : null;
    const hazardCard = card(hazardEntry?.cardId);
    const actionDisabled = fog.hazardPending || peekActive ? "disabled" : "";
    const stayBlocked = fog.started && !FOG_RULES.canPlace(fog, false);
    const headingLabel = ["东", "南", "西", "北"][Number(fog.heading) || 0];
    return `<section class="panel">
      <div class="panel-header"><div><div class="eyebrow">DEEP FOG</div><h3>弥雾路径</h3></div><span class="badge">牌堆 ${fog.deck.length} · 弃牌 ${fog.discard.length}</span></div>
      <div class="toolbar"><button id="fogDiscardTop" class="small danger" ${fog.deck.length && !peekActive ? "" : "disabled"}>弃置牌堆顶 1 张</button><button id="fogReshuffleDeck" class="small secondary" ${(fog.discard.length || fog.deck.length > 1) && !peekActive ? "" : "disabled"}>重洗牌组</button><span class="tiny">弃牌洗回未抽牌堆；当前牌与路径牌保持不变。</span></div>
      ${fog.active ? `
        <p>目标 <strong>${esc(tileLabel(tile(fog.target)))}</strong> · 直线路径 ${fog.route.length}/${fog.intensity} 张 · 当前方向 ${headingLabel} · 弥雾值 ${pathValue} + 满杯 ${fog.baneFull} = <strong>${fog.total}</strong></p>
        <div class="fields fog-peek-fields">
          <label>查看数量<input id="fogPeekCount" type="number" min="1" max="${Math.max(1, fog.deck.length)}" step="1" value="${defaultPeekCount}" ${peekActive ? "disabled" : ""}></label>
          <button id="fogStartPeekTop" class="secondary" ${fog.deck.length && !fog.hazardPending && !peekActive ? "" : "disabled"}>查看牌顶</button>
          <button id="fogStartPeekBottom" class="secondary" ${fog.deck.length && !fog.hazardPending && !peekActive ? "" : "disabled"}>查看牌底</button>
        </div>
        ${peekActive ? `
          <div class="scouting-peek-header"><strong>弥雾牌堆${peek.source === "bottom" ? "底" : "顶"}</strong><span class="badge">${peek.cards.length} 张</span></div>
          <div class="scouting-peek-grid fog-peek-grid">${peekCards.map((item, index) => `<div class="scouting-peek-card fog-peek-card">
            <div class="scouting-peek-order"><span class="badge">第 ${index + 1} 张</span><span class="badge fog-peek-status" data-fog-peek-status="${index}" data-destination="${peek.destinations[index]}">去向：${fogPeekDestinationLabel(peek.destinations[index])}</span></div>
            ${cardView(item?.image, "face")}
            <strong class="scouting-card-name">${esc(item?.name || peek.cards[index])}</strong>
            <div class="fog-peek-choice" role="group" aria-label="第 ${index + 1} 张牌的放置位置">
              <button type="button" class="small secondary" data-fog-peek-index="${index}" data-fog-peek-destination="top" aria-pressed="${peek.destinations[index] === "top"}">盖回牌顶</button>
              <button type="button" class="small secondary" data-fog-peek-index="${index}" data-fog-peek-destination="bottom" aria-pressed="${peek.destinations[index] === "bottom"}">放到牌底</button>
              <button type="button" class="small secondary" data-fog-peek-index="${index}" data-fog-peek-destination="shuffle" aria-pressed="${peek.destinations[index] === "shuffle"}">洗回牌库</button>
            </div>
          </div>`).join("")}</div>
          <div class="toolbar scouting-peek-actions"><button id="fogConfirmPeek" class="small">${fogPeekConfirmationLabel(peek)}</button><button id="fogCancelPeek" class="small secondary">全部放回牌${peek.source === "bottom" ? "底" : "顶"}</button></div>
        ` : ""}
        ${fog.started ? fogBoard(fog) : ""}
        ${!fog.started && active ? `<div class="fog-current">${cardView(active.image, "face")}<div class="alert">起始弥雾卡 · 值 ${fogCardValue(active)}${active.hazard ? " · 有侵害（起始牌不结算）" : ""}</div><button id="fogStartCard" ${peekActive ? "disabled" : ""}>建立起始弥雾卡</button></div>` : ""}
        ${fog.started ? `
          <div class="fields">
            <label class="check"><input id="fogBaneHalf" type="checkbox" ${fog.baneHalf ? "checked" : ""}>半杯侵害指示物</label>
            <label>满杯侵害指示物<input id="fogBaneFull" type="number" min="0" step="1" value="${fog.baneFull}"></label>
          </div>
          ${fog.hazardPending ? `<div class="alert danger"><strong>侵害待结算：</strong>${esc(hazardCard?.name || hazardEntry?.cardId || "当前弥雾卡")}。完成卡面效果并更新侵害指示物后确认。<div class="toolbar"><button id="fogHazardResolved">确认侵害已结算</button></div></div>` : `<p class="tiny">${fog.correctedEver ? "已修正过方向，之后抽到的侵害效果均需结算。" : "首次修正方向后，才开始结算新抽弥雾卡的侵害效果。"}</p>`}
          ${lowest.length ? `<label>离开时弃置的最低值牌<select id="fogLowestCard">${lowest.map(item => `<option value="${esc(item.cardId)}">${esc(card(item.cardId)?.name || item.cardId)} · 值 ${item.value}</option>`).join("")}</select></label>` : ""}
          ${fog.route.length < fog.intensity ? `
            <div class="fields">
              <label>修正方向保留的枢轴卡<select id="fogPivot">${fog.route.map((item, index) => `<option value="${index}">第 ${index + 1} 张 · 值 ${item.value}</option>`).join("")}</select></label>
              <label>转向<select id="fogTurn"><option value="left">向左转</option><option value="right">向右转</option></select></label>
            </div>
            <div class="toolbar"><button id="fogStay" ${fog.hazardPending || peekActive || stayBlocked ? "disabled" : ""}>${stayBlocked ? "前方已有弥雾卡" : "保持方向并抽牌"}</button><button id="fogCorrect" class="secondary" ${actionDisabled}>修正方向并抽牌</button><button id="fogWithdraw" class="danger" ${actionDisabled}>撤回</button></div>
          ` : `
            <div class="alert">已达到目标浓度。最终弥雾值 ${fog.total}：<strong>${outcomeLabel}</strong></div>
            ${outcome === "minor" ? `<label>选择结算一项严重惩罚的牌<select id="fogPenaltyCard">${fog.route.map(item => `<option value="${esc(item.cardId)}">${esc(card(item.cardId)?.name || item.cardId)} · 值 ${item.value}</option>`).join("")}</select></label>` : ""}
            ${outcome === "grave" ? `<div class="alert danger"><strong>结算本次所有已揭示弥雾卡的全部严重惩罚：</strong><div class="fog-route">${fog.used.map(item => `<div><span class="tiny">值 ${item.value}</span>${cardView(card(item.cardId)?.image, "face", "fog-mini")}</div>`).join("")}</div></div>` : ""}
            <button id="fogEmerge" ${actionDisabled}>确认惩罚已结算并出现</button>
          `}
        ` : ""}
      ` : '<p class="muted">在旅行面板选择目标并输入该板块的弥雾浓度后开始。</p>'}
      ${current.failed ? `<div class="alert danger">远征失败：${esc(current.failed)}</div>` : ""}
    </section>`;
  }

  function cluesAndStoryPanel() {
    const current = mapState();
    const lastClue = current.exploration.lastClueResolution;
    const selectableMainKnights = state.knights.filter(knight => knight.memberType !== "squire");
    const clueKnights = state.knights.filter(knight => knight.id !== state.mainKnightId);
    return `<section class="panel">
      <div class="panel-header"><div><div class="eyebrow">CLUES & STORY</div><h3>队伍线索与故事队列</h3></div><span class="badge">自选未分配 ${state.trackers.unassignedClues}</span></div>
      <div class="fields">
        <label>主线骑士<select id="mainKnightSelect"><option value="">未指定</option>${selectableMainKnights.map(knight => `<option value="${esc(knight.id)}" ${knight.id === state.mainKnightId ? "selected" : ""}>${esc(knight.name)}</option>`).join("")}</select></label>
        <button id="autoAssignClueRequirements" type="button" class="secondary">自动分配主次线索</button>
      </div>
      <label class="check"><input id="taskMode" type="checkbox" ${state.taskMode ? "checked" : ""}>任务模式（冲突与休息按骑士手册／故事段落人工确认）</label>
      ${lastClue ? `<div class="alert"><strong>最近自动线索：</strong>${directionName(lastClue.direction)}向 · ${clueName(lastClue.clueType)} · ${lastClue.recipients.length ? `${lastClue.recipients.map(esc).join("、")}各获得 1 枚` : "无人需求匹配"}</div>` : ""}
      ${pendingCluePanel()}
      ${clueKnights.map(knight => `<div class="clue-row">
        <div><span class="badge ${knight.memberType === "squire" ? "gold" : ""}">${knight.memberType === "squire" ? "侍从" : "骑士"}</span><select data-knight-name="${knight.id}">${memberOptions(knight)}</select></div>
        <div class="legend clue-records">${CLUES.map(([id, name, icon]) => `<span class="badge clue-record" title="${esc(name)}线索"><img class="clue-token-icon" src="${esc(icon)}" alt="${esc(name)}线索"><strong>${knight.clues[id]}</strong><button class="inline-step" data-clue="${knight.id}|${id}|-1">−</button><button class="inline-step" data-clue="${knight.id}|${id}|1">＋</button></span>`).join("")}</div>
        <div class="fields three">
          <label>主要需求<select data-requirement="${knight.id}|primary"><option value="">无</option>${CLUES.map(([id, name]) => `<option value="${id}" ${knight.primary === id ? "selected" : ""}>${name}</option>`).join("")}</select></label>
          <label>次要需求<select data-requirement="${knight.id}|secondary"><option value="">无</option>${CLUES.map(([id, name]) => `<option value="${id}" ${knight.secondary === id ? "selected" : ""}>${name}</option>`).join("")}</select></label>
          <label>任务需求<select data-requirement="${knight.id}|task"><option value="">无</option>${CLUES.map(([id, name]) => `<option value="${id}" ${knight.task === id ? "selected" : ""}>${name}</option>`).join("")}</select></label>
        </div>
      </div>`).join("")}
      <div class="fields">
        <label>段落／提醒<input id="storyText" placeholder="段落编号或人工说明"></label><button id="addStory" class="secondary">加入队列</button>
        <label>探索密码<input id="storyCode" placeholder="密码"></label><button id="addCode" class="secondary">记录密码</button>
      </div>
      <div class="list">${current.storyQueue.map(item => `<label class="list-row check"><input type="checkbox" data-story="${item.id}" ${item.read ? "checked" : ""}><span>${esc(item.code ? `${item.code} · ${item.text}` : item.text)}</span></label>`).join("") || '<span class="muted">没有待阅读段落</span>'}</div>
      <p class="tiny">探索密码：${current.explorationCodes.map(esc).join("、") || "无"}。规则：第一枚线索按旅行方向读取顶部探索卡；每枚额外线索各抽一张轻型伤亡牌确认方向。任务骑士匹配任务需求，其他骑士匹配主要或次要需求。</p>
    </section>`;
  }

  function effectMarkersFor(exp, slotKey) {
    const records = exp.effectMarkers?.[slotKey];
    return Array.isArray(records) ? records : [];
  }

  function effectMarkerLayer(exp, slotKey) {
    return `<div class="effect-card-markers">${effectMarkersFor(exp, slotKey).map((marker, index) => {
      const { x, y } = effectMarkerPosition(marker, index);
      const label = TILE_MARKERS.find(([id]) => id === marker.type)?.[1] || marker.type;
      return `<button type="button" class="effect-card-marker" data-effect-marker="${esc(marker.id)}" data-effect-slot="${esc(slotKey)}"
        data-remove-effect-marker="${esc(marker.id)}" data-marker-x="${x}" data-marker-y="${y}"
        style="left:${x}%;top:${y}%" title="${esc(label)}（可拖动，点击移除）" aria-label="${esc(label)}标记，可拖动，点击移除">
        ${tokenImage(markerToken(marker.type), label, "effect-marker-token")}
      </button>`;
    }).join("")}</div>`;
  }

  function effectCardControls(slotKey) {
    return `<div class="effect-card-controls">
      <select data-effect-marker-select="${esc(slotKey)}" aria-label="选择效果牌标记">
        ${TILE_MARKERS.map(([id, name]) => `<option value="${id}" ${id === "generic" ? "selected" : ""}>${esc(name)}</option>`).join("")}
      </select>
      <button type="button" class="small secondary" data-add-effect-marker="${esc(slotKey)}">添加标记</button>
      <button type="button" class="small danger" data-discard-effect="${esc(slotKey)}">弃置</button>
    </div>`;
  }

  function placedEffectCard(item, slotKey) {
    const exp = mapState().exploration;
    return `<div class="effect-card-stage">
      <div class="rule-card" role="img" aria-label="${esc(item.name)}" title="${esc(item.name)}" style='${cardStyle(item.image, "face")}'></div>
      ${effectMarkerLayer(exp, slotKey)}
    </div>${effectCardControls(slotKey)}`;
  }

  function kingdomEffectPlacements() {
    const zones = KINGDOM_PANEL_ZONES[state.kingdom];
    if (!zones) return "";
    const exp = mapState().exploration;
    const placements = exp.activeEffect
      ? [{ cardId: exp.activeEffect, label: "激活效果", zone: zones.active, kind: "active" }]
      : [];
    return placements.map(placement => {
      const item = card(placement.cardId);
      if (!item) return "";
      return `<figure class="kingdom-effect-placement ${placement.kind}" style="--zone-x:${placement.zone.x}%;--zone-y:${placement.zone.y}%;--zone-width:${placement.zone.width}%" title="${esc(placement.label)} · ${esc(item.name)}">
        <figcaption>${esc(placement.label)}</figcaption>
        ${placedEffectCard(item, "active")}
      </figure>`;
    }).join("");
  }

  function kingdomDistrictRail() {
    const exp = mapState().exploration;
    return `<aside class="kingdom-district-rail" aria-label="地区探索效果">
      ${rules().districts.map(district => {
        const item = card(exp.districtEffects[district.id]);
        return `<section class="kingdom-district-slot ${item ? "occupied" : "empty"}">
          <div class="kingdom-district-slot-label"><span>${esc(district.name)}</span><small>${item ? esc(item.name) : "空卡位"}</small></div>
          ${item
            ? placedEffectCard(item, `district:${district.id}`)
            : '<div class="kingdom-district-empty"><span>地区效果</span><strong>空</strong></div>'}
        </section>`;
      }).join("")}
    </aside>`;
  }

  function kingdomMonsterWheelTokens() {
    const zones = KINGDOM_PANEL_ZONES[state.kingdom]?.monsterSlots || {};
    const current = mapState();
    ensureDistrictWheel(current, state.kingdom);
    return rules().districts.map(district => {
      const monsterId = current.districtWheel[district.id];
      const zone = zones[district.id];
      if (!monsterId || !zone) return "";
      const monster = DATA.monsters.find(item => item.id === monsterId);
      const source = monsterToken(monsterId);
      const configuredLevel = Number(current.districtWheelLevels[district.id]);
      const level = Number.isFinite(configuredLevel) && configuredLevel > 0 ? configuredLevel : 1;
      const conflictLocation = String(current.districtWheelLocations[district.id] || "");
      const label = `${district.name} · ${monster?.name || monsterId} · Lv.${level}${conflictLocation ? ` · 冲突地点：${conflictLocation}` : ""}`;
      return `<button type="button" class="kingdom-monster-wheel-token" data-wheel-monster="${esc(monsterId)}" data-wheel-district="${esc(district.id)}" data-wheel-level="${level}" data-wheel-location="${esc(conflictLocation)}" style="--token-x:${zone.x}%;--token-y:${zone.y}%;--token-width:${zone.width}%" aria-label="${esc(label)}，选择进入遭遇或冲突" title="${esc(label)} · 点击进入遭遇或冲突">
        ${source ? `<img src="${esc(source)}" alt="">` : `<span class="kingdom-monster-wheel-fallback">${esc((monster?.name || "?").slice(0, 1))}</span>`}
      </button>`;
    }).join("");
  }

  function kingdomWheelRotateButton() {
    const zone = KINGDOM_PANEL_ZONES[state.kingdom]?.wheelCenter;
    if (!zone) return "";
    return `<button type="button" class="kingdom-wheel-rotate" data-rotate-wheel-once style="--rotate-x:${zone.x}%;--rotate-y:${zone.y}%" aria-label="地区轮盘顺时针轮换一格" title="顺时针轮换一格"><span aria-hidden="true">↻</span></button>`;
  }

  function kingdomBoardMarkers() {
    const markers = Array.isArray(mapState().kingdomMarkers) ? mapState().kingdomMarkers : [];
    return markers.map(marker => {
      const source = markerToken(marker.type);
      const label = TILE_MARKERS.find(([id]) => id === marker.type)?.[1] || marker.type;
      const x = clamp(Number(marker.x) || 50, 2, 98);
      const y = clamp(Number(marker.y) || 50, 2, 98);
      return `<span class="kingdom-board-marker" data-kingdom-marker="${esc(marker.id)}" data-marker-x="${x}" data-marker-y="${y}" style="left:${x}%;top:${y}%" title="${esc(label)}">
        ${source
          ? `<img class="kingdom-board-marker-image" src="${esc(source)}" alt="${esc(label)}" draggable="false">`
          : `<span class="kingdom-board-marker-fallback">${esc(label.slice(0, 1) || "?")}</span>`}
        <button type="button" class="kingdom-board-marker-remove" data-remove-kingdom-marker="${esc(marker.id)}" title="移除${esc(label)}" aria-label="移除${esc(label)}">&times;</button>
      </span>`;
    }).join("");
  }

  function kingdomMarkerToolbar() {
    return `<div class="kingdom-marker-toolbar">
      <strong>王国版图标记</strong>
      <select data-kingdom-marker-select aria-label="选择王国版图标记">
        ${TILE_MARKERS.map(([id, name]) => `<option value="${id}">${esc(name)}</option>`).join("")}
      </select>
      <button type="button" class="small secondary" data-add-kingdom-marker>添加标记</button>
    </div>`;
  }

  function kingdomBoardScene(panel) {
    return `<div class="kingdom-board-scene">
      <img src="${esc(panel)}" alt="${esc(kingdomData().label)}王国面板">
      ${kingdomMonsterWheelTokens()}
      ${kingdomWheelRotateButton()}
      ${kingdomEffectPlacements()}
      ${kingdomBoardMarkers()}
    </div>`;
  }

  function kingdomBoardLayout(panel) {
    return `<div class="kingdom-board-layout">
      ${kingdomBoardScene(panel)}
      ${kingdomDistrictRail()}
    </div>`;
  }

  function kingdomPanel() {
    const panel = rules().panel;
    if (!panel) return "";
    return `<details id="kingdomPanelDetails" class="kingdom-panel-section" ${kingdomPanelExpanded ? "open" : ""}>
      <summary>
        <span><span class="eyebrow">KINGDOM PANEL</span><strong>${esc(kingdomData().label)} · 王国面板</strong></span>
        <span class="kingdom-panel-toggle-copy"><span class="tiny">点击展开或折叠</span><span class="kingdom-panel-chevron" aria-hidden="true">⌄</span></span>
      </summary>
      ${kingdomMarkerToolbar()}
      <div class="kingdom-panel-inline">${kingdomBoardLayout(panel)}</div>
    </details>
    <dialog id="kingdomPanelDialog" class="kingdom-board-dialog">
      <div class="kingdom-dialog-bar">
        <strong>${esc(kingdomData().label)} · 王国面板</strong>
        <button id="closeKingdomPanel" class="small secondary" type="button">关闭</button>
      </div>
      ${kingdomMarkerToolbar()}
      ${kingdomBoardLayout(panel)}
    </dialog>
    <dialog id="kingdomMonsterActionDialog" class="kingdom-monster-action-dialog">
      <div class="kingdom-monster-action-heading">
        <div><span class="eyebrow">MONSTER ACTION</span><h3 data-wheel-action-title>选择怪物行动</h3></div>
        <button type="button" class="small secondary" data-close-wheel-action>关闭</button>
      </div>
      <p class="muted" data-wheel-action-detail></p>
      <div class="kingdom-monster-action-buttons">
        <button type="button" class="primary" data-wheel-monster-action="encounter">进入遭遇</button>
        <button type="button" class="secondary" data-wheel-monster-action="conflict">进入冲突</button>
      </div>
    </dialog>`;
  }

  function partyOverviewPanel() {
    const party = campaignParty();
    const clueKnights = state.knights.filter(knight => knight.id !== state.mainKnightId);
    const memberFor = knight => party.find(member =>
      member.id === knight.sheetId
      || member.sheetId === knight.sheetId
      || (!knight.sheetId && member.name === knight.name)
    );
    const resourceView = knight => {
      const selected = state.taskMode && knight.task
        ? [[knight.task, "任务"]]
        : [[knight.primary, "主要"], [knight.secondary, "次要"]].filter(([id]) => id);
      const resources = selected.length
        ? selected.filter(([id], index, items) => items.findIndex(([other]) => other === id) === index)
        : CLUES.map(([id]) => [id, ""]);
      return resources.map(([id, role]) => {
        const clue = CLUES.find(([clueId]) => clueId === id);
        const label = clue?.[1] || id;
        const icon = clue?.[2] || "";
        const amount = Number(knight.clues[id]) || 0;
        const roleShort = role === "主要" ? "主" : role === "次要" ? "次" : role === "任务" ? "任" : "";
        return `<span class="party-resource resource-${esc(id)}" title="${role ? `${role}需求 · ` : ""}${esc(label)}">
          <span class="party-resource-adjust">
            <span class="party-resource-label">
              <span class="party-resource-role" aria-label="${role || "线索"}">${roleShort}</span>
              ${icon ? `<img class="clue-token-icon" src="${esc(icon)}" alt="${esc(label)}线索">` : ""}
            </span>
            <button type="button" class="party-resource-step" data-clue="${knight.id}|${id}|-1" aria-label="${esc(knight.name)}${role || label}线索减一" ${amount <= 0 ? "disabled" : ""}>−</button>
            <strong>${amount}</strong>
            <button type="button" class="party-resource-step" data-clue="${knight.id}|${id}|1" aria-label="${esc(knight.name)}${role || label}线索加一">＋</button>
          </span>
        </span>`;
      }).join("");
    };
    return `<section class="party-overview" aria-label="当前出征队伍">
      <div class="party-overview-heading">
        <div><div class="eyebrow">EXPEDITION PARTY</div><h3>当前出征队伍</h3></div>
        <div class="legend"><span class="badge">${clueKnights.length} 条线索记录</span><span class="badge gold">自选线索 ${state.trackers.unassignedClues}</span></div>
      </div>
      <div class="party-roster" style="--party-records:${Math.max(1, clueKnights.length)}">
        ${clueKnights.map(knight => {
          const member = memberFor(knight);
          const portraitId = member?.type === "squire" ? member.squireId : member?.knightId;
          return `<article class="party-member">
            <div class="party-portrait">
              ${portraitId ? `<img src="/assets/heroes/${esc(portraitId)}-avatar.jpg" alt="${esc(knight.name)}立绘" loading="lazy">` : `<span aria-hidden="true">${esc(knight.name.slice(0, 1) || "?")}</span>`}
            </div>
            <div class="party-member-info">
              <strong title="${esc(knight.name)}">${esc(knight.name)}</strong>
            </div>
            <div class="party-resources">${resourceView(knight)}</div>
          </article>`;
        }).join("")}
      </div>
    </section>`;
  }

  function tracksPanel() {
    const limits = rules().limits;
    const icons = DATA.tokens?.tracks || {};
    const tracks = [
      ["threat", "威胁", value => THREAT_HUNT[value] ? `追猎 ${THREAT_HUNT[value]}` : ""],
      ["curse", "诅咒", () => ""],
      ["time", "时间", value => value === 8 ? "初步" : value === 16 ? "完全" : ""]
    ];
    return `<section class="panel">
      <div class="panel-header"><div><div class="eyebrow">DELVE TRACKS</div><h3>深入轨道</h3></div><span class="tiny">点击格子或按钮可修正当前位置</span></div>
      <div class="delve-tracks">
        ${tracks.map(([id, label, eventLabel]) => {
          const value = trackerValue(state.trackers[id]);
          const limit = limits[id];
          const notes = state.trackNotes[id] || {};
          const selectedNotePosition = clamp(value, 0, limit);
          const selectedNote = notes[String(selectedNotePosition)] || "";
          return `<div class="delve-track track-${id}${value > limit ? " over-limit" : ""}">
            <div class="delve-track-heading">
              <span class="delve-track-logo">${icons[id] ? `<img src="${esc(icons[id])}?v=3" alt="">` : ""}</span>
              <span class="delve-track-status"><strong class="delve-track-name">${label}</strong><small>当前 ${value}${value > limit ? " · 已溢出" : ""}</small></span>
              <form class="track-note-editor" data-track-note-form="${id}">
                <details class="track-note-position-picker">
                  <summary data-track-note-summary="${id}" title="已选数值 ${selectedNotePosition}">${selectedNotePosition}</summary>
                  <div class="track-note-position-options" role="group" aria-label="${label}轨道标记数值">
                    ${Array.from({ length: limit + 1 }, (_, cell) => `<label><input type="checkbox" data-track-note-value="${id}" value="${cell}" ${cell === selectedNotePosition ? "checked" : ""}><span>${cell}</span></label>`).join("")}
                  </div>
                </details>
                <input data-track-note-text="${id}" maxlength="${TRACK_NOTE_MAX_LENGTH}" value="${esc(selectedNote)}" placeholder="标记内容" aria-label="${label}轨道标记内容">
                <button type="submit" class="small secondary">保存</button>
                <button type="button" class="small danger" data-track-note-clear="${id}" ${selectedNote ? "" : "disabled"}>清除</button>
              </form>
            </div>
            <div class="delve-track-scroll">
              <div class="delve-track-cells" style="--track-cells:${limit + 1}">
                ${Array.from({ length: limit + 1 }, (_, cell) => {
                  const marker = eventLabel(cell);
                  const note = notes[String(cell)] || "";
                  const description = [`${label} ${cell}`, marker, note].filter(Boolean).join("，");
                  return `<button type="button" class="delve-track-cell${cell === value ? " active" : ""}${marker ? " event-cell" : ""}${note ? " noted" : ""}"
                    data-track-cell="${id}" data-track-value="${cell}" aria-label="${esc(description)}"
                    aria-pressed="${cell === value}" title="${esc(description)}">
                    <span class="track-cell-note">${note ? esc(note) : ""}</span>
                    <span class="track-number">${cell}</span>
                    <small class="track-event-label">${marker ? esc(marker) : ""}</small>
                  </button>`;
                }).join("")}
              </div>
            </div>
          </div>`;
        }).join("")}
      </div>
    </section>`;
  }

  function roundStepAction() {
    if (state.step === 0) return { label: "先选择旅行方式", disabled: true };
    if (state.step === 1) return { label: "完成王国板块结算", disabled: true };
    if (state.step === 2) {
      const exp = mapState().exploration;
      if (state.mercenaries.pendingAction) return { label: "先完成盗贼选牌", disabled: true };
      if (exp.resolvedRound === state.round) return { label: "进入故事步骤", disabled: false };
      return { label: exp.current ? "先结算探索牌" : "先抽取探索牌", disabled: true };
    }
    return { label: "完成本轮", disabled: false };
  }

  function render() {
    const current = mapState();
    const selected = tile(current.selected);
    const exploredCount = Object.values(current.tileState).filter(value => value === "explored").length;
    const revealedCount = Object.values(current.tileState).filter(value => value === "revealed").length;
    if (!TOOL_TABS.some(([id]) => id === activeTool)) activeTool = STEP_TOOL[state.step] || "tile";

    $("#kingdomSelect").value = state.kingdom;
    $("#kingdomSelect").disabled = Boolean(state.mercenaries.pendingAction);
    $("#undoButton").disabled = !current.history.length;
    $("#stepNav").innerHTML = STEPS.map((name, index) => `<button type="button" class="${state.step === index ? "active" : ""}" aria-current="${state.step === index ? "step" : "false"}" disabled>
      <span class="step-index">${index + 1}</span>
      <span class="step-copy"><strong>${name}</strong><small>${state.step === index ? `第 ${state.round} 轮 · 当前` : index < state.step ? "本轮已完成" : "等待进行"}</small></span>
    </button>`).join("");

    const toolTabs = TOOL_TABS.map(([id, label]) => `<button id="tool-tab-${id}" type="button" role="tab" data-tool-tab="${id}" aria-controls="tool-panel-${id}" aria-selected="${activeTool === id}" tabindex="${activeTool === id ? "0" : "-1"}" class="${activeTool === id ? "active" : ""}">${label}</button>`).join("");
    const toolPanel = (id, content) => `<div id="tool-panel-${id}" class="tool-panel stack" role="tabpanel" aria-labelledby="tool-tab-${id}" data-tool-panel="${id}" tabindex="0" ${activeTool === id ? "" : "hidden"}>${content}</div>`;

    const stepAction = roundStepAction();
    $("#app").innerHTML = `<div class="host-layout">
      <div class="map-column stack">
        <div class="delve-tracks-sticky">${tracksPanel()}</div>
        ${kingdomPanel()}
        <section class="panel map-shell">
          <div class="map-heading">
            <div class="map-title">
              <div class="eyebrow">KINGDOM MAP · ROUND ${state.round}</div>
              <h2>${esc(kingdomData().label)}</h2>
            </div>
            <div class="toolbar map-actions" aria-label="地图视图控制">
              <button class="small secondary" data-zoom="-0.2">缩小</button>
              <span class="badge zoom-badge">${Math.round(current.zoom * 100)}%</span>
              <button class="small secondary" data-zoom="0.2">放大</button>
              <input class="map-zoom-slider" type="range" min="${MAP_ZOOM_MIN * 100}" max="${MAP_ZOOM_MAX * 100}" step="1" value="${Math.round(current.zoom * 100)}" data-zoom-slider aria-label="地图缩放比例" title="拖动调节地图缩放比例">
              <button id="fitMap" class="small secondary">适合窗口</button>
              <button id="toggleAll" class="small secondary">${current.showAll ? "返回探索地图" : "预览全图"}</button>
              <button id="openKingdomPanelToolbar" class="small secondary">查看王国面板</button>
            </div>
          </div>
          <div class="map-status" aria-label="地图状态">
            <span class="badge gold">当前位置 ${esc(tileLabel(tile(current.current)))}</span>
            <span class="badge green">已探索 ${exploredCount}</span>
            <span class="badge">已揭示 ${revealedCount}</span>
            <span class="badge">已生成 ${current.placed.length} / ${kingdomData().tiles.length}</span>
            <span class="badge">所选 ${esc(tileLabel(selected))}</span>
          </div>
          <div class="map-workspace">
            <section class="map-board" aria-label="王国地图"><div class="map-canvas" style="width:${Math.round(current.zoom * 100)}%">${mapSvg()}</div></section>
          </div>
        </section>
        ${partyOverviewPanel()}
      </div>

      <aside class="host-sidebar" aria-label="主持工具">
        <div class="sidebar-scroll stack">
          ${current.tileResolution ? `<div class="sidebar-priority">${tileResolutionPanel()}</div>` : ""}
          <section class="panel history-panel">
            <div class="history-actions">
              <details class="history-details">
                <summary><span><span class="eyebrow">SETTLEMENT HISTORY</span><strong>最近记录</strong></span><span class="tiny">${state.log.length} 条</span></summary>
                <div class="list">${state.log.slice(0, 8).map(item => `<div class="list-row"><span>${esc(item.text)}</span><time class="tiny">${new Date(item.at).toLocaleTimeString()}</time></div>`).join("") || '<span class="muted">暂无结算记录</span>'}</div>
              </details>
              <button id="nextStep" ${stepAction.disabled ? "disabled" : ""}>${stepAction.label}</button>
            </div>
          </section>

          <section class="tool-deck" aria-label="主持工具组">
            <div class="tool-deck-heading">
              <div><div class="eyebrow">HOST CONSOLE</div><h3>主持工具</h3></div>
              <span class="badge gold">第 ${state.round} 轮 · ${esc(STEPS[state.step])}</span>
            </div>
            <div class="tool-tabs" role="tablist" aria-label="主持工具">${toolTabs}</div>
            ${toolPanel("tile", `${selectedTilePanel()}${markerPanel()}${showKingdomTilesPanel()}`)}
            ${toolPanel("travel", `${travelPanel()}${fogPanel()}`)}
            ${toolPanel("encounter", wheelAndMonsterPanel())}
            ${toolPanel("exploration", explorationToolsPanel())}
            ${toolPanel("mercenary", mercenaryPanel())}
            ${toolPanel("party", cluesAndStoryPanel())}
          </section>
        </div>
      </aside>
    </div>`;
    bind();
    const board = $(".map-board");
    board.scrollLeft = current.scrollLeft || 0;
    board.scrollTop = current.scrollTop || 0;
    scheduleMapFocus();
  }

  function renderLegacy() {
    const current = mapState();
    const selected = tile(current.selected);
    $("#kingdomSelect").value = state.kingdom;
    $("#kingdomSelect").disabled = Boolean(state.mercenaries.pendingAction);
    $("#undoButton").disabled = !current.history.length;
    $("#stepNav").innerHTML = STEPS.map((name, index) => `<button data-step="${index}" class="${state.step === index ? "active" : ""}">${index + 1}. ${name}</button>`).join("");
    $("#app").innerHTML = `<div class="stack">
      <section class="panel">
        <div class="panel-header">
          <div><div class="eyebrow">TTS FIXED GEOMETRY · ROUND ${state.round}</div><h2>${esc(kingdomData().label)}</h2><p class="muted">保持 TTS 3.06 单位基准尺寸、原坐标和原方向。全图预览只供参考，不改变探索状态。</p></div>
          <div class="toolbar">
            <button class="small secondary" data-zoom="-0.2">缩小</button>
            <span class="badge zoom-badge">${Math.round(current.zoom * 100)}%</span>
            <button class="small secondary" data-zoom="0.2">放大</button>
            <input class="map-zoom-slider" type="range" min="${MAP_ZOOM_MIN * 100}" max="${MAP_ZOOM_MAX * 100}" step="1" value="${Math.round(current.zoom * 100)}" data-zoom-slider aria-label="地图缩放比例" title="拖动调节地图缩放比例">
            <button id="fitMap" class="small secondary">适合窗口</button>
            <button id="toggleAll" class="small secondary">${current.showAll ? "返回探索地图" : "预览全图"}</button>
          </div>
        </div>
        <div class="legend">
          <span class="badge gold">当前 ${esc(tileLabel(tile(current.current)))}</span>
          <span class="badge green">已探索 ${Object.values(current.tileState).filter(value => value === "explored").length}</span>
          <span class="badge">已揭示未探索 ${Object.values(current.tileState).filter(value => value === "revealed").length}</span>
          <span class="badge">已生成 ${current.placed.length} / ${kingdomData().tiles.length}</span>
          <span class="badge">所选 ${esc(tileLabel(selected))}</span>
        </div>
      </section>
      <div class="layout">
        <div class="stack">
          <div class="map-workspace">
            <section class="map-board"><div class="map-canvas" style="width:${Math.round(current.zoom * 100)}%">${mapSvg()}</div></section>
            ${kingdomPanel()}
          </div>
          ${tracksPanel()}
          ${state.step === 0 ? travelPanel() : ""}
          ${tileResolutionPanel()}
           ${state.step === 2 ? explorationToolsPanel() : ""}
          ${mercenaryPanel()}
          ${state.step === 3 ? cluesAndStoryPanel() : ""}
          <section class="panel">
            <div class="panel-header"><div><div class="eyebrow">SETTLEMENT HISTORY</div><h3>最近记录</h3></div><button id="nextStep" class="small">${state.step === 3 ? "完成本轮" : "进入下一步"}</button></div>
            <div class="list">${state.log.slice(0, 8).map(item => `<div class="list-row"><span>${esc(item.text)}</span><time class="tiny">${new Date(item.at).toLocaleTimeString()}</time></div>`).join("") || '<span class="muted">暂无结算记录</span>'}</div>
          </section>
        </div>
        <aside class="stack side">
          ${selectedTilePanel()}
          ${markerPanel()}
          ${wheelAndMonsterPanel()}
          ${fogPanel()}
          ${state.step !== 2 ? explorationToolsPanel() : ""}
          ${state.step !== 3 ? cluesAndStoryPanel() : ""}
        </aside>
      </div>
    </div>`;
    bind();
    const board = $(".map-board");
    board.scrollLeft = current.scrollLeft || 0;
    board.scrollTop = current.scrollTop || 0;
  }

  function readResolutionFields() {
    const pending = mapState().tileResolution;
    if (!pending) return;
    const values = {
      backTime: "#backTime", backThreat: "#backThreat", backClues: "#backClues",
      backFogIntensity: "#backFogIntensity",
      spawnTileId: "#threatSevenSpawnTile"
    };
    for (const [key, selector] of Object.entries(values)) {
      const input = $(selector);
      if (!input) continue;
      pending[key] = input.type === "number" ? Number(input.value) : input.value.trim();
    }
  }

  function safeShuffleExploration() {
    const exp = mapState().exploration;
    exp.deck = shuffle(exp.deck);
    let attempts = 0;
    while (card(exp.deck[0])?.special && attempts < exp.deck.length * 3) {
      exp.deck = shuffle(exp.deck);
      attempts += 1;
    }
  }

  function drawExplorationCard() {
    const current = mapState();
    const exp = current.exploration;
    if (state.step !== 2) return toast("请先进入探索步骤");
    if (state.mercenaries.pendingAction) return toast("请先完成盗贼探索牌选择");
    if (scoutingState(exp).reordering) return toast("请先确认或取消斥候牌序调整");
    if (exp.resolvedRound === state.round) return toast("本轮探索步骤已经完成");
    if (exp.current) return toast("请先结算当前探索牌");
    if (!exp.deck.length) {
      current.failed = "探索牌组为空";
      return save(true);
    }
    snapshot("抽取探索牌");
    exp.current = exp.deck.shift();
    exp.peek = false;
    clearScoutingPeek(exp);
    save(true);
  }

  function bind() {
    const current = mapState();
    const board = $(".map-board");
    let clickTimer = 0;
    let tokenDrag = null;
    board.addEventListener("scroll", () => {
      current.scrollLeft = board.scrollLeft;
      current.scrollTop = board.scrollTop;
      save();
    });
    board.addEventListener("pointerdown", event => {
      const token = event.target.closest("[data-map-token]");
      if (!token || event.button !== 0) return;
      const tileNode = token.closest("[data-tile]");
      if (!tileNode) return;
      event.preventDefault();
      event.stopPropagation();
      clearTimeout(clickTimer);
      token.setPointerCapture(event.pointerId);
      const angle = Number(tileNode.dataset.angle) || 0;
      tokenDrag = {
        token,
        tileNode,
        pointerId: event.pointerId,
        kind: token.dataset.tokenKind,
        id: token.dataset.mapToken,
        tileId: token.dataset.tokenTile,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startX: Number(token.dataset.tokenX) || 50,
        startY: Number(token.dataset.tokenY) || 50,
        radians: angle * Math.PI / 180,
        x: Number(token.dataset.tokenX) || 50,
        y: Number(token.dataset.tokenY) || 50,
        moved: false,
        snapshotted: false
      };
      token.classList.add("dragging");
    });
    board.addEventListener("pointermove", event => {
      if (!tokenDrag || event.pointerId !== tokenDrag.pointerId) return;
      event.preventDefault();
      const dx = event.clientX - tokenDrag.startClientX;
      const dy = event.clientY - tokenDrag.startClientY;
      if (!tokenDrag.snapshotted && Math.hypot(dx, dy) > 3) {
        snapshot("移动地图 Token");
        tokenDrag.snapshotted = true;
        tokenDrag.moved = true;
      }
      if (!tokenDrag.moved) return;
      const cosine = Math.cos(tokenDrag.radians);
      const sine = Math.sin(tokenDrag.radians);
      const localDx = cosine * dx + sine * dy;
      const localDy = -sine * dx + cosine * dy;
      const tileWidth = Math.max(1, tokenDrag.tileNode.offsetWidth);
      const tileHeight = Math.max(1, tokenDrag.tileNode.offsetHeight);
      const halfX = tokenDrag.token.offsetWidth / tileWidth * 50;
      const halfY = tokenDrag.token.offsetHeight / tileHeight * 50;
      const nextX = clamp(tokenDrag.startX + localDx / tileWidth * 100, halfX, 100 - halfX);
      const nextY = clamp(tokenDrag.startY + localDy / tileHeight * 100, halfY, 100 - halfY);
      const overlaps = [...tokenDrag.tileNode.querySelectorAll("[data-map-token]")].some(other => {
        if (other === tokenDrag.token) return false;
        const otherX = Number.parseFloat(other.style.left);
        const otherY = Number.parseFloat(other.style.top);
        const minimumX = (tokenDrag.token.offsetWidth + other.offsetWidth) / tileWidth * 50;
        const minimumY = (tokenDrag.token.offsetHeight + other.offsetHeight) / tileHeight * 50;
        return Math.abs(nextX - otherX) < minimumX && Math.abs(nextY - otherY) < minimumY;
      });
      if (overlaps) return;
      tokenDrag.x = nextX;
      tokenDrag.y = nextY;
      tokenDrag.token.style.left = `${tokenDrag.x}%`;
      tokenDrag.token.style.top = `${tokenDrag.y}%`;
    });
    const finishTokenDrag = event => {
      if (!tokenDrag || event.pointerId !== tokenDrag.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      tokenDrag.token.classList.remove("dragging");
      if (tokenDrag.token.hasPointerCapture(event.pointerId)) {
        tokenDrag.token.releasePointerCapture(event.pointerId);
      }
      if (tokenDrag.moved) {
        tokenDrag.token.dataset.tokenX = String(tokenDrag.x);
        tokenDrag.token.dataset.tokenY = String(tokenDrag.y);
        setTokenPosition(tokenDrag.kind, tokenDrag.id, tokenDrag.tileId, {
          x: Number(tokenDrag.x.toFixed(2)),
          y: Number(tokenDrag.y.toFixed(2))
        });
        save();
      }
      tokenDrag = null;
    };
    board.addEventListener("pointerup", finishTokenDrag);
    board.addEventListener("pointercancel", finishTokenDrag);
    board.addEventListener("click", event => {
      if (event.target.closest("[data-map-token]")) return;
      const node = event.target.closest("[data-tile]");
      if (!node) return;
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        current.selected = node.dataset.tile;
        save(true);
      }, 210);
    });
    board.addEventListener("dblclick", event => {
      if (event.target.closest("[data-map-token]")) return;
      const node = event.target.closest("[data-tile]");
      if (!node) return;
      event.preventDefault();
      clearTimeout(clickTimer);
      beginTile(node.dataset.tile);
    });

    $$("[data-tool-tab]").forEach(button => button.addEventListener("click", () => {
      activeTool = button.dataset.toolTab;
      $$("[data-tool-tab]").forEach(tab => {
        const selected = tab.dataset.toolTab === activeTool;
        tab.classList.toggle("active", selected);
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
      });
      $$("[data-tool-panel]").forEach(panel => {
        panel.hidden = panel.dataset.toolPanel !== activeTool;
      });
    }));
    $$("[data-tool-tab]").forEach(button => button.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const tabs = $$("[data-tool-tab]");
      const index = tabs.indexOf(button);
      const target = event.key === "Home"
        ? tabs[0]
        : event.key === "End"
          ? tabs[tabs.length - 1]
          : tabs[(index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
      target?.focus();
      target?.click();
    }));
    $$("[data-zoom]").forEach(button => button.addEventListener("click", () => {
      setMapZoom(current.zoom + Number(button.dataset.zoom));
    }));
    $$('[data-zoom-slider]').forEach(slider => slider.addEventListener("input", () => {
      setMapZoom(Number(slider.value) / 100);
    }));
    $("#fitMap")?.addEventListener("click", () => {
      current.autoFocus = !current.showAll;
      current.zoom = 1;
      current.scrollLeft = 0;
      current.scrollTop = 0;
      save(true);
    });
    $("#toggleAll")?.addEventListener("click", () => { current.showAll = !current.showAll; save(true); });
    $("#openKingdomPanel")?.addEventListener("click", () => $("#kingdomPanelDialog")?.showModal());
    $("#openKingdomPanelToolbar")?.addEventListener("click", () => $("#kingdomPanelDialog")?.showModal());
    $("#kingdomPanelDetails")?.addEventListener("toggle", event => {
      kingdomPanelExpanded = event.currentTarget.open;
    });
    $("#closeKingdomPanel")?.addEventListener("click", () => $("#kingdomPanelDialog")?.close());
    $("#kingdomPanelDialog")?.addEventListener("click", event => {
      if (event.target === event.currentTarget) event.currentTarget.close();
    });
    $("#selectedBeginButton")?.addEventListener("click", () => beginTile(current.selected));
    $("#forceMovePartyButton")?.addEventListener("click", () => forceMoveParty(current.selected));
    $("#showSpecificKingdomTile")?.addEventListener("click", () => {
      const id = $("#showKingdomTileSelect")?.value;
      if (!id) return toast("没有可展示的未揭示板块");
      showKingdomTiles([id], "展示指定王国板块");
    });
    $("#showKingdomTileType")?.addEventListener("change", event => {
      const count = randomKingdomTilePool(event.currentTarget.value).length;
      const countInput = $("#showKingdomTileCount");
      if (countInput) {
        countInput.max = String(Math.max(1, count));
        countInput.value = String(Math.min(Math.max(1, Number(countInput.value) || 1), Math.max(1, count)));
      }
      const hint = $("#showKingdomTileAvailable");
      if (hint) hint.textContent = `${event.currentTarget.value} 类型随机池 ${count} 块`;
    });
    $("#showRandomKingdomTiles")?.addEventListener("click", () => {
      const size = $("#showKingdomTileType")?.value || "";
      const amount = Math.floor(Number($("#showKingdomTileCount")?.value) || 0);
      const candidates = randomKingdomTilePool(size);
      if (amount < 1) return toast("展示数量至少为 1");
      if (amount > candidates.length) return toast(`${size} 类型随机池只有 ${candidates.length} 块`);
      showKingdomTiles(
        shuffle(candidates).slice(0, amount).map(item => item.id),
        `随机展示 ${amount} 块 ${size} 类型王国板块`,
        { includePlacedHidden: true, highlightRandom: true }
      );
    });
    $("#earlyRevealButton")?.addEventListener("click", () => {
      if (current.tileState[current.selected] !== "hidden") return;
      snapshot(`提前揭示 ${tileLabel(tile(current.selected))}`);
      revealMapTile(current, current.selected);
      addLog(`提前揭示但未探索：${tileLabel(tile(current.selected))}`);
      save(true);
    });
    $$("[data-begin]").forEach(button => button.addEventListener("click", () => beginTile(button.dataset.begin)));
    $("#applyStartingTile")?.addEventListener("click", () => {
      const startId = $("#startingTileSelect").value;
      if (!tile(startId)) return toast("起始板块不存在");
      const hasProgress = state.step !== 0
        || state.round !== 1
        || Number(state.trackers.threat) !== 0
        || Number(state.trackers.curse) !== 0
        || Number(state.trackers.time) !== 0
        || current.tileResolution
        || current.monsters.length
        || state.mercenaries.active.length
        || state.mercenaries.discard.length
        || Object.values(current.tileState).filter(value => value === "explored").length > 1
        || state.knights.some(knight => Object.values(knight.clues).some(value => Number(value) > 0));
      if (hasProgress && !confirm("更换起始板块会清空当前地图进度、深入轨、佣兵和已获得线索。继续吗？")) return;

      const districtWheel = deepCopy(current.districtWheel || {});
      const districtWheelLevels = deepCopy(current.districtWheelLevels || {});
      const districtWheelLocations = deepCopy(current.districtWheelLocations || {});
      const districtWheelSource = deepCopy(current.districtWheelSource || null);
      state.maps[state.kingdom] = defaultMap(state.kingdom, startId);
      state.maps[state.kingdom].districtWheel = districtWheel;
      state.maps[state.kingdom].districtWheelLevels = districtWheelLevels;
      state.maps[state.kingdom].districtWheelLocations = districtWheelLocations;
      state.maps[state.kingdom].districtWheelSource = districtWheelSource;
      state.trackers = { threat: 0, curse: 0, time: 0, unassignedClues: 0 };
      state.mercenaries = MERCENARY_RULES.createState();
      state.knights.forEach(knight => {
        knight.clues = { martial: 0, errant: 0, historic: 0, mystic: 0 };
      });
      enterStep(0);
      state.round = 1;
      state.log = [];
      addLog(`选择起始板块：${tileLabel(tile(startId))}`);
      save(true);
    });
    $("#backtrackButton")?.addEventListener("click", () => {
      const target = $("#backtrackTarget").value;
      if (!target) return toast("请选择走回头路目标");
      resolveBacktrack(target);
    });
    $("#startFogButton")?.addEventListener("click", () => {
      if (state.step !== 0 || current.fog.active) return toast("请先完成当前步骤，再进入弥雾");
      const target = $("#fogTarget").value;
      if (!target) return toast("请选择弥雾目标");
      const labeledIntensity = Number(tile(target)?.rules?.back?.fogIntensity);
      const defaultIntensity = Number.isFinite(labeledIntensity) && labeledIntensity > 0 ? String(labeledIntensity) : "1";
      let requestedIntensity;
      try {
        requestedIntensity = prompt("输入目标板块背面的弥雾浓度：", defaultIntensity);
      } catch {
        requestedIntensity = defaultIntensity;
      }
      const intensity = Number(requestedIntensity);
      if (!Number.isFinite(intensity) || intensity < 1) return;
      snapshot(`进入弥雾，目标 ${tileLabel(tile(target))}`);
      current.placed = [...new Set([...current.placed, target])];
      current.tileState[target] ||= "hidden";
      current.fog.deck = shuffle(current.fog.deck);
      if (!current.fog.deck.length) {
        current.failed = "进入弥雾时牌组为空";
        return save(true);
      }
      current.fog = {
        ...current.fog,
        active: true,
        target,
        intensity,
        route: [],
        used: [],
        total: 0,
        current: current.fog.deck.shift(),
        hazardPending: false,
        started: false,
        correctedEver: false,
        baneHalf: false,
        baneFull: 0,
        heading: 0,
        peek: { source: "top", cards: [], destinations: [] }
      };
      changeThreat(1);
      addLog(`进入弥雾：威胁 +1，目标 ${tileLabel(tile(target))}，浓度 ${intensity}`);
      save(true);
    });
    $("#advanceTileButton")?.addEventListener("click", () => { readResolutionFields(); advanceTileResolution(); });
    $("#cancelTileButton")?.addEventListener("click", undo);
    $("#skipTravelButton")?.addEventListener("click", skipTravelStep);

    $("#addPathMarker")?.addEventListener("click", () => {
      const type = $("#pathMarkerType").value;
      current.pathMarkers.push({ id: uid(), from: current.selected, type });
      addLog(`添加路径标记：${PATH_MARKERS.find(([id]) => id === type)?.[1]}`);
      save(true);
    });
    $("#addTileMarker")?.addEventListener("click", () => {
      current.tileMarkers.push({ id: uid(), tileId: current.selected, type: $("#tileMarkerType").value });
      save(true);
    });
    const addCustomTileMarker = () => {
      const text = customMarkerText($("#customMarkerText")?.value);
      if (!text) return toast("请输入自定义标记文字");
      current.tileMarkers.push({ id: uid(), tileId: current.selected, type: "custom", text });
      save(true);
    };
    $("#addCustomTileMarker")?.addEventListener("click", addCustomTileMarker);
    $("#customMarkerText")?.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      addCustomTileMarker();
    });
    $$("[data-remove-path]").forEach(button => button.addEventListener("click", () => {
      current.pathMarkers = current.pathMarkers.filter(item => item.id !== button.dataset.removePath);
      save(true);
    }));
    $$("[data-remove-tile-marker]").forEach(button => button.addEventListener("click", () => {
      current.tileMarkers = current.tileMarkers.filter(item => item.id !== button.dataset.removeTileMarker);
      save(true);
    }));

    $$("[data-add-kingdom-marker]").forEach(button => button.addEventListener("click", () => {
      current.kingdomMarkers ||= [];
      const type = button.closest(".kingdom-marker-toolbar")?.querySelector("[data-kingdom-marker-select]")?.value || "generic";
      const [x, y] = KINGDOM_MARKER_STARTS[current.kingdomMarkers.length % KINGDOM_MARKER_STARTS.length];
      const dialogWasOpen = Boolean(button.closest("dialog")?.open);
      snapshot("添加王国版图标记");
      current.kingdomMarkers.push({ id: uid(), type, x, y });
      saveCritical(true);
      if (dialogWasOpen) $("#kingdomPanelDialog")?.showModal();
    }));
    $$("[data-remove-kingdom-marker]").forEach(button => button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      const dialogWasOpen = Boolean(button.closest("dialog")?.open);
      snapshot("移除王国版图标记");
      current.kingdomMarkers = (current.kingdomMarkers || []).filter(marker => marker.id !== button.dataset.removeKingdomMarker);
      saveCritical(true);
      if (dialogWasOpen) $("#kingdomPanelDialog")?.showModal();
    }));

    $$(".kingdom-board-scene").forEach(scene => {
      let markerDrag = null;
      scene.addEventListener("pointerdown", event => {
        if (event.button !== 0 || event.target.closest("[data-remove-kingdom-marker]")) return;
        const marker = event.target.closest("[data-kingdom-marker]");
        if (!marker) return;
        event.preventDefault();
        event.stopPropagation();
        marker.setPointerCapture(event.pointerId);
        markerDrag = {
          marker,
          id: marker.dataset.kingdomMarker,
          pointerId: event.pointerId,
          rect: scene.getBoundingClientRect(),
          startClientX: event.clientX,
          startClientY: event.clientY,
          x: Number(marker.dataset.markerX) || 50,
          y: Number(marker.dataset.markerY) || 50,
          moved: false,
          snapshotted: false
        };
        marker.classList.add("dragging");
      });
      scene.addEventListener("pointermove", event => {
        if (!markerDrag || event.pointerId !== markerDrag.pointerId) return;
        event.preventDefault();
        const distance = Math.hypot(event.clientX - markerDrag.startClientX, event.clientY - markerDrag.startClientY);
        if (!markerDrag.snapshotted && distance > 3) {
          snapshot("移动王国版图标记");
          markerDrag.snapshotted = true;
          markerDrag.moved = true;
        }
        if (!markerDrag.moved) return;
        const halfX = (markerDrag.marker.offsetWidth / 2 + 12) / Math.max(1, markerDrag.rect.width) * 100;
        const halfY = (markerDrag.marker.offsetHeight / 2 + 12) / Math.max(1, markerDrag.rect.height) * 100;
        markerDrag.x = clamp((event.clientX - markerDrag.rect.left) / markerDrag.rect.width * 100, halfX, 100 - halfX);
        markerDrag.y = clamp((event.clientY - markerDrag.rect.top) / markerDrag.rect.height * 100, halfY, 100 - halfY);
        $$("[data-kingdom-marker]").forEach(node => {
          if (node.dataset.kingdomMarker !== markerDrag.id) return;
          node.style.left = `${markerDrag.x}%`;
          node.style.top = `${markerDrag.y}%`;
          node.dataset.markerX = String(markerDrag.x);
          node.dataset.markerY = String(markerDrag.y);
        });
      });
      const finishKingdomMarkerDrag = event => {
        if (!markerDrag || event.pointerId !== markerDrag.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        markerDrag.marker.classList.remove("dragging");
        if (markerDrag.marker.hasPointerCapture(event.pointerId)) markerDrag.marker.releasePointerCapture(event.pointerId);
        if (markerDrag.moved) {
          const record = (current.kingdomMarkers || []).find(marker => marker.id === markerDrag.id);
          if (record) {
            record.x = Number(markerDrag.x.toFixed(2));
            record.y = Number(markerDrag.y.toFixed(2));
            saveCritical(false);
          }
        }
        markerDrag = null;
      };
      scene.addEventListener("pointerup", finishKingdomMarkerDrag);
      scene.addEventListener("pointercancel", finishKingdomMarkerDrag);
    });

    $$(".effect-card-stage").forEach(stage => {
      let effectMarkerDrag = null;
      stage.addEventListener("pointerdown", event => {
        if (event.button !== 0) return;
        const marker = event.target.closest("[data-effect-marker]");
        if (!marker) return;
        event.preventDefault();
        event.stopPropagation();
        marker.setPointerCapture(event.pointerId);
        const startPosition = effectMarkerPosition({ x: marker.dataset.markerX, y: marker.dataset.markerY });
        effectMarkerDrag = {
          marker,
          id: marker.dataset.effectMarker,
          slotKey: marker.dataset.effectSlot,
          pointerId: event.pointerId,
          rect: stage.getBoundingClientRect(),
          startClientX: event.clientX,
          startClientY: event.clientY,
          x: startPosition.x,
          y: startPosition.y,
          moved: false,
          snapshotted: false
        };
        marker.classList.add("dragging");
      });
      stage.addEventListener("pointermove", event => {
        if (!effectMarkerDrag || event.pointerId !== effectMarkerDrag.pointerId) return;
        event.preventDefault();
        const distance = Math.hypot(event.clientX - effectMarkerDrag.startClientX, event.clientY - effectMarkerDrag.startClientY);
        if (!effectMarkerDrag.snapshotted && distance > 3) {
          snapshot("移动探索效果牌标记");
          effectMarkerDrag.snapshotted = true;
          effectMarkerDrag.moved = true;
        }
        if (!effectMarkerDrag.moved) return;
        const halfX = effectMarkerDrag.marker.offsetWidth / Math.max(1, effectMarkerDrag.rect.width) * 50;
        const halfY = effectMarkerDrag.marker.offsetHeight / Math.max(1, effectMarkerDrag.rect.height) * 50;
        effectMarkerDrag.x = clamp((event.clientX - effectMarkerDrag.rect.left) / effectMarkerDrag.rect.width * 100, halfX, 100 - halfX);
        effectMarkerDrag.y = clamp((event.clientY - effectMarkerDrag.rect.top) / effectMarkerDrag.rect.height * 100, halfY, 100 - halfY);
        $$('[data-effect-marker]').forEach(node => {
          if (node.dataset.effectMarker !== effectMarkerDrag.id || node.dataset.effectSlot !== effectMarkerDrag.slotKey) return;
          node.style.left = `${effectMarkerDrag.x}%`;
          node.style.top = `${effectMarkerDrag.y}%`;
          node.dataset.markerX = String(effectMarkerDrag.x);
          node.dataset.markerY = String(effectMarkerDrag.y);
        });
      });
      const finishEffectMarkerDrag = event => {
        if (!effectMarkerDrag || event.pointerId !== effectMarkerDrag.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        effectMarkerDrag.marker.classList.remove("dragging");
        if (effectMarkerDrag.marker.hasPointerCapture(event.pointerId)) effectMarkerDrag.marker.releasePointerCapture(event.pointerId);
        if (effectMarkerDrag.moved) {
          const markers = current.exploration.effectMarkers?.[effectMarkerDrag.slotKey] || [];
          const record = markers.find(marker => marker.id === effectMarkerDrag.id);
          if (record) {
            record.x = Number(effectMarkerDrag.x.toFixed(2));
            record.y = Number(effectMarkerDrag.y.toFixed(2));
            if (event.type === "pointerup") effectMarkerDrag.marker.dataset.effectMarkerMoved = "true";
            saveCritical(false);
          }
        }
        effectMarkerDrag = null;
      };
      stage.addEventListener("pointerup", finishEffectMarkerDrag);
      stage.addEventListener("pointercancel", finishEffectMarkerDrag);
    });

    $$("[data-add-effect-marker]").forEach(button => button.addEventListener("click", () => {
      const slotKey = button.dataset.addEffectMarker;
      const exp = current.exploration;
      exp.effectMarkers ||= {};
      const markers = Array.isArray(exp.effectMarkers[slotKey]) ? exp.effectMarkers[slotKey] : [];
      if (markers.length >= EFFECT_MARKER_SLOTS.length) return toast("每张效果牌最多放置 8 个标记");
      const type = button.closest(".effect-card-controls")?.querySelector("[data-effect-marker-select]")?.value || "generic";
      const position = effectMarkerPosition(null, markers.length);
      snapshot("添加效果牌标记");
      markers.push({ id: uid(), type, ...position });
      exp.effectMarkers[slotKey] = markers;
      saveCritical(true);
    }));
    $$("[data-remove-effect-marker]").forEach(button => button.addEventListener("click", () => {
      if (button.dataset.effectMarkerMoved === "true") {
        delete button.dataset.effectMarkerMoved;
        return;
      }
      const slotKey = button.dataset.effectSlot;
      const exp = current.exploration;
      const markers = Array.isArray(exp.effectMarkers?.[slotKey]) ? exp.effectMarkers[slotKey] : [];
      snapshot("移除效果牌标记");
      exp.effectMarkers[slotKey] = markers.filter(marker => marker.id !== button.dataset.removeEffectMarker);
      saveCritical(true);
    }));
    $$("[data-discard-effect]").forEach(button => button.addEventListener("click", () => {
      const slotKey = button.dataset.discardEffect;
      const exp = current.exploration;
      const districtId = slotKey.startsWith("district:") ? slotKey.slice("district:".length) : "";
      const cardId = slotKey === "active" ? exp.activeEffect : exp.districtEffects[districtId];
      if (!cardId) return;
      snapshot("弃置探索效果牌");
      exp.discard.push(cardId);
      if (slotKey === "active") exp.activeEffect = null;
      else delete exp.districtEffects[districtId];
      if (exp.effectMarkers) delete exp.effectMarkers[slotKey];
      addLog(`弃置探索效果牌：${card(cardId)?.name || cardId}`);
      saveCritical(true);
    }));

    $$("[data-wheel]").forEach(select => select.addEventListener("change", () => {
      current.districtWheel[select.dataset.wheel] = select.value;
      current.districtWheelLevels[select.dataset.wheel] = null;
      current.districtWheelLocations[select.dataset.wheel] = "";
      if (current.districtWheelSource) current.districtWheelSource.manuallyAdjusted = true;
      save(true);
    }));
    $("#syncDistrictWheel")?.addEventListener("click", () => {
      if (syncDistrictWheelFromUpstream({ force: true, notify: true })) save(true);
    });
    $$('[data-wheel-monster]').forEach(token => token.addEventListener("click", () => {
      const dialog = $("#kingdomMonsterActionDialog");
      const monster = DATA.monsters.find(item => item.id === token.dataset.wheelMonster);
      const district = rules().districts.find(item => item.id === token.dataset.wheelDistrict);
      const level = Math.max(1, Math.trunc(Number(token.dataset.wheelLevel) || 1));
      if (!dialog || !monster) return;
      dialog.dataset.monsterId = monster.id;
      dialog.dataset.districtId = token.dataset.wheelDistrict || "";
      dialog.dataset.level = String(level);
      dialog.dataset.conflictLocation = token.dataset.wheelLocation || "";
      dialog.querySelector("[data-wheel-action-title]").textContent = `${monster.name} · Lv.${level}`;
      dialog.querySelector("[data-wheel-action-detail]").textContent = token.dataset.wheelLocation
        ? `${district?.name || "未指定地区"}：遭遇照常进行；冲突改在${token.dataset.wheelLocation}中进行。`
        : `${district?.name || "未指定地区"}：选择进入对应等级的遭遇或冲突。`;
      dialog.querySelector('[data-wheel-monster-action="encounter"]').textContent = `进入 Lv.${level} 遭遇`;
      dialog.querySelector('[data-wheel-monster-action="conflict"]').textContent = `进入 Lv.${level} 冲突`;
      dialog.showModal();
    }));
    $("[data-close-wheel-action]")?.addEventListener("click", () => $("#kingdomMonsterActionDialog")?.close());
    $("#kingdomMonsterActionDialog")?.addEventListener("click", event => {
      if (event.target === event.currentTarget) event.currentTarget.close();
    });
    $$('[data-wheel-monster-action]').forEach(button => button.addEventListener("click", async () => {
      const dialog = $("#kingdomMonsterActionDialog");
      if (!dialog?.dataset.monsterId) return;
      dialog.close();
      await openKingdomWheelMonster(
        dialog.dataset.monsterId,
        dialog.dataset.level,
        dialog.dataset.districtId,
        button.dataset.wheelMonsterAction,
        dialog.dataset.conflictLocation
      );
    }));
    $$('[data-rotate-wheel-once]').forEach(button => button.addEventListener("click", () => {
      snapshot("地区轮盘顺时针轮换 1 格");
      rotateDistrictWheel(current, 1, 1, true);
      addLog("地区轮盘顺时针轮换 1 格");
      save(true);
    }));
    $$("[data-rotate]").forEach(button => button.addEventListener("click", () => {
      const count = Math.max(1, Number($("#rotateCount").value) || 1);
      rotateDistrictWheel(current, Number(button.dataset.rotate), count, true);
      addLog(`地区轮盘${Number(button.dataset.rotate) > 0 ? "顺" : "逆"}时针移动 ${count} 格`);
      save(true);
    }));
    $("#huntButton")?.addEventListener("click", () => { snapshot("追击怪物移动"); moveHunt(1); save(true); });
    $("#resetThreatSeven")?.addEventListener("click", () => {
      snapshot("重新结算首次威胁 7+ 生成");
      current.threatSevenSpawned = false;
      current.threatSevenPending = true;
      addLog("已重置首次威胁 7+ 生成；将在下一次王国板块步骤 d 按当前地区轮盘重新结算");
      save(true);
    });
    $("#spawnMonster")?.addEventListener("click", () => {
      const monsterId = $("#monsterSelect").value;
      if (!tileIsFaceUp(current.selected, current)) {
        return toast("怪物只能生成在正面朝上的王国板块");
      }
      current.monsters = current.monsters.filter(item => item.monsterId !== monsterId);
      current.monsters.push({ id: uid(), monsterId, tileId: current.selected });
      save(true);
    });
    $$("[data-move-monster]").forEach(button => button.addEventListener("click", () => {
      if (!tileIsFaceUp(current.selected, current)) return toast("怪物只能移动到正面朝上的王国板块");
      const marker = current.monsters.find(item => item.id === button.dataset.moveMonster);
      if (marker) marker.tileId = current.selected;
      if (marker?.tileId === current.current) triggerPendingEncounter(marker.id);
      save(true);
    }));
    $$("[data-remove-monster]").forEach(button => button.addEventListener("click", () => {
      current.monsters = current.monsters.filter(item => item.id !== button.dataset.removeMonster);
      if (current.pendingEncounter === button.dataset.removeMonster) current.pendingEncounter = null;
      save(true);
    }));
    $("#openPendingEncounter")?.addEventListener("click", openPendingEncounter);
    $$("[data-hire-mercenary]").forEach(button => button.addEventListener("click", () => {
      const cardId = button.dataset.hireMercenary;
      const definition = MERCENARY_RULES.CATALOG[cardId];
      if (!definition) return;
      snapshot(`雇佣${definition.name} ${definition.level}`);
      if (!MERCENARY_RULES.hire(state.mercenaries, cardId)) {
        mapState().history.pop();
        return toast(`该${definition.name}已经雇佣或进入弃牌区`);
      }
      addLog(`雇佣${definition.name} ${definition.level} 级（左上角数值 ${definition.value}，未自动扣除资源）`);
      save(true);
    }));
    $$("[data-mercenary-conflict]").forEach(button => button.addEventListener("click", () => {
      const cardId = button.dataset.mercenaryConflict;
      const hired = activeMercenary(cardId);
      const definition = MERCENARY_RULES.CATALOG[cardId];
      if (!hired || !definition) return;
      const face = hired.face;
      if (!confirm(`确认${definition.name} ${definition.level} 级 ${face} 面的冲突效果已人工结算？`)) return;
      snapshot(`${definition.name} ${definition.level} ${face} 面冲突结算`);
      const transition = MERCENARY_RULES.advance(state.mercenaries, cardId);
      addLog(`${definition.name} ${definition.level} 级 ${face} 面冲突效果已人工结算；${transition.to === "B" ? "翻至 B 面" : "B 面结算后弃置"}`);
      save(true);
    }));
    $$("[data-mercenary-move]").forEach(button => button.addEventListener("click", () => {
      const cardId = button.dataset.mercenaryMove;
      const target = button.closest(".mercenary-card")?.querySelector("[data-mercenary-target]")?.value || "";
      movePartyWithMage(cardId, target);
    }));
    $$("[data-mercenary-redraw]").forEach(button => button.addEventListener("click", () => {
      const cardId = button.dataset.mercenaryRedraw;
      const hired = activeMercenary(cardId);
      const definition = MERCENARY_RULES.CATALOG[cardId];
      const exp = current.exploration;
      if (!hired || hired.face !== "A" || definition?.level !== 1) return;
      if (state.step !== 2 || exp.resolvedRound === state.round || !exp.current || !exp.deck.length || state.mercenaries.pendingAction) {
        return toast("当前不能使用盗贼 1 的重抽效果");
      }
      const previousCardId = exp.current;
      const result = MERCENARY_RULES.redrawExploration(previousCardId, exp.deck);
      if (!result) return toast("探索牌组没有可用于重抽的牌");
      snapshot("盗贼 1 A 忽略探索牌并重抽");
      exp.current = result.current;
      exp.deck = result.deck;
      exp.discard.push(...result.discarded);
      exp.peek = false;
      clearScoutingPeek(exp);
      MERCENARY_RULES.advance(state.mercenaries, cardId);
      addLog(`盗贼 1 级 A 面：忽略并弃置 ${card(previousCardId)?.name || previousCardId}，重抽 ${card(result.current)?.name || result.current}，佣兵翻至 B 面`);
      activeTool = "exploration";
      save(true);
    }));
    $$("[data-mercenary-choice]").forEach(button => button.addEventListener("click", () => {
      const cardId = button.dataset.mercenaryChoice;
      const hired = activeMercenary(cardId);
      const definition = MERCENARY_RULES.CATALOG[cardId];
      const exp = current.exploration;
      if (!hired || hired.face !== "A" || !definition || definition.level < 2) return;
      if (state.step !== 2 || exp.resolvedRound === state.round || exp.current || state.mercenaries.pendingAction) {
        return toast("当前不能开始盗贼探索牌选择");
      }
      const pending = MERCENARY_RULES.beginExplorationChoice(cardId, exp.deck);
      if (!pending) return toast(`探索牌组不足 ${MERCENARY_RULES.drawCount(cardId)} 张`);
      state.mercenaries.pendingAction = pending;
      activeTool = "mercenary";
      addLog(`盗贼 ${definition.level} 级 A 面：查看探索牌组顶部 ${pending.drawn.length} 张，等待选择`);
      save(true);
    }));
    $("#cancelMercenaryChoice")?.addEventListener("click", () => {
      if (!state.mercenaries.pendingAction) return;
      const definition = MERCENARY_RULES.CATALOG[state.mercenaries.pendingAction.cardId];
      state.mercenaries.pendingAction = null;
      addLog(`取消盗贼 ${definition?.level || ""} 级探索牌选择；牌序未改变`);
      save(true);
    });
    $("#confirmMercenaryChoice")?.addEventListener("click", () => {
      const pending = state.mercenaries.pendingAction;
      if (!pending) return;
      const definition = MERCENARY_RULES.CATALOG[pending.cardId];
      const exp = current.exploration;
      const resolvedCardId = $("#mercenaryResolveCard")?.value || "";
      const discardedCardId = definition.level === 3 ? $("#mercenaryDiscardCard")?.value || "" : "";
      if (definition.level === 3 && resolvedCardId === discardedCardId) {
        return toast("结算牌和弃置牌不能是同一张");
      }
      const result = MERCENARY_RULES.commitExplorationChoice(
        pending,
        exp.deck,
        resolvedCardId,
        discardedCardId
      );
      if (!result) return toast("探索牌组已变化，请取消后重试");

      state.mercenaries.pendingAction = null;
      snapshot(`盗贼 ${definition.level} A 选择探索牌`);
      state.mercenaries.pendingAction = pending;
      exp.current = result.current;
      exp.deck = result.deck;
      exp.discard.push(...result.discarded);
      exp.peek = false;
      clearScoutingPeek(exp);
      MERCENARY_RULES.advance(state.mercenaries, pending.cardId);
      const returned = result.returned?.length
        ? `，${result.returned.map(cardId => card(cardId)?.name || cardId).join("、")}放回牌组顶部`
        : "";
      addLog(`盗贼 ${definition.level} 级 A 面：选择 ${card(result.current)?.name || result.current} 结算，弃置 ${result.discarded.map(cardId => card(cardId)?.name || cardId).join("、")}${returned}，佣兵翻至 B 面`);
      activeTool = "exploration";
      save(true);
    });
    $$("[data-mercenary-skip]").forEach(button => button.addEventListener("click", () => {
      skipPendingEncounter(button.dataset.mercenarySkip);
    }));

    $("#shuffleExploration")?.addEventListener("click", () => {
      if (state.mercenaries.pendingAction) return toast("请先完成盗贼探索牌选择");
      if (scoutingState(current.exploration).reordering) return toast("请先确认或取消斥候牌序调整");
      snapshot("洗混探索牌组");
      safeShuffleExploration();
      current.exploration.peek = false;
      clearScoutingPeek(current.exploration);
      save(true);
    });
    $("#scoutRevealNeighbor")?.addEventListener("click", () => {
      if (state.mercenaries.pendingAction) return toast("请先完成盗贼探索牌选择");
      const target = $("#scoutRevealTile")?.value;
      if (!target || !tile(target)) return toast("请选择要揭示的起始相邻板块");
      if (current.tileState[target] === "explored") return toast("该板块已经探索");
      snapshot(`斥候揭示 ${tileLabel(tile(target))}`);
      current.placed = [...new Set([...current.placed, current.startingTile])];
      current.tileState[current.startingTile] ||= "explored";
      revealMapTile(current, target);
      current.selected = target;
      addLog(`斥候操作：揭示 ${tileLabel(tile(target))}，标记为未探索`);
      save(true);
    });
    $("#scoutPeekTop3")?.addEventListener("click", () => {
      if (state.mercenaries.pendingAction) return toast("请先完成盗贼探索牌选择");
      const exp = current.exploration;
      const scouting = scoutingState(exp);
      scouting.lastPeek = exp.deck.slice(0, 3);
      scouting.reordering = false;
      addLog(`斥候操作：查看探索牌组顶 ${scouting.lastPeek.length} 张，牌序未改变`);
      save(true);
    });
    $("#scoutStartReorder")?.addEventListener("click", () => {
      if (state.mercenaries.pendingAction) return toast("请先完成盗贼探索牌选择");
      const exp = current.exploration;
      const count = Math.trunc(Number($("#scoutReorderCount")?.value));
      if (!Number.isFinite(count) || count < 1) return toast("查看数量至少为 1 张");
      if (count > exp.deck.length) return toast(`探索牌组目前只有 ${exp.deck.length} 张`);
      const scouting = scoutingState(exp);
      scouting.lastPeek = exp.deck.slice(0, count);
      scouting.reordering = true;
      addLog(`斥候操作：查看探索牌组顶 ${count} 张并准备调整顺序`);
      save(true);
    });
    $$('[data-scout-move]').forEach(button => button.addEventListener("click", () => {
      const scouting = scoutingState(current.exploration);
      if (!scouting.reordering) return;
      const index = Number(button.dataset.scoutMove);
      const target = index + Number(button.dataset.scoutOffset);
      if (!Number.isInteger(index) || target < 0 || target >= scouting.lastPeek.length) return;
      [scouting.lastPeek[index], scouting.lastPeek[target]] = [scouting.lastPeek[target], scouting.lastPeek[index]];
      save(true);
    }));
    $("#scoutConfirmReorder")?.addEventListener("click", () => {
      const exp = current.exploration;
      const scouting = scoutingState(exp);
      if (!scouting.reordering || !scouting.lastPeek.length) return;
      const reordered = [...scouting.lastPeek];
      const original = exp.deck.slice(0, reordered.length);
      if (!containSameCards(original, reordered)) {
        clearScoutingPeek(exp);
        toast("探索牌组已变化，请重新查看后调整");
        return save(true);
      }
      const changed = reordered.some((id, index) => id !== original[index]);
      clearScoutingPeek(exp);
      if (changed) {
        snapshot(`斥候调整牌顶 ${reordered.length} 张`);
        exp.deck.splice(0, reordered.length, ...reordered);
      }
      const order = reordered.map(id => card(id)?.name || id).join(" → ");
      addLog(`斥候操作：${changed ? "调整并" : "按原顺序"}放回牌顶 ${reordered.length} 张：${order}`);
      save(true);
    });
    $("#scoutCancelReorder")?.addEventListener("click", () => {
      clearScoutingPeek(current.exploration);
      save(true);
    });
    $("#scoutClosePeek")?.addEventListener("click", () => {
      clearScoutingPeek(current.exploration);
      save(true);
    });
    $$("[data-add-survey]").forEach(button => button.addEventListener("click", () => {
      if (state.mercenaries.pendingAction) return toast("请先完成盗贼探索牌选择");
      const count = Number(button.dataset.addSurvey) || 0;
      const available = surveyExplorationCards().filter(item => !explorationCardsInUse(current.exploration).has(item.id));
      if (available.length < count) return toast(`可加入的 Survey 只剩 ${available.length} 张`);
      snapshot(`斥候洗入 ${count} 张 Survey`);
      const additions = addSpecialExplorationCards(surveyExplorationCards(), count);
      if (!additions.length) return toast("Survey 已经在牌组或结算区");
      const scouting = scoutingState(current.exploration);
      scouting.surveyAddedCount += additions.length;
      clearScoutingPeek(current.exploration);
      addLog(`斥候操作：洗入 ${additions.length} 张 Survey，探索牌组已洗混`);
      save(true);
    }));
    $("#addSpecialExploration")?.addEventListener("click", () => {
      if (state.mercenaries.pendingAction) return toast("请先完成盗贼探索牌选择");
      const additions = addSpecialExplorationCards(rules().specialExploration);
      clearScoutingPeek(current.exploration);
      if (!additions.length) return toast("特殊探索牌已经在牌组或结算区");
      snapshot("加入特殊探索牌");
      addLog(`加入 ${additions.length} 张特殊探索牌并洗混；若特殊牌在顶部已自动重洗`);
      save(true);
    });
    $("#peekExploration")?.addEventListener("click", () => {
      if (state.mercenaries.pendingAction) return toast("请先完成盗贼探索牌选择");
      current.exploration.peek = !current.exploration.peek;
      save(true);
    });
    $("#drawExploration")?.addEventListener("click", drawExplorationCard);
    $("#skipExplorationButton")?.addEventListener("click", skipExplorationStep);
    $("#resolveExploration")?.addEventListener("click", () => {
      if (state.step !== 2) return toast("请先进入探索步骤");
      const exp = current.exploration;
      const activeCard = card(exp.current);
      if (!activeCard) return;
      const type = $("#effectType").value;
      const district = $("#effectDistrict").value;
      if (type === "district") {
        if (exp.districtEffects[district]) {
          exp.discard.push(exp.current);
          toast("该地区已有探索效果，新牌已弃置");
        } else {
          exp.districtEffects[district] = exp.current;
        }
      } else if (type === "active") {
        if (exp.activeEffect) {
          exp.discard.push(exp.current);
          toast("已有激活效果，新牌已弃置");
        } else {
          exp.activeEffect = exp.current;
        }
      } else {
        exp.discard.push(exp.current);
      }
      const wasSpecial = activeCard.special;
      if (!wasSpecial) exp.resolvedRound = state.round;
      addLog(`结算探索牌 ${activeCard.name}（${type === "instant" ? "立即" : type === "district" ? "地区" : "激活"}）`);
      exp.current = null;
      if (wasSpecial) toast("特殊探索牌已结算：请继续抽取下一张牌");
      save(true);
    });

    const selectedLowestFogEntry = fog => {
      const candidates = lowestFogEntries(fog);
      const selectedId = $("#fogLowestCard")?.value;
      return candidates.find(item => item.cardId === selectedId) || candidates[0] || null;
    };
    const clearFogSession = fog => {
      Object.assign(fog, {
        active: false,
        target: "",
        current: null,
        route: [],
        used: [],
        total: 0,
        intensity: 0,
        hazardPending: false,
        started: false,
        correctedEver: false,
        baneHalf: false,
        baneFull: 0,
        heading: 0,
        peek: { source: "top", cards: [], destinations: [] }
      });
    };
    const returnUsedFogCards = (fog, discardedEntry) => {
      FOG_RULES.returnUsed(fog, discardedEntry, shuffle);
    };
    const checkFogDeckExhaustion = fog => {
      const routeLength = fog.started ? fog.route.length : fog.current ? 1 : 0;
      if (fog.active && routeLength < fog.intensity && !fog.deck.length) {
        current.failed = "弥雾牌组耗尽，远征立即失败";
      }
    };

    $("#fogDiscardTop")?.addEventListener("click", () => {
      const fog = current.fog;
      if (fogPeekState(fog).cards.length) return toast("请先确认或取消弥雾牌查看");
      if (!fog.deck.length) return toast("弥雾牌堆为空");
      snapshot("弃置弥雾牌堆顶 1 张");
      FOG_RULES.discardTop(fog);
      checkFogDeckExhaustion(fog);
      addLog("从弥雾牌堆顶弃置 1 张（未查看）");
      save(true);
    });

    $("#fogReshuffleDeck")?.addEventListener("click", () => {
      const fog = current.fog;
      if (fogPeekState(fog).cards.length) return toast("请先确认或取消弥雾牌查看");
      const discarded = fog.discard.length;
      const total = fog.deck.length + discarded;
      if (!discarded && total < 2) return toast("弥雾牌组不足 2 张");
      snapshot(`重洗弥雾牌组 ${total} 张`);
      FOG_RULES.reshuffleDeck(fog, shuffle);
      addLog(`重洗弥雾牌组：${discarded} 张弃牌已洗回，共 ${total} 张`);
      save(true);
    });

    const startFogPeek = source => {
      const fog = current.fog;
      if (!fog.active) return toast("当前未在穿越弥雾");
      if (fog.hazardPending) return toast("请先完成当前侵害效果");
      if (fogPeekState(fog).cards.length) return;
      const count = Math.trunc(Number($("#fogPeekCount")?.value));
      if (!Number.isFinite(count) || count < 1) return toast("查看数量至少为 1 张");
      if (count > fog.deck.length) return toast(`弥雾牌堆目前只有 ${fog.deck.length} 张`);
      fog.peek = {
        source,
        cards: FOG_RULES.peekCards(fog.deck, count, source),
        destinations: Array(count).fill(source === "bottom" ? "bottom" : "top")
      };
      addLog(`弥雾：查看牌堆${source === "bottom" ? "底" : "顶"} ${count} 张，等待选择放置位置`);
      save(true);
    };
    $("#fogStartPeekTop")?.addEventListener("click", () => startFogPeek("top"));
    $("#fogStartPeekBottom")?.addEventListener("click", () => startFogPeek("bottom"));

    $$('[data-fog-peek-destination]').forEach(button => button.addEventListener("click", () => {
      const fog = current.fog;
      const peek = fogPeekState(fog);
      const index = Number(button.dataset.fogPeekIndex);
      const destination = button.dataset.fogPeekDestination;
      if (!Number.isInteger(index) || !peek.cards[index] || !["top", "bottom", "shuffle"].includes(destination)) return;
      peek.destinations[index] = destination;
      const group = button.closest(".fog-peek-choice");
      $$('[data-fog-peek-destination]', group).forEach(option => {
        option.setAttribute("aria-pressed", String(option.dataset.fogPeekDestination === destination));
      });
      const status = $(`[data-fog-peek-status="${index}"]`);
      if (status) {
        status.dataset.destination = destination;
        status.textContent = `去向：${fogPeekDestinationLabel(destination)}`;
      }
      const confirmButton = $("#fogConfirmPeek");
      if (confirmButton) confirmButton.textContent = fogPeekConfirmationLabel(peek);
      save();
    }));

    $("#fogConfirmPeek")?.addEventListener("click", () => {
      const fog = current.fog;
      const peek = fogPeekState(fog);
      if (!peek.cards.length) return;
      const result = FOG_RULES.resolvePeek(fog.deck, peek.cards, peek.destinations, shuffle, peek.source);
      if (!result) {
        clearFogPeek(fog);
        toast("弥雾牌堆已变化，请重新查看");
        return save(true);
      }
      snapshot(`放置查看的弥雾牌 ${peek.cards.length} 张`);
      fog.deck = result.deck;
      clearFogPeek(fog);
      addLog(`弥雾：查看的牌中 ${result.topCards.length} 张盖回牌顶，${result.bottomCards.length} 张放到牌底，${result.shuffledCards.length} 张洗回牌库`);
      save(true);
    });

    $("#fogCancelPeek")?.addEventListener("click", () => {
      const fog = current.fog;
      const peek = fogPeekState(fog);
      const count = peek.cards.length;
      if (!count) return;
      clearFogPeek(fog);
      addLog(`弥雾：${count} 张查看牌按原顺序放回牌${peek.source === "bottom" ? "底" : "顶"}`);
      save(true);
    });

    $("#fogStartCard")?.addEventListener("click", () => {
      const fog = current.fog;
      if (fogPeekState(fog).cards.length) return toast("请先确认或取消弥雾牌查看");
      if (!fog.current || fog.started) return;
      snapshot("建立起始弥雾卡");
      const entry = makeFogEntry(fog.current);
      FOG_RULES.start(fog, entry);
      checkFogDeckExhaustion(fog);
      addLog(`弥雾：建立起始卡，路径 ${fog.route.length}/${fog.intensity}，牌面值 ${entry.value}`);
      save(true);
    });

    const drawFogCard = corrected => {
      const fog = current.fog;
      if (!fog.active || !fog.started) return;
      if (fogPeekState(fog).cards.length) return toast("请先确认或取消弥雾牌查看");
      if (fog.hazardPending) return toast("请先完成当前侵害效果");
      if (fog.route.length >= fog.intensity) return toast("已达到目标弥雾浓度，请结算出现");
      if (!fog.deck.length) {
        current.failed = "弥雾牌组耗尽，远征立即失败";
        return save(true);
      }
      const pivotIndex = $("#fogPivot")?.value || 0;
      const turn = $("#fogTurn")?.value || "left";
      if (!FOG_RULES.canPlace(fog, corrected, pivotIndex, turn)) {
        return toast(corrected ? "该转向位置已有弥雾卡，请改选枢轴或转向" : "前方已有弥雾卡，不能保持方向");
      }
      snapshot(corrected ? "弥雾修正方向" : "弥雾保持方向");
      const entry = makeFogEntry(fog.deck.shift(), corrected);
      FOG_RULES.place(fog, entry, corrected, pivotIndex, turn);
      checkFogDeckExhaustion(fog);
      addLog(`弥雾：${corrected ? "修正方向" : "保持方向"}并抽取 1 张，路径 ${fog.route.length}/${fog.intensity}，弥雾值 ${fog.total}${fog.hazardPending ? "，等待结算侵害" : ""}`);
      save(true);
    };
    $("#fogStay")?.addEventListener("click", () => drawFogCard(false));
    $("#fogCorrect")?.addEventListener("click", () => drawFogCard(true));
    $("#fogHazardResolved")?.addEventListener("click", () => {
      const fog = current.fog;
      if (!fog.hazardPending) return;
      snapshot("确认弥雾侵害已结算");
      fog.hazardPending = false;
      addLog("弥雾：侵害效果已结算");
      save(true);
    });
    $("#fogBaneHalf")?.addEventListener("change", event => {
      const fog = current.fog;
      snapshot("调整半杯侵害指示物");
      fog.baneHalf = event.target.checked;
      updateFogTotal(fog);
      addLog(`弥雾：半杯侵害指示物${fog.baneHalf ? "获得" : "弃置"}`);
      save(true);
    });
    $("#fogBaneFull")?.addEventListener("change", event => {
      const fog = current.fog;
      snapshot("调整满杯侵害指示物");
      fog.baneFull = Math.max(0, Math.trunc(Number(event.target.value) || 0));
      updateFogTotal(fog);
      addLog(`弥雾：满杯侵害指示物调整为 ${fog.baneFull}，最终弥雾值 ${fog.total}`);
      save(true);
    });
    $("#fogWithdraw")?.addEventListener("click", () => {
      const fog = current.fog;
      if (fogPeekState(fog).cards.length) return toast("请先确认或取消弥雾牌查看");
      if (fog.hazardPending) return toast("请先完成当前侵害效果");
      snapshot("从弥雾撤回");
      const lowest = selectedLowestFogEntry(fog);
      if (lowest) fog.discard.push(lowest.cardId);
      returnUsedFogCards(fog, lowest);
      clearFogSession(fog);
      changeThreat(1);
      enterStep(2);
      addLog("从弥雾撤回：弃置路径上弥雾值最低的牌，威胁 +1，进入探索步骤");
      save(true);
    });
    $("#fogEmerge")?.addEventListener("click", () => {
      const fog = current.fog;
      if (fogPeekState(fog).cards.length) return toast("请先确认或取消弥雾牌查看");
      if (fog.hazardPending) return toast("请先完成当前侵害效果");
      if (fog.route.length !== fog.intensity) return;
      const outcome = fogOutcome(fog);
      snapshot(`从弥雾出现（${outcome}）`);
      const lowest = selectedLowestFogEntry(fog);
      const penaltyCardId = outcome === "minor" ? $("#fogPenaltyCard")?.value : "";
      if (lowest) fog.discard.push(lowest.cardId);
      returnUsedFogCards(fog, lowest);
      if (outcome !== "perfect") {
        if (fog.deck.length) fog.discard.push(fog.deck.shift());
        else current.failed = "弥雾惩罚要求弃牌时牌组耗尽";
      }
      state.trackers.unassignedClues += state.knights.filter(knight => knight.memberType !== "squire").length;
      const target = fog.target;
      const previousCurrent = current.current;
      current.selected = target;
      current.travelRoute = [previousCurrent, target];
      current.tileState[target] ||= "hidden";
      clearFogSession(fog);
      const penalty = outcome === "perfect"
        ? "完美穿越"
        : outcome === "minor"
          ? `轻微惩罚：${card(penaltyCardId)?.name || penaltyCardId || "所选路径牌"}结算一项严重惩罚`
          : "严重惩罚：结算路径上所有已揭示卡的全部严重惩罚";
      addLog(`从弥雾出现于 ${tileLabel(tile(target))}：${penalty}；每名骑士获得 1 枚自选线索`);
      if (current.tileState[target] !== "explored") {
        const targetTile = tile(target);
        const back = targetTile?.rules?.back || {};
        current.tileResolution = {
          tileId: target,
          stage: "back",
          backTime: typeof back.time === "number" ? back.time : 0,
          backThreat: typeof back.threat === "number" ? back.threat : 0,
          backClues: typeof back.clues === "number" ? back.clues : 0,
          backFogIntensity: typeof back.fogIntensity === "number" ? back.fogIntensity : 0,
          backIconTags: [...(back.iconTags || [])],
          backNotes: back.pathNotes || "",
          frontTime: 0,
          frontThreat: 0,
          frontClues: 0,
          district: targetTile?.rules?.region || "",
          poi: "",
          code: "",
          notes: ""
        };
        enterStep(1);
      } else {
        setCurrentTile(current, target);
        enterStep(2);
      }
      save(true);
    });

    $("#mainKnightSelect")?.addEventListener("change", event => {
      const selected = state.knights.find(knight => knight.id === event.target.value && knight.memberType !== "squire");
      state.mainKnightId = selected?.id || "";
      save(true);
    });
    $("#autoAssignClueRequirements")?.addEventListener("click", () => {
      const mainKnight = mainlineKnight();
      if (!mainKnight) return toast("请先选择主线骑士");
      const recipients = state.knights.filter(knight => knight.id !== mainKnight.id);
      if (!recipients.length) return toast("没有可分配线索需求的队伍成员");
      if (recipients.length > CLUES.length) return toast("队伍成员超过四种线索颜色，无法保证主线索不重复");

      const primaryClues = shuffle(CLUES.map(([id]) => id)).slice(0, recipients.length);
      recipients.forEach((knight, index) => {
        knight.primary = primaryClues[index];
      });
      recipients.forEach((knight, index) => {
        knight.secondary = recipients[(index + 1) % recipients.length].primary;
      });
      mainKnight.primary = "";
      mainKnight.secondary = "";
      addLog(`自动分配主次线索：${recipients.map(knight => `${knight.name} 主${clueName(knight.primary)}／次${clueName(knight.secondary)}`).join("；")}`);
      save(true);
    });
    $$("[data-clue]").forEach(button => button.addEventListener("click", () => {
      const [knightId, clueType, delta] = button.dataset.clue.split("|");
      const knight = state.knights.find(item => item.id === knightId);
      if (!knight) return;
      knight.clues[clueType] = Math.max(0, Number(knight.clues[clueType]) + Number(delta));
      save(true);
    }));
    $$("[data-knight-name]").forEach(input => input.addEventListener("change", () => {
      const knight = state.knights.find(item => item.id === input.dataset.knightName);
      const selected = campaignParty().find(item => item.id === input.value);
      if (knight) { knight.sheetId = selected?.id || ""; knight.memberType=selected?.type||"knight";knight.name = selected?.name || "未选择队伍成员"; }
      save(true);
    }));
    $$("[data-requirement]").forEach(select => select.addEventListener("change", () => {
      const [knightId, key] = select.dataset.requirement.split("|");
      const knight = state.knights.find(item => item.id === knightId);
      if (knight) knight[key] = select.value;
      save(true);
    }));
    $("#addKnight")?.addEventListener("click", () => {
      state.knights.push({ id: uid(), name: `骑士 ${state.knights.length + 1}`, clues: { martial: 0, errant: 0, historic: 0, mystic: 0 }, primary: "", secondary: "", task: "" });
      save(true);
    });
    $("#taskMode")?.addEventListener("change", event => {
      state.taskMode = event.target.checked;
      checkLimits();
      save(true);
    });
    $("#addStory")?.addEventListener("click", () => {
      const text = $("#storyText").value.trim();
      if (!text) return;
      current.storyQueue.push({ id: uid(), code: "", text, read: false });
      save(true);
    });
    $("#addCode")?.addEventListener("click", () => {
      const code = $("#storyCode").value.trim();
      if (!code) return;
      current.explorationCodes.push(code);
      current.storyQueue.push({ id: uid(), code, text: `读取探索密码 ${code} 对应段落`, read: false });
      save(true);
    });
    $$("[data-story]").forEach(input => input.addEventListener("change", () => {
      const item = current.storyQueue.find(row => row.id === input.dataset.story);
      if (item) item.read = input.checked;
      save(true);
    }));
    $$('[data-track-note-text]').forEach(input => input.addEventListener("input", () => {
      const form = input.closest("[data-track-note-form]");
      if (form) form.dataset.noteDirty = "true";
    }));
    $$('[data-track-note-value]').forEach(checkbox => checkbox.addEventListener("change", () => {
      const key = checkbox.dataset.trackNoteValue;
      const form = checkbox.closest("[data-track-note-form]");
      let positions = selectedTrackNotePositions(form, key);
      if (!positions.length) {
        checkbox.checked = true;
        positions = selectedTrackNotePositions(form, key);
        toast("至少选择一个轨道数值");
      }
      const input = form?.querySelector(`[data-track-note-text="${key}"]`);
      const clearButton = form?.querySelector(`[data-track-note-clear="${key}"]`);
      const summary = form?.querySelector(`[data-track-note-summary="${key}"]`);
      const notes = positions.map(position => state.trackNotes[key]?.[String(position)] || "");
      const sharedNote = notes.every(note => note === notes[0]) ? notes[0] : "";
      if (input && form.dataset.noteDirty !== "true") input.value = sharedNote;
      if (clearButton) clearButton.disabled = !notes.some(Boolean);
      if (summary) {
        summary.textContent = positions.join("、");
        summary.title = `已选数值 ${positions.join("、")}`;
      }
    }));
    $$('[data-track-note-form]').forEach(form => form.addEventListener("submit", event => {
      event.preventDefault();
      const key = form.dataset.trackNoteForm;
      const positions = selectedTrackNotePositions(form, key);
      if (!positions.length) return toast("请至少选择一个轨道数值");
      const note = trackNoteText(form.querySelector(`[data-track-note-text="${key}"]`)?.value);
      if (!note) return toast("请输入标记内容");
      state.trackNotes[key] ||= {};
      const changedPositions = positions.filter(position => state.trackNotes[key][String(position)] !== note);
      if (!changedPositions.length) return toast("轨道标记没有变化");
      const label = { threat: "威胁", curse: "诅咒", time: "时间" }[key] || key;
      snapshot(`标记${label}轨道 ${changedPositions.join("、")}`);
      changedPositions.forEach(position => { state.trackNotes[key][String(position)] = note; });
      addLog(`${label}轨道 ${changedPositions.join("、")}：${note}`);
      save(true);
    }));
    $$('[data-track-note-clear]').forEach(button => button.addEventListener("click", () => {
      const key = button.dataset.trackNoteClear;
      const form = button.closest("[data-track-note-form]");
      const positions = selectedTrackNotePositions(form, key);
      const markedPositions = positions.filter(position => state.trackNotes[key]?.[String(position)]);
      if (!markedPositions.length) return;
      const label = { threat: "威胁", curse: "诅咒", time: "时间" }[key] || key;
      snapshot(`清除${label}轨道 ${markedPositions.join("、")} 标记`);
      markedPositions.forEach(position => { delete state.trackNotes[key][String(position)]; });
      addLog(`清除${label}轨道 ${markedPositions.join("、")} 标记`);
      save(true);
    }));
    $$("[data-track-cell]").forEach(button => button.addEventListener("click", () => {
      const key = button.dataset.trackCell;
      const before = Number(state.trackers[key]) || 0;
      const after = Math.max(0, Number(button.dataset.trackValue) || 0);
      if (key === "threat") changeThreat(after - before);
      else state.trackers[key] = after;
      checkLimits();
      save(true);
    }));
    $("#nextStep")?.addEventListener("click", () => {
      if (state.step === 2 && current.exploration.resolvedRound === state.round) {
        enterStep(3);
      } else if (state.step === 3) {
        state.round += 1;
        addLog(`完成深入第 ${state.round - 1} 轮`);
        enterStep(0);
      } else {
        return;
      }
      save(true);
    });
  }

  $("#kingdomSelect").addEventListener("change", event => {
    if (state.mercenaries.pendingAction) {
      event.target.value = state.kingdom;
      return toast("请先完成盗贼探索牌选择");
    }
    state.kingdom = event.target.value;
    render();
    save();
  });
  $("#undoButton").addEventListener("click", undo);
  $("#resetButton").addEventListener("click", () => {
    if (!confirm(`彻底重置 ${kingdomData().label} 地图状态与本次远征佣兵？`)) return;
    const startId = mapState().startingTile || kingdomData().start;
    state.maps[state.kingdom] = defaultMap(state.kingdom, startId);
    state.trackers = { threat: 0, curse: 0, time: 0, unassignedClues: 0 };
    state.trackNotes = normalizeTrackNotes();
    state.mercenaries = MERCENARY_RULES.createState();
    enterStep(0);
    state.round = 1;
    addLog(`重置 ${kingdomData().label}`);
    save(true);
  });
  $("#exportButton").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `kf-map-v${SAVE_VERSION}-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  });
  $("#importInput").addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (![5, 6, 7, SAVE_VERSION].includes(imported.version) || !imported.maps?.SK || !imported.maps?.POS) throw new Error("不是 v5-v8 地图存档");
        imported.version = SAVE_VERSION;
        state = normalizeSavedMapState(applySavedTileRegionCorrections(imported));
        activeTool = STEP_TOOL[state.step] || "tile";
        save(true);
        toast("存档导入成功");
      } catch (error) {
        toast(`导入失败：${error.message}`);
      }
    };
    reader.readAsText(file);
  });

  addEventListener("kf:map-upstream", event => {
    if (event.detail && typeof event.detail === "object") window.KF_MAP_UPSTREAM = event.detail;
    if (syncDistrictWheelFromUpstream()) save(true);
  });

  addEventListener("kf:module-state", event => {
    const incoming = event.detail;
    if (!incoming || typeof incoming !== "object" || ![5, 6, 7, SAVE_VERSION].includes(incoming.version)) return;
    let replacement;
    try {
      replacement = JSON.parse(JSON.stringify(incoming));
    } catch {
      return;
    }
    if (!replacement.maps?.SK || !replacement.maps?.POS || !DATA.maps[replacement.kingdom]) return;
    replacement.version = SAVE_VERSION;
    applySavedTileRegionCorrections(replacement);
    normalizeSavedMapState(replacement);
    replacement.knights = rosterKnights(replacement.knights);
    if (!replacement.knights.some(knight => knight.id === replacement.mainKnightId && knight.memberType !== "squire")) {
      replacement.mainKnightId = "";
    }
    clearTimeout(saveTimer);
    state = replacement;
    activeTool = STEP_TOOL[state.step] || (state.step === 3 ? "exploration" : "tile");
    pendingEncounterAutoStart = false;
    checkLimits();
    render();
    toast(`检测到并发修改，已保留服务器上轮次更多的第 ${state.round} 轮存档`);
  });

  const completedEncounterConsumed = consumeCompletedEncounter();
  const initialWheelSynced = syncDistrictWheelFromUpstream();
  if (completedEncounterConsumed) activeTool = STEP_TOOL[state.step] || activeTool;
  checkLimits();
  render();
  if (completedEncounterConsumed || initialWheelSynced) save();
})();
