"use client";

import { useRef, type PointerEvent } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { PracticePreview } from "@/components/landing/practice-preview";
import { LandingBackground } from "@/components/landing/landing-background";
import {
  LANDING_MOTION,
  landingDelayStyle,
  landingWordDelayStyle,
} from "@/components/landing/landing-motion";

const titleWords = ["A", "clearer", "path", "to", "your", "next", "interview."];

export function LandingHero({
  patternCount,
  signedIn,
  startHref,
  startLabel,
  animate,
}: {
  patternCount: number;
  signedIn: boolean;
  startHref: string;
  startLabel: string;
  animate: boolean;
}) {
  const backgroundRef = useRef<HTMLDivElement>(null);

  function moveBackground(event: PointerEvent<HTMLElement>) {
    if (
      !animate ||
      event.pointerType !== "mouse" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    backgroundRef.current
      ?.querySelectorAll<HTMLElement>(".yard-code-symbol")
      .forEach((symbol, index) => {
        const factor = ((index % 5) + 1) * 3;
        symbol.style.transform = `translate3d(${x * factor}px, ${y * factor}px, 0)`;
      });
  }

  return (
    <section
      className="yard-hero yard-container"
      aria-labelledby="yard-hero-title"
      onPointerMove={moveBackground}
    >
      {animate && <LandingBackground containerRef={backgroundRef} />}
      <div className="yard-hero-copy">
        <p
          className="yard-eyebrow"
          style={landingDelayStyle(LANDING_MOTION.hero.badgeDelayMs)}
        >
          <span aria-hidden="true" /> Free coding interview preparation
        </p>
        <h1
          id="yard-hero-title"
          aria-label="A clearer path to your next interview."
        >
          <span className="yard-hero-word-group" aria-hidden="true">
            {titleWords.slice(0, 5).map((word, index) => (
              <span
                className="yard-hero-word"
                key={word}
                style={landingWordDelayStyle(
                  LANDING_MOTION.hero.headlineDelayMs +
                    index * LANDING_MOTION.hero.wordStaggerMs,
                )}
              >
                {word}{" "}
              </span>
            ))}
          </span>
          <span className="yard-hero-highlight" aria-hidden="true">
            {titleWords.slice(5).map((word, index) => {
              const wordIndex = index + 5;
              return (
                <span
                  className="yard-hero-word"
                  key={word}
                  style={landingWordDelayStyle(
                    LANDING_MOTION.hero.headlineDelayMs +
                      wordIndex * LANDING_MOTION.hero.wordStaggerMs,
                  )}
                >
                  {word}
                  {wordIndex < titleWords.length - 1 ? " " : ""}
                </span>
              );
            })}
          </span>
        </h1>
        <p
          className="yard-hero-description"
          style={landingDelayStyle(LANDING_MOTION.hero.paragraphDelayMs)}
        >
          Choose the right questions. Learn the patterns. Keep your notes and
          revisions in one place. PrepYard makes daily practice easier to
          follow.
        </p>
        <div
          className="yard-hero-actions"
          style={landingDelayStyle(LANDING_MOTION.hero.actionsDelayMs)}
        >
          <Link className="yard-button yard-button-primary" href={startHref}>
            {startLabel} <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <a className="yard-button yard-button-secondary" href="#how-it-works">
            See how it works <ArrowUpRight size={17} aria-hidden="true" />
          </a>
        </div>
        <p
          className="yard-hero-note"
          style={landingDelayStyle(LANDING_MOTION.hero.noteDelayMs)}
        >
          Free with an account. Your progress stays with you.
        </p>
        <ul
          className="yard-hero-highlights"
          aria-label="Practice tools"
          style={landingDelayStyle(LANDING_MOTION.hero.highlightsDelayMs)}
        >
          <li>
            <Check size={15} aria-hidden="true" /> Company questions
          </li>
          <li>
            <Check size={15} aria-hidden="true" /> {patternCount} pattern groups
          </li>
          <li>
            <Check size={15} aria-hidden="true" /> Private notes
          </li>
        </ul>
      </div>
      <PracticePreview signedIn={signedIn} animate={animate} />
    </section>
  );
}
