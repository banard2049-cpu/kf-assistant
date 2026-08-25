(() => {
  "use strict";
  const DATA = window.KF_ENCOUNTER_DATA;
  const RED_DIE_FACES = DATA.dice.faces;
  const DRAGON_DIE_FACES = [
    { id: "dragon-double-sword-double-cup", label: "双剑＋双杯", match: { sword: 2, cup: 2 }, src: "assets/dice/faces/dragon-double-sword-double-cup.png" },
    { id: "dragon-double-sword", label: "双剑", match: { sword: 2 }, src: "assets/dice/faces/dragon-double-sword.png" },
    { id: "dragon-sword-cup", label: "单剑＋杯", match: { sword: 1, cup: 1 }, src: "assets/dice/faces/dragon-sword-cup.png" },
    { id: "dragon-sword", label: "单剑", match: { sword: 1 }, src: "assets/dice/faces/dragon-sword.png" },
    { id: "dragon-sword-double-cup", label: "单剑＋双杯", match: { sword: 1, cup: 2 }, src: "assets/dice/faces/dragon-sword-double-cup.png" },
    { id: "dragon-double-sword-cup", label: "双剑＋杯", match: { sword: 2, cup: 1 }, src: "assets/dice/faces/dragon-double-sword-cup.png" },
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
  const memberOptions = member => {
    const groups = [
      ["骑士", Array.isArray(window.KF_CAMPAIGN_KNIGHTS) ? window.KF_CAMPAIGN_KNIGHTS : []],
      ["侍从", Array.isArray(window.KF_CAMPAIGN_SQUIRES) ? window.KF_CAMPAIGN_SQUIRES : []],
    ];
    return `<option value="">请选择队伍成员</option>${groups.filter(([,items])=>items.length).map(([label,items])=>`<optgroup label="${label}">${items.map(item =>
      `<option value="${esc(item.id)}" ${(member.sheetId === item.id || (!member.sheetId && member.name === item.name)) ? "selected" : ""}>${esc(item.name)}${item.title && item.title !== item.name ? ` · ${esc(item.title)}` : ""}</option>`
    ).join("")}</optgroup>`).join("")}`;
  };
  const uid = () => Math.random().toString(36).slice(2, 9);
  const monsterById = id => DATA.monsters.find(m => m.id === id) || DATA.monsters[0];
  const currentMonster = () => monsterById(state.monsterId);
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
      selectedPiece: "",
      history: [], log: [], savedAt: Date.now(),
    };
  }

  function rosterKnights(existing = []) {
    const roster = campaignParty().slice(0, 4);
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
    if (!raw || raw.version !== 1 || !monsterById(raw.monsterId)) return base;
    const merged = { ...base, ...raw };
    const savedMonster = monsterById(merged.monsterId);
    if (!savedMonster.encounterLevels.some(level => level.level === merged.level)) {
      merged.level = savedMonster.encounterLevels[0].level;
    }
    merged.knights = rosterKnights(Array.isArray(raw.knights) ? raw.knights : []);
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
    merged.customPieces = (Array.isArray(raw.customPieces) ? raw.customPieces : [])
      .slice(0, MAX_CUSTOM_PIECES)
      .map(piece => ({
        id: String(piece?.id || uid()),
        name: String(piece?.name || "").trim().slice(0, MAX_CUSTOM_PIECE_TEXT),
        space: piece?.space ? String(piece.space) : "",
        facing: 0,
      }))
      .filter(piece => piece.name);
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
  function stats() {
    const level = currentLevel();
    const correctedCount = corrections[cardKey()]?.monsterCount;
    return { ...level.stats, monsterCount: correctedCount ?? level.stats.monsterCount };
  }
  function save(render = true) {
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
    return ({ mob: "杂兵", vassal: "封臣", king: "国王", devil: "恶魔", dragon: "巨龙" })[tier()] || "封臣";
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
        .filter(value => value.space && value.id !== item.id)
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
      level.attackPattern.forEach(offset => {
        const relativeFacing = ((monster.facing || 0) - (level.attackFacing || 0) + 360) % 360;
        const [rowOffset, colOffset] = rotateAttackOffset(offset, size, relativeFacing);
        const row = anchorRow + rowOffset;
        const col = anchorCol + colOffset;
        if (row >= 0 && row < board.rows && col >= 0 && col < board.cols) {
          targets.add(String(row * board.cols + col + 1));
        }
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
    return `<span class="piece-avatar"><img alt="${esc(alt)}" src="${esc(image.face)}" style="width:${image.width * 100}%;height:${image.height * 100}%;left:${-col * 100}%;top:${-row * 100}%"></span>`;
  }
  function pieceAvatar(piece) {
    if (piece.kind === "monster") return currentMonster().avatar ? { face: currentMonster().avatar, width: 1, height: 1, index: 0 } : null;
    return DATA.heroes?.find(hero => hero.id === piece.heroId)?.image || null;
  }
  function pieceVisual(piece) {
    if (piece.kind === "custom") {
      const length = Array.from(String(piece.name)).length;
      const size = length === 1 ? "one" : length <= 2 ? "short" : length <= 4 ? "medium" : length <= 8 ? "long" : "compact";
      return `<span class="custom-piece-label ${size}">${esc(piece.name)}</span>`;
    }
    return avatarCrop(pieceAvatar(piece), piece.name);
  }
  function stepper() {
    const current = PHASES.indexOf(state.phase);
    return `<nav class="stepper" aria-label="遭遇战步骤">${PHASE_LABELS.map((label, i) =>
      `<span class="step ${i === current ? "active" : ""} ${i < current ? "done" : ""}" ${i === current ? 'aria-current="step"' : ""}>${i + 1}. ${label}</span>`
    ).join("")}</nav>`;
  }
  function monsterRail() {
    return `<aside class="panel monster-rail ${monsterRailCollapsed ? "collapsed" : ""}">
      <div class="panel-head"><div><span class="eyebrow">BESTIARY</span><h2>遭遇怪物</h2><p class="monster-current">${esc(currentMonster().name)}</p></div><button class="small ghost" id="toggleMonsterRail" title="${monsterRailCollapsed ? "展开遭遇怪物" : "折叠遭遇怪物"}" aria-label="${monsterRailCollapsed ? "展开遭遇怪物" : "折叠遭遇怪物"}" aria-expanded="${!monsterRailCollapsed}">${monsterRailCollapsed ? "›" : "‹"}</button></div>
      <div class="monster-list">${DATA.monsters.map(m => `<button class="monster-btn ${m.id === state.monsterId ? "active" : ""}" data-monster="${m.id}"><span>${esc(m.name)}</span><span class="badge">${m.type === "mob" ? "杂兵" : "首领"}</span></button>`).join("")}</div>
    </aside>`;
  }
  function setupPanel() {
    const level = currentLevel();
    return `<section class="panel">
      <div class="panel-head"><div><span class="eyebrow">ENCOUNTER SETUP</span><h2>${esc(currentMonster().name)}</h2></div><span class="badge gold">${currentMonster().type === "mob" ? "杂兵" : "首领"} · 等级 ${state.level}</span></div>
      <div class="card-view">
        ${crop(level, level.side)}
        <div>
          <div class="grid2">
            <div class="field"><label>遭遇等级</label><select id="level">${currentMonster().encounterLevels.map(l => `<option value="${l.level}" ${l.level === state.level ? "selected" : ""}>等级 ${l.level} · ${l.side === "face" ? "正面" : "背面"}</option>`).join("")}</select></div>
            <div class="field"><label>遭遇类型</label><select id="encounterType"><option value="normal">普通遭遇</option><option value="ambush" ${state.encounterType === "ambush" ? "selected" : ""}>伏击</option><option value="special" ${state.encounterType === "special" ? "selected" : ""}>特殊遭遇</option></select></div>
          </div>
          ${state.encounterType === "special" ? `<label class="check"><input type="checkbox" id="specialToken" ${state.specialToken ? "checked" : ""}>按卡底图标使用通用指示物代替模型</label>` : ""}
          <div class="field"><label>队伍席位</label><div class="row"><span class="badge">${state.knights.length} 席（骑士与侍从分开）</span></div></div>
          ${state.knights.map((k, i) => `<div class="grid2">
            <div class="field"><label>席位 ${i + 1} · ${k.memberType === "squire" ? "侍从" : "骑士"}</label><select data-knight-name="${k.id}">${memberOptions(k)}</select></div>
            <div class="field"><label>${k.memberType === "squire" ? "侍从模型" : "骑士模型"}</label><select data-hero-id="${k.id}">${DATA.heroes.filter(hero=>(k.memberType === "squire" ? SQUIRE_IDS : KNIGHT_IDS).has(hero.id)).map(hero => `<option value="${hero.id}" ${hero.id === k.heroId ? "selected" : ""}>${esc(hero.name)}</option>`).join("")}</select></div>
          </div>`).join("")}
        </div>
      </div>
      <div class="nav-actions"><span></span><button class="primary" id="startPosition">开始放置 →</button></div>
    </section>`;
  }
  function boardHtml() {
    return `${window.KFEncounterView.renderBoard({
      state,
      data: DATA,
      monster: currentMonster(),
      level: currentLevel(),
      board: boardData(),
      allDieFaces: ALL_DIE_FACES,
      interactive: true
    })}${customPieceControls()}`;
  }
  function customPieceControls() {
    const selected = String(state.selectedPiece || "").startsWith("custom:") ? pieceByKey(state.selectedPiece) : null;
    return `<div class="custom-piece-tools">
      <form id="customPieceForm" class="custom-piece-form">
        <label for="customPieceText">自定义棋子</label>
        <div class="custom-piece-input-row"><input id="customPieceText" type="text" maxlength="${MAX_CUSTOM_PIECE_TEXT}" autocomplete="off" placeholder="棋子内容" aria-label="自定义棋子内容"><button class="primary custom-piece-add" type="submit" title="添加自定义棋子" aria-label="添加自定义棋子">＋</button></div>
      </form>
      ${state.customPieces.length ? `<div class="custom-piece-list" aria-label="自定义棋子列表">${state.customPieces.map(piece => {
        const key = `custom:${piece.id}`;
        const position = piece.space ? `格 ${spaceLabel(piece.space, boardData())}` : "待放置";
        return `<button type="button" class="custom-piece-option ${state.selectedPiece === key ? "selected" : ""}" data-select-custom-piece="${esc(piece.id)}" aria-pressed="${state.selectedPiece === key}" title="选择 ${esc(piece.name)}"><span class="custom-piece-token">${esc(piece.name)}</span><span>${position}</span></button>`;
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
        <div>${boardHtml()}<div class="match-legend"><span class="legend-one">骰面 1 匹配</span>${requiredMonsterDice() > 1 ? '<span class="legend-two">骰面 2 匹配</span><span class="legend-both">两枚都匹配</span>' : ""}</div><p class="muted">点击空格放置当前选中的棋子；规则模型的可放置格会按骰面高亮。再次点击模型可旋转 90°。</p></div>
        <div>
          <div class="stats-note">${ambush ? "骑士无匹配空格时必须移出遭遇；首领无法放置时，移除尽可能少的骑士，并让其在怪物轮受到攻击。" : "无匹配空格的骑士可移出遭遇，或放到被怪物瞄准的任一格。杂兵攻击范围应尽量少重叠。"}</div>
          ${dragonReposition ? '<p class="stats-note">只重新进行骑士放置；怪物保持原位。已在版图上的骑士可以选择不投骰并保持位置。</p>' : diceEditor(tier() === "dragon" ? "怪物放置骰（白骰）" : "怪物放置骰", state.monsters, "monster")}
          ${diceEditor("队伍成员放置骰", state.knights, "knight")}
          <button id="rerollAll">${dragonReposition ? "重新投骑士放置骰" : "重新投全部放置骰"}</button>
          <hr>
          <div class="field placement-piece-field"><label>当前放置模型</label><div class="placement-piece-picker">
            ${pieceChoices.map(({ key, kind, item }) => {
              const selected = state.selectedPiece === key;
              const kindLabel = kind === "monster" ? "怪物" : item.memberType === "squire" ? "侍从" : "骑士";
              const avatar = avatarCrop(pieceAvatar({ ...item, kind }), item.name)
                || `<span class="placement-piece-fallback">${kind === "monster" ? "M" : "K"}</span>`;
              const position = item.space ? `格 ${spaceLabel(item.space, boardData())}` : "待放置";
              return `<button type="button" class="placement-piece-option ${kind} ${selected ? "selected" : ""} ${item.space ? "placed" : ""}" data-select-piece="${esc(key)}" aria-pressed="${selected}" title="选择${esc(kindLabel)} ${esc(item.name)}">
                <span class="placement-piece-avatar">${avatar}</span>
                <strong class="placement-piece-name">${esc(item.name)}</strong>
                <span class="placement-piece-meta">${kindLabel} · ${position}</span>
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
      <div class="panel-head"><div><span class="eyebrow">MONSTER ROUND</span><h2>怪物行动</h2></div><span class="badge gold">${currentMonster().name}</span></div>
      <div class="grid2 encounter-play-layout ${tier()}"><div>${boardHtml()}</div><div>
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
      <div class="panel-head"><div><span class="eyebrow">KNIGHT ROUND</span><h2>骑士行动</h2></div><span class="badge gold">${currentMonster().name}</span></div>
      <div class="grid2 encounter-play-layout ${tier()}"><div>${boardHtml()}</div><div>
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
        <div class="log">${state.log.slice().reverse().map(e => `<div class="log-entry"><span class="muted">${esc(e.at)}</span> ${esc(e.text)}</div>`).join("") || '<p class="muted">尚无行动。</p>'}</div>
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
    $("#app").innerHTML = stepper() + `<div class="layout ${monsterRailCollapsed ? "monster-collapsed" : ""}">${monsterRail()}<div class="main-stack">${mainPanel()}${actionLogPanel()}</div></div>`;
    bind();
  }
  function preparePieces() {
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
  function moveSelectedPieceOffBoard() {
    const selectedKey = state.selectedPiece || defaultSelectedPieceKey();
    const [kind] = selectedKey.split(":");
    const item = pieceByKey(selectedKey);
    if (!item?.space) {
      toast("请先选择版图上的棋子");
      return false;
    }
    mutate(() => {
      item.space = "";
      if (kind === "monster") state.targets = calculatedAttackTargets();
    }, `${item.name} 移出遭遇版图`);
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
      state.monsterId = b.dataset.monster; state.level = currentMonster().encounterLevels[0].level; state.phase = "setup"; state.monsters = [];
    }, `选择 ${monsterById(b.dataset.monster).name}`)));
    $("#level")?.addEventListener("change", e => mutate(() => state.level = Number(e.target.value), `选择等级 ${e.target.value}`));
    $("#encounterType")?.addEventListener("change", e => mutate(() => state.encounterType = e.target.value));
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
      const name = $("#customPieceText")?.value.trim().slice(0, MAX_CUSTOM_PIECE_TEXT) || "";
      if (!name) return toast("请输入棋子内容");
      if (state.customPieces.length >= MAX_CUSTOM_PIECES) return toast(`最多添加 ${MAX_CUSTOM_PIECES} 个自定义棋子`);
      mutate(() => {
        const piece = { id: uid(), name, space: "", facing: 0 };
        state.customPieces.push(piece);
        state.selectedPiece = `custom:${piece.id}`;
      }, `添加自定义棋子“${name}”`);
    });
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
  function handleSpace(space) {
    if (!["position", "monster", "knight"].includes(state.phase)) return;
    const pieces = allBoardPieces();
    const board = boardData();
    if (isUnavailableBoardSpace(space, board)) return toast("杂兵版图的 1、15 格不能放置棋子");
    state.selectedPiece ||= defaultSelectedPieceKey();
    const selectedExists = pieces.some(value => `${value.kind}:${value.id}` === state.selectedPiece);
    if (!selectedExists) state.selectedPiece = defaultSelectedPieceKey();
    const clickedPiece = pieces.find(value => value.space && coveredSpaces(value.space, pieceFootprint(value), board).includes(Number(space)));
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
    const image = card.image, col = image.index % image.width, row = Math.floor(image.index / image.width);
    const src = image[level.side];
    modal.innerHTML = `<button class="close-preview">关闭</button><div style="position:relative;width:min(72vw,560px);aspect-ratio:.58156;overflow:hidden"><img src="${esc(src)}" alt="${esc(card.name)}" style="position:absolute;max-width:none;width:${image.width * 100}%;height:${image.height * 100}%;left:${-col * 100}%;top:${-row * 100}%"></div>`;
    modal.hidden = false;
    $(".close-preview", modal).addEventListener("click", () => modal.hidden = true);
    modal.addEventListener("click", e => { if (e.target === modal) modal.hidden = true; });
  }
  function exportSave() {
    const blob = new Blob([JSON.stringify({ app: "KF Encounter Assistant", version: 1, state, configs }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `kf-encounter-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href);
  }
  async function importSave(file) {
    try {
      const payload = JSON.parse(await file.text());
      state = normalize(payload.state || payload);
      if (payload.configs && typeof payload.configs === "object") configs = payload.configs;
      save(); toast("存档已导入");
    } catch { toast("无法导入：文件格式不正确"); }
  }
  $("#undo").addEventListener("click", undo);
  $("#exportSave").addEventListener("click", exportSave);
  $("#importSave").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", e => { if (e.target.files[0]) importSave(e.target.files[0]); e.target.value = ""; });
  $("#newEncounter").addEventListener("click", () => { if (confirm("开始新的遭遇战？当前遭遇状态会被清空。")) { state = blankState(); save(); } });
  renderApp();
})();
