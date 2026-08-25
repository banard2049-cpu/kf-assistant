<#
.SYNOPSIS
  将仓库中被 .gitignore 排除的图片打包成单个 zip，便于分发。

.DESCRIPTION
  用 git 自身的忽略规则枚举 public/assets/ 下「未跟踪且被忽略」的图片文件，
  按仓库相对路径原样打包。接收方在仓库根目录解压覆盖即可恢复全部美术资源，
  无需手工对照目录。

  为避免泄漏，脚本始终强制排除 .env、data/、backups/、logs/ 等敏感路径，
  即使通过 -Extension 传入了自定义扩展名也不会被打包。

.PARAMETER OutputPath
  输出 zip 路径。默认为仓库根目录下的 KF_Assistant_Images_<日期>.zip。

.PARAMETER Extension
  要收集的扩展名列表，覆盖默认图片扩展名。不需要写点号。

.PARAMETER CompressionLevel
  压缩级别。默认 Fastest：jpg/png 已经是压缩格式，Optimal 只会多花 CPU
  换来极少的体积收益。

.PARAMETER IncludeGenerated
  一并打包构建产物中的图片（Android 生成的 web 副本、便携版 PHP 运行时）。
  默认排除，因为它们由构建脚本从 Web 项目复制而来，属于冗余。

.PARAMETER NoHash
  跳过 SHA256 校验文件的生成。

.PARAMETER DryRun
  只统计将要打包的文件数量和体积，不写出任何文件。

.PARAMETER Force
  输出文件已存在时直接覆盖，不再询问。

.EXAMPLE
  .\pack-ignored-images.ps1
  在仓库根目录生成 KF_Assistant_Images_2026-08-18.zip 与同名 .sha256.txt。

.EXAMPLE
  .\pack-ignored-images.ps1 -DryRun
  先看看会打包多少东西。

.EXAMPLE
  .\pack-ignored-images.ps1 -OutputPath D:\share\kf-images.zip -Force
  输出到指定位置并覆盖同名文件。
#>
[CmdletBinding()]
param(
  [string]$OutputPath,
  [string[]]$Extension,
  [ValidateSet('Fastest', 'Optimal', 'NoCompression')]
  [string]$CompressionLevel = 'Fastest',
  [switch]$IncludeGenerated,
  [switch]$NoHash,
  [switch]$DryRun,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

# PowerShell 5.1 需要手工加载压缩相关程序集；7+ 已内置，重复加载无副作用。
Add-Type -AssemblyName System.IO.Compression -ErrorAction SilentlyContinue
Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue

$defaultExtensions = @(
  'png', 'jpg', 'jpeg', 'jfif', 'gif', 'webp', 'avif', 'bmp',
  'ico', 'svg', 'tif', 'tiff', 'heic', 'heif', 'psd', 'xcf'
)

# 无论如何都不打包的路径片段：本地配置、数据库、备份、日志。
$blockedPatterns = @(
  '(^|/)\.env($|\.)',
  '(^|/)data/',
  '(^|/)backups/',
  '(^|/)logs/'
)

# 构建产物中的图片副本，默认排除，-IncludeGenerated 可加回。
$generatedPatterns = @(
  '(^|/)KF_Unified_Assistant/tools/packaging/android/',
  '(^|/)KF_Unified_Assistant/tools/packaging/android/app/src/main/assets/web/',
  '(^|/)KF_Unified_Assistant/runtime/'
)

# 资源已经统一到这里；工具截图和其他构建目录中的图片不属于资源包。
$assetRootPrefix = 'KF_Unified_Assistant/public/assets/'

function Format-Size {
  param([double]$Bytes)
  if ($Bytes -ge 1GB) { return ('{0:N2} GB' -f ($Bytes / 1GB)) }
  if ($Bytes -ge 1MB) { return ('{0:N2} MB' -f ($Bytes / 1MB)) }
  if ($Bytes -ge 1KB) { return ('{0:N2} KB' -f ($Bytes / 1KB)) }
  return ('{0} B' -f [int]$Bytes)
}
$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
  throw "未找到 git 命令。本脚本依赖 git 的忽略规则来判断哪些图片没有进仓库。"
}

$repoRoot = & $git.Source -C $PSScriptRoot rev-parse --show-toplevel 2>$null
if ($LASTEXITCODE -ne 0 -or -not $repoRoot) {
  throw "$PSScriptRoot 不在 git 仓库内，无法确定仓库根目录。"
}
$repoRoot = [IO.Path]::GetFullPath($repoRoot.Trim())

if (-not $Extension -or $Extension.Count -eq 0) {
  $Extension = $defaultExtensions
}
$extensionSet = [System.Collections.Generic.HashSet[string]]::new(
  [string[]]($Extension | ForEach-Object { $_.TrimStart('.').ToLowerInvariant() }),
  [StringComparer]::OrdinalIgnoreCase
)

if (-not $OutputPath) {
  $stamp = Get-Date -Format 'yyyy-MM-dd'
  $OutputPath = Join-Path $repoRoot "KF_Assistant_Images_$stamp.zip"
}
$OutputPath = [IO.Path]::GetFullPath($OutputPath)

# git 用 NUL 分隔输出，避免中文文件名被转成八进制转义序列。
$previousEncoding = [Console]::OutputEncoding
try {
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  $raw = (& $git.Source -C $repoRoot ls-files --others --ignored --exclude-standard -z) -join ''
  if ($LASTEXITCODE -ne 0) {
    throw "git ls-files 执行失败，退出码 $LASTEXITCODE。"
  }
} finally {
  [Console]::OutputEncoding = $previousEncoding
}

$candidates = $raw -split "`0" | Where-Object { $_ }
Write-Verbose "git 报告被忽略的条目共 $($candidates.Count) 个。"

$skippedSensitive = 0
$skippedGenerated = 0
$selected = [System.Collections.Generic.List[object]]::new()

foreach ($relative in $candidates) {
  if (-not $relative.StartsWith($assetRootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    continue
  }
  $ext = [IO.Path]::GetExtension($relative).TrimStart('.')
  if (-not $extensionSet.Contains($ext)) { continue }

  $isSensitive = $false
  foreach ($pattern in $blockedPatterns) {
    if ($relative -match $pattern) { $isSensitive = $true; break }
  }
  if ($isSensitive) { $skippedSensitive++; continue }

  if (-not $IncludeGenerated) {
    $isGenerated = $false
    foreach ($pattern in $generatedPatterns) {
      if ($relative -match $pattern) { $isGenerated = $true; break }
    }
    if ($isGenerated) { $skippedGenerated++; continue }
  }

  $full = Join-Path $repoRoot ($relative -replace '/', [IO.Path]::DirectorySeparatorChar)
  $item = Get-Item -LiteralPath $full -ErrorAction SilentlyContinue
  if (-not $item -or $item.PSIsContainer) { continue }
  if ($item.FullName -eq $OutputPath) { continue }

  $selected.Add([pscustomobject]@{
    Relative = $relative
    FullName = $item.FullName
    Length   = $item.Length
  })
}

if ($selected.Count -eq 0) {
  throw "没有找到任何被忽略的图片文件。请确认在包含图片的仓库副本中运行本脚本。"
}

$totalBytes = ($selected | Measure-Object -Property Length -Sum).Sum
Write-Output "仓库根目录: $repoRoot"
Write-Output "待打包图片: $($selected.Count) 个，共 $(Format-Size $totalBytes)"
if ($skippedGenerated -gt 0) {
  Write-Output "已跳过构建产物副本 $skippedGenerated 个（加 -IncludeGenerated 可包含）"
}
if ($skippedSensitive -gt 0) {
  Write-Output "已跳过敏感路径文件 $skippedSensitive 个"
}

if ($DryRun) {
  Write-Output ""
  Write-Output "按目录分布（前 15）:"
  $selected |
    Group-Object { $dir = Split-Path $_.Relative -Parent; if ($dir) { $dir -replace '\\', '/' } else { '.' } } |
    Sort-Object Count -Descending |
    Select-Object -First 15 |
    ForEach-Object {
      Write-Output ("  {0,5}  {1}  {2}" -f $_.Count, (Format-Size (($_.Group | Measure-Object Length -Sum).Sum)).PadLeft(10), $_.Name)
    }
  Write-Output ""
  Write-Output "试运行结束，未写出任何文件。目标位置本应为: $OutputPath"
  return
}
if (Test-Path -LiteralPath $OutputPath) {
  if (-not $Force) {
    # 非交互场景（重定向输入、计划任务、CI）下不能停在 Read-Host 上等输入，
    # 否则进程会一直挂着。这里直接报错并提示用 -Force。
    if ([Console]::IsInputRedirected) {
      throw "输出文件已存在: $OutputPath`n非交互模式下不会自动覆盖，请加 -Force 参数。"
    }
    $answer = Read-Host "输出文件已存在: $OutputPath`n覆盖？(y/N)"
    if ($answer -notmatch '^\s*[yY]') {
      Write-Output "已取消。"
      return
    }
  }
  Remove-Item -LiteralPath $OutputPath -Force
}

$outputDirectory = Split-Path $OutputPath -Parent
if ($outputDirectory -and -not (Test-Path -LiteralPath $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

$level = [System.IO.Compression.CompressionLevel]::$CompressionLevel
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$utf8Bom = [System.Text.UTF8Encoding]::new($true)
$partialPath = "$OutputPath.partial"

# 上一次运行若被强行中断（关窗口、Ctrl+C、进程被杀），会残留 .partial 文件。
if (Test-Path -LiteralPath $partialPath) {
  Write-Verbose "清理上次中断残留的临时文件: $partialPath"
  Remove-Item -LiteralPath $partialPath -Force
}
$written = 0
$writtenBytes = 0L

try {
  $stream = [System.IO.File]::Open($partialPath, [System.IO.FileMode]::Create)
  try {
    # 显式指定 UTF-8 作为条目名编码，保证中文文件名在各解压工具中正确还原。
    $zip = [System.IO.Compression.ZipArchive]::new(
      $stream, [System.IO.Compression.ZipArchiveMode]::Create, $false, $utf8NoBom)
    try {
      foreach ($file in $selected) {
        $entryName = $file.Relative -replace '\\', '/'
        $entry = $zip.CreateEntry($entryName, $level)
        $entry.LastWriteTime = [IO.File]::GetLastWriteTime($file.FullName)

        $entryStream = $entry.Open()
        try {
          $source = [System.IO.File]::OpenRead($file.FullName)
          try {
            $source.CopyTo($entryStream)
          } finally {
            $source.Dispose()
          }
        } finally {
          $entryStream.Dispose()
        }

        $written++
        $writtenBytes += $file.Length
        if ($written % 25 -eq 0 -or $written -eq $selected.Count) {
          Write-Progress -Activity "打包被忽略的图片" `
            -Status "$written / $($selected.Count)  ($(Format-Size $writtenBytes))" `
            -PercentComplete ([math]::Min(100, $writtenBytes * 100.0 / [math]::Max(1, $totalBytes)))
        }
      }

      $manifestLines = [System.Collections.Generic.List[string]]::new()
      $manifestLines.Add("KF 助手图片资源包")
      $manifestLines.Add("生成时间: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz'))")
      $manifestLines.Add("文件数量: $($selected.Count)")
      $manifestLines.Add("解压后体积: $(Format-Size $totalBytes)")
      $manifestLines.Add("")
      $manifestLines.Add("恢复方法：在仓库根目录（含 KF_Unified_Assistant 的那一层）解压本压缩包，")
      $manifestLines.Add("选择覆盖同名文件即可。压缩包内已保留完整的仓库相对路径，无需手工移动目录。")
      $manifestLines.Add("")
      $manifestLines.Add("PowerShell 一行命令：")
      $manifestLines.Add('  Expand-Archive -LiteralPath <本文件>.zip -DestinationPath . -Force')
      $manifestLines.Add("")
      $manifestLines.Add("注意：本压缩包仅含图片，不含 .env、数据库、备份和日志。")
      $manifestLines.Add("Android 版无需单独恢复图片，构建脚本会从 Web 项目同步。")
      $manifestLines.Add("")
      $manifestLines.Add("--- 文件清单 ---")
      foreach ($file in $selected) {
        $manifestLines.Add(("{0,12}  {1}" -f $file.Length, ($file.Relative -replace '\\', '/')))
      }

      $readmeEntry = $zip.CreateEntry('RESTORE-README.txt', [System.IO.Compression.CompressionLevel]::Optimal)
      $readmeStream = $readmeEntry.Open()
      try {
        # GetBytes 不包含 BOM，必须单独写入前导字节，否则旧版记事本可能
        # 把中文按本地代码页解码成乱码。
        $preamble = $utf8Bom.GetPreamble()
        $readmeStream.Write($preamble, 0, $preamble.Length)
        $bytes = $utf8Bom.GetBytes(($manifestLines -join "`r`n") + "`r`n")
        $readmeStream.Write($bytes, 0, $bytes.Length)
      } finally {
        $readmeStream.Dispose()
      }
    } finally {
      $zip.Dispose()
    }
  } finally {
    $stream.Dispose()
  }

  Write-Progress -Activity "打包被忽略的图片" -Completed

  # 复核：重新打开压缩包，确认条目数与解压体积和源文件一致。
  $verifyZip = [System.IO.Compression.ZipFile]::OpenRead($partialPath)
  try {
    $imageEntries = @($verifyZip.Entries | Where-Object { $_.FullName -ne 'RESTORE-README.txt' })
    $verifiedBytes = ($imageEntries | Measure-Object -Property Length -Sum).Sum
    if ($imageEntries.Count -ne $selected.Count) {
      throw "复核失败：压缩包内图片条目 $($imageEntries.Count) 个，预期 $($selected.Count) 个。"
    }
    if ($verifiedBytes -ne $totalBytes) {
      throw "复核失败：压缩包内解压体积 $verifiedBytes 字节，预期 $totalBytes 字节。"
    }
  } finally {
    $verifyZip.Dispose()
  }

  Move-Item -LiteralPath $partialPath -Destination $OutputPath -Force
} catch {
  if (Test-Path -LiteralPath $partialPath) {
    Remove-Item -LiteralPath $partialPath -Force -ErrorAction SilentlyContinue
  }
  throw
}

$archive = Get-Item -LiteralPath $OutputPath
Write-Output ""
Write-Output "打包完成: $($archive.FullName)"
Write-Output "压缩包体积: $(Format-Size $archive.Length)  (源文件 $(Format-Size $totalBytes))"
Write-Output "已复核: $($selected.Count) 个图片条目，解压体积一致"

if (-not $NoHash) {
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $OutputPath).Hash.ToLowerInvariant()
  $hashPath = "$OutputPath.sha256.txt"
  Set-Content -LiteralPath $hashPath -Value "$hash  $([IO.Path]::GetFileName($OutputPath))" -Encoding ASCII
  Write-Output "SHA256: $hash"
  Write-Output "校验文件: $hashPath"
}


