[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repoRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$tempBase = [System.IO.Path]::GetFullPath((Join-Path ([System.IO.Path]::GetTempPath()) ("ai-team-fixture-" + [Guid]::NewGuid().ToString("N"))))
$worktreePath = Join-Path $tempBase "worktree"
$branch = "codex/fixture-" + [Guid]::NewGuid().ToString("N").Substring(0, 10)
$checks = New-Object System.Collections.Generic.List[string]
$worktreeAdded = $false

try {
  New-Item -ItemType Directory -Path $tempBase | Out-Null
  & git -C $repoRoot worktree add -b $branch $worktreePath HEAD | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Fixture worktree creation failed." }
  $worktreeAdded = $true

  $queue = @{
    version = 1
    updated_at = [DateTimeOffset]::Now.ToString("o")
    policy = @{
      stage = 4; max_tasks_per_run = 1; deployment_enabled = $false
      execution_environment = "worktree"; require_human_review = $true; max_changed_files = 2
      auto_selectable_risk_levels = @("read_only", "low_risk_write")
      allowed_verification_profiles = @("read_only", "docs_only", "typecheck")
      delivery = @{
        auto_commit = $true; auto_push = $true; force_push = $false; auto_merge = $false; auto_deploy = $false
        integration_branch = "codex/ai-team-operating-system"; draft_pr_number = 2
      }
    }
    tasks = @(@{
      id = "FIXTURE-001"; title = "fixture"; objective = "fixture"; priority = "P0"; status = "ready"
      risk_level = "low_risk_write"; auto_runnable = $true; verification_profile = "docs_only"
      depends_on = @(); allowed_paths = @("docs/AUTOMATION_FIXTURE.md")
      acceptance_tests = @("fixture"); rollback_plan = "remove fixture"; evidence = @()
    })
  }
  $queuePath = Join-Path $worktreePath "TASK_QUEUE.json"
  $queue | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $queuePath -Encoding UTF8

  Push-Location $worktreePath
  try {
    & git add -- TASK_QUEUE.json
    & git -c user.name="AI Team Fixture" -c user.email="fixture@local.invalid" commit -m "test: prepare stage 4 fixture" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Fixture baseline commit failed." }

    $fixturePath = Join-Path $worktreePath "docs\AUTOMATION_FIXTURE.md"
    "# fixture" | Set-Content -LiteralPath $fixturePath -Encoding UTF8

    & (Join-Path $repoRoot "scripts\Test-AITeamChangeSet.ps1") -TaskId "FIXTURE-001" -QueuePath $queuePath | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Allowed-path fixture was rejected." }
    $checks.Add("linked_worktree_allowed_path")

    & (Join-Path $repoRoot "scripts\Invoke-AITeamVerification.ps1") -TaskId "FIXTURE-001" -QueuePath $queuePath | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "docs_only verification fixture failed." }
    $checks.Add("fixed_verification_profile")

    "out-of-scope" | Set-Content -LiteralPath (Join-Path $worktreePath "OUTSIDE.txt") -Encoding UTF8
    $rejected = $false
    try {
      & (Join-Path $repoRoot "scripts\Test-AITeamChangeSet.ps1") -TaskId "FIXTURE-001" -QueuePath $queuePath | Out-Null
    } catch { $rejected = $true }
    if (-not $rejected) { throw "Out-of-scope fixture was not rejected." }
    $checks.Add("out_of_scope_rejected")
    Remove-Item -LiteralPath (Join-Path $worktreePath "OUTSIDE.txt") -Force

    & (Join-Path $repoRoot "scripts\Complete-AITeamTask.ps1") -TaskId "FIXTURE-001" -QueuePath $queuePath -Evidence "fixture completion passed" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Controlled completion fixture failed." }
    $completedQueue = Get-Content -LiteralPath $queuePath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($completedQueue.tasks[0].status -ne "done" -or $completedQueue.tasks[0].auto_runnable -ne $false) {
      throw "Controlled completion did not produce the expected task state."
    }
    $checks.Add("controlled_ready_to_done")

    & (Join-Path $repoRoot "scripts\Test-AITeamDeliverySet.ps1") -TaskId "FIXTURE-001" -QueuePath $queuePath -BaseRef "HEAD" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Final delivery-set fixture failed." }
    $checks.Add("final_delivery_set")
  } finally {
    Pop-Location
  }

  $primaryRejected = $false
  Push-Location $repoRoot
  try {
    try {
      & (Join-Path $repoRoot "scripts\Test-AITeamChangeSet.ps1") -TaskId "AI-PD-003" | Out-Null
    } catch { $primaryRejected = $true }
  } finally {
    Pop-Location
  }
  if (-not $primaryRejected) { throw "Primary-worktree safety gate did not reject execution." }
  $checks.Add("primary_worktree_rejected")

  [pscustomobject]@{
    passed = $true
    checks = @($checks)
    temporary_worktree = $worktreePath
    deployment_performed = $false
  } | ConvertTo-Json -Depth 5
} finally {
  if ($worktreeAdded) {
    $resolved = [System.IO.Path]::GetFullPath($worktreePath)
    if ($resolved.StartsWith($tempBase, [System.StringComparison]::OrdinalIgnoreCase)) {
      & git -C $repoRoot worktree remove --force $resolved 2>$null | Out-Null
      & git -C $repoRoot branch -D $branch 2>$null | Out-Null
    }
  }
  if (Test-Path -LiteralPath $tempBase) {
    $resolvedBase = [System.IO.Path]::GetFullPath($tempBase)
    $tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
    if ($resolvedBase.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase) -and $resolvedBase -like "*ai-team-fixture-*") {
      Remove-Item -LiteralPath $resolvedBase -Recurse -Force
    }
  }
}
