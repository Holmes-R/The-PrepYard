import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Building2, Layers3, StickyNote } from "lucide-react";
import { requireUser } from "@/lib/auth/server";
import { withStudentDatabase } from "@/lib/database/server";
export const metadata: Metadata = { title: "My dashboard" };
export default async function Page() {
  const user = await requireUser();
  const stats = await withStudentDatabase(
    async (client) =>
      (
        await client.query<{ solved: number; started: number; notes: number }>(
          `select (select count(*)::int from public.user_question_state where user_id=private.student_id() and status='solved') solved,(select count(*)::int from public.user_question_state where user_id=private.student_id() and status='attempted') started,(select count(*)::int from public.notes where user_id=private.student_id() and length(btrim(content))>0) notes`,
        )
      ).rows[0],
  );
  return (
    <>
      <header className="launch-page-heading">
        <span className="launch-eyebrow">YOUR PRACTICE SPACE</span>
        <h1>Welcome back{user.name ? ", " + user.name.split(" ")[0] : ""}.</h1>
        <p>Your next question is waiting. Make a little progress today.</p>
      </header>
      <div className="launch-stats launch-dashboard-stats">
        {[
          [String(stats.solved), "Questions solved"],
          [String(stats.started), "Questions attempted"],
          [String(stats.notes), "Private notes"],
        ].map(([value, label]) => (
          <div key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="launch-library">
        {[
          {
            href: "/companies",
            title: "Prepare for a company",
            text: "Choose a target and prioritize questions by frequency.",
            icon: Building2,
          },
          {
            href: "/patterns",
            title: "Build your understanding",
            text: "Practice by DSA topic, pattern, or curated sheet.",
            icon: Layers3,
          },
          {
            href: "/notes",
            title: "Revisit your notes",
            text: "Keep the approaches and lessons from your practice close.",
            icon: StickyNote,
          },
        ].map(({ href, title, text, icon: Icon }) => (
          <Link className="launch-feature" href={href} key={href}>
            <div className="feature-icon">
              <Icon />
            </div>
            <h3>{title}</h3>
            <p>{text}</p>
            <span className="feature-link">
              Continue <ArrowUpRight size={16} />
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
