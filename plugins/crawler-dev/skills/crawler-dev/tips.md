# Crawler Tips & Knowledge Base

Accumulated knowledge for common crawler fixes. Check here before investigating - the solution may already be documented.

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

### Regex Quantifier Mismatch
- **Symptom**: Match step fails even though pattern looks correct
- **Check**: Does the captured path start immediately with the target pattern (e.g., `/item/...` with nothing before it)?
- **Cause**: Using `[^"]+` (one or more) when the path has no preceding characters
- **Fix**: Use `[^"]*` (zero or more) instead of `[^"]+`
- **Example**:
  - Bad: `([^"]+/item/[^"]+\.pdf)` - fails on `/item/10.5802/msia.10.pdf`
  - Good: `([^"]*/item/[^"]+\.pdf)` - works because `*` allows zero chars before `/item/`

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
- **Symptom**: Works once, then fails with 429
- **Note**: Tests may be flaky due to rate limits
- **Fix**: Add delay between tests or mark as `muteAlarm: true`

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

---

## Publisher-Specific Findings

### APS (American Physical Society)
- **Restricted signature changed**: APS moved from `<h2>Authorization Required` to `<h1 class="...">Authorization Required` — strip heading tag from the signature and match only `Authorization Required`.
- **physics.aps.org (Physics magazine)** has NO `citation_pdf_url` meta tag, unlike `journals.aps.org`. Needs a separate rule: `match: 'href="(/articles/pdf/[^"]+)"'`.
- **Pattern**: `pdf_restricted_sigs: ['Authorization Required']` (no prefix)

### PsyArXiv (Open Science Framework)
- `psyarxiv.com/{id}` redirects to `osf.io/preprints/psyarxiv/{id}` which is a **Angular/JS SPA** with no meta tags in initial HTML.
- **Fix**: add a specific rewrite that jumps straight to the OSF download URL:
  ```typescript
  { rewrite: ['^https?://(?:www\\.)?psyarxiv\\.com/([^/?#]+).*', 'https://osf.io/download/$1/'] }
  ```
- The generic fallback `(https?://[^/]+)/.*?([^/]+)/?$` → `$1/download/$2/` still works for `osf.io/preprints/*`.

### JSTOR
- **Bug**: `url.match(/\/(\d+)\??/)` only captures digits before first `.`, so `10.1086/663681` becomes `10`. Breaks DOI-shaped IDs (`10.1086/663681`) and prefixed IDs (`resrep00259.13`).
- **Fix**: capture everything after `/stable/` (or `/stable/info/`) up to a `?`:
  ```typescript
  const [, documentId] = url.match(/\/stable\/(?:info\/)?([^?#]+?)\/?$/) || [];
  ```

### EuropePMC (PubMed Central)
- The `europepmc.org/articles/PMC{id}` page is a JS shell — no `citation_pdf_url`, and the `/pdf/` redirect goes to a flaky `/backend/ptpmcrender.fcgi?...` backend.
- The PMID-based URLs (`europepmc.org/abstract/MED/{pmid}`, `pmc.ncbi.nlm.nih.gov/articles/pmid/{pmid}/...`) now serve a Google reCAPTCHA wall — *not* the cloudpmc PoW that pubmed.ts can solve.
- **Working approach (used in pubmed.ts for europepmc URLs only)**:
  1. If PMID URL: resolve to PMCID via `https://pmc.ncbi.nlm.nih.gov/tools/idconv/api/v1/articles/?ids={pmid}&format=json` (look at `records[0].pmcid`).
  2. Hit `https://europepmc.org/api/getPdf?pmcid={pmcid}` — returns `application/pdf` directly. One call, no captcha, no filename guessing.
- **Don't use this for ncbi.nlm.nih.gov/pmc URLs** — those still work via the original cloudpmc-PoW path. Scope the regex to `europepmc\.org` only.

### DSpace 7 (Angular SPA repositories)
- **Symptom**: `match`/`fn: 'JqMeta'` returns null. The `bodyText` the crawler sees is just `<!DOCTYPE html>...<ds-app></ds-app>...` with no `citation_pdf_url` meta.
- **Cause**: DSpace 7 server-side renders only for *non-browser* user agents. Real Chrome (which the crawler advertises) gets the empty Angular app shell. The full meta-tagged page is only delivered to bots/curl-style UAs.
- **Quick check**: `curl -A "Mozilla/5.0 (...) Chrome/..." -L URL` returns ~800 bytes vs `curl -A "Mozilla/5.0" -L URL` returning hundreds of KB.
- **Fix**: use the public REST API instead. The flow is:
  1. URL after redirect: `https://{host}/items/{itemUuid}` → extract `itemUuid`.
  2. Call `https://{host}/server/api/core/items/{itemUuid}?embed=bundles/bitstreams` (returns `application/hal+json` — must add to `allowedMimeTypes`).
  3. Find the `ORIGINAL` bundle, then the `.pdf` bitstream, then return `_links.content.href` (`/server/api/core/bitstreams/{uuid}/content`) — that endpoint returns `application/pdf` directly.
- **Pass `allowedMimeTypes` on the per-request fetch** inside the fn (the global driver `allowed_mime_types` only applies to the *initial* step fetch, not subsequent fetches the fn makes).
- Implemented in `driverFunctions/pdf/dspace.ts`. Falls back to JqMeta for legacy `/handle/...` URLs.

### Anubis Challenge (OpenEdition, etc.)
- Some sites use [Anubis](https://github.com/TecharoHQ/anubis) proof-of-work challenge page.
- **Signature to detect**: `Protected by <a href="https://github.com/TecharoHQ/anubis">Anubis</a>`
- Add as `blocking_body_sigs` so the crawler reports BLOCKED rather than CRAWLER_FAILED.
- Affected publishers: OpenEdition (`journals.openedition.org`).

## Diagnosis Workflow (Quick Wins First)

When asked to fix many failing tests, triage this way:

1. **Run `yarn crawler:e2e:chrome` for each provider** to get pass/fail counts.
2. **Group failures by type** from the crawler logs:
   - `BLOCKED` (populated `blockedUrl`) → Cloudflare / captcha / AWS WAF; rarely fixable from our side.
   - `CRAWLER_FAILED` with `blockedUrl: null` → rule logic issue; try to fix.
   - `FETCH_FAILED: The URL does not point to a valid PDF file` → the rewritten URL returns HTML; regex or URL pattern bug.
   - `DRIVER_FAILED: No driver match` → test URL migrated to a different publisher; update test URL or add URL pattern.
   - `ACCESS_RESTRICTED` ± `LOGIN_REQUIRED` → working correctly; check test `restricted:` expectation.
3. **Priority order**:
   - Signature/regex bugs in driverFunctions (highest leverage — often fixes multiple tests at once).
   - URL pattern mismatches (easy, surgical).
   - Test URLs migrated to new providers (update `pdfTests.ts` or `metaTests.ts`).
   - Captcha/Cloudflare — document with `description` in tests, don't attempt to bypass.
4. **Blocked locally vs in user's env**: If you see `Blocked by Cloudflare captcha` on *every* fetch, it's your IP. The user's test runner env is often not CF-blocked, so logic fixes still land even if verification has to wait.

## Adding New Tips

When you discover a new pattern:

1. Identify the symptom clearly
2. Document the root cause
3. Provide the fix with example code if applicable
4. Add to appropriate section above
