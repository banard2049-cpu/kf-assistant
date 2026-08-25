(() => {
  "use strict";

  const data = window.KF_CONFLICT_SETUPS;
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem("kf-conflict-setup-v1") || "null") || {}; }
    catch { return {}; }
  })();
  const state = {
    monsterId: saved.monsterId || data.monsters[0].id,
    kingdom: saved.kingdom || "all",
    level: String(saved.level || "1"),
    checks: saved.checks || {},
    search: "",
    dialogIndex: 0,
  };

  function persist() {
    localStorage.setItem("kf-conflict-setup-v1", JSON.stringify({
      monsterId: state.monsterId,
      kingdom: state.kingdom,
      level: state.level,
      checks: state.checks,
    }));
  }

  function visibleMonsters() {
    const query = state.search.trim().toLowerCase();
    return data.monsters.filter(monster => {
      const kingdomMatches = state.kingdom === "all" || monster.kingdom === "both" || monster.kingdom === state.kingdom;
      const textMatches = !query || `${monster.name} ${monster.en}`.toLowerCase().includes(query);
      return kingdomMatches && textMatches;
    });
  }

  function currentMonster() {
    return data.monsters.find(monster => monster.id === state.monsterId) || visibleMonsters()[0] || data.monsters[0];
  }

  function monsterChecks(monster) {
    if (!state.checks[monster.id]) state.checks[monster.id] = { setup: [], standard: [] };
    return state.checks[monster.id];
  }

  function kingdomLabel(value) {
    if (value === "sunken") return "沉没王国专用";
    if (value === "stone") return "石之公国专用";
    return "双王国适用";
  }

  function renderMonsterList() {
    const monsters = visibleMonsters();
    if (monsters.length && !monsters.some(monster => monster.id === state.monsterId)) state.monsterId = monsters[0].id;
    $("#resultCount").textContent = `${monsters.length} / ${data.monsters.length}`;
    $("#monsterList").innerHTML = monsters.map(monster => `
      <button class="monster-button ${monster.id === state.monsterId ? "active" : ""}" type="button" data-monster="${monster.id}">
        <span><strong>${esc(monster.name)}</strong><small>${esc(monster.en)}</small></span>
        <span class="monster-type">${esc(monster.type)}</span>
      </button>`).join("") || '<div class="empty">没有匹配的怪物</div>';
  }

  function checklist(kind, items, checked) {
    return `<div class="check-list">${items.map((item, index) => `
      <label class="check-row ${checked.includes(index) ? "done" : ""}">
        <input type="checkbox" data-check-kind="${kind}" data-check-index="${index}" ${checked.includes(index) ? "checked" : ""}>
        <span>${kind === "setup" ? `<b class="step-number">${index + 1}.</b> ` : ""}${esc(item)}</span>
      </label>`).join("")}</div>`;
  }

  function tileMarkup(monster) {
    if (monster.tilesByLevel) {
      const key = state.level === "1" ? "1" : "2+";
      return `<div class="tile-groups"><section class="tile-group"><h4>${key === "1" ? "等级 1" : "等级 2 及以上"}</h4><div class="tiles">${monster.tilesByLevel[key].map(tile => `<div class="tile-item">${esc(tile)}</div>`).join("")}</div></section></div>`;
    }
    return `<div class="tiles">${monster.tiles.map(tile => `<div class="tile-item">${esc(tile)}</div>`).join("")}</div>`;
  }

  function renderSetup() {
    const monster = currentMonster();
    state.monsterId = monster.id;
    const checks = monsterChecks(monster);
    const done = checks.setup.filter(index => index < monster.steps.length).length;
    $("#setupView").innerHTML = `
      <header class="setup-head">
        <div><span class="eyebrow">CLASH SETUP · PDF ${monster.pages[0]}-${monster.pages[1]}</span><h2>${esc(monster.name)}</h2><p>${esc(monster.en)}</p></div>
        <div class="badges"><span class="badge">${esc(monster.type)}</span><span class="badge">${kingdomLabel(monster.kingdom)}</span>${monster.tilesByLevel ? `<span class="badge">等级 ${esc(state.level)}</span>` : ""}</div>
      </header>
      <div class="content-grid">
        <div class="main-column">
          <section class="panel">
            <div class="panel-head"><h3>专属设置步骤</h3><span class="progress">${done} / ${monster.steps.length} 完成</span></div>
            ${checklist("setup", monster.steps, checks.setup)}
            ${(monster.notes || []).map(note => `<p class="note">${esc(note)}</p>`).join("")}
          </section>
          <section class="panel standard-panel">
            <details ${checks.standard.length ? "open" : ""}>
              <summary>通用准备（规则书第 44 页）</summary>
              ${checklist("standard", data.standard, checks.standard)}
            </details>
          </section>
        </div>
        <aside class="side-column">
          <section class="panel"><h3>所需板块与组件</h3>${tileMarkup(monster)}</section>
          <section class="panel reference-panel">
            <div class="panel-head"><h3>原版图示</h3><span class="progress">点击放大</span></div>
            <div class="reference-pages">${monster.pages.map((page, index) => `
              <button class="reference-thumb" type="button" data-reference-index="${index}" aria-label="打开 PDF 第 ${page} 页">
                <img loading="lazy" src="/assets/pages/page-${page}.jpg" alt="${esc(monster.name)}原版参考第 ${page} 页">
                <span>PDF ${page}</span>
              </button>`).join("")}</div>
            <p class="source-note">中文步骤依据 PDF 对应页翻译；版图坐标、朝向和图块摆法以原图为准。</p>
          </section>
        </aside>
      </div>`;
    persist();
  }

  function render() {
    renderMonsterList();
    if (!visibleMonsters().length) {
      $("#setupView").innerHTML = '<div class="empty">没有匹配的冲突设置，请更换搜索词或王国筛选。</div>';
      return;
    }
    renderSetup();
  }

  function openReference(index) {
    const monster = currentMonster();
    state.dialogIndex = Math.max(0, Math.min(index, monster.pages.length - 1));
    const page = monster.pages[state.dialogIndex];
    $("#dialogTitle").textContent = `${monster.name} · ${monster.en}`;
    $("#dialogPage").textContent = `PDF 第 ${page} 页`;
    $("#dialogImage").src = `/assets/pages/page-${page}.jpg`;
    $("#dialogImage").alt = `${monster.name}原版参考第 ${page} 页`;
    $("#previousPage").disabled = state.dialogIndex === 0;
    $("#nextPage").disabled = state.dialogIndex === monster.pages.length - 1;
    if (!$("#referenceDialog").open) $("#referenceDialog").showModal();
    $(".dialog-image-wrap").scrollTo(0, 0);
  }

  $("#monsterList").addEventListener("click", event => {
    const button = event.target.closest("[data-monster]");
    if (!button) return;
    state.monsterId = button.dataset.monster;
    render();
  });
  $("#monsterSearch").addEventListener("input", event => { state.search = event.target.value; render(); });
  $("#kingdomFilter").addEventListener("change", event => { state.kingdom = event.target.value; render(); });
  $("#monsterLevel").addEventListener("change", event => { state.level = event.target.value; renderSetup(); });
  $("#setupView").addEventListener("change", event => {
    const input = event.target.closest("[data-check-kind]");
    if (!input) return;
    const checks = monsterChecks(currentMonster());
    const list = checks[input.dataset.checkKind];
    const index = Number(input.dataset.checkIndex);
    if (input.checked && !list.includes(index)) list.push(index);
    if (!input.checked) checks[input.dataset.checkKind] = list.filter(value => value !== index);
    renderSetup();
  });
  $("#setupView").addEventListener("click", event => {
    const button = event.target.closest("[data-reference-index]");
    if (button) openReference(Number(button.dataset.referenceIndex));
  });
  $("#resetChecks").addEventListener("click", () => {
    if (!confirm(`清空“${currentMonster().name}”的全部设置勾选？`)) return;
    state.checks[currentMonster().id] = { setup: [], standard: [] };
    renderSetup();
  });
  $("#previousPage").addEventListener("click", () => openReference(state.dialogIndex - 1));
  $("#nextPage").addEventListener("click", () => openReference(state.dialogIndex + 1));
  $("#closeDialog").addEventListener("click", () => $("#referenceDialog").close());
  $("#referenceDialog").addEventListener("click", event => {
    if (event.target === $("#referenceDialog")) $("#referenceDialog").close();
  });
  addEventListener("keydown", event => {
    if (!$("#referenceDialog").open) return;
    if (event.key === "ArrowLeft" && state.dialogIndex > 0) openReference(state.dialogIndex - 1);
    if (event.key === "ArrowRight" && state.dialogIndex < currentMonster().pages.length - 1) openReference(state.dialogIndex + 1);
  });

  $("#kingdomFilter").value = state.kingdom;
  $("#monsterLevel").value = state.level;
  render();
})();
