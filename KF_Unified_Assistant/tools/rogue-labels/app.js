(() => {
  "use strict";
  const RULES = window.KF_ROGUE_RULES;
  const KEY = RULES.LABEL_OVERRIDES_KEY;
  const rewardLetter = { heroic: "H", class: "C", peril: "P", technique: "T", gear: "G", virtue: "V", wild: "W", sigh: "S" };
  const kingdomName = { sunken: "沉没王国", stone: "巨石公国" };
  const $ = q => document.querySelector(q);
  const nodes = RULES.SOURCE_NODES.filter(node => node.id !== "S").map(node => ({ ...node }));
  let overrides = readOverrides();
  let selected = null;
  function readOverrides() {
    try { const value = JSON.parse(localStorage.getItem(KEY) || "{}"); return value && typeof value === "object" ? value : {}; }
    catch { return {}; }
  }
  function valueFor(node) {
    const override = overrides[node.id] || {};
    return { level: Number(override.level) || node.level, reward: override.reward || node.reward };
  }
  function isChanged(node) { const value = valueFor(node); return value.level !== node.level || value.reward !== node.reward; }
  function renderMap() {
    $("#markers").innerHTML = nodes.map(node => {
      const value = valueFor(node); const changed = isChanged(node); const active = selected === node.id;
      const left = (node.page * 50 + node.x * 50); const cls = `marker ${active ? "selected" : ""} ${changed ? "changed" : ""}`;
      return `<button class="${cls}" data-id="${node.id}" style="left:${left}%;top:${node.y * 100}%" title="${node.id} · 等级 ${value.level} · ${rewardLetter[value.reward]}" aria-label="${node.id}：${rewardLetter[value.reward]}，等级 ${value.level}">${rewardLetter[value.reward]} · ${value.level}</button>`;
    }).join("");
    document.querySelectorAll(".marker").forEach(button => button.addEventListener("click", () => select(button.dataset.id)));
  }
  function filteredNodes() {
    const kingdom = $("#kingdom").value; const status = $("#changed").value; const search = $("#search").value.trim().toLowerCase();
    return nodes.filter(node => (kingdom === "all" || node.kingdom === kingdom) && (status === "all" || (status === "changed" ? isChanged(node) : !isChanged(node))) && (!search || node.id.toLowerCase().includes(search)));
  }
  function renderList() {
    $("#nodeList").innerHTML = filteredNodes().map(node => {
      const value = valueFor(node); const changed = isChanged(node);
      return `<button class="node-row ${selected === node.id ? "selected" : ""} ${changed ? "changed" : ""}" data-id="${node.id}"><span><strong>${node.id}</strong><small>${kingdomName[node.kingdom]}</small></span><span class="node-value"><b>等级 ${value.level}</b><b class="reward-${value.reward}">${rewardLetter[value.reward]}</b></span></button>`;
    }).join("") || '<p class="muted empty-list">没有符合筛选条件的节点。</p>';
    document.querySelectorAll(".node-row").forEach(button => button.addEventListener("click", () => select(button.dataset.id)));
  }
  function renderForm() {
    const node = nodes.find(item => item.id === selected);
    $("#empty").classList.toggle("hidden", Boolean(node)); $("#form").classList.toggle("hidden", !node); $("#selectedId").textContent = node ? node.id : "未选择";
    if (!node) return;
    const value = valueFor(node); $("#nodeName").textContent = node.id; $("#nodeKingdom").textContent = kingdomName[node.kingdom]; $("#level").value = value.level; $("#resurrection").value = value.level; $("#reward").value = value.reward;
  }
  function select(id) { selected = id; renderMap(); renderList(); renderForm(); }
  function updateSummary() { const changed = nodes.filter(isChanged).length; $("#summary").textContent = `共 ${nodes.length} 个节点 · 已修正 ${changed} 个`; }
  function apply() { if (!selected) return; const level = Number($("#level").value); const reward = $("#reward").value; overrides[selected] = { level, reward }; renderMap(); renderList(); renderForm(); updateSummary(); }
  function save() {
    // Saving also commits the values currently visible in the editor, so the
    // user does not have to press a separate Apply button first.
    if (selected) {
      overrides[selected] = { level: Number($("#level").value), reward: $("#reward").value };
    }
    localStorage.setItem(KEY, JSON.stringify(overrides));
    renderMap(); renderList(); renderForm(); updateSummary();
    $("#summary").textContent += " · 已保存";
  }
  function reset() { if (!confirm("清除所有修正并恢复原始地图数据？")) return; overrides = {}; localStorage.removeItem(KEY); renderAll(); }
  function exportJson() { const blob = new Blob([JSON.stringify(overrides, null, 2)], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "rogue-label-overrides.json"; link.click(); URL.revokeObjectURL(link.href); }
  function importJson(event) { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const value = JSON.parse(reader.result); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); overrides = value; localStorage.setItem(KEY, JSON.stringify(overrides)); renderAll(); } catch { alert("JSON 格式无效。"); } event.target.value = ""; }; reader.readAsText(file); }
  function renderAll() { renderMap(); renderList(); renderForm(); updateSummary(); }
  $("#apply").addEventListener("click", apply); $("#save").addEventListener("click", save); $("#reset").addEventListener("click", reset); $("#export").addEventListener("click", exportJson); $("#import").addEventListener("change", importJson); ["#kingdom", "#changed", "#search"].forEach(q => $(q).addEventListener("input", renderList)); $("#level").addEventListener("change", () => { $("#resurrection").value = $("#level").value; });
  renderAll();
})();
