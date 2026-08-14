[CmdletBinding()]
param(
  [ValidateSet("validate", "status", "team", "intake", "metrics", "readiness", "next")]
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
$intakePath = Join-Path $teamRoot "INTAKE_QUEUE.json"
$qualityGatesPath = Join-Path $teamRoot "QUALITY_GATES.json"
$evidenceContractPath = Join-Path $teamRoot "EVIDENCE_CONTRACT.json"
$maturityPath = Join-Path $teamRoot "MATURITY_SCORECARD.json"

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

function Invoke-EnvironmentCheck {
  $environmentScript = Join-Path $ProjectRoot "scripts\Test-PrivateDomainDevEnvironment.ps1"
  if (-not (Test-Path -LiteralPath $environmentScript -PathType Leaf)) {
    throw "Environment readiness script is missing: $environmentScript"
  }
  $output = @(& powershell -NoProfile -ExecutionPolicy Bypass -File $environmentScript -ProjectRoot $ProjectRoot -ReportOnly 2>&1)
  try {
    return ($output -join [Environment]::NewLine) | ConvertFrom-Json
  } catch {
    throw "Environment readiness script returned invalid JSON."
  }
}

$manifest = Read-JsonFile $manifestPath
$teamQueue = Read-JsonFile $teamQueuePath
$intake = Read-JsonFile $intakePath
$qualityGates = Read-JsonFile $qualityGatesPath
$evidenceContract = Read-JsonFile $evidenceContractPath
$maturity = Read-JsonFile $maturityPath
$git = Get-GitState $ProjectRoot
$environment = Invoke-EnvironmentCheck

if ($Mode -eq "validate") {
  $errors = [System.Collections.Generic.List[string]]::new()
  if ($manifest.version -ne 2) { $errors.Add("TEAM_MANIFEST version must be 2.") }
  if ($manifest.max_tasks_per_cycle -ne 1) { $errors.Add("max_tasks_per_cycle must equal 1.") }
  if ($teamQueue.policy.max_tasks_per_cycle -ne 1) { $errors.Add("Team queue max_tasks_per_cycle must equal 1.") }
  if ($teamQueue.policy.auto_execute_governance_tasks -ne $false) { $errors.Add("Governance tasks must not auto-execute.") }

  $teamTaskIds = @($teamQueue.tasks | ForEach-Object { [string]$_.id })
  if ($teamTaskIds.Count -ne @($teamTaskIds | Sort-Object -Unique).Count) { $errors.Add("Team governance task ids must be unique.") }

  if ($intake.policy.automatic_promotion -ne $false) { $errors.Add("Intake automatic promotion must remain false.") }
  if ($intake.policy.customer_data_allowed -ne $false -or $intake.policy.external_actions_allowed -ne $false) {
    $errors.Add("Intake customer data and external actions must remain disabled.")
  }
  $intakeIds = @($intake.requests | ForEach-Object { [string]$_.id })
  $dedupeKeys = @($intake.requests | ForEach-Object { [string]$_.dedupe_key })
  if ($intakeIds.Count -ne @($intakeIds | Sort-Object -Unique).Count) { $errors.Add("Intake request ids must be unique.") }
  if ($dedupeKeys.Count -ne @($dedupeKeys | Sort-Object -Unique).Count) { $errors.Add("Intake dedupe keys must be unique.") }
  foreach ($request in $intake.requests) {
    foreach ($field in @("id", "dedupe_key", "title", "source", "status", "risk_level", "business_outcome", "proposed_scope", "external_actions", "customer_data")) {
      if ($null -eq $request.PSObject.Properties[$field] -or [string]::IsNullOrWhiteSpace([string]$request.$field)) {
        if ($field -notin @("external_actions", "customer_data")) { $errors.Add("Intake request is missing field ${field}: $($request.id)") }
      }
    }
    if ([string]$request.status -notin @($intake.policy.allowed_statuses)) { $errors.Add("Invalid intake status for $($request.id).") }
    if ([string]$request.risk_level -notin @($intake.policy.allowed_risk_levels)) { $errors.Add("Invalid intake risk for $($request.id).") }
    if ($request.external_actions -ne $false -or $request.customer_data -ne $false) { $errors.Add("Intake request exceeds external/customer boundary: $($request.id)") }
  }

  if ($qualityGates.arbitrary_commands_from_queue -ne $false) { $errors.Add("Arbitrary queue commands must remain disabled.") }
  $gateIds = @($qualityGates.gates | ForEach-Object { [string]$_.id })
  if ($gateIds.Count -lt 6 -or $gateIds.Count -ne @($gateIds | Sort-Object -Unique).Count) { $errors.Add("Quality gate ids must contain at least six unique values.") }
  foreach ($profile in $qualityGates.profiles) {
    foreach ($gateId in @($profile.required_gates)) {
      if ($gateIds -notcontains [string]$gateId) { $errors.Add("Quality profile $($profile.id) references unknown gate $gateId.") }
    }
    foreach ($scriptPath in @($profile.fixed_scripts)) {
      if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot ([string]$scriptPath).Replace('/', '\')) -PathType Leaf)) {
        $errors.Add("Fixed quality script is missing: $scriptPath")
      }
    }
  }

  $requiredEvidenceFields = @($evidenceContract.required_fields | ForEach-Object { [string]$_ })
  if ($requiredEvidenceFields.Count -lt 15 -or $requiredEvidenceFields.Count -ne @($requiredEvidenceFields | Sort-Object -Unique).Count) {
    $errors.Add("Evidence contract must contain at least 15 unique required fields.")
  }
  foreach ($field in $requiredEvidenceFields) {
    if ($null -eq $evidenceContract.template.PSObject.Properties[$field]) { $errors.Add("Evidence template is missing required field: $field") }
  }
  if ($evidenceContract.completion_rules.external_actions_must_equal_zero -ne $true) { $errors.Add("Evidence contract must require zero external actions.") }

  $capabilityIds = @($maturity.capabilities | ForEach-Object { [string]$_.id })
  if ($capabilityIds.Count -ne 10 -or $capabilityIds.Count -ne @($capabilityIds | Sort-Object -Unique).Count) {
    $errors.Add("Maturity scorecard must contain ten unique capabilities.")
  }
  foreach ($capability in $maturity.capabilities) {
    if ([string]$capability.status -notin @("implemented", "partial", "planned")) { $errors.Add("Invalid maturity status: $($capability.id)") }
    if ([string]::IsNullOrWhiteSpace([string]$capability.evidence)) { $errors.Add("Maturity capability lacks evidence: $($capability.id)") }
  }

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
    intake_request_count = $intakeIds.Count
    quality_gate_count = $gateIds.Count
    maturity_capability_count = $capabilityIds.Count
    environment_ready = ($environment.passed -eq $true)
    git = $git
    errors = [string[]]$errors
    deployment_enabled = $false
    external_actions_enabled = $false
  } | ConvertTo-Json -Depth 10
  if ($errors.Count -gt 0) { exit 1 }
  exit 0
}

if ($Mode -eq "readiness") {
  $environment | ConvertTo-Json -Depth 8
  exit 0
}

if ($Mode -eq "intake") {
  $byStatus = [ordered]@{}
  foreach ($statusName in @($intake.policy.allowed_statuses)) {
    $byStatus[$statusName] = @($intake.requests | Where-Object { $_.status -eq $statusName }).Count
  }
  [pscustomobject][ordered]@{
    passed = $true
    mode = $Mode
    request_count = @($intake.requests).Count
    unique_dedupe_keys = @($intake.requests.dedupe_key | Sort-Object -Unique).Count
    by_status = [pscustomobject]$byStatus
    requests = @($intake.requests)
    automatic_promotion = $false
    customer_data_allowed = $false
    external_actions_allowed = $false
  } | ConvertTo-Json -Depth 10
  exit 0
}

if ($Mode -eq "metrics") {
  $summary = Invoke-PrimaryController "summary"
  $implementedCount = @($maturity.capabilities | Where-Object { $_.status -eq "implemented" }).Count
  $boundaryViolations = @($manifest.hard_boundaries.PSObject.Properties | Where-Object { $_.Value -ne $false }).Count
  [pscustomobject][ordered]@{
    passed = ($boundaryViolations -eq 0)
    mode = $Mode
    observed_at = [DateTimeOffset]::Now.ToString("o")
    team_id = $manifest.team_id
    primary_queue = $summary
    governance_tasks = [pscustomobject][ordered]@{
      total = @($teamQueue.tasks).Count
      done = @($teamQueue.tasks | Where-Object { $_.status -eq "done" }).Count
    }
    intake = [pscustomobject][ordered]@{
      total = @($intake.requests).Count
      triaged_or_approved = @($intake.requests | Where-Object { $_.status -in @("triaged", "approved_governance") }).Count
      duplicate_keys = @($intake.requests).Count - @($intake.requests.dedupe_key | Sort-Object -Unique).Count
      automatic_promotions = 0
    }
    maturity = [pscustomobject][ordered]@{
      total = @($maturity.capabilities).Count
      implemented = $implementedCount
      target_level = $maturity.target_level
    }
    environment_ready = ($environment.passed -eq $true)
    hard_boundary_violations = $boundaryViolations
    external_actions = 0
    max_tasks_per_cycle = 1
  } | ConvertTo-Json -Depth 10
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
    source_write_ready = ($git.repository -and $git.clean -and $git.linked_worktree -and ([string]$git.branch).StartsWith("codex/") -and $environment.passed)
    environment = $environment
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
    operating_capabilities = $manifest.operating_capabilities
    hard_boundaries = $manifest.hard_boundaries
    entry_points = [pscustomobject][ordered]@{
      manifest = $manifestPath
      dashboard = Join-Path $teamRoot "TEAM_DASHBOARD.md"
      project_memory = Join-Path $teamRoot "PROJECT_MEMORY.md"
      runbook = Join-Path $teamRoot "RUNBOOK.md"
      intake = $intakePath
      quality_gates = $qualityGatesPath
      evidence_contract = $evidenceContractPath
      maturity_scorecard = $maturityPath
    }
  } | ConvertTo-Json -Depth 12
  exit 0
}

$primarySelection = Invoke-PrimaryController "next"
$sourceWriteReady = ($git.repository -and $git.clean -and $git.linked_worktree -and ([string]$git.branch).StartsWith("codex/") -and $environment.passed)
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
  environment_ready = ($environment.passed -eq $true)
  max_tasks_per_cycle = 1
  execution_performed = $false
  deployment_enabled = $false
  external_actions_enabled = $false
} | ConvertTo-Json -Depth 12
