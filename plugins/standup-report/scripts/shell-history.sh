#!/bin/bash
# Parse shell history for work-related activity
# Usage: shell-history.sh <since_date> [until_date]
#
# Extracts SSH sessions, server interactions, and notable work commands
# from zsh history with timestamps
#
# since_date: ISO date (e.g., "2024-02-03")
# until_date: ISO date (default: today)

set -e

SINCE="$1"
UNTIL="${2:-$(date +%Y-%m-%d)}"

if [ -z "$SINCE" ]; then
  echo "Usage: shell-history.sh <since_date> [until_date]" >&2
  exit 1
fi

# Convert dates to epoch for comparison
if [[ "$OSTYPE" == "darwin"* ]]; then
  SINCE_EPOCH=$(date -j -f "%Y-%m-%d" "$SINCE" "+%s" 2>/dev/null || date -j -f "%Y-%m-%d %H:%M:%S" "$SINCE 00:00:00" "+%s" 2>/dev/null || echo "0")
  UNTIL_EPOCH=$(date -j -f "%Y-%m-%d" "$UNTIL" "+%s" 2>/dev/null || date -j -f "%Y-%m-%d %H:%M:%S" "$UNTIL 23:59:59" "+%s" 2>/dev/null || echo "9999999999")
  # Add a day to until to include the full day
  UNTIL_EPOCH=$((UNTIL_EPOCH + 86400))
else
  SINCE_EPOCH=$(date -d "$SINCE" "+%s" 2>/dev/null || echo "0")
  UNTIL_EPOCH=$(date -d "$UNTIL +1 day" "+%s" 2>/dev/null || echo "9999999999")
fi

HISTFILE="${HISTFILE:-$HOME/.zsh_history}"

if [ ! -f "$HISTFILE" ]; then
  echo "No history file found at $HISTFILE" >&2
  exit 1
fi

echo "=== Shell History Report ==="
echo "Period: $SINCE to $UNTIL"
echo "Source: $HISTFILE"
echo "==========================="
echo ""

# Work-related patterns to look for
# SSH sessions, server connections, deployment commands, docker, kubectl, etc.
WORK_PATTERNS="ssh |scp |rsync |deploy|kubectl|docker|ansible|terraform|pm2 |systemctl|nginx|mysql|mongo|redis|psql|pg_dump|curl.*api|wget|npm run|yarn |make |grunt|gulp"

# Parse zsh extended history format: : timestamp:0;command
echo "## SSH & Server Sessions"
echo ""

# Extract entries with timestamps in range
while IFS= read -r line; do
  # Match zsh extended history format
  if [[ "$line" =~ ^:\ ([0-9]+):[0-9]+\;(.*)$ ]]; then
    TIMESTAMP="${BASH_REMATCH[1]}"
    COMMAND="${BASH_REMATCH[2]}"

    if [ "$TIMESTAMP" -ge "$SINCE_EPOCH" ] && [ "$TIMESTAMP" -lt "$UNTIL_EPOCH" ]; then
      # Check if it's an SSH command
      if echo "$COMMAND" | grep -qiE "^ssh |^scp |^rsync "; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
          DATE=$(date -r "$TIMESTAMP" "+%Y-%m-%d %H:%M" 2>/dev/null || echo "unknown")
        else
          DATE=$(date -d "@$TIMESTAMP" "+%Y-%m-%d %H:%M" 2>/dev/null || echo "unknown")
        fi
        echo "- [$DATE] $COMMAND"
      fi
    fi
  fi
done < "$HISTFILE"

echo ""
echo "## Notable Work Commands"
echo ""

while IFS= read -r line; do
  if [[ "$line" =~ ^:\ ([0-9]+):[0-9]+\;(.*)$ ]]; then
    TIMESTAMP="${BASH_REMATCH[1]}"
    COMMAND="${BASH_REMATCH[2]}"

    if [ "$TIMESTAMP" -ge "$SINCE_EPOCH" ] && [ "$TIMESTAMP" -lt "$UNTIL_EPOCH" ]; then
      # Check for work patterns (excluding SSH which is already shown)
      if echo "$COMMAND" | grep -qiE "deploy|kubectl|docker|ansible|terraform|pm2 |systemctl|nginx" && ! echo "$COMMAND" | grep -qiE "^ssh |^scp "; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
          DATE=$(date -r "$TIMESTAMP" "+%Y-%m-%d %H:%M" 2>/dev/null || echo "unknown")
        else
          DATE=$(date -d "@$TIMESTAMP" "+%Y-%m-%d %H:%M" 2>/dev/null || echo "unknown")
        fi
        echo "- [$DATE] $COMMAND"
      fi
    fi
  fi
done < "$HISTFILE"

echo ""
echo "## Directory Activity"
echo ""

# Show which directories were most active (cd commands)
while IFS= read -r line; do
  if [[ "$line" =~ ^:\ ([0-9]+):[0-9]+\;(.*)$ ]]; then
    TIMESTAMP="${BASH_REMATCH[1]}"
    COMMAND="${BASH_REMATCH[2]}"

    if [ "$TIMESTAMP" -ge "$SINCE_EPOCH" ] && [ "$TIMESTAMP" -lt "$UNTIL_EPOCH" ]; then
      if echo "$COMMAND" | grep -qE "^cd .*/work/"; then
        echo "$COMMAND"
      fi
    fi
  fi
done < "$HISTFILE" | sort | uniq -c | sort -rn | head -10 | while read count cmd; do
  echo "- ($count times) $cmd"
done
