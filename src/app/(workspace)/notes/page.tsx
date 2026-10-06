import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, StickyNote } from "lucide-react";
import { withStudentDatabase } from "@/lib/database/server";
import { studentNotes } from "@/features/notes/queries.mjs";
import { DeleteNoteButton } from "@/components/notes/delete-note-button";
export const metadata: Metadata = { title: "Notes" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const params = await searchParams;
  const requested = Array.isArray(params.page) ? params.page[0] : params.page;
  const {
    rows: notes,
    total,
    page,
    pages,
  } = await withStudentDatabase((client) => studentNotes(client, requested));
  return (
    <>
      <header className="launch-page-heading">
        <span className="launch-eyebrow">LESSONS WORTH KEEPING</span>
        <h1>Your private notebook.</h1>
        <p>
          Your approaches, edge cases, and reminders. Add or edit a note beside
          any question in a company or practice sheet.
        </p>
        {total > 0 && (
          <p className="text-sm">
            {total} {total === 1 ? "saved note" : "saved notes"} · Recently
            updated first
          </p>
        )}
      </header>
      {notes.length ? (
        <div className="launch-notes-grid">
          {notes.map((n) => (
            <article className="launch-note-card" key={n.id}>
              <header className="note-card-heading">
                <StickyNote size={17} aria-hidden="true" />
                <h2>{n.title}</h2>
              </header>
              <details className="note-disclosure">
                <summary>
                  <span className="note-view-label">View note</span>
                  <span className="note-hide-label">Hide note</span>
                  <span className="sr-only"> for {n.title}</span>
                </summary>
                <p>{n.content}</p>
              </details>
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
                <DeleteNoteButton questionId={n.id} title={n.title} />
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
      {pages > 1 && (
        <nav
          aria-label="Notes pages"
          className="mt-8 flex flex-wrap items-center justify-center gap-5"
        >
          {page > 1 && (
            <Link
              className="launch-secondary"
              href={"/notes?page=" + (page - 1)}
            >
              Previous
            </Link>
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} of {pages}
          </span>
          {page < pages && (
            <Link
              className="launch-secondary"
              href={"/notes?page=" + (page + 1)}
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
