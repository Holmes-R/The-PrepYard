# First company importer

Implemented: a fixed-snapshot adapter for 1Kosmos from cs-satyam/leetcode-companywise-questions.

Run from the project root:

```sh
pnpm import:company
pnpm test:import
```

The importer reads the checked-in, SHA-256-verified fixture offline. It writes artifacts/imports/1kosmos/snapshot.json and stage.sql. It never connects to a database, fetches a moving branch, or publishes data.

To choose another output directory:

```sh
pnpm import:company --out artifacts/imports/review
```

Review stage.sql, apply database migrations first, and then apply it to an explicitly selected development database:

```powershell
# Configure PGHOST, PGPORT, PGUSER, PGDATABASE for your intended development DB.
psql -X -v ON_ERROR_STOP=1 -f artifacts/imports/1kosmos/stage.sql
```

This is a real transactional staging import: one platform, company, source, snapshot, question, and two observations. It is safe to repeat while the snapshot remains staged. Matching records are reused; conflicting identities/values abort and roll back. It refuses validated/published/archived snapshots. Source approval, anomaly validation, publication, and scheduling remain separate later steps.

See [importer guide](../../docs/importer.md) and [fixture provenance](../../tests/fixtures/cs-satyam/1kosmos/README.md).
