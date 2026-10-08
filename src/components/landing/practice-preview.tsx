"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Code2,
  Layers3,
  LockKeyhole,
} from "lucide-react";

// Public, curated starting points. Account data stays behind authentication.
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
        name: "Prefix Sum",
        detail: "Answer range-sum queries efficiently",
        href: "/patterns/prefix-sum",
      },
      {
        name: "Modified Binary Search",
        detail: "Narrow the search space step by step",
        href: "/patterns/modified-binary-search",
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
        name: "Adobe",
        detail: "Explore company interview questions",
        href: "/companies/adobe",
      },
    ],
  },
] as const;

export function PracticePreview({ signedIn }: { signedIn: boolean }) {
  const [selected, setSelected] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const Icon = categories[selected].icon;

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
    setSelected(next);
    tabs.current[next]?.focus();
  }

  return (
    <div className="yard-preview-wrap">
      <section className="yard-preview" aria-label="Explore PrepYard practice">
        <div className="yard-preview-top">
          <div>
            <Code2 size={18} aria-hidden="true" />
            <strong>Your practice, organized.</strong>
          </div>
          <span>Interactive preview</span>
        </div>
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
              {category.label}
            </button>
          ))}
        </div>
        {categories.map((category, index) => {
          const ItemIcon = category.icon;
          return (
            <div
              key={category.key}
              className="yard-preview-panel"
              role="tabpanel"
              id={`${id}-panel-${category.key}`}
              aria-labelledby={`${id}-tab-${category.key}`}
              hidden={selected !== index}
              tabIndex={0}
            >
              <p className="yard-preview-label">{category.heading}</p>
              <ul className="yard-preview-choices">
                {category.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      className="yard-preview-choice"
                      href={
                        signedIn
                          ? item.href
                          : "/login?next=" + encodeURIComponent(item.href)
                      }
                      prefetch={false}
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
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        <div className="yard-preview-bottom">
          <span>Curated starting points</span>
          <span>
            <LockKeyhole size={14} aria-hidden="true" />
            {signedIn ? "Choose one to practice" : "Log in to explore"}
          </span>
        </div>
      </section>
      <p className="yard-preview-caption">
        Pick a category, then choose where to begin.
      </p>
    </div>
  );
}
