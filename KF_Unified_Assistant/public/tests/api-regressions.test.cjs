const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');

test('campaign import remaps module/history references and display ETags follow sheet revisions', async t => {
  const binary = spawnSync('php', ['-r', 'echo PHP_BINARY;'], { encoding: 'utf8', windowsHide: true });
  if (binary.error || binary.status !== 0) return t.skip('PHP is unavailable');
  const php = binary.stdout.trim();
  let args = [];
  const enabled = spawnSync(php, ['-r', 'echo extension_loaded("pdo_sqlite") ? "yes" : "no";'], { encoding: 'utf8', windowsHide: true });
  if (enabled.stdout.trim() !== 'yes') {
    const extensionDir = path.join(path.dirname(php), 'ext');
    if (!fs.existsSync(path.join(extensionDir, 'php_pdo_sqlite.dll'))) return t.skip('PHP pdo_sqlite is unavailable');
    args = ['-d', `extension_dir=${extensionDir}`, '-d', 'extension=pdo_sqlite'];
  }
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'kf-api-regressions-'));
  const port = await new Promise(resolve => {
    const socket = net.createServer(); socket.listen(0, '127.0.0.1', () => {
      const value = socket.address().port; socket.close(() => resolve(value));
    });
  });
  const server = spawn(php, [...args, '-S', `127.0.0.1:${port}`, '-t', path.resolve(__dirname, '..')], {
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, DATA_DIR: path.join(scratch, 'data'), BACKUP_DIR: path.join(scratch, 'backups'), ALLOW_REGISTRATION: 'true' },
  });
  let log = '', cookie = '';
  server.stdout.on('data', value => log += value); server.stderr.on('data', value => log += value);
  const url = route => {
    const [name, query] = route.split('?');
    return `http://127.0.0.1:${port}/api.php?route=${encodeURIComponent(name)}${query ? '&' + query : ''}`;
  };
  const api = async (route, method = 'GET', body) => {
    const response = await fetch(url(route), { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
    const session = response.headers.get('set-cookie'); if (session) cookie = session.split(';')[0];
    const json = await response.json();
    assert.ok(response.ok, `${route}: ${response.status} ${JSON.stringify(json)}\n${log}`);
    return json;
  };
  const op = (id, field, value, baseRevision = 0) => ({ id, clientId: 'regression_client', path: field, value, baseRevision });
  try {
    for (let attempt = 0; ; attempt++) {
      try { await api('health'); break; }
      catch (error) { if (attempt >= 40) throw error; await new Promise(resolve => setTimeout(resolve, 50)); }
    }
    await api('auth/register', 'POST', { username: 'regression_user', password: 'isolated_test_password' });
    const campaignId = (await api('campaigns')).defaultCampaignId;
    const sheet = (await api('sheets', 'POST', { campaignId, knightId: 'stoneface', title: 'test knight' })).sheet;
    await api('campaign-sync', 'POST', { campaignId, operations: [
      op('leader_operation', 'leaderSheetId', sheet.id), op('party_operation_', 'party', [sheet.id]),
      op('map_operation___', 'modules.map', { round: 6, mainKnightId: 'piece-1', knights: [{ id: 'piece-1', sheetId: sheet.id, clues: { martial: 3 } }], maps: { SK: { history: [{ knights: [{ id: 'piece-1', sheetId: sheet.id }] }] } } }),
      op('enc_operation___', 'modules.encounter', { knights: [{ id: 'piece-2', sheetId: sheet.id, space: '7', done: true }], history: [{ knights: [{ id: 'piece-2', sheetId: sheet.id }] }] }),
      op('rogue_operation_', 'modules.roguePath', { schemaVersion: 2, campaignId, activeSlotId: 'run-1', slots: [{ id: 'run-1', state: { schemaVersion: 1, partyName: 'saved run' } }] }),
    ] });
    const exported = await api('campaign-export?campaignId=' + campaignId);
    const importedId = (await api('campaign-import', 'POST', exported)).id;
    const imported = (await api('campaigns/' + importedId)).campaign.state;
    const newId = imported.party[0]; assert.notEqual(newId, sheet.id);
    assert.equal(imported.leaderSheetId, newId);
    assert.equal(imported.modules.map.knights[0].sheetId, newId);
    assert.equal(imported.modules.map.mainKnightId, 'piece-1');
    assert.equal(imported.modules.map.knights[0].clues.martial, 3);
    assert.equal(imported.modules.map.maps.SK.history[0].knights[0].sheetId, newId);
    assert.equal(imported.modules.encounter.knights[0].sheetId, newId);
    assert.equal(imported.modules.encounter.knights[0].space, '7');
    assert.equal(imported.modules.encounter.knights[0].done, true);
    assert.equal(imported.modules.encounter.history[0].knights[0].sheetId, newId);
    assert.equal(imported.modules.roguePath.campaignId, importedId);
    assert.equal(imported.modules.roguePath.slots[0].state.partyName, 'saved run');
    const copyId = (await api('campaigns/' + campaignId + '/copy', 'POST')).id;
    const copied = (await api('campaigns/' + copyId)).campaign.state;
    assert.equal(copied.modules.roguePath.campaignId, copyId);
    assert.equal(copied.modules.roguePath.slots[0].state.partyName, 'saved run');

    const syncVirtue = (id, value, base) => api('sync', 'POST', { sheetId: sheet.id, operations: [op(id, 'virtues.bravery.value', value, base)] });
    await syncVirtue('virtue_operation1', 2, 0);
    const displayRoute = 'display-state?campaignId=' + campaignId;
    const before = await fetch(url(displayRoute), { headers: { Cookie: cookie } });
    const etag = before.headers.get('etag'); await before.json();
    await syncVirtue('virtue_operation2', 3, 1);
    // Force the same updated_at value to specifically exercise revisions,
    // without relying on machine timing to fit both requests into one second.
    const sql = '$db=new PDO("sqlite:".$argv[1]);$q=$db->prepare("UPDATE knight_sheets SET updated_at=? WHERE id=?");$q->execute([$argv[2],$argv[3]]);';
    const oldTime = sheet.updated_at;
    const forceTime = value => {
      const result = spawnSync(php, [...args, '-r', sql, path.join(scratch, 'data/kf-knights.db'), value, sheet.id], { encoding: 'utf8', windowsHide: true });
      assert.equal(result.status, 0, result.stderr);
    };
    forceTime(oldTime);
    const stableBefore = await fetch(url(displayRoute), { headers: { Cookie: cookie } });
    const stableEtag = stableBefore.headers.get('etag'); await stableBefore.json();
    await syncVirtue('virtue_operation3', 4, 2); forceTime(oldTime);
    const after = await fetch(url(displayRoute), { headers: { Cookie: cookie, 'If-None-Match': stableEtag } });
    assert.equal(after.status, 200);
    assert.notEqual(after.headers.get('etag'), stableEtag);
    assert.equal((await after.json()).modules.map.knights[0].virtues.bravery, 4);
    const unchanged = await fetch(url(displayRoute), { headers: { Cookie: cookie, 'If-None-Match': after.headers.get('etag') } });
    assert.equal(unchanged.status, 304);
    assert.ok(etag);
  } finally {
    const stopped = once(server, 'exit'); server.kill(); await stopped;
    // The directory contains only this test's newly created database and backups.
    const resolvedScratch = path.resolve(scratch);
    assert.ok(resolvedScratch.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(resolvedScratch, { recursive: true, force: true });
  }
});
