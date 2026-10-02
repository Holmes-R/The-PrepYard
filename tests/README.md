# Test strategy

The scaffold's CI checks formatting, linting, TypeScript, and a production build.

Database tests are implemented under database/: 117 SQL assertions cover privileges, RLS, ownership, constraints, snapshot publication, and rollback. See [database guide](../docs/database.md). Application-level tests remain planned:

- fixtures/: small, permission-cleared source snapshots
- unit/: normalisation, frequency sorting, and validation
- integration/: idempotent imports, publication rollback, database access policies
- e2e/: browsing, filters, guest persistence, backups, and account merges

Use Vitest for data logic and Playwright for browser flows when those features exist. Empty placeholder tests are intentionally not included.

Importer tests are implemented under import/: run `pnpm test:import` for 31 offline parser/fixture checks. The database runner also applies generated staging SQL twice and checks exact values, hidden staging, and conflict rollback.
