const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { isNewer, validRelease } = require('../public/update-check.js');
assert.equal(isNewer('v1.5.0', '1.4.4'), true);
assert.equal(isNewer('v1.4.4', '1.4.4'), false);
assert.equal(isNewer('v1.4.4', '1.4.4-rc.1'), true);
assert.equal(isNewer('v1.4.4-rc.10', '1.4.4-rc.2'), true);
assert.equal(validRelease({ tag_name: 'v1.5.0', prerelease: true }), false);
const elements = {};
for (const id of ['checkUpdateButton', 'updateStatus', 'updateNotice', 'appVersionLabel', 'updateHeading', 'updateReport', 'updateGithubLink', 'skipUpdateButton', 'closeUpdateButton']) {
  elements[id] = { hidden: false, textContent: '', handlers: {}, addEventListener(type, handler) { this.handlers[type] = handler; } };
}
const storage = new Map();
let response = { ok: true, status: 200, json: async () => ({ tag_name: 'v1.5.0', body: '<img onerror=alert(1)>' }) };
const context = { window: { KF_APP_VERSION: '1.4.4' }, document: { getElementById: id => elements[id], querySelectorAll: () => [], hidden: false }, localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) }, fetch: async () => response, AbortController, setTimeout, clearTimeout, setInterval: () => {}, Date, console };
vm.runInNewContext(fs.readFileSync(require.resolve('../public/update-check.js'), 'utf8'), context);
const tick = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  await tick();
  assert.equal(elements.updateNotice.hidden, false);
  assert.equal(elements.updateReport.textContent, '<img onerror=alert(1)>');
  assert.match(elements.updateGithubLink.href, /v1\.5\.0$/);
  elements.skipUpdateButton.handlers.click();
  assert.equal(elements.updateNotice.hidden, true);
  elements.checkUpdateButton.handlers.click();
  await tick();
  assert.equal(elements.updateNotice.hidden, false);
  response = { ok: false, status: 403, headers: { get: () => '0' } };
  elements.checkUpdateButton.handlers.click();
  await tick();
  assert.match(elements.updateStatus.textContent, /限流/);
  assert.equal(elements.checkUpdateButton.disabled, false);
  console.log('Update check tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
