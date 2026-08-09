[CmdletBinding()]
param(
  [string]$ProjectRoot = "",
  [switch]$ReportOnly
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
} else {
  $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

$inside = @(& git -C $ProjectRoot rev-parse --is-inside-work-tree 2>$null)
$repository = ($LASTEXITCODE -eq 0 -and ($inside | Select-Object -First 1) -eq "true")
$branch = if ($repository) { @(& git -C $ProjectRoot symbolic-ref --short HEAD 2>$null) | Select-Object -First 1 } else { $null }
$gitDirValue = if ($repository) { @(& git -C $ProjectRoot rev-parse --git-dir 2>$null) | Select-Object -First 1 } else { $null }
$commonDirValue = if ($repository) { @(& git -C $ProjectRoot rev-parse --git-common-dir 2>$null) | Select-Object -First 1 } else { $null }

function Resolve-GitPath([string]$Value) {
  $normalized = $Value.Replace('/', '\')
  $candidate = if ([IO.Path]::IsPathRooted($normalized)) { $normalized } else { Join-Path $ProjectRoot $normalized }
  return [IO.Path]::GetFullPath($candidate).TrimEnd('\')
}

$linkedWorktree = $false
if ($repository -and $gitDirValue -and $commonDirValue) {
  $linkedWorktree = -not [string]::Equals((Resolve-GitPath $gitDirValue), (Resolve-GitPath $commonDirValue), [StringComparison]::OrdinalIgnoreCase)
}

$nodeOutput = @(& node --version 2>$null)
$nodeAvailable = ($LASTEXITCODE -eq 0)
$npmOutput = @(& npm --version 2>$null)
$npmAvailable = ($LASTEXITCODE -eq 0)
$packageLock = Test-Path -LiteralPath (Join-Path $ProjectRoot "package-lock.json") -PathType Leaf
$nodeModules = Test-Path -LiteralPath (Join-Path $ProjectRoot "node_modules") -PathType Container
$tsc = Test-Path -LiteralPath (Join-Path $ProjectRoot "node_modules\.bin\tsc.cmd") -PathType Leaf
$ready = ($repository -and $linkedWorktree -and ([string]$branch).StartsWith("codex/") -and $nodeAvailable -and $npmAvailable -and $packageLock -and $nodeModules -and $tsc)

[pscustomobject][ordered]@{
  passed = $ready
  project_root = $ProjectRoot
  repository = $repository
  linked_worktree = $linkedWorktree
  branch = $branch
  codex_branch = ([string]$branch).StartsWith("codex/")
  node_available = $nodeAvailable
  node_version = if ($nodeAvailable) { $nodeOutput | Select-Object -First 1 } else { $null }
  npm_available = $npmAvailable
  npm_version = if ($npmAvailable) { $npmOutput | Select-Object -First 1 } else { $null }
  package_lock_present = $packageLock
  node_modules_present = $nodeModules
  worktree_tsc_present = $tsc
  external_actions_enabled = $false
} | ConvertTo-Json -Depth 5

if (-not $ready -and -not $ReportOnly) { exit 1 }
