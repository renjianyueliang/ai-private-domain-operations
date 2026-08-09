[CmdletBinding()]
param([string]$ProjectRoot = "")

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
} else {
  $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

$controller = Join-Path $ProjectRoot "automations\opc\Invoke-PrivateDomainDevOpc.ps1"
$manifestPath = Join-Path $ProjectRoot "agents\opc-dev-team\TEAM_MANIFEST.json"
$checks = [System.Collections.Generic.List[string]]::new()

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw "OPC regression failed: $Message" }
  $checks.Add($Message)
}

function Invoke-Opc([string]$Mode) {
  $output = @(& powershell -NoProfile -ExecutionPolicy Bypass -File $controller -Mode $Mode -ProjectRoot $ProjectRoot 2>&1)
  if ($LASTEXITCODE -ne 0) { throw "OPC $Mode failed: $($output -join [Environment]::NewLine)" }
  return ($output -join [Environment]::NewLine) | ConvertFrom-Json
}

$frozen = @(
  "AGENTS.md",
  "TASK_QUEUE.json",
  "STATUS.md",
  "docs/APPROVAL_GATE_POLICY.md",
  "scripts/Invoke-AITeamController.ps1"
)
$before = @{}
foreach ($relativePath in $frozen) {
  $before[$relativePath] = (Get-FileHash -LiteralPath (Join-Path $ProjectRoot $relativePath) -Algorithm SHA256).Hash
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
Assert-True ($manifest.team_id -eq "private-domain-codex-dev-opc") "team id is fixed"
Assert-True (@($manifest.roles).Count -eq 6) "exactly six roles are registered"
Assert-True (@($manifest.roles.id | Sort-Object -Unique).Count -eq 6) "role ids are unique"
Assert-True ($manifest.max_tasks_per_cycle -eq 1) "one-task cycle limit is enforced"

foreach ($boundary in $manifest.hard_boundaries.PSObject.Properties) {
  Assert-True ($boundary.Value -eq $false) "hard boundary disabled: $($boundary.Name)"
}
Assert-True ($manifest.candidate_delivery.force_push -eq $false) "force push is disabled"
Assert-True ($manifest.candidate_delivery.auto_merge -eq $false) "auto merge is disabled"
Assert-True ($manifest.candidate_delivery.auto_deploy -eq $false) "auto deploy is disabled"

$validate = Invoke-Opc "validate"
Assert-True ($validate.passed -eq $true) "team validate passes"
Assert-True ($validate.primary_controller_valid -eq $true) "primary controller validate passes"
$status = Invoke-Opc "status"
Assert-True ($status.passed -eq $true) "team status passes"
$team = Invoke-Opc "team"
Assert-True (@($team.roles).Count -eq 6) "team view returns six roles"
$next = Invoke-Opc "next"
Assert-True ($next.passed -eq $true) "delegated next passes"
Assert-True ($next.selected_count -le 1) "delegated next returns at most one task"
Assert-True ($next.execution_performed -eq $false) "delegated next does not execute a task"
if ($null -ne $next.selected -and $next.selected.risk_level -ne "read_only") {
  Assert-True ($next.source_write_ready -eq $true) "write task requires a clean codex linked worktree"
}
if ($null -ne $next.blocked_candidate_id) {
  Assert-True ($next.selected_count -eq 0) "unsafe write candidate is not selected"
}

foreach ($relativePath in $frozen) {
  $afterHash = (Get-FileHash -LiteralPath (Join-Path $ProjectRoot $relativePath) -Algorithm SHA256).Hash
  Assert-True ($afterHash -eq $before[$relativePath]) "frozen file unchanged: $relativePath"
}

$allowedPrefixes = @(
  ".codex/agents/",
  "agents/opc-dev-team/",
  "automations/opc/Invoke-PrivateDomainDevOpc.ps1",
  "scripts/Test-PrivateDomainDevOpc.ps1"
)
$changedPaths = @(& git -C $ProjectRoot status --porcelain=v1 --untracked-files=all | ForEach-Object { $_.Substring(3).Replace('\', '/') })
foreach ($changedPath in $changedPaths) {
  $allowed = $false
  foreach ($prefix in $allowedPrefixes) {
    if ($changedPath -eq $prefix.TrimEnd('/') -or $changedPath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
      $allowed = $true
      break
    }
  }
  Assert-True $allowed "changed path is inside the bootstrap allowlist: $changedPath"
}

[pscustomobject][ordered]@{
  passed = $true
  checks = $checks.Count
  team_id = $manifest.team_id
  role_count = @($manifest.roles).Count
  selected_count = $next.selected_count
  selected_task_id = if ($null -eq $next.selected) { $null } else { $next.selected.id }
  changed_paths = $changedPaths
  frozen_files_unchanged = $true
  deployment_enabled = $false
  external_actions_enabled = $false
} | ConvertTo-Json -Depth 8
