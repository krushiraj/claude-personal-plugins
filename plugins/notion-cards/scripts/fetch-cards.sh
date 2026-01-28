#!/bin/bash
# Fetch cards from Notion API
# Usage: fetch-cards.sh <token> <database_id> <owner_uuid> [status_filter]

set -e

TOKEN="$1"
DATABASE_ID="$2"
OWNER_UUID="$3"
STATUS_FILTER="$4"

if [ -z "$TOKEN" ] || [ -z "$DATABASE_ID" ] || [ -z "$OWNER_UUID" ]; then
  echo "Usage: fetch-cards.sh <token> <database_id> <owner_uuid> [status_filter]" >&2
  exit 1
fi

# Build filter based on status
if [ -n "$STATUS_FILTER" ]; then
  FILTER=$(cat <<EOF
{
  "and": [
    {"property": "Owner", "people": {"contains": "$OWNER_UUID"}},
    {"property": "Status", "status": {"equals": "$STATUS_FILTER"}}
  ]
}
EOF
)
else
  FILTER=$(cat <<EOF
{
  "and": [
    {"property": "Owner", "people": {"contains": "$OWNER_UUID"}},
    {"property": "Status", "status": {"does_not_equal": "Done"}},
    {"property": "Status", "status": {"does_not_equal": "Triage"}}
  ]
}
EOF
)
fi

curl -s -X POST "https://api.notion.com/v1/databases/${DATABASE_ID}/query" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Notion-Version: 2022-06-28" \
  -H "Content-Type: application/json" \
  -d "{\"filter\": $FILTER, \"page_size\": 100}"
