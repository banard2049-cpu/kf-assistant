param(
  [string]$Source = (Join-Path $PSScriptRoot "..\..\KF_Unified_Assistant")
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$SourceRoot = (Resolve-Path -LiteralPath $Source).Path
$Public = Join-Path $SourceRoot "public"
$Target = Join-Path $Root "app\src\main\assets\web"
$Bridge = Join-Path $PSScriptRoot "android-local-api.js"

if (!(Test-Path -LiteralPath $Public -PathType Container)) { throw "Public directory not found: $Public" }
if (!(Test-Path -LiteralPath $Bridge -PathType Leaf)) { throw "Android API bridge not found: $Bridge" }
$safePrefix = $Root.TrimEnd('\') + '\app\src\main\assets\'
if (!$Target.StartsWith($safePrefix, [StringComparison]::OrdinalIgnoreCase)) { throw "Unsafe web asset target: $Target" }

if (Test-Path -LiteralPath $Target) { Remove-Item -LiteralPath $Target -Recurse -Force }
New-Item -ItemType Directory -Path $Target -Force | Out-Null

$robocopyArgs = @(
  $Public, $Target, "/E", "/COPY:DAT", "/DCOPY:DAT", "/R:2", "/W:1", "/NFL", "/NDL", "/NP",
  "/XF", "*.php", "*.log", "/XD", "tests", "__pycache__"
)
& robocopy.exe @robocopyArgs | Out-Host
if ($LASTEXITCODE -ge 8) { throw "Web asset sync failed with robocopy exit code $LASTEXITCODE" }

Copy-Item -LiteralPath $Bridge -Destination (Join-Path $Target "android-local-api.js") -Force
$scriptTag = '<script src="/android-local-api.js"></script>'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
Get-ChildItem -LiteralPath $Target -Recurse -File -Filter "*.html" | ForEach-Object {
  $text = [IO.File]::ReadAllText($_.FullName, [Text.Encoding]::UTF8)
  if (!$text.Contains($scriptTag)) {
    if ($text -match '(?i)<head[^>]*>') {
      $text = [regex]::Replace($text, '(?i)(<head[^>]*>)', "`$1`r`n  $scriptTag", 1)
    } elseif ($text -match '(?i)<body[^>]*>') {
      $text = [regex]::Replace($text, '(?i)(<body[^>]*>)', "`$1`r`n  $scriptTag", 1)
    } else {
      $text = $scriptTag + "`r`n" + $text
    }
    [IO.File]::WriteAllText($_.FullName, $text, $utf8NoBom)
  }
}

$files = @(Get-ChildItem -LiteralPath $Target -Recurse -File)
$bytes = ($files | Measure-Object Length -Sum).Sum
Write-Host ("Synced {0} files, {1:N2} GiB -> {2}" -f $files.Count, ($bytes / 1GB), $Target)
