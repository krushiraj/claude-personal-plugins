---
name: crawler-dev
description: Debug, fix, and verify PDF/META crawlers for academic publishers. Triggered by URL or driver name.
---

# Crawler Development & Debugging

## Overview

Autonomous skill for debugging and fixing crawlers in the Paperpile shared package. When given a URL or driver name, this skill will test, diagnose, fix, and verify the crawler.

## Trigger

Activate when user provides:
- A URL that needs crawling fixed
- A driver name (e.g., "Brieflands", "BioProtocol")
- A report that a crawler is broken

## Workflow

```
1. IDENTIFY
   ├── Detect if input is URL or driver name
   ├── Determine mode (META / PDF / Both)
   └── Locate the driver in pdf.ts or meta.ts

2. TEST
   ├── Run: yarn crawler:debug <url> META
   ├── Run: yarn crawler:debug <url> PDF
   └── Note current behavior and errors

3. DIAGNOSE
   ├── Read tips.md for known patterns
   ├── Analyze failure (network, parsing, access, etc.)
   ├── Check if issue is Node.js-only or also affects browser
   └── Identify root cause

4. PLAN
   ├── Present findings and reasoning
   ├── Propose fix approach
   └── Get approval before modifying non-standard files

5. FIX
   ├── Apply fix using existing mechanisms first
   ├── Update tests if URLs are dead
   └── Keep max 2-3 rules per driver

6. VERIFY
   ├── Run: yarn crawler:debug <url> META
   ├── Run: yarn crawler:debug <url> PDF
   ├── Run: yarn crawler:e2e (filtered to driver)
   ├── Run: yarn crawler:e2e:chrome (if browser-specific)
   └── Test in extension if needed

7. SIMPLIFY
   ├── Test if any rules can be removed (try with fewer rules)
   ├── Test if any steps can be removed
   ├── Verify all test cases still pass with simplified version
   └── Keep only the minimum rules/steps needed

8. REPORT
   └── Generate changelog/postmortem
```

## Permission Model

### Free to Modify
These files can be edited without asking:
- `src/crawler/drivers/pdf.ts`
- `src/crawler/drivers/meta.ts`
- `src/crawler/drivers/pdfTests.ts`
- `src/crawler/drivers/metaTests.ts`

### Ask Permission First
For any other files, explain the reasoning and ask before modifying:
- `src/crawler/converters/*` - New or modified converters
- `src/crawler/driverFunctions/*` - New or modified functions
- `src/crawler/urlPatterns.ts` - URL pattern changes
- Any core crawler files

## Extraction Preferences

### META Mode - Priority Order

| Priority | Method | When to Use |
|----------|--------|-------------|
| 1st | `Default` | Site has good HTML meta tags / structured data |
| 2nd | `Ris` / `Bibtex` / `EndNote` | Site exposes citation export links |
| 3rd | API converters (Doi, CrossRef, etc.) | Site has API or DOI resolution works |
| 4th | Site-specific converter | Last resort - requires new converter code |

### PDF Mode - Priority Order

| Priority | Method | When to Use |
|----------|--------|-------------|
| 1st | `fn: 'JqMeta'` | PDF URL in `<meta>` tag (citation_pdf_url, etc.) |
| 2nd | `rewrite` step | URL pattern transformation (e.g., `/abs/` → `/pdf/`) |
| 3rd | `match` step | Regex extraction from HTML |
| 4th | Combination | Chain multiple steps |
| 5th | Custom `fn` | Only if above methods cannot work |

## Fix Strategy Rules

1. **Minimize rules and steps** - Always aim for the fewest rules and steps that make all tests pass. After fixing, test if any rules or steps can be removed.
2. **Use existing mechanisms** - `match`, `rewrite`, `fn: 'JqMeta'` before writing custom code
3. **Max 2-3 rules per driver** - Keep it simple; prefer 1 rule if possible
4. **Check referer first** - If PDF works in browser but not code, try `referer: true`
5. **Update dead test URLs** - Don't just fix driver, fix tests too
6. **Browser is must-have** - Always ensure extension works
7. **Node.js is best-effort** - Nice to have, skip if blocked (proxy needed, etc.)
8. **Surgical fixes for single URL failures** - If one URL fails, make minimal changes that keep all other test cases passing
9. **Add new URLs to tests** - If the reported URL is not in tests, add it to `pdfTests.ts` or `metaTests.ts` to strengthen coverage
10. **Major changes as last resort** - If every test fails and requires new driver/target/fn, that's acceptable but try simpler fixes first
11. **Ask before changing descriptions** - Always ask user permission before adding or updating descriptions (test descriptions in pdfTests.ts/metaTests.ts and driver documentation in pdf.ts/meta.ts)
12. **Verify no redundancy** - After a fix works, always test with fewer rules/steps to ensure nothing is redundant

## Commands Reference

| Command | Purpose |
|---------|---------|
| `yarn crawler:debug <url> META` | Debug metadata extraction in Node.js |
| `yarn crawler:debug <url> PDF` | Debug PDF extraction in Node.js |
| `yarn crawler:e2e` | Run e2e tests in Node.js context |
| `yarn crawler:e2e:chrome` | Run e2e tests in Chrome browser context |

### Filtering e2e Tests

Edit `filterTestsToRun` in `test/crawler/e2e.test.ts`:

```typescript
// Run single driver (all tests)
{ META: { 'DriverName': true }, PDF: false }

// Run single test from driver
{ META: { 'DriverName': { 0: true } }, PDF: false }

// Run both META and PDF for a driver
{ META: { 'DriverName': true }, PDF: { 'DriverName': true } }
```

## Key Files

| File | Purpose |
|------|---------|
| `src/crawler/drivers/meta.ts` | META driver definitions |
| `src/crawler/drivers/pdf.ts` | PDF driver definitions |
| `src/crawler/drivers/metaTests.ts` | META test cases |
| `src/crawler/drivers/pdfTests.ts` | PDF test cases |
| `src/crawler/drivers/urlPatterns.ts` | URL signatures for driver matching |
| `src/crawler/converters/` | Format/site-specific converters |
| `src/crawler/driverFunctions/pdf/` | Custom PDF extraction functions |

## Tips & Knowledge Base

Read `tips.md` in this skill directory for accumulated knowledge on common fixes.

Always check tips before investigating - the fix may already be documented.

After fixing, evaluate if the pattern is worth adding to tips.md.

## Changelog / Postmortem Template

After each fix, generate this report:

```markdown
## Crawler Fix Report: [Driver Name]

### Summary
[1-2 sentence overview of what was broken and fixed]

### Issue Details
- **Mode**: META / PDF / Both
- **Reported URL(s)**: [URLs that were failing]
- **Symptom**: [What was happening]
- **Root Cause**: [Why it was failing]

### Investigation Steps
1. [What you tested first]
2. [What you discovered]
3. [How you identified the fix]

### Changes Made
| File | Change |
|------|--------|
| `drivers/pdf.ts` | [Description] |
| `drivers/pdfTests.ts` | [Description] |

### Fix Details
[Explain the fix - what rule/step was added/modified and why]

### Verification
- [ ] `yarn crawler:debug <url> PDF` - passes
- [ ] `yarn crawler:debug <url> META` - passes (if applicable)
- [ ] `yarn crawler:e2e` filtered to driver - passes
- [ ] `yarn crawler:e2e:chrome` - passes
- [ ] Extension test - passes (if applicable)

### Tips Learned
[Any new pattern worth adding to tips.md, or "None - used existing pattern"]
```
