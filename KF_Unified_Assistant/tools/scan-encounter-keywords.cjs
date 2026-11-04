'use strict';
// Export the exact card face selected for each encounter level.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(path.join(root, 'public/modules/encounter/data/encounter-data.js'), 'utf8'), context);
const records = context.window.KF_ENCOUNTER_DATA.monsters.flatMap(monster => monster.encounterLevels.map(level => ({
  id: `${monster.id}:${level.level}`, cardId: level.cardId, side: level.side,
  path: (level.image[level.side] || level.image.face).split('?')[0]
})));
fs.writeFileSync(path.join(root, 'tools/encounter-keyword-manifest.json'), JSON.stringify(records,null,2)+'\n');
console.log(`Encounter faces: ${records.length}`);
