"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const revealSelector = [
  ".yard-section-heading",
  ".yard-feature",
  ".yard-collection",
  ".yard-steps > li",
  ".yard-faq-list > details",
  ".yard-closing",
  ".dashboard-stats > div",
  ".dashboard-collection-card",
  ".dashboard-panel",
  ".company-card",
  ".dsa-topic",
].join(",");

export function ScrollReveal() {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    const hasNavigated = previousPathname.current !== pathname;
    previousPathname.current = pathname;

    if (
      !hasNavigated ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const main = document.getElementById("main-content");
    if (!main) return;

    main.classList.remove("is-route-entering");
    void main.offsetWidth;
    main.classList.add("is-route-entering");
  }, [pathname]);

  useEffect(() => {
    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    if (motionPreference.matches || !("IntersectionObserver" in window)) {
      return;
    }

    const revealed = new WeakSet<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-scroll-visible");
          revealed.add(entry.target);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    function observeElements() {
      document.querySelectorAll(revealSelector).forEach((element) => {
        if (revealed.has(element)) return;
        const top = element.getBoundingClientRect().top;
        if (top < window.innerHeight * 0.9) {
          element.classList.add("is-scroll-visible");
          revealed.add(element);
        } else {
          observer.observe(element);
        }
      });
    }

    document.body.classList.add("has-scroll-reveal");
    observeElements();
    const mutations = new MutationObserver(observeElements);
    mutations.observe(
      document.getElementById("main-content") ?? document.body,
      {
        childList: true,
        subtree: true,
      },
    );

    return () => {
      document.body.classList.remove("has-scroll-reveal");
      mutations.disconnect();
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
