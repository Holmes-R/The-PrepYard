# DSA topics and pattern practice

`/patterns` is a dedicated, authenticated practice sheet. Standard DSA subjects are
the accordion headings; problem-solving patterns are clickable question tags and a
separate filter. It does not use the company-page component or company grouping.

## Student workflow

1. Open Patterns after signing in.
2. Choose a DSA topic, pattern, difficulty, progress state or practice collection.
3. Apply filters. Filters are stored in the URL and survive reloads.
4. Expand a topic to load its questions, 30 at a time.
5. Open a question on its platform; mark it solved, bookmark it, add a revision flag
   for tomorrow, or edit a private note.

Global and topic progress count unique questions in the filtered result. Each
question has one primary teaching topic and any number of pattern tags. Student
state is stored under the canonical question ID and shared with other practice views.
No source URLs, dataset dates, import logs or operational history are sent to the UI.

## Database and setup

Apply `supabase/migrations/20261004000900_dsa_sheet.sql` after existing migrations.
Then run:

```sh
# Administrative database URL, never NEXT_PUBLIC_ and never the web runtime login.
pnpm patterns:publish
```

The command requires `IMPORT_DATABASE_URL` in its process environment. It does not
read or print credentials. Publication is transactional, takes an advisory lock,
and can be repeated without replacing question identities or student progress.
The LeetCode catalogue must already exist. `scripts/topics/leetcode-topics.json`
supplies question identities and topic metadata; it is read locally with no network
request. Re-run publication after catalogue/topic updates to classify new questions.

`dsa_topics` and `question_dsa_topics` hold primary topic assignments. Existing
`patterns` and `question_patterns` hold reviewed pattern mappings.
`pattern_collections` and `pattern_collection_questions` hold collection membership.
All new tables use RLS, authenticated reads and administrative writes. Student state
and notes use existing ownership policies. Server requests derive identity from
the verified session and use the restricted runtime database role.

## Reference collection

`scripts/patterns/kushal-patterns.json` records the question URLs by slug and the
observed group memberships from the requested Codolio sheet. On 2026-10-04 its 180
entries represented 178 unique LeetCode questions: Bag of Tokens and Missing Number
each appear twice. The displayed title says “20 Essential” but the observed sheet
has additional groups and nested subpatterns; the fixture preserves its leaf groups.
This is a fixed collection, not a claim of automatic synchronization with Codolio.
The source link and verification date remain maintenance metadata. Descriptions,
solutions and source page artwork are not copied.

Topic assignment is deterministic and editable in `scripts/patterns/taxonomy.mjs`.
Specific structures take precedence over broad Array/String tags; reference DP and
graph groups receive their corresponding teaching topic. Unclassified questions
appear under Algorithms. General pattern tags come from platform metadata; the
reference collection supplies its more specific groups. This classification is a
learning organization, not a claim that a question has only one possible solution.

## Implementation

- `src/features/patterns/queries.mjs`: bounded filters, parameterized queries,
  overview counts, deterministic ordering and pagination.
- `src/components/sheets/pattern-sheet.tsx`: independent responsive sheet with
  accessible accordion buttons, progress bars, filters and save feedback.
- `/api/patterns`: authenticated, private/no-store lazy question loading.
- Existing progress action: validates values and question identity, then saves
  student-owned data; invalidates both Companies and Patterns.

Loading, retry, empty-filter and page-error states are included. Questions from
additional platforms can use the same tables and UI when their importer supplies
topic assignments and pattern mappings.

## Validation

Run `pnpm test:patterns` for filter, fixture, taxonomy and query checks.
Run `pnpm test:patterns:database` with `PREPYARD_AUTH_TEST_DATABASE_URL` pointing
to a populated, isolated loopback database ending in `_test` to verify publication,
collection counts and account isolation. This check refuses hosted databases.

## Additional practice collections

The selector now also offers the following verified collections:

| Collection                        | Unique practice questions | Notes                                                           |
| --------------------------------- | ------------------------: | --------------------------------------------------------------- |
| Striver's A2Z — Practice Problems |                       432 | 448 practice entries, deduplicated; excludes 47 theory lessons. |
| Striver's SDE Pattern Sheet       |                       177 | Current 179-entry syllabus, deduplicated.                       |
| NeetCode 150                      |                       150 | Membership from NeetCode's own repository.                      |
| Blind 75                          |                        75 | Membership from the same pinned repository snapshot.            |

Source identities, URLs, counts and hashes are kept in scripts/patterns/collections.json
for maintenance, not shown on the practice page. Striver lists were read from their
public takeUforward syllabus. The NeetCode data is pinned to Git commit
3186ede2ea4c4788e87be4b509bf2b66d5eba0e9. These are fixed reviewed snapshots, not automatic
sheet synchronization. No solutions, videos or lesson text are mirrored.

Questions use their existing LeetCode identity whenever a LeetCode link is supplied.
Other practice problems link directly to takeUforward, using its stable problem ID.
External platforms control their own access requirements. Difficulty is left unrated
when the platform uses levels that cannot be reliably mapped to Easy/Medium/Hard.
Progress, bookmarks and notes are shared by canonical question identity across sheets.

Run pnpm collections:publish with IMPORT_DATABASE_URL to publish only these four
collections. The existing pnpm patterns:publish now publishes both the original
pattern catalogue and these collections. No additional migration is required.
Publication validates the fixture before writing, resolves identities, and replaces
collection membership atomically without deleting question identities or student data.
The recommended order uses the selected collection's own positions.

Tests: pnpm test:patterns; pnpm test:collections:database against the same populated,
isolated loopback test database described above.

## Question row controls

Question rows offer completion and private notes. Revision and bookmark controls are removed. Each row shows verified pattern tags; questions awaiting classification show “Pattern pending”. Frequency is the highest reported all-time company percentage, or — when unavailable. Company rows retain their selected-window percentage.
