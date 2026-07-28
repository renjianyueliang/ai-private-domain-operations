[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$TaskId,
  [string]$QueuePath = ""
)

$ErrorActionPreference = "Stop"
$workspaceRoot = (& git rev-parse --show-toplevel 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $workspaceRoot) { throw "Verification requires a Git worktree." }
$workspaceRoot = [System.IO.Path]::GetFullPath($workspaceRoot.Trim())
if ([string]::IsNullOrWhiteSpace($QueuePath)) { $QueuePath = Join-Path $workspaceRoot "TASK_QUEUE.json" }

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $scriptRoot "Test-AITeamChangeSet.ps1") -TaskId $TaskId -QueuePath $QueuePath | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Change-set verification failed." }

$queue = Get-Content -LiteralPath $QueuePath -Raw -Encoding UTF8 | ConvertFrom-Json
$task = @($queue.tasks | Where-Object { $_.id -eq $TaskId })[0]
$checks = New-Object System.Collections.Generic.List[string]

& git diff --check
if ($LASTEXITCODE -ne 0) { throw "git diff --check failed." }
$checks.Add("git_diff_check")

switch ($task.verification_profile) {
  "docs_only" {
    $paths = @(& git status --porcelain=v1 -uall | ForEach-Object { $_.Substring(3).Trim('"').Replace("\\", "/") })
    $invalid = @($paths | Where-Object { [System.IO.Path]::GetExtension($_) -notin @(".md", ".json") })
    if ($invalid.Count -gt 0) { throw "docs_only profile found non-document files: $($invalid -join ', ')" }
    $checks.Add("docs_only_extensions")
  }
  "typecheck" {
    & npm run typecheck
    if ($LASTEXITCODE -ne 0) { throw "npm run typecheck failed." }
    $checks.Add("npm_run_typecheck")
  }
  default { throw "Unsupported write verification profile '$($task.verification_profile)'." }
}

[pscustomobject]@{
  passed = $true
  task_id = $TaskId
  profile = $task.verification_profile
  checks = @($checks)
  deployment_performed = $false
  ready_for_human_review = $true
} | ConvertTo-Json -Depth 5
