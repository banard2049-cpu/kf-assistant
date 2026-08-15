(() => {
  "use strict";

  const body = document.body;
  const moduleName = body.dataset.kfModule;
  const storageKey = body.dataset.storageKey;
  const originalApp = body.dataset.originalApp || "app.js";
  const activeCampaign = localStorage.getItem("kfActiveCampaign") || "";
  const rosterKey = `kfCampaignRoster:${activeCampaign}`;
  const mapUpstreamKey = `kfMapUpstream:${activeCampaign}`;
  const kingdomKey = `kfCampaignKingdom:${activeCampaign}`;
  const legacyHarvestHandoffKey = "kfHarvestHandoff";
  const harvestHandoffKey = activeCampaign ? `kfHarvestHandoff:${activeCampaign}` : legacyHarvestHandoffKey;
  window.KF_CAMPAIGN_KINGDOM = localStorage.getItem(kingdomKey) || "";
  function phaseFromMapTime(value) {
    const time = Number(value);
    return time >= 8 && time < 16 ? "preliminary" : "full";
  }
  try {
    const handoff = JSON.parse(localStorage.getItem("kfEncounterHandoff") || "null");
    const handoffPhase = (!handoff?.campaignId || handoff.campaignId === activeCampaign)
      && (handoff?.clashPhase === "preliminary" || handoff?.clashPhase === "full")
      ? handoff.clashPhase : "";
    if (handoffPhase) window.KF_CLASH_PHASE = handoffPhase;
    else {
      const cachedMap = [moduleName === "map" ? storageKey : "", "kf-map-host-v8", "kf-map-host-v6", "kf-map-host-v5"]
        .filter(Boolean)
        .map(key => JSON.parse(localStorage.getItem(key) || "null"))
        .find(Boolean);
      window.KF_CLASH_PHASE = phaseFromMapTime(cachedMap?.trackers?.time);
    }
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
    ["/?module=harvest", "收获"],
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
    const mercenaries = (Array.isArray(campaignState?.partyManager?.outpost?.mercenaries)
      ? campaignState.partyManager.outpost.mercenaries : [])
      .map(item => ({
        catalogId: String(item?.catalogId || ""),
        assignedMemberKey: String(item?.assignedMemberKey || ""),
      }))
      .filter(item => item.catalogId && item.assignedMemberKey);
    const value = {
      campaignId: activeCampaign,
      kingdom: monsterPool?.kingdom || campaignState?.kingdom || campaignState?.map?.activeKingdom || "",
      monsterPool,
      mercenaries,
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
  function harvestInboxId(value) {
    const source = String(value || "receipt");
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    const stem = source.replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 56) || "receipt";
    return `${stem}_${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }
  async function syncHarvestReceipt(receipt) {
    if (!activeCampaign || globalThis.navigator?.onLine === false) return false;
    const result = await api("campaign-sync", {
      method: "POST",
      keepalive: true,
      body: JSON.stringify({
        campaignId: activeCampaign,
        operations: [{
          id: operationId(), clientId, path: `harvestInbox.${harvestInboxId(receipt.id)}`,
          value: receipt, baseRevision: campaignRevision,
        }],
      }),
    });
    campaignRevision = result.revision;
    return true;
  }
  function readHarvestHandoff() {
    try {
      const current = localStorage.getItem(harvestHandoffKey);
      const legacy = harvestHandoffKey !== legacyHarvestHandoffKey ? localStorage.getItem(legacyHarvestHandoffKey) : null;
      const value = JSON.parse(current || legacy || "null");
      if (!current && legacy && value?.campaignId === activeCampaign) {
        localStorage.setItem(harvestHandoffKey, legacy);
        localStorage.removeItem(legacyHarvestHandoffKey);
      }
      return value?.campaignId === activeCampaign && Array.isArray(value.receipts) ? value : { campaignId: activeCampaign, receipts: [] };
    } catch { return { campaignId: activeCampaign, receipts: [] }; }
  }
  function recordHarvestReceipt(receipt, { open = false } = {}) {
    const value = readHarvestHandoff();
    const normalized = {
      ...receipt,
      id: String(receipt?.id || `harvest-${compatibleUuid().replace(/-/g, "")}`),
      source: String(receipt?.source || moduleName || "manual"),
      createdAt: String(receipt?.createdAt || new Date().toISOString()),
      requests: Array.isArray(receipt?.requests) ? receipt.requests : [],
    };
    if (!normalized.requests.length) return null;
    if (!value.receipts.some(item => item.id === normalized.id)) value.receipts.push(normalized);
    localStorage.setItem(harvestHandoffKey, JSON.stringify(value));
    void syncHarvestReceipt(normalized).catch(() => {});
    if (open) location.href = "/?module=harvest";
    return normalized;
  }
  async function flushHarvestReceipts() {
    const value = readHarvestHandoff();
    for (const receipt of value.receipts) await syncHarvestReceipt(receipt);
  }
  function openHarvest(receipt = null) {
    if (receipt) recordHarvestReceipt(receipt);
    location.href = "/?module=harvest";
  }
  const operationId = () => compatibleUuid().replace(/-/g, "");
  const clientId = localStorage.kfClientId || (localStorage.kfClientId = operationId());
  let campaignRevision = 0;
  let lastValue = "";
  let saving = false;
  let queued = false;

  function applyAuthoritativeConflict(result) {
    const path = `modules.${moduleName}`;
    const serverWon = result.conflicts?.some(conflict => conflict.path === path && (
      conflict.resolution === "existing" || conflict.resolution === "merged-existing-mercenaries"
    ));
    if (!serverWon) return false;
    const selected = result.state?.modules?.[moduleName];
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
      const value = JSON.parse(localStorage.getItem("kfEncounterHandoff") || "null");
      return value?.campaignId === activeCampaign ? value : null;
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
    if (handoff.clashPhase === "preliminary" || handoff.clashPhase === "full") {
      window.KF_CLASH_PHASE = handoff.clashPhase;
    }
    const monster = window.KF_MONSTER_DATA?.monsters?.find(item => item.name === handoff.monster);
    const button = monster && document.querySelector(`[data-monster="${monster.id}"]`);
    if (!button) return;
    button.click();
    const level = document.querySelector("[data-level]");
    if (level) { level.value = String(handoff.level); level.dispatchEvent(new Event("input", { bubbles: true })); }
    document.querySelector("#setupBattle")?.click();
    handoff.appliedAibp = true;
    localStorage.setItem("kfEncounterHandoff", JSON.stringify(handoff));
    window.dispatchEvent(new CustomEvent("kf:aibp-handoff", { detail: handoff }));
  }

  async function pushValue(value) {
    if (!activeCampaign || saving) { queued = true; return; }
    saving = true;
    status.textContent = navigator.onLine ? "同步中…" : "离线暂存";
    try {
      const result = await api("campaign-sync", {
        method: "POST",
        body: JSON.stringify({
          campaignId: activeCampaign,
          operations: [{
            id: operationId(), clientId, path: `modules.${moduleName}`,
            value: JSON.parse(value), baseRevision: campaignRevision,
          }],
        }),
      });
      campaignRevision = result.revision;
      const serverWon = applyAuthoritativeConflict(result);
      status.textContent = serverWon ? "已保留服务器较高轮次存档" : "已同步";
    } catch (error) {
      queued = true;
      status.textContent = navigator.onLine ? error.message : "离线暂存";
    } finally {
      saving = false;
      if (queued && navigator.onLine) {
        queued = false;
        const current = localStorage.getItem(storageKey);
        if (current) setTimeout(() => pushValue(current), 500);
      }
    }
  }

  async function flushCurrentValue() {
    const deadline = Date.now() + 1200;
    while (saving && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 40));
    }
    const current = localStorage.getItem(storageKey);
    if (!current) return;
    lastValue = current;
    await pushValue(current);
  }

  window.KF_MODULE_BRIDGE = { flush: flushCurrentValue, flushHarvestReceipts, recordHarvestReceipt, openHarvest };

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
      party = [...new Set(party)].slice(0, 4);
      const partyKnights = party.map(id => allSheets.find(sheet => sheet.id === id)).filter(Boolean).map(sheet => ({
        id: sheet.id, sheetId: sheet.id, knightId: sheet.state?.knightId || "", type: "knight",
        name: sheet.state?.knight || sheet.title, title: sheet.title,
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
      window.KF_CAMPAIGN_KINGDOM = campaignState.monsterPool?.kingdom || campaignState.kingdom || campaignState.map?.activeKingdom || "";
      window.KF_CLASH_PHASE = phaseFromMapTime(campaignState.modules?.map?.trackers?.time);
      localStorage.setItem(rosterKey, JSON.stringify(window.KF_CAMPAIGN_PARTY));
      localStorage.setItem(kingdomKey, window.KF_CAMPAIGN_KINGDOM);
      exposeMapUpstream(campaignState);
      campaignRevision = detail.campaign.revision;
      await flushHarvestReceipts();
      const value = detail.campaign.state?.modules?.[moduleName] || null;
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
    void flushHarvestReceipts().catch(() => {});
  });
  boot();
})();
