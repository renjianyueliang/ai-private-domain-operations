[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$TaskId,
  [string]$QueuePath = "",
  [string]$BaseRef = "HEAD"
)

$ErrorActionPreference = "Stop"
$workspaceRoot = (& git rev-parse --show-toplevel 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $workspaceRoot) { throw "Delivery gate requires a Git worktree." }
$workspaceRoot = [System.IO.Path]::GetFullPath($workspaceRoot.Trim())
if ([string]::IsNullOrWhiteSpace($QueuePath)) { $QueuePath = Join-Path $workspaceRoot "TASK_QUEUE.json" }

$gitDir = [System.IO.Path]::GetFullPath((& git rev-parse --git-dir).Trim())
$commonDir = [System.IO.Path]::GetFullPath((& git rev-parse --git-common-dir).Trim())
if ($gitDir -eq $commonDir) { throw "Delivery gate forbids the primary worktree." }
$branch = (& git branch --show-current).Trim()
if ([string]::IsNullOrWhiteSpace($branch) -or $branch -in @("main", "master")) {
  throw "Delivery gate requires a non-main linked-worktree branch."
}

$baseQueueSpec = $BaseRef + ":TASK_QUEUE.json"
$baseQueueText = @(& git show $baseQueueSpec 2>$null) -join "`n"
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($baseQueueText)) {
  throw "Delivery gate cannot read TASK_QUEUE.json from $BaseRef."
}
$baseQueue = $baseQueueText | ConvertFrom-Json
$currentQueue = Get-Content -LiteralPath $QueuePath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($baseQueue.version -ne $currentQueue.version) { throw "Delivery gate: queue version changed." }

function Convert-StableJson([object]$Value) {
  return ($Value | ConvertTo-Json -Depth 30 -Compress)
}
if ((Convert-StableJson $baseQueue.policy) -ne (Convert-StableJson $currentQueue.policy)) {
  throw "Delivery gate: queue policy changed during an automatic task."
}
if ($baseQueue.tasks.Count -ne $currentQueue.tasks.Count) {
  throw "Delivery gate: task count changed during an automatic task."
}

$baseTask = @($baseQueue.tasks | Where-Object { $_.id -eq $TaskId })
$currentTask = @($currentQueue.tasks | Where-Object { $_.id -eq $TaskId })
if ($baseTask.Count -ne 1 -or $currentTask.Count -ne 1) { throw "Delivery gate: selected task is not unique." }
$baseTask = $baseTask[0]
$currentTask = $currentTask[0]
if ($baseTask.status -ne "ready" -or $baseTask.auto_runnable -ne $true) {
  throw "Delivery gate: base task was not ready and auto-runnable."
}
if ($currentTask.status -ne "done" -or $currentTask.auto_runnable -ne $false) {
  throw "Delivery gate: current task was not completed by the controlled transition."
}
if (@($currentTask.evidence).Count -le @($baseTask.evidence).Count) {
  throw "Delivery gate: completion evidence was not appended."
}
for ($index = 0; $index -lt @($baseTask.evidence).Count; $index++) {
  if ($baseTask.evidence[$index] -ne $currentTask.evidence[$index]) {
    throw "Delivery gate: existing completion evidence was changed."
  }
}

function Convert-TaskContract([object]$Task) {
  $contract = [ordered]@{}
  foreach ($property in $Task.PSObject.Properties) {
    if ($property.Name -notin @("status", "auto_runnable", "evidence")) {
      $contract[$property.Name] = $property.Value
    }
  }
  return Convert-StableJson $contract
}
if ((Convert-TaskContract $baseTask) -ne (Convert-TaskContract $currentTask)) {
  throw "Delivery gate: selected task contract changed outside completion fields."
}

foreach ($task in $baseQueue.tasks) {
  if ($task.id -eq $TaskId) { continue }
  $currentOther = @($currentQueue.tasks | Where-Object { $_.id -eq $task.id })
  if ($currentOther.Count -ne 1 -or (Convert-StableJson $task) -ne (Convert-StableJson $currentOther[0])) {
    throw "Delivery gate: another task changed ($($task.id))."
  }
}

$entries = @(& git status --porcelain=v1 -uall)
if ($entries.Count -eq 0) { throw "Delivery gate: no changes exist." }
if ($entries.Count -gt ([int]$currentQueue.policy.max_changed_files + 1)) {
  throw "Delivery gate: changed file count exceeds the task budget plus queue evidence."
}

$changedPaths = New-Object System.Collections.Generic.List[string]
foreach ($entry in $entries) {
  if ($entry.Length -lt 4) { throw "Delivery gate: cannot parse '$entry'." }
  $statusCode = $entry.Substring(0, 2)
  if ($statusCode -match "[DRC]") { throw "Delivery gate: delete, rename, and copy are forbidden." }
  $path = $entry.Substring(3).Trim('"').Replace("\\", "/")
  if ($path.Contains(" -> ")) { throw "Delivery gate: rename is forbidden." }
  $changedPaths.Add($path)
}

function Test-Allowed([string]$Path, [object[]]$AllowedPaths) {
  if ($Path -eq "TASK_QUEUE.json") { return $true }
  foreach ($allowed in $AllowedPaths) {
    $normalized = ([string]$allowed).Replace("\\", "/").TrimStart("./")
    if ($normalized.EndsWith("/") -and $Path.StartsWith($normalized, [System.StringComparison]::OrdinalIgnoreCase)) { return $true }
    if ($Path.Equals($normalized, [System.StringComparison]::OrdinalIgnoreCase)) { return $true }
  }
  return $false
}
foreach ($path in $changedPaths) {
  if (-not (Test-Allowed -Path $path -AllowedPaths @($baseTask.allowed_paths))) {
    throw "Delivery gate: '$path' is outside the selected task plus controlled queue update."
  }
}

$controllerPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "Invoke-AITeamController.ps1"
& $controllerPath -Mode validate -QueuePath $QueuePath | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Delivery gate: final queue validation failed." }

[pscustomobject]@{
  passed = $true
  task_id = $TaskId
  branch = $branch
  changed_files = @($changedPaths)
  queue_transition = "ready_to_done"
  force_push = $false
  auto_merge = $false
  auto_deploy = $false
  ready_to_commit = $true
} | ConvertTo-Json -Depth 6
