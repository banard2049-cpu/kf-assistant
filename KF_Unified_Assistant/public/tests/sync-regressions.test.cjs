const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const plain = value => JSON.parse(JSON.stringify(value));

function harness() {
  const requests = [], storage = new Map(), saves = [], timers = [];
  const context = vm.createContext({
    user: { id: 'user-A' }, active: 'sheet-A', state: { knightId: 'stoneface', gold: 1 }, revision: 0,
    activeCampaign: 'campaign-A', campaignState: { kingdom: 'sunken' }, campaignRevision: 0,
    pending: [], campaignPending: [], syncing: false, campaignSyncing: false,
    navigator: { onLine: true }, sheets: [{ id: 'sheet-A' }, { id: 'sheet-B' }],
    api: (route, options) => new Promise((resolve, reject) => requests.push({ route, body: options?.body ? JSON.parse(options.body) : undefined, resolve, reject })),
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    persistPending() {}, persistCampaignPending() {}, setSave: (...args) => saves.push(args), renderValues() {}, toast() {},
    renderAll() {}, closeSidebar() {}, renderLists() {}, showOverview() {}, viewMode: 'edit',
    hydrateGameSettings() {}, renderCurrentModule() {}, setTimeout: callback => timers.push(callback), structuredClone,
  });
  vm.runInContext(section('const pathSet=', 'const op=') + section('const cacheSheet=', 'function campaignOp(') + section('async function syncCampaign(){', 'function hydrateGameSettings(') + section('let sheetOpenRequest=0;', 'function showEmpty(') + section('async function refreshLists(){', 'function renderLists('), context);
  return { context, requests, storage, saves, timers };
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
    cacheSheet() {}, renderAll: title => rendered.push(title), closeSidebar() {}, sync() {}, toast() {}, setSave() {}, structuredClone,
  });
  vm.runInContext(section('const pathSet=', 'const op=') + section('const sheetSnapshots=', 'async function sync(){') + section('let sheetOpenRequest=0;', 'function showEmpty('), c);
  const a = c.openSheet('sheet-A'), b = c.openSheet('sheet-B');
  replies[1]({ sheet: { title: 'B', state: { gold: 2 }, revision: 2 } }); await b;
  replies[0]({ sheet: { title: 'A', state: { gold: 1 }, revision: 1 } }); await a;
  assert.equal(c.active, 'sheet-B');
  assert.equal(c.state.gold, 2);
  assert.deepEqual(rendered, ['B']);
});

for (const campaign of [false, true]) {
  test(`a deleted ${campaign ? 'campaign' : 'sheet'} is retained without blocking other saves or retrying forever`, async () => {
    const { context: c, requests, saves, timers } = harness();
    const key = campaign ? 'campaignId' : 'sheetId', queue = campaign ? c.campaignPending : c.pending;
    const sync = campaign ? c.syncCampaign : c.sync;
    queue.push({ id: 'missing-edit', userId: 'user-A', [key]: 'deleted', path: 'gold', value: 7 });
    queue.push({ id: 'valid-edit', userId: 'user-A', [key]: 'available', path: 'gold', value: 8 });
    const first = sync();
    queue.push({ id: 'later-missing-edit', userId: 'user-A', [key]: 'deleted', path: 'gold', value: 9 });
    requests[0].reject(Object.assign(new Error('not found'), { status: 404 })); await first;
    assert.equal(queue.length, 3, 'unavailable edits stay in the durable queue');
    assert.equal(queue[0].syncBlocked, 404); assert.equal(queue[2].syncBlocked, 404);
    const second = sync();
    assert.equal(requests[1].body[key], 'available');
    requests[1].resolve({ state: { gold: 8 }, revision: 1 }); await second;
    assert.deepEqual(queue.map(item => item.id), ['missing-edit', 'later-missing-edit']);
    assert.equal(timers.length, 1, 'only the remaining valid record schedules a follow-up');
    await sync(); assert.equal(requests.length, 2);
    assert.match(saves.at(-1)[0], /保留本机/); assert.equal(saves.at(-1)[1], true);
    assert.ok(JSON.parse(JSON.stringify(queue)).every(item => item.syncBlocked === 404), 'blocked status survives persistence');
  });
}

test('a restored sheet resumes its preserved edits when it returns to the active list', async () => {
  const { context: c, requests } = harness();
  c.pending.push({ id: 'restored-edit', userId: 'user-A', sheetId: 'sheet-A', path: 'gold', value: 7, syncBlocked: 404 });
  const refreshing = c.refreshLists();
  requests[0].resolve({ sheets: [{ id: 'sheet-A' }] }); requests[1].resolve({ sheets: [] }); await refreshing;
  assert.equal(c.pending[0].syncBlocked, undefined);
  assert.equal(requests[2].body.sheetId, 'sheet-A');
  requests[2].resolve({ state: { gold: 7 }, revision: 1 });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(c.pending.length, 0); assert.equal(c.state.gold, 7);
});

test('restoring a campaign only resumes the current account and available records', () => {
  const { context: c } = harness();
  c.campaignPending.push(
    { userId: 'user-A', campaignId: 'restored', syncBlocked: 404 },
    { userId: 'user-A', campaignId: 'deleted', syncBlocked: 404 },
    { userId: 'user-B', campaignId: 'restored', syncBlocked: 404 },
  );
  assert.equal(c.resumeAvailableOperations(c.campaignPending, 'campaignId', [{ id: 'restored' }]), true);
  assert.deepEqual(plain(c.campaignPending).map(item => item.syncBlocked ?? null), [null, 404, 404]);
});

test('temporary server failures remain retryable', async () => {
  const { context: c, requests, timers } = harness();
  c.pending.push({ id: 'edit-A', sheetId: 'sheet-A', path: 'gold', value: 7 });
  const saving = c.sync(); requests[0].reject(Object.assign(new Error('busy'), { status: 500 })); await saving;
  assert.equal(c.pending[0].syncBlocked, undefined); assert.equal(timers.length, 1);
});

test('an unavailable sheet does not prevent another sheet from refreshing remote edits', () => {
  const opened = [];let poll;
  const c = vm.createContext({
    user: { id: 'user-A' }, active: 'sheet-B', viewMode: 'edit', syncing: false,
    pending: [{ userId: 'user-A', sheetId: 'deleted-sheet', syncBlocked: 404 }],
    navigator: { onLine: true }, openSheet: id => opened.push(id), refreshLists() {},
    setInterval: callback => { poll = callback; },
  });
  vm.runInContext(section('const operationOwnedBy=', 'const operationReady=') + section('setInterval(()=>{if(!user)return;', 'initOffline().finally('), c);
  poll(); assert.deepEqual(opened, ['sheet-B']);
  c.pending.push({ userId: 'user-A', sheetId: 'sheet-B', syncBlocked: 404 });
  poll(); assert.deepEqual(opened, ['sheet-B'], 'an unsaved active sheet still keeps its working copy');
});

for (const inactive of [false, true]) {
  test(`an old GET cannot overwrite a save acknowledged while the sheet is ${inactive ? 'inactive' : 'active'}`, async () => {
    const { context: c, requests, storage } = harness();
    const reading = c.openSheet('sheet-A');
    c.pending.push({ id: 'edit-A', userId: 'user-A', sheetId: 'sheet-A', path: 'gold', value: 7 });
    if (inactive) { c.active = 'sheet-B'; c.state = { gold: 99 }; c.revision = 4; }
    const saving = c.sync(); requests[1].resolve({ state: { gold: 7 }, revision: 2 }); await saving;
    requests[0].resolve({ sheet: { title: 'A', state: { gold: 1 }, revision: 1 } }); await reading;
    assert.equal(c.state.gold, 7); assert.equal(c.revision, 2);
    assert.equal(c.pending.length, 0);
    assert.deepEqual(JSON.parse(storage.get('kf-sheet-sheet-A')), { state: { gold: 7 }, revision: 2 });
  });
}

test('a newer acknowledged snapshot still receives edits queued after its acknowledgement', async () => {
  const { context: c, requests } = harness();
  const reading = c.openSheet('sheet-A');
  c.pending.push({ id: 'edit-A', userId: 'user-A', sheetId: 'sheet-A', path: 'gold', value: 7 });
  const saving = c.sync(); requests[1].resolve({ state: { gold: 7 }, revision: 2 }); await saving;
  c.pending.push({ id: 'edit-A-new', userId: 'user-A', sheetId: 'sheet-A', path: 'gold', value: 8 });
  requests[0].resolve({ sheet: { title: 'A', state: { gold: 1 }, revision: 1 } }); await reading;
  assert.equal(c.state.gold, 8); assert.equal(c.revision, 2);
  requests[2].resolve({ state: { gold: 8 }, revision: 3 });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(c.state.gold, 8); assert.equal(c.revision, 3);
});
