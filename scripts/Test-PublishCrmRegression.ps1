[CmdletBinding()]
param(
  [int]$StartupTimeoutSeconds = 60
)

$ErrorActionPreference = "Stop"
$workspaceRoot = (& git rev-parse --show-toplevel 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $workspaceRoot) {
  throw "Publish/CRM regression requires a Git worktree."
}
$workspaceRoot = [System.IO.Path]::GetFullPath($workspaceRoot.Trim())
$workspaceParent = [System.IO.Path]::GetFullPath((Split-Path -Parent $workspaceRoot))
$defaultDataRoot = Join-Path $workspaceRoot ".local-data"
$nextEnvPath = Join-Path $workspaceRoot "next-env.d.ts"
$nextEnvBytes = [System.IO.File]::ReadAllBytes($nextEnvPath)
$testDataRoot = Join-Path $workspaceParent (".publish-crm-data-" + [guid]::NewGuid().ToString("N"))
$testDataRoot = [System.IO.Path]::GetFullPath($testDataRoot)

if (-not $testDataRoot.StartsWith($workspaceParent + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Safety gate: publish/CRM data path escaped the worktree parent."
}
if ([System.IO.Path]::GetFileName($testDataRoot) -notmatch '^\.publish-crm-data-[0-9a-f]{32}$') {
  throw "Safety gate: publish/CRM data path has an unexpected name."
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
$traceId = "publish-crm-$([DateTimeOffset]::Now.ToString('yyyyMMdd-HHmmss'))"
$publishPlanId = $null
$followupId = $null
$viewerVideoJobId = $null

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
    hook = "local-publish-crm-regression"
    platform = "local-package"
  }
  Assert-Status -Case "create publish source draft" -Observation $draftCreate -Expected @(201)
  $draftId = (Convert-ObservationJson $draftCreate).record.id
  if ([string]::IsNullOrWhiteSpace($draftId)) { throw "Content draft id was not returned." }

  $videoCreate = Invoke-HttpObservation -Method POST -Path "/api/workspace/video-jobs" -Session $adminSession -Body @{
    tenantId = $tenantId
    contentDraftId = $draftId
  }
  Assert-Status -Case "create publish source video" -Observation $videoCreate -Expected @(201)
  $videoJobId = (Convert-ObservationJson $videoCreate).record.id
  if ([string]::IsNullOrWhiteSpace($videoJobId)) { throw "Video job id was not returned." }

  $publishBody = @{ tenantId = $tenantId; videoJobId = $videoJobId; platform = "local-package" }
  $publishFirst = Invoke-HttpObservation -Method POST -Path "/api/workspace/publish-plans" -Session $adminSession -Body $publishBody
  Assert-Status -Case "first asset package plan" -Observation $publishFirst -Expected @(201)
  $publishSecond = Invoke-HttpObservation -Method POST -Path "/api/workspace/publish-plans" -Session $adminSession -Body $publishBody
  Assert-Status -Case "repeated asset package plan" -Observation $publishSecond -Expected @(201)
  $publishFirstRecord = (Convert-ObservationJson $publishFirst).record
  $publishSecondRecord = (Convert-ObservationJson $publishSecond).record
  $publishPlanId = $publishFirstRecord.id
  if ([string]::IsNullOrWhiteSpace($publishPlanId)) { throw "Publish plan id was not returned." }
  if ($publishPlanId -ne $publishSecondRecord.id) { throw "Repeated asset package creation returned a different plan id." }
  if ($null -ne $publishFirstRecord.scheduledAt) {
    throw "Local package plan crossed the external publishing boundary."
  }
  if (@($publishFirstRecord.packageChecklist).Count -lt 1) { throw "Asset package checklist was empty." }

  $publishList = Invoke-HttpObservation -Method GET -Path "/api/workspace/publish-plans?tenantId=$tenantId" -Session $adminSession -Body $null
  Assert-Status -Case "read idempotent publish plans" -Observation $publishList -Expected @(200)
  $publishMatches = @((Convert-ObservationJson $publishList).publishPlans | Where-Object { $_.videoJobId -eq $videoJobId -and $_.platform -eq "local-package" })
  if ($publishMatches.Count -ne 1 -or $publishMatches[0].id -ne $publishPlanId) {
    throw "Repeated asset package creation produced duplicate business records."
  }

  $followupBody = @{ tenantId = $tenantId; conversationId = $traceId; action = "add_followup"; note = "local CRM follow-up" }
  $followupFirst = Invoke-HttpObservation -Method POST -Path "/api/workspace/conversation-actions" -Session $adminSession -Body $followupBody
  Assert-Status -Case "first CRM follow-up" -Observation $followupFirst -Expected @(201)
  $followupSecond = Invoke-HttpObservation -Method POST -Path "/api/workspace/conversation-actions" -Session $adminSession -Body $followupBody
  Assert-Status -Case "repeated CRM follow-up" -Observation $followupSecond -Expected @(201)
  $followupId = (Convert-ObservationJson $followupFirst).record.id
  if ([string]::IsNullOrWhiteSpace($followupId)) { throw "CRM follow-up id was not returned." }
  if ($followupId -ne (Convert-ObservationJson $followupSecond).record.id) {
    throw "Repeated CRM follow-up returned a different record id."
  }

  $transfer = Invoke-HttpObservation -Method POST -Path "/api/workspace/conversation-actions" -Session $adminSession -Body @{
    tenantId = $tenantId
    conversationId = $traceId
    action = "transfer_human"
    note = "local human handoff"
  }
  Assert-Status -Case "distinct human transfer action" -Observation $transfer -Expected @(201)
  if ((Convert-ObservationJson $transfer).record.id -eq $followupId) {
    throw "A distinct conversation action reused the CRM follow-up record."
  }

  $actionList = Invoke-HttpObservation -Method GET -Path "/api/workspace/conversation-actions?tenantId=$tenantId" -Session $adminSession -Body $null
  Assert-Status -Case "read CRM action boundary" -Observation $actionList -Expected @(200)
  $traceActions = @((Convert-ObservationJson $actionList).conversationActions | Where-Object { $_.conversationId -eq $traceId })
  $followupMatches = @($traceActions | Where-Object { $_.action -eq "add_followup" })
  $transferMatches = @($traceActions | Where-Object { $_.action -eq "transfer_human" })
  if ($followupMatches.Count -ne 1 -or $transferMatches.Count -ne 1) {
    throw "Conversation action idempotency boundary is not one record per action kind."
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
  $viewerVideoCreate = Invoke-HttpObservation -Method POST -Path "/api/workspace/video-jobs" -Session $platformSession -Body @{
    tenantId = $viewerTenantId
    contentDraftId = $viewerDraftId
  }
  Assert-Status -Case "prepare viewer tenant video" -Observation $viewerVideoCreate -Expected @(201)
  $viewerVideoJobId = (Convert-ObservationJson $viewerVideoCreate).record.id

  $viewerSession = Login-User "user-viewer"
  $viewerPublish = Invoke-HttpObservation -Method POST -Path "/api/workspace/publish-plans" -Session $viewerSession -Body @{
    tenantId = $viewerTenantId
    videoJobId = $viewerVideoJobId
    platform = "local-package"
  }
  Assert-Status -Case "viewer publish plan rejected" -Observation $viewerPublish -Expected @(403)
  $viewerFollowup = Invoke-HttpObservation -Method POST -Path "/api/workspace/conversation-actions" -Session $viewerSession -Body @{
    tenantId = $viewerTenantId
    conversationId = "$traceId-viewer"
    action = "add_followup"
    note = "viewer-must-not-write"
  }
  Assert-Status -Case "viewer CRM follow-up rejected" -Observation $viewerFollowup -Expected @(403)

  $viewerPublishList = Invoke-HttpObservation -Method GET -Path "/api/workspace/publish-plans?tenantId=$viewerTenantId" -Session $platformSession -Body $null
  Assert-Status -Case "verify viewer created no publish plan" -Observation $viewerPublishList -Expected @(200)
  $viewerPublishMatches = @((Convert-ObservationJson $viewerPublishList).publishPlans | Where-Object { $_.videoJobId -eq $viewerVideoJobId })
  if ($viewerPublishMatches.Count -ne 0) { throw "Viewer write attempt created a publish plan." }

  $viewerActionList = Invoke-HttpObservation -Method GET -Path "/api/workspace/conversation-actions?tenantId=$viewerTenantId" -Session $platformSession -Body $null
  Assert-Status -Case "verify viewer created no CRM action" -Observation $viewerActionList -Expected @(200)
  $viewerActionMatches = @((Convert-ObservationJson $viewerActionList).conversationActions | Where-Object { $_.conversationId -eq "$traceId-viewer" })
  if ($viewerActionMatches.Count -ne 0) { throw "Viewer write attempt created a CRM action." }
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
    if ($resolvedTestRoot -ne $testDataRoot) { throw "Safety gate: publish/CRM cleanup path changed unexpectedly." }
    Remove-Item -LiteralPath $testDataRoot -Recurse -Force
  }
}

$after = Get-DirectoryFingerprint $defaultDataRoot
if (($before | ConvertTo-Json -Compress) -ne ($after | ConvertTo-Json -Compress)) {
  throw "Default .local-data changed during publish/CRM regression."
}
$matrixRows = @($matrix | ForEach-Object { $_ })

[pscustomobject]@{
  passed = $true
  profile = "publish_crm_regression"
  base_url = $baseUrl
  trace_id = $traceId
  repeated_publish_same_plan = $true
  publish_plan_id = $publishPlanId
  asset_package_only = $true
  repeated_followup_same_record = $true
  followup_id = $followupId
  distinct_action_separate_record = $true
  viewer_write_blocked = $true
  viewer_video_job_id = $viewerVideoJobId
  matrix_checks = $matrix.Count
  matrix = $matrixRows
  default_data_before = $before
  default_data_after = $after
  external_accounts = 0
  external_actions = 0
  temporary_data_removed = (-not (Test-Path -LiteralPath $testDataRoot))
} | ConvertTo-Json -Depth 8
