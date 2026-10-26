const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8').replace(/\r\n/g, '\n');
function section(start, end) {
  const from = source.indexOf(start), to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `Missing application section: ${start}`);
  return source.slice(from, to);
}
const helpers = section('const virtueMeta =', 'let user=null');
const rules = [
  ['bravery', '懦弱 COWARDICE', '你获得 -1 闪避加成。'],
  ['tenacity', '失信 DISHONOR', '忽略你在一次远征中抽取到的第一张正面伤亡卡。'],
  ['sagacity', '欺骗 DUPLICITY', '在收获阶段开始时，从战利品卡组中弃置 1 张战利品卡。'],
  ['fortitude', '冷漠 DISREGARD', '忽略你在一次远征中获得的第一个线索。'],
  ['might', '残忍 CRUELTY', '当你即将获得热度（Heat）时，将该获得降低 1（最低为 0）。'],
  ['insight', '背叛 TREACHERY', '你的佣兵卡使用金钱（Gold）费用 +2。'],
];
const line = key => {
  const [, name, effect] = rules.find(rule => rule[0] === key);
  return `【恶习】${name.split(' ')[0]}：${effect}`;
};
const legacyLine = key => {
  const [, name, effect] = rules.find(rule => rule[0] === key);
  return `【恶习自动记录】${name}：${effect}`;
};
const sheet = (notes = '') => ({ notes, virtues: Object.fromEntries(rules.map(([key]) => [key, { value: 0, vice: [false, false, false, false] }])) });

function pure() {
  const context = vm.createContext({});
  vm.runInContext(helpers, context);
  return context.notesWithViceEffects;
}

test('empty and all-unmarked sheets keep handwritten notes unchanged', () => {
  const reconcile = pure();
  for (const notes of ['', '恩惠：补给一份\n计数：2\n', '手写笔记\r\n保留原来的换行']) {
    const state = sheet(notes), before = JSON.stringify(state);
    assert.equal(reconcile(state), notes);
    assert.equal(JSON.stringify(state), before, 'the pure helper must not mutate its source');
  }
  assert.equal(reconcile({}), '');
  assert.equal(reconcile(null), '');
});

test('each of the four marks activates one matching rule without multiplying its penalty', () => {
  const reconcile = pure();
  for (const [key] of rules) {
    for (let mark = 0; mark < 4; mark++) {
      const state = sheet();
      state.virtues[key].vice[mark] = true;
      assert.equal(reconcile(state), line(key));
    }
    const state = sheet();
    state.virtues[key].vice.fill(true);
    assert.equal(reconcile(state), line(key));
  }
});

test('multiple active vices produce six correct effects in sheet order and remain idempotent', () => {
  const reconcile = pure(), state = sheet('恩惠：商人欠我一次人情');
  for (const [key] of rules) state.virtues[key].vice[2] = true;
  const expected = `${state.notes}\n${rules.map(([key]) => line(key)).join('\n')}`;
  assert.equal(reconcile(state), expected);
  state.notes = expected;
  for (let i = 0; i < 10; i++) {
    state.notes = reconcile(state);
    assert.equal(state.notes, expected, 'refreshes must not append duplicate rules or extra blank lines');
  }
});

test('remaining marks keep an effect until the final mark is cleared and handwriting survives', () => {
  const reconcile = pure(), original = '计数标记：3\n\n我自己记录的懦弱：闪避 -1。\n';
  const state = sheet(original);
  state.virtues.bravery.vice = [true, false, true, false];
  state.notes = reconcile(state);
  state.virtues.bravery.vice[0] = false;
  assert.equal(reconcile(state), `${original}\n${line('bravery')}`);
  state.virtues.bravery.vice[2] = false;
  assert.equal(reconcile(state), original);
});

test('only exact generated lines are replaced, preserving similar handwritten content and CRLF', () => {
  const reconcile = pure();
  const handwritten = '【恶习】这是我写的说明\r\n手动摘录：' + line('bravery');
  const state = sheet(`${handwritten}\r\n${line('bravery')}\r\n${line('bravery')}`);
  state.virtues.insight.vice[3] = true;
  assert.equal(reconcile(state), `${handwritten}\r\n${line('insight')}`);
});

test('legacy English automatic entries migrate to Chinese names or disappear when inactive', () => {
  const reconcile = pure();
  const handwritten = `计数：2\n【恶习自动记录】我的自定义说明\n手动摘录：${legacyLine('tenacity')}`;
  const state = sheet(`${handwritten}\n${rules.map(([key]) => legacyLine(key)).join('\n')}\n${line('bravery')}`);
  state.virtues.bravery.vice[1] = true;
  state.virtues.might.vice[3] = true;
  const expected = `${handwritten}\n${line('bravery')}\n${line('might')}`;
  assert.equal(reconcile(state), expected);
  state.notes = expected;
  assert.equal(reconcile(state), expected, 'migration must not leave duplicate old and new entries');
  state.virtues.bravery.vice[1] = false;
  state.virtues.might.vice[3] = false;
  assert.equal(reconcile(state), handwritten);
  const inactive = sheet(`${handwritten}\n${rules.map(([key]) => legacyLine(key)).join('\n')}`);
  assert.equal(reconcile(inactive), handwritten, 'inactive legacy effects are removed without deleting handwritten notes');
});

function live(state) {
  const listeners = {}, timers = [], stored = new Map();
  let serial = 0, persisted = 0;
  const form = { addEventListener(name, callback) { listeners[name] = callback; } };
  const notes = { dataset: { path: 'notes' }, type: 'textarea', value: '', hasAttribute() { return false; } };
  const mark = { dataset: { path: 'virtues.bravery.vice.3' }, type: 'checkbox', checked: false };
  const context = vm.createContext({
    state, user: { id: 'user-A' }, active: 'sheet-A', revision: 4, clientId: 'client-A', pending: [], saveTimer: null,
    navigator: { onLine: false }, document: { activeElement: null },
    $: selector => selector === '#sheetForm' ? form : null,
    $$: selector => selector === '[data-path]' ? [notes, mark] : [],
    compatibleUuid: () => `operation_${++serial}`,
    persistPending() { persisted++; }, cacheSheet() { stored.set('sheet-A', JSON.parse(JSON.stringify(context.state))); },
    setSave() {}, clearTimeout() {}, setTimeout(callback) { timers.push(callback); return timers.length; }, sync() {},
  });
  vm.runInContext(helpers + section('const pathGet=', 'const cacheSheet=') + section('function renderValues(){', 'function esc(')
    + section('$("#sheetForm").addEventListener("input"', '$("#sheetForm").addEventListener("click"'), context);
  return { context, notes, mark, listeners, stored, timers, persistCount: () => persisted };
}

test('opening an existing save populates notes through the normal offline save queue exactly once', () => {
  const state = sheet('旧档案笔记');
  state.virtues.fortitude.vice[1] = true;
  const { context: c, notes, stored, persistCount } = live(state);
  c.renderValues();
  const expected = `旧档案笔记\n${line('fortitude')}`;
  assert.equal(notes.value, expected);
  assert.equal(c.pending.length, 1);
  assert.equal(c.pending[0].path, 'notes');
  assert.equal(c.pending[0].sheetId, 'sheet-A');
  assert.equal(c.pending[0].value, expected);
  assert.equal(stored.get('sheet-A').notes, expected);
  c.renderValues(); c.renderValues();
  assert.equal(c.pending.length, 1);
  assert.equal(persistCount(), 1);
});

test('checking and clearing a vice immediately updates the visible notes and durable operations', () => {
  const { context: c, notes, mark, listeners } = live(sheet('恩惠：1'));
  c.document.activeElement = mark;
  mark.checked = true;
  listeners.input({ target: mark });
  assert.equal(notes.value, `恩惠：1\n${line('bravery')}`);
  assert.deepEqual(Array.from(c.pending, operation => operation.path), ['virtues.bravery.vice.3', 'notes']);
  mark.checked = false;
  listeners.input({ target: mark });
  assert.equal(notes.value, '恩惠：1');
  assert.equal(c.pending.at(-1).path, 'notes');
  assert.equal(c.pending.at(-1).value, '恩惠：1');
});

test('typing notes preserves the focused text, then blur restores the active rule once', () => {
  const state = sheet(); state.virtues.bravery.vice[0] = true;
  const { context: c, notes, listeners } = live(state);
  c.renderValues();
  c.document.activeElement = notes;
  notes.value = '我正在修改笔记';
  listeners.input({ target: notes });
  assert.equal(notes.value, '我正在修改笔记');
  assert.equal(c.state.notes, '我正在修改笔记');
  c.document.activeElement = null;
  listeners.focusout({ target: notes });
  const expected = `我正在修改笔记\n${line('bravery')}`;
  assert.equal(notes.value, expected);
  assert.equal(c.state.notes, expected);
  const count = c.pending.length;
  c.renderValues();
  assert.equal(c.pending.length, count, 'rendering normalized notes must not enqueue another save');
});
