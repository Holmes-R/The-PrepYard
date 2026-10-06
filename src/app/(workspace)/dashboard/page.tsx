import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCheck,
  Code2,
  History,
  Layers3,
  Play,
  StickyNote,
} from "lucide-react";
import { requireUser } from "@/lib/auth/server";
import { withStudentDatabase } from "@/lib/database/server";
import { dashboardData } from "@/features/dashboard/queries";
export const metadata: Metadata = { title: "My dashboard" };
export default async function Page() {
  const user = await requireUser();
  const { stats, collections, recent, activity } =
    await withStudentDatabase(dashboardData);
  const completion = stats.attempted
    ? Math.round((100 * stats.solved) / stats.attempted)
    : 0;
  const maxActivity = Math.max(1, ...activity.map((day) => day.count));
  const events = activity.reduce((sum, day) => sum + day.count, 0);
  return (
    <div className="prep-dashboard">
      <section className="prep-welcome">
        <div className="prep-welcome-copy">
          <p className="prep-session-label">
            <span />
            YOUR PRACTICE SPACE
          </p>
          <h1>
            Welcome back{user.name ? ", " + user.name.split(" ")[0] : ""}.
          </h1>
          <p>
            {stats.due
              ? `Your revision queue has ${stats.due} questions ready for review. Keep the momentum going.`
              : "Build your confidence, one question at a time. Your next opportunity starts with today’s practice."}
          </p>
          <Link
            href={
              recent[0]
                ? "/patterns?q=" + encodeURIComponent(recent[0].title)
                : "/patterns"
            }
            className="prep-primary"
          >
            Resume practice <ArrowRight size={17} />
          </Link>
        </div>
        <div className="prep-welcome-overview">
          <div className="prep-completion-ring">
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r="40" />
              <circle
                className="prep-completion-ring-value"
                cx="50"
                cy="50"
                r="40"
                strokeDasharray="251.33"
                strokeDashoffset={251.33 * (1 - completion / 100)}
              />
            </svg>
            <div>
              <strong>{completion}%</strong>
              <span>Completion</span>
            </div>
          </div>
          <strong>
            {stats.solved} of {stats.attempted} attempted questions solved
          </strong>
          <p>Progress across your practice</p>
        </div>
      </section>
      <div className="prep-stats">
        <article>
          <header>
            Questions completed
            <CheckCheck size={19} />
          </header>
          <strong>
            {stats.solved}
            <small> / {stats.total.toLocaleString()}</small>
          </strong>
          <p>Across your practice catalogue</p>
        </article>
        <article>
          <header>
            Completion rate
            <BarChart3 size={19} />
          </header>
          <strong>
            {completion}%<small> of attempted</small>
          </strong>
          <div className="prep-difficulty-summary">
            <span className="easy">E: {stats.easy}</span>
            <span className="medium">M: {stats.medium}</span>
            <span className="hard">H: {stats.hard}</span>
          </div>
        </article>
        <article>
          <header>
            Revision due
            <History size={19} />
          </header>
          <strong>
            {stats.due}
            <small> questions</small>
          </strong>
          <Link href="/patterns">
            Review your practice <ArrowRight size={14} />
          </Link>
        </article>
        <article>
          <header>
            Saved notes
            <StickyNote size={19} />
          </header>
          <strong>
            {stats.notes}
            <small> notes</small>
          </strong>
          <Link href="/notes">
            Open your notebook <ArrowRight size={14} />
          </Link>
        </article>
      </div>
      <div className="prep-dashboard-grid">
        <div>
          <section className="prep-panel">
            <header className="prep-panel-heading">
              <h2>
                <Play size={19} />
                Continue practicing
              </h2>
              <Link href="/patterns">
                View all sheets <ArrowRight size={14} />
              </Link>
            </header>
            <div className="prep-continue-list">
              {collections.slice(0, 2).map((sheet) => (
                <Link
                  key={sheet.slug}
                  href={"/patterns?collection=" + sheet.slug}
                  className="prep-continue"
                >
                  <span className="prep-sheet-icon">
                    <Code2 size={24} />
                  </span>
                  <div>
                    <h3>{sheet.name}</h3>
                    <p>
                      {sheet.solved} of {sheet.total} questions solved
                    </p>
                    <div className="prep-meter">
                      <span
                        style={{
                          width: `${sheet.total ? (100 * sheet.solved) / sheet.total : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="prep-continue-cta">
                    Continue <ArrowRight size={14} />
                  </span>
                </Link>
              ))}
              {!collections.length && (
                <p className="prep-empty">
                  Choose a topic or company to start your practice.
                </p>
              )}
            </div>
          </section>
          <section className="prep-panel">
            <header className="prep-panel-heading">
              <h2>
                <BarChart3 size={20} />
                Weekly revision activity
              </h2>
              <span>{events} revisions</span>
            </header>
            <p className="prep-muted">
              Your recorded revision sessions over the last seven days · India
              time
            </p>
            <div
              className="prep-activity"
              aria-label="Revision sessions in the last seven days"
            >
              {activity.map((day) => (
                <div key={day.day}>
                  <strong>{day.count}</strong>
                  <div className="prep-bar-track">
                    <span
                      style={{
                        height: `${day.count ? Math.max(6, (100 * day.count) / maxActivity) : 0}%`,
                      }}
                    />
                  </div>
                  <span>
                    {new Date(day.day + "T12:00:00Z").toLocaleDateString("en", {
                      weekday: "short",
                      timeZone: "Asia/Kolkata",
                    })}
                  </span>
                </div>
              ))}
            </div>
            {!events && (
              <p className="prep-empty">
                Mark a question as revised to begin your activity history.
              </p>
            )}
          </section>
        </div>
        <div>
          <section className="prep-panel">
            <header className="prep-panel-heading">
              <h2>
                <Layers3 size={19} />
                Curated sheets
              </h2>
            </header>
            <div className="prep-quick-sheets">
              {collections.map((sheet) => (
                <Link
                  key={sheet.slug}
                  href={"/patterns?collection=" + sheet.slug}
                >
                  <span>{sheet.name}</span>
                  <strong>
                    {sheet.solved}/{sheet.total}
                  </strong>
                </Link>
              ))}
            </div>
            <Link className="prep-company-shortcut" href="/companies">
              <Building2 size={18} />
              Prepare for your target company
              <ArrowRight size={16} />
            </Link>
          </section>
          <section className="prep-panel">
            <header className="prep-panel-heading">
              <h2>
                <History size={19} />
                Recent practice
              </h2>
            </header>
            <div className="prep-recent">
              {recent.map((q) => (
                <Link
                  key={q.id}
                  href={"/patterns?q=" + encodeURIComponent(q.title)}
                >
                  <div>
                    <strong>{q.title}</strong>
                    <span className={"prep-badge " + q.difficulty}>
                      {q.difficulty || "Unrated"}
                    </span>
                  </div>
                  <p>
                    <span>
                      {q.status === "solved"
                        ? "Solved"
                        : q.status === "attempted"
                          ? "Attempted"
                          : "Progress updated"}
                    </span>
                    <time dateTime={q.updated_at.toISOString()}>
                      {q.updated_at.toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        timeZone: "Asia/Kolkata",
                      })}
                    </time>
                  </p>
                </Link>
              ))}
              {!recent.length && (
                <p className="prep-empty">
                  Your practice updates will appear here.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
