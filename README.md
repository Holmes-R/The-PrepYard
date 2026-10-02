# The PrepYard

Free, account-based coding interview preparation for students.

Repository: [Holmes-R/The-PrepYard](https://github.com/Holmes-R/The-PrepYard).

## Current status

Implemented: Next.js scaffold, protected routes, Google sign-in through Auth.js, six database migrations, constraints/indexes/row-level policies, internal snapshot publication, and a pinned 1Kosmos importer. Supabase Auth is removed. Email/password registration, verification, login and password reset are implemented alongside Google. The catalogue, dashboard, and notes pages remain placeholders. Hosted Google sign-in, student progress screens, automatic fetching/scheduling, and production deployment are not yet verified or completed.

All student application pages and APIs require sign-in. Only /login, /signup, /forgot-password, /verify-email, /reset-password, OAuth endpoints, and framework assets are available before login. Sources, dataset dates, and import history are hidden from student screens and database access. Google asks for credentials on its own domain; this website never asks for a Google password.

## Stack

Next.js 16 / React 19 / TypeScript, Tailwind CSS 4, Radix-based UI primitives, Lucide icons, Auth.js Google OAuth and Credentials with encrypted JWT cookie sessions, PostgreSQL through node-postgres, pnpm, and GitHub Actions. Supabase may host PostgreSQL and provide migration tooling; it no longer authenticates users. Auth.js is pinned to the installed v5 beta version.

## Setup

Use Node.js 22.12+ within Node 22 or Node 24, and pnpm 11.19.0. From the existing repository:

```powershell
Set-Location -LiteralPath 'D:\Github Repositories\The PrepYard'
pnpm install --frozen-lockfile
```

Create an ignored .env.local from .env.example only if it does not exist. Configure AUTH_URL, AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, and DATABASE_URL following [Google setup](docs/google-sign-in.md). Apply all six migrations in order and provision the restricted prepyard_web database login. Do not use a Google password or a privileged database login. Do not commit secrets. Restart with pnpm dev after configuration changes. Missing configuration disables sign-in and denies protected pages.

The Google callback URL for local development is http://localhost:3000/api/auth/callback/google. Email/password setup is described in [password authentication](docs/password-auth.md). First-time Google sign-in creates the application account.

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

Student → verified email/password or Google OAuth → Auth.js session → protected Next.js application → restricted PostgreSQL server queries.

Approved upstream data → importer → normalize/validate → stage → atomic publication → catalogue. Sources/snapshots/import logs remain internal. Progress belongs to stable question IDs and is never rewritten by imports.

private.students owns application UUIDs. Google subject identifies the account; email is never used to automatically merge users. Migration 5 preserves existing Supabase-user UUIDs and student records without automatically linking them to Google accounts. Existing saved work needs an explicitly verified account migration. Student query transactions use the authenticated permission role and a locally scoped application identity; browser clients never receive direct database credentials or use Supabase Auth/PostgREST for student data.

## Routes and folders

| Route                         | Behaviour                                           |
| ----------------------------- | --------------------------------------------------- |
| /login                        | Email/password or Continue with Google              |
| /signup                       | Create an email/password account                    |
| /api/auth/*                   | Auth.js OAuth/session endpoints                     |
| /                             | Protected home                                      |
| /companies /explore /patterns | Protected catalogue placeholders                    |
| /dashboard /notes             | Protected workspace placeholders                    |
| /sources                      | Removed; not found after sign-in                    |
| /api/health                   | Protected application liveness, not database health |

src/auth.ts configures OAuth, src/proxy.ts guards requests, src/lib/auth provides verified session helpers, and src/lib/database provides server-only PostgreSQL transactions. Supabase/migrations contains historical and current schema migrations. Scripts/import contains the pinned adapter and staging generator. Tests cover imports, auth policies, page/session access, and real PostgreSQL permissions. GitHub Actions runs application and disposable database checks.

## Deployment and next milestones

Configure production Google origins/callback URLs, AUTH_URL, server secrets, and a certificate-verified PostgreSQL connection. Apply reviewed migrations, provision the restricted login, build, and verify the actual Google callback and sign-out. The application may be hosted on a server-capable Next.js provider. Automated deployment and scheduled imports are future work.

Next: configure real Google credentials and database; connect one published company sheet; save completion/bookmarks/notes; add reviewed patterns; automate imports; then expand platforms. Preserve necessary source licensing/attribution internally. The project does not bypass paid problem access or reproduce third-party statements.

Documentation: [Google sign-in](docs/google-sign-in.md), [database](docs/database.md), [importer](docs/importer.md), [architecture](docs/architecture.md), [roadmap](docs/roadmap.md).

## Email and password accounts

Use `/signup` to create an account, confirm the emailed link, then use `/login`. `/forgot-password` sends a reset link; `/reset-password` replaces the password and invalidates existing password sessions. These are PrepYard passwords, never Gmail passwords. Existing Google accounts keep using Google; accounts are not automatically merged by email.

Apply migration `20261002000600_password_identity.sql` with your database administrator, configure `RESEND_API_KEY` and `AUTH_EMAIL_FROM` in `.env.local`, and restart the app. See [step-by-step setup and testing](docs/password-auth.md). Without email delivery configuration, registration/reset fail closed; existing verified password login and Google remain independent.
