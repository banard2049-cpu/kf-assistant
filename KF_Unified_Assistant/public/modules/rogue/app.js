(() => {
  "use strict";
  const RULES = window.KF_ROGUE_RULES;
  // v2 invalidates saves created before the node-coordinate extraction.  The
  // old payload stored hitbox coordinates, so keeping it would redraw circles
  // away from the printed nodes even after the manifest is corrected.
  const KEY = "kf-rogue-path-v2";
  const SLOTS_KEY = "kf-rogue-path-slots-v1";
  const ACTIVE_SLOT_KEY = "kf-rogue-path-active-slot-v1";
  const $ = q => document.querySelector(q);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&#39;"}[c]));
  const clone = value => JSON.parse(JSON.stringify(value));
  const monsterNameById = id => {
    const source = window.KF_ENCOUNTER_DATA?.monsters || [];
    return source.find(item => item.id === id)?.name || id;
  };
  const monsterIdByName = name => (window.KF_ENCOUNTER_DATA?.monsters || []).find(item => item.name === name)?.id || "";
  const knightName = id => RULES.KNIGHTS.find(item => item.id === id)?.name || id;
  const campaignId = () => window.KF_MODULE_BOOTSTRAP?.campaignId || localStorage.getItem("kfActiveCampaign") || "";
  const slotsKey = () => `${SLOTS_KEY}:${campaignId() || "standalone"}`;
  const activeSlotKey = () => `${ACTIVE_SLOT_KEY}:${campaignId() || "standalone"}`;
  let slots = [];
  let activeSlotId = "";
  let state = load();
  let zoom = 1;
  let linkEditorOpen = false;
  let linkAnchorId = null;
  let selectedNodeId = null;
  let viewStage = state.stage || "rosegraal";

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "null");
      const bundled = raw?.schemaVersion === 2 && Array.isArray(raw.slots);
      const matchingBundle = bundled && raw.campaignId === campaignId();
      const legacy = !bundled && raw && typeof raw === "object" ? raw : null;
      let storedSlots = [], requestedSlot = "";
      if (matchingBundle) {
        storedSlots = raw.slots;
        requestedSlot = raw.activeSlotId;
      } else if (legacy) {
        // Old slots were global. Adopt them only when one contains this
        // exact restored run; another campaign's browser slots are unrelated.
        for (const key of [slotsKey(), SLOTS_KEY]) {
          const candidate = JSON.parse(localStorage.getItem(key) || "null");
          const match = Array.isArray(candidate) && candidate.find(slot => JSON.stringify(slot.state) === JSON.stringify(legacy));
          if (match) { storedSlots = candidate; requestedSlot = match.id; break; }
        }
        if (!storedSlots.length) storedSlots = [{ id: `rogue-${Date.now()}`, title: legacy.partyName || "肉鸽战役", state: legacy }];
      } else if (!window.KF_MODULE_BOOTSTRAP || window.KF_MODULE_BOOTSTRAP.offline) {
        storedSlots = JSON.parse(localStorage.getItem(slotsKey()) || "null") || [];
        requestedSlot = localStorage.getItem(activeSlotKey());
      }
      const usedIds = new Set();
      slots = (Array.isArray(storedSlots) ? storedSlots : []).flatMap(slot => {
        if (!slot || typeof slot !== "object" || !slot.state || typeof slot.state !== "object") return [];
        const id = String(slot.id || "");
        if (!id || usedIds.has(id)) return [];
        usedIds.add(id);
        return [{ id, title: String(slot.title || "肉鸽战役"), state: normalizeRun(slot.state) }];
      });
      if (!slots.length) slots = [{ id: `rogue-${Date.now()}`, title: "肉鸽战役", state: RULES.freshState() }];
      activeSlotId = requestedSlot || slots[0].id;
      if (!slots.some(slot => slot.id === activeSlotId)) activeSlotId = slots[0].id;
      const activeSlot = slots.find(slot => slot.id === activeSlotId);
      const loaded = normalizeRun(activeSlot.state);
      // The currently saved edited graph becomes the user's canonical default.
      if (loaded.linksEdited) loaded.defaultLinks = loaded.nodes.map(node => ({ id: node.id, links: [...node.links] }));
      persistSlots(loaded);
      return loaded;
    }
    catch {
      const fresh = RULES.freshState();
      slots = [{ id: `rogue-${Date.now()}`, title: "肉鸽战役", state: fresh }];
      activeSlotId = slots[0].id;
      return fresh;
    }
  }
  function normalizeRun(raw) {
    const { slots: ignoredSlots, activeSlotId: ignoredActive, campaignId: ignoredCampaign, ...run } = raw || {};
    return RULES.normalizeState(run);
  }
  function persistSlots(current) {
    const activeSlot = slots.find(slot => slot.id === activeSlotId);
    if (activeSlot) { activeSlot.state = current; activeSlot.title = current.partyName || activeSlot.title || "肉鸽战役"; }
    localStorage.setItem(slotsKey(), JSON.stringify(slots));
    localStorage.setItem(activeSlotKey(), activeSlotId);
    // Mirror the active run at the top level for the second screen while
    // synchronizing all slots as one campaign-owned snapshot.
    localStorage.setItem(KEY, JSON.stringify({ ...current, schemaVersion: 2, campaignId: campaignId(), activeSlotId, slots }));
  }
  function refreshLabelOverrides(updateSavedMap=false) {
    try {
      // The approved basic map replaces old browser-global audit labels.
      // A deliberate new import is still available as a manual edit.
      if(!updateSavedMap)return;
      const raw = localStorage.getItem(RULES.LABEL_OVERRIDES_KEY);
      const overrides = raw ? JSON.parse(raw) : {};
      if (!overrides || typeof overrides !== "object") return;
      state.nodes.forEach(node => {
        if(node.stage==="withergraal")return;
        const override = overrides[node.id];
        if (!override || typeof override !== "object") return;
        const level = Number(override.level);
        if (Number.isInteger(level) && level >= 1 && level <= 5) { node.level = level; node.resurrection = level; }
        if (["heroic", "class", "peril", "technique", "gear", "virtue", "wild", "sigh"].includes(override.reward)) node.reward = override.reward;
      });
      if(updateSavedMap&&RULES.applyMapConfig(state,RULES.createMapConfig(state.nodes)))save();
      renderMap();
    } catch { /* ignore malformed audit data */ }
  }
  function refreshSavedMapConfig() {
    try {
      const stored=JSON.parse(localStorage.getItem(KEY)||"null");
      if(!stored||stored.campaignId!==campaignId())return;
      const saved=Array.isArray(stored.slots)?stored.slots.find(slot=>slot?.id===activeSlotId)?.state:stored.activeSlotId===activeSlotId?stored:null;
      if(!saved?.mapConfig)return;
      const config=RULES.normalizeState(saved).mapConfig;
      if(!config||JSON.stringify(config)===JSON.stringify(state.mapConfig))return;
      if(RULES.applyMapConfig(state,config)){renderLinkEditor();renderMap();}
    }catch{/* Another tab may still be writing its map snapshot. */}
  }
  function importLabelOverrides(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const value = JSON.parse(reader.result);
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid");
        localStorage.setItem(RULES.LABEL_OVERRIDES_KEY, JSON.stringify(value));
        refreshLabelOverrides(true);
        $("#saveStatus").textContent = "标签修正已导入";
      } catch { alert("标签修正 JSON 格式无效。"); }
      event.target.value = "";
    };
    reader.readAsText(file);
  }
  function save() {
    state.updatedAt = Date.now();
    persistSlots(state);
    $("#saveStatus").textContent = "已保存";
    renderSaveSlots();
  }
  function renderSaveSlots() {
    const select = $("#rogueSaveSelect"); if (!select) return;
    select.innerHTML = slots.map(slot => `<option value="${esc(slot.id)}" ${slot.id === activeSlotId ? "selected" : ""}>${esc(slot.title || "肉鸽战役")}</option>`).join("");
  }
  function switchSlot(id) {
    if (!slots.some(slot => slot.id === id) || id === activeSlotId) return;
    save();
    activeSlotId = id;
    const activeSlot = slots.find(slot => slot.id === activeSlotId);
    state = RULES.normalizeState(activeSlot.state);
    viewStage=state.stage;
    linkEditorOpen = false; linkAnchorId = null;
    selectedNodeId = null;
    save(); render();
  }
  function createNewSlot() {
    save();
    const fresh = freshRunState();
    const slot = { id: `rogue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: "新肉鸽战役", state: fresh };
    slots.push(slot); activeSlotId = slot.id; state = fresh;
    viewStage=state.stage;
    selectedNodeId = null;
    save(); render();
  }
  function toast(message) {
    const node = $("#nodeInfo"); if (node) node.textContent = message;
  }
  function nodeById(id) { return state.nodes.find(node => node.id === id); }
  function freshRunState() {
    const next = RULES.freshState();
    if(state?.mapConfig&&RULES.applyMapConfig(next,state.mapConfig))return next;
    if (state?.defaultLinks || state?.linksEdited) {
      // Use the normalized current graph so a saved template cannot restore
      // stale links after a map correction or a stage-specific reset.
      const source = state.nodes;
      const custom = new Map(source.map(node => [node.id, node.links]));
      next.nodes.forEach(node => { if (custom.has(node.id)) node.links = [...custom.get(node.id)]; });
      next.linksEdited = true;
      next.defaultLinks = source.map(node => ({ id: node.id, links: [...node.links] }));
    }
    return next;
  }
  function clearedIds() { return new Set(state.nodes.filter(node => node.cleared).map(node => node.id)); }
  function isAvailable(node) {
    return RULES.isAvailable(state,node);
  }
  function selectedKnights() {
    return [...document.querySelectorAll(".knight-choice.selected")].map(node => node.dataset.knight);
  }
  function linkIsPresent(left, right) {
    return Boolean(left?.links?.includes(right?.id));
  }
  function toggleLink(left, right) {
    if (!left || !right || left.id === right.id) return;
    const present = linkIsPresent(left, right);
    left.links = present ? left.links.filter(id => id !== right.id) : [...left.links, right.id];
    right.links = present ? right.links.filter(id => id !== left.id) : [...right.links, left.id];
  }
  function renderLinkEditor() {
    const panel = $("#linkEditor");
    if (!panel) return;
    panel.classList.toggle("hidden", !linkEditorOpen);
    const anchor = linkAnchorId ? nodeById(linkAnchorId) : null;
    $("#linkEditorHint").textContent = anchor
      ? `已选中节点 ${anchor.id}：再点击一个节点即可添加或取消连线。`
      : "先点击一个节点，再点击另一个节点来添加或取消双向连线。";
    $("#linkEditorLinks").textContent = anchor
      ? `当前连接：${anchor.links.length ? anchor.links.join("、") : "无"}`
      : "未选择节点";
  }
  function handleLinkNode(node) {
    if (!linkAnchorId) {
      linkAnchorId = node.id;
      $("#nodeInfo").textContent = `已选中节点 ${node.id}，请选择要连接或取消连接的节点。`;
    } else if (linkAnchorId === node.id) {
      linkAnchorId = null;
      $("#nodeInfo").textContent = "已取消选择。";
    } else {
      const anchor = nodeById(linkAnchorId);
      const wasPresent = linkIsPresent(anchor, node);
      toggleLink(anchor, node);
      state.linksEdited = true;
      state.defaultLinks = state.nodes.map(item => ({ id: item.id, links: [...item.links] }));
      if(state.mapConfig)RULES.applyMapConfig(state,RULES.createMapConfig(state.nodes));
      save();
      $("#nodeInfo").textContent = `${wasPresent ? "已取消" : "已添加"} ${anchor.id} ↔ ${node.id} 连线。`;
      linkAnchorId = node.id;
    }
    renderLinkEditor();
    renderMap();
  }
  function resetLinks() {
    if (!confirm("恢复当前路径的默认连线会覆盖该阶段的人工修改，确定继续吗？")) return;
    const defaults = new Map(RULES.ALL_NODES.map(node => [node.id, node]));
    state.nodes.forEach(node => {
      const base = defaults.get(node.id);
      if (base && (node.stage || "rosegraal") === viewStage) node.links = [...base.links];
    });
    // Other stages may still contain intentional edits. Keep their graph as
    // the template inherited by new runs, and drop it only for a default map.
    state.linksEdited = state.nodes.some(node => {
      const links = defaults.get(node.id)?.links || [];
      return node.links.length !== links.length || node.links.some(id => !links.includes(id));
    });
    if (state.linksEdited) state.defaultLinks = state.nodes.map(node => ({ id: node.id, links: [...node.links] }));
    else delete state.defaultLinks;
    if(state.mapConfig)RULES.applyMapConfig(state,RULES.createMapConfig(state.nodes));
    linkAnchorId = null;
    selectedNodeId = null;
    save();
    renderLinkEditor();
    renderMap();
    $("#nodeInfo").textContent = "已恢复当前路径的默认连线。";
  }
  function renderChoices() {
    $("#knightChoices").innerHTML = RULES.KNIGHTS.map(item => `<button class="knight-choice" type="button" data-knight="${esc(item.id)}"><img src="/assets/heroes/${esc(item.id)}-avatar.jpg?v=story-1" alt=""><strong>${esc(item.name)}</strong></button>`).join("");
    document.querySelectorAll(".knight-choice").forEach(button => button.addEventListener("click", () => {
      button.classList.toggle("selected");
      if (selectedKnights().length > 4) button.classList.remove("selected");
    }));
  }
  function startRun() {
    const ids = selectedKnights();
    if (!ids.length) return toast("至少选择一名骑士");
    state = freshRunState();
    const partyName = $("#roguePartyName").value.trim();
    state.partyName = partyName;
    state.roster = ids.map((id, index) => ({ id: `rogue-${index + 1}`, knightId: id, name: knightName(id), player: "", gold: 10, alive: true, rewards: [], notes: "", attributes: Object.fromEntries(RULES.ATTRIBUTE_KEYS.map(key => [key, 0])) }));
    state.status = "active";
    viewStage=state.stage;
    selectedNodeId = null;
    save(); render();
  }
  async function openNode(node) {
    if (!isAvailable(node)) return;
    const result = RULES.randomResult(node.level, node.kingdom);
    state.pendingBattle = { handoffId: `rogue-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, nodeId: node.id, kingdom: node.kingdom, nodeLevel: node.level, roll: result.roll, monsterId: result.monsterId, monster: monsterNameById(result.monsterId), level: result.level, startedAt: Date.now() };
    state.currentNodeId = node.id;
    selectedNodeId = null;
    state.history.push({ at: Date.now(), type: "battle-start", nodeId: node.id, ...result });
    save();
    const roster = state.roster.filter(member => member.alive).slice(0, 4).map(member => ({ id: member.id, sheetId: member.id, knightId: member.knightId, type: "knight", name: member.name, title: member.name }));
    localStorage.setItem("kfRogueHandoff", JSON.stringify({
      id: state.pendingBattle.handoffId, slotId: activeSlotId, createdAt: state.pendingBattle.startedAt,
      campaignId: campaignId(), roguePath: true, stage:state.stage, postgame:state.postgame, nodeId: node.id, kingdom: node.kingdom,
      nodeLevel: node.level, roll: result.roll, monsterId: result.monsterId, monster: monsterNameById(result.monsterId),
      level: result.level, rogueRoster: roster, returnUrl: "/modules/rogue/"
    }));
    renderMap();
    await window.KF_MODULE_BRIDGE?.flush?.();
    location.href = "/modules/aibp/";
  }
  function updateNodeSelection() {
    document.querySelectorAll("[data-node]").forEach(button => {
      const selected = button.dataset.node === selectedNodeId;
      button.classList.toggle("node-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }
  function renderNodeInfo() {
    const panel = $("#nodeInfo");
    const node = nodeById(selectedNodeId);
    if (!node) {
      panel.textContent = (viewStage === "rosegraal" ? "基础路径完成最远端任意一个 V 级节点并结算奖励即可通关。" : "") + "单击节点查看等级和奖励；再次单击选中节点或双击可选节点进入 Boss 战。";
      return;
    }
    const hint = isAvailable(node) ? "已选中 · 再次单击此节点进入 Boss 战"
      : node.cleared ? "已完成"
      : state.pendingBattle ? "请先结算当前 Boss 战"
      : state.pendingRewardChoice ? "请先完成奖励选择"
      : state.status !== "active" ? "战役已结束" : "未解锁 · 需先完成相邻节点";
    const rewards = node.reward === "sigh" ? '<p class="node-reward-summary">队伍获得 1 次圣杯叹息。</p>'
      : node.stage==="withergraal" ? `<div class="node-reward-preview"><strong>团队共享奖励（当前或更低等级，剩余 ${RULES.advancedRewardOptions(state,node).length} 项，本节点选 1 项）：</strong>${RULES.advancedRewardOptions(state,node).map(r=>`<span>${rewardOptionHtml(r)}</span>`).join("")||"<span>可领取的该类奖励已全部领取。</span>"}</div>`
      : `<div class="node-reward-preview">${state.roster.map(member => {
        const options = RULES.basicRewardOptions(state,node,member);
        return `<div><strong>${esc(member.name)}（剩余 ${options.length} 项，选 1 项）：</strong><span>${options.map(option=>`${option.level} 级 · ${esc(option.text)}`).join(" / ")||"该类可领奖励已全部领取"}</span></div>`;
      }).join("")}</div>`;
    const finishHint = RULES.ROSEGRAAL_FINISH_NODE_IDS.includes(node.id) ? '<p class="node-reward-summary">V 级终点：完成此节点并结算奖励即可通关基础路径。</p>' : "";
    panel.innerHTML = `<div class="node-info-heading"><strong>等级 ${node.level} · ${node.kingdom === "stone" ? "巨石公国" : "沉没王国"}</strong><span class="node-info-hint">${hint}</span></div>${finishHint}<p class="node-reward-summary">${resourceText(node)} · 奖励：${esc(rewardName(node.reward))}</p>${rewards}`;
  }
  function renderMap() {
    const canvas = $("#mapCanvas");
    // Resize the layout box itself instead of using a visual transform. CSS
    // transforms do not contribute to scroll dimensions, which made the image
    // and its hitboxes appear to drift or become unreachable after zooming.
    canvas.style.transform = "none";
    canvas.style.width = `${zoom * 100}%`;
    const meta=RULES.stageMeta(viewStage);
    const image=$("#routeMapImage");if(image){image.src=meta.image;image.alt=meta.title;}
    if($("#mapTitle"))$("#mapTitle").textContent=meta.title+(viewStage!==state.stage?"（回看）":"");
    $("#zoomValue").textContent = `${Math.round(zoom * 100)}%`;
    // The source map already contains its printed paths. Do not add a second
    // SVG connector layer on top of it.
    $("#nodeLayer").innerHTML = RULES.getStageNodes(state,viewStage).filter(node => node.reward !== "start").map(node => {
      const available = isAvailable(node);
      const classes = ["rogue-node", node.cleared ? "cleared" : available ? "available" : "locked", state.pendingBattle?.nodeId === node.id ? "pending" : "", linkAnchorId === node.id ? "link-selected" : ""].join(" ");
      const label = node.id === "S" ? "S" : "";
      return `<button type="button" class="${classes}" data-node="${esc(node.id)}" style="left:${(node.page * 50 + node.x * 50)}%;top:${node.y * 100}%" aria-label="${esc(`${node.id}，等级 ${node.level}，${resourceText(node)}，${rewardName(node.reward)}，${node.cleared ? "已完成" : available ? "可选" : "未解锁"}`)}" aria-pressed="false" aria-describedby="nodeInfo" title="${esc(`等级 ${node.level} · ${resourceText(node)} · ${rewardName(node.reward)}`)}">${label}</button>`;
    }).join("");
    document.querySelectorAll("[data-node]").forEach(button => button.addEventListener("click", () => {
      const node = nodeById(button.dataset.node); if (!node) return;
      if (linkEditorOpen && viewStage===state.stage) return handleLinkNode(node);
      if (selectedNodeId === node.id && isAvailable(node)) return openNode(node);
      selectedNodeId = node.id;
      // Keep the button in place so a native double-click reaches the same
      // target: its first click previews, and its second starts the battle.
      updateNodeSelection();
      renderNodeInfo();
    }));
    updateNodeSelection();
    if (!linkEditorOpen) renderNodeInfo();
  }
  function renderParty() {
    $("#partyStats").innerHTML = state.roster.map(member => `<button type="button" class="party-row" data-sheet-member="${esc(member.id)}"><span><strong>${esc(member.name)}</strong><small>${member.alive ? "存活" : "死亡"} · 金钱 ${member.gold}</small></span><span>${member.rewards?.length || 0} 项奖励<br><small>打开记录表</small></span></button>`).join("");
    $("#reviveCount").textContent = state.sharedRevives;
    $("#sighCount").textContent = state.graalSighs;
    document.querySelectorAll("[data-sheet-member]").forEach(button => button.addEventListener("click", () => openKnightSheet(button.dataset.sheetMember)));
  }
  function openKnightSheet(memberId) {
    const member = state.roster.find(item => item.id === memberId);
    if (!member) return;
    const knight = RULES.KNIGHTS.find(item => item.id === member.knightId) || { id: member.knightId, name: member.name };
    $("#sheetTitle").textContent = `${member.name} · 骑士记录表`;
    $("#sheetSubtitle").textContent = `${member.alive ? "存活" : "死亡"}${member.postgame?" · 终盘游戏 Postgame":""} · 点击字段可直接修改`;
    const attributeNames = { might: "Might 威武", fortitude: "Fortitude 坚韧", insight: "Insight 洞察", sagacity: "Sagacity 睿智", bravery: "Bravery 勇敢", tenacity: "Tenacity 顽强" };
    const attributes = member.attributes || Object.fromEntries(RULES.ATTRIBUTE_KEYS.map(key => [key, 0]));
    $("#sheetBody").innerHTML = `<div class="sheet-identity"><img src="/assets/heroes/${esc(knight.id)}-avatar.jpg?v=story-1" alt=""><div class="sheet-identity-copy"><div class="sheet-name-row"><h3>${esc(member.name)}</h3><label>玩家<input data-sheet-field="player" value="${esc(member.player)}" maxlength="80"></label></div></div></div><div class="sheet-fields"><label><span class="sheet-field-name">金钱 <small>GOLD</small></span><img class="sheet-field-icon" src="/assets/sheet-icons/gold.png" alt=""><input data-sheet-field="gold" type="number" min="0" max="999" value="${member.gold}"></label><label><span class="sheet-field-name">状态 <small>STATUS</small></span><select data-sheet-field="alive"><option value="true" ${member.alive ? "selected" : ""}>存活</option><option value="false" ${member.alive ? "" : "selected"}>死亡</option></select></label></div><section class="sheet-attributes"><h3>美德 <small>VIRTUES</small></h3><div class="attribute-grid">${RULES.ATTRIBUTE_KEYS.map(key => `<label><img src="/assets/sheet-icons/${key}.png" alt=""><span>${attributeNames[key]}</span><input data-attribute="${key}" type="number" min="0" max="99" value="${attributes[key] || 0}"></label>`).join("")}</div></section><section class="sheet-rewards"><h3>已获得奖励（${member.rewards?.length || 0}）</h3><div class="sheet-reward-grid">${member.rewards?.length ? member.rewards.map(reward => `<div class="sheet-reward"><strong>等级 ${esc(reward.level)} · ${esc(reward.category)}</strong><span>${esc(reward.text)}</span></div>`).join("") : '<p class="muted">尚未获得奖励。</p>'}</div></section><label class="sheet-notes">记录备注<textarea data-sheet-field="notes" rows="5" maxlength="2000">${esc(member.notes)}</textarea></label>`;
    if(member.postgame){
      $("#sheetBody").innerHTML += `<section class="sheet-growth"><h3>进阶成长</h3><label class="devotion-field">虔信 Devotion<input data-sheet-field="devotion" type="number" min="0" max="9999" value="${member.devotion||0}"></label><div class="growth-grid">${Object.entries(RULES.GROWTH_LABELS).map(([key,label])=>`<label title="${esc(RULES.GROWTH_HELP[key]||label)}">${RULES.GROWTH_ICONS[key]?`<img class="growth-icon" src="/assets/rogue/${RULES.GROWTH_ICONS[key]}.png" alt="${esc(label)}">`:""}<span>${esc(label)} +</span><input data-growth="${key}" type="number" min="0" max="999" value="${member.growth?.[key]||0}"></label>`).join("")}</div></section>`;
    }
    $("#knightSheet").classList.remove("hidden");
    document.querySelectorAll("#sheetBody [data-sheet-field]").forEach(field => field.addEventListener("change", () => {
      if (["gold","devotion"].includes(field.dataset.sheetField)) member[field.dataset.sheetField] = Math.max(0, Math.trunc(Number(field.value) || 0));
      else if (field.dataset.sheetField === "alive") member.alive = field.value === "true";
      else member[field.dataset.sheetField] = field.value;
      save();
      renderParty();
      openKnightSheet(member.id);
    }));
    document.querySelectorAll("#sheetBody [data-attribute]").forEach(field => field.addEventListener("change", () => {
      member.attributes = member.attributes || Object.fromEntries(RULES.ATTRIBUTE_KEYS.map(key => [key, 0]));
      member.attributes[field.dataset.attribute] = Math.max(0, Number(field.value) || 0);
      save();
      openKnightSheet(member.id);
    }));
    document.querySelectorAll("#sheetBody [data-growth]").forEach(field=>field.addEventListener("change",()=>{
      member.growth=member.growth||{};member.growth[field.dataset.growth]=Math.max(0,Math.trunc(Number(field.value)||0));
      save();openKnightSheet(member.id);
    }));
  }
  function closeKnightSheet() { $("#knightSheet").classList.add("hidden"); }
  function renderRewards() {
    const entries = state.rewards.slice(-8).reverse();
    $("#rewardLog").innerHTML = entries.length ? entries.map(item => `<div class="reward-item"><strong>${esc(item.title)}</strong><br>${esc(item.text)}</div>`).join("") : '<p class="muted">尚无奖励记录。</p>';
  }
  const rewardCategoryNames = { heroic: "Heroic Arc（英勇曲线）", class: "Class（职业）", peril: "Peril Arc（危险曲线）", technique: "Technique（招数）", virtue: "Virtue（美德）", gear: "Gear（装备）", wild: "Wild Card（万能）" };
  const rewardName = category => ({ heroic: "Heroic Arc（英勇曲线）", class: "Class（职业）", peril: "Peril Arc（危险曲线）", technique: "Technique（招数）", virtue: "Virtue（美德）", gear: "Gear（装备）", wild: "Wild Card（万能）", sigh: "Sigh of the Graal（圣杯叹息）",stat:"属性提升",mastery:"精通",princess:"公主",saint:"圣徒",legendary:"传奇装备",start:"起点" }[category] || category);
  const resourceText = node => node.stage!=="withergraal"||node.resurrection>0 ? `复活 ${node.resurrection}` : node.devotion>0?`每名骑士获得 ${node.devotion} 虔信（枯萎）`:"无额外复活或虔信（枯萎）";
  const rewardOptionHtml = reward => `${reward.level?`${reward.level} 级 · `:""}${reward.icon?`<img class="growth-icon" src="/assets/rogue/${esc(reward.icon)}.png" alt="${esc(reward.text)}">`:""}${esc(reward.text)}${reward.help?`<small class="reward-help">${esc(reward.help)}</small>`:""}`;
  function rewardChoiceOptions(node) {
    if (!node || !state.roster.length) return null;
    if (node.stage === "withergraal") return node.reward !== "sigh" && RULES.advancedRewardOptions(state, node).length ? [node.reward] : null;
    return state.roster.some(member => RULES.basicRewardOptions(state,node,member).length > 1)
      ? [node.reward] : null;
  }
  function applyRewardAttributes(member, rewardText) {
    const names = { Might: "might", Fortitude: "fortitude", Insight: "insight", Sagacity: "sagacity", Bravery: "bravery", Tenacity: "tenacity" };
    member.attributes = member.attributes || Object.fromEntries(RULES.ATTRIBUTE_KEYS.map(key => [key, 0]));
    const pattern = /\+(\d+)\s+(Might|Fortitude|Insight|Sagacity|Bravery|Tenacity)\b/g;
    let match;
    while ((match = pattern.exec(String(rewardText || "")))) member.attributes[names[match[2]]] += Number(match[1]);
    // Gold Wild Cards are printed as a bare "+N" with a coin icon (no attribute
    // or text after the number). Attribute rewards always name the virtue, and
    // Rapport/Mercenary rewards carry words, so a standalone "+N" is gold.
    const goldMatch = /^\+(\d+)$/.exec(String(rewardText || "").trim());
    if (goldMatch) member.gold = Math.max(0, (Number(member.gold) || 0) + Number(goldMatch[1]));
  }
  function renderRewardChoice() {
    const modal = $("#rewardChoiceModal");
    const pending = state.pendingRewardChoice;
    modal.classList.toggle("hidden", !pending);
    if (!pending) return;
    const node = nodeById(pending.nodeId);
    if (!node) return;
    if (node.stage === "withergraal") return renderAdvancedRewardChoice(node, pending);
    if ($("#rewardChoiceHint")) $("#rewardChoiceHint").textContent = "每名骑士各从当前或更低等级的同类未领奖励中选择一项；已领取的项目不能重复领取。";
    $("#rewardChoiceError").textContent = "";
    const options = rewardChoiceOptions(node);
    // Older saves may contain a pending choice created by the previous
    // incorrect H/P two-choice flow.  Resolve it using the node's canonical
    // reward category instead of presenting stale choices again.
    if (!options) {
      modal.classList.add("hidden");
      finalizeVictory(pending, {});
      return;
    }
    const draft=pending.choices||(pending.choices={});
    $("#rewardChoiceBody").innerHTML = state.roster.map(member => {
      const rewards = RULES.basicRewardOptions(state,node,member);
      if(!rewards.length)return `<p class="muted">${esc(member.name)}：该类可领奖励已全部领取。</p>`;
      const selected=rewards.find(option=>option.id===draft[member.id]||option.rewards.includes(draft[member.id]))||rewards[0];
      draft[member.id]=selected.id;
      return `<label class="reward-choice-row"><strong>${esc(member.name)}（${rewards.length} 选 1）</strong><select data-reward-choice="${esc(member.id)}">${rewards.map(reward => `<option value="${esc(reward.id)}" ${reward.id===selected.id?"selected":""}>${reward.level} 级 · ${esc(rewardCategoryNames[node.reward] || node.reward)} · ${esc(reward.text)}</option>`).join("")}</select></label>`;
    }).join("");
    document.querySelectorAll("[data-reward-choice]").forEach(select=>select.addEventListener("change",()=>{draft[select.dataset.rewardChoice]=select.value;save();}));
  }
  function renderAdvancedRewardChoice(node, pending) {
    const options = RULES.advancedRewardOptions(state, node);
    if (!options.length) return finalizeVictory(pending, {});
    const draft = pending.choice || (pending.choice = {});
    const selected = options.find(option => option.id === draft.rewardId) || options[0];
    draft.rewardId = selected.id;
    if (!state.roster.some(member => member.id === draft.memberId)) draft.memberId = state.roster[0]?.id || "";
    const boon = RULES.advancedRewardBoon(selected,draft);
    const needsMember = RULES.advancedRewardNeedsMember(selected,draft);
    $("#rewardChoiceHint").textContent = `当前或更低等级的同类奖励，全队从剩余 ${options.length} 项中选 1 项；领取后消耗该项的共享名额。卡牌效果按原卡执行。`;
    $("#rewardChoiceError").textContent = "";
    $("#rewardChoiceBody").innerHTML = `<fieldset class="advanced-reward-options"><legend>节点等级 ${node.level} · ${esc(rewardName(node.reward))}</legend>${options.map(option => `<label class="advanced-reward-option"><input type="radio" name="advanced-reward" value="${esc(option.id)}" ${option.id === selected.id ? "checked" : ""}><span>${rewardOptionHtml(option)}${option.requiresName ? `（本级名额 ${option.slot}）` : ""}</span></label>`).join("")}</fieldset>${selected.alternatives ? `<label class="reward-choice-row">此名额二选一<select data-advanced-alternative>${selected.alternatives.map((option, index) => `<option value="${index}" ${Number(draft.alternative || 0) === index ? "selected" : ""}>${esc(option.text)}</option>`).join("")}</select></label>` : ""}${needsMember ? `<label class="reward-choice-row">领取骑士<select data-advanced-member>${state.roster.map(member => `<option value="${esc(member.id)}" ${member.id === draft.memberId ? "selected" : ""}>${esc(member.name)}</option>`).join("")}</select></label>${boon?.gold?'<p class="muted">全队总共获得 30 金钱；选择一名骑士记账。本项不会解锁 Slawia，且与解锁 Slawia 共用一个名额。</p>':""}` : '<p class="muted">解锁后供全队使用；每场至多携带一名公主，各骑士可选择一名已解锁圣徒。</p>'}${selected.requiresName ? `<label class="reward-choice-row">实际精通名称<input data-advanced-name maxlength="120" value="${esc(draft.name || "")}" placeholder="填写实际抽到的名称"></label>` : ""}`;
    document.querySelectorAll('[name="advanced-reward"]').forEach(input => input.addEventListener("change", () => {
      draft.rewardId = input.value; delete draft.name; delete draft.alternative; save(); renderAdvancedRewardChoice(node, pending);
    }));
    [["[data-advanced-member]", "memberId"], ["[data-advanced-name]", "name"], ["[data-advanced-alternative]", "alternative"]].forEach(([selector, key]) => {
      const input = $(selector);
      input?.addEventListener(key === "name" ? "input" : "change", () => { draft[key] = input.value; save(); if(key==="alternative")renderAdvancedRewardChoice(node,pending); });
    });
  }
  function finalizeVictory(pending, choices) {
    if (!pending) return;
    const node = nodeById(pending.nodeId); if (!node) return;
    if (state.history.some(item => item.type === "victory" && item.nodeId === node.id)) return;
    selectedNodeId = null;
    const rewardText = [];
    if (node.reward === "sigh") {
      state.graalSighs += 1;
      rewardText.push(`Sigh of the Graal · 圣杯叹息（+1，当前 ${state.graalSighs}）`);
    }
    else if (node.stage === "withergraal") {
      if (RULES.advancedRewardOptions(state, node).length) {
        const result = RULES.claimAdvancedReward(state, node, choices.advanced || pending.choice || {});
        if (!result.ok) { $("#rewardChoiceError").textContent = result.message; return; }
        rewardText.push(result.text);
      } else rewardText.push("当前或更低等级的该类团队奖励已全部领取。");
    }
    else {
      const grants=state.roster.map(member=>{
        const options=RULES.basicRewardOptions(state,node,member);
        const choice=choices[member.id]||pending.choices?.[member.id];
        const selected=choice?options.find(option=>option.id===choice||option.rewards.includes(choice)):options[0];
        return {member,options,selected};
      });
      if(grants.some(({options,selected})=>options.length&&!selected)){
        $("#rewardChoiceError").textContent="请选择尚未领取、且不高于当前节点等级的奖励。";return;
      }
      grants.forEach(({member,selected})=>{
        if(!selected){rewardText.push(`${member.name}：该类可领奖励已全部领取。`);return;}
        selected.rewards.forEach((reward,index)=>{
          const key=selected.keys[index];
          state.claimedRewards[key]=true;
          member.rewards.push({key,level:selected.level,nodeLevel:node.level,category:node.reward,text:reward});
          applyRewardAttributes(member,reward);
        });
        rewardText.push(`${member.name}：${selected.level} 级 · ${selected.rewards.join(" + ")}`);
      });
    }
    node.cleared = true;
    const resources = node.stage === "withergraal" ? `${pending.rewardRevives || 0} 次复活${pending.rewardDevotion ? `；每名骑士 ${pending.rewardDevotion} 虔信` : ""}` : `${pending.rewardRevives} 次复活`;
    state.rewards.push({ title: `等级 ${node.level} · ${rewardName(node.reward)} · 胜利`, text: `获得 ${resources}。${rewardText.join("；")}` });
    state.history.push({ at: Date.now(), type: "victory", nodeId: node.id, casualties: pending.casualties, spentRevives: pending.spentRevives, rewardRevives: pending.rewardRevives, reward: node.reward, graalSighs: state.graalSighs, choices });
    state.pendingRewardChoice = null; state.currentNodeId = null;
    if (RULES.stageComplete(state, state.stage)) state.status = "won";
    else if (!state.roster.some(member => member.alive) && state.sharedRevives === 0) state.status = "lost";
    save(); render();
  }
  function renderResolution() {
    const pending = state.pendingBattle;
    $("#resolutionPanel").classList.toggle("hidden", !pending);
    if (!pending) return;
    const battleNode = nodeById(pending.nodeId);
    $("#battleSummary").innerHTML = `${battleNode ? `等级 ${battleNode.level} · ${esc(rewardName(battleNode.reward))}` : "当前节点"} · ${esc(pending.monster)} · Boss 等级 ${pending.level}<br><small>规则表 d10：${pending.roll}</small>`;
    $("#casualtySelect").innerHTML = state.roster.filter(member => member.alive).map(member => `<label class="casualty-option" style="display:flex;align-items:center;justify-content:space-between;gap:9px"><input type="checkbox" value="${esc(member.id)}" style="order:2;flex:0 0 auto;margin-left:auto"><span><strong>${esc(member.name)}</strong><small>当前存活 · 点击标记死亡</small></span></label>`).join("") || '<p class="muted">没有存活骑士可选择。</p>';
  }
  function clearBattleHandoff(pending) {
    try {
      const handoff = JSON.parse(localStorage.getItem("kfRogueHandoff") || "null");
      if (!handoff?.roguePath || handoff.campaignId !== campaignId()) return;
      if (handoff.slotId && handoff.slotId !== activeSlotId) return;
      if (pending.handoffId) {
        if (handoff.id !== pending.handoffId) return;
      } else {
        // Legacy handoffs had no slot or request ID. Only claim one when its
        // battle matches exactly one local slot, which must be the current one.
        const matches = battle => battle?.nodeId === handoff.nodeId
          && (battle.monsterId || battle.monster) === (handoff.monsterId || handoff.monster)
          && Number(battle.level) === Number(handoff.level);
        const owners = slots.filter(slot => matches(slot.state?.pendingBattle));
        if (!matches(pending) || owners.length !== 1 || owners[0].id !== activeSlotId) return;
      }
      localStorage.removeItem("kfRogueHandoff");
    } catch { /* malformed or unrelated handoffs are not owned by this battle */ }
  }
  function resolve(result) {
    const pending = state.pendingBattle; if (!pending) return;
    const node = nodeById(pending.nodeId); if (!node) return;
    clearBattleHandoff(pending);
    selectedNodeId = null;
    const casualties = [...document.querySelectorAll("#casualtySelect input[type=checkbox]:checked")].map(input => input.value);
    const dead = new Set(casualties);
    const deadCount = casualties.length;
    state.roster.forEach(member => { if (dead.has(member.id)) member.alive = false; });
    if (result === "defeat") {
      const spentRevives = Math.min(deadCount, state.sharedRevives);
      let restored = 0;
      for (const member of state.roster) {
        if (dead.has(member.id) && restored < spentRevives) { member.alive = true; restored += 1; }
      }
      state.sharedRevives -= spentRevives;
      state.rewards.push({ title: "冲突失败", text: `${pending.monster}：节点保留，损失 ${spentRevives} 次复活${spentRevives < deadCount ? "（复活次数不足）" : ""}。` });
      state.history.push({ at: Date.now(), type: "defeat", nodeId: node.id, casualties, spentRevives });
      state.pendingBattle = null; state.currentNodeId = null;
      if (!state.roster.some(member => member.alive) && state.sharedRevives === 0) state.status = "lost";
      save(); render(); return;
    }
    let spent = 0;
    for (const member of state.roster) {
      if (!member.alive && spent < state.sharedRevives) { member.alive = true; spent += 1; }
    }
    state.sharedRevives -= spent;
    let rewardRevives = node.resurrection;
    const aliveAfter = state.roster.filter(member => member.alive).length;
    if (node.stage !== "withergraal") rewardRevives = Math.max(rewardRevives, Math.max(0, 4 - aliveAfter - state.sharedRevives));
    state.sharedRevives += rewardRevives;
    const rewardDevotion = node.stage === "withergraal" ? Math.max(0, Number(node.devotion) || 0) : 0;
    if (rewardDevotion) state.roster.forEach(member => { member.devotion = (Number(member.devotion) || 0) + rewardDevotion; });
    node.cleared = true;
    const options = rewardChoiceOptions(node);
    state.pendingBattle = null;
    if (options) {
      state.pendingRewardChoice = { nodeId: node.id, rewardRevives, rewardDevotion, casualties, spentRevives: spent, options };
      save(); render();
      return;
    }
    finalizeVictory({ nodeId: node.id, rewardRevives, rewardDevotion, casualties, spentRevives: spent }, {});
  }
  function render() {
    const active = state.status !== "setup";
    $("#setupPanel").classList.toggle("hidden", active);
    $("#emptyPanel").classList.toggle("hidden", active);
    $("#runPanel").classList.toggle("hidden", !active);
    if (!active) return;
    $("#continueWithergraal")?.classList.toggle("hidden", !RULES.canEnterWithergraal(state));
    const stageSelect = $("#mapStageSelect");
    if (stageSelect) { stageSelect.classList.toggle("hidden", !state.postgame); stageSelect.value = viewStage; }
    const unlocks = $("#teamUnlocks");
    if (unlocks) unlocks.innerHTML = state.postgame ? `<div class="team-unlocks"><strong>团队解锁</strong><p>公主：${(state.unlockedPrincesses || []).map(esc).join("、") || "暂无"}</p><p>圣徒：${(state.unlockedSaints || []).map(esc).join("、") || "暂无"}</p></div>` : "";
    $("#runStatus").textContent = ({active:"进行中",won:"战役胜利",lost:"战役失败"})[state.status] || state.status;
    renderParty(); renderRewards(); renderResolution(); renderRewardChoice(); renderLinkEditor(); renderMap();
    const pending = state.pendingBattle;
    $("#pendingNotice").innerHTML = pending ? `<p class="reward-item">待结算：${esc(pending.monster)} · <a href="/modules/aibp/">返回 AI/BP</a></p>` : "";
  }
  $("#startRun").addEventListener("click", startRun);
  $("#newRun").addEventListener("click", () => { if (!confirm("新建肉鸽战役会建立一个新的存档，保留当前肉鸽进度，确定继续？")) return; createNewSlot(); });
  $("#resolveVictory").addEventListener("click", () => resolve("victory"));
  $("#resolveDefeat").addEventListener("click", () => resolve("defeat"));
  const adjustSighs = delta => {
    state.graalSighs = Math.max(0, Math.min(999, state.graalSighs + delta));
    save();
    render();
  };
  $("#sighDecrease").addEventListener("click", () => adjustSighs(-1));
  $("#sighIncrease").addEventListener("click", () => adjustSighs(1));
  $("#confirmRewardChoices").addEventListener("click", () => {
    if (state.pendingRewardChoice && nodeById(state.pendingRewardChoice.nodeId)?.stage === "withergraal") {
      finalizeVictory(state.pendingRewardChoice, { advanced: state.pendingRewardChoice.choice || {} });
      return;
    }
    const choices = {};
    document.querySelectorAll("[data-reward-choice]").forEach(select => { choices[select.dataset.rewardChoice] = select.value; });
    if (!Object.keys(choices).length) return;
    finalizeVictory(state.pendingRewardChoice, choices);
  });
  $("#continueWithergraal")?.addEventListener("click", () => {
    if (!RULES.enterWithergraal(state)) return;
    viewStage = state.stage; selectedNodeId = null; linkAnchorId = null;
    linkEditorOpen = false;
    zoom = 1;
    save(); render();
    const viewport = $("#mapViewport");
    viewport.scrollTop = 0; viewport.scrollLeft = 0;
    window.KF_ROGUE_TRANSITION?.play({
      from: RULES.stageMeta("rosegraal").image,
      to: RULES.stageMeta("withergraal").image,
    });
  });
  $("#mapStageSelect")?.addEventListener("change", event => {
    viewStage = event.target.value === "withergraal" && state.postgame ? "withergraal" : "rosegraal";
    selectedNodeId = null; linkAnchorId = null; renderMap();
  });
  $("#zoomIn").addEventListener("click", () => { zoom = Math.min(2, zoom + .1); renderMap(); });
  $("#zoomOut").addEventListener("click", () => { zoom = Math.max(.5, zoom - .1); renderMap(); });
  $("#toggleLinkEditor").addEventListener("click", () => {
    linkEditorOpen = !linkEditorOpen;
    linkAnchorId = null;
    selectedNodeId = null;
    $("#toggleLinkEditor").textContent = linkEditorOpen ? "完成连线编辑" : "编辑节点连线";
    renderLinkEditor();
    renderMap();
  });
  $("#resetLinks").addEventListener("click", resetLinks);
  $("#importRogueLabels").addEventListener("change", importLabelOverrides);
  window.addEventListener("storage", event => {
    if(event.key===KEY)refreshSavedMapConfig();
    if(event.key===RULES.LABEL_OVERRIDES_KEY)refreshLabelOverrides();
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden){refreshSavedMapConfig();refreshLabelOverrides();} });
  $("#rogueSaveSelect").addEventListener("change", event => switchSlot(event.target.value));
  $("#closeSheet").addEventListener("click", closeKnightSheet);
  $("#knightSheet").addEventListener("click", event => { if (event.target.id === "knightSheet") closeKnightSheet(); });
  renderChoices(); renderSaveSlots(); render();
})();
