const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Minimal DOM host exercises the shared component and real dictionary without a browser dependency.
class Element {
  constructor(tag = 'div') { this.tag = tag; this.children = []; this.listeners = {}; this.hidden = false; this.value = ''; this._text = ''; this.classList = { add: () => {} }; }
  set innerHTML(value) {
    this.html = value;
    this.nodes = Object.fromEntries(['input', '.kf-keywords-results', '.kf-keywords-current', '.kf-keywords-count', '.kf-keywords-alert', '.kf-keywords-context'].map(key => [key, new Element()]));
  }
  set textContent(value) { this._text = value; this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  setAttribute() {}
  querySelector(key) { return this.nodes[key]; }
  replaceChildren(...children) { this._text = ''; this.children = children; }
  append(...children) { this.children.push(...children); }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  fire(type, event) { this.listeners[type](event); }
  closest() { return this.parentDetails || (this.parentDetails = new Element('details')); }
  scrollIntoView() { this.scrolled = true; }
  get firstElementChild() { return this.children[0]; }
  before(node) { this.inserted = node; }
}
const source = fs.readFileSync(path.join(__dirname, '../modules/keywords.js'), 'utf8');
const dictionary = JSON.parse(fs.readFileSync(path.join(__dirname, '../keyword-data/keywords.json'), 'utf8'));
async function create(fail = false) {
  const main = new Element();
  let fetched;
  const context = {
    URL, window: {}, document: {
      currentScript: { src: 'http://localhost/modules/keywords.js?v=1' },
      createElement: tag => new Element(tag), createTextNode: text => { const node = new Element(); node.textContent = text; return node; }, querySelector: () => main
    },
    DOMParser: class { parseFromString(text) {
      const link = text.match(/<a href=['"]dic:\/\/([^'"]+)['"]>([^<]+)<\/a>/i);
      const body = link ? { childNodes: [{ nodeType: 1, tagName: 'A', getAttribute: () => 'dic://' + link[1], textContent: link[2] }] } : { textContent: text.replace(/<[^>]*>/g, '') };
      return { querySelectorAll: () => [], body };
    } },
    fetch: async url => { fetched = String(url); return fail ? { ok: false, status: 404 } : { ok: true, json: async () => dictionary }; }
  };
  vm.runInNewContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  return { panel: main.inserted, api: context.window.KFKeywords, fetched };
}
test('loads dictionary and searches both languages, including composition input', async () => {
  const { panel, fetched } = await create();
  assert.equal(fetched, 'http://localhost/keyword-data/keywords.json');
  const input = panel.querySelector('input'), results = panel.querySelector('.kf-keywords-results');
  input.value = 'Acrobatics'; input.fire('input');
  assert.match(results.textContent, /杂技.*Acrobatics/);
  input.fire('compositionstart'); input.value = '激活X'; input.fire('input');
  assert.match(results.textContent, /杂技/);
  input.fire('compositionend'); assert.match(results.textContent, /激活X.*Activate X/);
  input.value = '击飞 ３'; input.fire('input');
  assert.match(results.textContent, /击飞X.*Knockback X/);
  input.value = 'Overcome 2+'; input.fire('input');
  assert.match(results.textContent, /过线X\+.*OvercomeX\+/);
  input.value = 'Poison 1'; input.fire('input');
  assert.match(results.textContent, /中毒X.*Poison/);
});
test('renders boss groups and a compact draw reminder, then clears it', async () => {
  const { panel, api } = await create();
  api.setPersistent([{ label: '大卡', keywords: ['Acrobatics'] }]);
  assert.match(panel.querySelector('.kf-keywords-current').textContent, /大卡.*杂技/);
  api.notify(['Acrobatics']);
  const notice = panel.querySelector('.kf-keywords-alert');
  assert.equal(notice.hidden, false);
  assert.equal(notice.children.length, 1);
  const keyword = notice.children[0].children[0];
  assert.notEqual(keyword.open, true);
  assert.equal(keyword.children[0].textContent, '杂技');
  assert.ok(keyword.children[1].textContent);
  api.notify([]); assert.equal(notice.hidden, true);
});
test('reports a failed dictionary load', async () => {
  const { panel } = await create(true);
  assert.match(panel.querySelector('.kf-keywords-results').textContent, /加载失败/);
});
test('opens a linked dictionary entry from a draw reminder', async () => {
  const { panel, api } = await create();
  api.notify([{ zh: '测试', definitionHtml: '<a href="dic://Acrobatics">杂技</a>' }]);
  const link = panel.querySelector('.kf-keywords-alert').children[0].children[0].children[1].children[0];
  let prevented = false;
  link.fire('click', { preventDefault() { prevented = true; } });
  const input = panel.querySelector('input'), results = panel.querySelector('.kf-keywords-results');
  assert.equal(prevented, true);
  assert.equal(input.value, 'Acrobatics');
  assert.equal(results.firstElementChild.open, true);
  assert.match(results.firstElementChild.children[0].textContent, /杂技/);
  assert.equal(input.closest('details').open, true);
  assert.equal(results.scrolled, true);
});
test('displays bilingual definitions in Chinese and English columns', async () => {
  const { panel, api } = await create();
  api.notify([{ zh: '测试', definitionHtml: 'English definition<hr>中文释义' }]);
  const definition = panel.querySelector('.kf-keywords-alert').children[0].children[0].children[1];
  assert.equal(definition.children[0].lang, 'zh');
  assert.equal(definition.children[1].lang, 'en');
  assert.match(definition.children[0].textContent, /中文释义/);
  assert.match(definition.children[1].textContent, /English definition/);
});
test('reports card data load failures and restores groups when recovered', async () => {
  const { panel, api } = await create();
  api.setPersistent([{ label: '大卡', keywords: ['Acrobatics'] }]);
  api.setCardDataError(true);
  assert.match(panel.querySelector('.kf-keywords-current').textContent, /卡牌关键词数据加载失败/);
  api.setCardDataError(false);
  assert.match(panel.querySelector('.kf-keywords-current').textContent, /大卡.*杂技/);
});
test('shows encounter-specific heading and distinguishes a missing scan', async () => {
  const { panel, api } = await create();
  api.setContext('当前遭遇卡关键词');
  api.setPersistent([{ label: '等级 2 · 背面', keywords: [], message: '此遭遇卡尚未扫描。' }]);
  assert.equal(panel.querySelector('.kf-keywords-context').textContent, '当前遭遇卡关键词');
  assert.match(panel.querySelector('.kf-keywords-current').textContent, /等级 2 · 背面.*尚未扫描/);
});
test('docks the panel into a host supplied by a module and keeps its state', async () => {
  const { panel, api } = await create();
  const host = new Element();
  assert.equal(api.mount(host), true);
  assert.equal(host.children.at(-1), panel);
  const input = panel.querySelector('input');
  input.value = 'Acrobatics';
  api.mount(host);
  assert.equal(host.children.at(-1), panel);
  assert.equal(panel.querySelector('input').value, 'Acrobatics');
  assert.equal(api.mount(null), false);
});
