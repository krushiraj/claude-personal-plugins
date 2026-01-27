#!/bin/bash
set -e

# Claude Personal Plugins - Installation Script (macOS/Linux)

REPO_URL="https://github.com/krushiraj/claude-personal-plugins.git"
INSTALL_DIR="$HOME/.claude-personal-plugins"
CLAUDE_DIR="$HOME/.claude"
HOOKS_DIR="$CLAUDE_DIR/hooks"

echo "=== Claude Personal Plugins Installer ==="
echo ""

# Check for git
if ! command -v git &> /dev/null; then
    echo "Error: git is not installed"
    exit 1
fi

# Clone or update repo
if [ -d "$INSTALL_DIR" ]; then
    echo "Updating existing installation..."
    cd "$INSTALL_DIR"
    git pull --rebase
else
    echo "Cloning repository..."
    git clone "$REPO_URL" "$INSTALL_DIR"
fi

# Create hooks directory if needed
mkdir -p "$HOOKS_DIR"

# Install SessionStart hook
echo "Installing SessionStart hook..."
cp "$INSTALL_DIR/sync/hooks/session-start-sync.md" "$HOOKS_DIR/"

# Register marketplace
echo "Registering marketplace..."
MARKETPLACES_FILE="$CLAUDE_DIR/plugins/known_marketplaces.json"
if [ -f "$MARKETPLACES_FILE" ]; then
    # Check if already registered
    if ! grep -q "personal-plugins" "$MARKETPLACES_FILE"; then
        # Add to existing file (simple approach - append before closing bracket)
        TMP_FILE=$(mktemp)
        jq --arg path "$INSTALL_DIR" '. + {"personal-plugins": {"path": $path, "type": "local"}}' "$MARKETPLACES_FILE" > "$TMP_FILE"
        mv "$TMP_FILE" "$MARKETPLACES_FILE"
    fi
else
    mkdir -p "$(dirname "$MARKETPLACES_FILE")"
    echo "{\"personal-plugins\": {\"path\": \"$INSTALL_DIR\", \"type\": \"local\"}}" > "$MARKETPLACES_FILE"
fi

# Set up file watcher based on OS
OS="$(uname -s)"
case "$OS" in
    Darwin)
        echo "Setting up macOS file watcher..."
        PLIST_DIR="$HOME/Library/LaunchAgents"
        mkdir -p "$PLIST_DIR"

        # Update plist with correct paths
        sed "s|\$HOME|$HOME|g" "$INSTALL_DIR/sync/launchd/com.claude.plugins-sync.plist" > "$PLIST_DIR/com.claude.plugins-sync.plist"

        # Load the agent
        launchctl unload "$PLIST_DIR/com.claude.plugins-sync.plist" 2>/dev/null || true
        launchctl load "$PLIST_DIR/com.claude.plugins-sync.plist"
        echo "File watcher installed and started"
        ;;
    Linux)
        echo "Setting up Linux file watcher..."
        SYSTEMD_DIR="$HOME/.config/systemd/user"
        mkdir -p "$SYSTEMD_DIR"

        # Update service with correct paths
        sed "s|\$HOME|$HOME|g" "$INSTALL_DIR/sync/systemd/claude-plugins-sync.service" > "$SYSTEMD_DIR/claude-plugins-sync.service"

        # Enable and start the service
        systemctl --user daemon-reload
        systemctl --user enable claude-plugins-sync.service
        systemctl --user start claude-plugins-sync.service
        echo "File watcher installed and started"
        ;;
    *)
        echo "Warning: Unsupported OS for file watcher: $OS"
        echo "You'll need to manually run sync-push.sh after making changes"
        ;;
esac

echo ""
echo "=== Installation Complete ==="
echo ""
echo "Your plugins are now synced from: $INSTALL_DIR"
echo ""
echo "Next steps:"
echo "  1. Restart Claude to activate the SessionStart hook"
echo "  2. Run 'claude plugins list' to verify plugins are available"
echo ""
