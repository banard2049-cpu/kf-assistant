'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const load = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const reviewed = load('tools/card-keyword-sheet-overrides.json').cards;
const dictionary = new Set(load('public/keyword-data/keywords.json').entries.map(entry => entry.id));
const indexed = load('public/keyword-data/card-keywords.json').cards;
const ctx = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(root, 'public/modules/aibp/data/monster-data.js'), 'utf8'), ctx);
const bosses = ctx.window.KF_MONSTER_DATA.monsters.filter(monster => monster.type === 'boss');
assert.deepEqual(Object.keys(reviewed).sort(), Array.from(bosses, boss => boss.id).sort(), 'all and only bosses must be reviewed');
let checkedImages = 0;
for (const boss of bosses) {
  const record = reviewed[boss.id];
  assert.ok(record.note && Array.isArray(record.keywords), `review evidence missing: ${boss.id}`);
  assert.equal(new Set(record.keywords).size, record.keywords.length, `duplicate keyword: ${boss.id}`);
  for (const id of record.keywords) assert.ok(dictionary.has(id), `unknown keyword ${id}`);
  assert.deepEqual([...(indexed[boss.id] || [])].sort(), [...record.keywords].sort(), `index differs from review: ${boss.id}`);
  for (const side of ['face', 'back']) {
    const image = record.images[side];
    assert.equal(image.path, boss.sheet[side], `source changed: ${boss.id} ${side}`);
    assert.match(image.sha256, /^[a-f0-9]{64}$/);
    const file = path.join(root, 'public', image.path);
    if (fs.existsSync(file)) {
      const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      assert.equal(hash, image.sha256, `image changed: ${boss.id} ${side}`);
      checkedImages++;
    }
  }
}
console.log(`review coverage: ${bosses.length} bosses; ${checkedImages} locally available images checked`);
