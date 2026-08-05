<#
.SYNOPSIS
  Idempotent create-or-update of GitHub branch protection for main on emirtechno/-miniMES-.

.DESCRIPTION
  Prefers a repository ruleset targeting refs/heads/main that:
    - Blocks deletions and force pushes (non_fast_forward)
    - Requires a pull request before merging (0 approving reviews OK for solo)
    - Requires CI status checks: frontend (includes Author attribution guard) and backend

  Also applies classic branch protection as a belt-and-suspenders layer (works on public repos).

  Uses portable gh if present at .tools/gh/bin/gh.exe, otherwise PATH gh.

.NOTES
  Do not force-push. Do not remove author attribution.
  Auth: gh must be logged in with repo admin (tested as emirtechno with ADMIN).

  Ruleset HTML: https://github.com/emirtechno/-miniMES-/rules/20462009
  Rules settings: https://github.com/emirtechno/-miniMES-/settings/rules
  Classic branches: https://github.com/emirtechno/-miniMES-/settings/branches

  Plan note: pull_request ruleset parameters use GitHub's newer field names
  (dismiss_stale_reviews_on_push, require_code_owner_review, allowed_merge_methods).
  Older docs names (dismiss_stale_reviews / require_code_owner_reviews) return HTTP 422.
#>
[CmdletBinding()]
param(
  [string]$Owner = "emirtechno",
  [string]$Repo = "-miniMES-",
  [string]$RulesetName = "Protect main + attribution CI"
)

$ErrorActionPreference = "Stop"

function Resolve-Gh {
  $portable = Join-Path $PSScriptRoot "..\.tools\gh\bin\gh.exe"
  if (Test-Path $portable) { return (Resolve-Path $portable).Path }
  $cmd = Get-Command gh -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  throw "gh CLI not found. Install GitHub CLI or place portable gh at .tools/gh/bin/gh.exe"
}

$gh = Resolve-Gh
Write-Host "Using gh: $gh"

& $gh auth status
if ($LASTEXITCODE -ne 0) { throw "gh auth failed" }

$repoFull = "$Owner/$Repo"
$view = & $gh repo view $repoFull --json nameWithOwner,visibility,viewerPermission | ConvertFrom-Json
Write-Host ("Repo={0} visibility={1} permission={2}" -f $view.nameWithOwner, $view.visibility, $view.viewerPermission)
if ($view.viewerPermission -notin @("ADMIN", "MAINTAIN")) {
  throw "Need ADMIN (or MAINTAIN) to manage rulesets/branch protection. Got: $($view.viewerPermission)"
}

# Correct pull_request parameter schema (as returned by GET rulesets API).
$rulesetBody = @{
  name        = $RulesetName
  target      = "branch"
  enforcement = "active"
  conditions  = @{
    ref_name = @{
      include = @("refs/heads/main")
      exclude = @()
    }
  }
  rules = @(
    @{ type = "deletion" }
    @{ type = "non_fast_forward" }
    @{
      type = "pull_request"
      parameters = @{
        required_approving_review_count     = 0
        dismiss_stale_reviews_on_push       = $true
        required_reviewers                  = @()
        require_code_owner_review           = $false
        require_last_push_approval          = $false
        required_review_thread_resolution   = $false
        allowed_merge_methods               = @("merge", "squash", "rebase")
      }
    }
    @{
      type = "required_status_checks"
      parameters = @{
        strict_required_status_checks_policy = $true
        do_not_enforce_on_create             = $false
        required_status_checks = @(
          @{ context = "frontend" }
          @{ context = "backend" }
        )
      }
    }
  )
} | ConvertTo-Json -Depth 10

$existing = & $gh api "repos/$repoFull/rulesets" | ConvertFrom-Json
$match = $existing | Where-Object { $_.name -eq $RulesetName } | Select-Object -First 1

if ($match) {
  Write-Host "Updating ruleset id=$($match.id)..."
  $null = $rulesetBody | & $gh api --method PUT "repos/$repoFull/rulesets/$($match.id)" --input -
  $rulesetId = $match.id
} else {
  Write-Host "Creating ruleset..."
  $created = $rulesetBody | & $gh api --method POST "repos/$repoFull/rulesets" --input - | ConvertFrom-Json
  $rulesetId = $created.id
}

Write-Host "Ruleset OK: https://github.com/$repoFull/rules/$rulesetId"

$classic = @{
  required_status_checks = @{
    strict   = $true
    contexts = @("frontend", "backend")
  }
  enforce_admins = $true
  required_pull_request_reviews = @{
    required_approving_review_count = 0
    dismiss_stale_reviews           = $false
    require_code_owner_reviews      = $false
  }
  restrictions      = $null
  allow_force_pushes = $false
  allow_deletions    = $false
} | ConvertTo-Json -Depth 8

Write-Host "Applying classic branch protection on main..."
try {
  $null = $classic | & $gh api --method PUT "repos/$repoFull/branches/main/protection" --input -
  Write-Host "Classic protection OK: https://github.com/$repoFull/settings/branches"
} catch {
  Write-Warning "Classic branch protection failed (plan limits?). Ruleset above may still apply. $_"
}

Write-Host "`nVerification:"
& $gh api "repos/$repoFull/rulesets/$rulesetId"
& $gh api "repos/$repoFull/branches/main/protection" 2>&1 | Out-String | Write-Host
