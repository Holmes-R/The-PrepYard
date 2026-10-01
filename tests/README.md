# Test strategy

The scaffold's CI checks formatting, linting, TypeScript, and a production build.

Add executable tests with the first functional milestone:

- fixtures/: small, permission-cleared source snapshots
- unit/: normalisation, frequency sorting, and validation
- integration/: idempotent imports, publication rollback, database access policies
- e2e/: browsing, filters, guest persistence, backups, and account merges

Use Vitest for data logic and Playwright for browser flows when those features exist. Empty placeholder tests are intentionally not included.
