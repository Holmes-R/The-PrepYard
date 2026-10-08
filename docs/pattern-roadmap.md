# Pattern learning roadmap

The Patterns browser and Pattern dropdown follow all 22 numbered sections of [Kushal Vijay's DSA Patterns Roadmap](https://github.com/KushalVijay/DSA-Patterns-Roadmap), pinned at commit 9adff6cf5d8e3559b64368b1de42972a17709a17. The checked-in reference manifest records the README checksum and resolves 180 exercise entries to canonical platform URLs. Repeated exercises intentionally belong to more than one pattern. No problem statements, solutions, or explanation text are copied.

Pattern pages prioritize the reference exercises in their listed order, followed by other visible catalogue questions that match the platform's verified topic tags or existing reviewed pattern mappings. Difficulty, revision, custom column sorting, shuffle, topic filters and collection filters remain available. A selected collection keeps its own recommended order. User progress, notes, and revision events continue to use the original question IDs.

All 22 pattern cards and dedicated routes are defined in code, including specialized groups that cannot be inferred safely from a broad platform tag. Their specialized membership uses the resolved reference exercises. The list does not require a database migration or an administrator connection. Pages only show existing listed questions accessible under the student's database policies; this is not an importer for unavailable exercises. Empty groups remain navigable with the normal empty-state UI. New catalogue imports appear automatically when their URL, reviewed mappings, or verified tags match a group.

The older Binary Search slug redirects to Modified Binary Search. Other existing pattern tag links remain valid. Standard DSA topic order and the practice collections are unchanged. Reference provenance stays in developer documentation and the checked-in manifest; students see generic algorithm names and numbered cards.

Explicit title aliases resolve shorthand such as BT/BST, stock names, and the roadmap's Minimum Time to Arrive on Time to the canonical Minimum Speed to Arrive on Time problem. Range Sum Query 2D resolves to the immutable prefix-sum version. Maximum Sum Subarray of Size K resolves to the equivalent GeeksforGeeks exercise. Revisit these reviewed aliases when updating the pinned source.

Run `pnpm test:patterns` for manifest/query regression checks. Run `pnpm test:roadmap:database` against a migrated isolated loopback database ending in `_test`, configured through `PREPYARD_AUTH_TEST_DATABASE_URL`, to verify actual SQL ordering, group membership and private user state.
