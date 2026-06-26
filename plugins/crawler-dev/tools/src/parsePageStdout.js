'use strict';

// Pure parser for fetch-card-content.sh stdout.
//
// The script prints: the page JSON, a blank line, the marker line
// `---BLOCKS---`, then one block per line. Block lines may be indented
// (nested blocks) and may include non-JSON placeholder lines such as
// `[📄 Linked Page: x]`, which are filtered out.
//
// Returns a page-shaped object for parseReport: { properties, _blocks }.
function parsePageStdout(stdout) {
  const text = String(stdout || '');
  const idx = text.indexOf('---BLOCKS---');
  const pagePart = idx === -1 ? text : text.slice(0, idx);
  const blocksPart = idx === -1 ? '' : text.slice(idx + '---BLOCKS---'.length);

  let page;
  try {
    page = JSON.parse(pagePart.trim());
  } catch (e) {
    throw new Error(`page JSON was not valid: ${e.message}`);
  }

  const _blocks = blocksPart
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && l.startsWith('{'))
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean);

  return { properties: (page && page.properties) || undefined, _blocks };
}

module.exports = { parsePageStdout };
