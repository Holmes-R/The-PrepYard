# Private question notes

Question notes on company and pattern sheets share one record per student and question. Saving creates or updates that record; saving an empty note removes it. Successful saves invalidate the Notes page so navigation shows the current content.

The Notes page lists all accessible notes belonging to the signed-in student, newest edits first, in pages of 24. Pagination replaces the old 100-note cap. Notes remain private through the authenticated database role and owner policies. The page provides the question title, full note text, a link to the problem, and a link to find it in practice.

Each card footer also has a Delete note button. It asks for confirmation inline ("Delete this note?" with Delete and Cancel) so a stray tap never removes anything, and Escape backs out. Confirming runs the `deleteNote` server action, which issues the same owner-scoped delete as saving an empty note, revalidates the Notes page plus the company and pattern layouts (their `has_note` flags change), and refreshes the route so the card disappears. On failure the confirm state stays open with the error, so the action can be retried.

Note cards are compact and collapsed by default. Use View note to expand the saved message and Hide note to collapse it again. The native disclosure supports keyboard navigation.
