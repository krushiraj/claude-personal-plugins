'use strict';

// Pure parser for the fetch-reports.sh (Notion DB query) response.
//
// Notion returns errors with an HTTP 200 body shaped { object: "error", ... },
// so we surface those as a thrown Error. On success we map the results to a
// minimal list of { id } rows, dropping any row without an id.
function parseReportRows(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  if (data && data.object === 'error') {
    throw new Error(data.message || 'Notion query error');
  }
  const results = (data && Array.isArray(data.results) && data.results) || [];
  return results
    .filter((r) => r && typeof r.id === 'string' && r.id)
    .map((r) => ({ id: r.id }));
}

module.exports = { parseReportRows };
