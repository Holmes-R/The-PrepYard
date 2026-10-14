# Daily practice dashboard

The dashboard focuses on the next practice session. It keeps the charcoal theme, Inter typography, white primary button and mint/blue accents used elsewhere in PrepYard.

## What students see

- **Practice now:** the single primary header action opens the practice page.
- **Continue practising:** three recently updated questions, showing their status, difficulty and date. These are actual progress updates, not a claim that an unfinished session or timer was saved.
- **Revision queue:** the three earliest due questions with the student's last saved confidence rating: Struggled, Tough, Got it or Nailed it. Dates use India time. Future revisions are excluded. View revisions opens the practice list with revision ordering.
- **Three compact statistics:** questions solved with difficulty counts; revision due; saved notes. The completion percentage sits under solved questions and explicitly refers to attempted questions, rather than the whole catalogue.
- **Practice collections:** small cards with a short purpose, solved count, progress bar and Open button. About this collection reveals its description and who it suits. How collections work explains shared progress and the Hotlist's changing membership.
- **Weekly revision activity:** seven daily counts, with a text equivalent for assistive technology. No solve streak or practice time is invented from revision events.
- **Recent practice history:** an expandable list appears when more than three recent questions are available.

Sync accounts is in the desktop account dropdown and the mobile navigation's account section. Log-out confirmation remains available. Account dropdowns close on outside click, Escape or navigation; Escape returns focus to the account control.

## Layout and accessibility

Desktop uses three summary cards and a two-column practice/revision section. Mobile puts practice and revision before statistics, then stacks collections and activity. Titles wrap, controls have at least 44px touch targets, focus is visible, and difficulty/confidence have text labels as well as colour. Full collection explanations remain accessible through native keyboard-operable details controls. Dashboard cards stay still instead of inheriting landing-page hover lifts or scroll animations.

## Data and access

The authenticated dashboard endpoint keeps private, no-store responses and the existing restricted database role. Recent questions and due revisions are fetched together in one database statement; the dashboard still uses four catalogue reads for statistics, collections, practice/revisions and weekly activity. Personal data is not shared or cached globally.

Both lists exclude unlisted and unresolved paid questions. Reviewed free alternatives retain the stable question ID. Questions open the matching pattern or company view when available; company links preserve an available observation window. A standalone question uses its exact practice-platform URL in a new tab.

This redesign requires no database migration. Restart the app after updating. Run `pnpm test:dashboard:database` against an explicitly configured migrated disposable loopback `_test` database to verify due ordering, limits, confidence, owner isolation, free alternatives, destination windows and empty states. The fresh-database CI runner includes this check.
