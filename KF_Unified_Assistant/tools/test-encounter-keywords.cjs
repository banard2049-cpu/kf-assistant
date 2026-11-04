'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const context = vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(path.join(root, 'public/modules/encounter/data/encounter-data.js'), 'utf8'), context);
const expected = context.window.KF_ENCOUNTER_DATA.monsters.flatMap(monster => monster.encounterLevels.map(level => ({
  id:`${monster.id}:${level.level}`, cardId:level.cardId, side:level.side,
  path:(level.image[level.side] || level.image.face).split('?')[0]
})));
const manifest = read('tools/encounter-keyword-manifest.json');
assert.equal(expected.length, 100);
assert.deepEqual(JSON.parse(JSON.stringify(expected)), manifest, 'all levels must use their actual displayed face');
const dictionary = new Set(read('public/keyword-data/keywords.json').entries.map(entry=>entry.id));
const index = read('public/keyword-data/encounter-keywords.json');
const keys = new Set(expected.map(item=>item.id));
const hashes = read('tools/encounter-keyword-review-hashes.json');
assert.deepEqual(new Set(Object.keys(index.cards)), keys);
assert.deepEqual(new Set(index.reviewed), keys, 'every face must be manually checked');
assert.deepEqual(new Set(Object.keys(hashes)), keys, 'every reviewed face must have a source hash');
const reviewed = new Set();
for (const file of fs.readdirSync(path.join(root, 'tools')).filter(name => /^encounter-keyword-reviews-.*\.json$/.test(name))) {
  for (const [id, words] of Object.entries(read(`tools/${file}`).cards)) {
    assert.ok(!reviewed.has(id), `duplicate review: ${id}`);
    reviewed.add(id);
    assert.deepEqual(index.cards[id], words, `stale review: ${id}`);
  }
}
assert.deepEqual(reviewed, keys, 'every face must have review source data');
for (const item of expected) {
  const file = path.join(root, 'public', item.path.replace(/^\/+/, ''));
  if (fs.existsSync(file)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), hashes[item.id], `card image changed: ${item.id}`);
}
for (const [id, words] of Object.entries(index.cards)) {
  assert.ok(Array.isArray(words), id);
  assert.equal(words.length, new Set(words).size, id);
  for (const word of words) assert.ok(dictionary.has(word), `${id}: ${word}`);
}
assert.ok(index.cards['M_BogWitch:1'].includes('OverpowerX+'));
assert.ok(index.cards['M_KnightFen:1'].includes('Refresh'));
console.log(`encounter keywords: ${keys.size} level-specific faces verified`);
