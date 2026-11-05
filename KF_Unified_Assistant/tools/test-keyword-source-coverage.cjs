'use strict';
// Verify scan inputs against source game data, independent of the generated index.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const ctx = vm.createContext({ window: {} });
for (const file of ['monster-data.js', 'localized-traits.js', 'localized-sheets.js', 'postgame-config.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'public/modules/aibp/data', file), 'utf8'), ctx, { filename: file });
}
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'tools/card-ocr-manifest.json'), 'utf8'));
const byId = new Map(manifest.map(item => [item.id, item]));
assert.equal(byId.size, manifest.length, 'duplicate scan ID');
let bossCount = 0, cards = 0, traits = 0;
for (const boss of ctx.window.KF_MONSTER_DATA.monsters) {
  bossCount++;
  assert.equal(byId.get(boss.id)?.path, boss.sheet.face, `${boss.id}: front`);
  assert.equal(byId.get(`${boss.id}:sheet-back`)?.path, boss.sheet.back, `${boss.id}: back`);
  assert.equal(byId.get(`${boss.id}:sheet-back`)?.mergeInto, boss.id, `${boss.id}: back merge`);
  for (const card of boss.cards.filter(card => /^(AI|BP|Trait|SIG)/.test(card.kind))) {
    cards++;
    assert.equal(byId.get(card.id)?.path, card.image.face, `${card.id}: card image`);
    if (/^BP[SX]$/.test(card.kind) && card.image.back) {
      assert.equal(byId.get(`${card.id}:card-back`)?.path, card.image.back, `${card.id}: reverse`);
      assert.equal(byId.get(`${card.id}:card-back`)?.mergeInto, card.id, `${card.id}: reverse merge`);
    }
  }
  for (const row of ctx.window.KF_POSTGAME_RULES.DATA[boss.id] || []) {
    traits++;
    assert.equal(byId.get(row.trait.id)?.path, row.trait.image.face, `${row.trait.id}: postgame trait`);
    assert.equal(byId.get(row.trait.id)?.monsterId, boss.id, `${row.trait.id}: owner`);
  }
}
assert.ok(bossCount && cards && traits, 'source datasets must not be empty');
console.log(`source coverage: ${bossCount} monster fronts/backs, ${cards} cards and ${traits} postgame traits`);
