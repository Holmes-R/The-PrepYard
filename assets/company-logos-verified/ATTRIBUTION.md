# Verified company icons

These website icons were matched to the employers in the catalogue. Every file has a company slug, retrieval URL, website, evidence and SHA-256 checksum in `manifest.json`. Sources include company websites and public Google/DuckDuckGo favicon caches. These are company brand assets; no blanket public-domain licence is assumed. Three JPEG icons were converted to PNG; their original hashes are retained.

This folder is separate from the Simple Icons artwork so refreshing that package cannot delete the reviewed icons. Run `pnpm logos:publish-reviewed` with `IMPORT_DATABASE_URL` to publish idempotently. Original supplied artwork takes precedence. Unresolved entries are listed in `scripts/logos/coverage.json`.
