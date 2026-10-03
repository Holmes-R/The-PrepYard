# Published company sheets

Students access /companies and /companies/1kosmos after login. Questions come from PostgreSQL using the restricted runtime connection, authenticated role and current student's internal ID. Publication visibility is enforced by row-level policies. The page projects only question fields, platform labels and safe observation columns; source IDs, revisions, dates and logs are never queried by the student catalogue.

Search and difficulty filters use parameterized SQL. Window and sort values are allowlisted. Pages contain at most 50 questions, with stable tie-breaking. Each sheet displays reported percentage frequency for one window; unknown values sort last. If several active sources report the same association, the highest reported percentage is used; values are never summed across windows or mixed with counts/scores. Company tags use the same window and metric and sort by descending frequency. GET filter URLs can be bookmarked. Empty results, unknown companies, loading and database failures have dedicated states.

## Publish the reviewed fixture

Run pnpm import:company to generate staging artifacts. Set IMPORT_DATABASE_URL in the trusted operator's process to the database administrator connection, then run pnpm import:publish --approve-source. This deliberately approves this metadata source for student access; use only after reviewing the fixture and permitted use. Never use a NEXT_PUBLIC variable or put the admin connection in the app runtime DATABASE_URL.

The command stages the fixed fixture if necessary, compares every question/observation against the independently maintained expected.json, validates and publishes through publish_source_snapshot in one transaction. A failure rolls back the entire operation. Repeating an already published, unchanged fixture is safe; archived or rejected snapshots require manual review. Runtime source details remain private. No question statements are copied.

## Verification

On a migrated disposable local `_test` database, set PREPYARD_AUTH_TEST_DATABASE_URL to its administrator connection URL and run `node tests/catalogue/database.mjs`. After building, set PREPYARD_CATALOGUE_TESTS=1 and run `node tests/auth/password-flow.mjs` to verify signed-in HTML, links, filters, not-found pages, metadata hiding and guest redirects. The tests use isolated fixture data; they never connect to the application database.

## Complete directory and reference-style layout

The directory covers all 656 company folders from the pinned repository, with 3,358 distinct questions and 39,353 company/window observations. Search companies by name; directory pages show 25 expandable sections. Questions load on demand, 50 at a time. The dark reference layout includes orange progress bars, green completion controls, colored difficulty labels, golden bookmarks and private notes. The plus button schedules revision for tomorrow. Controls persist to the authenticated student’s existing state and notes tables, with RLS enforcing ownership.

Run `pnpm import:repository --directory PATH` to validate the extracted pinned archive and generate an internal snapshot. Add `--approve-source` and a trusted `IMPORT_DATABASE_URL` to publish the complete repository transactionally. The checked-in repository manifest pins every CSV by its Git blob hash and byte length. Any missing or altered file or conflicting metadata aborts the import. Existing stable question IDs and student records are preserved. Replays must match exactly. Source metadata stays hidden from students.

Run `node tests/import/repository-database.mjs` with `REPOSITORY_DIRECTORY` pointing to the archive and `PREPYARD_AUTH_TEST_DATABASE_URL` pointing to a disposable migrated local `_test` database. This verifies all-company totals, replay stability, rollback on conflicts and authenticated queries.
