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
    const responseText = await response.text();
    let json;
    try { json = JSON.parse(responseText); }
    catch { throw new Error(`${route}: non-JSON response ${response.status}: ${responseText.slice(0, 2000)}\n${log}`); }
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
      op('rogue_operation_', 'modules.roguePath', { schemaVersion: 2, campaignId, activeSlotId: 'run-1', slots: [{ id: 'run-1', state: { schemaVersion: 2, partyName: 'saved run', stage: 'withergraal', sharedRevives: 20, postgame: true, roster: [{ id: 'rogue-knight', devotion: 3, growth: { maxVigor: 1 } }] } }] }),
    ] });
    const juraRecord = { enabled: true, level: 2, shards: 4, built: ['saints-sanctuary'], quests: { fragments: 'completed' }, loadouts: [{ name: '测试配装', level: 2, facilities: [], chants: [] }] };
    await api('user-settings', 'PATCH', { jura: juraRecord });
    const exported = await api('campaign-export?campaignId=' + campaignId);
    assert.deepEqual(exported.shared.jura, juraRecord);
    const importedId = (await api('campaign-import', 'POST', exported)).id;
    assert.deepEqual((await api('user-settings')).settings.jura, juraRecord);
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
    assert.equal(imported.modules.roguePath.slots[0].state.stage, 'withergraal');
    assert.equal(imported.modules.roguePath.slots[0].state.sharedRevives, 20);
    assert.equal(imported.modules.roguePath.slots[0].state.roster[0].devotion, 3);
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

    // Simulate an existing installation whose old sync log still contains full
    // module snapshots. A normal request after updating must migrate it without
    // changing current saves or losing operation-ID deduplication.
    const savedCampaign = (await api('campaigns/' + campaignId)).campaign;
    const databasePath = path.join(scratch, 'data/kf-knights.db');
    const runPhpJson = (source, ...parameters) => {
      const result = spawnSync(php, [...args, '-r', source, databasePath, ...parameters], { encoding: 'utf8', windowsHide: true });
      assert.equal(result.status, 0, result.stderr);
      return JSON.parse(result.stdout);
    };
    const legacyOperation = runPhpJson(`
      $db=new PDO("sqlite:".$argv[1],null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
      $q=$db->prepare("UPDATE campaign_operations SET value_json=? WHERE operation_id=?");
      $q->execute([json_encode(["obsolete"=>str_repeat("legacy map snapshot ",50000)]),"map_operation___"]);
      $q=$db->prepare("DELETE FROM app_meta WHERE meta_key=?");$q->execute(["operation-payload-storage-v1"]);
      $q=$db->prepare("SELECT * FROM campaign_operations WHERE operation_id=?");$q->execute(["map_operation___"]);
      echo json_encode($q->fetch(PDO::FETCH_ASSOC));
    `);
    assert.ok(legacyOperation.value_json.length > 900000);
    const tick = path.join(scratch, 'backups/.maintenance-tick');
    fs.utimesSync(tick, new Date(0), new Date(0));
    await api('health');
    const migrated = runPhpJson(`
      $db=new PDO("sqlite:".$argv[1]);
      $q=$db->prepare("SELECT * FROM campaign_operations WHERE operation_id=?");$q->execute(["map_operation___"]);
      $operation=$q->fetch(PDO::FETCH_ASSOC);
      $q=$db->prepare("SELECT meta_value FROM app_meta WHERE meta_key=?");$q->execute(["operation-payload-storage-v1"]);
      echo json_encode(["operation"=>$operation,"migration"=>json_decode($q->fetchColumn(),true)]);
    `);
    assert.equal(migrated.migration.phase, 'complete', log);
    assert.deepEqual(migrated.operation, { ...legacyOperation, value_json: '{"snapshot":true}' });
    const archivePath = path.join(scratch, 'backups', migrated.migration.archive);
    assert.ok(fs.existsSync(archivePath), 'Legacy payloads must be archived outside the main database');
    const archiveBytes = fs.readFileSync(archivePath);
    const archiveText = (archivePath.endsWith('.gz') ? require('node:zlib').gunzipSync(archiveBytes) : archiveBytes).toString('utf8');
    const archived = archiveText.trim().split('\n').map(line => JSON.parse(line));
    assert.deepEqual(archived.find(record => record.row.operation_id === 'map_operation___').row, legacyOperation);
    const preservedCampaign = (await api('campaigns/' + campaignId)).campaign;
    assert.deepEqual(preservedCampaign.state, savedCampaign.state, 'Automatic migration must retain current saves and undo history');
    assert.equal(preservedCampaign.revision, savedCampaign.revision);
    const retried = await api('campaign-sync', 'POST', { campaignId, operations: [
      op('map_operation___', 'modules.map', { round: 999, history: [] }, savedCampaign.revision),
    ] });
    assert.equal(retried.revision, savedCampaign.revision, 'An offline retry must remain deduplicated after migration');
    assert.deepEqual(retried.state, savedCampaign.state);
    const historyFiles = fs.readdirSync(path.join(scratch, 'backups')).filter(name => name.includes('-operation-history.jsonl'));
    fs.utimesSync(tick, new Date(0), new Date(0));
    await api('health');
    assert.deepEqual(fs.readdirSync(path.join(scratch, 'backups')).filter(name => name.includes('-operation-history.jsonl')), historyFiles,
      'Repeated maintenance must not create another archive');

    for (const level of [9, 10]) {
      const started = await api('encounters/start', 'POST', { campaignId, monster: 'postgame boss', level });
      assert.equal(started.state.encounter.level, level, 'The legacy start endpoint must preserve postgame levels');
      assert.equal(started.state.aibp.level, level);
    }
    const sheetTraits = [{ cardId: 'postgame-eggknight-5-traits', x: 67.5, y: 42.25, width: 34 }];
    const latestRevision = (await api('campaigns/' + campaignId)).campaign.revision;
    await api('campaign-sync', 'POST', { campaignId, operations: [
      op('sheet_traits_display', 'modules.aibp', { battle: {
        monsterId: 'M_Eggknight', level: 9, sheetTraits,
        aiDeck: ['hidden-ai-card'], bpDeck: ['hidden-bp-card'],
      } }, latestRevision),
    ] });
    const publicBattle = (await api(displayRoute)).modules.aibp.battle;
    assert.deepEqual(publicBattle.sheetTraits, sheetTraits, 'The second screen must receive placed trait coordinates and size');
    assert.ok(!('aiDeck' in publicBattle) && !('bpDeck' in publicBattle), 'Public traits must not expose hidden deck contents');

    const createCampaign = async name => (await api('campaigns', 'POST', { name })).campaign.id;
    const saveCampaign = (id, ...operations) => api('campaign-sync', 'POST', { campaignId: id, operations });
    const readCampaign = async id => (await api('campaigns/' + id)).campaign;

    await t.test('map sync preserves independent clue changes and resolves stale indexes by squire identity', async () => {
      const id = await createCampaign('clue synchronization');
      const squire = (sheetId, martial = 0) => ({ sheetId, memberType: 'squire', clues: { martial } });
      const bartos = 'squire:bartos', caelia = 'squire:caelia';
      const firstMap = { round: 1, trackers: { time: 2 }, knights: [squire(bartos), squire(caelia)] };
      const original = await saveCampaign(id, op('map_clue_initial', 'modules.map', firstMap));
      const adjusted = await saveCampaign(id, {
        ...op('map_clue_delta_1', 'modules.map.knights.0.clues.martial', 1, original.revision),
        squireId: bartos, clueDelta: 1,
      });
      assert.deepEqual(adjusted.state.modules.map.knights, [squire(bartos, 1), squire(caelia)]);

      const staleMap = { round: 2, trackers: { time: 3 }, knights: [squire(caelia), squire(bartos)] };
      const staleWrite = op('map_clue_stale', 'modules.map', staleMap, original.revision);
      const merged = await saveCampaign(id, staleWrite);
      assert.equal(merged.conflicts[0].resolution, 'merged');
      assert.deepEqual(merged.state.modules.map, { ...staleMap, knights: [squire(caelia), squire(bartos, 1)] });
      const retried = await saveCampaign(id, staleWrite);
      assert.equal(retried.revision, merged.revision);
      assert.equal(retried.conflicts[0].resolution, 'merged');
      assert.deepEqual(retried.state, merged.state);

      const undo = { ...staleMap, round: 1, knights: [squire(caelia), squire(bartos)] };
      const undone = await saveCampaign(id, op('map_clue_undo', 'modules.map', undo, merged.revision));
      assert.deepEqual(undone.state.modules.map, undo, 'Fresh whole-map undo can intentionally change round and clues');

      const latestMap = { ...undo, round: 3, knights: [squire(bartos, 4), squire(caelia, 2)] };
      const latest = await saveCampaign(id, op('map_clue_latest', 'modules.map', latestMap, undone.revision));
      const staleIndexUpdate = {
        ...op('map_clue_delta_2', 'modules.map.knights.1.clues.martial', 1, undone.revision),
        squireId: bartos, clueDelta: 1,
      };
      const afterReorder = await saveCampaign(id, staleIndexUpdate);
      assert.deepEqual(afterReorder.state.modules.map, { ...latestMap, knights: [squire(bartos, 5), squire(caelia, 2)] });
      const concurrentDelta = await saveCampaign(id, { ...staleIndexUpdate, id: 'map_clue_delta_3' });
      assert.deepEqual(concurrentDelta.state.modules.map.knights, [squire(bartos, 6), squire(caelia, 2)]);

      const staleLegacy = await fetch(url('campaign-sync'), {
        method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ campaignId: id, operations: [
          op('map_clue_legacy_stale', 'modules.map.knights.1.clues.martial', 1, undone.revision),
        ] }),
      });
      assert.equal(staleLegacy.status, 409);
      assert.deepEqual((await readCampaign(id)).state, concurrentDelta.state);

      // Before this fix, a newer child revision was stored by array index.
      // Simulate that legacy database metadata without changing its state.
      runPhpJson(`
        $db=new PDO("sqlite:".$argv[1]);
        $q=$db->prepare("SELECT field_versions_json FROM campaigns WHERE id=?");$q->execute([$argv[2]]);
        $versions=json_decode($q->fetchColumn(),true);
        $versions["modules.map.knights.0.clues.martial"]=$versions["modules.map.squireClues.squire:bartos.martial"];
        unset($versions["modules.map.squireClues.squire:bartos.martial"]);
        $q=$db->prepare("UPDATE campaigns SET field_versions_json=? WHERE id=?");$q->execute([json_encode($versions),$argv[2]]);
        echo json_encode($versions);
      `, id);
      const fromLegacy = await saveCampaign(id, op('map_clue_legacy_root', 'modules.map', { ...latestMap, round: 4 }, latest.revision));
      assert.equal(fromLegacy.conflicts[0].resolution, 'merged');
      assert.deepEqual(fromLegacy.state.modules.map.knights, [squire(bartos, 6), squire(caelia, 2)]);
    });

    await t.test('AIBP cleanup retains operation IDs and retry does not replay or prune', async () => {
      const a = await createCampaign('battle A'), b = await createCampaign('battle B');
      const battle = turn => ({ battle: { turn }, history: [{ turn: turn - 1 }] });
      const firstA = op('battle_a_first', 'modules.aibp', battle(1));
      await saveCampaign(a, firstA);
      await saveCampaign(b, op('battle_b_first', 'modules.aibp', battle(1)));
      const afterPruning = await readCampaign(a);
      assert.deepEqual(afterPruning.state.modules.aibp, { ...battle(1), history: [] });

      const advanced = await saveCampaign(a, op('battle_a_advanced', 'modules.aibp', battle(2), afterPruning.revision));
      const retry = await saveCampaign(a, firstA);
      assert.equal(retry.revision, advanced.revision);
      assert.deepEqual(retry.state.modules.aibp, battle(2));

      const beforeB = await readCampaign(b);
      await saveCampaign(b, op('battle_b_advanced', 'modules.aibp', battle(2), beforeB.revision));
      const latestA = await readCampaign(a), latestB = await readCampaign(b);
      const anotherRetry = await saveCampaign(a, firstA);
      assert.equal(anotherRetry.revision, latestA.revision);
      assert.deepEqual(anotherRetry.state.modules.aibp, { ...battle(2), history: [] });
      assert.deepEqual(await readCampaign(b), latestB, 'A duplicate cannot prune undo history from another campaign');
    });
  } finally {
    const stopped = once(server, 'exit'); server.kill(); await stopped;
    // The directory contains only this test's newly created database and backups.
    const resolvedScratch = path.resolve(scratch);
    assert.ok(resolvedScratch.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(resolvedScratch, { recursive: true, force: true });
  }
});
