[CmdletBinding()]
param(
  [int]$StartupTimeoutSeconds = 60
)

$ErrorActionPreference = "Stop"
$workspaceRoot = (& git rev-parse --show-toplevel 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $workspaceRoot) {
  throw "Auth regression requires a Git worktree."
}
$workspaceRoot = [System.IO.Path]::GetFullPath($workspaceRoot.Trim())
$workspaceParent = [System.IO.Path]::GetFullPath((Split-Path -Parent $workspaceRoot))
$defaultDataRoot = Join-Path $workspaceRoot ".local-data"
$nextEnvPath = Join-Path $workspaceRoot "next-env.d.ts"
$nextEnvBytes = [System.IO.File]::ReadAllBytes($nextEnvPath)
$testDataRoot = Join-Path $workspaceParent (".auth-regression-data-" + [guid]::NewGuid().ToString("N"))
$testDataRoot = [System.IO.Path]::GetFullPath($testDataRoot)

if (-not $testDataRoot.StartsWith($workspaceParent + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Safety gate: auth regression data path escaped the worktree parent."
}
if ([System.IO.Path]::GetFileName($testDataRoot) -notmatch '^\.auth-regression-data-[0-9a-f]{32}$') {
  throw "Safety gate: auth regression data path has an unexpected name."
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

function Invoke-HttpObservation {
  param(
    [string]$Method,
    [string]$Path,
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session,
    [object]$Body,
    [switch]$NoRedirect
  )

  $parameters = @{
    Uri = "$baseUrl$Path"
    Method = $Method
    Headers = @{ Origin = $baseUrl }
    UseBasicParsing = $true
  }
  if ($null -ne $Session) { $parameters.WebSession = $Session }
  if ($null -ne $Body) {
    $parameters.ContentType = "application/json"
    $parameters.Body = ($Body | ConvertTo-Json -Depth 8)
  }
  if ($NoRedirect) { $parameters.MaximumRedirection = 0 }

  try {
    $response = Invoke-WebRequest @parameters
    return [pscustomobject]@{
      status = [int]$response.StatusCode
      location = [string]$response.Headers.Location
      content = [string]$response.Content
    }
  } catch {
    if (-not $_.Exception.Response) { throw }
    $response = $_.Exception.Response
    $content = ""
    try {
      if ($response.Content) { $content = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult() }
    } catch {}
    return [pscustomobject]@{
      status = [int]$response.StatusCode
      location = [string]$response.Headers.Location
      content = $content
    }
  }
}

function Assert-Status {
  param(
    [string]$Case,
    [object]$Observation,
    [int[]]$Expected
  )
  if ($Observation.status -notin $Expected) {
    throw "$Case returned HTTP $($Observation.status); expected $($Expected -join '/')."
  }
  $script:matrix.Add([pscustomobject]@{
    case = $Case
    expected = ($Expected -join "/")
    actual = $Observation.status
    passed = $true
  })
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
$previousDataRoot = $env:AI_PRIVATE_DOMAIN_LOCAL_DATA_DIR
$previousDatabaseUrl = $env:DATABASE_URL
$matrix = New-Object System.Collections.Generic.List[object]
$roles = @(
  [pscustomobject]@{ userId = "user-platform-admin"; role = "platform_admin"; tenantId = "tenant-gold-academy"; otherTenantId = $null; canWrite = $true; canAdminWrite = $true },
  [pscustomobject]@{ userId = "user-tenant-admin"; role = "tenant_admin"; tenantId = "tenant-gold-academy"; otherTenantId = $null; canWrite = $true; canAdminWrite = $false },
  [pscustomobject]@{ userId = "user-operator"; role = "operator"; tenantId = "tenant-aesthetic-clinic"; otherTenantId = "tenant-gold-academy"; canWrite = $true; canAdminWrite = $false },
  [pscustomobject]@{ userId = "user-viewer"; role = "viewer"; tenantId = "tenant-aesthetic-clinic"; otherTenantId = "tenant-gold-academy"; canWrite = $false; canAdminWrite = $false }
)

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

  foreach ($path in @("/workspace/today", "/admin/overview")) {
    $observation = Invoke-HttpObservation -Method GET -Path $path -Session $null -Body $null -NoRedirect
    Assert-Status -Case "unauthenticated $path redirects" -Observation $observation -Expected @(302, 303, 307, 308)
    if ($observation.location -notmatch "/login") { throw "Unauthenticated $path did not redirect to /login." }
  }

  $invalidSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $invalidLogin = Invoke-HttpObservation -Method POST -Path "/api/auth/login" -Session $invalidSession -Body @{ userId = "missing-user"; loginCode = "" }
  Assert-Status -Case "unknown user login rejected" -Observation $invalidLogin -Expected @(404)

  foreach ($roleCase in $roles) {
    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $login = Invoke-HttpObservation -Method POST -Path "/api/auth/login" -Session $session -Body @{ userId = $roleCase.userId; loginCode = "" }
    Assert-Status -Case "$($roleCase.role) login" -Observation $login -Expected @(200)

    $me = Invoke-HttpObservation -Method GET -Path "/api/auth/me" -Session $session -Body $null
    Assert-Status -Case "$($roleCase.role) session identity" -Observation $me -Expected @(200)
    $meJson = $me.content | ConvertFrom-Json
    if ($meJson.user.role -ne $roleCase.role) { throw "$($roleCase.role) session returned role '$($meJson.user.role)'." }

    $workspacePage = Invoke-HttpObservation -Method GET -Path "/workspace/today?tenant=$($roleCase.tenantId)" -Session $session -Body $null -NoRedirect
    Assert-Status -Case "$($roleCase.role) workspace route" -Observation $workspacePage -Expected @(200)

    if ($roleCase.role -eq "platform_admin") {
      $adminPage = Invoke-HttpObservation -Method GET -Path "/admin/overview" -Session $session -Body $null -NoRedirect
      Assert-Status -Case "platform_admin admin route" -Observation $adminPage -Expected @(200)
    }

    $readOwn = Invoke-HttpObservation -Method GET -Path "/api/workspace/acquisition-plans?tenantId=$($roleCase.tenantId)" -Session $session -Body $null
    Assert-Status -Case "$($roleCase.role) own-tenant read" -Observation $readOwn -Expected @(200)

    $writeOwn = Invoke-HttpObservation -Method POST -Path "/api/workspace/acquisition-plans" -Session $session -Body @{
      tenantId = $roleCase.tenantId
      industry = "auth-regression"
      product = "local-$($roleCase.role)"
      customer = "local-test-user"
      hook = "local-permission-matrix"
      dailyLeadTarget = 1
      riskMode = "manual-review"
      channels = @("local-package")
    }
    $expectedWorkspaceWrite = if ($roleCase.canWrite) { @(201) } else { @(403) }
    Assert-Status -Case "$($roleCase.role) own-tenant write" -Observation $writeOwn -Expected $expectedWorkspaceWrite

    if ($roleCase.otherTenantId) {
      $readOther = Invoke-HttpObservation -Method GET -Path "/api/workspace/acquisition-plans?tenantId=$($roleCase.otherTenantId)" -Session $session -Body $null
      Assert-Status -Case "$($roleCase.role) cross-tenant read rejected" -Observation $readOther -Expected @(403)
      $writeOther = Invoke-HttpObservation -Method POST -Path "/api/workspace/acquisition-plans" -Session $session -Body @{
        tenantId = $roleCase.otherTenantId
        industry = "auth-regression"
        product = "cross-tenant-rejection"
        customer = "local-test-user"
        hook = "local-permission-matrix"
        dailyLeadTarget = 1
        riskMode = "manual-review"
        channels = @("local-package")
      }
      Assert-Status -Case "$($roleCase.role) cross-tenant write rejected" -Observation $writeOther -Expected @(403)
    }

    $adminWrite = Invoke-HttpObservation -Method POST -Path "/api/admin/tenants" -Session $session -Body @{
      company = "Auth Regression $($roleCase.role)"
      industry = "local-test"
      plan = "trial"
      renewalDate = "2026-12-31"
      seats = 1
    }
    $expectedAdminWrite = if ($roleCase.canAdminWrite) { @(201) } else { @(403) }
    Assert-Status -Case "$($roleCase.role) platform write" -Observation $adminWrite -Expected $expectedAdminWrite
  }
} finally {
  $env:AI_PRIVATE_DOMAIN_LOCAL_DATA_DIR = $previousDataRoot
  $env:DATABASE_URL = $previousDatabaseUrl
  if ($null -ne $server -and -not $server.HasExited) {
    $taskkill = Start-Process -FilePath (Join-Path $env:SystemRoot "System32\taskkill.exe") `
      -ArgumentList @("/PID", "$($server.Id)", "/T", "/F") -PassThru -Wait -WindowStyle Hidden
    if ($taskkill.ExitCode -ne 0) {
      $server.Refresh()
      if (-not $server.HasExited) {
        throw "Failed to stop the temporary Next.js process tree (PID $($server.Id))."
      }
    }
  }
  [System.IO.File]::WriteAllBytes($nextEnvPath, $nextEnvBytes)
  if (Test-Path -LiteralPath $testDataRoot) {
    $resolvedTestRoot = (Resolve-Path -LiteralPath $testDataRoot).Path
    if ($resolvedTestRoot -ne $testDataRoot) { throw "Safety gate: auth regression cleanup path changed unexpectedly." }
    Remove-Item -LiteralPath $testDataRoot -Recurse -Force
  }
}

$after = Get-DirectoryFingerprint $defaultDataRoot
if (($before | ConvertTo-Json -Compress) -ne ($after | ConvertTo-Json -Compress)) {
  throw "Default .local-data changed during auth regression."
}
$matrixRows = @($matrix | ForEach-Object { $_ })

[pscustomobject]@{
  passed = $true
  profile = "auth_regression"
  base_url = $baseUrl
  roles = @($roles.role)
  matrix_checks = $matrix.Count
  matrix = $matrixRows
  default_data_before = $before
  default_data_after = $after
  external_accounts = 0
  external_actions = 0
  temporary_data_removed = (-not (Test-Path -LiteralPath $testDataRoot))
} | ConvertTo-Json -Depth 8
