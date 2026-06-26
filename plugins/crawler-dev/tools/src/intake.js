'use strict';

// Pure core for the Crawler Fix Loop "report-intake" step.
//
// parseReport(page) turns a Notion crawler-report row into a normalized
// "case" object consumed by downstream tasks (log-acquire, classify, triage).
//
// The input is a page shaped like { properties: {...}, _blocks: [ <block> ] }.
// Every field may be missing; this function must never throw.

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

// Join all rich_text plain_text segments, or undefined when empty.
function richText(prop) {
  const arr = prop && prop.rich_text;
  if (Array.isArray(arr) && arr.length > 0) {
    return arr.map((t) => (t && t.plain_text) || '').join('');
  }
  return undefined;
}

// Find the code block and JSON.parse its rich_text payload.
function parseCodeBlock(blocks) {
  if (!Array.isArray(blocks)) return {};
  const block = blocks.find((b) => b && b.type === 'code');
  if (!block || !block.code || !Array.isArray(block.code.rich_text)) return {};
  const text = block.code.rich_text.map((t) => (t && t.plain_text) || '').join('');
  if (!text) return {};
  try {
    return JSON.parse(text) || {};
  } catch (e) {
    return {};
  }
}

// Resolve the real publisher URL from pub.url[], preferring a non-resolver
// host; fall back to the reported URL field.
function resolvePublisherUrl(pub, fallbackUrl) {
  const urls = pub && Array.isArray(pub.url) ? pub.url : [];
  for (const u of urls) {
    if (isPublisherHost(hostOf(u))) return u;
  }
  return fallbackUrl;
}

function parseReport(page) {
  const props = (page && page.properties) || {};
  const blocks = (page && page._blocks) || [];

  const url = props.URL && props.URL.url;
  const mode = props.Type && props.Type.select && props.Type.select.name;
  const env = props.PP_ENV && props.PP_ENV.select && props.PP_ENV.select.name;
  const proxyUsed = !!(props['Proxy Used'] && props['Proxy Used'].checkbox);
  const build = richText(props['Extension Build']);
  const browser = richText(props.Browser);
  const userEmail = props['User Email'] && props['User Email'].email;

  const { pub, userId, additionalInfo } = parseCodeBlock(blocks);

  const publisherUrl = resolvePublisherUrl(pub, url);
  const domain = hostOf(publisherUrl);
  const slug = domain && mode ? `${domain}-${mode.toLowerCase()}` : undefined;

  return {
    url,
    mode,
    env,
    proxyUsed,
    build,
    browser,
    userEmail,
    doi: pub && pub.doi,
    expectedPub: pub,
    publisherUrl,
    domain,
    slug,
    userId,
    additionalInfo,
  };
}

module.exports = { parseReport };
