# Topics, patterns, and practice collections

The existing topic groups, pattern filters, account protection, and tracking controls remain in place. The practice library now has three choices:

- **Interview Launchpad** (interview-launchpad): 66 unique questions from 70 reference entries.
- **DSA Deep Dive** (dsa-deep-dive): 282 unique questions from 287 reference entries, including LeetCode, GeeksforGeeks, and SPOJ links.
- **Interview Hotlist** (interview-hotlist): up to 20 questions per primary DSA topic, ranked dynamically by peak reported company percentage, then company coverage, then stable title/URL ordering.

The first two are renamed, deduplicated reference selections, not original PrepYard-authored sheets. Their references, counts, and checksums are recorded in [collection attribution](collection-attribution.md) and scripts/patterns/collection-provenance.json. No problem statements, solutions, or videos are copied.

## Update Supabase

1. With existing migrations through revision confidence already applied, run the entire scripts/patterns/publish-prepyard.sql file in Supabase SQL Editor. It includes migration 13, removal of all retired collection memberships, new memberships, topic tags, and access policies in one transaction. It is safe to repeat.
2. Alternatively apply all pending migrations, set IMPORT_DATABASE_URL to your administrator connection in the operator environment, and run pnpm patterns:publish. The runtime DATABASE_URL remains the restricted application account.
3. Restart the application if necessary and open /explore or /patterns?collection=interview-launchpad. Collections are query-string filters on the existing Practice route.

Regenerate the SQL file after manifest changes with pnpm collections:sql. No admin connection is exposed to the browser.

## Frequency behavior

The security-invoker view topic_frequency_questions reads observations permitted by the existing publication RLS policy. Only positive all-time percentages are comparable; unknown, count, score, and shorter overlapping windows are excluded. Each company/question contributes once, using its maximum percentage. The highest company percentage is the displayed peak frequency; company count breaks ties. This is a reported frequency, not an interview probability. Up to 20 are selected within each topic before search, difficulty, progress, or pattern filters. Shuffle changes their order, not membership.

No company publication is required to rebuild the hotlist: changes appear on the next request. Topics without eligible observations do not receive invented rankings. Archived, unapproved, private, or unlisted data are excluded by existing RLS. Anonymous users cannot query the view. Snapshot metadata is not returned by it.

## Preservation and verification

Replacement deletes only retired collection rows and their memberships. Canonical question UUIDs, progress, private notes, and revision events remain. A duplicate question in two collections shares tracking. The notes page can still show notes on retired questions.

Run pnpm test:patterns, pnpm test:collections:database, pnpm test:patterns:database, pnpm test:publication:database, and pnpm test:hotlist:database. Database tests require a migrated isolated loopback database ending in _test, configured through PREPYARD_AUTH_TEST_DATABASE_URL. They verify exact memberships/order, multi-platform identity, transactional replay, owner privacy, frequency selection and live publication changes.

## Pattern pages and question controls

Every pattern opens its own `/patterns/[slug]` page. Existing `/patterns?pattern=...` links redirect there with their filters preserved. Difficulty sorting supports Easy to Hard and Hard to Easy; Revision priority orders due questions, lower-confidence choices, upcoming reminders, then unreviewed questions. User state remains private. Unknown pattern names render the not-found page with noindex metadata. Next.js may send HTTP 200 when the response has already started streaming.

Both company and practice rows use icon-only revision and note actions with hover labels and keyboard focus. Revision color reflects Struggled (red), Tough (orange), Got it (yellow), or Nailed it (green). Saved notes highlight blue; empty notes stay muted. Difficulty and topic tags use rounded pills; additional topic tags expand from the +N control. Company difficulty count dots are unchanged. This feature requires no new migration.

## Shared question page controls

Company sheets, standard DSA topic lists, and dedicated pattern pages share the same question filter and header components. The first row offers Question, Difficulty, and Progress. Counted topic chips follow below, ordered by question count, with Show more / Show less expansion. Company topics allow multiple choices, while practice uses one standard DSA topic. Press Apply to apply selections. Less-used controls live under More filters, and Reset restores the defaults.

Question, Difficulty, and Revision headers are clickable on every question list; company lists also offer Frequency. Click a new header to add a sort rule, click it again to reverse direction, and click a third time to remove it. Numbers show priority (1 first); up to three columns can be combined. The first explicit header selection replaces the default ordering. Sorting applies in PostgreSQL before pagination, and priorities remain in the URL using the allowlisted order parameter. Topics is a plain label without sorting; legacy topic-order URL values are ignored. Difficulty leaves unknown values last, and Revision prioritizes due questions, low-confidence choices, upcoming reminders, and unreviewed questions. Revision and Note names remain visible in desktop headers; row actions remain highlighted icons.

On mobile, the same headers become a compact sorting toolbar and rows rearrange into readable cards with 44px action targets. No database migration is required. Focused column sorting tests run with pnpm test:patterns; the isolated database check runs with pnpm test:columns:database after setting PREPYARD_AUTH_TEST_DATABASE_URL to a migrated loopback _test database.
