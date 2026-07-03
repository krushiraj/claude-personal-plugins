'use strict';

// Shared URL helpers for intake-style parsers (Notion reports + extension
// crawl logs). Pure; extracted from src/intake.js so both consumers agree on
// what counts as a "real publisher" host.

// Hosts that are NOT the real publisher (resolver / index links).
function isPublisherHost(host) {
  if (!host) return false;
  if (host.endsWith('doi.org')) return false;
  if (host.includes('ncbi.nlm.nih.gov')) return false;
  return true;
}

function hostOf(url) {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch (e) {
    return undefined;
  }
}

module.exports = { isPublisherHost, hostOf };
