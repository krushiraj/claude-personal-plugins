---
name: sync
description: Manually sync personal plugins with remote
allowed_args: ["status", "resolve", "push", "pull"]
---

# Plugin Sync Command

Manually manage plugin synchronization.

## Usage

- `/sync` or `/sync push` - Push local changes to remote
- `/sync pull` - Pull remote changes
- `/sync status` - Show sync status
- `/sync resolve` - Help resolve sync conflicts

## Implementation

Based on the argument provided:

### /sync or /sync push

1. Change to `~/.claude-personal-plugins`
2. Run `git status` to check for changes
3. If changes exist:
   - Stage all changes: `git add -A`
   - Commit: `git commit -m "manual: sync plugins"`
   - Pull with rebase: `git pull --rebase origin main`
   - Push: `git push origin main`
4. Report success or any errors

### /sync pull

1. Change to `~/.claude-personal-plugins`
2. Stash any local changes
3. Run `git pull --rebase origin main`
4. Unstash local changes
5. Report what was updated

### /sync status

1. Change to `~/.claude-personal-plugins`
2. Run `git status` to show local changes
3. Run `git fetch origin && git log HEAD..origin/main --oneline` to show incoming changes
4. Check for `.sync-conflict` marker
5. Report the overall sync state

### /sync resolve

1. Change to `~/.claude-personal-plugins`
2. Run `git status` to identify conflicted files
3. Show the conflicts to the user
4. Ask user how to resolve each conflict:
   - Keep local version
   - Keep remote version
   - Manual edit
5. After resolution, complete the rebase/merge
6. Remove `.sync-conflict` marker
7. Push resolved changes
