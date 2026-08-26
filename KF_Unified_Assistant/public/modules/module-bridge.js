(() => {
  "use strict";

  const body = document.body;
  const moduleName = body.dataset.kfModule;
  const stateModuleName = moduleName === "rogue" ? "roguePath" : moduleName;
  const storageKey = body.dataset.storageKey;
  const originalApp = body.dataset.originalApp || "app.js";
  const activeCampaign = localStorage.getItem("kfActiveCampaign") || "";
  const rosterKey = `kfCampaignRoster:${activeCampaign}`;
  const mapUpstreamKey = `kfMapUpstream:${activeCampaign}`;
  const kingdomKey = `kfCampaignKingdom:${activeCampaign}`;
  window.KF_CAMPAIGN_KINGDOM = localStorage.getItem(kingdomKey) || "";
  const phaseFromMapTime = value => Number(value) === 8 ? "preliminary" : "full";
  try {
    const cachedMap = [storageKey, "kf-map-host-v6", "kf-map-host-v5"]
      .filter(Boolean)
      .map(key => JSON.parse(localStorage.getItem(key) || "null"))
      .find(Boolean);
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

  const bar = document.createElement("nav");
  bar.className = "unified-module-bar";
  const links = [
    ["/", "骑士团"],
    ["/modules/map/", "地图"],
    ["/modules/encounter/", "遭遇"],
    ["/modules/aibp/", "AI / BP"],
    ["/modules/rogue/", "肉鸽之路"],
    ["/modules/display/", "第二屏"],
  ];
  bar.innerHTML = `<strong>KF 一体化战役</strong>${links.map(([href, label]) =>
    `<a href="${href}" class="${href.includes(`/modules/${moduleName}/`) ? "active" : ""}">${label}</a>`
  ).join("")}`;
  bar.append(status);
  body.prepend(bar);

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
      kingdom: monsterPool?.kingdom || campaignState?.kingdom || campaignState?.map?.activeKingdom || "",
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

  function applyAuthoritativeConflict(result) {
    const path = `modules.${stateModuleName}`;
    const serverWon = result.conflicts?.some(conflict =>
      conflict.path === path && conflict.resolution === "existing"
    );
    if (!serverWon) return false;
    const selected = result.state?.modules?.[stateModuleName];
    if (!selected || typeof selected !== "object") return false;
    const serialized = JSON.stringify(selected);
    localStorage.setItem(storageKey, serialized);
    lastValue = serialized;
    queued = false;
    window.dispatchEvent(new CustomEvent("kf:module-state", { detail: selected }));
    return true;
  }

  function readHandoff() {
    try {
      const keys = moduleName === "aibp" ? ["kfRogueHandoff", "kfEncounterHandoff"] : ["kfEncounterHandoff"];
      for (const key of keys) {
        const value = JSON.parse(localStorage.getItem(key) || "null");
        if (value?.campaignId === activeCampaign) return value;
      }
      return null;
    } catch { return null; }
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
    localStorage.setItem("kfEncounterHandoff", JSON.stringify(handoff));
  }

  function applyAibpHandoff() {
    const handoff = readHandoff();
    if (!handoff || handoff.appliedAibp) return;
    const monster = window.KF_MONSTER_DATA?.monsters?.find(item => item.name === handoff.monster);
    const button = monster && document.querySelector(`[data-monster="${monster.id}"]`);
    if (!button) return;
    button.click();
    const level = document.querySelector("[data-level]");
    if (level) { level.value = String(handoff.level); level.dispatchEvent(new Event("input", { bubbles: true })); }
    document.querySelector("#setupBattle")?.click();
    handoff.appliedAibp = true;
    localStorage.setItem(handoff.roguePath ? "kfRogueHandoff" : "kfEncounterHandoff", JSON.stringify(handoff));
    window.dispatchEvent(new CustomEvent("kf:aibp-handoff", { detail: handoff }));
  }

  function queueOperation(path, value) {
    operationQueue = operationQueue.filter(operation => operation.path !== path);
    operationQueue.push({ id: operationId(), clientId, path, value });
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
    const batch = operationQueue.splice(0, 200).map(operation => ({ ...operation, baseRevision: campaignRevision }));
    status.textContent = navigator.onLine ? "同步中…" : "离线暂存";
    try {
      const result = await api("campaign-sync", {
        method: "POST",
        body: JSON.stringify({ campaignId: activeCampaign, operations: batch }),
      });
      campaignRevision = result.revision;
      const serverWon = applyAuthoritativeConflict(result);
      status.textContent = serverWon ? "已保留服务器较高轮次存档" : "已同步";
    } catch (error) {
      operationQueue.unshift(...batch.map(({ baseRevision, ...operation }) => operation));
      queued = true;
      status.textContent = navigator.onLine ? error.message : "离线暂存";
    } finally {
      saving = false;
      if (operationQueue.length && navigator.onLine) setTimeout(drainQueue, 250);
    }
  }

  async function pushValue(value) {
    if (!activeCampaign) return;
    queueOperation(`modules.${stateModuleName}`, JSON.parse(value));
    publishScene();
    await drainQueue();
  }

  async function flushCurrentValue() {
    const current = localStorage.getItem(storageKey);
    if (current) {
      lastValue = current;
      queueOperation(`modules.${stateModuleName}`, JSON.parse(current));
    }
    publishScene(true);
    const deadline = Date.now() + 1600;
    while ((saving || operationQueue.length) && Date.now() < deadline) {
      await drainQueue();
      await new Promise(resolve => setTimeout(resolve, 40));
    }
  }

  window.KF_MODULE_BRIDGE = { flush: flushCurrentValue, publishScene };

  async function boot() {
    if (!activeCampaign) {
      status.textContent = "请先选择战役";
      location.href = "/";
      return;
    }
    try {
      const session = await api("auth/me");
      if (!session.user) { location.href = "/"; return; }
      const detail = await api(`campaigns/${activeCampaign}`);
      const roster = await api(`sheets?overview=1&campaignId=${encodeURIComponent(activeCampaign)}`);
      const allSheets = roster.sheets || [];
      const campaignState = detail.campaign.state || {};
      const isKnightSheet = sheet => knightIds.has(sheet?.state?.knightId);
      let party = Array.isArray(campaignState.party) ? campaignState.party.filter(id => allSheets.some(sheet => sheet.id === id && isKnightSheet(sheet))) : [];
      if (!party.length && campaignState.leaderSheetId && allSheets.some(sheet => sheet.id === campaignState.leaderSheetId && isKnightSheet(sheet))) party = [campaignState.leaderSheetId];
      // Party slots reference distinct sheet records; repeated identities are
      // allowed because their sheet IDs remain different.
      party = [...new Set(party)].slice(0, 4);
      const partyKnights = party.map(id => allSheets.find(sheet => sheet.id === id)).filter(Boolean).map(sheet => ({
        id: sheet.id, sheetId: sheet.id, knightId: sheet.state?.knightId || "", type: "knight",
        name: sheet.title || sheet.state?.knight || "未命名骑士", title: sheet.title,
      }));
      const needed = partyKnights.length ? Math.max(0, 4 - partyKnights.length) : 0;
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
      try {
        const rogueHandoff = JSON.parse(localStorage.getItem("kfRogueHandoff") || "null");
        if (moduleName === "aibp" && rogueHandoff?.roguePath && rogueHandoff.campaignId === activeCampaign && Array.isArray(rogueHandoff.rogueRoster)) {
          window.KF_CAMPAIGN_KNIGHTS = rogueHandoff.rogueRoster;
          window.KF_CAMPAIGN_SQUIRES = [];
          window.KF_CAMPAIGN_PARTY = rogueHandoff.rogueRoster;
        }
      } catch { /* malformed handoff is ignored */ }
      window.KF_CAMPAIGN_KINGDOM = campaignState.monsterPool?.kingdom || campaignState.kingdom || campaignState.map?.activeKingdom || "";
      window.KF_CLASH_PHASE = phaseFromMapTime(campaignState.modules?.map?.trackers?.time);
      localStorage.setItem(rosterKey, JSON.stringify(window.KF_CAMPAIGN_PARTY));
      localStorage.setItem(kingdomKey, window.KF_CAMPAIGN_KINGDOM);
      exposeMapUpstream(campaignState);
      campaignRevision = detail.campaign.revision;
      const value = detail.campaign.state?.modules?.[stateModuleName] || null;
      prepareStorage(value);
      const handoff = readHandoff();
      if (handoff && ((moduleName === "encounter" && !handoff.appliedEncounter) || (moduleName === "aibp" && !handoff.appliedAibp))) {
        localStorage.removeItem(storageKey);
      }
      lastValue = localStorage.getItem(storageKey) || "";
      status.textContent = `${detail.campaign.name} · 已同步`;
      await script();
      if (moduleName === "encounter") applyEncounterHandoff();
      if (moduleName === "aibp") applyAibpHandoff();
      publishScene(true);
      setInterval(() => {
        const current = localStorage.getItem(storageKey) || "";
        if (current && current !== lastValue) {
          lastValue = current;
          pushValue(current);
        }
      }, 400);
    } catch (error) {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        lastValue = cached;
        status.textContent = navigator.onLine ? error.message : "离线使用本机暂存";
        await script();
        if (moduleName === "encounter") applyEncounterHandoff();
        if (moduleName === "aibp") applyAibpHandoff();
        queued = true;
        setInterval(() => {
          const current = localStorage.getItem(storageKey) || "";
          if (current && current !== lastValue) { lastValue = current; queued = true; }
        }, 400);
      } else {
        status.textContent = error.message;
      }
    }
  }

  addEventListener("online", () => {
    const current = localStorage.getItem(storageKey);
    if (current) pushValue(current);
    else drainQueue();
  });
  addEventListener("focus", () => publishScene());
  addEventListener("pointerdown", () => publishScene(), { passive: true });
  addEventListener("keydown", () => publishScene(), { passive: true });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) publishScene(true); });
  boot();
})();
