const { parseReport } = require('../src/intake');
const fixture = require('./fixtures/report-row.json');

test('normalizes a crawler report row into a case', () => {
  const c = parseReport(fixture);
  expect(c.mode).toBe('PDF');
  expect(c.doi).toBe('10.1016/j.vaccine.2026.128659');
  expect(c.env).toBe('Production');
  expect(c.proxyUsed).toBe(false);
  expect(c.build).toBe('2d46353c99818da9c2101fda6007678c5b33ccc3');
  expect(c.publisherUrl).toBe('https://linkinghub.elsevier.com/retrieve/pii/S0264410X26004676');
  expect(c.domain).toBe('linkinghub.elsevier.com');
  expect(c.expectedPub.title).toMatch(/Neoantigen-based/);
  expect(c.slug).toBe('linkinghub.elsevier.com-pdf');
});

test('falls back to the URL field when pub.url has no publisher link', () => {
  const c = parseReport({
    properties: { URL: { url: 'https://x.org/a' }, Type: { select: { name: 'META' } } },
    _blocks: [],
  });
  expect(c.publisherUrl).toBe('https://x.org/a');
  expect(c.domain).toBe('x.org');
  expect(c.mode).toBe('META');
});

test('never throws on undefined or empty input', () => {
  const fromUndefined = parseReport(undefined);
  expect(typeof fromUndefined).toBe('object');
  expect(fromUndefined.proxyUsed).toBe(false);

  const fromEmpty = parseReport({});
  expect(typeof fromEmpty).toBe('object');
  expect(fromEmpty.proxyUsed).toBe(false);
});

test('tolerates a code block with malformed JSON rich_text', () => {
  const c = parseReport({
    properties: {},
    _blocks: [{ type: 'code', code: { rich_text: [{ plain_text: 'not json {' }] } }],
  });
  expect(c.expectedPub).toBeUndefined();
  expect(c.doi).toBeUndefined();
});
