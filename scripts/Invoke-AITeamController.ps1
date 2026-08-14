[CmdletBinding()]
param(
  [ValidateSet("validate", "summary", "next")]
  [string]$Mode = "validate",
  [string]$QueuePath = ""
)

$ErrorActionPreference = "Stop"
$gitRoot = (& git rev-parse --show-toplevel 2>$null)
$workspaceRoot = if ($LASTEXITCODE -eq 0 -and $gitRoot) {
  [System.IO.Path]::GetFullPath($gitRoot.Trim())
} else {
  [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
}
if ([string]::IsNullOrWhiteSpace($QueuePath)) {
  $QueuePath = Join-Path $workspaceRoot "TASK_QUEUE.json"
}
$validPriorities = @("P0", "P1", "P2")
$validStatuses = @("backlog", "ready", "in_progress", "blocked", "approval_required", "done")
$validRisks = @("read_only", "low_risk_write", "controlled_write", "high_risk")
$validProfiles = @(
  "read_only", "docs_only", "typecheck", "isolated_client_e2e",
  "auth_regression", "review_video_regression", "publish_crm_regression"
)

function Fail-Validation([string]$Message) {
  throw "Queue validation failed: $Message"
}

if (-not (Test-Path -LiteralPath $QueuePath -PathType Leaf)) {
  Fail-Validation "Queue file not found: $QueuePath"
}

try {
  $queue = Get-Content -LiteralPath $QueuePath -Raw -Encoding UTF8 | ConvertFrom-Json
} catch {
  Fail-Validation "Invalid JSON. $($_.Exception.Message)"
}

if ($queue.version -ne 1) { Fail-Validation "version must be 1." }
if ($queue.policy.stage -ne 4) { Fail-Validation "policy.stage must be 4." }
if ($queue.policy.max_tasks_per_run -ne 1) { Fail-Validation "max_tasks_per_run must be 1." }
if ($queue.policy.deployment_enabled -ne $false) { Fail-Validation "deployment_enabled must remain false." }
if ($queue.policy.execution_environment -ne "worktree") { Fail-Validation "execution_environment must be worktree." }
if ($queue.policy.require_human_review -ne $true) { Fail-Validation "require_human_review must be true." }
if ($queue.policy.max_changed_files -lt 1 -or $queue.policy.max_changed_files -gt 20) {
  Fail-Validation "max_changed_files must be between 1 and 20."
}
if ($queue.policy.delivery.auto_commit -ne $true -or $queue.policy.delivery.auto_push -ne $true) {
  Fail-Validation "Stage 4 requires auto_commit and auto_push."
}
if ($queue.policy.delivery.force_push -ne $false -or $queue.policy.delivery.auto_merge -ne $false -or $queue.policy.delivery.auto_deploy -ne $false) {
  Fail-Validation "Force push, auto merge, and auto deploy must remain false."
}
if ($queue.policy.delivery.integration_branch -ne "codex/ai-team-operating-system") {
  Fail-Validation "Unexpected integration branch."
}
if ($queue.policy.delivery.draft_pr_number -ne 2) { Fail-Validation "draft_pr_number must remain 2." }
if (-not $queue.tasks -or $queue.tasks.Count -lt 1) { Fail-Validation "tasks must not be empty." }

$autoRisks = @($queue.policy.auto_selectable_risk_levels)
if ($autoRisks.Count -ne 2 -or $autoRisks -notcontains "read_only" -or $autoRisks -notcontains "low_risk_write") {
  Fail-Validation "Stage 4 allows exactly read_only and low_risk_write for automatic selection."
}
$allowedProfiles = @($queue.policy.allowed_verification_profiles)
foreach ($profile in $allowedProfiles) {
  if ($validProfiles -notcontains $profile) { Fail-Validation "Unknown allowed verification profile '$profile'." }
}

$taskMap = @{}
foreach ($task in $queue.tasks) {
  foreach ($field in @("id", "title", "objective", "priority", "status", "risk_level", "auto_runnable", "verification_profile", "depends_on", "allowed_paths", "acceptance_tests", "rollback_plan", "evidence")) {
    if ($null -eq $task.PSObject.Properties[$field]) { Fail-Validation "Task is missing field '$field'." }
  }
  if ([string]::IsNullOrWhiteSpace($task.id)) { Fail-Validation "Task id must not be blank." }
  if ($taskMap.ContainsKey($task.id)) { Fail-Validation "Duplicate task id '$($task.id)'." }
  if ($validPriorities -notcontains $task.priority) { Fail-Validation "Task $($task.id) has invalid priority." }
  if ($validStatuses -notcontains $task.status) { Fail-Validation "Task $($task.id) has invalid status." }
  if ($validRisks -notcontains $task.risk_level) { Fail-Validation "Task $($task.id) has invalid risk_level." }
  if ($allowedProfiles -notcontains $task.verification_profile) { Fail-Validation "Task $($task.id) has a disallowed verification_profile." }
  if ($task.risk_level -eq "read_only" -and $task.verification_profile -ne "read_only") {
    Fail-Validation "Read-only task $($task.id) must use the read_only profile."
  }
  if ($task.risk_level -eq "low_risk_write" -and $task.verification_profile -eq "read_only") {
    Fail-Validation "Low-risk write task $($task.id) must use a write-capable verification profile."
  }
  if ($task.auto_runnable -isnot [bool]) { Fail-Validation "Task $($task.id) auto_runnable must be boolean." }
  if ($task.auto_runnable -and $autoRisks -notcontains $task.risk_level) {
    Fail-Validation "Task $($task.id) is auto_runnable outside the allowed risk levels."
  }
  if (-not $task.allowed_paths -or @($task.allowed_paths).Count -lt 1) {
    Fail-Validation "Task $($task.id) must declare allowed_paths."
  }
  if (-not $task.acceptance_tests -or @($task.acceptance_tests).Count -lt 1) {
    Fail-Validation "Task $($task.id) must declare acceptance_tests."
  }
  foreach ($allowedPath in @($task.allowed_paths)) {
    if ([System.IO.Path]::IsPathRooted($allowedPath)) {
      Fail-Validation "Task $($task.id) contains an absolute allowed path."
    }
    $normalized = $allowedPath.Replace("/", [System.IO.Path]::DirectorySeparatorChar)
    $candidate = [System.IO.Path]::GetFullPath((Join-Path $workspaceRoot $normalized))
    $rootPrefix = $workspaceRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
    if ($candidate -ne $workspaceRoot -and -not $candidate.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      Fail-Validation "Task $($task.id) contains a path outside the workspace: $allowedPath"
    }
  }
  $taskMap[$task.id] = $task
}

$indegree = @{}
$dependents = @{}
foreach ($task in $queue.tasks) {
  $indegree[$task.id] = @($task.depends_on).Count
  $dependents[$task.id] = New-Object System.Collections.ArrayList
}
foreach ($task in $queue.tasks) {
  foreach ($dependencyId in @($task.depends_on)) {
    if (-not $taskMap.ContainsKey($dependencyId)) {
      Fail-Validation "Task $($task.id) depends on unknown task '$dependencyId'."
    }
    if ($dependencyId -eq $task.id) { Fail-Validation "Task $($task.id) depends on itself." }
    [void]$dependents[$dependencyId].Add($task.id)
  }
}

$readyForSort = New-Object System.Collections.Queue
foreach ($task in $queue.tasks) {
  if ($indegree[$task.id] -eq 0) { $readyForSort.Enqueue($task.id) }
}
$processed = 0
while ($readyForSort.Count -gt 0) {
  $current = $readyForSort.Dequeue()
  $processed++
  foreach ($dependentId in $dependents[$current]) {
    $indegree[$dependentId]--
    if ($indegree[$dependentId] -eq 0) { $readyForSort.Enqueue($dependentId) }
  }
}
if ($processed -ne $queue.tasks.Count) { Fail-Validation "Task dependencies contain a cycle." }

if ($Mode -eq "validate") {
  [pscustomobject]@{
    valid = $true
    tasks = $queue.tasks.Count
    deployment_enabled = $false
    stage = 4
    execution_environment = "worktree"
    max_tasks_per_run = 1
    queue_path = [System.IO.Path]::GetFullPath($QueuePath)
  } | ConvertTo-Json
  exit 0
}

if ($Mode -eq "summary") {
  $byStatus = @{}
  foreach ($status in $validStatuses) {
    $byStatus[$status] = @($queue.tasks | Where-Object { $_.status -eq $status }).Count
  }
  [pscustomobject]@{
    total = $queue.tasks.Count
    by_status = $byStatus
    auto_selectable = @($queue.tasks | Where-Object { $_.status -eq "ready" -and $_.auto_runnable -and $autoRisks -contains $_.risk_level }).Count
    deployment_enabled = $false
    execution_environment = "worktree"
  } | ConvertTo-Json -Depth 5
  exit 0
}

$priorityRank = @{ P0 = 0; P1 = 1; P2 = 2 }
$eligible = @($queue.tasks | Where-Object {
  $task = $_
  $dependenciesDone = @($task.depends_on | Where-Object { $taskMap[$_].status -ne "done" }).Count -eq 0
  $task.status -eq "ready" -and $task.auto_runnable -and $autoRisks -contains $task.risk_level -and $dependenciesDone
} | Sort-Object @{ Expression = { $priorityRank[$_.priority] } }, id)

if ($eligible.Count -eq 0) {
  [pscustomobject]@{ selected = $null; reason = "No eligible read-only or low-risk-write task."; max_tasks_per_run = 1 } | ConvertTo-Json
  exit 0
}

[pscustomobject]@{
  selected = $eligible[0]
  reason = "Selected one dependency-satisfied Stage 4 task. The controller did not execute or mutate it."
  max_tasks_per_run = 1
} | ConvertTo-Json -Depth 8
