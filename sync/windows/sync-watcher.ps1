# Claude Personal Plugins - File Watcher (Windows)

$InstallDir = "$env:USERPROFILE\.claude-personal-plugins"
$WatchPath = "$InstallDir\plugins"
$SyncScript = "$InstallDir\sync\sync-push.ps1"

# Create FileSystemWatcher
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $WatchPath
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true

# Debounce timer
$debounceTimer = $null
$debounceInterval = 5000  # 5 seconds

$action = {
    # Cancel previous timer if exists
    if ($debounceTimer) {
        $debounceTimer.Stop()
        $debounceTimer.Dispose()
    }

    # Create new timer
    $debounceTimer = New-Object System.Timers.Timer
    $debounceTimer.Interval = $debounceInterval
    $debounceTimer.AutoReset = $false

    Register-ObjectEvent -InputObject $debounceTimer -EventName Elapsed -Action {
        & $SyncScript
    }

    $debounceTimer.Start()
}

# Register events
Register-ObjectEvent -InputObject $watcher -EventName Changed -Action $action
Register-ObjectEvent -InputObject $watcher -EventName Created -Action $action
Register-ObjectEvent -InputObject $watcher -EventName Deleted -Action $action
Register-ObjectEvent -InputObject $watcher -EventName Renamed -Action $action

Write-Host "Claude plugins sync watcher started. Watching: $WatchPath"

# Keep script running
while ($true) {
    Start-Sleep -Seconds 60
}
