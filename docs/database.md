# Database implementation

## Status

Three SQL migrations implement 16 application tables, constraints, indexes, timestamp triggers, RLS, explicit grants, and a service-role-only publication function. The UI is not connected and no hosted Supabase project has been changed.

Tests execute SQL on PostgreSQL 17 with real role switching. A disposable test bootstrap supplies a minimal auth.users table, auth.uid() claim helper, and Supabase-style API roles/default grants. This verifies PostgreSQL behaviour, not hosted authentication, JWT verification, PostgREST, or Supabase deployment configuration.

## Tables and relationships

| Area            | Tables                                      | Identity and invariants                                                            |
| --------------- | ------------------------------------------- | ---------------------------------------------------------------------------------- |
| Catalogue       | platforms, companies, questions, patterns   | UUID keys; unique slugs; platform/problem ID and platform/canonical URL uniqueness |
| Company aliases | company_aliases                             | Source-scoped case-insensitive trimmed alias uniqueness                            |
| Patterns        | question_patterns                           | One mapping per question/pattern; only reviewed mappings exposed                   |
| Provenance      | sources, source_snapshots                   | Source/revision uniqueness; separate dataset date, import time, check time         |
| Evidence        | company_question_observations               | Unique snapshot/company/question/window; source-specific frequency                 |
| Operations      | import_runs                                 | Server-only logs; snapshot must belong to run source                               |
| Collections     | sheets, sheet_items                         | Owner or server-curated sheet; question unique per sheet; section positions unique |
| Personal        | user_question_state, notes, practice_events | Owner foreign keys; one state and note per user/question                           |
| Feedback        | correction_reports                          | Reporter-owned submission; server-managed moderation                               |

Time windows: 30d, 60d, 90d, 180d, 1y, 2y, older-than-180d, all. These are source-relative windows, not live dates.

Frequency kinds: unknown (NULL only), percent (0–100), count (nonnegative whole number), score (nonnegative finite number). Missing frequency is never silently zero. Original difficulty is retained separately from optional easy/medium/hard normalization.

Deletion of a user cascades their private records and owned sheets. Deleting a sheet cascades its items. Question deletion is restricted when referenced by observations or student records. Source removal is restricted when history exists. Prefer unlisting and snapshot retirement over deleting stable identities.

## Access matrix

| Data                                   | Anonymous                                                | Signed-in student                     | Server service role |
| -------------------------------------- | -------------------------------------------------------- | ------------------------------------- | ------------------- |
| Platforms, companies, patterns         | Read                                                     | Read                                  | Manage              |
| Listed question metadata               | Read                                                     | Read                                  | Manage              |
| Approved public sources                | Read                                                     | Read                                  | Manage              |
| Published/archived snapshot provenance | Read for public sources                                  | Same                                  | Manage              |
| Current observations                   | Read for published public snapshots and listed questions | Same                                  | Manage              |
| Reviewed pattern mappings              | Read for listed questions                                | Same                                  | Manage              |
| Company aliases / import logs          | None                                                     | None                                  | Manage              |
| Public sheets and items                | Read                                                     | Read; owner may edit                  | Manage              |
| Private sheets and items               | None                                                     | Owner only                            | Manage              |
| Progress / notes                       | None                                                     | Owner CRUD                            | Manage              |
| Practice events                        | None                                                     | Owner read, insert, delete; no update | Manage              |
| Correction reports                     | None                                                     | Read own; submit own details only     | Moderate            |
| Snapshot publication                   | None                                                     | None                                  | Execute             |

A public personal sheet intentionally exposes its owner UUID and contents; notes and progress remain private. NULL sheet owner means server-curated, and clients cannot create, claim, or edit such sheets. Ownership checks apply to both old and new rows, preventing transfer to another user and movement of sheet items into someone else's sheet.

RLS is enabled on every application table. Policies alone are insufficient: migrations revoke inherited/default grants and explicitly grant each operation. The service role bypasses RLS by Supabase design and must only be used in trusted server code. Database owners also bypass RLS; tests use anon/authenticated roles rather than testing everything as postgres.

No SECURITY DEFINER functions or RLS-bypassing views are exposed. Function execution is revoked from PUBLIC and granted explicitly.

## Indexes

Composite indexes cover company/window/snapshot/frequency browsing, question/company lookup, owner sheet listings, owner revision queues, bookmarks, recent practice, and source import history. A partial unique index enforces one published snapshot per source. Title full-text search uses a GIN index. Foreign-key reverse lookup indexes support joins and deletion checks.

## Publication and rollback

1. Create a disabled source with pending reuse permission.
2. After reviewing permission and attribution, a trusted operator approves/enables the source and chooses public visibility.
3. Import a fixed revision into a staged snapshot. New questions default to unlisted.
4. Complete parser, completeness, and anomaly validation in the future importer.
5. The trusted importer marks the snapshot validated.
6. Call public.publish_source_snapshot(snapshot_uuid) as the server role.
7. Refresh affected website caches in application code after the transaction commits.

The function locks the source row to serialize publications, locks the snapshot, requires an approved/enabled/public source, rejects unvalidated or empty snapshots, archives the previous snapshot, exposes new question metadata, and publishes the target in one transaction. Repeating the active publication is a no-op. Passing an archived snapshot restores it as current.

Old snapshot provenance remains readable; old observations do not appear in the active catalogue. Previously listed question metadata remains available to preserve history. Student state is never rewritten during publication.

The service role is trusted and can bypass this workflow with direct SQL. Import code must use the function, treat published snapshot contents as immutable, and never mark a snapshot validated merely because it parsed. Automatic validation, scheduling, and cache refresh are future importer work. The database checks cannot determine whether source data is truthful or complete.

## Local Supabase workflow

Install the official Supabase CLI and run Docker. From the repository root:

```sh
supabase start
supabase migration list --local
supabase db push --local
```

supabase/config.toml uses PostgreSQL 17 and local ports 54321–54323. No fixture seed runs automatically. If these ports are occupied, choose an unused local configuration.

The test-only bootstrap MUST NOT be run against this Supabase instance. To run policy assertions against an otherwise empty local Supabase database, execute only tests/database/policies.sql using psql as the local database owner. Tests wrap fixtures in a transaction and roll back. These fixtures use fixed IDs: use an isolated development instance.

## Disposable PostgreSQL test workflow

The repository runner requires an EMPTY isolated PostgreSQL cluster without Supabase roles, a loopback host, and a database name ending in _test. It intentionally refuses an existing application database.

Create an isolated PostgreSQL 17 instance and a database such as prepyard_test, then in PowerShell:

```powershell
$env:PGHOST = '127.0.0.1'
$env:PGPORT = '55439'
$env:PGUSER = 'postgres'
$env:PGDATABASE = 'prepyard_test'
$env:PSQL_BIN = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
# Set PGPASSWORD only if your disposable instance requires authentication.
pnpm db:test
```

The runner applies the minimal test bootstrap and actual migrations, then policy/constraint assertions. It does not load .env.local, connect to hosted services, or delete a database. After a run, the cluster is no longer empty; use a fresh isolated cluster for a full replay. To rerun assertions alone on the same test database:

```powershell
& $env:PSQL_BIN -X -v ON_ERROR_STOP=1 -f tests/database/policies.sql
```

CI creates an ephemeral PostgreSQL 17 service and runs the same runner. Assertion fixtures roll back; migration schema persists only in the disposable service. Coverage includes anonymous access, cross-user SELECT/INSERT/UPDATE/DELETE, owner changes, public/private sheets, staged data, invalid values, duplicate identity, publication/rollback, and preservation of student work.

## Hosted deployment (explicit separate operation)

Review and back up the target project, confirm its project reference, and inspect the migration plan before applying. Supabase supplies auth.users, auth.uid(), anon, authenticated, and service_role; production migrations do not create them.

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --dry-run
supabase db push
```

Do not use local test bootstrap files or development fixtures in hosted migrations. Once a migration is applied/shared, add a new migration instead of rewriting it. Rollback of a source snapshot is different from reverting a database schema; do not drop tables to undo an import.

After application, generate database TypeScript types using the Supabase CLI, test policies through real authenticated API requests, then wire application clients. No service key belongs in NEXT_PUBLIC variables or a browser bundle.

References: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [migration workflow](https://supabase.com/docs/guides/local-development/database-migrations).
