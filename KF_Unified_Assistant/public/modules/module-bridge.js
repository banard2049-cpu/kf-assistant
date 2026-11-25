(() => {
  "use strict";

  const body = document.body;
  const moduleName = body.dataset.kfModule;
  const stateModuleName = moduleName === "rogue" ? "roguePath" : moduleName;
  const legacyStorageKey = body.dataset.storageKey;
  const originalApp = body.dataset.originalApp || "app.js?v=115";
  const navigationParams = typeof location.search === "string" ? new URLSearchParams(location.search) : null;
  const activeCampaign = navigationParams?.get("campaignId") || localStorage.getItem("kfActiveCampaign") || "";
  const storageKey = `kfModuleState:${activeCampaign}:${legacyStorageKey}`;
  const cacheKey = `kfModuleCache:${activeCampaign}:${stateModuleName}`;
  const legacyOwnerKey = `kfModuleStorageOwner:${legacyStorageKey}`;
  const handoffKey = name => `${name}:${activeCampaign}`;
  const campaignUrl = path => {
    if (!activeCampaign || typeof location.href !== "string") return path;
    const url = new URL(path, location.href);
    if (url.origin !== location.origin) return path;
    url.searchParams.set("campaignId", activeCampaign);
    return url.pathname + url.search + url.hash;
  };
  if (activeCampaign && typeof location.pathname === "string") {
    const current = location.pathname + location.search + location.hash;
    const scoped = campaignUrl(current);
    if (current !== scoped) history.replaceState(history.state, "", scoped);
  }
  let cache = (() => {
    try { return JSON.parse(localStorage.getItem(cacheKey) || "null") || {}; }
    catch { return {}; }
  })();
  const valueSignature = value => {
    let first = 2166136261, second = 5381;
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      first = Math.imul(first ^ code, 16777619);
      second = Math.imul(second, 33) ^ code;
    }
    return `${value.length}:${first >>> 0}:${second >>> 0}`;
  };
  const cacheIsDirty = () => Boolean(cache.value && (cache.acknowledgedSignature
    ? valueSignature(cache.value) !== cache.acknowledgedSignature
    : cache.value !== cache.acknowledgedValue));
  const storeCache = () => {
    if (typeof cache.acknowledgedValue === "string") {
      cache.acknowledgedSignature = valueSignature(cache.acknowledgedValue);
      delete cache.acknowledgedValue;
    }
    const { value, ...metadata } = cache;
    // The campaign working key already stores the snapshot and its undo history.
    localStorage.setItem(cacheKey, JSON.stringify({ ...metadata, scoped: true }));
  };
  const acknowledgeValue = (value, revision) => {
    cache.acknowledgedSignature = valueSignature(value);
    delete cache.acknowledgedValue;
    cache.revision = revision;
    storeCache();
  };
  function captureCurrentValue() {
    const current = localStorage.getItem(storageKey) || "";
    if (current && current !== cache.value) {
      cache.value = current;
    }
    return current;
  }
  if (activeCampaign) {
    // Recover edits written by an older client after its last polling tick,
    // but never load another campaign's copy or an unowned legacy save.
    if (!cache.scoped && !localStorage.getItem(storageKey)) {
      const legacy = localStorage.getItem(legacyStorageKey);
      const owner = localStorage.getItem(legacyOwnerKey);
      const oldMap = moduleName === "map" && ["kf-map-host-v7", "kf-map-host-v6", "kf-map-host-v5"]
        .filter(key => localStorage.getItem(`kfModuleStorageOwner:${key}`) === activeCampaign)
        .map(key => localStorage.getItem(key)).find(Boolean);
      const saved = (owner === activeCampaign && legacy) || cache.value || oldMap;
      if (saved) localStorage.setItem(storageKey, saved);
      if (legacy && !owner && !localStorage.getItem(`kfModuleLegacy:${legacyStorageKey}`)) {
        localStorage.setItem(`kfModuleLegacy:${legacyStorageKey}`, legacy);
      }
    }
    cache.value = localStorage.getItem(storageKey) || "";
    if (!cache.scoped) storeCache();
    for (const name of ["kfEncounterHandoff", "kfRogueHandoff"]) {
      const legacy = localStorage.getItem(name);
      if (!legacy) continue;
      try {
        if (JSON.parse(legacy)?.campaignId !== activeCampaign) continue;
        if (!localStorage.getItem(handoffKey(name))) localStorage.setItem(handoffKey(name), legacy);
        localStorage.removeItem(name);
      } catch { /* A damaged legacy handoff cannot be resumed. */ }
    }
  }
  const rosterKey = `kfCampaignRoster:${activeCampaign}`;
  const mapUpstreamKey = `kfMapUpstream:${activeCampaign}`;
  const kingdomKey = `kfCampaignKingdom:${activeCampaign}`;
  const optionsKey = `kfCampaignOptions:${activeCampaign}`;
  window.KF_CAMPAIGN_KINGDOM = localStorage.getItem(kingdomKey) || "";
  // Campaign options the modules need offline too: five-player mode (rulebook p.77) and the
  // party leader (the five-player clue rule targets the leader).
  try {
    window.KF_CAMPAIGN_OPTIONS = JSON.parse(localStorage.getItem(optionsKey) || "null") || { fivePlayer: false, leaderSheetId: "" };
  } catch {
    window.KF_CAMPAIGN_OPTIONS = { fivePlayer: false, leaderSheetId: "" };
  }
  const phaseFromMapTime = value => Number(value) === 8 ? "preliminary" : "full";
  try {
    const cachedMap = JSON.parse(localStorage.getItem(`kfModuleState:${activeCampaign}:kf-map-host-v8`) || "null");
    window.KF_CLASH_PHASE = phaseFromMapTime(cachedMap?.trackers?.time);
  } catch {
    window.KF_CLASH_PHASE = "full";
  }
  const squireCatalog = [
    { id: "bartos", name: "巴尔托什 · Bartos" }, { id: "caelia", name: "凯莉娅 · Caelia" },
    { id: "helse", name: "赫尔塞 · Helse" }, { id: "fabio", name: "法比奥 · Fabio" },
    { id: "bianca", name: "比安卡 · Bianca" }, { id: "murmur", name: "穆尔穆 · Murmur" },
    { id: "ralof", name: "拉福尔 · Ralof" }, { id: "vratlada", name: "芙拉特兰姬 · Vratlada" },
  ];
  const knightIds = new Set(["stoneface", "fleischritter", "renholder", "ser-sonch", "paracelsa", "ser-ubar", "kara"]);
  try {
    window.KF_CAMPAIGN_PARTY = JSON.parse(localStorage.getItem(rosterKey) || "[]");
    window.KF_CAMPAIGN_KNIGHTS = window.KF_CAMPAIGN_PARTY.filter(item => item.type !== "squire");
    window.KF_CAMPAIGN_SQUIRES = window.KF_CAMPAIGN_PARTY.filter(item => item.type === "squire");
  } catch {
    window.KF_CAMPAIGN_PARTY = []; window.KF_CAMPAIGN_KNIGHTS = []; window.KF_CAMPAIGN_SQUIRES = [];
  }
  if (moduleName === "map") {
    try {
      window.KF_MAP_UPSTREAM = JSON.parse(localStorage.getItem(mapUpstreamKey) || "null");
    } catch {
      window.KF_MAP_UPSTREAM = null;
    }
  }
  const status = document.createElement("span");
  status.className = "bridge-status";
  status.textContent = "连接战役…";

  body.querySelector("header[data-unified-topbar] [data-topbar-actions]")?.prepend(status);

  const api = async (route, options = {}) => {
    const [routeName, query = ""] = route.split("?");
    const response = await fetch(`/api.php?route=${encodeURIComponent(routeName)}${query ? `&${query}` : ""}`, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "服务器请求失败");
    return data;
  };

  const script = () => new Promise((resolve, reject) => {
    const node = document.createElement("script");
    node.src = originalApp;
    node.onload = resolve;
    node.onerror = () => reject(new Error(`无法载入 ${originalApp}`));
    document.body.append(node);
  });

  const prepareStorage = value => {
    if (value) localStorage.setItem(storageKey, JSON.stringify(value));
    else localStorage.removeItem(storageKey);
  };

  function exposeMapUpstream(campaignState) {
    if (moduleName !== "map") return;
    const monsterPool = campaignState?.monsterPool || null;
    const value = {
      campaignId: activeCampaign,
      kingdom: campaignState?.kingdom || campaignState?.map?.activeKingdom || monsterPool?.kingdom || "",
      monsterPool,
    };
    window.KF_MAP_UPSTREAM = value;
    localStorage.setItem(mapUpstreamKey, JSON.stringify(value));
  }

  function compatibleUuid() {
    const source = globalThis.crypto;
    if (typeof source?.randomUUID === "function") return source.randomUUID();
    const bytes = new Uint8Array(16);
    if (typeof source?.getRandomValues === "function") source.getRandomValues(bytes);
    else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  const operationId = () => compatibleUuid().replace(/-/g, "");
  const clientId = localStorage.kfClientId || (localStorage.kfClientId = operationId());
  const sceneName = { map: "map", encounter: "encounter", aibp: "conflict", rogue: "rogue" }[moduleName] || "map";
  const presentationChannel = "BroadcastChannel" in window ? new BroadcastChannel("kf-presentation") : null;
  let campaignRevision = 0;
  let lastValue = "";
  let saving = false;
  let queued = false;
  let operationQueue = [];
  let lastScenePublish = 0;

  function applyAuthoritativeConflict(result, batch) {
    const path = `modules.${stateModuleName}`;
    const serverWon = result.conflicts?.some(conflict =>
      conflict.path === path && ["existing", "merged"].includes(conflict.resolution)
    );
    if (!serverWon) return false;
    const selected = result.state?.modules?.[stateModuleName];
    if (!selected || typeof selected !== "object") return false;
    const submitted = batch.find(operation => operation.path === path);
    const current = captureCurrentValue();
    if (submitted && current && current !== JSON.stringify(submitted.value)) {
      // This verdict belongs to the submitted snapshot. Keep edits made while
      // it was in flight and let the server arbitrate that newer snapshot too.
      // Retain the old base even across a reload, so a lower map round cannot
      // bypass the server's conflict protection using this response's revision.
      const pending = operationQueue.find(operation => operation.path === path);
      const baseRevision = pending?.baseRevision ?? submitted.baseRevision;
      queueOperation(path, JSON.parse(current), baseRevision);
      cache.revision = baseRevision;
      storeCache();
      lastValue = current;
      return "deferred";
    }
    const serialized = JSON.stringify(selected);
    localStorage.setItem(storageKey, serialized);
    cache.value = serialized;
    acknowledgeValue(serialized, result.revision);
    operationQueue = operationQueue.filter(operation => operation.path !== path);
    lastValue = serialized;
    queued = false;
    window.dispatchEvent(new CustomEvent("kf:module-state", { detail: selected }));
    return "applied";
  }

  function readHandoff() {
    const keys = moduleName === "aibp" ? ["kfEncounterHandoff", "kfRogueHandoff"] : ["kfEncounterHandoff"];
    const candidates = [];
    for (const key of keys) {
      try {
        const value = JSON.parse(localStorage.getItem(handoffKey(key)) || "null");
        if (value?.campaignId !== activeCampaign) continue;
        if (value.roguePath && value.slotId) {
          const activeSlot = localStorage.getItem(`kf-rogue-path-active-slot-v1:${activeCampaign}`);
          if (activeSlot && activeSlot !== value.slotId) continue;
        }
        candidates.push(value);
      } catch { /* one malformed handoff must not hide the other source */ }
    }
    // New requests carry their creation time. Legacy requests have no clock,
    // so an unapplied request wins over an already consumed legacy handoff.
    candidates.sort((left, right) => {
      const leftTime = Number(left.createdAt || left.startedAt || 0);
      const rightTime = Number(right.createdAt || right.startedAt || 0);
      return rightTime - leftTime || Number(Boolean(left.appliedAibp)) - Number(Boolean(right.appliedAibp))
        || Number(right.appliedAt || 0) - Number(left.appliedAt || 0);
    });
    return candidates[0] || null;
  }

  function applyEncounterHandoff() {
    const handoff = readHandoff();
    if (!handoff || handoff.appliedEncounter) return;
    const monster = window.KF_ENCOUNTER_DATA?.monsters?.find(item =>
      item.id === handoff.monsterId || item.name === handoff.monster
    );
    const button = monster && document.querySelector(`[data-monster="${monster.id}"]`);
    if (!button) return;
    button.click();
    const level = document.querySelector("#level");
    if (level) { level.value = String(handoff.level); level.dispatchEvent(new Event("change", { bubbles: true })); }
    const type = document.querySelector("#encounterType");
    if (type) { type.value = handoff.type || "normal"; type.dispatchEvent(new Event("change", { bubbles: true })); }
    handoff.appliedEncounter = true;
    localStorage.setItem(handoffKey("kfEncounterHandoff"), JSON.stringify(handoff));
  }

  function applyAibpHandoff(rogueSave) {
    const requestId = navigationParams?.get("rogueBattle");
    if (requestId) {
      const slotId = navigationParams.get("rogueSlot");
      const run = (rogueSave?.campaignId === activeCampaign && Array.isArray(rogueSave.slots))
        ? rogueSave.slots.find(slot => slot.id === slotId)?.state : null;
      const battle = run?.pendingBattle;
      if (battle?.handoffId !== requestId || !Array.isArray(run.roster)) {
        status.textContent = "未找到要继续的肉鸽冲突";
        return;
      }
      const rogueRoster = run.roster.filter(member => member.alive).slice(0, 4).map(member => ({
        id: member.id, sheetId: member.id, knightId: member.knightId, type: "knight", name: member.name, title: member.name
      }));
      if (!window.KF_AIBP_HANDOFF?.({ ...battle, id: requestId, slotId, roguePath: true, stage: run.stage, postgame: run.postgame, rogueRoster })) {
        status.textContent = "无法打开要继续的肉鸽冲突";
      }
      return;
    }
    const handoff = readHandoff();
    if (!handoff || handoff.appliedAibp || !window.KF_AIBP_HANDOFF?.(handoff)) return;
    handoff.appliedAibp = true;
    handoff.appliedAt = Date.now();
    localStorage.setItem(handoffKey(handoff.roguePath ? "kfRogueHandoff" : "kfEncounterHandoff"), JSON.stringify(handoff));
  }

  function queueOperation(path, value, baseRevision = campaignRevision) {
    if (path === `modules.${stateModuleName}` && (moduleName === "map" || cacheIsDirty()) && Number.isInteger(cache.revision)) {
      baseRevision = Math.min(baseRevision, cache.revision);
    }
    operationQueue = operationQueue.filter(operation => operation.path !== path);
    operationQueue.push({ id: operationId(), clientId, path, value, baseRevision });
  }

  function publishScene(force = false) {
    if (!activeCampaign) return;
    const now = Date.now();
    if (!force && now - lastScenePublish < 1200) return;
    lastScenePublish = now;
    const updatedAt = new Date(now).toISOString();
    queueOperation("presentation.scene", sceneName);
    queueOperation("presentation.updatedAt", updatedAt);
    queueOperation("presentation.sourceClientId", clientId);
    presentationChannel?.postMessage({ campaignId: activeCampaign, scene: sceneName, updatedAt, sourceClientId: clientId });
    drainQueue();
  }

  async function drainQueue() {
    if (!activeCampaign || saving || !operationQueue.length || !navigator.onLine) { queued = operationQueue.length > 0; return; }
    saving = true;
    queued = false;
    const batch = operationQueue.splice(0, 200);
    status.textContent = navigator.onLine ? "同步中…" : "离线暂存";
    try {
      const result = await api("campaign-sync", {
        method: "POST",
        body: JSON.stringify({ campaignId: activeCampaign, operations: batch }),
      });
      campaignRevision = result.revision;
      const serverWon = applyAuthoritativeConflict(result, batch);
      const savedModule = batch.find(operation => operation.path === `modules.${stateModuleName}`);
      if (savedModule && !serverWon) {
        captureCurrentValue();
        acknowledgeValue(JSON.stringify(savedModule.value), result.revision);
      }
      status.textContent = serverWon === "deferred" ? "继续同步本机新修改…" : "已同步";
    } catch (error) {
      operationQueue.unshift(...batch);
      queued = true;
      status.textContent = navigator.onLine ? error.message : "离线暂存";
    } finally {
      saving = false;
      if (operationQueue.length && navigator.onLine) setTimeout(drainQueue, 250);
    }
  }

  async function pushValue(value) {
    if (!activeCampaign) return;
    cache.value = value;
    storeCache();
    queueOperation(`modules.${stateModuleName}`, JSON.parse(value));
    publishScene();
    await drainQueue();
  }

  async function flushCurrentValue() {
    queueCurrentValue();
    publishScene(true);
    const deadline = Date.now() + 1600;
    while ((saving || operationQueue.length) && Date.now() < deadline) {
      await drainQueue();
      await new Promise(resolve => setTimeout(resolve, 40));
    }
  }

  function queueCurrentValue() {
    const current = captureCurrentValue();
    if (!current) return;
    const path = `modules.${stateModuleName}`;
    if (current === lastValue && (!cacheIsDirty() || saving || operationQueue.some(operation => operation.path === path))) return;
    lastValue = current;
    queueOperation(path, JSON.parse(current));
  }

  let conflictClueMap = null;
  async function refreshConflictClues() {
    const detail = await api(`campaigns/${activeCampaign}`);
    conflictClueMap = detail.campaign.state?.modules?.map || null;
    campaignRevision = detail.campaign.revision;
    return conflictClueMap;
  }
  async function adjustConflictClue(sheetId, clue, delta) {
    if (!["martial", "errant", "historic", "mystic"].includes(clue) || ![-1, 1].includes(delta)) throw new Error("线索调整无效");
    const map = await refreshConflictClues();
    const index = map?.knights?.findIndex(item => item.sheetId === sheetId && item.memberType === "squire") ?? -1;
    if (index < 0) throw new Error("地图中没有该侍从的线索记录，请先打开地图初始化队伍");
    const value = Math.max(0, (Number(map.knights[index].clues?.[clue]) || 0) + delta);
    const result = await api("campaign-sync", { method: "POST", body: JSON.stringify({ campaignId: activeCampaign, operations: [{ id: operationId(), clientId, path: `modules.map.knights.${index}.clues.${clue}`, value, baseRevision: campaignRevision, squireId: sheetId, clueDelta: delta }] }) });
    campaignRevision = result.revision;
    conflictClueMap = result.state?.modules?.map || await refreshConflictClues();
    return conflictClueMap;
  }
  window.KF_MODULE_BRIDGE = { flush: flushCurrentValue, publishScene, refreshConflictClues, adjustConflictClue, getConflictClues: () => conflictClueMap, handoffKey, campaignUrl };

  async function boot() {
    if (!activeCampaign) {
      status.textContent = "请先选择战役";
      location.href = "/";
      return;
    }
    let accountMismatch = false;
    try {
      const session = await api("auth/me");
      if (!session.user) { location.href = "/"; return; }
      accountMismatch = Boolean(cache.userId && cache.userId !== session.user.id);
      if (accountMismatch) cache = {};
      cache.userId = session.user.id;
      const detail = await api(`campaigns/${activeCampaign}`);
      const roster = await api(`sheets?overview=1&campaignId=${encodeURIComponent(activeCampaign)}`);
      const allSheets = roster.sheets || [];
      const campaignState = detail.campaign.state || {};
      conflictClueMap = campaignState.modules?.map || null;
      const isKnightSheet = sheet => knightIds.has(sheet?.state?.knightId);
      let party = Array.isArray(campaignState.party) ? campaignState.party.filter(id => allSheets.some(sheet => sheet.id === id && isKnightSheet(sheet))) : [];
      if (!party.length && campaignState.leaderSheetId && allSheets.some(sheet => sheet.id === campaignState.leaderSheetId && isKnightSheet(sheet))) party = [campaignState.leaderSheetId];
      // Party slots reference distinct sheet records; repeated identities are
      // allowed because their sheet IDs remain different.
      const fivePlayer = campaignState.optionalRules?.fivePlayer === true;
      const partyLimit = fivePlayer ? 5 : 4;
      party = [...new Set(party)].slice(0, partyLimit);
      const partyKnights = party.map(id => allSheets.find(sheet => sheet.id === id)).filter(Boolean).map(sheet => ({
        id: sheet.id, sheetId: sheet.id, knightId: sheet.state?.knightId || "", type: "knight",
        name: sheet.title || sheet.state?.knight || "未命名骑士", title: sheet.title,
      }));
      const needed = partyKnights.length ? Math.max(0, partyLimit - partyKnights.length) : 0;
      const requested = Array.isArray(campaignState.squires) ? campaignState.squires : [];
      const squireIds = [];
      for (const id of requested) if (squireIds.length < needed && squireCatalog.some(item => item.id === id) && !squireIds.includes(id)) squireIds.push(id);
      for (const item of squireCatalog) if (squireIds.length < needed && !squireIds.includes(item.id)) squireIds.push(item.id);
      const squires = squireIds.map(id => {
        const item = squireCatalog.find(entry => entry.id === id);
        return { id: `squire:${id}`, squireId: id, type: "squire", name: `${item.name}（侍从）`, title: "侍从" };
      });
      window.KF_CAMPAIGN_KNIGHTS = partyKnights;
      window.KF_CAMPAIGN_SQUIRES = squires;
      window.KF_CAMPAIGN_PARTY = [...partyKnights, ...squires];
      window.KF_CAMPAIGN_KINGDOM = campaignState.kingdom || campaignState.map?.activeKingdom || campaignState.monsterPool?.kingdom || "";
      // Five-player rules require a fifth member in the campaign party.
      window.KF_CAMPAIGN_OPTIONS = {
        fivePlayer: fivePlayer && window.KF_CAMPAIGN_PARTY.length >= 5,
        leaderSheetId: String(campaignState.leaderSheetId || "")
      };
      window.KF_CLASH_PHASE = phaseFromMapTime(campaignState.modules?.map?.trackers?.time);
      localStorage.setItem(rosterKey, JSON.stringify(window.KF_CAMPAIGN_PARTY));
      localStorage.setItem(kingdomKey, window.KF_CAMPAIGN_KINGDOM);
      localStorage.setItem(optionsKey, JSON.stringify(window.KF_CAMPAIGN_OPTIONS));
      exposeMapUpstream(campaignState);
      campaignRevision = detail.campaign.revision;
      const value = detail.campaign.state?.modules?.[stateModuleName] || null;
      const dirty = cacheIsDirty();
      if (dirty) {
        campaignRevision = Number.isInteger(cache.revision) ? cache.revision : 0;
        prepareStorage(JSON.parse(cache.value));
      } else {
        prepareStorage(value);
        cache.value = value ? JSON.stringify(value) : "";
        acknowledgeValue(cache.value, campaignRevision);
      }
      window.KF_MODULE_BOOTSTRAP = { campaignId: activeCampaign, storageKey, serverState: value, offline: false };
      const handoff = readHandoff();
      if (moduleName === "encounter" && handoff && !handoff.appliedEncounter) {
        localStorage.removeItem(storageKey);
      }
      lastValue = localStorage.getItem(storageKey) || "";
      status.textContent = `${detail.campaign.name} · 已同步`;
      await script();
      if (moduleName === "encounter") applyEncounterHandoff();
      if (moduleName === "aibp") applyAibpHandoff(campaignState.modules?.roguePath);
      if (dirty || captureCurrentValue() !== lastValue) {
        lastValue = captureCurrentValue();
        if (lastValue) queueOperation(`modules.${stateModuleName}`, JSON.parse(lastValue));
      }
      publishScene(true);
      watchCurrentValue();
    } catch (error) {
      const cached = accountMismatch ? null : cache.value || localStorage.getItem(storageKey);
      if (cached) {
        prepareStorage(JSON.parse(cached));
        campaignRevision = Number.isInteger(cache.revision) ? cache.revision : 0;
        window.KF_MODULE_BOOTSTRAP = { campaignId: activeCampaign, storageKey, serverState: null, offline: true };
        lastValue = cached;
        status.textContent = navigator.onLine ? error.message : "离线使用本机暂存";
        await script();
        if (moduleName === "encounter") applyEncounterHandoff();
        if (moduleName === "aibp") {
          const localRogue = localStorage.getItem(`kfModuleState:${activeCampaign}:kf-rogue-path-v2`);
          let rogueSave;
          try { rogueSave = JSON.parse(localRogue || "null"); } catch { /* Invalid local Rogue snapshot. */ }
          applyAibpHandoff(rogueSave);
        }
        captureCurrentValue();
        queued = true;
        watchCurrentValue();
      } else {
        status.textContent = error.message;
      }
    }
  }

  function watchCurrentValue() {
    setInterval(() => {
      const current = captureCurrentValue();
      if (current && current !== lastValue) {
        lastValue = current;
        pushValue(current);
      }
    }, 400);
  }

  addEventListener("online", () => {
    queueCurrentValue();
    drainQueue();
  });
  addEventListener("focus", () => publishScene());
  addEventListener("pointerdown", () => publishScene(), { passive: true });
  addEventListener("keydown", () => publishScene(), { passive: true });
  addEventListener("pagehide", () => captureCurrentValue());
  document.addEventListener("visibilitychange", () => {
    captureCurrentValue();
    if (!document.hidden) publishScene(true);
  });
  boot();
})();
