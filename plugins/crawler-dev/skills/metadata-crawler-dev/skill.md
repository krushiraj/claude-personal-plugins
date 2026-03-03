---
name: metadata-crawler-dev
description: This skill should be used when the user asks to "fix metadata selectors", "test DOI extraction", "add selectors for a domain", "debug metadata crawler", "test metadata for DOI", mentions a DOI like "10.1007/..." and wants to check if abstract/DOI/PDF can be extracted, or references the Apify metadata crawler at apify/metadata-crawler. Covers the metadata crawler in guru that runs on Apify, NOT the shared package crawlers (pdf.ts/meta.ts).
---

# Metadata Crawler Development

## Overview

Skill for developing and debugging the Apify metadata crawler that extracts DOI, abstract, and PDF URL from academic publisher pages. The crawler lives at `apify/metadata-crawler/` in the guru repo and uses CSS selectors + Cheerio to parse HTML.

## Trigger

Activate when:
- A DOI is provided and the user wants to test metadata extraction
- Selectors need to be added or fixed for a publisher domain
- A new domain needs support in the metadata crawler
- The user mentions "metadata crawler", "selectors.js", or "apify metadata"

**Do NOT activate** for shared package crawler work (pdf.ts/meta.ts, urlPatterns.ts) — that's handled by the `crawler-dev` skill.

## Workflow

```
1. IDENTIFY
   ├── Get DOI or publisher URL from user
   ├── Determine domain (e.g., link.springer.com)
   └── Check if domain already has selectors in selectors.js

2. FETCH HTML
   ├── Try direct curl first: curl -L -A "Mozilla/5.0..." "https://doi.org/{DOI}"
   ├── If redirect fails, try: curl -L -A "Mozilla/5.0..." "https://doi.org/{DOI}?locatt=mode:legacy"
   ├── If user provides a local HTML file, use that instead
   └── Save HTML for analysis

3. TEST EXISTING SELECTORS
   ├── Load HTML with cheerio and run getMetadata() against it
   ├── Check: DOI extracted? Abstract extracted? PDF URL extracted?
   └── Report which fields succeeded/failed

4. DIAGNOSE FAILURES
   ├── Analyze HTML structure for the failing fields
   ├── Search for DOI in meta tags, hidden inputs, data attributes
   ├── Search for abstract in sections, divs, meta description
   ├── Search for PDF URL in meta tags, links, buttons
   └── Identify the right CSS selectors

5. FIX
   ├── Update selectorsObj with new CSS selectors
   ├── Update crawlersObj with corresponding extraction functions
   ├── Follow existing patterns (see Architecture section)
   └── Keep changes minimal — add fallbacks, don't restructure

6. ADD TESTS
   ├── Copy HTML to test/data/metadataCrawler/{PublisherId}-{Type}.html
   ├── Add test case to test/crawler/metadata/domains/{domain}.crawler.test.js
   ├── Follow existing test patterns (see Testing section)
   └── Run: yarn test:one test/crawler/metadata/domains/{file}.test.js

7. VERIFY
   └── Confirm all tests pass (existing + new)
```

## Architecture

### Key Files

| File | Purpose |
|------|---------|
| `apify/metadata-crawler/src/selectors.js` | All selector definitions + extraction functions |
| `apify/metadata-crawler/src/getWebDocument.js` | HTML fetching + redirect handling |
| `apify/metadata-crawler/src/metadataFetcher.js` | Orchestrates fetching + extraction |
| `test/crawler/metadata/domains/*.crawler.test.js` | Per-domain test files |
| `test/data/metadataCrawler/*.html` | HTML fixtures for tests |

### selectors.js Structure

The file has three main sections:

**1. selectorsObj** — Maps domains to CSS selectors:
```javascript
[LINK_SPRINGER]: {
  [DOI]: ['#doi-url', 'meta[name="DOI"]', 'meta[name="doi"]'],
  [ABSTRACT]: [
    'section.Abstract[lang="en"] > p',
    'section[lang="en"] #Abs1-content > p',
    'section[data-title="About this book"] .c-book-section',
  ],
  id: LINK_SPRINGER_ID,
},
```

**2. crawlersObj** — Maps domains to extraction functions that use the selectors:
```javascript
[LINK_SPRINGER]: {
  [DOI]: [
    $ => {
      const doiUrl = $(getSelector(LINK_SPRINGER, DOI)[0]).text();
      if (!doiUrl) return null;
      const doi = getDOI(doiUrl);
      return doi || null;
    },
    $ => {
      const doi = $(getSelector(LINK_SPRINGER, DOI)[1]).attr('content');
      return doi || null;
    },
  ],
  [ABSTRACT]: [
    $ => {
      const data = $(getSelector(LINK_SPRINGER, ABSTRACT)[0]).text();
      const abstract = cleanAbstract(data);
      return abstract || null;
    },
  ],
},
```

**3. getMetadata()** — Orchestrates extraction using `any()` to try each function until one succeeds.

### Adding a New Selector

To add a fallback selector for an existing domain:

1. Add the CSS selector to `selectorsObj` (append to array)
2. Add the corresponding extraction function to `crawlersObj` (append to array)
3. The `any()` function tries each function in order until one returns data

To add a new domain:

1. Add domain + ID constants at the top of selectors.js
2. Add entry to `selectorsObj` with CSS selectors for DOI, ABSTRACT, PDF_URL
3. Add entry to `crawlersObj` with extraction functions
4. Common meta tag selectors: `META_CITATION_DOI`, `META_CITATION_ABSTRACT`, `META_PDF_URL`

### Common Selector Patterns

| Field | Common Selectors |
|-------|-----------------|
| DOI | `meta[name="citation_doi"]`, `meta[name="DOI"]`, `meta[name="doi"]`, `meta[name="dc.identifier"]` |
| Abstract | `meta[name="citation_abstract"]`, `meta[name="description"]`, `section.Abstract`, `.abstract` |
| PDF URL | `meta[name="citation_pdf_url"]`, `a[href$=".pdf"]`, `meta[name="citation_fulltext_html_url"]` |

### Important: Cheerio Case Sensitivity

Cheerio (htmlparser2) lowercases attribute **names** but preserves attribute **values**. So `meta[name="DOI"]` will NOT match `<meta name="doi" ...>`. Always check the actual case in HTML and add both variants if needed.

## Testing

### Test File Pattern

Tests live at `test/crawler/metadata/domains/{domain}.crawler.test.js`:

```javascript
global.mockFetch = global.fetch;
const fetch = jest.requireActual('node-fetch');
global.fetch = fetch;

const MetadataFetcher = require('../../../../apify/metadata-crawler/src/metadataFetcher');
const { fakeLogger, getHtmlForTest, assertAndLog, dumpJenkinsLogToFile } = require('../../../testUtils');

jest.setTimeout(60000);
const publisher = 'PublisherId';

describe(`MetadataFetcher - ${publisher}`, () => {
  const metadataFetcher = new MetadataFetcher(fakeLogger);

  afterAll(() => { global.fetch = global.mockFetch; });

  it('Test crawler for Metadata fetching. - PublisherId-Type', async () => {
    const expected = 'Expected abstract text...';
    const doi = '10.xxxx/yyyy';
    const html = await getHtmlForTest(doi, 'PublisherId-Type');
    const { abstract: actual } = await metadataFetcher.fetch('domain.com', html, doi);
    assertAndLog(
      () => { expect(actual).toBe(expected); },
      () => {
        if (process.env.JENKINS_SERVER) { dumpJenkinsLogToFile(publisher, html); }
        else { console.log(html); }
      }
    );
  });
});
```

### HTML Fixtures

- Save HTML to `test/data/metadataCrawler/{PublisherId}-{Type}.html`
- Naming convention: `LinkSpringer-Article.html`, `LinkSpringer-Book.html`, `OxfordAcademic-Article.html`
- `getHtmlForTest(doi, label)` loads the fixture by label name

### Running Tests

```bash
yarn test:one test/crawler/metadata/domains/{file}.test.js
```

### Quick Testing with Node

To quickly test selectors against HTML without running the full test suite:

```bash
node -e "
const cheerio = require('cheerio');
const fs = require('fs');
const html = fs.readFileSync('path/to/file.html', 'utf-8');
const \$ = cheerio.load(html);
console.log('DOI:', \$('meta[name=\"doi\"]').attr('content'));
console.log('Abstract:', \$('selector').text().trim().substring(0, 200));
"
```

## Permission Model

### Free to Modify
- `apify/metadata-crawler/src/selectors.js`
- `test/crawler/metadata/domains/*.crawler.test.js`
- `test/data/metadataCrawler/*.html` (fixtures)

### Ask Permission First
- `apify/metadata-crawler/src/getWebDocument.js`
- `apify/metadata-crawler/src/metadataFetcher.js`
- `apify/metadata-crawler/src/common.js`
- Any other core crawler files

## Reference

For detailed architecture and patterns, consult `references/selectors-patterns.md`.
