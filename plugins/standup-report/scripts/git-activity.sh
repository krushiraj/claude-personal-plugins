#!/bin/bash
# Gather git activity across all repos in a directory
# Usage: git-activity.sh <since_date> [until_date] [work_dir]
#
# since_date: ISO date or git-compatible date string (e.g., "2024-02-03", "3 days ago")
# until_date: ISO date (default: now)
# work_dir: directory containing git repos (default: ~/work)
#
# Output: commits grouped by repo, one JSON object per line

set -e

SINCE="$1"
UNTIL="${2:-now}"
WORK_DIR="${3:-$HOME/work}"

if [ -z "$SINCE" ]; then
  echo "Usage: git-activity.sh <since_date> [until_date] [work_dir]" >&2
  exit 1
fi

if [ ! -d "$WORK_DIR" ]; then
  echo "Error: Work directory not found: $WORK_DIR" >&2
  exit 1
fi

# Get the git user name/email for filtering
GIT_USER_NAME=$(git config --global user.name 2>/dev/null || echo "")
GIT_USER_EMAIL=$(git config --global user.email 2>/dev/null || echo "")

echo "=== Git Activity Report ==="
echo "Period: $SINCE to $UNTIL"
echo "Author: $GIT_USER_NAME <$GIT_USER_EMAIL>"
echo "Scanning: $WORK_DIR"
echo "=========================="
echo ""

TOTAL_COMMITS=0

# Find all git repos (direct children and nested)
find "$WORK_DIR" -maxdepth 3 -name ".git" -type d 2>/dev/null | sort | while read gitdir; do
  REPO_DIR=$(dirname "$gitdir")
  REPO_NAME=$(echo "$REPO_DIR" | sed "s|$WORK_DIR/||")

  # Build author filter
  AUTHOR_FILTER=""
  if [ -n "$GIT_USER_EMAIL" ]; then
    AUTHOR_FILTER="--author=$GIT_USER_EMAIL"
  elif [ -n "$GIT_USER_NAME" ]; then
    AUTHOR_FILTER="--author=$GIT_USER_NAME"
  fi

  # Get commits in date range
  COMMITS=$(cd "$REPO_DIR" && git log $AUTHOR_FILTER --since="$SINCE" --until="$UNTIL" --format="%h|%s|%ai" --all 2>/dev/null || echo "")

  if [ -n "$COMMITS" ]; then
    COMMIT_COUNT=$(echo "$COMMITS" | wc -l | tr -d ' ')
    echo "## $REPO_NAME ($COMMIT_COUNT commits)"
    echo ""

    echo "$COMMITS" | while IFS='|' read hash subject date; do
      echo "- [$hash] $subject ($date)"
    done

    echo ""

    # Also show branches with recent activity
    BRANCHES=$(cd "$REPO_DIR" && git branch --sort=-committerdate --format='%(refname:short) %(committerdate:short)' 2>/dev/null | head -5)
    if [ -n "$BRANCHES" ]; then
      echo "  Active branches:"
      echo "$BRANCHES" | while read branch date; do
        echo "    - $branch ($date)"
      done
      echo ""
    fi
  fi
done

# Summary stats
echo "=== Summary ==="
find "$WORK_DIR" -maxdepth 3 -name ".git" -type d 2>/dev/null | while read gitdir; do
  REPO_DIR=$(dirname "$gitdir")
  REPO_NAME=$(echo "$REPO_DIR" | sed "s|$WORK_DIR/||")

  AUTHOR_FILTER=""
  if [ -n "$GIT_USER_EMAIL" ]; then
    AUTHOR_FILTER="--author=$GIT_USER_EMAIL"
  elif [ -n "$GIT_USER_NAME" ]; then
    AUTHOR_FILTER="--author=$GIT_USER_NAME"
  fi

  COUNT=$(cd "$REPO_DIR" && git log $AUTHOR_FILTER --since="$SINCE" --until="$UNTIL" --oneline --all 2>/dev/null | wc -l | tr -d ' ')
  if [ "$COUNT" -gt 0 ]; then
    echo "$REPO_NAME: $COUNT commits"
  fi
done

# Files changed stats
echo ""
echo "=== Files Changed ==="
find "$WORK_DIR" -maxdepth 3 -name ".git" -type d 2>/dev/null | while read gitdir; do
  REPO_DIR=$(dirname "$gitdir")
  REPO_NAME=$(echo "$REPO_DIR" | sed "s|$WORK_DIR/||")

  AUTHOR_FILTER=""
  if [ -n "$GIT_USER_EMAIL" ]; then
    AUTHOR_FILTER="--author=$GIT_USER_EMAIL"
  elif [ -n "$GIT_USER_NAME" ]; then
    AUTHOR_FILTER="--author=$GIT_USER_NAME"
  fi

  STATS=$(cd "$REPO_DIR" && git log $AUTHOR_FILTER --since="$SINCE" --until="$UNTIL" --shortstat --all 2>/dev/null | grep -E "files? changed" | awk '{ins+=$4; del+=$6; files+=$1} END {if(files>0) printf "%d files, +%d/-%d lines", files, ins, del}')
  if [ -n "$STATS" ]; then
    echo "$REPO_NAME: $STATS"
  fi
done
