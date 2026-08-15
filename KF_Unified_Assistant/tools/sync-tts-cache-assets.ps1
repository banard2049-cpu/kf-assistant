[CmdletBinding(SupportsShouldProcess)]
param(
  [string]$ModsPath,
  [ValidateSet("Copy", "HardLink")]
  [string]$Mode = "Copy",
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$appRoot = Split-Path $PSScriptRoot -Parent
$publicRoot = Join-Path $appRoot "public"

if (-not $ModsPath) {
  $ModsPath = Join-Path $appRoot "..\..\refs\Mods"
}

$ModsPath = [IO.Path]::GetFullPath($ModsPath)
$imageCache = Join-Path $ModsPath "Images"
if (-not (Test-Path -LiteralPath $imageCache -PathType Container)) {
  throw "TTS image cache was not found: $imageCache"
}

$cacheByName = [Collections.Generic.Dictionary[string, IO.FileInfo]]::new(
  [StringComparer]::OrdinalIgnoreCase
)
foreach ($source in Get-ChildItem -LiteralPath $imageCache -File) {
  $cacheByName[$source.Name] = $source
}

$assetPattern = [regex]::new(
  '(?<![A-Za-z0-9_-])/?assets/[A-Za-z0-9_./${}-]+\.(?:png|jpe?g|jfif|gif|webp|avif|bmp|ico|svg|tif|tiff)',
  [Text.RegularExpressions.RegexOptions]::IgnoreCase
)
$destinations = [Collections.Generic.Dictionary[string, IO.FileInfo]]::new(
  [StringComparer]::OrdinalIgnoreCase
)
$referenced = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$unmatched = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)

$sourceFiles = Get-ChildItem -LiteralPath $publicRoot -Recurse -File |
  Where-Object { $_.Extension -in ".js", ".json", ".html", ".css" }

foreach ($sourceFile in $sourceFiles) {
  $text = Get-Content -LiteralPath $sourceFile.FullName -Raw
  $relativeSource = $sourceFile.FullName.Substring($publicRoot.Length + 1)
  $assetBase = $publicRoot
  if ($relativeSource -match '^modules[\\/]([^\\/]+)[\\/]') {
    $assetBase = Join-Path $publicRoot ("modules\" + $Matches[1])
  }

  foreach ($match in $assetPattern.Matches($text)) {
    $assetReference = $match.Value
    if ($assetReference.Contains('${')) {
      continue
    }
    $null = $referenced.Add($assetReference)

    $relativeAsset = $assetReference.TrimStart('/').Replace('/', '\')
    if ($relativeAsset.Split('\') -contains '..') {
      throw "Unsafe asset reference in $relativeSource`: $assetReference"
    }

    $targetBase = if ($assetReference.StartsWith('/')) { $publicRoot } else { $assetBase }
    $destination = [IO.Path]::GetFullPath((Join-Path $targetBase $relativeAsset))
    if (-not $destination.StartsWith($publicRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
      throw "Asset destination escapes public root: $destination"
    }

    $cacheName = [IO.Path]::GetFileName($destination)
    if ($cacheByName.ContainsKey($cacheName)) {
      $destinations[$destination] = $cacheByName[$cacheName]
    } else {
      $null = $unmatched.Add($assetReference)
    }
  }
}

$created = 0
$updated = 0
$skipped = 0
$bytes = [int64]0

foreach ($entry in $destinations.GetEnumerator() | Sort-Object Key) {
  $destination = $entry.Key
  $source = $entry.Value
  $exists = Test-Path -LiteralPath $destination -PathType Leaf

  if ($exists -and -not $Force) {
    $skipped++
    continue
  }

  if ($PSCmdlet.ShouldProcess($destination, "$Mode TTS cache asset from $($source.FullName)")) {
    $parent = Split-Path $destination -Parent
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
    if ($exists) {
      Remove-Item -LiteralPath $destination -Force
    }

    if ($Mode -eq "HardLink") {
      New-Item -ItemType HardLink -Path $destination -Target $source.FullName | Out-Null
    } else {
      Copy-Item -LiteralPath $source.FullName -Destination $destination
    }

    if ($exists) { $updated++ } else { $created++ }
    $bytes += $source.Length
  }
}

$uniqueSources = $destinations.Values | Sort-Object FullName -Unique
Write-Output "TTS cache:       $imageCache"
Write-Output "References:      $($referenced.Count)"
Write-Output "Matched targets: $($destinations.Count)"
Write-Output "Unique sources:  $($uniqueSources.Count)"
Write-Output "Created:         $created"
Write-Output "Updated:         $updated"
Write-Output "Skipped:         $skipped"
Write-Output "Materialized:    $([math]::Round($bytes / 1MB, 1)) MB ($Mode)"
Write-Output "Unmatched refs:  $($unmatched.Count)"
Write-Output ""
Write-Output "Unmatched references are renamed, cropped, or generated application assets."
Write-Output "They cannot be restored safely by filename-only copying from the TTS cache."
