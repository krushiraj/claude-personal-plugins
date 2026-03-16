---
name: recall
description: Load context from Obsidian vault memory. Temporal queries use native JSONL timeline. Topic queries use QMD BM25 search. Graph mode generates interactive visualization. Every recall ends with "One Thing" - the single highest-leverage next action.
argument-hint: [yesterday|today|last week|this week|TOPIC|graph DATE_EXPR]
allowed-tools: Bash(qmd:*), Bash(python3:*), Bash(node:*)
---

# Recall Command

Three modes: temporal (date-based session timeline), topic (BM25 search across QMD collections), and graph (interactive visualization of session-file relationships). Every recall ends with the **One Thing** - a concrete, highest-leverage next action synthesized from the results.

## Step 1: Classify Query

Parse the user's input after `/recall` and classify:

- **Graph** - starts with "graph": "graph last week", "graph yesterday"
  -> Go to Step 2C
- **Temporal** - mentions time: "yesterday", "today", "last week", "this week", a date
  -> Go to Step 2A
- **Topic** - mentions a subject: "QMD video", "authentication", "apple notes"
  -> Go to Step 2B
- **Both** - temporal + topic: "what did I do with QMD yesterday"
  -> Go to Step 2A first, then scan results for the topic

## Step 2A: Temporal Recall (JSONL Timeline)

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/recall-day.py list DATE_EXPR --all-projects
```

Present the table. If user picks a session to expand:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/recall-day.py expand SESSION_ID --all-projects
```

## Step 2B: Topic Recall (QMD BM25 with Query Expansion)

**Step 2B.1: Expand query into 3-4 keyword variants** covering synonyms and phrasings.

**Step 2B.2: Run ALL variants across collections in parallel:**

```bash
qmd search "VARIANT_1" -c obsidian -n 5
qmd search "VARIANT_2" -c obsidian -n 5
qmd search "VARIANT_3" -c obsidian -n 5
```

If a `sessions` collection exists, also search it:
```bash
qmd search "VARIANT_1" -c sessions -n 5
```

**Step 2B.3: Deduplicate** by document path, keep highest scores. Present top 5.

## Step 3: Fetch Full Documents (Topic path only)

For top 3 results:
```bash
qmd get "qmd://obsidian/path/to/file.md" -l 50
```

## Step 2C: Graph Visualization

```bash
${CLAUDE_PLUGIN_ROOT}/.venv/bin/python3 ${CLAUDE_PLUGIN_ROOT}/scripts/session-graph.py DATE_EXPR --all-projects
```

## Step 4: Present Summary

**Temporal:** Show session table, offer to expand.
**Topic:** Organize by source (notes, sessions, daily logs). Keep concise.

## Step 5: Synthesize "One Thing"

After presenting results, synthesize the single highest-leverage next action:
1. What has momentum (recent activity, mid-flow)
2. What's blocked (removing blocker unlocks downstream)
3. What's closest to done (finishing > starting)

> **One Thing: [specific, concrete action]**

If not enough signal, ask "What would you like to work on from here?"

## Fallback

```
No results found for "QUERY". Try:
- Different search terms / broader keywords
- Different date range
- --min-msgs 1 to include short sessions
```
