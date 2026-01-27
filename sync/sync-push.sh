#!/bin/bash
# Claude Personal Plugins - Push Script (macOS/Linux)

INSTALL_DIR="$HOME/.claude-personal-plugins"
LOCK_FILE="$INSTALL_DIR/.sync-lock"

# Prevent concurrent runs
if [ -f "$LOCK_FILE" ]; then
    exit 0
fi
touch "$LOCK_FILE"
trap "rm -f $LOCK_FILE" EXIT

cd "$INSTALL_DIR" || exit 1

# Check if there are changes
if [ -z "$(git status --porcelain)" ]; then
    exit 0
fi

# Determine which plugin changed
CHANGED_PLUGIN=$(git status --porcelain | head -1 | awk '{print $2}' | cut -d'/' -f2)

# Stage all changes
git add -A

# Commit with auto message
git commit -m "auto: update ${CHANGED_PLUGIN:-plugins}"

# Pull with rebase first to avoid conflicts
if ! git pull --rebase origin main 2>/dev/null; then
    # Conflict detected
    git rebase --abort 2>/dev/null
    echo "CONFLICT" > "$INSTALL_DIR/.sync-conflict"
    echo "Sync conflict detected. Run '/sync resolve' in Claude to fix."
    exit 1
fi

# Push changes
git push origin main 2>/dev/null || {
    echo "Push failed. Will retry on next change."
    exit 1
}

# Clean up conflict marker if exists
rm -f "$INSTALL_DIR/.sync-conflict"
