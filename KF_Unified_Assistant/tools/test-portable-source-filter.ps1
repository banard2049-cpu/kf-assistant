[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$tar = (Get-Command tar.exe -ErrorAction Stop).Source
$excludes = Join-Path $PSScriptRoot 'portable-excludes.txt'
$tempParent = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$fixture = Join-Path $tempParent ('kf-portable-filter-' + [guid]::NewGuid().ToString('N'))
$source = Join-Path $fixture 'source'
$stage = Join-Path $fixture 'stage'
$archive = Join-Path $fixture 'source.tar'
$utf8 = [Text.UTF8Encoding]::new($false)

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
}

function Write-Fixture([string]$Relative) {
  $file = Join-Path $source $Relative
  [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($file)) | Out-Null
  [IO.File]::WriteAllText($file, $Relative, $utf8)
}

$keep = @(
  'public/index.html',
  'public/assets/rogue/rosegraal-tree.jpg',
  'public/modules/aibp/data/monster-data.js',
  'tools/admin.php',
  'tools/packaging/android/app/build.gradle',
  'tools/packaging/android/app/src/main/java/Main.java',
  '.env.example'
)
$blocked = @(
  'tools/packaging/android/.build-tools/release.jks',
  'tools/packaging/android/signing/release.keystore',
  'tools/packaging/android/.gradle/cache.bin',
  'tools/packaging/android/dist/release.apk',
  'tools/packaging/android/app/build/outputs/release.apk',
  'tools/packaging/android/app/src/main/assets/web/assets/copy.jpg',
  'tools/packaging/android/local.properties',
  'tools/.packaging-cache/runtime.exe',
  'tools/__pycache__/script.pyc',
  'tools/data/campaign.json',
  'tools/backups/campaign.json',
  'tools/logs/build.txt',
  'tools/secret.jks',
  'tools/.env',
  'tools/.env.local',
  'public/.env',
  'public/state.sqlite3',
  'public/campaign.db',
  'public/errors.log',
  'data/campaign.json',
  'backups/campaign.json',
  'logs/build.txt',
  '.env'
)

try {
  [IO.Directory]::CreateDirectory($stage) | Out-Null
  foreach ($relative in ($keep + $blocked)) { Write-Fixture $relative }
  & $tar -cf $archive --exclude-from $excludes -C $source public tools .env.example
  Assert-True ($LASTEXITCODE -eq 0) 'Portable source collection failed.'
  & $tar -xf $archive -C $stage
  Assert-True ($LASTEXITCODE -eq 0) 'Portable source extraction failed.'
  $actual = @(Get-ChildItem -LiteralPath $stage -Recurse -File -Force)
  Assert-True ($actual.Count -eq $keep.Count) "Unexpected source count: $($actual.Count)"
  foreach ($relative in $keep) {
    $file = Join-Path $stage $relative
    Assert-True (Test-Path -LiteralPath $file -PathType Leaf) "Required source missing: $relative"
    Assert-True ([IO.File]::ReadAllText($file) -ceq $relative) "Required source changed: $relative"
  }
  foreach ($relative in $blocked) {
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $stage $relative))) "Private source included: $relative"
  }
  $parseErrors = $null
  [Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'build-portable-windows.ps1'), [ref]$null, [ref]$parseErrors) | Out-Null
  Assert-True ($parseErrors.Count -eq 0) 'Windows portable build script has syntax errors.'
  Write-Output "Portable source filter passed: $($keep.Count) source/resource files retained, $($blocked.Count) private/generated paths excluded."
} finally {
  $resolvedFixture = [IO.Path]::GetFullPath($fixture)
  Assert-True ($resolvedFixture.StartsWith($tempParent.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) 'Unsafe fixture cleanup path.'
  if (Test-Path -LiteralPath $resolvedFixture) { Remove-Item -LiteralPath $resolvedFixture -Recurse -Force }
}
