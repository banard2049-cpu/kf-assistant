<?php
declare(strict_types=1);

/**
 * Save current application state without ever copying the operation logs.
 * The caller must not have a transaction open on this connection.
 */
function database_state_backup(PDO $db, string $backupDir, string $label = 'manual'): string {
    if ($db->inTransaction()) throw new LogicException('A state backup requires an idle database connection.');
    if (!is_dir($backupDir) && !@mkdir($backupDir, 0770, true) && !is_dir($backupDir)) {
        throw new RuntimeException('Cannot create the backup directory.');
    }
    $safeLabel = preg_replace('/[^a-z0-9_-]/i', '-', $label) ?: 'manual';
    $suffix = bin2hex(random_bytes(8));
    $target = rtrim($backupDir, '/\\') . DIRECTORY_SEPARATOR
        . gmdate('Y-m-d\TH-i-s-v\Z') . '-' . $safeLabel . '-' . $suffix . '.db';
    $schema = 'state_backup_' . $suffix;
    $identifier = static fn(string $name): string => '"' . str_replace('"', '""', $name) . '"';
    $qualifiedSchema = $identifier($schema);
    $excluded = ['sessions' => true, 'sync_operations' => true, 'campaign_operations' => true];
    $snapshot = null;
    $attached = false;
    $started = false;
    $complete = false;

    try {
        // The first schema read establishes one source snapshot for every table.
        $db->beginTransaction();
        $started = true;
        $objects = $db->query("SELECT type,name,tbl_name,sql FROM main.sqlite_schema
            WHERE substr(name,1,7)<>'sqlite_' AND sql IS NOT NULL ORDER BY rowid")
            ->fetchAll(PDO::FETCH_ASSOC);
        $hasSequence = $db->query("SELECT 1 FROM main.sqlite_schema WHERE name='sqlite_sequence'")->fetchColumn() !== false;
        $tableInfo = [];
        foreach ($db->query('PRAGMA main.table_list')->fetchAll(PDO::FETCH_ASSOC) as $table) {
            if (($table['schema'] ?? '') === 'main') $tableInfo[$table['name']] = $table;
        }
        $tables = array_values(array_filter($objects, static fn(array $object): bool =>
            $object['type'] === 'table' && ($tableInfo[$object['name']]['type'] ?? '') !== 'shadow'));

        // Use the original SQL on the standalone connection. This preserves
        // quoted names and main-qualified views without rewriting SQL text.
        $snapshot = new PDO('sqlite:' . $target, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $snapshot->exec('PRAGMA encoding=' . $snapshot->quote((string)$db->query('PRAGMA main.encoding')->fetchColumn()));
        foreach (['page_size', 'auto_vacuum', 'application_id', 'user_version'] as $pragma) {
            $value = (int)$db->query('PRAGMA main.' . $pragma)->fetchColumn();
            $snapshot->exec('PRAGMA ' . $pragma . '=' . $value);
        }
        // Ordinary tables first, then virtual tables and their generated shadow
        // schema. Never create or copy those shadow tables a second time.
        foreach ([false, true] as $virtual) {
            foreach ($tables as $table) {
                $isVirtual = preg_match('/^\s*CREATE\s+VIRTUAL\s+TABLE\b/i', $table['sql']) === 1;
                if ($isVirtual !== $virtual) continue;
                if ($isVirtual && !$tableInfo) throw new RuntimeException('Virtual-table backups require SQLite table_list support.');
                $snapshot->exec($table['sql']);
            }
        }
        // SQLite keeps sqlite_sequence even after the last AUTOINCREMENT table
        // was dropped. Recreate that empty internal table through normal DDL.
        if ($hasSequence && $snapshot->query("SELECT 1 FROM sqlite_schema WHERE name='sqlite_sequence'")->fetchColumn() === false) {
            $seed = $identifier('backup_sequence_seed_' . $suffix);
            $snapshot->exec('CREATE TABLE ' . $seed . '(id INTEGER PRIMARY KEY AUTOINCREMENT)');
            $snapshot->exec('DROP TABLE ' . $seed);
        }
        $snapshot = null;

        $attach = $db->prepare('ATTACH DATABASE ? AS ' . $qualifiedSchema);
        $attach->execute([$target]);
        $attach = null;
        $attached = true;
        // Table order need not follow foreign-key dependency order.
        $db->exec('PRAGMA defer_foreign_keys=ON');
        foreach ([false, true] as $virtual) {
            foreach ($tables as $table) {
                $name = $table['name'];
                if (isset($excluded[$name])) continue;
                $isVirtual = preg_match('/^\s*CREATE\s+VIRTUAL\s+TABLE\b/i', $table['sql']) === 1;
                if ($isVirtual !== $virtual) continue;
                $columns = $db->query('PRAGMA main.table_xinfo(' . $identifier($name) . ')')->fetchAll(PDO::FETCH_ASSOC);
                // Generated and virtual hidden columns cannot be inserted.
                $names = array_column(array_filter($columns, static fn(array $column): bool => (int)($column['hidden'] ?? 0) === 0), 'name');
                $withoutRowid = isset($tableInfo[$name]) ? (bool)$tableInfo[$name]['wr']
                    : preg_match('/\bWITHOUT\s+ROWID\b/i', $table['sql']) === 1;
                if (!$withoutRowid) {
                    $used = array_map('strtolower', array_column($columns, 'name'));
                    foreach (['rowid', '_rowid_', 'oid'] as $rowid) {
                        if (!in_array($rowid, $used, true)) { array_unshift($names, $rowid); break; }
                    }
                }
                $list = implode(',', array_map($identifier, $names));
                $quotedTable = $identifier($name);
                $db->exec('INSERT INTO ' . $qualifiedSchema . '.' . $quotedTable . '(' . $list . ')'
                    . ' SELECT ' . $list . ' FROM main.' . $quotedTable);
            }
        }
        // Empty AUTOINCREMENT logs still need their original high-water marks.
        if ($hasSequence) {
            $db->exec('DELETE FROM ' . $qualifiedSchema . '.sqlite_sequence');
            $db->exec('INSERT INTO ' . $qualifiedSchema . '.sqlite_sequence(name,seq) SELECT name,seq FROM main.sqlite_sequence');
        }
        $db->commit();
        $started = false;
        $db->exec('DETACH DATABASE ' . $qualifiedSchema);
        $attached = false;

        // Build indexes and triggers after the copy so triggers do not replay
        // application writes, and indexes are built only for retained state.
        $snapshot = new PDO('sqlite:' . $target, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $snapshot->beginTransaction();
        foreach (['index', 'view', 'trigger'] as $type) {
            foreach ($objects as $object) {
                if ($object['type'] === $type && ($tableInfo[$object['tbl_name']]['type'] ?? '') !== 'shadow') {
                    $snapshot->exec($object['sql']);
                }
            }
        }
        $snapshot->commit();
        $snapshot = null;
        $complete = true;
        return $target;
    } finally {
        $snapshot = null;
        if ($started && $db->inTransaction()) $db->rollBack();
        try {
            if ($attached) $db->exec('DETACH DATABASE ' . $qualifiedSchema);
        } finally {
            if (!$complete) {
                foreach (['', '-journal', '-wal', '-shm'] as $extension) {
                    if (is_file($target . $extension)) @unlink($target . $extension);
                }
            }
        }
    }
}
