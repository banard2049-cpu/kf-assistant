(() => {
  "use strict";
  const root = document.querySelector("#displayRoot");
  const displayHeader = document.querySelector("#displayHeader");
  const connectionText = document.querySelector("#connectionText");
  const connectionDot = document.querySelector("#connectionDot");
  const activeCampaign = localStorage.getItem("kfActiveCampaign") || "";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const cardinalFacing = value => {
    const normalized = ((Number(value) || 0) % 360 + 360) % 360;
    return Math.round(normalized / 90) % 4 * 90;
  };
  const facingClass = value => `facing-${cardinalFacing(value)}`;
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
      assetBase: "/modules/map/",
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
    return `/modules/map/${value}`;
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
        const markup = window.KFMapView.renderExplorationCard({ state, data:window.KF_MOD_DATA, card, side:"face", assetBase:"/modules/map/" });
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
      assetBase: "/modules/map/",
      interactive: false
    });
    if (!mapStage) return stateView("探索地图为空", "主屏放置地图板块后会自动显示。", "MAP");
    const kingdomBoard = window.KFMapView.renderKingdomBoard({ state, data: window.KF_MOD_DATA, assetBase: "/modules/map/" });
    const districtEffects = window.KFMapView.renderDistrictExplorationCards({ state, data: window.KF_MOD_DATA, assetBase: "/modules/map/" });
    const clueTracking = window.KFMapView.renderClueTracking({ state, assetBase: "/modules/map/" });
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
      assetBase: "/modules/encounter/",
      interactive: false
    });
    if (!board) return stateView("遭遇版图资源缺失", "请重新运行资源导入或检查部署文件。", "!");
    const encounterCard = window.KFEncounterView.renderCard(level, level?.side || "face", "/modules/encounter/");
    const phaseLabels = {setup:"设置",position:"放置",monster:"怪物轮",knight:"骑士轮",resolution:"结算"};
    root.innerHTML = `<section class="encounter-scene"><div class="encounter-board-area">${board}</div><aside class="map-side encounter-side"><p class="side-subtitle">ENCOUNTER</p><h2 class="side-title">${esc(monster?.name || state.monsterId)}</h2>${encounterCard}<dl class="fact-list"><dt>等级</dt><dd>${esc(state.level)}</dd><dt>类型</dt><dd>${esc(state.encounterType === "ambush" ? "伏击" : state.encounterType === "special" ? "特殊" : "普通")}</dd><dt>阶段</dt><dd>${esc(phaseLabels[state.phase] || state.phase)}</dd><dt>怪物</dt><dd>${esc(state.monsters?.length || 0)}</dd><dt>队伍</dt><dd>${esc(state.knights?.length || 0)}</dd><dt>机会</dt><dd>${esc(state.pool?.opportunity || 0)}</dd><dt>破甲</dt><dd>${esc(state.pool?.break || 0)}</dd><dt>擦伤</dt><dd>${esc(state.scrapes || 0)}</dd></dl></aside></section>`;
  }

  function displayAsset(value) { return value ? `/modules/display/${String(value).replace(/^\/+/, "")}` : ""; }
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
  function aibpAsset(value) { return value ? `/modules/aibp/${String(value).replace(/^\/+/, "")}` : ""; }
  function cardById(monster, id) { return monster?.cards?.find(card => card.id === id); }
  function cardArt(card, side = "face") {
    if (!card?.image?.face) return "";
    const image = card.image, cols = Math.max(1,Number(image.width)||1), rows = Math.max(1,Number(image.height)||1), index = Math.max(0,Number(image.index)||0);
    const x = cols > 1 ? (index%cols)/(cols-1)*100 : 0, y = rows > 1 ? Math.floor(index/cols)/(rows-1)*100 : 0;
    return `--card-aspect:${Number(image.aspect)||.7};background-image:url('${aibpAsset(image[side]||image.face)}');background-size:${cols*100}% ${rows*100}%;background-position:${x}% ${y}%`;
  }
  function publicCard(monster,id,label,side="face",className="") { const card=cardById(monster,id); return card ? `<figure class="public-card ${esc(className)}" data-public-card="${esc(id)}"><div class="public-card-art" style="${cardArt(card,side)}"></div><figcaption>${esc(label)} · ${esc(card.name)}</figcaption></figure>` : ""; }
  function publicFeatureCard(entry) {
    return entry?.card ? `<figure class="public-card feature-card" data-public-card="${esc(entry.card.id)}" aria-label="${esc(entry.label)} · ${esc(entry.card.name)}" title="${esc(entry.card.name)}"><div class="public-card-art" style="${cardArt(entry.card)}"></div></figure>` : "";
  }
  function publicDeckLevelText(levels) {
    const normalized=(Array.isArray(levels)?levels:[]).map(Number).filter(level=>Number.isInteger(level)&&level>=0&&level<=3);
    return normalized.length?normalized.join(" → "):"空";
  }
  function publicDeckSummary(battle) {
    const single=clamp(battle.singleWounds||0,0,99),double=clamp(battle.doubleWounds||0,0,99),total=single+double*2;
    return `<div class="conflict-resolving-summary" aria-label="AI、BP 等级顺序和损伤量"><p><b>AI 顺序</b><span>${esc(publicDeckLevelText(battle.aiDeckLevels))}</span></p><p><b>BP 顺序</b><span>${esc(publicDeckLevelText(battle.bpDeckLevels))}</span></p><p class="resolving-damage"><b>损伤</b><span>${esc(total)} <small>单伤 ${esc(single)} · 双伤 ${esc(double)} · BP 损伤牌 ${esc(battle.bpDamage?.length||0)}</small></span></p></div>`;
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
  function tokenSrc(id) { return TOKEN_FILES[id] ? `/modules/aibp/assets/tokens/${TOKEN_FILES[id]}` : ""; }
  function publicTokenStacks(tokens) {
    return (tokens || []).map(token => {
      const src=tokenSrc(token.assetId); if(!src)return "";
      return `<span class="boss-sheet-token" style="left:${clamp(token.x,0,100)}%;top:${clamp(token.y,0,100)}%"><img src="${esc(src)}" alt=""><b>×${clamp(token.count||1,1,20)}</b></span>`;
    }).join("");
  }
  function bossSheetHtml(monster,battle) {
    if(!monster?.sheet?.face&&!monster?.sheet?.back)return "";
    return `<section class="boss-sheet-block" aria-label="Boss 大卡"><div class="boss-sheet-stage"><div class="boss-sheet-spread">${monster.sheet.face?`<img src="${esc(aibpAsset(monster.sheet.face))}" alt="${esc(monster.name)} 怪物面板正面">`:""}${monster.sheet.back?`<img src="${esc(aibpAsset(monster.sheet.back))}" alt="${esc(monster.name)} 怪物面板背面">`:""}</div><div class="boss-sheet-token-layer">${publicTokenStacks(battle.sheetTokens)}</div></div></section>`;
  }
  function markerStacks(markerTokens) {
    return Object.entries(markerTokens||{}).map(([assetId,count])=>{const src=tokenSrc(assetId);return src&&count?`<span class="display-bp-marker"><img src="${esc(src)}" alt=""><b>×${clamp(count,1,20)}</b></span>`:""}).join("");
  }
  function publicMobTrack(monster,battle,fillers=[]) {
    const standardSlots=Array.isArray(battle?.bpTrack)&&battle.bpTrack.length?battle.bpTrack:null;
    const bossTrack=!standardSlots&&["doppelganger","guardian"].includes(battle?.bossMobTrack?.type)?battle.bossMobTrack:null;
    if(!standardSlots&&!bossTrack)return {html:"",used:0};
    const trackType=standardSlots?"standard":bossTrack.type;
    const sourceSlots=standardSlots||bossTrack.slots||[];
    const backCard=monster.cards.find(card=>/^BP[123SX]$/.test(card.kind));
    let used=0;
    const slots=Array.from({length:10},(_,index)=>sourceSlots[index]||{id:"",occupied:false,revealed:false,side:"face",markerTokens:{}}).map((slot,index)=>{
      const card=trackType==="standard"&&slot.revealed&&slot.id?cardById(monster,slot.id):null;
      const occupied=slot.occupied===true||Boolean(slot.id);
      const filler=!occupied&&fillers[used]?.card?fillers[used++]:null;
      let cardContent="";
      if(filler)cardContent=`<div class="display-track-card" data-public-feature="${esc(filler.card.id)}" aria-label="${esc(filler.label)} · ${esc(filler.card.name)}" title="${esc(filler.card.name)}" style="${cardArt(filler.card)}"></div>`;
      else if(trackType==="standard"&&card)cardContent=`<div class="display-track-card" data-public-bp="${esc(slot.id)}" style="${cardArt(card,slot.side)}"></div>`;
      else if(trackType==="standard"&&occupied&&backCard)cardContent=`<div class="display-track-card" style="${cardArt(backCard,"back")}"></div>`;
      else if(trackType==="doppelganger"&&occupied){
        const knownCards=slot.revealed?(slot.cardIds||[]).map(id=>cardById(monster,id)).filter(Boolean):[];
        const stackCards=knownCards.length?knownCards:Array.from({length:Math.max(1,Number(slot.cardCount)||1)},()=>backCard).filter(Boolean);
        cardContent=`<div class="display-track-stack">${stackCards.map((stackCard,depth)=>`<div class="display-track-card" style="--stack-depth:${depth};${cardArt(stackCard,knownCards.length?"face":"back")}"></div>`).join("")}</div><b class="display-track-count">×${esc(slot.cardCount||stackCards.length)}</b>`;
      }else if(trackType==="guardian"&&occupied){
        const guardianCard=slot.carrier?cardById(monster,"M_WhiteApe:Trait:38"):null;
        cardContent=guardianCard?`<div class="display-track-card" style="${cardArt(guardianCard)}"></div>`:`<img class="display-guardian-figure" src="/modules/aibp/assets/guardians/firstman-guardian-placeholder.png" alt="先民护卫">`;
      }
      const activations=trackType==="standard"?(battle.mobActivations||[]).filter(token=>token.position===index).map(token=>`<span class="display-activation ${token.used?"used":""} ${token.id===battle.activeMobActivationId?"active":""}">${esc(token.type)}</span>`).join(""):"";
      const markers=trackType==="standard"?markerStacks(slot.markerTokens):"";
      return `<div class="display-mob-slot ${trackType} ${occupied?"occupied":filler?"feature":"empty"} ${slot.revealed?"revealed":"hidden"} ${card&&slot.id===battle.activeBP?"active":""} ${slot.decoy?"decoy":""}" data-track-index="${index}"><span class="display-slot-number">${index+1}</span>${cardContent||'<strong class="display-empty-slot">空位</strong>'}<div class="display-bp-markers">${markers}</div>${activations}${slot.decoy?'<b class="display-decoy">诱匿</b>':""}</div>`;
    }).join("");
    return {html:`<section class="display-mob-track-block" aria-label="杂兵 BP 轨"><div class="display-mob-track" data-track-slot-count="10">${slots}</div></section>`,used};
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
  function applyConflictSidebarLayout(rotation, boardVisible) {
    const side = root.querySelector(".conflict-side");
    const content = side?.querySelector(".conflict-side-content");
    if (!side || !content) return;
    const normalized = Number(rotation) === 270 ? 270 : 90;
    const effectiveRotation = boardVisible === false ? 0 : normalized;
    const quarterTurn = effectiveRotation === 90 || effectiveRotation === 270;
    const sideWidth = Math.max(1, side.clientWidth);
    const sideHeight = Math.max(1, side.clientHeight);
    content.style.setProperty("--sidebar-content-width", `${quarterTurn ? sideHeight : sideWidth}px`);
    content.style.setProperty("--sidebar-content-height", `${quarterTurn ? sideWidth : sideHeight}px`);
    content.style.setProperty("--sidebar-rotation", `${-effectiveRotation}deg`);
    content.style.removeProperty("--mirror-primary-width");
    content.style.removeProperty("--quarter-primary-width");
    content.style.removeProperty("--mirror-mob-card-height");
    content.classList.toggle("quarter-turn", quarterTurn);
    content.classList.toggle("aibp-mirror", boardVisible === false);
    if (quarterTurn || boardVisible === false) {
      const primary=content.querySelector(".conflict-side-primary");
      const boss=primary?.querySelector(".boss-sheet-block");
      const mob=primary?.querySelector(".display-mob-track-block");
      const mobCard=mob?.querySelector(".display-mob-slot");
      if(mobCard)content.style.setProperty("--mirror-mob-card-height",`${mobCard.offsetHeight}px`);
      const fixedRows=boardVisible===false?[primary?.querySelector(".conflict-hero-clues"),primary?.querySelector(".conflict-mirror-primary-cards")].filter(Boolean):[];
      if (primary&&boss&&mob) {
        const primaryWidth=primary.clientWidth;
        const availableHeight=primary.clientHeight;
        const primaryGap=parseFloat(getComputedStyle(primary).rowGap)||0;
        const scalableHeight=boss.offsetHeight+mob.offsetHeight;
        const fixedHeight=fixedRows.reduce((sum,row)=>sum+row.offsetHeight,0);
        const gapHeight=primaryGap*(1+fixedRows.length);
        const contentGap=parseFloat(getComputedStyle(content).columnGap)||0;
        const targetWidth=primaryWidth*Math.max(1,availableHeight-fixedHeight-gapHeight)/Math.max(1,scalableHeight);
        const reservedWidth=boardVisible===false?64:24;
        const maxWidth=Math.max(primaryWidth,content.clientWidth-contentGap-reservedWidth);
        const property=boardVisible===false?"--mirror-primary-width":"--quarter-primary-width";
        content.style.setProperty(property,`${Math.min(targetWidth,maxWidth)}px`);
      }
    }
  }
  function renderConflict(payload) {
    const module = payload.modules?.aibp, battle = module?.battle;
    if (!battle?.monsterId) return stateView("冲突尚未建立", "在主屏建立 AI / BP 后会自动显示。", "CL");
    const monster = window.KF_MONSTER_DATA?.monsters?.find(item => item.id === battle.monsterId);
    const boardState = battle.conflictBoard;
    const layout = window.KF_CONFLICT_BOARD_DATA?.layouts?.find(item => item.id === boardState?.layoutId);
    if (!layout) return stateView("高清冲突布局缺失", "当前怪物没有可用的 TTS 布置数据。", "!");
    const assignment = new Map((boardState.mobAssignments || []).map(item => [item.placementId,item.number]));
    const knightAssignment = new Map((boardState.knightAssignments || []).map(item => [item.placementId,item]));
    const terrain = Array.isArray(boardState.terrain)
      ? boardState.terrain.map(item => ({...item,kind:"terrain"}))
      : layout.placements.filter(item => item.kind === "terrain");
    const terrainCards = terrainCardsFor(terrain);
    const fixed = layout.placements.filter(item => item.kind !== "terrain")
      .filter(item => boardState.showStarts !== false || !(["knight","monster","number"].includes(item.kind) || item.asset === "LictorDecoy"));
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
        const label=item.kind==="knight"?"骑士":item.kind==="number"?item.asset.replace("Number",""):item.asset.replace(/([a-z])([A-Z])/g,"$1 $2");
        content=`<span class="board-marker ${item.kind}"><span class="marker-arrow ${facingClass(rotation)}" aria-hidden="true">▲</span>${esc(label)}${assignment.has(item.id)?`<span class="marker-number">${assignment.get(item.id)}</span>`:""}</span>`;
      }
      return `<span class="conflict-placement" data-placement="${esc(item.id)}" data-kind="${esc(item.kind)}" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%;${placementTransform}--layer:${item.layer}">${content}</span>`;
    }).join("");
    const grid=Array.from({length:140},()=>"<span></span>").join("");
    const settings=payload.presentation?.settings || {}, scale=clamp(settings.conflictScale || 100,50,200), boardVisible=settings.conflictBoardVisible!==false;
    const rotation=Number(settings.conflictRotation)===270?270:90;
    const activeCards=[publicCard(monster,battle.activeAI,"当前 AI","face","active-ai-card"),publicCard(monster,battle.activeBP,"当前 BP","face","active-bp-card")].filter(Boolean).join("");
    const kingdomTrait=layout.kingdom==="stone"?"Trait_POS":"Trait_SK";
    const references=(monster?.cards||[]).filter(card=>card.kind==="Trait"||card.kind===kingdomTrait||card.kind==="BPX");
    const tacticCard=cardById(monster,battle.mobTacticCard);
    const featureEntries=[tacticCard?{card:tacticCard,label:"战术"}:null,...references.map(card=>({card,label:"特质"}))].filter(Boolean);
    const mobTrack=publicMobTrack(monster,battle,featureEntries);
    const remainingFeatures=featureEntries.slice(mobTrack.used);
    const featureCards=remainingFeatures.map(publicFeatureCard).join("");
    const featureSection=featureCards?`<section class="conflict-card-block conflict-feature-block" aria-label="战术与公开特质"><div class="public-card-row feature-card-row">${featureCards}</div></section>`:"";
    const mirrorTerrainCards=boardVisible?"":terrainCards.map(card=>`<figure class="conflict-terrain-card" aria-label="${esc(card.label)}" title="${esc(card.label)}">${terrainCardFace(card)}</figure>`).join("");
    const mirrorPrimaryCards=mirrorTerrainCards||featureCards?`<section class="conflict-mirror-primary-cards" aria-label="地形、特性与战术卡"><div class="conflict-mirror-primary-row">${mirrorTerrainCards}${featureCards}</div></section>`:"";
    const heroClues=conflictHeroClues(payload.modules?.map);
    const resolvingSummary=publicDeckSummary(battle);
    const primaryFollowup=boardVisible
      ? mobTrack.html
      : `${mobTrack.html}${heroClues}${featureSection}${mirrorPrimaryCards}`;
    applyBoardCrop(window.KF_CONFLICT_BOARD_DATA.board);
    const sceneClass=`conflict-scene ${settings.conflictSwapped?"swapped":""} ${boardVisible?"":"board-hidden"}`;
    root.innerHTML=`<section class="${sceneClass}">
      <div class="conflict-board-area"><div class="conflict-board-shell" style="--board-scale:${scale/100}"><div class="conflict-board"><img class="conflict-board-source" src="${esc(displayAsset(window.KF_CONFLICT_BOARD_DATA.board.asset))}" alt="TTS 高清冲突版图"><div class="conflict-grid">${grid}</div>${placements}</div></div></div>
      <aside class="conflict-side"><div class="conflict-side-content"><header class="conflict-side-head"><div><p class="side-subtitle">CLASH · ${esc(kingdomLabel(layout.kingdom))}</p><h2 class="side-title">${esc(monster?.name || battle.monsterId)}</h2></div><dl class="conflict-quick-facts"><div><dt>等级</dt><dd>${esc(battle.level)}</dd></div><div><dt>AI</dt><dd>${esc(battle.aiDeckCount||0)}</dd></div><div><dt>BP</dt><dd>${esc(battle.bpDeckCount||0)}</dd></div><div><dt>损伤</dt><dd>${esc((battle.singleWounds||0)+(battle.doubleWounds||0)*2)}</dd></div></dl></header>
        <div class="conflict-side-primary">${bossSheetHtml(monster,battle)}${primaryFollowup}</div>
        <div class="conflict-side-secondary">
          <section class="conflict-card-block conflict-resolving-block"><div class="conflict-block-title"><span>RESOLVING</span><strong>正在结算的卡牌</strong></div><div class="public-card-row active-public-cards">${activeCards||'<p class="conflict-empty-state">当前没有正在结算的卡牌</p>'}</div>${resolvingSummary}</section>
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
    if (scene === "encounter") renderEncounter(payload);
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
    applyConflictSidebarLayout(settings.conflictRotation,settings.conflictBoardVisible!==false);
  });
  setInterval(()=>{poll();if(lastSuccess&&Date.now()-lastSuccess>4000)setConnection("同步过期","stale");},1000);
  poll(true);
})();
