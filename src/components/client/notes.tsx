"use client";
import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ArrowUpRight, StickyNote, Search, Pencil } from "lucide-react";
import type { NotePage } from "@/features/notes/queries.mjs";
import {
  useClientResource,
  type JsonData,
} from "@/lib/client/use-client-resource";
import { ResourceState } from "@/components/feedback/resource-state";
import { DeleteNoteButton } from "@/components/notes/delete-note-button";
import { Button } from "@/components/ui/button";
import { NoteContent } from "@/components/notes/note-content";
const NoteDialog = dynamic(
  () =>
    import("@/components/notes/note-dialog").then(
      (module) => module.NoteDialog,
    ),
  { loading: () => <p role="status">Loading editor…</p> },
);

function NoteCard({ note: n }: { note: JsonData<NotePage>["rows"][number] }) {
  const [editing, setEditing] = useState(false);
  return (
    <article className="launch-note-card">
      <header className="note-card-heading">
        <StickyNote size={17} aria-hidden="true" />
        <h2>{n.title}</h2>
      </header>
      <time className="prep-note-updated" dateTime={n.updated_at}>
        Updated {new Date(n.updated_at).toLocaleDateString()}
      </time>
      {n.tags.length > 0 && (
        <ul className="prep-note-tags" aria-label="Note tags">
          {n.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      )}
      <details className="note-disclosure">
        <summary>
          <span className="note-view-label">View note</span>
          <span className="note-hide-label">Hide note</span>
          <span className="sr-only"> for {n.title}</span>
        </summary>
        <NoteContent content={n.content} />
      </details>
      <div>
        <a href={n.canonical_url} target="_blank" rel="noopener noreferrer">
          Open question <ArrowUpRight size={14} />
        </a>
        <Link href={"/patterns?q=" + encodeURIComponent(n.title)}>
          Find in practice
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="compact"
          onClick={() => setEditing(true)}
        >
          <Pencil size={14} aria-hidden="true" /> Edit note
          <span className="sr-only"> for {n.title}</span>
        </Button>
        <DeleteNoteButton questionId={n.id} title={n.title} />
      </div>
      {editing && (
        <NoteDialog
          questionId={n.id}
          title={n.title}
          content={n.content}
          tags={n.tags}
          onClose={() => setEditing(false)}
        />
      )}
    </article>
  );
}
export function ClientNotes({
  requested,
  query = "",
}: {
  requested?: string;
  query?: string;
}) {
  const router = useRouter();
  const params = new URLSearchParams({ page: requested ?? "1" });
  if (query) params.set("q", query);
  const resource = useClientResource<JsonData<NotePage>>(
    "/api/notes?" + params,
  );
  const data = resource.data;
  function pageHref(page: number) {
    const next = new URLSearchParams({ page: String(page) });
    if (query) next.set("q", query);
    return "/notes?" + next;
  }
  return (
    <>
      <header className="launch-page-heading">
        <h1>Your private notebook.</h1>
        <p>
          Capture your approach, mistakes, and code. Your notes stay connected
          to each question across company and pattern pages.
        </p>
        {data && (
          <p className="text-sm">
            {data.total} {query ? "matching" : "saved"}{" "}
            {data.total === 1 ? "note" : "notes"} · Recently updated first
          </p>
        )}
      </header>
      <form
        className="prep-note-search"
        role="search"
        action="/notes"
        onSubmit={(event) => {
          event.preventDefault();
          const value = String(new FormData(event.currentTarget).get("q") ?? "")
            .trim()
            .slice(0, 200);
          router.push(
            value ? "/notes?" + new URLSearchParams({ q: value }) : "/notes",
          );
        }}
      >
        <label className="sr-only" htmlFor="notes-search">
          Search notes
        </label>
        <Search size={18} aria-hidden="true" />
        <input
          key={query}
          id="notes-search"
          name="q"
          type="search"
          maxLength={200}
          defaultValue={query}
          placeholder="Search titles, content, or tags…"
        />
        <Button type="submit">Search</Button>
        {query && (
          <Link className="prep-note-clear" href="/notes">
            Clear search
          </Link>
        )}
      </form>
      {!data ? (
        <ResourceState title="Your notes" {...resource} />
      ) : data.rows.length ? (
        <div className="launch-notes-grid">
          {data.rows.map((note) => (
            <NoteCard key={note.id} note={note} />
          ))}
        </div>
      ) : (
        <section className="launch-final">
          <StickyNote size={30} aria-hidden="true" />
          <h2>
            {query ? "No matching notes." : "A space for your next insight."}
          </h2>
          <p>
            {query
              ? "Try another question title or a phrase from your note."
              : "Open a question’s notes button to capture what you learned. Your saved notes will appear here."}
          </p>
          <Link className="launch-button" href={query ? "/notes" : "/patterns"}>
            {query ? "Show all notes" : "Find a question"}{" "}
            <ArrowUpRight size={16} />
          </Link>
        </section>
      )}
      {data && data.pages > 1 && (
        <nav
          aria-label="Notes pages"
          className="mt-8 flex flex-wrap items-center justify-center gap-5"
        >
          {data.page > 1 && (
            <Link className="launch-secondary" href={pageHref(data.page - 1)}>
              Previous
            </Link>
          )}
          <span className="text-sm text-muted-foreground">
            Page {data.page} of {data.pages}
          </span>
          {data.page < data.pages && (
            <Link className="launch-secondary" href={pageHref(data.page + 1)}>
              Next
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
