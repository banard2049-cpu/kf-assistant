(() => {
  "use strict";

  const DATA = window.KF_MONSTER_DATA;
  const LEVELS = window.KF_LEVEL_CONFIG || {};
  const MOB_ACTIVATIONS = window.KF_MOB_ACTIVATIONS || {};
  const BOSS_RULES = window.KF_BOSS_RULE_CONFIG || {};
  const CONFLICT_SETUPS = window.KF_CONFLICT_SETUPS || { standard: [], aftermath: [], monsters: [] };
  const STORAGE_KEY = "kf-aibp-assistant-v1";
  const VERSION = 10;
  const WOUND_PREFIX = "WOUND:";
  const MAX_SHEET_TOKENS_PER_TYPE = 20;
  const MAX_BP_MARKERS = 4;
  const TOKEN_ASSETS = [
    ["token-01", "Generic", "httpssteamusercontentaakamaihdnetugc10792521070177147F375BA9D7F1EF7C2ABAA9D04F55839FA6FC24A94.jpg"],
    ["token-04", "Bane", "httpssteamusercontentaakamaihdnetugc107925210701772985157F1FFBF1B6B3122574EAC077DF071EEAECD0A.jpg"],
    ["token-06", "Charge", "httpssteamusercontentaakamaihdnetugc107925210701773816D94D0D9F92199789B87B059762037FBCDB3002F.jpg"],
    ["token-08", "Fog Gate", "httpssteamusercontentaakamaihdnetugc107925210701773996ECA849F992C7EA67C78D97A03A7992F61BD241B.jpg"],
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
  ].map(([id, name, file, shape = "round"]) => ({ id, name, file, shape, src: `assets/tokens/${file}` }));
  const TOKEN_ASSET_IDS = new Set(TOKEN_ASSETS.map(asset => asset.id));
  const DEFAULT_MOB_MARKER_ASSET_IDS = { M_PalebloodWorms: "token-blood" };
  const MOB_TACTICS = {
    M_FirstmenLictor: {
      basic: [
        "M_FirstmenLictor:Trait:38",
        "M_FirstmenLictor:Trait:39",
        "M_FirstmenLictor:Trait:42"
      ],
      advanced: [
        "M_FirstmenLictor:Trait:37",
        "M_FirstmenLictor:Trait:40",
        "M_FirstmenLictor:Trait:41"
      ]
    },
    M_FirstmenWarriors: {
      basic: [
        "M_FirstmenWarriors:Trait:37",
        "M_FirstmenWarriors:Trait:38",
        "M_FirstmenWarriors:Trait:39"
      ]
    }
  };
  const FIRSTMEN_WARRIOR_COMPANION_CARDS = {
    muscularChest: "M_WhiteApe:BP2:12",
    rampageStrike: "M_WhiteApe:AI2:30"
  };
  const WINGED_NIGHTMARE_ID = "M_WingedNightmare";
  const WINGED_WIDE_WINGS_ID = "M_WingedNightmare:BPS:1";
  const WINGED_BLOODY_DEFIANCE_ID = "M_WingedNightmare:BPX:2";
  const WINGED_BLOODY_DEFIANCE_THRESHOLD = 6;
  const BOG_WITCH_MARKER_SRC = "assets/tokens/bog-witch-encounter.png";
  const BOG_WITCH_POSITIONS = [
    { label: "沼泽", x: 6.95, y: 59.05 },
    { label: "泥地鬼火", x: 13.85, y: 59.05 },
    { label: "腐烂树桩", x: 20.65, y: 59.05 }
  ];
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
  const clone = value => JSON.parse(JSON.stringify(value));
  const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

  function monsterById(id) {
    return DATA.monsters.find(monster => monster.id === id);
  }

  function cardById(monster, id) {
    return monster?.cards.find(card => card.id === id);
  }

  function cardByAnyId(id) {
    for (const monster of DATA.monsters) {
      const card = cardById(monster, id);
      if (card) return card;
    }
    return null;
  }

  function isWarriorCompanionCard(id) {
    return Object.values(FIRSTMEN_WARRIOR_COMPANION_CARDS).includes(id);
  }

  function isMob(monster) {
    return monster?.type === "mob";
  }

  function isWingedNightmare(monster) {
    return monster?.id === WINGED_NIGHTMARE_ID;
  }

  function isWingedFixedBpId(id) {
    return id === WINGED_WIDE_WINGS_ID || id === WINGED_BLOODY_DEFIANCE_ID;
  }

  function ensureWingedAiDiscard(battle = state?.battle) {
    if (!battle || battle.monsterId !== WINGED_NIGHTMARE_ID || battle.aiDiscard.length) return "";
    const index = battle.aiDeck.findIndex(id => id !== battle.activeAI);
    if (index < 0) return "";
    const [id] = battle.aiDeck.splice(index, 1);
    battle.aiDiscard.push(id);
    return id;
  }

  function wingedBloodyDefianceActive(battle = state?.battle) {
    return battle?.monsterId === WINGED_NIGHTMARE_ID
      && battle.level >= 2
      && battle.clashPhase !== "preliminary"
      && Boolean(battle.ruleState?.wingedNightmare?.bloodyDefiance);
  }

  function mobTacticIds(monster, level) {
    const pools = MOB_TACTICS[monster?.id];
    if (!pools) return [];
    const tier = pools.advanced && Number(level) >= 3 ? "advanced" : "basic";
    return (pools[tier] || []).filter(id => cardById(monster, id));
  }

  function allMobTacticIds(monster) {
    const pools = MOB_TACTICS[monster?.id];
    return pools ? [...(pools.basic || []), ...(pools.advanced || [])] : [];
  }

  function randomMobTactic(monster, level) {
    const tactics = mobTacticIds(monster, level);
    return tactics.length ? tactics[Math.floor(Math.random() * tactics.length)] : "";
  }

  function suggestedClashPhase() {
    return window.KF_CLASH_PHASE === "preliminary" ? "preliminary" : "full";
  }

  function mobConflictSetup(monster) {
    return CONFLICT_SETUPS.monsters.find(item => item.id === monster?.id) || null;
  }

  function mobSetupResult(monster) {
    const setup = mobConflictSetup(monster);
    const fail = message => ({ setup, counts: {}, fixedCards: [], total: 0, error: message });
    if (!setup) return fail(`${monster?.name || "该杂兵"}缺少冲突设置`);
    if (!setup.initialBp || typeof setup.initialBp !== "object" || Array.isArray(setup.initialBp)) {
      return fail(`${setup.name}缺少 initialBp 配置`);
    }

    const kinds = ["BP1", "BP2", "BP3", "BPS"];
    const counts = {};
    for (const [kind, rawCount] of Object.entries(setup.initialBp)) {
      if (!kinds.includes(kind)) return fail(`${setup.name}使用了未知初始 BP 类型：${kind}`);
      const count = Number(rawCount);
      const available = monster.cards.filter(card => card.kind === kind).length;
      if (!Number.isInteger(count) || count < 0 || count > available) {
        return fail(`${setup.name}的 ${kind} 初始数量 ${rawCount} 超出卡池 ${available}`);
      }
      if (count) counts[kind] = count;
    }
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    if (!total || total > 10) return fail(`${setup.name}的初始 BP 总数必须为 1-10`);

    const fixedCards = Array.isArray(setup.initialBpCards) ? setup.initialBpCards : [];
    const fixedIds = new Set();
    const fixedSlots = new Set();
    const fixedByKind = {};
    for (const fixed of fixedCards) {
      const card = cardById(monster, fixed?.id);
      if (!card) return fail(`${setup.name}的固定 BP 不存在：${fixed?.id || "未填写 ID"}`);
      if (!Object.hasOwn(counts, card.kind)) return fail(`${card.id}不属于初始 BP 配置`);
      if (!Number.isInteger(fixed.slot) || fixed.slot < 0 || fixed.slot >= total) {
        return fail(`${card.id}的固定槽位必须在 0-${total - 1}`);
      }
      if (fixedIds.has(card.id)) return fail(`${card.id}被重复配置`);
      if (fixedSlots.has(fixed.slot)) return fail(`杂兵轨槽位 ${fixed.slot + 1} 被重复配置`);
      if (fixed.side && !["face", "back"].includes(fixed.side)) return fail(`${card.id}的正反面配置无效`);
      fixedIds.add(card.id);
      fixedSlots.add(fixed.slot);
      fixedByKind[card.kind] = (fixedByKind[card.kind] || 0) + 1;
    }
    for (const [kind, count] of Object.entries(fixedByKind)) {
      if (count > counts[kind]) return fail(`${kind}固定卡数量超过初始数量`);
    }

    const sides = setup.initialBpSides;
    if (sides) {
      const face = Number(sides.face || 0);
      const back = Number(sides.back || 0);
      if (!Number.isInteger(face) || !Number.isInteger(back) || face < 0 || back < 0 || face + back !== total) {
        return fail(`${setup.name}的初始 BP 正反面数量必须合计 ${total}`);
      }
      const fixedFace = fixedCards.filter(item => item.side !== "back").length;
      const fixedBack = fixedCards.filter(item => item.side === "back").length;
      if (fixedFace > face || fixedBack > back) return fail(`${setup.name}的固定 BP 正反面数量超过初始配置`);
    }
    const markers = Number(setup.initialGenericMarkersOnBack || 0);
    if (!Number.isInteger(markers) || markers < 0 || markers > MAX_BP_MARKERS) {
      return fail(`${setup.name}的初始通用标记数量无效`);
    }

    for (const conditional of setup.conditionalCards || []) {
      if (!cardById(monster, conditional?.id)) return fail(`${setup.name}的条件卡不存在：${conditional?.id || "未填写 ID"}`);
    }
    return { setup, counts, fixedCards, total, error: "" };
  }

  function mobInitialBpCounts(monster) {
    return mobSetupResult(monster).counts;
  }

  function mobInitialCount(monster) {
    return Object.values(mobInitialBpCounts(monster)).reduce((total, count) => total + count, 0);
  }

  function isPumpkinhead(monster) {
    return monster?.id === "M_Pumpkinhead";
  }

  function isSpecialMobBp(card) {
    return card?.kind === "BPS";
  }

  function isSpecialMobSlot(monster, slot) {
    return isSpecialMobBp(cardById(monster, slot?.id));
  }

  function isSaplingSlot(monster, slot) {
    // Pumpkinhead BPS uses the back sprite as the Seed/Sapling side.
    return isPumpkinhead(monster) && isSpecialMobSlot(monster, slot) && slot.side === "back";
  }

  function mobActivationKind(monster, token, battle = state.battle) {
    const slot = battle.bpTrack[token?.position];
    return token?.type === "AI" && isSaplingSlot(monster, slot) ? "SG" : token?.type;
  }

  function levelInfo(monster, level = 1) {
    const levels = LEVELS[monster?.id] || [];
    return levels.find(item => item.level === Number(level)) || levels[0] || null;
  }

  function exhibitionStartingWounds(monster, level, clashPhase) {
    if (clashPhase !== "preliminary") return 0;
    return Math.max(0, Number(levelInfo(monster, level)?.exhibitionWounds || 0));
  }

  function bossRule(monster) {
    return BOSS_RULES[monster?.id] || null;
  }

  function conflictSetupPanel(monster, level) {
    const setup = CONFLICT_SETUPS.monsters.find(item => item.id === monster?.id);
    if (!setup) return "";

    const campaignKingdom = window.KF_CAMPAIGN_KINGDOM === "stone" ? "stone" : "sunken";
    const levelKey = Number(level) >= 2 ? "2+" : "1";
    const map = setup.mapsByKingdom?.[campaignKingdom] || setup.mapsByLevel?.[levelKey] || setup.map;
    const original = setup.original?.byKingdom?.[campaignKingdom] || setup.original?.default || null;
    const tiles = setup.tilesByKingdom?.[campaignKingdom] || setup.tilesByLevel?.[levelKey] || setup.tiles || [];
    const kingdomLabels = { sunken: "沉没王国", stone: "石之公国", both: "双王国" };
    const aftermath = CONFLICT_SETUPS.aftermath.map((section, index) => ({
      ...section,
      items: [...section.items, ...(index === 1 ? setup.aftermathExtras || [] : [])]
    }));

    return `<details class="panel conflict-setup-panel">
      <summary class="conflict-setup-summary">
        <span class="conflict-disclosure" aria-hidden="true"></span>
        <span class="conflict-summary-title"><span class="eyebrow">CLASH SETUP</span><strong>${esc(setup.name)}冲突设置</strong></span>
        <span class="badge">${esc(setup.type)} · ${esc(kingdomLabels[setup.kingdom] || "通用")}</span>
      </summary>
      ${original ? `<details class="conflict-original-panel">
        <summary><span>查看原版内容</span><span class="badge">${esc(original.label)}</span></summary>
        <figure class="conflict-original-figure">
          <button type="button" class="conflict-original-trigger" data-original-preview="${esc(original.src)}" data-original-title="${esc(setup.en)} · ${esc(original.label)}" aria-label="放大查看${esc(setup.name)}原版内容">
            <img src="${esc(original.src)}" alt="${esc(setup.en)}原版冲突设置双页" loading="lazy">
          </button>
          <figcaption>${esc(setup.en)} · ${esc(original.label)}</figcaption>
        </figure>
      </details>` : ""}
      <div class="conflict-setup-layout">
        <div class="conflict-setup-copy">
          <details class="conflict-standard">
            <summary>标准准备（${CONFLICT_SETUPS.standard.length} 项）</summary>
            <ol>${CONFLICT_SETUPS.standard.map(item => `<li>${esc(item)}</li>`).join("")}</ol>
          </details>
          <section class="conflict-monster-rules">
            <h4>本场设置</h4>
            <div class="required-tiles" aria-label="所需地形与组件">${tiles.map(item => `<span>${esc(item)}</span>`).join("")}</div>
            <ol>${setup.steps.map(item => `<li>${esc(item)}</li>`).join("")}</ol>
            ${(setup.notes || []).map(note => `<p class="conflict-note">${esc(note)}</p>`).join("")}
          </section>
        </div>
        <figure class="conflict-map-figure">
          <img src="${esc(map)}" alt="${esc(setup.name)}冲突地图" loading="lazy">
          <figcaption>${esc(setup.name)}冲突地图${setup.mapsByKingdom ? ` · ${kingdomLabels[campaignKingdom]}` : setup.mapsByLevel ? ` · ${levelKey === "1" ? "等级 1" : "等级 2+"}` : ""}</figcaption>
        </figure>
      </div>
      ${setup.flavor ? `<section class="conflict-flavor" aria-labelledby="conflict-flavor-${esc(setup.id)}">
        <div class="conflict-flavor-heading">
          <span class="eyebrow">INTRODUCTION</span>
          <h4 id="conflict-flavor-${esc(setup.id)}">风味文字</h4>
        </div>
        <blockquote>
          <p>${esc(setup.flavor.quote)}</p>
          <cite>${esc(setup.flavor.source)}</cite>
        </blockquote>
        <div class="conflict-flavor-body">${setup.flavor.paragraphs.map(item => `<p>${esc(item)}</p>`).join("")}</div>
      </section>` : ""}
      <details class="aftermath-panel" open>
        <summary>战后处理</summary>
        <div class="aftermath-grid">${aftermath.map(section => `<section class="aftermath-section">
          <h4>${esc(section.title)}</h4>
          ${section.items.map(([label, text]) => `<p><strong>${esc(label)}：</strong>${esc(text)}</p>`).join("")}
        </section>`).join("")}</div>
      </details>
    </details>`;
  }

  function defaultRuleState(monster, level = 1, clashPhase = "full") {
    const rule = bossRule(monster);
    const stages = (rule?.stages || []).filter(stage =>
      (!stage.minLevel || Number(level) >= stage.minLevel)
      && (!stage.fullOnly || clashPhase === "full")
    );
    const patientIds = (rule?.patientCards || []).map(card => card.id);
    const eggBonus = Number(level) >= 2 ? 1 : 0;
    return {
      phaseIndex: 0,
      phaseIds: stages.map(stage => stage.id),
      aiAttachments: [],
      doppelgangers: [],
      guardians: {
        count: rule?.kind === "white-ape" ? 2 : 0,
        carrier: 0,
        slots: Array.from({ length: 6 }, (_, index) => rule?.kind === "white-ape" && index < 2)
      },
      fallenKnights: [],
      puppetKing: { fallenKnightTokens: 0, armor: 0 },
      panzerArmor: { field: 0, dragon: 0, remnant: 0 },
      panzerRetributionArmor: 0,
      thickSkinSetAside: false,
      reinforcementTokens: 0,
      vengeanceTokens: 0,
      pendingCoordinatedAttacks: 0,
      cookieTokens: 0,
      lictorDecoyTokens: 0,
      etherealUnity: { counter: 0 },
      ironcast: { necrofusion: 0 },
      knightFen: { armor: 0 },
      firstmenWarriors: { muscularChestMarkers: 0, retributionMarkers: 0 },
      ratwolves: { pendingSignature: false, spawnedRank: 0, trackIndex: -1, rankSource: "" },
      wingedNightmare: { bloodyDefiance: false },
      bogWitch: { position: 0 },
      pendingRuleAiReason: "",
      doppelPreviewCard: "",
      aiChoiceIds: [],
      recommendedAiId: "",
      aiChoiceMode: "choose",
      ruleCard: "",
      ruleCardReason: "",
      ruleNotice: "",
      severityByKnight: {},
      activeKnight: "",
      patient: {
        deck: patientIds,
        discard: [],
        drawn: [],
        queue: [],
        stage: "idle",
        target: "",
        stopReason: ""
      },
      ancientDusk: { disaster: 0, pillars: 0 },
      smeltedFears: {
        disaster: 0,
        devilArmor: 2,
        ironTitheArmor: 0,
        imprisonedKnight: "",
        gateHolders: [],
        suffocationEvents: 0,
        pendingMoltenChains: ""
      },
      eggknight: {
        armor: { 1: 1 + eggBonus, 2: 2 + eggBonus, 3: 3 + eggBonus },
        jacked: 0,
        counter: 0
      },
      knighteater: {
        meat: 0,
        armor: 0,
        brute: 0,
        berserk: false,
        priorityTarget: ""
      },
      stonemason: {
        armor: { front: 0, right: 0, back: 0, left: 0 },
        direction: "front",
        armorLocked: false
      },
      kingLaidLow: {
        curseHolder: "",
        livingKnights: [],
        putrid: 0,
        vpCreated: false,
        vpOccupant: ""
      }
    };
  }

  function normalizeRuleState(monster, raw, level, clashPhase) {
    const base = defaultRuleState(monster, level, clashPhase);
    const cardIds = allCardIds(monster);
    const validCards = value => Array.isArray(value) ? value.filter(id => cardIds.has(id)) : [];
    const attachments = Array.isArray(raw?.aiAttachments) ? raw.aiAttachments
      .filter(item => item && cardIds.has(item.cardId))
      .map(item => ({ id: String(item.id || uid()), cardId: item.cardId, holder: String(item.holder || "骑士") })) : [];
    const doppelgangers = Array.isArray(raw?.doppelgangers) ? raw.doppelgangers
      .map(item => {
        const cards = validCards(item?.cards);
        return {
          id: String(item?.id || uid()),
          cards,
          revealed: Boolean(item?.revealed || (cards[0] && cards[0] === raw?.doppelPreviewCard))
        };
      })
      .filter(item => item.cards.length) : [];
    const fallenKnights = Array.isArray(raw?.fallenKnights) ? raw.fallenKnights
      .map(item => ({ id: String(item?.id || uid()), wounds: clamp(item?.wounds, 0, 1) })) : [];
    const patientIds = new Set((bossRule(monster)?.patientCards || []).map(card => card.id));
    const patientList = value => Array.isArray(value) ? value.filter(id => patientIds.has(id)) : [];
    const severityByKnight = {};
    if (raw?.severityByKnight && typeof raw.severityByKnight === "object") {
      for (const [name, severity] of Object.entries(raw.severityByKnight)) {
        if (String(name).trim()) severityByKnight[String(name)] = clamp(severity, 0, 9);
      }
    }
    const directions = new Set(["front", "right", "back", "left"]);
    const rawStone = raw?.stonemason || {};
    const rawBogWitch = raw?.bogWitch || {};
    const rawPatient = raw?.patient || {};
    const rawSmelted = raw?.smeltedFears || {};
    const rawKing = raw?.kingLaidLow || {};
    const rawPuppet = raw?.puppetKing || {};
    const puppetKingRule = bossRule(monster)?.kind === "puppet-king";
    const legacyFallenKnightTokens = fallenKnights.some(item => item.wounds) ? 1 : 0;
    const puppetArmor = clamp(rawPuppet.armor, 0, 99);
    const rawGuardians = raw?.guardians || {};
    const guardianLimit = guardianCap(level);
    const legacyGuardianCount = clamp(rawGuardians.count ?? base.guardians.count, 0, guardianLimit);
    const guardianSlots = Array.isArray(rawGuardians.slots)
      ? Array.from({ length: 6 }, (_, index) => index < guardianLimit && Boolean(rawGuardians.slots[index]))
      : Array.from({ length: 6 }, (_, index) => index < legacyGuardianCount);
    return {
      ...base,
      ...raw,
      phaseIndex: clamp(raw?.phaseIndex, 0, Math.max(0, base.phaseIds.length - 1)),
      phaseIds: base.phaseIds,
      aiAttachments: attachments,
      doppelgangers,
      fallenKnights: puppetKingRule ? [] : fallenKnights,
      puppetKing: {
        fallenKnightTokens: clamp(
          rawPuppet.fallenKnightTokens ?? legacyFallenKnightTokens,
          0,
          1
        ),
        armor: puppetArmor >= 5 ? 0 : puppetArmor
      },
      guardians: {
        count: guardianSlots.filter(Boolean).length,
        carrier: clamp(rawGuardians.carrier ?? base.guardians.carrier, 0, 5),
        slots: guardianSlots
      },
      panzerArmor: {
        field: clamp(raw?.panzerArmor?.field, 0, 20),
        dragon: clamp(raw?.panzerArmor?.dragon, 0, 20),
        remnant: clamp(raw?.panzerArmor?.remnant, 0, 20)
      },
      panzerRetributionArmor: clamp(raw?.panzerRetributionArmor, 0, 8),
      thickSkinSetAside: Boolean(raw?.thickSkinSetAside),
      reinforcementTokens: clamp(raw?.reinforcementTokens, 0, 20),
      vengeanceTokens: Number(level) >= 2 ? clamp(raw?.vengeanceTokens, 0, 20) : 0,
      pendingCoordinatedAttacks: clamp(raw?.pendingCoordinatedAttacks, 0, 10),
      cookieTokens: clamp(raw?.cookieTokens, 0, 20),
      lictorDecoyTokens: clamp(raw?.lictorDecoyTokens, 0, MAX_SHEET_TOKENS_PER_TYPE),
      etherealUnity: {
        counter: clamp(raw?.etherealUnity?.counter, 0, 99)
      },
      ironcast: {
        necrofusion: clamp(raw?.ironcast?.necrofusion, 0, 99)
      },
      knightFen: {
        armor: clamp(raw?.knightFen?.armor, 0, 99)
      },
      firstmenWarriors: {
        muscularChestMarkers: clamp(raw?.firstmenWarriors?.muscularChestMarkers, 0, 4),
        retributionMarkers: clamp(raw?.firstmenWarriors?.retributionMarkers, 0, 3)
      },
      ratwolves: {
        pendingSignature: Boolean(raw?.ratwolves?.pendingSignature),
        spawnedRank: clamp(raw?.ratwolves?.spawnedRank, 0, 3),
        trackIndex: clamp(raw?.ratwolves?.trackIndex ?? -1, -1, 9),
        rankSource: String(raw?.ratwolves?.rankSource || "")
      },
      wingedNightmare: {
        bloodyDefiance: Boolean(raw?.wingedNightmare?.bloodyDefiance)
      },
      bogWitch: {
        position: clamp(rawBogWitch.position ?? base.bogWitch.position, 0, BOG_WITCH_POSITIONS.length - 1)
      },
      pendingRuleAiReason: String(raw?.pendingRuleAiReason || ""),
      doppelPreviewCard: cardIds.has(raw?.doppelPreviewCard) ? raw.doppelPreviewCard : "",
      aiChoiceIds: validCards(raw?.aiChoiceIds).slice(0, 2),
      recommendedAiId: validCards(raw?.aiChoiceIds).includes(raw?.recommendedAiId) ? raw.recommendedAiId : "",
      aiChoiceMode: raw?.aiChoiceMode === "routine" ? "routine" : "choose",
      ruleCard: cardIds.has(raw?.ruleCard) ? raw.ruleCard : "",
      ruleCardReason: String(raw?.ruleCardReason || ""),
      ruleNotice: String(raw?.ruleNotice || ""),
      severityByKnight,
      activeKnight: String(raw?.activeKnight || ""),
      patient: {
        deck: raw?.patient ? patientList(rawPatient.deck) : [...base.patient.deck],
        discard: patientList(rawPatient.discard),
        drawn: patientList(rawPatient.drawn),
        queue: Array.isArray(rawPatient.queue)
          ? rawPatient.queue.filter(letter => /^[A-F]$/.test(letter)) : [],
        stage: ["idle", "drawing", "resolving"].includes(rawPatient.stage) ? rawPatient.stage : "idle",
        target: String(rawPatient.target || ""),
        stopReason: String(rawPatient.stopReason || "")
      },
      ancientDusk: {
        disaster: clamp(raw?.ancientDusk?.disaster, 0, 99),
        pillars: clamp(raw?.ancientDusk?.pillars, 0, 99)
      },
      smeltedFears: {
        disaster: clamp(rawSmelted.disaster, 0, 99),
        devilArmor: clamp(rawSmelted.devilArmor ?? base.smeltedFears.devilArmor, 0, 99),
        ironTitheArmor: clamp(rawSmelted.ironTitheArmor, 0, 99),
        imprisonedKnight: String(rawSmelted.imprisonedKnight || ""),
        gateHolders: Array.isArray(rawSmelted.gateHolders)
          ? [...new Set(rawSmelted.gateHolders.map(String).filter(Boolean))] : [],
        suffocationEvents: clamp(rawSmelted.suffocationEvents, 0, 99),
        pendingMoltenChains: ["light", "heavy", "fatal", "judgment"].includes(rawSmelted.pendingMoltenChains)
          ? rawSmelted.pendingMoltenChains : ""
      },
      eggknight: {
        armor: {
          1: clamp(raw?.eggknight?.armor?.[1] ?? base.eggknight.armor[1], 0, 20),
          2: clamp(raw?.eggknight?.armor?.[2] ?? base.eggknight.armor[2], 0, 20),
          3: clamp(raw?.eggknight?.armor?.[3] ?? base.eggknight.armor[3], 0, 20)
        },
        jacked: clamp(raw?.eggknight?.jacked, 0, 99),
        counter: clamp(raw?.eggknight?.counter, 0, 99)
      },
      knighteater: {
        meat: clamp(raw?.knighteater?.meat, 0, 99),
        armor: clamp(raw?.knighteater?.armor, 0, 99),
        brute: clamp(raw?.knighteater?.brute, 0, 2),
        berserk: Boolean(raw?.knighteater?.berserk),
        priorityTarget: String(raw?.knighteater?.priorityTarget || "")
      },
      stonemason: {
        armor: {
          front: clamp(rawStone.armor?.front, 0, 20),
          right: clamp(rawStone.armor?.right, 0, 20),
          back: clamp(rawStone.armor?.back, 0, 20),
          left: clamp(rawStone.armor?.left, 0, 20)
        },
        direction: directions.has(rawStone.direction) ? rawStone.direction : "front",
        armorLocked: Boolean(rawStone.armorLocked)
      },
      kingLaidLow: {
        curseHolder: String(rawKing.curseHolder || ""),
        livingKnights: Array.isArray(rawKing.livingKnights)
          ? [...new Set(rawKing.livingKnights.map(String).filter(Boolean))] : [],
        putrid: clamp(rawKing.putrid, 0, 99),
        vpCreated: Boolean(rawKing.vpCreated),
        vpOccupant: String(rawKing.vpOccupant || "")
      }
    };
  }

  function mobActivationTypes(monster, level = 1) {
    const levels = MOB_ACTIVATIONS[monster?.id] || [];
    return levels[clamp(level, 1, levels.length) - 1] || [];
  }

  function defaultCounts(monster, level = 1) {
    const count = kind => Number(monster?.pools?.[kind] || 0);
    const counts = {
      AI1: count("AI1"), AI2: 0, AI3: 0,
      BP1: isMob(monster) ? 0 : Math.min(6, count("BP1")), BP2: 0, BP3: 0,
      BPS: 0, BPX: 0
    };
    if (isMob(monster)) Object.assign(counts, mobInitialBpCounts(monster));
    const info = !isMob(monster) ? levelInfo(monster, level) : null;
    for (let step = 0; step < Number(info?.promotion || 0); step++) {
      for (const prefix of ["AI", "BP"]) {
        if (counts[`${prefix}1`] > 0) {
          counts[`${prefix}1`]--;
          counts[`${prefix}2`]++;
        } else if (counts[`${prefix}2`] > 0) {
          counts[`${prefix}2`]--;
          counts[`${prefix}3`]++;
        }
      }
    }
    return counts;
  }

  function conflictKingdom() {
    return String(window.KF_CAMPAIGN_KINGDOM || "").toLowerCase().includes("stone") ? "stone" : "sunken";
  }

  function conflictLayout(monster, level, kingdom = conflictKingdom()) {
    const layouts = window.KF_CONFLICT_BOARD_DATA?.layouts || [];
    const candidates = layouts.filter(layout => layout.monsterId === monster?.id);
    const local = candidates.filter(layout => layout.kingdom === kingdom);
    const pool = local.length ? local : candidates;
    const wanted = Number(level) <= 1 ? "1" : "2+";
    return pool.find(layout => layout.levelVariant === wanted)
      || pool.find(layout => layout.levelVariant === "all")
      || pool[0]
      || null;
  }

  function conflictKnightAssignments(layout) {
    const starts = (layout?.placements || []).filter(placement => placement.kind === "knight");
    const party = Array.isArray(window.KF_CAMPAIGN_PARTY) ? window.KF_CAMPAIGN_PARTY : [];
    return starts.slice(0, party.length).flatMap((placement, index) => {
      const member = party[index] || {};
      const heroId = member.type === "squire" ? member.squireId : member.knightId;
      if (!heroId) return [];
      return [{
        placementId: placement.id,
        heroId: String(heroId),
        name: String(member.name || member.title || heroId),
        memberType: member.type === "squire" ? "squire" : "knight",
      }];
    });
  }

  function foolDeckCards() {
    return Array.isArray(window.KF_CONFLICT_BOARD_DATA?.foolDeck?.cards)
      ? window.KF_CONFLICT_BOARD_DATA.foolDeck.cards : [];
  }

  function foolCardById(cardId) {
    return foolDeckCards().find(card => card.cardId === Number(cardId)) || null;
  }

  function shuffledFoolDeck() {
    return shuffle(foolDeckCards().map(card => card.cardId));
  }

  function defaultConflictTerrain(layout, resolvedOrientations = {}) {
    return (layout?.placements || []).filter(placement => placement.kind === "terrain").map(placement => ({
      id: placement.id,
      asset: placement.asset,
      rowStart: placement.rowStart,
      rowEnd: placement.rowEnd,
      columnStart: placement.columnStart,
      columnEnd: placement.columnEnd,
      rotation: resolvedOrientations[placement.id] ?? placement.rotation ?? 0,
      flipped: false,
      layer: placement.layer ?? 10,
    }));
  }

  function normalizeConflictTerrain(raw, layout, resolvedOrientations) {
    if (!Array.isArray(raw)) return defaultConflictTerrain(layout, resolvedOrientations);
    const assets = window.KF_CONFLICT_BOARD_DATA?.assets || {};
    const usedIds = new Set();
    return raw.flatMap((placement, index) => {
      const asset = String(placement?.asset || "");
      let id = String(placement?.id || `terrain-${index}`);
      if (!assets[asset] || usedIds.has(id)) return [];
      usedIds.add(id);
      let rowStart = clamp(placement.rowStart, 1, 10);
      let rowEnd = clamp(placement.rowEnd, rowStart, 10);
      let columnStart = clamp(placement.columnStart, 1, 14);
      let columnEnd = clamp(placement.columnEnd, columnStart, 14);
      const rotation = ((Number(placement.rotation) || 0) % 360 + 360) % 360;
      return [{
        id, asset, rowStart, rowEnd, columnStart, columnEnd, rotation,
        flipped: Boolean(placement.flipped),
        layer: clamp(placement.layer ?? 10, 1, 39),
      }];
    });
  }

  function buildConflictBoard(monster, level, battle = null) {
    const requestedKingdom = conflictKingdom();
    const layout = conflictLayout(monster, level, requestedKingdom);
    if (!layout) return null;
    const randomOrientations = window.KF_CONFLICT_BOARD_DATA?.randomOrientations || {};
    const resolvedOrientations = {};
    for (const placement of layout.placements) {
      const choices = randomOrientations[placement.orientation];
      if (Array.isArray(choices) && choices.length) resolvedOrientations[placement.id] = choices[Math.floor(Math.random() * choices.length)];
    }
    const numberable = shuffle(layout.placements.filter(placement =>
      placement.kind === "monster" || ["RedSapling", "LictorDecoy"].includes(placement.asset)
    ));
    const occupiedTrackNumbers = Array.isArray(battle?.bpTrack)
      ? battle.bpTrack.map((slot, index) => slot?.id ? index + 1 : 0).filter(Boolean)
      : [];
    const numbers = occupiedTrackNumbers.length ? occupiedTrackNumbers : Array.from({ length: numberable.length }, (_, index) => index + 1);
    return {
      layoutId: layout.id,
      monsterId: monster?.id || "",
      kingdom: layout.kingdom,
      requestedKingdom,
      level: Number(level) || 1,
      resolvedOrientations,
      knightAssignments: conflictKnightAssignments(layout),
      mobAssignments: numberable.slice(0, numbers.length).map((placement, index) => ({ placementId: placement.id, number: numbers[index] })),
      terrain: defaultConflictTerrain(layout, resolvedOrientations),
      showStarts: true,
      showCoordinates: false,
      overlay: window.KF_OVERLAY?.normalizeSettings(null) || null,
      foolDeckOrder: [],
      activeFoolCardId: null,
      createdAt: new Date().toISOString(),
    };
  }

  function normalizeConflictBoard(raw, monster, level, battle) {
    const layouts = window.KF_CONFLICT_BOARD_DATA?.layouts || [];
    const layout = layouts.find(item => item.id === raw?.layoutId && item.monsterId === monster?.id);
    if (!layout) return buildConflictBoard(monster, level, battle);
    const randomIds = new Set(layout.placements.filter(item => ["R", "K"].includes(item.orientation)).map(item => item.id));
    const resolvedOrientations = {};
    for (const [id, rotation] of Object.entries(raw?.resolvedOrientations || {})) {
      if (randomIds.has(id) && [0, 90, 180, 270].includes(Number(rotation))) resolvedOrientations[id] = Number(rotation);
    }
    for (const placement of layout.placements) {
      if (!randomIds.has(placement.id) || Object.prototype.hasOwnProperty.call(resolvedOrientations, placement.id)) continue;
      const choices = window.KF_CONFLICT_BOARD_DATA?.randomOrientations?.[placement.orientation] || [0];
      resolvedOrientations[placement.id] = choices[Math.floor(Math.random() * choices.length)];
    }
    const placementIds = new Set(layout.placements.map(item => item.id));
    const knightPlacementIds = new Set(layout.placements.filter(item => item.kind === "knight").map(item => item.id));
    const usedKnightPlacements = new Set();
    const knightAssignments = (Array.isArray(raw?.knightAssignments) ? raw.knightAssignments : []).flatMap(item => {
      const placementId = String(item?.placementId || "");
      const heroId = String(item?.heroId || "");
      if (!knightPlacementIds.has(placementId) || usedKnightPlacements.has(placementId) || !/^[a-z0-9-]{1,40}$/.test(heroId)) return [];
      usedKnightPlacements.add(placementId);
      return [{
        placementId,
        heroId,
        name: String(item?.name || heroId).slice(0, 100),
        memberType: item?.memberType === "squire" ? "squire" : "knight",
      }];
    });
    const usedNumbers = new Set();
    const mobAssignments = (Array.isArray(raw?.mobAssignments) ? raw.mobAssignments : []).flatMap(item => {
      const number = Number(item?.number);
      if (!placementIds.has(item?.placementId) || !Number.isInteger(number) || number < 1 || number > 20 || usedNumbers.has(number)) return [];
      usedNumbers.add(number);
      return [{ placementId: item.placementId, number }];
    });
    const expectsAssignments = layout.placements.some(item => item.kind === "monster" || ["RedSapling", "LictorDecoy"].includes(item.asset));
    const fallback = expectsAssignments && !mobAssignments.length ? buildConflictBoard(monster, level, battle) : null;
    const foolCardIds = new Set(foolDeckCards().map(card => card.cardId));
    const usedFoolCards = new Set();
    const storedFoolDeckOrder = Array.isArray(raw?.foolDeckOrder);
    const foolDeckOrder = (storedFoolDeckOrder ? raw.foolDeckOrder : []).flatMap(value => {
      const cardId = Number(value);
      if (!foolCardIds.has(cardId) || usedFoolCards.has(cardId)) return [];
      usedFoolCards.add(cardId);
      return [cardId];
    });
    const activeFoolCardId = Number(raw?.activeFoolCardId);
    const normalizedActiveFoolCardId = foolCardIds.has(activeFoolCardId) ? activeFoolCardId : null;
    return {
      layoutId: layout.id,
      monsterId: monster.id,
      kingdom: layout.kingdom,
      requestedKingdom: raw?.requestedKingdom === "stone" ? "stone" : "sunken",
      level: Number(raw?.level) || Number(level) || 1,
      resolvedOrientations,
      knightAssignments: knightAssignments.length ? knightAssignments : conflictKnightAssignments(layout),
      mobAssignments: mobAssignments.length ? mobAssignments : (fallback?.mobAssignments || []),
      terrain: normalizeConflictTerrain(raw?.terrain, layout, resolvedOrientations),
      showStarts: raw?.showStarts !== false,
      showCoordinates: raw?.showCoordinates === true,
      overlay: window.KF_OVERLAY?.normalizeSettings(raw?.overlay) || null,
      foolDeckOrder: foolDeckOrder.filter(cardId => cardId !== normalizedActiveFoolCardId),
      activeFoolCardId: normalizedActiveFoolCardId,
      createdAt: String(raw?.createdAt || new Date().toISOString()),
    };
  }

  function emptyBattle(monster = DATA.monsters[0]) {
    return {
      monsterId: monster?.id || "",
      level: 1,
      clashPhase: suggestedClashPhase(),
      mobCount: isMob(monster) ? mobInitialCount(monster) : 0,
      setupCounts: defaultCounts(monster, 1),
      aiDeck: [], aiDiscard: [], aiRemoved: [],
      bpDeck: [], bpDiscard: [], bpDamage: [], bpRemoved: [],
      bpTrack: [], activeAI: "", activeBP: "",
      mobTacticCard: "",
      lastMobWoundRank: 0,
      mobActivations: [], activeMobActivationId: "",
      sheetTokens: [],
      singleWounds: 0, doubleWounds: 0,
      ruleState: defaultRuleState(monster, 1, suggestedClashPhase()),
      conflictStatus: "active", failureReason: "",
      conflictLocation: "",
      conflictBoard: buildConflictBoard(monster, 1),
      aiView: "discard", bpView: "damage", galleryKind: "ALL",
      log: []
    };
  }

  function defaultState() {
    const battle = emptyBattle();
    return {
      version: VERSION,
      selectedMonsterId: battle.monsterId,
      battle,
      history: [],
      encounters: {},
      updatedAt: Date.now()
    };
  }

  function allCardIds(monster) {
    return new Set(monster.cards.map(card => card.id));
  }

  function normalizeBattle(raw) {
    const monster = monsterById(raw?.monsterId) || DATA.monsters[0];
    const base = emptyBattle(monster);
    const cardIds = allCardIds(monster);
    const ids = value => Array.isArray(value) ? value.filter(id => cardIds.has(id) || String(id).startsWith(WOUND_PREFIX)) : [];
    const track = Array.isArray(raw?.bpTrack) ? raw.bpTrack
      .filter(slot => slot && (!slot.id || cardIds.has(slot.id)))
      .map(slot => {
        const id = slot.id || "";
        const pumpkinheadBps = isPumpkinhead(monster) && isSpecialMobBp(cardById(monster, id));
        const wasHiddenPumpkinheadBps = pumpkinheadBps && !slot.revealed;
        const markerTokens = {};
        if (id && slot.markerTokens && typeof slot.markerTokens === "object") {
          for (const [assetId, count] of Object.entries(slot.markerTokens)) {
            if (!TOKEN_ASSET_IDS.has(assetId)) continue;
            const normalized = clamp(count, 0, MAX_SHEET_TOKENS_PER_TYPE);
            if (normalized) markerTokens[assetId] = normalized;
          }
        }
        const genericMarkers = id
          ? clamp(markerTokens["token-01"] ?? slot.markers, 0, pumpkinheadBps ? MAX_BP_MARKERS : MAX_SHEET_TOKENS_PER_TYPE)
          : 0;
        if (genericMarkers) markerTokens["token-01"] = genericMarkers;
        else delete markerTokens["token-01"];
        return {
          id,
          revealed: wasHiddenPumpkinheadBps ? true : Boolean(slot.revealed),
          side: wasHiddenPumpkinheadBps ? "back" : (slot.side === "back" ? "back" : "face"),
          markers: genericMarkers,
          markerTokens,
          decoy: monster.id === "M_FirstmenLictor" && Boolean(id) && Boolean(slot.decoy)
        };
      }) : [];
    const mobActivations = Array.isArray(raw?.mobActivations) ? raw.mobActivations
      .filter(token => token && ["AI", "SG"].includes(token.type))
      .map((token, index) => ({
        id: String(token.id || `activation-${index}`),
        type: token.type,
        position: clamp(token.position, -1, 9),
        used: Boolean(token.used)
      })) : [];
    const sheetTokensByAsset = new Map();
    if (Array.isArray(raw?.sheetTokens)) {
      raw.sheetTokens.forEach((token, index) => {
        if (!token || !TOKEN_ASSET_IDS.has(token.assetId)) return;
        const count = clamp(token.count ?? 1, 1, MAX_SHEET_TOKENS_PER_TYPE);
        const existing = sheetTokensByAsset.get(token.assetId);
        if (existing) {
          existing.count = clamp(existing.count + count, 1, MAX_SHEET_TOKENS_PER_TYPE);
          return;
        }
        sheetTokensByAsset.set(token.assetId, {
          id: String(token.id || `sheet-token-${index}-${uid()}`),
          assetId: token.assetId,
          count,
          x: clamp(token.x ?? 50, 0, 100),
          y: clamp(token.y ?? 50, 0, 100)
        });
      });
    }
    const sheetTokens = [...sheetTokensByAsset.values()]
      .slice(0, TOKEN_ASSETS.length * MAX_SHEET_TOKENS_PER_TYPE);
    const setupCounts = { ...base.setupCounts };
    for (const kind of Object.keys(setupCounts)) {
      setupCounts[kind] = clamp(raw?.setupCounts?.[kind] ?? setupCounts[kind], 0, Number(monster.pools[kind] || 0));
    }
    const maxLevel = Math.max(1, (LEVELS[monster.id] || []).length || 4);
    const level = clamp(raw?.level ?? base.level, 1, maxLevel);
    const storedMobTacticCard = raw?.mobTacticCard || raw?.lictorTacticCard || "";
    const mobTacticCard = mobTacticIds(monster, level).includes(storedMobTacticCard)
      ? storedMobTacticCard : "";
    const clashPhase = raw?.clashPhase === "preliminary" ? "preliminary" : "full";
    const ruleState = normalizeRuleState(monster, raw?.ruleState, level, clashPhase);
    const aiDeck = ids(raw?.aiDeck);
    const aiDiscard = ids(raw?.aiDiscard);
    const aiRemoved = ids(raw?.aiRemoved);
    const winged = isWingedNightmare(monster);
    const cleanBpIds = value => ids(value).filter(id => !winged || !isWingedFixedBpId(id));
    if (winged && isWingedFixedBpId(ruleState.ruleCard)) {
      ruleState.ruleCard = "";
      ruleState.ruleCardReason = "";
    }
    const normalized = {
      ...base, ...raw, monsterId: monster.id, setupCounts,
      mobActivations: winged ? [] : mobActivations, sheetTokens, ruleState,
      mobTacticCard, lictorTacticCard: undefined,
      level,
      clashPhase,
      mobCount: isMob(monster)
        ? mobInitialCount(monster)
        : 0,
      aiDeck, aiDiscard, aiRemoved,
      bpDeck: cleanBpIds(raw?.bpDeck), bpDiscard: cleanBpIds(raw?.bpDiscard),
      bpDamage: cleanBpIds(raw?.bpDamage), bpRemoved: cleanBpIds(raw?.bpRemoved),
      bpTrack: winged ? [] : track,
      activeAI: cardIds.has(raw?.activeAI) ? raw.activeAI : "",
      activeBP: !winged && cardIds.has(raw?.activeBP) ? raw.activeBP : "",
      activeMobActivationId: !winged && mobActivations.some(token => token.id === raw?.activeMobActivationId)
        ? raw.activeMobActivationId : "",
      conflictStatus: raw?.conflictStatus === "failed" ? "failed" : "active",
      failureReason: String(raw?.failureReason || ""),
      conflictLocation: String(raw?.conflictLocation || ""),
      log: Array.isArray(raw?.log) ? raw.log.slice(-100) : []
    };
    normalized.conflictBoard = normalizeConflictBoard(raw?.conflictBoard, monster, level, normalized);
    ensureWingedAiDiscard(normalized);
    return normalized;
  }

  function validateState(value) {
    if (!value || typeof value !== "object") throw new Error("存档不是有效对象");
    if (Number(value.version || 0) !== VERSION) throw new Error("旧版存档不兼容，请建立新冲突");
    const battle = normalizeBattle(value.battle || value);
    const monster = monsterById(battle.monsterId);
    validateBattleZones(battle);
    for (const id of [battle.activeAI, battle.activeBP].filter(Boolean)) {
      if (!cardById(monster, id)) throw new Error(`未知卡牌：${id}`);
    }
    const encounters = {};
    if (value.encounters && typeof value.encounters === "object") {
      for (const [monsterId, encounter] of Object.entries(value.encounters)) {
        if (!monsterById(monsterId) || !encounter || typeof encounter !== "object") continue;
        const savedBattle = normalizeBattle({ ...(encounter.battle || {}), monsterId });
        validateBattleZones(savedBattle);
        const savedHistory = normalizeValidatedHistory(encounter.history, monsterId);
        encounters[monsterId] = {
          battle: savedBattle,
          history: savedHistory
        };
      }
    }
    const selectedMonsterId = monsterById(value.selectedMonsterId)?.id || battle.monsterId;
    const selectedEncounter = encounters[selectedMonsterId];
    const result = {
      version: VERSION,
      selectedMonsterId,
      battle: selectedEncounter ? clone(selectedEncounter.battle) : battle,
      history: selectedEncounter
        ? clone(selectedEncounter.history)
        : normalizeValidatedHistory(value.history, battle.monsterId),
      encounters,
      updatedAt: Date.now()
    };
    if (!result.encounters[result.battle.monsterId]) {
      result.encounters[result.battle.monsterId] = {
        battle: clone(result.battle),
        history: clone(result.history)
      };
    }
    return result;
  }

  function normalizeValidatedHistory(raw, monsterId) {
    if (!Array.isArray(raw)) return [];
    return raw.slice(-30).map(item => {
      const battle = normalizeBattle({ ...item, monsterId });
      validateBattleZones(battle);
      return battle;
    });
  }

  function validateBattleZones(battle) {
    const monster = monsterById(battle.monsterId);
    const zones = [
      ...battle.aiDeck, ...battle.aiDiscard, ...battle.aiRemoved,
      ...battle.bpDeck, ...battle.bpDiscard, ...battle.bpDamage.filter(id => !id.startsWith(WOUND_PREFIX)),
      ...battle.bpRemoved, ...battle.bpTrack.map(slot => slot.id).filter(Boolean),
      battle.mobTacticCard,
      ...battle.ruleState.aiAttachments.map(item => item.cardId),
      ...battle.ruleState.doppelgangers.flatMap(item => item.cards),
      ...battle.ruleState.aiChoiceIds,
      battle.ruleState.ruleCard,
      battle.ruleState.thickSkinSetAside ? bossRule(monster)?.cards?.thickSkin : "",
      battle.activeAI && !battle.aiDeck.includes(battle.activeAI) ? battle.activeAI : "",
      battle.activeBP && !battle.bpDeck.includes(battle.activeBP)
        && !battle.bpTrack.some(slot => slot.id === battle.activeBP) ? battle.activeBP : ""
    ].filter(Boolean);
    const seen = new Set();
    const duplicate = zones.find(id => seen.has(id) || !seen.add(id));
    if (duplicate) throw new Error(`卡牌同时出现在多个区域：${duplicate}`);
    const patientZones = [
      ...battle.ruleState.patient.deck,
      ...battle.ruleState.patient.discard,
      ...battle.ruleState.patient.drawn
    ];
    const seenPatients = new Set();
    const duplicatePatient = patientZones.find(id => seenPatients.has(id) || !seenPatients.add(id));
    if (duplicatePatient) throw new Error(`Patient 卡同时出现在多个区域：${duplicatePatient}`);
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const value = JSON.parse(raw);
      if (Number(value?.version || 0) !== VERSION) {
        const monster = monsterById(value?.battle?.monsterId) || DATA.monsters[0];
        const next = defaultState();
        next.battle = emptyBattle(monster);
        next.selectedMonsterId = monster.id;
        toast("旧版存档不兼容，已建立新冲突");
        return next;
      }
      return validateState(value);
    } catch (error) {
      console.warn(error);
      toast(`本地存档无法读取，已使用新存档：${error.message}`);
      return defaultState();
    }
  }

  let state = load();
  let saveTimer;
  let monsterDirectoryOpen = false;
  let mobMarkerAssetId = DEFAULT_MOB_MARKER_ASSET_IDS[state.battle.monsterId] || "token-01";
  let deckConfigOpen = false;
  let sheetTokenToolsOpen = false;
  let selectedTerrainId = "";
  let overlayPlacementMode = "";

  function syncCurrentEncounter() {
    if (!state.battle?.monsterId) return;
    state.selectedMonsterId = state.battle.monsterId;
    state.encounters ||= {};
    state.encounters[state.battle.monsterId] = {
      battle: clone(state.battle),
      history: clone(state.history)
    };
  }

  function save(render = true) {
    const wingedDiscard = ensureWingedAiDiscard();
    if (wingedDiscard) {
      const card = cardById(monsterById(state.battle.monsterId), wingedDiscard);
      log(`难以捉摸：AI 弃牌堆为空，弃置牌组顶 ${card?.kind || "AI"}`);
    }
    try {
      validateBattleZones(state.battle);
    } catch (error) {
      const previous = state.history.pop();
      if (previous) state.battle = normalizeBattle(previous);
      toast(`操作已撤销：${error.message}`);
      if (render) renderApp();
      return;
    }
    syncCurrentEncounter();
    state.updatedAt = Date.now();
    clearTimeout(saveTimer);
    $("#saveStatus").textContent = "保存中…";
    saveTimer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      $("#saveStatus").textContent = "已保存";
    }, 80);
    if (render) renderApp();
  }

  function remember() {
    state.history.push(clone(state.battle));
    state.history = state.history.slice(-30);
  }

  function undo() {
    const previous = state.history.pop();
    if (!previous) return toast("没有可撤销的操作");
    state.battle = normalizeBattle(previous);
    save();
  }

  function toast(message) {
    const node = $("#toast");
    if (!node) return;
    node.textContent = message;
    node.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { node.hidden = true; }, 2800);
  }

  function log(message) {
    state.battle.log.unshift({ at: new Date().toLocaleTimeString("zh-CN", { hour12: false }), message });
    state.battle.log = state.battle.log.slice(0, 100);
  }

  function shuffle(values) {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function setupCount(monster, kind) {
    return clamp(state.battle.setupCounts[kind], 0, Number(monster.pools[kind] || 0));
  }

  function buildInitialMobTrack(monster, setupResult) {
    const { setup, counts, fixedCards, total } = setupResult;
    const fixedIds = new Set(fixedCards.map(item => item.id));
    const remainingIds = shuffle(Object.entries(counts).flatMap(([kind, count]) => {
      const fixedCount = fixedCards.filter(item => cardById(monster, item.id)?.kind === kind).length;
      return shuffle(monster.cards.filter(card => card.kind === kind && !fixedIds.has(card.id)).map(card => card.id))
        .slice(0, count - fixedCount);
    }));
    const slots = Array.from({ length: 10 }, () => ({
      id: "", revealed: false, side: "face", markers: 0, markerTokens: {}, decoy: false
    }));
    const fixedSlots = new Map(fixedCards.map(item => [item.slot, item]));
    const requestedSides = setup.initialBpSides || { face: total, back: 0 };
    const fixedSideCounts = { face: 0, back: 0 };
    fixedCards.forEach(item => { fixedSideCounts[item.side === "back" ? "back" : "face"]++; });
    const remainingSides = shuffle([
      ...Array.from({ length: Number(requestedSides.back || 0) - fixedSideCounts.back }, () => "back"),
      ...Array.from({ length: Number(requestedSides.face || total) - fixedSideCounts.face }, () => "face")
    ]);
    let cardIndex = 0;
    let sideIndex = 0;
    for (let index = 0; index < total; index++) {
      const fixed = fixedSlots.get(index);
      const id = fixed?.id || remainingIds[cardIndex++];
      const side = fixed?.side === "back" ? "back" : fixed?.side === "face" ? "face" : remainingSides[sideIndex++];
      const markers = side === "back" ? Number(setup.initialGenericMarkersOnBack || 0) : 0;
      slots[index] = {
        id,
        revealed: fixed ? Boolean(fixed.revealed) : Boolean(setup.initialBpRevealed),
        side,
        markers,
        markerTokens: markers ? { "token-01": markers } : {},
        decoy: false
      };
    }
    return slots;
  }

  function initializeBattle(monster, options = {}) {
    const battle = state.battle;
    const mobSetup = isMob(monster) ? mobSetupResult(monster) : null;
    if (mobSetup?.error) {
      Object.assign(battle, {
        conflictStatus: "failed",
        failureReason: `冲突初始化失败：${mobSetup.error}`,
        aiDeck: [], bpDeck: [], bpTrack: [], activeAI: "", activeBP: "", mobTacticCard: ""
      });
      battle.log = [];
      log(battle.failureReason);
      toast(battle.failureReason);
      if (!options.preserveHistory) state.history = [];
      return false;
    }
    // Initial composition is determined by the monster and its level.
    state.battle.setupCounts = defaultCounts(monster, state.battle.level);
    const build = kinds => kinds.flatMap(kind =>
      shuffle(monster.cards.filter(card => card.kind === kind).map(card => card.id))
        .slice(0, setupCount(monster, kind))
    );
    battle.aiDeck = shuffle(build(["AI1", "AI2", "AI3"]));
    const ai0Ids = shuffle(monster.cards.filter(card => card.kind === "AI0").map(card => card.id));
    battle.aiDeck.unshift(...ai0Ids);
    if (isMob(monster)) {
      battle.mobCount = mobSetup.total;
      battle.bpDeck = [];
      battle.bpTrack = isWingedNightmare(monster) ? [] : buildInitialMobTrack(monster, mobSetup);
      if (monster.id === "M_PalebloodWorms" && battle.level >= 3) {
        battle.bpTrack.filter(slot => slot.id).forEach(slot => {
          slot.markerTokens["token-blood"] = 1;
        });
      }
      battle.mobTacticCard = isWingedNightmare(monster) ? "" : randomMobTactic(monster, battle.level);
      const occupiedPositions = battle.bpTrack.map((slot, index) => slot.id ? index : -1).filter(index => index >= 0);
      if (monster.id === "M_FirstmenLictor") {
        shuffle(occupiedPositions).slice(0, 6).forEach(index => { battle.bpTrack[index].decoy = true; });
      }
      battle.mobActivations = (isWingedNightmare(monster) ? [] : mobActivationTypes(monster, battle.level)).map((type, index) => ({
        id: `activation-${index}-${uid()}`,
        type,
        position: occupiedPositions[index] ?? -1,
        used: false
      }));
    } else {
      battle.bpDeck = shuffle(build(["BP1", "BP2", "BP3"]));
      battle.bpTrack = [];
      battle.mobTacticCard = "";
    }
    battle.ruleState = defaultRuleState(monster, battle.level, battle.clashPhase);
    battle.conflictStatus = "active";
    battle.failureReason = "";
    const rule = bossRule(monster);
    if (rule?.patientCards?.length) {
      battle.ruleState.patient.deck = shuffle(rule.patientCards.map(card => card.id));
      const party = (window.KF_CAMPAIGN_PARTY || []).map(item => String(item.name || item.title || "").trim()).filter(Boolean);
      for (const name of party) battle.ruleState.severityByKnight[name] = 9;
    }
    if (rule?.kind === "king-laid-low") {
      const living = (window.KF_CAMPAIGN_PARTY || []).map(item => String(item.name || item.title || "").trim()).filter(Boolean);
      battle.ruleState.kingLaidLow.livingKnights = [...new Set(living)];
      if (living.length) battle.ruleState.kingLaidLow.curseHolder = living[Math.floor(Math.random() * living.length)];
    }
    if (rule?.kind === "white-ape") {
      const thickSkin = rule.cards.thickSkin;
      if (cardById(monster, thickSkin)) battle.bpDeck.unshift(thickSkin);
    }
    Object.assign(battle, {
      aiDiscard: [], aiRemoved: [], bpDiscard: [], bpDamage: [], bpRemoved: [],
      activeAI: "", activeBP: "", lastMobWoundRank: 0,
      mobActivations: isMob(monster) ? battle.mobActivations : [], activeMobActivationId: "",
      sheetTokens: [],
      singleWounds: 0, doubleWounds: 0,
      aiView: "discard", bpView: "damage", log: []
    });
    battle.conflictBoard = buildConflictBoard(monster, battle.level, battle);
    ensureWingedAiDiscard(battle);
    const initialSw = exhibitionStartingWounds(monster, battle.level, battle.clashPhase);
    for (let index = 0; index < initialSw; index++) addWound("single");
    if (!options.preserveHistory) state.history = [];
    log(`建立 ${monster.name} 的 AI/BP`);
    if (monster.id === "M_PalebloodWorms" && battle.level >= 3) {
      log("血痂护甲：初始杂兵轨全部 BP 各放置 1 枚血液指示物");
    }
    if (rule?.kind === "doppelgangers") {
      const initialDoppelgangers = battle.level >= 4 ? 2 : 1;
      for (let index = 0; index < initialDoppelgangers; index++) {
        if (!spawnDoppelganger({ initial: true })) break;
      }
    }
    if (initialSw) log(`初步冲突：加入 SW ×${initialSw}，不触发晋升`);
    return true;
  }

  function selectMonster(monster) {
    if (!monster || monster.id === state.battle.monsterId) return;
    syncCurrentEncounter();
    const saved = state.encounters?.[monster.id];
    if (saved) {
      state.battle = normalizeBattle({ ...clone(saved.battle), monsterId: monster.id });
      state.history = Array.isArray(saved.history) ? clone(saved.history) : [];
    } else {
      state.battle = emptyBattle(monster);
      state.history = [];
      initializeBattle(monster);
    }
    mobMarkerAssetId = DEFAULT_MOB_MARKER_ASSET_IDS[monster.id] || "token-01";
    save();
  }

  function usedIds() {
    const b = state.battle;
    const monster = monsterById(b.monsterId);
    const thickSkin = bossRule(monster)?.cards?.thickSkin;
    return new Set([
      ...b.aiDeck, ...b.aiDiscard, ...b.aiRemoved,
      ...b.bpDeck, ...b.bpDiscard, ...b.bpDamage, ...b.bpRemoved,
      ...b.bpTrack.map(slot => slot.id), b.activeAI, b.activeBP,
      ...b.ruleState.aiAttachments.map(item => item.cardId),
      ...b.ruleState.doppelgangers.flatMap(item => item.cards),
      ...b.ruleState.aiChoiceIds, b.ruleState.ruleCard,
      b.ruleState.thickSkinSetAside ? thickSkin : ""
    ].filter(id => id && !String(id).startsWith(WOUND_PREFIX)));
  }

  function supply(monster, kind) {
    const used = usedIds();
    return monster.cards.filter(card => card.kind === kind && !used.has(card.id));
  }

  function takeSupply(monster, kind) {
    const cards = supply(monster, kind);
    return cards.length ? cards[Math.floor(Math.random() * cards.length)].id : "";
  }

  function insertRandom(deck, id) {
    if (id) deck.splice(Math.floor(Math.random() * (deck.length + 1)), 0, id);
  }

  function aibpDeckType(card) {
    const match = String(card?.kind || "").match(/^(AI|BP)/);
    return match ? match[1].toLowerCase() : "";
  }

  function removeAibpCardFromZones(id) {
    const b = state.battle;
    const monster = monsterById(b.monsterId);
    const wasActiveAI = b.activeAI === id;
    const wasInDamage = b.bpDamage.includes(id);
    for (const zone of ["aiDeck", "aiDiscard", "aiRemoved", "bpDeck", "bpDiscard", "bpDamage", "bpRemoved"]) {
      b[zone] = b[zone].filter(cardId => cardId !== id);
    }
    b.bpTrack.forEach((slot, index) => {
      if (slot.id !== id) return;
      slot.id = "";
      slot.revealed = false;
      slot.side = "face";
      slot.markers = 0;
      slot.markerTokens = {};
      slot.decoy = false;
      moveActivationsFromDefeated(index);
    });
    if (b.activeAI === id) b.activeAI = "";
    if (b.activeBP === id) b.activeBP = "";

    const rs = b.ruleState;
    rs.aiAttachments = rs.aiAttachments.filter(item => item.cardId !== id);
    rs.doppelgangers.forEach(item => { item.cards = item.cards.filter(cardId => cardId !== id); });
    rs.aiChoiceIds = rs.aiChoiceIds.filter(cardId => cardId !== id);
    if (rs.recommendedAiId === id) rs.recommendedAiId = "";
    if (rs.ruleCard === id) {
      rs.ruleCard = "";
      rs.ruleCardReason = "";
      rs.pendingRuleAiReason = "";
    }
    if (rs.doppelPreviewCard === id) rs.doppelPreviewCard = "";
    if (rs.thickSkinSetAside && bossRule(monster)?.cards?.thickSkin === id) {
      rs.thickSkinSetAside = false;
    }

    if (wasInDamage) {
      const card = cardById(monster, id);
      if (bpRank(card) === 3 && b.doubleWounds) b.doubleWounds--;
      else if (b.singleWounds) b.singleWounds--;
    }
    if (wasActiveAI && isMob(monster)) completeMobActivation();
  }

  function moveAibpCard(id, destination) {
    const monster = monsterById(state.battle.monsterId);
    if (isWingedNightmare(monster) && isWingedFixedBpId(id)) {
      return toast("翼生梦魇的固定 BP 不能移动或翻面");
    }
    const card = cardById(monster, id);
    const type = aibpDeckType(card);
    const standardDestinations = ["top", "bottom", "shuffle", "discard", "removed"];
    const moveToMobTrack = destination === "mob-left" && type === "bp" && isMob(monster);
    if (!type || (!standardDestinations.includes(destination) && !moveToMobTrack)) {
      return toast("只能移动 AI/BP 卡牌");
    }
    let mobTrackIndex = -1;
    if (moveToMobTrack) {
      mobTrackIndex = state.battle.bpTrack.findIndex(slot => !slot.id);
      const currentTrackIndex = state.battle.bpTrack.findIndex(slot => slot.id === id);
      if (mobTrackIndex < 0 && currentTrackIndex < 0) return toast("杂兵轨已满，无法放置 BP");
      if (mobTrackIndex < 0) mobTrackIndex = currentTrackIndex;
      if (currentTrackIndex === mobTrackIndex) return toast(`该 BP 已位于最左侧可用杂兵轨 ${mobTrackIndex + 1}`);
    }
    remember();
    removeAibpCardFromZones(id);
    const deck = state.battle[`${type}Deck`];
    if (destination === "top") deck.unshift(id);
    if (destination === "bottom") deck.push(id);
    if (destination === "shuffle") insertRandom(deck, id);
    if (destination === "discard") state.battle[`${type}Discard`].push(id);
    if (destination === "removed") state.battle[`${type}Removed`].push(id);
    if (moveToMobTrack) {
      state.battle.bpTrack[mobTrackIndex] = spawnedMobSlot(monster, id);
    }
    const labels = {
      top: "置于抽牌堆顶部", bottom: "置于抽牌堆底部", shuffle: "洗入抽牌堆",
      discard: "弃置", removed: "移除", "mob-left": `放置到最左侧杂兵轨 ${mobTrackIndex + 1}`
    };
    log(`${card.kind} · ${card.name}：${labels[destination]}`);
    save();
  }

  function reshuffleIfEmpty(type) {
    const b = state.battle;
    if (!b[`${type}Deck`].length && b[`${type}Discard`].length) {
      b[`${type}Deck`] = shuffle(b[`${type}Discard`]);
      b[`${type}Discard`] = [];
      log(`${type.toUpperCase()} 弃牌堆洗回牌组`);
      if (type === "ai") ensureWingedAiDiscard(b);
    }
  }

  function draw(type) {
    const monster = monsterById(state.battle.monsterId);
    if (ratwolfSignaturePending()) return toast("请先完成新生狼鼠的标志行为");
    if (type === "bp" && isMob(monster)) return toast("杂兵请从 BP 轨选择目标");
    const active = `active${type.toUpperCase()}`;
    if (state.battle[active]) return toast(`请先处理当前 ${type.toUpperCase()} 卡`);
    if (type === "ai" && bossRule(monster)?.kind === "puppet-king" && state.battle.level >= 4) {
      if (state.battle.ruleState.ruleCard) return toast("请先完成当前惯常行动");
      return revealPuppetTopTwo();
    }
    remember();
    reshuffleIfEmpty(type);
    if (!state.battle[`${type}Deck`].length) {
      if (type === "ai" && bossRule(monster)?.aiPolicy?.failWhenExhausted) {
        failConflict("AI 牌组与弃牌堆均为空");
        log("冲突失败：AI 牌组与弃牌堆均为空");
        return save();
      }
      state.history.pop();
      return toast(`${type.toUpperCase()} 牌组为空`);
    }
    state.battle[active] = state.battle[`${type}Deck`][0];
    log(`抽取 ${type.toUpperCase()}`);
    save();
  }

  function removeActive(type) {
    const b = state.battle;
    const key = `active${type.toUpperCase()}`;
    const id = b[key];
    const deck = b[`${type}Deck`];
    const index = deck.indexOf(id);
    if (index >= 0) deck.splice(index, 1);
    b[key] = "";
    return id;
  }

  function removeKind(monster, type, kind) {
    const b = state.battle;
    for (const zone of [`${type}Deck`, `${type}Discard`]) {
      const index = b[zone].findIndex(id => cardById(monster, id)?.kind === kind);
      if (index < 0) continue;
      const id = b[zone].splice(index, 1)[0];
      b[`${type}Removed`].push(id);
      if (zone.endsWith("Discard")) {
        b[`${type}Deck`] = shuffle([...b[`${type}Deck`], ...b[`${type}Discard`]]);
        b[`${type}Discard`] = [];
      }
      return id;
    }
    return "";
  }

  function promoteSpecific(monster, type, from, to) {
    const replacement = takeSupply(monster, to);
    if (!replacement || !removeKind(monster, type, from)) return false;
    insertRandom(state.battle[`${type}Deck`], replacement);
    return true;
  }

  function promoteHauntAi(monster, targetRank) {
    const b = state.battle;
    const lowestKind = ["AI1", "AI2", "AI3"].find(kind =>
      [...b.aiDeck, ...b.aiDiscard].some(id => cardById(monster, id)?.kind === kind)
    );
    if (!lowestKind) return false;
    return promoteSpecific(monster, "ai", lowestKind, `AI${targetRank}`);
  }

  function placePanzergeistPromotionArmor(monster, reason) {
    if (monster?.id !== "M_Panzergeists" || state.battle.level < 2) return false;
    const target = state.battle.bpTrack.map((slot, index) => ({
      slot, index, rank: bpRank(cardById(monster, slot.id))
    })).filter(item => item.rank).sort((left, right) => left.rank - right.rank || left.index - right.index)[0];
    if (!target) {
      toast("装甲倾泻：杂兵轨没有可放置盔甲指示物的 BP");
      return true;
    }
    remember();
    target.slot.markerTokens ||= {};
    target.slot.markerTokens["token-armor"] = clamp(
      (target.slot.markerTokens["token-armor"] || 0) + 1,
      0,
      MAX_SHEET_TOKENS_PER_TYPE
    );
    const notice = `装甲倾泻：${reason}，已在杂兵轨最低阶 BP${target.rank}（第 ${target.index + 1} 格）放置 1 枚盔甲指示物。`;
    state.battle.ruleState.ruleNotice = notice;
    log(notice);
    save();
    toast(notice);
    return true;
  }

  function promoteLowest(type) {
    const monster = monsterById(state.battle.monsterId);
    if (type === "bp" && isMob(monster)) return promoteMob(monster);
    const prefix = type === "ai" ? "AI" : "BP";
    for (const rank of [1, 2]) {
      const from = `${prefix}${rank}`, to = `${prefix}${rank + 1}`;
      const exists = [...state.battle[`${type}Deck`], ...state.battle[`${type}Discard`]]
        .some(id => cardById(monster, id)?.kind === from);
      if (!exists) continue;
      if (!supply(monster, to).length) {
        if (type === "ai" && placePanzergeistPromotionArmor(monster, `${to} 晋升供应为空`)) return;
        return toast(`${to} 晋升供应为空`);
      }
      remember();
      promoteSpecific(monster, type, from, to);
      log(`${from} 晋升为 ${to}`);
      return save();
    }
    if (type === "ai" && placePanzergeistPromotionArmor(monster, "没有 AI 可供晋升")) return;
    toast(`${prefix} 没有可晋升的低阶卡`);
  }

  function addWound(type, id = "") {
    const double = type === "double";
    state.battle[double ? "doubleWounds" : "singleWounds"]++;
    state.battle.bpDamage.push(id || `${WOUND_PREFIX}${double ? "double" : "single"}:${uid()}`);
    recordWarriorRetribution(id);
  }

  function bpRank(card) {
    const match = String(card?.kind || "").match(/^BP([123])$/);
    return match ? Number(match[1]) : 0;
  }

  function removeLowest(monster, type) {
    const prefix = type === "ai" ? "AI" : "BP";
    return [1, 2, 3].some(rank => Boolean(removeKind(monster, type, `${prefix}${rank}`)));
  }

  function resolveBossBp(monster, id, critical) {
    const card = cardById(monster, id);
    const rank = bpRank(card);
    if (rank === 1 || rank === 2) {
      addWound("single", id);
      insertRandom(state.battle.bpDeck, takeSupply(monster, `BP${rank + 1}`));
      promoteSpecific(monster, "ai", `AI${rank}`, `AI${rank + 1}`);
      return;
    }
    if (rank === 3 && critical) {
      addWound("double", id);
      if (supply(monster, "BP3").length) {
        removeLowest(monster, "bp");
        insertRandom(state.battle.bpDeck, takeSupply(monster, "BP3"));
        insertRandom(state.battle.bpDeck, takeSupply(monster, "BP3"));
      } else {
        state.battle.bpDeck = shuffle([...state.battle.bpDeck, ...state.battle.bpDiscard]);
        state.battle.bpDiscard = [];
      }
    } else if (rank === 3) {
      addWound("double");
      const replacements = supply(monster, "BP3").filter(card => card.id !== id);
      if (replacements.length) {
        removeLowest(monster, "bp");
        insertRandom(state.battle.bpDeck, replacements[Math.floor(Math.random() * replacements.length)].id);
      } else {
        state.battle.bpDeck = shuffle([...state.battle.bpDeck, ...state.battle.bpDiscard]);
        state.battle.bpDiscard = [];
      }
      state.battle.bpDeck.push(id);
    } else {
      addWound("single", id);
    }
    const lowAI = ["AI1", "AI2"].find(kind =>
      [...state.battle.aiDeck, ...state.battle.aiDiscard].some(cardId => cardById(monster, cardId)?.kind === kind)
    );
    if (lowAI) promoteSpecific(monster, "ai", lowAI, "AI3");
  }

  function resolveWingedNightmareAttack(success) {
    const monster = monsterById(state.battle.monsterId);
    if (!isWingedNightmare(monster)) return;
    remember();
    ensureWingedAiDiscard(state.battle);
    const attackingBloodyDefiance = wingedBloodyDefianceActive(state.battle);
    const targetName = attackingBloodyDefiance ? "Bloody Defiance" : "Wide Wings";
    if (!success) {
      log(`${targetName}：未击伤；固定 BP 保持不变`);
      return save();
    }

    addWound("single");
    const totalDamage = state.battle.singleWounds + state.battle.doubleWounds * 2;
    const activatesBloodyDefiance = !attackingBloodyDefiance
      && state.battle.level >= 2
      && state.battle.clashPhase !== "preliminary"
      && totalDamage >= WINGED_BLOODY_DEFIANCE_THRESHOLD;
    if (activatesBloodyDefiance) {
      state.battle.ruleState.wingedNightmare.bloodyDefiance = true;
    }
    const topAi = cardById(monster, state.battle.aiDiscard.at(-1));
    const rank = Number(String(topAi?.kind || "").match(/^AI([123])$/)?.[1] || 0);
    let promoted = false;
    if (rank === 1 || rank === 2) {
      promoted = promoteSpecific(monster, "ai", `AI${rank}`, `AI${rank + 1}`);
    } else if (rank === 3) {
      const lowAI = ["AI1", "AI2"].find(kind =>
        [...state.battle.aiDeck, ...state.battle.aiDiscard]
          .some(id => cardById(monster, id)?.kind === kind)
      );
      if (lowAI) promoted = promoteSpecific(monster, "ai", lowAI, "AI3");
    }
    log(`${targetName}：击伤，加入 1 张单重损伤；按弃牌堆顶 ${topAi?.kind || "AI"}${promoted ? " 晋升 AI" : "，无可执行的 AI 晋升"}${activatesBloodyDefiance ? "；不屈顽抗生效，后续仅攻击 Bloody Defiance" : ""}`);
    if (activatesBloodyDefiance) toast("不屈顽抗生效：后续仅攻击 Bloody Defiance");
    save();
  }

  function resolveWingedAiResponse() {
    const monster = monsterById(state.battle.monsterId);
    if (!isWingedNightmare(monster)) return;
    remember();
    ensureWingedAiDiscard(state.battle);
    const topAi = cardById(monster, state.battle.aiDiscard.at(-1));
    if (!topAi) {
      state.history.pop();
      return toast("AI 牌组与弃牌堆均为空");
    }
    log(`AI Response：结算弃牌堆顶 ${topAi.kind} · ${topAi.name}`);
    save(false);
    showPreview(topAi, "face", false);
  }

  function failConflict(reason) {
    state.battle.conflictStatus = "failed";
    state.battle.failureReason = reason;
    state.battle.ruleState.ruleNotice = reason;
  }

  function queueRuleAi(reason) {
    const b = state.battle;
    if (b.ruleState.ruleCard) {
      b.ruleState.pendingRuleAiReason = reason;
      return false;
    }
    reshuffleIfEmpty("ai");
    if (!b.aiDeck.length) {
      failConflict("AI 牌组与弃牌堆均为空");
      return false;
    }
    b.ruleState.ruleCard = b.aiDeck.shift();
    b.ruleState.ruleCardReason = reason;
    return true;
  }

  function guardianCap(level) {
    return level >= 4 ? 6 : level >= 3 ? 5 : 4;
  }

  function whiteGuardianSlots(guardians) {
    if (!Array.isArray(guardians.slots)) {
      guardians.slots = Array.from({ length: 6 }, (_, index) => index < clamp(guardians.count, 0, 6));
    } else {
      guardians.slots.length = 6;
      for (let index = 0; index < 6; index++) guardians.slots[index] = Boolean(guardians.slots[index]);
    }
    guardians.count = guardians.slots.filter(Boolean).length;
    guardians.carrier = clamp(guardians.carrier, 0, 5);
    return guardians.slots;
  }

  function nextWhiteGuardianIndex(guardians, afterIndex = guardians.carrier) {
    const slots = whiteGuardianSlots(guardians);
    return slots.findIndex((occupied, index) => occupied && index > afterIndex);
  }

  function spawnWhiteGuardians(amount, coordinated = false) {
    const b = state.battle;
    const guardians = b.ruleState.guardians;
    const cap = guardianCap(b.level);
    const slots = whiteGuardianSlots(guardians);
    const spawned = [];
    for (let count = 0; count < Math.max(0, Number(amount) || 0); count++) {
      const index = slots.findIndex((occupied, slotIndex) => slotIndex < cap && !occupied);
      if (index < 0) break;
      slots[index] = true;
      spawned.push(index);
      if (guardians.carrier === index) {
        const next = nextWhiteGuardianIndex(guardians, index);
        guardians.carrier = next >= 0 ? next : 0;
      }
    }
    guardians.count = slots.filter(Boolean).length;
    if (coordinated) b.ruleState.pendingCoordinatedAttacks += spawned.length;
    return spawned;
  }

  function whiteGuardianPlacement(index) {
    return `护卫 ${index + 1} 放到与大红树相邻、尽量靠近巨白猿魔的格子`;
  }

  function whiteVengeanceThreshold(battle = state.battle) {
    return battle.level >= 4 ? 3 : battle.level >= 3 ? 4 : 5;
  }

  function whiteVengeanceActive(battle = state.battle) {
    return battle.monsterId === "M_WhiteApe" && battle.level >= 2;
  }

  function spawnWhiteGuardian() {
    const monster = monsterById(state.battle.monsterId);
    if (bossRule(monster)?.kind !== "white-ape") return;
    if (state.battle.ruleState.pendingCoordinatedAttacks) return toast("请先完成待执行的协同攻击");
    const guardians = state.battle.ruleState.guardians;
    const slots = whiteGuardianSlots(guardians);
    const cap = guardianCap(state.battle.level);
    if (!slots.some((occupied, index) => index < cap && !occupied)) {
      return toast(`先民护卫已达等级上限 ${cap}`);
    }
    remember();
    const [index] = spawnWhiteGuardians(1);
    state.battle.ruleState.ruleNotice = `特殊生成：${whiteGuardianPlacement(index)}；不执行晋升，不加入任何损伤牌。`;
    log(`特殊生成先民护卫 ${index + 1}（无损伤、无晋升）`);
    save();
  }

  function recordWhiteReinforcement(value) {
    const rs = state.battle.ruleState;
    const previous = rs.reinforcementTokens;
    rs.reinforcementTokens = clamp(previous + Math.max(0, Number(value) || 0), 0, 20);
    rs.ruleNotice = rs.reinforcementTokens >= 4
      ? `增援抵达 ${rs.reinforcementTokens}/4：已达到阈值。完成当前行动后，点击指示物结算。`
      : `增援抵达 ${rs.reinforcementTokens}/4。`;
    log(`巨白猿魔增援抵达通用指示物：${rs.reinforcementTokens}/4`);
    if (previous < 4 && rs.reinforcementTokens >= 4) {
      toast("增援抵达达到 4：完成当前行动后点击结算");
    }
  }

  function changeWhiteReinforcementCounter(delta) {
    const b = state.battle;
    if (bossRule(monsterById(b.monsterId))?.kind !== "white-ape") return;
    const next = clamp(b.ruleState.reinforcementTokens + Number(delta || 0), 0, 20);
    if (next === b.ruleState.reinforcementTokens) return;
    remember();
    if (next > b.ruleState.reinforcementTokens) {
      recordWhiteReinforcement(next - b.ruleState.reinforcementTokens);
    } else {
      b.ruleState.reinforcementTokens = next;
      b.ruleState.ruleNotice = `增援抵达 ${next}/4。`;
      log(`巨白猿魔增援抵达通用指示物：${next}/4`);
    }
    save();
  }

  function resolveWhiteReinforcement() {
    const b = state.battle;
    const monster = monsterById(b.monsterId);
    const rs = b.ruleState;
    if (bossRule(monster)?.kind !== "white-ape") return;
    if (rs.reinforcementTokens < 4) return toast("增援抵达达到 4 后才能结算");
    if (b.activeBP || b.activeAI || b.activeMobActivationId || rs.ruleCard
      || rs.pendingCoordinatedAttacks) {
      return toast("请先完成当前行动再结算增援抵达");
    }

    remember();
    rs.reinforcementTokens = 0;
    const guardians = rs.guardians;
    const spawned = spawnWhiteGuardians(1);
    const slots = whiteGuardianSlots(guardians);
    let attacker = spawned[0];
    if (attacker === undefined) {
      const next = nextWhiteGuardianIndex(guardians);
      attacker = next >= 0 ? next : slots.findIndex(Boolean);
    }
    if (attacker >= 0) {
      guardians.carrier = attacker;
      rs.pendingCoordinatedAttacks++;
    }
    if (spawned.length) {
      rs.ruleNotice = `增援抵达已结算：清除全部指示物；${whiteGuardianPlacement(attacker)}；不执行晋升、不加入损伤牌。护卫 ${attacker + 1} 待执行协同攻击。`;
      log(`增援抵达结算：生成护卫 ${attacker + 1} 并待执行协同攻击`);
    } else if (attacker >= 0) {
      rs.ruleNotice = `增援抵达已结算：清除全部指示物；先民护卫已达等级上限 ${guardianCap(b.level)}，改由护卫 ${attacker + 1} 待执行协同攻击。`;
      log(`增援抵达结算：护卫达到上限，改由护卫 ${attacker + 1} 待执行协同攻击`);
    } else {
      rs.ruleNotice = "增援抵达已结算：清除全部指示物；当前没有先民护卫可执行协同攻击。";
      log("增援抵达结算：没有先民护卫可执行协同攻击");
    }
    save();
  }

  function changeWhiteVengeanceCounter(delta) {
    const b = state.battle;
    if (!whiteVengeanceActive(b)) return toast("等级 2+ 才能触发为部落复仇");
    const rs = b.ruleState;
    const threshold = whiteVengeanceThreshold(b);
    const next = clamp(rs.vengeanceTokens + Number(delta || 0), 0, 20);
    if (next === rs.vengeanceTokens) return;
    remember();
    rs.vengeanceTokens = next;
    rs.ruleNotice = next >= threshold
      ? `为部落复仇 ${next}/${threshold}：已达到阈值。完成当前行动后，点击指示物结算 AI 顶牌。`
      : `为部落复仇 ${next}/${threshold}。`;
    log(`巨白猿魔为部落复仇通用指示物：${next}/${threshold}`);
    if (next >= threshold && next - Number(delta || 0) < threshold) {
      toast("为部落复仇达到阈值：完成当前行动后点击结算");
    }
    save();
  }

  function resolveWhiteVengeance() {
    const b = state.battle;
    const rs = b.ruleState;
    if (!whiteVengeanceActive(b)) return;
    const threshold = whiteVengeanceThreshold(b);
    if (rs.vengeanceTokens < threshold) return toast(`为部落复仇达到 ${threshold} 后才能结算`);
    if (b.activeBP || b.activeAI || b.activeMobActivationId || rs.ruleCard
      || rs.pendingCoordinatedAttacks) {
      return toast("请先完成当前行动再结算为部落复仇");
    }
    remember();
    rs.vengeanceTokens = 0;
    const queued = queueRuleAi("为部落复仇");
    if (queued) {
      rs.ruleNotice = "为部落复仇已结算：清除全部指示物，结算 AI 牌组顶牌。";
      log("为部落复仇结算：清除全部指示物并结算 AI 顶牌");
    } else {
      log("为部落复仇结算：清除全部指示物，但没有可结算的 AI 顶牌");
    }
    save();
  }

  function cookieCrumbsActive(battle = state.battle) {
    return battle.monsterId === "M_BogWitch" && battle.level >= 3;
  }

  function recordCookieCrumbs(value) {
    if (!cookieCrumbsActive()) return;
    state.battle.ruleState.cookieTokens += Math.max(0, Number(value) || 0);
  }

  function recordBossWoundCounters(monster, id, woundValue = 0) {
    const rule = bossRule(monster);
    const rank = bpRank(cardById(monster, id));
    if (rule?.kind === "white-ape") {
      const value = id === rule.cards.thickSkin ? 1 : (rank === 3 ? 2 : 1);
      recordWhiteReinforcement(value);
    }
    if (rule?.kind === "bog-witch") recordCookieCrumbs(rank === 3 ? 2 : 1);
    recordP2WoundCounters(monster, woundValue);
  }

  function promoteAfterSpecialWound(monster, rank) {
    if (rank === 1 || rank === 2) {
      insertRandom(state.battle.bpDeck, takeSupply(monster, `BP${rank + 1}`));
      promoteSpecific(monster, "ai", `AI${rank}`, `AI${rank + 1}`);
      return;
    }
    const lowAI = ["AI1", "AI2"].find(kind =>
      [...state.battle.aiDeck, ...state.battle.aiDiscard]
        .some(id => cardById(monster, id)?.kind === kind)
    );
    if (lowAI) promoteSpecific(monster, "ai", lowAI, "AI3");
  }

  function resolveYoungDevourWound(monster, id, critical) {
    const rank = bpRank(cardById(monster, id));
    if (rank === 3 && !critical) {
      addWound("double");
      state.battle.bpDeck.push(id);
    } else {
      addWound(rank === 3 ? "double" : "single", id);
    }
    state.battle.ruleState.ruleNotice = "本次击伤已跳过全部 AI/BP 晋升与替换。";
  }

  function resolvePuppetFinger(monster, id) {
    const finger = bossRule(monster)?.fingers?.[id];
    if (!finger) return false;
    const b = state.battle;
    if (finger.effect === "single" || finger.effect === "double") {
      addWound(finger.effect, id);
      if (finger.promote) promoteAfterSpecialWound(monster, bpRank(cardById(monster, id)));
      b.ruleState.ruleNotice = `${finger.name}：加入${finger.effect === "double" ? "双重" : "单重"}损伤${finger.promote ? "，并执行允许的标准晋升" : ""}。`;
    } else {
      b.bpRemoved.push(id);
      b.ruleState.ruleNotice = `${finger.name}：不加入伤口牌；请按大卡确认地形与陨落骑士效果。`;
    }
    return true;
  }

  function resolveSpecialBossBp(monster, id, action) {
    if (!["defeat", "critical"].includes(action)) return false;
    const rule = bossRule(monster);
    if (rule?.kind === "knighteater" && state.battle.level >= 4
      && state.battle.ruleState.knighteater.berserk) {
      state.battle.bpDiscard.push(id);
      state.battle.ruleState.ruleNotice = "凶暴防守：本次攻击按未造成损伤结算；不加入伤口，也不执行晋升。";
      return true;
    }
    if (rule?.kind === "stonemason") {
      const stone = state.battle.ruleState.stonemason;
      if (state.battle.level >= 3 && stone.armor[stone.direction] >= 2) {
        state.battle.bpDiscard.push(id);
        state.battle.ruleState.ruleNotice = "坚不可摧的盔甲：该方向有至少 2 枚盔甲，本次攻击按未造成损伤结算。";
        return true;
      }
    }
    if (rule?.kind === "devour-stages") {
      resolveYoungDevourWound(monster, id, action === "critical");
      return true;
    }
    if (rule?.kind === "white-ape" && id === rule.cards.thickSkin) {
      state.battle.ruleState.thickSkinSetAside = true;
      state.battle.ruleState.ruleNotice = "厚皮已置于专用区域；不加入损伤，也不执行晋升。";
      return true;
    }
    if (rule?.kind === "panzer-colony") {
      state.battle.bpDiscard.push(id);
      state.battle.ruleState.ruleCard = rule.cards.mortalRetribution;
      state.battle.ruleState.ruleCardReason = "装甲巨龙：巨龙受伤";
      state.battle.ruleState.ruleNotice = "巨龙特殊 BP 已结算：不加入伤口、不晋升；请处理显示卡面的后续规则。";
      return true;
    }
    if (rule?.kind === "puppet-king" && resolvePuppetFinger(monster, id)) return true;
    return false;
  }

  function settle(type, action) {
    const monster = monsterById(state.battle.monsterId);
    const activeKey = `active${type.toUpperCase()}`;
    if (!state.battle[activeKey]) return toast(`当前没有 ${type.toUpperCase()} 卡`);
    const activeCard = cardById(monster, state.battle[activeKey]);
    const resolvingAi0 = type === "ai" && activeCard?.kind === "AI0";
    if (type === "bp" && isMob(monster)) return settleMob(monster, action);
    if (type === "bp" && ["defeat", "critical"].includes(action)
      && bossRule(monster)?.kind === "panzer-colony" && state.battle.ruleState.ruleCard) {
      return toast("请先完成当前特殊卡面处理");
    }
    remember();
    const woundValueBefore = state.battle.singleWounds + state.battle.doubleWounds * 2;
    const stoneDirection = state.battle.ruleState.stonemason.direction;
    const stoneArmorBefore = state.battle.ruleState.stonemason.armor[stoneDirection];
    const id = removeActive(type);
    if (resolvingAi0) state.battle.aiRemoved.push(id);
    else {
      if (action === "discard") state.battle[`${type}Discard`].push(id);
      if (action === "removed") state.battle[`${type}Removed`].push(id);
      if (action === "bottom") state.battle[`${type}Deck`].push(id);
    }
    if (type === "bp" && ["defeat", "critical"].includes(action)
      && !resolveSpecialBossBp(monster, id, action)) {
      resolveBossBp(monster, id, action === "critical");
    }
    if (type === "bp" && ["defeat", "critical"].includes(action)
      && bossRule(monster)?.kind === "stonemason") {
      finishStonemasonAttack(stoneDirection, stoneArmorBefore);
    }
    if (type === "bp" && ["defeat", "critical"].includes(action)) {
      const woundValueAfter = state.battle.singleWounds + state.battle.doubleWounds * 2;
      recordBossWoundCounters(monster, id, Math.max(0, woundValueAfter - woundValueBefore));
    }
    log(`${activeCard?.kind || type.toUpperCase()}：${resolvingAi0 ? "首次结算后移出游戏" : action}`);
    if (type === "ai" && isMob(monster)) completeMobActivation();
    save();
  }

  function advanceDevourStage() {
    const monster = monsterById(state.battle.monsterId);
    const rule = bossRule(monster);
    const b = state.battle;
    const nextIndex = b.ruleState.phaseIndex + 1;
    const nextStage = rule?.stages?.find(stage => stage.id === b.ruleState.phaseIds[nextIndex]);
    if (!nextStage) return toast("已经是最后阶段");
    if (b.activeAI || b.activeBP) return toast("请先处理当前 AI/BP，再推进阶段");
    remember();
    const previousTier = nextStage.tier - 1;
    for (const [type, prefix] of [["ai", "AI"], ["bp", "BP"]]) {
      const oldKind = `${prefix}${previousTier}`;
      for (const zone of [`${type}Deck`, `${type}Discard`]) {
        const kept = [];
        for (const id of b[zone]) {
          if (cardById(monster, id)?.kind === oldKind) b[`${type}Removed`].push(id);
          else kept.push(id);
        }
        b[zone] = kept;
      }
      const newKind = `${prefix}${nextStage.tier}`;
      b[`${type}Deck`] = shuffle([...b[`${type}Deck`], ...b[`${type}Discard`], ...supply(monster, newKind).map(card => card.id)]);
      b[`${type}Discard`] = [];
    }
    b.ruleState.phaseIndex = nextIndex;
    b.ruleState.ruleNotice = `已进入${nextStage.name}：移除上一阶段 AI/BP，并加入全部 ${nextStage.tier} 阶牌。`;
    log(`阶段推进：${nextStage.name}`);
    save();
  }

  function startWhiteApeRound() {
    const monster = monsterById(state.battle.monsterId);
    const rule = bossRule(monster);
    const b = state.battle;
    if (b.activeBP) return toast("请先处理当前 BP");
    if (b.ruleState.pendingCoordinatedAttacks) return toast("请先完成待执行的协同攻击");
    remember();
    const thickSkin = rule.cards.thickSkin;
    for (const zone of ["bpDeck", "bpDiscard", "bpRemoved"]) {
      b[zone] = b[zone].filter(id => id !== thickSkin);
    }
    b.bpDeck.unshift(thickSkin);
    b.ruleState.thickSkinSetAside = false;
    const cap = guardianCap(b.level);
    const spawnAmount = b.level >= 3 ? 2 : 1;
    const spawned = spawnWhiteGuardians(spawnAmount);
    const guardians = b.ruleState.guardians;
    const slots = whiteGuardianSlots(guardians);
    const attacker = slots[guardians.carrier] ? guardians.carrier : -1;
    if (attacker >= 0) b.ruleState.pendingCoordinatedAttacks++;
    const spawnNotice = spawned.length
      ? `特殊生成 ${spawned.length} 只：${spawned.map(whiteGuardianPlacement).join("；")}${spawned.length < spawnAmount ? `；护卫已达等级上限 ${cap}` : ""}`
      : `护卫已达等级上限 ${cap}，取消生成`;
    b.ruleState.ruleNotice = `厚皮已置顶；${spawnNotice}。${attacker >= 0 ? `护卫 ${attacker + 1} 待执行协同攻击。` : "当前没有护卫对应共享 BP。"}`;
    log(`巨白猿魔新回合：${spawned.length ? `生成护卫 ${spawned.map(index => index + 1).join("、")}` : "护卫达到上限"}${attacker >= 0 ? `，护卫 ${attacker + 1} 待协同攻击` : ""}`);
    save();
  }

  function passGuardianBp() {
    if (state.battle.ruleState.pendingCoordinatedAttacks) return toast("请先完成待执行的协同攻击");
    const guardians = state.battle.ruleState.guardians;
    const next = nextWhiteGuardianIndex(guardians);
    const target = next >= 0 ? next : 0;
    if (target === guardians.carrier) return toast("共享 BP 已位于杂兵轨最左侧，右侧没有可传递的护卫");
    remember();
    guardians.carrier = target;
    state.battle.ruleState.ruleNotice = next >= 0
      ? `BP 已传递给护卫 ${target + 1}。`
      : "右侧没有可传递的护卫，共享 BP 已放回杂兵轨最左侧。";
    log(`先民护卫 BP ${next >= 0 ? `传递至 ${target + 1} 号` : "放回杂兵轨最左侧"}`);
    save();
  }

  function resolveGuardianAttack() {
    const rs = state.battle.ruleState;
    if (!rs.pendingCoordinatedAttacks) return toast("当前没有待执行的协同攻击");
    const guardians = rs.guardians;
    const slots = whiteGuardianSlots(guardians);
    const attacker = guardians.carrier;
    if (!slots[attacker]) return toast("共享 BP 当前没有对应场上的先民护卫");
    remember();
    rs.pendingCoordinatedAttacks--;
    const next = nextWhiteGuardianIndex(guardians, attacker);
    guardians.carrier = next >= 0 ? next : 0;
    rs.ruleNotice = `护卫 ${attacker + 1} 已执行协同攻击${next >= 0 ? `；共享 BP 已传给护卫 ${next + 1}` : "；右侧没有可用位置，共享 BP 已放回杂兵轨最左侧"}。${rs.pendingCoordinatedAttacks ? `剩余 ${rs.pendingCoordinatedAttacks} 次待执行。` : ""}`;
    log(`先民护卫 ${attacker + 1} 协同攻击，BP ${next >= 0 ? `传至 ${next + 1} 号` : "放回杂兵轨最左侧"}`);
    save();
  }

  function defeatGuardian(index) {
    if (state.battle.ruleState.pendingCoordinatedAttacks) return toast("请先完成待执行的协同攻击");
    const guardians = state.battle.ruleState.guardians;
    const slots = whiteGuardianSlots(guardians);
    if (index < 0 || index >= slots.length || !slots[index]) return;
    remember();
    const carriedBp = guardians.carrier === index;
    slots[index] = false;
    guardians.count = slots.filter(Boolean).length;
    if (carriedBp) {
      const next = nextWhiteGuardianIndex(guardians, index);
      guardians.carrier = next >= 0 ? next : 0;
    }
    const rs = state.battle.ruleState;
    const deathNotice = `护卫 ${index + 1} 死亡：不加入 Boss 损伤、不晋升${carriedBp ? `；共享 BP ${guardians.carrier ? `传给护卫 ${guardians.carrier + 1}` : "移回杂兵轨最左侧"}` : ""}`;
    if (whiteVengeanceActive()) {
      const threshold = whiteVengeanceThreshold();
      rs.vengeanceTokens = clamp(rs.vengeanceTokens + 1, 0, 20);
      rs.ruleNotice = rs.vengeanceTokens >= threshold
        ? `${deathNotice}；为部落复仇 ${rs.vengeanceTokens}/${threshold} 已达到阈值，完成当前行动后点击指示物结算。`
        : `${deathNotice}；为部落复仇 ${rs.vengeanceTokens}/${threshold}。`;
      if (rs.vengeanceTokens === threshold) {
        toast("为部落复仇达到阈值：完成当前行动后点击结算");
      }
    } else {
      rs.ruleNotice = `${deathNotice}。`;
    }
    log(`先民护卫 ${index + 1} 死亡（无 Boss 损伤、无晋升）`);
    save();
  }

  function spawnDoppelganger(options = {}) {
    const b = state.battle;
    const needed = b.level >= 3 ? 2 : 1;
    const initial = Boolean(options.initial);
    if (!initial) remember();
    if (b.bpDeck.length < needed) {
      failConflict(`生成拟身骑士需要 ${needed} 张 BP，但牌组不足`);
      log(`冲突失败：生成拟身骑士时 BP 不足 ${needed} 张`);
      if (!initial) save();
      return false;
    }
    const cards = b.bpDeck.splice(0, needed);
    b.ruleState.doppelgangers.push({ id: `doppel-${uid()}`, cards, revealed: false });
    b.ruleState.ruleNotice = `${initial ? "冲突开始" : "已生成拟身骑士"}：叠放 ${needed} 张面朝下 BP；顶牌优先结算。`;
    log(`${initial ? "冲突开始，生成" : "生成"}拟身骑士（${needed} 张 BP）`);
    if (!initial) save();
    return true;
  }

  function defeatDoppelganger(id) {
    const monster = monsterById(state.battle.monsterId);
    const list = state.battle.ruleState.doppelgangers;
    const index = list.findIndex(item => item.id === id);
    if (index < 0) return;
    remember();
    const doppel = list[index];
    doppel.cards.forEach(cardId => resolveBossBp(monster, cardId, false));
    list.splice(index, 1);
    if (state.battle.ruleState.doppelPreviewCard && doppel.cards.includes(state.battle.ruleState.doppelPreviewCard)) {
      state.battle.ruleState.doppelPreviewCard = "";
    }
    const gainsArmor = state.battle.level >= 2;
    if (gainsArmor) {
      state.battle.ruleState.knightFen.armor = clamp(state.battle.ruleState.knightFen.armor + 1, 0, 99);
    }
    const armorNotice = gainsArmor ? `，吸收亡者获得 1 枚盔甲（当前 ${state.battle.ruleState.knightFen.armor}）` : "";
    state.battle.ruleState.ruleNotice = `拟身骑士死亡：${doppel.cards.length} 张 BP 已同时计伤，并按顶牌优先完成晋升${armorNotice}。`;
    log(`拟身骑士死亡，结算 ${doppel.cards.length} 张 BP${armorNotice}`);
    save();
  }

  function toggleDoppelgangerCards(id) {
    const doppel = state.battle.ruleState.doppelgangers.find(item => item.id === id);
    if (!doppel) return;
    remember();
    const topCard = doppel.cards[0] || "";
    doppel.revealed = !doppel.revealed;
    state.battle.ruleState.doppelPreviewCard = doppel.revealed ? topCard : "";
    state.battle.ruleState.ruleNotice = doppel.revealed
      ? `拟身骑士的 ${doppel.cards.length} 张 BP 已一起翻至正面。`
      : `拟身骑士的 ${doppel.cards.length} 张 BP 已一起翻回背面。`;
    log(`拟身骑士全部 BP 翻至${doppel.revealed ? "正面" : "背面"}`);
    save();
  }

  function toggleDoppelgangerTop(id) {
    return toggleDoppelgangerCards(id);
  }

  function failDoppelganger(id) {
    return toggleDoppelgangerCards(id);
  }

  function promoteLowestPair(monster) {
    const b = state.battle;
    const rank = [1, 2].find(value =>
      [...b.bpDeck, ...b.bpDiscard].some(id => cardById(monster, id)?.kind === `BP${value}`)
    );
    if (!rank) return false;
    const promotedBp = promoteSpecific(monster, "bp", `BP${rank}`, `BP${rank + 1}`);
    if (promotedBp) promoteSpecific(monster, "ai", `AI${rank}`, `AI${rank + 1}`);
    return promotedBp;
  }

  function damagePuppetFallenKnight() {
    const monster = monsterById(state.battle.monsterId);
    if (bossRule(monster)?.kind !== "puppet-king") return;
    const puppet = state.battle.ruleState.puppetKing;
    remember();
    puppet.fallenKnightTokens++;
    if (puppet.fallenKnightTokens >= 2) {
      puppet.fallenKnightTokens = 0;
      addWound("single");
      const promoted = promoteLowestPair(monster);
      state.battle.ruleState.ruleNotice = `陨落骑士累计 2 枚通用指示物：已弃置全部指示物、加入 1 张单重损伤${promoted ? "并晋升 1 次" : "；当前没有可执行的晋升"}。`;
      log(`陨落骑士结算：单重损伤${promoted ? "并晋升 1 次" : "，无可用晋升"}`);
    } else {
      state.battle.ruleState.ruleNotice = "陨落骑士受到损伤：放置 1 枚通用指示物（1/2）。";
      log("陨落骑士：通用指示物 1/2");
    }
    save();
  }

  function changePuppetArmor(delta) {
    const monster = monsterById(state.battle.monsterId);
    if (bossRule(monster)?.kind !== "puppet-king") return;
    const puppet = state.battle.ruleState.puppetKing;
    const amount = Number(delta) || 0;
    if (!amount || (amount < 0 && !puppet.armor)) return;
    remember();
    const next = clamp(puppet.armor + amount, 0, 99);
    if (next >= 5) {
      puppet.armor = 0;
      state.battle.ruleState.ruleNotice = "盔甲指示物达到 5：已弃置全部盔甲指示物；所有骑士获得灾祸 5。";
      log("Puppet King Edelhardt：弃置 5 枚盔甲，所有骑士灾祸 5");
      save();
      return toast("所有骑士获得灾祸 5");
    }
    puppet.armor = next;
    log(`Puppet King Edelhardt 盔甲：${next}/5`);
    save();
  }

  function revealPuppetTopTwo() {
    const b = state.battle;
    if (b.activeAI || b.ruleState.aiChoiceIds.length) return toast("请先处理当前 AI 选择");
    remember();
    if (b.aiDeck.length < 2 && b.aiDiscard.length) {
      b.aiDeck = [...b.aiDeck, ...shuffle(b.aiDiscard)];
      b.aiDiscard = [];
    }
    if (!b.aiDeck.length) {
      state.history.pop();
      return toast("AI 牌组为空");
    }
    b.ruleState.aiChoiceIds = b.aiDeck.splice(0, 2);
    b.ruleState.aiChoiceMode = "choose";
    b.ruleState.recommendedAiId = "";
    b.ruleState.ruleNotice = "展示 AI 牌组顶端两张牌：选择执行其中一张，或执行惯常行动。";
    log("Puppet King Edelhardt：展示牌组顶端两张 AI");
    save();
  }

  function choosePuppetAi(id) {
    const b = state.battle;
    if (!b.ruleState.aiChoiceIds.includes(id)) return;
    remember();
    const unchosen = b.ruleState.aiChoiceIds.filter(cardId => cardId !== id);
    b.aiDeck.unshift(...unchosen);
    b.activeAI = id;
    b.ruleState.aiChoiceIds = [];
    b.ruleState.recommendedAiId = "";
    b.ruleState.aiChoiceMode = "choose";
    b.ruleState.ruleNotice = "已选择执行一张 AI；另一张已按原顺序放回牌组顶。";
    log("Puppet King Edelhardt：选择 1 张 AI 结算");
    save();
  }

  function executePuppetRoutine() {
    const monster = monsterById(state.battle.monsterId);
    const b = state.battle;
    if (!b.ruleState.aiChoiceIds.length) return;
    remember();
    b.aiDeck.unshift(...b.ruleState.aiChoiceIds);
    b.ruleState.aiChoiceIds = [];
    b.ruleState.aiChoiceMode = "choose";
    b.ruleState.recommendedAiId = "";
    b.ruleState.ruleCard = bossRule(monster).aiPriority.routineCard;
    b.ruleState.ruleCardReason = "四级能力：惯常行动";
    b.ruleState.ruleNotice = "两张 AI 已按原顺序放回牌组顶；执行惯常行动。";
    log("Puppet King Edelhardt：执行惯常行动");
    save();
  }

  function attachBogAi(holder) {
    const b = state.battle;
    if (!b.activeAI) return toast("当前没有可附着的 AI");
    holder = String(holder || "骑士").trim() || "骑士";
    remember();
    const incoming = removeActive("ai");
    b.ruleState.aiAttachments.push({ id: `attach-${uid()}`, cardId: incoming, holder });
    const holderCount = b.ruleState.aiAttachments.filter(item => item.holder === holder).length;
    b.ruleState.ruleNotice = `AI 已附着到${holder}（共 ${holderCount} 张），未进入弃牌堆。`;
    log(`AI 附着：${holder}`);
    save();
  }

  function returnBogAttachment(id) {
    const list = state.battle.ruleState.aiAttachments;
    const index = list.findIndex(item => item.id === id);
    if (index < 0) return;
    remember();
    const attachment = list.splice(index, 1)[0];
    state.battle.aiDiscard.push(attachment.cardId);
    state.battle.ruleState.ruleNotice = `${attachment.holder}的附着 AI 已手动归还弃牌堆。`;
    log(`归还附着 AI：${attachment.holder}`);
    save();
  }

  function hiddenBogBpTop(index) {
    if (!state.battle.bpDeck.length) return toast("BP 牌组为空");
    const position = clamp(index, 0, state.battle.bpDeck.length - 1);
    remember();
    const [selected] = state.battle.bpDeck.splice(position, 1);
    state.battle.bpDeck.unshift(selected);
    state.battle.ruleState.ruleNotice = `已选择第 ${position + 1} 张面朝下 BP 置顶；其余卡牌顺序未改变。`;
    log("沼地女巫：面朝下选择 BP 置顶");
    save();
  }

  function bogBpCandidateLabel(monster, cardId, index) {
    const level = String(cardById(monster, cardId)?.kind || "").match(/^BP([1-3])$/)?.[1] || "未知";
    return `候选 ${index + 1}（等级 ${level}）`;
  }

  function settleCookieCrumbs() {
    const b = state.battle;
    if (!cookieCrumbsActive(b)) return toast("Cookie Crumbs 仅在沼地女巫等级 3 及以上激活");
    const count = b.ruleState.cookieTokens;
    if (b.ruleState.ruleCard) return toast("请先完成当前特殊卡面处理");
    remember();
    if (count >= 9) {
      b.ruleState.ruleCard = monsterById(b.monsterId).cards.find(card => card.kind === "SIG")?.id || "";
      b.ruleState.ruleCardReason = "Cookie Crumbs：标志行为";
      b.ruleState.pendingRuleAiReason = "Cookie Crumbs：AI 顶牌";
      b.ruleState.ruleNotice = "Cookie Crumbs 9+：先执行标志行为，完成后自动展示 AI 顶牌。";
    } else if (count >= 6) {
      queueRuleAi("Cookie Crumbs：AI 顶牌");
      b.ruleState.ruleNotice = "Cookie Crumbs 6–8：结算 AI 顶牌。";
    } else if (count >= 3) {
      b.ruleState.ruleCard = monsterById(b.monsterId).cards.find(card => card.kind === "SIG")?.id || "";
      b.ruleState.ruleCardReason = "Cookie Crumbs：标志行为";
      b.ruleState.ruleNotice = "Cookie Crumbs 3–5：执行标志行为。";
    } else {
      b.ruleState.ruleNotice = "Cookie Crumbs 0–2：本轮无额外效果。";
    }
    log(`Cookie Crumbs：伤口数 ${count}`);
    save();
  }

  function panzerAttack(target) {
    const monster = monsterById(state.battle.monsterId);
    const rule = bossRule(monster);
    if (state.battle.ruleState.ruleCard) return toast("请先完成当前特殊卡面处理");
    const cardId = target === "field" ? rule.cards.field : rule.cards.remnant;
    remember();
    state.battle.ruleState.ruleCard = cardId;
    state.battle.ruleState.ruleCardReason = `装甲巨龙：${rule.labels[target]}受伤`;
    state.battle.ruleState.ruleNotice = `${rule.labels[target]}受伤：不加入伤口、不晋升；请处理显示卡面的后续规则。`;
    log(`${rule.labels[target]}受伤（无损伤、无晋升）`);
    save();
  }

  function changePanzerArmor(target, delta) {
    if (!Object.hasOwn(state.battle.ruleState.panzerArmor, target)) return;
    const rs = state.battle.ruleState;
    const armor = rs.panzerArmor;
    const amount = Number(delta || 0);
    if (!amount) return;
    if (amount < 0) {
      if (!armor[target]) return toast("该处盔甲已为空");
      if (rs.panzerRetributionArmor >= 8) return toast("现行现报已有 8 枚盔甲，请先点击弃置");
      const removed = Math.min(armor[target], Math.abs(amount), 8 - rs.panzerRetributionArmor);
      remember();
      armor[target] -= removed;
      rs.panzerRetributionArmor += removed;
      rs.ruleNotice = `从${bossRule(monsterById(state.battle.monsterId))?.labels[target] || target}弃置盔甲 ${removed} 枚；现行现报 ${rs.panzerRetributionArmor}/8。`;
      log(`装甲巨龙：${target} 弃置盔甲 ${removed}，现行现报 ${rs.panzerRetributionArmor}/8`);
      return save();
    }
    const before = armor[target];
    const next = clamp(before + amount, 0, 20);
    if (next === before) return;
    remember();
    armor[target] = next;
    log(`盔甲：${target} +${next - before}`);
    save();
  }

  function clearPanzerRetributionArmor() {
    const rs = state.battle.ruleState;
    if (state.battle.monsterId !== "M_Panzerdragon" || rs.panzerRetributionArmor < 8) {
      return toast("现行现报需要 8 枚盔甲才能弃置");
    }
    remember();
    rs.panzerRetributionArmor = 0;
    rs.ruleNotice = "";
    log("装甲巨龙：现行现报弃置全部 8 枚盔甲");
    save();
  }

  function migratePanzerArmor() {
    remember();
    const armor = state.battle.ruleState.panzerArmor;
    const previous = { ...armor };
    armor.field = previous.remnant;
    armor.dragon = previous.field;
    armor.remnant = previous.dragon;
    state.battle.ruleState.ruleNotice = "盔甲已按 虫阵 → 巨龙 → 残余 → 虫阵 循环迁移。";
    log("装甲巨龙：循环迁移盔甲");
    save();
  }

  function discardTopAi(count, reason = "规则弃置", target = "") {
    const b = state.battle;
    const amount = clamp(count, 1, 20);
    if (b.activeAI) return toast("请先处理当前 AI");
    if (!b.aiDeck.length) return toast("AI 牌组为空");
    remember();
    const discarded = b.aiDeck.splice(0, amount);
    b.aiDiscard.push(...discarded);
    const source = target ? `${target} · ${reason}` : reason;
    b.ruleState.ruleNotice = `${source}：已将牌组顶 ${discarded.length} 张 AI 面朝下弃置；真实 ID 仅保存在状态中。`;
    log(`蟾蜍龙：${source}，面朝下弃置 AI ×${discarded.length}`);
    save();
  }

  function favoriteChild() {
    const b = state.battle;
    if (b.activeAI || b.ruleState.ruleCard) return toast("请先处理当前规则卡");
    remember();
    reshuffleIfEmpty("ai");
    if (!b.aiDeck.length) {
      state.history.pop();
      return toast("AI 牌组为空");
    }
    b.ruleState.ruleCard = b.aiDeck.shift();
    b.ruleState.ruleCardReason = "最爱幼崽";
    b.ruleState.ruleNotice = "结算这张 AI 后点击完成；它将以隐藏卡面进入弃牌区。";
    log("蟾蜍龙：结算最爱幼崽");
    save();
  }

  function completeRuleCard() {
    const b = state.battle;
    if (!b.ruleState.ruleCard) return;
    remember();
    const ruleCardId = b.ruleState.ruleCard;
    const ruleCardKind = cardById(monsterById(b.monsterId), ruleCardId)?.kind || "";
    if (ruleCardKind === "AI0") b.aiRemoved.push(ruleCardId);
    else if (/^AI[1-3]$/.test(ruleCardKind)) b.aiDiscard.push(ruleCardId);
    b.ruleState.ruleCard = "";
    b.ruleState.ruleCardReason = "";
    const pendingAi = b.ruleState.pendingRuleAiReason;
    b.ruleState.pendingRuleAiReason = "";
    if (pendingAi) {
      const queued = queueRuleAi(pendingAi);
      b.ruleState.ruleNotice = queued ? "前一项处理完成；继续结算 AI 顶牌。" : b.failureReason;
    } else {
      b.ruleState.ruleNotice = "专用卡面处理完成。";
    }
    log("完成专用卡面处理");
    save();
  }

  function patientLetter(monster, id) {
    return bossRule(monster)?.patientCards?.find(card => card.id === id)?.letter || "?";
  }

  function severityBand(monster, severity) {
    const value = clamp(severity, 0, 9);
    return bossRule(monster)?.severityBands?.find(band => value >= band.min && value <= band.max)?.wound || "";
  }

  function woundBandLabel(value) {
    return ({ light: "轻型", heavy: "重型", fatal: "致命", judgment: "审判" })[value] || value;
  }

  function setKnightSeverity(name, severity) {
    name = String(name || "当前骑士").trim() || "当前骑士";
    remember();
    const value = clamp(severity, 0, 9);
    state.battle.ruleState.severityByKnight[name] = value;
    state.battle.ruleState.activeKnight = name;
    const woundClass = severityBand(monsterById(state.battle.monsterId), value);
    state.battle.ruleState.ruleNotice = `${name}烈度设为 ${value}；下一次抽伤使用${woundBandLabel(woundClass)}伤口。`;
    log(`烈度：${name} = ${value}`);
    save();
  }

  function finishAncientBargain() {
    const b = state.battle;
    const patient = b.ruleState.patient;
    const letters = patient.drawn.map(id => patientLetter(monsterById(b.monsterId), id));
    const pillarGain = Math.floor(patient.drawn.length / 2);
    b.ruleState.ancientDusk.pillars += pillarGain;
    patient.discard.push(...patient.drawn);
    patient.drawn = [];
    patient.queue = [];
    patient.stage = "idle";
    patient.stopReason = "";
    if (letters.includes("C")) {
      patient.deck = shuffle([...patient.deck, ...patient.discard]);
      patient.discard = [];
    }
    b.ruleState.ruleNotice = `讨价还价完成：放置 ${pillarGain} 块石柱${letters.includes("C") ? "；因抽到 C，Patient 弃牌已洗回牌组" : ""}。`;
  }

  function ancientBargain(count, target = "") {
    const b = state.battle;
    const patient = b.ruleState.patient;
    const amount = clamp(count, 1, 12);
    if (patient.stage !== "idle") return toast("请先完成当前 Patient 结算");
    remember();
    b.ruleState.ancientDusk.disaster++;
    patient.target = String(target || b.ruleState.activeKnight || "当前骑士");
    if (patient.deck.length < amount) {
      failConflict(`远古薄暮恶魔需要抽取 ${amount} 张 Patient，但牌组仅剩 ${patient.deck.length} 张`);
      log("冲突失败：Patient 牌数量不足");
      return save();
    }
    patient.drawn = patient.deck.splice(0, amount);
    const counts = {};
    patient.drawn.forEach(id => {
      const letter = patientLetter(monsterById(b.monsterId), id);
      counts[letter] = (counts[letter] || 0) + 1;
    });
    patient.queue = ["A", "B", "C", "D", "E", "F"].filter(letter => counts[letter] >= 2);
    patient.stage = "resolving";
    patient.stopReason = "已按相同字母组成对子，每种字母只结算一次";
    b.ruleState.ruleNotice = patient.queue.length
      ? `抽取完成：依次确认 ${patient.queue.join("、")} 对效果。`
      : "没有形成字母对子；点击完成以弃置抽牌并放置石柱。";
    log(`远古薄暮讨价还价：抽取 Patient ×${amount}`);
    save();
  }

  function drawSmeltedPatient(target = "") {
    const b = state.battle;
    const patient = b.ruleState.patient;
    if (patient.stage === "resolving") return toast("请先完成当前 Patient 效果");
    const bargainTarget = String(target || b.ruleState.activeKnight || "当前骑士");
    if (patient.stage === "idle" && b.ruleState.smeltedFears.gateHolders.includes(bargainTarget)) {
      return toast("持有门禁标记的骑士不能讨价还价");
    }
    remember();
    if (patient.stage === "idle") {
      patient.stage = "drawing";
      patient.target = bargainTarget;
      patient.drawn = [];
      patient.queue = [];
      b.ruleState.smeltedFears.disaster++;
    }
    if (!patient.deck.length && patient.discard.length) {
      patient.deck = shuffle(patient.discard);
      patient.discard = [];
      patient.stopReason = "Patient 弃牌已洗回牌组";
    }
    if (!patient.deck.length) {
      failConflict("Patient 牌组与弃牌堆均为空");
      log("冲突失败：Patient 牌耗尽");
      return save();
    }
    const id = patient.deck.shift();
    patient.drawn.push(id);
    const letter = patientLetter(monsterById(b.monsterId), id);
    if (letter === "A" || letter === "B") {
      patient.queue = patient.drawn.map(cardId => patientLetter(monsterById(b.monsterId), cardId)).reverse();
      patient.stage = "resolving";
      patient.stopReason = `抽到 ${letter}，必须停止`;
    }
    b.ruleState.ruleNotice = `抽到 Patient ${letter}${patient.stage === "resolving" ? "；开始倒序结算" : "；可以继续抽取或停止"}。`;
    log(`熔怖恶魔抽取 Patient ${letter}`);
    save();
  }

  function stopSmeltedPatient() {
    const b = state.battle;
    const patient = b.ruleState.patient;
    if (patient.stage !== "drawing" || !patient.drawn.length) return toast("当前没有可停止的 Patient 抽取");
    remember();
    patient.queue = patient.drawn.map(id => patientLetter(monsterById(b.monsterId), id)).reverse();
    patient.stage = "resolving";
    patient.stopReason = "玩家选择停止";
    b.ruleState.ruleNotice = `停止抽取；按 ${patient.queue.join(" → ")} 倒序结算。`;
    log("熔怖恶魔：停止抽取 Patient");
    save();
  }

  function finishSmeltedBargain(message = "讨价还价结算完成。") {
    const patient = state.battle.ruleState.patient;
    patient.discard.push(...patient.drawn);
    patient.drawn = [];
    patient.queue = [];
    patient.stage = "idle";
    patient.stopReason = "";
    state.battle.ruleState.ruleNotice = message;
  }

  function resolvePatientEffect(choice = "") {
    const monster = monsterById(state.battle.monsterId);
    const rule = bossRule(monster);
    const b = state.battle;
    const patient = b.ruleState.patient;
    if (patient.stage !== "resolving") return toast("当前没有待结算的 Patient 效果");
    remember();
    if (rule.kind === "ancient-dusk") {
      const letter = patient.queue.shift();
      if (!letter) finishAncientBargain();
      else {
        const effect = {
          A: "向最近短边拉近 2 格",
          B: "获得溺水",
          C: "若有债务则该骑士死亡",
          D: "被攻击 BP 获得 Overline 6+ Knockdown",
          E: "获得暴露",
          F: "随机弃一张手牌；无法弃置则死亡"
        }[letter];
        b.ruleState.ruleNotice = `Patient ${letter}：${effect}。${patient.queue.length ? `下一项 ${patient.queue[0]}` : "再次点击以完成讨价还价"}`;
      }
    } else if (rule.kind === "smelted-fears") {
      const letter = patient.queue.shift();
      const target = patient.target || "当前骑士";
      if (!letter) finishSmeltedBargain();
      else if (letter === "A") {
        patient.discard.push(...patient.drawn);
        patient.deck = shuffle([...patient.deck, ...patient.discard]);
        patient.discard = [];
        patient.drawn = [];
        patient.queue = [];
        patient.stage = "idle";
        b.ruleState.smeltedFears.imprisonedKnight = target;
        b.ruleState.ruleNotice = `Patient A：${target}移入囚牢；全部抽牌弃置并将 Patient 弃牌洗回牌组。`;
      } else {
        const armorLoss = ({ C: 3, D: 2, E: 1 })[letter] || (letter === "F" && choice === "accept" ? 1 : 0);
        if (armorLoss) b.ruleState.smeltedFears.ironTitheArmor += armorLoss;
        if (letter === "F" && choice === "accept") {
          b.ruleState.severityByKnight[target] = clamp((b.ruleState.severityByKnight[target] ?? 9) + 1, 0, 9);
        }
        const effect = letter === "B" ? "随机弃一张手牌"
          : letter === "F" ? (choice === "accept" ? "烈度 +1，弃置 1 枚盔甲" : "拒绝以烈度换取弃甲")
            : `弃置 ${armorLoss} 枚盔甲并放到 Iron Tithe`;
        b.ruleState.ruleNotice = `Patient ${letter}：${effect}。${patient.queue.length ? `下一项 ${patient.queue[0]}` : "结算完成"}`;
        if (!patient.queue.length) finishSmeltedBargain(b.ruleState.ruleNotice);
      }
    }
    log("确认 Patient 效果");
    save();
  }

  function setSmeltedOubliette(name) {
    const current = state.battle.ruleState.smeltedFears.imprisonedKnight;
    if (!String(name || "").trim() && current
      && state.battle.ruleState.smeltedFears.gateHolders.includes(current)) {
      return toast("持有门禁标记的骑士不能离开囚牢");
    }
    remember();
    state.battle.ruleState.smeltedFears.imprisonedKnight = String(name || "").trim();
    state.battle.ruleState.ruleNotice = state.battle.ruleState.smeltedFears.imprisonedKnight
      ? `${state.battle.ruleState.smeltedFears.imprisonedKnight}已置于囚牢；忽略强制移动，恶魔对其始终拥有基础技巧。`
      : "囚牢当前为空。";
    log("更新囚牢骑士");
    save();
  }

  function toggleSmeltedGate(name) {
    name = String(name || "当前骑士").trim() || "当前骑士";
    remember();
    const holders = state.battle.ruleState.smeltedFears.gateHolders;
    const index = holders.indexOf(name);
    if (index >= 0) holders.splice(index, 1);
    else holders.push(name);
    state.battle.ruleState.ruleNotice = index >= 0
      ? `${name}的门禁标记已弃置。`
      : `${name}获得门禁标记：不能讨价还价，也不能离开囚牢。`;
    log(`门禁标记：${name}`);
    save();
  }

  function smeltedFerrobaptism() {
    remember();
    const gain = state.battle.level >= 3 ? 3 : 2;
    state.battle.ruleState.smeltedFears.devilArmor += gain;
    state.battle.ruleState.ruleNotice = `铁之洗礼 ${gain}：恶魔获得 ${gain} 枚盔甲。`;
    log(`铁之洗礼 ${gain}`);
    save();
  }

  function changeSmeltedArmor(target, delta) {
    if (!["devilArmor", "ironTitheArmor"].includes(target)) return;
    remember();
    const smelted = state.battle.ruleState.smeltedFears;
    smelted[target] = clamp(smelted[target] + delta, 0, 99);
    state.battle.ruleState.ruleNotice = "";
    log(`熔怖恶魔 ${target}：${delta > 0 ? "+" : ""}${delta}`);
    save();
  }

  function bargainDiscardSmeltedArmor() {
    const smelted = state.battle.ruleState.smeltedFears;
    if (!smelted.devilArmor) return toast("当前没有可讲价弃置的盔甲指示物");
    remember();
    smelted.devilArmor--;
    smelted.ironTitheArmor++;
    state.battle.ruleState.ruleNotice = "";
    log("熔怖恶魔：讲价弃置 1 枚盔甲到窖牢");
    save();
  }

  function recordP2WoundCounters(monster, value) {
    if (value <= 0) return;
    const b = state.battle;
    const rule = bossRule(monster);
    if (rule?.kind === "eggknight") {
      const egg = b.ruleState.eggknight;
      egg.counter = clamp(egg.counter + value, 0, 99);
      b.ruleState.ruleNotice = egg.counter >= 3
        ? `还击指示物 ${egg.counter}/3：已达到阈值。`
        : `还击指示物 ${egg.counter}/3。`;
    }
    if (rule?.kind === "knighteater" && b.level >= 2) {
      const eater = b.ruleState.knighteater;
      eater.brute += value;
      if (eater.brute >= 3) {
        eater.brute = 0;
        eater.armor = 0;
        b.ruleState.ruleNotice = "凶残计数达到 3：计数与全部盔甲已清除，请执行食骑者标志行为。";
      }
    }
    if (rule?.kind === "king-laid-low") {
      const king = b.ruleState.kingLaidLow;
      if (b.level >= 2) {
        const before = king.putrid;
        king.putrid = clamp(king.putrid + value, 0, 99);
        b.ruleState.ruleNotice = king.putrid >= 4
          ? `腐臭赎罪 ${king.putrid}/4：已达到阈值。完成当前行动后，点击指示物执行标志行为。`
          : `腐臭赎罪 ${king.putrid}/4。`;
        log(`俯伏王腐臭赎罪通用指示物：${king.putrid}/4`);
        if (before < 4 && king.putrid >= 4) toast("腐臭赎罪达到 4：完成当前行动后点击结算");
      }
      if (!king.vpCreated && b.singleWounds + b.doubleWounds * 2 >= rule.vpWoundThreshold) {
        king.vpCreated = true;
        b.ruleState.ruleNotice += " 损伤达到 6，谜之凸起 VP 已生成。";
      }
    }
    if (rule?.kind === "smelted-fears") {
      const target = b.ruleState.activeKnight || "当前骑士";
      const gateIndex = b.ruleState.smeltedFears.gateHolders.indexOf(target);
      if (gateIndex >= 0) b.ruleState.smeltedFears.gateHolders.splice(gateIndex, 1);
      if (b.level < 2) return;
      const severity = b.ruleState.severityByKnight[target] ?? 9;
      const woundClass = severityBand(monster, severity);
      b.ruleState.smeltedFears.pendingMoltenChains = woundClass;
      const effect = {
        light: "Cool，并随机弃一张手牌",
        heavy: "Delay、随机弃一张手牌并耗竭装备",
        fatal: "随机弃一张手牌并耗竭装备",
        judgment: "Gatekeeper，并耗竭装备"
      }[woundClass];
      b.ruleState.ruleNotice = `熔链（${woundBandLabel(woundClass)}）：${effect}。`;
    }
  }

  function smeltedEquipmentEvent() {
    if (state.battle.level < 3) return toast("等级 3+ 才触发窒息");
    remember();
    state.battle.ruleState.smeltedFears.suffocationEvents++;
    state.battle.ruleState.ruleNotice = "装备已弃置或耗竭：追加窒息 1。";
    log("熔怖恶魔：装备事件，窒息 1");
    save();
  }

  function changeEggArmor(slot, delta, headbutt = false) {
    slot = clamp(slot, 1, 3);
    const egg = state.battle.ruleState.eggknight;
    if (delta < 0 && !egg.armor[slot]) return toast("该盔甲槽已为空");
    remember();
    const before = egg.armor[slot];
    egg.armor[slot] = clamp(before + delta, 0, 20);
    const removed = Math.max(0, before - egg.armor[slot]);
    egg.jacked += removed;
    const threshold = egg.jacked >= 9 ? "9+：攻击额外造成 3 活力损失"
      : egg.jacked >= 5 ? "5+：怪物攻击获得 +1 闪避" : egg.jacked >= 2 ? "2+：闪避难度 +1" : "尚未达到阈值";
    state.battle.ruleState.ruleNotice = `${slot} 阶槽盔甲 ${delta > 0 ? "+" : ""}${delta}；Jacked ${egg.jacked}（${threshold}）。${headbutt && removed ? "请抽取致命伤卡，按坐标放置石柱，再将该伤卡放回牌堆底。" : ""}`;
    log(`蛋蛋骑士盔甲槽 ${slot}：${delta > 0 ? "+" : ""}${delta}`);
    save();
  }

  function changeEggCounter(delta) {
    const egg = state.battle.ruleState.eggknight;
    const next = clamp(egg.counter + Number(delta || 0), 0, 99);
    if (next === egg.counter) return;
    remember();
    egg.counter = next;
    state.battle.ruleState.ruleNotice = egg.counter >= 3
      ? `还击指示物 ${egg.counter}/3：已达到阈值。`
      : `还击指示物 ${egg.counter}/3。`;
    log(`蛋蛋骑士还击指示物：${egg.counter}/3`);
    save();
  }

  function triggerEggCounter() {
    const b = state.battle;
    const egg = b.ruleState.eggknight;
    if (egg.counter < 3) return toast("还击指示物达到 3 后才能触发");
    if (b.ruleState.ruleCard) return toast("请先完成当前特殊卡面处理");
    const signature = monsterById(b.monsterId).cards.find(card => card.kind === "SIG");
    if (!signature) return toast("未找到蛋蛋骑士标志行为卡");
    remember();
    egg.counter = 0;
    b.ruleState.ruleCard = signature.id;
    b.ruleState.ruleCardReason = "还击：标志行为";
    b.ruleState.ruleNotice = "还击已触发并清除全部还击指示物；请执行标志行为。";
    log("蛋蛋骑士还击：执行标志行为");
    save();
  }

  function checkKnighteaterBrute() {
    if (state.battle.level < 2) return false;
    const eater = state.battle.ruleState.knighteater;
    if (eater.brute < 3) return false;
    eater.brute = 0;
    eater.armor = 0;
    state.battle.ruleState.ruleNotice = "凶残计数达到 3：计数与全部盔甲已清除，请执行食骑者标志行为。";
    return true;
  }

  function changeKnighteaterResource(type, delta) {
    const eater = state.battle.ruleState.knighteater;
    if (!Object.hasOwn(eater, type) || !["meat", "armor"].includes(type)) return;
    remember();
    const before = eater[type];
    eater[type] = clamp(before + delta, 0, 99);
    if (type === "armor" && state.battle.level >= 2 && eater[type] > before) {
      eater.brute += eater[type] - before;
    }
    if (!checkKnighteaterBrute()) {
      state.battle.ruleState.ruleNotice = type === "armor"
        ? ""
        : `${type === "meat" ? "肉块" : "盔甲"} ${delta > 0 ? "+" : ""}${delta}。`;
    }
    log(`食骑者${type}：${delta > 0 ? "+" : ""}${delta}`);
    save();
  }

  function changeKnighteaterBruteCounter(delta) {
    const b = state.battle;
    if (b.monsterId !== "M_Knighteater" || b.level < 2) return toast("等级 2+ 才能触发凶残");
    const eater = b.ruleState.knighteater;
    const next = clamp(eater.brute + Number(delta || 0), 0, 3);
    if (next === eater.brute) return;
    remember();
    eater.brute = next;
    if (!checkKnighteaterBrute()) b.ruleState.ruleNotice = `凶残 ${next}/3。`;
    log(`食骑者凶残通用指示物：${next}/3`);
    save();
  }

  function setKnighteaterBerserk(value, priorityTarget = "") {
    const eater = state.battle.ruleState.knighteater;
    eater.berserk = Boolean(value);
    eater.priorityTarget = eater.berserk ? "BOSS" : String(priorityTarget || "");
  }

  function toggleKnighteaterBerserk(value, priorityTarget = "") {
    remember();
    setKnighteaterBerserk(value, priorityTarget);
    state.battle.ruleState.ruleNotice = value
      ? "食骑者已标记为暴走；优先目标标记放到 Boss 面板。"
      : "食骑者已停止暴走；请将优先目标标记交给战意最高骑士。";
    log(`食骑者暴走：${value ? "开始" : "停止"}`);
    save();
  }

  function resolveWolfDown(priorityTarget = "") {
    const b = state.battle;
    const eater = b.ruleState.knighteater;
    const amount = b.level;
    remember();
    const spent = Math.min(amount, eater.meat);
    eater.meat -= spent;
    const enough = spent === amount;
    let message = "";
    if (!eater.berserk && !enough) {
      setKnighteaterBerserk(true);
      message = "肉块不足，食骑者开始暴走；优先目标标记放到 Boss 面板。";
    } else if (!eater.berserk && enough) {
      eater.armor++;
      eater.brute++;
      message = "肉块足够：获得 1 枚盔甲，不开始暴走。";
    } else if (eater.berserk && !enough && b.level >= 3) {
      setKnighteaterBerserk(false, priorityTarget);
      message = "肉块不足：随机一名相邻骑士死亡，食骑者停止暴走。";
    } else if (eater.berserk && !enough) {
      message = `肉块不足：随机一名相邻骑士失去 ${amount} 活力，食骑者维持暴走。`;
    } else {
      eater.armor++;
      eater.brute++;
      setKnighteaterBerserk(false, priorityTarget);
      message = "肉块足够：获得 1 枚盔甲并停止暴走；优先目标转给战意最高骑士。";
    }
    if (!checkKnighteaterBrute()) b.ruleState.ruleNotice = `狼吞虎咽 ${amount}：${message}`;
    log(`食骑者狼吞虎咽 ${amount}`);
    save();
  }

  function addStonemasonArmor(direction, amount) {
    const stone = state.battle.ruleState.stonemason;
    if (stone.armorLocked || amount <= 0) return false;
    const occupied = Object.values(stone.armor).filter(value => value > 0).length;
    if (!stone.armor[direction] && occupied === 3) {
      for (const key of Object.keys(stone.armor)) stone.armor[key] = Math.max(0, stone.armor[key] - 1);
      stone.armorLocked = true;
      state.battle.ruleState.ruleNotice = "第四防护节点触发：改为每个节点各弃置 1 枚盔甲，区域 2 内所有骑士击飞 2；本轮不能再获得盔甲。";
      return true;
    }
    stone.armor[direction] = clamp(stone.armor[direction] + amount, 0, 20);
    return true;
  }

  function finishStonemasonAttack(direction, armorBefore) {
    const b = state.battle;
    if (armorBefore === 0) {
      addStonemasonArmor(direction, 1);
      if (!b.ruleState.stonemason.armorLocked) b.ruleState.ruleNotice = `磁石盔甲：攻击结算完毕，${direction}节点获得 1 枚盔甲。`;
    } else if (b.level >= 4) {
      addStonemasonArmor(direction, 1);
      if (!b.ruleState.stonemason.armorLocked) b.ruleState.ruleNotice = `坚定不移的信念：${direction}节点额外获得 1 枚盔甲。`;
    }
  }

  function setStonemasonDirection(direction) {
    if (!["front", "right", "back", "left"].includes(direction)) return;
    remember();
    state.battle.ruleState.stonemason.direction = direction;
    const armor = state.battle.ruleState.stonemason.armor[direction];
    state.battle.ruleState.ruleNotice = `攻击方向设为 ${direction}；该节点有 ${armor} 枚盔甲${armor ? "，石匠骑士视作 +1 AT" : ""}。`;
    log(`石匠攻击方向：${direction}`);
    save();
  }

  function changeStonemasonArmor(direction, delta) {
    if (!["front", "right", "back", "left"].includes(direction)) return;
    remember();
    const stone = state.battle.ruleState.stonemason;
    stone.armor[direction] = clamp(stone.armor[direction] + delta, 0, 20);
    state.battle.ruleState.ruleNotice = `${direction}节点盔甲 ${delta > 0 ? "+" : ""}${delta}。`;
    log(`石匠盔甲 ${direction}：${delta > 0 ? "+" : ""}${delta}`);
    save();
  }

  function startStonemasonRound() {
    const b = state.battle;
    remember();
    b.ruleState.stonemason.armorLocked = false;
    b.ruleState.ruleNotice = "新怪物轮开始：盔甲获取限制已解除。";
    log("石匠骑士怪物轮开始");
    save();
  }

  function endStonemasonRound(direction) {
    if (state.battle.level < 3) return toast("等级 3+ 才执行磁力聚甲");
    remember();
    addStonemasonArmor(direction, 2);
    if (!state.battle.ruleState.stonemason.armorLocked) {
      state.battle.ruleState.ruleNotice = `磁力聚甲：${direction}节点获得 2 枚盔甲。`;
    }
    log("石匠骑士怪物轮结束：磁力聚甲");
    save();
  }

  function stonemasonBoardAction(action) {
    const messages = {
      ruin: "废墟：在石匠骑士前方相邻位置放置 2×2 瓦砾堆。",
      buried: "活埋：瓦砾将覆盖已有瓦砾上的骑士，请该骑士执行审判抽取。",
      spikes: "废墟铁刺：骑士穿过或停在瓦砾堆时失去 1 活力。"
    };
    remember();
    state.battle.ruleState.ruleNotice = messages[action] || "请按大卡确认瓦砾地形。";
    log(`石匠棋盘效果：${action}`);
    save();
  }

  function setKingCurse(name) {
    name = String(name || "").trim();
    remember();
    const king = state.battle.ruleState.kingLaidLow;
    if (name && !king.livingKnights.includes(name)) king.livingKnights.push(name);
    king.curseHolder = name;
    state.battle.ruleState.ruleNotice = name ? `${name}持有恶咒状态卡。` : "当前未指定恶咒持有者。";
    log(`俯伏王恶咒：${name || "未指定"}`);
    save();
  }

  function kingKnightDied(name) {
    name = String(name || "").trim();
    const king = state.battle.ruleState.kingLaidLow;
    remember();
    king.livingKnights = king.livingKnights.filter(item => item !== name);
    if (king.curseHolder === name) {
      king.curseHolder = king.livingKnights.length
        ? king.livingKnights[Math.floor(Math.random() * king.livingKnights.length)] : "";
    }
    if (king.vpOccupant === name) king.vpOccupant = "";
    state.battle.ruleState.ruleNotice = king.curseHolder
      ? `${name}死亡；恶咒随机传递给 ${king.curseHolder}（面朝上）。`
      : `${name}死亡；没有其他存活骑士可接收恶咒。`;
    log(`俯伏王：${name}死亡`);
    save();
  }

  function kingBow(name, obey) {
    remember();
    state.battle.ruleState.ruleNotice = obey
      ? `${name || "该骑士"}选择服从：击倒并失去 2 活力。`
      : `${name || "该骑士"}选择不服从：获得恐慌状态卡。`;
    log(`向国王下跪：${obey ? "服从" : "不服从"}`);
    save();
  }

  function kingVpAction(name, action, success) {
    const king = state.battle.ruleState.kingLaidLow;
    if (!king.vpCreated) return toast("VP 尚未生成");
    remember();
    name = String(name || "当前骑士").trim() || "当前骑士";
    if (action === "climb") {
      if (success) king.vpOccupant = name;
      state.battle.ruleState.ruleNotice = success
        ? `${name}通过洞察 7+，登上 VP。`
        : `${name}攀登失败，获得黏糊状态卡。`;
    } else {
      if (!success) king.vpOccupant = "";
      state.battle.ruleState.ruleNotice = success
        ? `${name}通过坚韧 8+，继续留在 VP。`
        : `${name}抓紧失败：击倒并移至相邻格。`;
    }
    log(`俯伏王 VP：${action} ${success ? "成功" : "失败"}`);
    save();
  }

  function kingDrillAction() {
    remember();
    const occupant = state.battle.ruleState.kingLaidLow.vpOccupant;
    state.battle.ruleState.ruleNotice = occupant
      ? `${occupant}位于 VP：可获得 +2 对应属性，使国王改为向玩家选择的直线方向钻地冲 4。`
      : `按当前等级执行钻地冲 ${state.battle.level >= 4 ? 5 : state.battle.level >= 2 ? 4 : 3}；路径、骑士飞离方向与凹坑放置由玩家确认。`;
    log("俯伏王：钻地冲提示");
    save();
  }

  function changeKingPutridCounter(delta) {
    const b = state.battle;
    if (b.monsterId !== "M_KingLaidLow" || b.level < 2) return toast("等级 2+ 才能触发腐臭赎罪");
    const king = b.ruleState.kingLaidLow;
    const next = clamp(king.putrid + Number(delta || 0), 0, 99);
    if (next === king.putrid) return;
    remember();
    king.putrid = next;
    b.ruleState.ruleNotice = next >= 4
      ? `腐臭赎罪 ${next}/4：已达到阈值。完成当前行动后，点击指示物执行标志行为。`
      : `腐臭赎罪 ${next}/4。`;
    log(`俯伏王腐臭赎罪通用指示物：${next}/4`);
    save();
  }

  function resolveKingPutridPenance() {
    const b = state.battle;
    const monster = monsterById(b.monsterId);
    const king = b.ruleState.kingLaidLow;
    if (monster.id !== "M_KingLaidLow" || b.level < 2) return;
    if (king.putrid < 4) return toast("腐臭赎罪达到 4 后才能结算");
    if (b.activeBP || b.activeAI || b.activeMobActivationId || b.ruleState.ruleCard) {
      return toast("请先完成当前行动再结算腐臭赎罪");
    }
    const signature = monster.cards.find(card => card.kind === "SIG");
    if (!signature) return toast("未找到俯伏王标志行为卡");

    remember();
    king.putrid = 0;
    b.ruleState.ruleCard = signature.id;
    b.ruleState.ruleCardReason = "腐臭赎罪：标志行为";
    b.ruleState.ruleNotice = "腐臭赎罪已结算并清除全部指示物；请执行国王的标志行为。";
    log("俯伏王腐臭赎罪：执行标志行为");
    save();
  }

  function activeMobSlot() {
    const index = state.battle.bpTrack.findIndex(slot => slot.id === state.battle.activeBP);
    return index >= 0 ? { index, slot: state.battle.bpTrack[index] } : null;
  }

  function ironcastSpawnArmorActive(monster, battle = state.battle) {
    return monster?.id === "M_Ironcast" && battle.level >= 3;
  }

  function palebloodScabArmorActive(monster, battle = state.battle) {
    return monster?.id === "M_PalebloodWorms" && battle.level >= 3;
  }

  function spawnedMobSlot(monster, id) {
    const markerTokens = {};
    if (ironcastSpawnArmorActive(monster)) markerTokens["token-armor"] = 1;
    if (palebloodScabArmorActive(monster)) markerTokens["token-blood"] = 1;
    return { id, revealed: false, side: "face", markers: 0, markerTokens, decoy: false };
  }

  function nextMobActivationPosition(from, excludeId = "") {
    const b = state.battle;
    const occupied = Array.from({ length: b.bpTrack.length }, (_, offset) =>
      (from + 1 + offset) % b.bpTrack.length
    ).filter(index => b.bpTrack[index]?.id);
    if (!occupied.length) return -1;
    return occupied.find(index =>
      !b.mobActivations.some(token => token.id !== excludeId && token.position === index)
    ) ?? occupied[0];
  }

  function moveMobActivation(token, used) {
    const destination = nextMobActivationPosition(token.position, token.id);
    if (destination < 0) return false;
    token.position = destination;
    token.used = used;
    return true;
  }

  function completeMobActivation() {
    const id = state.battle.activeMobActivationId;
    const token = state.battle.mobActivations.find(item => item.id === id);
    if (!token) return;
    const monster = monsterById(state.battle.monsterId);
    const kind = mobActivationKind(monster, token);
    const from = token.position;
    moveMobActivation(token, true);
    state.battle.activeMobActivationId = "";
    log(`${kind} 激活指示物：${from + 1} → ${token.position + 1}（已使用）`);
  }

  function moveActivationsFromDefeated(position) {
    const tokens = state.battle.mobActivations.filter(token => token.position === position);
    for (const token of tokens) {
      const from = token.position;
      if (moveMobActivation(token, token.used)) {
        log(`${token.type} 指示物随杂兵被击败：${from + 1} → ${token.position + 1}`);
      }
    }
  }

  function startMobRound() {
    if (ratwolfSignaturePending()) return toast("请先完成新生狼鼠的标志行为");
    remember();
    state.battle.mobActivations.forEach(token => { token.used = false; });
    state.battle.activeMobActivationId = "";
    log("怪物轮开始：所有激活指示物翻至准备面");
    save();
  }

  function resolveMobActivation(id) {
    const b = state.battle;
    const monster = monsterById(b.monsterId);
    if (ratwolfSignaturePending(b)) return toast("请先完成新生狼鼠的标志行为");
    if (b.activeMobActivationId) {
      if (b.activeMobActivationId === id && b.activeAI) {
        settle("ai", "discard");
        return;
      }
      return toast("请先完成当前激活");
    }
    if (b.activeAI) return toast("请先处理当前 AI");
    const ready = b.mobActivations
      .filter(token => !token.used && b.bpTrack[token.position]?.id)
      .sort((a, z) => a.position - z.position)[0];
    if (!ready || ready.id !== id) return toast("必须从最左侧的准备面激活指示物开始");
    remember();
    b.activeMobActivationId = ready.id;
    const activationKind = mobActivationKind(monster, ready, b);
    if (activationKind === "AI") {
      reshuffleIfEmpty("ai");
      if (!b.aiDeck.length) {
        b.activeMobActivationId = "";
        return toast("AI 牌组为空");
      }
      b.activeAI = b.aiDeck[0];
      log(`杂兵轨 ${ready.position + 1}：AI 激活`);
      save();
    } else {
      log(`杂兵轨 ${ready.position + 1}：执行标志行为`);
      completeMobActivation();
      save();
    }
  }

  function selectMob(index) {
    if (ratwolfSignaturePending()) return toast("请先完成新生狼鼠的标志行为");
    if (state.battle.activeBP) return toast("请先处理当前 BP");
    const slot = state.battle.bpTrack[index];
    if (!slot?.id) return toast("此位置为空");
    remember();
    slot.revealed = true;
    state.battle.activeBP = slot.id;
    log(`揭示杂兵轨 ${index + 1}`);
    save();
  }

  function checkMobMarkerFailure(monster, index, slot) {
    if (!isPumpkinhead(monster) || !isSpecialMobSlot(monster, slot) || slot.markers < MAX_BP_MARKERS) return false;
    state.battle.conflictStatus = "failed";
    state.battle.failureReason = `杂兵轨 ${index + 1} 的南瓜头 BP 已有 ${MAX_BP_MARKERS} 枚通用指示物：生态灾难触发。`;
    toast(state.battle.failureReason);
    return true;
  }

  function changeMobMarker(index, assetId, delta) {
    const monster = monsterById(state.battle.monsterId);
    const slot = state.battle.bpTrack[index];
    if (!isMob(monster) || !slot?.id) return toast("该杂兵 BP 位置为空");
    const asset = TOKEN_ASSETS.find(item => item.id === assetId);
    if (!asset) return toast("未知标记类型");
    const specialGeneric = assetId === "token-01" && isPumpkinhead(monster) && isSpecialMobSlot(monster, slot);
    const max = specialGeneric ? MAX_BP_MARKERS : MAX_SHEET_TOKENS_PER_TYPE;
    slot.markerTokens ||= {};
    const before = clamp(slot.markerTokens[assetId], 0, max);
    const next = clamp(before + delta, 0, max);
    if (next === before) return;
    remember();
    if (next) slot.markerTokens[assetId] = next;
    else delete slot.markerTokens[assetId];
    if (assetId === "token-01") {
      slot.markers = next;
      checkMobMarkerFailure(monster, index, slot);
    }
    log(`杂兵轨 ${index + 1}：${asset.name}标记 ${delta > 0 ? "+" : ""}${delta}（${next}/${max}）`);
    save();
  }

  function toggleLictorDecoy(index) {
    const battle = state.battle;
    const slot = battle.bpTrack[index];
    if (battle.monsterId !== "M_FirstmenLictor" || !slot?.id) return toast("该位置没有可设置的巡猎手 BP");
    remember();
    if (slot.decoy) {
      slot.decoy = false;
      log(`杂兵轨 ${index + 1}：解除诱匿`);
    } else {
      slot.decoy = true;
      if (slot.revealed) slot.side = slot.side === "back" ? "face" : "back";
      battle.ruleState.lictorDecoyTokens = clamp(
        battle.ruleState.lictorDecoyTokens + 1,
        0,
        MAX_SHEET_TOKENS_PER_TYPE
      );
      log(`杂兵轨 ${index + 1}：设为诱匿，Taunt & Decoy 通用标记 +1`);
    }
    save();
  }

  function defeatWarriorMuscularChest() {
    const battle = state.battle;
    if (battle.monsterId !== "M_FirstmenWarriors") return;
    const warrior = battle.ruleState.firstmenWarriors;
    if (warrior.muscularChestMarkers >= 4) return toast("MUSCULAR CHEST 已有 4 枚通用标记");
    remember();
    warrior.muscularChestMarkers++;
    addWound("single");
    log(`MUSCULAR CHEST 被击败：通用标记 ${warrior.muscularChestMarkers}/4，增加 1 个单重损伤`);
    save();
  }

  function warriorRetributionActive(battle = state.battle) {
    return battle.monsterId === "M_FirstmenWarriors" && battle.level >= 3;
  }

  function recordWarriorRetribution(id) {
    const battle = state.battle;
    const monster = monsterById(battle.monsterId);
    if (!warriorRetributionActive(battle) || !bpRank(cardById(monster, id))) return;

    const warrior = battle.ruleState.firstmenWarriors;
    warrior.retributionMarkers = clamp(warrior.retributionMarkers + 1, 0, 4);
    if (warrior.retributionMarkers < 4) {
      battle.ruleState.ruleNotice = `战术反击 ${warrior.retributionMarkers}/4：每张进入损伤堆叠的 BP 卡累计 1 枚通用指示物。`;
      log(`战术反击通用指示物：${warrior.retributionMarkers}/4`);
      return;
    }

    warrior.retributionMarkers = 0;
    battle.ruleState.ruleNotice = "战术反击达到 4：已清除全部指示物。完成当前行动后，触发长音呼嚎特质，并立刻激活一次巨白猿魔。";
    log("战术反击达到 4/4：清除全部通用指示物；待触发长音呼嚎并激活巨白猿魔");
    toast("战术反击：完成当前行动后触发长音呼嚎，并立刻激活一次巨白猿魔");
  }

  function ratwolfSignaturePending(battle = state.battle) {
    return battle.monsterId === "M_Ratwolves" && Boolean(battle.ruleState.ratwolves?.pendingSignature);
  }

  function spawnRatwolfAfterDefeat(monster, defeatedRank, trackIndex) {
    if (monster.id !== "M_Ratwolves" || defeatedRank < 1 || trackIndex < 0) return false;
    const ranks = [...new Set([defeatedRank + 1, defeatedRank, defeatedRank - 1])]
      .filter(rank => rank >= 1 && rank <= 3);
    let id = "";
    let spawnedRank = 0;
    for (const rank of ranks) {
      id = takeSupply(monster, `BP${rank}`);
      if (id) {
        spawnedRank = rank;
        break;
      }
    }
    const ratwolves = state.battle.ruleState.ratwolves;
    if (!id) {
      ratwolves.pendingSignature = false;
      ratwolves.spawnedRank = 0;
      ratwolves.trackIndex = -1;
      ratwolves.rankSource = "";
      const notice = `狼鼠死亡后无法生成新狼鼠：BP${ranks.join("、BP")} 供应均已耗尽。`;
      state.battle.ruleState.ruleNotice = notice;
      log(notice);
      toast(notice);
      return false;
    }

    const rankSource = spawnedRank === defeatedRank + 1 ? "高一阶"
      : spawnedRank === defeatedRank ? "同阶" : "低一阶";
    state.battle.bpTrack[trackIndex] = spawnedMobSlot(monster, id);
    ratwolves.pendingSignature = true;
    ratwolves.spawnedRank = spawnedRank;
    ratwolves.trackIndex = trackIndex;
    ratwolves.rankSource = rankSource;
    state.battle.ruleState.ruleNotice = `新生狼鼠：在杂兵轨 ${trackIndex + 1} 生成${rankSource} BP${spawnedRank}。将模型放到可作为随机一名骑士相邻同伴、最靠近场边且无障碍的格子；若格子被占据，位移其他模型。最后执行该狼鼠的标志行为。`;
    log(`新生狼鼠：杂兵轨 ${trackIndex + 1} 生成${rankSource} BP${spawnedRank}，待执行标志行为`);
    return true;
  }

  function completeRatwolfSignature() {
    if (!ratwolfSignaturePending()) return;
    remember();
    const ratwolves = state.battle.ruleState.ratwolves;
    ratwolves.pendingSignature = false;
    ratwolves.spawnedRank = 0;
    ratwolves.trackIndex = -1;
    ratwolves.rankSource = "";
    state.battle.ruleState.ruleNotice = "";
    log("新生狼鼠：标志行为已完成");
    save();
  }

  function settleMob(monster, action) {
    const active = activeMobSlot();
    if (!active) return toast("未选择杂兵 BP");
    remember();
    const { slot } = active;
    const id = slot.id;
    const card = cardById(monster, id);
    const pumpkinheadBps = isPumpkinhead(monster) && isSpecialMobBp(card);
    let ratwolfRespawn = null;
    if (action === "fail") slot.revealed = true;
    if (action === "flip") {
      slot.revealed = true;
      slot.side = slot.side === "back" ? "face" : "back";
    }
    if (action === "defeat" || action === "critical") {
      if (pumpkinheadBps && slot.side === "face") {
        slot.revealed = true;
        slot.side = "back";
        slot.markers = clamp((slot.markers || 0) + 1, 0, MAX_BP_MARKERS);
        slot.markerTokens ||= {};
        slot.markerTokens["token-01"] = slot.markers;
        state.battle.activeBP = "";
        log(`杂兵轨 ${active.index + 1}：南瓜头受伤，翻至 Seed 面并放置通用指示物（${slot.markers}/${MAX_BP_MARKERS}）`);
        checkMobMarkerFailure(monster, active.index, slot);
        return save();
      }
      const rank = bpRank(card);
      const markerRank = clamp(slot.markers || 1, 1, 3);
      const woundValue = action === "critical" && rank === 3 ? 2 : 1;
      if (monster.id === "M_Ratwolves" && rank) ratwolfRespawn = { rank, trackIndex: active.index };
      state.battle.lastMobWoundRank = rank;
      addWound(woundValue === 2 ? "double" : "single", id);
      slot.id = ""; slot.revealed = false; slot.side = "face"; slot.markers = 0; slot.markerTokens = {}; slot.decoy = false;
      moveActivationsFromDefeated(active.index);
      recordIroncastNecrofusionWound(monster, woundValue);
      recordEtherealUnityRemoval(monster);
      if (rank > 0 && rank < 3) {
        if (monster.id === "M_HauntOf" && state.battle.level >= 2) {
          promoteHauntAi(monster, rank + 1);
        } else {
          promoteSpecific(monster, "ai", `AI${rank}`, `AI${rank + 1}`);
        }
      } else if (pumpkinheadBps && markerRank < 3) {
        promoteSpecific(monster, "ai", `AI${markerRank}`, `AI${markerRank + 1}`);
      }
    }
    state.battle.activeBP = "";
    log(`杂兵轨 ${active.index + 1}：${action}`);
    if (ratwolfRespawn) spawnRatwolfAfterDefeat(monster, ratwolfRespawn.rank, ratwolfRespawn.trackIndex);
    save();
  }

  function recordIroncastNecrofusionWound(monster, value) {
    if (monster.id !== "M_Ironcast" || state.battle.level < 2 || value <= 0) return;
    const ironcast = state.battle.ruleState.ironcast;
    ironcast.necrofusion = clamp(ironcast.necrofusion + value, 0, 99);
    state.battle.ruleState.ruleNotice = ironcast.necrofusion >= 3
      ? `亡骸融合 ${ironcast.necrofusion}/3：已达到阈值。完成当前行动后，点击指示物结算。`
      : `亡骸融合 ${ironcast.necrofusion}/3。`;
    log(`铁铸亡者亡骸融合通用指示物：${ironcast.necrofusion}/3`);
    if (ironcast.necrofusion === 3) toast("亡骸融合达到 3：完成当前行动后点击结算");
  }

  function changeIroncastNecrofusionCounter(delta) {
    const b = state.battle;
    if (b.monsterId !== "M_Ironcast" || b.level < 2) return toast("等级 2+ 才能触发亡骸融合");
    const ironcast = b.ruleState.ironcast;
    const next = clamp(ironcast.necrofusion + Number(delta || 0), 0, 99);
    if (next === ironcast.necrofusion) return;
    remember();
    ironcast.necrofusion = next;
    b.ruleState.ruleNotice = next >= 3
      ? `亡骸融合 ${next}/3：已达到阈值。完成当前行动后，点击指示物结算。`
      : `亡骸融合 ${next}/3。`;
    log(`铁铸亡者亡骸融合通用指示物：${next}/3`);
    save();
  }

  function resolveIroncastNecrofusion() {
    const b = state.battle;
    const monster = monsterById(b.monsterId);
    const ironcast = b.ruleState.ironcast;
    if (monster.id !== "M_Ironcast" || b.level < 2) return;
    if (ironcast.necrofusion < 3) return toast("亡骸融合达到 3 后才能结算");
    if (b.activeBP || b.activeAI || b.activeMobActivationId) return toast("请先完成当前行动再结算亡骸融合");

    remember();
    ironcast.necrofusion = 0;
    const index = b.bpTrack.findIndex(slot => !slot.id);
    const id = index >= 0
      ? takeSupply(monster, "BP1") || takeSupply(monster, "BP2") || takeSupply(monster, "BP3")
      : "";
    if (index >= 0 && id) {
      b.bpTrack[index] = spawnedMobSlot(monster, id);
      const armorText = ironcastSpawnArmorActive(monster, b) ? "带有盔甲指示物的" : "";
      b.ruleState.ruleNotice = `亡骸融合已结算：清除全部指示物，在杂兵轨 ${index + 1} 生成 1 只${armorText}铁铸骷髅。请将模型放到距离首要目标最近的瓦砾空格，并立刻执行一次标志行为。`;
      log(`亡骸融合结算：在杂兵轨 ${index + 1} 生成铁铸骷髅并执行标志行为`);
    } else {
      b.ruleState.ruleNotice = "亡骸融合已清除全部指示物；因杂兵轨空位或 BP 供应不足，本次未能生成铁铸骷髅。";
      log("亡骸融合结算：未能生成铁铸骷髅");
      toast("无法生成铁铸骷髅，请检查 BP 供应与空位");
    }
    save();
  }

  function recordEtherealUnityRemoval(monster) {
    if (monster.id !== "M_HauntOf") return;
    const unity = state.battle.ruleState.etherealUnity;
    unity.counter = clamp(unity.counter + 1, 0, 99);
    state.battle.ruleState.ruleNotice = unity.counter >= 3
      ? `聚合灵体 ${unity.counter}/3：已达到阈值。完成当前行动后，点击指示物或结算按钮生成 3 只新鬼影。`
      : `聚合灵体 ${unity.counter}/3：所有鬼影 +${unity.counter} 命中要求${unity.counter >= 2 ? `，攻击额外造成 ${Math.floor(unity.counter / 2)} 点活力损失` : ""}。`;
    log(`聚合灵体通用指示物：${unity.counter}/3`);
    if (unity.counter === 3) toast("聚合灵体达到 3：完成当前行动后点击结算");
  }

  function resolveEtherealUnity() {
    const b = state.battle;
    const monster = monsterById(b.monsterId);
    const unity = b.ruleState.etherealUnity;
    if (monster.id !== "M_HauntOf") return;
    if (unity.counter < 3) return toast("聚合灵体达到 3 后才能结算");

    remember();
    unity.counter = 0;
    const spawnedSlots = [];
    for (let count = 0; count < 3; count++) {
      const index = b.bpTrack.findIndex(slot => !slot.id);
      const id = takeSupply(monster, "BP1") || takeSupply(monster, "BP2") || takeSupply(monster, "BP3");
      if (index < 0 || !id) break;
      b.bpTrack[index] = { id, revealed: false, side: "face", markers: 0, markerTokens: {}, decoy: false };
      spawnedSlots.push(index);
    }

    const occupiedSlots = b.bpTrack.map((slot, index) => slot.id ? index : -1).filter(index => index >= 0);
    b.mobActivations
      .sort((left, right) => left.position - right.position)
      .forEach((token, index) => {
        if (occupiedSlots.length) token.position = occupiedSlots[index % occupiedSlots.length];
      });

    const spawned = spawnedSlots.length;
    const placement = spawnedSlots.map(index => index + 1).join("、");
    b.ruleState.ruleNotice = spawned === 3
      ? `聚合灵体已结算：清除全部指示物，并在杂兵轨 ${placement} 生成 3 只新鬼影。请抽取患者牌组顶部 3 张卡，按坐标放置模型。`
      : `聚合灵体已结算并清除全部指示物；因杂兵轨空位或 BP 供应不足，仅生成 ${spawned}/3 只新鬼影。`;
    log(`聚合灵体结算：生成 ${spawned}/3 只新鬼影${placement ? `（杂兵轨 ${placement}）` : ""}`);
    if (spawned < 3) toast(`只能生成 ${spawned}/3 只新鬼影，请检查 BP 供应与空位`);
    save();
  }

  function spawnMob(mode = "interval") {
    const monster = monsterById(state.battle.monsterId);
    if (ratwolfSignaturePending()) return toast("请先完成新生狼鼠的标志行为");
    if (isWingedNightmare(monster)) return toast("翼生梦魇不使用杂兵 BP 轨");
    if (isPumpkinhead(monster)) return toast("南瓜头精怪使用特殊双面 BP，不使用普通杂兵生成");
    const index = state.battle.bpTrack.findIndex(slot => !slot.id);
    if (index < 0) return toast("杂兵轨已满，本次生成取消");
    let id = "";
    if (mode === "immediate") {
      const defeatedRank = Number(state.battle.lastMobWoundRank || 0);
      const nextRank = Math.min(3, Math.max(2, defeatedRank + 1));
      id = takeSupply(monster, `BP${nextRank}`);
      if (!id) return toast(`高一阶 BP${nextRank} 晋升供应为空`);
    } else {
      id = takeSupply(monster, "BP1") || takeSupply(monster, "BP2") || takeSupply(monster, "BP3");
      if (!id) return toast("最低阶 BP 晋升供应为空");
    }
    remember();
    state.battle.bpTrack[index] = spawnedMobSlot(monster, id);
    const armorNotice = ironcastSpawnArmorActive(monster) ? "并放置 1 枚盔甲指示物" : "";
    const bloodNotice = palebloodScabArmorActive(monster) ? "并放置 1 枚血液指示物" : "";
    log(`在最左空位 ${index + 1} ${mode === "immediate" ? "立即生成高一阶" : "生成最低阶"} BP${armorNotice || bloodNotice}`);
    save();
  }

  function promoteMob(monster) {
    if (ratwolfSignaturePending()) return toast("请先完成新生狼鼠的标志行为");
    if (isPumpkinhead(monster)) return toast("南瓜头精怪的 BPS 不会晋升；受伤时按大卡晋升 AI");
    const candidates = state.battle.bpTrack.map((slot, index) => ({
      slot, index, rank: bpRank(cardById(monster, slot.id))
    })).filter(item => item.rank && item.rank < 3).sort((a, b) => a.rank - b.rank);
    if (!candidates.length) return toast("杂兵轨没有可自动晋升的数字阶 BP");
    const target = candidates[0];
    const nextKind = `BP${target.rank + 1}`;
    const replacement = takeSupply(monster, nextKind);
    if (!replacement) {
      if (monster.id !== "M_PalebloodWorms") return toast(`${nextKind} 晋升供应为空`);
      remember();
      const occupiedSlots = state.battle.bpTrack.filter(slot => slot.id);
      for (const slot of occupiedSlots) {
        slot.markerTokens ||= {};
        slot.markerTokens["token-blood"] = clamp(
          (slot.markerTokens["token-blood"] || 0) + 1,
          0,
          MAX_SHEET_TOKENS_PER_TYPE
        );
      }
      const notice = `${nextKind} 晋升供应为空：杂兵轨全部 ${occupiedSlots.length} 张 BP 各放置 1 枚血液指示物。`;
      state.battle.ruleState.ruleNotice = notice;
      log(notice);
      save();
      return toast(notice);
    }
    remember();
    state.battle.bpRemoved.push(target.slot.id);
    state.battle.bpTrack[target.index] = { id: replacement, revealed: false, side: "face", markers: 0, markerTokens: {}, decoy: false };
    log(`杂兵轨 ${target.index + 1} 晋升`);
    save();
  }

  function cropStyle(image, side = "face") {
    if (!image) return "";
    // KF's TTS data uses aligned face/back sprite sheets. The same card index
    // must be used on both sides (not the top-left of the whole back sheet).
    const cols = Math.max(1, Number(image.width) || 1);
    const rows = Math.max(1, Number(image.height) || 1);
    const index = Math.max(0, Number(image.index) || 0);
    const x = cols > 1 ? ((index % cols) / (cols - 1)) * 100 : 0;
    const y = rows > 1 ? (Math.floor(index / cols) / (rows - 1)) * 100 : 0;
    const aspect = Number(image.aspect) || (Number(image.cellWidth) / Number(image.cellHeight)) || 0.7;
    return `--cols:${cols};--rows:${rows};--x:${x}%;--y:${y}%;--card-aspect:${aspect};background-image:url("${image[side] || image.face}")`;
  }

  function cardLabel(card, side = "face") {
    if (card?.id === FIRSTMEN_WARRIOR_COMPANION_CARDS.muscularChest) return "BP2 · MUSCULAR CHEST";
    if (card?.id === FIRSTMEN_WARRIOR_COMPANION_CARDS.rampageStrike) return "AI2 · RAMPAGE STRIKE";
    if (card?.kind !== "SIG") return `${card.kind} · ${card.name}`;
    const monsterName = String(card.name || "").replace(/\s+Signature Routine$/i, "");
    return `${side === "back" ? "SIGNATURE" : "ROUTINE"} · ${monsterName}`;
  }

  function cardHtml(card, className = "", side = "face", label = true, interactive = true) {
    if (!card) return `<div class="crop-card empty ${className}">暂无卡牌</div>`;
    const tag = interactive ? "button" : "div";
    const preview = interactive ? ` data-preview="${esc(card.id)}" data-preview-side="${side}"` : "";
    return `<${tag} class="card-button"${preview}>
      <span class="crop-card ${className}" style='${cropStyle(card.image, side)}'></span>
      ${label ? `<span>${esc(cardLabel(card, side))}</span>` : ""}
    </${tag}>`;
  }

  function deckLevelOrderHtml(ids, monster, label) {
    const cards = ids.map(id => cardById(monster, id)).filter(Boolean);
    if (!cards.length) return '<span class="deck-level-empty">空</span>';
    return `<div class="deck-level-order" aria-label="${esc(label)}等级顺序">${cards.map((card, index) => {
      const level = String(card.kind || "").match(/^(?:AI|BP)([0-3])$/)?.[1] || "?";
      return `<span class="deck-level" title="第 ${index + 1} 张">${level}</span>`;
    }).join("")}</div>`;
  }

  function pileIds(type, view, monster) {
    const b = state.battle;
    if (view === "current") return b[`${type}Deck`];
    if (view === "discard") return b[`${type}Discard`];
    if (view === "removed") return b[`${type}Removed`];
    if (view === "damage") return b.bpDamage;
    if (/^(AI|BP)[23]$/.test(view)) return supply(monster, view).map(card => card.id);
    return [];
  }

  function pileGrid(ids, monster, hidden = false) {
    if (!ids.length) return '<p class="empty-message">此区域为空</p>';
    return ids.map(id => {
      if (id.startsWith(WOUND_PREFIX)) {
        const wound = id.includes(":double:") ? DATA.wounds.double : DATA.wounds.single;
        return cardHtml(wound);
      }
      const card = cardById(monster, id);
      if (!hidden && card?.kind === "SIG") {
        return `${cardHtml(card, "", "face")}${cardHtml(card, "", "back")}`;
      }
      return hidden ? cardHtml(card, "hidden-card", "back", false, false) : cardHtml(card);
    }).join("");
  }

  function guardedPileGrid(ids, monster, source) {
    if (!ids.length) return '<p class="empty-message">此区域为空</p>';
    const pileName = source === "bp-current" ? "当前 BP 牌组" : "当前 AI 牌组";
    return ids.map(id => {
      const card = cardById(monster, id);
      if (!card) return "";
      return `<button class="card-button guarded-pile-card" data-guarded-preview="${esc(id)}" data-guarded-source="${esc(source)}"
        title="点击后确认是否查看" aria-label="${pileName}隐藏卡牌，点击后确认是否查看">
        <span class="crop-card hidden-card" style='${cropStyle(card.image, "back")}'></span>
      </button>`;
    }).join("");
  }

  function pileVisibility(monster, type, view) {
    const rule = bossRule(monster);
    if (!isMob(monster) && view === "current") {
      return { guarded: true, source: `${type}-current` };
    }
    if (view === "discard" && ((type === "ai" && rule?.hiddenAiDiscard)
      || (type === "bp" && rule?.hiddenBpDiscard))) {
      return { hidden: true };
    }
    return {};
  }

  function pileGridForView(type, view, monster) {
    const ids = pileIds(type, view, monster);
    const visibility = pileVisibility(monster, type, view);
    if (visibility.guarded) return guardedPileGrid(ids, monster, visibility.source);
    return pileGrid(ids, monster, Boolean(visibility.hidden));
  }

  function tabs(type, active) {
    const entries = type === "ai"
      ? [["current", "当前"], ["discard", "弃牌"], ["removed", "移除"], ["AI2", "AI2供应"], ["AI3", "AI3供应"]]
      : [["current", "当前"], ["discard", "弃牌"], ["damage", "损伤"], ["removed", "移除"], ["BP2", "BP2供应"], ["BP3", "BP3供应"]];
    return `<div class="segmented">${entries.map(([value, label]) =>
      `<button class="${value === active ? "active" : ""}" data-view="${type}:${value}">${label}</button>`
    ).join("")}</div>`;
  }

  function sheetTokenCounts(battle) {
    const counts = new Map(TOKEN_ASSETS.map(asset => [asset.id, 0]));
    battle.sheetTokens.forEach(token => counts.set(token.assetId, (counts.get(token.assetId) || 0) + token.count));
    return counts;
  }

  function defaultSheetTokenPosition(index) {
    return {
      x: 15 + (index % 6) * 14,
      y: 20 + (Math.floor(index / 6) % 3) * 30
    };
  }

  function setSheetTokenCount(assetId, value) {
    if (!TOKEN_ASSET_IDS.has(assetId)) return;
    const desired = clamp(value, 0, MAX_SHEET_TOKENS_PER_TYPE);
    const existing = state.battle.sheetTokens.find(token => token.assetId === assetId);
    if (desired === (existing?.count || 0)) return;
    remember();
    if (!desired) {
      state.battle.sheetTokens = state.battle.sheetTokens.filter(token => token.assetId !== assetId);
    } else if (existing) {
      existing.count = desired;
    } else {
      const position = defaultSheetTokenPosition(state.battle.sheetTokens.length);
      state.battle.sheetTokens.push({ id: `sheet-token-${uid()}`, assetId, count: desired, ...position });
    }
    save();
  }

  function clearSheetTokens() {
    if (!state.battle.sheetTokens.length) return;
    remember();
    state.battle.sheetTokens = [];
    save();
  }

  function setBogWitchPosition(value) {
    if (state.battle.monsterId !== "M_BogWitch") return;
    const position = clamp(value, 0, BOG_WITCH_POSITIONS.length - 1);
    const bogWitch = state.battle.ruleState.bogWitch;
    if (bogWitch.position === position) return;
    remember();
    bogWitch.position = position;
    log(`沼地女巫移动到${BOG_WITCH_POSITIONS[position].label}`);
    save();
  }

  function startSheetTokenDrag(event) {
    if (event.button !== undefined && event.button !== 0) return;
    const node = event.currentTarget;
    const stage = node.closest("[data-sheet-stage]");
    const token = state.battle.sheetTokens.find(item => item.id === node.dataset.sheetToken);
    if (!stage || !token) return;
    const before = clone(state.battle);
    let moved = false;

    const move = pointerEvent => {
      const stageRect = stage.getBoundingClientRect();
      const tokenRect = node.getBoundingClientRect();
      if (!stageRect.width || !stageRect.height) return;
      const halfX = tokenRect.width / stageRect.width * 50;
      const halfY = tokenRect.height / stageRect.height * 50;
      token.x = Math.round(clamp((pointerEvent.clientX - stageRect.left) / stageRect.width * 100, halfX, 100 - halfX) * 100) / 100;
      token.y = Math.round(clamp((pointerEvent.clientY - stageRect.top) / stageRect.height * 100, halfY, 100 - halfY) * 100) / 100;
      node.style.left = `${token.x}%`;
      node.style.top = `${token.y}%`;
      moved = true;
    };
    const finish = pointerEvent => {
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", finish);
      node.removeEventListener("pointercancel", finish);
      node.classList.remove("dragging");
      if (node.hasPointerCapture?.(pointerEvent.pointerId)) node.releasePointerCapture(pointerEvent.pointerId);
      if (!moved) return;
      state.history.push(before);
      state.history = state.history.slice(-30);
      save();
    };

    event.preventDefault();
    node.classList.add("dragging");
    node.setPointerCapture?.(event.pointerId);
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", finish);
    node.addEventListener("pointercancel", finish);
  }

  function sheetTokenTools(battle) {
    const counts = sheetTokenCounts(battle);
    const total = battle.sheetTokens.reduce((sum, token) => sum + token.count, 0);
    return `<details class="sheet-token-tools" data-sheet-token-tools ${sheetTokenToolsOpen ? "open" : ""}>
      <summary>大卡 Token (${total})</summary>
      <div class="sheet-token-toolbar">
        <div class="sheet-token-palette">${TOKEN_ASSETS.map(asset => {
          const count = counts.get(asset.id) || 0;
          return `<div class="sheet-token-choice" title="${esc(asset.name)}">
            <img class="${asset.shape === "square" ? "token-square" : ""}" src="${esc(asset.src)}" alt="${esc(asset.name)}">
            <div class="sheet-token-counter">
              <button type="button" data-token-delta="${asset.id}" data-delta="-1" aria-label="减少 ${esc(asset.name)}" ${count ? "" : "disabled"}>-</button>
              <input type="number" min="0" max="${MAX_SHEET_TOKENS_PER_TYPE}" value="${count}" data-token-count="${asset.id}" aria-label="${esc(asset.name)} 数量">
              <button type="button" data-token-delta="${asset.id}" data-delta="1" aria-label="增加 ${esc(asset.name)}" ${count >= MAX_SHEET_TOKENS_PER_TYPE ? "disabled" : ""}>+</button>
            </div>
          </div>`;
        }).join("")}</div>
        <button type="button" class="button secondary small" data-clear-sheet-tokens ${battle.sheetTokens.length ? "" : "disabled"}>清空全部</button>
      </div>
    </details>`;
  }

  function autoSheetTokens(battle) {
    const make = (assetId, slot, count, x, y, options = {}) => count > 0 ? {
      id: `auto-${assetId}-${battle.monsterId}-${slot}`,
      assetId,
      count,
      x,
      y,
      autoSlot: slot,
      ...options
    } : null;
    if (battle.monsterId === "M_Eggknight") {
      const egg = battle.ruleState.eggknight;
      const armor = egg.armor;
      return [
        make("token-armor", "bp1", armor[1], 57.1, 40.2),
        make("token-armor", "bp2", armor[2], 63.6, 40.3),
        make("token-armor", "bp3", armor[3], 70.7, 40.2),
        make("token-01", "counter", egg.counter, 24.3, 74.0, {
          autoAction: "egg-counter",
          mustResolve: egg.counter >= 3
        }),
        make("token-armor", "jacked", egg.jacked, 96.2, 10.4)
      ].filter(Boolean);
    }
    if (battle.monsterId === "M_Stonemason") {
      const armor = battle.ruleState.stonemason.armor;
      return [
        make("token-armor", "back", armor.back, 85.7, 36.5),
        make("token-armor", "right", armor.right, 78.3, 61.6),
        make("token-armor", "left", armor.left, 94.0, 61.8),
        make("token-armor", "front", armor.front, 86.1, 83.7)
      ].filter(Boolean);
    }
    if (battle.monsterId === "M_Knighteater") {
      const eater = battle.ruleState.knighteater;
      return [
        make("token-knighteater-berserk", "首要目标", Number(eater.berserk), 25, 50, {
          title: "首要目标指示物"
        }),
        battle.level >= 2 ? make("token-01", "凶残", eater.brute, 72, 47.5, {
          autoAction: "knighteater-brute",
          title: `凶残通用指示物 ×${eater.brute}/3；点击增加`
        }) : null
      ].filter(Boolean);
    }
    if (battle.monsterId === "M_KnightFen" && battle.level >= 2) {
      const armor = battle.ruleState.knightFen.armor;
      return [make("token-armor", "absorb-the-fallen", armor, 96.0, 8.0, {
        title: `吸收亡者盔甲指示物 ×${armor}`
      })].filter(Boolean);
    }
    if (battle.monsterId === "M_FirstmenLictor") {
      return [make("token-01", "Taunt & Decoy", battle.ruleState.lictorDecoyTokens, 68.5, 8.5)].filter(Boolean);
    }
    if (warriorRetributionActive(battle)) {
      const counter = battle.ruleState.firstmenWarriors.retributionMarkers;
      return [make("token-01", "retribution", counter, 97, 28.7, {
        title: `战术反击通用指示物 ×${counter}/4；第 4 张 BP 进入损伤堆叠后自动清除并提醒`
      })].filter(Boolean);
    }
    if (battle.monsterId === "M_HauntOf") {
      const counter = battle.ruleState.etherealUnity.counter;
      return [make("token-01", "ethereal-unity", counter, 24.3, 69.0, {
        autoAction: counter >= 3 ? "ethereal-unity" : "",
        mustResolve: counter >= 3,
        title: `聚合灵体通用指示物 ×${counter}${counter >= 3 ? "，点击结算并生成 3 只新鬼影" : ""}`
      })].filter(Boolean);
    }
    if (battle.monsterId === "M_Ironcast" && battle.level >= 2) {
      const counter = battle.ruleState.ironcast.necrofusion;
      return [make("token-01", "necrofusion", counter, 16.0, 66.5, {
        autoAction: "ironcast-necrofusion",
        mustResolve: counter >= 3,
        title: `亡骸融合通用指示物 ×${counter}${counter >= 3 ? "，点击结算并生成铁铸骷髅" : "，点击增加"}`
      })].filter(Boolean);
    }
    if (battle.monsterId === "M_WhiteApe") {
      const reinforcement = battle.ruleState.reinforcementTokens;
      const vengeance = battle.ruleState.vengeanceTokens;
      const vengeanceThreshold = whiteVengeanceThreshold(battle);
      return [
        make("token-01", "reinforcements", reinforcement, 72.5, 23.5, {
          autoAction: "white-reinforcements",
          mustResolve: reinforcement >= 4,
          title: `增援抵达通用指示物 ×${reinforcement}${reinforcement >= 4 ? "，点击清除并生成先民护卫" : "，点击增加"}`
        }),
        battle.level >= 2 ? make("token-01", "vengeance", vengeance, 72.5, 88.0, {
          autoAction: "white-vengeance",
          mustResolve: vengeance >= vengeanceThreshold,
          title: `为部落复仇通用指示物 ×${vengeance}/${vengeanceThreshold}${vengeance >= vengeanceThreshold ? "，点击清除并结算 AI 顶牌" : "，点击增加"}`
        }) : null
      ].filter(Boolean);
    }
    if (battle.monsterId === "M_KingLaidLow" && battle.level >= 2) {
      const counter = battle.ruleState.kingLaidLow.putrid;
      return [make("token-01", "putrid-penance", counter, 73.5, 41.0, {
        autoAction: "king-putrid-penance",
        mustResolve: counter >= 4,
        title: `腐臭赎罪通用指示物 ×${counter}${counter >= 4 ? "，点击清除并执行标志行为" : "，点击增加"}`
      })].filter(Boolean);
    }
    if (cookieCrumbsActive(battle)) {
      return [make("token-01", "Cookie Crumbs", battle.ruleState.cookieTokens, 94.5, 50.5)].filter(Boolean);
    }
    return [];
  }

  function sheetTokenLayer(battle) {
    const displayTokens = [...battle.sheetTokens, ...autoSheetTokens(battle)];
    const bogWitchPosition = battle.monsterId === "M_BogWitch"
      ? BOG_WITCH_POSITIONS.map((position, index) => {
        const active = battle.ruleState.bogWitch.position === index;
        const next = (index + 1) % BOG_WITCH_POSITIONS.length;
        const title = active
          ? `${position.label}（当前位置；点击移动到${BOG_WITCH_POSITIONS[next].label}）`
          : `移动到${position.label}`;
        return `<button type="button" class="bog-position-slot ${active ? "active" : ""}"
          data-bog-position="${index}" style="left:${position.x}%;top:${position.y}%"
          title="${esc(title)}" aria-label="${esc(title)}">
          ${active ? `<img src="${BOG_WITCH_MARKER_SRC}" alt="">` : '<span aria-hidden="true">+</span>'}
        </button>`;
      }).join("")
      : "";
    const emptyEggCounterSlot = battle.monsterId === "M_Eggknight" && !battle.ruleState.eggknight.counter
      ? '<button type="button" class="sheet-rule-token-slot" data-egg-counter-slot style="left:24.3%;top:74.0%" title="放置 1 个还击通用指示物">+</button>'
      : "";
    const emptyIroncastCounterSlot = battle.monsterId === "M_Ironcast" && battle.level >= 2
      && !battle.ruleState.ironcast.necrofusion
      ? '<button type="button" class="sheet-rule-token-slot" data-ironcast-necrofusion-slot style="left:16.0%;top:66.5%" title="放置 1 个亡骸融合通用指示物">+</button>'
      : "";
    const emptyWhiteReinforcementSlot = battle.monsterId === "M_WhiteApe"
      && !battle.ruleState.reinforcementTokens
      ? '<button type="button" class="sheet-rule-token-slot" data-white-reinforcement-slot style="left:72.5%;top:23.5%" title="放置 1 个增援抵达通用指示物">+</button>'
      : "";
    const emptyWhiteVengeanceSlot = whiteVengeanceActive(battle)
      && !battle.ruleState.vengeanceTokens
      ? `<button type="button" class="sheet-rule-token-slot" data-white-vengeance-slot style="left:72.5%;top:88%" title="放置 1 个为部落复仇通用指示物">+</button>`
      : "";
    const emptyKingPutridSlot = battle.monsterId === "M_KingLaidLow" && battle.level >= 2
      && !battle.ruleState.kingLaidLow.putrid
      ? '<button type="button" class="sheet-rule-token-slot" data-king-putrid-slot style="left:73.5%;top:41.0%" title="放置 1 个腐臭赎罪通用指示物">+</button>'
      : "";
    const emptyKnighteaterBruteSlot = battle.monsterId === "M_Knighteater" && battle.level >= 2
      && !battle.ruleState.knighteater.brute
      ? '<button type="button" class="sheet-rule-token-slot" data-knighteater-brute-slot style="left:72%;top:47.5%" title="放置 1 个凶残通用指示物">+</button>'
      : "";
    return `<div class="sheet-token-layer">${bogWitchPosition}${displayTokens.map(token => {
      const asset = TOKEN_ASSETS.find(item => item.id === token.assetId);
      if (!asset) return "";
      const automatic = Boolean(token.autoSlot);
      const interactiveAuto = Boolean(token.autoAction);
      const tag = automatic && !interactiveAuto ? "span" : "button";
      const attributes = token.autoAction === "egg-counter"
        ? 'type="button" data-egg-counter-token'
        : token.autoAction === "ethereal-unity"
          ? 'type="button" data-ethereal-unity-resolve'
        : token.autoAction === "ironcast-necrofusion"
          ? 'type="button" data-ironcast-necrofusion-token'
        : token.autoAction === "white-reinforcements"
          ? 'type="button" data-white-reinforcement-token'
        : token.autoAction === "white-vengeance"
          ? 'type="button" data-white-vengeance-token'
        : token.autoAction === "king-putrid-penance"
          ? 'type="button" data-king-putrid-token'
        : token.autoAction === "knighteater-brute"
          ? 'type="button" data-knighteater-brute-token'
        : automatic
          ? `data-auto-armor-slot="${esc(token.autoSlot)}"`
          : `type="button" data-sheet-token="${esc(token.id)}"`;
      const title = token.title || (token.autoAction === "egg-counter"
        ? `还击通用指示物 ×${token.count}${token.mustResolve ? "，点击触发标志行为" : "，点击增加"}`
        : `${asset.name}${automatic ? ` · ${token.autoSlot} ×${token.count}` : ""}`);
      return `<${tag} ${attributes}
        class="sheet-token ${automatic ? "auto-token" : ""} ${interactiveAuto ? "interactive-auto-token" : ""} ${token.mustResolve ? "must-resolve" : ""}" style="left:${token.x}%;top:${token.y}%"
        title="${esc(title)}" ${automatic ? "" : `aria-label="拖动 ${esc(asset.name)}"`}>
        <span class="sheet-token-stack">
          ${token.count > 2 ? `<img class="sheet-token-copy back ${asset.shape === "square" ? "token-square" : ""}" src="${esc(asset.src)}" alt="">` : ""}
          ${token.count > 1 ? `<img class="sheet-token-copy middle ${asset.shape === "square" ? "token-square" : ""}" src="${esc(asset.src)}" alt="">` : ""}
          <img class="sheet-token-image ${asset.shape === "square" ? "token-square" : ""}" src="${esc(asset.src)}" alt="">
        </span>
        ${token.count > 1 ? `<span class="sheet-token-quantity">x${token.count}</span>` : ""}
      </${tag}>`;
    }).join("")}${emptyEggCounterSlot}${emptyIroncastCounterSlot}${emptyWhiteReinforcementSlot}${emptyWhiteVengeanceSlot}${emptyKingPutridSlot}${emptyKnighteaterBruteSlot}</div>`;
  }

  function youngDevourStageOverlay(monster, battle) {
    const rule = bossRule(monster);
    if (rule?.kind !== "devour-stages") return "";
    const stageId = battle.ruleState.phaseIds[battle.ruleState.phaseIndex];
    const stage = rule.stages.find(item => item.id === stageId);
    const card = cardById(monster, stageId);
    if (!stage || !card) return "";
    return `<div class="young-devour-stage-overlay" data-young-devour-stage-card="${esc(stageId)}"
      title="当前状态：${esc(stage.name)}" aria-label="当前状态：${esc(stage.name)}">
      ${cardHtml(card, "young-devour-sheet-card", "face", false)}
    </div>`;
  }

  function mobTrackHtml(monster, battle) {
    const selectedAsset = TOKEN_ASSETS.find(asset => asset.id === mobMarkerAssetId) || TOKEN_ASSETS[0];
    const mobTactic = cardById(monster, battle.mobTacticCard);
    const warriorCompanions = monster.id === "M_FirstmenWarriors"
      ? [
          cardByAnyId(FIRSTMEN_WARRIOR_COMPANION_CARDS.muscularChest),
          cardByAnyId(FIRSTMEN_WARRIOR_COMPANION_CARDS.rampageStrike)
        ].filter(Boolean)
      : [];
    const genericToken = TOKEN_ASSETS.find(asset => asset.id === "token-01");
    const muscularChestMarkers = clamp(battle.ruleState.firstmenWarriors?.muscularChestMarkers, 0, 4);
    const scabArmorActive = palebloodScabArmorActive(monster, battle);
    const ratwolfPending = ratwolfSignaturePending(battle);
    const ratwolves = battle.ruleState.ratwolves;
    mobMarkerAssetId = selectedAsset.id;
    return `<div class="mob-track-section">
      ${scabArmorActive ? '<div class="mob-rule-note"><strong>血痂护甲</strong><span>初始与冲突中生成的 BP 自动获得 1 枚血液；每枚血液使该 BP 的 AT 降低 1。</span></div>' : ""}
      ${ratwolfPending ? `<div class="mob-rule-note ratwolf-rebirth-note">
        <strong>新生狼鼠 · ${esc(ratwolves.rankSource)} BP${ratwolves.spawnedRank}</strong>
        <span>杂兵轨 ${ratwolves.trackIndex + 1}：放到可作为随机一名骑士相邻同伴、最靠近场边且无障碍的格子；若被占据，位移其他模型。然后执行标志行为。</span>
        <button type="button" class="button small" data-ratwolf-signature-complete>完成标志行为</button>
      </div>` : ""}
      <div class="mob-track" aria-label="杂兵 BP 轨">${mobTactic ? `<div class="mob-slot mob-tactic-slot">
        ${monster.id === "M_FirstmenLictor" && battle.level >= 3 ? "<span>高级战术</span>" : ""}
        <div class="mob-card-stage">${cardHtml(mobTactic, "track-card")}</div>
      </div>` : ""}${warriorCompanions.map(card => {
        const muscularChest = card.id === FIRSTMEN_WARRIOR_COMPANION_CARDS.muscularChest;
        return `<div class="mob-slot warrior-companion-slot ${muscularChest ? "warrior-muscular-chest" : ""}">
          <div class="mob-card-stage">
            ${cardHtml(card, "track-card")}
            ${muscularChest && muscularChestMarkers && genericToken ? `<div class="warrior-companion-markers" title="Generic ×${muscularChestMarkers}">
              <img src="${esc(genericToken.src)}" alt="Generic">
              <strong>×${muscularChestMarkers}</strong>
            </div>` : ""}
          </div>
          ${muscularChest ? `<button type="button" class="button danger small warrior-muscular-defeat" data-warrior-muscular-defeat ${muscularChestMarkers >= 4 ? "disabled" : ""}>结算击败</button>` : ""}
        </div>`;
      }).join("")}${battle.bpTrack.map((slot, index) => {
        if (!slot.id) return `<div class="mob-slot empty"><span class="${mobNumberClass(index + 1)}">${index + 1}</span><strong>空位</strong></div>`;
        const markerTokens = slot.markerTokens || {};
        const selectedCount = clamp(markerTokens[selectedAsset.id], 0, MAX_SHEET_TOKENS_PER_TYPE);
        const selectedMax = selectedAsset.id === "token-01" && isPumpkinhead(monster) && isSpecialMobSlot(monster, slot)
          ? MAX_BP_MARKERS : MAX_SHEET_TOKENS_PER_TYPE;
        const placedMarkers = TOKEN_ASSETS.map(asset => ({ asset, count: clamp(markerTokens[asset.id], 0, MAX_SHEET_TOKENS_PER_TYPE) }))
          .filter(item => item.count);
        return `<div class="mob-slot ${slot.revealed ? "revealed" : ""} ${slot.id === battle.activeBP ? "active" : ""} ${slot.decoy ? "decoy" : ""}">
          <span class="${mobNumberClass(index + 1)}">${index + 1}</span>
          <div class="mob-card-stage">
            <button class="mob-card-button" data-mob="${index}" ${battle.activeBP || ratwolfPending ? "disabled" : ""}>
              ${cardHtml(cardById(monster, slot.id), "track-card", slot.revealed ? slot.side : "back", false, false)}
            </button>
            ${placedMarkers.length ? `<div class="mob-bp-markers">${placedMarkers.map(({ asset, count }) =>
              `<span class="mob-bp-marker" title="${esc(asset.name)} ×${count}"><img class="${asset.shape === "square" ? "token-square" : ""}" src="${esc(asset.src)}" alt=""><strong>×${count}</strong></span>`
            ).join("")}</div>` : ""}
            ${slot.decoy ? '<strong class="mob-decoy-badge">诱匿</strong>' : ""}
          </div>
          ${monster.id === "M_FirstmenLictor" ? `<button type="button" class="button secondary small mob-decoy-toggle ${slot.decoy ? "active" : ""}" data-lictor-decoy="${index}">${slot.decoy ? "解除诱匿" : "设为诱匿"}</button>` : ""}
          <div class="mob-marker-controls" aria-label="第 ${index + 1} 张 BP 的 ${esc(selectedAsset.name)}标记">
            <button type="button" data-mob-marker="${index}" data-marker-asset="${esc(selectedAsset.id)}" data-delta="-1" title="移除 ${esc(selectedAsset.name)}" ${selectedCount ? "" : "disabled"}>−</button>
            <label class="mob-marker-type-picker" title="点击切换标记种类：${esc(selectedAsset.name)}">
              <img class="${selectedAsset.shape === "square" ? "token-square" : ""}" src="${esc(selectedAsset.src)}" alt="">
              <strong>${selectedCount}</strong>
              <select data-mob-marker-asset aria-label="第 ${index + 1} 张 BP 的标记种类">${TOKEN_ASSETS.map(asset =>
                `<option value="${esc(asset.id)}" ${asset.id === selectedAsset.id ? "selected" : ""}>${esc(asset.name)}</option>`
              ).join("")}</select>
            </label>
            <button type="button" data-mob-marker="${index}" data-marker-asset="${esc(selectedAsset.id)}" data-delta="1" title="放置 ${esc(selectedAsset.name)}" ${selectedCount >= selectedMax ? "disabled" : ""}>+</button>
          </div>
          <div class="mob-activations">${battle.mobActivations
            .filter(token => token.position === index)
            .map(token => `<button class="activation-token ${token.used ? "used" : "ready"} ${token.id === battle.activeMobActivationId ? "active" : ""}"
              data-activation="${esc(token.id)}" ${ratwolfPending || token.used || (battle.activeMobActivationId && token.id !== battle.activeMobActivationId) ? "disabled" : ""}>
              ${mobActivationKind(monster, token, battle)} · ${token.used ? "已用" : token.id === battle.activeMobActivationId ? "再点完成" : "准备"}
            </button>`).join("")}</div>
        </div>`;
      }).join("")}</div>
    </div>`;
  }

  function doppelgangerTrackHtml(monster, battle) {
    const rule = bossRule(monster);
    if (rule?.kind !== "doppelgangers") return "";
    const doppelgangers = battle.ruleState.doppelgangers;
    return `<div class="mob-track-section doppelganger-track-section">
      <div class="doppelganger-track-header">
        <div><span class="eyebrow">MOB TRACK</span><h3>拟身骑士杂兵轨</h3></div>
        <button class="button secondary" data-rule-action="spawn-doppel">生成拟身骑士</button>
      </div>
      <div class="mob-track doppelganger-track" aria-label="拟身骑士杂兵轨">${doppelgangers.map((item, index) => {
        const revealed = Boolean(item.revealed);
        const paired = item.cards.length > 1;
        const strength = item.cards.reduce((sum, id) => sum + Number(rule.bpStrength?.[id] || 0), 0);
        const displayCards = paired ? item.cards : [...item.cards].reverse();
        const stack = displayCards.map(cardId => {
          const depth = item.cards.indexOf(cardId);
          const showFace = revealed;
          return `<div class="doppelganger-card-layer" style="--stack-depth:${depth};--stack-order:${item.cards.length - depth}">
            ${cardHtml(cardById(monster, cardId), "track-card", showFace ? "face" : "back", false, showFace)}
          </div>`;
        }).join("");
        return `<article class="mob-slot doppelganger-slot ${paired ? "paired" : ""} ${revealed ? "revealed" : ""}">
          <span class="${mobNumberClass(index + 1)}">${index + 1}</span>
          <div class="doppelganger-card-stack ${paired ? "paired" : ""}">${stack}</div>
          <div class="doppelganger-slot-meta"><strong>拟身骑士 ${index + 1}</strong><small>BP × ${item.cards.length} · 总强度 ${strength}</small></div>
          <div class="rule-actions compact doppelganger-slot-actions">
            <button class="button danger small" data-defeat-doppel="${esc(item.id)}">同时击伤</button>
            <button class="button secondary small" data-flip-doppel="${esc(item.id)}">${revealed ? "翻回背面" : "翻面"}</button>
          </div>
        </article>`;
      }).join("") || '<div class="mob-slot empty doppelganger-empty-slot"><strong>轨道为空</strong><small>生成效果触发时添加拟身骑士</small></div>'}</div>
    </div>`;
  }

  function patientCardsHtml(monster, ids) {
    return ids.length ? `<div class="patient-row">${ids.map(id =>
      `<span class="patient-card" title="${esc(id)}">${esc(patientLetter(monster, id))}</span>`
    ).join("")}</div>` : '<span class="muted">尚未抽取</span>';
  }

  function p2CounterHtml(label, key, value) {
    return `<div class="rule-counter"><span>${esc(label)}</span><div class="counter">
      <button data-p2-counter="${esc(key)}" data-delta="-1" ${value ? "" : "disabled"}>-</button>
      <strong>${value}</strong>
      <button data-p2-counter="${esc(key)}" data-delta="1">+</button>
    </div></div>`;
  }

  function bossRulePanel(monster) {
    const rule = bossRule(monster);
    if (!rule) return "";
    if (["ancient-dusk", "doppelgangers", "hidden-ai-discard", "king-laid-low"].includes(rule.kind)) return "";
    const b = state.battle;
    const rs = b.ruleState;
    let body = "";

    if (rule.kind === "devour-stages") {
      const stages = rs.phaseIds.map(id => rule.stages.find(stage => stage.id === id)).filter(Boolean);
      body = `<div class="devour-stage-layout">
        <div class="rule-track">${stages.map((stage, index) =>
          `<div class="rule-track-item ${index === rs.phaseIndex ? "active" : ""} ${index < rs.phaseIndex ? "done" : ""}"
            data-devour-stage="${index}" aria-current="${index === rs.phaseIndex ? "step" : "false"}">
            <span>${index + 1}</span><strong>${esc(stage.name)}</strong>
          </div>`).join("")}</div>
        <div class="devour-stage-actions">
          <button class="button" data-rule-action="advance-stage" ${rs.phaseIndex >= stages.length - 1 ? "disabled" : ""}>推进阶段</button>
        </div>
      </div>`;
    }

    if (rule.kind === "white-ape") {
      const guardians = rs.guardians;
      const guardianSlots = whiteGuardianSlots(guardians);
      const cap = guardianCap(b.level);
      const vengeanceThreshold = b.level >= 4 ? 3 : b.level >= 3 ? 4 : 5;
      const canSpawn = !rs.pendingCoordinatedAttacks
        && guardianSlots.some((occupied, index) => index < cap && !occupied);
      const canPass = !rs.pendingCoordinatedAttacks
        && (nextWhiteGuardianIndex(guardians) >= 0 || guardians.carrier !== 0);
      body = `<div class="white-guardian-rule">
        <div class="rule-actions">
          <button class="button" data-rule-action="white-round" ${rs.pendingCoordinatedAttacks ? "disabled" : ""}>怪物轮开始</button>
          <button class="button secondary" data-rule-action="spawn-white-guardian" ${canSpawn ? "" : "disabled"}>特殊生成护卫</button>
          <button class="button secondary" data-rule-action="pass-guardian" ${canPass ? "" : "disabled"}>传递 BP</button>
          <button class="button secondary" data-rule-action="guardian-attack" ${rs.pendingCoordinatedAttacks ? "" : "disabled"}>协同攻击 ×${rs.pendingCoordinatedAttacks}</button>
        </div>
        <div class="guardian-rule-summary">
          <strong>先民护卫共享 BP</strong>
          <span>特殊生成放在与大红树相邻、尽量靠近巨白猿魔的格子；同享巨白猿魔的属性加成；生成与死亡均不产生损伤或晋升。</span>
        </div>
        <div class="guardian-mob-track" aria-label="先民护卫杂兵轨">${Array.from({ length: 6 }, (_, index) => {
          const occupied = guardianSlots[index];
          const carrier = guardians.carrier === index;
          const locked = index >= cap;
          return `<div class="guardian-track-slot ${occupied ? "occupied" : "empty"} ${carrier ? "carrier" : ""} ${locked ? "locked" : ""}" data-guardian-slot="${index}" ${carrier ? "data-guardian-carrier" : ""}>
            <span class="guardian-track-number ${mobNumberClass(index + 1)}">${index + 1}</span>
            <div class="guardian-track-body">
              ${carrier ? cardHtml(cardById(monster, rule.cards.guardian), "guardian-track-card track-card", "face", false) : occupied ? `<div class="guardian-track-figure">
                <img src="assets/guardians/firstman-guardian-placeholder.png" alt="先民护卫 ${index + 1}">
              </div>` : `<div class="guardian-track-placeholder">
                <strong>${locked ? "等级未开放" : occupied ? `先民护卫 ${index + 1}` : "空位"}</strong>
                <span>${occupied ? "共享属性加成" : locked ? `护卫上限 ${cap}` : "等待特殊生成"}</span>
              </div>`}
              ${carrier ? `<span class="guardian-carrier-badge">${occupied ? `护卫 ${index + 1} 持有` : "BP 等待"}</span>` : ""}
            </div>
            ${occupied ? `<button class="button danger small" data-defeat-guardian="${index}" ${rs.pendingCoordinatedAttacks ? "disabled" : ""}>护卫死亡</button>` : '<span class="guardian-slot-spacer"></span>'}
          </div>`;
        }).join("")}</div>
        <div class="rule-badges"><span class="badge">厚皮：${rs.thickSkinSetAside ? "专用区域" : b.bpDeck[0] === rule.cards.thickSkin ? "BP 顶" : "牌组中"}</span><span class="badge">护卫 ${guardians.count}/${cap}</span><span class="badge">增援 ${rs.reinforcementTokens}/4</span>${b.level >= 2 ? `<span class="badge">复仇 ${rs.vengeanceTokens}/${vengeanceThreshold}</span>` : ""}</div>
      </div>`;
    }

    if (rule.kind === "puppet-king") {
      const genericAsset = TOKEN_ASSETS.find(asset => asset.id === "token-01");
      const armorAsset = TOKEN_ASSETS.find(asset => asset.id === "token-armor");
      const puppet = rs.puppetKing;
      body = `<div class="puppet-rule-layout">
        <section class="puppet-fallen-module">
          <div class="puppet-fallen-header">
            <div class="puppet-module-heading"><span class="eyebrow">TRAIT</span><strong>陨落骑士</strong></div>
            <details class="puppet-fallen-details">
              <summary>BP 卡</summary>
              <div class="puppet-fallen-stage">
                ${cardHtml(cardById(monster, rule.cards.fallenKnight), "puppet-fallen-card")}
                ${puppet.fallenKnightTokens && genericAsset ? `<span class="puppet-fallen-token" title="通用指示物 1/2">
                  <img src="${esc(genericAsset.src)}" alt=""><strong>1</strong>
                </span>` : ""}
              </div>
            </details>
            <button class="button" data-rule-action="damage-puppet-fallen">造成损伤</button>
          </div>
        </section>
        <section class="puppet-armor-module">
          <div class="puppet-module-heading"><span class="eyebrow">COUNTER</span><strong>盔甲指示物</strong></div>
          <div class="smelted-armor-controls">
            <button class="smelted-armor-step" aria-label="减少 Puppet King 盔甲" data-puppet-armor data-delta="-1" ${puppet.armor ? "" : "disabled"}>-</button>
            <span class="smelted-armor-token">
              ${armorAsset ? `<img class="smelted-armor-icon" src="${esc(armorAsset.src)}" alt="">` : ""}
              <strong class="smelted-armor-count">${puppet.armor}</strong>
            </span>
            <button class="smelted-armor-step" aria-label="增加 Puppet King 盔甲" data-puppet-armor data-delta="1">+</button>
          </div>
          <span class="badge ${puppet.armor >= 4 ? "danger-badge" : ""}">${puppet.armor}/5</span>
        </section>
      </div>`;
    }

    if (rule.kind === "bog-witch") {
      const party = window.KF_CAMPAIGN_PARTY || [];
      const holders = [...new Set(["沼地女巫", ...party.map(item => item.name || item.title).filter(Boolean)])];
      body = `<div class="rule-form-row">
          <label>附着目标<select data-bog-holder>${holders.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join("")}<option value="__custom__">其他骑士</option></select></label>
          <label>其他骑士姓名<input data-bog-custom-holder placeholder="输入姓名"></label>
          <button class="button" data-rule-action="attach-bog-ai" ${b.activeAI ? "" : "disabled"}>附着当前 AI</button>
          <label>面朝下 BP<select data-hidden-bp-index>${b.bpDeck.map((id, index) => `<option value="${index}">${bogBpCandidateLabel(monster, id, index)}</option>`).join("")}</select></label>
          <button class="button secondary" data-rule-action="hidden-bp-top" ${b.bpDeck.length ? "" : "disabled"}>选择并置顶</button>
          <button class="button secondary" data-rule-action="cookie-crumbs" ${cookieCrumbsActive(b) ? "" : "disabled"}>结算 Cookie Crumbs</button>
        </div>
        <div class="special-track">${rs.aiAttachments.map(item =>
          `<div class="special-unit attachment"><strong>${esc(item.holder)}</strong>${cardHtml(cardById(monster, item.cardId), "attachment-card")}
            <button class="button secondary small" data-return-attachment="${esc(item.id)}">归还 AI</button></div>`).join("") || '<p class="empty-message">尚无附着 AI</p>'}</div>`;
    }

    if (rule.kind === "panzer-colony") {
      const armorAsset = TOKEN_ASSETS.find(asset => asset.id === "token-armor");
      const targets = [
        { id: "field", label: "虫阵", detail: "特殊 BP", cardId: rule.cards.field, action: 'data-rule-action="panzer-field"' },
        { id: "dragon", label: "巨龙", detail: "普通 BP", cardId: rule.cards.mortalRetribution, action: 'data-draw="bp"' },
        { id: "remnant", label: "残余", detail: "特殊 BP", cardId: rule.cards.remnant, action: 'data-rule-action="panzer-remnant"' }
      ];
      const retributionCount = rs.panzerRetributionArmor;
      body = `<div class="panzer-panel-layout">
        <div class="panzer-trait-row">${targets.map(target => `<div class="panzer-trait-stage" data-panzer-trait="${target.id}">
          ${cardHtml(cardById(monster, target.cardId), "panzer-trait-card")}
          ${target.id === "dragon" && retributionCount ? `<${retributionCount >= 8 ? "button" : "span"}
            class="panzer-retribution-token ${retributionCount >= 8 ? "ready" : ""}"
            ${retributionCount >= 8 ? 'type="button" data-rule-action="clear-panzer-retribution" aria-label="弃置现行现报上的 8 枚盔甲" title="点击弃置全部 8 枚盔甲"' : `title="现行现报盔甲 ${retributionCount}/8"`}>
            <span class="panzer-retribution-stack">
              ${retributionCount > 2 && armorAsset ? `<img class="back" src="${esc(armorAsset.src)}" alt="">` : ""}
              ${retributionCount > 1 && armorAsset ? `<img class="middle" src="${esc(armorAsset.src)}" alt="">` : ""}
              ${armorAsset ? `<img src="${esc(armorAsset.src)}" alt="">` : ""}
            </span>
            <strong class="smelted-armor-count">${retributionCount}</strong>
          </${retributionCount >= 8 ? "button" : "span"}>` : ""}
        </div>`).join("")}</div>
        <div class="panzer-controls-panel">
          <div class="panzer-armor-list">${targets.map(target => {
            const value = rs.panzerArmor[target.id];
            return `<section class="panzer-armor-module" data-panzer-module="${target.id}">
          <button class="panzer-target-action" ${target.action} ${rs.ruleCard ? "disabled" : ""}>
            <strong>${target.label}</strong><span>${target.detail}</span>
          </button>
          <div class="panzer-armor-display">
            <span>盔甲</span>
            <div class="smelted-armor-controls">
              <button class="smelted-armor-step" aria-label="减少${target.label}盔甲" data-panzer-armor="${target.id}" data-delta="-1" ${value ? "" : "disabled"}>-</button>
              <span class="smelted-armor-token">
                ${armorAsset ? `<img class="smelted-armor-icon" src="${esc(armorAsset.src)}" alt="">` : ""}
                <strong class="smelted-armor-count">${value}</strong>
              </span>
              <button class="smelted-armor-step" aria-label="增加${target.label}盔甲" data-panzer-armor="${target.id}" data-delta="1">+</button>
            </div>
          </div>
        </section>`;
          }).join("")}</div>
          <div class="panzer-migrate-strip">
            <span class="panzer-migrate-route">虫阵 <b aria-hidden="true">&#8594;</b> 巨龙 <b aria-hidden="true">&#8594;</b> 残余 <b aria-hidden="true">&#8594;</b> 虫阵</span>
            <button class="button secondary panzer-migrate-button" aria-label="循环迁移盔甲" title="循环迁移盔甲" data-rule-action="migrate-armor"><span aria-hidden="true">&#8635;</span>循环迁移</button>
          </div>
        </div>
      </div>`;
    }

    if (rule.kind === "smelted-fears") {
      const smelted = rs.smeltedFears;
      const armorAsset = TOKEN_ASSETS.find(asset => asset.id === "token-armor");
      body = `<div class="smelted-armor-layout">
        <div class="smelted-armor-display">
          <span>盔甲指示物</span>
          <div class="smelted-armor-controls">
            <button class="smelted-armor-step" aria-label="减少盔甲指示物" data-p2-counter="smelted:devilArmor" data-delta="-1" ${smelted.devilArmor ? "" : "disabled"}>-</button>
            <span class="smelted-armor-token">
              ${armorAsset ? `<img class="smelted-armor-icon" src="${esc(armorAsset.src)}" alt="">` : ""}
              <strong class="smelted-armor-count">${smelted.devilArmor}</strong>
            </span>
            <button class="smelted-armor-step" aria-label="增加盔甲指示物" data-p2-counter="smelted:devilArmor" data-delta="1">+</button>
          </div>
        </div>
        <button class="button secondary smelted-bargain-button" aria-label="讲价弃置 1 枚盔甲到窖牢" title="讲价弃置 1 枚盔甲到窖牢" data-rule-action="smelted-bargain-armor" ${smelted.devilArmor ? "" : "disabled"}>&#8594;</button>
        <div class="smelted-armor-display">
          <span>窖牢</span>
          <span class="smelted-armor-token">
            ${armorAsset ? `<img class="smelted-armor-icon" src="${esc(armorAsset.src)}" alt="">` : ""}
            <strong class="smelted-armor-count" data-smelter-oubliette-count>${smelted.ironTitheArmor}</strong>
          </span>
        </div>
      </div>`;
    }

    if (rule.kind === "eggknight") {
      const egg = rs.eggknight;
      const counterReady = egg.counter >= 3;
      const jackedText = egg.jacked >= 9 ? "攻击额外造成 3 活力损失" : egg.jacked >= 5 ? "怪物攻击 +1 闪避" : egg.jacked >= 2 ? "闪避难度 +1" : "未激活";
      body = `<div class="egg-rule-line">${[1, 2, 3].map(slot => `<div class="egg-armor-inline"><span>BP${slot} 盔甲 / +AT</span><div class="counter"><button data-egg-armor="${slot}">-</button><strong>${egg.armor[slot]}</strong><button data-egg-add="${slot}">+</button></div><button class="button secondary small" data-egg-headbutt="${slot}">头槌弃甲</button></div>`).join("")}
        <span class="badge ${counterReady ? "danger-badge" : ""}">还击 ${egg.counter}/3${counterReady ? " · 立即处理" : ""}</span><span class="badge gold">Jacked ${egg.jacked}：${jackedText}</span></div>`;
    }

    if (rule.kind === "knighteater") {
      const eater = rs.knighteater;
      const armorAsset = TOKEN_ASSETS.find(asset => asset.id === "token-armor");
      body = `<div class="rule-actions compact">
        <div class="smelted-armor-display">
          <span>盔甲指示物</span>
          <div class="smelted-armor-controls">
            <button class="smelted-armor-step" aria-label="减少盔甲指示物" data-p2-counter="eater:armor" data-delta="-1" ${eater.armor ? "" : "disabled"}>-</button>
            <span class="smelted-armor-token">
              ${armorAsset ? `<img class="smelted-armor-icon" src="${esc(armorAsset.src)}" alt="">` : ""}
              <strong class="smelted-armor-count">${eater.armor}</strong>
            </span>
            <button class="smelted-armor-step" aria-label="增加盔甲指示物" data-p2-counter="eater:armor" data-delta="1">+</button>
          </div>
        </div>
        <button class="button secondary" data-rule-action="toggle-berserk">${eater.berserk ? "停止暴走" : "开始暴走"}</button>
      </div>`;
    }

    if (rule.kind === "stonemason") {
      const stone = rs.stonemason;
      const labels = { front: "前", right: "右", back: "后", left: "左" };
      const armorAsset = TOKEN_ASSETS.find(asset => asset.id === "token-armor");
      body = `<div class="stonemason-armor-grid" aria-label="四方向盔甲指示物">${Object.entries(stone.armor).map(([direction, value]) => `
        <div class="stonemason-armor-module ${direction === stone.direction ? "is-current" : ""}" ${direction === stone.direction ? 'aria-current="true"' : ""}>
          <span class="stonemason-armor-label">${labels[direction]}方节点</span>
          <div class="smelted-armor-controls">
            <button class="smelted-armor-step" aria-label="减少${labels[direction]}方盔甲指示物" data-p2-counter="stone:${direction}" data-delta="-1" ${value ? "" : "disabled"}>-</button>
            <span class="smelted-armor-token">
              ${armorAsset ? `<img class="smelted-armor-icon" src="${esc(armorAsset.src)}" alt="">` : ""}
              <strong class="smelted-armor-count">${value}</strong>
            </span>
            <button class="smelted-armor-step" aria-label="增加${labels[direction]}方盔甲指示物" data-p2-counter="stone:${direction}" data-delta="1">+</button>
          </div>
        </div>`).join("")}</div>
        <div class="rule-form-row"><label>攻击/最多骑士方向<select data-stone-direction>${Object.keys(labels).map(direction => `<option value="${direction}" ${direction === stone.direction ? "selected" : ""}>${labels[direction]}</option>`).join("")}</select></label>
          <button class="button secondary" data-rule-action="stone-direction">设为攻击方向</button>
          <button class="button secondary" data-rule-action="stone-round-start">怪物轮开始</button>
          <button class="button" data-rule-action="stone-round-end" ${b.level >= 3 ? "" : "disabled"}>轮结束：磁力聚甲</button>
          <button class="button secondary" data-rule-action="stone-ruin">废墟</button>
          <button class="button secondary" data-rule-action="stone-buried">活埋</button>
          <button class="button secondary" data-rule-action="stone-spikes">铁刺</button>
        </div>
        <div class="rule-badges"><span class="badge ${stone.armorLocked ? "danger-badge" : ""}">${stone.armorLocked ? "本轮禁止获得盔甲" : "可获得盔甲"}</span><span class="badge">当前方向 ${labels[stone.direction]}：${stone.armor[stone.direction]} 甲${stone.armor[stone.direction] ? " / +1 AT" : ""}</span></div>
        <p class="muted">在结算 BP 击伤前先选择攻击方向。瓦砾覆盖、移动穿越和实际地形位置仍由玩家确认。</p>`;
    }

    const ruleCard = cardById(monster, rs.ruleCard);
    return `<section class="panel boss-rule-panel ${b.conflictStatus === "failed" ? "failed" : ""}">
      ${b.conflictStatus === "failed" ? '<div class="rule-badges boss-rule-status"><span class="badge danger-badge">冲突失败</span></div>' : ""}
      ${b.conflictStatus === "failed" ? `<div class="conflict-alert">${esc(b.failureReason)}</div>` : ""}
      ${body}
      ${ruleCard ? `<div class="rule-card-resolution"><div>${cardHtml(ruleCard, "rule-feature-card", ruleCard.kind === "SIG" && rs.ruleCardReason.includes("标志行为") ? "back" : "face")}</div><div class="stack"><strong>${esc(rs.ruleCardReason)}</strong><button class="button" data-rule-action="complete-rule-card">完成卡面处理</button></div></div>` : ""}
      ${rule.kind !== "panzer-colony" && rs.ruleNotice ? `<p class="rule-notice">${esc(rs.ruleNotice)}</p>` : ""}
    </section>`;
  }

  function activeReferenceCards(monster, battle) {
    const setup = mobConflictSetup(monster);
    const conditional = new Map((setup?.conditionalCards || []).map(item => [item.id, item]));
    const kingdomTrait = window.KF_CAMPAIGN_KINGDOM === "stone" ? "Trait_POS" : "Trait_SK";
    return monster.cards.filter(card => {
      if (!["SIG", "Trait", "Trait_SK", "Trait_POS", "BPX"].includes(card.kind)) return false;
      if (allMobTacticIds(monster).includes(card.id)) return false;
      if (["Trait_SK", "Trait_POS"].includes(card.kind) && card.kind !== kingdomTrait) return false;
      if (isWingedNightmare(monster) && card.id === WINGED_BLOODY_DEFIANCE_ID
        && (battle.clashPhase === "preliminary" || wingedBloodyDefianceActive(battle))) return false;
      const rule = conditional.get(card.id);
      if (!rule) return true;
      if (rule.zone && rule.zone !== "reference") return false;
      return battle.level >= Number(rule.minLevel || 1)
        && (!rule.maxLevel || battle.level <= Number(rule.maxLevel));
    });
  }

  function conflictBoardLayout(battle = state.battle) {
    return (window.KF_CONFLICT_BOARD_DATA?.layouts || []).find(layout => layout.id === battle.conflictBoard?.layoutId) || null;
  }

  function conflictAssetSrc(asset) {
    const value = String(asset || "");
    const source = window.KF_CONFLICT_BOARD_DATA?.assets?.[value]
      || (value.includes("/") ? value.replace(/^\/+/, "") : "");
    return source ? `../display/${source}` : "";
  }

  function conflictBoardCropStyle() {
    const board = window.KF_CONFLICT_BOARD_DATA?.board;
    const crop = board?.crop;
    if (!board || !crop) return "";
    return `--board-image-width:${board.width / crop.width * 100}%;--board-image-height:${board.height / crop.height * 100}%;--board-image-left:${-crop.x / crop.width * 100}%;--board-image-top:${-crop.y / crop.height * 100}%`;
  }

  function conflictTerrainLabel(asset) {
    return String(asset || "地形").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/(\D)(\d+)/g, "$1 $2");
  }

  function conflictTerrainCards(terrain = state.battle.conflictBoard?.terrain || []) {
    const cardData = window.KF_CONFLICT_BOARD_DATA?.terrainCards;
    if (!cardData?.sheet || !cardData.byAsset) return [];
    const seen = new Set();
    return terrain.flatMap(placement => {
      const card = cardData.byAsset[placement.asset];
      if (!card || seen.has(card.cardId)) return [];
      seen.add(card.cardId);
      return [{ ...card, asset: placement.asset }];
    });
  }

  function conflictTerrainCardFaceHtml(card, className = "") {
    const sheet = window.KF_CONFLICT_BOARD_DATA?.terrainCards?.sheet;
    if (!sheet || !card) return "";
    return `<span class="terrain-card-face ${esc(className)}" style="--card-sheet-width:${sheet.columns * 100}%;--card-sheet-height:${sheet.rows * 100}%;--card-left:${-card.column * 100}%;--card-top:${-card.row * 100}%"><img src="${esc(conflictAssetSrc(sheet.asset))}" alt=""></span>`;
  }

  function conflictGridCellRef(index) {
    const row = Math.floor(index / 14) + 1;
    const column = index % 14 + 1;
    return `${String.fromCharCode(75 - row)}${column}`;
  }

  // 视线叠加层。计算在 kf-overlay.js 里，这里只取结果。
  function conflictOverlay(battle = state.battle) {
    const boardState = battle?.conflictBoard;
    if (!boardState || !window.KF_OVERLAY) return null;
    const layout = conflictBoardLayout(battle);
    return window.KF_OVERLAY.computeOverlay(boardState, layout?.placements || []);
  }

  function conflictOverlayCellLabel(cell) {
    if (!cell) return "未设置";
    const row = cell.row != null ? cell.row : cell.rowStart;
    const column = cell.column != null ? cell.column : cell.columnStart;
    return `${column}列${String.fromCharCode(75 - row)}行`;
  }

  function conflictOverlayFacingLabel(facing) {
    if (facing === 0) return "上";
    if (facing === 90) return "右";
    if (facing === 180) return "下";
    if (facing === 270) return "左";
    return "未定";
  }

  function conflictOverlayPathDetailsHtml(overlay) {
    const rules = overlay?.movement?.rules || [];
    if (!rules.length) return "";
    return rules.map((path, index) => {
      const route = index === 0 ? "A" : "B";
      return `<span>${route}终点 <b>${esc(conflictOverlayCellLabel(path.finalOrigin))}</b></span><span>${route}朝向 <b>${esc(conflictOverlayFacingLabel(path.facing))}</b></span>`;
    }).join("");
  }

  function conflictOverlayMarkerHtml(marker) {
    if (!marker) return "";
    const column = Math.max(1, Number(marker.column) || 1);
    const row = Math.max(1, Number(marker.row) || 1);
    const width = Math.max(1, Number(marker.width) || 1);
    const height = Math.max(1, Number(marker.height) || 1);
    const classes = ["kf-ov-marker", marker.className, marker.facing != null ? `kf-ov-marker-facing-${marker.facing}` : ""]
      .filter(Boolean).join(" ");
    const left = (column - 1) / 14 * 100;
    const top = (row - 1) / 10 * 100;
    const markerWidth = width / 14 * 100;
    const markerHeight = height / 10 * 100;
    const style = `left:${left}%;top:${top}%;width:${markerWidth}%;height:${markerHeight}%;`;
    return `<i class="${esc(classes)}" style="${style}" aria-hidden="true"></i>`;
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
    if (overlay.target) {
      markers.push({ className: "kf-ov-marker-target", column: overlay.target.column, row: overlay.target.row, width: 1, height: 1 });
    }
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

  function conflictOverlayToolsHtml(boardState, layout, overlay) {
    const OV = window.KF_OVERLAY;
    if (!OV || !overlay) return "";
    const settings = overlay.settings;
    const modeButtons = [
      { key: "boss", label: overlay.footprint?.mode === "boss" ? overlay.footprint.label : "Boss" },
      { key: "knight", label: "骑士 1×1" },
    ].map(item => `<button type="button" class="button secondary small ${overlayPlacementMode === item.key ? "active" : ""}" data-overlay-mode="${item.key}">放置 ${esc(item.label)}</button>`).join("");
    const toggles = [
      { key: "los", label: "遮挡", title: "标出没有视线的格子（P50）" },
      { key: "path", label: "寻路", title: "按当前模型足迹标出靠近骑士目标的路径" },
    ].map(item => `<button type="button" class="button secondary small ${settings[item.key] ? "active" : ""}" data-overlay-layer="${item.key}" title="${esc(item.title)}">${item.label}</button>`).join("");
    const pathStatus = !settings.path
      ? ""
      : overlay.target
        ? `<span>路线 <b>${overlay.counts.routes}</b></span><span>步数 <b>${overlay.counts.pathCost}</b></span>${conflictOverlayPathDetailsHtml(overlay)}`
        : `<span>骑士目标 <b>未设置</b></span>`;
    const stats = overlay.active
      ? `<div class="overlay-stats">
          <span>起点 <b>${esc(conflictOverlayCellLabel(overlay.source))}</b></span>
          <span>骑士目标 <b>${esc(conflictOverlayCellLabel(overlay.target))}</b></span>
          <span>足迹 <b>${esc(overlay.footprint?.label || "")}</b></span>
          <span>可见 <b>${overlay.counts.visible}</b>/140</span>
          ${pathStatus}
        </div>`
      : `<p class="muted">起点：未设置</p>`;
    return `<div class="overlay-tools" aria-label="视线与寻路叠加层">
      <div class="overlay-tool-head"><strong>视线 / 寻路</strong><span class="muted">中规 1.06</span></div>
      <div class="overlay-origin-row"><span>起点</span><strong>${esc(overlay.source ? conflictOverlayCellLabel(overlay.source) : "未设置")}</strong><button type="button" class="button secondary small" data-overlay-clear ${settings.sourceCell ? "" : "disabled"}>清除</button></div>
      <div class="overlay-origin-row"><span>骑士目标</span><strong>${esc(overlay.target ? conflictOverlayCellLabel(overlay.target) : "未设置")}</strong><button type="button" class="button secondary small" data-overlay-clear-target ${settings.targetCell ? "" : "disabled"}>清除</button></div>
      <div class="overlay-tool-row">${modeButtons}</div>
      <div class="overlay-tool-row">${toggles}</div>
      ${stats}
      <div class="overlay-legend" aria-hidden="true">
        <span class="kf-ov-source"></span>起点
        <span class="kf-ov-target"></span>骑士目标
        <span class="kf-ov-path"></span>路径
        <span class="kf-ov-path-a"></span>路径A
        <span class="kf-ov-path-b"></span>路径B
        <span class="kf-ov-path-overlap"></span>重叠
        <span class="kf-ov-final-a"></span>终点A
        <span class="kf-ov-final-b"></span>终点B
        <span class="kf-ov-blocked"></span>无视线
      </div>
    </div>`;
  }

  function conflictGridHtml(boardState, overlay = null) {
    const activeSpaces = new Set(foolCardById(boardState?.activeFoolCardId)?.spaces || []);
    const cells = Array.from({ length: 140 }, (_, index) => {
      const ref = conflictGridCellRef(index);
      const highlighted = activeSpaces.has(ref);
      // 网格 span 是 row-major、14 列 10 行，与 kf-overlay 的坐标系一致。
      const row = Math.floor(index / 14) + 1;
      const column = index % 14 + 1;
      const distance = overlay?.active ? overlay.distanceAt(column, row) : null;
      const label = distance != null ? `<b class="kf-ov-distance">${distance}</b>` : (boardState?.showCoordinates ? `<b>${ref}</b>` : "");
      const classes = [highlighted ? "fool-highlight" : "", ...(overlay?.active ? overlay.classesAt(column, row) : [])]
        .filter(Boolean).join(" ");
      return `<span class="${classes}"${highlighted ? ` aria-label="愚者牌格位 ${ref}"` : ""}>${label}</span>`;
    }).join("");
    return cells;
  }

  function foolCardFaceHtml(card) {
    const sheet = window.KF_CONFLICT_BOARD_DATA?.foolDeck?.sheet;
    if (!sheet || !card) return "";
    return `<span class="fool-card-face" style="--card-sheet-width:${sheet.columns * 100}%;--card-sheet-height:${sheet.rows * 100}%;--card-left:${-card.column * 100}%;--card-top:${-card.row * 100}%"><img src="${esc(conflictAssetSrc(sheet.asset))}" alt="${esc(card.label)}"></span>`;
  }

  function foolDeckPreviewHtml(boardState) {
    const activeCard = foolCardById(boardState?.activeFoolCardId);
    const remaining = Array.isArray(boardState?.foolDeckOrder) ? boardState.foolDeckOrder.length : 0;
    if (activeCard) return `<div class="fool-deck-preview active">${foolCardFaceHtml(activeCard)}<strong>${esc(activeCard.label)}</strong><span>格位：${activeCard.spaces.map(esc).join(" / ")} · 剩余 ${remaining} 张</span></div>`;
    const back = window.KF_CONFLICT_BOARD_DATA?.foolDeck?.back;
    const status = remaining ? `剩余 ${remaining} / ${foolDeckCards().length} 张${remaining === foolDeckCards().length ? " · 已洗牌" : ""}` : "首次抽取时洗牌";
    return `<div class="fool-deck-preview">${back?.asset ? `<img class="fool-card-back" src="${esc(conflictAssetSrc(back.asset))}" alt="愚者卡组牌背">` : ""}<strong>愚者卡组</strong><span>${status}</span></div>`;
  }

  function conflictTerrainCatalog() {
    const catalog = new Map();
    for (const layout of window.KF_CONFLICT_BOARD_DATA?.layouts || []) {
      for (const placement of layout.placements || []) {
        if (placement.kind !== "terrain" || catalog.has(placement.asset)) continue;
        catalog.set(placement.asset, placement);
      }
    }
    return [...catalog.values()].sort((a, b) => a.asset.localeCompare(b.asset));
  }

  function conflictTerrainGeometry(placement) {
    const rowSpan = placement.rowEnd - placement.rowStart + 1;
    const columnSpan = placement.columnEnd - placement.columnStart + 1;
    const quarterTurn = Math.abs(Number(placement.rotation || 0)) % 180 === 90;
    return {
      rowSpan,
      columnSpan,
      centerRow: (placement.rowStart + placement.rowEnd) / 2,
      centerColumn: (placement.columnStart + placement.columnEnd) / 2,
      artRowSpan: quarterTurn ? columnSpan : rowSpan,
      artColumnSpan: quarterTurn ? rowSpan : columnSpan,
    };
  }

  function conflictTerrainPlacementHtml(placement, selected = false, interactionLocked = false) {
    const geometry = conflictTerrainGeometry(placement);
    const src = conflictAssetSrc(placement.asset);
    return `<button type="button" class="terrain-control-placement ${selected ? "selected" : ""} ${interactionLocked ? "path-active" : ""}" data-terrain-id="${esc(placement.id)}"
      aria-label="${esc(conflictTerrainLabel(placement.asset))}" title="${esc(conflictTerrainLabel(placement.asset))}"
      style="left:${(geometry.centerColumn - .5) / 14 * 100}%;top:${(geometry.centerRow - .5) / 10 * 100}%;width:${geometry.artColumnSpan / 14 * 100}%;height:${geometry.artRowSpan / 10 * 100}%;transform:translate(-50%,-50%) rotate(${placement.rotation}deg);--terrain-layer:${placement.layer || 10}">
      <img src="${esc(src)}" alt="" style="transform:scaleX(${placement.flipped ? -1 : 1})">
    </button>`;
  }

  function conflictBoardEditorHtml(monster, battle) {
    const boardState = battle.conflictBoard;
    const layout = conflictBoardLayout(battle);
    if (!boardState || !layout) return `<section class="panel terrain-control-panel"><p class="empty-message">当前怪物没有可用的 TTS 高清冲突布局。</p></section>`;
    const terrain = Array.isArray(boardState.terrain) ? boardState.terrain : [];
    if (!terrain.some(item => item.id === selectedTerrainId)) selectedTerrainId = "";
    const selected = terrain.find(item => item.id === selectedTerrainId);
    const knightAssignments = new Map((boardState.knightAssignments || []).map(item => [item.placementId, item]));
    const mobAssignments = new Map((boardState.mobAssignments || []).map(item => [item.placementId, item.number]));
    const starts = (layout.placements || []).filter(item => item.kind !== "terrain")
      .filter(item => boardState.showStarts !== false || !(["knight", "monster", "number"].includes(item.kind) || item.asset === "LictorDecoy")).map(item => {
      const rowSpan = item.rowEnd - item.rowStart + 1;
      const columnSpan = item.columnEnd - item.columnStart + 1;
      const rotation = boardState.resolvedOrientations?.[item.id] ?? item.rotation ?? 0;
      const knight = knightAssignments.get(item.id);
      const arrow = ["knight", "monster"].includes(item.kind) ? `<span class="terrain-start-arrow ${facingClass(rotation)}" aria-hidden="true">▲</span>` : "";
      const avatar = knight ? `<img src="../../assets/heroes/${esc(knight.heroId)}-avatar.jpg" alt="">${arrow}` : "";
      const assignedNumber = mobAssignments.get(item.id);
      const label = knight ? "" : `${item.kind === "monster" ? conflictTerrainLabel(item.asset) : item.kind === "number" ? item.asset.replace("Number", "") : conflictTerrainLabel(item.asset)}${assignedNumber ? `<b class="${mobNumberClass(assignedNumber)}">${assignedNumber}</b>` : ""}`;
      const numberImage = item.kind === "number"
        ? `<img class="terrain-control-number-image" src="${esc(conflictAssetSrc(item.asset))}" alt="${esc(item.asset)}">`
        : "";
      return `<span class="terrain-control-start ${item.kind} ${knight ? "knight" : ""}" style="left:${(item.columnStart - 1) / 14 * 100}%;top:${(item.rowStart - 1) / 10 * 100}%;width:${columnSpan / 14 * 100}%;height:${rowSpan / 10 * 100}%"><i>${avatar || numberImage || `${arrow}${label}`}</i></span>`;
    }).join("");
    const catalog = conflictTerrainCatalog();
    const usedAssets = [...new Set(terrain.map(item => item.asset))];
    const terrainCards = conflictTerrainCards(terrain);
    const boardAsset = window.KF_CONFLICT_BOARD_DATA?.board?.asset;
    const activeFoolCard = foolCardById(boardState.activeFoolCardId);
    const foolDeckExhausted = activeFoolCard && !boardState.foolDeckOrder.length;
    const foolDeckButtonLabel = activeFoolCard
      ? (foolDeckExhausted ? "取消标红并洗牌" : "取消标红")
      : "抽取愚者卡组";
    const selection = selected
      ? `<strong>${esc(conflictTerrainLabel(selected.asset))}</strong><span>第 ${selected.columnStart} 列 · ${String.fromCharCode(75 - selected.rowStart)} 行 · ${selected.rotation}°${selected.flipped ? " · 反面" : ""}</span>`
      : "未选择地形";
    const overlay = conflictOverlay(battle);
    return `<section class="panel terrain-control-panel" aria-label="冲突版图地形控制">
      <div class="panel-header terrain-control-head"><div><span class="eyebrow">TTS CLASH BOARD</span><h3>冲突版图与地形</h3></div><div class="inline-actions">
        <button type="button" class="button secondary small ${boardState.showCoordinates ? "active" : ""}" data-grid-coordinates>${boardState.showCoordinates ? "隐藏格子位置" : "显示格子位置"}</button>
        <button type="button" class="button small ${activeFoolCard ? "danger" : ""}" data-fool-deck>${foolDeckButtonLabel}</button>
        <label class="terrain-start-toggle"><input type="checkbox" data-terrain-starts ${boardState.showStarts !== false ? "checked" : ""}>显示初始位置</label>
        <button type="button" class="button secondary small" data-terrain-reset>重置版图</button>
      </div></div>
      <div class="terrain-control-workspace">
        <div class="terrain-control-board" data-terrain-board style="${conflictBoardCropStyle()}">
          <img class="terrain-control-board-source" src="../display/${esc(boardAsset)}" alt="TTS 高清冲突版图">
          <div class="terrain-control-grid">${conflictGridHtml(boardState, overlay)}</div>
          ${conflictOverlayMarkersHtml(overlay)}
          ${terrain.map(item => conflictTerrainPlacementHtml(item, item.id === selectedTerrainId, Boolean(overlay?.settings?.path || overlayPlacementMode))).join("")}${starts}
        </div>
        <aside class="terrain-control-tools">
          ${foolDeckPreviewHtml(boardState)}
          <div class="terrain-tool-row">
            <button type="button" class="button secondary small" data-terrain-rotate="-90" ${selected ? "" : "disabled"} title="逆时针旋转 90°">↶ 左转</button>
            <button type="button" class="button secondary small" data-terrain-rotate="90" ${selected ? "" : "disabled"} title="顺时针旋转 90°">↷ 右转</button>
            <button type="button" class="button secondary small ${selected?.flipped ? "active" : ""}" data-terrain-flip ${selected ? "" : "disabled"}>⇅ 翻面</button>
            <button type="button" class="button danger small" data-terrain-delete ${selected ? "" : "disabled"}>× 删除</button>
          </div>
          <div class="terrain-add-row"><select data-terrain-add-select aria-label="新增地形">${catalog.map(item => `<option value="${esc(item.asset)}">${esc(conflictTerrainLabel(item.asset))}</option>`).join("")}</select><button type="button" class="button small" data-terrain-add>+ 新增</button></div>
          <div class="terrain-selection">${selection}</div>
          <p class="muted">选择地形后点击版图格位移动；所有修改会同步到第二屏。</p>
          ${conflictOverlayToolsHtml(boardState, layout, overlay)}
        </aside>
      </div>
      <div class="terrain-reference"><div class="terrain-reference-head"><strong>当前地形卡</strong><span>${terrainCards.length} 张</span></div><div class="terrain-reference-list">${terrainCards.map(card => `<button type="button" data-terrain-card="${card.cardId}" title="查看 ${esc(card.label)} 地形卡">${conflictTerrainCardFaceHtml(card)}<span>${esc(card.label)}</span></button>`).join("") || `<span class="muted">${usedAssets.length ? "当前地形没有对应卡牌" : "当前版图没有地形"}</span>`}</div></div>
    </section>`;
  }

  function snapConflictTerrainCoordinate(value, span, maximum) {
    const offset = span % 2 === 0 ? .5 : 0;
    const snapped = Math.round(Number(value) - offset) + offset;
    return clamp(snapped, (span + 1) / 2, maximum - (span - 1) / 2);
  }

  function moveConflictTerrain(placement, targetRow, targetColumn) {
    const rowSpan = placement.rowEnd - placement.rowStart + 1;
    const columnSpan = placement.columnEnd - placement.columnStart + 1;
    const centerRow = snapConflictTerrainCoordinate(targetRow, rowSpan, 10);
    const centerColumn = snapConflictTerrainCoordinate(targetColumn, columnSpan, 14);
    const rowStart = Math.round(centerRow - (rowSpan - 1) / 2);
    const columnStart = Math.round(centerColumn - (columnSpan - 1) / 2);
    return { ...placement, rowStart, rowEnd: rowStart + rowSpan - 1, columnStart, columnEnd: columnStart + columnSpan - 1 };
  }

  function rotateConflictTerrain(placement, delta) {
    const geometry = conflictTerrainGeometry(placement);
    const rotated = {
      ...placement,
      rowEnd: placement.rowStart + geometry.columnSpan - 1,
      columnEnd: placement.columnStart + geometry.rowSpan - 1,
      rotation: (placement.rotation + delta + 360) % 360,
    };
    return moveConflictTerrain(rotated, geometry.centerRow, geometry.centerColumn);
  }

  function editSelectedTerrain(transform) {
    const board = state.battle.conflictBoard;
    const index = board?.terrain?.findIndex(item => item.id === selectedTerrainId) ?? -1;
    if (index < 0) return;
    remember();
    board.terrain[index] = transform({ ...board.terrain[index] });
    save();
  }

  function startConflictTerrainDrag(event) {
    if (event.button !== undefined && event.button !== 0) return;
    if (conflictOverlaySettings().path || overlayPlacementMode) return;
    const node = event.currentTarget;
    const boardNode = node.closest("[data-terrain-board]");
    const terrain = state.battle.conflictBoard?.terrain?.find(item => item.id === node.dataset.terrainId);
    if (!boardNode || !terrain) return;
    selectedTerrainId = terrain.id;
    let preview = { ...terrain };
    let moved = false;

    const move = pointerEvent => {
      const rect = boardNode.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const column = clamp(Math.floor((pointerEvent.clientX - rect.left) / rect.width * 14) + 1, 1, 14);
      const row = clamp(Math.floor((pointerEvent.clientY - rect.top) / rect.height * 10) + 1, 1, 10);
      const next = moveConflictTerrain({ ...terrain }, row, column);
      if (next.rowStart === preview.rowStart && next.columnStart === preview.columnStart) return;
      preview = next;
      const geometry = conflictTerrainGeometry(preview);
      node.style.left = `${(geometry.centerColumn - .5) / 14 * 100}%`;
      node.style.top = `${(geometry.centerRow - .5) / 10 * 100}%`;
      moved = true;
      pointerEvent.preventDefault();
    };
    const finish = pointerEvent => {
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", finish);
      node.removeEventListener("pointercancel", finish);
      node.classList.remove("dragging");
      if (node.hasPointerCapture?.(pointerEvent.pointerId)) node.releasePointerCapture(pointerEvent.pointerId);
      if (moved) editSelectedTerrain(() => preview);
    };

    node.classList.add("dragging");
    node.setPointerCapture?.(event.pointerId);
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", finish);
    node.addEventListener("pointercancel", finish);
  }

  function resetConflictTerrain() {
    const layout = conflictBoardLayout();
    if (!layout) return false;
    remember();
    state.battle.conflictBoard.terrain = defaultConflictTerrain(layout, state.battle.conflictBoard.resolvedOrientations);
    state.battle.conflictBoard.showStarts = true;
    selectedTerrainId = "";
    save();
    return true;
  }

  function toggleConflictCoordinates() {
    if (!state.battle.conflictBoard) return;
    state.battle.conflictBoard.showCoordinates = !state.battle.conflictBoard.showCoordinates;
    save();
  }

  function conflictOverlaySettings() {
    return window.KF_OVERLAY?.normalizeSettings(state.battle.conflictBoard?.overlay)
      || { sourceCell: null, targetCell: null, sourceMode: "boss", move: 5, los: true, path: false };
  }

  // 叠加层是纯查看用的显示开关，不进撤销栈（和显示格子位置一致）。
  function updateConflictOverlay(patch) {
    const boardState = state.battle.conflictBoard;
    if (!boardState || !window.KF_OVERLAY) return;
    boardState.overlay = window.KF_OVERLAY.normalizeSettings({ ...conflictOverlaySettings(), ...patch });
    if (boardState.overlay.path) {
      selectedTerrainId = "";
      overlayPlacementMode = "";
    }
    save();
  }

  function drawOrResetFoolCard() {
    const boardState = state.battle.conflictBoard;
    if (!boardState || !foolDeckCards().length) return toast("愚者卡组资源缺失");
    remember();
    if (foolCardById(boardState.activeFoolCardId)) {
      const exhausted = !boardState.foolDeckOrder.length;
      boardState.activeFoolCardId = null;
      if (exhausted) {
        boardState.foolDeckOrder = shuffledFoolDeck();
        log("取消愚者牌标红；牌组已抽完，重新洗牌");
      } else {
        log(`取消愚者牌标红（牌组剩余 ${boardState.foolDeckOrder.length} 张）`);
      }
    } else {
      const validOrder = Array.isArray(boardState.foolDeckOrder)
        ? boardState.foolDeckOrder.filter(cardId => foolCardById(cardId)) : [];
      boardState.foolDeckOrder = validOrder.length ? validOrder : shuffledFoolDeck();
      const card = foolCardById(boardState.foolDeckOrder.shift());
      boardState.activeFoolCardId = card?.cardId || null;
      if (card) log(`抽取愚者牌：${card.label}（${card.spaces.join(" / ")}，剩余 ${boardState.foolDeckOrder.length} 张）`);
    }
    save();
  }

  function renderApp() {
    const root = $("#app");
    const b = state.battle;
    const monster = monsterById(b.monsterId) || DATA.monsters[0];
    const mob = isMob(monster);
    const winged = isWingedNightmare(monster);
    const wingedWideWings = winged ? cardById(monster, WINGED_WIDE_WINGS_ID) : null;
    const wingedBloodyDefiance = winged ? cardById(monster, WINGED_BLOODY_DEFIANCE_ID) : null;
    const bloodyDefianceActive = wingedBloodyDefianceActive(b);
    const wingedAttackTarget = bloodyDefianceActive ? wingedBloodyDefiance : wingedWideWings;
    const activeAI = cardById(monster, b.activeAI);
    const activeAiZero = activeAI?.kind === "AI0";
    const sigCard = monster.cards.find(card => card.kind === "SIG");
    const activeBP = cardById(monster, b.activeBP);
    const thickSkinActive = bossRule(monster)?.kind === "white-ape"
      && b.activeBP === bossRule(monster).cards.thickSkin;
    const references = activeReferenceCards(monster, b);
    const kinds = ["ALL", ...new Set(monster.cards.map(card => card.kind))];
    const gallery = monster.cards.filter(card => b.galleryKind === "ALL" || card.kind === b.galleryKind);
    const totalDamage = b.singleWounds + b.doubleWounds * 2;
    const setupKinds = ["AI1", "AI2", "AI3", "BP1", "BP2", "BP3", "BPS", "BPX"];
    const monsterLevels = LEVELS[monster.id] || [];
    const currentLevel = levelInfo(monster, b.level);
    const automaticCounts = defaultCounts(monster, b.level);
    const currentMobSetup = mob ? mobSetupResult(monster) : null;
    const initialSw = exhibitionStartingWounds(monster, b.level, b.clashPhase);
    const maxLevel = monsterLevels.length || MOB_ACTIVATIONS[monster.id]?.length || 4;
    const specialMobBp = mob && isPumpkinhead(monster);
    const puppetAiChoices = bossRule(monster)?.kind === "puppet-king" && b.level >= 4
      ? b.ruleState.aiChoiceIds.map(id => cardById(monster, id)).filter(Boolean)
      : [];

    root.innerHTML = `
      <div class="monster-layout standalone-layout ${monsterDirectoryOpen ? "directory-open" : "directory-collapsed"}">
        <aside class="panel monster-index">
          <div class="monster-directory" data-monster-directory>
            <div class="monster-directory-heading"><span class="directory-title"><span class="eyebrow">MONSTERS</span><strong>怪物目录</strong></span><span class="badge">${DATA.monsters.length}</span></div>
            <div class="monster-directory-body">
              <input id="monsterSearch" placeholder="搜索怪物…">
              <div class="monster-list">${DATA.monsters.map(item =>
                `<button class="monster-item ${item.id === monster.id ? "active" : ""}" data-monster="${esc(item.id)}">
                  <strong>${esc(item.name)}</strong><small>${isMob(item) ? "杂兵" : "首领"} · ${item.cards.length} 张牌</small>
                </button>`).join("")}</div>
            </div>
          </div>
        </aside>
        <div class="stack">
          ${b.conflictLocation ? `<section class="panel conflict-location-alert"><strong>特殊冲突地点：${esc(b.conflictLocation)}</strong><span>“贪食巨龙来了！”已与该怪物绑定，本场冲突在${esc(b.conflictLocation)}中进行。</span></section>` : ""}
          ${conflictSetupPanel(monster, b.level)}
          <section class="panel setup-panel">
            <div class="panel-header"><div><span class="eyebrow">${mob ? "MOB CLASH" : "BOSS CLASH"}</span><h2>${esc(monster.name)}</h2></div>
              <div class="inline-actions"><button class="button" id="setupBattle">开始冲突 / 重建牌组</button></div>
            </div>
            ${b.conflictStatus === "failed" ? `<div class="conflict-alert">${esc(b.failureReason)}</div>` : ""}
            <details class="deck-config-tools" data-deck-config ${deckConfigOpen ? "open" : ""}><summary>牌组配置</summary>
              <div class="setup-grid ${mob ? "mob-setup-grid" : ""}">
                <label>怪物等级<input type="number" min="1" max="${maxLevel}" data-level value="${clamp(b.level, 1, maxLevel)}"></label>
                <label>冲突阶段<select data-clash-phase><option value="full" ${b.clashPhase === "full" ? "selected" : ""}>完全冲突</option><option value="preliminary" ${b.clashPhase === "preliminary" ? "selected" : ""}>初步冲突</option></select></label>
                ${mob ? `<div class="automatic-deck-summary"><span>冲突设置固定数量</span><strong>${b.mobCount} 个杂兵</strong></div>` : ""}
                <div class="automatic-deck-summary">
                  <span>${winged ? "固定 BP（不进入杂兵轨）" : mob ? "标准初始杂兵轨（特殊场景规则优先）" : "自动初始牌组"}</span>
                  <strong>${setupKinds
                    .filter(kind => automaticCounts[kind] > 0)
                    .map(kind => `${kind} × ${automaticCounts[kind]}`)
                    .join("　")}</strong>
                </div>
                ${mob && currentMobSetup?.fixedCards.length ? `<div class="automatic-deck-summary"><span>固定 BP</span><strong>${currentMobSetup.fixedCards.map(item => `${item.slot + 1}号位 · ${esc(cardById(monster, item.id)?.name || item.id)}`).join("　")}</strong></div>` : ""}
                <div class="automatic-deck-summary"><span>初始损伤</span><strong>${b.clashPhase === "preliminary" ? `初步冲突 · SW ×${initialSw}` : "完全冲突 · 无初步损伤"}</strong></div>
              </div>
              ${currentLevel?.hit ? `<div class="auto-config-note">
                <strong>等级 ${currentLevel.level} 自动配置已人工复核</strong>
                <span>命中 ${esc(currentLevel.hit)} · 损伤阈值 ${currentLevel.wounds} · 初步冲突 SW ${currentLevel.exhibitionWounds} · 初始晋升 ${currentLevel.promotion} · 激活 ${esc(currentLevel.activations.join(" + "))}</span>
              </div>` : ""}
            </details>
            ${sheetTokenTools(b)}
            <div class="monster-sheet-display ${b.conflictLocation === "巨兽之腹" ? "has-devour-dragon-trait" : ""}">
              <div class="monster-sheet-stage" data-sheet-stage>
                <div class="monster-sheet-spread">
                  ${monster.sheet?.face ? `<img src="${esc(monster.sheet.face)}" alt="怪物面板左侧">` : ""}
                  ${monster.sheet?.back ? `<img src="${esc(monster.sheet.back)}" alt="怪物面板右侧">` : ""}
                </div>
                ${youngDevourStageOverlay(monster, b)}
                ${sheetTokenLayer(b)}
              </div>
              ${b.conflictLocation === "巨兽之腹" ? `<figure class="devour-dragon-trait">
                <img src="assets/traits-zh/devour-dragon-belly.png" alt="巨兽之腹特质">
              </figure>` : ""}
            </div>
            ${mob ? (winged ? "" : mobTrackHtml(monster, b)) : doppelgangerTrackHtml(monster, b)}
          </section>
          ${bossRulePanel(monster)}
          <section class="panel aibp-panel">
            <div class="aibp-columns">
              <div class="aibp-column">
                <div class="panel-header"><div><span class="eyebrow">AI DECK</span><div class="deck-title-row"><h3>AI</h3>${deckLevelOrderHtml(b.aiDeck, monster, "AI")}</div></div><span class="badge">${b.aiDeck.length} 当前 / ${b.aiDiscard.length} 弃牌</span></div>
                <div class="aibp-draw-box">
                  <div class="aibp-actions">
                    <button class="button ${mob ? "secondary" : ""}" data-draw="ai" title="${mob ? "手动抽取 AI（非指示物效果）" : "抽取 AI"}">抽 AI</button>
                    ${activeAiZero
                      ? '<button class="button" data-settle="ai:removed" title="AI0 首次结算后必须移出游戏">结算并移出游戏</button>'
                      : `<button class="button secondary" data-settle="ai:discard" title="弃置当前 AI" ${activeAI ? "" : "disabled"}>弃置</button>
                        <button class="button secondary" data-settle="ai:removed" title="移除当前 AI" ${activeAI ? "" : "disabled"}>移除</button>
                        <button class="button secondary" data-settle="ai:bottom" title="将当前 AI 置于牌组底部" ${activeAI ? "" : "disabled"}>置底</button>`}
                    <button class="button secondary" data-promote="ai" title="AI 晋升">晋升</button>
                    <button class="button ${mob ? "secondary" : ""}" id="undo" title="撤销上一步" ${state.history.length ? "" : "disabled"}>撤销</button>
                  </div>
                  <div class="${puppetAiChoices.length ? "aibp-pending puppet-ai-choice-pending" : "aibp-pending"}">
                    ${puppetAiChoices.length ? `
                      <div class="puppet-ai-choice-grid">
                        ${puppetAiChoices.map(card => `<div class="puppet-ai-choice">
                          ${cardHtml(card, "battle-card puppet-ai-choice-card")}
                          <button class="button" data-choose-puppet-ai="${esc(card.id)}">执行此 AI</button>
                        </div>`).join("")}
                      </div>
                      <button class="button secondary puppet-routine-button" data-rule-action="puppet-routine">惯常</button>
                    ` : (activeAI ? cardHtml(activeAI, "battle-card") : cardHtml(sigCard, "battle-card", "back"))}
                  </div>
                </div>
                ${tabs("ai", b.aiView)}
                <div class="card-gallery aibp-pile-grid">${pileGridForView("ai", b.aiView, monster)}</div>
              </div>
              <div class="aibp-column">
                <div class="panel-header"><div><span class="eyebrow">${winged ? "PERMANENT BP" : mob ? "MOB BP TRACK" : "BP DECK"}</span><div class="deck-title-row"><h3>BP</h3>${mob ? "" : deckLevelOrderHtml(b.bpDeck, monster, "BP")}</div></div><span class="badge gold">总损伤 ${totalDamage} / 单重 ${b.singleWounds} / 双重 ${b.doubleWounds}</span></div>
                <div class="aibp-draw-box">
                  <div class="aibp-actions">
                    ${winged ? `
                      <button class="button secondary" data-winged-attack="fail" title="本次攻击未击伤；${bloodyDefianceActive ? "Bloody Defiance" : "Wide Wings"} 保持不变">未击伤</button>
                      <button class="button" data-winged-attack="success" title="攻击 ${bloodyDefianceActive ? "Bloody Defiance" : "Wide Wings"}：加入 1 张单重损伤，并按 AI 弃牌堆顶阶数晋升 AI">击伤</button>
                      <button class="button secondary" data-winged-ai-response title="结算 AI 弃牌堆顶卡牌的 AI Response 效果">AI Response</button>` : mob ? `
                      <button class="button secondary" id="startMobRound" title="怪物轮开始 / 重置指示物">新回合</button>
                      <button class="button secondary" data-settle="bp:fail" title="本次攻击未击伤" ${activeBP ? "" : "disabled"}>未击伤</button>
                      <button class="button secondary" data-settle="bp:defeat" title="击伤并移出当前杂兵" ${activeBP ? "" : "disabled"}>击伤</button>
                      <button class="button secondary" data-settle="bp:flip" title="翻转当前杂兵 BP" ${activeBP ? "" : "disabled"}>翻面</button>
                      ${specialMobBp ? "" : `
                        <button class="button secondary" data-spawn-mode="interval" title="间隔生成最低阶杂兵">间隔生成</button>
                        <button class="button secondary" data-spawn-mode="immediate" title="立即生成高一阶杂兵" ${b.lastMobWoundRank ? "" : "disabled"}>立即生成</button>
                        <button class="button secondary" data-promote="bp" title="杂兵轨道晋升">晋升</button>`}` : `
                      <button class="button" data-draw="bp" title="抽取 BP">抽 BP</button>
                      <button class="button secondary" data-settle="bp:discard" title="弃置当前 BP" ${activeBP && !thickSkinActive ? "" : "disabled"}>弃置</button>
                      <button class="button secondary" data-settle="bp:defeat" title="用当前 BP 结算击伤" ${activeBP ? "" : "disabled"}>击伤</button>
                      <button class="button secondary" data-settle="bp:critical" title="BP3 暴击" ${activeBP?.kind === "BP3" && !thickSkinActive ? "" : "disabled"}>暴击</button>
                      <button class="button secondary" data-settle="bp:bottom" title="将当前 BP 置于牌组底部" ${activeBP && !thickSkinActive ? "" : "disabled"}>置底</button>
                      <button class="button secondary" data-promote="bp" title="BP 晋升" ${thickSkinActive ? "disabled" : ""}>晋升</button>`}
                    <button class="button secondary" data-wound="single" title="添加单重损伤" ${thickSkinActive ? "disabled" : ""}>+单重</button>
                    <button class="button secondary" data-wound="double" title="添加双重损伤" ${thickSkinActive ? "disabled" : ""}>+双重</button>
                  </div>
                  <div class="aibp-pending">${winged
                    ? cardHtml(wingedAttackTarget, "battle-card", "face")
                    : cardHtml(activeBP, "battle-card", activeMobSlot()?.slot.side || "face")}</div>
                </div>
                ${mob ? `<div class="card-gallery aibp-pile-grid">${pileGrid(b.bpDamage, monster)}</div>` :
                  `${tabs("bp", b.bpView)}<div class="card-gallery aibp-pile-grid">${pileGridForView("bp", b.bpView, monster)}</div>`}
              </div>
            </div>
          </section>
          <section class="panel">
            <details open><summary>标志行为与特质 (${references.length})</summary>
              <div class="card-gallery reference-gallery">${pileGrid(references.map(card => card.id), monster)}</div>
            </details>
          </section>
          <section class="panel">
            <details><summary>全部怪物牌</summary>
              <select id="galleryKind">${kinds.map(kind => `<option ${kind === b.galleryKind ? "selected" : ""}>${esc(kind)}</option>`).join("")}</select>
              <div class="card-gallery">${pileGrid(gallery.map(card => card.id), monster)}</div>
            </details>
          </section>
          <section class="panel">
            <details><summary>操作日志 (${b.log.length})</summary>
              <div class="battle-log">${b.log.map(entry => `<p><time>${esc(entry.at)}</time>${esc(entry.message)}</p>`).join("") || "<p>暂无操作</p>"}</div>
            </details>
          </section>
          ${conflictBoardEditorHtml(monster, b)}
        </div>
      </div>`;
    const directoryToggle = $("#monsterDirectoryToggle");
    directoryToggle?.setAttribute?.("aria-expanded", String(monsterDirectoryOpen));
    directoryToggle?.setAttribute?.("aria-label", monsterDirectoryOpen ? "收起怪物目录" : "展开怪物目录");
    if (directoryToggle) directoryToggle.title = monsterDirectoryOpen ? "收起怪物目录" : "展开怪物目录";
    bindEvents(monster);
  }

  function bindEvents(monster) {
    $("[data-deck-config]")?.addEventListener("toggle", event => { deckConfigOpen = event.currentTarget.open; });
    $("[data-sheet-token-tools]")?.addEventListener("toggle", event => { sheetTokenToolsOpen = event.currentTarget.open; });
    $("[data-grid-coordinates]")?.addEventListener("click", toggleConflictCoordinates);
    $("[data-fool-deck]")?.addEventListener("click", drawOrResetFoolCard);
    $$('[data-terrain-id]').forEach(button => button.addEventListener('click', event => {
      if (conflictOverlaySettings().path || overlayPlacementMode) return;
      if (selectedTerrainId && selectedTerrainId !== button.dataset.terrainId) return;
      if (selectedTerrainId !== button.dataset.terrainId) {
        event.stopPropagation();
        selectedTerrainId = button.dataset.terrainId;
        renderApp();
      } else {
        event.stopPropagation();
        selectedTerrainId = "";
        renderApp();
      }
    }));
    $$('[data-terrain-id]').forEach(button => button.addEventListener('pointerdown', startConflictTerrainDrag));
    $('[data-terrain-board]')?.addEventListener('click', event => {
      const rect = event.currentTarget.getBoundingClientRect();
      const column = clamp(Math.floor((event.clientX - rect.left) / rect.width * 14) + 1, 1, 14);
      const row = clamp(Math.floor((event.clientY - rect.top) / rect.height * 10) + 1, 1, 10);
      const settings = conflictOverlaySettings();
      if (overlayPlacementMode) {
        const sourceMode = overlayPlacementMode;
        return updateConflictOverlay({ sourceMode, sourceCell: { row, column }, targetCell: null });
      }
      if (!settings.path) {
        if (selectedTerrainId) return editSelectedTerrain(placement => moveConflictTerrain(placement, row, column));
        return;
      }
      if (!settings.sourceCell) return;
      updateConflictOverlay({ targetCell: { row, column } });
    });
    $$('[data-terrain-rotate]').forEach(button => button.addEventListener('click', () => {
      const delta = Number(button.dataset.terrainRotate) || 0;
      editSelectedTerrain(placement => rotateConflictTerrain(placement, delta));
    }));
    $('[data-terrain-flip]')?.addEventListener('click', () => editSelectedTerrain(placement => ({ ...placement, flipped: !placement.flipped })));
    $('[data-terrain-delete]')?.addEventListener('click', () => {
      if (!selectedTerrainId) return;
      remember();
      state.battle.conflictBoard.terrain = state.battle.conflictBoard.terrain.filter(item => item.id !== selectedTerrainId);
      selectedTerrainId = "";
      save();
    });
    $('[data-terrain-add]')?.addEventListener('click', () => {
      const asset = $('[data-terrain-add-select]')?.value;
      const template = conflictTerrainCatalog().find(item => item.asset === asset);
      if (!template) return;
      remember();
      const rowSpan = template.rowEnd - template.rowStart + 1;
      const columnSpan = template.columnEnd - template.columnStart + 1;
      const id = `terrain-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const placement = moveConflictTerrain({ id, asset, rowStart: 1, rowEnd: rowSpan, columnStart: 1, columnEnd: columnSpan, rotation: template.rotation ?? 0, flipped: false, layer: 10 }, 5, 7);
      state.battle.conflictBoard.terrain.push(placement);
      selectedTerrainId = id;
      save();
    });
    $('[data-terrain-reset]')?.addEventListener('click', () => {
      resetConflictTerrain();
    });
    $('[data-terrain-starts]')?.addEventListener('change', event => {
      remember();
      state.battle.conflictBoard.showStarts = event.target.checked;
      save();
    });
    $$('[data-overlay-layer]').forEach(button => button.addEventListener('click', () => {
      const key = button.dataset.overlayLayer;
      if (!window.KF_OVERLAY?.LAYERS.includes(key)) return;
      updateConflictOverlay({ [key]: !conflictOverlaySettings()[key] });
    }));
    $$('[data-overlay-mode]').forEach(button => button.addEventListener('click', () => {
      const sourceMode = button.dataset.overlayMode;
      if (!window.KF_OVERLAY?.MODES.includes(sourceMode)) return;
      if (overlayPlacementMode === sourceMode) {
        overlayPlacementMode = "";
        return renderApp();
      }
      overlayPlacementMode = sourceMode;
      selectedTerrainId = "";
      updateConflictOverlay({ sourceMode, path: false, targetCell: null });
    }));
    $('[data-overlay-clear]')?.addEventListener('click', () => updateConflictOverlay({ sourceCell: null, targetCell: null }));
    $('[data-overlay-clear-target]')?.addEventListener('click', () => updateConflictOverlay({ targetCell: null }));
    $$('[data-terrain-select-asset]').forEach(button => button.addEventListener('click', () => {
      const match = state.battle.conflictBoard?.terrain?.find(item => item.asset === button.dataset.terrainSelectAsset);
      if (!match) return;
      selectedTerrainId = match.id;
      renderApp();
    }));
    $$('[data-terrain-card]').forEach(button => button.addEventListener('click', () => {
      const card = conflictTerrainCards().find(item => String(item.cardId) === button.dataset.terrainCard);
      showTerrainCardPreview(card);
    }));
    $$("[data-monster]").forEach(button => button.addEventListener("click", () => {
      selectMonster(monsterById(button.dataset.monster));
    }));
    $("#monsterSearch")?.addEventListener("input", event => {
      const query = event.target.value.trim().toLowerCase();
      $$(".monster-item").forEach(item => { item.hidden = query && !item.textContent.toLowerCase().includes(query); });
    });
    $("[data-level]").addEventListener("input", event => {
      const max = Number(event.target.max) || 4;
      state.battle.level = clamp(event.target.value, 1, max);
      if (!isMob(monster) && levelInfo(monster, state.battle.level)) {
        state.battle.setupCounts = defaultCounts(monster, state.battle.level);
        toast("已套用人工复核的等级配置；点击“开始冲突 / 重建牌组”生效");
      }
      save();
    });
    $("[data-clash-phase]")?.addEventListener("change", event => {
      const next = event.target.value === "preliminary" ? "preliminary" : "full";
      if (next === state.battle.clashPhase) return;
      if (!confirm(`切换为${next === "preliminary" ? "初步" : "完全"}冲突会立即重建牌组并清空当前损伤，确定继续？`)) {
        event.target.value = state.battle.clashPhase;
        return;
      }
      remember();
      state.battle.clashPhase = next;
      initializeBattle(monster, { preserveHistory: true });
      save();
    });
    $$('[data-token-count]').forEach(input => input.addEventListener("change", () => {
      setSheetTokenCount(input.dataset.tokenCount, input.value);
    }));
    $$('[data-token-delta]').forEach(button => button.addEventListener("click", () => {
      const count = state.battle.sheetTokens.find(token => token.assetId === button.dataset.tokenDelta)?.count || 0;
      setSheetTokenCount(button.dataset.tokenDelta, count + Number(button.dataset.delta));
    }));
    $("[data-clear-sheet-tokens]")?.addEventListener("click", clearSheetTokens);
    $$('[data-sheet-token]').forEach(token => token.addEventListener("pointerdown", startSheetTokenDrag));
    $$('[data-bog-position]').forEach(button => button.addEventListener("click", () => {
      const selected = Number(button.dataset.bogPosition);
      const current = state.battle.ruleState.bogWitch.position;
      setBogWitchPosition(selected === current ? (current + 1) % BOG_WITCH_POSITIONS.length : selected);
    }));
    $$('[data-lictor-decoy]').forEach(button => button.addEventListener("click", () => {
      toggleLictorDecoy(Number(button.dataset.lictorDecoy));
    }));
    $$('[data-mob-marker]').forEach(button => button.addEventListener("click", () =>
      changeMobMarker(Number(button.dataset.mobMarker), button.dataset.markerAsset, Number(button.dataset.delta))
    ));
    $$('[data-mob-marker-asset]').forEach(select => select.addEventListener("change", event => {
      if (!TOKEN_ASSET_IDS.has(event.target.value)) return;
      mobMarkerAssetId = event.target.value;
      renderApp();
    }));
    $("[data-ratwolf-signature-complete]")?.addEventListener("click", completeRatwolfSignature);
    $("#setupBattle").addEventListener("click", () => {
      if ((state.battle.aiDeck.length || state.battle.bpDeck.length || state.battle.bpTrack.some(slot => slot.id))
        && !confirm("重建会清空当前牌组、损伤和日志，确定继续？")) return;
      remember();
      initializeBattle(monster, { preserveHistory: true });
      save();
    });
    $("#undo").addEventListener("click", undo);
    $$("[data-draw]").forEach(button => button.addEventListener("click", () => draw(button.dataset.draw)));
    $$("[data-rule-action]").forEach(button => button.addEventListener("click", () => {
      const action = button.dataset.ruleAction;
      if (action === "advance-stage") return advanceDevourStage();
      if (action === "white-round") return startWhiteApeRound();
      if (action === "spawn-white-guardian") return spawnWhiteGuardian();
      if (action === "pass-guardian") return passGuardianBp();
      if (action === "guardian-attack") return resolveGuardianAttack();
      if (action === "spawn-doppel") return spawnDoppelganger();
      if (action === "damage-puppet-fallen") return damagePuppetFallenKnight();
      if (action === "attach-bog-ai") {
        const selected = $("[data-bog-holder]")?.value;
        return attachBogAi(selected === "__custom__" ? $("[data-bog-custom-holder]")?.value : selected);
      }
      if (action === "hidden-bp-top") return hiddenBogBpTop($("[data-hidden-bp-index]")?.value);
      if (action === "cookie-crumbs") return settleCookieCrumbs();
      if (action === "panzer-field") return panzerAttack("field");
      if (action === "panzer-remnant") return panzerAttack("remnant");
      if (action === "migrate-armor") return migratePanzerArmor();
      if (action === "clear-panzer-retribution") return clearPanzerRetributionArmor();
      if (action === "toad-discard") return discardTopAi(
        $("[data-toad-discard-count]")?.value,
        $("[data-toad-discard-reason]")?.value,
        $("[data-toad-target]")?.value
      );
      if (action === "favorite-child") return favoriteChild();
      if (action === "set-severity") return setKnightSeverity(
        $("[data-p2-knight]")?.value,
        $("[data-p2-severity]")?.value
      );
      if (action === "ancient-bargain") return ancientBargain(
        $("[data-patient-count]")?.value,
        $("[data-p2-knight]")?.value
      );
      if (action === "ancient-round") {
        remember();
        state.battle.ruleState.ruleNotice = "先祖回忆：所有位于恶魔正面的骑士承受窒息 2。";
        log("远古薄暮恶魔怪物轮开始：窒息 2 提示");
        return save();
      }
      if (action === "smelted-draw") return drawSmeltedPatient($("[data-p2-knight]")?.value);
      if (action === "smelted-stop") return stopSmeltedPatient();
      if (action === "resolve-patient") return resolvePatientEffect();
      if (action === "resolve-patient-f") return resolvePatientEffect("accept");
      if (action === "set-oubliette") return setSmeltedOubliette($("[data-smelted-holder]")?.value);
      if (action === "toggle-gate") return toggleSmeltedGate($("[data-smelted-holder]")?.value);
      if (action === "ferrobaptism") return smeltedFerrobaptism();
      if (action === "smelted-equipment") return smeltedEquipmentEvent();
      if (action === "smelted-bargain-armor") return bargainDiscardSmeltedArmor();
      if (action === "eater-meatbait") return changeKnighteaterResource("meat", state.battle.level);
      if (action === "wolf-down") return resolveWolfDown($("[data-eater-target]")?.value);
      if (action === "toggle-berserk") return toggleKnighteaterBerserk(
        !state.battle.ruleState.knighteater.berserk,
        $("[data-eater-target]")?.value
      );
      if (action === "stone-direction") return setStonemasonDirection($("[data-stone-direction]")?.value);
      if (action === "stone-round-start") return startStonemasonRound();
      if (action === "stone-round-end") return endStonemasonRound($("[data-stone-direction]")?.value);
      if (action === "stone-ruin") return stonemasonBoardAction("ruin");
      if (action === "stone-buried") return stonemasonBoardAction("buried");
      if (action === "stone-spikes") return stonemasonBoardAction("spikes");
      if (action === "king-curse") return setKingCurse($("[data-king-knight]")?.value);
      if (action === "king-death") return kingKnightDied($("[data-king-knight]")?.value);
      if (action === "king-obey") return kingBow($("[data-king-knight]")?.value, true);
      if (action === "king-defy") return kingBow($("[data-king-knight]")?.value, false);
      if (action === "king-climb-ok") return kingVpAction($("[data-king-knight]")?.value, "climb", true);
      if (action === "king-climb-fail") return kingVpAction($("[data-king-knight]")?.value, "climb", false);
      if (action === "king-hold-ok") return kingVpAction($("[data-king-knight]")?.value, "hold", true);
      if (action === "king-hold-fail") return kingVpAction($("[data-king-knight]")?.value, "hold", false);
      if (action === "king-drill") return kingDrillAction();
      if (action === "puppet-routine") return executePuppetRoutine();
      if (action === "complete-rule-card") return completeRuleCard();
    }));
    $$("[data-defeat-guardian]").forEach(button => button.addEventListener("click", () => defeatGuardian(Number(button.dataset.defeatGuardian))));
    $$("[data-defeat-doppel]").forEach(button => button.addEventListener("click", () => defeatDoppelganger(button.dataset.defeatDoppel)));
    $$("[data-flip-doppel]").forEach(button => button.addEventListener("click", () => toggleDoppelgangerCards(button.dataset.flipDoppel)));
    $$("[data-choose-puppet-ai]").forEach(button => button.addEventListener("click", () => choosePuppetAi(button.dataset.choosePuppetAi)));
    $$("[data-return-attachment]").forEach(button => button.addEventListener("click", () => returnBogAttachment(button.dataset.returnAttachment)));
    $$("[data-panzer-armor]").forEach(button => button.addEventListener("click", () =>
      changePanzerArmor(button.dataset.panzerArmor, Number(button.dataset.delta))
    ));
    $$("[data-puppet-armor]").forEach(button => button.addEventListener("click", () =>
      changePuppetArmor(Number(button.dataset.delta))
    ));
    $$("[data-egg-armor]").forEach(button => button.addEventListener("click", () =>
      changeEggArmor(Number(button.dataset.eggArmor), -1, false)
    ));
    $$("[data-egg-add]").forEach(button => button.addEventListener("click", () =>
      changeEggArmor(Number(button.dataset.eggAdd), 1, false)
    ));
    $$("[data-egg-headbutt]").forEach(button => button.addEventListener("click", () =>
      changeEggArmor(Number(button.dataset.eggHeadbutt), -1, true)
    ));
    $("[data-egg-counter-slot]")?.addEventListener("click", () => changeEggCounter(1));
    $("[data-egg-counter-token]")?.addEventListener("click", () => {
      if (state.battle.ruleState.eggknight.counter >= 3) return triggerEggCounter();
      changeEggCounter(1);
    });
    $("[data-ironcast-necrofusion-slot]")?.addEventListener("click", () => changeIroncastNecrofusionCounter(1));
    $("[data-ironcast-necrofusion-token]")?.addEventListener("click", () => {
      if (state.battle.ruleState.ironcast.necrofusion >= 3) return resolveIroncastNecrofusion();
      changeIroncastNecrofusionCounter(1);
    });
    $("[data-white-reinforcement-slot]")?.addEventListener("click", () => changeWhiteReinforcementCounter(1));
    $("[data-white-reinforcement-token]")?.addEventListener("click", () => {
      if (state.battle.ruleState.reinforcementTokens >= 4) return resolveWhiteReinforcement();
      changeWhiteReinforcementCounter(1);
    });
    $("[data-white-vengeance-slot]")?.addEventListener("click", () => changeWhiteVengeanceCounter(1));
    $("[data-white-vengeance-token]")?.addEventListener("click", () => {
      if (state.battle.ruleState.vengeanceTokens >= whiteVengeanceThreshold()) return resolveWhiteVengeance();
      changeWhiteVengeanceCounter(1);
    });
    $("[data-king-putrid-slot]")?.addEventListener("click", () => changeKingPutridCounter(1));
    $("[data-king-putrid-token]")?.addEventListener("click", () => {
      if (state.battle.ruleState.kingLaidLow.putrid >= 4) return resolveKingPutridPenance();
      changeKingPutridCounter(1);
    });
    $("[data-knighteater-brute-slot]")?.addEventListener("click", () => changeKnighteaterBruteCounter(1));
    $("[data-knighteater-brute-token]")?.addEventListener("click", () => changeKnighteaterBruteCounter(1));
    $$(`[data-ethereal-unity-resolve]`).forEach(button => button.addEventListener("click", resolveEtherealUnity));
    $$("[data-p2-counter]").forEach(button => button.addEventListener("click", () => {
      const [kind, target] = button.dataset.p2Counter.split(":");
      const delta = Number(button.dataset.delta);
      if (kind === "eater") return changeKnighteaterResource(target, delta);
      if (kind === "stone") return changeStonemasonArmor(target, delta);
      if (kind === "smelted") return changeSmeltedArmor(target, delta);
    }));
    $$("[data-settle]").forEach(button => button.addEventListener("click", () => {
      const [type, action] = button.dataset.settle.split(":"); settle(type, action);
    }));
    $$("[data-winged-attack]").forEach(button => button.addEventListener("click", () => {
      resolveWingedNightmareAttack(button.dataset.wingedAttack === "success");
    }));
    $("[data-winged-ai-response]")?.addEventListener("click", resolveWingedAiResponse);
    $$("[data-promote]").forEach(button => button.addEventListener("click", () => promoteLowest(button.dataset.promote)));
    $$("[data-wound]").forEach(button => button.addEventListener("click", () => {
      remember();
      addWound(button.dataset.wound);
      const value = button.dataset.wound === "double" ? 2 : 1;
      const rule = bossRule(monster);
      if (rule?.kind === "white-ape") recordWhiteReinforcement(value);
      if (rule?.kind === "bog-witch") recordCookieCrumbs(value);
      recordIroncastNecrofusionWound(monster, value);
      recordP2WoundCounters(monster, value);
      log(`手动添加${button.dataset.wound === "double" ? "双重" : "单重"}损伤`);
      save();
    }));
    $$("[data-view]").forEach(button => button.addEventListener("click", () => {
      const [type, view] = button.dataset.view.split(":"); state.battle[`${type}View`] = view; save();
    }));
    $$("[data-mob]").forEach(button => button.addEventListener("click", () => selectMob(Number(button.dataset.mob))));
    $$("[data-activation]").forEach(button => button.addEventListener("click", () => resolveMobActivation(button.dataset.activation)));
    $("[data-warrior-muscular-defeat]")?.addEventListener("click", defeatWarriorMuscularChest);
    $("#startMobRound")?.addEventListener("click", startMobRound);
    $$("[data-spawn-mode]").forEach(button => button.addEventListener("click", () => spawnMob(button.dataset.spawnMode)));
    $("#galleryKind")?.addEventListener("change", event => { state.battle.galleryKind = event.target.value; save(); });
    $$("[data-preview]").forEach(button => button.addEventListener("click", event => {
      event.stopPropagation();
      const card = cardById(monster, button.dataset.preview)
        || cardByAnyId(button.dataset.preview)
        || Object.values(DATA.wounds).find(item => item.id === button.dataset.preview);
      showPreview(card, button.dataset.previewSide || "face");
    }));
    $$("[data-guarded-preview]").forEach(button => button.addEventListener("click", event => {
      event.stopPropagation();
      showGuardedPreview(button.dataset.guardedPreview, button.dataset.guardedSource);
    }));
    $$("[data-original-preview]").forEach(button => button.addEventListener("click", () => {
      showOriginalPreview(button.dataset.originalPreview, button.dataset.originalTitle);
    }));
  }

  function showGuardedPreview(id, source) {
    const monster = monsterById(state.battle.monsterId);
    const card = cardById(monster, id);
    if (!card) return false;
    const pileName = source === "bp-current" ? "当前 BP 牌组" : "当前 AI 牌组";
    if (!window.confirm(`${pileName}默认隐藏，查看会泄露牌序。是否执意查看这张牌？`)) return false;
    showPreview(card);
    return true;
  }

  function showPreview(card, side = "face", allowMoves = true) {
    if (!card) return;
    const modal = $("#modal");
    const monster = monsterById(state.battle.monsterId);
    const fixedWarriorCompanion = monster?.id === "M_FirstmenWarriors" && isWarriorCompanionCard(card.id);
    const fixedWingedBp = isWingedNightmare(monster) && isWingedFixedBpId(card.id);
    const type = fixedWarriorCompanion || fixedWingedBp || !allowMoves ? "" : aibpDeckType(card);
    const previewSide = card.kind === "SIG" && side === "back" ? "back" : "face";
    modal.innerHTML = `<div class="modal-backdrop" data-close-modal></div><div class="modal-card">
      <button class="modal-close" data-close-modal aria-label="关闭卡牌预览">×</button>
      ${cardHtml(card, "preview-card", previewSide, false, false)}
      <h3>${esc(cardLabel(card, previewSide))}</h3>
      ${type ? `<div class="preview-deck-actions" aria-label="${type.toUpperCase()} 卡牌去向">
        <button class="button" data-preview-move="top">放到抽牌堆顶部</button>
        <button class="button secondary" data-preview-move="bottom">放到抽牌堆底部</button>
        <button class="button secondary" data-preview-move="shuffle">洗入抽牌堆</button>
        <button class="button danger" data-preview-move="discard">弃置</button>
        <button class="button danger" data-preview-move="removed">移除</button>
        ${type === "bp" && isMob(monster) ? `<button class="button secondary" data-preview-move="mob-left">放置到最左侧杂兵轨道</button>` : ""}
      </div>` : ""}
    </div>`;
    modal.hidden = false;
    $$("[data-close-modal]", modal).forEach(node => node.addEventListener("click", () => { modal.hidden = true; }));
    $$("[data-preview-move]", modal).forEach(button => button.addEventListener("click", () => {
      modal.hidden = true;
      moveAibpCard(card.id, button.dataset.previewMove);
    }));
  }

  function showTerrainCardPreview(card) {
    if (!card) return;
    const modal = $("#modal");
    modal.innerHTML = `<div class="modal-backdrop" data-close-modal></div><div class="modal-card terrain-card-preview-modal">
      <button class="modal-close" data-close-modal aria-label="关闭地形卡预览">×</button>
      ${conflictTerrainCardFaceHtml(card, "terrain-card-preview")}
      <h3>${esc(card.label)}</h3>
    </div>`;
    modal.hidden = false;
    $$('[data-close-modal]', modal).forEach(node => node.addEventListener('click', () => { modal.hidden = true; }));
  }

  function showOriginalPreview(src, title) {
    if (!src) return;
    const modal = $("#modal");
    modal.innerHTML = `<div class="modal-backdrop" data-close-modal></div><div class="modal-card original-preview-modal">
      <button class="modal-close" data-close-modal aria-label="关闭原版预览">×</button>
      <h3>${esc(title || "原版冲突设置")}</h3>
      <img class="original-preview-image" src="${esc(src)}" alt="${esc(title || "原版冲突设置")}">
    </div>`;
    modal.hidden = false;
    $$("[data-close-modal]", modal).forEach(node => node.addEventListener("click", () => { modal.hidden = true; }));
  }

  function exportSave() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `kf-aibp-${state.battle.monsterId}-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function importSave(file) {
    try {
      const raw = JSON.parse(await file.text());
      if (Number(raw?.version || 0) !== VERSION) {
        const monster = monsterById(state.battle.monsterId);
        state = defaultState();
        state.battle = emptyBattle(monster);
        state.selectedMonsterId = monster.id;
        initializeBattle(monster);
        syncCurrentEncounter();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        toast("旧版存档不兼容，已为当前怪物建立新冲突");
        return renderApp();
      }
      const next = validateState(raw);
      state = next;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      toast("存档导入成功");
      renderApp();
    } catch (error) {
      toast(`导入失败：${error.message}`);
    }
  }

  $("#newBattle").addEventListener("click", () => {
    if (!confirm("为当前怪物开始新冲突并清空它的现有进度？")) return;
    const monster = monsterById(state.battle.monsterId);
    state.battle = emptyBattle(monster);
    state.history = [];
    initializeBattle(monster);
    save();
  });
  $("#resetBattle").addEventListener("click", () => {
    if (!confirm("重置只会删除当前怪物的冲突进度，确定继续？")) return;
    const monster = monsterById(state.battle.monsterId);
    delete state.encounters?.[monster.id];
    state.battle = emptyBattle(monster);
    state.history = [];
    initializeBattle(monster);
    save();
  });
  $("#exportSave").addEventListener("click", exportSave);
  $("#importSave").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", event => {
    if (event.target.files[0]) importSave(event.target.files[0]);
    event.target.value = "";
  });
  $("#monsterDirectoryToggle")?.addEventListener("click", () => {
    monsterDirectoryOpen = !monsterDirectoryOpen;
    renderApp();
  });

  window.addEventListener?.("kf:aibp-handoff", event => {
    const location = String(event.detail?.mapWheel?.conflictLocation || "");
    state.battle.conflictLocation = location;
    if (location) log(`特殊冲突地点：${location}（贪食巨龙来了！）`);
    save();
  });

  if (!state.battle.aiDeck.length && !state.battle.bpDeck.length && !state.battle.bpTrack.length) {
    initializeBattle(monsterById(state.battle.monsterId));
  }
  renderApp();
  save(false);
  if (window.KF_AIBP_TESTING) {
    window.KF_AIBP_TEST_API = {
      state: () => state,
      selectMonster: id => selectMonster(monsterById(id)),
      rebuild: preserveHistory => initializeBattle(
        monsterById(state.battle.monsterId), { preserveHistory: Boolean(preserveHistory) }
      ),
      draw, settle, moveAibpCard, undo, advanceDevourStage,
      startWhiteApeRound, spawnWhiteGuardian, passGuardianBp, resolveGuardianAttack, defeatGuardian,
      recordWhiteReinforcement, changeWhiteReinforcementCounter, resolveWhiteReinforcement,
      changeWhiteVengeanceCounter, resolveWhiteVengeance, whiteVengeanceThreshold, recordBossWoundCounters,
      spawnDoppelganger, defeatDoppelganger, toggleDoppelgangerCards, toggleDoppelgangerTop, failDoppelganger,
      damagePuppetFallenKnight, changePuppetArmor,
      attachBogAi, returnBogAttachment, revealPuppetTopTwo, choosePuppetAi, executePuppetRoutine,
      hiddenBogBpTop, settleCookieCrumbs, panzerAttack, changePanzerArmor,
      migratePanzerArmor, clearPanzerRetributionArmor, discardTopAi, favoriteChild, completeRuleCard,
      setKnightSeverity, ancientBargain, drawSmeltedPatient, stopSmeltedPatient, resolvePatientEffect,
      setSmeltedOubliette, toggleSmeltedGate, smeltedFerrobaptism, changeSmeltedArmor, bargainDiscardSmeltedArmor, smeltedEquipmentEvent,
      changeEggArmor, changeEggCounter, triggerEggCounter, changeKnighteaterResource, changeKnighteaterBruteCounter, toggleKnighteaterBerserk, resolveWolfDown,
      changeIroncastNecrofusionCounter, resolveIroncastNecrofusion,
      setStonemasonDirection, changeStonemasonArmor, startStonemasonRound, endStonemasonRound, stonemasonBoardAction,
      setKingCurse, kingKnightDied, kingBow, kingVpAction, kingDrillAction,
      changeKingPutridCounter, resolveKingPutridPenance, recordP2WoundCounters,
      setSheetTokenCount, setBogWitchPosition, changeMobMarker, toggleLictorDecoy, promoteLowest,
      defeatWarriorMuscularChest, recordWarriorRetribution, addWound,
      spawnMob, resolveMobActivation, resolveEtherealUnity, completeRatwolfSignature,
      resolveWingedNightmareAttack, resolveWingedAiResponse, ensureWingedAiDiscard,
      selectMob, settleMob: action => settleMob(monsterById(state.battle.monsterId), action),
      resetConflictTerrain, moveConflictTerrain, rotateConflictTerrain, conflictTerrainGeometry,
      toggleConflictCoordinates, drawOrResetFoolCard, conflictGridCellRef, conflictGridHtml,
      conflictOverlay, conflictOverlaySettings, updateConflictOverlay,
      validateState, renderApp, showPreview, showGuardedPreview, remember, commit: () => save(false),
      activeReferenceIds: () => activeReferenceCards(
        monsterById(state.battle.monsterId), state.battle
      ).map(card => card.id),
      mobSetup: () => mobSetupResult(monsterById(state.battle.monsterId)),
      renderBossRules: () => bossRulePanel(monsterById(state.battle.monsterId)),
      renderPileView: (type, view) => pileGridForView(
        type, view, monsterById(state.battle.monsterId)
      ),
      renderAiDiscard: () => pileGrid(
        state.battle.aiDiscard,
        monsterById(state.battle.monsterId),
        Boolean(bossRule(monsterById(state.battle.monsterId))?.hiddenAiDiscard)
      )
    };
  }
})();
