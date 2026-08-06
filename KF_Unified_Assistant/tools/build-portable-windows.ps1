[CmdletBinding()]
param(
  [string]$OutputPath,
  [string]$PhpSource
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
$packageName = "KF_Unified_Assistant_Portable"

if (-not $OutputPath) {
  $date = Get-Date -Format "yyyy-MM-dd"
  $OutputPath = Join-Path (Split-Path $repoRoot -Parent) "${packageName}_${date}.zip"
}
$OutputPath = [IO.Path]::GetFullPath($OutputPath)

if (-not $PhpSource) {
  $bundledPhp = Join-Path $repoRoot "runtime\php"
  if (Test-Path (Join-Path $bundledPhp "php.exe")) {
    $PhpSource = $bundledPhp
  } else {
    $phpCommand = Get-Command php -ErrorAction SilentlyContinue
    if ($phpCommand) {
      $PhpSource = Split-Path $phpCommand.Source -Parent
    }
  }
}

if (-not $PhpSource -or -not (Test-Path (Join-Path $PhpSource "php.exe"))) {
  throw "PHP source not found. Pass -PhpSource with the directory containing php.exe."
}
$PhpSource = [IO.Path]::GetFullPath($PhpSource)
$phpExe = Join-Path $PhpSource "php.exe"
$phpExt = Join-Path $PhpSource "ext"

& $phpExe -r "exit(version_compare(PHP_VERSION,'8.2.0','>=')?0:1);"
if ($LASTEXITCODE -ne 0) {
  throw "Portable PHP must be version 8.2 or newer."
}
& $phpExe -d "extension_dir=$phpExt" -d extension=pdo_sqlite -d extension=sqlite3 -d extension=mbstring -r "exit(extension_loaded('pdo_sqlite')&&extension_loaded('sqlite3')&&extension_loaded('mbstring')&&defined('PASSWORD_ARGON2ID')?0:1);"
if ($LASTEXITCODE -ne 0) {
  throw "PHP source cannot load pdo_sqlite, sqlite3, mbstring, or Argon2id."
}

$stageParent = Join-Path ([IO.Path]::GetTempPath()) ("kf-portable-" + [guid]::NewGuid().ToString("N"))
$stageRoot = Join-Path $stageParent $packageName
$portablePhp = Join-Path $stageRoot "runtime\php"

try {
  New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null

  $entries = @(
    "public",
    "tools",
    ".env.example",
    "check-windows.bat",
    "start-windows.bat",
    "一键启动-KF助手.bat",
    "PORTABLE-README.txt",
    "php-admin-windows.bat",
    "README.md",
    "Dockerfile",
    "compose.yaml"
  )
  foreach ($entry in $entries) {
    $source = Join-Path $repoRoot $entry
    if (Test-Path $source) {
      Copy-Item -LiteralPath $source -Destination $stageRoot -Recurse -Force
    }
  }

  New-Item -ItemType Directory -Path $portablePhp -Force | Out-Null
  Copy-Item -Path (Join-Path $PhpSource "*") -Destination $portablePhp -Recurse -Force

  $buildInfo = @(
    "KF Unified Assistant portable Windows package",
    "Built: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz'))",
    "PHP: $(& $phpExe -r 'echo PHP_VERSION;')",
    "User data excluded: .env, data, backups, logs"
  )
  Set-Content -LiteralPath (Join-Path $stageRoot "BUILD-INFO.txt") -Value $buildInfo -Encoding UTF8

  $outputDirectory = Split-Path $OutputPath -Parent
  New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
  if (Test-Path $OutputPath) {
    Remove-Item -LiteralPath $OutputPath -Force
  }

  $tar = Get-Command tar.exe -ErrorAction Stop
  Push-Location $stageParent
  try {
    & $tar.Source -a -cf $OutputPath $packageName
    if ($LASTEXITCODE -ne 0) {
      throw "tar.exe failed with exit code $LASTEXITCODE."
    }
  } finally {
    Pop-Location
  }

  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $OutputPath).Hash.ToLowerInvariant()
  $hashPath = "$OutputPath.sha256.txt"
  Set-Content -LiteralPath $hashPath -Value "$hash  $([IO.Path]::GetFileName($OutputPath))" -Encoding ASCII

  $archive = Get-Item -LiteralPath $OutputPath
  Write-Output "Portable package: $($archive.FullName)"
  Write-Output "Size: $([math]::Round($archive.Length / 1GB, 2)) GB"
  Write-Output "SHA256: $hash"
} finally {
  if (Test-Path $stageParent) {
    Remove-Item -LiteralPath $stageParent -Recurse -Force
  }
}
