// Run with Playwright installed, or point NODE_PATH at a bundled installation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../public');
const campaignId = '11111111-1111-4111-8111-111111111111';
const state = { schemaVersion: 2, kingdom: 'sunken', party: [], squires: [], modules: {}, monsterPool: {}, presentation: {} };
let revision = 0;
const sheet = { id: '22222222-2222-4222-8222-222222222222', title: '测试骑士', revision: 0, state: { knight: 'Stoneface', gold: 30 } };
const shared = { storyMarkers: {}, passwords: [], jura: null };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api.php') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const route = url.searchParams.get('route');
      let value;
      if (route === 'auth/me') value = { user: { id: 'test-user', username: 'browser-test' } };
      else if (route === 'config') value = { registration: false };
      else if (route === 'user-settings') {
        if (req.method === 'PATCH') {
          const payload = JSON.parse(body);
          Object.assign(shared, payload);
        }
        value = { settings: shared };
      }
      else if (route === 'campaigns') value = { campaigns: [{ id: campaignId, name: '尤拉测试' }], defaultCampaignId: campaignId };
      else if (route === `campaigns/${campaignId}`) value = { campaign: { id: campaignId, state, revision } };
      else if (route === 'sheets') value = { sheets: url.searchParams.get('trash') === '1' ? [] : [sheet] };
      else if (route === 'campaign-sync') {
        const payload = JSON.parse(body);
        for (const op of payload.operations) {
          const keys = op.path.split('.');
          let target = state;
          for (const key of keys.slice(0, -1)) target = target[key] ||= {};
          target[keys.at(-1)] = op.value;
          revision++;
        }
        value = { state, revision, conflicts: [] };
      } else if (route === 'sync') {
        const payload = JSON.parse(body);
        assert.equal(payload.sheetId, sheet.id);
        for (const op of payload.operations) {
          assert.equal(op.path, 'gold');
          sheet.state.gold = op.value;
          sheet.revision++;
        }
        value = { state: sheet.state, revision: sheet.revision, conflicts: [] };
      } else {
        res.writeHead(404, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: route })); return;
      }
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(value));
    });
    return;
  }
  const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, ...(process.env.KF_TEST_BROWSER ? { executablePath: process.env.KF_TEST_BROWSER } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const panel = page.locator('#juraPanel');
    await panel.locator('[data-jura-enabled]').check();
    assert.equal(await panel.locator('[data-jura-quest="fragments-of-the-past"]').isVisible(), true, 'all commissions are listed horizontally');
    await panel.locator('[data-jura-level-select]').selectOption('1');
    assert.match(await panel.locator('[data-jura-level-select]').textContent(), /低层 · 设施 3 槽 · 圣言 1 槽/);
    await panel.locator('[data-jura-quest="fragments-of-the-past"]').check();
    await panel.locator('[data-jura-shards]').fill('20');
    await panel.locator('[data-jura-shard-step="1"]').click();
    assert.equal(await panel.locator('[data-jura-shards]').inputValue(), '21');
    await panel.locator('[data-jura-shard-step="-1"]').click();
    assert.equal(await panel.locator('[data-jura-shards]').inputValue(), '20');
    const chant = panel.locator('.jura-build-item').filter({ hasText: '振奋祷言' });
    assert.match(await chant.textContent(), /一名被击倒的骑士立即站起/);
    await chant.locator('[data-jura-preview="uplifting-prayer"]').click();
    assert.equal(await page.locator('#juraCardDialog').isVisible(), true);
    assert.match(await page.locator('#juraCardDialog').textContent(), /红色标志表示「危险」/);
    await page.locator('[data-jura-close-preview]').click();
    assert.equal(await panel.locator(`[data-jura-payer-id="${sheet.id}"]`).isChecked(), true);
    const goldSaved = page.waitForResponse(response => new URL(response.url()).searchParams.get('route') === 'sync' && response.ok());
    await chant.locator('[data-jura-action="build"]').click();
    await goldSaved;
    await page.waitForFunction(() => document.querySelector('#saveState').textContent === '已保存');
    assert.equal(shared.jura.level, 1);
    assert.equal(shared.jura.shards, 17);
    assert.ok(shared.jura.built.includes('uplifting-prayer'));
    assert.equal(shared.jura.quests['fragments-of-the-past'], 'completed');
    assert.equal(sheet.state.gold, 25, 'building deducts gold from the selected knight sheet');
    assert.equal(await chant.locator('.jura-built-mark').textContent(), '已建造');
    await panel.locator('[data-jura-loadout-open][data-jura-loadout-kind="chant"]').first().click();
    assert.equal(await page.locator('#juraLoadoutDialog').isVisible(), true);
    await page.locator('[data-jura-loadout-choose="uplifting-prayer"]').click();
    assert.equal(await panel.locator('[data-jura-loadout-remove][data-jura-loadout-id="uplifting-prayer"]').count(), 1);
    await panel.locator('[data-jura-loadout-name]').fill('测试配装');
    const loadoutSaved = page.waitForResponse(response => new URL(response.url()).searchParams.get('route') === 'user-settings'
      && response.request().method() === 'PATCH' && response.ok()
      && response.request().postDataJSON()?.jura?.loadouts?.some(item => item.name === '测试配装'));
    await panel.locator('[data-jura-loadout-save] button[type="submit"]').click();
    await loadoutSaved;
    await page.waitForFunction(() => document.querySelector('#saveState').textContent === '已保存');
    assert.match(await panel.locator('.jura-saved-loadouts').textContent(), /测试配装/);
    assert.equal(shared.jura.loadoutChants.includes('uplifting-prayer'), true);
    assert.equal(shared.jura.loadouts[0].name, '测试配装');
    await page.reload();
    assert.match(await panel.locator('.jura-build-item').filter({ hasText: '振奋祷言' }).textContent(), /已建造/);
    assert.match(await panel.locator('.jura-saved-loadouts').textContent(), /测试配装/);
    assert.equal(await panel.locator('[data-jura-loadout-remove][data-jura-loadout-id="uplifting-prayer"]').count(), 1);
    assert.equal(await panel.locator('[data-jura-level-select]').inputValue(), '1');
    assert.match(await panel.locator('[data-jura-payer-menu] summary').textContent(), /测试骑士/);
    assert.match(await panel.locator('[data-jura-payer-menu] summary').textContent(), /25/);
    const mobile = { width: 390, height: 844 };
    await page.setViewportSize(mobile);
    await page.locator('#menuButton').click();
    await page.locator('#openJura').click();
    assert.equal(await panel.isVisible(), true);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false, 'mobile layout must not overflow horizontally');
    const screenshot = process.env.KF_JURA_SCREENSHOT;
    if (screenshot) { await page.setViewportSize({ width: 1440, height: 1050 }); await panel.screenshot({ path: screenshot }); }
    assert.deepEqual(errors, []);
    console.log('Jura browser flow passed: tier, slots, shards, horizontal commissions, sheet-funded construction, reload and mobile layout.');
  } finally {
    await browser.close(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
