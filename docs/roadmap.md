# Implementation roadmap

1. Scaffold: application shell, route placeholders, configuration, environment template, CI, and documentation.
2. Database: migrations, stable IDs, indexes, snapshot publication, and owner-scoped policies.
3. First importer: fixed-revision fixture, CSV parsing, normalisation, validation, and idempotent import.
4. Catalogue: real company pages, patterns, frequency sorting, pagination, and URL filters.
5. Account progress: completion, bookmarks, notes, revision state, and backup round trips.
6. Required accounts: email/password forms and server-side guards are implemented; configure Supabase and verify confirmation, sign-in, and sign-out against a hosted project.
7. Automatic updates: daily source checks, staged publication, failure reporting, and rollback.
8. Additional adapters: supported repositories/APIs and manual problem links.
9. Release: mobile and keyboard checks, privacy information, attribution, monitoring, and production verification.

The first end-to-end feature is: open a company sheet, sort by frequency, open a problem, mark it solved, reload, and retain progress.

Do not implement planners, mock interviews, or AI assistance before the catalogue and progress flows are reliable.
