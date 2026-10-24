(() => {
  "use strict";
  const monsterLabel = value => window.KFMonsterLabels?.name(value) ?? (typeof value === "string" ? value : value?.name || value?.id || "");

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
  // The remaining entries use the same token IDs and files as the Boss battle palette.
  const pieceIcons = Object.freeze([
    // Little Ser: Ser Sonch knightbook, printed p.4 / PDF p.4.
    ["monkey", "小猴子", "little-ser.png", "free", "ser-sonch"],
    ["token-01", "Generic", "generic.png"],
    ["token-04", "Bane", "httpssteamusercontentaakamaihdnetugc107925210701772985157F1FFBF1B6B3122574EAC077DF071EEAECD0A.jpg"],
    ["token-06", "Charge", "httpssteamusercontentaakamaihdnetugc107925210701773816D94D0D9F92199789B87B059762037FBCDB3002F.jpg"],
    ["token-08", "Fog Gate", "httpssteamusercontentaakamaihdnetugc107925210701773996ECA849F992C7EA67C78D97A03A7992F61BD241B.png"],
    ["token-09", "Devotion", "httpssteamusercontentaakamaihdnetugc1079252107017740261329DF7464BB346AC1307E370422403ED4AABE9.jpg"],
    ["token-11", "Scrape", "httpssteamusercontentaakamaihdnetugc10792521070177409519E3960B377A6A0CF46E8E04206FF8B556C47CF.jpg"],
    ["token-16", "Precision+", "httpssteamusercontentaakamaihdnetugc10792521070177552FA3C2C3D1D58187DA29E930E0BA1248B856EF54B.jpg"],
    ["token-17", "Precision-", "httpssteamusercontentaakamaihdnetugc107925210701775671EC8F342FEAD175C306DC5C6AC566A41CE0C9C28.jpg"],
    ["token-18", "AT+", "httpssteamusercontentaakamaihdnetugc10792521070177582AC98FE77627A34BFBDB9AAE92C4A2F9144B49084.jpg"],
    ["token-25", "AT-", "httpssteamusercontentaakamaihdnetugc107925210701831595B57839538577AC8E725FC547DFE4A614FED1E1B.jpg"],
    ["token-19", "Speed+", "httpssteamusercontentaakamaihdnetugc10792521070177587FC4B51B9E92C0BCDF0DE9378DB39078494C0F322.jpg"],
    ["token-20", "Speed-", "httpssteamusercontentaakamaihdnetugc107925210701775976C465B40B146734829DDEF9CE3F3759165132A67.jpg"],
    ["token-21", "To-Hit+", "httpssteamusercontentaakamaihdnetugc10792521070177607E3043472742006E2EE8AA83C0EAAD1404CB0704A.jpg"],
    ["token-22", "To-Hit-", "httpssteamusercontentaakamaihdnetugc10792521070177611252C8886A8E299ADF24A84A08DC38FE2D50C2139.jpg"],
    ["token-26", "Trap", "httpssteamusercontentaakamaihdnetugc13216830436822399584A1B8938E37C135D5BE567A1C580CF796E92038C5.png"],
    ["token-27", "Stone Key", "httpssteamusercontentaakamaihdnetugc14218767844456284586295178C389FD1EAF16D781B8833FF32E5DF00F9D.png"],
    ["token-29", "Token 29", "httpssteamusercontentaakamaihdnetugc159373289066078412246415D2EB9E78B9BCE62F168752E882B6821C3806.png"],
    ["token-blood", "血液", "httpssteamusercontentaakamaihdnetugc121471199374279135890AFE0D6E4BBFE4427554C0AF999D31C14D91B1E7.png"],
    ["token-knighteater-berserk", "首要目标", "httpssteamusercontentaakamaihdnetugc10792521070176964E460F00E6C698AFEB4F862A2B09A8B61D30EB2CD.png"],
    ["token-armor", "盔甲", "httpssteamusercontentaakamaihdnetugc10253072582350080078E89257D8FD942C3FA0350726E80F48FC7AEF6B99.png", "square"]
  ].map(([id, name, file, shape = "round", knightId]) => Object.freeze({ id, name, shape, knightId, src: `/assets/tokens/${file}${id === "monkey" ? "?v=5" : ""}` })));
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
    return `<span class="piece-avatar${image.monsterRing ? " monster-ring" : ""}"><img alt="${esc(alt)}" src="${esc(asset(image.face, assetBase))}" style="width:${width * 100}%;height:${height * 100}%;left:${-col * 100}%;top:${-row * 100}%"></span>`;
  }

  let cardFilterId = 0;
  function renderCard(card, side = "face", assetBase = "") {
    const image = card?.image;
    if (!image?.[side]) return "";
    const crop = image[`${side}Crop`] || image;
    const width = Math.max(1, Number(crop.width) || 1);
    const height = Math.max(1, Number(crop.height) || 1);
    const index = Math.max(0, Number(crop.index) || 0);
    const col = index % width;
    const row = Math.floor(index / width);
    const left = crop.x != null ? (1 - width) * crop.x : -col * 100;
    const top = crop.y != null ? (1 - height) * crop.y : -row * 100;
    const aspect = Number(crop.aspect || image.aspect) || .58156;
    const radius = Number(image.cornerRadiusRatio) || 0;
    const outline = radius > 0 ? `;border-radius:${radius * 100}% / ${radius * aspect * 100}%;border:0;background:transparent` : "";
    // Correct the different scans in sRGB while retaining the source pixels and alpha.
    const gains = image.colorCorrection?.channelGain;
    const contrast = Math.max(.5, Math.min(1.25, Number(image.colorCorrection?.contrast) || 1));
    const contrastOffset = Number(((1 - contrast) / 2).toFixed(6));
    const filterId = Array.isArray(gains) && gains.length === 3 ? `kf-card-tone-${++cardFilterId}` : "";
    const soften = contrast !== 1 ? `<feComponentTransfer>${["R", "G", "B"].map(channel => `<feFunc${channel} type="linear" slope="${contrast}" intercept="${contrastOffset}"/>`).join("")}<feFuncA type="identity"/></feComponentTransfer>` : "";
    const correction = filterId ? `<svg width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute"><defs><filter id="${filterId}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feComponentTransfer>${["R", "G", "B"].map((channel, index) => `<feFunc${channel} type="linear" slope="${Math.max(.5, Math.min(1.5, Number(gains[index]) || 1))}"/>`).join("")}<feFuncA type="identity"/></feComponentTransfer>${soften}</filter></defs></svg>` : "";
    const tone = filterId ? `;filter:url(#${filterId})` : "";
    return `<div class="crop-card read-only" style="aspect-ratio:${aspect}${outline}" aria-label="${esc(monsterLabel(card.name) || "遭遇卡")}">
      ${correction}<img alt="${esc(monsterLabel(card.name) || "遭遇卡")}" src="${esc(asset(image[side], assetBase))}" style="width:${width * 100}%;height:${height * 100}%;left:${left}%;top:${top}%${tone}">
    </div>`;
  }

  function customPieceVisual(piece) {
    const icon = pieceIcons.find(item => item.id === piece.iconId);
    if (icon) return `<img class="custom-piece-image ${icon.shape}" src="${esc(icon.src)}" alt="${esc(piece.name || icon.name)}">`;
    const length = Array.from(String(piece.name || "")).length;
    const size = length === 1 ? "one" : length <= 2 ? "short" : length <= 4 ? "medium" : length <= 8 ? "long" : "compact";
    return `<span class="custom-piece-label ${size}">${esc(piece.name)}</span>`;
  }

  function pieceVisual(piece, data, monster, assetBase) {
    if (piece.kind === "custom") return customPieceVisual(piece);
    const image = piece.kind === "monster"
      ? monster?.avatar ? { face: monster.avatar, width: 1, height: 1, index: 0, monsterRing: true } : null
      : list(data?.heroes).find(hero => hero.id === piece.heroId)?.image;
    return avatarCrop(image, piece.kind === "monster" ? monsterLabel(piece.name) : piece.name, assetBase);
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
      // Mirrored boards lay their columns right-to-left, so a multi-cell footprint has to grow
      // leftwards from its anchor cell; otherwise the drawn token covers cells outside its footprint.
      const mirrorClass = board.mirror && footprint > 1 ? " mirror" : "";
      const symbolText = [symbols.sword ? `剑×${symbols.sword}` : "", symbols.cup ? `杯×${symbols.cup}` : ""].filter(Boolean).join("、") || "空白";
      const title = unavailable ? `格 ${label} · 不可站立` : `${piece ? `${piece.kind === "monster" ? monsterLabel(piece.name) : piece.name} · ${footprint}×${footprint} · ` : ""}格 ${label} · ${symbolText}`;
      const tokenClass = piece?.kind === "custom" && pieceIcons.some(icon => icon.id === piece.iconId) ? "image-token" : "";
      const pieceKey = piece ? esc(`${piece.kind}:${piece.id}`) : "";
      const bossFrame = piece?.kind === "monster" && monster?.type === "boss" ? " boss-token-frame" : "";
      const knightFrame = piece?.kind === "knight" ? " knight-token-frame" : "";
      const frameFacing = bossFrame || knightFrame ? ` style="--${bossFrame ? "boss" : "token"}-facing:${Number(piece.facing) || 0}deg"` : "";
      const content = `<span class="space-number">${label}</span>${piece ? `<span class="piece ${piece.kind} ${tokenClass} ${selectedClass} footprint-${footprint} facing-${piece.facing || 0}${mirrorClass}${bossFrame}${knightFrame}"${frameFacing} data-piece="${pieceKey}">${pieceVisual(piece, data, monster, options.assetBase)}</span>` : ""}`;
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

  window.KFEncounterView = Object.freeze({ boardData, boardKind, customPieceVisual, isUnavailableBoardSpace, monsterFootprint, pieceIcons, renderBoard, renderCard, spaceLabel });
})();
