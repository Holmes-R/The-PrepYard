# LeetCode completion sync

## Student setup

Open **Dashboard → LeetCode sync** (the `/settings` page), enter the username from your public LeetCode profile, and select **Connect profile**. The app checks immediately, then every two minutes while a signed-in PrepYard tab is visible and online. **Sync now** shares the same database-enforced two-minute cooldown. Pause/resume or disconnect from this page; disconnect keeps existing progress and notes.

The adapter fetches the latest 20 publicly visible Accepted submissions. This is a recent-submission sync, not a complete historical import, account-ownership verification, or immediate live detection. It does not require or collect LeetCode passwords, cookies, private submission details, or solution code. A private/unavailable profile, upstream rate limit, or network failure leaves progress unchanged. Only existing, listed LeetCode questions can be matched.

Checks happen while PrepYard is open. Closing all tabs stops them. No cron job or paid third-party service is required. If many new submissions fall outside the latest 20 before the next successful check, those older submissions can be missed.

## Deployment

1. Apply `supabase/migrations/20261010001400_leetcode_sync.sql` after all earlier migrations, using the database operator's SQL editor or your existing migration workflow. The restricted application's `prepyard_web` role cannot apply schema migrations.
2. Build/deploy the application normally. No additional environment secrets or libraries are needed.
3. Connect a public profile on `/settings`, solve a listed question on LeetCode, wait for it to appear in the public recent Accepted list, and select **Sync now** once the cooldown expires.
4. Confirm the question's completion checkbox and dashboard totals update. Confirm notes and revision ratings are preserved. Repeat the sync to confirm it makes no additional changes.

The LeetCode GraphQL interface is undocumented and can change or block requests. Requests use the fixed `https://leetcode.com/graphql/` endpoint, no redirects, a ten-second timeout, a bounded result size, and strict response validation. There is no CAPTCHA bypass, copied browser session, or third-party proxy fallback. HTTP/browser tests use an independent fixture; deployment should also be checked against a real public profile from the hosting environment.

## Data and access

`leetcode_sync_settings` stores an owner-selected username, enabled state, connection version, cooldown timestamp and last sync result. `leetcode_sync_receipts` records matched submission IDs to make imports idempotent. Both tables use row-level policies based on the verified server session. Anonymous access is denied; a username selects a public profile and is not an authentication identity.

The server derives the student from Auth.js, claims a cooldown slot atomically, fetches outside a database transaction, then locks/rechecks the connection version before applying changes. Changing usernames, pausing or disconnecting cancels older in-flight imports. Newly seen matched submissions and completion changes commit together. Updates touch only the `status` field; bookmarks, confidence, reminders and notes are preserved.

Existing receipts prevent repeated imports from undoing a manual uncheck. A new Accepted submission for that question can mark it solved again. Changing/disconnecting the linked profile clears its receipt ledger, so reconnecting starts a fresh recent-submission import. This behavior is intentional; previously saved progress is retained.

SWR and a scoped browser event refresh active views. Open company sheets and topic accordions reload their local rows; inactive panels discard stale rows. Same-account open tabs receive a BroadcastChannel notification. Checks are skipped in hidden/offline tabs, and a per-account database cooldown coalesces concurrent tabs.

Run `pnpm test:leetcode` for parser/request checks. Database/HTTP/browser verification should use an isolated PostgreSQL test database; never point test fixtures at a hosted application database.

## Suggested notes improvements

Start with optional **Approach / Why it works / Complexity / Mistakes / Edge cases** templates, searchable notes with topic/pattern filters, and code blocks with a language selector and copy button. Add debounced autosave with a saved indicator and recoverable drafts after that. Later additions can include note version history, revision-linked reminders, pinned notes, and Markdown export. Keep notebook cards compact and the note body behind **View note**, as in the current UI.
