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
  const campaignId = () => localStorage.getItem("kfActiveCampaign") || "";
  let slots = [];
  let activeSlotId = "";
  let state = load();
  let zoom = 1;
  let linkEditorOpen = false;
  let linkAnchorId = null;

  function load() {
    try {
      const storedSlots = JSON.parse(localStorage.getItem(SLOTS_KEY) || "null");
      if (Array.isArray(storedSlots) && storedSlots.length) slots = storedSlots;
      else {
        const legacy = JSON.parse(localStorage.getItem(KEY) || "null");
        slots = [{ id: `rogue-${Date.now()}`, title: legacy?.partyName || "肉鸽战役", state: legacy || RULES.freshState() }];
        localStorage.setItem(SLOTS_KEY, JSON.stringify(slots));
      }
      activeSlotId = localStorage.getItem(ACTIVE_SLOT_KEY) || slots[0].id;
      if (!slots.some(slot => slot.id === activeSlotId)) activeSlotId = slots[0].id;
      localStorage.setItem(ACTIVE_SLOT_KEY, activeSlotId);
      const activeSlot = slots.find(slot => slot.id === activeSlotId);
      const loaded = RULES.normalizeState(activeSlot?.state || null);
      // The currently saved edited graph becomes the user's canonical default.
      if (loaded.linksEdited) loaded.defaultLinks = loaded.nodes.map(node => ({ id: node.id, links: [...node.links] }));
      return loaded;
    }
    catch {
      const fresh = RULES.freshState();
      slots = [{ id: `rogue-${Date.now()}`, title: "肉鸽战役", state: fresh }];
      activeSlotId = slots[0].id;
      return fresh;
    }
  }
  function refreshLabelOverrides() {
    try {
      const raw = localStorage.getItem(RULES.LABEL_OVERRIDES_KEY);
      const overrides = raw ? JSON.parse(raw) : {};
      if (!overrides || typeof overrides !== "object") return;
      state.nodes.forEach(node => {
        const override = overrides[node.id];
        if (!override || typeof override !== "object") return;
        const level = Number(override.level);
        if (Number.isInteger(level) && level >= 1 && level <= 5) { node.level = level; node.resurrection = level; }
        if (["heroic", "class", "peril", "technique", "gear", "virtue", "wild", "sigh"].includes(override.reward)) node.reward = override.reward;
      });
      renderMap();
    } catch { /* ignore malformed audit data */ }
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
        refreshLabelOverrides();
        $("#saveStatus").textContent = "标签修正已导入";
      } catch { alert("标签修正 JSON 格式无效。"); }
      event.target.value = "";
    };
    reader.readAsText(file);
  }
  function save() {
    state.updatedAt = Date.now();
    const activeSlot = slots.find(slot => slot.id === activeSlotId);
    if (activeSlot) { activeSlot.state = state; activeSlot.title = state.partyName || activeSlot.title || "肉鸽战役"; }
    localStorage.setItem(SLOTS_KEY, JSON.stringify(slots));
    localStorage.setItem(ACTIVE_SLOT_KEY, activeSlotId);
    localStorage.setItem(KEY, JSON.stringify(state));
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
    localStorage.setItem(ACTIVE_SLOT_KEY, activeSlotId);
    const activeSlot = slots.find(slot => slot.id === activeSlotId);
    state = RULES.normalizeState(activeSlot.state);
    linkEditorOpen = false; linkAnchorId = null;
    renderSaveSlots(); render();
  }
  function createNewSlot() {
    save();
    const fresh = freshRunState();
    const slot = { id: `rogue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: "新肉鸽战役", state: fresh };
    slots.push(slot); activeSlotId = slot.id; state = fresh;
    save(); render();
  }
  function toast(message) {
    const node = $("#nodeInfo"); if (node) node.textContent = message;
  }
  function nodeById(id) { return state.nodes.find(node => node.id === id); }
  function freshRunState() {
    const next = RULES.freshState();
    if (state?.defaultLinks || state?.linksEdited) {
      const source = state.defaultLinks || state.nodes.map(node => ({ id: node.id, links: node.links }));
      const custom = new Map(source.map(node => [node.id, node.links]));
      next.nodes.forEach(node => { if (custom.has(node.id)) node.links = [...custom.get(node.id)]; });
      next.linksEdited = true;
      next.defaultLinks = source.map(node => ({ id: node.id, links: [...node.links] }));
    }
    return next;
  }
  function clearedIds() { return new Set(state.nodes.filter(node => node.cleared).map(node => node.id)); }
  function isAvailable(node) {
    if (!node || node.cleared || state.pendingBattle || state.pendingRewardChoice || state.status !== "active") return false;
    const cleared = clearedIds();
    return node.links.some(id => cleared.has(id));
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
      save();
      $("#nodeInfo").textContent = `${wasPresent ? "已取消" : "已添加"} ${anchor.id} ↔ ${node.id} 连线。`;
      linkAnchorId = node.id;
    }
    renderLinkEditor();
    renderMap();
  }
  function resetLinks() {
    if (!confirm("恢复默认连线会覆盖你当前编辑的节点关系，确定继续吗？")) return;
    const current = new Map(state.nodes.map(node => [node.id, node]));
    const defaults = state.defaultLinks || RULES.NODES.map(node => ({ id: node.id, links: node.links }));
    const defaultMap = new Map(defaults.map(node => [node.id, node.links]));
    state.nodes = RULES.NODES.map(base => ({ ...current.get(base.id), links: [...(defaultMap.get(base.id) || base.links)] }));
    state.linksEdited = true;
    state.defaultLinks = defaults.map(node => ({ id: node.id, links: [...node.links] }));
    linkAnchorId = null;
    save();
    renderLinkEditor();
    renderMap();
    $("#nodeInfo").textContent = "已恢复默认连线。";
  }
  function renderChoices() {
    $("#knightChoices").innerHTML = RULES.KNIGHTS.map(item => `<button class="knight-choice" type="button" data-knight="${esc(item.id)}"><img src="/assets/heroes/${esc(item.id)}-avatar.jpg" alt=""><strong>${esc(item.name)}</strong></button>`).join("");
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
    save(); render();
  }
  async function openNode(node) {
    if (!isAvailable(node)) return;
    const result = RULES.randomResult(node.level, node.kingdom);
    state.pendingBattle = { nodeId: node.id, kingdom: node.kingdom, nodeLevel: node.level, roll: result.roll, monsterId: result.monsterId, monster: monsterNameById(result.monsterId), level: result.level, startedAt: Date.now() };
    state.currentNodeId = node.id;
    state.history.push({ at: Date.now(), type: "battle-start", nodeId: node.id, ...result });
    save();
    const roster = state.roster.filter(member => member.alive).slice(0, 4).map(member => ({ id: member.id, sheetId: member.id, knightId: member.knightId, type: "knight", name: member.name, title: member.name }));
    localStorage.setItem("kfRogueHandoff", JSON.stringify({
      campaignId: campaignId(), roguePath: true, nodeId: node.id, kingdom: node.kingdom,
      nodeLevel: node.level, roll: result.roll, monsterId: result.monsterId, monster: monsterNameById(result.monsterId),
      level: result.level, rogueRoster: roster, returnUrl: "/modules/rogue/"
    }));
    await window.KF_MODULE_BRIDGE?.flush?.();
    location.href = "/modules/aibp/";
  }
  function renderMap() {
    const canvas = $("#mapCanvas");
    // Resize the layout box itself instead of using a visual transform. CSS
    // transforms do not contribute to scroll dimensions, which made the image
    // and its hitboxes appear to drift or become unreachable after zooming.
    canvas.style.transform = "none";
    canvas.style.width = `${zoom * 100}%`;
    $("#zoomValue").textContent = `${Math.round(zoom * 100)}%`;
    // The source map already contains its printed paths. Do not add a second
    // SVG connector layer on top of it.
    $("#nodeLayer").innerHTML = state.nodes.filter(node => node.id !== "S").map(node => {
      const available = isAvailable(node);
      const classes = ["rogue-node", node.cleared ? "cleared" : available ? "available" : "locked", state.pendingBattle?.nodeId === node.id ? "pending" : "", linkAnchorId === node.id ? "link-selected" : ""].join(" ");
      const label = node.id === "S" ? "S" : "";
      const rewardNames = { heroic:"Heroic Arc 英勇曲线", class:"Class 职业", peril:"Peril Arc 危险曲线", technique:"Technique 招数", gear:"Gear 装备", virtue:"Virtue 美德", wild:"Wild Card 万能", sigh:"Sigh of the Graal 圣杯叹息", start:"起点" };
      return `<button type="button" class="${classes}" data-node="${esc(node.id)}" style="left:${(node.page * 50 + node.x * 50)}%;top:${node.y * 100}%" aria-label="${esc(node.id === "S" ? "起点 S" : `等级 ${node.level}，复活 ${node.resurrection}，${rewardNames[node.reward] || node.reward}`)}" title="${esc(node.id === "S" ? "起点 S" : `等级 ${node.level} · 复活 ${node.resurrection} · ${rewardNames[node.reward] || node.reward}`)}" ${linkEditorOpen || available ? "" : "disabled"}>${label}</button>`;
    }).join("");
    document.querySelectorAll("[data-node]").forEach(button => button.addEventListener("click", () => {
      const node = nodeById(button.dataset.node); if (!node) return;
      if (linkEditorOpen) return handleLinkNode(node);
      const rewardNames = { heroic:"Heroic Arc（英勇曲线）", class:"Class（职业）", peril:"Peril Arc（危险曲线）", technique:"Technique（招数）", gear:"Gear（装备）", virtue:"Virtue（美德）", wild:"Wild Card（万能）", sigh:"Sigh of the Graal（圣杯叹息）", start:"起点" };
      $("#nodeInfo").innerHTML = `<strong>${node.id === "S" ? "起点 S" : `等级 ${node.level} · ${node.kingdom === "stone" ? "巨石公国" : "沉没王国"}`}</strong>　复活 ${node.resurrection}　奖励：${esc(rewardNames[node.reward] || node.reward)}`;
      if (isAvailable(node)) openNode(node);
    }));
  }
  function renderParty() {
    $("#partyStats").innerHTML = state.roster.map(member => `<button type="button" class="party-row" data-sheet-member="${esc(member.id)}"><span><strong>${esc(member.name)}</strong><small>${member.alive ? "存活" : "死亡"} · 金币 ${member.gold}</small></span><span>${member.rewards?.length || 0} 项奖励<br><small>打开记录表</small></span></button>`).join("");
    $("#reviveCount").textContent = state.sharedRevives;
    $("#sighCount").textContent = state.graalSighs;
    document.querySelectorAll("[data-sheet-member]").forEach(button => button.addEventListener("click", () => openKnightSheet(button.dataset.sheetMember)));
  }
  function openKnightSheet(memberId) {
    const member = state.roster.find(item => item.id === memberId);
    if (!member) return;
    const knight = RULES.KNIGHTS.find(item => item.id === member.knightId) || { id: member.knightId, name: member.name };
    $("#sheetTitle").textContent = `${member.name} · 骑士记录表`;
    $("#sheetSubtitle").textContent = `${member.alive ? "存活" : "死亡"} · 点击字段可直接修改`;
    const attributeNames = { might: "Might 力量", fortitude: "Fortitude 坚韧", insight: "Insight 洞察", sagacity: "Sagacity 睿智", bravery: "Bravery 勇气", tenacity: "Tenacity 毅力" };
    const attributes = member.attributes || Object.fromEntries(RULES.ATTRIBUTE_KEYS.map(key => [key, 0]));
    $("#sheetBody").innerHTML = `<div class="sheet-identity"><img src="/assets/heroes/${esc(knight.id)}-avatar.jpg" alt=""><div class="sheet-identity-copy"><div class="sheet-name-row"><h3>${esc(member.name)}</h3><label>玩家<input data-sheet-field="player" value="${esc(member.player)}" maxlength="80"></label></div></div></div><div class="sheet-fields"><label><span class="sheet-field-name">金币 <small>GOLD</small></span><img class="sheet-field-icon" src="/assets/sheet-icons/gold.png" alt=""><input data-sheet-field="gold" type="number" min="0" max="999" value="${member.gold}"></label><label><span class="sheet-field-name">状态 <small>STATUS</small></span><select data-sheet-field="alive"><option value="true" ${member.alive ? "selected" : ""}>存活</option><option value="false" ${member.alive ? "" : "selected"}>死亡</option></select></label></div><section class="sheet-attributes"><h3>美德 <small>VIRTUES</small></h3><div class="attribute-grid">${RULES.ATTRIBUTE_KEYS.map(key => `<label><img src="/assets/sheet-icons/${key}.png" alt=""><span>${attributeNames[key]}</span><input data-attribute="${key}" type="number" min="0" max="99" value="${attributes[key] || 0}"></label>`).join("")}</div></section><section class="sheet-rewards"><h3>已获得奖励（${member.rewards?.length || 0}）</h3><div class="sheet-reward-grid">${member.rewards?.length ? member.rewards.map(reward => `<div class="sheet-reward"><strong>等级 ${esc(reward.level)} · ${esc(reward.category)}</strong><span>${esc(reward.text)}</span></div>`).join("") : '<p class="muted">尚未获得奖励。</p>'}</div></section><label class="sheet-notes">记录备注<textarea data-sheet-field="notes" rows="5" maxlength="2000">${esc(member.notes)}</textarea></label>`;
    $("#knightSheet").classList.remove("hidden");
    document.querySelectorAll("#sheetBody [data-sheet-field]").forEach(field => field.addEventListener("change", () => {
      if (field.dataset.sheetField === "gold") member.gold = Math.max(0, Number(field.value) || 0);
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
  }
  function closeKnightSheet() { $("#knightSheet").classList.add("hidden"); }
  function renderRewards() {
    const entries = state.rewards.slice(-8).reverse();
    $("#rewardLog").innerHTML = entries.length ? entries.map(item => `<div class="reward-item"><strong>${esc(item.title)}</strong><br>${esc(item.text)}</div>`).join("") : '<p class="muted">尚无奖励记录。</p>';
  }
  const rewardCategoryNames = { heroic: "Heroic Arc（英勇曲线）", class: "Class（职业）", peril: "Peril Arc（危险曲线）", technique: "Technique（招数）", virtue: "Virtue（美德）", gear: "Gear（装备）", wild: "Wild Card（万能）" };
  const rewardName = category => ({ heroic: "Heroic Arc（英勇曲线）", class: "Class（职业）", peril: "Peril Arc（危险曲线）", technique: "Technique（招数）", virtue: "Virtue（美德）", gear: "Gear（装备）", wild: "Wild Card（万能）", sigh: "Sigh of the Graal（圣杯叹息）" }[category] || category);
  // Gear may list one item in two forms (e.g. Laxlaw's Dual Standard Rigid /
  // Pliant), so the knight keeps every entry. Class/Heroic/Peril/Technique
  // cells instead present their entries as a choice — the knight picks one.
  const GRANT_ALL = new Set(["gear"]);
  function rewardChoiceOptions(node) {
    if (!node || !state.roster.length) return null;
    if (GRANT_ALL.has(node.reward)) return null;
    // A choice exists only when that exact table cell contains several rewards.
    return state.roster.some(member => RULES.rewardOptions(node.level, member.knightId, node.reward).length > 1)
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
    const options = rewardChoiceOptions(node);
    // Older saves may contain a pending choice created by the previous
    // incorrect H/P two-choice flow.  Resolve it using the node's canonical
    // reward category instead of presenting stale choices again.
    if (!options) {
      modal.classList.add("hidden");
      finalizeVictory(pending, {});
      return;
    }
    $("#rewardChoiceBody").innerHTML = state.roster.map(member => {
      const rewards = RULES.rewardOptions(node.level, member.knightId, node.reward);
      return `<label class="reward-choice-row"><strong>${esc(member.name)}</strong><select data-reward-choice="${esc(member.id)}">${rewards.map((reward, index) => `<option value="${esc(reward)}">${esc(rewardCategoryNames[node.reward] || node.reward)} · ${esc(reward)}${rewards.length > 1 ? `（选项 ${index + 1}）` : ""}</option>`).join("")}</select></label>`;
    }).join("");
  }
  function finalizeVictory(pending, choices) {
    const node = nodeById(pending.nodeId); if (!node) return;
    const rewardText = [];
    if (node.reward === "sigh") {
      state.graalSighs += 1;
      rewardText.push(`Sigh of the Graal · 圣杯叹息（+1，当前 ${state.graalSighs}）`);
    }
    else state.roster.forEach(member => {
      const category = node.reward;
      // Grant-all cells (Technique) hand over every printed move; the others
      // resolve to the chosen or default single reward.
      const granted = GRANT_ALL.has(category)
        ? RULES.rewardOptions(node.level, member.knightId, category)
        : [choices[member.id] || RULES.genericReward(node.level, member.knightId, category)];
      const gainedTexts = [];
      let anyDuplicate = false;
      granted.forEach(reward => {
        const key = `${member.id}:${node.level}:${category}:${reward}`;
        const duplicate = Boolean(state.claimedRewards[key]);
        if (!duplicate) { state.claimedRewards[key] = true; member.rewards.push({ key, level: node.level, category, text: reward }); applyRewardAttributes(member, reward); }
        else anyDuplicate = true;
        gainedTexts.push(reward);
      });
      rewardText.push(`${member.name}：${gainedTexts.join(" + ")}${anyDuplicate ? "（部分已获得，重复项无效）" : ""}`);
    });
    node.cleared = true;
    state.rewards.push({ title: `等级 ${node.level} · ${rewardName(node.reward)} · 胜利`, text: `获得 ${pending.rewardRevives} 次复活。${rewardText.join("；")}` });
    state.history.push({ at: Date.now(), type: "victory", nodeId: node.id, casualties: pending.casualties, spentRevives: pending.spentRevives, rewardRevives: pending.rewardRevives, reward: node.reward, graalSighs: state.graalSighs, choices });
    state.pendingRewardChoice = null; state.currentNodeId = null;
    if (state.nodes.filter(item => item.id !== "S").every(item => item.cleared)) state.status = "won";
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
  function resolve(result) {
    const pending = state.pendingBattle; if (!pending) return;
    const node = nodeById(pending.nodeId); if (!node) return;
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
    rewardRevives = Math.max(rewardRevives, Math.max(0, 4 - aliveAfter - state.sharedRevives));
    state.sharedRevives += rewardRevives;
    node.cleared = true;
    const options = rewardChoiceOptions(node);
    state.pendingBattle = null;
    if (options) {
      state.pendingRewardChoice = { nodeId: node.id, rewardRevives, casualties, spentRevives: spent, options };
      save(); render();
      return;
    }
    finalizeVictory({ nodeId: node.id, rewardRevives, casualties, spentRevives: spent }, {});
  }
  function render() {
    const active = state.status !== "setup";
    $("#setupPanel").classList.toggle("hidden", active);
    $("#emptyPanel").classList.toggle("hidden", active);
    $("#runPanel").classList.toggle("hidden", !active);
    if (!active) return;
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
    const choices = {};
    document.querySelectorAll("[data-reward-choice]").forEach(select => { choices[select.dataset.rewardChoice] = select.value; });
    if (!Object.keys(choices).length) return;
    finalizeVictory(state.pendingRewardChoice, choices);
  });
  $("#zoomIn").addEventListener("click", () => { zoom = Math.min(2, zoom + .1); renderMap(); });
  $("#zoomOut").addEventListener("click", () => { zoom = Math.max(.5, zoom - .1); renderMap(); });
  $("#toggleLinkEditor").addEventListener("click", () => {
    linkEditorOpen = !linkEditorOpen;
    linkAnchorId = null;
    $("#toggleLinkEditor").textContent = linkEditorOpen ? "完成连线编辑" : "编辑节点连线";
    renderLinkEditor();
    renderMap();
  });
  $("#resetLinks").addEventListener("click", resetLinks);
  $("#importRogueLabels").addEventListener("change", importLabelOverrides);
  window.addEventListener("storage", event => { if (event.key === RULES.LABEL_OVERRIDES_KEY) refreshLabelOverrides(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshLabelOverrides(); });
  $("#rogueSaveSelect").addEventListener("change", event => switchSlot(event.target.value));
  $("#closeSheet").addEventListener("click", closeKnightSheet);
  $("#knightSheet").addEventListener("click", event => { if (event.target.id === "knightSheet") closeKnightSheet(); });
  renderChoices(); renderSaveSlots(); render();
})();
