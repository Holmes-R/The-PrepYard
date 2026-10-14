"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
} from "framer-motion";
import {
  ArrowRight,
  Building2,
  Code2,
  Layers3,
  LockKeyhole,
} from "lucide-react";
import {
  LANDING_MOTION,
  landingRowStyle,
  useLandingReducedMotion,
} from "@/components/landing/landing-motion";

const categories = [
  {
    key: "topics",
    label: "Topics",
    heading: "Popular topics",
    icon: Code2,
    items: [
      {
        name: "Arrays",
        detail: "Build your problem-solving foundation",
        href: "/patterns?topic=arrays",
      },
      {
        name: "Strings",
        detail: "Practice text and character problems",
        href: "/patterns?topic=strings",
      },
      {
        name: "Linked Lists",
        detail: "Work with nodes and pointers",
        href: "/patterns?topic=linked-lists",
      },
      {
        name: "Graphs",
        detail: "Explore connections and traversal",
        href: "/patterns?topic=graphs",
      },
    ],
  },
  {
    key: "patterns",
    label: "Patterns",
    heading: "Popular patterns",
    icon: Layers3,
    items: [
      {
        name: "Two Pointers",
        detail: "Solve problems with coordinated pointers",
        href: "/patterns/two-pointers",
      },
      {
        name: "Sliding Window",
        detail: "Track a changing range efficiently",
        href: "/patterns/sliding-window",
      },
      {
        name: "Binary Search",
        detail: "Narrow the search space step by step",
        href: "/patterns/modified-binary-search",
      },
      {
        name: "Fast & Slow Pointers",
        detail: "Find cycles and work through linked structures",
        href: "/patterns/fast-and-slow-pointer",
      },
    ],
  },
  {
    key: "companies",
    label: "Companies",
    heading: "Popular companies",
    icon: Building2,
    items: [
      {
        name: "Google",
        detail: "Explore company interview questions",
        href: "/companies/google",
      },
      {
        name: "Amazon",
        detail: "Explore company interview questions",
        href: "/companies/amazon",
      },
      {
        name: "Microsoft",
        detail: "Explore company interview questions",
        href: "/companies/microsoft",
      },
      {
        name: "Meta",
        detail: "Explore company interview questions",
        href: "/companies/meta",
      },
    ],
  },
] as const;

export function PracticePreview({
  signedIn,
  animate = false,
}: {
  signedIn: boolean;
  animate?: boolean;
}) {
  const [selected, setSelected] = useState(0);
  const [paused, setPaused] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const activityTimeout = useRef<number | null>(null);
  const id = useId();
  const reducedMotion = useLandingReducedMotion();
  const tiltXValue = useMotionValue(0);
  const tiltYValue = useMotionValue(0);
  const tiltX = useSpring(tiltXValue, LANDING_MOTION.preview.tiltSpring);
  const tiltY = useSpring(tiltYValue, LANDING_MOTION.preview.tiltSpring);
  const Icon = categories[selected].icon;

  useEffect(() => {
    if (!animate || reducedMotion || paused) return;
    const timer = window.setInterval(() => {
      setSelected((current) => (current + 1) % categories.length);
    }, LANDING_MOTION.preview.autoAdvanceMs);
    return () => window.clearInterval(timer);
  }, [animate, paused, reducedMotion]);

  useEffect(
    () => () => {
      if (activityTimeout.current) window.clearTimeout(activityTimeout.current);
    },
    [],
  );

  function pauseForInteraction() {
    if (!animate || reducedMotion) return;
    setPaused(true);
    if (activityTimeout.current) window.clearTimeout(activityTimeout.current);
    activityTimeout.current = window.setTimeout(() => {
      setPaused(false);
      activityTimeout.current = null;
    }, LANDING_MOTION.preview.resumeAfterMs);
  }

  function tiltPreview(event: PointerEvent<HTMLElement>) {
    if (!animate || reducedMotion || event.pointerType !== "mouse") {
      return;
    }
    pauseForInteraction();
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    const tiltRange = LANDING_MOTION.preview.tiltMaxDegrees * 2;
    tiltXValue.set(y * -tiltRange);
    tiltYValue.set(x * tiltRange);
  }

  function resetTilt() {
    tiltXValue.set(0);
    tiltYValue.set(0);
  }

  function navigateTabs(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let next: number;
    switch (event.key) {
      case "ArrowRight":
        next = (index + 1) % categories.length;
        break;
      case "ArrowLeft":
        next = (index + categories.length - 1) % categories.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = categories.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    pauseForInteraction();
    setSelected(next);
    tabs.current[next]?.focus();
  }

  return (
    <div className="yard-preview-wrap">
      {animate && (
        <div className="yard-motion-decorations" aria-hidden="true">
          <span className="yard-motion-orbit" />
        </div>
      )}
      <motion.section
        className="yard-preview"
        aria-label="Explore PrepYard practice"
        style={{
          transformPerspective: 1100,
          rotateX: reducedMotion ? 0 : tiltX,
          rotateY: reducedMotion ? 0 : tiltY,
        }}
        onPointerEnter={pauseForInteraction}
        onPointerMove={tiltPreview}
        onPointerLeave={resetTilt}
        onClickCapture={pauseForInteraction}
        onFocusCapture={pauseForInteraction}
        onKeyDownCapture={pauseForInteraction}
      >
        <div className="yard-preview-top">
          <div>
            <Code2 size={18} aria-hidden="true" />
            <strong>Your practice, organized.</strong>
          </div>
          <span>Interactive preview</span>
        </div>
        {animate && (
          <div className="yard-session-signal" aria-hidden="true">
            <span />
          </div>
        )}
        <div className="yard-preview-summary">
          <div>
            <span>Choose your focus</span>
            <strong>Find your next starting point.</strong>
          </div>
          <span className="yard-preview-symbol">
            <Icon size={25} aria-hidden="true" />
          </span>
        </div>
        <div
          className="yard-preview-tabs"
          role="tablist"
          aria-label="Practice categories"
        >
          {categories.map((category, index) => (
            <button
              key={category.key}
              ref={(element) => {
                tabs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${category.key}`}
              aria-controls={`${id}-panel-${category.key}`}
              aria-selected={selected === index}
              tabIndex={selected === index ? 0 : -1}
              onClick={() => setSelected(index)}
              onKeyDown={(event) => navigateTabs(event, index)}
            >
              {selected === index && (
                <motion.span
                  className="yard-preview-tab-highlight"
                  layoutId="yard-preview-tab-highlight"
                  transition={{
                    duration: reducedMotion
                      ? 0
                      : LANDING_MOTION.preview.tabTransitionMs / 1000,
                    ease: LANDING_MOTION.easing,
                  }}
                  aria-hidden="true"
                />
              )}
              <span>{category.label}</span>
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {categories.map((category, index) => {
            if (selected !== index) return null;
            const ItemIcon = category.icon;
            return (
              <motion.div
                key={category.key}
                className="yard-preview-panel"
                role="tabpanel"
                id={`${id}-panel-${category.key}`}
                aria-labelledby={`${id}-tab-${category.key}`}
                tabIndex={0}
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -5 }}
                transition={{
                  duration: LANDING_MOTION.preview.panelTransitionMs / 1000,
                  ease: LANDING_MOTION.easing,
                }}
              >
                <p className="yard-preview-label">{category.heading}</p>
                <ul className="yard-preview-choices">
                  {category.items.map((item, rowIndex) => (
                    <motion.li
                      key={item.href}
                      initial={
                        reducedMotion ? { opacity: 0 } : { opacity: 0, y: 7 }
                      }
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: LANDING_MOTION.preview.rowTransitionMs / 1000,
                        delay: reducedMotion
                          ? 0
                          : (rowIndex * LANDING_MOTION.preview.rowStaggerMs) /
                            1000,
                        ease: LANDING_MOTION.easing,
                      }}
                    >
                      <Link
                        className="yard-preview-choice"
                        href={
                          signedIn
                            ? item.href
                            : "/login?next=" + encodeURIComponent(item.href)
                        }
                        prefetch={false}
                        style={landingRowStyle(rowIndex)}
                      >
                        <span className="yard-preview-choice-icon">
                          <ItemIcon size={18} aria-hidden="true" />
                        </span>
                        <span className="yard-preview-choice-copy">
                          <strong>{item.name}</strong>
                          <span>{item.detail}</span>
                        </span>
                        <ArrowRight size={16} aria-hidden="true" />
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div className="yard-preview-bottom">
          <span>Curated starting points</span>
          <span>
            <LockKeyhole size={14} aria-hidden="true" />
            {signedIn ? "Choose one to practice" : "Log in to explore"}
          </span>
        </div>
      </motion.section>
      <p className="yard-preview-caption">
        Pick a category, then choose where to begin.
      </p>
    </div>
  );
}
