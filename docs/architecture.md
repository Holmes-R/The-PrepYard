# Architecture

The PrepYard is a free, multi-platform interview preparation tracker.

## Authentication update

Supabase Auth has been removed. Auth.js verifies Google OAuth and issues encrypted sessions; PostgreSQL private.students owns identity. Application queries use the restricted prepyard_web login and transaction-local identity. See [Google setup](google-sign-in.md).

## Current scaffold

- Next.js App Router and TypeScript provide pages and future application endpoints.
- Tailwind CSS and shadcn-compatible design tokens provide the interface foundation.
- Every application page and API requires Google sign-in through Auth.js. The Google sign-in page and OAuth endpoints are the entry points.
- Domain features, storage, auth, and import directories define future implementation boundaries.
- Database migrations implement catalogue and student-data tables, constraints, indexes, RLS, and server-only snapshot publication. See [database guide](database.md).
- Google-only account UI and server-side session guards are implemented. Live catalogue queries, progress persistence, and scheduled imports remain pending.

## Planned boundaries

Catalogue reads require authenticated identities. Private progress uses Auth.js Google sessions and owner-scoped database policies. Guest browsing and guest progress are no longer planned. Authentication responses are private and never shared through a cache. Source metadata, snapshot dates, and import history remain internal; students can query only the allowed frequency observation columns.

Imports run separately from website requests. Source adapters fetch a fixed revision, normalise records, validate a staged snapshot, and publish it atomically. Failed imports preserve the last good dataset. Refresh only affected catalogue caches after publication.

Question identity is platform plus external problem ID (or canonical URL where no ID exists). Company frequency belongs to a question/company/time-window/source-snapshot observation. User progress belongs to the question and must survive catalogue updates. Similar questions on separate platforms do not share completion automatically.

Preserve dataset date, import time, and last-check time separately. Never infer current interview frequency from a recent repository commit alone.

## Secrets

Google OAuth secrets, AUTH_SECRET, and PostgreSQL connection credentials remain server-only. The restricted database login and row-level security enforce student access. Administrative features require separate authorization.

## First importer

The fixed 1Kosmos adapter verifies checked-in CSV checksums, normalizes one question across two time windows, and generates JSON plus transactional staging SQL. It does not auto-publish or connect the frontend. See [importer guide](importer.md).
