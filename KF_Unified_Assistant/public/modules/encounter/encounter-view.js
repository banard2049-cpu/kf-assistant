(() => {
  "use strict";

  const DRAGON_DIE_FACES = [
    { id: "dragon-double-sword-double-cup", match: { sword: 2, cup: 2 } },
    { id: "dragon-double-sword", match: { sword: 2 } },
    { id: "dragon-sword-cup", match: { sword: 1, cup: 1 } },
    { id: "dragon-sword", match: { sword: 1 } },
    { id: "dragon-sword-double-cup", match: { sword: 1, cup: 2 } },
    { id: "dragon-double-sword-cup", match: { sword: 2, cup: 1 } }
  ];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const list = value => Array.isArray(value) ? value : [];
  const asset = (source, base = "") => {
    const value = String(source || "");
    if (!value || /^(?:[a-z]+:|\/)/i.test(value)) return value;
    return `${base}${value}`;
  };

  function boardKind(level) {
    const tier = level?.tier || "mob";
    return ["vassal", "king", "devil"].includes(tier) ? "vassal" : tier;
  }

  function boardData(data, level) {
    return data?.boards?.[boardKind(level)] || data?.boards?.all?.[0] || {};
  }

  function isUnavailableBoardSpace(space, board, tier) {
    const position = Number(space);
    return tier === "mob" && board.cols === 5 && board.rows === 3 && (position === 1 || position === 15);
  }

  function spaceLabel(space, board) {
    const index = Number(space) - 1;
    if (board.cols === 9 && board.rows === 5) return `${["E", "D", "C", "B", "A"][Math.floor(index / 9)]}${index % 9 + 1}`;
    return String(space);
  }

  function monsterFootprint(level) {
    const tier = level?.tier || "mob";
    return Number(level?.stats?.monsterSize) || (tier === "mob" ? 1 : tier === "dragon" ? 3 : 2);
  }


  function avatarCrop(image, alt, assetBase) {
    if (!image?.face) return "";
    const width = Math.max(1, Number(image.width) || 1);
    const height = Math.max(1, Number(image.height) || 1);
    const index = Math.max(0, Number(image.index) || 0);
    const col = index % width;
    const row = Math.floor(index / width);
    return `<span class="piece-avatar"><img alt="${esc(alt)}" src="${esc(asset(image.face, assetBase))}" style="width:${width * 100}%;height:${height * 100}%;left:${-col * 100}%;top:${-row * 100}%"></span>`;
  }

  function renderCard(card, side = "face", assetBase = "") {
    const image = card?.image;
    if (!image?.[side]) return "";
    const width = Math.max(1, Number(image.width) || 1);
    const height = Math.max(1, Number(image.height) || 1);
    const index = Math.max(0, Number(image.index) || 0);
    const col = index % width;
    const row = Math.floor(index / width);
    return `<div class="crop-card read-only" aria-label="${esc(card.name || "遭遇卡")}">
      <img alt="${esc(card.name || "遭遇卡")}" src="${esc(asset(image[side], assetBase))}" style="width:${width * 100}%;height:${height * 100}%;left:${-col * 100}%;top:${-row * 100}%">
    </div>`;
  }

  function pieceVisual(piece, data, monster, assetBase) {
    if (piece.kind === "custom") {
      const length = Array.from(String(piece.name || "")).length;
      const size = length === 1 ? "one" : length <= 2 ? "short" : length <= 4 ? "medium" : length <= 8 ? "long" : "compact";
      return `<span class="custom-piece-label ${size}">${esc(piece.name)}</span>`;
    }
    const image = piece.kind === "monster"
      ? monster?.avatar ? { face: monster.avatar, width: 1, height: 1, index: 0 } : null
      : list(data?.heroes).find(hero => hero.id === piece.heroId)?.image;
    return avatarCrop(image, piece.name, assetBase);
  }

  function faceMatchesSpace(faceId, symbols, allDieFaces) {
    const match = list(allDieFaces).find(face => face.id === faceId)?.match || {};
    const keys = Object.keys(match);
    if (!keys.length) return !symbols.sword && !symbols.cup;
    return keys.every(key => (symbols[key] || 0) >= match[key]);
  }

  function renderBoard(options = {}) {
    const state = options.state || {};
    const data = options.data || {};
    const monster = options.monster || list(data.monsters).find(item => item.id === state.monsterId) || list(data.monsters)[0] || {};
    const level = options.level || list(monster.encounterLevels).find(item => Number(item.level) === Number(state.level)) || list(monster.encounterLevels)[0] || {};
    const board = options.board || boardData(data, level);
    if (!board.cols || !board.rows) return "";
    const tier = level.tier || "mob";
    const activeCols = ({ vassal: 4, king: 5, devil: 6 })[tier] || board.cols;
    const inset = board.inset || [6, 7, 6, 7];
    const pieces = [
      ...list(state.monsters).filter(item => item.space).map(item => ({ ...item, kind: "monster" })),
      ...list(state.knights).filter(item => item.space).map(item => ({ ...item, kind: "knight" })),
      ...list(state.customPieces).filter(item => item.space).map(item => ({ ...item, kind: "custom" }))
    ];
    const allDieFaces = options.allDieFaces || [...list(data.dice?.faces), ...DRAGON_DIE_FACES];
    const attackTargetsVisible = state.phase === "monster" || (state.phase === "position" && list(state.monsters).some(item => item.space));
    const selectedKey = String(state.selectedPiece || "");
    const interactive = options.interactive !== false;
    const spaces = Array.from({ length: board.cols * board.rows }, (_, index) => {
      const number = index + 1;
      const label = spaceLabel(number, board);
      const col = index % board.cols;
      const piece = pieces.find(item => Number(item.space) === number);
      const symbols = board.spaces?.[index] || {};
      const selectedPiece = (() => {
        const [kind, id] = selectedKey.split(":");
        if (kind === "monster") return list(state.monsters).find(item => item.id === id);
        if (kind === "knight") return list(state.knights).find(item => item.id === id);
        if (kind === "custom") return list(state.customPieces).find(item => item.id === id);
        return null;
      })();
      const selectedRolls = selectedPiece
        ? list(selectedPiece.rolls).length ? selectedPiece.rolls : selectedPiece.roll ? [selectedPiece.roll] : []
        : [];
      const matchedDice = state.phase === "position"
        ? selectedRolls.map((face, dieIndex) => faceMatchesSpace(face, symbols, allDieFaces) ? dieIndex + 1 : 0).filter(Boolean)
        : [];
      const matchClass = matchedDice.length > 1 ? "match match-both" : matchedDice.length ? `match match-${matchedDice[0]}` : "";
      const unavailable = isUnavailableBoardSpace(number, board, tier);
      const inactive = col >= activeCols || unavailable;
      const targetClass = attackTargetsVisible && list(state.targets).includes(String(number)) ? "target" : "";
      const footprint = piece?.kind === "monster" ? monsterFootprint(level) : 1;
      const selectedClass = piece && selectedKey === `${piece.kind}:${piece.id}` ? "selected" : "";
      const symbolText = [symbols.sword ? `剑×${symbols.sword}` : "", symbols.cup ? `杯×${symbols.cup}` : ""].filter(Boolean).join("、") || "空白";
      const title = unavailable ? `格 ${label} · 不可站立` : `${piece ? `${piece.name} · ${footprint}×${footprint} · ` : ""}格 ${label} · ${symbolText}`;
      const content = `<span class="space-number">${label}</span>${piece ? `<span class="piece ${piece.kind} ${selectedClass} footprint-${footprint} facing-${piece.facing || 0}">${pieceVisual(piece, data, monster, options.assetBase)}</span>` : ""}`;
      return interactive
        ? `<button class="space ${inactive ? "inactive" : ""} ${unavailable ? "unavailable" : ""} ${matchClass} ${targetClass} ${piece ? "piece-anchor" : ""}" data-space="${number}" ${inactive ? "disabled" : ""} title="${esc(title)}">${content}</button>`
        : `<span class="space read-only ${inactive ? "inactive" : ""} ${unavailable ? "unavailable" : ""} ${matchClass} ${targetClass} ${piece ? "piece-anchor" : ""}" aria-label="${esc(title)}">${content}</span>`;
    }).join("");
    return `<div class="board-wrap ${interactive ? "" : "read-only"}" style="--board-aspect:${Number(board.width) || 1}/${Number(board.height) || 1}">
      ${board.src ? `<img src="${esc(asset(board.src, options.assetBase))}" alt="TTS 遭遇战版图" style="transform:scaleY(${Number(board.mapScaleY) || 1});">` : ""}
      ${interactive ? '<button type="button" id="boardRemoveZone" class="board-remove-zone" title="将当前选中的棋子移出版图">移出区</button><button type="button" id="peekBoardIcons" class="board-icon-peek" aria-pressed="false" title="按住查看地图图标">查看图标</button>' : ""}
      <div class="board-grid" style="--cols:${board.cols};--rows:${board.rows};left:${inset[0]}%;top:${inset[1]}%;right:${inset[2]}%;bottom:${inset[3]}%;${board.mirror ? "direction:rtl;" : ""}">${spaces}</div>
    </div>`;
  }

  window.KFEncounterView = Object.freeze({ boardData, boardKind, isUnavailableBoardSpace, monsterFootprint, renderBoard, renderCard, spaceLabel });
})();
