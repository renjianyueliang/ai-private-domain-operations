[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$TaskId,
  [string]$Evidence = "Fixed verification profile passed.",
  [string]$QueuePath = ""
)

$ErrorActionPreference = "Stop"
$workspaceRoot = (& git rev-parse --show-toplevel 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $workspaceRoot) { throw "Completion requires a Git worktree." }
$workspaceRoot = [System.IO.Path]::GetFullPath($workspaceRoot.Trim())
if ([string]::IsNullOrWhiteSpace($QueuePath)) { $QueuePath = Join-Path $workspaceRoot "TASK_QUEUE.json" }
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

& (Join-Path $scriptRoot "Invoke-AITeamVerification.ps1") -TaskId $TaskId -QueuePath $QueuePath | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Completion refused because fixed verification failed." }

$queue = Get-Content -LiteralPath $QueuePath -Raw -Encoding UTF8 | ConvertFrom-Json
$task = @($queue.tasks | Where-Object { $_.id -eq $TaskId })
if ($task.Count -ne 1) { throw "Completion refused because task '$TaskId' is not unique." }
$task = $task[0]
if ($task.status -ne "ready" -or $task.auto_runnable -ne $true -or $task.risk_level -ne "low_risk_write") {
  throw "Completion refused because task is not a ready auto-runnable low-risk write."
}

$timestamp = [DateTimeOffset]::Now.ToString("o")
$task.status = "done"
$task.auto_runnable = $false
$task.evidence = @($task.evidence) + @("${timestamp}: $Evidence")
$queue.updated_at = $timestamp
$queue | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $QueuePath -Encoding UTF8

& (Join-Path $scriptRoot "Test-AITeamDeliverySet.ps1") -TaskId $TaskId -QueuePath $QueuePath -BaseRef "HEAD" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Completion wrote queue evidence, but final delivery validation failed." }

[pscustomobject]@{
  completed = $true
  task_id = $TaskId
  completed_at = $timestamp
  verification_profile = $task.verification_profile
  ready_to_commit = $true
  ready_to_push_existing_draft_pr = $true
  auto_merge = $false
  auto_deploy = $false
} | ConvertTo-Json -Depth 5
