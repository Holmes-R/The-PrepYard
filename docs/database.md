# Database implementation

## Current contract

Five tracked migrations implement 16 public application tables and the private.students identity table, constraints, indexes, RLS, internal publication, and Google-owned identity. Migration 5 removes application foreign keys to auth.users and replaces policy identity lookups with private.student_id(). Earlier files remain unchanged for already-deployed projects.

Supabase may host PostgreSQL and manage migration tooling, but the website does not use Supabase Auth or student PostgREST requests. Direct server PostgreSQL queries use Auth.js session identity. See [Google setup](google-sign-in.md) for credentials, the restricted database login, and legacy-account migration limits.

## Tables

| Area            | Tables                                                                                 | Responsibility                                          |
| --------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Catalogue       | platforms, companies, questions, patterns, question_patterns                           | Stable identities and reviewed mappings                 |
| Internal data   | sources, company_aliases, source_snapshots, company_question_observations, import_runs | Source normalization, observations, publication history |
| Sheets          | sheets, sheet_items                                                                    | Curated/personal collections and ordered questions      |
| Student records | user_question_state, notes, practice_events, correction_reports                        | Private state and reporter-owned submissions            |
| Accounts        | private.students                                                                       | Internal UUID, unique Google subject, profile metadata  |

Progress belongs to stable question IDs and survives publication. Frequency windows include 30d, 60d, 90d, 180d, 1y, 2y, older-than-180d, and all. Values represent unknown, percent, count, or score, and different kinds/windows must not be added together. Constraints reject invalid values, duplicate identities, inconsistent source/snapshot references, and unsupported windows. Indexes support catalogue filters, owner lookups, revisions, search, and one active snapshot per source.

## Access

| Data                                        | Anonymous | Signed-in student through server | Trusted maintenance |
| ------------------------------------------- | --------- | -------------------------------- | ------------------- |
| Eligible catalogue, patterns, shared sheets | None      | Read                             | Manage              |
| Frequency observations                      | None      | Explicit safe columns only       | Manage              |
| Sources, aliases, snapshots, import history | None      | None                             | Manage              |
| Notes and progress                          | None      | Owner only                       | Manage              |
| Practice events                             | None      | Owner read/insert/delete         | Manage              |
| Correction reports                          | None      | Own submissions; no moderation   | Moderate            |
| private.students                            | None      | No direct table access           | Manage              |
| Snapshot publication                        | None      | None                             | Execute             |

Owner-scoped policies apply to reads and writes, including ownership changes and moving sheet items. Student clients cannot claim curated sheets or modify the catalogue. Allowed observation columns are company_id, question_id, time_window, frequency, frequency_kind, and acceptance_percent. Never use select * on observations as a student.

The prepyard_web role is NOINHERIT, non-superuser, and cannot bypass RLS. It can resolve a verified Google identity through one private function. Ordinary queries use withStudentDatabase: the server derives the user from the verified session, starts a transaction, switches to the authenticated database permission role, sets a transaction-local identity, and commits/rolls back before releasing the connection. Identity from URL/form/header data is never trusted. Two narrowly scoped SECURITY DEFINER functions operate inside the private schema for eligibility checks and verified account registration; their execute privileges are explicit.

## Legacy accounts

Migration 5 copies existing Supabase user UUIDs into private.students and reattaches their records. It does not alter Supabase-managed auth objects or merge Google accounts by email. Saved work is preserved but needs an explicit verified ownership migration to attach it to a new Google login. Google subject is the stable identity; a changed email retains the account, and matching emails never automatically merge different subjects.

## Publication

Stage a fixed, approved source revision, verify parser/completeness/anomaly checks, mark the snapshot validated, and invoke publish_source_snapshot using trusted maintenance access. Publication serializes per source, exposes eligible new questions, and archives the previous snapshot in one transaction. Failed imports preserve the active catalogue. Publishing an archived snapshot restores it; student data is never rewritten. Source is_public remains an internal catalogue-eligibility flag, not permission to expose provenance to students.

## Migration deployment

With the Supabase CLI installed, confirm the project reference and inspect the plan:

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --dry-run
supabase db push
```

Provision prepyard_web with a strong private login password and configure DATABASE_URL as documented in google-sign-in.md. The website rejects postgres/service_role connections. Hosted connections must verify TLS certificates. New database changes belong in new migrations; do not rewrite previously applied migration files.

Historical migrations expect Supabase-provided roles/auth objects. A fresh plain PostgreSQL production deployment needs a separate proper initialization plan; do not use the disposable test bootstrap in production. Local Supabase remains an optional development database, while Google still handles application sign-in.

## Disposable tests

Use a fresh isolated PostgreSQL 17 cluster without Supabase roles and an empty database whose name ends in _test. Never point this runner at an existing application or hosted database.

```powershell
$env:PGHOST = '127.0.0.1'
$env:PGPORT = 'YOUR_DISPOSABLE_PORT'
$env:PGUSER = 'postgres'
$env:PGDATABASE = 'prepyard_test'
$env:PSQL_BIN = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
pnpm db:test
```

The runner applies the test-only auth shim, tests the historical policies/importer at migration 3, tests membership at migration 4, inserts a legacy preservation fixture, applies migration 5, then tests the current Google identity/ownership contract and transaction cleanup. It does not load .env.local, access a hosted database, or drop a database. Use a fresh disposable cluster for a full repeat. Do not run the historical policies.sql against the final schema: it deliberately expects the older contract. CI uses its own ephemeral PostgreSQL 17 service.

Coverage includes constraints, exact fixture data, repeated staging, rollback, publication, anonymous denial, metadata hiding, stable Google identity, legacy notes, foreign-key migration, cross-user private records, and cleared transaction-local identity. Live Google consent and hosted connections require separate verification with real configuration.
