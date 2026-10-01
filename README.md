# The PrepYard

Free, multi-platform coding interview preparation for students.

Repository: [Holmes-R/The-PrepYard](https://github.com/Holmes-R/The-PrepYard)

## Current milestone: application scaffold

This repository contains a runnable foundation, not a completed question tracker.

**Implemented**

- Next.js App Router, React, strict TypeScript, and the `@/*` source alias.
- Tailwind CSS, system light/dark themes, Lucide icons, and shadcn/ui configuration.
- A responsive home page, navigation, skip link, reusable button, and section placeholders.
- Public routes that run without accounts or environment secrets.
- A health endpoint, ESLint, Prettier, type checking, and a production-build CI workflow.
- Directories and documentation for future database, progress, import, and test work.
- A pnpm lockfile for reproducible dependency installation.

**Not implemented yet**
Live questions, source imports, scheduled updates, search/filtering, Supabase connections, authentication, notes storage, guest progress, account sync, and admin operations. Placeholder pages say this explicitly. The health endpoint reports application liveness only, not database or source health.

## Technology

| Area            | Scaffold                                                              |
| --------------- | --------------------------------------------------------------------- |
| Application     | Next.js 16, React 19, TypeScript 5                                    |
| Styling         | Tailwind CSS 4, CSS theme variables                                   |
| UI foundation   | shadcn/ui configuration, Radix Slot, class-variance-authority, Lucide |
| Quality         | ESLint, Prettier, Next.js route type generation, TypeScript           |
| Package manager | pnpm 11.19.0, pinned in package.json                                  |
| Automation      | GitHub Actions CI                                                     |

Planned additions: Supabase PostgreSQL/Auth, Dexie/IndexedDB for guest progress, TanStack Table, Papa Parse, Zod, Vitest, and Playwright. They will be installed when their features are implemented; no unused service clients are created in this scaffold.

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

For a production smoke check, run `pnpm build`, then `pnpm start`, and open the website and `/api/health`.

## Routes

| Route         | Current behaviour                  |
| ------------- | ---------------------------------- |
| `/`           | Project landing page               |
| `/explore`    | Question catalogue placeholder     |
| `/companies`  | Company directory placeholder      |
| `/patterns`   | Pattern learning placeholder       |
| `/dashboard`  | Guest workspace placeholder        |
| `/notes`      | Notes placeholder                  |
| `/sources`    | Source provenance placeholder      |
| `/about`      | Mission and scope                  |
| `/api/health` | JSON application liveness response |

The `(public)` and `(workspace)` route groups organise files and do not appear in URLs. Workspace pages are intentionally accessible without login. Admin and authenticated routes must not be added until authorization is implemented.

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
supabase/migrations/          Future versioned SQL migrations
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
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Future public Supabase client key                |
| `SUPABASE_SECRET_KEY`                  | Future privileged server/import operations only  |
| `GITHUB_TOKEN`                         | Future server-side repository access if required |

These variables are placeholders and are not consumed yet. Never prefix privileged secrets with `NEXT_PUBLIC_`. Keep real values in `.env.local` or deployment/Actions secrets. The environment example is tracked; actual environment files are ignored.

## Architecture and automatic updates

```text
Students -> Next.js -> catalogue / optional private progress
                      |
                      +-> Supabase PostgreSQL (planned)
                      +-> browser guest storage (planned)

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

The scaffold includes **CI only**. A daily import workflow will be added after source permissions, adapters, validation, and publication are implemented.

## CI and verification

`.github/workflows/ci.yml` runs on pull requests, pushes to main/master, and manual dispatch. It installs the pinned pnpm version, uses Node 24, performs a frozen-lockfile installation, and runs formatting, lint, type checking, and a production build without service secrets.

Run the same checks locally with `pnpm check`. This workflow cannot execute on GitHub until the project files are committed and pushed. No remote commit or deployment is performed by the scaffold.

No empty placeholder tests are included. Add Vitest and Playwright with the first functional milestone, focusing on duplicate-free imports, failure rollback, progress persistence, backups, and user isolation. See [test strategy](tests/README.md).

## Next implementation milestones

1. Add database migrations, constraints, and owner-scoped access policies.
2. Build and test one source adapter using a small fixed fixture.
3. Connect real company sheets, patterns, filters, and sorting.
4. Implement guest progress, notes, bookmarks, and backup restoration.
5. Add optional accounts and explicit guest-to-cloud merging.
6. Enable safe scheduled imports and source health reporting.
7. Expand to additional sources and platforms.
8. Verify accessibility, performance, privacy, and deployment readiness.

See [architecture](docs/architecture.md), [roadmap](docs/roadmap.md), and [import pipeline](scripts/import/README.md).

## Data and contribution principles

Credit sources, preserve snapshot dates, link to original problems, and check redistribution permissions before importing content. A public repository is not automatically a licence to redistribute its dataset. This scaffold does not unlock paid problems or reproduce third-party statements.

Choose the project's code licence before accepting external contributions or describing the repository as open source; no licence has been selected on the owner's behalf.
