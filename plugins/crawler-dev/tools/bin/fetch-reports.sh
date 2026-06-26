#!/bin/bash
# Query the crawler-reports Notion DB by Status.
# Usage: fetch-reports.sh <token> <database_id> [status]
# Prints the raw JSON response from the Notion query API.
#
# NOTE: the reports DB "Status" property is a `select` (not a `status`)
# property, so the filter uses `select`/`equals`.

set -e

TOKEN="$1"
DATABASE_ID="$2"
STATUS="${3:-New}"

if [ -z "$TOKEN" ] || [ -z "$DATABASE_ID" ]; then
  echo "Usage: fetch-reports.sh <token> <database_id> [status]" >&2
  exit 1
fi

curl -s -X POST "https://api.notion.com/v1/databases/${DATABASE_ID}/query" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Notion-Version: 2022-06-28" \
  -H "Content-Type: application/json" \
  -d "{\"filter\": {\"property\": \"Status\", \"status\": {\"equals\": \"${STATUS}\"}}, \"page_size\": 100}"
