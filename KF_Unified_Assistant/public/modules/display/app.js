(() => {
  "use strict";
  const root = document.querySelector("#displayRoot");
  const displayHeader = document.querySelector("#displayHeader");
  const connectionText = document.querySelector("#connectionText");
  const connectionDot = document.querySelector("#connectionDot");
  const query = new URLSearchParams(location.search);
  const activeCampaign = query.get("campaignId") || query.get("c") || localStorage.getItem("kfActiveCampaign") || "";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const cardinalFacing = value => {
    const normalized = ((Number(value) || 0) % 360 + 360) % 360;
    return Math.round(normalized / 90) % 4 * 90;
  };
  const facingClass = value => `facing-${cardinalFacing(value)}`;
  const mobNumberClass = value => {
    const number = Number(value);
    return Number.isInteger(number) && number >= 1 && number <= 10 ? `mob-number-${number}` : "";
  };
  const BELLY_BOARD = window.KF_BELLY_BOARD_DATA || {};
  const DIGESTIVE_TRACK_POSITIONS = [37.1, 52.3, 67.4, 81.7];
  const isBellyConflict = battle => battle?.monsterId !== "M_YoungDevour" && (battle?.conflictBoard?.boardId === "belly_of_beast" || battle?.conflictType === "belly_of_beast" || battle?.conflictLocation === "巨兽之腹");
  const bellyLayout = monster => {
    const layouts = Array.isArray(BELLY_BOARD.layouts) ? BELLY_BOARD.layouts : [];
    const source = layouts.find(layout => layout.monsterId === monster?.id)
      || (typeof BELLY_BOARD.findLayout === "function" ? BELLY_BOARD.findLayout(monster?.id) : null)
      || (BELLY_BOARD.layout || {});
    return { ...source, monsterId: monster?.id || source.monsterId, placements: (source.placements || []).map(item => ({ ...item })) };
  };
  let etag = "";
  let lastPayload = null;
  let lastSuccess = 0;

  function stateView(title, detail = "", mark = "KF") {
    displayHeader.hidden = true;
    root.innerHTML = `<section class="state-view"><div class="state-mark">${esc(mark)}</div><h1>${esc(title)}</h1>${detail ? `<p>${esc(detail)}</p>` : ""}</section>`;
  }

  function setConnection(label, status = "") {
    if (connectionText) connectionText.textContent = label;
    if (connectionDot) connectionDot.className = `connection-dot ${status}`;
  }

  function kingdomLabel(value) { return value === "stone" || value === "POS" ? "石之公国" : "沉没王国"; }

  function renderHeader(payload, scene) {
    if (scene !== "map") {
      displayHeader.hidden = true;
      displayHeader.innerHTML = "";
      return;
    }
    const state = payload.modules?.map;
    const tracks = state && window.KFMapView?.renderDelveTracks({
      state,
      data: window.KF_MOD_DATA,
      assetBase: "",
      interactive: false,
    });
    displayHeader.innerHTML = tracks || "";
    displayHeader.hidden = !tracks;
  }

  function keepPartyInMapViewport() {
    const viewport = root.querySelector(".map-viewport");
    const party = viewport?.querySelector(".party-location-token");
    if (!viewport || !party) return;
    const viewportRect = viewport.getBoundingClientRect();
    const partyRect = party.getBoundingClientRect();
    const margin = Math.min(96, Math.max(36, Math.min(viewportRect.width, viewportRect.height) * 0.12));
    const visible = partyRect.left >= viewportRect.left + margin
      && partyRect.right <= viewportRect.right - margin
      && partyRect.top >= viewportRect.top + margin
      && partyRect.bottom <= viewportRect.bottom - margin;
    if (visible) return;
    viewport.scrollLeft += partyRect.left + partyRect.width / 2 - (viewportRect.left + viewportRect.width / 2);
    viewport.scrollTop += partyRect.top + partyRect.height / 2 - (viewportRect.top + viewportRect.height / 2);
  }

  function mapAsset(source) {
    const value = String(source || "");
    if (!value || /^(?:[a-z]+:|\/)/i.test(value)) return value;
    return `/assets/${value}`;
  }

  function mapTileAngle(tile) {
    return (((Number(tile?.rotation) || 180) - 180 + 540) % 360) - 180;
  }

  function renderCurrentTilePreview(state, current) {
    const tile = window.KF_MOD_DATA?.maps?.[state.kingdom]?.tiles?.find(item => item.id === current.current);
    if (!tile?.image) return '<p class="display-empty-copy">当前位置地图块资源缺失</p>';
    const status = current.tileState?.[tile.id] || "hidden";
    const faceUp = current.showAll || status !== "hidden";
    const source = tile.image[faceUp ? "face" : "back"] || tile.image.face;
    const angle = mapTileAngle(tile);
    const quarterTurn = Math.abs(angle) % 180 === 90;
    const sourceAspect = Math.max(.01, Number(tile.image.aspect) || .6657);
    const displayAspect = quarterTurn ? 1 / sourceAspect : sourceAspect;
    return `<div class="map-auto-tile-frame ${quarterTurn ? "quarter-turn" : ""}" style="--preview-aspect:${displayAspect};--preview-angle:${angle}deg">
      <img src="${esc(mapAsset(source))}" alt="${esc(window.KFMapView.tileLabel(tile))}" draggable="false">
    </div>`;
  }

  function renderFogPreview(state, current) {
    const fog = current.fog || {};
    const cards = window.KF_MOD_DATA?.kingdomRules?.[state.kingdom]?.deepFog || [];
    const cardById = id => cards.find(item => item.id === id);
    const entries = Array.isArray(fog.route) && fog.route.length
      ? fog.route
      : fog.current ? [{ cardId:fog.current }] : [];
    if (!entries.length) return '<p class="display-empty-copy">正在进入弥雾</p>';
    const columns = entries.length;
    const cardAspect = Math.max(.2, Number(cardById(entries[0]?.cardId)?.image?.aspect) || .635);
    const gridAspect = columns * cardAspect;
    return `<div class="display-fog-preview" style="--fog-columns:${columns};--fog-aspect:${gridAspect}">
      ${entries.map((item, index) => {
        const card = cardById(item.cardId);
        if (!card) return "";
        const markup = window.KFMapView.renderExplorationCard({ state, data:window.KF_MOD_DATA, card, side:"face", assetBase:"" });
        return `<div class="display-fog-preview-card" style="grid-column:${index + 1};grid-row:1">${markup}</div>`;
      }).join("")}
    </div>`;
  }

  function renderMapAutoPreview(state, current) {
    const fogActive = current.fog?.active === true;
    const tile = window.KF_MOD_DATA?.maps?.[state.kingdom]?.tiles?.find(item => item.id === current.current);
    const target = window.KF_MOD_DATA?.maps?.[state.kingdom]?.tiles?.find(item => item.id === current.fog?.target);
    const title = fogActive ? "弥雾路径" : window.KFMapView.tileLabel(tile);
    const subtitle = fogActive && target ? `前往 ${window.KFMapView.tileLabel(target)}` : "当前位置";
    return `<section class="map-auto-preview" aria-label="自动显示区">
      <div class="display-section-heading"><span>AUTO DISPLAY · ${esc(subtitle)}</span><strong>${esc(title)}</strong></div>
      <div class="map-auto-preview-body ${fogActive ? "showing-fog" : "showing-tile"}">
        ${fogActive ? renderFogPreview(state, current) : renderCurrentTilePreview(state, current)}
      </div>
    </section>`;
  }

  function renderMap(payload) {
    const state = payload.modules?.map;
    if (!state?.maps?.[state.kingdom]) return stateView("探索地图尚未建立", "在主屏进入地图模块后会自动显示。", "MAP");
    const current = state.maps[state.kingdom];
    const mapStage = window.KFMapView?.renderMapStage({
      state,
      data: window.KF_MOD_DATA,
      assetBase: "",
      interactive: false
    });
    if (!mapStage) return stateView("探索地图为空", "主屏放置地图板块后会自动显示。", "MAP");
    const kingdomBoard = window.KFMapView.renderKingdomBoard({ state, data: window.KF_MOD_DATA, assetBase: "" });
    const districtEffects = window.KFMapView.renderDistrictExplorationCards({ state, data: window.KF_MOD_DATA, assetBase: "" });
    const clueTracking = window.KFMapView.renderClueTracking({ state, assetBase: "" });
    const scale = clamp(payload.presentation?.settings?.mapScale || 100,50,200);
    root.innerHTML = `<section class="map-scene">
      <div class="map-primary">
        <div class="map-viewport"><div class="map-canvas" style="width:${scale}%">${mapStage}</div></div>
      </div>
      <aside class="map-side">
        <div class="map-side-scroll">
          <div class="display-kingdom-board">${kingdomBoard || '<p class="display-empty-copy">王国版图资源缺失</p>'}</div>
          <section class="display-district-section" aria-label="区域探索卡"><div class="display-district-effects">${districtEffects}</div></section>
          ${renderMapAutoPreview(state, current)}
        </div>
        <section class="display-clue-panel sidebar-clue-panel" aria-label="骑士线索追踪"><div class="display-section-heading"><span>KNIGHT CLUES</span><strong>骑士线索追踪</strong></div>${clueTracking}</section>
      </aside>
    </section>`;
    requestAnimationFrame(() => requestAnimationFrame(keepPartyInMapViewport));
  }

  function renderRogue(payload) {
    const state = payload.modules?.roguePath || window.KF_ROGUE_RULES?.freshState?.();
    if (!state || !Array.isArray(state.nodes) || !state.nodes.length) {
      return stateView("肉鸽地图尚未建立", "在主屏进入肉鸽之路并创建战役后会自动显示。", "ROGUE");
    }
    const cleared = new Set(state.nodes.filter(node => node.cleared).map(node => node.id));
    const canChoose = node => node && !node.cleared && !state.pendingBattle && !state.pendingRewardChoice
      && state.status === "active" && (node.links || []).some(id => cleared.has(id));
    const rewardNames = { heroic:"英勇曲线", class:"职业", peril:"危险曲线", technique:"招数", gear:"装备", virtue:"美德", wild:"万能", sigh:"圣杯叹息", start:"起点" };
    const nodes = state.nodes.filter(node => node.id !== "S").map(node => {
      const available = canChoose(node);
      const status = node.cleared ? "cleared" : available ? "available" : "locked";
      const title = node.id === "S" ? "起点 S" : `等级 ${node.level} · ${node.kingdom === "stone" ? "巨石公国" : "沉没王国"} · ${rewardNames[node.reward] || node.reward}`;
      return `<span class="display-rogue-node ${status}" data-node="${esc(node.id)}" style="left:${(Number(node.page) * 50 + Number(node.x) * 50)}%;top:${Number(node.y) * 100}%" title="${esc(title)}"></span>`;
    }).join("");
    const roster = Array.isArray(state.roster) ? state.roster : [];
    const alive = roster.filter(member => member.alive !== false).length;
    const statusLabel = ({ setup:"未开始", active:"进行中", won:"战役胜利", lost:"战役失败" })[state.status] || state.status || "—";
    const pending = state.pendingBattle;
    root.innerHTML = `<section class="rogue-display-scene">
      <div class="rogue-display-map-area"><div class="rogue-display-map-frame"><img src="/assets/rogue/rosegraal-tree.jpg" alt="玫瑰圣杯路径图"><div class="display-rogue-node-layer">${nodes}</div></div></div>
      <aside class="rogue-display-side"><p class="side-subtitle">ROSEGRAAL · ROGUE'S PATH</p><h1 class="side-title">肉鸽之路</h1><dl class="fact-list"><dt>状态</dt><dd>${esc(statusLabel)}</dd><dt>队伍</dt><dd>${roster.length ? `${alive} / ${roster.length} 存活` : "尚未选择"}</dd><dt>共享复活</dt><dd>${esc(state.sharedRevives ?? 0)}</dd><dt>圣杯叹息</dt><dd>${esc(state.graalSighs ?? 0)}</dd><dt>已完成节点</dt><dd>${cleared.size}</dd></dl>${pending ? `<section class="rogue-display-pending"><strong>待结算冲突</strong><span>${esc(pending.nodeId || "")} · ${esc(pending.monster || "")}</span><small>请在主屏 AI / BP 完成结算</small></section>` : ""}<section class="rogue-display-party"><h2>队伍</h2>${roster.length ? roster.map(member => `<div class="rogue-party-row"><span>${esc(member.name || member.knightId)}</span><small>${member.alive === false ? "死亡" : "存活"} · ${esc(member.gold ?? 0)} 金币</small></div>`).join("") : '<p class="display-empty-copy">尚未开始肉鸽战役。</p>'}</section></aside>
    </section>`;
  }

  function renderEncounter(payload) {
    const state = payload.modules?.encounter;
    if (!state?.monsterId) return stateView("遭遇战尚未建立", "在主屏开始遭遇后会自动显示。", "EN");
    const monster = window.KF_ENCOUNTER_DATA?.monsters?.find(item => item.id === state.monsterId);
    const level = monster?.encounterLevels?.find(item => Number(item.level) === Number(state.level)) || monster?.encounterLevels?.[0];
    const board = window.KFEncounterView?.renderBoard({
      state,
      data: window.KF_ENCOUNTER_DATA,
      monster,
      level,
      assetBase: "",
      interactive: false
    });
    if (!board) return stateView("遭遇版图资源缺失", "请重新运行资源导入或检查部署文件。", "!");
    const encounterCard = window.KFEncounterView.renderCard(level, level?.side || "face", "");
    const phaseLabels = {setup:"设置",position:"放置",monster:"怪物轮",knight:"骑士轮",resolution:"结算"};
    root.innerHTML = `<section class="encounter-scene"><div class="encounter-board-area">${board}</div><aside class="map-side encounter-side"><p class="side-subtitle">ENCOUNTER</p><h2 class="side-title">${esc(monster?.name || state.monsterId)}</h2>${encounterCard}<dl class="fact-list"><dt>等级</dt><dd>${esc(state.level)}</dd><dt>类型</dt><dd>${esc(state.encounterType === "ambush" ? "伏击" : state.encounterType === "special" ? "特殊" : "普通")}</dd><dt>阶段</dt><dd>${esc(phaseLabels[state.phase] || state.phase)}</dd><dt>怪物</dt><dd>${esc(state.monsters?.length || 0)}</dd><dt>队伍</dt><dd>${esc(state.knights?.length || 0)}</dd><dt>机会</dt><dd>${esc(state.pool?.opportunity || 0)}</dd><dt>破甲</dt><dd>${esc(state.pool?.break || 0)}</dd><dt>擦伤</dt><dd>${esc(state.scrapes || 0)}</dd></dl></aside></section>`;
  }

  function displayAsset(value) {
    const source = String(value || "");
    return !source ? "" : (/^(?:[a-z]+:|\/)/i.test(source) ? source : `/assets/${source}`);
  }
  function terrainCardsFor(terrain) {
    const cardData = window.KF_CONFLICT_BOARD_DATA?.terrainCards;
    if (!cardData?.sheet || !cardData.byAsset) return [];
    const seen = new Set();
    return (terrain || []).flatMap(placement => {
      const card = cardData.byAsset[placement.asset];
      if (!card || seen.has(card.cardId)) return [];
      seen.add(card.cardId);
      return [{...card,asset:placement.asset}];
    });
  }
  function terrainCardFace(card) {
    const sheet = window.KF_CONFLICT_BOARD_DATA?.terrainCards?.sheet;
    if (!sheet || !card) return "";
    return `<span class="terrain-card-face" style="--card-sheet-width:${sheet.columns*100}%;--card-sheet-height:${sheet.rows*100}%;--card-left:${-card.column*100}%;--card-top:${-card.row*100}%"><img src="${esc(displayAsset(sheet.asset))}" alt=""></span>`;
  }
  function publicTerrainCard(entry) {
    const card = entry?.terrainCard;
    return card ? `<figure class="display-track-terrain" aria-label="地形 · ${esc(card.label)}" title="${esc(card.label)}">${terrainCardFace(card)}</figure>` : "";
  }
  function aibpAsset(value) {
    const source = String(value || "");
    return !source ? "" : (/^(?:[a-z]+:|\/)/i.test(source) ? source : `/assets/${source}`);
  }
  function cardById(monster, id) { return monster?.cards?.find(card => card.id === id); }
  function cardArt(card, side = "face") {
    if (!card?.image?.face) return "";
    const image = card.image, cols = Math.max(1,Number(image.width)||1), rows = Math.max(1,Number(image.height)||1), index = Math.max(0,Number(image.index)||0);
    const x = cols > 1 ? (index%cols)/(cols-1)*100 : 0, y = rows > 1 ? Math.floor(index/cols)/(rows-1)*100 : 0;
    return `--card-aspect:${Number(image.aspect)||.7};background-image:url('${aibpAsset(image[side]||image.face)}');background-size:${cols*100}% ${rows*100}%;background-position:${x}% ${y}%`;
  }
  function publicCard(monster,id,label,side="face",className="") { const card=cardById(monster,id); return card ? `<figure class="public-card ${esc(className)}" data-public-card="${esc(id)}"><div class="public-card-art" style="${cardArt(card,side)}"></div><figcaption>${esc(label)} · ${esc(card.name)}</figcaption></figure>` : ""; }
  function publicFeatureCard(entry) {
    return entry?.card ? `<figure class="public-card feature-card" data-public-card="${esc(entry.key || entry.card.id)}" aria-label="${esc(entry.label)} · ${esc(entry.card.name)}" title="${esc(entry.card.name)}"><div class="public-card-art" style="${cardArt(entry.card,entry.side||"face")}"></div><figcaption>${esc(entry.label)} · ${esc(entry.card.name)}</figcaption></figure>` : "";
  }
  function publicDeckLevelText(levels) {
    const normalized=(Array.isArray(levels)?levels:[]).map(Number).filter(level=>Number.isInteger(level)&&level>=0&&level<=3);
    return normalized.length?normalized.join(" → "):"空";
  }
  function publicDeckLevelSummary(levels) {
    const normalized=(Array.isArray(levels)?levels:[]).map(Number).filter(level=>Number.isInteger(level)&&level>=0&&level<=3);
    if (!normalized.length) return "空";
    const counts=new Map();
    normalized.forEach(level=>counts.set(level,(counts.get(level)||0)+1));
    const composition=[...counts.entries()].map(([level,count])=>`${level}×${count}`).join("，");
    return `${normalized[0]}（${composition}）`;
  }
  function publicDeckSummary(battle, partyRows = "") {
    const single=clamp(battle.singleWounds||0,0,99),double=clamp(battle.doubleWounds||0,0,99),total=single+double*2;
    const deckLevelText=battle.deckOrderVisible===false?publicDeckLevelSummary:publicDeckLevelText;
    return `<div class="conflict-resolving-summary" aria-label="AI、BP 等级顺序、损伤量与骑士属性"><p><b>AI 顺序</b><span>${esc(deckLevelText(battle.aiDeckLevels))}</span></p><p><b>BP 顺序</b><span>${esc(deckLevelText(battle.bpDeckLevels))}</span></p><p class="resolving-damage"><b>损伤</b><span>${esc(total)} <small>单伤 ${esc(single)} · 双伤 ${esc(double)} · BP 损伤牌 ${esc(battle.bpDamage?.length||0)}</small></span></p>${partyRows}</div>`;
  }
  function conflictHeroClues(state) {
    const heroes=(Array.isArray(state?.knights)?state.knights:[]).filter(hero=>hero?.heroId||hero?.name);
    if(!heroes.length)return "";
    const clueLabels={martial:["武","武艺"],errant:["游","游侠"],historic:["史","历史"],mystic:["秘","神秘"]};
    const clueValue=(hero,id,role)=>{
      const label=clueLabels[id]||["-","未指定"];
      const amount=id?Math.max(0,Number(hero.clues?.[id])||0):0;
      return `<span class="conflict-hero-clue ${id?`clue-${esc(id)}`:"empty"}" title="${role} · ${label[1]}线索 ${amount}"><small>${label[0]}</small><b>${esc(amount)}</b></span>`;
    };
    return `<section class="conflict-hero-clues" aria-label="英雄线索数量">${heroes.map(hero=>{
      const name=hero.name||hero.heroId||"英雄";
      const avatar=hero.heroId?`<img src="/assets/heroes/${esc(hero.heroId)}-avatar.jpg" alt="">`:"";
      return `<article title="${esc(name)}">${avatar}<strong>${esc(name)}</strong>${clueValue(hero,hero.primary,"主要")}${clueValue(hero,hero.secondary,"次要")}</article>`;
    }).join("")}</section>`;
  }
  // Party attributes shown alongside the AI/BP deck order + damage in the
  // resolving summary (one row per member): knights show their six virtues with
  // full 中文+English names, squires show their primary + secondary clues with
  // the matching clue-token icons. Virtues come from the enriched display-state
  // payload (hero.virtues); clues are already carried on hero.clues. A knight
  // without virtue data falls back to clues rather than rendering nothing.
  const VIRTUE_LABELS=[["bravery","勇敢","BRAVERY"],["tenacity","顽强","TENACITY"],["sagacity","睿智","SAGACITY"],["fortitude","坚韧","FORTITUDE"],["might","威武","MIGHT"],["insight","洞察","INSIGHT"]];
  const CLUE_LABELS={martial:["武","武艺"],errant:["游","游侠"],historic:["史","历史"],mystic:["秘","神秘"]};
  const CLUE_ICONS={martial:"/assets/tokens/红-token.png?v=1",errant:"/assets/tokens/绿-token.png?v=1",historic:"/assets/tokens/黄-token.png?v=1",mystic:"/assets/tokens/蓝-token.png?v=1"};
  // Resolve the party roster to display beside the AI/BP summary. When the
  // conflict originated from 肉鸽之路 (a rogue battle is pending), read the rogue
  // roster: those members are all knights and already carry their six virtues in
  // `attributes`. Otherwise fall back to the map module's knights (which the API
  // enriches with `virtues` for knights and `clues` for squires).
  function conflictPartyRoster(payload) {
    const rogue=payload?.modules?.roguePath;
    if(rogue?.pendingBattle && Array.isArray(rogue.roster) && rogue.roster.length){
      return rogue.roster.filter(member=>member.alive!==false).map(member=>({
        heroId:member.knightId||"",
        name:member.name||member.knightId||"骑士",
        memberType:"knight",
        virtues:member.attributes&&typeof member.attributes==="object"?member.attributes:null,
      }));
    }
    const map=payload?.modules?.map;
    return Array.isArray(map?.knights)?map.knights:[];
  }
  function conflictPartyAttributes(payload) {
    const heroes=conflictPartyRoster(payload).filter(hero=>hero?.heroId||hero?.name);
    if(!heroes.length)return "";
    const clueChip=(hero,id,role)=>{
      const label=CLUE_LABELS[id]||["-","未指定"];
      const icon=CLUE_ICONS[id];
      const amount=id?Math.max(0,Number(hero.clues?.[id])||0):0;
      const face=icon?`<img class="conflict-clue-icon" src="${esc(icon)}" alt="${esc(label[1])}">`:`<small>${label[0]}</small>`;
      return `<span class="conflict-attr-chip ${id?`clue-${esc(id)}`:"empty"}" title="${role} · ${label[1]}线索 ${amount}">${face}<b>${esc(amount)}</b></span>`;
    };
    const virtueChip=([key,cn,en],hero)=>{
      const amount=Math.max(-99,Math.min(99,Number(hero.virtues?.[key])||0));
      return `<span class="conflict-attr-chip virtue" title="${esc(cn)} ${esc(en)} ${amount}"><small>${esc(cn)} ${esc(en)}</small><b>${esc(amount)}</b></span>`;
    };
    return heroes.map(hero=>{
      const name=hero.name||hero.heroId||"英雄";
      const avatar=hero.heroId?`<img class="conflict-party-avatar" src="/assets/heroes/${esc(hero.heroId)}-avatar.jpg" alt="">`:"";
      const isSquire=hero.memberType==="squire";
      const hasVirtues=hero.virtues&&typeof hero.virtues==="object";
      const chips=(!isSquire&&hasVirtues)
        ? VIRTUE_LABELS.map(v=>virtueChip(v,hero)).join("")
        : `${clueChip(hero,hero.primary,"主要")}${clueChip(hero,hero.secondary,"次要")}`;
      return `<p class="conflict-party-row ${isSquire?"is-squire":"is-knight"}" title="${esc(name)}"><b>${avatar}<span class="conflict-party-name">${esc(name)}</span></b><span class="conflict-attr-chips">${chips}</span></p>`;
    }).join("");
  }
  const TOKEN_FILES = {
    "token-01":"httpssteamusercontentaakamaihdnetugc10792521070177147F375BA9D7F1EF7C2ABAA9D04F55839FA6FC24A94.jpg",
    "token-04":"httpssteamusercontentaakamaihdnetugc107925210701772985157F1FFBF1B6B3122574EAC077DF071EEAECD0A.jpg",
    "token-06":"httpssteamusercontentaakamaihdnetugc107925210701773816D94D0D9F92199789B87B059762037FBCDB3002F.jpg",
    "token-08":"httpssteamusercontentaakamaihdnetugc107925210701773996ECA849F992C7EA67C78D97A03A7992F61BD241B.jpg",
    "token-09":"httpssteamusercontentaakamaihdnetugc1079252107017740261329DF7464BB346AC1307E370422403ED4AABE9.jpg",
    "token-11":"httpssteamusercontentaakamaihdnetugc10792521070177409519E3960B377A6A0CF46E8E04206FF8B556C47CF.jpg",
    "token-16":"httpssteamusercontentaakamaihdnetugc10792521070177552FA3C2C3D1D58187DA29E930E0BA1248B856EF54B.jpg",
    "token-17":"httpssteamusercontentaakamaihdnetugc107925210701775671EC8F342FEAD175C306DC5C6AC566A41CE0C9C28.jpg",
    "token-18":"httpssteamusercontentaakamaihdnetugc10792521070177582AC98FE77627A34BFBDB9AAE92C4A2F9144B49084.jpg",
    "token-25":"httpssteamusercontentaakamaihdnetugc107925210701831595B57839538577AC8E725FC547DFE4A614FED1E1B.jpg",
    "token-19":"httpssteamusercontentaakamaihdnetugc10792521070177587FC4B51B9E92C0BCDF0DE9378DB39078494C0F322.jpg",
    "token-20":"httpssteamusercontentaakamaihdnetugc107925210701775976C465B40B146734829DDEF9CE3F3759165132A67.jpg",
    "token-21":"httpssteamusercontentaakamaihdnetugc10792521070177607E3043472742006E2EE8AA83C0EAAD1404CB0704A.jpg",
    "token-22":"httpssteamusercontentaakamaihdnetugc10792521070177611252C8886A8E299ADF24A84A08DC38FE2D50C2139.jpg",
    "token-26":"httpssteamusercontentaakamaihdnetugc13216830436822399584A1B8938E37C135D5BE567A1C580CF796E92038C5.png",
    "token-27":"httpssteamusercontentaakamaihdnetugc14218767844456284586295178C389FD1EAF16D781B8833FF32E5DF00F9D.png",
    "token-29":"httpssteamusercontentaakamaihdnetugc159373289066078412246415D2EB9E78B9BCE62F168752E882B6821C3806.png",
    "token-blood":"httpssteamusercontentaakamaihdnetugc121471199374279135890AFE0D6E4BBFE4427554C0AF999D31C14D91B1E7.png",
    "token-knighteater-berserk":"httpssteamusercontentaakamaihdnetugc10792521070176964E460F00E6C698AFEB4F862A2B09A8B61D30EB2CD.png",
    "token-armor":"httpssteamusercontentaakamaihdnetugc10253072582350080078E89257D8FD942C3FA0350726E80F48FC7AEF6B99.png"
  };
  function tokenSrc(id) {
    if (id === "bog-witch-encounter") return "/assets/tokens/httpssteamusercontentaakamaihdnetugc102276672612288011771BFEEDE9B444465A77830BDC2F8E79E37A0B9056.png";
    if (id === "token-01") return `/assets/images/${TOKEN_FILES[id]}`;
    return TOKEN_FILES[id] ? `/assets/tokens/${TOKEN_FILES[id]}` : "";
  }
  function tokenShapeClass(id) { return id === "token-armor" ? "token-square" : ""; }
  function publicTokenStacks(tokens) {
    return (tokens || []).map(token => {
      const src=tokenSrc(token.assetId); if(!src)return "";
      return `<span class="boss-sheet-token ${token.auto ? "auto-token" : ""}" style="left:${clamp(token.x,0,100)}%;top:${clamp(token.y,0,100)}%"><img class="${tokenShapeClass(token.assetId)}" src="${esc(src)}" alt=""><b>×${clamp(token.count||1,1,20)}</b></span>`;
    }).join("");
  }
  function bossSheetHtml(monster,battle) {
    if(!monster?.sheet?.face&&!monster?.sheet?.back)return "";
    const tokens=[...(Array.isArray(battle.sheetTokens)?battle.sheetTokens:[]),...(Array.isArray(battle.sheetAutoTokens)?battle.sheetAutoTokens:[])];
    return `<section class="boss-sheet-block boss-sheet-display-bar" data-layout="big-card" aria-label="Boss 大卡"><div class="boss-sheet-stage"><div class="boss-sheet-spread">${monster.sheet.face?`<img src="${esc(aibpAsset(monster.sheet.face))}" alt="${esc(monster.name)} 怪物面板正面">`:""}${monster.sheet.back?`<img src="${esc(aibpAsset(monster.sheet.back))}" alt="${esc(monster.name)} 怪物面板背面">`:""}</div><div class="boss-sheet-token-layer">${publicTokenStacks(tokens)}</div></div></section>`;
  }
  function markerStacks(markerTokens) {
    return Object.entries(markerTokens||{}).map(([assetId,count])=>{const src=tokenSrc(assetId);return src&&count?`<span class="display-bp-marker"><img class="${tokenShapeClass(assetId)}" src="${esc(src)}" alt=""></span>`:""}).join("");
  }
  function publicMobTrack(monster,battle,fillers=[]) {
    const bossTrack=["doppelganger","guardian"].includes(battle?.bossMobTrack?.type)?battle.bossMobTrack:null;
    const standardSlots=bossTrack?null:(Array.isArray(battle?.bpTrack)?battle.bpTrack:[]);
    // An empty standard BP track means this Boss has no minion track (for
    // example Winged Nightmare). Keep the presentation area useful for
    // terrain/feature cards, but use a compact six-card row.
    const noMobTrack=!bossTrack&&monster?.type==="boss"&&standardSlots.length===0;
    const trackType=bossTrack?bossTrack.type:"standard";
    const sourceSlots=bossTrack?bossTrack.slots||[]:standardSlots;
    const slotCount=noMobTrack?6:16;
    const backCard=monster.cards.find(card=>/^BP[123SX]$/.test(card.kind));
    let used=0;
    const slots=Array.from({length:16},(_,index)=>(index<10?sourceSlots[index]:null)||{id:"",occupied:false,revealed:false,side:"face",markerTokens:{}}).slice(0,slotCount).map((slot,index)=>{
      const card=trackType==="standard"&&slot.revealed&&slot.id?cardById(monster,slot.id):null;
      const occupied=slot.occupied===true||Boolean(slot.id);
      const filler=!occupied&&(fillers[used]?.card||fillers[used]?.terrainCard)?fillers[used++]:null;
      let cardContent="";
      if(filler?.terrainCard)cardContent=publicTerrainCard(filler);
      else if(filler?.card)cardContent=`<div class="display-track-card" data-public-feature="${esc(filler.key || filler.card.id)}" aria-label="${esc(filler.label)} · ${esc(filler.card.name)}" title="${esc(filler.card.name)}" style="${cardArt(filler.card,filler.side||"face")}"></div>`;
      else if(trackType==="standard"&&card)cardContent=`<div class="display-track-card" data-public-bp="${esc(slot.id)}" style="${cardArt(card,slot.side)}"></div>`;
      else if(trackType==="standard"&&occupied&&backCard)cardContent=`<div class="display-track-card" style="${cardArt(backCard,"back")}"></div>`;
      else if(trackType==="doppelganger"&&occupied){
        const knownCards=slot.revealed?(slot.cardIds||[]).map(id=>cardById(monster,id)).filter(Boolean):[];
        const stackCards=knownCards.length?knownCards:Array.from({length:Math.max(1,Number(slot.cardCount)||1)},()=>backCard).filter(Boolean);
        cardContent=`<div class="display-track-stack">${stackCards.map((stackCard,depth)=>`<div class="display-track-card" style="--stack-depth:${depth};${cardArt(stackCard,knownCards.length?"face":"back")}"></div>`).join("")}</div><b class="display-track-count">×${esc(slot.cardCount||stackCards.length)}</b>`;
      }else if(trackType==="guardian"&&occupied){
        const guardianCard=slot.carrier?cardById(monster,"M_WhiteApe:Trait:38"):null;
        cardContent=guardianCard?`<div class="display-track-card" style="${cardArt(guardianCard)}"></div>`:`<img class="display-guardian-figure" src="/assets/guardians/firstman-guardian-placeholder.png" alt="先民护卫">`;
      }
      const activationTokens=trackType==="standard"?(battle.mobActivations||[]).filter(token=>token.position===index).map(token=>`<span class="display-activation ${token.used?"used":""} ${token.id===battle.activeMobActivationId?"active":""}">${esc(token.type)}</span>`).join(""):"";
      // AI/SG activation tokens sit in a strip anchored to the bottom of the BP
      // card, so they read as "belonging to" that slot rather than covering its
      // number/art at the top.
      const activations=activationTokens?`<div class="display-slot-activations">${activationTokens}</div>`:"";
      const markers=trackType==="standard"?markerStacks(slot.markerTokens):"";
      const slotNumber=index<10?`<span class="display-slot-number ${mobNumberClass(index+1)}">${index+1}</span>`:"";
      return `<div class="display-mob-slot ${trackType} ${index>=10?"display-extra-slot ":""}${occupied?"occupied":filler?"feature":"empty"} ${slot.revealed?"revealed":"hidden"} ${card&&slot.id===battle.activeBP?"active":""} ${slot.decoy?"decoy":""}" data-track-index="${index}">${slotNumber}${cardContent||'<strong class="display-empty-slot">空位</strong>'}<div class="display-bp-markers">${markers}</div>${activations}${slot.decoy?'<b class="display-decoy">诱匿</b>':""}</div>`;
    }).join("");
    return {html:`<section class="display-mob-track-block ${noMobTrack?"no-mob-track":""}" aria-label="杂兵 BP 轨"><div class="display-mob-track" data-track-slot-count="${slotCount}">${slots}</div></section>`,used};
  }
  function applyBoardCrop(board) {
    const crop = board?.crop || {};
    const imageWidth = Number(board?.width), imageHeight = Number(board?.height);
    const cropX = Number(crop.x), cropY = Number(crop.y), cropWidth = Number(crop.width), cropHeight = Number(crop.height);
    if (![imageWidth,imageHeight,cropX,cropY,cropWidth,cropHeight].every(Number.isFinite) || cropWidth <= 0 || cropHeight <= 0) return;
    root.style.setProperty("--board-image-width", `${imageWidth/cropWidth*100}%`);
    root.style.setProperty("--board-image-height", `${imageHeight/cropHeight*100}%`);
    root.style.setProperty("--board-image-left", `${-cropX/cropWidth*100}%`);
    root.style.setProperty("--board-image-top", `${-cropY/cropHeight*100}%`);
  }
  function applyConflictSidebarLayout(rotation, boardVisible, compactBoard = false) {
    const side = root.querySelector(".conflict-side");
    const content = side?.querySelector(".conflict-side-content");
    if (!side || !content) return;
    const rawRotation = ((Number(rotation) % 360) + 360) % 360;
    const normalized = [0, 90, 180, 270].includes(rawRotation) ? rawRotation : 90;
    const effectiveRotation = boardVisible === false ? 0 : normalized;
    const quarterTurn = effectiveRotation === 90 || effectiveRotation === 270;
    const mirror = boardVisible === false;
    const showcase = !mirror;
    const sideWidth = Math.max(1, side.clientWidth);
    const sideHeight = Math.max(1, side.clientHeight);
    // The content box is laid out in its own (pre-rotation) coordinate space
    // and then rotated onto the physical sidebar. A quarter turn swaps the
    // visual axes, so the logical canvas the cards live in is the sidebar with
    // width and height exchanged. Every decision below uses this logical
    // canvas, never the post-rotation painted rect — mixing the two is what
    // used to push the big card past the clip edge and hide part of it.
    const logicalWidth = quarterTurn ? sideHeight : sideWidth;
    const logicalHeight = quarterTurn ? sideWidth : sideHeight;
    content.style.setProperty("--sidebar-content-width", `${logicalWidth}px`);
    content.style.setProperty("--sidebar-content-height", `${logicalHeight}px`);
    content.style.setProperty("--sidebar-rotation", `${-effectiveRotation}deg`);
    content.classList.toggle("quarter-turn", showcase);
    content.classList.toggle("aibp-mirror", mirror);
    content.classList.toggle("compact-board", Boolean(compactBoard && showcase));
    content.dataset.layout = showcase ? "quarter-turn" : "standard";
    const primary = content.querySelector(".conflict-side-primary");
    const group = primary?.querySelector(".conflict-board-card-group");
    const boss = group?.querySelector(".boss-sheet-block");
    const mob = group?.querySelector(".display-mob-track-block");
    if (showcase) {
      // Drop any inline geometry left by older transform-based builds so the
      // pure-CSS container-query fit is never fighting a stale scale().
      content.style.removeProperty("--mirror-primary-width");
      content.style.removeProperty("--quarter-primary-width");
      content.style.removeProperty("--mirror-mob-card-height");
      if (group) {
        group.style.removeProperty("transform");
        group.style.removeProperty("height");
        group.style.removeProperty("--card-group-scale");
      }
      if (primary && group && boss && mob) {
        // The hero group is a flex column: boss sheet, a gap, then the BP
        // rail. Both blocks share the group's width and keep a fixed aspect
        // ratio, so the *gapless* aspect width/(bossH+mobH) is width-invariant.
        // Measure it at a fixed probe width rather than the live width: the
        // live width comes from a container-query formula that itself depends
        // on --hero-aspect, and on the first passes those units resolve to ~0,
        // which would lock the aspect at its floor. Probing at a constant width
        // (with max-width lifted) breaks that circular dependency. The gap is
        // applied separately in CSS via --hero-gap, so it is kept out of the
        // ratio (folding it in would make the ratio width-dependent again).
        const gap = parseFloat(getComputedStyle(group).rowGap) || 0;
        const prevWidth = group.style.width;
        const prevMaxWidth = group.style.maxWidth;
        group.style.maxWidth = "none";
        group.style.width = "1000px";
        void group.offsetWidth; // force reflow at the probe width
        const blocksHeight = Math.max(1, boss.offsetHeight + mob.offsetHeight);
        const heroAspect = Math.max(0.2, boss.offsetWidth / blocksHeight);
        if (prevWidth) group.style.width = prevWidth; else group.style.removeProperty("width");
        if (prevMaxWidth) group.style.maxWidth = prevMaxWidth; else group.style.removeProperty("max-width");
        content.style.setProperty("--hero-aspect", heroAspect.toFixed(4));
        content.style.setProperty("--hero-gap", `${gap}px`);
        // Side-by-side only when the logical canvas is clearly wider than the
        // hero itself, so the resolving rail gets real room; otherwise stack.
        const logicalAspect = logicalWidth / logicalHeight;
        const layoutMode = logicalAspect >= heroAspect * 1.3 ? "side" : "stack";
        content.classList.remove("layout-popup");
        content.classList.toggle("layout-side", layoutMode === "side");
        content.classList.toggle("layout-stack", layoutMode === "stack");
        content.dataset.cardLayout = layoutMode;
      }
      return;
    }
    // Board-hidden AI/BP mirror: never rotated, so the logical canvas equals
    // the painted rect. Size the primary grid column from the untransformed
    // group height and let CSS lay the rest out; no scale() transform.
    content.style.removeProperty("--quarter-primary-width");
    if (group) {
      group.style.removeProperty("transform");
      group.style.removeProperty("height");
      group.style.removeProperty("--card-group-scale");
    }
    const mobCard = mob?.querySelector(".display-mob-slot");
    if (mobCard) content.style.setProperty("--mirror-mob-card-height", `${mobCard.offsetHeight}px`);
    const fixedRows = [
      primary?.querySelector(".conflict-hero-clues"),
      primary?.querySelector(".conflict-mirror-primary-cards"),
    ].filter(Boolean);
    content.classList.remove("layout-popup");
    if (primary && boss && mob) {
      // The board-hidden mirror is never rotated, so the logical canvas is the
      // painted content box. A canvas clearly wider than the hero sits the
      // resolving cards beside it; otherwise stack them underneath.
      const layoutMode = logicalWidth / logicalHeight >= 1.43 ? "side" : "stack";
      content.classList.toggle("layout-side", layoutMode === "side");
      content.classList.toggle("layout-stack", layoutMode === "stack");
      content.dataset.cardLayout = layoutMode;
      const canvasWidth = Math.max(1, content.clientWidth);
      const canvasHeight = Math.max(1, content.clientHeight);
      const rowGap = parseFloat(getComputedStyle(primary).rowGap) || 0;
      const scalableHeight = Math.max(1, boss.offsetHeight + mob.offsetHeight);
      const fixedHeight = fixedRows.reduce((sum, row) => sum + row.offsetHeight, 0);
      const gapHeight = rowGap * (1 + fixedRows.length);
      const contentGap = parseFloat(getComputedStyle(content).columnGap) || 0;
      const targetWidth = canvasWidth * Math.max(1, canvasHeight - fixedHeight - gapHeight) / scalableHeight;
      const maxWidth = Math.max(1, canvasWidth - contentGap);
      content.style.setProperty("--mirror-primary-width", `${Math.min(targetWidth, maxWidth)}px`);
    }
  }

  function conflictGridCellRef(index) {
    const row = Math.floor(index / 14) + 1;
    const column = index % 14 + 1;
    return `${String.fromCharCode(75 - row)}${column}`;
  }

  function conflictOverlayMarkerHtml(marker) {
    if (!marker) return "";
    const column = Math.max(1, Number(marker.column) || 1);
    const row = Math.max(1, Number(marker.row) || 1);
    const width = Math.max(1, Number(marker.width) || 1);
    const height = Math.max(1, Number(marker.height) || 1);
    const classes = ["kf-ov-marker", marker.className, marker.facing != null ? `kf-ov-marker-facing-${marker.facing}` : ""].filter(Boolean).join(" ");
    const left = (column - 1) / 14 * 100;
    const top = (row - 1) / 10 * 100;
    const markerWidth = width / 14 * 100;
    const markerHeight = height / 10 * 100;
    const style = `left:${left}%;top:${top}%;width:${markerWidth}%;height:${markerHeight}%;`;
    return `<i class="${classes}" style="${style}" aria-hidden="true"></i>`;
  }

  function conflictOverlayMarkersHtml(overlay) {
    if (!overlay?.active) return "";
    const markers = [];
    if (overlay.source) {
      markers.push({
        className: "kf-ov-marker-source",
        column: overlay.source.columnStart,
        row: overlay.source.rowStart,
        width: overlay.source.columnEnd - overlay.source.columnStart + 1,
        height: overlay.source.rowEnd - overlay.source.rowStart + 1,
      });
    }
    if (overlay.target) markers.push({ className: "kf-ov-marker-target", column: overlay.target.column, row: overlay.target.row, width: 1, height: 1 });
    (overlay.movement?.rules || []).forEach((path, index) => {
      markers.push({
        className: index === 0 ? "kf-ov-marker-final-a" : "kf-ov-marker-final-b",
        column: path.finalOrigin.column,
        row: path.finalOrigin.row,
        width: overlay.footprint?.width || 1,
        height: overlay.footprint?.height || 1,
        facing: path.facing,
      });
    });
    return markers.length ? `<div class="kf-ov-marker-layer">${markers.map(conflictOverlayMarkerHtml).join("")}</div>` : "";
  }

  function conflictGridHtml(boardState, overlay = null) {
    const foolCards = window.KF_CONFLICT_BOARD_DATA?.foolDeck?.cards || [];
    const activeCard = foolCards.find(card => card.cardId === Number(boardState?.activeFoolCardId));
    const activeSpaces = new Set(activeCard?.spaces || []);
    const cells = Array.from({length:140},(_,index)=>{
      const ref=conflictGridCellRef(index),highlighted=activeSpaces.has(ref);
      // 与主屏同一套 kf-ov-* 类名；网格是 row-major、14 列 10 行。
      const row=Math.floor(index/14)+1,column=index%14+1;
      const distance=overlay?.active?overlay.distanceAt(column,row):null;
      const label=distance!=null?`<b class="kf-ov-distance">${distance}</b>`:(boardState?.showCoordinates?`<b>${ref}</b>`:"");
      const classes=[highlighted?"fool-highlight":"",...(overlay?.active?overlay.classesAt(column,row):[])].filter(Boolean).join(" ");
      return `<span class="${classes}"${highlighted?` aria-label="愚者牌格位 ${ref}"`:""}>${label}</span>`;
    }).join("");
    return cells;
  }

  function renderConflict(payload) {
    const module = payload.modules?.aibp;
    // PHP returns the sanitized AIBP battle directly under `battle`, while
    // the Android local API may still expose the synchronized module wrapper.
    // Accept both shapes so the second screen never falls back to an empty
    // conflict just because the transport differs.
    const battle = module?.battle?.monsterId ? module.battle : module;
    if (!battle?.monsterId) return stateView("冲突尚未建立", "在主屏建立 AI / BP 后会自动显示。", "CL");
    const monster = window.KF_MONSTER_DATA?.monsters?.find(item => item.id === battle.monsterId);
    const boardState = battle.conflictBoard;
    const belly = isBellyConflict(battle);
    const layout = belly
      ? bellyLayout(monster)
      : window.KF_CONFLICT_BOARD_DATA?.layouts?.find(item => item.id === boardState?.layoutId);
    if (!layout) return stateView("高清冲突布局缺失", "当前怪物没有可用的 TTS 布置数据。", "!");
    const assignment = new Map((boardState.mobAssignments || []).map(item => [item.placementId,item.number]));
    const knightAssignment = new Map((boardState.knightAssignments || []).map(item => [item.placementId,item]));
    const terrain = Array.isArray(boardState.terrain)
      ? boardState.terrain.map(item => ({...item,kind:"terrain"}))
      : layout.placements.filter(item => item.kind === "terrain");
    const terrainCards = terrainCardsFor(terrain);
    const fixed = layout.placements.filter(item => item.kind !== "terrain")
      .filter(item => boardState.showStarts !== false || !(["knight","monster","number"].includes(item.kind) || ["LictorDecoy","Armor"].includes(item.asset)));
    const placements = [...terrain,...fixed].map(item => {
      let left=(item.columnStart-1)/14*100,top=(item.rowStart-1)/10*100,width=(item.columnEnd-item.columnStart+1)/14*100,height=(item.rowEnd-item.rowStart+1)/10*100;
      const rotation = item.kind === "terrain" ? item.rotation ?? 0 : boardState.resolvedOrientations?.[item.id] ?? item.rotation ?? 0;
      const source = window.KF_CONFLICT_BOARD_DATA?.assets?.[item.asset];
      let content;
      let placementTransform="";
      if (source && item.kind === "terrain") {
        const rowSpan=item.rowEnd-item.rowStart+1,colSpan=item.columnEnd-item.columnStart+1,quarterTurn=Math.abs(rotation%180)===90;
        const artRows=quarterTurn?colSpan:rowSpan,artColumns=quarterTurn?rowSpan:colSpan;
        left=(((item.columnStart+item.columnEnd)/2)-.5)/14*100;
        top=(((item.rowStart+item.rowEnd)/2)-.5)/10*100;
        width=artColumns/14*100;height=artRows/10*100;
        placementTransform=`transform:translate(-50%,-50%) rotate(${rotation}deg);`;
        content=`<img class="terrain-art" src="${esc(displayAsset(source))}" alt="${esc(item.asset)}" style="left:0;top:0;width:100%;height:100%;transform:scaleX(${item.flipped?-1:1})">`;
      } else if (source && ["special","number"].includes(item.kind)) {
        const swapped=Math.abs(rotation%180)===90, rowSpan=item.rowEnd-item.rowStart+1, colSpan=item.columnEnd-item.columnStart+1;
        content=`<img class="terrain-art" src="${esc(displayAsset(source))}" alt="${esc(item.asset)}" style="width:${swapped?rowSpan/colSpan*100:100}%;height:${swapped?colSpan/rowSpan*100:100}%;transform:translate(-50%,-50%) rotate(${rotation}deg) scaleX(${item.flipped?-1:1})">`;
      } else if (item.kind === "knight" && knightAssignment.has(item.id)) {
        const knight = knightAssignment.get(item.id);
        content=`<span class="board-marker knight" aria-label="${esc(knight.name)}" title="${esc(knight.name)}"><img class="knight-avatar" src="/assets/heroes/${esc(knight.heroId)}-avatar.jpg" alt=""><span class="marker-arrow ${facingClass(rotation)}" aria-hidden="true">▲</span></span>`;
      } else {
        const label=belly && item.kind === "monster" ? (monster?.name || "附着怪物") : item.kind==="knight"?"骑士":item.kind==="number"?item.asset.replace("Number",""):item.asset.replace(/([a-z])([A-Z])/g,"$1 $2");
        content=`<span class="board-marker ${item.kind}"><span class="marker-arrow ${facingClass(rotation)}" aria-hidden="true">▲</span>${esc(label)}${assignment.has(item.id)?`<span class="marker-number ${mobNumberClass(assignment.get(item.id))}">${assignment.get(item.id)}</span>`:""}</span>`;
      }
      return `<span class="conflict-placement" data-placement="${esc(item.id)}" data-kind="${esc(item.kind)}" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%;${placementTransform}--layer:${item.layer}">${content}</span>`;
    }).join("");
    // 叠加层设置随 conflictBoard 一起从主屏同步过来，第二屏只负责画。
    const overlay=window.KF_OVERLAY?.computeOverlay(boardState,layout.placements||[])||null;
    const grid=conflictGridHtml(boardState,overlay);
    const settings=payload.presentation?.settings || {}, scale=clamp(settings.conflictScale || 100,50,200), boardVisible=settings.conflictBoardVisible!==false;
    const rawRotation=((Number(settings.conflictRotation)%360)+360)%360;
    const rotation=[0,90,180,270].includes(rawRotation)?rawRotation:90;
    // “正在结算” follows the main branch: only the card currently drawn
    // from the AI or BP deck is shown here.
    const activeCards=[publicCard(monster,battle.activeAI,"当前 AI","face","active-ai-card"),publicCard(monster,battle.activeBP,"当前 BP","face","active-bp-card")].filter(Boolean).join("");
    const kingdomTrait=layout.kingdom==="stone"?"Trait_POS":"Trait_SK";
    const referenceLabel=card=>card.kind==="BPX"?"BPX":"特质";
    const signatureCard=(monster?.cards||[]).find(card=>card.kind==="SIG");
    const tacticIds=new Set([
      "M_FirstmenLictor:Trait:37","M_FirstmenLictor:Trait:38","M_FirstmenLictor:Trait:39",
      "M_FirstmenLictor:Trait:40","M_FirstmenLictor:Trait:41","M_FirstmenLictor:Trait:42",
      "M_FirstmenWarriors:Trait:37","M_FirstmenWarriors:Trait:38","M_FirstmenWarriors:Trait:39",
    ]);
    const isTacticCard=card=>tacticIds.has(card.id)||/战术|tactic/i.test(card.name||"");
    const references=(monster?.cards||[]).filter(card=>["Trait",kingdomTrait,"BPX"].includes(card.kind)&&!isTacticCard(card));
    // battle.mobTacticCard is the authoritative pointer to the currently
    // selected tactic.  Do not re-classify it by name/id here: newly added
    // tactic cards may not yet be covered by the local classifier.
    const tacticCard=cardById(monster,battle.mobTacticCard);
    const featureEntries=[
      tacticCard?{card:tacticCard,label:"战术"}:null,
      signatureCard?{card:signatureCard,label:"惯常",side:"face",key:`${signatureCard.id}:routine`}:null,
      ...references.map(card=>({card,label:referenceLabel(card)})),
      signatureCard?{card:signatureCard,label:"标志",side:"back",key:`${signatureCard.id}:signature`}:null,
    ].filter(Boolean);
    const trackFillers=boardVisible?[...terrainCards.map(card=>({terrainCard:card,label:"地形"})),...featureEntries]:featureEntries;
    const mobTrack=publicMobTrack(monster,battle,trackFillers);
    const usedFeatures=boardVisible?Math.max(0,mobTrack.used-terrainCards.length):mobTrack.used;
    const remainingFeatures=featureEntries.slice(usedFeatures);
    const featureCards=remainingFeatures.map(publicFeatureCard).join("");
    const partyAttributes=conflictPartyAttributes(payload);
    // Board-visible showcase groups the party attributes with the AI/BP order +
    // damage inside the resolving summary. Board-hidden mirror keeps its own
    // conflictHeroClues row in the primary, so it does not repeat them here.
    const resolvingSummary=publicDeckSummary(battle, boardVisible?partyAttributes:"");
    const resolvingSection=`<section class="conflict-card-block conflict-resolving-block"><div class="conflict-block-title"><span>RESOLVING</span><strong>正在结算的卡牌</strong></div><div class="public-card-row active-public-cards">${activeCards||'<p class="conflict-empty-state">当前没有正在结算的卡牌</p>'}</div>${resolvingSummary}</section>`;
    const featureSection=featureCards?`<section class="conflict-card-block conflict-feature-block" aria-label="战术与公开特质"><div class="public-card-row feature-card-row">${featureCards}</div></section>`:"";
    const mirrorTerrainCards=boardVisible?"":terrainCards.map(card=>`<figure class="conflict-terrain-card" aria-label="${esc(card.label)}" title="${esc(card.label)}">${terrainCardFace(card)}</figure>`).join("");
    const mirrorPrimaryCards=mirrorTerrainCards||featureCards?`<section class="conflict-mirror-primary-cards" aria-label="地形、特性与战术卡"><div class="conflict-mirror-primary-row">${mirrorTerrainCards}${featureCards}</div></section>`:"";
    const heroClues=conflictHeroClues(payload.modules?.map);
    const primaryFollowup=boardVisible
      ? featureSection
      : `${heroClues}${featureSection}${mirrorPrimaryCards}`;
    // Keep the big card and minion track in one scalable group in both board
    // and board-hidden (second-screen-only) modes.
    const boardCardGroup=`<div class="conflict-board-card-group">${bossSheetHtml(monster,battle)}${mobTrack.html}</div>`;
    // Board-visible showcase: the hero group is fitted inside its own container
    // so the container-query sizing measures the reserved space. Party
    // attributes now live in the resolving summary, so the hero cell reclaims
    // the full idle area. Board-hidden mirror keeps its original flat structure.
    const primaryInner=boardVisible
      ? `<div class="conflict-hero-fit">${boardCardGroup}</div>${featureSection}`
      : `${boardCardGroup}${primaryFollowup}`;
    const boardDefinition = belly ? BELLY_BOARD.board : window.KF_CONFLICT_BOARD_DATA.board;
    applyBoardCrop(boardDefinition);
    const digestiveTrack = boardState.digestiveTrack || {};
    const digestiveMax = Math.max(1, Number(BELLY_BOARD.digestiveTrack?.max) || 4);
    const digestivePosition = Math.min(digestiveMax, Math.max(1, Number(digestiveTrack.position) || 1));
    const digestiveMarkup = belly
      ? `<div class="display-digestive-track" aria-label="消化轨"><span>消化轨</span><span class="display-digestive-track-steps">${Array.from({ length: digestiveMax }, (_, index) => `<i class="${index + 1 === digestivePosition ? "active" : ""}">${index + 1}</i>`).join("")}</span><b>${digestivePosition} / ${digestiveMax}</b></div>`
      : "";
    const digestiveMarkerMarkup = belly
      ? `<div class="display-digestive-marker" aria-label="消化轨通用标记位置 ${digestivePosition}" style="left:91.1%;top:${DIGESTIVE_TRACK_POSITIONS[digestivePosition - 1]}%"><img src="/assets/tokens/generic.png" alt="通用标记"></div>`
      : "";
    const boardAlign=["top","center","bottom"].includes(settings.conflictBoardAlign)?settings.conflictBoardAlign:"center";
    const sceneClass=`conflict-scene ${settings.conflictSwapped?"swapped":""} ${boardVisible?"":"board-hidden"} board-align-${boardAlign}`;
    root.innerHTML=`<section class="${sceneClass}" style="--board-scale:${scale/100}">
      <div class="conflict-board-area"><div class="conflict-board-shell" style="--board-scale:${scale/100}"><div class="conflict-board"><img class="conflict-board-source" src="${esc(displayAsset(boardDefinition.asset))}" alt="${belly ? "巨兽之腹版图" : "TTS 高清冲突版图"}"><div class="conflict-grid">${grid}</div>${conflictOverlayMarkersHtml(overlay)}${placements}${digestiveMarkerMarkup}${digestiveMarkup}</div></div></div>
      <aside class="conflict-side"><div class="conflict-side-content"><header class="conflict-side-head"><div><p class="side-subtitle">CLASH · ${esc(kingdomLabel(layout.kingdom))}</p><h2 class="side-title">${esc(monster?.name || battle.monsterId)}</h2></div><dl class="conflict-quick-facts"><div><dt>等级</dt><dd>${esc(battle.level)}</dd></div><div><dt>AI</dt><dd>${esc(battle.aiDeckCount||0)}</dd></div><div><dt>BP</dt><dd>${esc(battle.bpDeckCount||0)}</dd></div><div><dt>损伤</dt><dd>${esc((battle.singleWounds||0)+(battle.doubleWounds||0)*2)}</dd></div></dl></header>
        <div class="conflict-side-primary">${primaryInner}</div>
        <div class="conflict-side-secondary">
          ${resolvingSection}
          <div class="conflict-landscape-extras">
            ${!boardVisible&&terrainCards.length?`<section class="conflict-terrain-card-block"><div class="conflict-block-title"><span>TERRAIN</span><strong>当前地形卡 · ${terrainCards.length} 张</strong></div><div class="conflict-terrain-card-list">${terrainCards.map(card=>`<figure class="conflict-terrain-card">${terrainCardFace(card)}<figcaption>${esc(card.label)}</figcaption></figure>`).join("")}</div></section>`:""}
            <section class="conflict-status-block"><dl class="fact-list"><dt>冲突阶段</dt><dd>${esc(battle.clashPhase==="preliminary"?"初步冲突":"完全冲突")}</dd><dt>状态</dt><dd class="${battle.conflictStatus==="failed"?"failure":""}">${esc(battle.conflictStatus==="failed"?"失败":"进行中")}</dd><dt>地点</dt><dd>${esc(battle.conflictLocation||"标准冲突")}</dd><dt>晋升</dt><dd>${esc(battle.ruleState?.promotionLevel??0)}</dd><dt>AI 弃牌 / 移除</dt><dd>${esc(battle.aiDiscard?.length||0)} / ${esc(battle.aiRemoved?.length||0)}</dd><dt>BP 弃牌 / 损伤</dt><dd>${esc(battle.bpDiscard?.length||0)} / ${esc(battle.bpDamage?.length||0)}</dd></dl>${battle.failureReason?`<p class="failure conflict-failure">${esc(battle.failureReason)}</p>`:""}</section>
          </div>
        </div>
      </div></aside></section>`;
    applyConflictSidebarLayout(rotation,boardVisible);
    requestAnimationFrame(()=>applyConflictSidebarLayout(rotation,boardVisible));
  }

  function render(payload) {
    lastPayload = payload;
    const scene = payload.presentation?.scene || "map";
    renderHeader(payload, scene);
    if (scene === "rogue") renderRogue(payload);
    else if (scene === "encounter") renderEncounter(payload);
    else if (scene === "conflict") renderConflict(payload);
    else renderMap(payload);
  }

  async function poll(force = false) {
    if (!activeCampaign) { setConnection("未选择战役","stale"); stateView("未选择战役", "请先在主界面选择战役，再打开第二屏。"); return; }
    try {
      const headers = !force && etag ? { "If-None-Match": etag } : {};
      const response = await fetch(`/api.php?route=display-state&campaignId=${encodeURIComponent(activeCampaign)}`, { credentials:"same-origin", headers, cache:"no-store" });
      if (response.status === 401) { setConnection("未登录","stale"); stateView("需要登录", "第二屏必须登录与主屏相同的账号。"); return; }
      if (response.status === 304) { lastSuccess=Date.now(); setConnection("已同步","live"); return; }
      const data = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(data.error || "同步失败");
      etag=response.headers.get("ETag")||"";lastSuccess=Date.now();setConnection("已同步","live");render(data);
    } catch(error) {
      setConnection(navigator.onLine?"同步中断":"离线","stale");
      if(!lastPayload)stateView("无法读取战役",error.message,"!");
    }
  }

  const channel = "BroadcastChannel" in window ? new BroadcastChannel("kf-presentation") : null;
  channel?.addEventListener("message", event => { if(event.data?.campaignId===activeCampaign)poll(true); });
  addEventListener("online",()=>poll(true));
  addEventListener("resize",()=>{
    if(lastPayload?.presentation?.scene!=="conflict")return;
    const settings=lastPayload.presentation?.settings||{};
    const scale=clamp(settings.conflictScale||100,50,200);
    const boardVisible=settings.conflictBoardVisible!==false;
    applyConflictSidebarLayout(settings.conflictRotation,boardVisible,boardVisible&&scale<=80);
  });
  setInterval(()=>{poll();if(lastSuccess&&Date.now()-lastSuccess>4000)setConnection("同步过期","stale");},1000);
  poll(true);
})();
