# Notion Cards Plugin

A Claude Code plugin for managing Notion cards workflow - list cards, start work with branch/spec/PR, and track status.

## Features

- **List cards** by status (In Progress, Code Review, QA, etc.)
- **Start work** on a card: creates branch, fetches spec, opens draft PR
- **Track status** across different workflow stages

## Setup

Create `.claude/notion-cards.local.md` with your credentials:

```yaml
---
notion_token: secret_xxx
database_id: your-database-id
owner_uuid: your-user-uuid
owner_name: YourName
---
```

## Usage

### List your cards
- "show my cards"
- "what cards are in code review?"
- "list my backlog"

### Start work on a card
- "start on ID-1234"
- Paste a Notion link
- "work on ID-1234"

This will:
1. Create branch: `yourname-id-1234-short-description`
2. Fetch card content → `specs/ID-1234-spec.md`
3. Create draft PR: `[ID-1234] Card Title`

### Check status
- "what's in code review?"
- "show QA cards"

## Status Order

1. In Progress
2. Code Review
3. Backlog
4. QA Dev
5. QA Staging
6. QA Production
7. Done (hidden by default)
8. Triage (hidden by default)
