# Private question notes

Question notes on company and pattern sheets share one record per student and question. Saving creates or updates that record; saving an empty note removes it. Successful saves invalidate the Notes page so navigation shows the current content.

The Notes page lists all accessible notes belonging to the signed-in student, newest edits first, in pages of 24. Pagination replaces the old 100-note cap. Notes remain private through the authenticated database role and owner policies. The page provides the question title, full note text, a link to the problem, and a link to find it in practice.

Each card footer also has a Delete note button. It asks for confirmation inline ("Delete this note?" with Delete and Cancel) so a stray tap never removes anything, and Escape backs out. Confirming runs the `deleteNote` server action, which issues the same owner-scoped delete as saving an empty note, revalidates the Notes page plus the company and pattern layouts (their `has_note` flags change), and refreshes the route so the card disappears. On failure the confirm state stays open with the error, so the action can be retried.

Note cards are compact and collapsed by default. Use View note to expand the saved message and Hide note to collapse it again. The native disclosure supports keyboard navigation.

## First release: search and shared editor

Search question titles or note content from the notebook. The search is case-insensitive and literal, runs inside the authenticated owner policies, and includes every saved note, including pages not currently displayed. Search and page parameters stay in the URL. Empty results offer Clear search, and cards keep their content collapsed.

Edit note opens an accessible native dialog with the same editor used inline in company and pattern rows. Optional templates append Approach / Why it works / Complexity / Edge cases or Mistakes / Corrections / Lessons without replacing existing writing. Choose a code language and Insert code to wrap a selection or add an empty fenced block. Preview and View note show headings, bullet lists and language-labelled code blocks with Copy code. Raw HTML is displayed literally and never executed. This is a small Markdown subset rather than a rich-text editor.

Edits save after a one-second typing pause. Requests are serialized per editor, coalescing newer typing while a save is in flight. Save now flushes edits; Close saves first and remains open on failure. Saving, Saved, Unsaved changes and retryable errors are visible. Clearing all text deletes the note using the existing action.

Unsaved text is stored in session storage under the student and question. Refreshing or navigating away leaves it recoverable in the same browser tab. Reopening offers Restore draft or Discard draft; a changed saved base is called out before restoration. Drafts are never silently written over the server note. Closing the browser tab ends this recovery session; disabled/full browser storage shows a warning. Successful saves only remove drafts matching the saved text, so a late acknowledgement cannot erase newer typing. Explicit deletion also clears that question's draft in the current tab.

This release uses the existing note table, 50,000-character limit, owner policies and save/delete actions; no migration or new service is needed. Run `pnpm test:notes` for editor and query checks. Disposable database checks are included in `pnpm db:test`.
