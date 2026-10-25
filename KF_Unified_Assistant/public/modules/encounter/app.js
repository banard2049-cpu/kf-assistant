(() => {
  "use strict";
  const monsterLabel = value => window.KFMonsterLabels?.name(value) ?? (typeof value === "string" ? value : value?.name || value?.id || "");
  const tierName = value => window.KFMonsterLabels?.tier(value) ?? value;
  const DATA = window.KF_ENCOUNTER_DATA;
  const RED_DIE_FACES = DATA.dice.faces;
  const DRAGON_DIE_FACES = [
    { id: "dragon-double-sword-double-cup", label: "双剑＋双杯", match: { sword: 2, cup: 2 }, src: "/assets/dice/faces/dragon-double-sword-double-cup.png" },
    { id: "dragon-double-sword", label: "双剑", match: { sword: 2 }, src: "/assets/dice/faces/dragon-double-sword.png" },
    { id: "dragon-sword-cup", label: "单剑＋杯", match: { sword: 1, cup: 1 }, src: "/assets/dice/faces/dragon-sword-cup.png" },
    { id: "dragon-sword", label: "单剑", match: { sword: 1 }, src: "/assets/dice/faces/dragon-sword.png" },
    { id: "dragon-sword-double-cup", label: "单剑＋双杯", match: { sword: 1, cup: 2 }, src: "/assets/dice/faces/dragon-sword-double-cup.png" },
    { id: "dragon-double-sword-cup", label: "双剑＋杯", match: { sword: 2, cup: 1 }, src: "/assets/dice/faces/dragon-double-sword-cup.png" },
  ];
  const ALL_DIE_FACES = [...RED_DIE_FACES, ...DRAGON_DIE_FACES];
  const KEY = "kf-encounter-assistant-v1";
  const CORRECTION_KEY = "kf-encounter-card-corrections-v1";
  const PHASES = ["setup", "position", "monster", "knight", "resolution"];
  const PHASE_LABELS = ["设置", "放置", "怪物轮", "骑士轮", "结算"];
  const KNIGHT_IDS = new Set(["stoneface", "fleischritter", "renholder", "ser-sonch", "paracelsa", "ser-ubar", "kara"]);
  const SQUIRE_IDS = new Set(["bartos", "bianca", "caelia", "fabio", "helse", "murmur", "ralof", "vratlada"]);
  const MAX_CUSTOM_PIECES = 20;
  const MAX_CUSTOM_PIECE_TEXT = 12;
  const $ = (q, root = document) => root.querySelector(q);
  const $$ = (q, root = document) => [...root.querySelectorAll(q)];
  const clone = value => JSON.parse(JSON.stringify(value));
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const campaignParty = () => Array.isArray(window.KF_CAMPAIGN_PARTY) ? window.KF_CAMPAIGN_PARTY : [];
  const leaderKnightId = () => window.KFEncounterCatalog.leaderKnightId(campaignParty(), window.KF_CAMPAIGN_OPTIONS?.leaderSheetId);
  const availableMonsters = () => window.KFEncounterCatalog.available(DATA.monsters, leaderKnightId());
  // Five-player mode (rulebook p.77) adds a fifth member to every encounter.
  const partyLimit = () => window.KF_CAMPAIGN_OPTIONS?.fivePlayer === true ? 5 : 4;
  const isSquireMember = item => item?.memberType === "squire" || item?.type === "squire";
  // Squire rosters store the full bilingual label ("巴尔托什 · Bartos（侍从）");
  // the encounter UI only shows the Chinese name.
  const memberDisplayName = item => {
    const raw = String(item?.name || "");
    if (!isSquireMember(item)) return raw;
    return raw.split("·")[0].replace(/\s*（侍从）\s*$/, "").trim() || raw;
  };
  const memberOptions = member => {
    const groups = [
      ["骑士", Array.isArray(window.KF_CAMPAIGN_KNIGHTS) ? window.KF_CAMPAIGN_KNIGHTS : []],
      ["侍从", Array.isArray(window.KF_CAMPAIGN_SQUIRES) ? window.KF_CAMPAIGN_SQUIRES : []],
    ];
    return `<option value="">请选择队伍成员</option>${groups.filter(([,items])=>items.length).map(([label,items])=>`<optgroup label="${label}">${items.map(item =>
      `<option value="${esc(item.id)}" ${(member.sheetId === item.id || (!member.sheetId && member.name === item.name)) ? "selected" : ""}>${esc(memberDisplayName(item))}${!isSquireMember(item) && item.title && item.title !== item.name ? ` · ${esc(item.title)}` : ""}</option>`
    ).join("")}</optgroup>`).join("")}`;
  };
  const uid = () => Math.random().toString(36).slice(2, 9);
  const monsterById = id => DATA.monsters.find(m => m.id === id) || DATA.monsters[0];
  const currentMonster = () => monsterById(state.monsterId);
  const specialEncounter = () => currentMonster().special;
  let corrections = (() => {
    try { return JSON.parse(localStorage.getItem(CORRECTION_KEY)) || {}; }
    catch { return {}; }
  })();
  const currentLevel = () => {
    const base = currentMonster().encounterLevels.find(l => l.level === state.level) || currentMonster().encounterLevels[0];
    const correction = corrections[`${currentMonster().id}:${base.level}`] || {};
    return {
      ...base,
      attackPattern: correction.attackPattern ?? base.attackPattern,
      attackPatternVerified: correction.attackPatternVerified ?? base.attackPatternVerified,
      attackFacing: correction.attackFacing ?? base.attackFacing ?? 0,
      stats: { ...base.stats, monsterCount: correction.monsterCount ?? base.stats.monsterCount },
    };
  };
  const cardKey = () => `${state.monsterId}:${state.level}`;

  function blankState() {
    const monster = DATA.monsters[0];
    return {
      version: 1, monsterId: monster.id, level: monster.encounterLevels[0].level,
      phase: "setup", encounterType: "normal", specialToken: false,
      knights: rosterKnights(),
      monsters: [], customPieces: [], pool: { opportunity: 0, break: 0 }, scrapes: 0,
      criticalUsed: false, dragonRoarDone: false, targets: [],
      specialMonsterCount: 1,
      selectedPiece: "",
      history: [], log: [], savedAt: Date.now(),
    };
  }

  function rosterKnights(existing = []) {
    const roster = campaignParty().slice(0, partyLimit());
    if (!roster.length) return [{ id: uid(), name: "骑士 1", heroId: DATA.heroes?.[0]?.id || "", roll: roll(), space: "", facing: 0, action: "", done: false }];
    const usedPrevious = new Set();
    return roster.map((member, index) => {
      const previous = existing.find(item => !usedPrevious.has(item.id) && (item.sheetId === member.id || (!item.sheetId && item.name === member.name)));
      if (previous) usedPrevious.add(previous.id);
      const heroId = member.knightId || member.squireId || previous?.heroId || DATA.heroes?.[index % DATA.heroes.length]?.id || "";
      return {
        id: previous?.id || uid(), sheetId: member.id, memberType: member.type || "knight", name: member.name, heroId,
        roll: previous?.roll || roll(), space: previous?.space || "", facing: previous?.facing || 0,
        action: previous?.action || "", done: Boolean(previous?.done)
      };
    });
  }

  function normalize(raw) {
    const base = blankState();
    if (!raw || raw.version !== 1 || !availableMonsters().some(monster => monster.id === raw.monsterId)) return base;
    const merged = { ...base, ...raw };
    const savedMonster = monsterById(merged.monsterId);
    if (!savedMonster.encounterLevels.some(level => level.level === merged.level)) {
      merged.level = savedMonster.encounterLevels[0].level;
    }
    merged.knights = rosterKnights(Array.isArray(raw.knights) ? raw.knights : []);
    if (savedMonster.special) {
      merged.encounterType = "special";
      merged.specialToken = savedMonster.special.usesGenericToken;
      const [min, max] = savedMonster.special.countRange || [1, 1];
      merged.specialMonsterCount = Math.max(min, Math.min(max, Math.trunc(Number(raw.specialMonsterCount) || min)));
      if (savedMonster.special.solo) merged.knights = merged.knights.filter(knight => knight.sheetId === window.KF_CAMPAIGN_OPTIONS?.leaderSheetId);
    }
    merged.knights.forEach((knight, index) => {
      knight.heroId ||= DATA.heroes?.[index % DATA.heroes.length]?.id || "";
      knight.roll = normalizeFace(knight.roll, RED_DIE_FACES);
    });
    merged.monsters = Array.isArray(raw.monsters) ? raw.monsters : [];
    const savedLevel = savedMonster.encounterLevels.find(level => level.level === merged.level) || savedMonster.encounterLevels[0];
    const savedTier = savedLevel?.tier || "mob";
    const monsterFaces = savedTier === "dragon"
      ? DRAGON_DIE_FACES
      : RED_DIE_FACES;
    merged.monsters.forEach(monster => {
      monster.roll = normalizeFace(monster.roll, monsterFaces);
      monster.rolls = (monster.rolls || [monster.roll]).map(value => normalizeFace(value, monsterFaces));
    });
    const allowedIcons = availablePieceIcons(merged.knights);
    let hasMonkey = false;
    merged.customPieces = (Array.isArray(raw.customPieces) ? raw.customPieces : [])
      .slice(0, MAX_CUSTOM_PIECES)
      .map(piece => {
        const icon = window.KFEncounterView.pieceIcons.find(item => item.id === piece?.iconId);
        if (icon && !allowedIcons.some(item => item.id === icon.id)) return null;
        return {
          id: String(piece?.id || uid()),
          name: String(piece?.name || icon?.name || "").trim().slice(0, MAX_CUSTOM_PIECE_TEXT),
          iconId: icon?.id || "",
          space: piece?.space ? String(piece.space) : "",
          facing: 0,
        };
      })
      .filter(piece => {
        if (!piece?.name) return false;
        if (piece.iconId !== "monkey") return true;
        if (hasMonkey) return false;
        hasMonkey = true;
        return true;
      });
    if (String(merged.selectedPiece).startsWith("custom:") && !merged.customPieces.some(piece => `custom:${piece.id}` === merged.selectedPiece)) merged.selectedPiece = "";
    const savedBoardKind = ["vassal", "king", "devil"].includes(savedTier) ? "vassal" : savedTier;
    const savedBoard = DATA.boards[savedBoardKind] || DATA.boards.all[0] || {};
    let removedBlockedMonster = false;
    merged.monsters.forEach(piece => {
      if (!isUnavailableBoardSpace(piece.space, savedBoard, savedTier)) return;
      piece.space = "";
      removedBlockedMonster = true;
    });
    [...merged.knights, ...merged.customPieces].forEach(piece => {
      if (isUnavailableBoardSpace(piece.space, savedBoard, savedTier)) piece.space = "";
    });
    if (removedBlockedMonster) merged.targets = [];
    merged.pool = { ...base.pool, ...(raw.pool || {}) };
    merged.history = Array.isArray(raw.history) ? raw.history.slice(-30) : [];
    merged.log = Array.isArray(raw.log) ? raw.log.slice(-100) : [];
    return merged;
  }

  function load() {
    try { return normalize(JSON.parse(localStorage.getItem(KEY))); }
    catch { return blankState(); }
  }
  let state = load();
  let monsterRailCollapsed = true;
  // Set after a piece is dragged; the synthetic click that follows must not rotate/select it again.
  let boardClickSuppressed = false;
  function stats() {
    const level = currentLevel();
    const correctedCount = corrections[cardKey()]?.monsterCount;
    const range = specialEncounter()?.countRange;
    const count = range ? Math.max(range[0], Math.min(range[1], Number(state.specialMonsterCount) || range[0])) : correctedCount ?? level.stats.monsterCount;
    return { ...level.stats, monsterCount: count };
  }
  function save(render = true) {
    const allowedIconIds = new Set(availablePieceIcons().map(icon => icon.id));
    state.customPieces = state.customPieces.filter(piece => !piece.iconId || allowedIconIds.has(piece.iconId));
    if (String(state.selectedPiece).startsWith("custom:") && !pieceByKey(state.selectedPiece)) state.selectedPiece = defaultSelectedPieceKey();
    state.savedAt = Date.now();
    localStorage.setItem(KEY, JSON.stringify({ ...state, history: state.history.slice(-30) }));
    if (render) renderApp();
    const el = $("#saveStatus");
    if (el) el.textContent = "已保存";
  }
  function remember() {
    const snapshot = clone({ ...state, history: [] });
    state.history.push(snapshot);
    state.history = state.history.slice(-30);
  }
  function mutate(fn, message = "") {
    remember(); fn();
    if (message) state.log.push({ at: new Date().toLocaleTimeString("zh-CN", { hour12: false }), text: message });
    save();
  }
  function undo() {
    const previous = state.history.pop();
    if (!previous) return toast("没有可撤销的操作");
    const history = state.history;
    state = normalize({ ...previous, history });
    save();
    toast("已撤销");
  }
  function toast(message) {
    const el = $("#toast"); el.textContent = message; el.hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => el.hidden = true, 1800);
  }
  function normalizeFace(value, faces = RED_DIE_FACES) {
    if (faces.some(face => face.id === value)) return value;
    const existingIndex = ALL_DIE_FACES.findIndex(face => face.id === value);
    if (existingIndex >= 0) return faces[existingIndex % faces.length].id;
    const legacy = Math.max(1, Math.min(6, Number(value) || 1));
    return faces[legacy - 1].id;
  }
  function dieFaces(type = "knight") {
    return type === "monster" && tier() === "dragon" ? DRAGON_DIE_FACES : RED_DIE_FACES;
  }
  function roll(type = "knight") {
    const faces = dieFaces(type);
    return faces[Math.floor(Math.random() * faces.length)].id;
  }
  function setPlacementRoll(item, type, rollIndex, value) {
    if (!item) return false;
    const index = Math.max(0, Math.trunc(Number(rollIndex) || 0));
    if (type === "monster") {
      item.rolls ||= [value];
      item.rolls[index] = value;
      item.roll = item.rolls[0];
    } else {
      item.roll = value;
    }
    return true;
  }
  function tier() {
    return currentLevel().tier;
  }
  function boardKind() {
    return ["vassal", "king", "devil"].includes(tier()) ? "vassal" : tier();
  }
  function tierLabel() {
    return tierName(tier());
  }
  function requiredMonsterDice() { return ["vassal", "king", "devil"].includes(tier()) ? 2 : 1; }
  function boardData() {
    return DATA.boards[boardKind()] || DATA.boards.all[0] || {};
  }
  function isUnavailableBoardSpace(space, board = boardData(), encounterTier = tier()) {
    const position = Number(space);
    return encounterTier === "mob" && board.cols === 5 && board.rows === 3 && (position === 1 || position === 15);
  }
  function spaceSymbols(space) {
    return boardData().spaces?.[Number(space) - 1] || {};
  }
  function faceMatchesSpace(faceId, symbols) {
    const match = ALL_DIE_FACES.find(face => face.id === faceId)?.match || {};
    const keys = Object.keys(match);
    if (!keys.length) return !symbols.sword && !symbols.cup;
    return keys.every(key => (symbols[key] || 0) >= match[key]);
  }
  function positionPieceEntries() {
    const monsters = state.monsters.map(item => ({ key: `monster:${item.id}`, kind: "monster", item }));
    const knights = state.knights.map(item => ({ key: `knight:${item.id}`, kind: "knight", item }));
    if (tier() === "dragon" && state.dragonRoarDone) return knights;
    return state.encounterType === "ambush" ? [...knights, ...monsters] : [...monsters, ...knights];
  }
  function pieceList(kind) {
    if (kind === "monster") return state.monsters;
    if (kind === "custom") return state.customPieces;
    return state.knights;
  }
  function pieceByKey(key) {
    const [kind, id] = String(key || "").split(":");
    return pieceList(kind).find(item => item.id === id);
  }
  function allBoardPieces(includeUnplacedKnights = true) {
    return [
      ...state.monsters.map(item => ({ ...item, kind: "monster" })),
      ...state.knights.filter(item => includeUnplacedKnights || item.space).map(item => ({ ...item, kind: "knight" })),
      ...state.customPieces.map(item => ({ ...item, kind: "custom" })),
    ];
  }
  function selectedPositionItem() {
    const fallback = positionPieceEntries()[0]?.key || "";
    return pieceByKey(state.selectedPiece || fallback);
  }
  function defaultSelectedPieceKey() {
    if (state.phase === "position") return positionPieceEntries()[0]?.key || "";
    if (state.phase === "monster") {
      const monster = state.monsters.find(item => item.space) || state.monsters[0];
      if (monster) return `monster:${monster.id}`;
    }
    if (state.phase === "knight") {
      const knight = state.knights.find(item => item.space) || state.knights[0];
      if (knight) return `knight:${knight.id}`;
    }
    if (state.monsters[0]) return `monster:${state.monsters[0].id}`;
    return state.knights[0] ? `knight:${state.knights[0].id}` : "";
  }
  function selectedRolls() {
    const item = selectedPositionItem();
    if (!item || (!item.roll && !item.rolls?.length)) return [];
    return Array.isArray(item.rolls) && item.rolls.length ? item.rolls : [item.roll];
  }
  function monsterFootprint() {
    return Number(currentLevel().stats.monsterSize) || (tier() === "mob" ? 1 : tier() === "dragon" ? 3 : 2);
  }
  function pieceFootprint(piece) {
    return piece.kind === "monster" ? monsterFootprint() : 1;
  }
  function coveredSpaces(space, size, board = boardData()) {
    const start = Number(space) - 1;
    const row = Math.floor(start / board.cols);
    const col = start % board.cols;
    if (row + size > board.rows || col + size > board.cols) return [];
    return Array.from({ length: size * size }, (_, index) => {
      const rowOffset = Math.floor(index / size);
      const colOffset = index % size;
      return (row + rowOffset) * board.cols + col + colOffset + 1;
    });
  }
  function movementAnchorForClick(space, size, board, activeCols, pieces, item) {
    const target = Number(space);
    const targetRow = Math.floor((target - 1) / board.cols);
    const targetCol = (target - 1) % board.cols;
    const current = Number(item.space || 0);
    const currentRow = current ? Math.floor((current - 1) / board.cols) : targetRow;
    const currentCol = current ? (current - 1) % board.cols : targetCol;
    const anchors = new Set();
    for (let rowOffset = 0; rowOffset < size; rowOffset += 1) {
      for (let colOffset = 0; colOffset < size; colOffset += 1) {
        const row = targetRow - rowOffset;
        const col = targetCol - colOffset;
        if (row < 0 || col < 0 || row + size > board.rows || col + size > activeCols) continue;
        anchors.add(String(row * board.cols + col + 1));
      }
    }
    const legal = [...anchors].filter(anchor => {
      const candidate = coveredSpaces(anchor, size, board);
      return candidate.length === size * size
        && !candidate.some(candidateSpace => isUnavailableBoardSpace(candidateSpace, board))
        && !pieces
        .filter(value => value.space && value.id !== item.id && value.iconId !== "monkey")
        .some(value => coveredSpaces(value.space, pieceFootprint(value), board).some(valueSpace => candidate.includes(valueSpace)));
    });
    legal.sort((a, b) => {
      if (!current && Number(a) === target) return -1;
      if (!current && Number(b) === target) return 1;
      const ar = Math.floor((Number(a) - 1) / board.cols), ac = (Number(a) - 1) % board.cols;
      const br = Math.floor((Number(b) - 1) / board.cols), bc = (Number(b) - 1) % board.cols;
      return ((ar - currentRow) ** 2 + (ac - currentCol) ** 2) - ((br - currentRow) ** 2 + (bc - currentCol) ** 2);
    });
    return legal[0] || "";
  }
  function rotateAttackOffset(offset, size, facing) {
    let [row, col] = offset;
    for (let turns = 0; turns < ((facing || 0) / 90) % 4; turns += 1) {
      [row, col] = [col, size - 1 - row];
    }
    return [row, col];
  }
  function calculatedAttackTargets() {
    const level = currentLevel();
    if (!level.attackPatternVerified || !Array.isArray(level.attackPattern)) return [];
    const board = boardData();
    const size = monsterFootprint();
    const targets = new Set();
    state.monsters.filter(monster => monster.space).forEach(monster => {
      const start = Number(monster.space) - 1;
      const anchorRow = Math.floor(start / board.cols);
      const anchorCol = start % board.cols;
      // The card diagram is drawn on the monster's physical footprint. Mirrored boards flip the
      // columns, so resolve the footprint's visual top-left column first and map the result back.
      const physicalCol = board.mirror ? board.cols - size - anchorCol : anchorCol;
      level.attackPattern.forEach(offset => {
        const relativeFacing = ((monster.facing || 0) - (level.attackFacing || 0) + 360) % 360;
        const [rowOffset, colOffset] = rotateAttackOffset(offset, size, relativeFacing);
        const row = anchorRow + rowOffset;
        const visualCol = physicalCol + colOffset;
        if (row < 0 || row >= board.rows || visualCol < 0 || visualCol >= board.cols) return;
        const col = board.mirror ? board.cols - 1 - visualCol : visualCol;
        targets.add(String(row * board.cols + col + 1));
      });
    });
    return [...targets];
  }
  function attackTargetsVisible() {
    if (state.phase === "monster") return true;
    return state.phase === "position" && state.monsters.some(monster => monster.space);
  }
  function spaceLabel(space, board) {
    const index = Number(space) - 1;
    if (board.cols === 9 && board.rows === 5) {
      return `${["E", "D", "C", "B", "A"][Math.floor(index / 9)]}${index % 9 + 1}`;
    }
    return String(space);
  }
  function crop(card, side = "face") {
    return window.KFEncounterView.renderCard(card, side)
      .replace('class="crop-card read-only"', `class="crop-card" data-preview-card="1" data-side="${side}"`);
  }
  function avatarCrop(image, alt) {
    if (!image?.face) return "";
    const col = image.index % image.width;
    const row = Math.floor(image.index / image.width);
    return `<span class="piece-avatar${image.monsterRing ? " monster-ring" : ""}"><img alt="${esc(alt)}" src="${esc(image.face)}" style="width:${image.width * 100}%;height:${image.height * 100}%;left:${-col * 100}%;top:${-row * 100}%"></span>`;
  }
  function pieceAvatar(piece) {
    if (piece.kind === "monster") return currentMonster().avatar ? { face: currentMonster().avatar, width: 1, height: 1, index: 0, monsterRing: true } : null;
    return DATA.heroes?.find(hero => hero.id === piece.heroId)?.image || null;
  }
  function pieceVisual(piece) {
    if (piece.kind === "custom") return window.KFEncounterView.customPieceVisual(piece);
    return avatarCrop(pieceAvatar(piece), piece.kind === "monster" ? monsterLabel(piece.name) : piece.name);
  }
  function stepper() {
    const current = PHASES.indexOf(state.phase);
    return `<nav class="stepper" aria-label="遭遇战步骤">${PHASE_LABELS.map((label, i) =>
      `<span class="step ${i === current ? "active" : ""} ${i < current ? "done" : ""}" ${i === current ? 'aria-current="step"' : ""}>${i + 1}. ${label}</span>`
    ).join("")}</nav>`;
  }
  function monsterRail() {
    const monsters = availableMonsters();
    const buttons = items => items.map(m => `<button class="monster-btn ${m.id === state.monsterId ? "active" : ""}" data-monster="${m.id}"><span>${esc(monsterLabel(m))}</span><span class="badge">${m.special ? `${esc(m.special.code)} · ` : ""}${esc(tierName(m.encounterLevels[0].tier))}</span></button>`).join("");
    const specials = monsters.filter(m => m.category === "special");
    return `<aside class="panel monster-rail ${monsterRailCollapsed ? "collapsed" : ""}">
      <div class="panel-head"><div><span class="eyebrow">BESTIARY</span><h2>遭遇怪物</h2><p class="monster-current">${esc(monsterLabel(currentMonster()))}</p></div><button class="small ghost" id="toggleMonsterRail" title="${monsterRailCollapsed ? "展开遭遇怪物" : "折叠遭遇怪物"}" aria-label="${monsterRailCollapsed ? "展开遭遇怪物" : "折叠遭遇怪物"}" aria-expanded="${!monsterRailCollapsed}">${monsterRailCollapsed ? "›" : "‹"}</button></div>
      <div class="monster-list">${specials.length ? `<section class="monster-group"><h3>特殊遭遇战</h3>${buttons(specials)}</section>` : ""}<section class="monster-group"><h3>常规遭遇战</h3>${buttons(monsters.filter(m => m.category !== "special"))}</section></div>
    </aside>`;
  }
  function setupPanel() {
    const level = currentLevel();
    const special = specialEncounter();
    const baseMonster = special?.baseMonsterId ? monsterById(special.baseMonsterId) : null;
    const participants = special?.solo ? state.knights.filter(knight => knight.sheetId === window.KF_CAMPAIGN_OPTIONS?.leaderSheetId) : state.knights;
    return `<section class="panel">
      <div class="panel-head"><div><span class="eyebrow">${special ? "特殊遭遇战" : "ENCOUNTER SETUP"}</span><h2>${esc(monsterLabel(currentMonster()))}</h2></div><span class="badge gold">${special ? `${esc(special.code)} · ${esc(tierName(level.tier))}` : `${esc(tierName(level.tier))} · 等级 ${state.level}`}</span></div>
      <div class="card-view">
        ${crop(level, level.side)}
        <div>
          <div class="grid2">
            <div class="field"><label>${special ? "特殊遭遇卡" : "遭遇等级"}</label><select id="level">${currentMonster().encounterLevels.map(l => `<option value="${l.level}" ${l.level === state.level ? "selected" : ""}>${special ? `${esc(special.code)} · 独立卡面` : `等级 ${l.level} · ${l.side === "face" ? "正面" : "背面"}`}</option>`).join("")}</select></div>
            <div class="field"><label>遭遇类型</label><select id="encounterType" ${special ? "disabled" : ""}>${special ? '<option value="special" selected>特殊遭遇战</option>' : `<option value="normal">普通遭遇</option><option value="ambush" ${state.encounterType === "ambush" ? "selected" : ""}>伏击</option><option value="special" ${state.encounterType === "special" ? "selected" : ""}>特殊遭遇</option>`}</select></div>
          </div>
          ${special ? `<div class="stats-note"><strong>${esc(monsterLabel(currentMonster()))} · ${baseMonster ? `基础怪物：${esc(monsterLabel(baseMonster))}` : special.tokenAsset ? `使用 ${esc(special.tokenAsset.name)} 标记` : "使用通用指示物"}</strong><br>底盘 ${monsterFootprint()}×${monsterFootprint()} · ${special.countRange ? `数量 ${stats().monsterCount}` : `${stats().monsterCount} 只`}<br>${esc(special.note)}${special.avatarSource ? `<br><small>头像：${esc(special.avatarSource.label)}</small>` : ""}<br><small>骑士书第 ${special.source.printedPage} 页（PDF 第 ${special.source.pdfPage} 页）</small></div>` : ""}
          ${special?.countRange ? `<div class="field"><label for="specialMonsterCount">赏金猎人数量（按 Bane 标记强度，1-10）</label><input id="specialMonsterCount" type="number" min="1" max="10" step="1" value="${stats().monsterCount}"></div>` : ""}
          ${state.encounterType === "special" ? `<label class="check"><input type="checkbox" id="specialToken" ${state.specialToken ? "checked" : ""} ${special ? "disabled" : ""}>按卡底图标使用通用指示物代替模型</label>` : ""}
          <div class="field"><label>队伍席位</label><div class="row"><span class="badge">${participants.length} 席（骑士与侍从分开）</span></div></div>
          ${participants.map((k, i) => `<div class="grid2">
            <div class="field"><label>席位 ${i + 1} · ${k.memberType === "squire" ? "侍从" : "骑士"}</label><select data-knight-name="${k.id}" ${special?.solo ? "disabled" : ""}>${memberOptions(k)}</select></div>
            <div class="field"><label>${k.memberType === "squire" ? "侍从模型" : "骑士模型"}</label><select data-hero-id="${k.id}">${DATA.heroes.filter(hero=>(k.memberType === "squire" ? SQUIRE_IDS : KNIGHT_IDS).has(hero.id)).map(hero => `<option value="${hero.id}" ${hero.id === k.heroId ? "selected" : ""}>${esc(hero.name)}</option>`).join("")}</select></div>
          </div>`).join("")}
        </div>
      </div>
      <div class="nav-actions"><span></span><button class="primary" id="startPosition">开始放置 →</button></div>
    </section>`;
  }
  function boardView() {
    return window.KFEncounterView.renderBoard({
      state,
      data: DATA,
      monster: currentMonster(),
      level: currentLevel(),
      board: boardData(),
      allDieFaces: ALL_DIE_FACES,
      interactive: true
    });
  }
  function matchLegend() {
    return `<div class="match-legend"><span class="legend-one">骰面 1 匹配</span>${requiredMonsterDice() > 1 ? '<span class="legend-two">骰面 2 匹配</span><span class="legend-both">两枚都匹配</span>' : ""}</div>`;
  }
  function boardHtml() {
    return `${boardView()}${customPieceControls()}`;
  }
  function availablePieceIcons(knights = state.knights) {
    return window.KFEncounterView.pieceIcons.filter(icon => !icon.knightId || knights.some(knight => {
      if (knight.memberType === "squire") return false;
      const member = campaignParty().find(item => item.id === knight.sheetId);
      return (member?.knightId || knight.heroId) === icon.knightId;
    }));
  }
  function customPieceControls() {
    const selected = String(state.selectedPiece || "").startsWith("custom:") ? pieceByKey(state.selectedPiece) : null;
    return `<div class="custom-piece-tools">
      <div class="custom-piece-icon-tools">
        <strong>Token 指示物</strong>
        <div class="custom-piece-icon-picker" role="group" aria-label="添加 Token 指示物">${availablePieceIcons().map(icon => `<button type="button" class="custom-piece-icon-option" data-add-piece-icon="${icon.id}" aria-label="添加${icon.name} Token" title="将${icon.name}拖到棋盘，或点击添加后再点击空格放置"><span class="custom-piece-icon-preview">${window.KFEncounterView.customPieceVisual({ iconId: icon.id, name: icon.name })}</span><span>${esc(icon.name)}</span></button>`).join("")}</div>
        <p class="custom-piece-hint">可从选择区将 Token 拖到棋盘，拖到移出区可移出；也可点击选择后再点击空格放置或移动。Little Ser 仅在 Sonch 参与遭遇时可用。</p>
      </div>
      <form id="customPieceForm" class="custom-piece-form">
        <label for="customPieceText">自定义文字棋子</label>
        <div class="custom-piece-input-row"><input id="customPieceText" type="text" maxlength="${MAX_CUSTOM_PIECE_TEXT}" autocomplete="off" placeholder="棋子内容" aria-label="自定义棋子内容"><button class="primary custom-piece-add" type="submit" title="添加自定义棋子" aria-label="添加自定义棋子">＋</button></div>
      </form>
      ${state.customPieces.length ? `<div class="custom-piece-list" aria-label="自定义棋子列表">${state.customPieces.map(piece => {
        const key = `custom:${piece.id}`;
        const position = piece.space ? `格 ${spaceLabel(piece.space, boardData())}` : piece.iconId === "monkey" ? "Sonch 骑士板" : "待放置";
        return `<button type="button" class="custom-piece-option ${state.selectedPiece === key ? "selected" : ""}" data-select-custom-piece="${esc(piece.id)}" aria-pressed="${state.selectedPiece === key}" aria-label="选择 ${esc(piece.name)} · ${position}" title="选择 ${esc(piece.name)}"><span class="custom-piece-token ${piece.iconId ? "image-token" : ""}">${window.KFEncounterView.customPieceVisual(piece)}</span><span>${position}</span></button>`;
      }).join("")}</div>` : ""}
      ${selected ? `<div class="custom-piece-actions"><strong>${esc(selected.name)}</strong><span class="custom-piece-action-buttons">${selected.space ? '<button type="button" class="small" id="removeCustomPiece">移出棋盘</button>' : ""}<button type="button" class="small danger" id="deleteCustomPiece">删除</button></span></div>` : ""}
    </div>`;
  }
  function diceEditor(label, items, type) {
    const faces = dieFaces(type);
    return `<h3>${label}</h3><div class="dice-row">${items.flatMap((item, itemIndex) => {
      const rolls = type === "monster" ? (item.rolls || [item.roll]) : [item.roll];
      return rolls.map((faceId, rollIndex) => {
        const face = faces.find(value => value.id === faceId) || faces[0];
        const dieLabel = `${type === "monster" ? "怪物" : "队伍成员"} ${itemIndex + 1}${rolls.length > 1 ? ` 第 ${rollIndex + 1} 枚` : ""}放置骰`;
        return `<div class="die"><span>${itemIndex + 1}${rolls.length > 1 ? `-${rollIndex + 1}` : ""}</span><button type="button" class="die-result" data-reroll-die="${type}" data-id="${item.id}" data-roll-index="${rollIndex}" title="点击重投该骰子" aria-label="重投${dieLabel}"><img src="${face.src}" alt="${face.label}"></button><select data-die="${type}" data-id="${item.id}" data-roll-index="${rollIndex}" aria-label="设置${dieLabel}">${faces.map(option => `<option value="${option.id}" ${option.id === face.id ? "selected" : ""}>${option.label}</option>`).join("")}</select></div>`;
      });
    }).join("")}</div>`;
  }
  function positionPanel() {
    const ambush = state.encounterType === "ambush";
    const dragonReposition = tier() === "dragon" && state.dragonRoarDone;
    const pieceChoices = positionPieceEntries();
    const selectedCustomPiece = String(state.selectedPiece || "").startsWith("custom:") && pieceByKey(state.selectedPiece);
    if (!selectedCustomPiece && !pieceChoices.some(choice => choice.key === state.selectedPiece)) {
      state.selectedPiece = pieceChoices[0]?.key || "";
    }
    return `<section class="panel">
      <div class="panel-head"><div><span class="eyebrow">POSITIONING</span><h2>${dragonReposition ? "巨龙咆哮：重新放置骑士" : ambush ? "伏击放置：先骑士，后怪物" : "放置：先怪物，后骑士"}</h2></div><span class="badge gold">${tierLabel()}遭遇战版图</span></div>
      <div class="grid2 encounter-play-layout ${tier()}">
        <div>${boardView()}${matchLegend()}<p class="muted placement-hint">可从选择区将棋子拖到棋盘，或点击空格放置当前选中的棋子；规则模型的可放置格会按骰面高亮。棋盘上的棋子也可拖动，拖到移出区可移出。再次点击模型可旋转 90°。</p>${customPieceControls()}</div>
        <div>
          <div class="stats-note">${ambush ? "骑士无匹配空格时必须移出遭遇；首领无法放置时，移除尽可能少的骑士，并让其在怪物轮受到攻击。" : "无匹配空格的骑士可移出遭遇，或放到被怪物瞄准的任一格。杂兵攻击范围应尽量少重叠。"}</div>
          ${dragonReposition ? '<p class="stats-note">只重新进行骑士放置；怪物保持原位。已在版图上的骑士可以选择不投骰并保持位置。</p>' : diceEditor(tier() === "dragon" ? "怪物放置骰（白骰）" : "怪物放置骰", state.monsters, "monster")}
          ${diceEditor("队伍成员放置骰", state.knights, "knight")}
          <button id="rerollAll">${dragonReposition ? "重新投骑士放置骰" : "重新投全部放置骰"}</button>
          <hr>
          <div class="field placement-piece-field"><label>当前放置模型</label><div class="placement-piece-picker">
            ${pieceChoices.map(({ key, kind, item }) => {
              const selected = state.selectedPiece === key;
              const kindLabel = kind === "monster" ? "怪物" : isSquireMember(item) ? "" : "骑士";
              const displayName = kind === "monster" ? monsterLabel(item.name) : memberDisplayName(item);
              const titleText = `选择${kindLabel ? `${kindLabel} ` : ""}${displayName}`;
              const avatar = avatarCrop(pieceAvatar({ ...item, kind }), displayName)
                || `<span class="placement-piece-fallback">${kind === "monster" ? "M" : "K"}</span>`;
              const position = item.space ? `格 ${spaceLabel(item.space, boardData())}` : "待放置";
              const meta = [kindLabel, position].filter(Boolean).join(" · ");
              return `<button type="button" class="placement-piece-option ${kind} ${selected ? "selected" : ""} ${item.space ? "placed" : ""}" data-select-piece="${esc(key)}" aria-pressed="${selected}" title="${esc(titleText)}">
                <span class="placement-piece-avatar">${avatar}</span>
                <strong class="placement-piece-name">${esc(displayName)}</strong>
                <span class="placement-piece-meta">${esc(meta)}</span>
              </button>`;
            }).join("")}
          </div></div>
          <button id="removePiece">将当前棋子移出遭遇</button>
          <p class="muted">系统会保留骰面和最终位置，但需要玩家按照卡面攻击图示确认怪物朝向是否覆盖最多格子或骑士。</p>
        </div>
      </div>
      <div class="nav-actions"><button data-goto="setup">← 返回设置</button><button class="primary" id="confirmPosition">确认放置 →</button></div>
    </section>`;
  }
  function monsterPanel() {
    return `<section class="panel">
      <div class="panel-head"><div><span class="eyebrow">MONSTER ROUND</span><h2>怪物行动</h2></div><span class="badge gold">${esc(monsterLabel(currentMonster()))}</span></div>
      <div class="grid2 encounter-play-layout ${tier()}"><div>${boardHtml()}<p class="muted">按住怪物或骑士模型可直接拖动调整位置；点击模型可旋转 90°。</p></div><div>
        ${crop(currentLevel(), currentLevel().side)}
          <div class="stats-note" style="margin-top:.8rem"><strong>卡面攻击效果</strong><br>请直接查看卡面文字并结算。红色格为放置完成时计算的攻击范围，怪物轮不可修改。<br>${currentLevel().attackPatternVerified ? "红色格已根据怪物位置和朝向自动计算。" : "此卡面的范围包含首领或特殊图示，目前不会自动生成红色目标格。"}</div>
        <div class="field"><label>受影响骑士</label>${state.knights.map(k => `<label class="check"><input type="checkbox" data-target-knight="${k.id}" ${state.targets.includes(k.space) && k.space ? "checked" : ""} disabled>${esc(k.name)}${k.space ? `（格 ${k.space}）` : "（已移出）"}</label>`).join("")}</div>
        ${tier() === "dragon" && !state.dragonRoarDone ? `<div class="resolution"><h3>巨龙咆哮</h3><p>第一个怪物轮后，重复骑士放置，再执行一次怪物轮。已在版图上的骑士可在投骰前选择保持位置。</p><button class="primary" id="dragon-roar">进入重新放置</button></div>` : ""}
      </div></div>
      <div class="nav-actions"><button data-goto="position">← 返回放置</button><button class="primary" id="finishMonster" ${tier() === "dragon" && !state.dragonRoarDone ? "disabled" : ""}>怪物轮已结算 →</button></div>
    </section>`;
  }
  function knightPanel() {
    return `<section class="panel">
      <div class="panel-head"><div><span class="eyebrow">KNIGHT ROUND</span><h2>骑士行动</h2></div><span class="badge gold">${esc(monsterLabel(currentMonster()))}</span></div>
      <div class="grid2 encounter-play-layout ${tier()}"><div>${boardHtml()}<p class="muted">按住怪物或骑士模型可直接拖动调整站位；点击模型可旋转 90°。</p></div><div>
        ${crop(currentLevel(), currentLevel().side)}
        <div class="pool">
          <span class="token opportunity">机会 ${state.pool.opportunity}</span><button class="small" data-pool="opportunity" data-delta="-1">−</button><button class="small" data-pool="opportunity" data-delta="1">＋</button>
          <span class="token break">破甲 ${state.pool.break}</span><button class="small" data-pool="break" data-delta="-1">−</button><button class="small" data-pool="break" data-delta="1">＋</button>
          <span class="token scrape">擦伤 ${state.scrapes}</span><button class="small" data-scrape="-1">−</button><button class="small" data-scrape="1">＋</button>
        </div>
        <p class="muted">骑士可各执行一次攻击或援助，行动顺序可自由选择；也可保留尚未行动的骑士并直接进入结算。</p>
        <div class="knight-actions">${state.knights.map(k => `<article class="knight-action ${k.done ? "done" : ""}">
          <div class="panel-head"><strong>${esc(k.name)}</strong><span class="badge">${k.done ? k.action === "help" ? "已援助" : "已攻击" : k.space ? `格 ${k.space}` : "不在遭遇中"}</span></div>
          ${k.done || !k.space ? `<button class="small" data-reset-action="${k.id}" ${!k.space ? "disabled" : ""}>重做行动</button>` : `<div class="row"><button data-help="${k.id}">援助</button><button class="primary" data-attack="${k.id}">攻击</button></div>`}
        </article>`).join("")}</div>
        <div id="attackForm"></div>
        ${state.criticalUsed ? `<p class="stats-note">本场遭遇的整队关键擦伤已使用。</p>` : ""}
      </div></div>
      <div class="nav-actions"><button data-goto="monster">← 返回怪物轮</button><button class="primary" id="finishKnights">进入结算 →</button></div>
    </section>`;
  }
  function resolutionPanel() {
    const handoff = readEncounterHandoff();
    const returnLabel = handoff?.source === "map"
      ? "完成并返回地图"
      : handoff?.returnUrl ? "完成并返回骑士团" : "完成并新建";
    return `<section class="panel">
      <div class="panel-head"><div><span class="eyebrow">RESOLUTION</span><h2>遭遇战结算</h2></div><span class="badge gold">${state.scrapes} 擦伤</span></div>
      <div class="card-view">${crop(currentLevel(), currentLevel().side)}<div>
        <div class="resolution"><h2>按卡面结算</h2><p>根据当前 ${state.scrapes} 个擦伤，直接执行遭遇战怪物卡上对应的结果。</p></div>
        <div class="stats-note"><strong>清理</strong><br>清理所有遭遇战配件，返回被遭遇战中断的阶段。</div>
      </div></div>
      <div class="nav-actions"><button data-goto="knight">← 返回骑士轮</button><button class="primary" id="completeEncounter">${returnLabel}</button></div>
    </section>`;
  }
  function actionLogPanel() {
    return `<section class="panel action-log-panel"><div class="panel-head"><div><span class="eyebrow">ACTION LOG</span><h2>行动日志</h2></div></div>
        <div class="log">${state.log.slice().reverse().map(e => `<div class="log-entry"><span class="muted">${esc(e.at)}</span> ${esc(window.KFMonsterLabels?.text(e.text) ?? e.text)}</div>`).join("") || '<p class="muted">尚无行动。</p>'}</div>
      </section>`;
  }
  function mainPanel() {
    if (state.phase === "setup") return setupPanel();
    if (state.phase === "position") return positionPanel();
    if (state.phase === "monster") return monsterPanel();
    if (state.phase === "knight") return knightPanel();
    return resolutionPanel();
  }
  function renderApp() {
    if (!availableMonsters().some(monster => monster.id === state.monsterId)) state = blankState();
    $("#app").innerHTML = stepper() + `<div class="layout ${monsterRailCollapsed ? "monster-collapsed" : ""}">${monsterRail()}<div class="main-stack">${mainPanel()}${actionLogPanel()}</div></div>`;
    bind();
  }
  function preparePieces() {
    if (specialEncounter()?.solo) state.knights = state.knights.filter(knight => knight.sheetId === window.KF_CAMPAIGN_OPTIONS?.leaderSheetId);
    const count = Math.max(1, Number(stats().monsterCount) || 1);
    state.monsters = Array.from({ length: count }, (_, i) => ({
      id: uid(), name: count > 1 ? `怪物 ${i + 1}` : currentMonster().name,
      roll: "", rolls: Array.from({ length: requiredMonsterDice() }, () => roll("monster")), space: "", facing: 0,
    }));
    state.knights.forEach(k => { k.roll = roll(); k.space = ""; k.facing = 0; k.done = false; k.action = ""; });
    state.customPieces.forEach(piece => { piece.space = ""; piece.facing = 0; });
    state.targets = [];
    state.selectedPiece = state.encounterType === "ambush" && state.knights[0]
      ? `knight:${state.knights[0].id}`
      : state.monsters[0] ? `monster:${state.monsters[0].id}` : `knight:${state.knights[0]?.id || ""}`;
  }

  function readEncounterHandoff() {
    try {
      const handoff = JSON.parse(localStorage.getItem("kfEncounterHandoff") || "null");
      const campaignId = localStorage.getItem("kfActiveCampaign") || "";
      return !handoff?.campaignId || handoff.campaignId === campaignId ? handoff : null;
    } catch {
      return null;
    }
  }

  function activeMembersDone() {
    return state.knights.every(knight => !knight.space || knight.done);
  }

  function finishMemberActionIfReady() {
    if (!activeMembersDone()) return;
    state.phase = "resolution";
    state.log.push({
      at: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
      text: "所有在场骑士与侍从均已行动，自动进入结算步骤"
    });
  }

  async function completeEncounter() {
    const handoff = readEncounterHandoff();
    if (handoff?.source === "map") {
      handoff.completedEncounter = {
        at: new Date().toISOString(),
        monster: currentMonster().name,
        level: state.level,
        scrapes: state.scrapes
      };
      localStorage.setItem("kfEncounterHandoff", JSON.stringify(handoff));
    } else if (handoff?.returnUrl) {
      localStorage.removeItem("kfEncounterHandoff");
    }
    state = blankState();
    save();
    if (handoff?.returnUrl) {
      await window.KF_MODULE_BRIDGE?.flush?.();
      location.href = handoff.returnUrl;
      return;
    }
    toast("遭遇已完成");
  }
  function moveSelectedPieceOffBoard(key) {
    const selectedKey = typeof key === "string" ? key : state.selectedPiece || defaultSelectedPieceKey();
    const [kind] = selectedKey.split(":");
    const item = pieceByKey(selectedKey);
    if (!item?.space) {
      toast("请先选择版图上的棋子");
      return false;
    }
    mutate(() => {
      item.space = "";
      state.selectedPiece = selectedKey;
      if (kind === "monster") state.targets = calculatedAttackTargets();
    }, `${item.name} 移出遭遇版图`);
    return true;
  }

  function addCustomPiece(name, iconId = "", space = "") {
    const icon = availablePieceIcons().find(item => item.id === iconId);
    if (iconId && !icon) return false;
    const existingMonkey = iconId === "monkey" && state.customPieces.find(piece => piece.iconId === "monkey");
    if (existingMonkey) { state.selectedPiece = `custom:${existingMonkey.id}`; save(); return true; }
    const text = String(icon?.name || name || "").trim().slice(0, MAX_CUSTOM_PIECE_TEXT);
    if (!text) { toast("请输入棋子内容"); return false; }
    if (state.customPieces.length >= MAX_CUSTOM_PIECES) { toast(`最多添加 ${MAX_CUSTOM_PIECES} 个自定义棋子`); return false; }
    mutate(() => {
      const piece = { id: uid(), name: text, iconId: icon?.id || "", space, facing: 0 };
      state.customPieces.push(piece);
      state.selectedPiece = `custom:${piece.id}`;
      if (space && piece.iconId !== "monkey") displaceLittleSer();
    }, `添加${icon ? "图标" : "自定义"}棋子“${text}”`);
    return true;
  }

  function bind() {
    const peekBoardIcons = $("#peekBoardIcons");
    if (peekBoardIcons) {
      const setPiecePeek = hidden => {
        peekBoardIcons.closest(".board-wrap")?.classList.toggle("pieces-hidden", hidden);
        peekBoardIcons.setAttribute("aria-pressed", String(hidden));
      };
      peekBoardIcons.addEventListener("pointerdown", event => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        try { peekBoardIcons.setPointerCapture(event.pointerId); } catch {}
        setPiecePeek(true);
      });
      ["pointerup", "pointercancel", "pointerleave", "lostpointercapture"].forEach(type =>
        peekBoardIcons.addEventListener(type, () => setPiecePeek(false))
      );
      peekBoardIcons.addEventListener("keydown", event => {
        if ([" ", "Enter"].includes(event.key)) setPiecePeek(true);
      });
      peekBoardIcons.addEventListener("keyup", event => {
        if ([" ", "Enter"].includes(event.key)) setPiecePeek(false);
      });
      peekBoardIcons.addEventListener("blur", () => setPiecePeek(false));
    }
    $("#boardRemoveZone")?.addEventListener("click", moveSelectedPieceOffBoard);
    $("#toggleMonsterRail")?.addEventListener("click", () => {
      monsterRailCollapsed = !monsterRailCollapsed;
      renderApp();
    });
    $$("[data-goto]").forEach(b => b.addEventListener("click", () => mutate(() => state.phase = b.dataset.goto, `返回${PHASE_LABELS[PHASES.indexOf(b.dataset.goto)]}阶段`)));
    $$("[data-monster]").forEach(b => b.addEventListener("click", () => mutate(() => {
      if (!availableMonsters().some(monster => monster.id === b.dataset.monster)) return;
      const wasSpecial = Boolean(specialEncounter());
      state.monsterId = b.dataset.monster; state.level = currentMonster().encounterLevels[0].level; state.phase = "setup"; state.monsters = [];
      state.targets = []; state.specialMonsterCount = specialEncounter()?.countRange?.[0] || 1;
      state.knights = rosterKnights(state.knights);
      if (specialEncounter()) { state.encounterType = "special"; state.specialToken = specialEncounter().usesGenericToken; }
      else if (wasSpecial) { state.encounterType = "normal"; state.specialToken = false; }
    }, `选择 ${monsterById(b.dataset.monster).name}`)));
    $("#level")?.addEventListener("change", e => mutate(() => state.level = Number(e.target.value), `选择等级 ${e.target.value}`));
    $("#encounterType")?.addEventListener("change", e => mutate(() => state.encounterType = specialEncounter() ? "special" : e.target.value));
    $("#specialMonsterCount")?.addEventListener("change", e => mutate(() => {
      const range = specialEncounter()?.countRange;
      if (range) state.specialMonsterCount = Math.max(range[0], Math.min(range[1], Math.trunc(Number(e.target.value) || range[0])));
    }));
    $("#specialToken")?.addEventListener("change", e => { state.specialToken = e.target.checked; save(); });
    $$("[data-knight-name]").forEach(input => input.addEventListener("change", e => {
      const k = state.knights.find(x => x.id === e.target.dataset.knightName), selected = campaignParty().find(item => item.id === e.target.value);
      if (k) { k.sheetId = selected?.id || ""; k.memberType=selected?.type||"knight";k.name = selected?.name || "未选择队伍成员"; save(); }
    }));
    $$("[data-hero-id]").forEach(select => select.addEventListener("change", e => {
      const k = state.knights.find(x => x.id === e.target.dataset.heroId); if (k) k.heroId = e.target.value; save();
    }));
    $("#addKnight")?.addEventListener("click", () => mutate(() => {
      if (state.knights.length < 5) state.knights.push({ id: uid(), name: `骑士 ${state.knights.length + 1}`, heroId: DATA.heroes?.[state.knights.length % DATA.heroes.length]?.id || "", roll: roll(), space: "", facing: 0, action: "", done: false });
    }, "增加骑士"));
    $("#removeKnight")?.addEventListener("click", () => mutate(() => { if (state.knights.length > 1) state.knights.pop(); }, "减少骑士"));
    $("#startPosition")?.addEventListener("click", () => mutate(() => { preparePieces(); state.phase = "position"; }, "开始遭遇战放置"));
    $$("[data-die]").forEach(input => input.addEventListener("change", e => {
      const list = e.target.dataset.die === "monster" ? state.monsters : state.knights;
      const item = list.find(x => x.id === e.target.dataset.id);
      if (item) {
        const value = normalizeFace(e.target.value, dieFaces(e.target.dataset.die));
        const index = Number(e.target.dataset.rollIndex || 0);
        setPlacementRoll(item, e.target.dataset.die, index, value);
      }
      save();
    }));
    $$("[data-reroll-die]").forEach(button => button.addEventListener("click", () => {
      const type = button.dataset.rerollDie;
      const list = type === "monster" ? state.monsters : state.knights;
      const item = list.find(entry => entry.id === button.dataset.id);
      if (!item) return;
      const index = Number(button.dataset.rollIndex || 0);
      const dieNumber = type === "monster" && (item.rolls || []).length > 1 ? `第 ${index + 1} 枚` : "";
      mutate(
        () => setPlacementRoll(item, type, index, roll(type)),
        `重投${item.name || (type === "monster" ? "怪物" : "队伍成员")}${dieNumber}放置骰`
      );
    }));
    $$("[data-select-piece]").forEach(button => button.addEventListener("click", () => {
      if (!positionPieceEntries().some(choice => choice.key === button.dataset.selectPiece)) return;
      state.selectedPiece = button.dataset.selectPiece;
      save();
    }));
    $("#customPieceForm")?.addEventListener("submit", event => {
      event.preventDefault();
      addCustomPiece($("#customPieceText")?.value);
    });
    $$("[data-add-piece-icon]").forEach(button => button.addEventListener("click", () => addCustomPiece("", button.dataset.addPieceIcon)));
    $$("[data-select-custom-piece]").forEach(button => button.addEventListener("click", () => {
      const key = `custom:${button.dataset.selectCustomPiece}`;
      if (!pieceByKey(key)) return;
      state.selectedPiece = key;
      save();
    }));
    $("#removeCustomPiece")?.addEventListener("click", moveSelectedPieceOffBoard);
    $("#deleteCustomPiece")?.addEventListener("click", () => mutate(() => {
      const [kind, id] = state.selectedPiece.split(":");
      if (kind !== "custom") return;
      state.customPieces = state.customPieces.filter(piece => piece.id !== id);
      state.selectedPiece = defaultSelectedPieceKey();
    }, "删除自定义棋子"));
    $("#rerollAll")?.addEventListener("click", () => mutate(() => {
      if (!(tier() === "dragon" && state.dragonRoarDone)) {
        state.monsters.forEach(m => { m.rolls = Array.from({ length: requiredMonsterDice() }, () => roll("monster")); m.roll = m.rolls[0]; });
      }
      state.knights.forEach(k => k.roll = roll());
    }, "重投全部放置骰"));
    $$(".space").forEach(space => space.addEventListener("click", () => handleSpace(space.dataset.space)));
    bindBoardDrag();
    $("#removePiece")?.addEventListener("click", moveSelectedPieceOffBoard);
    $("#confirmPosition")?.addEventListener("click", () => mutate(() => {
      state.phase = "monster";
      state.targets = calculatedAttackTargets();
      state.selectedPiece = defaultSelectedPieceKey();
    }, "确认所有模型放置并计算攻击范围"));
    $$("[data-target-knight]").forEach(input => input.addEventListener("change", e => {
      if (state.phase === "monster") return;
      const k = state.knights.find(x => x.id === e.target.dataset.targetKnight);
      if (!k?.space) return;
      state.targets = e.target.checked ? [...new Set([...state.targets, k.space])] : state.targets.filter(s => s !== k.space); save();
    }));
    $("#dragon-roar")?.addEventListener("click", () => mutate(() => {
      state.dragonRoarDone = true; state.phase = "position"; state.targets = calculatedAttackTargets(); state.knights.forEach(k => k.roll = roll());
      state.selectedPiece = state.knights[0] ? `knight:${state.knights[0].id}` : "";
    }, "巨龙咆哮：重新进行骑士放置，之后执行第二怪物轮"));
    $("#finishMonster")?.addEventListener("click", () => mutate(() => {
      state.phase = "knight";
      state.selectedPiece = defaultSelectedPieceKey();
    }, "怪物轮结算完成"));
    $$("[data-pool]").forEach(b => b.addEventListener("click", () => mutate(() => {
      const key = b.dataset.pool; state.pool[key] = Math.max(0, state.pool[key] + Number(b.dataset.delta));
    }, "手动调整遭遇池")));
    $$("[data-scrape]").forEach(b => b.addEventListener("click", () => mutate(() => state.scrapes = Math.max(0, state.scrapes + Number(b.dataset.scrape)), "手动调整擦伤")));
    $$("[data-help]").forEach(b => b.addEventListener("click", () => helpKnight(b.dataset.help)));
    $$("[data-attack]").forEach(b => b.addEventListener("click", () => showAttack(b.dataset.attack)));
    $$("[data-reset-action]").forEach(b => b.addEventListener("click", () => mutate(() => {
      const k = state.knights.find(x => x.id === b.dataset.resetAction); if (k) { k.done = false; k.action = ""; }
    }, "重做骑士行动")));
    $("#finishKnights")?.addEventListener("click", () => mutate(() => state.phase = "resolution", "进入遭遇战结算"));
    $("#completeEncounter")?.addEventListener("click", completeEncounter);
    $$("[data-preview-card]").forEach(c => c.addEventListener("click", () => previewCard()));
  }
  function boardCellFromPoint(clientX, clientY, grid) {
    const board = boardData();
    const rect = grid.getBoundingClientRect();
    if (!rect.width || !rect.height) return 0;
    let col = Math.floor((clientX - rect.left) / (rect.width / board.cols));
    const row = Math.floor((clientY - rect.top) / (rect.height / board.rows));
    // A mirrored board renders the columns right-to-left, so visual columns map back to space numbers.
    if (board.mirror) col = board.cols - 1 - col;
    if (row < 0 || row >= board.rows || col < 0 || col >= board.cols) return 0;
    return row * board.cols + col + 1;
  }

  // Drag anchor: keep the grabbed point of the footprint under the pointer, then fall back to the
  // legal anchor that covers the hovered cell, so a multi-cell boss follows the cursor naturally.
  function dragAnchorFor(clientX, clientY, size, activeCols, board, pieces, draggedId, grid, grab = { row: size / 2, col: size / 2 }) {
    const rect = grid.getBoundingClientRect();
    if (!rect.width || !rect.height) return "";
    let colF = (clientX - rect.left) / (rect.width / board.cols);
    if (board.mirror) colF = board.cols - colF;
    const rowF = (clientY - rect.top) / (rect.height / board.rows);
    const hovered = boardCellFromPoint(clientX, clientY, grid);
    if (!hovered) return "";
    // Dropping over the dimmed columns or a blocked space rejects the move instead of teleporting.
    if ((hovered - 1) % board.cols >= activeCols || isUnavailableBoardSpace(hovered, board)) return "";
    const anchors = new Set();
    {
      const hoverRow = Math.floor((hovered - 1) / board.cols);
      const hoverCol = (hovered - 1) % board.cols;
      for (let rowOffset = 0; rowOffset < size; rowOffset += 1) {
        for (let colOffset = 0; colOffset < size; colOffset += 1) {
          anchors.add(`${hoverRow - rowOffset},${hoverCol - colOffset}`);
        }
      }
    }
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const preferredRow = clamp(Math.round(rowF - grab.row), 0, Math.max(0, board.rows - size));
    const preferredCol = clamp(Math.round(colF - grab.col), 0, Math.max(0, activeCols - size));
    anchors.add(`${preferredRow},${preferredCol}`);
    const legal = [];
    for (const candidate of anchors) {
      const [row, col] = candidate.split(",").map(Number);
      if (row < 0 || col < 0 || row + size > board.rows || col + size > activeCols) continue;
      const anchor = String(row * board.cols + col + 1);
      const spaces = coveredSpaces(anchor, size, board);
      if (spaces.length !== size * size) continue;
      if (spaces.some(space => isUnavailableBoardSpace(space, board))) continue;
      const blocked = pieces
        .filter(value => value.space && value.id !== draggedId && value.iconId !== "monkey")
        .some(value => coveredSpaces(value.space, pieceFootprint(value), board).some(space => spaces.includes(space)));
      if (blocked) continue;
      legal.push({
        anchor, row, col,
        preferred: row === preferredRow && col === preferredCol,
        containsHover: spaces.includes(hovered)
      });
    }
    legal.sort((a, b) => {
      const preferredOrder = Number(b.preferred) - Number(a.preferred);
      if (preferredOrder) return preferredOrder;
      const hoverOrder = Number(b.containsHover) - Number(a.containsHover);
      if (hoverOrder) return hoverOrder;
      const distanceA = ((a.row + size / 2) - rowF) ** 2 + ((a.col + size / 2) - colF) ** 2;
      const distanceB = ((b.row + size / 2) - rowF) ** 2 + ((b.col + size / 2) - colF) ** 2;
      return distanceA - distanceB;
    });
    return legal[0]?.anchor || "";
  }

  function bindBoardDrag() {
    const grid = $(".board-grid");
    if (!grid || !["position", "monster", "knight"].includes(state.phase)) return;
    const removeZone = $("#boardRemoveZone");
    const sources = $$("[data-select-piece], [data-select-custom-piece], [data-add-piece-icon]");
    const board = boardData();
    const activeCols = ({ vassal: 4, king: 5, devil: 6 })[tier()] || board.cols;
    let drag = null;

    const clearDropHint = () => {
      grid.querySelectorAll(".space.drop-target").forEach(node => node.classList.remove("drop-target"));
      removeZone?.classList.remove("drop-target");
    };
    const showDropHint = anchor => {
      clearDropHint();
      if (!anchor || !drag) return;
      coveredSpaces(anchor, drag.size, board).forEach(space => {
        grid.querySelector(`.space[data-space="${space}"]`)?.classList.add("drop-target");
      });
    };
    const moveGhost = (x, y) => {
      if (!drag?.ghost) return;
      drag.ghost.style.left = `${x - drag.offsetX}px`;
      drag.ghost.style.top = `${y - drag.offsetY}px`;
    };
    // Consume the click after a drag before any picker, board or remove-button action runs.
    const swallowClick = event => {
      if (!boardClickSuppressed) return;
      boardClickSuppressed = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    [grid, removeZone, ...sources].filter(Boolean).forEach(node => node.addEventListener("click", swallowClick, true));

    const updateDropTarget = event => {
      const rect = removeZone?.getBoundingClientRect();
      drag.removing = Boolean(rect && event.clientX >= rect.left && event.clientX < rect.right
        && event.clientY >= rect.top && event.clientY < rect.bottom);
      drag.anchor = drag.removing ? "" : dragAnchorFor(event.clientX, event.clientY, drag.size, activeCols, board, allBoardPieces(), drag.item.id, grid, drag.grab);
      showDropHint(drag.anchor);
      removeZone?.classList.toggle("drop-target", drag.removing && Boolean(drag.item.space));
    };

    function onMove(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) return;
      if (!drag.moved) {
        drag.moved = true;
        drag.node.classList.add("dragging");
        const ghost = drag.fromBoard ? drag.node.cloneNode(true) : document.createElement("span");
        if (!drag.fromBoard) {
          ghost.className = `piece ${drag.kind} footprint-${drag.size} facing-${drag.item.facing || 0}${drag.item.iconId ? " image-token" : ""}`;
          if (drag.kind === "knight") ghost.classList.add("knight-token-frame");
          if (drag.kind === "monster" && currentMonster().type === "boss") ghost.classList.add("boss-token-frame");
          ghost.style.setProperty("--token-facing", `${drag.item.facing || 0}deg`);
          ghost.innerHTML = pieceVisual({ ...drag.item, kind: drag.kind });
        }
        ghost.classList.remove("dragging");
        ghost.removeAttribute("data-piece");
        ghost.setAttribute("aria-hidden", "true");
        ghost.classList.add("piece-drag-ghost");
        ghost.style.inset = "auto";
        ghost.style.width = `${drag.rect.width}px`;
        ghost.style.height = `${drag.rect.height}px`;
        document.body.appendChild(ghost);
        drag.ghost = ghost;
      }
      moveGhost(event.clientX, event.clientY);
      updateDropTarget(event);
      event.preventDefault();
    }

    function finish(event, cancelled = false) {
      if (!drag || (event?.pointerId !== undefined && event.pointerId !== drag.pointerId)) return;
      if (drag.moved && !cancelled && event?.type === "pointerup") updateDropTarget(event);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", onKeyDown);
      const current = drag;
      drag = null;
      clearDropHint();
      current.ghost?.remove();
      current.node.classList.remove("dragging");
      if (!current.moved) return;
      boardClickSuppressed = true;
      setTimeout(() => { boardClickSuppressed = false; }, 0);
      if (cancelled || event?.type === "pointercancel" || !grid.isConnected) return;
      if (current.removing) {
        if (current.item.space) moveSelectedPieceOffBoard(current.key);
        return;
      }
      if (!current.anchor) return toast(`${current.size}×${current.size} 底盘无法放到目标区域`);
      if (current.newIcon) {
        addCustomPiece("", current.newIcon, current.anchor);
        return;
      }
      if (current.anchor === current.space) return;
      mutate(() => {
        current.item.space = current.anchor;
        if (!(current.kind === "custom" && current.item.iconId === "monkey")) displaceLittleSer();
        if (["position", "monster"].includes(state.phase) && current.kind === "monster") state.targets = calculatedAttackTargets();
        state.selectedPiece = current.key;
      }, `${current.item.name} 拖放到格 ${spaceLabel(current.anchor, board)}`);
    }

    function cancel() { finish(undefined, true); }
    function onKeyDown(event) {
      if (event.key === "Escape") cancel();
    }

    function start(event) {
      boardClickSuppressed = false;
      if (drag) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (event.isPrimary === false) return;
      const node = event.target.closest(".piece[data-piece], [data-select-piece], [data-select-custom-piece], [data-add-piece-icon]");
      if (!node) return;
      const fromBoard = Boolean(node.dataset.piece);
      let key = node.dataset.piece || node.dataset.selectPiece || (node.dataset.selectCustomPiece ? `custom:${node.dataset.selectCustomPiece}` : "");
      let item = key ? pieceByKey(key) : null;
      let newIcon = "";
      if (node.dataset.addPieceIcon) {
        const icon = availablePieceIcons().find(value => value.id === node.dataset.addPieceIcon);
        if (!icon) return;
        item = icon.id === "monkey" ? state.customPieces.find(value => value.iconId === icon.id) : null;
        if (item) key = `custom:${item.id}`;
        else {
          newIcon = icon.id;
          key = "custom:";
          item = { id: "", name: icon.name, iconId: icon.id, space: "", facing: 0 };
        }
      }
      if (!item || (fromBoard && !item.space)) return;
      const [kind] = key.split(":");
      if (node.dataset.selectPiece && !positionPieceEntries().some(choice => choice.key === key)) return;
      const gridRect = grid.getBoundingClientRect();
      if (!gridRect.width || !gridRect.height) return;
      const cellWidth = gridRect.width / board.cols;
      const cellHeight = gridRect.height / board.rows;
      const size = pieceFootprint({ ...item, kind });
      const rect = fromBoard ? node.getBoundingClientRect() : { width: cellWidth * (size - .14), height: cellHeight * (size - .14) };
      let grabCol = (event.clientX - gridRect.left) / cellWidth;
      if (board.mirror) grabCol = board.cols - grabCol;
      const grabRow = (event.clientY - gridRect.top) / cellHeight;
      const anchorRow = Math.floor((Number(item.space) - 1) / board.cols);
      const anchorCol = (Number(item.space) - 1) % board.cols;
      drag = {
        key, item, kind, node, fromBoard, newIcon, pointerId: event.pointerId,
        startX: event.clientX, startY: event.clientY, space: String(item.space || ""),
        size, rect,
        offsetX: fromBoard ? event.clientX - rect.left : rect.width / 2,
        offsetY: fromBoard ? event.clientY - rect.top : rect.height / 2,
        grab: fromBoard ? { row: grabRow - anchorRow, col: grabCol - anchorCol } : { row: size / 2, col: size / 2 },
        moved: false, removing: false, anchor: "", ghost: null
      };
      try { node.setPointerCapture(event.pointerId); } catch {}
      window.addEventListener("pointermove", onMove, { passive: false });
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
      window.addEventListener("blur", cancel);
      window.addEventListener("keydown", onKeyDown);
    }
    [grid, ...sources].forEach(node => {
      node.addEventListener("pointerdown", start);
      node.addEventListener("dragstart", event => event.preventDefault());
    });
  }

  function displaceLittleSer() {
    const monkey = state.customPieces.find(piece => piece.iconId === "monkey" && piece.space);
    if (!monkey) return;
    const board = boardData();
    const activeCols = ({ vassal: 4, king: 5, devil: 6 })[tier()] || board.cols;
    const occupied = new Set(allBoardPieces().filter(piece => piece.space && piece.id !== monkey.id)
      .flatMap(piece => coveredSpaces(piece.space, pieceFootprint(piece), board)));
    const position = Number(monkey.space);
    if (!occupied.has(position)) return;
    const distance = space => Math.abs(Math.floor((space - 1) / board.cols) - Math.floor((position - 1) / board.cols))
      + Math.abs((space - 1) % board.cols - (position - 1) % board.cols);
    const spaces = Array.from({ length: board.cols * board.rows }, (_, i) => i + 1)
      .filter(space => (space - 1) % board.cols < activeCols && !isUnavailableBoardSpace(space, board) && !occupied.has(space))
      .sort((a, b) => distance(a) - distance(b) || a - b);
    monkey.space = spaces.length ? String(spaces[0]) : "";
  }
  function handleSpace(space) {
    if (boardClickSuppressed) { boardClickSuppressed = false; return; }
    if (!["position", "monster", "knight"].includes(state.phase)) return;
    const pieces = allBoardPieces();
    const board = boardData();
    if (isUnavailableBoardSpace(space, board)) return toast("杂兵版图的 1、15 格不能放置棋子");
    state.selectedPiece ||= defaultSelectedPieceKey();
    const selectedExists = pieces.some(value => `${value.kind}:${value.id}` === state.selectedPiece);
    if (!selectedExists) state.selectedPiece = defaultSelectedPieceKey();
    const clickedPiece = pieces.find(value => value.space && coveredSpaces(value.space, pieceFootprint(value), board).includes(Number(space))
      && (value.iconId !== "monkey" || state.selectedPiece === `custom:${value.id}`));
    const selectedKey = state.selectedPiece || "";
    const clickedKey = clickedPiece ? `${clickedPiece.kind}:${clickedPiece.id}` : "";
    if (clickedPiece && clickedKey !== selectedKey) {
      mutate(() => { state.selectedPiece = clickedKey; }, `选择 ${clickedPiece.name}`);
      return;
    }
    const [kind, id] = state.selectedPiece.split(":");
    const list = pieceList(kind);
    const item = list.find(x => x.id === id);
    if (!item || (state.phase !== "position" && kind !== "custom" && !item.space)) return;
    const activeCols = ({ vassal: 4, king: 5, devil: 6 })[tier()] || board.cols;
    const size = pieceFootprint({ kind });
    const currentCovered = item.space ? coveredSpaces(item.space, size, board) : [];
    if (kind === "custom" && clickedPiece && clickedKey === selectedKey) return;
    const rotateCurrentPiece = kind !== "custom" && clickedPiece && clickedKey === selectedKey && currentCovered.includes(Number(space));
    const anchor = rotateCurrentPiece ? String(item.space) : movementAnchorForClick(space, size, board, activeCols, pieces, item);
    mutate(() => {
      if (rotateCurrentPiece) item.facing = ((item.facing || 0) + 90) % 360;
      else if (anchor) item.space = anchor;
      if (kind !== "custom" || item.iconId !== "monkey") displaceLittleSer();
      if (["position", "monster"].includes(state.phase) && kind === "monster") state.targets = calculatedAttackTargets();
    }, rotateCurrentPiece ? `${item.name} 旋转 90°` : anchor ? `${item.name} 移动到格 ${anchor}，占据 ${size}×${size}` : `${size}×${size} 底盘无法放到目标区域`);
  }
  function helpKnight(id) {
    const k = state.knights.find(x => x.id === id); if (!k) return;
    const symbols = spaceSymbols(k.space);
    const opportunity = symbols.cup || 0;
    const breakCount = symbols.sword || 0;
    mutate(() => {
      state.pool.opportunity += opportunity;
      state.pool.break += breakCount;
      k.done = true; k.action = "help";
      finishMemberActionIfReady();
    }, `${k.name} 援助：${opportunity || breakCount ? `+${opportunity} 机会，+${breakCount} 破甲` : "所在格无援助图标"}`);
  }
  function showAttack(id) {
    const k = state.knights.find(x => x.id === id); if (!k) return;
    $("#attackForm").innerHTML = `<div class="resolution" style="margin-top:.8rem"><h3>${esc(k.name)} · 攻击</h3>
      <div class="grid3"><label class="check"><input id="attackHit" type="checkbox" checked>攻击命中</label><label class="check"><input id="attackScrape" type="checkbox">造成擦伤</label><label class="check"><input id="attackCrit" type="checkbox" ${state.criticalUsed ? "disabled" : ""}>关键机会并造成擦伤</label></div>
      <p class="muted">结算武器和英勇曲线技能。遭遇战造成擦伤而非损伤，因此沉重等要求“损伤”的关键词不会触发。</p>
      <button class="primary" id="confirmAttack">确认攻击</button></div>`;
    $("#confirmAttack").addEventListener("click", () => {
      const hit = $("#attackHit").checked;
      const crit = $("#attackCrit").checked && !state.criticalUsed;
      const scraped = hit && $("#attackScrape").checked;
      mutate(() => {
        if (scraped) state.scrapes += 1;
        if (scraped && crit) state.criticalUsed = true;
        state.pool = { opportunity: 0, break: 0 };
        k.done = true; k.action = "attack";
        finishMemberActionIfReady();
      }, `${k.name} 攻击：${!hit ? "未命中" : scraped ? `造成擦伤${crit ? "并触发关键擦伤" : ""}` : "命中但未造成擦伤"}；清空遭遇池`);
    });
  }
  function previewCard() {
    const level = currentLevel(), card = level;
    const modal = $("#preview");
    modal.innerHTML = `<button class="close-preview">关闭</button><div style="width:min(72vw,560px)">${window.KFEncounterView.renderCard(card, level.side || "face", "")}</div>`;
    modal.hidden = false;
    $(".close-preview", modal).addEventListener("click", () => modal.hidden = true);
    modal.addEventListener("click", e => { if (e.target === modal) modal.hidden = true; });
  }
  function exportSave() {
    const blob = new Blob([JSON.stringify({ app: "KF Encounter Assistant", version: 1, state }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `kf-encounter-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href);
  }
  async function importSave(file) {
    try {
      const payload = JSON.parse(await file.text());
      state = normalize(payload.state || payload);
      // Legacy configs had no runtime meaning; card corrections use their own import/export.
      save(); toast("存档已导入");
    } catch { toast("无法导入：文件格式不正确"); }
  }
  $("#undo").addEventListener("click", undo);
  $("#exportSave").addEventListener("click", exportSave);
  $("#importSave").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", e => { if (e.target.files[0]) importSave(e.target.files[0]); e.target.value = ""; });
  $("#newEncounter").addEventListener("click", () => { if (confirm("开始新的遭遇战？当前遭遇状态会被清空。")) { state = blankState(); save(); } });
  window.addEventListener("storage", event => {
    const campaignId = localStorage.getItem("kfActiveCampaign") || "";
    if (![ `kfCampaignRoster:${campaignId}`, `kfCampaignOptions:${campaignId}` ].includes(event.key)) return;
    try {
      window.KF_CAMPAIGN_PARTY = JSON.parse(localStorage.getItem(`kfCampaignRoster:${campaignId}`) || "[]");
      window.KF_CAMPAIGN_OPTIONS = JSON.parse(localStorage.getItem(`kfCampaignOptions:${campaignId}`) || "{}");
      state = normalize(state); save();
    } catch { /* Ignore incomplete cached campaign updates. */ }
  });
  // Publish the normalized state too, so another screen cannot retain a special
  // card that became unavailable after the campaign leader changed.
  save(false);
  renderApp();
})();
