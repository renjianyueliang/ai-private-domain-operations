[CmdletBinding()]
param(
  [ValidateSet("validate", "status", "team", "next")]
  [string]$Mode = "validate",
  [string]$ProjectRoot = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path
} else {
  $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

$teamRoot = Join-Path $ProjectRoot "agents\opc-dev-team"
$manifestPath = Join-Path $teamRoot "TEAM_MANIFEST.json"
$teamQueuePath = Join-Path $teamRoot "TASK_QUEUE.json"

function Read-JsonFile([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Required JSON file is missing: $Path"
  }
  try {
    return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
  } catch {
    throw "Invalid JSON file $Path. $($_.Exception.Message)"
  }
}

function Get-GitState([string]$Root) {
  $inside = @(& git -C $Root rev-parse --is-inside-work-tree 2>$null)
  $repository = ($LASTEXITCODE -eq 0 -and ($inside | Select-Object -First 1) -eq "true")
  if (-not $repository) {
    return [pscustomobject][ordered]@{ repository = $false; clean = $null; branch = $null; head = $null; linked_worktree = $false }
  }

  $changes = @(& git -C $Root status --porcelain 2>$null)
  $head = @(& git -C $Root rev-parse --verify HEAD 2>$null) | Select-Object -First 1
  $branch = @(& git -C $Root symbolic-ref --short HEAD 2>$null) | Select-Object -First 1
  $gitDirectory = @(& git -C $Root rev-parse --git-dir 2>$null) | Select-Object -First 1
  $commonDirectory = @(& git -C $Root rev-parse --git-common-dir 2>$null) | Select-Object -First 1
  $gitDirectoryValue = ([string]$gitDirectory).Replace('/', '\')
  $commonDirectoryValue = ([string]$commonDirectory).Replace('/', '\')
  $gitDirectoryCandidate = if ([IO.Path]::IsPathRooted($gitDirectoryValue)) { $gitDirectoryValue } else { Join-Path $Root $gitDirectoryValue }
  $commonDirectoryCandidate = if ([IO.Path]::IsPathRooted($commonDirectoryValue)) { $commonDirectoryValue } else { Join-Path $Root $commonDirectoryValue }
  $gitDirectoryPath = [IO.Path]::GetFullPath($gitDirectoryCandidate).TrimEnd('\')
  $commonDirectoryPath = [IO.Path]::GetFullPath($commonDirectoryCandidate).TrimEnd('\')

  return [pscustomobject][ordered]@{
    repository = $true
    clean = ($changes.Count -eq 0)
    branch = $branch
    head = $head
    linked_worktree = -not [string]::Equals($gitDirectoryPath, $commonDirectoryPath, [StringComparison]::OrdinalIgnoreCase)
  }
}

function Invoke-PrimaryController([string]$PrimaryMode) {
  $controllerPath = Join-Path $ProjectRoot "scripts\Invoke-AITeamController.ps1"
  $queuePath = Join-Path $ProjectRoot "TASK_QUEUE.json"
  if (-not (Test-Path -LiteralPath $controllerPath -PathType Leaf)) {
    throw "Primary controller is missing: $controllerPath"
  }
  Push-Location $ProjectRoot
  try {
    $output = @(& powershell -NoProfile -ExecutionPolicy Bypass -File $controllerPath -Mode $PrimaryMode -QueuePath $queuePath 2>&1)
  } finally {
    Pop-Location
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Primary controller $PrimaryMode failed: $($output -join [Environment]::NewLine)"
  }
  try {
    return ($output -join [Environment]::NewLine) | ConvertFrom-Json
  } catch {
    throw "Primary controller returned invalid JSON for mode $PrimaryMode."
  }
}

$manifest = Read-JsonFile $manifestPath
$teamQueue = Read-JsonFile $teamQueuePath
$git = Get-GitState $ProjectRoot

if ($Mode -eq "validate") {
  $errors = [System.Collections.Generic.List[string]]::new()
  if ($manifest.version -ne 1) { $errors.Add("TEAM_MANIFEST version must be 1.") }
  if ($manifest.max_tasks_per_cycle -ne 1) { $errors.Add("max_tasks_per_cycle must equal 1.") }
  if ($teamQueue.policy.max_tasks_per_cycle -ne 1) { $errors.Add("Team queue max_tasks_per_cycle must equal 1.") }
  if ($teamQueue.policy.auto_execute_governance_tasks -ne $false) { $errors.Add("Governance tasks must not auto-execute.") }

  $roleIds = @($manifest.roles | ForEach-Object { [string]$_.id })
  $requiredRoleIds = @("product-lead", "architecture-developer", "qa-test-agent", "security-compliance-agent", "operations-researcher", "task-controller")
  if ($roleIds.Count -ne 6 -or @($roleIds | Sort-Object -Unique).Count -ne 6) {
    $errors.Add("Exactly six unique roles are required.")
  }
  foreach ($requiredRoleId in $requiredRoleIds) {
    if ($roleIds -notcontains $requiredRoleId) { $errors.Add("Required role is missing: $requiredRoleId") }
  }
  foreach ($role in $manifest.roles) {
    $rolePath = Join-Path $ProjectRoot ([string]$role.config).Replace('/', '\')
    if (-not (Test-Path -LiteralPath $rolePath -PathType Leaf)) { $errors.Add("Role config is missing: $($role.config)") }
  }
  foreach ($relativePath in $manifest.mandatory_project_files) {
    $requiredPath = Join-Path $ProjectRoot ([string]$relativePath).Replace('/', '\')
    if (-not (Test-Path -LiteralPath $requiredPath)) { $errors.Add("Mandatory project file is missing: $relativePath") }
  }
  foreach ($boundary in $manifest.hard_boundaries.PSObject.Properties) {
    if ($boundary.Value -ne $false) { $errors.Add("Hard boundary must remain false: $($boundary.Name)") }
  }
  if ($manifest.candidate_delivery.force_push -ne $false -or $manifest.candidate_delivery.auto_merge -ne $false -or $manifest.candidate_delivery.auto_deploy -ne $false) {
    $errors.Add("Force push, auto merge, and auto deploy must remain false.")
  }

  $primary = $null
  try { $primary = Invoke-PrimaryController "validate" } catch { $errors.Add($_.Exception.Message) }

  [pscustomobject][ordered]@{
    passed = ($errors.Count -eq 0)
    mode = $Mode
    team_id = $manifest.team_id
    team_name = $manifest.team_name
    role_count = $roleIds.Count
    max_tasks_per_cycle = 1
    primary_controller_valid = ($null -ne $primary -and $primary.valid -eq $true)
    git = $git
    errors = [string[]]$errors
    deployment_enabled = $false
    external_actions_enabled = $false
  } | ConvertTo-Json -Depth 10
  if ($errors.Count -gt 0) { exit 1 }
  exit 0
}

if ($Mode -eq "status") {
  $summary = Invoke-PrimaryController "summary"
  [pscustomobject][ordered]@{
    passed = $true
    mode = $Mode
    observed_at = [DateTimeOffset]::Now.ToString("o")
    team_id = $manifest.team_id
    autonomy_stage = $manifest.autonomy_stage
    git = $git
    source_write_ready = ($git.repository -and $git.clean -and $git.linked_worktree -and ([string]$git.branch).StartsWith("codex/"))
    primary_queue = $summary
    max_tasks_per_cycle = 1
    deployment_enabled = $false
    external_actions_enabled = $false
  } | ConvertTo-Json -Depth 10
  exit 0
}

if ($Mode -eq "team") {
  [pscustomobject][ordered]@{
    passed = $true
    mode = $Mode
    team_id = $manifest.team_id
    team_name = $manifest.team_name
    autonomy_stage = $manifest.autonomy_stage
    roles = @($manifest.roles)
    max_tasks_per_cycle = 1
    primary_task_queue = Join-Path $ProjectRoot "TASK_QUEUE.json"
    governance_task_count = @($teamQueue.tasks).Count
    hard_boundaries = $manifest.hard_boundaries
    entry_points = [pscustomobject][ordered]@{
      manifest = $manifestPath
      dashboard = Join-Path $teamRoot "TEAM_DASHBOARD.md"
      project_memory = Join-Path $teamRoot "PROJECT_MEMORY.md"
      runbook = Join-Path $teamRoot "RUNBOOK.md"
    }
  } | ConvertTo-Json -Depth 12
  exit 0
}

$primarySelection = Invoke-PrimaryController "next"
$sourceWriteReady = ($git.repository -and $git.clean -and $git.linked_worktree -and ([string]$git.branch).StartsWith("codex/"))
$blockedCandidateId = $null
if ($null -ne $primarySelection.selected -and $primarySelection.selected.risk_level -ne "read_only" -and -not $sourceWriteReady) {
  $blockedCandidateId = $primarySelection.selected.id
  $primarySelection.selected = $null
}
$selectedCount = if ($null -eq $primarySelection.selected) { 0 } else { 1 }
[pscustomobject][ordered]@{
  passed = $true
  mode = $Mode
  selected = $primarySelection.selected
  selected_count = $selectedCount
  reason = if ($null -ne $blockedCandidateId) { "Primary candidate $blockedCandidateId requires a clean codex/ linked worktree; selection was blocked." } else { "Delegated to the repository controller. No task was executed or mutated." }
  primary_reason = $primarySelection.reason
  blocked_candidate_id = $blockedCandidateId
  source_write_ready = $sourceWriteReady
  max_tasks_per_cycle = 1
  execution_performed = $false
  deployment_enabled = $false
  external_actions_enabled = $false
} | ConvertTo-Json -Depth 12
