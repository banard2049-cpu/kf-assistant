(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KF_FOG_RULES = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function cardValue(item) {
    const value = Number(item && item.fogValue);
    return Number.isFinite(value) ? value : 0;
  }

  function makeEntry(cardId, item, corrected = false) {
    return {
      cardId,
      value: cardValue(item),
      corrected,
      hazard: item && item.hazard === true
    };
  }

  const VECTORS = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 }
  ];

  function heading(value) {
    const normalized = Math.trunc(Number(value) || 0) % VECTORS.length;
    return normalized < 0 ? normalized + VECTORS.length : normalized;
  }

  function hasPosition(entry) {
    return Number.isFinite(Number(entry && entry.x)) && Number.isFinite(Number(entry && entry.y));
  }

  function placement(fog, corrected = false, pivotIndex = 0, turn = "left") {
    const route = fog.route || [];
    const safeIndex = Math.min(
      Math.max(0, Math.trunc(Number(pivotIndex) || 0)),
      Math.max(0, route.length - 1)
    );
    const base = corrected ? route[safeIndex] : route[route.length - 1];
    if (!base || !hasPosition(base)) return null;
    const currentHeading = heading(fog.heading);
    const nextHeading = corrected
      ? heading(currentHeading + (turn === "right" ? 1 : -1))
      : currentHeading;
    const vector = VECTORS[nextHeading];
    return {
      x: Number(base.x) + vector.x,
      y: Number(base.y) + vector.y,
      heading: nextHeading,
      pivotIndex: safeIndex
    };
  }

  function positionOccupied(fog, target) {
    if (!target) return true;
    return (fog.used || []).some(item =>
      hasPosition(item) && Number(item.x) === target.x && Number(item.y) === target.y
    );
  }

  function canPlace(fog, corrected = false, pivotIndex = 0, turn = "left") {
    const target = placement(fog, corrected, pivotIndex, turn);
    return Boolean(target && !positionOccupied(fog, target));
  }

  function normalizeLayout(fog) {
    fog.heading = heading(fog.heading);
    const route = fog.route || [];
    const used = fog.used || [];
    const usedById = new Map(used.map(item => [item.cardId, item]));

    for (const routeEntry of route) {
      const usedEntry = usedById.get(routeEntry.cardId);
      if (!hasPosition(routeEntry) && hasPosition(usedEntry)) {
        routeEntry.x = Number(usedEntry.x);
        routeEntry.y = Number(usedEntry.y);
      }
    }

    if (route.some(item => !hasPosition(item))) {
      fog.heading = 0;
      route.forEach((item, index) => {
        item.x = index;
        item.y = 0;
      });
    }

    const occupied = new Set();
    for (const routeEntry of route) {
      occupied.add(`${routeEntry.x},${routeEntry.y}`);
      const usedEntry = usedById.get(routeEntry.cardId);
      if (usedEntry) {
        usedEntry.x = routeEntry.x;
        usedEntry.y = routeEntry.y;
      }
    }

    let parkedX = 0;
    const parkedY = route.length ? Math.max(...route.map(item => Number(item.y))) + 2 : 2;
    for (const item of used) {
      if (route.some(routeEntry => routeEntry.cardId === item.cardId)) continue;
      if (hasPosition(item) && !occupied.has(`${item.x},${item.y}`)) {
        occupied.add(`${item.x},${item.y}`);
        continue;
      }
      while (occupied.has(`${parkedX},${parkedY}`)) parkedX += 1;
      item.x = parkedX;
      item.y = parkedY;
      occupied.add(`${item.x},${item.y}`);
      parkedX += 1;
    }

    return fog;
  }

  function updateTotal(fog) {
    const pathValue = (fog.route || []).reduce((sum, item) => sum + (Number(item.value) || 0), 0);
    fog.baneFull = Math.max(0, Math.trunc(Number(fog.baneFull) || 0));
    fog.total = pathValue + fog.baneFull;
    return fog.total;
  }

  function outcome(fog) {
    if ((fog.route || []).length !== Number(fog.intensity)) return "";
    const total = updateTotal(fog);
    return total === 4 ? "perfect" : total < 4 ? "minor" : "grave";
  }

  function lowestEntries(fog) {
    if (!fog.route || !fog.route.length) return [];
    const lowest = Math.min(...fog.route.map(item => Number(item.value) || 0));
    return fog.route.filter(item => (Number(item.value) || 0) === lowest);
  }

  function start(fog, entry) {
    entry.x = 0;
    entry.y = 0;
    fog.used = [entry];
    fog.route = [entry];
    fog.current = null;
    fog.started = true;
    fog.hazardPending = false;
    fog.heading = 0;
    updateTotal(fog);
  }

  function place(fog, entry, corrected, pivotIndex = 0, turn = "left") {
    const target = placement(fog, corrected, pivotIndex, turn);
    if (!target || positionOccupied(fog, target)) return false;
    entry.x = target.x;
    entry.y = target.y;
    fog.used.push(entry);
    if (corrected) {
      const pivot = fog.route[target.pivotIndex];
      fog.route = pivot ? [pivot, entry] : [entry];
      fog.correctedEver = true;
    } else {
      fog.route.push(entry);
    }
    fog.heading = target.heading;
    updateTotal(fog);
    fog.hazardPending = fog.correctedEver === true && entry.hazard === true;
    return true;
  }

  function returnUsed(fog, discardedEntry, shuffle) {
    const returned = fog.used
      .filter(item => item.cardId !== discardedEntry?.cardId)
      .map(item => item.cardId);
    fog.deck = shuffle([...fog.deck, ...returned]);
  }

  function discardTop(fog) {
    if (!fog.deck.length) return null;
    const discarded = fog.deck.shift();
    fog.discard.push(discarded);
    return discarded;
  }

  function reshuffleDeck(fog, shuffle) {
    if (!fog.discard.length && fog.deck.length < 2) return 0;
    fog.deck = shuffle([...fog.deck, ...fog.discard]);
    fog.discard = [];
    return fog.deck.length;
  }

  function peekCards(deck, count, source = "top") {
    if (!Array.isArray(deck)) return [];
    const safeCount = Math.min(deck.length, Math.max(0, Math.trunc(Number(count) || 0)));
    return source === "bottom"
      ? deck.slice(deck.length - safeCount).reverse()
      : deck.slice(0, safeCount);
  }

  function resolvePeek(deck, peeked, destinations, shuffle, source = "top") {
    if (!Array.isArray(deck) || !Array.isArray(peeked) || !peeked.length) return null;
    const expected = peekCards(deck, peeked.length, source);
    if (peeked.some((cardId, index) => expected[index] !== cardId)) return null;
    const topCards = peeked.filter((_, index) => !["bottom", "shuffle"].includes(destinations?.[index]));
    const bottomCards = peeked.filter((_, index) => destinations?.[index] === "bottom");
    const shuffledCards = peeked.filter((_, index) => destinations?.[index] === "shuffle");
    const remaining = source === "bottom"
      ? deck.slice(0, deck.length - peeked.length)
      : deck.slice(peeked.length);
    const middleCards = [...remaining, ...shuffledCards];
    const shuffledMiddle = shuffledCards.length && typeof shuffle === "function"
      ? shuffle(middleCards)
      : middleCards;
    const orderedBottomCards = source === "bottom" ? [...bottomCards].reverse() : bottomCards;
    return {
      deck: [...topCards, ...shuffledMiddle, ...orderedBottomCards],
      topCards,
      bottomCards,
      shuffledCards
    };
  }

  return {
    cardValue,
    makeEntry,
    updateTotal,
    outcome,
    lowestEntries,
    start,
    place,
    placement,
    canPlace,
    normalizeLayout,
    returnUsed,
    discardTop,
    reshuffleDeck,
    peekCards,
    resolvePeek
  };
});
