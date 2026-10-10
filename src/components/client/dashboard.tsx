"use client";

import Link from "next/link";
import { ArrowRight, Building2, ChevronDown } from "lucide-react";
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
const formatCount = (count: number) => count.toLocaleString("en-IN");
export function ClientDashboard() {
  const resource = useClientResource<Data>("/api/dashboard");
  if (!resource.data)
    return <ResourceState title="Your dashboard" {...resource} />;
  return <DashboardContent data={resource.data} />;
}
function DashboardContent({ data }: { data: Data }) {
  const { user, stats, collections, recent, activity } = data;
  const completion = stats.attempted
    ? Math.round((100 * stats.solved) / stats.attempted)
    : 0;
  const maxActivity = Math.max(1, ...activity.map((day) => day.count));
  const revisions = activity.reduce((sum, day) => sum + day.count, 0);
  return (
    <div className="prep-dashboard prep-dashboard-clean">
      <header className="dashboard-heading">
        <div>
          <p className="dashboard-kicker">Your dashboard</p>
          <h1>
            Welcome back{user.name ? ", " + user.name.split(" ")[0] : ""}.
          </h1>
          <p className="dashboard-intro">
            Choose your next practice session and keep track of what you’ve
            learned.
          </p>
        </div>
        <div className="dashboard-heading-actions">
          <Link
            href="/patterns"
            className="dashboard-button dashboard-button-primary"
          >
            Practice now <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <Link
            href="/companies"
            className="dashboard-button dashboard-button-secondary"
          >
            <Building2 size={17} aria-hidden="true" /> Browse companies
          </Link>
          <Link
            href="/settings"
            className="dashboard-button dashboard-button-secondary"
          >
            LeetCode sync
          </Link>
        </div>
      </header>

      <section aria-labelledby="dashboard-progress-title">
        <h2 className="sr-only" id="dashboard-progress-title">
          Your practice progress
        </h2>
        <dl className="dashboard-stats">
          <div>
            <dt>Questions solved</dt>
            <dd className="dashboard-stat-value">
              {formatCount(stats.solved)}
            </dd>
            <dd className="dashboard-stat-detail">
              <p>Of {formatCount(stats.total)} available questions</p>
              <ul
                className="dashboard-difficulty-counts"
                aria-label="Solved questions by difficulty"
              >
                {[
                  { name: "Easy", count: stats.easy, kind: "easy" },
                  { name: "Medium", count: stats.medium, kind: "medium" },
                  { name: "Hard", count: stats.hard, kind: "hard" },
                ].map((item) => (
                  <li key={item.kind}>
                    <span
                      className={"dashboard-dot " + item.kind}
                      aria-hidden="true"
                    />
                    {item.name} {formatCount(item.count)}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
          <div>
            <dt>Completion rate</dt>
            <dd className="dashboard-stat-value">
              {completion}
              <span>%</span>
            </dd>
            <dd className="dashboard-stat-detail">
              <p>
                {stats.attempted
                  ? `Of ${formatCount(stats.attempted)} attempted questions`
                  : "Solve your first question to get started"}
              </p>
            </dd>
          </div>
          <div>
            <dt>Revision due</dt>
            <dd className="dashboard-stat-value">{formatCount(stats.due)}</dd>
            <dd className="dashboard-stat-detail">
              <p>
                {stats.due
                  ? "Ready for another attempt"
                  : "No overdue revisions"}
              </p>
              <Link
                href="/patterns?sort=revision"
                className="dashboard-text-link"
              >
                Review queue
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </dd>
          </div>
          <div>
            <dt>Saved notes</dt>
            <dd className="dashboard-stat-value">{formatCount(stats.notes)}</dd>
            <dd className="dashboard-stat-detail">
              <p>Your approaches and reminders</p>
              <Link href="/notes" className="dashboard-text-link">
                View notes
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </dd>
          </div>
        </dl>
      </section>

      <section
        className="dashboard-collections"
        aria-labelledby="dashboard-collections-title"
      >
        <header className="dashboard-section-heading">
          <div>
            <h2 id="dashboard-collections-title">
              Choose a practice collection
            </h2>
            <p>
              A collection is a focused set of questions to guide your practice.
              Pick the one that fits your goal.
            </p>
          </div>
        </header>
        <div className="dashboard-collection-grid">
          {prepYardCollections.map((collection, index) => {
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
                <div className="dashboard-collection-top">
                  <span
                    className="dashboard-collection-number"
                    aria-hidden="true"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="dashboard-collection-kind">
                    {collection.kind === "dynamic"
                      ? "Frequency priorities"
                      : index === 0
                        ? "Focused essentials"
                        : "Broader coverage"}
                  </span>
                </div>
                <h3 id={"collection-" + collection.slug}>{collection.name}</h3>
                <p className="dashboard-collection-description">
                  {collection.description}
                </p>
                <p className="dashboard-collection-purpose">
                  <strong>Best for:</strong> {collection.bestFor}
                </p>
                <div className="dashboard-collection-progress">
                  <div>
                    <span>
                      {formatCount(solved)} / {formatCount(total)} solved
                    </span>
                    <strong>{percentage}%</strong>
                  </div>
                  <progress
                    value={solved}
                    max={Math.max(1, total)}
                    aria-label={
                      collection.name +
                      ": " +
                      formatCount(solved) +
                      " of " +
                      formatCount(total) +
                      " questions solved"
                    }
                  />
                  {!total && (
                    <p>No questions available in this collection yet.</p>
                  )}
                </div>
                <Link
                  href={"/patterns?collection=" + collection.slug}
                  className="dashboard-button dashboard-button-secondary"
                  aria-label={"Open collection: " + collection.name}
                >
                  Open collection <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </article>
            );
          })}
        </div>
        <details className="dashboard-collection-help">
          <summary>
            How collections work <ChevronDown size={17} aria-hidden="true" />
          </summary>
          <div>
            <p>
              <strong>One question, one progress record.</strong> A question can
              appear in several collections. Solving it, adding a note, or
              marking it revised updates that question everywhere; your overall
              solved count counts it once.
            </p>
            <p>
              <strong>Choose your own pace.</strong> Open a collection, choose a
              topic, and narrow questions by difficulty. Your notes are private,
              and revision history keeps the confidence level you selected.
            </p>
            <p>
              <strong>Hotlist counts can vary.</strong> Interview Hotlist
              includes up to 20 questions per topic with eligible company
              frequency data. Frequency helps you prioritize; it does not
              guarantee a question will appear in an interview.
            </p>
          </div>
        </details>
      </section>

      <div className="dashboard-detail-grid">
        <section
          className="dashboard-panel"
          aria-labelledby="dashboard-recent-title"
        >
          <header className="dashboard-section-heading">
            <h2 id="dashboard-recent-title">Recent practice</h2>
            <Link href="/patterns" className="dashboard-text-link">
              All questions <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </header>
          {recent.length ? (
            <ul className="dashboard-recent-list">
              {recent.map((question) => (
                <li key={question.id}>
                  <Link
                    href={"/patterns?q=" + encodeURIComponent(question.title)}
                  >
                    <span>{question.title}</span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                  <div>
                    <span>
                      {question.status === "solved"
                        ? "Solved"
                        : question.status === "attempted"
                          ? "Attempted"
                          : "Progress saved"}
                    </span>
                    <time dateTime={question.updated_at}>
                      {new Date(question.updated_at).toLocaleDateString(
                        "en-IN",
                        {
                          day: "numeric",
                          month: "short",
                          timeZone: "Asia/Kolkata",
                        },
                      )}
                    </time>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="dashboard-empty">
              <p>
                Your recent questions will appear here once you start
                practicing.
              </p>
              <Link href="/patterns" className="dashboard-text-link">
                Find your first question{" "}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          )}
        </section>
        <section
          className="dashboard-panel"
          aria-labelledby="dashboard-activity-title"
        >
          <header className="dashboard-section-heading">
            <h2 id="dashboard-activity-title">Revision this week</h2>
            <span className="dashboard-activity-total">
              {formatCount(revisions)}{" "}
              {revisions === 1 ? "revision" : "revisions"}
            </span>
          </header>
          <p className="dashboard-caption">Your last seven days · India time</p>
          <ul
            className="dashboard-activity-list"
            aria-label="Daily revision counts"
          >
            {activity.map((day) => {
              const date = new Date(day.day + "T12:00:00Z");
              return (
                <li key={day.day}>
                  <span className="sr-only">
                    {date.toLocaleDateString("en-IN", {
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
                      {date.toLocaleDateString("en-IN", {
                        weekday: "short",
                        timeZone: "Asia/Kolkata",
                      })}
                    </time>
                  </div>
                </li>
              );
            })}
          </ul>
          {!revisions && (
            <p className="dashboard-caption dashboard-activity-empty">
              Mark a question as revised to start your activity record.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
