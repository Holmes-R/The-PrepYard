"use client";

import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  Clock3,
  FileText,
  History,
  Layers,
} from "lucide-react";
import type { dashboardData } from "@/features/dashboard/queries";
import {
  useClientResource,
  type JsonData,
} from "@/lib/client/use-client-resource";
import { ResourceState } from "@/components/feedback/resource-state";
import { prepYardCollections } from "@/features/patterns/collections.mjs";

type Data = JsonData<Awaited<ReturnType<typeof dashboardData>>> & {
  user: { name?: string | null };
};
type Question = Data["recent"][number];
const count = (value: number) => value.toLocaleString("en-IN");
const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
const confidence: Record<number, string> = {
  1: "Struggled",
  2: "Tough",
  3: "Got it",
  4: "Nailed it",
};
const purposes: Record<string, string> = {
  "interview-launchpad": "Core interview foundations",
  "dsa-deep-dive": "Data structures, topic by topic",
  "interview-hotlist": "High-frequency questions to prioritise",
};

export function ClientDashboard() {
  const resource = useClientResource<Data>("/api/dashboard");
  if (!resource.data)
    return <ResourceState title="Your dashboard" {...resource} />;
  return <DashboardContent data={resource.data} />;
}

function QuestionRow({
  question,
  revision = false,
}: {
  question: Question;
  revision?: boolean;
}) {
  const href = question.practice_path
    ? question.practice_path +
      (question.practice_path.includes("?") ? "&q=" : "?q=") +
      encodeURIComponent(question.title) +
      (revision ? "&sort=revision" : "")
    : question.canonical_url;
  const external = !question.practice_path;
  const statusLabel =
    question.status === "solved"
      ? "Solved"
      : question.status === "attempted"
        ? "Attempted"
        : "Progress saved";
  const description = revision
    ? [
        question.next_revision_at
          ? "Due " + dateLabel(question.next_revision_at)
          : "",
        question.revision_confidence != null &&
        confidence[question.revision_confidence]
          ? "Last revision rating: " + confidence[question.revision_confidence]
          : "",
      ]
        .filter(Boolean)
        .join(", ")
    : [statusLabel, question.difficulty, dateLabel(question.updated_at)]
        .filter(Boolean)
        .join(", ");

  return (
    <li className="dashboard-question-row">
      <Link
        href={href}
        prefetch={false}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        aria-label={
          (revision ? "Review " : "Practise ") +
          question.title +
          ", " +
          description +
          (external ? " (opens in a new tab)" : "")
        }
      >
        <span className="dashboard-question-main">
          <span className="dashboard-question-title">{question.title}</span>
          <span className="dashboard-question-meta">
            {revision && question.next_revision_at ? (
              <time dateTime={question.next_revision_at}>
                Due {dateLabel(question.next_revision_at)}
              </time>
            ) : (
              <>
                <span>
                  {question.status === "solved"
                    ? "Solved"
                    : question.status === "attempted"
                      ? "Attempted"
                      : "Progress saved"}
                </span>
                <time dateTime={question.updated_at}>
                  {dateLabel(question.updated_at)}
                </time>
              </>
            )}
          </span>
        </span>
        <span className="dashboard-question-badges">
          {revision &&
          question.revision_confidence != null &&
          confidence[question.revision_confidence] ? (
            <span
              className={
                "dashboard-confidence confidence-" +
                question.revision_confidence
              }
              title="Last revision rating"
            >
              {confidence[question.revision_confidence]}
            </span>
          ) : question.difficulty ? (
            <span className={"dashboard-difficulty " + question.difficulty}>
              {question.difficulty}
            </span>
          ) : null}
          <ArrowRight size={16} aria-hidden="true" />
        </span>
      </Link>
    </li>
  );
}

export function DashboardContent({ data }: { data: Data }) {
  const { user, stats, collections, recent, activity, revisions = [] } = data;
  const completion = stats.attempted
    ? Math.round((100 * stats.solved) / stats.attempted)
    : 0;
  const maxActivity = Math.max(1, ...activity.map((day) => day.count));
  const weeklyRevisions = activity.reduce((sum, day) => sum + day.count, 0);
  return (
    <div className="prep-dashboard prep-dashboard-clean">
      <header className="dashboard-heading">
        <div>
          <p className="dashboard-kicker">Your workspace</p>
          <h1>
            Welcome back{user.name ? ", " + user.name.split(" ")[0] : ""}.
          </h1>
          <p className="dashboard-intro">
            A little practice. A little progress.
          </p>
        </div>
        <Link
          href="/patterns"
          className="dashboard-button dashboard-button-primary"
        >
          Practice now <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </header>

      <section
        className="dashboard-progress"
        aria-labelledby="dashboard-progress-title"
      >
        <h2 className="sr-only" id="dashboard-progress-title">
          Your practice progress
        </h2>
        <dl className="dashboard-stats">
          <div>
            <dt>Questions solved</dt>
            <dd className="dashboard-stat-value">
              {count(stats.solved)}
              <span> / {count(stats.total)}</span>
            </dd>
            <dd className="dashboard-stat-detail">
              <ul
                className="dashboard-difficulty-counts"
                aria-label="Solved questions by difficulty"
              >
                {[
                  { name: "Easy", value: stats.easy, kind: "easy" },
                  { name: "Medium", value: stats.medium, kind: "medium" },
                  { name: "Hard", value: stats.hard, kind: "hard" },
                ].map((item) => (
                  <li key={item.kind}>
                    <span
                      className={"dashboard-dot " + item.kind}
                      aria-hidden="true"
                    />
                    {item.name} {count(item.value)}
                  </li>
                ))}
              </ul>
              <p>
                {stats.attempted
                  ? `${completion}% of ${count(stats.attempted)} attempted questions solved`
                  : "Your first solve starts here."}
              </p>
            </dd>
          </div>
          <div>
            <dt>
              <Clock3 size={15} aria-hidden="true" />
              Revision due
            </dt>
            <dd className="dashboard-stat-value">{count(stats.due)}</dd>
            <dd className="dashboard-stat-detail">
              <p>
                {stats.due ? "Ready for another attempt" : "You’re up to date"}
              </p>
              <Link
                href="/patterns?sort=revision"
                className="dashboard-text-link"
              >
                View revisions <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </dd>
          </div>
          <div>
            <dt>
              <FileText size={15} aria-hidden="true" />
              Saved notes
            </dt>
            <dd className="dashboard-stat-value">{count(stats.notes)}</dd>
            <dd className="dashboard-stat-detail">
              <p>Your approaches and reminders</p>
              <Link href="/notes" className="dashboard-text-link">
                Open notebook <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </dd>
          </div>
        </dl>
      </section>

      <div className="dashboard-focus">
        <section
          className="dashboard-panel dashboard-continue"
          aria-labelledby="dashboard-continue-title"
        >
          <header className="dashboard-section-heading">
            <div>
              <h2 id="dashboard-continue-title">Continue practising</h2>
              <p>Your recently updated questions</p>
            </div>
            <Link href="/patterns" className="dashboard-text-link">
              Browse practice <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </header>
          {recent.length ? (
            <ul className="dashboard-question-list">
              {recent.slice(0, 3).map((question) => (
                <QuestionRow question={question} key={question.id} />
              ))}
            </ul>
          ) : (
            <div className="dashboard-empty">
              <Layers size={24} aria-hidden="true" />
              <h3>Start with one question</h3>
              <p>
                Choose a topic or a company. Your recent practice will appear
                here.
              </p>
              <div className="dashboard-empty-actions">
                <Link
                  href="/patterns"
                  className="dashboard-button dashboard-button-secondary"
                >
                  Explore topics
                </Link>
                <Link href="/companies" className="dashboard-text-link">
                  Browse companies <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </div>
          )}
        </section>
        <section
          className="dashboard-panel dashboard-review"
          aria-labelledby="dashboard-review-title"
        >
          <header className="dashboard-section-heading">
            <div>
              <h2 id="dashboard-review-title">Revision queue</h2>
              <p>
                {stats.due
                  ? `${count(stats.due)} ready to revisit`
                  : "Keep what you learn"}
              </p>
            </div>
            <History size={19} aria-hidden="true" />
          </header>
          {revisions.length ? (
            <>
              <ul className="dashboard-question-list">
                {revisions.map((question) => (
                  <QuestionRow question={question} revision key={question.id} />
                ))}
              </ul>
              <Link
                href="/patterns?sort=revision"
                className="dashboard-text-link dashboard-review-link"
              >
                View revisions <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </>
          ) : (
            <div className="dashboard-empty dashboard-review-empty">
              <History size={24} aria-hidden="true" />
              <h3>No revisions due</h3>
              <p>
                Rate your confidence after a revision to build your review
                queue.
              </p>
            </div>
          )}
        </section>
      </div>

      <section
        className="dashboard-collections"
        aria-labelledby="dashboard-collections-title"
      >
        <header className="dashboard-section-heading">
          <div>
            <h2 id="dashboard-collections-title">Practice collections</h2>
            <p>Focused question sets for different goals.</p>
          </div>
        </header>
        <div className="dashboard-collection-grid">
          {prepYardCollections.map((collection) => {
            const progress = collections.find(
              (item) => item.slug === collection.slug,
            );
            const total = progress?.total ?? 0,
              solved = progress?.solved ?? 0;
            const percentage = total ? Math.round((100 * solved) / total) : 0;
            return (
              <article
                className="dashboard-collection-card"
                key={collection.slug}
                aria-labelledby={"collection-" + collection.slug}
              >
                <h3 id={"collection-" + collection.slug}>{collection.name}</h3>
                <p className="dashboard-collection-purpose">
                  {purposes[collection.slug]}
                </p>
                <div className="dashboard-collection-progress">
                  <div>
                    <span>
                      {total
                        ? `${count(solved)} / ${count(total)} solved`
                        : "No questions available yet"}
                    </span>
                    {total > 0 && <strong>{percentage}%</strong>}
                  </div>
                  <progress
                    value={solved}
                    max={Math.max(1, total)}
                    aria-label={`${collection.name}: ${count(solved)} of ${count(total)} questions solved`}
                  />
                </div>
                <div className="dashboard-collection-actions">
                  <Link
                    href={"/patterns?collection=" + collection.slug}
                    className="dashboard-button dashboard-button-secondary"
                    aria-label={"Open collection: " + collection.name}
                  >
                    Open <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </div>
                <details className="dashboard-collection-about">
                  <summary aria-label={"About " + collection.name}>
                    About this collection{" "}
                    <ChevronDown size={15} aria-hidden="true" />
                  </summary>
                  <div>
                    <p>{collection.description}</p>
                    <p>
                      <strong>Best for:</strong> {collection.bestFor}
                    </p>
                  </div>
                </details>
              </article>
            );
          })}
        </div>
        <details className="dashboard-collection-help">
          <summary>
            How collections work <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <div>
            <p>
              A collection groups questions around a preparation goal. Choose a
              topic and difficulty inside each collection.
            </p>
            <p>
              <strong>Progress is shared.</strong> Solving a question, saving a
              note, or revising it updates that question across company and
              pattern pages. Your overall solved count counts it once.
            </p>
            <p>
              Interview Hotlist includes up to 20 questions per topic with
              eligible company frequency data. Its size can change; frequency
              helps prioritise practice and does not guarantee an interview
              question.
            </p>
          </div>
        </details>
      </section>

      <section
        className="dashboard-panel dashboard-activity"
        aria-labelledby="dashboard-activity-title"
      >
        <div className="dashboard-activity-heading">
          <History size={20} aria-hidden="true" />
          <div>
            <h2 id="dashboard-activity-title">Revision this week</h2>
            <p>
              {count(weeklyRevisions)}{" "}
              {weeklyRevisions === 1 ? "revision" : "revisions"} · Last seven
              days, India time
            </p>
            {!weeklyRevisions && <p>No revisions this week yet.</p>}
          </div>
        </div>
        <ul
          className="dashboard-activity-list"
          aria-label="Daily revision counts"
        >
          {activity.map((day) => (
            <li key={day.day}>
              <span className="sr-only">
                {new Date(day.day + "T12:00:00Z").toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  timeZone: "Asia/Kolkata",
                })}
                : {day.count} {day.count === 1 ? "revision" : "revisions"}
              </span>
              <div aria-hidden="true">
                <strong>{day.count}</strong>
                <div className="dashboard-bar-track">
                  <span
                    style={{
                      height: `${day.count ? Math.max(8, (100 * day.count) / maxActivity) : 0}%`,
                    }}
                  />
                </div>
                <time dateTime={day.day}>
                  {new Date(day.day + "T12:00:00Z").toLocaleDateString(
                    "en-IN",
                    { weekday: "short", timeZone: "Asia/Kolkata" },
                  )}
                </time>
              </div>
            </li>
          ))}
        </ul>
      </section>
      {recent.length > 3 && (
        <details className="dashboard-recent-history">
          <summary>
            Recent practice history <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <ul className="dashboard-question-list">
            {recent.map((question) => (
              <QuestionRow question={question} key={question.id} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
