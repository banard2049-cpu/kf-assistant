/* Keyword index for the currently selected encounter card and side. */
(function () {
  'use strict';
  const url = new URL('../../keyword-data/encounter-keywords.json?v=2', document.currentScript.src);
  let cards = null;
  const ready = fetch(url).then(response => {
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  }).then(data => {
    if (!data || !data.cards || typeof data.cards !== 'object' || Array.isArray(data.cards)) throw new Error('Invalid encounter keyword data');
    cards = data.cards;
    return cards;
  }).catch(() => null);
  function get(monsterId, level) {
    const key = `${monsterId}:${level}`;
    return cards && Object.prototype.hasOwnProperty.call(cards, key) && Array.isArray(cards[key]) ? cards[key] : null;
  }
  window.KFEncounterKeywords = { ready, get };
}());
