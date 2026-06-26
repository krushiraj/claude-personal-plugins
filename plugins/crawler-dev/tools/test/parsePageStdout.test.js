const { parsePageStdout } = require('../src/parsePageStdout');

// A captured-shape sample of fetch-card-content.sh stdout: page JSON, blank
// line, ---BLOCKS--- marker, then block lines incl. an indented one and a
// non-JSON placeholder line that must be filtered out.
const SAMPLE = [
  '{"object":"page","id":"abc","properties":{"URL":{"url":"https://x.org/a"},"Type":{"select":{"name":"PDF"}}}}',
  '',
  '---BLOCKS---',
  '{"type":"paragraph","paragraph":{"rich_text":[]}}',
  '  {"type":"code","code":{"rich_text":[{"plain_text":"{\\"pub\\":{\\"doi\\":\\"10.1/x\\"}}"}]}}',
  '[📄 Linked Page: Some Child]',
  '',
].join('\n');

test('splits page JSON from blocks and exposes properties', () => {
  const { properties, _blocks } = parsePageStdout(SAMPLE);
  expect(properties.URL.url).toBe('https://x.org/a');
  expect(properties.Type.select.name).toBe('PDF');
  expect(Array.isArray(_blocks)).toBe(true);
});

test('parses indented block lines and filters non-JSON placeholders', () => {
  const { _blocks } = parsePageStdout(SAMPLE);
  // paragraph + indented code block = 2; placeholder line dropped.
  expect(_blocks).toHaveLength(2);
  const code = _blocks.find((b) => b.type === 'code');
  expect(code).toBeTruthy();
  expect(JSON.parse(code.code.rich_text[0].plain_text).pub.doi).toBe('10.1/x');
});

test('throws a clear error when page JSON is not valid', () => {
  expect(() => parsePageStdout('not json\n---BLOCKS---\n')).toThrow(/page JSON/);
});
