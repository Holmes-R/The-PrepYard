# Sync accounts

Open **Dashboard → Sync accounts** (`/settings`). LeetCode and GeeksforGeeks are independent connections with separate usernames, pause/resume, disconnect, cooldown and error status. Connecting does not require a platform password, cookie or solution code. Public username selection is not proof of account ownership.

## Setup

1. Apply `supabase/migrations/20261012001700_account_sync.sql` after the earlier migrations using your normal administrator migration workflow. The app keeps using the restricted `prepyard_web` connection. The migration adds owner-only `account_sync_settings` and `account_sync_seen`; existing LeetCode connections are preserved.
2. Restart the app and open **Sync accounts**.
3. Enter your public LeetCode username in its card. Its existing behaviour remains: check the latest 20 public Accepted submissions; only submissions accepted after connecting count.
4. Enter your GeeksforGeeks profile handle and make the practice profile public. PrepYard first validates a complete public solved list and records it as the baseline. Connecting imports none of those older solves.
5. Solve a new matching question on GFG. While PrepYard is visible and online, checks run every two minutes. **Sync now** uses the same server-enforced cooldown. GFG exercises displayed as reviewed alternatives resolve to the original stable PrepYard question ID, so company and pattern completion stay in agreement.
6. Pause/resume or disconnect each platform separately. Disconnect keeps notes, revisions and progress. Changing usernames creates a new baseline; resuming/reconnecting the same account retains the old baseline.

## GFG behaviour and limits

The directly verified public endpoints are `authapi.geeksforgeeks.org/api-get/user-profile-info/` and `practiceapi.geeksforgeeks.org/api/v1/user/problems/submissions/`. This is an unofficial public-site integration, not a guaranteed supported API. The requests use a fixed allowlisted host, a timeout and a 2 MB response limit. GFG's required public Origin/Referer headers are included; no authentication headers are sent.

The public profile's total must equal the number of unique solved slugs before any write. Private, blocked, truncated, malformed or inconsistent responses leave progress unchanged. Public updates can be delayed. The API's `user_subtime` has no documented timezone contract, so it is not treated as a trustworthy acceptance timestamp: GFG detects problems newly visible after its baseline, whereas LeetCode uses timestamped Accepted submissions. An older solve omitted from an otherwise valid initial public snapshot can later appear new. GFG does not detect a repeated solve of an already observed problem.

Every observed slug is retained, including unmatched questions. A catalogue addition or repeated check does not import old activity or undo a later manual uncheck. A failed transaction rolls back the observed keys and progress together. An account change, pause or disconnect cancels in-flight writes through the binding version and row lock. GFG can match native GFG URLs and reviewed free replacements, never merely similar titles.

NeetCode, HackerRank and CodeChef remain manual in this release, as selected. Their questions and free destinations remain available; use the question checkbox after solving them. No dummy username connections or unsupported automatic-sync promises are offered.

## Checks

- `pnpm test:accounts`: public adapter validation, upstream failures and response bounds.
- `pnpm test:accounts:database`: an explicitly provided migrated loopback `_test` database via `PREPYARD_AUTH_TEST_DATABASE_URL`; baseline isolation, owner RLS, shared completion, state preservation, cooldown and stale-binding/idempotency checks.
- `pnpm db:test`: CI's fresh local database migration runner also includes the account-sync test. Never point this runner at a real project.

The existing LeetCode browser extension and full-history endpoint remain available and independent; see [LeetCode details](leetcode-sync.md).
