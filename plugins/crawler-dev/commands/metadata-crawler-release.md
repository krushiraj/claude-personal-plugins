---
description: Copy metadata crawler to apify-actors, commit, and push for deployment
allowed-tools: Read, Bash, Grep, Glob, AskUserQuestion
---

# Metadata Crawler Release

Copy metadata crawler changes from guru to apify-actors repo, commit in both repos, and push for Apify deployment.

## Prerequisites

- Changes to `apify/metadata-crawler/` have been made and tested in guru
- All metadata crawler tests pass

## Steps

### 1. Navigate to guru and verify changes

```bash
cd /Users/krushi/work/paperpile/js/guru
```

Show what changed in the metadata crawler:
```bash
git diff -- apify/metadata-crawler/
git diff -- test/crawler/metadata/ test/data/metadataCrawler/
```

If no changes, stop and inform user there's nothing to release.

### 2. Run tests to confirm everything passes

```bash
yarn test:one test/crawler/metadata/domains/linkspringer.crawler.test.js
```

Run any other affected domain tests as needed. If tests fail, stop and fix first.

### 3. **CHECKPOINT**: Ask user to confirm what to release

Show a summary of changed files and ask: "These are the metadata crawler changes. Ready to copy to apify-actors and release?"

### 4. Copy files to apify-actors

Run the copy script:
```bash
cd /Users/krushi/work/paperpile/js/guru
bash scripts/copyApifyMetadataCrawler.sh
```

### 5. Verify the copy

Show what changed in apify-actors:
```bash
cd /Users/krushi/work/apify-actors/metadata-crawler
git diff
git status
```

### 6. **CHECKPOINT**: Ask user to confirm commit message

Propose a commit message based on the changes and ask user to confirm or adjust.

### 7. Commit in guru repo

```bash
cd /Users/krushi/work/paperpile/js/guru
git add apify/metadata-crawler/ test/crawler/metadata/ test/data/metadataCrawler/
```

Commit with the agreed message.

### 8. Commit in apify-actors repo

```bash
cd /Users/krushi/work/apify-actors/metadata-crawler
git add .
```

Commit with a matching message.

### 9. **CHECKPOINT**: Ask user to confirm push

"Ready to push guru + apify-actors (main first, then release/production/metadata-crawler). The release branch push triggers the Apify build. Confirm?"

### 10. Push repos — main BEFORE release branch

apify-actors must be pushed in two steps so `main` and `release/production/metadata-crawler` stay aligned. The release branch is what Apify deploys from; main is the source-of-truth default branch and should never lag behind it.

Only if user confirms:
```bash
# guru: push the dev commit
cd /Users/krushi/work/paperpile/js/guru
git push

# apify-actors: commit was made on release/production/metadata-crawler. First
# fast-forward main to it, push main, then push the release branch.
cd /Users/krushi/work/apify-actors
git fetch origin
git checkout main
git merge --ff-only release/production/metadata-crawler
git push origin main

git checkout release/production/metadata-crawler
git push
```

If `git merge --ff-only` fails because main has diverged, stop and ask the user — never force-push main.

## Post-Release

Report completion:
- guru changes pushed
- apify-actors `main` pushed (kept in sync)
- apify-actors `release/production/metadata-crawler` pushed → Apify rebuild triggered (deployed from `webstore` account)

## Important Notes

- Always run tests before releasing
- Never push without user confirmation
- `main` is pushed BEFORE `release/production/metadata-crawler` so the default branch never lags
- The copy script uses rsync and excludes node_modules
- Development happens only in guru; apify-actors is the production/deployment repo
- Actors are deployed from apify-actors repo from the webstore account on Apify
