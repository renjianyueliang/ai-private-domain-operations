[CmdletBinding()]
param(
  [ValidateSet("smoke", "full")]
  [string]$Mode = "smoke",
  [string]$BaseUrl = "http://127.0.0.1:3000",
  [switch]$AllowLocalWrites
)

$ErrorActionPreference = "Stop"
$uri = [Uri]$BaseUrl
if ($uri.Scheme -notin @("http", "https") -or $uri.Host -notin @("127.0.0.1", "localhost", "::1")) {
  throw "Safety gate: tests may only target localhost or 127.0.0.1."
}
if ($Mode -eq "full" -and -not $AllowLocalWrites) {
  throw "Safety gate: full mode creates e2e-marked local records. Re-run with -AllowLocalWrites."
}

function Invoke-JsonRequest {
  param(
    [string]$Method,
    [string]$Path,
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session,
    [object]$Body
  )
  $parameters = @{
    Uri = "$BaseUrl$Path"
    Method = $Method
    WebSession = $Session
    Headers = @{ Origin = $BaseUrl }
    UseBasicParsing = $true
  }
  if ($null -ne $Body) {
    $parameters.ContentType = "application/json"
    $parameters.Body = ($Body | ConvertTo-Json -Depth 8)
  }
  $response = Invoke-WebRequest @parameters
  if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
    throw "$Method $Path returned $($response.StatusCode)."
  }
  if ([string]::IsNullOrWhiteSpace($response.Content)) { return $null }
  return $response.Content | ConvertFrom-Json
}

try {
  $health = Invoke-WebRequest -Uri "$BaseUrl/login" -UseBasicParsing -TimeoutSec 10
} catch {
  throw "Local service is unavailable at $BaseUrl. Start it with npm run dev, then retry."
}
if ($health.StatusCode -ne 200) { throw "Login page returned $($health.StatusCode)." }

$adminSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$login = Invoke-JsonRequest -Method POST -Path "/api/auth/login" -Session $adminSession -Body @{ userId = "user-tenant-admin"; loginCode = "" }
if ($login.user.role -ne "tenant_admin") { throw "Tenant admin login did not return the expected role." }

$routes = @(
  "/workspace/today", "/workspace/plan", "/workspace/review", "/workspace/video",
  "/workspace/channels", "/workspace/inbox", "/workspace/crm"
)
foreach ($route in $routes) {
  $page = Invoke-WebRequest -Uri "$BaseUrl$route" -WebSession $adminSession -MaximumRedirection 0 -UseBasicParsing
  if ($page.StatusCode -ne 200) { throw "$route returned $($page.StatusCode)." }
}

$tenantId = "tenant-gold-academy"
foreach ($path in @(
  "/api/workspace/acquisition-plans?tenantId=$tenantId",
  "/api/workspace/content-drafts?tenantId=$tenantId",
  "/api/workspace/video-jobs?tenantId=$tenantId",
  "/api/workspace/publish-plans?tenantId=$tenantId",
  "/api/workspace/conversation-actions?tenantId=$tenantId"
)) {
  [void](Invoke-JsonRequest -Method GET -Path $path -Session $adminSession -Body $null)
}

$viewerSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
[void](Invoke-JsonRequest -Method POST -Path "/api/auth/login" -Session $viewerSession -Body @{ userId = "user-viewer"; loginCode = "" })
$viewerBlocked = $false
try {
  [void](Invoke-JsonRequest -Method POST -Path "/api/workspace/acquisition-plans" -Session $viewerSession -Body @{
    tenantId = "tenant-aesthetic-clinic"; industry = "e2e-permission-check"; product = "no-write";
    customer = "no-write"; hook = "no-write"; dailyLeadTarget = 1; riskMode = "manual-review"; channels = @()
  })
} catch {
  if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 403) { $viewerBlocked = $true } else { throw }
}
if (-not $viewerBlocked) { throw "Viewer write was not blocked with HTTP 403." }

$traceId = $null
if ($Mode -eq "full") {
  $traceId = "e2e-$([DateTimeOffset]::Now.ToString('yyyyMMdd-HHmmss'))"
  [void](Invoke-JsonRequest -Method POST -Path "/api/workspace/acquisition-plans" -Session $adminSession -Body @{
    tenantId = $tenantId; industry = "automation-acceptance"; product = $traceId; customer = "local-test-user";
    hook = "local-loop-test"; dailyLeadTarget = 1; riskMode = "manual-review"; channels = @("local-package")
  })
  $draftResult = Invoke-JsonRequest -Method POST -Path "/api/workspace/content-drafts" -Session $adminSession -Body @{
    tenantId = $tenantId; product = $traceId; customer = "local-test-user"; hook = "local-loop-test"; platform = "local-package"
  }
  $draftId = $draftResult.record.id
  if (-not $draftId) { throw "Content draft id was not returned." }
  [void](Invoke-JsonRequest -Method PATCH -Path "/api/workspace/content-drafts" -Session $adminSession -Body @{
    tenantId = $tenantId; draftId = $draftId; status = "approved"; reviewNote = $traceId
  })
  $videoResult = Invoke-JsonRequest -Method POST -Path "/api/workspace/video-jobs" -Session $adminSession -Body @{
    tenantId = $tenantId; contentDraftId = $draftId
  }
  $videoJobId = $videoResult.record.id
  if (-not $videoJobId) { throw "Video job id was not returned." }
  [void](Invoke-JsonRequest -Method POST -Path "/api/workspace/publish-plans" -Session $adminSession -Body @{
    tenantId = $tenantId; videoJobId = $videoJobId; platform = "local-package"
  })
  [void](Invoke-JsonRequest -Method POST -Path "/api/workspace/conversation-actions" -Session $adminSession -Body @{
    tenantId = $tenantId; conversationId = $traceId; action = "add_followup"; note = $traceId
  })
}

[pscustomobject]@{
  passed = $true
  mode = $Mode
  base_url = $BaseUrl
  authenticated_role = "tenant_admin"
  protected_routes = $routes.Count
  api_reads = 5
  viewer_write_blocked = $viewerBlocked
  local_business_writes = ($Mode -eq "full")
  trace_id = $traceId
  external_actions = 0
} | ConvertTo-Json
