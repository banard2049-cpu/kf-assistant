<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/public/database-maintenance.php';

function check(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}
function rows(PDO $db, string $table): array {
    return $db->query('SELECT * FROM ' . $table . ' ORDER BY rowid')->fetchAll(PDO::FETCH_ASSOC);
}
function fixture(string $path): PDO {
    $db = new PDO('sqlite:' . $path, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $db->exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=1000');
    $db->exec(<<<'SQL'
CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT NOT NULL);
CREATE TABLE campaigns (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), state_json TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE knight_sheets (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), state_json TEXT NOT NULL, revision INTEGER NOT NULL);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id));
CREATE TABLE campaign_operations (seq INTEGER PRIMARY KEY AUTOINCREMENT, operation_id TEXT NOT NULL UNIQUE, campaign_id TEXT REFERENCES campaigns(id), user_id TEXT NOT NULL, client_id TEXT NOT NULL, field_path TEXT NOT NULL, value_json TEXT NOT NULL, base_revision INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX campaign_ops_idx ON campaign_operations(campaign_id,seq);
CREATE TABLE sync_operations (seq INTEGER PRIMARY KEY AUTOINCREMENT, operation_id TEXT NOT NULL UNIQUE, sheet_id TEXT REFERENCES knight_sheets(id), value_json TEXT NOT NULL);
CREATE TABLE app_meta (meta_key TEXT PRIMARY KEY, meta_value TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE user_settings (user_id TEXT PRIMARY KEY, settings_json TEXT NOT NULL);
INSERT INTO users VALUES ('owner-1','synthetic user');
INSERT INTO campaigns VALUES ('campaign-1','owner-1','{"modules":{"map":{"round":7,"history":[{"round":6}]},"aibp":{"history":[{"step":4}]}},"party":["sheet-1"]}',42,'2026-10-26T07:00:00Z');
INSERT INTO knight_sheets VALUES ('sheet-1','owner-1','{"notes":"keep current notes","story":[{"quest":"active"}]}',11);
INSERT INTO sessions VALUES ('keep-session','owner-1');
INSERT INTO sync_operations(operation_id,sheet_id,value_json) VALUES ('keep-sheet-op','sheet-1','"original scalar"');
INSERT INTO user_settings VALUES ('owner-1','{"fivePlayer":true}');
INSERT INTO app_meta VALUES ('existing-migration','complete','2026-01-01T00:00:00Z');
SQL);
    $insert = $db->prepare('INSERT INTO campaign_operations(operation_id,campaign_id,user_id,client_id,field_path,value_json,base_revision,created_at) VALUES(?,?,?,?,?,?,?,?)');
    foreach ([
        ['old-map','modules.map',json_encode(['round' => 6, 'history' => [str_repeat('旧地图状态', 160000)]], JSON_UNESCAPED_UNICODE)],
        ['old-encounter','modules.encounter',json_encode(['history' => [str_repeat('encounter-old-state-', 100000)]])],
        ['old-aibp','aibp.history',json_encode([str_repeat('old-step-', 10000)])],
        ['small-module','modules.roguePath','{"node":2}'],
        ['already-small','modules.map','{"snapshot":true}'],
        ['keep-scalar','presentation.scene','"map"'],
    ] as [$id,$field,$value]) {
        $insert->execute([$id,'campaign-1','owner-1','client-1',$field,$value,39,'2026-08-26T10:00:00Z']);
    }
    $db->exec('PRAGMA wal_checkpoint(TRUNCATE)');
    return $db;
}
function read_archive(string $path): array {
    $text = str_ends_with($path, '.gz') ? gzdecode((string)file_get_contents($path)) : file_get_contents($path);
    check(is_string($text), 'archive must be readable');
    $result = [];
    foreach (explode("\n", trim($text)) as $line) {
        $entry = json_decode($line, true, 512, JSON_THROW_ON_ERROR);
        check($entry['table'] === 'campaign_operations', 'archive identifies original table');
        $result[$entry['row']['operation_id']] = $entry['row'];
    }
    return $result;
}
function remove_fixture_tree(string $directory): void {
    foreach (new FilesystemIterator($directory, FilesystemIterator::SKIP_DOTS) as $entry) {
        if ($entry->isDir()) remove_fixture_tree($entry->getPathname());
        else unlink($entry->getPathname());
    }
    rmdir($directory);
}

$root = dirname(__DIR__) . '/tmp/test-operation-storage-' . bin2hex(random_bytes(6));
mkdir($root, 0770, true);
try {
    $backupDir = $root . '/backups';
    mkdir($backupDir);
    $dbPath = $root . '/test.db';
    $db = fixture($dbPath);
    $current = [];
    foreach (['users','campaigns','knight_sheets','sessions','sync_operations','user_settings','sqlite_sequence'] as $table) $current[$table] = rows($db, $table);
    $originalOps = rows($db, 'campaign_operations');
    clearstatcache(true, $dbPath);
    $sizeBefore = filesize($dbPath);

    // A competing startup request must leave both the state and histories alone.
    $lock = fopen($backupDir . '/.operation-storage.lock', 'c+b');
    flock($lock, LOCK_EX);
    database_maintain_operation_storage($db, $backupDir);
    check(rows($db, 'campaign_operations') === $originalOps, 'competing worker must not modify operations');
    check(count(glob($backupDir . '/*operation-history.jsonl*') ?: []) === 0, 'competing worker must not create an archive');
    flock($lock, LOCK_UN);
    fclose($lock);

    database_maintain_operation_storage($db, $backupDir);
    foreach ($current as $table => $expected) check(rows($db, $table) === $expected, 'migration preserves ' . $table . ' exactly, including undo state and sequence numbers');
    $afterOps = rows($db, 'campaign_operations');
    check(count($afterOps) === count($originalOps), 'deduplication rows must not be deleted');
    $expectedArchived = [];
    foreach ($originalOps as $index => $original) {
        $expected = $original;
        if (str_starts_with($original['field_path'], 'modules.') || str_starts_with($original['field_path'], 'aibp.')) {
            if ($original['value_json'] !== '{"snapshot":true}') $expectedArchived[$original['operation_id']] = $original;
            $expected['value_json'] = '{"snapshot":true}';
        }
        check($afterOps[$index] === $expected, 'only historical payload changes; IDs, sequence, clients and revisions survive');
    }
    $archives = glob($backupDir . '/*operation-history.jsonl*') ?: [];
    check(count($archives) === 1, 'one external history archive is created');
    check(read_archive($archives[0]) === $expectedArchived, 'archive must reconstruct every original operation row and exact Unicode JSON value');
    $snapshots = glob($backupDir . '/*.db') ?: [];
    check(count($snapshots) === 1, 'one independent safety snapshot is created');
    $snapshot = new PDO('sqlite:' . $snapshots[0], null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    check(rows($snapshot, 'campaigns') === $current['campaigns'], 'safety snapshot preserves current campaign including undo state');
    foreach (['campaign_operations','sync_operations','sessions'] as $table) check(rows($snapshot, $table) === [], 'snapshot omits ' . $table);
    $snapshot = null;
    clearstatcache(true, $dbPath);
    check(filesize($dbPath) < $sizeBefore / 4, 'compaction materially shrinks the database');
    check($db->query('PRAGMA integrity_check')->fetchColumn() === 'ok', 'compacted database passes integrity check');
    $marker = json_decode((string)$db->query("SELECT meta_value FROM app_meta WHERE meta_key='operation-payload-storage-v1'")->fetchColumn(), true, 512, JSON_THROW_ON_ERROR);
    check($marker['phase'] === 'complete', 'migration is marked complete');
    check(rows($db, 'app_meta')[0]['meta_key'] === 'existing-migration', 'previous migration markers survive');

    // Repeat every subsequent startup and retry pending compaction after a crash.
    $filesBefore = glob($backupDir . '/*') ?: [];
    $metaBefore = rows($db, 'app_meta');
    database_maintain_operation_storage($db, $backupDir);
    check(rows($db, 'app_meta') === $metaBefore, 'completed migration is a no-op');
    check((glob($backupDir . '/*') ?: []) === $filesBefore, 'repeat startup creates no duplicate backup or archive');
    $marker['phase'] = 'pending_compaction';
    $db->prepare("UPDATE app_meta SET meta_value=? WHERE meta_key='operation-payload-storage-v1'")->execute([json_encode($marker)]);
    database_maintain_operation_storage($db, $backupDir);
    check((glob($backupDir . '/*') ?: []) === $filesBefore, 'pending compaction resumes without re-archiving');
    check(rows($db, 'campaign_operations') === $afterOps, 'resume preserves deduplication records');

    // Inaccessible archive storage must fail without changing any history.
    $failureDb = fixture($root . '/failure.db');
    $failureOps = rows($failureDb, 'campaign_operations');
    $failed = false;
    try { database_maintain_operation_storage($failureDb, $root . '/missing/backups'); }
    catch (Throwable $e) { $failed = true; }
    // Exception traces retain PDO arguments until the exception is released.
    // Close that reference before deleting the fixture on Windows.
    unset($e);
    check($failed, 'unavailable backup storage reports failure');
    check(rows($failureDb, 'campaign_operations') === $failureOps, 'archive failure must preserve every historical payload');
    check((int)$failureDb->query("SELECT COUNT(*) FROM app_meta WHERE meta_key='operation-payload-storage-v1'")->fetchColumn() === 0, 'archive failure must not mark migration complete');
    $failureDb = null;
    $db = null;
    echo "database operation storage: archive fidelity, current saves, undo, deduplication, compaction, concurrency, resume and failure safety verified\n";
} finally {
    unset($snapshot, $failureDb, $db);
    remove_fixture_tree($root);
}
