# Claude Personal Plugins - Installation Script (Windows)

$ErrorActionPreference = "Stop"

$RepoUrl = "https://github.com/krushiraj/claude-personal-plugins.git"
$InstallDir = "$env:USERPROFILE\.claude-personal-plugins"
$ClaudeDir = "$env:USERPROFILE\.claude"
$HooksDir = "$ClaudeDir\hooks"

Write-Host "=== Claude Personal Plugins Installer ===" -ForegroundColor Cyan
Write-Host ""

# Check for git
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Error: git is not installed" -ForegroundColor Red
    exit 1
}

# Clone or update repo
if (Test-Path $InstallDir) {
    Write-Host "Updating existing installation..."
    Push-Location $InstallDir
    git pull --rebase
    Pop-Location
} else {
    Write-Host "Cloning repository..."
    git clone $RepoUrl $InstallDir
}

# Create hooks directory if needed
if (-not (Test-Path $HooksDir)) {
    New-Item -ItemType Directory -Path $HooksDir -Force | Out-Null
}

# Install SessionStart hook
Write-Host "Installing SessionStart hook..."
Copy-Item "$InstallDir\sync\hooks\session-start-sync.md" "$HooksDir\" -Force

# Register marketplace
Write-Host "Registering marketplace..."
$MarketplacesFile = "$ClaudeDir\plugins\known_marketplaces.json"
$MarketplacesDir = Split-Path $MarketplacesFile -Parent

if (-not (Test-Path $MarketplacesDir)) {
    New-Item -ItemType Directory -Path $MarketplacesDir -Force | Out-Null
}

if (Test-Path $MarketplacesFile) {
    $marketplaces = Get-Content $MarketplacesFile | ConvertFrom-Json
    if (-not $marketplaces."personal-plugins") {
        $marketplaces | Add-Member -NotePropertyName "personal-plugins" -NotePropertyValue @{
            path = $InstallDir
            type = "local"
        }
        $marketplaces | ConvertTo-Json -Depth 10 | Set-Content $MarketplacesFile
    }
} else {
    @{
        "personal-plugins" = @{
            path = $InstallDir
            type = "local"
        }
    } | ConvertTo-Json -Depth 10 | Set-Content $MarketplacesFile
}

# Set up file watcher via Task Scheduler
Write-Host "Setting up Windows file watcher..."

$TaskName = "ClaudePluginsSync"
$WatcherScript = "$InstallDir\sync\windows\sync-watcher.ps1"

# Remove existing task if present
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

# Create task to run at logon
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$WatcherScript`""
$Trigger = New-ScheduledTaskTrigger -AtLogon
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings | Out-Null

# Start the watcher now
Start-ScheduledTask -TaskName $TaskName
Write-Host "File watcher installed and started"

Write-Host ""
Write-Host "=== Installation Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Your plugins are now synced from: $InstallDir"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Restart Claude to activate the SessionStart hook"
Write-Host "  2. Run 'claude plugins list' to verify plugins are available"
Write-Host ""
