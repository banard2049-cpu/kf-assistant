<?php
declare(strict_types=1);

require dirname(__DIR__) . '/public/database-backup.php';

function check(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}
function test_database(string $path): PDO {
    $db = new PDO('sqlite:' . $path, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $db->exec('PRAGMA foreign_keys=ON');
    return $db;
}
function schema_rows(PDO $db): array {
    return $db->query("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL ORDER BY type,name")
        ->fetchAll(PDO::FETCH_ASSOC);
}
function remove_test_directory(string $directory): void {
    foreach (new FilesystemIterator($directory) as $item) {
        if ($item->isDir()) remove_test_directory($item->getPathname());
        else unlink($item->getPathname());
    }
    rmdir($directory);
}

$scratch = sys_get_temp_dir() . DIRECTORY_SEPARATOR . "kf-backup-quote'-" . bin2hex(random_bytes(6));
mkdir($scratch, 0770, true);
$db = $snapshot = $failed = null;
try {
    $db = test_database($scratch . '/source.db');
    $db->exec('PRAGMA journal_mode=WAL');
    $db->exec('PRAGMA application_id=123456');
    $db->exec('PRAGMA user_version=17');
    // A child table deliberately precedes its parent in the schema.
    $db->exec(<<<'SQL'
CREATE TABLE future_child(id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES users(id), note TEXT);
CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE);
CREATE TABLE sessions(token TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id));
CREATE TABLE campaign_operations(seq INTEGER PRIMARY KEY AUTOINCREMENT, operation_id TEXT UNIQUE, value_json TEXT);
CREATE TABLE sync_operations(seq INTEGER PRIMARY KEY AUTOINCREMENT, operation_id TEXT UNIQUE, value_json TEXT);
CREATE TABLE campaigns(id TEXT PRIMARY KEY, state_json TEXT NOT NULL, revision INTEGER NOT NULL);
ALTER TABLE campaigns ADD COLUMN future_column TEXT DEFAULT 'migrated';
CREATE TABLE app_meta(meta_key TEXT PRIMARY KEY, meta_value TEXT);
CREATE TABLE "odd "" table"(label TEXT, payload BLOB, nullable TEXT, derived TEXT GENERATED ALWAYS AS (upper(label)) STORED);
CREATE TABLE audit(message TEXT);
CREATE TABLE natural_keys(key TEXT PRIMARY KEY, value TEXT) WITHOUT ROWID;
CREATE INDEX future_child_note_idx ON future_child(note) WHERE note IS NOT NULL;
CREATE VIEW current_campaigns AS SELECT id,state_json,revision FROM main.campaigns;
CREATE TRIGGER campaign_audit AFTER INSERT ON campaigns BEGIN INSERT INTO audit(message) VALUES(new.id); END;
INSERT INTO users(username) VALUES('saved user');
INSERT INTO future_child VALUES(7,1,'future data');
INSERT INTO sessions VALUES('do not back up this session',1);
INSERT INTO campaigns(id,state_json,revision) VALUES('campaign-1','{"modules":{"map":{"round":12,"history":["undo"]}}}',123);
INSERT INTO app_meta VALUES('migration-marker','retained');
INSERT INTO "odd "" table"(rowid,label,payload,nullable) VALUES(91,'quoted',X'00FF0102',NULL);
INSERT INTO natural_keys VALUES('preserved key','preserved value');
SQL);
    $insert = $db->prepare('INSERT INTO campaign_operations(seq,operation_id,value_json) VALUES(?,?,?)');
    $insert->execute([900, 'historical-campaign-operation', str_repeat('historical payload ', 600000)]);
    $insert = null;
    $db->exec("INSERT INTO sync_operations VALUES(700,'historical-sheet-operation','old sheet payload')");
    $hasFts = in_array('ENABLE_FTS5', $db->query('PRAGMA compile_options')->fetchAll(PDO::FETCH_COLUMN), true);
    if ($hasFts) {
        $db->exec('CREATE VIRTUAL TABLE future_search USING fts5(text)');
        $db->exec("INSERT INTO future_search(rowid,text) VALUES(42,'searchable future state')");
    }
    $db->exec("ATTACH DATABASE ':memory:' AS unrelated_schema");
    $db->exec('CREATE TABLE unrelated_schema.unrelated_table(value TEXT)');
    $beforeSchema = schema_rows($db);
    $beforeSequences = $db->query('SELECT name,seq FROM sqlite_sequence ORDER BY name')->fetchAll(PDO::FETCH_ASSOC);
    $target = database_state_backup($db, $scratch . "/backups'quoted", 'manual / quoted');
    $second = database_state_backup($db, $scratch . "/backups'quoted", 'manual / quoted');
    check($target !== $second && is_file($target) && is_file($second), 'Backups must have collision-safe filenames.');
    $snapshot = test_database($target);
    check(schema_rows($snapshot) === $beforeSchema, 'The complete schema must survive exactly.');
    check($snapshot->query('PRAGMA integrity_check')->fetchColumn() === 'ok', 'Backup integrity check failed.');
    check($snapshot->query('PRAGMA foreign_key_check')->fetchAll() === [], 'Backup foreign keys must be valid.');
    check((int)$snapshot->query('PRAGMA application_id')->fetchColumn() === 123456, 'Application ID must survive.');
    check((int)$snapshot->query('PRAGMA user_version')->fetchColumn() === 17, 'Schema version must survive.');
    foreach (['sessions', 'campaign_operations', 'sync_operations'] as $table) {
        check((int)$snapshot->query('SELECT COUNT(*) FROM ' . $table)->fetchColumn() === 0, $table . ' must be empty.');
    }
    check($snapshot->query('SELECT name,seq FROM sqlite_sequence ORDER BY name')->fetchAll(PDO::FETCH_ASSOC) === $beforeSequences,
        'Every AUTOINCREMENT high-water mark must survive, including empty logs.');
    foreach (['users', 'future_child', 'campaigns', 'app_meta', 'audit', 'natural_keys'] as $table) {
        check($snapshot->query('SELECT * FROM ' . $table)->fetchAll(PDO::FETCH_ASSOC) === $db->query('SELECT * FROM ' . $table)->fetchAll(PDO::FETCH_ASSOC),
            $table . ' current state must remain identical.');
    }
    $quotedQuery = 'SELECT rowid,label,hex(payload),nullable,derived FROM "odd "" table"';
    check($snapshot->query($quotedQuery)->fetchAll(PDO::FETCH_ASSOC) === $db->query($quotedQuery)->fetchAll(PDO::FETCH_ASSOC),
        'Quoted identifiers, rowids, blobs, nulls and generated columns must survive.');
    check($snapshot->query('SELECT COUNT(*) FROM current_campaigns')->fetchColumn() === 1, 'Standalone views must resolve main correctly.');
    if ($hasFts) {
        check((int)$snapshot->query("SELECT rowid FROM future_search WHERE future_search MATCH 'searchable'")->fetchColumn() === 42,
            'Virtual tables and their indexes must preserve current rows.');
    }
    $snapshot->exec("INSERT INTO campaigns(id,state_json,revision) VALUES('after-restore','{}',1)");
    check((int)$snapshot->query('SELECT COUNT(*) FROM audit')->fetchColumn() === 2, 'Triggers must remain functional without firing during backup.');
    $snapshot->exec("INSERT INTO campaign_operations(operation_id,value_json) VALUES('new operation','{}')");
    check((int)$snapshot->query("SELECT seq FROM campaign_operations WHERE operation_id='new operation'")->fetchColumn() === 901,
        'Restored operation IDs must continue above the previous high-water mark.');
    check((int)$db->query('SELECT length(value_json) FROM campaign_operations')->fetchColumn() === strlen('historical payload ') * 600000,
        'Backing up must leave source operation payloads intact.');
    check(filesize($target) < 500000, 'Backup size must exclude historical payloads.');
    check(count($db->query('PRAGMA database_list')->fetchAll()) === 2, 'Success must detach only the backup connection.');
    $snapshot = null;

    $db->beginTransaction();
    try {
        database_state_backup($db, $scratch . '/backups', 'nested');
        throw new RuntimeException('Nested transaction should be rejected.');
    } catch (LogicException $expected) {
        check($db->inTransaction(), 'Rejecting a nested call must preserve the caller transaction.');
    } finally { $db->rollBack(); }

    // A source CHECK violation forces failure after ATTACH and partial copying.
    $failed = test_database($scratch . '/invalid-source.db');
    $failed->exec('CREATE TABLE invalid_state(value INTEGER CHECK(value>0))');
    $failed->exec('PRAGMA ignore_check_constraints=ON');
    $failed->exec('INSERT INTO invalid_state VALUES(-1)');
    $failed->exec('PRAGMA ignore_check_constraints=OFF');
    try {
        database_state_backup($failed, $scratch . '/failed-backups');
        throw new RuntimeException('Copy failure should propagate.');
    } catch (PDOException $expected) {
        check(!$failed->inTransaction(), 'Failure must roll back the source transaction.');
        check(count($failed->query('PRAGMA database_list')->fetchAll()) === 1, 'Failure must detach the backup.');
        check(glob($scratch . '/failed-backups/*') === [], 'Failure must remove every partial backup file.');
        check((int)$failed->query('SELECT value FROM invalid_state')->fetchColumn() === -1, 'Failure must leave source rows untouched.');
    }
    $expected = null;

    // A database may retain an empty sqlite_sequence after dropping its last
    // AUTOINCREMENT table; that schema must remain a valid backup source.
    $failed = test_database($scratch . '/dropped-sequence.db');
    $failed->exec('CREATE TABLE removed(id INTEGER PRIMARY KEY AUTOINCREMENT)');
    $failed->exec('DROP TABLE removed');
    $target = database_state_backup($failed, $scratch . '/sequence-backup');
    $snapshot = test_database($target);
    check(schema_rows($snapshot) === schema_rows($failed), 'An orphaned sqlite_sequence schema must survive.');
    $snapshot = null;
    echo "database state backup: schema, current state, history exclusion, sequence continuity, quoting, uniqueness and failure cleanup verified\n";
} finally {
    $db = $snapshot = $failed = null;
    remove_test_directory($scratch);
}
