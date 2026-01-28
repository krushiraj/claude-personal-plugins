#!/bin/bash
# Fetch a single card's content from Notion API
# Usage: fetch-card-content.sh <token> <page_id>

set -e

TOKEN="$1"
PAGE_ID="$2"

if [ -z "$TOKEN" ] || [ -z "$PAGE_ID" ]; then
  echo "Usage: fetch-card-content.sh <token> <page_id>" >&2
  exit 1
fi

# Fetch page properties
curl -s -X GET "https://api.notion.com/v1/pages/${PAGE_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Notion-Version: 2022-06-28"

echo "---BLOCKS---"

# Fetch page content (blocks)
curl -s -X GET "https://api.notion.com/v1/blocks/${PAGE_ID}/children?page_size=100" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Notion-Version: 2022-06-28"
