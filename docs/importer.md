# Fixed-snapshot company importer

## Implemented scope

The first adapter imports the entire 1Kosmos folder from commit a09d3bae6ecf5420ae59e8886e0f9bf660717388 of cs-satyam/leetcode-companywise-questions. This is intentionally one small company before broadening coverage.

It reads checked-in fixtures offline and produces normalized JSON plus executable PostgreSQL staging SQL. No credentials or additional dependencies are required to generate artifacts. Node's built-in test runner exercises parsing and validation.

## Expected result

| Field                    | Value                                                        |
| ------------------------ | ------------------------------------------------------------ |
| Company                  | 1Kosmos                                                      |
| Platform / problem ID    | LeetCode / 2938                                              |
| Title                    | Separate Black and White Balls                               |
| URL                      | https://leetcode.com/problems/separate-black-and-white-balls |
| Difficulty               | Medium                                                       |
| Acceptance               | 63.9%                                                        |
| all.csv                  | Window all, frequency 100%                                   |
| more-than-six-months.csv | Window older-than-180d, frequency 100%                       |

One question is deduplicated across the two windows. Frequency stays separate per observation. A CSV row position is not assumed to be a frequency rank, so source_rank remains NULL. Dataset date is unknown rather than inferred from the commit.

## Commands

- pnpm import:company: validate fixture, write snapshot.json and stage.sql under artifacts/imports/1kosmos.
- pnpm import:company --out artifacts/imports/review: choose output directory.
- pnpm test:import: offline fixture and malformed-input tests.
- pnpm db:test: on a fresh disposable PostgreSQL instance, run schema policies and then the importer SQL integration suite.

Output files are ignored by Git. All validation completes before artifacts are written. Files in the selected output directory are replaced on a successful generation; do not use that directory for hand-authored documents.

## Validation

The manifest requires the expected repository/company, a full 40-character commit SHA, the complete two-file set, exact filename/window mappings, row counts, and SHA-256 digests. CSV parsing accepts BOM, LF/CRLF, escaped quotes, quoted commas/newlines, and rejects malformed quoting, unexpected headers, and wrong field counts.

Records require a positive numeric problem ID, a canonical LeetCode problem URL, a nonempty title, known difficulty, and bounded percentages. Blank percentages remain NULL/unknown; zero remains zero. Duplicate records within a window and conflicting metadata or URL identities across windows fail the whole import.

Golden expected values are recorded separately in expected.json. Tests compare every normalized question and observation, not just row counts. CSV bytes are excluded from Git newline conversion.

## Database staging

The generated SQL runs in a transaction and serializes matching source imports with a transaction advisory lock. It resolves existing platform/company/question keys, creates a company-scoped source (cs-satyam-1kosmos), and attaches two observations to one commit snapshot.

Source scope is deliberately per company, because marking a repository-wide snapshot complete after importing just one company would be misleading. A future multi-company importer must define its complete snapshot scope explicitly.

Existing metadata must match; the importer never overwrites published question metadata to make a conflict disappear. An exact staged replay creates no duplicate business records. A changed value causes an exception and transaction rollback. Re-import after validation/publication is rejected for explicit review.

New sources remain pending/disabled/private, snapshots remain staged, and new questions remain unlisted. The importer never modifies student records, approves reuse, marks a snapshot validated, or calls the publication function.

The generated JSON retains revision, filenames, checksums, row counts, attribution, and company scope. The current database schema stores source/revision and observations; it does not yet persist per-file hashes or a detailed import audit. Automatic fetching, scheduling, full import-run auditing, and reconciliation are later work.

## Verification

The parser suite covers fixture fidelity, deterministic output, quoting, missing values, hostile URLs, malformed records, checksum drift, missing windows, and cross-window conflicts.

The database integration suite applies the generated SQL twice in the disposable instance, compares stored values to the independent fixture, verifies staged data is hidden from anonymous readers, rejects value/metadata conflicts without changing stored data, and refuses to mutate non-staged snapshots.

The fixtures contain metadata only and preserve attribution. Public publication still requires the source permission review described in the database guide.

## Completion checks

The adapter accepts only the reviewed commit `a09d3bae6ecf5420ae59e8886e0f9bf660717388`, not an arbitrary commit or branch. File ordering in the manifest is normalized. The golden `expected.json` is maintained independently from parser output: compare it directly with the two upstream CSV files at that commit when reviewing updates. Never regenerate the golden fixture from the importer under test.

Tests execute the actual CLI twice and compare both artifacts byte-for-byte. PostgreSQL tests replay the transaction sequentially and concurrently and compare all platform, company, source, snapshot, question and observation rows, including IDs and timestamps. Conflicting platform/company metadata and attribution are rejected atomically alongside question and observation conflicts.
