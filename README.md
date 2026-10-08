# The PrepYard

Free, account-based coding interview preparation for students.

Repository: [Holmes-R/The-PrepYard](https://github.com/Holmes-R/The-PrepYard).

## Current status

Implemented: Next.js scaffold, protected routes, email/password authentication through Auth.js, seven database migrations, constraints/indexes/row-level policies, internal snapshot publication, and a pinned 1Kosmos importer. Supabase Auth is removed. Email/password registration, verification, login and password reset are implemented. The company directory and company question sheets are connected to PostgreSQL. The dashboard, explore, patterns, and notes pages remain placeholders. student progress screens, automatic fetching/scheduling, and production deployment are not yet verified or completed.

All student application pages and APIs require sign-in. Only /login, /signup, /forgot-password, /verify-email, /reset-password, Auth.js endpoints, and framework assets are available before login. Sources, dataset dates, and import history are hidden from student screens and database access. Login uses a separate PrepYard password.

## Stack

Next.js 16 / React 19 / TypeScript, Tailwind CSS 4, Radix-based UI primitives, Lucide icons, Auth.js Credentials with encrypted JWT cookie sessions, PostgreSQL through node-postgres, pnpm, and GitHub Actions. Supabase may host PostgreSQL and provide migration tooling; it no longer authenticates users. Auth.js is pinned to the installed v5 beta version.

## Setup

Use Node.js 22.12+ within Node 22 or Node 24, and pnpm 11.19.0. From the existing repository:

```powershell
Set-Location -LiteralPath 'D:\Github Repositories\The PrepYard'
pnpm install --frozen-lockfile
```

Create an ignored .env.local from .env.example only if it does not exist. Configure AUTH_URL, AUTH_SECRET, DATABASE_URL, RESEND_API_KEY and AUTH_EMAIL_FROM following [password setup](docs/password-auth.md). Apply all seven migrations in order and provision the restricted prepyard_web database login. Do not use a Google password or a privileged database login. Do not commit secrets. Restart with pnpm dev after configuration changes. Missing configuration disables sign-in and denies protected pages.

Email/password setup is described in [password authentication](docs/password-auth.md). Verify your email before logging in.

## Commands

| Command                 | Purpose                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------- |
| pnpm dev                | Run the development application                                                         |
| pnpm build / pnpm start | Build / serve production                                                                |
| pnpm check              | Format, lint, importer/auth tests, types, build, route/session checks                   |
| pnpm test:auth          | Verified identity and safe destination tests                                            |
| pnpm test:access        | Logged-out and encrypted-session integration checks after build                         |
| pnpm import:company     | Generate pinned 1Kosmos JSON and staging SQL, without modifying a database              |
| pnpm test:import        | Verify exact fixture values and malformed inputs                                        |
| pnpm db:test            | Run migrations and policy/identity tests on a fresh disposable local PostgreSQL cluster |

## Architecture

Student → verified email/password → Auth.js session → protected Next.js application → restricted PostgreSQL server queries.

Approved upstream data → importer → normalize/validate → stage → atomic publication → catalogue. Sources/snapshots/import logs remain internal. Progress belongs to stable question IDs and is never rewritten by imports.

private.students owns application UUIDs. Verified password identities resolve the account; email is never used to automatically merge historical users. Migration 5 preserves existing Supabase-user UUIDs and student records without automatically linking them to Google accounts. Existing saved work needs an explicitly verified account migration. Student query transactions use the authenticated permission role and a locally scoped application identity; browser clients never receive direct database credentials or use Supabase Auth/PostgREST for student data.

## Routes and folders

| Route             | Behaviour                                           |
| ----------------- | --------------------------------------------------- |
| /login            | Email and PrepYard password                         |
| /signup           | Create an email/password account                    |
| /api/auth/*       | Auth.js password/session endpoints                  |
| /                 | Protected home                                      |
| /companies        | Published company directory and question sheets     |
| /dashboard /notes | Protected workspace placeholders                    |
| /sources          | Removed; not found after sign-in                    |
| /api/health       | Protected application liveness, not database health |

src/auth.ts configures password authentication, src/proxy.ts guards requests, src/lib/auth provides verified session helpers, and src/lib/database provides server-only PostgreSQL transactions. Supabase/migrations contains historical and current schema migrations. Scripts/import contains the pinned adapter and staging generator. Tests cover imports, auth policies, page/session access, and real PostgreSQL permissions. GitHub Actions runs application and disposable database checks.

## Deployment and next milestones

Configure production AUTH_URL, server secrets, and a certificate-verified PostgreSQL connection. Apply reviewed migrations, provision the restricted login, build, and verify email delivery, login and sign-out. The application may be hosted on a server-capable Next.js provider. Automated deployment and scheduled imports are future work.

Next: configure production email delivery; save completion/bookmarks/notes; add reviewed patterns; automate imports; then expand platforms. Preserve necessary source licensing/attribution internally. The project does not bypass paid problem access or reproduce third-party statements.

Documentation: [Password authentication](docs/password-auth.md), [database](docs/database.md), [importer](docs/importer.md), [architecture](docs/architecture.md), [roadmap](docs/roadmap.md).

## Email and password accounts

Use `/signup` to create an account, confirm the emailed link, then use `/login`. `/forgot-password` sends a reset link; `/reset-password` replaces the password and invalidates existing password sessions. These are PrepYard passwords, never Gmail passwords. Legacy Google records are retained, but Google sign-in is disabled. They are not automatically merged into new password accounts.

Apply migration `20261002000600_password_identity.sql` with your database administrator, configure `RESEND_API_KEY` and `AUTH_EMAIL_FROM` in `.env.local`, and restart the app. See [step-by-step setup and testing](docs/password-auth.md). Without email delivery configuration, registration/reset fail closed; existing verified password login does not require email delivery.

## Completed fixed-snapshot importer

`pnpm import:company` imports the complete 1Kosmos fixture pinned to `a09d3bae6ecf5420ae59e8886e0f9bf660717388`: one LeetCode question and two frequency windows. It generates deterministic JSON and staging SQL without modifying your database. `pnpm test:import` checks the independently recorded expected fixture, malformed inputs, exact revision and CLI replay. `pnpm db:test` verifies exact stored values, sequential/concurrent idempotence and rollback on conflicts in an isolated database. See [importer instructions](docs/importer.md).

## Working company sheets

`/companies` now lists companies with published questions. `/companies/1kosmos` provides title search, difficulty and question-window filters, frequency sorting, ranked company tags and platform links. All access requires login; source metadata remains private. Publish the reviewed fixture with `pnpm import:publish --approve-source` using a trusted `IMPORT_DATABASE_URL`. See [company page and publication workflow](docs/company-pages.md).

## Full company directory

The Companies section now includes all 656 repository companies, expandable dark question sections, search, filters, completion tracking, bookmarks, private notes and revision scheduling. Questions are loaded on demand and company tags are frequency-sorted. `pnpm import:repository --directory PATH [--approve-source]` validates the pinned full archive and optionally publishes it using the trusted importer connection. See [company workflow](docs/company-pages.md).

## DSA topics and patterns

The authenticated `/patterns` page groups questions by standard DSA topics, with separate generic pattern filters and two attributed reference collections and a dynamic frequency shortlist. Progress, private notes, and revision history are shared across all views. For an existing database, run `scripts/patterns/publish-prepyard.sql` in Supabase SQL Editor, or follow the admin publication workflow in [the pattern guide](docs/pattern-sheet.md).

### Application appearance

The interface follows the supplied Google Stitch designs: horizontal navigation, white primary buttons, charcoal panels, mint/blue progress accents, compact company cards, dense question tables, and a mobile navigation menu. The home route opens the authenticated dashboard.

The dashboard shows real student progress, completion rate, due revisions, saved notes, collection progress, recent practice updates, and seven days of recorded revision activity. Company search supports alphabetical, question-count, and solved-count sorting. Practice offers Topics, Patterns, and Collections browsing modes. Questions keep separate Difficulty, Topics, Revision, and Notes cells; company rows also show frequency. Revision history retains the confidence selected for each event.

Notes remain private, show their content only when expanded, support deletion, and are paginated newest first. Ctrl/Cmd+K focuses the contextual quick search. See [the Stitch interface guide](docs/stitch-ui.md).

### Interface components

After signing in, open `/components` to review the reusable button variants and states, native checkboxes (including mixed state), radios, filter chips, typography, an example company question, and a compact note. Preview interactions use local state and do not write account data.

Shared components live in `src/components/ui`; control and typography tokens are defined in `src/app/control-theme.css`. Buttons use 40px regular and 32px compact sizes, with 44px mobile targets, visible keyboard focus, and a loading indicator. Inter is bundled locally with its OFL license in `src/app/fonts`, so rendering does not depend on a font service.

### Original PrepYard practice tracks

Explore and Practice offer Interview Launchpad (66 unique questions), DSA Deep Dive (282 unique questions across three platforms), and Interview Hotlist (up to 20 questions per topic ranked dynamically by reported company frequency). Old collection memberships are retired while saved progress, notes, and revisions remain. Run the generated `scripts/patterns/publish-prepyard.sql` in Supabase SQL Editor, or apply pending migrations and run `pnpm patterns:publish` with an administrative connection. See [publication](docs/pattern-sheet.md) and [reference attribution](docs/collection-attribution.md). Display names do not change reuse rights.

## Pattern roadmap

Practice exposes 22 numbered pattern groups in the learning order of the pinned DSA Patterns Roadmap. Dedicated pages prioritize its reference exercises already present in the catalogue, followed by matching verified topic tags and reviewed mappings. Existing topic browsing, explicit sorting, notes and revisions remain available. No database migration is needed for this catalogue/order change. See [roadmap matching and verification](docs/pattern-roadmap.md).
