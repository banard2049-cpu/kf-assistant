'use strict';
// The Docker data volume is mounted at /app/data, so static keyword files
// must be served outside /data in both the standalone and container builds.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const cases = [
  ['public/modules/keywords.js', 'http://localhost/modules/keywords.js', 'keywords.json'],
  ['public/modules/card-keywords.js', 'http://localhost/modules/card-keywords.js', 'card-keywords.json'],
  ['public/modules/encounter/encounter-keywords.js', 'http://localhost/modules/encounter/encounter-keywords.js', 'encounter-keywords.json']
];
for (const [file, scriptUrl, name] of cases) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const relative = source.match(/new URL\(['"]([^'"]+\.json(?:\?[^'"]*)?)['"],\s*document\.currentScript\.src\)/)?.[1];
  assert.ok(relative, `${file}: data URL missing`);
  const url = new URL(relative, scriptUrl);
  assert.ok(!url.pathname.startsWith('/data/'), `${name}: hidden by the container data volume`);
  const physical = path.join(root, 'public', url.pathname.replace(/^\/+/, ''));
  assert.ok(fs.existsSync(physical), `${name}: static asset missing`);
  assert.doesNotThrow(() => JSON.parse(fs.readFileSync(physical, 'utf8')));
}
console.log('keyword static assets resolve outside the container data volume');
