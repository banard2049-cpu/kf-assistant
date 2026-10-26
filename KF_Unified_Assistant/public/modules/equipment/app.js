(() => {
  "use strict";

  const data = window.KF_EQUIPMENT_DATA;
  const catalog = window.KFEquipmentCatalog;
  const $ = selector => document.querySelector(selector);
  if (!data || !catalog) {
    $("#emptyState").hidden = false;
    $("#emptyState").textContent = "装备目录载入失败，请刷新页面重试。";
    return;
  }

  const categoryById = new Map(data.categories.map(item => [item.id, item]));
  const tierById = new Map(data.tiers.map(item => [item.id, item]));
  const cardById = new Map([...data.cards, ...(data.tierCards || [])].map(item => [item.id, item]));
  const imageCache = new Map();
  let filters = { category: "all", tiers: [], query: "" };
  let visibleCards = [];
  let visibleStacks = [];
  let previewCards = [];
  let selectedCardId = "";
  let showingBack = false;
  let opener = null;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function imageInfo(url) {
    if (!imageCache.has(url)) imageCache.set(url, new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve(null);
      image.src = url;
    }));
    return imageCache.get(url);
  }

  function paintCard(node, card, back = false) {
    const crop = catalog.cardCrop(card.image, back);
    node.dataset.image = `${card.id}:${back}`;
    node.style.backgroundImage = "none";
    node.style.backgroundSize = crop.size;
    node.style.backgroundPosition = crop.position;
    const cellWidth = back ? card.image.backCellWidth : card.image.cellWidth;
    const cellHeight = back ? card.image.backCellHeight : card.image.cellHeight;
    const aspect = cellWidth && cellHeight ? cellWidth / cellHeight : 5 / 7;
    node.style.aspectRatio = String(aspect);
    node.style.setProperty("--card-aspect", String(aspect));
    node.dataset.missing = "loading";
    node.replaceChildren(element("span", "image-notice", "载入卡面…"));
    if (!crop.url) {
      node.dataset.missing = "true";
      node.firstChild.textContent = "暂无此面卡图";
      return;
    }
    const token = node.dataset.image;
    imageInfo(crop.url).then(info => {
      if (node.dataset.image !== token) return;
      if (!info) {
        node.dataset.missing = "true";
        node.firstChild.textContent = "缺少卡面资源，请补齐 assets/equipment 图片包";
        return;
      }
      node.dataset.missing = "false";
      node.style.backgroundImage = `url(${JSON.stringify(crop.url)})`;
      const loadedAspect = (info.width / crop.columns) / (info.height / crop.rows);
      node.style.aspectRatio = String(loadedAspect);
      node.style.setProperty("--card-aspect", String(loadedAspect));
      node.firstChild.textContent = "";
    });
  }

  function readUrl() {
    const params = new URLSearchParams(location.search);
    const category = params.get("category") || "all";
    filters = {
      category: categoryById.has(category) ? category : "all",
      tiers: [...new Set((params.get("tiers") || "").split(","))].filter(id => tierById.has(id)),
      query: (params.get("q") || "").slice(0, 160),
    };
    $("#equipmentSearch").value = filters.query;
  }

  function writeUrl() {
    const url = new URL(location.href);
    for (const [key, value] of [["category", filters.category === "all" ? "" : filters.category], ["tiers", filters.tiers.join(",")], ["q", filters.query]]) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    history.replaceState(null, "", url);
  }

  function renderCategories() {
    const root = $("#categoryList");
    root.replaceChildren();
    function categoryButton(id, name, count) {
      const button = element("button", `category-button${filters.category === id ? " active" : ""}`);
      button.type = "button";
      button.dataset.category = id;
      button.setAttribute("aria-pressed", String(filters.category === id));
      button.append(element("span", "", name), element("span", "count", count));
      return button;
    }
    root.append(categoryButton("all", "全部装备", catalog.stackCards(data.cards).length));
    const groups = new Map();
    const names = { kingdom: "王国装备", sunken: "沉没王国 · 怪物装备", stone: "石之公国 · 怪物装备", other: "其他怪物装备", special: "特殊用途" };
    for (const category of data.categories) {
      const key = category.group || "other";
      if (!groups.has(key)) {
        const section = element("section", "category-group");
        section.append(element("h3", "", names[key] || key));
        groups.set(key, section);
        root.append(section);
      }
      groups.get(key).append(categoryButton(category.id, category.name,
        catalog.stackCards(data.cards.filter(card => card.categoryIds.includes(category.id))).length));
    }
  }

  function renderTiers() {
    const root = $("#tierFilters");
    root.replaceChildren();
    for (const tier of data.tiers) {
      const button = element("button", "tier-filter", tier.name);
      button.type = "button";
      button.dataset.tier = tier.id;
      button.title = tier.nameEn || tier.id;
      button.setAttribute("aria-pressed", String(filters.tiers.includes(tier.id)));
      root.append(button);
    }
  }

  function render() {
    visibleCards = catalog.selectCards(data, filters);
    visibleStacks = catalog.stackCards(visibleCards);
    $("#currentCategory").textContent = categoryById.get(filters.category)?.name || "全部装备";
    $("#resultCount").textContent = `${visibleStacks.length} 种 · ${visibleStacks.reduce((sum, stack) => sum + stack.count, 0)} 张`;
    $("#emptyState").hidden = visibleCards.length > 0;
    for (const button of document.querySelectorAll("[data-category]")) {
      const active = button.dataset.category === filters.category;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    for (const button of document.querySelectorAll("[data-tier]")) {
      button.setAttribute("aria-pressed", String(filters.tiers.includes(button.dataset.tier)));
    }
    const root = $("#equipmentGrid");
    root.replaceChildren();
    for (const group of catalog.groupCards(data, visibleCards)) {
      const stacks = catalog.stackCards(group.cards);
      const section = element("section", "equipment-section");
      const heading = element("div", "section-heading");
      heading.append(element("h3", "", group.name), element("span", "", `${group.nameEn || group.id} · ${stacks.length} 种 · ${stacks.reduce((sum, stack) => sum + stack.count, 0)} 张`));
      const tierCard = data.tierCards?.find(card => card.tier === group.id);
      if (tierCard) {
        const explanation = element("button", "tier-explanation", "阶级说明");
        explanation.type = "button";
        explanation.dataset.tierCard = tierCard.id;
        explanation.setAttribute("aria-label", `查看${group.name}装备阶级说明`);
        heading.append(explanation);
      }
      const grid = element("div", "card-grid");
      for (const stack of stacks) {
        const card = stack.card;
        const button = element("button", `equipment-card${stack.count > 1 ? " has-copies" : ""}`);
        button.type = "button";
        button.dataset.cardId = card.id;
        button.dataset.copyCount = String(stack.count);
        button.setAttribute("aria-label", `预览 ${card.name}`);
        const pile = element("div", "card-stack");
        for (let index = 0; index < Math.min(stack.count - 1, 2); index++) {
          const layer = element("div", "card-art stack-layer");
          layer.setAttribute("aria-hidden", "true");
          layer.style.setProperty("--layer", String(index + 1));
          paintCard(layer, card);
          pile.append(layer);
        }
        const art = element("div", "card-art stack-face");
        paintCard(art, card);
        pile.append(art);
        const caption = element("div", "card-caption");
        caption.append(element("strong", "", card.name));
        button.append(pile, caption);
        grid.append(button);
      }
      section.append(heading, grid);
      root.append(section);
    }
    writeUrl();
  }

  function renderPreview() {
    const card = cardById.get(selectedCardId);
    if (!card) return;
    const index = previewCards.findIndex(item => item.id === card.id);
    $("#dialogTitle").textContent = card.categoryIds ? card.name : `${tierById.get(card.tier)?.name || card.tier}装备 · 阶级说明`;
    $("#dialogMeta").textContent = [tierById.get(card.tier)?.name || "其他装备",
      ...(card.categoryIds || []).map(id => categoryById.get(id)?.name).filter(Boolean)].join(" · ");
    $("#previewPosition").textContent = `${index + 1} / ${previewCards.length} · ${showingBack ? "背面" : "正面"}`;
    $("#flipCard").textContent = showingBack ? "查看正面" : "查看背面";
    $("#flipCard").disabled = !card.image.back || card.image.face === card.image.back;
    $("#flipCard").setAttribute("aria-pressed", String(showingBack));
    $("#prevCard").disabled = index <= 0;
    $("#nextCard").disabled = index >= previewCards.length - 1;
    paintCard($("#previewCard"), card, showingBack);
    $("#previewCard").setAttribute("aria-label", `${card.name} · ${showingBack ? "背面" : "正面"}`);
  }

  function openPreview(id, trigger, tierCard = false) {
    previewCards = tierCard ? data.tiers.map(tier => data.tierCards?.find(card => card.tier === tier.id)).filter(Boolean) : visibleStacks.flatMap(stack => stack.cards);
    selectedCardId = id;
    showingBack = false;
    opener = trigger;
    renderPreview();
    $("#cardDialog").showModal();
    document.body.classList.add("preview-open");
  }

  function navigatePreview(step) {
    const index = previewCards.findIndex(card => card.id === selectedCardId) + step;
    if (index < 0 || index >= previewCards.length) return;
    selectedCardId = previewCards[index].id;
    showingBack = false;
    renderPreview();
  }

  $("#categoryList").addEventListener("click", event => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    filters.category = button.dataset.category;
    render();
  });
  $("#tierFilters").addEventListener("click", event => {
    const button = event.target.closest("[data-tier]");
    if (!button) return;
    const tier = button.dataset.tier;
    filters.tiers = filters.tiers.includes(tier) ? filters.tiers.filter(id => id !== tier) : [...filters.tiers, tier];
    render();
  });
  $("#equipmentSearch").addEventListener("input", event => {
    filters.query = event.target.value;
    render();
  });
  $("#clearSearch")?.addEventListener("click", () => {
    filters.query = "";
    $("#equipmentSearch").value = "";
    $("#equipmentSearch").focus();
    render();
  });
  $("#resetFilters").addEventListener("click", () => {
    filters = { category: "all", tiers: [], query: "" };
    $("#equipmentSearch").value = "";
    render();
  });
  $("#equipmentGrid").addEventListener("click", event => {
    const explanation = event.target.closest("[data-tier-card]");
    if (explanation) { openPreview(explanation.dataset.tierCard, explanation, true); return; }
    const button = event.target.closest("[data-card-id]");
    if (button) openPreview(button.dataset.cardId, button);
  });
  $("#closePreview").addEventListener("click", () => $("#cardDialog").close());
  $("#prevCard").addEventListener("click", () => navigatePreview(-1));
  $("#nextCard").addEventListener("click", () => navigatePreview(1));
  $("#flipCard").addEventListener("click", () => { showingBack = !showingBack; renderPreview(); });
  $("#cardDialog").addEventListener("click", event => {
    if (event.target !== $("#cardDialog")) return;
    const rect = event.target.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.target.close();
  });
  $("#cardDialog").addEventListener("close", () => {
    document.body.classList.remove("preview-open");
    opener?.focus();
  });
  $("#cardDialog").addEventListener("keydown", event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowLeft") { event.preventDefault(); navigatePreview(-1); }
    else if (event.key === "ArrowRight") { event.preventDefault(); navigatePreview(1); }
    else if (event.key.toLowerCase() === "f" && !$("#flipCard").disabled) {
      event.preventDefault(); showingBack = !showingBack; renderPreview();
    }
  });
  window.addEventListener("popstate", () => { readUrl(); render(); });
  readUrl();
  renderCategories();
  renderTiers();
  render();
})();
