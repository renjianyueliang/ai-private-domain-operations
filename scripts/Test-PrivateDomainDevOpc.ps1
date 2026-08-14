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
$intakePath = Join-Path $ProjectRoot "agents\opc-dev-team\INTAKE_QUEUE.json"
$qualityPath = Join-Path $ProjectRoot "agents\opc-dev-team\QUALITY_GATES.json"
$evidencePath = Join-Path $ProjectRoot "agents\opc-dev-team\EVIDENCE_CONTRACT.json"
$maturityPath = Join-Path $ProjectRoot "agents\opc-dev-team\MATURITY_SCORECARD.json"
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
$intakeConfig = Get-Content -LiteralPath $intakePath -Raw -Encoding UTF8 | ConvertFrom-Json
$qualityConfig = Get-Content -LiteralPath $qualityPath -Raw -Encoding UTF8 | ConvertFrom-Json
$evidenceConfig = Get-Content -LiteralPath $evidencePath -Raw -Encoding UTF8 | ConvertFrom-Json
$maturityConfig = Get-Content -LiteralPath $maturityPath -Raw -Encoding UTF8 | ConvertFrom-Json
Assert-True ($manifest.team_id -eq "private-domain-codex-dev-opc") "team id is fixed"
Assert-True ($manifest.version -eq 2) "team manifest is V2"
Assert-True (@($manifest.roles).Count -eq 6) "exactly six roles are registered"
Assert-True (@($manifest.roles.id | Sort-Object -Unique).Count -eq 6) "role ids are unique"
Assert-True ($manifest.max_tasks_per_cycle -eq 1) "one-task cycle limit is enforced"
Assert-True ($manifest.operating_capabilities.automatic_intake_promotion -eq $false) "intake cannot auto-promote"
Assert-True ($manifest.operating_capabilities.self_authorized_policy_change -eq $false) "team cannot self-authorize policy changes"

Assert-True (@($intakeConfig.requests.id | Sort-Object -Unique).Count -eq @($intakeConfig.requests).Count) "intake ids are unique"
Assert-True (@($intakeConfig.requests.dedupe_key | Sort-Object -Unique).Count -eq @($intakeConfig.requests).Count) "intake dedupe keys are unique"
Assert-True ($intakeConfig.policy.automatic_promotion -eq $false) "intake automatic promotion is disabled"
Assert-True ($intakeConfig.policy.customer_data_allowed -eq $false) "intake customer data is disabled"
Assert-True ($intakeConfig.policy.external_actions_allowed -eq $false) "intake external actions are disabled"
Assert-True (@($qualityConfig.gates).Count -ge 6) "at least six quality gates exist"
Assert-True ($qualityConfig.arbitrary_commands_from_queue -eq $false) "quality gates reject arbitrary queue commands"
Assert-True (@($evidenceConfig.required_fields).Count -ge 15) "evidence contract has complete required fields"
Assert-True ($evidenceConfig.completion_rules.external_actions_must_equal_zero -eq $true) "evidence requires zero external actions"
Assert-True (@($maturityConfig.capabilities).Count -eq 10) "maturity scorecard has ten capabilities"

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
$readiness = Invoke-Opc "readiness"
Assert-True ($readiness.passed -eq $true) "isolated worktree environment is ready"
$intake = Invoke-Opc "intake"
Assert-True ($intake.passed -eq $true) "formal intake passes"
Assert-True ($intake.automatic_promotion -eq $false) "intake output cannot auto-promote"
$metrics = Invoke-Opc "metrics"
Assert-True ($metrics.passed -eq $true) "team metrics pass"
Assert-True ($metrics.hard_boundary_violations -eq 0) "metrics report zero hard-boundary violations"
Assert-True ($metrics.external_actions -eq 0) "metrics report zero external actions"
Assert-True ($metrics.maturity.implemented -eq 10) "all ten maturity capabilities are implemented"
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
  "scripts/Test-PrivateDomainDevOpc.ps1",
  "scripts/Test-PrivateDomainDevEnvironment.ps1"
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
  Assert-True $allowed "changed path is inside the team-governance allowlist: $changedPath"
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
