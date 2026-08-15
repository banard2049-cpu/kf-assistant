<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

$root = dirname(__DIR__);
$envFile = $root . DIRECTORY_SEPARATOR . '.env';
if (is_file($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        if (preg_match('/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/', $line, $m) && getenv($m[1]) === false) {
            putenv($m[1] . '=' . $m[2]);
        }
    }
}

function env_value(string $name, string $default): string {
    $value = getenv($name);
    return $value === false ? $default : $value;
}
function resolve_dir(string $root, string $value): string {
    if (preg_match('/^(?:[A-Za-z]:[\\\\\/]|\/)/', $value)) return rtrim($value, '/\\');
    return $root . DIRECTORY_SEPARATOR . trim($value, './\\');
}

$dataDir = resolve_dir($root, env_value('DATA_DIR', 'data'));
$backupDir = resolve_dir($root, env_value('BACKUP_DIR', 'backups'));
$allowRegistration = strtolower(env_value('ALLOW_REGISTRATION', 'true')) === 'true';
$sessionDays = max(1, (int)env_value('SESSION_DAYS', '30'));
@mkdir($dataDir, 0770, true);
@mkdir($backupDir, 0770, true);

if (!extension_loaded('pdo_sqlite')) {
    http_response_code(500);
    echo json_encode(['error' => '服务器未启用 PHP pdo_sqlite 扩展'], JSON_UNESCAPED_UNICODE);
    exit;
}

$dbPath = $dataDir . DIRECTORY_SEPARATOR . 'kf-knights.db';
$db = new PDO('sqlite:' . $dbPath, null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
]);
$db->exec('PRAGMA journal_mode=WAL');
$db->exec('PRAGMA foreign_keys=ON');
$db->exec('PRAGMA busy_timeout=5000');
$db->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, username TEXT NOT NULL, username_key TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL, last_used_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS knight_sheets (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, state_json TEXT NOT NULL,
  field_versions_json TEXT NOT NULL DEFAULT '{}', revision INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS sheets_owner_idx ON knight_sheets(user_id, deleted_at, updated_at);
CREATE TABLE IF NOT EXISTS sync_operations (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, operation_id TEXT NOT NULL UNIQUE,
  sheet_id TEXT NOT NULL REFERENCES knight_sheets(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, client_id TEXT NOT NULL, field_path TEXT NOT NULL,
  value_json TEXT NOT NULL, base_revision INTEGER NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sync_sheet_seq_idx ON sync_operations(sheet_id, seq);
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  settings_json TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, state_json TEXT NOT NULL, field_versions_json TEXT NOT NULL DEFAULT '{}',
  revision INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS campaigns_owner_idx ON campaigns(user_id,deleted_at,updated_at);
CREATE TABLE IF NOT EXISTS campaign_operations (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, operation_id TEXT NOT NULL UNIQUE,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, client_id TEXT NOT NULL, field_path TEXT NOT NULL,
  value_json TEXT NOT NULL, base_revision INTEGER NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS campaign_ops_idx ON campaign_operations(campaign_id,seq);
CREATE TABLE IF NOT EXISTS app_meta (
  meta_key TEXT PRIMARY KEY, meta_value TEXT NOT NULL, updated_at TEXT NOT NULL
);
SQL);
$sheetColumns=$db->query('PRAGMA table_info(knight_sheets)')->fetchAll();
if(!array_filter($sheetColumns,fn($column)=>$column['name']==='campaign_id'))$db->exec('ALTER TABLE knight_sheets ADD COLUMN campaign_id TEXT');
$db->exec("UPDATE campaigns SET state_json=json_remove(state_json,'$.expedition','$.log','$.modules.flow')
    WHERE json_type(state_json,'$.expedition') IS NOT NULL
       OR json_type(state_json,'$.log') IS NOT NULL
       OR json_type(state_json,'$.modules.flow') IS NOT NULL");

function stamp(): string { return gmdate('Y-m-d\TH:i:s.v\Z'); }
function uuid4(): string {
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);
    return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4) . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20);
}
function respond(int $status, array $body, array $headers = []): never {
    http_response_code($status);
    foreach ($headers as $name => $value) header($name . ': ' . $value);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function request_data(): array {
    $raw = file_get_contents('php://input');
    if (strlen($raw ?: '') > 10_000_000) respond(413, ['error' => '请求内容过大']);
    if ($raw === '' || $raw === false) return [];
    try {
        $data = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($data)) respond(400, ['error' => 'JSON 格式无效']);
        return $data;
    } catch (JsonException) { respond(400, ['error' => 'JSON 格式无效']); }
}
function text_value(mixed $value, int $max = 5000): string {
    $text = is_scalar($value) ? (string)$value : '';
    return function_exists('mb_substr') ? mb_substr($text, 0, $max) : substr($text, 0, $max);
}
function title_value(mixed $value): string {
    $title = trim(text_value($value, 80));
    return $title === '' ? '未命名骑士' : $title;
}
function knight_catalog(): array {
    return [
        'stoneface'=>'Stoneface','fleischritter'=>'Fleischritter','renholder'=>'Renholder',
        'ser-sonch'=>'Ser Sonch','paracelsa'=>'Paracelsa','ser-ubar'=>'Ser Ubar','kara'=>'Kara',
    ];
}
function default_state(string $knightId='', string $player=''): array {
    $virtues = [];
    foreach (['bravery','tenacity','sagacity','fortitude','might','insight'] as $key) $virtues[$key] = ['value' => 0, 'vice' => [false,false,false,false]];
    $story = [];
    for ($i=0; $i<5; $i++) $story[] = ['quest'=>false,'investigations'=>array_fill(0,3,['attempted'=>false,'success'=>''])];
    $catalog=knight_catalog();
    return [
        'knightId'=>$knightId,'knight'=>$catalog[$knightId]??'','player'=>text_value($player,80),'bane'=>0,'gold'=>0,'leads'=>0,'sigh'=>0,'virtues'=>$virtues,'notes'=>'','prologue'=>false,'story'=>$story,
        'rapport'=>array_fill(0,4,['knight'=>'','hearts'=>[false,false,false],'favor'=>'']),'armory'=>[''],'saints'=>[''],'mercenaries'=>[''],
        'choices'=>(object)[],'choicesUnlocked'=>false,'successfulInvestigations'=>(object)[],'firstDeath'=>false,
    ];
}
function default_campaign_state(): array {
    return [
        'schemaVersion'=>2,'kingdom'=>'sunken','leaderSheetId'=>'','party'=>[],'squires'=>[],
        'partyManager'=>['schemaVersion'=>4,'activeMemberKey'=>'','members'=>(object)[],'squireLeads'=>0,'mettle'=>null,'knightPool'=>(object)[],'outpost'=>['mercenaries'=>[],'merchantGear'=>[]]],
        'monsterPool'=>['row'=>0,'cards'=>[],'districts'=>[],'history'=>[]],
        'map'=>['activeKingdom'=>'sunken','kingdoms'=>[
            'sunken'=>['tiles'=>[],'partyTile'=>'','markers'=>[],'round'=>0],
            'stone'=>['tiles'=>[],'partyTile'=>'','markers'=>[],'round'=>0],
        ]],
        'encounter'=>['active'=>false,'monster'=>'','level'=>1,'type'=>'normal','phase'=>'setup','board'=>(object)[],'result'=>''],
        'aibp'=>['monster'=>'','level'=>1,'ai'=>[],'bp'=>[],'discard'=>[],'wounds'=>[],'promotion'=>0,'history'=>[]],
        'harvest'=>['schemaVersion'=>1,'status'=>'collecting','receipts'=>[],'loot'=>[],'activities'=>(object)[],'history'=>[],'completedAt'=>null],
        'harvestInbox'=>(object)[],
        'modules'=>['map'=>null,'encounter'=>null,'aibp'=>null]
    ];
}
function ensure_default_campaign(PDO $db,string $userId): string {
    $q=$db->prepare('SELECT id FROM campaigns WHERE user_id=? AND deleted_at IS NULL ORDER BY created_at LIMIT 1');$q->execute([$userId]);
    $id=$q->fetchColumn();
    if(!$id){$id=uuid4();$time=stamp();$q=$db->prepare('INSERT INTO campaigns(id,user_id,name,state_json,created_at,updated_at) VALUES(?,?,?,?,?,?)');$q->execute([$id,$userId,'默认战役',json_encode(default_campaign_state(),JSON_UNESCAPED_UNICODE),$time,$time]);}
    return (string)$id;
}
function owned_campaign(PDO $db,string $id,string $userId,bool $deleted=false): ?array {
    $q=$db->prepare('SELECT * FROM campaigns WHERE id=? AND user_id=?'.($deleted?'':' AND deleted_at IS NULL'));$q->execute([$id,$userId]);return $q->fetch()?:null;
}
function parsed_campaign(array $row): array {
    $row['state']=json_decode($row['state_json'],true);$row['fieldVersions']=json_decode($row['field_versions_json'],true);
    $row['deleted']=$row['deleted_at']!==null;unset($row['state_json'],$row['field_versions_json']);return $row;
}
function user_from_session(PDO $db): ?array {
    $token = $_COOKIE['kf_session'] ?? '';
    if ($token === '') return null;
    $hash = hash('sha256', $token);
    $q = $db->prepare('SELECT u.id,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1');
    $q->execute([$hash, stamp()]);
    $user = $q->fetch();
    if ($user) {
        $u = $db->prepare('UPDATE sessions SET last_used_at=? WHERE token_hash=?');
        $u->execute([stamp(), $hash]);
    }
    return $user ?: null;
}
function require_user(PDO $db): array {
    $user = user_from_session($db);
    if (!$user) respond(401, ['error'=>'请先登录']);
    return $user;
}
function owned_sheet(PDO $db, string $id, string $userId, bool $deleted = false): ?array {
    $sql = 'SELECT * FROM knight_sheets WHERE id=? AND user_id=?' . ($deleted ? '' : ' AND deleted_at IS NULL');
    $q = $db->prepare($sql); $q->execute([$id,$userId]); return $q->fetch() ?: null;
}
function parsed_sheet(array $row): array {
    $row['state'] = json_decode($row['state_json'], true);
    $row['fieldVersions'] = json_decode($row['field_versions_json'], true);
    $row['deleted'] = $row['deleted_at'] !== null;
    unset($row['state_json'],$row['field_versions_json']);
    return $row;
}
function normalize_story_markers(mixed $value): array {
    if (!is_array($value)) return [];
    $markers=[];
    foreach (array_slice($value,0,100,true) as $id=>$checked) {
        if ($checked===true && is_string($id) && preg_match('/^[a-z0-9-]{3,80}$/',$id)) $markers[$id]=true;
    }
    return $markers;
}
function normalize_password_records(mixed $value): array {
    if (!is_array($value)) return [];
    $records=[];$seen=[];$symbols=['dot','filled','outline'];
    foreach (array_slice($value,0,100) as $record) {
        if (!is_array($record)) continue;
        $id=(string)($record['id']??'');if(!preg_match('/^[A-Za-z0-9_-]{8,100}$/',$id)||isset($seen[$id]))continue;
        $matrix=is_array($record['matrix']??null)?array_values($record['matrix']):[];
        $matrix=array_map(fn($symbol)=>in_array($symbol,$symbols,true)?$symbol:'dot',array_pad(array_slice($matrix,0,6),6,'dot'));
        $number=preg_replace('/\D/','',(string)($record['number']??''));$number=substr($number,0,8);
        $records[]=['id'=>$id,'matrix'=>$matrix,'number'=>$number];$seen[$id]=true;
    }
    return $records;
}
function load_user_settings(PDO $db,string $userId): array {
    $q=$db->prepare('SELECT settings_json FROM user_settings WHERE user_id=?');$q->execute([$userId]);$raw=$q->fetchColumn();
    if($raw===false)return [];$settings=json_decode((string)$raw,true);return is_array($settings)?$settings:[];
}
function store_user_settings(PDO $db,string $userId,array $settings): void {
    $q=$db->prepare('INSERT INTO user_settings(user_id,settings_json,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET settings_json=excluded.settings_json,updated_at=excluded.updated_at');
    $q->execute([$userId,json_encode($settings,JSON_UNESCAPED_UNICODE),stamp()]);
}
function public_user_settings(array $settings): array {
    $markers=normalize_story_markers($settings['storyMarkers']??[]);
    return ['storyMarkers'=>$markers?:new stdClass(),'passwords'=>normalize_password_records($settings['passwords']??[])];
}
function &path_ref(array &$root, array $parts): mixed {
    $ref =& $root;
    foreach ($parts as $part) {
        if (!is_array($ref)) $ref = [];
        if (!array_key_exists($part, $ref)) $ref[$part] = [];
        $ref =& $ref[$part];
    }
    return $ref;
}
function get_path(array $root, string $path): mixed {
    $value = $root;
    foreach (explode('.', $path) as $part) {
        if (!is_array($value) || !array_key_exists($part, $value)) return null;
        $value = $value[$part];
    }
    return $value;
}
function set_path(array &$root, string $path, mixed $value): void {
    $parts = array_values(array_filter(explode('.', $path), fn($v)=>$v!==''));
    if (!$parts || count($parts)>8) respond(400,['error'=>'字段路径无效']);
    foreach ($parts as $part) if (!preg_match('/^[A-Za-z0-9_-]+$/', $part)) respond(400,['error'=>'字段路径无效']);
    $last = array_pop($parts);
    $parent =& path_ref($root, $parts);
    $parent[$last] = $value;
}
function validate_harvest_state(mixed $value): void {
    if(!is_array($value)||($value['schemaVersion']??1)!==1||!in_array($value['status']??'', ['collecting','drafting','allocating','complete'], true))respond(400,['error'=>'收获阶段状态版本或阶段无效']);
    foreach(['receipts','loot'] as $key)if(!is_array($value[$key]??null)||count($value[$key])>300)respond(400,['error'=>'收获阶段记录结构无效']);
    $receiptIds=[];
    foreach($value['receipts'] as $receipt){
        if(!is_array($receipt)||!is_string($receipt['id']??null)||$receipt['id']===''||isset($receiptIds[$receipt['id']])||!is_array($receipt['requests']??null)||count($receipt['requests'])>16)respond(400,['error'=>'收获搜刮收据无效']);
        $receiptIds[$receipt['id']]=true;
    }
    foreach($value['loot'] as $item)if(!is_array($item)||!is_string($item['id']??null)||!is_string($item['catalogId']??null)||!isset($receiptIds[(string)($item['sourceReceiptId']??'')]))respond(400,['error'=>'收获战利品牌记录无效']);
}
function validate_harvest_receipt(mixed $value): void {
    if($value===null)return;
    if(!is_array($value)||!is_string($value['id']??null)||$value['id']===''||!is_array($value['requests']??null)||count($value['requests'])<1||count($value['requests'])>16)respond(400,['error'=>'跨阶段收获收据无效']);
}
function validate_value(string $path, mixed $value): void {
    if (in_array($path,['knight','knightId'],true)) respond(400,['error'=>'骑士身份在创建后不可更改']);
    $encoded = json_encode($value, JSON_UNESCAPED_UNICODE);
    $limit = str_starts_with($path, 'modules.') ? 1_500_000 : (in_array($path,['partyManager','harvest'],true) ? 500_000 : 20_000);
    if ($encoded === false || strlen($encoded)>$limit) respond(400,['error'=>'字段内容无效或过长']);
    if($path==='harvest')validate_harvest_state($value);
    if(str_starts_with($path,'harvestInbox.'))validate_harvest_receipt($value);
    if (in_array($path,['bane','gold','leads','sigh'],true) && (!is_int($value) || $value<0 || $value>99999)) respond(400,['error'=>'数值超出范围']);
    if (preg_match('/^story\.\d+\.investigations\.\d+\.success$/',$path) && $value!=='' && (!is_int($value) || $value<0 || $value>99)) respond(400,['error'=>'调查数字超出范围']);
}
function map_state_round(mixed $value): int {
    if (!is_array($value)) return 0;
    $round=$value['round']??0;
    return is_int($round)?max(0,$round):0;
}
function resolve_campaign_sync_conflict(string $path,mixed $previous,mixed $incoming): array {
    $result=['value'=>$incoming,'resolution'=>'incoming'];
    if($path==='harvest'&&is_array($previous)&&is_array($incoming)){
        $previousReceipts=is_array($previous['receipts']??null)?$previous['receipts']:[];$incomingReceipts=is_array($incoming['receipts']??null)?$incoming['receipts']:[];
        $previousIds=[];foreach($previousReceipts as $receipt)if(is_array($receipt)&&is_string($receipt['id']??null))$previousIds[$receipt['id']]=true;
        $incomingHasNew=false;foreach($incomingReceipts as $receipt)if(is_array($receipt)&&is_string($receipt['id']??null)&&!isset($previousIds[$receipt['id']])){$incomingHasNew=true;break;}
        if(($previous['status']??'')==='complete'&&($incoming['status']??'')==='collecting'&&(count($incomingReceipts)===0||$incomingHasNew))return ['value'=>$incoming,'resolution'=>'incoming-new-expedition'];
        $merged=$previous;$receiptMap=$previousIds;
        foreach($incomingReceipts as $receipt)if(is_array($receipt)&&is_string($receipt['id']??null)&&!isset($receiptMap[$receipt['id']])){$merged['receipts'][]=$receipt;$receiptMap[$receipt['id']]=true;}
        $mergedLoot=is_array($merged['loot']??null)?$merged['loot']:[];$lootIds=[];$catalogIds=[];
        foreach($mergedLoot as $item)if(is_array($item)){$lootIds[(string)($item['id']??'')]=true;$catalogIds[(string)($item['catalogId']??'')]=true;}
        $addedLoot=false;
        foreach((is_array($incoming['loot']??null)?$incoming['loot']:[]) as $item)if(is_array($item)&&!isset($lootIds[(string)($item['id']??'')])&&!isset($catalogIds[(string)($item['catalogId']??'')])){$mergedLoot[]=$item;$lootIds[(string)($item['id']??'')]=true;$catalogIds[(string)($item['catalogId']??'')]=true;$addedLoot=true;}
        $merged['loot']=$mergedLoot;
        if($incomingHasNew||$addedLoot){
            $merged['status']='collecting';$merged['completedAt']=null;
            foreach($merged['loot'] as &$item)if(is_array($item)&&($item['allocation']??'')!=='discarded'){$item['allocation']='unassigned';$item['assignedMemberKey']='';$item['resolution']=null;}unset($item);
            return ['value'=>$merged,'resolution'=>'merged-additive'];
        }
        return ['value'=>$previous,'resolution'=>'existing'];
    }
    if($path!=='modules.map')return $result;
    $previousRound=map_state_round($previous);$incomingRound=map_state_round($incoming);
    $result['previousRound']=$previousRound;$result['incomingRound']=$incomingRound;
    if($previousRound>$incomingRound){$result['value']=$previous;$result['resolution']='existing';}
    elseif(is_array($previous)&&is_array($incoming)&&is_array($previous['mercenaries']??null)){
        $previousMercenaries=$previous['mercenaries'];$incomingMercenaries=is_array($incoming['mercenaries']??null)?$incoming['mercenaries']:[];
        $previousMercenaryUpdate=max(0,(int)($previousMercenaries['updatedAt']??0));$incomingMercenaryUpdate=max(0,(int)($incomingMercenaries['updatedAt']??0));
        if($previousMercenaryUpdate>$incomingMercenaryUpdate){$result['value']=$incoming;$result['value']['mercenaries']=$previousMercenaries;$result['resolution']='merged-existing-mercenaries';}
    }
    return $result;
}
function create_backup(PDO $db, string $backupDir, string $label='manual'): string {
    $safe = preg_replace('/[^a-z0-9_-]/i','-',$label);
    $target = $backupDir . DIRECTORY_SEPARATOR . gmdate('Y-m-d\TH-i-s-v\Z') . '-' . $safe . '.db';
    $quoted = str_replace("'", "''", $target);
    $db->exec("VACUUM INTO '$quoted'");
    return $target;
}
function migrate_global_knights(PDO $db, string $backupDir): void {
    $key='global-knights-v1';$q=$db->prepare('SELECT meta_value FROM app_meta WHERE meta_key=?');$q->execute([$key]);if($q->fetchColumn()!==false)return;
    $count=(int)$db->query('SELECT COUNT(*) FROM knight_sheets')->fetchColumn();if($count>0)create_backup($db,$backupDir,'before-global-knights');
    $rows=$db->query('SELECT id,user_id,title,state_json,updated_at,deleted_at FROM knight_sheets ORDER BY user_id,updated_at DESC')->fetchAll();
    $canonical=[];$replace=[];$duplicates=[];
    foreach($rows as $row){
        if($row['deleted_at']!==null)continue;$state=json_decode($row['state_json'],true);$knightId=is_array($state)?(string)($state['knightId']??''):'';if($knightId==='')continue;
        $group=$row['user_id'].'|'.$knightId;if(!isset($canonical[$group]))$canonical[$group]=$row['id'];else{$replace[$row['id']]=$canonical[$group];$duplicates[]=$row['id'];}
    }
    $db->beginTransaction();
    try{
        if($replace){
            $campaigns=$db->query('SELECT id,state_json FROM campaigns')->fetchAll();$updateCampaign=$db->prepare('UPDATE campaigns SET state_json=?,revision=revision+1,updated_at=? WHERE id=?');
            foreach($campaigns as $campaign){$state=json_decode($campaign['state_json'],true);if(!is_array($state))continue;$changed=false;$leader=(string)($state['leaderSheetId']??'');if(isset($replace[$leader])){$state['leaderSheetId']=$replace[$leader];$changed=true;}
                $party=is_array($state['party']??null)?$state['party']:[];$mapped=array_values(array_unique(array_map(fn($id)=>$replace[(string)$id]??$id,$party)));if($mapped!==$party){$state['party']=$mapped;$changed=true;}
                if(array_key_exists('harvest',$state)){$mappedHarvest=remap_harvest_member_keys($state['harvest'],$replace);if($mappedHarvest!==$state['harvest']){$state['harvest']=$mappedHarvest;$changed=true;}}
                if($changed)$updateCampaign->execute([json_encode($state,JSON_UNESCAPED_UNICODE),stamp(),$campaign['id']]);
            }
            $archive=$db->prepare('UPDATE knight_sheets SET title=title||"（跨战役合并备份）",deleted_at=?,updated_at=?,campaign_id=NULL WHERE id=?');$time=stamp();foreach($duplicates as $id)$archive->execute([$time,$time,$id]);
        }
        $db->exec('UPDATE knight_sheets SET campaign_id=NULL');$q=$db->prepare('INSERT INTO app_meta(meta_key,meta_value,updated_at) VALUES(?,?,?)');$q->execute([$key,'complete',stamp()]);$db->commit();
    }catch(Throwable $e){$db->rollBack();throw $e;}
}
function remap_campaign_member_key(mixed $value,array $sheetMap): string {
    $key=(string)$value;
    if(!str_starts_with($key,'knight:'))return $key;
    $sheetId=substr($key,7);
    return isset($sheetMap[$sheetId])?'knight:'.$sheetMap[$sheetId]:$key;
}
function remap_harvest_member_keys(mixed $value,array $sheetMap): mixed {
    if(!is_array($value))return $value;
    $harvest=$value;
    if(is_array($harvest['activities']??null)){
        $activities=[];
        foreach($harvest['activities'] as $memberKey=>$activity)$activities[remap_campaign_member_key($memberKey,$sheetMap)]=$activity;
        $harvest['activities']=$activities;
    }
    if(is_array($harvest['loot']??null))foreach($harvest['loot'] as &$item)if(is_array($item)&&isset($item['assignedMemberKey']))$item['assignedMemberKey']=remap_campaign_member_key($item['assignedMemberKey'],$sheetMap);
    unset($item);
    return $harvest;
}
function maintenance(PDO $db, string $backupDir): void {
    $cutoff = gmdate('Y-m-d\TH:i:s.v\Z', time()-30*86400);
    $q=$db->prepare('DELETE FROM knight_sheets WHERE deleted_at IS NOT NULL AND deleted_at<?');$q->execute([$cutoff]);
    $q=$db->prepare('DELETE FROM campaigns WHERE deleted_at IS NOT NULL AND deleted_at<?');$q->execute([$cutoff]);
    $q=$db->prepare('DELETE FROM sessions WHERE expires_at<?');$q->execute([stamp()]);
    $marker=$backupDir.DIRECTORY_SEPARATOR.'.last-daily';
    $today=gmdate('Y-m-d');
    if (!is_file($marker) || trim((string)file_get_contents($marker))!==$today) {
        create_backup($db,$backupDir,'daily'); file_put_contents($marker,$today,LOCK_EX);
        $files=glob($backupDir.DIRECTORY_SEPARATOR.'*.db')?:[]; usort($files,fn($a,$b)=>filemtime($b)<=>filemtime($a));
        $days=[];$weeks=[];$keep=[];
        foreach($files as $file){$time=filemtime($file);$day=gmdate('Y-m-d',$time);$week=gmdate('o-W',$time);
            if(count($days)<7&&!isset($days[$day])){$days[$day]=1;$keep[$file]=1;}
            if(count($weeks)<4&&!isset($weeks[$week])){$weeks[$week]=1;$keep[$file]=1;}
        }
        foreach($files as $file)if(!isset($keep[$file]))@unlink($file);
    }
}

migrate_global_knights($db, $backupDir);
maintenance($db, $backupDir);
$route = trim((string)($_GET['route'] ?? ''), '/');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($route === 'health') respond(200,['ok'=>true,'time'=>stamp()]);
    if ($route === 'config') respond(200,['registration'=>$allowRegistration]);
    if ($route === 'auth/me') respond(200,['user'=>user_from_session($db)]);
    if ($route === 'auth/register' && $method === 'POST') {
        if (!$allowRegistration) respond(403,['error'=>'服务器已关闭新用户注册']);
        $data=request_data();$username=trim(text_value($data['username']??'',32));$key=function_exists('mb_strtolower')?mb_strtolower($username):strtolower($username);$password=$data['password']??'';
        if(!preg_match('/^[\p{L}\p{N}_.-]{3,32}$/u',$username)||!is_string($password)||strlen($password)<8||strlen($password)>128)respond(400,['error'=>'用户名需为 3–32 位，密码至少 8 位']);
        try{$q=$db->prepare('INSERT INTO users(id,username,username_key,password_hash,created_at) VALUES(?,?,?,?,?)');$q->execute([uuid4(),$username,$key,password_hash($password,PASSWORD_ARGON2ID),stamp()]);}
        catch(PDOException $e){if(str_contains($e->getMessage(),'UNIQUE'))respond(409,['error'=>'用户名已存在']);throw $e;}
        login_user($db,$key,$password,$sessionDays);
    }
    if ($route === 'auth/login' && $method === 'POST') {$data=request_data();$name=trim(text_value($data['username']??'',32));$key=function_exists('mb_strtolower')?mb_strtolower($name):strtolower($name);login_user($db,$key,$data['password']??'',$sessionDays);}
    if ($route === 'auth/logout' && $method === 'POST') {
        $token=$_COOKIE['kf_session']??'';if($token!==''){$q=$db->prepare('DELETE FROM sessions WHERE token_hash=?');$q->execute([hash('sha256',$token)]);}
        setcookie('kf_session','',['expires'=>1,'path'=>'/','httponly'=>true,'samesite'=>'Strict']);respond(200,['ok'=>true]);
    }
    $user=require_user($db);
    $defaultCampaignId=ensure_default_campaign($db,$user['id']);
    if ($route === 'user-settings' && $method === 'GET') respond(200,['settings'=>public_user_settings(load_user_settings($db,$user['id']))]);
    if ($route === 'user-settings' && $method === 'PATCH') {
        $data=request_data();if(!array_key_exists('storyMarkers',$data)&&!array_key_exists('passwords',$data))respond(400,['error'=>'账号共享记录无效']);
        if(array_key_exists('storyMarkers',$data)&&!is_array($data['storyMarkers']))respond(400,['error'=>'永久故事标记无效']);
        if(array_key_exists('passwords',$data)&&!is_array($data['passwords']))respond(400,['error'=>'密码记录无效']);
        $settings=load_user_settings($db,$user['id']);if(array_key_exists('storyMarkers',$data))$settings['storyMarkers']=normalize_story_markers($data['storyMarkers']);if(array_key_exists('passwords',$data))$settings['passwords']=normalize_password_records($data['passwords']);store_user_settings($db,$user['id'],$settings);
        respond(200,['settings'=>public_user_settings($settings)]);
    }
    if ($route === 'campaigns' && $method === 'GET') {
        $trash=($_GET['trash']??'')==='1';$q=$db->prepare('SELECT id,name,revision,created_at,updated_at,deleted_at FROM campaigns WHERE user_id=? AND deleted_at IS '.($trash?'NOT NULL':'NULL').' ORDER BY updated_at DESC');$q->execute([$user['id']]);
        $rows=$q->fetchAll();foreach($rows as &$row)$row['deleted']=$row['deleted_at']!==null;respond(200,['campaigns'=>$rows,'defaultCampaignId'=>$defaultCampaignId]);
    }
    if ($route === 'campaigns' && $method === 'POST') {
        $data=request_data();$id=uuid4();$time=stamp();$state=default_campaign_state();$q=$db->prepare('INSERT INTO campaigns(id,user_id,name,state_json,created_at,updated_at) VALUES(?,?,?,?,?,?)');
        $q->execute([$id,$user['id'],title_value($data['name']??'新战役'),json_encode($state,JSON_UNESCAPED_UNICODE),$time,$time]);respond(201,['campaign'=>parsed_campaign(owned_campaign($db,$id,$user['id']))]);
    }
    if (preg_match('/^campaigns\/([a-f0-9-]+)(?:\/(copy|trash|restore))?$/',$route,$m)) {
        $action=$m[2]??'';$row=owned_campaign($db,$m[1],$user['id'],$action==='restore');if(!$row)respond(404,['error'=>'战役不存在']);
        if($action===''&&$method==='GET')respond(200,['campaign'=>parsed_campaign($row)]);
        if($action===''&&$method==='PATCH'){$data=request_data();$q=$db->prepare('UPDATE campaigns SET name=?,updated_at=? WHERE id=?');$q->execute([title_value($data['name']??''),stamp(),$row['id']]);respond(200,['ok'=>true]);}
        if($action==='copy'&&$method==='POST'){
            $id=uuid4();$time=stamp();$state=json_decode($row['state_json'],true);
            $q=$db->prepare('INSERT INTO campaigns(id,user_id,name,state_json,created_at,updated_at) VALUES(?,?,?,?,?,?)');$q->execute([$id,$user['id'],$row['name'].'（副本）',json_encode($state,JSON_UNESCAPED_UNICODE),$time,$time]);respond(201,['id'=>$id]);
        }
        if($action==='trash'&&$method==='POST'){
            $q=$db->prepare('SELECT COUNT(*) FROM campaigns WHERE user_id=? AND deleted_at IS NULL');$q->execute([$user['id']]);if((int)$q->fetchColumn()<=1)respond(400,['error'=>'至少保留一个战役']);
            $q=$db->prepare('UPDATE campaigns SET deleted_at=?,updated_at=? WHERE id=?');$q->execute([stamp(),stamp(),$row['id']]);respond(200,['ok'=>true]);
        }
        if($action==='restore'&&$method==='POST'){$q=$db->prepare('UPDATE campaigns SET deleted_at=NULL,updated_at=? WHERE id=?');$q->execute([stamp(),$row['id']]);respond(200,['ok'=>true]);}
    }
    if ($route === 'campaign-sync' && $method === 'POST') {
        $data=request_data();$row=owned_campaign($db,(string)($data['campaignId']??''),$user['id']);if(!$row)respond(404,['error'=>'战役不存在']);
        $operations=is_array($data['operations']??null)?array_slice($data['operations'],0,200):[];$conflicts=[];
        $db->exec('BEGIN IMMEDIATE');
        try{$row=owned_campaign($db,$row['id'],$user['id']);if(!$row)throw new RuntimeException('Campaign disappeared during sync');
            $state=json_decode($row['state_json'],true);$versions=json_decode($row['field_versions_json'],true);$revision=(int)$row['revision'];if(!is_array($state))$state=[];if(!is_array($versions))$versions=[];
            $exists=$db->prepare('SELECT seq FROM campaign_operations WHERE operation_id=?');$insert=$db->prepare('INSERT INTO campaign_operations(operation_id,campaign_id,user_id,client_id,field_path,value_json,base_revision,created_at) VALUES(?,?,?,?,?,?,?,?)');
            foreach($operations as $op){if(!is_array($op)||!preg_match('/^[A-Za-z0-9_-]{8,100}$/',(string)($op['id']??''))||!preg_match('/^[A-Za-z0-9_-]{8,100}$/',(string)($op['clientId']??'')))respond(400,['error'=>'战役同步操作无效']);
                $exists->execute([$op['id']]);if($exists->fetch())continue;$path=(string)($op['path']??'');$incoming=$op['value']??null;validate_value($path,$incoming);$base=is_int($op['baseRevision']??null)?$op['baseRevision']:0;$selected=$incoming;
                if(($versions[$path]??0)>$base){$previous=get_path($state,$path);$choice=resolve_campaign_sync_conflict($path,$previous,$incoming);$selected=$choice['value'];$conflict=['path'=>$path,'previous'=>$previous,'resolution'=>$choice['resolution']];if(isset($choice['previousRound'])){$conflict['previousRound']=$choice['previousRound'];$conflict['incomingRound']=$choice['incomingRound'];}$conflicts[]=$conflict;}
                $revision++;set_path($state,$path,$selected);$versions[$path]=$revision;
                $insert->execute([$op['id'],$row['id'],$user['id'],$op['clientId'],$path,json_encode($incoming,JSON_UNESCAPED_UNICODE),$base,stamp()]);
            }
            $q=$db->prepare('UPDATE campaigns SET state_json=?,field_versions_json=?,revision=?,updated_at=? WHERE id=?');$q->execute([json_encode($state,JSON_UNESCAPED_UNICODE),json_encode($versions),$revision,stamp(),$row['id']]);$db->exec('COMMIT');
        }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}respond(200,['state'=>$state,'revision'=>$revision,'conflicts'=>$conflicts]);
    }
    if ($route === 'campaign-export' && $method === 'GET') {
        $id=(string)($_GET['campaignId']??'');$row=owned_campaign($db,$id,$user['id']);if(!$row)respond(404,['error'=>'战役不存在']);
        $q=$db->prepare('SELECT id,title,state_json FROM knight_sheets WHERE user_id=? AND deleted_at IS NULL ORDER BY created_at');$q->execute([$user['id']]);$sheets=[];
        foreach($q->fetchAll() as $sheet)$sheets[]=['id'=>$sheet['id'],'title'=>$sheet['title'],'state'=>json_decode($sheet['state_json'],true)];
        respond(200,['format'=>'kf-unified-campaign','schemaVersion'=>2,'exportedAt'=>stamp(),'shared'=>public_user_settings(load_user_settings($db,$user['id'])),'campaign'=>['name'=>$row['name'],'state'=>json_decode($row['state_json'],true),'sheets'=>$sheets]]);
    }
    if ($route === 'campaign-import' && $method === 'POST') {
        $data=request_data();if(($data['format']??'')!=='kf-unified-campaign'||($data['schemaVersion']??0)!==2||!is_array($data['campaign']??null))respond(400,['error'=>'只支持新版 KF 一体化战役存档（版本 2）']);
        $payload=$data['campaign'];$sharedImport=is_array($data['shared']??null)?$data['shared']:[];$importedStoryMarkers=normalize_story_markers($sharedImport['storyMarkers']??[]);$importedPasswords=normalize_password_records($sharedImport['passwords']??[]);$id=uuid4();$time=stamp();$state=is_array($payload['state']??null)?$payload['state']:default_campaign_state();$state['schemaVersion']=2;
        if(!isset($state['harvest']))$state['harvest']=default_campaign_state()['harvest'];validate_harvest_state($state['harvest']);
        foreach((is_array($state['harvestInbox']??null)?$state['harvestInbox']:[]) as $receipt)validate_harvest_receipt($receipt);
        $sourceSheets=array_slice(is_array($payload['sheets']??null)?$payload['sheets']:[],0,100);$sheetMap=[];$seenKnights=[];$catalog=knight_catalog();
        $existingByKnight=[];$q=$db->prepare('SELECT id,state_json FROM knight_sheets WHERE user_id=? AND deleted_at IS NULL');$q->execute([$user['id']]);foreach($q->fetchAll() as $existing){$existingState=json_decode($existing['state_json'],true);$existingKnight=(string)($existingState['knightId']??'');if($existingKnight!=='')$existingByKnight[$existingKnight]=$existing['id'];}
        foreach($sourceSheets as $sheet)if(is_array($sheet)){
            $sheetState=$sheet['state']??null;$knightId=is_array($sheetState)?(string)($sheetState['knightId']??''):'';
            if(!isset($catalog[$knightId])||isset($seenKnights[$knightId]))respond(400,['error'=>'导入文件包含无效或重复的骑士身份']);
            $seenKnights[$knightId]=true;$sheetMap[(string)($sheet['id']??uuid4())]=$existingByKnight[$knightId]??uuid4();
        }
        if(isset($sheetMap[$state['leaderSheetId']??'']))$state['leaderSheetId']=$sheetMap[$state['leaderSheetId']];
        $state['party']=array_values(array_map(fn($sheetId)=>$sheetMap[$sheetId]??$sheetId,is_array($state['party']??null)?$state['party']:[]));
        if(array_key_exists('harvest',$state))$state['harvest']=remap_harvest_member_keys($state['harvest'],$sheetMap);
        $db->beginTransaction();
        try{$q=$db->prepare('INSERT INTO campaigns(id,user_id,name,state_json,created_at,updated_at) VALUES(?,?,?,?,?,?)');$q->execute([$id,$user['id'],title_value($payload['name']??'导入战役').'（导入）',json_encode($state,JSON_UNESCAPED_UNICODE),$time,$time]);
            $insert=$db->prepare('INSERT INTO knight_sheets(id,user_id,campaign_id,title,state_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?)');
            foreach($sourceSheets as $sheet)if(is_array($sheet)&&is_array($sheet['state']??null)){$oldId=(string)($sheet['id']??'');$sheetState=$sheet['state'];$knightId=(string)$sheetState['knightId'];if(isset($existingByKnight[$knightId]))continue;$sheetState['knight']=$catalog[$knightId];$insert->execute([$sheetMap[$oldId]??uuid4(),$user['id'],null,title_value($sheet['title']??''),json_encode($sheetState,JSON_UNESCAPED_UNICODE),$time,$time]);}
            if($importedStoryMarkers||$importedPasswords){$settings=load_user_settings($db,$user['id']);$settings['storyMarkers']=array_replace(normalize_story_markers($settings['storyMarkers']??[]),$importedStoryMarkers);$settings['passwords']=normalize_password_records(array_merge(normalize_password_records($settings['passwords']??[]),$importedPasswords));store_user_settings($db,$user['id'],$settings);}
            $db->commit();}catch(Throwable $e){$db->rollBack();throw $e;}respond(201,['id'=>$id]);
    }
    if ($route === 'encounters/start' && $method === 'POST') {
        $data=request_data();$row=owned_campaign($db,(string)($data['campaignId']??''),$user['id']);if(!$row)respond(404,['error'=>'战役不存在']);$state=json_decode($row['state_json'],true);
        $monster=text_value($data['monster']??'',80);$level=max(1,min(4,(int)($data['level']??1)));$type=in_array($data['type']??'normal',['normal','ambush','special'],true)?$data['type']:'normal';
        $state['encounter']=['active'=>true,'monster'=>$monster,'level'=>$level,'type'=>$type,'phase'=>'setup','board'=>(object)[],'result'=>''];$state['aibp']=['monster'=>$monster,'level'=>$level,'ai'=>[],'bp'=>[],'discard'=>[],'wounds'=>[],'promotion'=>0,'history'=>[]];
        $q=$db->prepare('UPDATE campaigns SET state_json=?,revision=revision+1,updated_at=? WHERE id=?');$q->execute([json_encode($state,JSON_UNESCAPED_UNICODE),stamp(),$row['id']]);respond(200,['state'=>$state]);
    }
    if ($route === 'encounters/complete' && $method === 'POST') {
        $data=request_data();$row=owned_campaign($db,(string)($data['campaignId']??''),$user['id']);if(!$row)respond(404,['error'=>'战役不存在']);$state=json_decode($row['state_json'],true);
        $result=in_array($data['result']??'victory',['victory','defeat','retreat'],true)?$data['result']:'victory';$casualties=text_value($data['casualties']??'',200);$rewards=text_value($data['rewards']??'',500);
        $state['encounter']['active']=false;$state['encounter']['result']=$result;$state['encounter']['resultDetails']=['casualties'=>$casualties,'rewards'=>$rewards];
        $q=$db->prepare('UPDATE campaigns SET state_json=?,revision=revision+1,updated_at=? WHERE id=?');$q->execute([json_encode($state,JSON_UNESCAPED_UNICODE),stamp(),$row['id']]);respond(200,['state'=>$state]);
    }
    if ($route === 'sheets' && $method === 'GET') {
        $trash=($_GET['trash']??'')==='1';$overview=($_GET['overview']??'')==='1';
        $campaignId=(string)($_GET['campaignId']??$defaultCampaignId);if(!owned_campaign($db,$campaignId,$user['id']))respond(404,['error'=>'战役不存在']);
        $columns='id,title,revision,created_at,updated_at,deleted_at'.($overview?',state_json':'');
        $q=$db->prepare("SELECT $columns FROM knight_sheets WHERE user_id=? AND deleted_at IS ".($trash?'NOT NULL':'NULL').' ORDER BY updated_at DESC');$q->execute([$user['id']]);
        $rows=$q->fetchAll();foreach($rows as &$r){$r['deleted']=$r['deleted_at']!==null;if($overview){$r['state']=json_decode($r['state_json'],true);unset($r['state_json']);}}respond(200,['sheets'=>$rows]);
    }
    if ($route === 'sheets' && $method === 'POST') {
        $data=request_data();$campaignId=(string)($data['campaignId']??$defaultCampaignId);if(!owned_campaign($db,$campaignId,$user['id']))respond(404,['error'=>'战役不存在']);
        $catalog=knight_catalog();$knightId=(string)($data['knightId']??'');if(!isset($catalog[$knightId]))respond(400,['error'=>'请选择一个有效的骑士']);
        $q=$db->prepare('SELECT state_json FROM knight_sheets WHERE user_id=? AND deleted_at IS NULL');$q->execute([$user['id']]);
        foreach($q->fetchAll() as $existing){$existingState=json_decode($existing['state_json'],true);if(($existingState['knightId']??'')===$knightId)respond(409,['error'=>'已经有这名骑士的共享档案']);}
        $id=uuid4();$time=stamp();$state=default_state($knightId,(string)($data['player']??''));$title=trim(text_value($data['title']??'',80));if($title==='')$title=$catalog[$knightId];
        $q=$db->prepare('INSERT INTO knight_sheets(id,user_id,campaign_id,title,state_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?)');$q->execute([$id,$user['id'],null,title_value($title),json_encode($state,JSON_UNESCAPED_UNICODE),$time,$time]);
        respond(201,['sheet'=>parsed_sheet(owned_sheet($db,$id,$user['id']))]);
    }
    if (in_array($route,['export','import','game-settings'],true)) respond(410,['error'=>'旧版接口已停用，请使用新版完整存档导入导出']);
    if (preg_match('/^sheets\/([a-f0-9-]+)(?:\/(copy|trash|restore))?$/',$route,$m)) {
        $action=$m[2]??'';$row=owned_sheet($db,$m[1],$user['id'],$action==='restore');if(!$row)respond(404,['error'=>'档案不存在']);
        if($action===''&&$method==='GET')respond(200,['sheet'=>parsed_sheet($row)]);
        if($action===''&&$method==='PATCH'){$data=request_data();$q=$db->prepare('UPDATE knight_sheets SET title=?,updated_at=? WHERE id=? AND user_id=?');$q->execute([title_value($data['title']??''),stamp(),$row['id'],$user['id']]);respond(200,['ok'=>true]);}
        if($action==='copy'&&$method==='POST')respond(409,['error'=>'骑士档案跨战役共享，无需复制']);
        if($action==='trash'&&$method==='POST'){
            $time=stamp();$q=$db->prepare('UPDATE knight_sheets SET deleted_at=?,updated_at=? WHERE id=?');$q->execute([$time,$time,$row['id']]);
            $campaigns=$db->prepare('SELECT id,state_json FROM campaigns WHERE user_id=?');$campaigns->execute([$user['id']]);$updateCampaign=$db->prepare('UPDATE campaigns SET state_json=?,revision=revision+1,updated_at=? WHERE id=?');foreach($campaigns->fetchAll() as $campaign){$campaignState=json_decode($campaign['state_json'],true);$changed=false;
                if(($campaignState['leaderSheetId']??'')===$row['id']){$campaignState['leaderSheetId']='';$changed=true;}
                $party=is_array($campaignState['party']??null)?$campaignState['party']:[];$filtered=array_values(array_filter($party,fn($id)=>$id!==$row['id']));if($filtered!==$party){$campaignState['party']=$filtered;$changed=true;}
                if($changed)$updateCampaign->execute([json_encode($campaignState,JSON_UNESCAPED_UNICODE),$time,$campaign['id']]);
            }respond(200,['ok'=>true]);
        }
        if($action==='restore'&&$method==='POST'){$state=json_decode($row['state_json'],true);$knightId=(string)($state['knightId']??'');$q=$db->prepare('SELECT state_json FROM knight_sheets WHERE user_id=? AND deleted_at IS NULL');$q->execute([$user['id']]);foreach($q->fetchAll() as $existing){$existingState=json_decode($existing['state_json'],true);if(($existingState['knightId']??'')===$knightId)respond(409,['error'=>'这名骑士已有共享档案，无法恢复重复备份']);}$q=$db->prepare('UPDATE knight_sheets SET deleted_at=NULL,updated_at=?,campaign_id=NULL WHERE id=?');$q->execute([stamp(),$row['id']]);respond(200,['ok'=>true]);}
    }
    if ($route === 'sync' && $method === 'POST') {
        $data=request_data();$row=owned_sheet($db,(string)($data['sheetId']??''),$user['id']);if(!$row)respond(404,['error'=>'档案不存在']);
        $operations=is_array($data['operations']??null)?array_slice($data['operations'],0,200):[];$state=json_decode($row['state_json'],true);$versions=json_decode($row['field_versions_json'],true);$revision=(int)$row['revision'];$conflicts=[];
        $db->exec('BEGIN IMMEDIATE');
        try{
            $exists=$db->prepare('SELECT seq FROM sync_operations WHERE operation_id=?');$insert=$db->prepare('INSERT INTO sync_operations(operation_id,sheet_id,user_id,client_id,field_path,value_json,base_revision,created_at) VALUES(?,?,?,?,?,?,?,?)');
            foreach($operations as $op){if(!is_array($op)||!preg_match('/^[A-Za-z0-9_-]{8,100}$/',(string)($op['id']??''))||!preg_match('/^[A-Za-z0-9_-]{8,100}$/',(string)($op['clientId']??'')))respond(400,['error'=>'同步操作无效']);
                $exists->execute([$op['id']]);if($exists->fetch())continue;$path=(string)($op['path']??'');$value=$op['value']??null;validate_value($path,$value);$base=is_int($op['baseRevision']??null)?$op['baseRevision']:0;
                if(($versions[$path]??0)>$base)$conflicts[]=['path'=>$path,'previous'=>get_path($state,$path)];$revision++;set_path($state,$path,$value);$versions[$path]=$revision;
                $insert->execute([$op['id'],$row['id'],$user['id'],$op['clientId'],$path,json_encode($value,JSON_UNESCAPED_UNICODE),$base,stamp()]);
            }
            $q=$db->prepare('UPDATE knight_sheets SET state_json=?,field_versions_json=?,revision=?,updated_at=? WHERE id=?');$q->execute([json_encode($state,JSON_UNESCAPED_UNICODE),json_encode($versions),$revision,stamp(),$row['id']]);$db->exec('COMMIT');
        }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
        respond(200,['state'=>$state,'revision'=>$revision,'conflicts'=>$conflicts]);
    }
    respond(404,['error'=>'接口不存在']);
} catch (Throwable $e) {
    error_log((string)$e);
    respond(500,['error'=>'服务器内部错误']);
}

function login_user(PDO $db, string $usernameKey, mixed $password, int $sessionDays): never {
    $q=$db->prepare('SELECT * FROM users WHERE username_key=? AND active=1');$q->execute([$usernameKey]);$user=$q->fetch();
    if(!$user||!is_string($password)||!password_verify($password,$user['password_hash']))respond(401,['error'=>'用户名或密码错误']);
    $token=rtrim(strtr(base64_encode(random_bytes(32)),'+/','-_'),'=');$expires=time()+$sessionDays*86400;
    $q=$db->prepare('INSERT INTO sessions(token_hash,user_id,expires_at,last_used_at) VALUES(?,?,?,?)');$q->execute([hash('sha256',$token),$user['id'],gmdate('Y-m-d\TH:i:s.v\Z',$expires),stamp()]);
    setcookie('kf_session',$token,['expires'=>$expires,'path'=>'/','httponly'=>true,'samesite'=>'Strict']);
    respond(200,['user'=>['id'=>$user['id'],'username'=>$user['username']]]);
}
