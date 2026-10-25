[CmdletBinding()]
param([string]$PackScript)

$ErrorActionPreference = 'Stop'
if (-not $PackScript) { $PackScript = Join-Path $PSScriptRoot 'pack-ignored-images.ps1' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$git = (Get-Command git -ErrorAction Stop).Source
$fixtureParent = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$fixture = Join-Path $fixtureParent ('kf-resource-pack-test-' + [guid]::NewGuid().ToString('N'))
$utf8 = [Text.UTF8Encoding]::new($false)
$expected = @{}

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
}

function Write-FixtureFile([string]$Relative, [string]$Content) {
  $full = Join-Path $fixture $Relative
  [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($full)) | Out-Null
  $bytes = $utf8.GetBytes($Content)
  [IO.File]::WriteAllBytes($full, $bytes)
  return $bytes
}

function Assert-Archive([string]$ArchivePath, [hashtable]$ExpectedFiles) {
  $archive = [IO.Compression.ZipFile]::OpenRead($ArchivePath)
  try {
    Assert-True ($archive.Entries.Count -eq ($ExpectedFiles.Count + 1)) 'ZIP must contain only the expected assets and restore README.'
    foreach ($relative in $ExpectedFiles.Keys) {
      $entry = $archive.GetEntry($relative)
      Assert-True ($null -ne $entry) "Missing asset: $relative"
      $stream = $entry.Open()
      $copy = [IO.MemoryStream]::new()
      try {
        $stream.CopyTo($copy)
        Assert-True ([Convert]::ToBase64String($copy.ToArray()) -ceq [Convert]::ToBase64String($ExpectedFiles[$relative])) "Asset bytes changed: $relative"
      } finally {
        $copy.Dispose()
        $stream.Dispose()
      }
    }
    $readme = $archive.GetEntry('RESTORE-README.txt')
    Assert-True ($null -ne $readme) 'Restore README must be included.'
  } finally { $archive.Dispose() }
}

try {
  [IO.Directory]::CreateDirectory($fixture) | Out-Null
  $fixtureScript = Join-Path $fixture 'KF_Unified_Assistant/tools/pack-ignored-images.ps1'
  [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($fixtureScript)) | Out-Null
  Copy-Item -LiteralPath $PackScript -Destination $fixtureScript
  & $git -C $fixture init --quiet
  Assert-True ($LASTEXITCODE -eq 0) 'Fixture git init failed.'
  Write-FixtureFile '.gitignore' "*.jpg`n*.png`n" | Out-Null

  $prefix = 'KF_Unified_Assistant/public/assets/'
  # These tracked files reproduced the Android pack omission.
  $tracked = @('rogue/rosegraal-tree.jpg', 'conflict/belly-of-beast.jpg')
  foreach ($relative in $tracked) {
    $entryName = $prefix + $relative
    $expected[$entryName] = Write-FixtureFile $entryName ('tracked:' + $relative)
    & $git -C $fixture add --force -- $entryName
    Assert-True ($LASTEXITCODE -eq 0) "Fixture git add failed: $entryName"
  }

  # Build a Unicode filename without depending on the test script's encoding in Windows PowerShell 5.1.
  $unicodeName = ([string][char]0x5E95) + [char]0x56FE + '.png'
  foreach ($relative in @('map/ignored.jpg', ('cards/' + $unicodeName), 'tokens/untracked.webp', '.hidden.jpg')) {
    $entryName = $prefix + $relative
    $expected[$entryName] = Write-FixtureFile $entryName ('asset:' + $relative)
  }

  foreach ($relative in @(
    'outside.jpg',
    'KF_Unified_Assistant/public/modules/rogue/assets/old.jpg',
    'KF_Unified_Assistant/tools/packaging/android/app/src/main/assets/web/assets/generated.jpg',
    'KF_Unified_Assistant/data/private.jpg',
    ($prefix + 'data/private.jpg'),
    ($prefix + 'backups/private.png'),
    ($prefix + 'logs/private.webp'),
    ($prefix + '.env.png'),
    ($prefix + 'notes.txt')
  )) { Write-FixtureFile $relative 'must not be distributed' | Out-Null }

  $dryOutput = Join-Path $fixture 'dry-run.zip'
  & $fixtureScript -OutputPath $dryOutput -DryRun | Out-Null
  Assert-True (-not (Test-Path -LiteralPath $dryOutput)) 'DryRun must not create an archive.'
  Assert-True (-not (Test-Path -LiteralPath ($dryOutput + '.sha256.txt'))) 'DryRun must not create a hash file.'
  Assert-True (-not (Test-Path -LiteralPath ($dryOutput + '.partial'))) 'DryRun must not create a partial archive.'

  $output = Join-Path $fixture 'resources.zip'
  [IO.File]::WriteAllText($output, 'old archive', $utf8)
  & $fixtureScript -OutputPath $output -Force -NoHash | Out-Null
  Assert-Archive $output $expected
  Assert-True (-not (Test-Path -LiteralPath ($output + '.sha256.txt'))) 'NoHash must not create a hash file.'
  Assert-True (-not (Test-Path -LiteralPath ($output + '.partial'))) 'Successful packing must remove the partial archive.'

  $hashOutput = Join-Path $fixture 'resources-with-hash.zip'
  & $fixtureScript -OutputPath $hashOutput | Out-Null
  Assert-Archive $hashOutput $expected
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $hashOutput).Hash.ToLowerInvariant()
  $hashText = [IO.File]::ReadAllText($hashOutput + '.sha256.txt').Trim()
  Assert-True ($hashText -ceq ($hash + '  ' + [IO.Path]::GetFileName($hashOutput))) 'SHA256 sidecar must match the final ZIP.'

  # Custom extensions must still respect the fixed sensitive-path exclusions.
  $expected[$prefix + 'notes.txt'] = $utf8.GetBytes('must not be distributed')
  Write-FixtureFile ($prefix + 'data/private.txt') 'sensitive custom extension' | Out-Null
  Write-FixtureFile ($prefix + '.env.txt') 'sensitive config' | Out-Null
  $customOutput = Join-Path $fixture 'resources-custom.zip'
  & $fixtureScript -OutputPath $customOutput -Extension @('jpg', 'png', 'webp', 'txt') -NoHash | Out-Null
  Assert-Archive $customOutput $expected

  Write-Output 'Resource pack regression passed: tracked, ignored, untracked, Unicode and hidden assets; sensitive exclusions; DryRun, Force, NoHash and SHA256.'
} finally {
  # Only remove the unique fixture under the OS temp directory.
  $resolvedFixture = [IO.Path]::GetFullPath($fixture)
  $safePrefix = $fixtureParent.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
  if (-not $resolvedFixture.StartsWith($safePrefix, [StringComparison]::OrdinalIgnoreCase) -or
      [IO.Path]::GetFileName($resolvedFixture) -notmatch '^kf-resource-pack-test-[0-9a-f]{32}$') {
    throw "Unsafe test cleanup path: $resolvedFixture"
  }
  if (Test-Path -LiteralPath $resolvedFixture) { Remove-Item -LiteralPath $resolvedFixture -Recurse -Force }
}
