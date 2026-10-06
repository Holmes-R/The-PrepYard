# DSA topics and pattern practice

`/patterns` is a dedicated, authenticated practice sheet. Standard DSA subjects are
the accordion headings; problem-solving patterns are clickable question tags and a
separate filter. It does not use the company-page component or company grouping.

## Student workflow

1. Open Patterns after signing in.
2. Search, or narrow by difficulty, topic, pattern, progress state or practice
   collection. Apply filters. Filters are stored in the URL and survive reloads.
3. Expand a topic to load its questions, 30 at a time.
4. Open a question on its platform; mark it solved, bookmark it, add a revision flag
   for tomorrow, or edit a private note.

Global and topic progress count unique questions in the filtered result. Each
question has one primary teaching topic and any number of pattern tags. Student
state is stored under the canonical question ID and shared with other practice views.
No source URLs, dataset dates, import logs or operational history are sent to the UI.

## Filters

The filter panel is one GET form, so every control round-trips to a bookmarkable URL
and nothing lives only in the browser.

- **Search** matches question titles _and_ topic names, which is why the placeholder
  says "Filter problems or topics". Topic matching uses an `exists()` rather than a
  second join: a question has exactly one primary topic, so joining on any other
  topic's name would duplicate rows.
- **Difficulty** is a segmented control (All / Easy / Medium / Hard) rather than a
  select, because it is the filter used most often and one click beats one click plus
  a menu.
- **Topics** are chips carrying the number of matching questions, taken from the same
  grouped query that renders the accordions. A chip never advertises a count for a
  topic with no matching questions. Twelve are shown, with a `+N more` control; the
  selected topic is always visible even when it sits past that limit.
- **Random** shuffles via `order by random()`, which is re-evaluated per query, so
  reloading the same URL reshuffles. It is a toggle, because there is no Order control:
  without the toggle, turning shuffle on would be a one-way door out of the
  recommended order. It is a link rather than a submit button so it does not round-trip
  the form or discard whatever is typed in the search box.
- **Hide topics** suppresses the pattern tags on each row. It is a view preference, but
  it lives in the URL so it survives a filter change like everything else.
- **Progress** offers Unsolved, Solved and Bookmarked. Needs revision was removed
  along with the Order control; the revision state itself still exists and is still
  scheduled from company sheets.

There is no Order control. Two orders exist: the recommended one, which leads with the
reader's position in the selected practice collection, and the shuffle. Both the
allowlist and the SQL reflect that, so `?sort=title` and `?sort=difficulty` fall back
to recommended rather than silently sorting.

Difficulty and progress are allowlisted; slugs must be slug-shaped; the search term is
trimmed and capped. Filter values are always bound parameters, and every statement
binds exactly as many parameters as it references.

Completion toggles answer optimistically and reconcile on the server round-trip.
Success shows a self-dismissing `role="status"` confirmation; failures use
`role="alert"`. List rows carry only whether a private note exists; content loads
from `/api/notes/{questionId}` when the editor opens. Topic fetches go through one
shared callback so opening a topic fires a single cancellable request. The shuffle
control is a real `<button aria-pressed>`, and the topic overflow is a single toggle
with `aria-expanded` and `aria-controls`.

## Layout and question rows

The sheet spans the full application width rather than the narrow reading column, so
the filter panel has room for the topic chips without wrapping on a laptop.

Each row shows completion, the problem title linking straight to the platform, a
LeetCode topic column beside difficulty, optional pattern tags, the platform,
difficulty and notes plus revision controls. The problem title is the primary
affordance and carries an external-link indicator.

The topic column shows the primary LeetCode topic with a count for the rest; the
full list is in the accessible name and on hover, since a narrow column cannot fit
it. Below the tablet breakpoint the column hides and the full tag list returns, so
touch users never depend on hover. "Hide topics" removes the column (and the
fallback tags) and the grid collapses back to four tracks.

Frequency is no longer shown. It was a company-reporting percentage, which is a
different question from whether a DSA topic has been practised, and it required a
correlated subquery per row against `company_question_observations`. Company sheets
keep their own windowed percentage.

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
- `src/components/sheets/revision-dialog.tsx`: confidence rating plus revision
  history in a native dialog; per-pattern colours live in
  `src/lib/pattern-colour.ts` so both sheets agree.
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

Question rows offer completion, private notes and revision. Bookmark controls are removed. Each row shows verified pattern tags; questions awaiting classification show "Pattern pending". The per-row frequency column was removed; company rows retain their selected-window percentage.

The revision button opens a native `<dialog>` with Add Revision and History tabs.
Add Revision asks for a confidence rating — Struggled, Tough, Got it, Nailed it,
stored as `user_question_state.confidence` 1–4 — and Mark as Revised stays disabled
until one is chosen. Saving also schedules tomorrow's reminder
(`next_revision_at`) and appends a `practice_events` row of type `reviewed`, all in
one transaction; this action only inserts history, and owner access policies keep it private.
The History tab lists those entries newest-first and lazy-loads on selection. Each new history entry stores its selected confidence in `practice_events.confidence`, added by migration `20261006001000_revision_confidence.sql`. Older entries remain null and display "Rating not recorded"; their ratings cannot be recovered from the latest question state.

The Topic column sits beside Difficulty on desktop. On narrow screens it wraps below the question title, keeping both revision and notes buttons reachable. Hiding topics removes that column. Confidence selection supports arrow keys; the dialog supports Escape, focus trapping, loading states and history retry.

The Topic column uses the populated `question_dsa_topics` / `dsa_topics` classification, not the optional imported `question_topics` table. Revision and Notes have separate columns. History displays the rating selected for each revision together with its date and time.
