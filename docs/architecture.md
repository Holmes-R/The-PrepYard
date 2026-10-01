# Architecture

The PrepYard is a free, multi-platform interview preparation tracker.

## Current scaffold

- Next.js App Router and TypeScript provide pages and future application endpoints.
- Tailwind CSS and shadcn-compatible design tokens provide the interface foundation.
- Public routes work without a database or account.
- Domain features, storage, auth, and import directories define future implementation boundaries.
- No live questions, account system, persistence, scheduled imports, or database schema are implemented yet.

## Planned boundaries

Public catalogue reads use cached server queries against Supabase PostgreSQL. Private progress uses Supabase Auth and owner-scoped database policies. Guest progress will use Dexie/IndexedDB, with explicit backup and account-merge behaviour.

Imports run separately from website requests. Source adapters fetch a fixed revision, normalise records, validate a staged snapshot, and publish it atomically. Failed imports preserve the last good dataset. Refresh only affected catalogue caches after publication.

Question identity is platform plus external problem ID (or canonical URL where no ID exists). Company frequency belongs to a question/company/time-window/source-snapshot observation. User progress belongs to the question and must survive catalogue updates. Similar questions on separate platforms do not share completion automatically.

Preserve dataset date, import time, and last-check time separately. Never infer current interview frequency from a recent repository commit alone.

## Secrets

Public Supabase configuration identifies the project; row-level security must enforce access. Secret database/import keys must never enter client components or NEXT_PUBLIC variables. Add authentication and authorization before creating admin routes or privileged endpoints.
