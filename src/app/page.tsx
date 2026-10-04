export const dynamic = "force-dynamic";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Layers3,
  StickyNote,
  Check,
  Orbit,
  Code2,
} from "lucide-react";
import { requireUser } from "@/lib/auth/server";
import { withStudentDatabase } from "@/lib/database/server";

export default async function Home() {
  await requireUser();
  const stats = await withStudentDatabase(
    async (client) =>
      (
        await client.query<{
          companies: number;
          questions: number;
          collections: number;
        }>(
          `select (select count(*)::int from public.companies c where exists(select 1 from public.company_question_observations o where o.company_id=c.id)) companies, (select count(*)::int from public.questions where is_listed) questions, (select count(*)::int from public.pattern_collections) collections`,
        )
      ).rows[0],
  );
  return (
    <div className="launch-home">
      <section className="launch-hero">
        <p className="launch-pill">
          <span /> YOUR NEXT CHAPTER STARTS HERE
        </p>
        <h1>
          Launch your preparation.
          <br />
          <span>Land your next opportunity.</span>
        </h1>
        <p className="launch-lead">
          Company questions, essential patterns, and the sheets you love.
          <br className="desktop-break" /> One place to practice. Every bit of
          it free.
        </p>
        <div className="launch-cta">
          <Link className="launch-button" href="/companies">
            Start practicing <ArrowRight size={17} />
          </Link>
          <Link className="launch-secondary" href="/patterns">
            Explore the sheets <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="launch-proof">
          <span>
            <Check size={14} /> Free with your account
          </span>
          <span>
            <Check size={14} /> Your progress, saved
          </span>
        </div>
        <div className="launch-preview" aria-label="Your practice workspace">
          <div className="preview-top">
            <span>
              <Orbit size={16} /> YOUR PRACTICE, IN FOCUS
            </span>
            <span className="preview-live">Ready when you are</span>
          </div>
          <div className="preview-body">
            <div className="preview-sidebar">
              <span className="preview-active">
                <Building2 size={16} /> Companies
              </span>
              <span>
                <Layers3 size={16} /> DSA patterns
              </span>
              <span>
                <StickyNote size={16} /> Private notes
              </span>
              <div className="preview-sidebar-note">
                Small steps.
                <br />
                Lasting progress.
              </div>
            </div>
            <div className="preview-sheet">
              <div className="preview-sheet-title">
                <div>
                  <small>FIND YOUR NEXT CHALLENGE</small>
                  <h2>Built around how you learn.</h2>
                </div>
                <Code2 size={25} />
              </div>
              {[
                {
                  title: "Prepare for your target company",
                  tag: "Company-wise",
                  href: "/companies",
                  icon: Building2,
                },
                {
                  title: "Understand the idea behind each solution",
                  tag: "Pattern tags",
                  href: "/patterns",
                  icon: Layers3,
                },
                {
                  title: "Return to your favorite practice sheet",
                  tag: "Curated collections",
                  href: "/patterns?collection=striver-sde",
                  icon: Code2,
                },
              ].map(({ title, tag, href, icon: Icon }) => (
                <Link className="preview-row" href={href} key={href}>
                  <Icon size={18} />
                  <span>
                    {title}
                    <small>{tag}</small>
                  </span>
                  <ArrowUpRight size={16} />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
      <div className="launch-stats">
        {[
          [stats.companies.toLocaleString(), "Companies to prepare for"],
          [stats.questions.toLocaleString(), "Practice questions"],
          [String(stats.collections), "Curated practice sheets"],
          ["Always free", "Built for students"],
        ].map(([value, label]) => (
          <div key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <section className="launch-features">
        <div className="launch-section-heading">
          <p className="launch-eyebrow">A BETTER WAY TO PREPARE</p>
          <h2>
            Less searching.
            <br />
            <span>More solving.</span>
          </h2>
          <p>
            Everything you need to turn a little daily practice into real
            understanding.
          </p>
        </div>
        <div className="launch-bento">
          <Link href="/companies" className="launch-feature feature-wide">
            <div className="feature-icon">
              <Building2 />
            </div>
            <h3>Your company. Your focus.</h3>
            <p>
              Browse the company directory and prioritize questions by reported
              frequency. Find the next problem that matters to you.
            </p>
            <div className="feature-chips">
              <span>Company tags</span>
              <span>Frequency</span>
              <span>Difficulty filters</span>
            </div>
            <span className="feature-link">
              Explore companies <ArrowUpRight size={16} />
            </span>
          </Link>
          <Link href="/patterns" className="launch-feature">
            <div className="feature-icon">
              <Layers3 />
            </div>
            <h3>See the pattern.</h3>
            <p>
              Start with standard DSA topics, then narrow your practice by
              patterns such as Prefix Sum and Sliding Window.
            </p>
            <span className="feature-link">
              Find your pattern <ArrowUpRight size={16} />
            </span>
          </Link>
          <Link
            href="/patterns?collection=striver-a2z"
            className="launch-feature"
          >
            <div className="feature-icon">
              <Code2 />
            </div>
            <h3>A sheet for every stage.</h3>
            <p>
              Practice with Striver, NeetCode, Blind 75, and Kushal’s essential
              patterns. Your progress follows the question across sheets.
            </p>
            <span className="feature-link">
              Browse collections <ArrowUpRight size={16} />
            </span>
          </Link>
          <Link href="/notes" className="launch-feature feature-wide">
            <div className="feature-icon">
              <StickyNote />
            </div>
            <h3>Keep the lesson, too.</h3>
            <p>
              Save your approach, edge cases, and complexity notes alongside
              each question. A space for what you learned, private to you.
            </p>
            <div className="feature-note">
              <span>{"// a note to your future self"}</span>
              <p>
                Understand the approach.
                <br />
                Test the edge cases.
                <br />
                Come back stronger.
              </p>
            </div>
            <span className="feature-link">
              Your notes <ArrowUpRight size={16} />
            </span>
          </Link>
        </div>
      </section>
      <section className="launch-workflow">
        <div className="launch-section-heading">
          <p className="launch-eyebrow">BUILD YOUR MOMENTUM</p>
          <h2>One question at a time.</h2>
        </div>
        <div className="launch-steps">
          {[
            [
              "01",
              "Choose your direction",
              "Pick a company, DSA topic, or curated sheet.",
            ],
            [
              "02",
              "Make it your practice",
              "Filter by difficulty and patterns to find your next challenge.",
            ],
            [
              "03",
              "Solve. Reflect. Repeat.",
              "Mark your progress and write down what you learned.",
            ],
          ].map(([n, title, text]) => (
            <div key={n}>
              <span>{n}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="launch-final">
        <Orbit size={32} />
        <h2>
          Your next opportunity
          <br />
          starts with today’s practice.
        </h2>
        <p>
          No subscription. Just you, your curiosity, and your next question.
        </p>
        <Link className="launch-button" href="/patterns">
          Find your next question <ArrowRight size={17} />
        </Link>
      </section>
    </div>
  );
}
