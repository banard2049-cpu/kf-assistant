// Run with Playwright, Chrome or Edge, and PHP with pdo_sqlite installed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { once } = require('node:events');
const { chromium } = require('playwright');

const application = path.resolve(__dirname, '../public');
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function waitFor(get, matches, description) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const value = await get();
    if (matches(value)) return value;
    await delay(100);
  }
  assert.fail(description);
}

async function awaitJournal(page, expected) {
  await page.waitForFunction(async ({ queue, field, values }) => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('kf-knight-sheet', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const rows = await new Promise((resolve, reject) => {
        const request = database.transaction('sync').objectStore('sync').getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return values.every(value => rows.some(row => row?.queue === queue && row.operation?.[field] === value));
    } finally {
      database.close();
    }
  }, expected);
}

async function main() {
  const php = execFileSync('php', ['-r', 'echo PHP_BINARY;'], { encoding: 'utf8' });
  const sqlite = execFileSync(php, ['-r', 'echo extension_loaded("pdo_sqlite") ? "yes" : "no";'], { encoding: 'utf8' });
  const extensions = sqlite === 'yes' ? [] : ['-d', 'extension_dir=' + path.join(path.dirname(php), 'ext'), '-d', 'extension=pdo_sqlite'];
  const probe = net.createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const base = 'http://127.0.0.1:' + port;
  const temporaryRoot = fs.realpathSync(os.tmpdir());
  const scratch = fs.mkdtempSync(path.join(temporaryRoot, 'kf-offline-settings-test-'));
  const server = spawn(php, [...extensions, '-S', '127.0.0.1:' + port, '-t', application], {
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, DATA_DIR: path.join(scratch, 'data'), BACKUP_DIR: path.join(scratch, 'backups'), ALLOW_REGISTRATION: 'true' },
  });
  const serverExit = once(server, 'exit');
  let log = '', browser;
  server.stderr.on('data', chunk => { log = (log + chunk).slice(-4000); });
  try {
    await waitFor(async () => {
      try { return (await fetch(base + '/api.php?route=health')).ok; }
      catch { return false; }
    }, Boolean, 'Local PHP fixture did not start');
    const browserPath = process.env.KF_TEST_BROWSER;
    browser = await chromium.launch({ headless: true, ...(browserPath ? { executablePath: browserPath } : {}) });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
    const errors = [];
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    async function api(route, method = 'GET', data) {
      const response = await context.request.fetch(base + '/api.php?route=' + encodeURIComponent(route), { method, data });
      assert.ok(response.ok(), route + ': ' + response.status() + ' ' + await response.text());
      return response.json();
    }
    const { user } = await api('auth/register', 'POST', { username: 'offline_fixture', password: 'testing_only_password' });
    const { defaultCampaignId: campaignId } = await api('campaigns');
    const { sheet: first } = await api('sheets', 'POST', { campaignId, knightId: 'stoneface', title: 'Offline fixture A' });
    const { sheet: second } = await api('sheets', 'POST', { campaignId, knightId: 'kara', title: 'Offline fixture B' });
    const open = async () => {
      const page = await context.newPage();
      page.setDefaultTimeout(12000);
      await page.goto(base + '/');
      await page.locator('#permanentStoryMarkerGroups [data-permanent-story-marker]').first().waitFor({ state: 'attached' });
      return page;
    };

    const offlineA = await open();
    const offlineB = await open();
    await offlineA.locator('#sheetList [data-sheet="' + first.id + '"]').click();
    await offlineB.locator('#sheetList [data-sheet="' + second.id + '"]').click();
    await offlineA.locator('#sheetForm').waitFor();
    await offlineB.locator('#sheetForm').waitFor();
    await context.setOffline(true);
    await offlineA.locator('[data-path="notes"]').fill('offline note from tab A');
    await offlineB.locator('[data-path="gold"]').fill('37');
    await awaitJournal(offlineB, { queue: 'sheet', field: 'sheetId', values: [first.id, second.id] });
    await offlineA.close();
    await offlineB.close();
    await context.setOffline(false);
    const pageA = await open();
    await waitFor(() => api('sheets/' + first.id), data => data.sheet.state.notes === 'offline note from tab A', 'First offline edit disappeared');
    await waitFor(() => api('sheets/' + second.id), data => data.sheet.state.gold === 37, 'Second offline edit disappeared');
    console.log('Concurrent offline edits on two sheets persisted and synced after both tabs closed.');

    const pageB = await open();
    const markers = await pageA.locator('[data-permanent-story-marker]').evaluateAll(inputs => inputs.slice(0, 3).map(input => input.dataset.permanentStoryMarker));
    const marker = (page, id) => page.locator('[data-permanent-story-marker="' + id + '"]');
    const setMarker = (page, id) => marker(page, id).evaluate(input => input.click());
    const settings = async () => (await api('user-settings')).settings;
    await setMarker(pageA, markers[0]);
    await waitFor(settings, value => value.storyMarkers[markers[0]] === true, 'First marker did not sync');
    assert.equal(await marker(pageB, markers[0]).isChecked(), false, 'Second tab must still have the stale marker snapshot');
    await pageB.locator('#juraPanel [data-jura-enabled]').check();
    const afterJura = await waitFor(settings, value => value.jura?.enabled === true, 'Jura update did not sync');
    assert.equal(afterJura.storyMarkers[markers[0]], true, 'Stale Jura edit erased the first marker');
    console.log('Changing Jura in a stale tab preserved the saved story marker.');

    let firstPatch, navigating = false, releasePatch;
    const patchGate = new Promise(resolve => { releasePatch = resolve; });
    await pageA.route(url => url.pathname === '/' || url.pathname === '/api.php', async route => {
      const request = route.request(), url = new URL(request.url());
      if (request.isNavigationRequest()) navigating = true;
      if (url.searchParams.get('route') !== 'user-settings' || request.method() !== 'PATCH' || navigating) {
        return route.continue();
      }
      if (firstPatch) return route.abort();
      firstPatch = route.fetch();
      const response = await firstPatch;
      await patchGate;
      await route.fulfill({ response });
    });
    await setMarker(pageA, markers[1]);
    const accepted = await waitFor(async () => firstPatch, Boolean, 'Delayed marker request did not reach PHP');
    assert.ok(accepted.ok(), 'First delayed PATCH was rejected');
    await setMarker(pageA, markers[2]);
    await awaitJournal(pageA, { queue: 'settings', field: 'key', values: [markers[2]] });
    const acknowledged = pageA.waitForResponse(response => response.request().method() === 'PATCH'
      && new URL(response.url()).searchParams.get('route') === 'user-settings' && response.ok());
    releasePatch();
    await acknowledged;
    await pageA.waitForFunction(({ userId, key }) => {
      const cached = JSON.parse(localStorage.getItem('kf-user-settings-' + userId) || 'null');
      return cached?.settings?.storyMarkers?.[key] === true;
    }, { userId: user.id, key: markers[1] });
    assert.equal((await settings()).storyMarkers[markers[2]], undefined, 'Second rapid edit reached PHP before the reload');
    await pageA.reload();
    const afterReload = await waitFor(settings, value => value.storyMarkers[markers[2]] === true, 'Edit made during an in-flight PATCH was lost on reload');
    assert.ok(markers.every(id => afterReload.storyMarkers[id] === true));
    assert.equal(afterReload.jura.enabled, true);
    assert.deepEqual(errors, []);
    console.log('A second marker edited during an in-flight PATCH survived its acknowledgment and browser reload.');
  } catch (error) {
    console.error(log);
    throw error;
  } finally {
    if (browser) await browser.close();
    if (server.exitCode === null && server.signalCode === null) server.kill();
    await serverExit;
    if (path.dirname(scratch) === temporaryRoot && path.basename(scratch).startsWith('kf-offline-settings-test-')) {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
