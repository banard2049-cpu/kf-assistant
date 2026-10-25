<#
.SYNOPSIS
  将 public/assets/ 下的全部图片打包成单个 zip，便于分发。

.DESCRIPTION
  枚举 public/assets/ 下的全部图片文件，包括已被 git 跟踪的图片，按仓库
  相对路径原样打包。接收方在仓库根目录解压覆盖即可恢复全部美术资源，
  Android 版可直接导入此 ZIP；导入成功后整体替换旧资源。

  为避免泄漏，脚本始终强制排除 .env、data/、backups/、logs/ 等敏感路径，
  即使通过 -Extension 传入了自定义扩展名也不会被打包。

  条目名含中文时，脚本会补写 UTF-8 标志位（general purpose bit 11），
  这样用资源管理器自带解压、unzip 等按本地代码页处理的工具也不会解出乱码文件名。

.PARAMETER OutputPath
  输出 zip 路径。默认为仓库根目录下的 KF_Assistant_Images_<日期>.zip。

.PARAMETER Extension
  要收集的扩展名列表，覆盖默认图片扩展名。不需要写点号。

.PARAMETER CompressionLevel
  压缩级别。默认 Fastest：jpg/png 已经是压缩格式，Optimal 只会多花 CPU
  换来极少的体积收益。

.PARAMETER IncludeGenerated
  为兼容旧命令保留。资源包始终只收集 public/assets/，不包含构建产物副本。

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

# 资源已经统一到这里；工具截图和其他构建目录中的图片不属于资源包。
$assetRootPrefix = 'KF_Unified_Assistant/public/assets/'

function Format-Size {
  param([double]$Bytes)
  if ($Bytes -ge 1GB) { return ('{0:N2} GB' -f ($Bytes / 1GB)) }
  if ($Bytes -ge 1MB) { return ('{0:N2} MB' -f ($Bytes / 1MB)) }
  if ($Bytes -ge 1KB) { return ('{0:N2} KB' -f ($Bytes / 1KB)) }
  return ('{0} B' -f [int]$Bytes)
}

function Set-ZipUtf8NameFlags {
  # 给条目名含非 ASCII 字符的记录补上 UTF-8 标志位（general purpose bit 11）。
  # .NET Framework 即使指定 UTF-8 编码写条目名，也不会置这个标志位，
  # 结果按本地代码页解压的工具（资源管理器自带解压等）会把中文名解成乱码。
  # 只改写标志位，不动数据、CRC 和尺寸；返回补写的条目数。
  param([Parameter(Mandatory = $true)][string]$Path)

  $utf8Strict = [System.Text.UTF8Encoding]::new($false, $true)
  $file = [System.IO.File]::Open(
    $Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
  try {
    $length = $file.Length
    if ($length -lt 22) { throw "压缩包过小，无法定位中央目录: $Path" }

    # 在文件尾部 64 KB 内倒着找 EOCD（中央目录结尾记录）。
    $tailSize = [int][Math]::Min($length, 65557)
    $tail = New-Object byte[] $tailSize
    $file.Position = $length - $tailSize
    $read = 0
    while ($read -lt $tailSize) {
      $chunk = $file.Read($tail, $read, $tailSize - $read)
      if ($chunk -le 0) { break }
      $read += $chunk
    }
    $eocd = -1
    for ($i = $tailSize - 22; $i -ge 0; $i--) {
      if ($tail[$i] -eq 0x50 -and $tail[$i + 1] -eq 0x4B -and
          $tail[$i + 2] -eq 0x05 -and $tail[$i + 3] -eq 0x06) { $eocd = $i; break }
    }
    if ($eocd -lt 0) { throw "未找到中央目录结尾记录，压缩包可能已损坏: $Path" }

    $entryCount = [BitConverter]::ToUInt16($tail, $eocd + 10)
    $cdSize = [BitConverter]::ToUInt32($tail, $eocd + 12)
    $cdOffset = [BitConverter]::ToUInt32($tail, $eocd + 16)
    if ($entryCount -eq 0xFFFF -or $cdSize -eq 0xFFFFFFFF -or $cdOffset -eq 0xFFFFFFFF) {
      throw "该压缩包是 Zip64 格式，本脚本暂不处理: $Path"
    }

    $cd = New-Object byte[] $cdSize
    $file.Position = $cdOffset
    $read = 0
    while ($read -lt $cdSize) {
      $chunk = $file.Read($cd, $read, $cdSize - $read)
      if ($chunk -le 0) { break }
      $read += $chunk
    }
    if ($read -ne $cdSize) { throw "中央目录没有完整读入: $Path" }

    $patched = 0
    $cursor = 0
    for ($index = 0; $index -lt $entryCount; $index++) {
      if ([BitConverter]::ToUInt32($cd, $cursor) -ne 0x02014b50) {
        throw "第 $index 条中央目录记录签名异常: $Path"
      }
      $flags = [BitConverter]::ToUInt16($cd, $cursor + 8)
      $nameLength = [BitConverter]::ToUInt16($cd, $cursor + 28)
      $extraLength = [BitConverter]::ToUInt16($cd, $cursor + 30)
      $commentLength = [BitConverter]::ToUInt16($cd, $cursor + 32)
      $localOffset = [BitConverter]::ToUInt32($cd, $cursor + 42)

      $hasHighByte = $false
      for ($b = 0; $b -lt $nameLength; $b++) {
        if ($cd[$cursor + 46 + $b] -ge 0x80) { $hasHighByte = $true; break }
      }
      if ($hasHighByte -and (($flags -band 0x0800) -eq 0)) {
        try { $entryName = $utf8Strict.GetString($cd, $cursor + 46, $nameLength) }
        catch { throw "第 $index 条记录的文件名不是合法 UTF-8: $Path" }

        $flagBytes = [BitConverter]::GetBytes([uint16]($flags -bor 0x0800))
        $file.Position = $cdOffset + $cursor + 8
        $file.Write($flagBytes, 0, 2)

        $signature = New-Object byte[] 4
        $file.Position = $localOffset
        $file.Read($signature, 0, 4) | Out-Null
        if ([BitConverter]::ToUInt32($signature, 0) -ne 0x04034b50) {
          throw "本地文件头签名异常，压缩包可能已损坏: $entryName"
        }
        $file.Position = $localOffset + 6
        $file.Write($flagBytes, 0, 2)
        $patched++
      }

      $cursor += 46 + $nameLength + $extraLength + $commentLength
    }

    $file.Flush($true)
    return $patched
  } finally {
    $file.Dispose()
  }
}
$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
  throw "未找到 git 命令。本脚本使用 git 定位仓库根目录。"
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

# APK 不内置图片，完整资源包必须包含已跟踪、被忽略及普通未跟踪图片。
# 不能只用 git ls-files --others --ignored，否则肉鸽底图等已跟踪资源会漏包。
$assetRoot = Join-Path $repoRoot ($assetRootPrefix -replace '/', [IO.Path]::DirectorySeparatorChar)
if (-not (Test-Path -LiteralPath $assetRoot -PathType Container)) {
  throw "资源目录不存在: $assetRoot"
}
$candidates = @(Get-ChildItem -LiteralPath $assetRoot -Recurse -File -Force | Sort-Object FullName)
Write-Verbose "资源目录中共有 $($candidates.Count) 个文件。"

$skippedSensitive = 0
$selected = [System.Collections.Generic.List[object]]::new()

foreach ($item in $candidates) {
  $relative = $item.FullName.Substring($repoRoot.Length + 1) -replace '\\', '/'
  $ext = [IO.Path]::GetExtension($relative).TrimStart('.')
  if (-not $extensionSet.Contains($ext)) { continue }

  $isSensitive = $false
  foreach ($pattern in $blockedPatterns) {
    if ($relative -match $pattern) { $isSensitive = $true; break }
  }
  if ($isSensitive) { $skippedSensitive++; continue }

  if ($item.FullName -eq $OutputPath) { continue }

  $selected.Add([pscustomobject]@{
    Relative = $relative
    FullName = $item.FullName
    Length   = $item.Length
  })
}

if ($selected.Count -eq 0) {
  throw "没有找到任何图片文件。请确认 public/assets/ 中包含图片资源。"
}

$totalBytes = ($selected | Measure-Object -Property Length -Sum).Sum
Write-Output "仓库根目录: $repoRoot"
Write-Output "待打包图片: $($selected.Count) 个，共 $(Format-Size $totalBytes)"
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
          Write-Progress -Activity "打包全部资源图片" `
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
      $manifestLines.Add('Android 版：在主界面选择“导入资源 ZIP”并导入本文件；成功后会整体替换旧资源。')
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

  Write-Progress -Activity "打包全部资源图片" -Completed

  # 交给复核前先补齐中文文件名的 UTF-8 标志位，否则资源管理器解压出来是乱码名。
  $flaggedCount = Set-ZipUtf8NameFlags -Path $partialPath
  if ($flaggedCount -gt 0) {
    Write-Output "已为 $flaggedCount 个中文文件名补写 UTF-8 标志位"
  }

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


