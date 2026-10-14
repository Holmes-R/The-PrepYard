# Free practice destinations

Both company and pattern queries use the same reviewed catalogue relation. Search, difficulty filters, sorting, topic counts, company difficulty totals, collection counts and pagination use the displayed exercise. IDs and company-frequency observations are never rewritten; only equivalent problems keep those associations. Pattern membership still uses the original URL internally, which is stripped from returned rows.

## Current coverage

10 reviewed free equivalents cover standard intervals, prefix sums, BST subtrees, linked-list carry, tree boundaries, island shapes, minimum merge costs, three-array intersection and sorted-matrix medians. Free access can change; review the destinations before deploying refreshed mappings. This release does not claim all paid problems have alternatives.

Questions lacking a verified equivalent are withheld from company/pattern browsing, rather than silently changed to a different task. Existing accounts, notes, progress and revision history are not deleted. Notes on withheld exercises can still be edited/deleted; their unavailable practice links are omitted. LeetCode syncing still records LeetCode submissions. After the account-sync migration, a connected public GeeksforGeeks account can also complete reviewed GFG alternatives under the same stable question ID. HackerRank and CodeChef completions remain manual; see [Sync accounts](sync-accounts.md).

NeetCode is excluded from practice browsing, search, counts and dashboard suggestions. Its five former alternatives have been removed. Their original paid LeetCode questions stay withheld until a supported free equivalent is independently reviewed. Historical notes, completion and revision records remain intact; notes do not link to removed destinations. No database deletion or migration is needed.

## Operator workflow

1. Run `pnpm practice:audit --directory "PATH_TO_PINNED_SNAPSHOT"`. The importer validates the supported company snapshot hashes. The internal report includes roadmap and practice collections too.
2. To refresh access metadata, add `--refresh`. Only public access metadata is fetched, never paid statements or user sessions. Failed/invalid responses preserve the previous access artifact.
3. Read `scripts/practice/audit-report.json` for pending exercises. Search public practice judges and compare task, outputs, constraints and edge cases. Verify free submission access, not just a free editorial.
4. Add a reviewed mapping in `src/features/questions/reviewed-alternatives.json` with source slug, destination title/URL/platform/difficulty, `match: equivalent`, `free_submission: true`, review date and short review notes. Metadata and review notes stay internal. Allowed destinations currently include GFG, HackerRank and CodeChef.
5. Run `pnpm practice:check-links`, `pnpm test:practice`, `pnpm typecheck` and `pnpm build`. A link response is only a reachability check; it cannot certify free access or equivalence. Re-review sign-in/paywall flows manually when needed.
6. Regenerate the full audit report, review the Git diff and deploy. These mappings require no database migration.

Do not promote merely similar problems. Examples rejected during review: GFG's exactly-K-unique substring task is different from at-most-K; GFG's grouping-ones task returns -1 for an all-zero array instead of the original zero; a three-digit Armstrong checker is insufficient for arbitrary-length numbers.
