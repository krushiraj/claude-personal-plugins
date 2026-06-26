const { classify } = require('../src/classify');
const fs = require('fs');
const read = (f) => fs.readFileSync(`${__dirname}/fixtures/${f}`, 'utf8');

test('BLOCKED with blockedUrl and proxy off -> proxy-needed', () => {
  const r = classify(read('log-blocked.txt'), { mode: 'PDF', proxyUsed: false });
  expect(['proxy-needed', 'blocked-paywall']).toContain(r.errorClass);
  expect(r.errorClass).toBe('proxy-needed');
  expect(r.evidence).toMatch(/BLOCKED|sciencedirect/i);
});

test('BLOCKED with proxy ON -> blocked-paywall', () => {
  expect(
    classify(read('log-blocked.txt'), { mode: 'PDF', proxyUsed: true }).errorClass
  ).toBe('blocked-paywall');
});

test('BLOCKED with proxyUsed unknown -> blocked-paywall (conservative)', () => {
  expect(classify(read('log-blocked.txt'), { mode: 'PDF' }).errorClass).toBe(
    'blocked-paywall'
  );
});

test('fetch aborted -> network', () => {
  expect(classify(read('log-network.txt'), { mode: 'PDF' }).errorClass).toBe(
    'network'
  );
});

test('page loaded but no pdf url -> selector-drift', () => {
  const r = classify(read('log-jqmeta-empty.txt'), { mode: 'PDF' });
  expect(r.errorClass).toBe('selector-drift');
  expect(r.evidence).toMatch(/JqMeta|citation_pdf_url/i);
});

test('Result Pub present -> success', () => {
  const r = classify(read('log-success-meta.txt'), { mode: 'META' });
  expect(r.errorClass).toBe('success');
  expect(r.obtainable.doi).toBe(true);
});

test('Result PDF present -> success with obtainable.pdf true', () => {
  const r = classify('Result PDF: /tmp/out/foo.pdf', { mode: 'PDF' });
  expect(r.errorClass).toBe('success');
  expect(r.obtainable.pdf).toBe(true);
});

test('403 on a .pdf fetch -> referer-required', () => {
  const log = [
    'Crawling https://pubs.example.org/doi/10.1/x in PDF mode',
    "CrawlerLogging:",
    " { type: 'log', message: 'FETCH_FAILED: HTTP 403 for https://pubs.example.org/doi/pdf/10.1/x.pdf', level: 'error' }",
    "Crawler failed: { errors: [ 'CRAWLER_FAILED' ], blockedUrl: null }",
  ].join('\n');
  expect(classify(log, { mode: 'PDF' }).errorClass).toBe('referer-required');
});

test('JS / SPA shell indication -> js-rendered', () => {
  const log = [
    'Crawling https://osf.io/preprints/psyarxiv/abcd in PDF mode',
    "CrawlerLogging:",
    " { type: 'log', message: 'Fetched 200 OK; body is Angular SPA shell <ds-app></ds-app>, no meta tags', level: 'warn' }",
    "Crawler failed: { errors: [ 'CRAWLER_FAILED' ], blockedUrl: null }",
  ].join('\n');
  expect(classify(log, { mode: 'PDF' }).errorClass).toBe('js-rendered');
});

test('DOI target resolution failure -> doi-resolution-fail', () => {
  const log = [
    'Crawling https://doi.org/10.1/x in META mode',
    "CrawlerLogging:",
    " { type: 'log', message: 'Doi target failed: CrossRef returned no record for 10.1/x', level: 'error' }",
  ].join('\n');
  expect(classify(log, { mode: 'META' }).errorClass).toBe('doi-resolution-fail');
});

test('Anubis proof-of-work block -> blocked-paywall', () => {
  const log =
    "Crawler failed: { errors: [ 'BLOCKED' ], blockedUrl: 'https://journals.openedition.org/x' }";
  expect(classify(log, { mode: 'PDF', proxyUsed: true }).errorClass).toBe(
    'blocked-paywall'
  );
});

test('shape: always returns the documented keys', () => {
  const r = classify(read('log-network.txt'), { mode: 'PDF' });
  expect(r).toHaveProperty('errorClass');
  expect(r).toHaveProperty('siteKind');
  expect(r).toHaveProperty('obtainable.pdf');
  expect(r).toHaveProperty('obtainable.doi');
  expect(r).toHaveProperty('obtainable.abstract');
  expect(r).toHaveProperty('evidence');
});

test('never throws on empty/garbage', () => {
  expect(() => classify('', {})).not.toThrow();
  expect(() => classify(null, null)).not.toThrow();
  expect(() => classify(undefined)).not.toThrow();
  expect(classify('', {}).errorClass).toBe('unknown');
  expect(classify('random noise with no markers', {}).errorClass).toBe('unknown');
});
