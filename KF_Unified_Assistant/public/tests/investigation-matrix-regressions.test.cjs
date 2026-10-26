const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const section = (start, end) => {
  const from = source.indexOf(start), to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `Missing application section: ${start}`);
  return source.slice(from, to);
};
const plain = value => JSON.parse(JSON.stringify(value));
function harness() {
  const listeners = {}, cached = [];
  let serial = 0;
  const state = { successfulInvestigations: {}, story: Array.from({ length: 5 }, () => ({
    quest: false, investigations: Array.from({ length: 3 }, () => ({ success: '', attempted: false })),
  })) };
  const c = vm.createContext({
    state, pending: [], user: { id: 'user-A' }, active: 'sheet-A', clientId: 'client-A', revision: 2, saveTimer: null,
    navigator: { onLine: false }, compatibleUuid: () => `operation_${++serial}`,
    persistPending() {}, cacheSheet() { cached.push(plain(state)); }, setSave() {}, clearTimeout() {}, setTimeout() {}, sync() {},
    renderValues() {}, $: () => ({ addEventListener: (name, callback) => { listeners[name] = callback; } }),
  });
  vm.runInContext(section('const investigationSuccessValue=', 'function rapportHearts(')
    + section('const pathGet=', 'const cacheSheet=')
    + section('$("#sheetForm").addEventListener("input"', '$("#sheetForm").addEventListener("focusout"'), c);
  const click = (id, checked = true) => {
    const target = { type: 'checkbox', checked, dataset: { path: `successfulInvestigations.${id}` } };
    listeners.input({ target });
    return target;
  };
  const edit = (chapter, slot, value, field = 'success') => {
    const target = { dataset: { path: `story.${chapter}.investigations.${slot}.${field}` },
      type: field === 'attempted' ? 'checkbox' : 'number', checked: value, value: String(value), min: '0', max: '99',
      hasAttribute: name => name === 'data-investigation-success' };
    listeners.input({ target });
  };
  return { c, state, cached, click, edit };
}

test('selecting a successful investigation fills its story number and checks the right-hand box', () => {
  const { c, state, cached, click } = harness();
  click('1-2'); click('1-3');
  assert.deepEqual(plain(state.story[0].investigations), [
    { success: 2, attempted: true }, { success: 3, attempted: true }, { success: '', attempted: false },
  ]);
  assert.equal(state.successfulInvestigations['1-2'], true);
  assert.deepEqual(Array.from(c.pending.slice(0, 3), item => item.path), [
    'successfulInvestigations.1-2', 'story.0.investigations.0.success', 'story.0.investigations.0.attempted',
  ]);
  assert.ok(c.pending.every(item => item.sheetId === 'sheet-A' && item.userId === 'user-A'));
  assert.deepEqual(cached.at(-1), plain(state));
});

test('each matrix row maps to its own chapter and preserves occupied numbers', () => {
  const { state, click } = harness();
  state.story[1].investigations[0] = { success: 17, attempted: true };
  state.story[1].investigations[1] = { success: 0, attempted: false };
  click('2-5');
  assert.deepEqual(plain(state.story[1].investigations), [
    { success: 17, attempted: true }, { success: 0, attempted: false }, { success: 5, attempted: true },
  ]);
  assert.ok(state.story[0].investigations.every(item => item.success === ''));
});

test('a full chapter still accepts the success checkbox without changing any story entry', () => {
  const { c, state, click } = harness();
  state.story[2].investigations = [1, 2, 3].map(success => ({ success, attempted: true }));
  const before = plain(state.story);
  assert.equal(click('3-5').checked, true);
  assert.equal(state.successfulInvestigations['3-5'], true);
  assert.deepEqual(plain(state.story), before);
  assert.deepEqual(Array.from(c.pending, item => item.path), ['successfulInvestigations.3-5']);
  click('3-5', false);
  assert.equal(state.successfulInvestigations['3-5'], false);
  assert.deepEqual(plain(state.story), before);
});

test('an existing matching number is reused instead of creating a duplicate', () => {
  const { state, click } = harness();
  state.story[3].investigations[1].success = '4';
  click('4-4');
  assert.equal(state.story[3].investigations[0].success, '');
  assert.equal(state.story[3].investigations[1].success, '4');
  assert.equal(state.story[3].investigations[1].attempted, true);
  assert.equal(state.story[3].investigations[2].success, '');
});

test('unchecking the success matrix removes the story check and preserves the recorded number', () => {
  const { state, click } = harness();
  click('5-2'); click('5-4'); click('5-2', false);
  assert.deepEqual(plain(state.story[4].investigations), [
    { success: 2, attempted: false }, { success: 4, attempted: true }, { success: '', attempted: false },
  ]);
  click('5-1');
  assert.equal(state.story[4].investigations[0].success, 2);
  assert.equal(state.story[4].investigations[1].success, 4);
  assert.equal(state.story[4].investigations[2].success, 1);
});

test('invalid identifiers cannot write outside the five chapters or investigations', () => {
  const { c, state } = harness(), before = plain(state);
  for (const id of ['0-1', '1-0', '6-1', '1-6', '__proto__', '1-1.extra']) {
    assert.equal(c.recordSuccessfulInvestigation(`successfulInvestigations.${id}`, true), false);
  }
  assert.deepEqual(plain(state), before);
  assert.equal(c.pending.length, 0);
});

test('typing, replacing and clearing a story number alone never marks a successful investigation', () => {
  const { c, state, edit } = harness();
  edit(1, 0, 2);
  assert.equal(state.story[1].investigations[0].attempted, false);
  assert.equal(state.successfulInvestigations['2-2'], undefined);
  edit(1, 0, 4);
  assert.equal(state.successfulInvestigations['2-2'], undefined);
  assert.equal(state.successfulInvestigations['2-4'], undefined);
  edit(1, 0, '');
  assert.equal(state.successfulInvestigations['2-4'], undefined);
  assert.equal(state.story[1].investigations[0].attempted, false);
  assert.ok(c.pending.every(item => item.path === 'story.1.investigations.0.success'));
});

test('the story right-hand checkbox and success matrix synchronize in both directions', () => {
  const { state, edit, click } = harness();
  edit(0, 1, 3);
  assert.equal(state.successfulInvestigations['1-3'], undefined);
  edit(0, 1, true, 'attempted');
  assert.equal(state.successfulInvestigations['1-3'], true);
  edit(0, 1, false, 'attempted');
  assert.equal(state.successfulInvestigations['1-3'], false);
  assert.equal(state.story[0].investigations[1].success, 3);
  click('1-3');
  assert.equal(state.story[0].investigations[1].attempted, true);
  assert.equal(state.successfulInvestigations['1-3'], true);
  click('1-3', false);
  assert.equal(state.story[0].investigations[1].attempted, false);
  assert.equal(state.story[0].investigations[1].success, 3);
  assert.equal(state.successfulInvestigations['1-3'], false);
});

test('story edits preserve unrelated extra successful investigations selected after a chapter fills', () => {
  const { state, click, edit } = harness();
  click('1-1'); click('1-2'); click('1-3'); click('1-5');
  edit(0, 0, 4);
  assert.equal(state.successfulInvestigations['1-1'], false);
  assert.equal(state.successfulInvestigations['1-4'], true);
  assert.equal(state.successfulInvestigations['1-5'], true);
});

test('clearing one duplicate story number preserves another completed instance', () => {
  const { state, edit } = harness();
  edit(0, 0, 2); edit(0, 1, 2);
  edit(0, 0, true, 'attempted'); edit(0, 1, true, 'attempted'); edit(0, 0, '');
  assert.equal(state.successfulInvestigations['1-2'], true);
  assert.equal(state.story[0].investigations[1].success, 2);
});

test('legacy story numbers outside the five investigation identifiers remain editable without false matrix cells', () => {
  const { state, edit } = harness();
  edit(2, 0, 17); edit(2, 0, true, 'attempted');
  assert.equal(state.story[2].investigations[0].success, 17);
  assert.deepEqual(plain(state.successfulInvestigations), {});
});

test('changing an already checked story entry moves its success mark to the new identifier', () => {
  const { state, edit } = harness();
  edit(0, 0, 2); edit(0, 0, true, 'attempted'); edit(0, 0, 4);
  assert.equal(state.story[0].investigations[0].attempted, true);
  assert.equal(state.successfulInvestigations['1-2'], false);
  assert.equal(state.successfulInvestigations['1-4'], true);
});

test('entering an unchecked number cannot clear an independently selected success', () => {
  const { c, state, edit } = harness();
  state.successfulInvestigations['1-3'] = true;
  edit(0, 0, 3);
  assert.equal(state.successfulInvestigations['1-3'], true);
  assert.equal(state.story[0].investigations[0].attempted, false);
  assert.deepEqual(Array.from(c.pending, item => item.path), ['story.0.investigations.0.success']);
});

test('unchecking a success clears matching story checks even when a legacy save contains duplicate numbers', () => {
  const { state, edit, click } = harness();
  edit(0, 0, 2); edit(0, 1, 2);
  click('1-2');
  assert.equal(state.story[0].investigations[0].attempted, true);
  assert.equal(state.story[0].investigations[1].attempted, true);
  click('1-2', false);
  assert.equal(state.story[0].investigations[0].attempted, false);
  assert.equal(state.story[0].investigations[1].attempted, false);
  assert.equal(state.story[0].investigations[0].success, 2);
  assert.equal(state.story[0].investigations[1].success, 2);
});
