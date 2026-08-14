[CmdletBinding()]
param(
  [int]$StartupTimeoutSeconds = 60
)

$ErrorActionPreference = "Stop"
$workspaceRoot = (& git rev-parse --show-toplevel 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $workspaceRoot) {
  throw "Isolated E2E requires a Git worktree."
}
$workspaceRoot = [System.IO.Path]::GetFullPath($workspaceRoot.Trim())
$workspaceParent = [System.IO.Path]::GetFullPath((Split-Path -Parent $workspaceRoot))
$defaultDataRoot = Join-Path $workspaceRoot ".local-data"
$nextEnvPath = Join-Path $workspaceRoot "next-env.d.ts"
$nextEnvBytes = [System.IO.File]::ReadAllBytes($nextEnvPath)
$testDataRoot = Join-Path $workspaceParent (".e2e-data-" + [guid]::NewGuid().ToString("N"))
$testDataRoot = [System.IO.Path]::GetFullPath($testDataRoot)

if (-not $testDataRoot.StartsWith($workspaceParent + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Safety gate: isolated data path escaped the worktree parent."
}
if ([System.IO.Path]::GetFileName($testDataRoot) -notmatch '^\.e2e-data-[0-9a-f]{32}$') {
  throw "Safety gate: isolated data path has an unexpected name."
}

function Get-DirectoryFingerprint([string]$Root) {
  if (-not (Test-Path -LiteralPath $Root)) {
    return [pscustomobject]@{ exists = $false; files = 0; bytes = 0; sha256 = "missing" }
  }

  $files = @(Get-ChildItem -LiteralPath $Root -Recurse -File -Force | Sort-Object FullName)
  $relativeStart = $Root.TrimEnd([System.IO.Path]::DirectorySeparatorChar).Length + 1
  $lines = @($files | ForEach-Object {
    $relative = $_.FullName.Substring($relativeStart).Replace("\", "/")
    $hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
    "$relative`t$($_.Length)`t$hash"
  })
  $payload = $lines -join "`n"
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $digest = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($payload))).Replace("-", "")
  } finally {
    $sha.Dispose()
  }
  $bytes = if ($files.Count -eq 0) { 0 } else { ($files | Measure-Object Length -Sum).Sum }
  return [pscustomobject]@{ exists = $true; files = $files.Count; bytes = [long]$bytes; sha256 = $digest }
}

$before = Get-DirectoryFingerprint $defaultDataRoot
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
$listener.Stop()
$baseUrl = "http://127.0.0.1:$port"
$stdoutPath = Join-Path $testDataRoot "next.stdout.log"
$stderrPath = Join-Path $testDataRoot "next.stderr.log"
$server = $null
$workflowResult = $null
$isolatedFileCount = 0
$previousDataRoot = $env:AI_PRIVATE_DOMAIN_LOCAL_DATA_DIR
$previousDatabaseUrl = $env:DATABASE_URL

try {
  New-Item -ItemType Directory -Path $testDataRoot | Out-Null
  $env:AI_PRIVATE_DOMAIN_LOCAL_DATA_DIR = $testDataRoot
  $env:DATABASE_URL = ""
  $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
  $server = Start-Process -FilePath $npm `
    -ArgumentList @("run", "dev", "--", "--hostname", "127.0.0.1", "--port", "$port") `
    -WorkingDirectory $workspaceRoot -PassThru -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
  $env:AI_PRIVATE_DOMAIN_LOCAL_DATA_DIR = $previousDataRoot
  $env:DATABASE_URL = $previousDatabaseUrl

  $deadline = [DateTimeOffset]::Now.AddSeconds($StartupTimeoutSeconds)
  $ready = $false
  while ([DateTimeOffset]::Now -lt $deadline) {
    if ($server.HasExited) { break }
    try {
      $response = Invoke-WebRequest -Uri "$baseUrl/login" -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -eq 200) { $ready = $true; break }
    } catch {
      Start-Sleep -Seconds 1
    }
  }
  if (-not $ready) {
    $stderrTail = if (Test-Path -LiteralPath $stderrPath) { @(Get-Content -LiteralPath $stderrPath -Tail 30) -join "`n" } else { "" }
    throw "Next.js did not become ready at $baseUrl. $stderrTail"
  }

  $workflowJson = & (Join-Path $workspaceRoot "scripts\Test-ClientWorkflow.ps1") `
    -Mode full -BaseUrl $baseUrl -AllowLocalWrites
  if ($LASTEXITCODE -ne 0) { throw "Full client workflow returned exit code $LASTEXITCODE." }
  $workflowResult = $workflowJson | ConvertFrom-Json
  if (-not $workflowResult.passed -or $workflowResult.external_actions -ne 0 -or -not $workflowResult.trace_id) {
    throw "Full client workflow did not return the required isolated evidence."
  }

  $isolatedFiles = @(Get-ChildItem -LiteralPath $testDataRoot -Recurse -File -Force | Where-Object {
    $_.FullName -notin @($stdoutPath, $stderrPath)
  })
  $isolatedFileCount = $isolatedFiles.Count
  if ($isolatedFileCount -eq 0) { throw "Full workflow produced no isolated data files." }
} finally {
  $env:AI_PRIVATE_DOMAIN_LOCAL_DATA_DIR = $previousDataRoot
  $env:DATABASE_URL = $previousDatabaseUrl
  if ($null -ne $server -and -not $server.HasExited) {
    & taskkill.exe /PID $server.Id /T /F 2>$null | Out-Null
  }
  [System.IO.File]::WriteAllBytes($nextEnvPath, $nextEnvBytes)
  if (Test-Path -LiteralPath $testDataRoot) {
    $resolvedTestRoot = (Resolve-Path -LiteralPath $testDataRoot).Path
    if ($resolvedTestRoot -ne $testDataRoot) { throw "Safety gate: isolated cleanup path changed unexpectedly." }
    Remove-Item -LiteralPath $testDataRoot -Recurse -Force
  }
}

$after = Get-DirectoryFingerprint $defaultDataRoot
if (($before | ConvertTo-Json -Compress) -ne ($after | ConvertTo-Json -Compress)) {
  throw "Default .local-data changed during isolated E2E."
}

[pscustomobject]@{
  passed = $true
  profile = "isolated_client_e2e"
  base_url = $baseUrl
  trace_id = $workflowResult.trace_id
  isolated_data_files = $isolatedFileCount
  default_data_before = $before
  default_data_after = $after
  external_actions = $workflowResult.external_actions
  temporary_data_removed = (-not (Test-Path -LiteralPath $testDataRoot))
} | ConvertTo-Json -Depth 6
