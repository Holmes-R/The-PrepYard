# Faster catalogue reads

PrepYard uses its existing Next.js, SWR and PostgreSQL stack. These improvements need no new service or database migration.

## Company questions

A company sheet previously made six catalogue queries for identity, windows, topics, totals, solved totals and question rows. It now makes two on a cold cache: one for shared company metadata and one for the filtered counts and rows together. A warm cache needs only the latter query. Authentication, role checks and transaction setup are additional database operations and remain enforced.

The combined query joins the current student's progress once, calculates counts and the clamped page from the same database snapshot, and fetches topic/pattern/company tags only for the 50 visible rows. Notes still load on demand, rather than sending full note text with every question.

## Shared metadata

An in-memory cache holds company directory counts, company topics/windows, pattern choices, collection names and topic-picker counts. Entries expire after 60 seconds and refresh on the next read. At most 128 entries are retained; concurrent misses share one load. Each process has its own cache, scoped to its database target. Restarting or redeploying clears it. Published catalogue changes can take up to 60 seconds to appear in metadata; this is not an instant cross-server invalidation system.

Every cache access remains behind sign-in and the restricted student database transaction. The cache accepts only an allowlist of catalogue fields. Sessions, user IDs, solved counts, progress, revisions, note text and note tags are never shared. Directory solved counts and pattern-group progress are read afresh for the current student and merged after reading metadata. API responses retain `Cache-Control: private, no-store` and `Vary: Cookie`.

## Check where time is spent

1. Restart the app, open browser developer tools and select **Network**.
2. Open a company sheet, change a filter, then select its `/api/companies/<slug>` request. For other pages, select their authenticated data request.
3. Inspect **Server-Timing** under response headers (or the browser's Timing view). It contains total handler time (`app`), authentication (`auth`), pool checkout (`pool`), database queries (`db`) and catalogue cache hit/miss/wait counts.
4. Compare the first and subsequent requests for the same company. The cached request should have one fewer catalogue query. Query counts include authentication, role checks and transaction statements too.
5. Optionally set `PREPYARD_PERFORMANCE_LOG=1` locally or in your deployment environment and restart. Structured logs include a fixed endpoint label, response status, durations and counters; they exclude SQL, query parameters, credentials and note contents. Remove the setting to stop logging.

Durations are milliseconds and overlap: for example, authentication can itself query PostgreSQL. Do not add all durations together. The header measures the API handler, not browser rendering, middleware or the entire page load. Actual latency depends on network distance, connection waits, data volume and query plans; no fixed speedup is promised.

## Validation

`pnpm test:performance` checks cache expiry, bounded eviction, concurrent loads, failure retries, mutation protection, private-field rejection and isolated timing counters. `pnpm test:performance:database` uses an explicitly configured disposable loopback database to check two students sharing metadata while keeping progress/notes/revisions separate, plus fresh counts and pagination. Existing company difficulty, sorting and free-alternative database tests verify compatibility.

If requests remain slow, use these timings to choose the next fix: inspect slow SQL with `EXPLAIN (ANALYZE, BUFFERS)` on a test database, check deployment/database regions, and review connection waits before changing pool limits or adding indexes. Moving work to the browser alone does not reduce database latency.
