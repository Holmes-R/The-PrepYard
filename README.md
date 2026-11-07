# The PrepYard

**Free coding-interview practice and progress tracking for students.**

PrepYard brings company-wise questions, standard DSA topics, patterns, practice collections, notes, revisions, and progress into one workspace.

- Repository: [Holmes-R/The-PrepYard](https://github.com/Holmes-R/The-PrepYard)
- Live app: [the-prepyard.onrender.com](https://the-prepyard.onrender.com/)

## What you can do

- **Practice by company:** browse company question lists and filter by topic, difficulty, reported frequency, or your own progress.
- **Learn by topic or pattern:** practice standard data-structure and algorithm topics, then browse reusable patterns such as Prefix Sum or Two Pointers.
- **Use practice collections:** explore curated collections such as Interview Launchpad, DSA Deep Dive, and Interview Hotlist.
- **Track your work:** mark questions solved, review your dashboard, and record confidence ratings with revision history.
- **Keep private notes:** add notes to questions, optionally tag them, and save changes only when you choose **Save now**.
- **Sync accounts:** connect supported public LeetCode and GeeksforGeeks profiles. HackerRank and CodeChef tracking remains manual. An optional browser extension can import LeetCode solved history.

PrepYard uses an account email and a separate PrepYard password. It does **not** ask for or store your Google/Gmail password. Email verification and password reset use the configured email provider.

## Data and limitations

Question catalogues and company-frequency observations come from reviewed external datasets. Coverage and freshness can vary. Frequency is historical reported data; it is not a prediction of what an interviewer will ask.

Where a reviewed free alternative exists for a paid problem, PrepYard can link to that alternative. This coverage is not complete. PrepYard does not bypass subscription checks or copy third-party problem statements or solutions. See [free practice destinations](docs/free-practice.md) and [collection attribution](docs/collection-attribution.md).

The app keeps source and import metadata out of student practice screens. The repository’s importer and attribution guides explain how catalogue data is reviewed and maintained.

## How it works

1. A student signs in with email and a PrepYard password.
2. The browser requests catalogue and personal progress data through the Next.js application.
3. Server-side code validates the session and accesses PostgreSQL with the restricted `prepyard_web` role.
4. PostgreSQL row-level security limits notes, progress, and revision records to their owner.
5. Catalogue updates are reviewed and imported separately from normal student traffic.

Supabase can host PostgreSQL and apply migrations. PrepYard does **not** use Supabase Auth; account registration, password verification, and sessions are handled by the application.

## Tech stack

| Area        | Technology                                                                |
| ----------- | ------------------------------------------------------------------------- |
| Web app     | Next.js 16 App Router, React 19, TypeScript                               |
| UI          | Tailwind CSS 4, Lucide icons, locally bundled Inter font                  |
| Data        | PostgreSQL with `pg`, ordered SQL migrations, row-level security          |
| Accounts    | Auth.js credentials, scrypt password hashes, email verification and reset |
| Client data | SWR for request deduplication and refresh                                 |
| Tooling     | Node.js, pnpm, ESLint, Prettier, GitHub Actions                           |
| Hosting     | Render web service; Supabase PostgreSQL is the documented database setup  |

## Run locally

### Requirements

- Node.js 22.12 or later in the supported 22.x line, or Node.js 24
- pnpm 11 (`corepack enable` can install the version specified by the project)
- A Supabase PostgreSQL project, or a compatible local Supabase instance for development.
- An email sender for account verification and password reset

### 1. Get the code

```sh
git clone https://github.com/Holmes-R/The-PrepYard.git
cd The-PrepYard
corepack enable
pnpm install --frozen-lockfile
```

### 2. Create local environment settings

Copy the example file and edit `.env.local` in the repository root:

```sh
cp .env.example .env.local
```

Set at least:

```dotenv
AUTH_URL=http://localhost:3000
AUTH_SECRET=your-generated-secret
DATABASE_URL=your-restricted-database-connection-url
AUTH_EMAIL_PROVIDER=gmail
GMAIL_USER=your-sender@gmail.com
GMAIL_APP_PASSWORD=your-google-app-password
```

Generate an `AUTH_SECRET` locally:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

`GMAIL_APP_PASSWORD` is a Google App Password, not the sender’s regular Google password. Other supported email options are Gmail API and Resend; Resend needs a verified sending domain. See [password and email setup](docs/password-auth.md) and [Gmail API setup](docs/gmail-api-email.md).

Keep `.env.local` private. Never commit database passwords, email credentials, OAuth tokens, or `AUTH_SECRET`.

### 3. Prepare the database

Apply the migrations in `supabase/migrations/` in filename order. The app must connect with the restricted `prepyard_web` role, not the database administrator or `service_role` account. For Supabase, the connection URL uses the Session pooler and the username `prepyard_web.<project-ref>`.

Follow the [database setup guide](docs/database.md) before linking or changing a hosted project. Inspect the migration plan before applying it. Catalogue data may need to be published separately; migrations create the schema and do not automatically import the question catalogue.

### 4. Start the app

```sh
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), create an account at `/signup`, verify the email, and log in at `/login`.

## Pages

| Page                | What it’s for                                      |
| ------------------- | -------------------------------------------------- |
| `/`                 | Project landing page                               |
| `/dashboard`        | Progress, recent practice, and revision overview   |
| `/companies`        | Search and browse the company directory            |
| `/companies/[slug]` | A company’s questions and filters                  |
| `/patterns`         | Standard topics, pattern browsing, and collections |
| `/patterns/[slug]`  | A dedicated pattern question list                  |
| `/explore`          | Entry point to topics and practice collections     |
| `/notes`            | Search and manage your saved notes                 |
| `/settings`         | Connect or manage supported sync accounts          |
| `/about`            | About PrepYard                                     |

Company cards open the company question page in a new tab. Question tracking, notes, and revisions are shared across company, topic, pattern, and collection views.

## Account sync

Open **Settings → Sync accounts** to connect supported public profiles. PrepYard does not ask for platform passwords, cookies, or solution code.

- **LeetCode username sync** checks recent public Accepted submissions. Only submissions accepted after connecting are eligible; the public feed is limited and may omit activity.
- **GeeksforGeeks sync** records a public solved-list baseline when connected, then tracks newly visible matching problems. It does not use a reliable acceptance timestamp.
- **LeetCode browser extension** is an optional way to import full solved history from a signed-in LeetCode tab. The LeetCode session remains in the browser and is not sent to PrepYard.
- **HackerRank and CodeChef** are manual in this release.

Completion sync updates the same PrepYard question across company, topic, pattern, and collection pages. Notes and revision history are preserved. Read [Sync accounts](docs/sync-accounts.md) and [LeetCode sync](docs/leetcode-sync.md) for setup, privacy details, and limitations.

## Development commands

| Command                 | Purpose                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `pnpm dev`              | Start the development server                                                       |
| `pnpm build`            | Build the production app and package the optional browser extension                |
| `pnpm start`            | Start the production build                                                         |
| `pnpm check`            | Run formatting, lint, tests, typecheck, build, and access checks                   |
| `pnpm lint`             | Run ESLint                                                                         |
| `pnpm typecheck`        | Generate Next.js types and run TypeScript checks                                   |
| `pnpm format:check`     | Check formatting with Prettier                                                     |
| `pnpm db:test`          | Run database migrations and access tests on a disposable local PostgreSQL instance |
| `pnpm test:notes`       | Run note editor, tag, and query tests                                              |
| `pnpm test:accounts`    | Run account-sync adapter tests                                                     |
| `pnpm test:leetcode`    | Run LeetCode adapter and extension tests                                           |
| `pnpm test:performance` | Run cache and request-timing tests                                                 |

Database integration tests use a separate disposable test database. **Never point a test or importer command at the production database.** See [test instructions](tests/README.md).

## Project structure

```text
src/
  app/                 Next.js pages, route handlers, and styles
  components/          Navigation, company/pattern sheets, notes, and UI
  features/            Catalogue, authentication, progress, patterns, and sync logic
  lib/                 Database, session, validation, and shared server helpers
  auth.ts              Auth.js configuration
  proxy.ts             Protected-route and session guard
supabase/migrations/   Database schema, access policies, and indexes
scripts/               Catalogue import, publication, and maintenance commands
tests/                 Unit, integration, and database test suites
docs/                  Setup and feature guides
extensions/            Optional LeetCode browser extension
```

## Contributing

Contributions and clear bug reports are welcome. Before opening a pull request:

1. Explain the user problem and the change you made.
2. Add or update documentation when setup, privacy, or behavior changes.
3. Add a new migration for database changes; do not edit migrations that may already have been applied.
4. Run `pnpm check` when your environment supports the complete check suite.
5. Keep secrets, real student data, and production connection strings out of commits and screenshots.

For catalogue changes, include the reviewed fixture or attribution update and explain how the change was validated.

## Guides

- [Database setup and access rules](docs/database.md)
- [Password authentication and email delivery](docs/password-auth.md)
- [Render deployment](docs/render-deployment.md)
- [Company pages and catalogue updates](docs/company-pages.md)
- [Patterns and practice collections](docs/pattern-sheet.md)
- [Notes and manual saving](docs/notes.md)
- [Sync accounts setup and limitations](docs/sync-accounts.md)
- [LeetCode username sync and browser extension](docs/leetcode-sync.md)
- [Catalogue performance](docs/performance.md)
- [Importer workflow](docs/importer.md)
- [Project roadmap](docs/roadmap.md)
