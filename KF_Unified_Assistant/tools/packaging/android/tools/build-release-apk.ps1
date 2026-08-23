[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Version,
  [Parameter(Mandatory = $true)][string]$OutputPath,
  [Parameter(Mandatory = $true)][string]$KeystorePath,
  [Parameter(Mandatory = $true)][string]$StorePassword,
  [Parameter(Mandatory = $true)][string]$KeyAlias,
  [Parameter(Mandatory = $true)][string]$KeyPassword,
  [string]$Source = (Join-Path $PSScriptRoot "..\..\..\..")
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$gradleVersion = "8.9"
$gradleRoot = Join-Path $env:RUNNER_TEMP "kf-gradle-$gradleVersion"
$gradleZip = Join-Path $env:RUNNER_TEMP "gradle-$gradleVersion-bin.zip"
$gradleExe = Join-Path $gradleRoot "bin\gradle.bat"

function Invoke-Checked([string]$File, [string[]]$Arguments) {
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Command failed ($LASTEXITCODE): $File $($Arguments -join ' ')" }
}

if (!(Test-Path -LiteralPath (Join-Path $Source "public\index.html"))) { throw "Web source not found: $Source" }
if (!(Test-Path -LiteralPath (Join-Path $Root "app\build.gradle"))) { throw "Android project not found: $Root" }
if (!(Test-Path -LiteralPath $KeystorePath -PathType Leaf)) { throw "Keystore not found: $KeystorePath" }

if (!(Test-Path -LiteralPath $gradleExe)) {
  if (!(Test-Path -LiteralPath $gradleZip)) {
    Invoke-WebRequest -Uri "https://services.gradle.org/distributions/gradle-$gradleVersion-bin.zip" -OutFile $gradleZip
  }
  if (Test-Path -LiteralPath $gradleRoot) { Remove-Item -LiteralPath $gradleRoot -Recurse -Force }
  $extractRoot = Join-Path $env:RUNNER_TEMP "kf-gradle-extract"
  if (Test-Path -LiteralPath $extractRoot) { Remove-Item -LiteralPath $extractRoot -Recurse -Force }
  Expand-Archive -LiteralPath $gradleZip -DestinationPath $extractRoot -Force
  Move-Item -LiteralPath (Join-Path $extractRoot "gradle-$gradleVersion") -Destination $gradleRoot
  Remove-Item -LiteralPath $extractRoot -Recurse -Force
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root "android\sync-web-assets.ps1") -Source $Source
if ($LASTEXITCODE -ge 8) { throw "Web asset sync failed." }

$versionDigits = ($Version -replace '[^0-9]', '')
$versionCode = if ($versionDigits) { [Math]::Min([int64]$versionDigits, 2100000000) } else { 1 }
$env:ANDROID_HOME = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { $env:ANDROID_SDK_ROOT }
if (!$env:ANDROID_HOME) { throw "ANDROID_HOME or ANDROID_SDK_ROOT is required." }
$buildTools = Get-ChildItem -LiteralPath (Join-Path $env:ANDROID_HOME "build-tools") -Directory | Sort-Object Name -Descending | Select-Object -First 1
if (!$buildTools) { throw "Android build-tools not found." }
$zipAlign = Join-Path $buildTools.FullName "zipalign.exe"
$apkSigner = Join-Path $buildTools.FullName "apksigner.bat"
if (!(Test-Path $zipAlign) -or !(Test-Path $apkSigner)) { throw "zipalign/apksigner not found in $($buildTools.FullName)." }

Push-Location $Root
try {
  Invoke-Checked $gradleExe @("--no-daemon", "assembleRelease", "-PkfVersionName=$Version", "-PkfVersionCode=$versionCode")
} finally { Pop-Location }

$unsigned = Join-Path $Root "app\build\outputs\apk\release\app-release-unsigned.apk"
if (!(Test-Path -LiteralPath $unsigned)) { throw "Unsigned APK was not generated." }
$output = [IO.Path]::GetFullPath($OutputPath)
New-Item -ItemType Directory -Path (Split-Path $output -Parent) -Force | Out-Null
$aligned = Join-Path $env:RUNNER_TEMP "kf-aligned.apk"
Invoke-Checked $zipAlign @("-f", "-p", "4", $unsigned, $aligned)
Invoke-Checked $apkSigner @("sign", "--ks", $KeystorePath, "--ks-key-alias", $KeyAlias, "--ks-pass", "pass:$StorePassword", "--key-pass", "pass:$KeyPassword", "--out", $output, $aligned)
Invoke-Checked $apkSigner @("verify", "--verbose", $output)
Remove-Item -LiteralPath $aligned -Force -ErrorAction SilentlyContinue
$hash = (Get-FileHash -LiteralPath $output -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath "$output.sha256" -Value "$hash  $([IO.Path]::GetFileName($output))" -Encoding ascii
Write-Host "APK: $output"
Write-Host "SHA-256: $hash"
