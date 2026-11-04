'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const script = fs.readFileSync(path.join(__dirname, '../modules/encounter/encounter-keywords.js'), 'utf8');
async function load(response) {
  let requested;
  const context = { window: {}, URL,
    document: { currentScript: { src: 'http://localhost/modules/encounter/encounter-keywords.js?v=1' } },
    fetch: async url => { requested = String(url); return response; } };
  vm.runInNewContext(script, context);
  await context.window.KFEncounterKeywords.ready;
  return { api: context.window.KFEncounterKeywords, requested };
}
(async () => {
  const { api, requested } = await load({ ok: true, json: async () => ({ cards: {
    'M_BogWitch:1': ['Poison'], 'M_BogWitch:2': ['Knockdown'], 'Special_F4:1': []
  } }) });
  assert.equal(new URL(requested).pathname, '/keyword-data/encounter-keywords.json');
  assert.deepEqual(Array.from(api.get('M_BogWitch', 1)), ['Poison']);
  assert.deepEqual(Array.from(api.get('M_BogWitch', 2)), ['Knockdown']);
  assert.deepEqual(Array.from(api.get('Special_F4', 1)), []);
  assert.equal(api.get('Special_F4', 2), null, 'unscanned differs from a scanned empty card');
  const broken = await load({ ok: false, status: 404 });
  assert.equal(await broken.api.ready, null);
  // Exercise the actual render integration, including a delayed fetch while the
  // player changes from one card face to another.
  const app = fs.readFileSync(path.join(__dirname, '../modules/encounter/app.js'), 'utf8');
  const start = app.indexOf('    if (window.KFEncounterKeywords && window.KFKeywords) {');
  const end = app.indexOf('    $("#app").innerHTML', start);
  assert.ok(start >= 0 && end > start, 'encounter keyword rendering exists');
  let resolveReady, displayed, title;
  const ctx = { state: { monsterId: 'M_BogWitch', level: 1 },
    currentMonster: () => ({ special: ctx.state.monsterId.startsWith('Special_') }),
    currentLevel: () => ({ side: ctx.state.level === 2 ? 'back' : 'face' }),
    window: { KFKeywords: { setContext: x => { title = x; }, setCardDataError() {}, setPersistent: x => { displayed = x; } },
      KFEncounterKeywords: { ready: new Promise(resolve => { resolveReady = resolve; }),
        get: (id, level) => api.get(id, level) } } };
  const renderKeywords = vm.runInNewContext(`(function () {${app.slice(start, end)}\n})`, ctx);
  renderKeywords();
  ctx.state.level = 2; renderKeywords();
  resolveReady({}); await Promise.resolve();
  assert.equal(title, '当前遭遇卡关键词');
  assert.equal(displayed[0].label, '等级 2 · 背面');
  assert.deepEqual(Array.from(displayed[0].keywords), ['Knockdown'], 'stale card must not overwrite current face');
  ctx.state.monsterId = 'Special_F4'; ctx.state.level = 1; renderKeywords(); await Promise.resolve();
  assert.equal(displayed[0].label, '特殊遭遇卡');
  assert.match(displayed[0].message, /未识别到/);
  console.log('encounter card keyword lookup: level, special, empty and failure verified');
})().catch(error => { console.error(error); process.exitCode = 1; });
