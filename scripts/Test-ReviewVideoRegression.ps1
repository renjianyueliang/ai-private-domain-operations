[CmdletBinding()]
param(
  [int]$StartupTimeoutSeconds = 60
)

$ErrorActionPreference = "Stop"
$workspaceRoot = (& git rev-parse --show-toplevel 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $workspaceRoot) {
  throw "Review/video regression requires a Git worktree."
}
$workspaceRoot = [System.IO.Path]::GetFullPath($workspaceRoot.Trim())
$workspaceParent = [System.IO.Path]::GetFullPath((Split-Path -Parent $workspaceRoot))
$defaultDataRoot = Join-Path $workspaceRoot ".local-data"
$nextEnvPath = Join-Path $workspaceRoot "next-env.d.ts"
$nextEnvBytes = [System.IO.File]::ReadAllBytes($nextEnvPath)
$testDataRoot = Join-Path $workspaceParent (".review-video-data-" + [guid]::NewGuid().ToString("N"))
$testDataRoot = [System.IO.Path]::GetFullPath($testDataRoot)

if (-not $testDataRoot.StartsWith($workspaceParent + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Safety gate: review/video data path escaped the worktree parent."
}
if ([System.IO.Path]::GetFileName($testDataRoot) -notmatch '^\.review-video-data-[0-9a-f]{32}$') {
  throw "Safety gate: review/video data path has an unexpected name."
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
    [object]$Body
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

  try {
    $response = Invoke-WebRequest @parameters
    return [pscustomobject]@{
      status = [int]$response.StatusCode
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

function Convert-ObservationJson([object]$Observation) {
  if ([string]::IsNullOrWhiteSpace($Observation.content)) { return $null }
  return $Observation.content | ConvertFrom-Json
}

function Login-User([string]$UserId) {
  $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $observation = Invoke-HttpObservation -Method POST -Path "/api/auth/login" -Session $session -Body @{
    userId = $UserId
    loginCode = ""
  }
  Assert-Status -Case "$UserId login" -Observation $observation -Expected @(200)
  return $session
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
$tenantId = "tenant-gold-academy"
$viewerTenantId = "tenant-aesthetic-clinic"
$traceId = "review-video-$([DateTimeOffset]::Now.ToString('yyyyMMdd-HHmmss'))"
$videoJobId = $null
$viewerDraftId = $null

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

  $adminSession = Login-User "user-tenant-admin"
  $draftCreate = Invoke-HttpObservation -Method POST -Path "/api/workspace/content-drafts" -Session $adminSession -Body @{
    tenantId = $tenantId
    product = $traceId
    customer = "local-opc-customer"
    hook = "local-review-video-regression"
    platform = "local-package"
  }
  Assert-Status -Case "create one review draft" -Observation $draftCreate -Expected @(201)
  $draftId = (Convert-ObservationJson $draftCreate).record.id
  if ([string]::IsNullOrWhiteSpace($draftId)) { throw "Content draft id was not returned." }

  $reviewBody = @{
    tenantId = $tenantId
    draftId = $draftId
    status = "approved"
    reviewNote = $traceId
  }
  $reviewFirst = Invoke-HttpObservation -Method PATCH -Path "/api/workspace/content-drafts" -Session $adminSession -Body $reviewBody
  Assert-Status -Case "first content approval" -Observation $reviewFirst -Expected @(200)
  $reviewSecond = Invoke-HttpObservation -Method PATCH -Path "/api/workspace/content-drafts" -Session $adminSession -Body $reviewBody
  Assert-Status -Case "repeated content approval" -Observation $reviewSecond -Expected @(200)
  if ((Convert-ObservationJson $reviewFirst).record.id -ne (Convert-ObservationJson $reviewSecond).record.id) {
    throw "Repeated approval did not return the same content draft."
  }

  $videoBody = @{ tenantId = $tenantId; contentDraftId = $draftId }
  $videoFirst = Invoke-HttpObservation -Method POST -Path "/api/workspace/video-jobs" -Session $adminSession -Body $videoBody
  Assert-Status -Case "first video generation" -Observation $videoFirst -Expected @(201)
  $videoSecond = Invoke-HttpObservation -Method POST -Path "/api/workspace/video-jobs" -Session $adminSession -Body $videoBody
  Assert-Status -Case "repeated video generation" -Observation $videoSecond -Expected @(201)
  $videoJobId = (Convert-ObservationJson $videoFirst).record.id
  if ([string]::IsNullOrWhiteSpace($videoJobId)) { throw "Video job id was not returned." }
  if ($videoJobId -ne (Convert-ObservationJson $videoSecond).record.id) {
    throw "Repeated video generation returned a different job id."
  }

  $draftList = Invoke-HttpObservation -Method GET -Path "/api/workspace/content-drafts?tenantId=$tenantId" -Session $adminSession -Body $null
  Assert-Status -Case "read final draft state" -Observation $draftList -Expected @(200)
  $draftMatches = @((Convert-ObservationJson $draftList).contentDrafts | Where-Object { $_.id -eq $draftId })
  if ($draftMatches.Count -ne 1 -or $draftMatches[0].status -ne "video_queued") {
    throw "Review/video flow did not leave one video_queued draft."
  }

  $videoList = Invoke-HttpObservation -Method GET -Path "/api/workspace/video-jobs?tenantId=$tenantId" -Session $adminSession -Body $null
  Assert-Status -Case "read idempotent video jobs" -Observation $videoList -Expected @(200)
  $videoMatches = @((Convert-ObservationJson $videoList).videoJobs | Where-Object { $_.contentDraftId -eq $draftId })
  if ($videoMatches.Count -ne 1 -or $videoMatches[0].id -ne $videoJobId) {
    throw "Repeated video generation created duplicate business records."
  }

  $platformSession = Login-User "user-platform-admin"
  $viewerDraftCreate = Invoke-HttpObservation -Method POST -Path "/api/workspace/content-drafts" -Session $platformSession -Body @{
    tenantId = $viewerTenantId
    product = "$traceId-viewer"
    customer = "local-viewer-permission"
    hook = "must-remain-read-only"
    platform = "local-package"
  }
  Assert-Status -Case "prepare viewer tenant draft" -Observation $viewerDraftCreate -Expected @(201)
  $viewerDraftId = (Convert-ObservationJson $viewerDraftCreate).record.id
  if ([string]::IsNullOrWhiteSpace($viewerDraftId)) { throw "Viewer tenant draft id was not returned." }

  $viewerSession = Login-User "user-viewer"
  $viewerReview = Invoke-HttpObservation -Method PATCH -Path "/api/workspace/content-drafts" -Session $viewerSession -Body @{
    tenantId = $viewerTenantId
    draftId = $viewerDraftId
    status = "approved"
    reviewNote = "viewer-must-not-write"
  }
  Assert-Status -Case "viewer approval rejected" -Observation $viewerReview -Expected @(403)
  $viewerVideo = Invoke-HttpObservation -Method POST -Path "/api/workspace/video-jobs" -Session $viewerSession -Body @{
    tenantId = $viewerTenantId
    contentDraftId = $viewerDraftId
  }
  Assert-Status -Case "viewer video generation rejected" -Observation $viewerVideo -Expected @(403)

  $viewerDraftList = Invoke-HttpObservation -Method GET -Path "/api/workspace/content-drafts?tenantId=$viewerTenantId" -Session $platformSession -Body $null
  Assert-Status -Case "verify viewer draft unchanged" -Observation $viewerDraftList -Expected @(200)
  $viewerDraftMatches = @((Convert-ObservationJson $viewerDraftList).contentDrafts | Where-Object { $_.id -eq $viewerDraftId })
  if ($viewerDraftMatches.Count -ne 1 -or $viewerDraftMatches[0].status -ne "needs_review") {
    throw "Viewer write attempt changed the content draft."
  }

  $viewerVideoList = Invoke-HttpObservation -Method GET -Path "/api/workspace/video-jobs?tenantId=$viewerTenantId" -Session $platformSession -Body $null
  Assert-Status -Case "verify viewer created no video" -Observation $viewerVideoList -Expected @(200)
  $viewerVideoMatches = @((Convert-ObservationJson $viewerVideoList).videoJobs | Where-Object { $_.contentDraftId -eq $viewerDraftId })
  if ($viewerVideoMatches.Count -ne 0) { throw "Viewer write attempt created a video job." }
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
    if ($resolvedTestRoot -ne $testDataRoot) { throw "Safety gate: review/video cleanup path changed unexpectedly." }
    Remove-Item -LiteralPath $testDataRoot -Recurse -Force
  }
}

$after = Get-DirectoryFingerprint $defaultDataRoot
if (($before | ConvertTo-Json -Compress) -ne ($after | ConvertTo-Json -Compress)) {
  throw "Default .local-data changed during review/video regression."
}
$matrixRows = @($matrix | ForEach-Object { $_ })

[pscustomobject]@{
  passed = $true
  profile = "review_video_regression"
  base_url = $baseUrl
  trace_id = $traceId
  repeated_approval_same_draft = $true
  repeated_generation_same_job = $true
  video_job_id = $videoJobId
  viewer_write_blocked = $true
  viewer_draft_id = $viewerDraftId
  matrix_checks = $matrix.Count
  matrix = $matrixRows
  default_data_before = $before
  default_data_after = $after
  external_accounts = 0
  external_actions = 0
  temporary_data_removed = (-not (Test-Path -LiteralPath $testDataRoot))
} | ConvertTo-Json -Depth 8
