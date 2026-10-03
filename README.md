# The PrepYard

Free, account-based coding interview preparation for students.

Repository: [Holmes-R/The-PrepYard](https://github.com/Holmes-R/The-PrepYard).

## Current status

Implemented: Next.js scaffold, protected routes, email/password authentication through Auth.js, seven database migrations, constraints/indexes/row-level policies, internal snapshot publication, and a pinned 1Kosmos importer. Supabase Auth is removed. Email/password registration, verification, login and password reset are implemented. The catalogue, dashboard, and notes pages remain placeholders. student progress screens, automatic fetching/scheduling, and production deployment are not yet verified or completed.

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

| Route                         | Behaviour                                           |
| ----------------------------- | --------------------------------------------------- |
| /login                        | Email and PrepYard password                         |
| /signup                       | Create an email/password account                    |
| /api/auth/*                   | Auth.js password/session endpoints                  |
| /                             | Protected home                                      |
| /companies /explore /patterns | Protected catalogue placeholders                    |
| /dashboard /notes             | Protected workspace placeholders                    |
| /sources                      | Removed; not found after sign-in                    |
| /api/health                   | Protected application liveness, not database health |

src/auth.ts configures password authentication, src/proxy.ts guards requests, src/lib/auth provides verified session helpers, and src/lib/database provides server-only PostgreSQL transactions. Supabase/migrations contains historical and current schema migrations. Scripts/import contains the pinned adapter and staging generator. Tests cover imports, auth policies, page/session access, and real PostgreSQL permissions. GitHub Actions runs application and disposable database checks.

## Deployment and next milestones

Configure production AUTH_URL, server secrets, and a certificate-verified PostgreSQL connection. Apply reviewed migrations, provision the restricted login, build, and verify email delivery, login and sign-out. The application may be hosted on a server-capable Next.js provider. Automated deployment and scheduled imports are future work.

Next: configure email delivery and database; connect one published company sheet; save completion/bookmarks/notes; add reviewed patterns; automate imports; then expand platforms. Preserve necessary source licensing/attribution internally. The project does not bypass paid problem access or reproduce third-party statements.

Documentation: [Password authentication](docs/password-auth.md), [database](docs/database.md), [importer](docs/importer.md), [architecture](docs/architecture.md), [roadmap](docs/roadmap.md).

## Email and password accounts

Use `/signup` to create an account, confirm the emailed link, then use `/login`. `/forgot-password` sends a reset link; `/reset-password` replaces the password and invalidates existing password sessions. These are PrepYard passwords, never Gmail passwords. Legacy Google records are retained, but Google sign-in is disabled. They are not automatically merged into new password accounts.

Apply migration `20261002000600_password_identity.sql` with your database administrator, configure `RESEND_API_KEY` and `AUTH_EMAIL_FROM` in `.env.local`, and restart the app. See [step-by-step setup and testing](docs/password-auth.md). Without email delivery configuration, registration/reset fail closed; existing verified password login does not require email delivery.

## Completed fixed-snapshot importer

`pnpm import:company` imports the complete 1Kosmos fixture pinned to `a09d3bae6ecf5420ae59e8886e0f9bf660717388`: one LeetCode question and two frequency windows. It generates deterministic JSON and staging SQL without modifying your database. `pnpm test:import` checks the independently recorded expected fixture, malformed inputs, exact revision and CLI replay. `pnpm db:test` verifies exact stored values, sequential/concurrent idempotence and rollback on conflicts in an isolated database. See [importer instructions](docs/importer.md).
