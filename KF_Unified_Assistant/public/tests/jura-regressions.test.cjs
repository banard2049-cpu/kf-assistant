const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let jura;
test.before(async () => {
  const source = fs.readFileSync(path.join(__dirname, '../jura.js'), 'utf8');
  jura = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
});

const catalog = {
  startingQuest: 'fragments-of-the-past',
  startingFacility: 'saints-sanctuary',
  startingFacilityUsesSlot: false,
  quests: [
    { id: 'fragments-of-the-past', name: '往昔碎片' },
    { id: 'middle-quest', name: '中层委托' },
  ],
  cards: [
    { id: 'saints-sanctuary', kind: 'facility', name: '圣徒圣所', level: 1 },
    ...[1, 2, 3, 4].flatMap(level => Array.from({ length: 2 }, (_, i) => ({ id: `facility-${level}-${i}`, kind: 'facility', name: `${level} 级设施 ${i}`, level }))),
    ...[1, 2, 3, 4].flatMap(level => Array.from({ length: 2 }, (_, i) => ({ id: `chant-${level}-${i}`, kind: 'chant', name: `${level} 级圣言 ${i}`, level }))),
  ],
};
catalog.cards.find(card => card.id === 'chant-1-0').rules = '测试效果简述';
catalog.cards.find(card => card.id === 'chant-1-0').image = '/test-chant.jpg';
const allIds = () => catalog.cards.map(card => card.id);
const fresh = overrides => jura.normalizeJura({ ...overrides }, catalog);
const action = (state, type, values = {}) => jura.applyJuraAction(state, { type, ...values }, catalog);
const restored = state => JSON.parse(JSON.stringify(state));

test('old campaign data becomes a separate disabled, empty ledger without mutating the source', () => {
  for (const input of [undefined, null, {}, { notes: '原有记录' }]) {
    const snapshot = JSON.stringify(input);
    const state = jura.normalizeJura(input, catalog);
    assert.equal(state.enabled, false);
    assert.equal(state.level, 0);
    assert.equal(state.shards, 0);
    assert.deepEqual(state.built, []);
    assert.deepEqual(state.quests, {});
    assert.equal(JSON.stringify(input), snapshot);
  }
});

test('normalizing and editing two campaign snapshots does not share mutable state', () => {
  const source = fresh({ customCards: [{ id: 'jura-test-card', name: '测试', kind: 'chant', level: 1 }] });
  const first = jura.normalizeJura(source, catalog);
  const second = jura.normalizeJura(restored(source), catalog);
  first.built.push('chant-1-0');
  first.quests['fragments-of-the-past'] = 'completed';
  first.customCards[0].name = '已修改';
  assert.deepEqual(source.built, []);
  assert.deepEqual(source.quests, {});
  assert.equal(source.customCards[0].name, '测试');
  assert.deepEqual(second.built, []);
  assert.deepEqual(second.quests, {});
});

test('current tier is recorded directly; the free sanctuary is only added once a tier is chosen', () => {
  let state = action(fresh(), 'enable', { value: true });
  assert.equal(state.level, 0);
  assert.deepEqual(state.built, []);
  assert.throws(() => action(state, 'set-level', { level: 5 }));
  assert.throws(() => action(state, 'set-level', { level: -1 }));
  state = action(state, 'set-level', { level: 1 });
  assert.equal(state.level, 1);
  assert.deepEqual(state.built, [catalog.startingFacility]);
  assert.equal(state.shards, 0);
  state = action(state, 'set-level', { level: 4 });
  assert.equal(state.level, 4);
  assert.deepEqual(state.built, [catalog.startingFacility]);
  state = action(state, 'set-level', { level: 0 });
  assert.equal(state.level, 0);
  assert.throws(() => action(action(state, 'set-level', { level: 1 }), 'build', { id: 'chant-1-0' }), /化圣碎片不足/);
});

test('cumulative facility and chant slots match all four tiers', () => {
  assert.deepEqual([1, 2, 3, 4].map(level => jura.juraSlots(level, 'facility').length), [3, 5, 6, 7]);
  assert.deepEqual([1, 2, 3, 4].map(level => jura.juraSlots(level, 'chant').length), [1, 2, 3, 4]);
  assert.deepEqual(jura.juraSlots(0, 'facility'), []);
});

test('loadout slot fitting rejects mixed types and cards above available tiers', () => {
  assert.equal(jura.fitsJuraSlots(['facility-2-0', 'facility-1-0'], 2, catalog, 'facility'), true);
  assert.equal(jura.fitsJuraSlots(['facility-2-0', 'facility-2-1', 'facility-1-0'], 2, catalog, 'facility'), true);
  assert.equal(jura.fitsJuraSlots(['facility-3-0'], 2, catalog, 'facility'), false);
  assert.equal(jura.fitsJuraSlots(['facility-1-0', 'chant-1-0'], 2, catalog), false);
  assert.equal(jura.fitsJuraSlots(['chant-2-0', 'chant-1-0'], 2, catalog, 'chant'), true);
  assert.equal(jura.fitsJuraSlots(['chant-2-0', 'chant-2-1'], 2, catalog, 'chant'), false);
});

test('building charges the printed shard and gold price for every tier', () => {
  const prices = [[1, 3, 5], [2, 5, 10], [3, 7, 15], [4, 10, 20]];
  for (const [level, shards, gold] of prices) {
    const before = fresh({ enabled: true, level: 4, shards: 99 });
    const snapshot = JSON.stringify(before);
    const after = action(before, 'build', { id: `chant-${level}-0`, payerGold: 100 });
    assert.equal(after.shards, before.shards - shards);
    assert.ok(after.built.includes(`chant-${level}-0`));
    assert.equal(JSON.stringify(before), snapshot);
  }
});

test('locked tiers, duplicate builds, insufficient shards and an underfunded sheet reject atomically', () => {
  const locked = fresh({ enabled: true, level: 1, shards: 99 });
  assert.throws(() => action(locked, 'build', { id: 'chant-2-0', payerGold: 99 }));
  assert.throws(() => action(locked, 'build', { id: 'missing-card', payerGold: 99 }));
  assert.throws(() => action(locked, 'build', { id: catalog.startingFacility, payerGold: 99 }));
  const poor = fresh({ enabled: true, level: 1, shards: 2 });
  const poorSnapshot = JSON.stringify(poor);
  assert.throws(() => action(poor, 'build', { id: 'chant-1-0', payerGold: 99 }));
  assert.equal(JSON.stringify(poor), poorSnapshot);
  const noGold = fresh({ enabled: true, level: 1, shards: 3 });
  assert.throws(() => action(noGold, 'build', { id: 'chant-1-0', payerGold: 4 }));
  assert.equal(noGold.built.includes('chant-1-0'), false);
  const built = action(fresh({ enabled: true, level: 1, shards: 6 }), 'build', { id: 'chant-1-0', payerGold: 5 });
  assert.throws(() => action(built, 'build', { id: 'chant-1-0', payerGold: 5 }));
});

test('loadout selection respects tier slots, saves by name and loads back as images', () => {
  let state = fresh({ enabled: true, level: 2, built: allIds() });
  state = action(state, 'loadout-toggle', { kind: 'facility', id: 'facility-2-0', selected: true });
  state = action(state, 'loadout-toggle', { kind: 'facility', id: 'facility-1-0', selected: true });
  state = action(state, 'loadout-toggle', { kind: 'chant', id: 'chant-2-0', selected: true });
  assert.deepEqual(state.loadoutFacilities, ['facility-2-0', 'facility-1-0']);
  assert.deepEqual(state.loadoutChants, ['chant-2-0']);
  const crowded = action(state, 'loadout-toggle', { kind: 'chant', id: 'chant-1-0', selected: true });
  assert.throws(() => action(crowded, 'loadout-toggle', { kind: 'chant', id: 'chant-1-1', selected: true }), /槽位不足/);
  state = action(state, 'loadout-save', { name: '远征 A' });
  assert.equal(state.loadouts.length, 1);
  assert.equal(state.loadouts[0].name, '远征 A');
  state = action(state, 'loadout-toggle', { kind: 'facility', id: 'facility-2-0', selected: false });
  assert.equal(state.loadoutFacilities.includes('facility-2-0'), false);
  state = action(state, 'loadout-load', { name: '远征 A' });
  assert.deepEqual(state.loadoutFacilities, ['facility-2-0', 'facility-1-0']);
  assert.deepEqual(state.loadoutChants, ['chant-2-0']);
  state = action(state, 'loadout-delete', { name: '远征 A' });
  assert.deepEqual(state.loadouts, []);
  assert.throws(() => action(state, 'loadout-load', { name: '远征 A' }));
});

test('loadouts validate their saved cards against the current tier and built list', () => {
  let state = fresh({ enabled: true, level: 2, built: allIds() });
  state = action(state, 'loadout-toggle', { kind: 'facility', id: 'facility-2-0', selected: true });
  state = action(state, 'loadout-save', { name: '高层设施' });
  let lower = action(state, 'set-level', { level: 1 });
  assert.equal(lower.loadoutFacilities.includes('facility-2-0'), false, 'lowering the tier trims the draft');
  assert.throws(() => action(lower, 'loadout-load', { name: '高层设施' }), /尚未建造或当前层数无法使用/);
  const unbuilt = fresh({ enabled: true, level: 2, built: ['saints-sanctuary'] });
  assert.throws(() => action(unbuilt, 'loadout-save', { name: '' }), /请填写配装名称/);
});

test('commissions only keep a name and a completed flag and can be unchecked', () => {
  let state = fresh({ enabled: true, level: 1 });
  state = action(state, 'quest', { id: 'fragments-of-the-past', completed: true });
  assert.deepEqual(state.quests, { 'fragments-of-the-past': 'completed' });
  state = action(state, 'quest', { id: 'middle-quest', completed: false });
  assert.deepEqual(state.quests, { 'fragments-of-the-past': 'completed' });
  state = action(state, 'quest', { id: 'fragments-of-the-past', completed: false });
  assert.deepEqual(state.quests, {});
  assert.throws(() => action(state, 'quest', { id: 'missing-quest', completed: true }));
});

test('old accepted commissions are not mistaken for completed commissions', () => {
  const state = jura.normalizeJura({ enabled: true, level: 1, quests: { 'fragments-of-the-past': 'accepted', 'middle-quest': 'completed' } }, catalog);
  assert.deepEqual(state.quests, { 'middle-quest': 'completed' });
});

test('registered cards remain buildable without granting a free construction', () => {
  const blueprint = { id: 'jura-test-blueprint', name: '登记圣言', kind: 'chant', level: 1, rules: '按卡面使用' };
  let state = jura.normalizeJura({ enabled: true, level: 1, shards: 3, customCards: [blueprint] }, catalog);
  assert.equal(state.built.includes(blueprint.id), false);
  state = action(state, 'build', { id: blueprint.id, payerGold: 5 });
  assert.equal(state.shards, 0);
  assert.ok(state.built.includes(blueprint.id));
});

test('changing tiers does not discard recorded builds, shards or commissions', () => {
  let state = fresh({ enabled: true, level: 2, shards: 20 });
  state = action(state, 'build', { id: 'facility-1-0', payerGold: 99 });
  state = action(state, 'quest', { id: 'fragments-of-the-past', completed: true });
  const built = [...state.built], shards = state.shards;
  state = action(state, 'set-level', { level: 4 });
  assert.deepEqual(state.built, built);
  assert.equal(state.shards, shards);
  assert.equal(state.quests['fragments-of-the-past'], 'completed');
});

function officialCatalog() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../jura-data.js'), 'utf8'), context);
  return JSON.parse(JSON.stringify(context.window.KF_JURA_DATA));
}

test('the TTS catalog still supplies 13 facilities, 9 chants and six commissions', () => {
  const official = officialCatalog();
  assert.equal(official.cards.filter(card => card.kind === 'facility').length, 13);
  assert.equal(official.cards.filter(card => card.kind === 'chant').length, 9);
  assert.equal(official.quests.length, 6);
  assert.equal(new Set(official.cards.map(card => card.id)).size, 22);
  assert.equal(official.cards.filter(card => card.id === 'devotion-altar').length, 1);
  assert.match(official.cards.find(card => card.id === 'circle-of-purification').rules, /恶魔\+：改为强化 3/);
  const psalm = official.cards.find(card => card.id === 'psalm-of-light');
  assert.match(psalm.rules, /获得 \+4 活力/);
  assert.match(psalm.rules, /获得 \+2 活力/);
  assert.doesNotMatch(psalm.rules, /卡面所示的/);
  const hallway = official.cards.find(card => card.id === 'hallway-of-heroes');
  assert.match(hallway.rules, /获得 \+1 战意/);
  assert.match(hallway.rules, /战意不能低于 1/);
  assert.doesNotMatch(hallway.rules, /卡面所示|具体属性图标/);
  const antiCurse = official.cards.find(card => card.id === 'anti-curse-room');
  assert.match(antiCurse.rules, /第一次将要获得诅咒时/);
  assert.doesNotMatch(antiCurse.rules, /卡面所示|具体指示物图标/);
});

test('the compact panel keeps commissions horizontal, shows rules and pays from knight sheets', () => {
  const source = fs.readFileSync(path.join(__dirname, '../jura.js'), 'utf8');
  assert.match(source, /class="jura-quests"/);
  assert.match(source, /data-jura-payer/);
  assert.match(source, /data-jura-preview/);
  assert.match(source, /data-jura-shards/);
  assert.match(source, /jura-shard-icon/);
  assert.match(source, /data-jura-shard-step/);
  assert.match(source, /jura-gold-icon/);
  assert.match(source, /loadout-toggle/);
  assert.match(source, /loadout-save/);
  assert.match(source, /loadout-load/);
  assert.match(source, /class="jura-build-rules"/);
  assert.match(source, /class="jura-build-meta"/);
  assert.match(source, /atlasMarkup/);
  assert.match(source, /jura-card-legend/);
  assert.match(source, /adjustGold\(payment\.sheetId,-payment\.gold\)/);
  assert.doesNotMatch(source, /data-jura-resources|facilityImage|chantImage|实时扣除金币|不占设施槽|jura-toolbar-note|槽位量只记录当前层数|点击名称可查看卡面图片/);
  const css = fs.readFileSync(path.join(__dirname, '../jura.css'), 'utf8');
  assert.match(css, /\.jura-quests\{display:flex/);
  assert.match(css, /\.jura-card-dialog/);
});

test('panel rendering, construction and undo move shards and the chosen sheet gold together', () => {
  const root = {
    innerHTML: '', listeners: {}, contains: () => false,
    addEventListener(type, handler) { this.listeners[type] = handler; },
  };
  const sheet = { id: 'sheet-1', title: '测试骑士', state: { gold: 30 } };
  let state = { enabled: true, level: 1, shards: 20, built: [] };
  const saved = [];
  const notices = [];
  const panel = jura.createJuraPanel({
    root, catalog,
    getState: () => state,
    getSheets: () => [sheet],
    save: value => { state = value; saved.push(value); },
    adjustGold: (id, delta) => { assert.equal(id, sheet.id); sheet.state.gold += delta; return sheet.state.gold; },
    notify: message => notices.push(message),
  });
  const fire = (type, target) => root.listeners[type]({ target, preventDefault() {} });
  const button = (attributes, dataset = {}) => ({
    disabled: false, dataset,
    closest(selector) { return selector === 'button' ? this : null; },
    hasAttribute(name) { return attributes.includes(name); },
  });

  panel.render(true);
  assert.match(root.innerHTML, /class="jura-quests"/);
  assert.match(root.innerHTML, /data-jura-payer/);
  assert.match(root.innerHTML, /data-jura-level-select/);
  assert.match(root.innerHTML, /data-jura-shards/);
  assert.match(root.innerHTML, /jura-shard-icon/);
  assert.match(root.innerHTML, /jura-gold-icon/);
  assert.match(root.innerHTML, /配装区/);
  assert.match(root.innerHTML, /data-jura-loadout-save/);
  assert.match(root.innerHTML, /低层 · 设施 3 槽 · 圣言 1 槽/);
  assert.match(root.innerHTML, /3 碎片 \+ 5 金钱/);
  assert.match(root.innerHTML, /data-jura-preview="chant-1-0"/);
  assert.match(root.innerHTML, /class="jura-build-meta">低层/);
  assert.match(root.innerHTML, /测试效果简述/);
  assert.ok(root.innerHTML.indexOf('配装区') < root.innerHTML.indexOf('建设区') && root.innerHTML.indexOf('建设区') < root.innerHTML.indexOf('尤拉委托'), 'loadout, construction and commissions keep the requested order');

  fire('click', button(['data-jura-action'], { juraAction: 'build', id: 'chant-1-0' }));
  assert.equal(state.shards, 17);
  assert.ok(state.built.includes('chant-1-0'));
  assert.equal(sheet.state.gold, 25);
  assert.equal(saved.length, 1);

  fire('click', button(['data-jura-undo']));
  assert.equal(state.shards, 20);
  assert.equal(state.built.includes('chant-1-0'), false);
  assert.equal(sheet.state.gold, 30);
  assert.match(notices.join(' '), /撤销/);
});

test('combined payment spends earlier knight sheets first and undo refunds every payer', () => {
  const root = { innerHTML: '', listeners: {}, contains: () => false, querySelector: () => null, addEventListener(type, handler) { this.listeners[type] = handler; } };
  const first = { id: 'sheet-1', title: 'Fleischritter', state: { gold: 3 } };
  const second = { id: 'sheet-2', title: 'Stoneface', state: { gold: 10 } };
  let state = { enabled: true, level: 1, shards: 20, built: [] };
  const panel = jura.createJuraPanel({
    root, catalog,
    getState: () => state,
    getSheets: () => [first, second],
    save: value => { state = value; },
    adjustGold: (id, delta) => {
      const sheet = id === first.id ? first : second;
      sheet.state.gold += delta;
      return sheet.state.gold;
    },
    notify: () => {},
  });
  panel.render(true);
  const change = target => root.listeners.change({ target });
  change({ hasAttribute: name => name === 'data-jura-payer-id', dataset: { juraPayerId: second.id }, checked: true });
  assert.match(root.innerHTML, /Fleischritter \+ Stoneface/);
  assert.match(root.innerHTML, /<b>13<\/b>/);
  root.listeners.click({ target: { disabled: false, dataset: { juraAction: 'build', id: 'chant-1-0' }, closest(selector) { return selector === 'button' ? this : null; }, hasAttribute() { return false; } } });
  assert.equal(state.shards, 17);
  assert.equal(first.state.gold, 0, 'the first knight pays as much as possible');
  assert.equal(second.state.gold, 8, 'the next knight pays the remainder');
  root.listeners.click({ target: { disabled: false, dataset: {}, closest(selector) { return selector === 'button' ? this : null; }, hasAttribute(name) { return name === 'data-jura-undo'; } } });
  assert.equal(first.state.gold, 3);
  assert.equal(second.state.gold, 10);
  assert.equal(state.shards, 20);
});

test('the loadout area renders selected built cards as image tiles', () => {
  const root = { innerHTML: '', listeners: {}, contains: () => false, querySelector: () => null, addEventListener(type, handler) { this.listeners[type] = handler; } };
  jura.createJuraPanel({
    root, catalog,
    getState: () => ({ enabled: true, level: 2, shards: 10, built: allIds(), loadoutFacilities: ['facility-2-0'], loadoutChants: ['chant-1-0'] }),
    getSheets: () => [],
    save: () => {}, adjustGold: () => 0, notify: () => {},
  }).render(true);
  assert.match(root.innerHTML, /配装区/);
  assert.match(root.innerHTML, /data-jura-loadout-remove/);
  assert.match(root.innerHTML, /data-jura-loadout-open/);
  assert.match(root.innerHTML, /data-jura-loadout-save/);
  assert.match(root.innerHTML, /jura-loadout-slot is-facility is-fixed/);
  assert.match(root.innerHTML, /圣徒圣所 · 自带，不占槽/);
  assert.equal((root.innerHTML.match(/is-fixed/g) || []).length, 1, 'the starting sanctuary is a single fixed slot');
  assert.match(root.innerHTML, /test-chant\.jpg/);
  assert.match(root.innerHTML, /设施 1 \/ 5 · 圣言 1 \/ 2/);
  assert.equal((root.innerHTML.match(/data-jura-loadout-open/g) || []).length, 4 + 1, 'four empty facility slots and one empty chant slot');
  assert.equal((root.innerHTML.match(/data-jura-loadout-remove/g) || []).length, 2, 'one filled facility and one filled chant');
  assert.doesNotMatch(root.innerHTML, /可加入的设施|可加入的圣言/);
});

test('clicking an empty loadout slot opens a picker and adds the chosen card', () => {
  const dialogs = [];
  const documentStub = {
    body: { append(dialog) { dialogs.push(dialog); } },
    querySelector() { return dialogs[0] || null; },
    createElement() {
      return { open: false, innerHTML: '', onclick: null, showModal() { this.open = true; }, close() { this.open = false; } };
    },
  };
  const previousDocument = global.document;
  global.document = documentStub;
  try {
    const root = { innerHTML: '', listeners: {}, contains: () => false, querySelector: () => null, addEventListener(type, handler) { this.listeners[type] = handler; } };
    let state = { enabled: true, level: 1, shards: 10, built: allIds() };
    jura.createJuraPanel({ root, catalog, getState: () => state, getSheets: () => [], save: value => { state = value; }, adjustGold: () => 0, notify: () => {} }).render(true);
    root.listeners.click({ target: { disabled: false, dataset: { juraLoadoutKind: 'chant' }, closest(selector) { return selector === 'button' ? this : null; }, hasAttribute(name) { return name === 'data-jura-loadout-open'; } } });
    assert.equal(dialogs[0].open, true);
    assert.match(dialogs[0].innerHTML, /data-jura-loadout-choose="chant-1-0"/);
    const choice = { dataset: { juraLoadoutChoose: 'chant-1-0' }, closest(selector) { return selector === '[data-jura-loadout-choose]' ? this : null; } };
    dialogs[0].onclick({ target: choice });
    assert.deepEqual(state.loadoutChants, ['chant-1-0']);
    assert.equal(dialogs[0].open, false);
  } finally {
    if (previousDocument === undefined) delete global.document;
    else global.document = previousDocument;
  }
});

test('the shard field saves while typing and needs no update button', () => {
  const root = { innerHTML: '', listeners: {}, contains: () => false, addEventListener(type, handler) { this.listeners[type] = handler; } };
  let state = { enabled: true, level: 1, shards: 3, built: [] };
  const saved = [];
  jura.createJuraPanel({
    root, catalog,
    getState: () => state,
    save: value => { state = value; saved.push(value); },
    getSheets: () => [{ id: 'sheet-1', title: '测试骑士', state: { gold: 30 } }],
    adjustGold: () => 25,
    notify: () => {},
  }).render(true);
  assert.doesNotMatch(root.innerHTML, /更新碎片/);
  root.listeners.input({ target: { hasAttribute: name => name === 'data-jura-shards', value: '14' } });
  assert.equal(state.shards, 14);
  assert.equal(saved.length, 1);
  const step = value => ({ disabled: false, dataset: { juraShardStep: String(value) }, closest(selector) { return selector === 'button' ? this : null; }, hasAttribute() { return false; } });
  root.listeners.click({ target: step(1) });
  assert.equal(state.shards, 15);
  root.listeners.click({ target: step(-1) });
  assert.equal(state.shards, 14);
  assert.equal(saved.length, 3);
  root.listeners.input({ target: { hasAttribute: name => name === 'data-jura-shards', value: '' } });
  assert.equal(state.shards, 14, 'clearing the field waits for change instead of saving zero immediately');
  root.listeners.change({ target: { hasAttribute: name => name === 'data-jura-shards', value: '' } });
  assert.equal(state.shards, 0);
});

test('the current-tier picker switches tiers without a separate tier table', () => {
  const root = { innerHTML: '', listeners: {}, contains: () => false, addEventListener(type, handler) { this.listeners[type] = handler; } };
  let state = { enabled: true, level: 1, shards: 3, built: [] };
  const notices = [];
  jura.createJuraPanel({
    root, catalog,
    getState: () => state,
    save: value => { state = value; },
    getSheets: () => [],
    notify: message => notices.push(message),
  }).render(true);
  assert.doesNotMatch(root.innerHTML, /jura-tier-table/);
  assert.match(root.innerHTML, /低层 · 设施 3 槽 · 圣言 1 槽/);
  root.listeners.change({ target: { hasAttribute: name => name === 'data-jura-level-select', value: '4' } });
  assert.equal(state.level, 4);
  assert.match(root.innerHTML, /顶层 · 设施 7 槽 · 圣言 4 槽/);
  assert.match(notices.join(' '), /顶层/);
});

test('clicking a card name opens its card image in a dialog', () => {
  const dialogs = [];
  const documentStub = {
    body: { append(dialog) { dialogs.push(dialog); } },
    querySelector() { return dialogs[0] || null; },
    createElement(tag) {
      const content = { innerHTML: '' };
      const dialog = {
        tag, id: '', className: '', open: false, innerHTML: '', content,
        addEventListener() {}, showModal() { this.open = true; }, close() { this.open = false; },
        querySelector(selector) { return selector === '.jura-preview-content' ? content : null; },
      };
      return dialog;
    },
  };
  const previousDocument = global.document;
  global.document = documentStub;
  try {
    const root = { innerHTML: '', listeners: {}, contains: () => false, addEventListener(type, handler) { this.listeners[type] = handler; } };
    const panel = jura.createJuraPanel({
      root, catalog,
      getState: () => ({ enabled: true, level: 1, shards: 3, built: [] }),
      getSheets: () => [{ id: 'sheet-1', title: '测试骑士', state: { gold: 30 } }],
      save: () => {}, adjustGold: () => 30, notify: () => {},
    });
    panel.render(true);
    const previewButton = {
      disabled: false, dataset: { juraPreview: 'chant-1-0' },
      closest(selector) { return selector === 'button' ? this : null; },
      hasAttribute() { return false; },
    };
    root.listeners.click({ target: previewButton });
    assert.equal(dialogs.length, 1);
    assert.equal(dialogs[0].open, true);
    assert.match(dialogs[0].content.innerHTML, /test-chant\.jpg/);
    assert.match(dialogs[0].innerHTML, /jura-card-legend/);
    assert.match(dialogs[0].innerHTML, /红色标志表示「危险」/);
  } finally {
    if (previousDocument === undefined) delete global.document;
    else global.document = previousDocument;
  }
});
