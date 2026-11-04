'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const cards = JSON.parse(fs.readFileSync(path.join(root, 'public/keyword-data/card-keywords.json'), 'utf8')).cards;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'card-ocr-manifest.json'), 'utf8'));
const dictionary = JSON.parse(fs.readFileSync(path.join(root, 'public/keyword-data/keywords.json'), 'utf8'));
const ids = new Set(dictionary.entries.map(entry => entry.id));
for (const item of manifest) {
  assert.ok(Object.hasOwn(cards, item.id), `missing scan ${item.id}`);
  assert.ok(item.path.startsWith('/assets/'), `invalid image path ${item.path}`);
  for (const id of cards[item.id]) assert.ok(ids.has(id), `unknown keyword ${id}`);
}
assert.equal(Object.keys(cards).length, manifest.length);
const context = vm.createContext({ window: {}, document: { currentScript: { src: 'http://localhost/modules/card-keywords.js' } }, URL,
  fetch: async () => ({ ok: true, json: async () => ({ cards }) }) });
vm.runInContext(fs.readFileSync(path.join(root, 'public/modules/card-keywords.js'), 'utf8'), context);
(async () => {
  await context.window.KFCardKeywords.ready;
  const traits = Array.from(context.window.KFCardKeywords.traits('M_KnightFen'));
  assert.ok(traits.includes('M_KnightFen:Trait_SK:40'));
  assert.ok(traits.includes('M_KnightFen:Trait_POS:41'));
  assert.ok(Array.from(context.window.KFCardKeywords.words(['M_BogWitch:AI1:18'])).includes('Poison'));
  const bad = vm.createContext({ window: {}, document: { currentScript: { src: 'http://localhost/modules/card-keywords.js' } }, URL,
    fetch: async () => ({ ok: true, json: async () => ({ cards: [] }) }) });
  vm.runInContext(fs.readFileSync(path.join(root, 'public/modules/card-keywords.js'), 'utf8'), bad);
  assert.equal(await bad.window.KFCardKeywords.ready, null, 'invalid card data signals a load failure');
  console.log('card keyword coverage and lookup passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
