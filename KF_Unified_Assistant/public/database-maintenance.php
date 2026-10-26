<?php
declare(strict_types=1);

require_once __DIR__ . '/database-backup.php';

/**
 * Older releases logged an entire module snapshot for every sync operation.
 * These values are never replayed: current state (including undo history) lives
 * in campaigns.state_json, and operation IDs are used only for deduplication.
 * Archive the old values before replacing them, retaining every operation ID.
 */
function database_maintain_operation_storage(PDO $db, string $backupDir): array {
    $key = 'operation-payload-storage-v1';
    $read = $db->prepare('SELECT meta_value FROM app_meta WHERE meta_key=?');
    $read->execute([$key]);
    $progress = json_decode((string)($read->fetchColumn() ?: '{}'), true);
    if (($progress['phase'] ?? '') === 'complete') return $progress;

    $lock = @fopen($backupDir . DIRECTORY_SEPARATOR . '.operation-storage.lock', 'c+b');
    if ($lock === false) throw new RuntimeException('Cannot open operation archive lock');
    if (!flock($lock, LOCK_EX | LOCK_NB)) {
        fclose($lock);
        return ['phase' => 'busy'];
    }
    $partial = null;
    $stream = null;
    $inTransaction = false;
    try {
        // A different worker may have completed the migration before the lock.
        $read->execute([$key]);
        $progress = json_decode((string)($read->fetchColumn() ?: '{}'), true);
        $read->closeCursor();
        if (($progress['phase'] ?? '') === 'complete') return $progress;
        $save = $db->prepare('INSERT INTO app_meta(meta_key,meta_value,updated_at) VALUES(?,?,?) '
            . 'ON CONFLICT(meta_key) DO UPDATE SET meta_value=excluded.meta_value,updated_at=excluded.updated_at');
        $placeholder = '{"snapshot":true}';
        $where = "(substr(field_path,1,8)='modules.' OR field_path='aibp' OR substr(field_path,1,5)='aibp.') AND value_json<>?";

        if (($progress['phase'] ?? '') !== 'pending_compaction') {
            $hasLegacy = $db->prepare('SELECT 1 FROM campaign_operations WHERE ' . $where . ' LIMIT 1');
            $hasLegacy->execute([$placeholder]);
            $needsArchive = $hasLegacy->fetchColumn() !== false;
            $hasLegacy->closeCursor();
            // Backups contain only current state, never a second full copy of
            // the oversized history. The archive below preserves those values.
            $safety = $needsArchive ? database_state_backup($db, $backupDir, 'before-operation-storage') : null;
            $db->exec('BEGIN IMMEDIATE');
            $inTransaction = true;
            $rows = $db->prepare('SELECT * FROM campaign_operations WHERE ' . $where . ' ORDER BY seq');
            $rows->execute([$placeholder]);
            $count = 0;
            $archive = null;
            $gzip = function_exists('gzopen');
            while ($row = $rows->fetch(PDO::FETCH_ASSOC)) {
                if ($stream === null) {
                    $archive = $backupDir . DIRECTORY_SEPARATOR . gmdate('Y-m-d\TH-i-s\Z')
                        . '-' . bin2hex(random_bytes(6)) . '-operation-history.jsonl' . ($gzip ? '.gz' : '');
                    $partial = $archive . '.partial';
                    $stream = $gzip ? @gzopen($partial, 'wb6') : @fopen($partial, 'xb');
                    if ($stream === false) {
                        $stream = null;
                        throw new RuntimeException('Cannot create operation archive');
                    }
                }
                $line = json_encode(['table' => 'campaign_operations', 'row' => $row],
                    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n";
                $offset = 0;
                while ($offset < strlen($line)) {
                    $written = $gzip ? gzwrite($stream, substr($line, $offset)) : fwrite($stream, substr($line, $offset));
                    if ($written === false || $written === 0) throw new RuntimeException('Cannot finish operation archive');
                    $offset += $written;
                }
                $count++;
            }
            $rows->closeCursor();
            if ($stream !== null) {
                $closed = $gzip ? gzclose($stream) : fclose($stream);
                $stream = null;
                if (!$closed || !@rename($partial, $archive)) throw new RuntimeException('Cannot finalize operation archive');
                $partial = null;
            }
            // The finalized archive exists before any historical payload changes.
            // Keep sequence numbers and IDs so old offline retries still dedupe.
            $update = $db->prepare('UPDATE campaign_operations SET value_json=? WHERE ' . $where);
            $update->execute([$placeholder, $placeholder]);
            $progress = ['phase' => 'pending_compaction', 'rows' => $count,
                'archive' => $archive === null ? null : basename($archive),
                'backup' => $safety === null ? null : basename($safety)];
            $save->execute([$key, json_encode($progress, JSON_THROW_ON_ERROR), gmdate('Y-m-d\TH:i:s\Z')]);
            $db->exec('COMMIT');
            $inTransaction = false;
        }

        // VACUUM runs outside the transaction. If another connection prevents it,
        // the pending marker makes the next maintenance sweep retry safely.
        $read->closeCursor();
        $freePages = (int)$db->query('PRAGMA freelist_count')->fetchColumn();
        if ($freePages > 0) $db->exec('VACUUM');
        $checkpoint = $db->query('PRAGMA wal_checkpoint(TRUNCATE)')->fetch(PDO::FETCH_NUM);
        if ($checkpoint !== false && (int)$checkpoint[0] !== 0) return $progress;
        $progress['phase'] = 'complete';
        $save->execute([$key, json_encode($progress, JSON_THROW_ON_ERROR), gmdate('Y-m-d\TH:i:s\Z')]);
        return $progress;
    } catch (Throwable $e) {
        if ($inTransaction) $db->exec('ROLLBACK');
        if ($stream !== null) {
            if (function_exists('gzopen') && $gzip) gzclose($stream);
            else fclose($stream);
        }
        if ($partial !== null && is_file($partial)) @unlink($partial);
        throw $e;
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}
