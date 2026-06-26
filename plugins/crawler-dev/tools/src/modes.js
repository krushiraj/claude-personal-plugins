'use strict';

// Canonical crawl-mode token.
//
// debugCrawler.ts strictly requires 'PDF' | 'META'. Notion's Type.select.name
// for metadata reports is the label "Metadata" (not "META"), so a naive
// uppercase compare maps it to 'PDF' and every metadata failure is re-crawled
// in the wrong mode. canonicalMode normalizes any "meta"-ish label to 'META'
// and everything else to 'PDF'.
function canonicalMode(raw) {
  return /^meta/i.test(String(raw == null ? '' : raw).trim()) ? 'META' : 'PDF';
}

module.exports = { canonicalMode };
