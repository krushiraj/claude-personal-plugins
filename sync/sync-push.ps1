# Claude Personal Plugins - Push Script (Windows)

$InstallDir = "$env:USERPROFILE\.claude-personal-plugins"
$LockFile = "$InstallDir\.sync-lock"

# Prevent concurrent runs
if (Test-Path $LockFile) {
    exit 0
}
New-Item -ItemType File -Path $LockFile -Force | Out-Null

try {
    Push-Location $InstallDir

    # Check if there are changes
    $status = git status --porcelain
    if (-not $status) {
        exit 0
    }

    # Determine which plugin changed
    $changedPlugin = ($status | Select-Object -First 1) -replace '^\s*\S+\s+', '' -replace '/.*', ''
    if ($changedPlugin -like "plugins/*") {
        $changedPlugin = $changedPlugin -replace 'plugins/', ''
    }

    # Stage all changes
    git add -A

    # Commit with auto message
    $message = "auto: update $changedPlugin"
    git commit -m $message

    # Pull with rebase first
    $pullResult = git pull --rebase origin main 2>&1
    if ($LASTEXITCODE -ne 0) {
        git rebase --abort 2>$null
        "CONFLICT" | Set-Content "$InstallDir\.sync-conflict"
        Write-Host "Sync conflict detected. Run '/sync resolve' in Claude to fix."
        exit 1
    }

    # Push changes
    git push origin main 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Push failed. Will retry on next change."
        exit 1
    }

    # Clean up conflict marker
    Remove-Item "$InstallDir\.sync-conflict" -ErrorAction SilentlyContinue

} finally {
    Pop-Location
    Remove-Item $LockFile -ErrorAction SilentlyContinue
}
