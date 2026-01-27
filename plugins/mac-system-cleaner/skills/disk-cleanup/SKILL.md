---
name: disk-cleanup
description: This skill should be used when the user asks to "clean disk space", "free up storage", "check what's using disk space", "clean developer caches", "clean system data", "reclaim disk space", or mentions large "System Data" in macOS storage settings. Provides knowledge about macOS developer tool locations and safe cleanup commands.
---

# macOS Developer Disk Cleanup

## Overview

macOS "System Data" in storage settings often grows large due to developer tool caches. This skill provides knowledge about common locations and safe cleanup procedures.

## Categories and Locations

### Docker
**Location**: `~/Library/Containers/com.docker.docker`
**Check size**: `docker system df`
**What accumulates**: Images, containers, volumes, build cache
**Cleanup command**: `docker system prune -a --volumes`
**Caution**: This removes ALL unused images, containers, and volumes. Running containers are preserved.

### Yarn Cache
**Location**: `~/Library/Caches/Yarn`
**Check size**: `du -sh ~/Library/Caches/Yarn`
**What accumulates**: Downloaded package tarballs
**Cleanup command**: `yarn cache clean`
**Safe**: Yes, packages re-download as needed

### npm Cache
**Location**: `~/.npm`
**Check size**: `du -sh ~/.npm`
**What accumulates**: Package cache, logs
**Cleanup command**: `npm cache clean --force`
**Safe**: Yes, packages re-download as needed

### Gradle Cache
**Location**: `~/.gradle/caches`
**Check size**: `du -sh ~/.gradle/caches`
**What accumulates**: Downloaded dependencies, build outputs
**Cleanup command**: `rm -rf ~/.gradle/caches`
**Safe**: Yes, dependencies re-download on next build

### Xcode - iOS Simulators
**Location**: `~/Library/Developer/CoreSimulator`
**Check size**: `du -sh ~/Library/Developer/CoreSimulator`
**What accumulates**: Simulator runtimes, device data
**Cleanup command**: `xcrun simctl delete unavailable`
**Safe**: Only removes unavailable/broken simulators

### Xcode - Derived Data
**Location**: `~/Library/Developer/Xcode/DerivedData`
**Check size**: `du -sh ~/Library/Developer/Xcode/DerivedData`
**What accumulates**: Build artifacts, indexes
**Cleanup command**: `rm -rf ~/Library/Developer/Xcode/DerivedData/*`
**Safe**: Yes, rebuilds on next Xcode build

### Android AVD (Emulators)
**Location**: `~/.android/avd`
**Check size**: `du -sh ~/.android/avd`
**What accumulates**: Android Virtual Device images
**Cleanup**: Delete unused AVDs via Android Studio > Device Manager
**Caution**: Manual selection recommended - don't delete AVDs you use

### Android SDK System Images
**Location**: `~/Library/Android/sdk/system-images`
**Check size**: `du -sh ~/Library/Android/sdk/system-images`
**What accumulates**: Android OS images for emulators
**Cleanup**: Use Android Studio SDK Manager to remove unused images
**Caution**: Required for corresponding emulators

### Claude Code Sessions
**Location**: `~/.claude/projects`
**Check size**: `du -sh ~/.claude/projects`
**What accumulates**: Session transcripts (.jsonl files) with tool outputs
**Cleanup command**: `find ~/.claude/projects -name "*.jsonl" -mtime +7 -delete`
**Safe**: Only removes sessions older than 7 days

### Homebrew Cache
**Location**: `~/Library/Caches/Homebrew`
**Check size**: `du -sh ~/Library/Caches/Homebrew`
**What accumulates**: Downloaded package files
**Cleanup command**: `brew cleanup`
**Safe**: Yes, packages re-download as needed

### CocoaPods Cache
**Location**: `~/Library/Caches/CocoaPods`
**Check size**: `du -sh ~/Library/Caches/CocoaPods`
**What accumulates**: Pod specs, downloaded pods
**Cleanup command**: `pod cache clean --all`
**Safe**: Yes, pods re-download as needed

### pip Cache
**Location**: `~/Library/Caches/pip` or `~/.cache/pip`
**Check size**: `du -sh ~/Library/Caches/pip ~/.cache/pip 2>/dev/null`
**What accumulates**: Downloaded Python packages
**Cleanup command**: `pip cache purge`
**Safe**: Yes, packages re-download as needed

## Scan Commands

To scan all categories at once:

```bash
# Docker
docker system df 2>/dev/null || echo "Docker not running"

# Package managers
du -sh ~/Library/Caches/Yarn 2>/dev/null
du -sh ~/.npm 2>/dev/null
du -sh ~/.gradle/caches 2>/dev/null

# Xcode/iOS
du -sh ~/Library/Developer/CoreSimulator 2>/dev/null
du -sh ~/Library/Developer/Xcode/DerivedData 2>/dev/null

# Android
du -sh ~/.android/avd 2>/dev/null
du -sh ~/Library/Android/sdk/system-images 2>/dev/null

# Claude Code
du -sh ~/.claude/projects 2>/dev/null

# Other caches
du -sh ~/Library/Caches/Homebrew 2>/dev/null
du -sh ~/Library/Caches/CocoaPods 2>/dev/null
du -sh ~/Library/Caches/pip 2>/dev/null
```

## Best Practices

1. **Always scan first**: Show user what exists before cleaning
2. **Confirm before destructive actions**: Especially Docker volumes and Android AVDs
3. **Present sizes clearly**: Use human-readable formats (GB, MB)
4. **Explain what each cleanup does**: User should understand impact
5. **Handle missing tools gracefully**: Not everyone has Docker, Xcode, etc.
