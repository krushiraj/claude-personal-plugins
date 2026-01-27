# Mac System Cleaner

A Claude Code plugin to analyze and reclaim disk space consumed by developer tools and caches on macOS.

## Features

- Scans common developer tool locations for space usage
- Presents findings in organized tables
- Interactive cleanup with user confirmation
- Supports multiple categories: Docker, Yarn, npm, Gradle, Xcode, Android, and more

## Commands

- `/clean-scan` - Scan all developer tool locations and show disk usage report
- `/clean-execute` - Interactively clean selected categories

## Supported Categories

| Category | What it scans | Cleanup action |
|----------|---------------|----------------|
| Docker | Images, volumes, build cache | `docker system prune -a --volumes` |
| Yarn | Package cache | `yarn cache clean` |
| npm | Package cache | `npm cache clean --force` |
| Gradle | Build cache | Remove `~/.gradle/caches` |
| Xcode | Simulators, derived data | `xcrun simctl delete unavailable` |
| Android | AVDs, SDK images | Remove unused emulators |
| Claude Code | Session transcripts | Remove old `.jsonl` files |
| Homebrew | Package cache | `brew cleanup` |
| CocoaPods | Pod cache | `pod cache clean --all` |
| pip | Package cache | `pip cache purge` |

## Usage

1. Run `/clean-scan` to see what's consuming space
2. Review the report
3. Run `/clean-execute` and select which categories to clean
4. Confirm cleanup actions

## Requirements

- macOS
- Claude Code CLI
<!-- sync test 2: Tue Jan 27 18:18:24 IST 2026 -->
