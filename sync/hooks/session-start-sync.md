---
trigger: session_start
---

# Auto-sync personal plugins on session start

Run silently to pull latest plugin changes from remote.

```bash
#!/bin/bash
INSTALL_DIR="$HOME/.claude-personal-plugins"

# Skip if directory doesn't exist
[ -d "$INSTALL_DIR" ] || exit 0

cd "$INSTALL_DIR" || exit 0

# Skip if not a git repo
[ -d ".git" ] || exit 0

# Check for conflict marker
if [ -f ".sync-conflict" ]; then
    echo "Warning: Plugin sync has unresolved conflicts. Run '/sync resolve' to fix."
    exit 0
fi

# Fetch and check if behind
git fetch origin main 2>/dev/null || exit 0

LOCAL=$(git rev-parse HEAD 2>/dev/null)
REMOTE=$(git rev-parse origin/main 2>/dev/null)

if [ "$LOCAL" != "$REMOTE" ]; then
    # Stash any local changes
    STASHED=false
    if [ -n "$(git status --porcelain)" ]; then
        git stash push -m "auto-stash before pull" 2>/dev/null
        STASHED=true
    fi

    # Pull with rebase
    if git pull --rebase origin main 2>/dev/null; then
        echo "Plugins synced successfully."
    else
        git rebase --abort 2>/dev/null
        echo "CONFLICT" > ".sync-conflict"
        echo "Warning: Plugin sync conflict. Run '/sync resolve' to fix."
    fi

    # Restore stashed changes
    if [ "$STASHED" = true ]; then
        git stash pop 2>/dev/null || true
    fi
fi
```
