---
name: clean-scan
description: Scan macOS for developer tool caches and show disk usage report
allowed-tools:
  - Bash
  - Read
---

# Disk Usage Scanner

Scan all common developer tool locations and present a comprehensive disk usage report.

## Instructions

1. Run the following scan commands to check each category:

```bash
# Docker (if installed)
docker system df 2>/dev/null

# Check Docker container data
du -sh ~/Library/Containers/com.docker.docker 2>/dev/null

# Package manager caches
du -sh ~/Library/Caches/Yarn 2>/dev/null
du -sh ~/.npm 2>/dev/null
du -sh ~/.gradle/caches 2>/dev/null

# Xcode/iOS development
du -sh ~/Library/Developer/CoreSimulator 2>/dev/null
du -sh ~/Library/Developer/Xcode/DerivedData 2>/dev/null
du -sh ~/Library/Developer/Xcode 2>/dev/null

# Android development
du -sh ~/.android/avd 2>/dev/null
du -sh ~/Library/Android/sdk/system-images 2>/dev/null

# Claude Code sessions
du -sh ~/.claude/projects 2>/dev/null

# Other caches
du -sh ~/Library/Caches/Homebrew 2>/dev/null
du -sh ~/Library/Caches/CocoaPods 2>/dev/null
du -sh ~/Library/Caches/pip 2>/dev/null
du -sh ~/.cache/pip 2>/dev/null
```

2. Present findings in a clear table format:

| Category | Location | Size | Safe to Clean |
|----------|----------|------|---------------|
| Docker | ~/Library/Containers/com.docker.docker | X GB | Yes (with prune) |
| Yarn Cache | ~/Library/Caches/Yarn | X GB | Yes |
| ... | ... | ... | ... |

3. Calculate and show total reclaimable space

4. Explain what each category contains and the impact of cleaning

5. Tell the user to run `/clean-execute` to interactively clean selected categories

## Output Format

Present results as:
1. Summary table with all categories and sizes
2. Total potential space to reclaim
3. Brief explanation of each non-zero category
4. Instruction to use `/clean-execute` for cleanup
