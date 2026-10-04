import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, StickyNote } from "lucide-react";
import { withStudentDatabase } from "@/lib/database/server";
export const metadata: Metadata = { title: "Notes" };
export default async function Page() {
  const notes = await withStudentDatabase(
    async (client) =>
      (
        await client.query<{
          id: string;
          title: string;
          canonical_url: string;
          content: string;
        }>(
          `select q.id,q.title,q.canonical_url,n.content from public.notes n join public.questions q on q.id=n.question_id where n.user_id=private.student_id() and length(btrim(n.content))>0 order by lower(q.title),q.id limit 100`,
        )
      ).rows,
  );
  return (
    <>
      <header className="launch-page-heading">
        <span className="launch-eyebrow">LESSONS WORTH KEEPING</span>
        <h1>Your private notebook.</h1>
        <p>
          Your approaches, edge cases, and reminders. Add or edit a note beside
          any question in a company or practice sheet.
        </p>
      </header>
      {notes.length ? (
        <div className="launch-notes-grid">
          {notes.map((n) => (
            <article className="launch-note-card" key={n.id}>
              <StickyNote size={19} />
              <h2>{n.title}</h2>
              <p>{n.content}</p>
              <div>
                <a
                  href={n.canonical_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open question <ArrowUpRight size={14} />
                </a>
                <Link href={"/patterns?q=" + encodeURIComponent(n.title)}>
                  Find in practice
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="launch-final">
          <StickyNote size={30} />
          <h2>A space for your next insight.</h2>
          <p>
            Open a question’s notes button to capture what you learned. Your
            saved notes will appear here.
          </p>
          <Link className="launch-button" href="/patterns">
            Find a question <ArrowUpRight size={16} />
          </Link>
        </section>
      )}
      {notes.length === 100 && (
        <p className="mt-6 text-sm text-muted-foreground">
          Showing the first 100 notes in title order. All your notes remain
          available beside their questions.
        </p>
      )}
    </>
  );
}
