# Crawler Dev Plugin

Debug, fix, and verify crawlers for academic publishers.

## Skills

- **crawler-dev**: Debug and fix PDF/META crawlers in the shared package (pdf.ts/meta.ts). Triggered by URL or driver name.
- **metadata-crawler-dev**: Debug and fix Apify metadata crawler selectors (selectors.js). Triggered by DOI or mention of metadata crawler. Supports live HTML fetching and local HTML files.

## Commands

- **`/crawler-dev:metadata-crawler-release`**: Copy metadata crawler changes from guru to apify-actors, commit, and push for Apify deployment.

## Usage

### Shared package crawlers
Mention a URL or driver name to trigger the `crawler-dev` skill for pdf.ts/meta.ts work.

### Metadata crawler
Give a DOI (e.g., "test metadata for 10.1007/0-306-46801-8") or mention selectors/metadata crawler to trigger the `metadata-crawler-dev` skill for selectors.js work.

### Releasing metadata crawler
Use `/crawler-dev:metadata-crawler-release` to copy changes to apify-actors and deploy.
