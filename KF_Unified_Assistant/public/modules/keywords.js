/* Shared keyword lookup for the encounter and AI/BP modules. */
(function () {
  'use strict';
  const dictionaryUrl = new URL('../keyword-data/keywords.json', document.currentScript.src);
  const panel = document.createElement('section');
  panel.className = 'kf-keywords';
  panel.setAttribute('aria-label', '关键词查询');
  panel.innerHTML = '<details open><summary>查询关键词</summary><div class="kf-keywords-content"><label>输入中文或英文关键词 <input type="search" placeholder="搜索关键词" autocomplete="off"></label><div class="kf-keywords-results" aria-live="polite"></div></div></details><details open><summary><span class="kf-keywords-context">当前 Boss 关键词</span> <span class="kf-keywords-count"></span></summary><div class="kf-keywords-content"><p class="kf-keywords-note">卡面关键词由卡面自动识别，可能遗漏或误识，请核对卡面。</p><div class="kf-keywords-current">尚未识别到关键词，请核对卡面。</div></div></details><div class="kf-keywords-alert" hidden role="status"></div>';
  document.querySelector('main').before(panel);
  // Modules can dock the panel beside their own content (for example the AI/BP
  // conflict board); the panel node is reused so its search state survives.
  function mount(target) {
    const host = typeof target === 'string' ? document.querySelector(target) : target;
    if (!host) return false;
    if (panel.parentElement !== host) host.append(panel);
    return true;
  }
  const input = panel.querySelector('input');
  const results = panel.querySelector('.kf-keywords-results');
  const current = panel.querySelector('.kf-keywords-current');
  const count = panel.querySelector('.kf-keywords-count');
  const contextTitle = panel.querySelector('.kf-keywords-context');
  const alertBox = panel.querySelector('.kf-keywords-alert');
  let entries = [], groups = [], loadError = false, cardDataError = false, composing = false, pendingNotice = null;
  const normalize = value => String(value || '').trim().toLocaleLowerCase();
  // Printed values such as “击飞 3” and “Overcome 2+” correspond to
  // dictionary headwords with X, while some English headwords omit X.
  const compact = value => normalize(value).normalize('NFKC').replace(/\s+/g, '');
  function matchesQuery(value, query) {
    const term = compact(value), input = compact(query);
    if (term.includes(input)) return true;
    const parameterized = input.replace(/\d+/g, 'x');
    if (term.includes(parameterized)) return true;
    return /\d+\+?$/.test(input) && term === input.replace(/\d+\+?$/, '');
  }
  function entryFor(value) {
    if (value && typeof value === 'object' && value.definitionHtml !== undefined) return value;
    const key = normalize(typeof value === 'object' && value ? (value.id || value.en || value.zh || value.keyword) : value);
    return entries.find(entry => [entry.id, entry.en, entry.zh].some(part => normalize(part) === key));
  }
  function renderDefinition(container, html) {
    const doc = new DOMParser().parseFromString(String(html || '').replace(/<\s*(?:br|hr)\s*\/?\s*>/gi, '\n').replace(/<\/(?:p|div|li|tr|h[1-6])\s*>/gi, '\n'), 'text/html');
    doc.querySelectorAll('script,style').forEach(node => node.remove());
    function appendNode(node) {
      if (node.nodeType === 3) { container.append(document.createTextNode(node.textContent)); return; }
      if (node.nodeType !== 1) return;
      const href = node.tagName === 'A' && node.getAttribute('href');
      if (href && /^dic:\/\//i.test(href)) {
        const link = document.createElement('a');
        link.href = '#';
        link.textContent = node.textContent;
        link.addEventListener('click', event => {
          event.preventDefault();
          let target = href.slice(6);
          try { target = decodeURIComponent(target); } catch (_) { /* Keep the original name. */ }
          input.value = target;
          renderSearch();
          const match = entryFor(target);
          if (match) {
            results.replaceChildren(renderEntry(match));
            results.firstElementChild.open = true;
          }
          input.closest('details').open = true;
          results.scrollIntoView({ block: 'nearest' });
        });
        container.append(link);
      } else {
        Array.from(node.childNodes).forEach(appendNode);
      }
    }
    if (doc.body.childNodes) Array.from(doc.body.childNodes).forEach(appendNode);
    else container.textContent = doc.body.textContent || '';
    if (!container.textContent.trim()) container.textContent = '暂无释义';
  }
  function renderEntry(value, compactTitle = false) {
    const entry = entryFor(value);
    const box = document.createElement('details');
    box.className = 'kf-keyword-entry';
    const title = document.createElement('summary');
    title.textContent = entry ? [entry.zh, entry.en].filter(Boolean).join(' / ') : String(typeof value === 'object' && value ? (value.zh || value.en || value.id || value.keyword || '') : value);
    if (compactTitle && entry) title.textContent = entry.zh || entry.en || entry.id;
    box.append(title);
    const definition = document.createElement('div');
    definition.className = 'kf-keyword-definition';
    if (entry) {
      const parts = String(entry.definitionHtml || '').split(/<\s*hr\s*\/?\s*>/i);
      if (parts.length > 1) {
        definition.classList.add('kf-keyword-bilingual');
        const chinese = document.createElement('div');
        const english = document.createElement('div');
        chinese.lang = 'zh'; english.lang = 'en';
        renderDefinition(chinese, parts.slice(1).join('\n'));
        renderDefinition(english, parts[0]);
        definition.append(chinese, english);
      } else renderDefinition(definition, parts[0]);
    } else definition.textContent = '未找到对应释义';
    box.append(definition);
    return box;
  }
  function renderSearch() {
    results.replaceChildren();
    if (loadError) { results.textContent = '关键词词典加载失败，请检查数据文件后重新打开页面。'; return; }
    if (!entries.length) { results.textContent = '正在加载词典…'; return; }
    const query = normalize(input.value);
    if (!query) { results.textContent = '输入关键词以查询释义。'; return; }
    const matches = entries.filter(entry => [entry.en, entry.zh, entry.id].some(part => matchesQuery(part, query)));
    if (!matches.length) { results.textContent = '没有找到匹配的关键词。'; return; }
    matches.forEach(entry => results.append(renderEntry(entry)));
  }
  function renderPersistent() {
    current.replaceChildren();
    if (cardDataError) {
      count.textContent = '';
      current.textContent = '卡牌关键词数据加载失败，请检查数据文件后重新打开页面。';
      return;
    }
    let total = 0;
    groups.forEach(group => {
      const words = group.keywords || group.entries || [];
      if (!words.length && !group.message) return;
      total += words.length;
      const heading = document.createElement('strong');
      heading.textContent = group.label || group.name || '关键词';
      current.append(heading);
      if (group.message) {
        const message = document.createElement('p');
        message.textContent = group.message;
        current.append(message);
      }
      words.forEach(word => current.append(renderEntry(word)));
    });
    count.textContent = total ? `（${total}）` : '';
    if (!total && !groups.some(group => group.message)) current.textContent = '尚未识别到关键词，请核对卡面。';
  }
  function renderNotice(words) {
    alertBox.replaceChildren();
    if (!words || !words.length) { alertBox.hidden = true; return; }
    const list = document.createElement('div');
    list.className = 'kf-keywords-alert-list';
    words.forEach(word => list.append(renderEntry(word, true)));
    alertBox.append(list);
    alertBox.hidden = false;
  }
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; renderSearch(); });
  input.addEventListener('input', () => { if (!composing) renderSearch(); });
  window.KFKeywords = {
    setContext(value) { if (contextTitle) contextTitle.textContent = String(value || '当前 Boss 关键词'); },
    setCardDataError(value) {
      const next = Boolean(value);
      if (cardDataError === next) return;
      cardDataError = next;
      renderPersistent();
    },
    setPersistent(value) {
      const next = Array.isArray(value) ? value : [];
      if (JSON.stringify(groups) === JSON.stringify(next)) return;
      groups = next; renderPersistent();
    },
    notify(value) { pendingNotice = Array.isArray(value) ? value : []; renderNotice(pendingNotice); },
    mount(target) { return mount(target); }
  };
  renderSearch(); renderPersistent();
  fetch(dictionaryUrl).then(response => { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); }).then(data => {
    if (!Array.isArray(data.entries)) throw new Error('Invalid dictionary');
    entries = data.entries; renderSearch(); renderPersistent();
    if (pendingNotice && !alertBox.hidden) renderNotice(pendingNotice);
  }).catch(() => { loadError = true; renderSearch(); });
}());
