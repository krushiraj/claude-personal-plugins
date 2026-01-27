# Claude Personal Plugins

Personal Claude Code plugins and skills synced across machines.

## Quick Install

**macOS/Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/krushiraj/claude-personal-plugins/main/sync/install.sh | bash
```

**Windows (PowerShell as Admin):**
```powershell
irm https://raw.githubusercontent.com/krushiraj/claude-personal-plugins/main/sync/install.ps1 | iex
```

## Plugins Included

| Plugin | Description |
|--------|-------------|
| `guru-release` | Deployment workflow for Guru (staging, production, version management) |
| `mac-system-cleaner` | Disk cleanup utility for macOS developer caches |
| `crawler-dev` | Debug and fix PDF/META crawlers for academic publishers |

## How Sync Works

### Auto-pull on startup
When Claude starts a new session, a hook automatically pulls the latest changes from this repo.

### Auto-push on changes
A file watcher monitors the plugins directory. When you edit a plugin:
1. Waits 5 seconds for more edits (debounce)
2. Auto-commits with message like `auto: update guru-release`
3. Pulls with rebase, then pushes

### Manual sync
Use the `/sync` command:
- `/sync` - Push local changes
- `/sync pull` - Pull remote changes
- `/sync status` - Show sync state
- `/sync resolve` - Fix conflicts

## Directory Structure

```
~/.claude-personal-plugins/
├── plugins/
│   ├── guru-release/
│   ├── mac-system-cleaner/
│   └── crawler-dev/
├── sync/
│   ├── install.sh
│   ├── install.ps1
│   ├── sync-push.sh
│   ├── sync-push.ps1
│   ├── hooks/
│   ├── commands/
│   ├── launchd/      (macOS)
│   ├── systemd/      (Linux)
│   └── windows/
└── marketplace.json
```

## Conflict Resolution

If a sync conflict occurs:
1. A `.sync-conflict` marker file is created
2. Claude warns you at session start
3. Run `/sync resolve` to fix

## Adding New Plugins

1. Create a new folder in `plugins/`
2. Add `.claude-plugin/plugin.json`
3. Add your commands, skills, agents, hooks
4. The file watcher will auto-sync

## Manual Setup (if install script fails)

1. Clone this repo to `~/.claude-personal-plugins`
2. Copy `sync/hooks/session-start-sync.md` to `~/.claude/hooks/`
3. Add to `~/.claude/plugins/known_marketplaces.json`:
   ```json
   {
     "personal-plugins": {
       "path": "/path/to/.claude-personal-plugins",
       "type": "local"
     }
   }
   ```
4. Run `claude plugins install` for each plugin
