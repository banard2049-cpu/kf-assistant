/* Card matches come from OCR of the English card faces and need verification. */
(function () {
  'use strict';
  const url = new URL('../keyword-data/card-keywords.json?v=6', document.currentScript.src);
  let cards = null;
  const ready = fetch(url).then(response => {
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  }).then(data => {
    if (!data || !data.cards || typeof data.cards !== 'object' || Array.isArray(data.cards)) throw new Error('Invalid card keyword data');
    cards = data.cards;
    return cards;
  }).catch(() => null);
  function words(ids) {
    return [...new Set(ids.flatMap(id => cards?.[id] || []))];
  }
  function traits(monsterId) {
    return Object.keys(cards || {}).filter(id => id.startsWith(monsterId + ':Trait'));
  }
  window.KFCardKeywords = { ready, words, traits };
}());
