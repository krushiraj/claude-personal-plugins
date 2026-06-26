const { clusterCases, renderBoard } = require('../src/triage');

test('clusters by domain + errorClass, sorted by count', () => {
  const cases = [
    { domain: 'a.com', mode: 'PDF', diagnosis: { errorClass: 'referer-required' } },
    { domain: 'a.com', mode: 'PDF', diagnosis: { errorClass: 'referer-required' } },
    { domain: 'b.com', mode: 'META', diagnosis: { errorClass: 'selector-drift' } },
  ];
  const clusters = clusterCases(cases);
  expect(clusters[0].count).toBe(2);
  expect(clusters.find(c => c.key === 'a.com|referer-required').count).toBe(2);
  expect(clusters.find(c => c.key === 'b.com|selector-drift').count).toBe(1);
  const md = renderBoard(clusters);
  expect(md).toMatch(/a\.com/);
  expect(md).toMatch(/referer-required/);
});

test('handles missing domain/diagnosis without throwing', () => {
  expect(() => clusterCases([{}, { diagnosis: {} }])).not.toThrow();
  const clusters = clusterCases([{}]);
  expect(clusters[0].key).toBe('unknown|unknown');
});

test('ties broken alphabetically by key', () => {
  const cases = [
    { domain: 'z.com', diagnosis: { errorClass: 'network' } },
    { domain: 'a.com', diagnosis: { errorClass: 'network' } },
  ];
  const clusters = clusterCases(cases);
  expect(clusters[0].key).toBe('a.com|network');
  expect(clusters[1].key).toBe('z.com|network');
});

test('renderBoard shows totals and an example identifier', () => {
  const cases = [
    { domain: 'a.com', mode: 'PDF', url: 'https://a.com/x.pdf', diagnosis: { errorClass: 'referer-required' } },
    { domain: 'b.com', mode: 'META', doi: '10.1/xyz', diagnosis: { errorClass: 'selector-drift' } },
  ];
  const md = renderBoard(clusterCases(cases));
  expect(md).toMatch(/2 cases/);
  expect(md).toMatch(/2 clusters/);
  // an example identifier from each cluster appears in the table
  expect(md).toMatch(/a\.com\/x\.pdf/);
  expect(md).toMatch(/10\.1\/xyz/);
});

test('renderBoard handles empty clusters without throwing', () => {
  expect(() => renderBoard([])).not.toThrow();
  const md = renderBoard([]);
  expect(md).toMatch(/0 cases/);
});

test('renderBoard lists every cluster member folder + an obtainable/evidence hint', () => {
  const diagnosis = {
    errorClass: 'referer-required',
    obtainable: { pdf: false, doi: null, abstract: null },
    evidence: '403 on .pdf',
  };
  const cases = [
    { folder: '2026-06-26-a.com-pdf-1111', domain: 'a.com', mode: 'PDF', diagnosis },
    { folder: '2026-06-26-a.com-pdf-2222', domain: 'a.com', mode: 'PDF', diagnosis },
  ];
  const md = renderBoard(clusterCases(cases));
  // every member folder is listed so the user can act on the whole cluster
  expect(md).toMatch(/2026-06-26-a\.com-pdf-1111/);
  expect(md).toMatch(/2026-06-26-a\.com-pdf-2222/);
  // compact diagnosis hints surfaced
  expect(md).toMatch(/pdf:false/);
  expect(md).toMatch(/403 on \.pdf/);
});
