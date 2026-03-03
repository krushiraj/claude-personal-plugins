# Selectors Patterns Reference

## Complete Domain Setup Example

Here's a full example of adding support for a new domain (using Springer book pages as reference):

### Step 1: Add Domain Constants

At the top of `selectors.js`, in the publisher domain constants section:

```javascript
// newpublisher.com
const NEW_PUBLISHER = 'newpublisher.com';
const NEW_PUBLISHER_ID = 'NewPublisher';
```

### Step 2: Add to selectorsObj

```javascript
[NEW_PUBLISHER]: {
  [DOI]: 'meta[name="citation_doi"]',        // single selector
  [ABSTRACT]: '.abstract-content > p',         // single selector
  [PDF_URL]: META_PDF_URL,                     // reuse common constant
  id: NEW_PUBLISHER_ID,
},
```

For multiple fallback selectors:

```javascript
[NEW_PUBLISHER]: {
  [DOI]: ['meta[name="citation_doi"]', 'meta[name="doi"]'],
  [ABSTRACT]: ['.abstract-content > p', 'meta[name="description"]'],
  id: NEW_PUBLISHER_ID,
},
```

### Step 3: Add to crawlersObj

For simple text extraction:

```javascript
[NEW_PUBLISHER]: {
  [DOI]: $ => {
    const doi = $(getSelector(NEW_PUBLISHER, DOI)).attr('content');
    return doi || null;
  },
  [ABSTRACT]: $ => {
    const data = $(getSelector(NEW_PUBLISHER, ABSTRACT)).text();
    const abstract = cleanAbstract(data);
    return abstract || null;
  },
},
```

For multiple fallback functions (matching array selectors):

```javascript
[NEW_PUBLISHER]: {
  [DOI]: [
    $ => {
      const doi = $(getSelector(NEW_PUBLISHER, DOI)[0]).attr('content');
      return doi || null;
    },
    $ => {
      const doi = $(getSelector(NEW_PUBLISHER, DOI)[1]).attr('content');
      return doi || null;
    },
  ],
  [ABSTRACT]: [
    $ => {
      const data = $(getSelector(NEW_PUBLISHER, ABSTRACT)[0]).text();
      const abstract = cleanAbstract(data);
      return abstract || null;
    },
    $ => {
      const data = $(getSelector(NEW_PUBLISHER, ABSTRACT)[1]).attr('content');
      const abstract = cleanAbstract(data);
      return abstract || null;
    },
  ],
},
```

### Step 4: Add Test

Create `test/crawler/metadata/domains/newpublisher.crawler.test.js`:

```javascript
global.mockFetch = global.fetch;
const fetch = jest.requireActual('node-fetch');
global.fetch = fetch;

const MetadataFetcher = require('../../../../apify/metadata-crawler/src/metadataFetcher');
const { fakeLogger, getHtmlForTest, assertAndLog, dumpJenkinsLogToFile } = require('../../../testUtils');

jest.setTimeout(60000);

const publisher = 'NewPublisher';

describe(`MetadataFetcher - ${publisher}`, () => {
  const metadataFetcher = new MetadataFetcher(fakeLogger);

  afterAll(() => {
    global.fetch = global.mockFetch;
  });

  it('Test crawler for Metadata fetching. - NewPublisher-Article', async () => {
    const expected = 'The full expected abstract text goes here...';
    const doi = '10.xxxx/yyyy';
    const html = await getHtmlForTest(doi, 'NewPublisher-Article');
    const { abstract: actual } = await metadataFetcher.fetch('newpublisher.com', html, doi);
    assertAndLog(
      () => {
        expect(actual).toBe(expected);
      },
      () => {
        if (process.env.JENKINS_SERVER) {
          dumpJenkinsLogToFile(publisher, html);
        } else {
          console.log(html);
        }
      }
    );
  });
});
```

### Step 5: Save HTML Fixture

Save the publisher HTML page to `test/data/metadataCrawler/NewPublisher-Article.html`.

## Extraction Function Patterns

### Text from element

```javascript
$ => {
  const data = $(selector).text();
  const abstract = cleanAbstract(data);
  return abstract || null;
}
```

### Attribute from meta tag

```javascript
$ => {
  const value = $(selector).attr('content');
  return value || null;
}
```

### DOI from URL text

```javascript
$ => {
  const doiUrl = $(selector).text();
  if (!doiUrl) return null;
  const doi = getDOI(doiUrl);  // strips doi.org prefix etc.
  return doi || null;
}
```

### PDF URL with validation

```javascript
$ => {
  const pdfUrl = $(selector).attr('content') || $(selector).attr('href');
  if (!pdfUrl) return null;
  // Optionally validate it's a real PDF
  const isValid = await isPdfDownloadable(pdfUrl);
  return isValid ? pdfUrl : null;
}
```

### Regex from page content

```javascript
$ => {
  const html = $.root().html();
  if (!html) return null;
  const match = html.match(/somePattern=(.*?);/);
  if (!match) return null;
  return match[1] || null;
}
```

## HANDLED_BY Pattern

When one domain should use the same selectors as another:

```javascript
[SUBDOMAIN_PUBLISHER]: {
  [HANDLED_BY]: MAIN_PUBLISHER,
  id: SUBDOMAIN_PUBLISHER_ID,
},
```

## Utility Functions

- `cleanAbstract(text)` — Strips \n\t, collapses whitespace, trims
- `getDOI(url)` — Extracts DOI from a URL string
- `isPdfDownloadable(url)` — Checks if URL returns actual PDF bytes
- `getSelector(domain, field)` — Gets CSS selector(s) from selectorsObj
- `any(fns)` — Tries each function until one returns truthy

## HTML Analysis Checklist

When analyzing a publisher page for selectors:

1. **DOI**: Check these locations in order:
   - `<meta name="citation_doi" content="...">`
   - `<meta name="DOI" content="...">` or `<meta name="doi" content="...">`
   - `<meta name="dc.identifier" content="...">`
   - `<a id="doi-url">` or similar text links
   - Hidden form inputs: `<input name="doi" value="...">`

2. **Abstract**: Check these locations in order:
   - `<meta name="citation_abstract" content="...">`
   - `<meta name="description" content="...">`
   - `<section class="Abstract">` or `<div class="abstract">`
   - `<section data-title="About this book">` (books)
   - `#abstract`, `#Abs1-content`, `.abstract-text`

3. **PDF URL**: Check these locations in order:
   - `<meta name="citation_pdf_url" content="...">`
   - `<a href="...pdf">` links
   - `<meta name="citation_fulltext_html_url">` (may need rewrite to pdf)

## Troubleshooting

### Selector works in browser but not in Cheerio
- Check attribute value case sensitivity (Cheerio preserves values)
- Check if content is JavaScript-rendered (not in initial HTML)
- Check if Cheerio parsing mode matters (xmlMode, decodeEntities)

### cleanAbstract returns empty
- The selector might match but the element has no text children
- Try `.text()` on parent or child elements
- Check for `<em>`, `<strong>` etc. that contain the text (`.text()` should still get it)

### Multiple elements match selector
- `$(selector).text()` concatenates all matches — usually fine for abstracts
- `$(selector).first().text()` for just the first match
- `$(selector).attr('content')` only gets first match's attribute
