<?php
declare(strict_types=1);

$root = dirname(__DIR__);
foreach (is_file($root.'/.env') ? (file($root.'/.env', FILE_IGNORE_NEW_LINES|FILE_SKIP_EMPTY_LINES) ?: []) : [] as $line) {
    if (preg_match('/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/',$line,$m) && getenv($m[1])===false) putenv($m[1].'='.$m[2]);
}
function setting(string $name,string $default):string{$v=getenv($name);return $v===false?$default:$v;}
function directory(string $root,string $value):string{return preg_match('/^(?:[A-Za-z]:[\\\\\/]|\/)/',$value)?rtrim($value,'/\\'):$root.DIRECTORY_SEPARATOR.trim($value,'./\\');}
$dataDir=directory($root,setting('DATA_DIR','data'));$backupDir=directory($root,setting('BACKUP_DIR','backups'));
@mkdir($dataDir,0770,true);@mkdir($backupDir,0770,true);
if(!extension_loaded('pdo_sqlite')){fwrite(STDERR,"pdo_sqlite is required.\n");exit(1);}
$dbPath=$dataDir.DIRECTORY_SEPARATOR.'kf-knights.db';
if(!is_file($dbPath)){fwrite(STDERR,"Database does not exist. Start the website once first.\n");exit(1);}
$db=new PDO('sqlite:'.$dbPath,null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
function backup(PDO $db,string $dir,string $label):string{$target=$dir.DIRECTORY_SEPARATOR.gmdate('Y-m-d\TH-i-s-v\Z').'-'.$label.'.db';$db->exec("VACUUM INTO '".str_replace("'","''",$target)."'");return $target;}
function prune_backups(string $dir,int $limit=50):void{$files=glob($dir.DIRECTORY_SEPARATOR.'*.db')?:[];usort($files,fn($a,$b)=>(filemtime($b)<=>filemtime($a))?:strcmp(basename($b),basename($a)));foreach(array_slice($files,$limit)as$file)@unlink($file);}
$command=$argv[1]??'help';
if($command==='backup'){$target=backup($db,$backupDir,'manual');prune_backups($backupDir);echo $target.PHP_EOL;}
elseif($command==='list'){foreach(array_reverse(glob($backupDir.DIRECTORY_SEPARATOR.'*.db')?:[])as$file)printf("%-48s %10d bytes\n",basename($file),filesize($file));}
elseif($command==='reset-password'){
    $username=$argv[2]??'';$password=$argv[3]??'';if($username===''||strlen($password)<8){fwrite(STDERR,"Usage: php tools/admin.php reset-password USERNAME NEW_PASSWORD\n");exit(1);}
    $q=$db->prepare('UPDATE users SET password_hash=? WHERE username_key=?');$q->execute([password_hash($password,PASSWORD_ARGON2ID),strtolower($username)]);
    if(!$q->rowCount()){fwrite(STDERR,"User not found.\n");exit(1);}
    $q=$db->prepare('DELETE FROM sessions WHERE user_id=(SELECT id FROM users WHERE username_key=?)');$q->execute([strtolower($username)]);echo "Password reset. Existing sessions were signed out.\n";
}
elseif($command==='restore'){
    $name=basename($argv[2]??'');$source=$backupDir.DIRECTORY_SEPARATOR.$name;if($name===''||!is_file($source)){fwrite(STDERR,"Usage: php tools/admin.php restore BACKUP_FILE.db\n");exit(1);}
    $safety=backup($db,$backupDir,'before-restore');$db=null;copy($source,$dbPath);prune_backups($backupDir);echo "Restore complete. Safety backup: $safety\nRestart the web server.\n";
}
else echo "Commands: backup | list | restore FILE.db | reset-password USERNAME NEW_PASSWORD\n";
