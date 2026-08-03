# Crawler Tips & Knowledge Base

Accumulated knowledge for common crawler fixes. Check here before investigating - the solution may already be documented.

**Policy**: this file holds GENERIC patterns only. Driver-specific knowledge belongs in comments next to the driver code (pdf.ts / meta.ts / urlPatterns.ts / driverFunctions/*). Only put driver-related knowledge here when it genuinely cannot be expressed at the code site (e.g. platform patterns spanning many drivers). When fixing a driver, write the "why" as a comment on the rule/sig itself.

---

## PDF Issues

### Referer Required
- **Symptom**: PDF link works in browser, returns 403/401 in crawler
- **Fix**: Add `referer: true` to driver definition
- **Alternative**: Use `referer: { url: 'https://specific-domain.com' }` for custom referer
- **Example**:
  ```typescript
  'Publisher Name': {
    referer: true,
    rules: [{ steps: [{ fn: 'JqMeta' }] }],
  }
  ```

### Redirect Chains
- **Symptom**: URL redirects multiple times, crawler times out or fails
- **Fix**: Use `rewrite` step to skip directly to final URL pattern
- **Example**: If `/article/123` redirects to `/article/123/pdf`, use rewrite to go direct

### citation_pdf_url Is Stale
- **Symptom**: `citation_pdf_url` meta points to a URL that 404s (even in a real browser with cookies), yet the page's own "Download PDF" button works
- **Cause**: Publisher's meta tag lags the actual asset (common on early-access/ahead-of-print articles)
- **Diagnose**: In page context compare `fetch(citationPdfUrl).then(r => r.status)` with `document.querySelector('a[data-track-action="download pdf"]')?.href` (or whatever the real download anchor is)
- **Fix**: Add a fallback match rule for the real download anchor AFTER the citation_pdf_url rule — rules run in order until one yields a valid PDF. Document the publisher's quirk as a comment on the rule.

### Stale pdf_restricted_sigs (Paywall Misreported as CRAWLER_FAILED)
- **Symptom**: Paywalled article fails with generic `CRAWLER_FAILED` instead of `ACCESS_RESTRICTED`; PDF URL returns HTTP 200 with an HTML paywall page
- **Cause**: Publisher changed paywall markup; none of the driver's `pdf_restricted_sigs` (urlPatterns.ts) match anymore — sigs rot silently
- **Diagnose**: Grep the captured page body (extension pdf-crawl-log `collectedLogs[].response.body`) for each existing sig — if all miss, find what the current paywall actually says
- **Fix**: Add the current paywall markers to `pdf_restricted_sigs` with a dated comment. Prefer explicit commerce phrases ('Buy this article') over generic words

### Restricted-Signature Regex Misses HTML Tags Between Words
- **Symptom**: Page clearly contains "subscriber/member/login required" text but `pdf_restricted_sigs` doesn't fire
- **Cause**: The page wraps the message with `<br/>` (or other inline HTML) between words, e.g. `accessible to AMA<br/> members`. The literal-text regex doesn't match
- **Fix**: Replace inline literal spaces with a small character class, e.g. `'accessible to AMA.{0,20}members'`, or pick a unique unbroken substring
- **Tip**: When adding a new sig, paste a chunk of the rendered HTML from the page source — don't trust the visible text

### JqMeta Fails but PDF URL Exists
- **Symptom**: `fn: 'JqMeta'` returns nothing, but PDF URL is in page source
- **Check**: Look for non-standard meta tag names:
  - `DC.identifier`
  - `bepress_citation_pdf_url`
  - `eprints.document_url`
  - `citation_pdf_url` (standard)
- **Fix**: May need custom match step or new JqMeta selector

### PDF Behind JavaScript
- **Symptom**: Works in extension, fails in Node.js
- **Cause**: PDF URL is rendered by JavaScript, not in initial HTML
- **Fix**: Mark driver as `dynamic: true`, accept browser-only support
- **Note**: This is acceptable - browser support is the priority

### PDF URL with Query Parameters
- **Symptom**: Match step captures URL but breaks at `?` or `&`
- **Fix**: Adjust regex to include query string: `([^"']+\.pdf[^"']*)`

### Regex Quantifier Mismatch (`+` vs `*`)
- **Symptom**: Match step fails even though pattern looks correct
- **Cause**: `[^"]+` (one or more) used where zero chars are valid — either BEFORE the target path or AFTER `.pdf`
- **Fix**: Use `[^"]*` (zero or more) on both sides unless at least one char is guaranteed
- **Examples**:
  - Bad: `([^"]+/item/[^"]+\.pdf)` — fails on `/item/10.5802/msia.10.pdf` (nothing before `/item/`)
  - Bad: `href=["']([^"']+\.pdf[^"']+)["']` — fails on URLs ending exactly at `.pdf"` (nothing after)
  - Good: `([^"]*/item/[^"]+\.pdf[^"']*)`

---

## META Issues

### Default Converter Fails
- **Symptom**: `Default` target returns incomplete/wrong metadata
- **Check**: View page source for structured data (JSON-LD, meta tags)
- **Fix Options**:
  1. Try `Doi` target if DOI is present
  2. Look for citation export links (RIS, BibTeX)
  3. Check if site-specific converter exists

### DOI Resolution Fails
- **Symptom**: `Doi` target fails but DOI exists on page
- **Cause**: DOI not registered, or CrossRef data incomplete
- **Fix**: Fall back to `Default` or site-specific converter

### Wrong Publication Type
- **Symptom**: Article detected as webpage or wrong type
- **Check**: `website_pubtype_allowed` in urlPatterns
- **Fix**: May need to add pattern or adjust converter

---

## Test Issues

### Dead Test URLs
- **Symptom**: Test fails with 404 or page not found
- **Fix**:
  1. Find new working URL from same publisher
  2. Update URL in `metaTests.ts` or `pdfTests.ts`
  3. Update expected output if metadata differs
- **Finding URLs**: Check publisher's recent articles, use Google Scholar

### Test Passes Locally, Fails in CI
- **Symptom**: Inconsistent test results
- **Causes**:
  - Rate limiting
  - Geo-blocking
  - Session/cookie requirements
- **Fix**: Mark test with `muteAlarm: true` or `sessionRequired: true` if flaky

### Access Restricted Content
- **Symptom**: Works for some articles, fails for others
- **Cause**: Paywalled content
- **Fix**:
  1. Check `pdf_url_restricted_sigs` in urlPatterns
  2. Mark test as `restricted: true`
  3. Find open-access article for testing
- **Note**: restricted-test expectations accept ACCESS_RESTRICTED/LOGIN_REQUIRED/PROXY_LOGGED_OUT but NOT BLOCKED — use `pdf_restricted_sigs` (not `blocking_body_sigs`) when the goal is a restricted verdict

---

## Driver Configuration

### Too Many Rules
- **Problem**: Driver has 4+ rules, hard to maintain
- **Fix**: Consolidate rules, use more generic patterns
- **Goal**: Max 2-3 rules per driver

### URL Pattern Conflicts
- **Symptom**: Wrong driver matches URL
- **Debug**: Run `yarn ts-node scripts/testCrawlerPatterns.ts`
- **Fix**: Make patterns more specific with `article_sigs` or `article_exclude_sigs`

### URL Pattern Substring Matching
- **Symptom**: Wrong driver matches because one domain is substring of another
- **Example**: `brill\.com` matches `degruyterbrill.com` because URL patterns are regex-tested without anchoring
- **Cause**: Pattern `publisher\.com` will match any URL containing `publisher.com` anywhere
- **Fix**: Prefix pattern with `[:/.]` to require URL boundary:
  ```typescript
  // Bad: 'brill\\.com' matches 'degruyterbrill.com'
  // Good: '[:/.]brill\\.com' only matches '://brill.com' or '.brill.com'
  ```
- **When to use**: If driver A's domain is a suffix of driver B's domain (e.g., `brill.com` vs `degruyterbrill.com`)

### Driver Not Matching
- **Symptom**: URL should match driver but doesn't
- **Check**:
  1. URL patterns in `urlPatterns.ts`
  2. `article_sigs` for path patterns
  3. `body_sigs` for content-based matching
- **Fix**: Add or adjust URL signature

---

## Network Issues

### CORS Errors (Extension Only)
- **Symptom**: Extension fails with CORS, Node.js works
- **Cause**: Publisher blocks cross-origin requests
- **Fix**: Usually not fixable - may need proxy or accept limitation

### SSL/Certificate Errors
- **Symptom**: UNABLE_TO_VERIFY_LEAF_SIGNATURE or similar
- **Cause**: Publisher has certificate issues
- **Fix**: Report issue, usually requires publisher to fix

### Rate Limiting
- **Symptom**: Works once, then fails with 429 — or every request returns 429/420 with an empty body
- **Codes**: 429 is standard. **420** ("Enhance Your Calm") is used by `doi.org` and
  `ieeexplore.ieee.org`, usually with `len=0` bodies on *every* request in the crawl.
- **Since [ID-2662]**: both are recorded as the `RATE_LIMITED` restriction instead of falling through
  to `CRAWLER_FAILED`. If you see `RATE_LIMITED`, there is nothing to fix in the driver.
- **Note**: Tests may be flaky due to rate limits
- **Fix**: Add delay between tests or mark as `muteAlarm: true`
- **Before concluding anything**, read "Throttled Body Looks Like a Driver Bug" below.

### Throttled Body Looks Like a Driver Bug

**The most expensive mis-triage in this codebase.** When a host throttles or challenges us it returns
an empty or interstitial body. The driver then runs its `match` / `rewrite` step against that body,
finds nothing, and reports `RULE_FAILED: Steps failed` or `Nothing rewritten during rewrite` — which
reads exactly like broken driver logic.

- **Symptom**: `RULE_FAILED` / `Nothing rewritten`, on a driver whose rules are actually fine
- **Root cause**: there was no content to match against
- **How to tell**, before touching any driver:

```bash
# Per-request status and body length from a crawl log
jq -r '.collectedLogs[] | "\(.response.status) len=\(.response.body|length) \(.request.url)"' <log.json>
```

  `420`/`429` or `len=0` across the crawl → throttling, not a driver bug. A body that is present but
  small is often a challenge page or an iframe wrapper — read it before assuming.

- **Real example**: 12 IEEE logs looked like driver bugs. 11 were HTTP 420 with empty bodies (one
  user, rate-limited, also through their university proxy). The 12th had real content and the driver
  matched correctly — it was an iframe wrapper already handled by a later fix. **Zero driver bugs.**
- **Corollary**: never trust a driver conclusion drawn from a throttled crawl. Re-run when not
  throttled, or replay a log captured under working conditions.

### Anti-Bot Markers That Are NOT Blocks

Some vendor scripts are injected into **successful** pages as telemetry, not block pages. Detecting
on them causes false `BLOCKED` classifications that break working crawls.

- `APM_DO_NOT_TOUCH` (Akamai) appears on normal IEEE article pages that parse fine — it is *not* a
  block marker. Verified: it was present in all 5 responses of a crawl, including the page the driver
  successfully extracted `pdfUrl` from and the stamp.jsp page containing the real PDF iframe.
- Before adding any challenge detector, confirm the marker is absent from successful responses.

---

## Anti-Bot & SPA Platform Patterns

Patterns spanning many publishers (a platform, not one driver) — the specific sigs/implementations live in the driver files with comments.

### Cookie-Bounce Identity Providers
- **Symptom**: PDF URL 30x-redirects to an `idp.<publisher>.com/authorize?response_type=cookie...` hop; non-browser fetches land on `?error=cookies_not_supported` → 404
- **Diagnose**: `curl -sI <pdf-url> | grep -i location`; verify in a real browser via page-context `fetch(url, {credentials:'include'})`
- **Note**: The bounce failing does NOT prove the asset exists — check whether the PDF is fetchable in a real browser before blaming the bounce

### Webroute / ISTL Interstitial
- **Symptom**: HTTP 200 `text/html` but body is obfuscated JS, no real content; JqMeta returns null. `detectCaptcha` does NOT catch it (no `cf-mitigated`, no "Just a moment...")
- **Markers**: headers `X-Webroute-Cache*`; body `ISTL-INFINITE-LOOP`, `ISTL-RESPONSE-URL`, `ISTL-REDIRECT-TO`
- **Fix**: add `ISTL-INFINITE-LOOP` to the affected driver's `pdf_restricted_sigs` (gives ACCESS_RESTRICTED; `blocking_body_sigs` would give BLOCKED which restricted tests don't accept)

### Anubis Proof-of-Work Challenge
- **Marker**: `Protected by <a href="https://github.com/TecharoHQ/anubis">Anubis</a>`
- **Fix**: add as `blocking_body_sigs` on the affected driver so the crawler reports BLOCKED rather than CRAWLER_FAILED
- **Known adopters**: OpenEdition (`journals.openedition.org`) — NOTE: sig not yet added to the OpenEdition urlPatterns entry

### DSpace 7 (Angular SPA Repositories)
- **Symptom**: crawler sees only `<ds-app></ds-app>` app shell; no meta tags. DSpace 7 SSRs full HTML only for non-browser user agents
- **Quick check**: browser-UA curl returns ~800 bytes; generic-UA curl returns hundreds of KB
- **Fix**: use the DSpace REST API (`/server/api/core/items/{uuid}?embed=bundles/bitstreams` → ORIGINAL bundle → bitstream `content` href). Implemented once for all DSpace hosts in `driverFunctions/pdf/dspace.ts` (see comments there, incl. the per-request `allowedMimeTypes` gotcha)

---

## Step Helpers Reference

### match
Extract URL from HTML using regex:
```typescript
{ match: 'href="([^"]+\\.pdf)"' }
```

### rewrite
Transform URL using regex substitution:
```typescript
{ rewrite: ['/article/(\\d+)', '/article/$1/pdf'] }
```

### fn
Call built-in function:
```typescript
{ fn: 'JqMeta' }  // Extracts from meta[name*="pdf_url"]
```

### Available fn values
- `JqMeta` - Extract from meta tags
- `Atypon` - Atypon publisher platform
- `Elsevier` - Elsevier/ScienceDirect
- `PubMed` - PubMed Central
- `JSTOR` - JSTOR
- See `src/crawler/driverFunctions/pdf/index.ts` for full list

---

## Diagnosis Tips

### Use Browser User-Agent in curl
- **When**: Running curl commands to test URLs during diagnosis
- **Why**: Many publishers block non-browser user agents, returning 403/406 or different content
- **Fix**: Always include a browser-like user agent:
  ```bash
  curl -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" "URL"
  ```
- **Note**: This helps reproduce what the browser sees vs what a raw request gets

### Replay Real User Crawls Offline
- Extension-uploaded `*_pdf-crawl-log_*.json` files replay deterministically with `yarn crawler:debug:replay <file>` — no network, exact user conditions. The captured `collectedLogs[].response.body` is also the ground truth for testing sigs/regexes. See the `crawler-fix-loop` skill for the triage toolchain.
- Fetch a corpus with `js/shared/scripts/fetch-pdf-crawl-logs.sh <hyperdx.csv>` — it pulls from S3 and
  sorts each file into a subdirectory named after its top-level `errorMsg` (`CRAWLER_FAILED/`,
  `BLOCKED/`, `PROXY_LOGGED_OUT/`, …). Sweep a whole directory with `triage.js --logs-dir <dir>`.

**Replay caveats — know these before trusting a result:**

1. **A cache miss silently hits the live network.** Watch for
   `[Replay] No log for <url>, falling back to network`. Those steps reflect the site today and your
   IP, not the recorded crawl. A replay that "now succeeds" is often just this.
2. **PDF bodies are stubbed.** Captured as `[PDF content skipped]` and replayed as a literal
   `%PDF-1.7`, so PDF-signature checks pass trivially. These logs diagnose crawl *routing* only,
   never PDF *parsing*.
3. **Response headers only exist in logs captured after [ID-2662].** Older logs replay with an empty
   header set, so anything header-dependent (`Retry-After`, `cf-mitigated`, `x-amzn-waf-action`) is
   not reproducible from them.
4. **A log only replays the URLs it recorded.** If a fix makes the crawler follow a *new* URL, that
   fetch goes live — which is a genuine end-to-end confirmation, but say so rather than calling it
   an offline reproduction.

---

## Diagnosis Workflow (Quick Wins First)

When asked to fix many failing tests, triage this way:

1. **Run `yarn crawler:e2e:chrome` for each provider** to get pass/fail counts.
2. **Group failures by type** from the crawler logs:
   - `BLOCKED` (populated `blockedUrl`) → Cloudflare / captcha / AWS WAF; rarely fixable from our side.
   - `CRAWLER_FAILED` with `blockedUrl: null` → rule logic issue; try to fix.
   - `FETCH_FAILED: The URL does not point to a valid PDF file` → the rewritten URL returns HTML; regex or URL pattern bug — or a stale-sig paywall misreport (see PDF Issues).
   - `DRIVER_FAILED: No driver match` → test URL migrated to a different publisher; update test URL or add URL pattern.
   - `ACCESS_RESTRICTED` ± `LOGIN_REQUIRED` → working correctly; check test `restricted:` expectation.
3. **Priority order**:
   - Signature/regex bugs in driverFunctions (highest leverage — often fixes multiple tests at once).
   - URL pattern mismatches (easy, surgical).
   - Test URLs migrated to new providers (update `pdfTests.ts` or `metaTests.ts`).
   - Captcha/Cloudflare — document with `description` in tests, don't attempt to bypass.
4. **Blocked locally vs in user's env**: If you see `Blocked by Cloudflare captcha` on *every* fetch, it's your IP. The user's test runner env is often not CF-blocked, so logic fixes still land even if verification has to wait.

---

## Adding New Tips

When you discover a new pattern:

1. **Generic pattern** (applies across publishers/drivers) → document it here: symptom, root cause, fix, example.
2. **Driver-specific finding** → write it as a comment ON the driver rule/sig in pdf.ts / meta.ts / urlPatterns.ts / driverFunctions/* (with a date for markup-drift fixes). Do NOT add it here.
3. **Platform pattern** (Anubis, DSpace, Webroute — many sites, one mechanism) → the "Anti-Bot & SPA Platform Patterns" section here, with pointers to the canonical implementation.
4. If a fix teaches BOTH a generic lesson and a publisher quirk: generic lesson here, quirk in the code comment.
