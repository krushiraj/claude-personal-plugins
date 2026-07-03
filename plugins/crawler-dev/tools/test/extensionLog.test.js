'use strict';

const {
  parseExtensionLog,
  extensionVerdict,
  parseLogFilename,
} = require('../src/extensionLog');

// Trimmed copy of a REAL extension pdf-crawl-log upload (karger.com,
// CRAWLER_FAILED): structure is real, collectedLogs bodies truncated.
const fixture = require('./fixtures/extension-log.json');

describe('parseExtensionLog', () => {
  test('normalizes a real pdf-crawl-log into a case', () => {
    const c = parseExtensionLog(fixture);
    expect(c.mode).toBe('PDF');
    expect(c.doi).toBe('10.1159/000347069');
    expect(c.title).toMatch(/Anterior choroidal artery/);
    expect(c.errorMsg).toBe('CRAWLER_FAILED');
    expect(c.blockedUrl).toBeNull();
    expect(c.source).toBe('webapp');
    // first inputUrls.publisher entry with a real publisher host
    expect(c.publisherUrl).toBe('https://www.karger.com/Article/Pdf/347069');
    expect(c.domain).toBe('www.karger.com');
    expect(c.slug).toBe('www.karger.com-pdf');
    // last processedUrls entry = the final URL the crawl reached
    expect(c.finalUrl).toBe('https://karger.com/article/doi/10.1159/000347069');
  });

  test('carries meta (userId/reportedAt/sourceFile) onto the case', () => {
    const c = parseExtensionLog(fixture, {
      userId: '37CF486C062F11E5AF7A2FE6BF9F7527',
      reportedAt: '2026-06-24T12:03:29Z',
      sourceFile: '/x/y.json',
    });
    expect(c.userId).toBe('37CF486C062F11E5AF7A2FE6BF9F7527');
    expect(c.reportedAt).toBe('2026-06-24T12:03:29Z');
    expect(c.sourceFile).toBe('/x/y.json');
  });

  test('skips doi.org/ncbi publisher entries, falls back to LAST processedUrls', () => {
    const c = parseExtensionLog({
      inputUrls: { publisher: ['http://dx.doi.org/10.1/x', 'https://www.ncbi.nlm.nih.gov/pubmed/1'] },
      processedUrls: ['http://dx.doi.org/10.1/x', 'https://publisher.example.org/article/1'],
    });
    expect(c.publisherUrl).toBe('https://publisher.example.org/article/1');
    expect(c.domain).toBe('publisher.example.org');
  });

  test('falls back to first pubUrls when there are no publisher inputs or processedUrls', () => {
    const c = parseExtensionLog({
      pubUrls: ['http://dx.doi.org/10.1/x', 'https://www.example.org/a'],
    });
    expect(c.publisherUrl).toBe('http://dx.doi.org/10.1/x');
    expect(c.domain).toBe('dx.doi.org');
    expect(c.finalUrl).toBeUndefined();
  });

  test('never throws on missing/garbage input', () => {
    expect(() => parseExtensionLog(undefined)).not.toThrow();
    expect(() => parseExtensionLog(null, null)).not.toThrow();
    expect(() => parseExtensionLog({}, {})).not.toThrow();
    expect(() => parseExtensionLog({ inputUrls: 'nope', processedUrls: 42 })).not.toThrow();
    const c = parseExtensionLog({});
    expect(c.mode).toBe('PDF');
    expect(c.publisherUrl).toBeUndefined();
    expect(c.slug).toBeUndefined();
  });
});

describe('extensionVerdict', () => {
  test('maps the extension error codes to taxonomy classes', () => {
    expect(extensionVerdict('ACCESS_RESTRICTED')).toBe('access-restricted');
    expect(extensionVerdict('PROXY_LOGGED_OUT')).toBe('proxy-logged-out');
    expect(extensionVerdict('BLOCKED')).toBe('blocked-paywall');
    expect(extensionVerdict('SITE_NOT_SUPPORTED')).toBe('site-not-supported');
  });

  test('CRAWLER_FAILED and null/unknown need deeper classification -> null', () => {
    expect(extensionVerdict('CRAWLER_FAILED')).toBeNull();
    expect(extensionVerdict(null)).toBeNull();
    expect(extensionVerdict(undefined)).toBeNull();
    expect(extensionVerdict('SOMETHING_ELSE')).toBeNull();
    expect(extensionVerdict('toString')).toBeNull(); // prototype key is not a verdict
  });
});

describe('parseLogFilename', () => {
  test('parses userId + timestamp from the ops export name', () => {
    const m = parseLogFilename('37CF486C062F11E5AF7A2FE6BF9F7527_pdf-crawl-log_20260624T120329Z.json');
    expect(m).toEqual({
      userId: '37CF486C062F11E5AF7A2FE6BF9F7527',
      reportedAt: '2026-06-24T12:03:29Z',
    });
  });

  test('accepts a full path (uses the basename)', () => {
    const m = parseLogFilename('/a/b/USER1_pdf-crawl-log_20260101T000000Z.json');
    expect(m.userId).toBe('USER1');
    expect(m.reportedAt).toBe('2026-01-01T00:00:00Z');
  });

  test('non-matching names -> null (never throws)', () => {
    expect(parseLogFilename('random.json')).toBeNull();
    expect(parseLogFilename('')).toBeNull();
    expect(parseLogFilename(undefined)).toBeNull();
  });
});
