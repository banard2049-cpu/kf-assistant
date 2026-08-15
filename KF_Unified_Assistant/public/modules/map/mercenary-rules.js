(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KF_MERCENARY_RULES = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const ROGUES = Object.freeze([
    {
      id: "rogue-1",
      catalogId: "mercenary:26609",
      role: "rogue",
      name: "盗贼",
      en: "ROGUE",
      level: 1,
      value: 3,
      faces: {
        A: {
          image: "assets/mercenaries/rogue-1-a.jpg",
          conflict: "查看 BP 卡组顶端卡牌。你可将其放置到底端。如果和杂兵怪物冲突，改为选择并查看杂兵轨上的任意一张 BP。",
          delve: "在你抽取一张探索卡后，忽略它，并再抽取一张。",
          action: "redraw"
        },
        B: {
          image: "assets/mercenaries/rogue-1-b.jpg",
          conflict: "一名骑士立即 Hide 隐藏，即使它在怪物的前方。只要该骑士仍处于此次隐藏，下一次它将要成为攻击目标时，可跳过那一行目标选择指示。",
          delve: "忽略一场遭遇战，将对应的遭遇战怪物指示物放置到当前王国板块，并立即走回头路到上一个王国板块。",
          action: "skip-and-backtrack"
        }
      }
    },
    {
      id: "rogue-2",
      catalogId: "mercenary:26610",
      role: "rogue",
      name: "盗贼",
      en: "ROGUE",
      level: 2,
      value: 5,
      faces: {
        A: {
          image: "assets/mercenaries/rogue-2-a.jpg",
          conflict: "当你造成损伤失败时，不要弃置攻击的 BP，改为将其放回 BP 卡组顶端。如果和杂兵怪物冲突，改为在结算完 Fail 响应后，将攻击的 BP 翻至面朝下。",
          delve: "当你即将抽取一张探索卡时，改为抽取 2 张。选择一张结算，弃置其余的。",
          action: "choose-two"
        },
        B: {
          image: "assets/mercenaries/rogue-2-b.jpg",
          conflict: "一名骑士立即 Hide 隐藏，即使它在怪物的前方。只要该骑士仍处于此次隐藏，它不能成为攻击的目标。",
          delve: "忽略一场遭遇战或伏击，将对应的遭遇战怪物指示物放置到当前王国板块，并立即走回头路到上一个王国板块。",
          action: "skip-and-backtrack"
        }
      }
    },
    {
      id: "rogue-3",
      catalogId: "mercenary:26611",
      role: "rogue",
      name: "盗贼",
      en: "ROGUE",
      level: 3,
      value: 9,
      faces: {
        A: {
          image: "assets/mercenaries/rogue-3-a.jpg",
          conflict: "在确定 BP 卡步骤中，选择一种 BP 等级，将 BP 弃牌堆洗回卡组，随机找出一张你选择等级的 BP，然后重新混洗 BP 卡组。如果和杂兵怪物冲突，改为将杂兵轨上的所有 BP 翻至面朝下。",
          delve: "当你即将抽取一张探索卡时，改为抽取 3 张。选择一张结算，弃置另一张，将其余卡牌放回卡组顶端。",
          action: "choose-three"
        },
        B: {
          image: "assets/mercenaries/rogue-3-b.jpg",
          conflict: "当一名骑士即将成为一次攻击的目标时，立即 Hide 隐藏，即使它在怪物的前方，并选择另一名处于攻击范围内的骑士，改为该骑士成为攻击的目标。",
          delve: "忽略一场遭遇战或伏击。",
          action: "skip"
        }
      }
    }
  ]);

  const MAGES = Object.freeze([
    {
      id: "mage-1",
      catalogId: "mercenary:26606",
      role: "mage",
      name: "法师",
      en: "MAGE",
      level: 1,
      value: 3,
      faces: {
        A: {
          image: "assets/mercenaries/mage-1-a.jpg",
          conflict: "将一名骑士放置到距离其当前位置至多 2 格远的空格子上。",
          delve: "将队伍指示物放置到一块相邻的已探索王国板块上。",
          action: "place-adjacent"
        },
        B: {
          image: "assets/mercenaries/mage-1-b.jpg",
          conflict: "将一名骑士放置到距离其当前位置至多 2 格远的空格子上。",
          delve: "将队伍指示物放置到一块相邻的已探索王国板块上。",
          action: "place-adjacent"
        }
      }
    },
    {
      id: "mage-2",
      catalogId: "mercenary:26607",
      role: "mage",
      name: "法师",
      en: "MAGE",
      level: 2,
      value: 5,
      faces: {
        A: {
          image: "assets/mercenaries/mage-2-a.jpg",
          conflict: "两名在冲突版图上的骑士交换它们的位置。",
          delve: "将队伍指示物放置到当前地区的任意已探索王国板块上。",
          action: "place-district"
        },
        B: {
          image: "assets/mercenaries/mage-2-b.jpg",
          conflict: "两名在冲突版图上的骑士交换它们的位置。",
          delve: "将队伍指示物放置到当前地区的任意已探索王国板块上。",
          action: "place-district"
        }
      }
    },
    {
      id: "mage-3",
      catalogId: "mercenary:26608",
      role: "mage",
      name: "法师",
      en: "MAGE",
      level: 3,
      value: 9,
      faces: {
        A: {
          image: "assets/mercenaries/mage-3-a.jpg",
          conflict: "将一名骑士放置到冲突版图上的任意空格子上。",
          delve: "将队伍指示物放置到有兴趣点的任意已探索王国板块上。",
          action: "place-poi"
        },
        B: {
          image: "assets/mercenaries/mage-3-b.jpg",
          conflict: "将一名骑士放置到离冲突版图中心最近的空格子上。",
          delve: "将队伍指示物放置到有兴趣点的任意已探索王国板块上。",
          action: "place-poi"
        }
      }
    }
  ]);

  const CARDS = Object.freeze([...ROGUES, ...MAGES]);
  const CATALOG = Object.freeze(Object.fromEntries(CARDS.map(card => [card.id, card])));
  const CATALOG_BY_CANONICAL_ID = Object.freeze(Object.fromEntries(CARDS.map(card => [card.catalogId, card])));

  function createState() {
    return { usage: {}, pendingAction: null, updatedAt: 0 };
  }

  function touchState(state) {
    if (!state || typeof state !== "object") return 0;
    const previous = Math.max(0, Math.trunc(Number(state.updatedAt) || 0));
    state.updatedAt = Math.max(Date.now(), previous + 1);
    return state.updatedAt;
  }

  function definitionFor(cardId) {
    return CATALOG[String(cardId || "")] || CATALOG_BY_CANONICAL_ID[String(cardId || "")] || null;
  }

  function canonicalCatalogId(cardId) {
    return definitionFor(cardId)?.catalogId || String(cardId || "");
  }

  function normalizeState(value, hiredIds = []) {
    const source = value && typeof value === "object" ? value : {};
    const allowed = new Set((Array.isArray(hiredIds) ? hiredIds : []).map(item => String(item || "")).filter(Boolean));
    const usage = {};
    const sourceUsage = source.usage && typeof source.usage === "object" && !Array.isArray(source.usage) ? source.usage : {};
    for (const [rawCatalogId, rawState] of Object.entries(sourceUsage)) {
      const catalogId = canonicalCatalogId(rawCatalogId);
      if (!allowed.has(catalogId)) continue;
      usage[catalogId] = {
        face: rawState?.face === "B" ? "B" : "A",
        status: rawState?.status === "discarded" ? "discarded" : "active"
      };
    }

    // Migrate the old map-owned roster only when the same physical card is
    // already hired at the Outpost. Orphaned local entries are deliberately ignored.
    for (const item of Array.isArray(source.active) ? source.active : []) {
      const catalogId = canonicalCatalogId(item?.cardId);
      if (!allowed.has(catalogId) || usage[catalogId]) continue;
      usage[catalogId] = { face: item?.face === "B" ? "B" : "A", status: "active" };
    }
    for (const item of Array.isArray(source.discard) ? source.discard : []) {
      const catalogId = canonicalCatalogId(item);
      if (!allowed.has(catalogId)) continue;
      usage[catalogId] = { face: usage[catalogId]?.face || "B", status: "discarded" };
    }

    const pending = source.pendingAction;
    const pendingDefinition = definitionFor(pending?.cardId);
    const pendingUsage = pendingDefinition ? usage[pendingDefinition.catalogId] : null;
    const expected = pendingDefinition
      && allowed.has(pendingDefinition.catalogId)
      && (pendingUsage?.status || "active") === "active"
      && (pendingUsage?.face || "A") === "A"
      ? drawCount(pendingDefinition.id) : 0;
    const pendingAction = pending
      && pending.kind === "exploration-choice"
      && expected > 1
      && Array.isArray(pending.drawn)
      && pending.drawn.length === expected
      && pending.drawn.every(Boolean)
      ? { kind: "exploration-choice", cardId: pendingDefinition.id, drawn: [...pending.drawn] }
      : null;
    return {
      usage,
      pendingAction,
      updatedAt: Math.max(0, Math.trunc(Number(source.updatedAt) || 0))
    };
  }

  function projectHired(assignments, state) {
    const source = Array.isArray(assignments) ? assignments : [];
    const normalized = normalizeState(state, source.map(item => item?.catalogId));
    return source.filter(item => item?.catalogId).map(item => {
      const lifecycle = normalized.usage[item.catalogId] || {};
      return {
        ...item,
        face: lifecycle.face === "B" ? "B" : "A",
        status: lifecycle.status === "discarded" ? "discarded" : "active"
      };
    });
  }

  function canUseCatalogId(catalogId, hiredIds) {
    return Array.isArray(hiredIds) && hiredIds.map(String).includes(catalogId);
  }

  function flipMercenary(state, cardId, hiredIds) {
    const catalogId = canonicalCatalogId(cardId);
    if (!state || typeof state !== "object" || !canUseCatalogId(catalogId, hiredIds)) return false;
    if (!state.usage || typeof state.usage !== "object" || Array.isArray(state.usage)) state.usage = {};
    const current = state.usage[catalogId] || { face: "A", status: "active" };
    state.usage[catalogId] = {
      face: current.face === "B" ? "A" : "B",
      status: current.status === "discarded" ? "discarded" : "active"
    };
    touchState(state);
    return true;
  }

  function discardMercenary(state, cardId, hiredIds) {
    const catalogId = canonicalCatalogId(cardId);
    if (!state || typeof state !== "object" || !canUseCatalogId(catalogId, hiredIds)) return false;
    if (!state.usage || typeof state.usage !== "object" || Array.isArray(state.usage)) state.usage = {};
    const current = state.usage[catalogId] || { face: "A", status: "active" };
    state.usage[catalogId] = {
      face: current.face === "B" ? "B" : "A",
      status: current.status === "discarded" ? "active" : "discarded"
    };
    state.pendingAction = null;
    touchState(state);
    return true;
  }

  function advance(state, cardId) {
    const definition = definitionFor(cardId);
    if (!state || !definition) return null;
    if (!state.usage || typeof state.usage !== "object" || Array.isArray(state.usage)) state.usage = {};
    const item = state.usage[definition.catalogId] || { face: "A", status: "active" };
    if (item.status === "discarded") return null;
    if (item.face === "A") {
      state.usage[definition.catalogId] = { face: "B", status: "active" };
      state.pendingAction = null;
      touchState(state);
      return { cardId: definition.id, catalogId: definition.catalogId, from: "A", to: "B" };
    }
    state.usage[definition.catalogId] = { face: "B", status: "discarded" };
    state.pendingAction = null;
    touchState(state);
    return { cardId: definition.id, catalogId: definition.catalogId, from: "B", to: "discard" };
  }

  function drawCount(cardId) {
    const id = definitionFor(cardId)?.id || String(cardId || "");
    if (id === "rogue-2") return 2;
    if (id === "rogue-3") return 3;
    return 1;
  }

  function beginExplorationChoice(cardId, deck) {
    const definition = definitionFor(cardId);
    if (!definition) return null;
    const count = drawCount(cardId);
    if (count < 2 || !Array.isArray(deck) || deck.length < count) return null;
    return {
      kind: "exploration-choice",
      cardId: definition.id,
      drawn: deck.slice(0, count)
    };
  }

  function commitExplorationChoice(action, deck, resolvedCardId, discardedCardId) {
    if (!action || action.kind !== "exploration-choice" || !Array.isArray(deck)) return null;
    const count = drawCount(action.cardId);
    const drawn = action.drawn || [];
    if (count < 2 || drawn.length !== count) return null;
    if (drawn.some((cardId, index) => deck[index] !== cardId)) return null;
    if (!drawn.includes(resolvedCardId)) return null;

    if (count === 2) {
      const discarded = drawn.find(cardId => cardId !== resolvedCardId);
      return {
        current: resolvedCardId,
        deck: deck.slice(2),
        discarded: [discarded]
      };
    }

    if (!drawn.includes(discardedCardId) || discardedCardId === resolvedCardId) return null;
    const returned = drawn.find(cardId => cardId !== resolvedCardId && cardId !== discardedCardId);
    return {
      current: resolvedCardId,
      deck: [returned, ...deck.slice(3)],
      discarded: [discardedCardId],
      returned: [returned]
    };
  }

  function redrawExploration(currentCardId, deck) {
    if (!currentCardId || !Array.isArray(deck) || !deck.length) return null;
    return {
      current: deck[0],
      deck: deck.slice(1),
      discarded: [currentCardId]
    };
  }

  function mageTargetIds(cardId, context = {}) {
    const definition = definitionFor(cardId);
    if (definition?.role !== "mage") return [];
    const currentTileId = String(context.currentTileId || "");
    const adjacent = new Set(Array.isArray(context.adjacentTileIds) ? context.adjacentTileIds : []);
    const pointOfInterest = new Set(Array.isArray(context.pointOfInterestTileIds) ? context.pointOfInterestTileIds : []);
    const districts = context.tileDistricts && typeof context.tileDistricts === "object"
      ? context.tileDistricts
      : {};
    return (Array.isArray(context.exploredTileIds) ? context.exploredTileIds : [])
      .filter(tileId => tileId && tileId !== currentTileId)
      .filter(tileId => {
        if (definition.level === 1) return adjacent.has(tileId);
        if (definition.level === 2) return Boolean(context.currentDistrict) && districts[tileId] === context.currentDistrict;
        return pointOfInterest.has(tileId);
      });
  }

  function encounterSkip(cardId, currentTileId, travelRoute) {
    const action = definitionFor(cardId)?.faces.B.action;
    if (action === "skip") {
      return {
        action,
        targetTileId: currentTileId,
        suppress: true
      };
    }
    if (action !== "skip-and-backtrack") return null;
    const route = Array.isArray(travelRoute) ? travelRoute : [];
    const previousTileId = route.length >= 2 && route.at(-1) === currentTileId ? route.at(-2) : "";
    if (!previousTileId) return null;
    return {
      action,
      targetTileId: previousTileId,
      suppress: false
    };
  }

  return {
    ROGUES,
    MAGES,
    CARDS,
    CATALOG,
    CATALOG_BY_CANONICAL_ID,
    createState,
    touchState,
    normalizeState,
    definitionFor,
    canonicalCatalogId,
    projectHired,
    flipMercenary,
    discardMercenary,
    advance,
    drawCount,
    beginExplorationChoice,
    commitExplorationChoice,
    redrawExploration,
    mageTargetIds,
    encounterSkip
  };
});
