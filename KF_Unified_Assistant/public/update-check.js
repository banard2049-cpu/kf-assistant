(() => {
  const API = 'https://api.github.com/repos/banard2049-cpu/kf-assistant/releases/latest';
  const RELEASES = 'https://github.com/banard2049-cpu/kf-assistant/releases';
  const CACHE = 'kf-update-cache-v1', SKIPPED = 'kf-update-skipped-v1';
  const INTERVAL = 6 * 60 * 60 * 1000;
  function parseVersion(value) {
    const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(value));
    return m ? { parts: m.slice(1, 4).map(Number), pre: m[4] || '' } : null;
  }
  function isNewer(latest, current) {
    const a = parseVersion(latest), b = parseVersion(current);
    if (!a || !b) return false;
    for (let i = 0; i < 3; i++) if (a.parts[i] !== b.parts[i]) return a.parts[i] > b.parts[i];
    if (!a.pre || !b.pre) return !a.pre && !!b.pre;
    const x = a.pre.split('.'), y = b.pre.split('.');
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      if (x[i] === undefined) return false;
      if (y[i] === undefined) return true;
      if (x[i] === y[i]) continue;
      const xn = /^\d+$/.test(x[i]), yn = /^\d+$/.test(y[i]);
      if (xn && yn) return Number(x[i]) > Number(y[i]);
      if (xn !== yn) return !xn;
      return x[i] > y[i];
    }
    return false;
  }
  function validRelease(r) { const v = r && parseVersion(r.tag_name); return !!(v && !v.pre && !r.draft && !r.prerelease); }
  if (typeof module !== 'undefined' && module.exports) { module.exports = { parseVersion, isNewer, validRelease }; return; }
  const el = id => document.getElementById(id);
  const button = el('checkUpdateButton'), status = el('updateStatus'), panel = el('updateNotice');
  if (!button || !status || !panel) return;
  const current = window.KF_APP_VERSION || 'local';
  el('appVersionLabel').textContent = `当前版本：${current === 'local' ? '本地开发版' : current}`;
  let busy = false, shownTag = '';
  function read(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
  function show(release, manual) {
    panel.hidden = true;
    if (!parseVersion(current)) { status.textContent = `当前为本地开发版，最新正式版为 ${release.tag_name}。`; return; }
    if (!isNewer(release.tag_name, current)) { status.textContent = '当前已是最新版本。'; return; }
    const skipped = read(SKIPPED) === release.tag_name;
    status.textContent = `发现新版本 ${release.tag_name}${skipped ? '（已跳过）' : ''}。`;
    if (skipped && !manual) return;
    shownTag = release.tag_name;
    el('updateHeading').textContent = `发现新版本：${current} → ${shownTag}`;
    el('updateReport').textContent = release.body || '此版本未提供更新说明，请前往 GitHub 查看。';
    el('updateGithubLink').href = `${RELEASES}/tag/${encodeURIComponent(shownTag)}`;
    panel.hidden = false;
  }
  async function check(manual = false) {
    if (busy) return;
    const cached = read(CACHE);
    if (!manual && cached && Number.isFinite(cached.at) && Date.now() - cached.at >= 0 && Date.now() - cached.at < INTERVAL && validRelease(cached.release)) { show(cached.release, false); return; }
    busy = true; button.disabled = true; status.textContent = '正在检查更新…';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(API, { signal: controller.signal, cache: 'no-store', credentials: 'omit', headers: { Accept: 'application/vnd.github+json' } });
      if (response.status === 404) throw new Error('仓库暂无正式版发布，请稍后再试。');
      if ((response.status === 403 || response.status === 429) && response.headers.get('x-ratelimit-remaining') === '0') throw new Error('GitHub 接口暂时限流，请稍后重试或前往发布页查看。');
      if (!response.ok) throw new Error(`GitHub 返回 HTTP ${response.status}，请稍后重试。`);
      const release = await response.json();
      if (!validRelease(release)) throw new Error('未找到有效的正式版，请前往发布页查看。');
      const safe = { tag_name: release.tag_name, body: typeof release.body === 'string' ? release.body : '' };
      write(CACHE, { at: Date.now(), release: safe }); show(safe, manual);
    } catch (error) {
      status.textContent = controller.signal.aborted ? '检查更新超时，请检查网络或前往发布页。' : (error.message && !/fetch|network|load failed/i.test(error.message) ? error.message : '无法连接 GitHub，请检查网络或前往发布页。');
    } finally { clearTimeout(timer); busy = false; button.disabled = false; }
  }
  button.addEventListener('click', () => void check(true));
  el('skipUpdateButton').addEventListener('click', () => { write(SKIPPED, shownTag); panel.hidden = true; status.textContent = `已跳过 ${shownTag}，下一版本仍会提醒。`; });
  el('closeUpdateButton').addEventListener('click', () => { panel.hidden = true; });
  document.querySelectorAll('.update-check a').forEach(link => link.addEventListener('click', event => {
    if (window.KFAndroidFiles && typeof window.KFAndroidFiles.openExternalUrl === 'function') { event.preventDefault(); window.KFAndroidFiles.openExternalUrl(link.href); }
  }));
  void check();
  setInterval(() => { if (!document.hidden) void check(); }, INTERVAL);
})();
