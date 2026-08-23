param(
  [string]$Source = (Join-Path $PSScriptRoot "..\KF_Unified_Assistant"),
  [string]$Toolchain = "D:\download\ato2\ATO-android-local\.build-tools",
  [switch]$SkipSync,
  [switch]$SkipClean,
  [switch]$IncrementPatch
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Dist = Join-Path $Root "dist"
$GradleFile = Join-Path $Root "app\build.gradle"
$PackageName = "com.kingdomsforlorn.unified.local"
$Alias = "kf-unified-local"
$StorePassword = "kf-unified-local-2026"

function Assert-File([string]$Path, [string]$Label) {
  if (!(Test-Path -LiteralPath $Path -PathType Leaf)) { throw "$Label not found: $Path" }
}

function Invoke-Checked([string]$File, [string[]]$Arguments) {
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Command failed ($LASTEXITCODE): $File $($Arguments -join ' ')" }
}

function Write-Utf8NoBom([string]$Path, [string]$Text) {
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [IO.File]::WriteAllText($Path, $Text, $encoding)
}

Assert-File $GradleFile "app build.gradle"
if (!(Test-Path -LiteralPath $Source -PathType Container)) { throw "KF source project not found: $Source" }
if (!(Test-Path -LiteralPath $Toolchain -PathType Container)) { throw "Android toolchain not found: $Toolchain" }

$JdkHome = Get-ChildItem (Join-Path $Toolchain "jdk") -Directory |
  Where-Object { Test-Path (Join-Path $_.FullName "bin\java.exe") } |
  Select-Object -First 1 -ExpandProperty FullName
$Gradle = Join-Path $Toolchain "gradle-8.9\bin\gradle.bat"
$Sdk = Join-Path $Toolchain "android-sdk"
$BuildTools = Join-Path $Sdk "build-tools\35.0.0"
$ZipAlign = Join-Path $BuildTools "zipalign.exe"
$ApkSigner = Join-Path $BuildTools "apksigner.bat"
$Adb = Join-Path $Sdk "platform-tools\adb.exe"
$KeyTool = if ($JdkHome) { Join-Path $JdkHome "bin\keytool.exe" } else { "" }
$PrivateTools = Join-Path $Root ".build-tools"
$Keystore = Join-Path $PrivateTools "kf-unified-local-release.jks"

if (!$JdkHome) { throw "JDK not found under $Toolchain\jdk" }
Assert-File $Gradle "Gradle"
Assert-File $ZipAlign "zipalign"
Assert-File $ApkSigner "apksigner"
Assert-File $KeyTool "keytool"

$gradleText = Get-Content -LiteralPath $GradleFile -Raw -Encoding UTF8
$versionCode = [int]([regex]::Match($gradleText, 'versionCode\s+(\d+)').Groups[1].Value)
$versionName = [regex]::Match($gradleText, 'versionName\s+"([^"]+)"').Groups[1].Value
if ($IncrementPatch) {
  $parts = @($versionName.Split('.') | ForEach-Object { [int]$_ })
  while ($parts.Count -lt 3) { $parts += 0 }
  $parts[2]++
  $versionCode++
  $versionName = "$($parts[0]).$($parts[1]).$($parts[2])"
  $gradleText = [regex]::Replace($gradleText, 'versionCode\s+\d+', "versionCode $versionCode")
  $gradleText = [regex]::Replace($gradleText, 'versionName\s+"[^"]+"', "versionName `"$versionName`"")
  Write-Utf8NoBom $GradleFile $gradleText
}

Write-Host "[1/6] Syncing standalone web assets..."
if (!$SkipSync) {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root "android\sync-web-assets.ps1") -Source $Source
  if ($LASTEXITCODE -ne 0) { throw "Web asset sync failed." }
}
$WebAssets = Join-Path $Root "app\src\main\assets\web"
if (!(Test-Path -LiteralPath (Join-Path $WebAssets "index.html"))) { throw "Synced web app is missing. Run without -SkipSync." }
$assetBytes = (Get-ChildItem -LiteralPath $WebAssets -Recurse -File | Measure-Object Length -Sum).Sum
if ($assetBytes -ge 4GB) { throw ("Web assets exceed the APK ZIP limit: {0:N2} GiB" -f ($assetBytes / 1GB)) }

Write-Host "[2/6] Preparing Android build tools and release key..."
$env:JAVA_HOME = $JdkHome
$env:ANDROID_SDK_ROOT = $Sdk
$env:GRADLE_USER_HOME = Join-Path $Toolchain "gradle-home"
New-Item -ItemType Directory -Path $Dist,$PrivateTools -Force | Out-Null
if (!(Test-Path -LiteralPath $Keystore)) {
  Invoke-Checked $KeyTool @(
    "-genkeypair", "-v", "-keystore", $Keystore, "-storepass", $StorePassword,
    "-keypass", $StorePassword, "-alias", $Alias, "-keyalg", "RSA", "-keysize", "2048",
    "-validity", "10000", "-dname", "CN=KF Unified Assistant Local, O=Kingdoms Forlorn, C=CN"
  )
}

Write-Host "[3/6] Building release APK..."
$tasks = if ($SkipClean) { @("--no-daemon", "--offline", "assembleRelease") } else { @("--no-daemon", "--offline", "clean", "assembleRelease") }
Invoke-Checked $Gradle $tasks

Write-Host "[4/6] Aligning and signing APK..."
$Unsigned = Join-Path $Root "app\build\outputs\apk\release\app-release-unsigned.apk"
$Aligned = Join-Path $Dist "kf-unified-local-aligned.tmp.apk"
$Output = Join-Path $Dist "KF-Unified-Assistant-Local-$versionName.apk"
Assert-File $Unsigned "unsigned release APK"
Invoke-Checked $ZipAlign @("-f", "-p", "4", $Unsigned, $Aligned)
Invoke-Checked $ApkSigner @(
  "sign", "--ks", $Keystore, "--ks-key-alias", $Alias,
  "--ks-pass", "pass:$StorePassword", "--key-pass", "pass:$StorePassword",
  "--out", $Output, $Aligned
)
Remove-Item -LiteralPath $Aligned -Force
if (Test-Path -LiteralPath "$Output.idsig") { Remove-Item -LiteralPath "$Output.idsig" -Force }

Write-Host "[5/6] Verifying signed standalone APK..."
Invoke-Checked $ApkSigner @("verify", "--verbose", "--print-certs", $Output)
Invoke-Checked $ZipAlign @("-c", "4", $Output)

$InstallScript = Join-Path $Dist "install-android.ps1"
$installText = @"
`$ErrorActionPreference = "Stop"
`$adb = "$Adb"
`$apk = Join-Path `$PSScriptRoot "$(Split-Path -Leaf $Output)"
if (!(Test-Path -LiteralPath `$adb)) { throw "ADB not found: `$adb" }
if (!(Test-Path -LiteralPath `$apk)) { throw "APK not found: `$apk" }
& `$adb start-server
& `$adb install -r `$apk
if (`$LASTEXITCODE -ne 0) { throw "APK install failed." }
Write-Host "KF Unified Assistant Local installed. The app runs without PHP or a server."
"@
Write-Utf8NoBom $InstallScript $installText

Write-Host "[6/6] Done."
$item = Get-Item -LiteralPath $Output
$hash = (Get-FileHash -LiteralPath $Output -Algorithm SHA256).Hash
Write-Host ("APK: {0}" -f $item.FullName)
Write-Host ("Size: {0:N2} GiB" -f ($item.Length / 1GB))
Write-Host ("SHA256: {0}" -f $hash)
Write-Host ("Install: powershell -ExecutionPolicy Bypass -File `"{0}`"" -f $InstallScript)
