"use client";

import { useSyncExternalStore, type CSSProperties } from "react";

export const LANDING_MOTION = {
  easingCss: "cubic-bezier(0.22, 1, 0.36, 1)",
  easing: [0.22, 1, 0.36, 1] as const,
  hero: {
    wordDurationMs: 560,
    wordStaggerMs: 80,
    headlineDelayMs: 100,
    badgeDelayMs: 0,
    paragraphDelayMs: 1240,
    actionsDelayMs: 1400,
    noteDelayMs: 1540,
    highlightsDelayMs: 1660,
    entryDurationMs: 680,
    dotPulseMs: 2400,
    buttonHoverMs: 220,
    shimmerMs: 8000,
    shimmerStartDelayMs: 0,
  },
  preview: {
    floatMs: 6000,
    floatDistancePx: -7,
    borderSweepMs: 14000,
    tiltMaxDegrees: 6,
    tiltSpring: {
      stiffness: 120,
      damping: 24,
      mass: 0.8,
    },
    floatStartDelayMs: 1000,
    autoAdvanceMs: 5000,
    resumeAfterMs: 4000,
    tabTransitionMs: 420,
    panelTransitionMs: 240,
    rowTransitionMs: 360,
    rowStaggerMs: 60,
    scannerCycleMs: 7200,
    scannerRowDelayMs: 1800,
    signalSweepMs: 5500,
    orbitPulseMs: 3000,
    auroraDriftMs: 16000,
    featureBreatheMs: 5000,
    stepBeaconMs: 4500,
    numberGlowMs: 4000,
    featureDelayMs: [0, -1200, -2500, -3700] as const,
    stepDelayMs: [0, -1500, -3000] as const,
    collectionDelayMs: [0, -1300, -2600] as const,
    symbolParallaxMs: 600,
    orbDelayMs: [0, -8000, -14000] as const,
    symbolFadeCycleMs: 12500,
  },
  background: {
    orbDriftMs: 26000,
  },
  sections: {
    revealMs: 700,
    revealOffsetPx: 20,
  },
  navbar: {
    scrollThresholdPx: 12,
    transitionMs: 280,
  },
} as const;

type MotionStyle = CSSProperties & Record<`--yard-${string}`, string>;

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeToMotionPreference(onChange: () => void) {
  const mediaQuery = window.matchMedia(reducedMotionQuery);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

function getMotionPreference() {
  return window.matchMedia(reducedMotionQuery).matches;
}

export function useLandingReducedMotion() {
  return useSyncExternalStore(
    subscribeToMotionPreference,
    getMotionPreference,
    () => false,
  );
}

export const LANDING_MOTION_STYLE: MotionStyle = {
  "--yard-motion-ease": LANDING_MOTION.easingCss,
  "--yard-hero-word-duration": `${LANDING_MOTION.hero.wordDurationMs}ms`,
  "--yard-hero-entry-duration": `${LANDING_MOTION.hero.entryDurationMs}ms`,
  "--yard-hero-dot-pulse-duration": `${LANDING_MOTION.hero.dotPulseMs}ms`,
  "--yard-button-hover-duration": `${LANDING_MOTION.hero.buttonHoverMs}ms`,
  "--yard-hero-shimmer-duration": `${LANDING_MOTION.hero.shimmerMs}ms`,
  "--yard-hero-shimmer-delay": `${LANDING_MOTION.hero.shimmerStartDelayMs}ms`,
  "--yard-aurora-duration": `${LANDING_MOTION.preview.auroraDriftMs}ms`,
  "--yard-preview-float-duration": `${LANDING_MOTION.preview.floatMs}ms`,
  "--yard-preview-float-distance": `${LANDING_MOTION.preview.floatDistancePx}px`,
  "--yard-preview-border-duration": `${LANDING_MOTION.preview.borderSweepMs}ms`,
  "--yard-preview-float-delay": `${LANDING_MOTION.preview.floatStartDelayMs}ms`,
  "--yard-preview-signal-duration": `${LANDING_MOTION.preview.signalSweepMs}ms`,
  "--yard-symbol-parallax-duration": `${LANDING_MOTION.preview.symbolParallaxMs}ms`,
  "--yard-preview-orbit-duration": `${LANDING_MOTION.preview.orbitPulseMs}ms`,
  "--yard-feature-breathe-duration": `${LANDING_MOTION.preview.featureBreatheMs}ms`,
  "--yard-step-beacon-duration": `${LANDING_MOTION.preview.stepBeaconMs}ms`,
  "--yard-number-glow-duration": `${LANDING_MOTION.preview.numberGlowMs}ms`,
  "--yard-feature-delay-2": `${LANDING_MOTION.preview.featureDelayMs[1]}ms`,
  "--yard-feature-delay-3": `${LANDING_MOTION.preview.featureDelayMs[2]}ms`,
  "--yard-feature-delay-4": `${LANDING_MOTION.preview.featureDelayMs[3]}ms`,
  "--yard-step-delay-2": `${LANDING_MOTION.preview.stepDelayMs[1]}ms`,
  "--yard-step-delay-3": `${LANDING_MOTION.preview.stepDelayMs[2]}ms`,
  "--yard-collection-delay-2": `${LANDING_MOTION.preview.collectionDelayMs[1]}ms`,
  "--yard-collection-delay-3": `${LANDING_MOTION.preview.collectionDelayMs[2]}ms`,
  "--yard-background-orb-duration": `${LANDING_MOTION.background.orbDriftMs}ms`,
  "--yard-background-orb-delay-2": `${LANDING_MOTION.preview.orbDelayMs[1]}ms`,
  "--yard-background-orb-delay-3": `${LANDING_MOTION.preview.orbDelayMs[2]}ms`,
  "--yard-symbol-cycle-duration": `${LANDING_MOTION.preview.symbolFadeCycleMs}ms`,
  "--yard-section-reveal-duration": `${LANDING_MOTION.sections.revealMs}ms`,
  "--yard-section-reveal-offset": `${LANDING_MOTION.sections.revealOffsetPx}px`,
  "--yard-preview-scanner-duration": `${LANDING_MOTION.preview.scannerCycleMs}ms`,
};

export const LANDING_NAV_STYLE: MotionStyle = {
  "--yard-navbar-transition": `${LANDING_MOTION.navbar.transitionMs}ms`,
  "--yard-motion-ease": LANDING_MOTION.easingCss,
};

export function landingDelayStyle(delayMs: number): MotionStyle {
  return { "--yard-entry-delay": `${delayMs}ms` };
}

export function landingWordDelayStyle(delayMs: number): MotionStyle {
  return { "--yard-word-delay": `${delayMs}ms` };
}

export function landingRowStyle(index: number): MotionStyle {
  return {
    "--yard-row-scan-delay": `${index * LANDING_MOTION.preview.scannerRowDelayMs}ms`,
  };
}

export function landingSymbolStyle(
  index: number,
  x: number,
  y: number,
  total: number,
): MotionStyle {
  return {
    "--yard-symbol-x": `${x}%`,
    "--yard-symbol-y": `${y}%`,
    "--yard-symbol-delay": `${-Math.round((LANDING_MOTION.preview.symbolFadeCycleMs / total) * index)}ms`,
  };
}
