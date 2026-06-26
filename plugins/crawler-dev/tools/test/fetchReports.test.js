const { parseReportRows } = require('../src/fetchReports');

test('maps Notion query results to { id } rows', () => {
  const json = {
    object: 'list',
    results: [
      { id: 'aaa', properties: {} },
      { id: 'bbb', properties: {} },
    ],
  };
  expect(parseReportRows(json)).toEqual([{ id: 'aaa' }, { id: 'bbb' }]);
});

test('accepts a JSON string and drops rows without an id', () => {
  const json = JSON.stringify({ results: [{ id: 'aaa' }, { properties: {} }, { id: '' }] });
  expect(parseReportRows(json)).toEqual([{ id: 'aaa' }]);
});

test('returns [] when results is missing', () => {
  expect(parseReportRows({ object: 'list' })).toEqual([]);
});

test('throws a clear error on a Notion error body', () => {
  const json = { object: 'error', code: 'validation_error', message: 'bad filter' };
  expect(() => parseReportRows(json)).toThrow(/bad filter/);
});
