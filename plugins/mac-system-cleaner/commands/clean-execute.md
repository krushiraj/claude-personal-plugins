---
name: clean-execute
description: Interactively clean developer tool caches and reclaim disk space
allowed-tools:
  - Bash
  - AskUserQuestion
---

# Interactive Disk Cleanup

Help user clean selected developer tool caches with confirmation for each action.

## Instructions

1. First, scan to show current disk usage (same as clean-scan):

```bash
du -sh ~/Library/Containers/com.docker.docker ~/Library/Caches/Yarn ~/.npm ~/.gradle/caches ~/Library/Developer/CoreSimulator ~/Library/Developer/Xcode/DerivedData ~/.android/avd ~/.claude/projects ~/Library/Caches/Homebrew ~/Library/Caches/CocoaPods ~/Library/Caches/pip 2>/dev/null | sort -hr
```

2. Present a summary of what can be cleaned

3. Use AskUserQuestion to ask user which categories to clean. Offer these options:
   - All caches (safe items only)
   - Select specific categories
   - Cancel

4. If user selects specific categories, ask which ones using multiSelect

5. For each selected category, execute the appropriate cleanup command:

### Cleanup Commands

**Docker** (requires confirmation - removes all unused data):
```bash
docker system prune -a --volumes
```

**Yarn Cache**:
```bash
yarn cache clean
```

**npm Cache**:
```bash
npm cache clean --force
```

**Gradle Cache**:
```bash
rm -rf ~/.gradle/caches
```

**Xcode Simulators** (unavailable only):
```bash
xcrun simctl delete unavailable
```

**Xcode Derived Data**:
```bash
rm -rf ~/Library/Developer/Xcode/DerivedData/*
```

**Claude Code Sessions** (older than 7 days):
```bash
find ~/.claude/projects -name "*.jsonl" -mtime +7 -delete
```

**Homebrew Cache**:
```bash
brew cleanup
```

**CocoaPods Cache**:
```bash
pod cache clean --all
```

**pip Cache**:
```bash
pip cache purge
```

6. After cleanup, show before/after comparison of disk usage

7. Show total space reclaimed

## Important Notes

- Always confirm before Docker cleanup (removes volumes)
- Android AVDs require manual cleanup via Android Studio - inform user
- Skip categories that don't exist or tools not installed
- Show clear success/failure for each cleanup action
