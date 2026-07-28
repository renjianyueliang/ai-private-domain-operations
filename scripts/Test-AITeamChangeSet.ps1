[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$TaskId,
  [string]$QueuePath = ""
)

$ErrorActionPreference = "Stop"
$workspaceRoot = (& git rev-parse --show-toplevel 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $workspaceRoot) { throw "Safety gate: current directory is not a Git worktree." }
$workspaceRoot = [System.IO.Path]::GetFullPath($workspaceRoot.Trim())
if ([string]::IsNullOrWhiteSpace($QueuePath)) { $QueuePath = Join-Path $workspaceRoot "TASK_QUEUE.json" }

$gitDir = [System.IO.Path]::GetFullPath((& git rev-parse --git-dir).Trim())
$commonDir = [System.IO.Path]::GetFullPath((& git rev-parse --git-common-dir).Trim())
if ($gitDir -eq $commonDir) { throw "Safety gate: automatic writes are forbidden in the primary worktree." }

$branch = (& git branch --show-current).Trim()
if ([string]::IsNullOrWhiteSpace($branch) -or $branch -in @("main", "master")) {
  throw "Safety gate: automatic writes require a non-main branch in a linked worktree."
}

$queue = Get-Content -LiteralPath $QueuePath -Raw -Encoding UTF8 | ConvertFrom-Json
$task = @($queue.tasks | Where-Object { $_.id -eq $TaskId })
if ($task.Count -ne 1) { throw "Safety gate: task '$TaskId' was not found exactly once." }
$task = $task[0]
if ($task.status -ne "ready" -or -not $task.auto_runnable -or $task.risk_level -ne "low_risk_write") {
  throw "Safety gate: task '$TaskId' is not an auto-runnable ready low-risk write."
}

$controlPaths = @(
  "AGENTS.md", "STATUS.md", "TASK_QUEUE.json", "docs/APPROVAL_GATE_POLICY.md",
  "scripts/Invoke-AITeamController.ps1", "scripts/Test-AITeamChangeSet.ps1",
  "scripts/Invoke-AITeamVerification.ps1", ".github/workflows/"
)

$entries = @(& git status --porcelain=v1 -uall)
if ($entries.Count -eq 0) { throw "Change gate: no changes were produced." }
if ($entries.Count -gt [int]$queue.policy.max_changed_files) {
  throw "Change gate: changed file count exceeds policy.max_changed_files."
}

$changedPaths = New-Object System.Collections.Generic.List[string]
foreach ($entry in $entries) {
  if ($entry.Length -lt 4) { throw "Change gate: cannot parse git status entry '$entry'." }
  $statusCode = $entry.Substring(0, 2)
  if ($statusCode -match "[DRC]") { throw "Change gate: delete, rename, and copy operations are forbidden ($entry)." }
  $path = $entry.Substring(3).Trim('"').Replace("\\", "/")
  if ($path.Contains(" -> ")) { throw "Change gate: rename operations are forbidden ($entry)." }
  $changedPaths.Add($path)
}

function Test-PathAllowed([string]$Path, [object[]]$AllowedPaths) {
  foreach ($allowed in $AllowedPaths) {
    $normalized = ([string]$allowed).Replace("\\", "/").TrimStart("./")
    if ($normalized.EndsWith("/")) {
      if ($Path.StartsWith($normalized, [System.StringComparison]::OrdinalIgnoreCase)) { return $true }
    } elseif ($Path.Equals($normalized, [System.StringComparison]::OrdinalIgnoreCase)) {
      return $true
    }
  }
  return $false
}

foreach ($path in $changedPaths) {
  if (-not (Test-PathAllowed -Path $path -AllowedPaths @($task.allowed_paths))) {
    throw "Change gate: '$path' is outside task allowed_paths."
  }
  foreach ($controlPath in $controlPaths) {
    if ($controlPath.EndsWith("/") -and $path.StartsWith($controlPath, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Change gate: '$path' is protected control-plane content."
    }
    if ($path.Equals($controlPath, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Change gate: '$path' is protected control-plane content."
    }
  }
  $leaf = [System.IO.Path]::GetFileName($path)
  if ($leaf -match "^\.env($|\.)" -or $leaf -in @("package-lock.json", "pnpm-lock.yaml", "yarn.lock")) {
    throw "Change gate: secrets and dependency lockfiles are forbidden."
  }
}

[pscustomobject]@{
  passed = $true
  task_id = $TaskId
  branch = $branch
  linked_worktree = $true
  changed_files = @($changedPaths)
  changed_file_count = $changedPaths.Count
  deployment_enabled = $false
  human_review_required = $true
} | ConvertTo-Json -Depth 5
