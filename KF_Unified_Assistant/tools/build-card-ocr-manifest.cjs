'use strict';
// Use the same localized data as the battle screen, including mob encounters.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const ctx = vm.createContext({ window: {} });
for (const file of ['monster-data.js', 'localized-traits.js', 'localized-sheets.js', 'postgame-config.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'public/modules/aibp/data', file), 'utf8'), ctx, { filename: file });
}
const manifest = [];
for (const monster of ctx.window.KF_MONSTER_DATA.monsters) {
  manifest.push({ id: monster.id, path: monster.sheet.face });
  manifest.push({ id: `${monster.id}:sheet-back`, path: monster.sheet.back, mergeInto: monster.id });
  for (const card of monster.cards.filter(card => /^(AI|BP|Trait|SIG)/.test(card.kind))) {
    manifest.push({ id: card.id, path: card.image.face });
    // Special/X BP cards carry gameplay rules on both faces.
    if (/^BP[SX]$/.test(card.kind) && card.image.back) {
      manifest.push({ id: `${card.id}:card-back`, path: card.image.back, mergeInto: card.id });
    }
  }
  for (const row of ctx.window.KF_POSTGAME_RULES.DATA[monster.id] || []) {
    manifest.push({ id: row.trait.id, path: row.trait.image.face, monsterId: monster.id });
  }
}
fs.writeFileSync(path.join(__dirname, 'card-ocr-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`${ctx.window.KF_MONSTER_DATA.monsters.length} monsters, ${manifest.length} card faces`);
