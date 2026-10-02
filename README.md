# The PrepYard

Free, multi-platform coding interview preparation for students.

Repository: [Holmes-R/The-PrepYard](https://github.com/Holmes-R/The-PrepYard)

## Current milestone: first fixed-snapshot importer

This repository contains a runnable application scaffold and a tested database foundation. The frontend remains a placeholder; no hosted database has been changed.

**Implemented**

- Next.js App Router, React, strict TypeScript, and the `@/*` source alias.
- Tailwind CSS, system light/dark themes, Lucide icons, and shadcn/ui configuration.
- A responsive home page, navigation, skip link, reusable button, and section placeholders.
- Public routes that run without accounts or environment secrets.
- A health endpoint, ESLint, Prettier, type checking, and a production-build CI workflow.
- Directories and documentation for future database, progress, import, and test work.
- A pnpm lockfile for reproducible dependency installation.
- Four Supabase migrations with 16 tables, constraints, indexes, row-level policies, and atomic snapshot publication.
- A disposable PostgreSQL integration runner with 117 policy/constraint assertions and a database CI job.
- A checksum-pinned 1Kosmos importer with exact fixture tests and idempotent transactional SQL staging.

**Not implemented yet**
Live website questions, automated source fetching, scheduled updates, search/filtering, catalogue persistence, notes storage, account sync, and admin operations. Placeholder pages say this explicitly. The health endpoint requires sign-in and reports application liveness only.

## Technology

| Area            | Scaffold                                                              |
| --------------- | --------------------------------------------------------------------- |
| Application     | Next.js 16, React 19, TypeScript 5                                    |
| Styling         | Tailwind CSS 4, CSS theme variables                                   |
| UI foundation   | shadcn/ui configuration, Radix Slot, class-variance-authority, Lucide |
| Quality         | ESLint, Prettier, Next.js route type generation, TypeScript           |
| Package manager | pnpm 11.19.0, pinned in package.json                                  |
| Automation      | GitHub Actions CI                                                     |

Supabase Auth clients are installed for required accounts. Planned additions: TanStack Table, Papa Parse, Zod, Vitest, and Playwright. They will be installed when their features are implemented; new dependencies will be added as needed.

## Prerequisites

- Node.js 22.12+ (Node 22) or Node.js 24 LTS.
- pnpm 11.19.0.
- Git when using a repository checkout.

If pnpm is missing, install the pinned version:

```powershell
npm install --global pnpm@11.19.0
```

## Local setup on Windows

```powershell
Set-Location -LiteralPath 'D:\Github Repositories\The PrepYard'
pnpm install --frozen-lockfile
pnpm dev
```

If PowerShell blocks package-manager scripts, use `pnpm.cmd` instead of changing execution policy.

Open [http://localhost:3000](http://localhost:3000).

No credentials are required for the scaffold. When service integration begins, create an ignored local environment file:

```powershell
Copy-Item -LiteralPath .env.example -Destination .env.local
```

Do not overwrite an existing `.env.local` containing your credentials.

## Commands

| Command             | Purpose                                               |
| ------------------- | ----------------------------------------------------- |
| `pnpm dev`          | Start the development server                          |
| `pnpm build`        | Create a production build                             |
| `pnpm start`        | Serve an existing production build                    |
| `pnpm lint`         | Run ESLint                                            |
| `pnpm typecheck`    | Generate Next.js route types and run TypeScript       |
| `pnpm format`       | Format source and documentation                       |
| `pnpm format:check` | Check formatting without changing files               |
| `pnpm check`        | Formatting, lint, type checking, and production build |

Run `pnpm import:company` to generate the first company snapshot and staging SQL; `pnpm test:import` checks fixture fidelity offline. See [importer guide](docs/importer.md).

For the separate database checks, run `pnpm db:test` after following [database test setup](docs/database.md). The database job does not require application dependencies.

For a production smoke check, run `pnpm build`, then `pnpm start`, and open the website and `/api/health`.

## Routes

| Route         | Current behaviour                         |
| ------------- | ----------------------------------------- |
| `/`           | Project landing page                      |
| `/explore`    | Question catalogue placeholder            |
| `/companies`  | Company directory placeholder             |
| `/patterns`   | Pattern learning placeholder              |
| `/dashboard`  | Guest workspace placeholder               |
| `/notes`      | Notes placeholder                         |
| `/sources`    | Removed; sign-in required, then not found |
| `/about`      | Mission and scope                         |
| `/api/health` | JSON application liveness response        |

The `(public)` and `(workspace)` route groups organise files and do not appear in URLs. Both groups require sign-in through server layouts and the application proxy. Administrative features still require separate server-side authorization.

## Directory structure

```text
.github/workflows/ci.yml       Quality checks on pull requests and main/master pushes
docs/
  architecture.md             Components, data boundaries, and security principles
  roadmap.md                  Ordered milestones and acceptance goals
public/                       Static assets
scripts/import/
  adapters/                   Source-specific fetchers and parsers
  normalise/                  IDs, aliases, URLs, and time windows
  validate/                   Record and snapshot validation
  publish/                    Atomic snapshot publication
src/
  app/
    (public)/                 Explore, companies, patterns, sources, about
    (workspace)/              Dashboard and notes
    api/health/               Application liveness endpoint
    globals.css               Theme and global styles
    layout.tsx                Metadata and application shell
    page.tsx                  Landing page
    not-found.tsx             Custom missing-page screen
  components/
    navigation/               Site navigation
    questions/                Future question table components
    sheets/                   Future pattern groups and sheet components
    ui/                       Reusable UI primitives
  features/
    catalogue/                Catalogue and filter domain logic
    progress/                 Completion, bookmarks, and notes
    revision/                 Review scheduling
    source-management/        Provenance and source health
  hooks/                      Future client hooks
  lib/
    auth/                     Future authentication boundary
    database/                 Future server database boundary
    guest-storage/            Future IndexedDB persistence
    validation/               Future shared schemas
    site.ts                   Navigation and site configuration
    utils.ts                  CSS class helper
supabase/migrations/          Implemented catalogue, student data, and access migrations
tests/
  fixtures/                   Small representative source snapshots
  unit/                       Future domain tests
  integration/                Future import/database tests
  e2e/                        Future browser workflow tests
```

README files explain module boundaries; `.gitkeep` files preserve reserved directories in Git. The generated `AGENTS.md` directs coding assistants to this installed Next.js version's bundled documentation.

## Environment variables

| Variable                               | Intended use                                     |
| -------------------------------------- | ------------------------------------------------ |
| `NEXT_PUBLIC_SITE_URL`                 | Public application URL                           |
| `NEXT_PUBLIC_SUPABASE_URL`             | Future Supabase project URL                      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable authentication key          |
| `SUPABASE_SECRET_KEY`                  | Future privileged server/import operations only  |
| `GITHUB_TOKEN`                         | Future server-side repository access if required |

These variables are placeholders and are not consumed yet. Never prefix privileged secrets with `NEXT_PUBLIC_`. Keep real values in `.env.local` or deployment/Actions secrets. The environment example is tracked; actual environment files are ignored.

## Architecture and automatic updates

```text
Students -> Supabase sign-in -> Next.js -> catalogue / private progress
                      |
                      +-> Supabase PostgreSQL (planned)
                      +-> internal importer metadata (server only)

Source repositories / supported APIs
  -> scheduled importer
  -> parse and normalise
  -> validate staged snapshot
  -> publish atomically
  -> refresh affected website caches
```

Imports must not run inside page requests. Fetch a fixed source revision, preserve original provenance and time windows, reject malformed changes, and keep the last good dataset if an import fails.

Identify questions by platform and stable problem ID. Frequency belongs to a company/question/source/time-window observation. Keep progress separate from source snapshots so updates cannot overwrite student work.

Track dataset date, import time, and last-check time separately. Do not treat a recent repository commit as evidence of recent interview data. Store unknown frequency as unknown; do not add scores from unrelated sources.

The project includes CI and an offline fixed-snapshot importer. No automatic import schedule is active. A daily import workflow will be added after source permissions, adapters, validation, and publication are implemented.

## CI and verification

`.github/workflows/ci.yml` runs on pull requests, pushes to main/master, and manual dispatch. It installs the pinned pnpm version, uses Node 24, performs a frozen-lockfile installation, and runs formatting, lint, type checking, and a production build without service secrets.

Run the same checks locally with `pnpm check`. This workflow cannot execute on GitHub until the project files are committed and pushed. No remote commit or deployment is performed by the scaffold.

Database integration tests now run separately in CI on PostgreSQL 17. Locally, pnpm db:test requires a fresh disposable instance and explicit PGHOST/PGDATABASE settings; see [database guide](docs/database.md). Tests use real database roles and a minimal test-only Supabase auth shim. They do not test hosted authentication or API behaviour. Application-level tests will follow with the first connected UI feature.

## Next implementation milestones

1. Apply and verify the implemented database migrations in an isolated Supabase project; generate database types and integrate clients.
2. Review the implemented 1Kosmos import artifacts, configure the development database, and apply staging SQL before connecting real catalogue pages.
3. Connect real company sheets, patterns, filters, and sorting.
4. Implement account progress, notes, bookmarks, and backup restoration.
5. Configure and verify hosted authentication, private sync, and account lifecycle.
6. Enable safe scheduled imports and source health reporting.
7. Expand to additional sources and platforms.
8. Verify accessibility, performance, privacy, and deployment readiness.

See [architecture](docs/architecture.md), [roadmap](docs/roadmap.md), and [import pipeline](scripts/import/README.md).

## Data and contribution principles

Credit sources, preserve snapshot dates, link to original problems, and check redistribution permissions before importing content. A public repository is not automatically a licence to redistribute its dataset. This scaffold does not unlock paid problems or reproduce third-party statements.

Choose the project's code licence before accepting external contributions or describing the repository as open source; no licence has been selected on the owner's behalf.

## Account access and student privacy

All application pages and APIs require an authenticated account; only sign-in, registration, email confirmation, and framework assets are accessible before login. Email/password authentication uses Supabase Auth. Sources, dataset dates, and import history are not shown in the student interface. `/sources` returns not found for signed-in users. Internal provenance remains available to trusted import maintenance jobs.

Copy `.env.example` to `.env.local`, set the Supabase URL and publishable key, and enable email/password authentication in your Supabase project. Set your Site URL and allowed redirects to the application domain. For server-side email confirmation, set the Confirm signup email template link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`. Set these environment values before building or deploying, then rebuild after changes. Apply all four database migrations in order. Missing configuration denies access rather than allowing guest browsing. Never expose the secret key in browser code.

Migration `20261002000400_members_only.sql` supersedes the earlier anonymous catalogue policies: student catalogue reads require identity, shared sheets require an account, and source/snapshot/import metadata is inaccessible to student roles. Observation queries must explicitly select `company_id,question_id,time_window,frequency,frequency_kind,acceptance_percent`; `select *` and provenance columns are denied. Keep required upstream license notices in repository/internal documentation. This update replaces earlier plans for guest progress and public browsing. The catalogue screens remain milestone placeholders.

The database test runner verifies the earlier three-migration contract and importer first, then applies membership restrictions and verifies anonymous denial, student metadata denial, and allowed catalogue projections.

Run `pnpm test:access` after `pnpm build` to verify logged-out page/API denial and account entry points. This runs automatically in `pnpm check` and CI. Hosted confirmation and successful sign-in must be checked after configuring Supabase.
