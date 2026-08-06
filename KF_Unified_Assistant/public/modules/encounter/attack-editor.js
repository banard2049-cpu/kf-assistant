(() => {
  "use strict";
  const DATA = window.KF_ENCOUNTER_DATA;
  const STORAGE_KEY = "kf-encounter-card-corrections-v1";
  const GRID_SIZE = 19;
  const ORIGIN = 8;
  const $ = (query, root = document) => root.querySelector(query);
  const $$ = (query, root = document) => [...root.querySelectorAll(query)];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));
  let corrections = loadCorrections();
  let selectedMonsterId = DATA.monsters[0].id;
  let selectedLevel = DATA.monsters[0].encounterLevels[0].level;

  function loadCorrections() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }
  function monster() {
    return DATA.monsters.find(value => value.id === selectedMonsterId) || DATA.monsters[0];
  }
  function level() {
    return monster().encounterLevels.find(value => value.level === selectedLevel) || monster().encounterLevels[0];
  }
  function key() {
    return `${monster().id}:${level().level}`;
  }
  function correction() {
    return corrections[key()] || {};
  }
  function effectivePattern() {
    return correction().attackPattern ?? level().attackPattern ?? [];
  }
  function effectiveCount() {
    return correction().monsterCount ?? level().stats.monsterCount;
  }
  function effectiveVerified() {
    return correction().attackPatternVerified ?? level().attackPatternVerified ?? false;
  }
  function effectiveFacing() {
    return correction().attackFacing ?? level().attackFacing ?? 0;
  }
  function footprint() {
    return Number(level().stats.monsterSize) || (level().tier === "mob" ? 1 : level().tier === "dragon" ? 3 : 2);
  }
  function saveCorrection(patch) {
    corrections[key()] = { ...correction(), ...patch, updatedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(corrections));
    render();
    toast("修正已保存，遭遇战助手会自动读取");
  }
  function crop(card) {
    const image = card.image;
    const col = image.index % image.width;
    const row = Math.floor(image.index / image.width);
    return `<div class="crop-card"><img alt="${esc(card.name)}" src="${esc(image[card.side])}" style="width:${image.width * 100}%;height:${image.height * 100}%;left:${-col * 100}%;top:${-row * 100}%"></div>`;
  }
  function attackGrid() {
    const pattern = new Set(effectivePattern().map(([row, col]) => `${row},${col}`));
    const size = footprint();
    return `<div class="attack-grid" style="--audit-size:${GRID_SIZE}">${Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => {
      const visualRow = Math.floor(index / GRID_SIZE);
      const visualCol = index % GRID_SIZE;
      const row = visualRow - ORIGIN;
      const col = visualCol - ORIGIN;
      const isFootprint = row >= 0 && row < size && col >= 0 && col < size;
      const isAttack = pattern.has(`${row},${col}`);
      const origin = row === 0 && col === 0;
      const middle = Math.floor(size / 2);
      const facing = effectiveFacing();
      const arrow = isFootprint && (
        (facing === 0 && row === 0 && col === middle)
        || (facing === 90 && row === middle && col === size - 1)
        || (facing === 180 && row === size - 1 && col === middle)
        || (facing === 270 && row === middle && col === 0)
      );
      const arrowText = ({ 0: "▲", 90: "▶", 180: "▼", 270: "◀" })[facing];
      return `<button class="attack-cell ${isFootprint ? "footprint" : ""} ${isAttack ? "attack" : ""} ${origin ? "origin" : ""}" data-row="${row}" data-col="${col}" ${isFootprint ? "disabled" : ""} title="相对坐标 ${row}, ${col}">${isFootprint ? (arrow ? arrowText : "■") : isAttack ? "攻击" : ""}</button>`;
    }).join("")}</div>`;
  }
  function render() {
    const current = level();
    const correctedCards = new Set(Object.keys(corrections));
    $("#editorApp").innerHTML = `<div class="audit-layout">
      <aside class="panel audit-sidebar">
        <div class="panel-head"><div><span class="eyebrow">CARDS</span><h2>怪物列表</h2></div><span class="badge">${correctedCards.size} 项修正</span></div>
        ${DATA.monsters.map(value => {
          const count = value.encounterLevels.filter(item => correctedCards.has(`${value.id}:${item.level}`)).length;
          return `<button class="audit-monster ${value.id === monster().id ? "active" : ""}" data-monster="${value.id}"><span>${esc(value.name)}</span><span>${count ? `● ${count}` : ""}</span></button>`;
        }).join("")}
      </aside>
      <section class="audit-main">
        <div class="panel audit-card">
          <div class="panel-head"><div><span class="eyebrow">${current.tier.toUpperCase()}</span><h2>${esc(monster().name)}</h2></div><span class="badge gold">等级 ${current.level}</span></div>
          ${crop(current)}
          <p class="muted">卡图是权威参考。请选择卡图中箭头的实际朝向，再按原图位置绘制红色攻击格。</p>
        </div>
        <div class="panel audit-controls">
          <div class="audit-levels">${monster().encounterLevels.map(item => `<button class="${item.level === current.level ? "active" : ""}" data-level="${item.level}">等级 ${item.level}</button>`).join("")}</div>
          <div class="grid2">
            <div class="field"><label>怪物数量（卡片右下角）</label><input id="monsterCountCorrection" type="number" min="1" max="12" value="${effectiveCount()}"></div>
            <div class="field"><label>卡图中的怪物朝向</label><select id="attackFacing">${[[0, "上 ▲"], [90, "右 ▶"], [180, "下 ▼"], [270, "左 ◀"]].map(([value, label]) => `<option value="${value}" ${effectiveFacing() === value ? "selected" : ""}>${label}</option>`).join("")}</select></div>
          </div>
          <label class="check"><input id="patternVerified" type="checkbox" ${effectiveVerified() ? "checked" : ""}>攻击范围已人工核对</label>
          <div class="stats-note">黑色区域是怪物底盘（${footprint()}×${footprint()}）。箭头方向应与卡图一致；点击其他格切换红色攻击范围，实战时会根据模型朝向自动换算。</div>
          ${attackGrid()}
          <div class="audit-summary">
            <span>攻击格：${effectivePattern().length}</span>
            <span>数量：${effectiveCount()}</span>
            <span>朝向：${({ 0: "上", 90: "右", 180: "下", 270: "左" })[effectiveFacing()]}</span>
            <span>${correction().updatedAt ? `最后修正：${new Date(correction().updatedAt).toLocaleString("zh-CN")}` : "使用内置数据"}</span>
          </div>
          <div class="nav-actions">
            <button id="copyPrevious">复制上一等级范围</button>
            <button id="clearPattern">清空攻击范围</button>
            <button class="danger" id="resetCurrent">恢复当前卡内置数据</button>
          </div>
        </div>
      </section>
    </div>`;
    bind();
  }
  function bind() {
    $$("[data-monster]").forEach(button => button.addEventListener("click", () => {
      selectedMonsterId = button.dataset.monster;
      selectedLevel = monster().encounterLevels[0].level;
      render();
    }));
    $$("[data-level]").forEach(button => button.addEventListener("click", () => {
      selectedLevel = Number(button.dataset.level);
      render();
    }));
    $$(".attack-cell:not([disabled])").forEach(button => button.addEventListener("click", () => {
      const point = [Number(button.dataset.row), Number(button.dataset.col)];
      const pattern = effectivePattern().map(value => [...value]);
      const index = pattern.findIndex(([row, col]) => row === point[0] && col === point[1]);
      if (index >= 0) pattern.splice(index, 1);
      else pattern.push(point);
      saveCorrection({ attackPattern: pattern, attackPatternVerified: true });
    }));
    $("#monsterCountCorrection").addEventListener("change", event => {
      saveCorrection({ monsterCount: Math.max(1, Math.min(12, Number(event.target.value) || 1)) });
    });
    $("#patternVerified").addEventListener("change", event => saveCorrection({ attackPatternVerified: event.target.checked }));
    $("#attackFacing").addEventListener("change", event => saveCorrection({ attackFacing: Number(event.target.value) }));
    $("#clearPattern").addEventListener("click", () => saveCorrection({ attackPattern: [], attackPatternVerified: true }));
    $("#copyPrevious").addEventListener("click", () => {
      const levels = monster().encounterLevels;
      const index = levels.findIndex(item => item.level === selectedLevel);
      if (index <= 0) return toast("当前已经是第一个等级");
      const previous = levels[index - 1];
      const previousCorrection = corrections[`${monster().id}:${previous.level}`] || {};
      saveCorrection({
        attackPattern: structuredClone(previousCorrection.attackPattern ?? previous.attackPattern ?? []),
        attackPatternVerified: previousCorrection.attackPatternVerified ?? previous.attackPatternVerified ?? false,
        attackFacing: previousCorrection.attackFacing ?? previous.attackFacing ?? 0,
      });
    });
    $("#resetCurrent").addEventListener("click", () => {
      delete corrections[key()];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(corrections));
      render();
      toast("当前卡已恢复内置数据");
    });
  }
  function toast(message) {
    const element = $("#editorToast");
    element.textContent = message;
    element.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { element.hidden = true; }, 1800);
  }
  function downloadJson(value, name) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
  $("#exportCorrections").addEventListener("click", () => downloadJson({
    format: "KF_ENCOUNTER_CARD_CORRECTIONS",
    version: 1,
    exportedAt: new Date().toISOString(),
    cards: corrections,
  }, "kf-encounter-card-corrections.json"));
  $("#importCorrections").addEventListener("click", () => $("#correctionFile").click());
  $("#correctionFile").addEventListener("change", async event => {
    try {
      const payload = JSON.parse(await event.target.files[0].text());
      if (payload.format !== "KF_ENCOUNTER_CARD_CORRECTIONS" || payload.version !== 1 || !payload.cards) throw new Error("格式不正确");
      corrections = payload.cards;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(corrections));
      render();
      toast("修正文件已导入");
    } catch (error) {
      toast(`导入失败：${error.message}`);
    } finally {
      event.target.value = "";
    }
  });
  $("#resetAll").addEventListener("click", () => {
    if (!confirm("确定清空全部卡牌数量和攻击范围修正吗？")) return;
    corrections = {};
    localStorage.removeItem(STORAGE_KEY);
    render();
    toast("全部修正已清空");
  });
  render();
})();
