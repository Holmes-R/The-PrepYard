# The PrepYard

Free, account-based coding interview preparation for students — company-wise question sheets, pattern-based practice, private notes, and a spaced-revision system in one app.

Repository: [Holmes-R/The-PrepYard](https://github.com/Holmes-R/The-PrepYard)

## Overview

The PrepYard helps you prepare for coding interviews in three ways:

1. **Practice by company** — pick a company (for example Amazon or 1Kosmos) and work through the questions it is known to ask, ordered by how frequently they are reported.
2. **Practice by pattern** — browse DSA questions grouped into patterns and topics (two-pointers, dynamic programming, graphs, …) so you learn transferable approaches instead of isolated tricks.
3. **Track your progress** — mark questions solved, bookmark them, keep private notes, and schedule revisions with a confidence rating. Everything is saved to your account and shows up on your dashboard.

Everything requires a free email/password account. Notes and progress are private to you; nothing is shared or published to other students.

## Tech stack

| Layer     | Choices                                                                         |
| --------- | ------------------------------------------------------------------------------- |
| Framework | Next.js 16 (App Router), React 19, TypeScript                                   |
| Styling   | Tailwind CSS 4, Radix primitives, Lucide icons, locally bundled Inter font      |
| Data      | PostgreSQL via `pg` (node-postgres), 15 SQL migrations, row-level security      |
| Auth      | Auth.js (v5 beta) credentials — email + PrepYard password, encrypted JWT cookie |
| Tooling   | pnpm 11.19, ESLint, Prettier, GitHub Actions                                    |

Supabase may host the PostgreSQL database and run migrations, but it does **not** authenticate users — the app talks to the database directly through a restricted server-side login.

## Getting started

### Prerequisites

- Node.js 22.12+ (Node 22 or 24)
- pnpm 11.19.0 (`corepack enable` installs it from `package.json`)
- A PostgreSQL 17 database (local or Supabase)

### 1. Install

```bash
git clone https://github.com/Holmes-R/The-PrepYard.git
cd The-PrepYard
pnpm install --frozen-lockfile
```

### 2. Configure environment

Create `.env.local` in the repository root (it is git-ignored — never commit it):

```bash
AUTH_URL=http://localhost:3000
AUTH_SECRET=generate-with-openssl-rand-base64-32
DATABASE_URL=postgresql://user:password@host:5432/postgres
RESEND_API_KEY=...        # transactional email for signup/reset links
AUTH_EMAIL_FROM=...       # the From address for those emails
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Sign-in fails closed: without this configuration, protected pages deny access. A wrong or missing `AUTH_SECRET` invalidates every session. See [password authentication](docs/password-auth.md) for the full walkthrough.

### 3. Database

Apply all 15 migrations in `supabase/migrations/` in timestamp order (Supabase CLI: `supabase db push`, or paste them into the SQL editor in order). Then provision the restricted `prepyard_web` login that the app uses — see the [database guide](docs/database.md). Do not point the app at a privileged database role.

### 4. Run

```bash
pnpm dev        # http://localhost:3000
```

Create an account at `/signup`, confirm the emailed link, then log in at `/login`. Your password is a **PrepYard password** — never reuse your email or Google password.

## Scripts

| Command          | What it does                                                           |
| ---------------- | ---------------------------------------------------------------------- |
| `pnpm dev`       | Start the development server                                           |
| `pnpm build`     | Production build                                                       |
| `pnpm start`     | Serve the production build                                             |
| `pnpm check`     | Full gate: format, lint, unit tests, types, build, route/session tests |
| `pnpm lint`      | ESLint                                                                 |
| `pnpm typecheck` | `tsc --noEmit` (after Next type generation)                            |
| `pnpm format`    | Prettier write                                                         |
| `pnpm db:test`   | Migrations + RLS/identity tests on a disposable local PostgreSQL       |

Test-only entry points (also part of `pnpm check`): `test:patterns`, `test:catalogue`, `test:import`, `test:auth`, `test:access`. Database-backed suites run with their own `test:*:database` scripts and need a reachable PostgreSQL.

Admin/import entry points: `import:company`, `import:repository`, `patterns:publish`, `collections:publish`, `logos:publish-reviewed`, `topics:fetch`, `logos:fetch`. These are documented in [the importer guide](docs/importer.md) and [company workflow](docs/company-pages.md).

## Project structure

```
src/
  app/                  # Routes (App Router)
    page.tsx            #   Public landing page
    login, signup, ...  #   Pre-sign-in pages (also: forgot/reset/verify email)
    (public)/           #   App pages: companies, explore, patterns, about
    (workspace)/        #   Workspace pages: dashboard, notes, components
    api/                #   Route handlers (auth, companies, notes, health, …)
  components/           # Feature UI (sheets, questions, notes) + ui/ primitives
  features/             # Domain logic: catalogue, patterns, notes, progress, auth
  lib/                  # Server helpers: database transactions, auth policy, site nav
  proxy.ts              # Request guard — redirects signed-out users away from app pages
  auth.ts               # Auth.js configuration (credentials provider)
supabase/migrations/    # 15 ordered SQL migrations (schema, RLS, grants, identity)
scripts/                # Importers, publishers, data fetchers
tests/                  # Unit, auth, import, access and database suites
docs/                   # In-depth guides (see below)
```

## Pages

Only the landing page and the five account pages are public. Every other page requires a session and redirects signed-out visitors to `/login?next=…`, returning them to the page they wanted afterwards. On any signed-in page, `Ctrl/Cmd+K` opens the quick search.

### Home — `/`

The public front door.

- The main button adapts to your session: "Create free account" when signed out, "Go to dashboard" when signed in.
- An interactive preview with Topics / Patterns / Companies tabs (Arrow keys, Home and End navigate them), each listing four curated destinations; guests are sent to sign-in with the destination preserved.
- A feature grid, three collection guides, a three-step "How it works", and keyboard-accessible FAQ accordions.

### Log in — `/login`

- Sign in with your email and PrepYard password.
- Honors a `?next=` redirect so you land back on the page you came from.
- Links to sign-up and password recovery; failed attempts show an error without revealing whether the account exists.

### Sign up — `/signup`

- Create an account with your name, email, and a 12–128 character password (entered twice).
- Sends a verification email; you confirm the link before you can log in.

### Forgot password — `/forgot-password`

- Enter your account email to have a password-reset link sent to you.

### Reset password — `/reset-password`

- The emailed link carries a token; choose and confirm a new password.
- Without a valid token the page offers to request a new link.

### Verify email — `/verify-email`

- The emailed verification link lands here and confirms your account.
- Without a token, the page links back to sign-up to request a new email.

### Companies — `/companies`

The company directory.

- Search companies (debounced, saved in the URL), sort by question count, name, or most solved, and switch between "All companies" and "Your practice" (companies you have solved at least one question in).
- Each card shows the question pool, solved percentage, a progress meter, and difficulty totals; company logos fall back to colored initials when missing.
- Expanding a card inlines the full question sheet with a live solved/total counter; one card opens at a time.
- Twelve companies per page, with Previous/Next pagination; the open card and filters stay in the address bar, so views are shareable and survive back/forward.

### Company sheet — `/companies/1kosmos`

The question list for one company (for example `1kosmos`).

- Filters: question search, difficulty, progress (any / not started / attempted / solved / needs revision), multi-select topic chips, plus "More filters" for sort order, time window (only windows the company actually has), and minimum frequency/acceptance percentages.
- Click column headers to sort by up to three priorities at once (question, difficulty, frequency, revision).
- Every row: a solved toggle, a direct link to the problem on its platform, pattern tags, up to four company tags with reported frequency (clicking one deep-links to that company), an expandable topic list, a revision button, and a note button.
- The revision dialog rates each session (Struggled / Tough / Got it / Nailed it), schedules a next-day reminder, and lists your dated revision history.
- The note editor holds up to 50,000 characters per question, fetched on first open, with save feedback and error recovery.
- Paginated with skeletons while loading, a Retry on failure, and a redirect to login if your session expires.

### Explore — `/explore`

A hub page for choosing where to practice.

- Large cards link to the company directory, the full topic list, and each practice collection (Interview Launchpad, DSA Deep Dive, Interview Hotlist).
- Progress and notes are shared everywhere: a question solved in one collection stays solved in every view.

### Patterns hub — `/patterns`

The DSA practice hub.

- A progress card shows solved/total and completion percentage for whatever you are currently viewing.
- Three browsing modes: **Topics** (numbered pattern roadmap), **Patterns**, and **Collections**, each with counts.
- Filters: question search, difficulty, progress (any / unsolved / solved / bookmarked), single-select topic chips, a **Shuffle** button for random order, and "More filters" for a specific pattern, a collection, or hiding topic tags in rows.
- Results appear as topic accordions — each with its own completion meter, solved count, sortable column header, and Previous/Next pagination.
- Active filters show as removable chips; the Interview Hotlist gets a note explaining its dynamic top-20-per-topic ranking.

### Pattern sheet — `/patterns/two-pointers`

The question list for one pattern group.

- Hero with the pattern name and a progress card; a back link to all topics.
- Filters: search, difficulty, progress, topic chips, plus sort orders — Recommended, Easy→Hard, Hard→Easy, Revision priority (soonest-due first), and Shuffle.
- Every row carries a solved toggle, the platform link, a "peak frequency · N companies" badge, pattern tags, a difficulty badge, an expandable topic column, and the same revision dialog and note editor as company sheets.
- Sorting and pagination live in the URL; unknown slugs 404, and a renamed slug redirects.

### Dashboard — `/dashboard`

Your progress at a glance.

- Four stat cards: questions solved (with easy/medium/hard breakdown), completion rate, revisions due (with a link to the review queue), and saved notes (with a link to the notebook).
- Collection cards with solved/total, a progress bar, and a "How collections work" explainer.
- A recent-practice list (each entry links back to the question) and a seven-day revision activity chart.

### Notes — `/notes`

Your private notebook.

- All saved notes as cards, newest edit first, paginated.
- Each card expands to show the note, links to the original question, and offers "Find in practice" to locate it in the pattern sheet.
- Deleting is a deliberate two-step inline confirmation (Escape cancels), so a stray tap never removes a note.

### About — `/about`

A short mission statement about the project. Requires sign-in like every app page.

### Components — `/components`

A gallery of the design system: button variants and states, checkboxes (including indeterminate), radios, filter chips, typography scale, and example question and note components. Previews are local-only — nothing here reads or writes your account data.

## How it works

**Sign-in and data access.** The browser never receives database credentials. Auth.js verifies your password and stores an encrypted JWT cookie; `src/proxy.ts` checks it before any protected page or API is served. Server code opens a PostgreSQL transaction, switches to the restricted `authenticated` permission role, and scopes the request to your student id — row-level security policies double-check ownership on every query, so even a buggy query can only ever touch your own notes and progress.

**Catalogue data.** Approved upstream datasets are imported separately from website traffic: the importer normalizes and validates a staged snapshot, then publishes it atomically — a failed import leaves the last good dataset in place. Student progress is keyed to stable question ids, so imports never overwrite your solved/bookmarked/notes state. Source URLs, dataset dates, and import logs stay internal.

**Client rendering.** Pages load a shell immediately, then fetch private JSON from authenticated APIs (SWR deduplicates and caches them per session). Saves and deletions refresh only the affected data; a 401 returns you to login with your destination preserved. Private responses are always `private, no-store`. Filters and pagination are serialized into the URL, so any filtered view is shareable and survives reloads.

## Testing and CI

- **Unit tests** — query builders and fixtures: `pnpm test:patterns`, `pnpm test:catalogue`, `pnpm test:import`, `pnpm test:auth`
- **Post-build integration** — `pnpm test:access` boots the built app and verifies protected-route redirects and forged-cookie denial
- **Database tests** — `pnpm db:test` and the `test:*:database` scripts run migrations, row-level-security and publication checks against a disposable PostgreSQL
- **CI** — `.github/workflows/ci.yml` runs format, lint, tests, typecheck, build and access checks on every push/PR, plus migration/policy tests on a fresh PostgreSQL service

## Documentation

| Guide                                            | Contents                                               |
| ------------------------------------------------ | ------------------------------------------------------ |
| [Password authentication](docs/password-auth.md) | Account setup, email delivery, reset flows             |
| [Database](docs/database.md)                     | Schema, access matrix, restricted login, deployment    |
| [Company pages](docs/company-pages.md)           | Company sheets and the publication workflow            |
| [Pattern sheet](docs/pattern-sheet.md)           | Practice sheets, filters, revision dialog, collections |
| [Notes](docs/notes.md)                           | Private notes model and the notebook page              |
| [Importer](docs/importer.md)                     | Pinned fixtures, staging SQL, publication              |
| [Architecture](docs/architecture.md)             | Design boundaries and data-ownership rules             |
| [Roadmap](docs/roadmap.md)                       | Planned work                                           |
| [UI guide](docs/stitch-ui.md)                    | Design language, components, accessibility conventions |

## Notes

- The project does not bypass paid problem access or reproduce third-party problem statements; questions link to their canonical platform pages.
- Keep source licensing and attribution records internal, as described in [collection attribution](docs/collection-attribution.md).
- Never commit secrets. `.env.local`, privileged database URLs, and the `prepyard_web` password stay on your machine or in your host's secret store.

## LeetCode completion sync

Open **Dashboard → LeetCode sync**, enter your public LeetCode username, and connect. Automatic sync is enabled by default once a username is connected. Only submissions accepted after connecting are eligible; older solves and failed/pending attempts do not change completion. Recent publicly visible Accepted submissions are checked every two minutes while PrepYard is visible and online, with manual Sync now, pause/resume, and disconnect controls. Matching questions update across company pages, patterns, and dashboard totals. Notes and revision ratings are preserved, and previously processed submissions do not undo a later manual uncheck. No LeetCode passwords, cookies, or solution code are collected.

Apply migration `20261010001400_leetcode_sync.sql` before using this feature. Public syncing is limited to the latest 20 Accepted submissions and may miss older/private activity; closing all PrepYard tabs stops periodic checks. See [sync setup and limitations](docs/leetcode-sync.md). Run `pnpm test:leetcode` for adapter checks.

### Complete LeetCode history

The optional Chrome/Edge extension imports all solved question slugs from a signed-in LeetCode tab and checks every two minutes while LeetCode and PrepYard tabs are open. Completion is shared across company and pattern pages. Passwords, cookies and solution code remain outside PrepYard. Apply migration `20261010001500_leetcode_history.sql` after the sync-settings migration. Run `pnpm build:extension` to package the downloadable ZIP; the production build does this automatically. Install/setup, privacy and limitations are documented in [LeetCode sync](docs/leetcode-sync.md).

## Notes: first release

The notebook searches question titles and note content across all pages. Compact cards keep content behind View note, with Edit note opening the shared editor. Company and pattern rows use that same editor. The editor starts with a clean note and supports optional user-written tags, shown on each notebook card and included in search. Insert language-labelled fenced code blocks and use Preview or View note to copy code. Only a small safe Markdown subset (headings, bullet lists and fenced code) is rendered; raw HTML remains text.

Notes autosave after a one-second pause, with Saved, Saving and retryable error states. Writes from one editor are serialized so older requests cannot overwrite newer typing. Unsaved drafts are stored under the signed-in account and question in this browser tab's session storage; reopening after a refresh offers Restore or Discard instead of overwriting the saved note. Closing the tab ends this recovery session. Notes stay private under existing owner policies, with the existing 50,000-character limit; apply `supabase/migrations/20261010001600_note_tags.sql` for optional note tags. Run `pnpm test:notes` for editor/queue/validation checks.
