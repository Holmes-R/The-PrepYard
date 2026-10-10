# LeetCode completion sync

PrepYard supports two complementary methods. **Public username syncing** is enabled by default after connecting and tracks only new public Accepted submissions made after connection. It checks the latest 20 submissions without importing older solves. **The Chrome/Edge browser extension** imports the complete solved-question list, including older solves, from your own signed-in LeetCode tab. Both update the same per-user question status, so completion appears in company sheets, topic groups, pattern pages and dashboard totals.

Full history means the set of questions you have solved. It does not import solution code, failed attempts, every repeated submission, or a historical submission timeline.

## Student setup: automatic new solves (no extension)

1. Open **Dashboard → LeetCode sync** (`/settings`), enter your public LeetCode username and select **Enable automatic sync**. This enables checks by default; no extension, password or API key is needed.
2. Submit a solution on LeetCode. PrepYard only marks a matching question solved after LeetCode returns **Accepted**, with a submission timestamp later than when you connected. Viewing, running examples, pending judgments and failed submissions do not mark completion. Previously accepted solves remain unchanged.
3. Keep PrepYard open and return to it after solving. While a signed-in tab is visible and online, checks run at most every two minutes. Completion refreshes in company and pattern pages without a reload. Public feed delays or an unavailable/private profile can delay or prevent an update; this is periodic syncing, not instant push notifications.
4. Use **Pause sync**, **Resume sync** or **Disconnect** when needed. Pausing/resuming or reconnecting the same username retains the original tracking start. Changing the username or disconnecting and reconnecting starts a new tracking window.

## Optional student setup: complete history

1. Open **Dashboard → LeetCode sync** (`/settings`), enter your LeetCode username and select **Enable automatic sync**.
2. Select **Download browser extension** and extract the ZIP into a folder you will keep. Alternatively, use this repository's `extensions/leetcode-sync` folder directly.
3. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge. Turn on **Developer mode**, choose **Load unpacked**, and select the folder containing `manifest.json`.
4. Open LeetCode and PrepYard in the **same browser**, and sign in to both. Keep both tabs open. LeetCode must be signed in to the username linked in PrepYard.
5. Open the extension from the browser toolbar. Enter only your PrepYard origin (for example, `http://localhost:3000` or `https://your-prepyard-site.com`). Select **Connect & sync all history**, then allow access to that specific site.
6. The first import checks the complete solved list against LeetCode's solved count. If the counts disagree, it reports an incomplete response and imports nothing. The result shows how many solves matched PrepYard. `/settings` also shows the last full-history check and counts.
7. The extension checks every two minutes while the browser runs and both signed-in tabs are open. Browser suspension or network delays may postpone a check. Use **Sync now** in the extension to check manually. **Pause sync** in PrepYard pauses both methods; **Disconnect extension** stops just the extension. **Disconnect** in PrepYard clears the connection and import receipts, keeping saved progress and notes.

This is a sideloaded extension, not a Chrome Web Store listing. Reload the extension on its Extensions page after changing its files. A future public release can package/review the same extension for the stores.

## Public username syncing

The application checks recent public Accepted submissions immediately after connecting and every two minutes while a signed-in PrepYard tab is visible and online. The PrepYard **Sync now** button shares the database-enforced two-minute cooldown. This method requires no extension and ignores submissions at or before the profile connection timestamp. It cannot recover complete older history. An explicit optional extension import is the separate way to include older solves. A private/unavailable profile or upstream failure leaves progress unchanged.

Full-history importing has a separate two-minute cooldown. The extension also requests the public recent-submission check to recognize a newly accepted re-solve after a manual uncheck. The full-history import remains saved if that supplemental check fails.

## Matching, repeated imports and privacy

The server matches canonical LeetCode problem slugs to shared PrepYard question IDs, never question titles. Every solved slug is retained, including questions not currently in PrepYard. Such questions have no visible row until they enter PrepYard's catalogue; the next import can then mark them completed. Importing never creates unreviewed catalogue questions or marks other platforms' similarly titled questions solved.

Only new matches and new Accepted submissions change completion. Repeating the same history is idempotent and preserves a later manual uncheck. Old public submissions already covered by the history import cannot undo that uncheck. A genuinely new Accepted submission can mark the question solved again. Imports merge solves and never reset locally completed questions. Notes, revision confidence, bookmarks and reminders are untouched.

The extension reads LeetCode's existing same-origin browser session without inspecting cookies or passwords. Only username, solved slugs, the total count and a PrepYard connection version are sent to PrepYard. No cookies, solution code, password, or email is transferred. PrepYard authentication remains independent. Browser-host access is granted for LeetCode and the specific PrepYard site chosen by the student; the extension checks the exact origin and connection version before every import. Changing either signed-in account or linked username requires reconnection.

The import endpoint derives the student from the verified PrepYard session, requires same-origin JSON, validates all fields and rejects credential-bearing/partial/malformed payloads. A locked connection row prevents stale account imports and coalesces concurrent imports. Completion and receipts commit atomically. As with manual checkboxes, this is personal tracking, not proof for rankings or assessments: users control their own completion data.

## Deployment

1. Apply `supabase/migrations/20261010001400_leetcode_sync.sql` and then `supabase/migrations/20261010001500_leetcode_history.sql`, after all earlier migrations, using the database operator's SQL editor or the normal migration workflow. The restricted `prepyard_web` application role cannot migrate the schema.
2. Run `pnpm build` and deploy normally. The build creates `public/prepyard-leetcode-sync.zip` from the fixed extension file list. `pnpm build:extension` creates just the ZIP for local development. No new service, package, API key or environment secret is needed.
3. Follow the student setup above. Solve a known question and confirm completion in company and pattern pages. Check an older solved question absent from the recent 20. Check that notes and revision ratings survive, then repeat the import to confirm idempotency.

The extension uses `https://leetcode.com/api/problems/all/` in the signed-in LeetCode tab; public sync uses `https://leetcode.com/graphql/` on the server. These interfaces are undocumented and can change. Requests have timeouts and strict response validation. Full-history payloads are capped at 20,000 distinct slugs and 4.5 MB; this is an abuse/resource bound, not the public endpoint's 20-submission window. API challenges, sign-in expiry and count mismatches are surfaced rather than bypassed. Do not ask students to copy session cookies into PrepYard.

## Data and verification

`leetcode_sync_settings` stores an owner-selected username, enabled state, connection version, cooldown timestamps and recent/full-history results. Its existing `created_at` timestamp is the start of the current profile binding, exposed as `sync_started_at`; changing usernames resets it, while pause/resume and reconnecting the same username retain it. The server checks this cutoff inside the locked connection transaction, so older public submissions never create receipts or change completion. This change uses existing columns and needs no additional migration. `leetcode_sync_receipts` stores recent Accepted submission IDs. `leetcode_history_questions` stores all imported solved slugs and, once matched, a shared question ID. All tables have owner-only row-level policies and deny anonymous reads. Changing/disconnecting the linked username clears both receipt ledgers but retains completion and notes.

SWR, an extension import event and same-account BroadcastChannel messages refresh active views. Open company sheets and topic accordions reload their rows; closed panels discard stale data. The extension is independent of page rendering and does not slow initial practice-page loading.

Run `pnpm test:leetcode` for independent fixtures, complete-list/count validation, request bounds and origin checks. `pnpm db:test` includes owner-policy checks on a fresh disposable PostgreSQL instance. HTTP/browser integration checks must use isolated test data, never a hosted application database. Fixtures validate the complete-history path beyond 20 solves, account isolation, failure rollback, idempotency and both page types. A real signed-in LeetCode import remains a required deployment smoke check.

## Suggested notes improvements

Useful next additions: optional **Approach / Why it works / Complexity / Mistakes / Edge cases** templates; searchable notes with topic/pattern filters; code blocks with language selection and copy; debounced autosave with a saved indicator and recoverable drafts; note history, revision reminders and Markdown export. Keep notebook cards compact with the note body behind **View note**.
