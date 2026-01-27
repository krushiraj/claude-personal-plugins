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

## Adding New Tips

When you discover a new pattern:

1. Identify the symptom clearly
2. Document the root cause
3. Provide the fix with example code if applicable
4. Add to appropriate section above
