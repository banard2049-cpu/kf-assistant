const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const plain = value => JSON.parse(JSON.stringify(value));

function harness() {
  const requests = [], storage = new Map();
  const context = vm.createContext({
    user: { id: 'user-A' }, active: 'sheet-A', state: { knightId: 'stoneface', gold: 1 }, revision: 0,
    activeCampaign: 'campaign-A', campaignState: { kingdom: 'sunken' }, campaignRevision: 0,
    pending: [], campaignPending: [], syncing: false, campaignSyncing: false,
    navigator: { onLine: true }, sheets: [{ id: 'sheet-A' }, { id: 'sheet-B' }],
    api: (route, options) => new Promise((resolve, reject) => requests.push({ route, body: JSON.parse(options.body), resolve, reject })),
    localStorage: { setItem: (key, value) => storage.set(key, value) },
    persistPending() {}, persistCampaignPending() {}, setSave() {}, renderValues() {}, toast() {},
    hydrateGameSettings() {}, renderCurrentModule() {}, setTimeout() {}, structuredClone,
  });
  vm.runInContext(section('const pathSet=', 'const op=') + section('async function sync(){', 'function campaignOp(') + section('async function syncCampaign(){', 'function hydrateGameSettings('), context);
  return { context, requests, storage };
}

test('a delayed sheet response updates only its original sheet and cache', async () => {
  const { context: c, requests, storage } = harness();
  c.pending.push({ id: 'edit-A', sheetId: 'sheet-A', path: 'gold', value: 7 });
  const saving = c.sync();
  assert.equal(c.pending.length, 1, 'in-flight operations remain durable until acknowledged');
  c.active = 'sheet-B'; c.state = { knightId: 'kara', gold: 99 }; c.revision = 4;
  requests[0].resolve({ state: { knightId: 'stoneface', gold: 7 }, revision: 1 });
  await saving;
  assert.deepEqual(plain(c.state), { knightId: 'kara', gold: 99 });
  assert.equal(c.revision, 4);
  assert.equal(storage.has('kf-sheet-sheet-B'), false);
  assert.equal(JSON.parse(storage.get('kf-sheet-sheet-A')).state.gold, 7);
  assert.equal(c.pending.length, 0);
});

test('queued edits to an inactive sheet still upload and newer edits survive the response', async () => {
  const { context: c, requests } = harness();
  c.active = 'sheet-B';
  c.pending.push({ id: 'edit-A', sheetId: 'sheet-A', path: 'gold', value: 7 });
  const saving = c.sync();
  assert.equal(requests[0].body.sheetId, 'sheet-A');
  c.pending.push({ id: 'edit-A-new', sheetId: 'sheet-A', path: 'gold', value: 8 });
  requests[0].resolve({ state: { gold: 7 }, revision: 1 });
  await saving;
  assert.deepEqual(plain(c.pending).map(op => op.id), ['edit-A-new']);
  assert.equal(c.sheets[0].state.gold, 8);
});

test('a failed request retains one copy of each queued edit', async () => {
  const { context: c, requests } = harness();
  c.pending.push({ id: 'edit-A', sheetId: 'sheet-A', path: 'gold', value: 7 });
  const saving = c.sync(); requests[0].reject(new Error('offline')); await saving;
  assert.equal(c.pending.length, 1);
});

test('a delayed campaign response cannot replace the newly selected campaign', async () => {
  const { context: c, requests } = harness();
  c.campaignPending.push({ id: 'edit-campaign-A', campaignId: 'campaign-A', path: 'kingdom', value: 'stone' });
  const saving = c.syncCampaign();
  c.activeCampaign = 'campaign-B'; c.campaignState = { kingdom: 'sunken' }; c.campaignRevision = 7;
  requests[0].resolve({ state: { kingdom: 'stone' }, revision: 1 }); await saving;
  assert.equal(c.campaignState.kingdom, 'sunken');
  assert.equal(c.campaignRevision, 7);
  assert.equal(c.campaignPending.length, 0);
});

test('another account cannot upload or receive the previous account edits', async () => {
  const { context: c, requests } = harness();
  c.pending.push({ id: 'edit-A', userId: 'user-B', sheetId: 'sheet-A', path: 'gold', value: 7 });
  await c.sync(); assert.equal(requests.length, 0);
});

test('out-of-order sheet fetches cannot reopen a previously selected sheet', async () => {
  const replies = [], rendered = [], storage = new Map();
  const c = vm.createContext({
    user: { id: 'user-A' }, active: null, state: null, revision: 0, viewMode: 'overview', pending: [],
    api: () => new Promise(resolve => replies.push(resolve)),
    localStorage: { getItem: key => storage.get(key) ?? null },
    cacheSheet() {}, renderAll: title => rendered.push(title), closeSidebar() {}, sync() {}, toast() {}, setSave() {},
  });
  vm.runInContext(section('const pathSet=', 'const op=') + section('let sheetOpenRequest=0;', 'function showEmpty('), c);
  const a = c.openSheet('sheet-A'), b = c.openSheet('sheet-B');
  replies[1]({ sheet: { title: 'B', state: { gold: 2 }, revision: 2 } }); await b;
  replies[0]({ sheet: { title: 'A', state: { gold: 1 }, revision: 1 } }); await a;
  assert.equal(c.active, 'sheet-B');
  assert.equal(c.state.gold, 2);
  assert.deepEqual(rendered, ['B']);
});
