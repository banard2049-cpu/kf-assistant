(() => {
  "use strict";

  const normalize = value => String(value ?? "").normalize("NFKC").toLowerCase().trim();
  const compareText = (a, b) => a < b ? -1 : a > b ? 1 : 0;

  function selectCards(data, { category = "all", tiers = [], query = "" } = {}) {
    const selectedTiers = new Set(tiers);
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    const categories = new Map(data.categories.map(item => [item.id, item]));
    const ranks = new Map(data.tiers.map((item, index) => [item.id, index]));
    const tierNames = new Map(data.tiers.map(item => [item.id, `${item.name} ${item.nameEn || item.id}`]));
    return data.cards.filter(card => {
      if (category !== "all" && !card.categoryIds.includes(category)) return false;
      if (selectedTiers.size && !selectedTiers.has(card.tier)) return false;
      if (!terms.length) return true;
      const haystack = normalize([
        card.name, card.originalName, card.nameEn, card.nameZh, card.description, card.id, card.cardId,
        tierNames.get(card.tier), ...card.categoryIds.map(id => {
          const item = categories.get(id);
          return `${id} ${item?.name || ""} ${item?.nameEn || ""}`;
        }),
      ].join(" "));
      return terms.every(term => haystack.includes(term));
    }).sort((a, b) => (ranks.get(a.tier) ?? ranks.size) - (ranks.get(b.tier) ?? ranks.size)
      || (a.order ?? 999) - (b.order ?? 999)
      || compareText(a.name, b.name) || compareText(a.id, b.id));
  }

  function groupCards(data, cards) {
    const tiers = data.tiers.some(tier => tier.id === "Other") ? data.tiers
      : [...data.tiers, { id: "Other", name: "其他装备", nameEn: "Other" }];
    return tiers
      .map(tier => ({ ...tier, cards: cards.filter(card => card.tier === tier.id) }))
      .filter(group => group.cards.length);
  }

  function stackCards(cards) {
    const stacks = new Map();
    for (const card of cards) {
      const name = normalize(card.name).replace(/\s+/g, " ") || card.id;
      const key = JSON.stringify([name, card.tier, [...new Set(card.categoryIds || [])].sort()]);
      if (!stacks.has(key)) stacks.set(key, { id: card.id, card, cards: [], count: 0 });
      const stack = stacks.get(key);
      stack.cards.push(card);
      stack.count += Number.isInteger(card.copies) && card.copies > 0 ? card.copies : 1;
    }
    return [...stacks.values()];
  }

  function cardCrop(image, back = false) {
    const atlas = !back || image.backIsAtlas;
    const columns = atlas ? image.columns : 1;
    const rows = atlas ? image.rows : 1;
    const index = atlas ? (back ? image.backIndex ?? image.index : image.index) : 0;
    return {
      url: back ? image.back : image.face,
      columns, rows, index,
      size: `${columns * 100}% ${rows * 100}%`,
      position: `${columns > 1 ? (index % columns) / (columns - 1) * 100 : 0}% ${rows > 1 ? Math.floor(index / columns) / (rows - 1) * 100 : 0}%`,
    };
  }

  const api = { selectCards, groupCards, stackCards, cardCrop };
  if (typeof window !== "undefined") window.KFEquipmentCatalog = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
