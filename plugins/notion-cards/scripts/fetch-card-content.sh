#!/bin/bash
# Fetch a single card's content from Notion API with recursive block fetching
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

echo ""
echo "---BLOCKS---"

# Function to fetch blocks recursively
fetch_blocks() {
  local block_id="$1"
  local indent="$2"

  local response=$(curl -s -X GET "https://api.notion.com/v1/blocks/${block_id}/children?page_size=100" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Notion-Version: 2022-06-28")

  echo "$response" | jq -c '.results[]' 2>/dev/null | while read -r block; do
    block_type=$(echo "$block" | jq -r '.type')
    block_id=$(echo "$block" | jq -r '.id')
    has_children=$(echo "$block" | jq -r '.has_children')

    # For child_page, child_database, link_to_page - just output placeholder
    case "$block_type" in
      child_page)
        title=$(echo "$block" | jq -r '.child_page.title // "Untitled"')
        echo "${indent}[📄 Linked Page: ${title}]"
        ;;
      child_database)
        title=$(echo "$block" | jq -r '.child_database.title // "Untitled"')
        echo "${indent}[📊 Linked Database: ${title}]"
        ;;
      link_to_page)
        echo "${indent}[🔗 Link to Page]"
        ;;
      *)
        # Output the block
        echo "${indent}${block}"

        # Recursively fetch children if present
        if [ "$has_children" = "true" ]; then
          fetch_blocks "$block_id" "${indent}  "
        fi
        ;;
    esac
  done
}

# Start recursive fetch from the page
fetch_blocks "$PAGE_ID" ""
