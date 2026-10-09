"use client";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Check,
  ChevronDown,
  History,
  Layers3,
  NotebookPen,
} from "lucide-react";
import { useClientSession } from "@/components/auth/client-session";
import { prepYardCollections } from "@/features/patterns/collections.mjs";
import { PracticePreview } from "@/components/landing/practice-preview";

const features = [
  {
    icon: Building2,
    title: "Prepare for your target company",
    text: "Explore company questions and use reported frequency to decide where to focus. Filter by topic and difficulty.",
  },
  {
    icon: Layers3,
    title: "Understand the patterns",
    text: "Build your foundation with standard DSA topics, then follow a numbered roadmap of reusable problem-solving patterns.",
  },
  {
    icon: NotebookPen,
    title: "Keep the lessons that matter",
    text: "Save your approach, edge cases and reminders beside each question. Find them together in your private notebook.",
  },
  {
    icon: History,
    title: "Make revision a habit",
    text: "Rate your confidence after a revision. Revisit questions you struggled with and see how your understanding develops.",
  },
];
export function LandingPage({ patternCount }: { patternCount: number }) {
  const { user } = useClientSession();
  const startHref = user ? "/dashboard" : "/signup";
  const startLabel = user ? "Go to dashboard" : "Create free account";
  return (
    <div className="prepyard-landing">
      <section
        className="yard-hero yard-container"
        aria-labelledby="yard-hero-title"
      >
        <div className="yard-hero-copy">
          <p className="yard-eyebrow">
            <span aria-hidden="true" /> Free coding interview preparation
          </p>
          <h1 id="yard-hero-title">
            A clearer path to your <span>next interview.</span>
          </h1>
          <p className="yard-hero-description">
            Choose the right questions. Learn the patterns. Keep your notes and
            revisions in one place. PrepYard makes daily practice easier to
            follow.
          </p>
          <div className="yard-hero-actions">
            <Link className="yard-button yard-button-primary" href={startHref}>
              {startLabel} <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <a
              className="yard-button yard-button-secondary"
              href="#how-it-works"
            >
              See how it works <ArrowUpRight size={17} aria-hidden="true" />
            </a>
          </div>
          <p className="yard-hero-note">
            Free with an account. Your progress stays with you.
          </p>
          <ul className="yard-hero-highlights" aria-label="Practice tools">
            <li>
              <Check size={15} aria-hidden="true" /> Company questions
            </li>
            <li>
              <Check size={15} aria-hidden="true" /> {patternCount} pattern
              groups
            </li>
            <li>
              <Check size={15} aria-hidden="true" /> Private notes
            </li>
          </ul>
        </div>
        <PracticePreview signedIn={Boolean(user)} />
      </section>

      <section
        id="features"
        className="yard-section yard-container"
        aria-labelledby="yard-features-title"
      >
        <header className="yard-section-heading">
          <p className="yard-kicker">Built around your practice</p>
          <h2 id="yard-features-title">
            Less searching.
            <br />
            More understanding.
          </h2>
          <p>
            Move from choosing a question to remembering how you solved it, with
            a workspace that keeps everything connected.
          </p>
        </header>
        <div className="yard-feature-grid">
          {features.map(({ icon: Icon, title, text }) => (
            <article className="yard-feature" key={title}>
              <span className="yard-feature-icon">
                <Icon size={22} aria-hidden="true" />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="collections"
        className="yard-section yard-collections-section"
        aria-labelledby="yard-collections-title"
      >
        <div className="yard-container">
          <header className="yard-section-heading">
            <p className="yard-kicker">Find your starting point</p>
            <h2 id="yard-collections-title">Three ways to focus.</h2>
            <p>
              A practice collection gives you a set of questions to work
              through. Choose a compact starting point, deeper topic coverage,
              or frequency-based priorities.
            </p>
          </header>
          <div className="yard-collection-grid">
            {prepYardCollections.map((collection, index) => (
              <article className="yard-collection" key={collection.slug}>
                <div className="yard-collection-heading">
                  <span aria-hidden="true">0{index + 1}</span>
                  <span>
                    {
                      [
                        "Start with essentials",
                        "Explore more topics",
                        "Prioritize your time",
                      ][index]
                    }
                  </span>
                </div>
                <h3>{collection.name}</h3>
                <p>{collection.description}</p>
                <p className="yard-collection-best">
                  <strong>Best for</strong>
                  <br />
                  {collection.bestFor}
                </p>
                <Link
                  className="yard-collection-link"
                  href={
                    user ? "/patterns?collection=" + collection.slug : "/signup"
                  }
                  aria-label={"Explore collection: " + collection.name}
                >
                  Explore collection <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
          <p className="yard-shared-progress">
            <Check size={17} aria-hidden="true" /> A question can appear in
            multiple collections. Your completion, notes and revision history
            stay the same everywhere.
          </p>
        </div>
      </section>

      <section
        id="how-it-works"
        className="yard-section yard-container"
        aria-labelledby="yard-how-title"
      >
        <header className="yard-section-heading">
          <p className="yard-kicker">A simple daily routine</p>
          <h2 id="yard-how-title">
            Start where you are.
            <br />
            Build from there.
          </h2>
        </header>
        <ol className="yard-steps">
          <li>
            <span className="yard-step-number" aria-hidden="true">
              01
            </span>
            <h3>Create your free account</h3>
            <p>
              Make a PrepYard account to keep your progress and private notebook
              together.
            </p>
          </li>
          <li>
            <span className="yard-step-number" aria-hidden="true">
              02
            </span>
            <h3>Choose your focus</h3>
            <p>
              Pick a company, a DSA topic, a learning pattern or a practice
              collection. Use filters to narrow your session.
            </p>
          </li>
          <li>
            <span className="yard-step-number" aria-hidden="true">
              03
            </span>
            <h3>Practice, note, revisit</h3>
            <p>
              Open the question on its coding platform, mark your progress, and
              save what you learned for your next revision.
            </p>
          </li>
        </ol>
      </section>

      <section
        id="faq"
        className="yard-section yard-container yard-faq-section"
        aria-labelledby="yard-faq-title"
      >
        <header className="yard-section-heading">
          <p className="yard-kicker">Before you begin</p>
          <h2 id="yard-faq-title">A few useful answers.</h2>
        </header>
        <div className="yard-faq-list">
          {[
            [
              "Is PrepYard free?",
              "Yes. PrepYard’s practice browsing, progress tracking, notes and revision tools are free with an account. Linked questions open on their original coding platforms, which may have their own account or access requirements.",
            ],
            [
              "Do I need an account to practice?",
              "Yes. Create an account or log in to access companies, questions, collections and your dashboard. This keeps your progress and notes connected to you.",
            ],
            [
              "Are my notes visible to other students?",
              "No. Your notes and revision history are private to your account. You can edit or delete notes whenever you need to.",
            ],
            [
              "Can I choose my own practice order?",
              "Yes. Browse by topic, pattern or company, then filter by difficulty and progress. Pattern pages also let you sort by difficulty or revision priority.",
            ],
          ].map(([question, answer]) => (
            <details key={question}>
              <summary>
                {question}
                <ChevronDown size={18} aria-hidden="true" />
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section
        className="yard-closing yard-container"
        aria-labelledby="yard-closing-title"
      >
        <div>
          <p className="yard-kicker">Your next session starts here</p>
          <h2 id="yard-closing-title">Make room for better practice.</h2>
          <p>A few focused questions today. A stronger foundation tomorrow.</p>
        </div>
        <Link className="yard-button yard-button-primary" href={startHref}>
          {startLabel}
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
