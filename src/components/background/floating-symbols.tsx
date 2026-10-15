"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { SITE_BACKGROUND_CONFIG } from "./site-background-config";

const SYMBOL_TEXT = [
  "Arrays",
  "Linked Lists",
  "Stacks",
  "Queues",
  "Hash Tables",
  "Binary Trees",
  "Graphs",
  "Heaps",
  "Binary Search",
  "Two Pointers",
  "Sliding Window",
  "Dynamic Programming",
  "Prefix Sum",
  "Backtracking",
  "Greedy",
  "Recursion",
  "Merge Sort",
  "Quick Sort",
  "Union Find",
  "Topological Sort",
  "Monotonic Stack",
  "Trie",
  "BFS",
  "DFS",
  "O(n log n)",
  "O(1)",
  "dp[i] = max(...)",
  "prefix[r] - prefix[l]",
  "left < right",
  "visited[node]",
  "heap.pop()",
  "dfs(root)",
];

type SymbolStyle = CSSProperties & Record<`--symbol-${string}`, string>;

function randomBetween([min, max]: readonly [number, number]) {
  return min + Math.random() * (max - min);
}

function createSymbols(count: number): SymbolStyle[] {
  const columns = count <= SITE_BACKGROUND_CONFIG.reducedSymbolCount ? 3 : 6;
  const rows = Math.ceil(count / columns);
  return Array.from({ length: count }, (_, index) => {
    const depth = randomBetween([0.35, 1]);
    // Spread text across cells so it cannot cluster into an unreadable cloud.
    return {
      "--symbol-x": `${((index % columns) + randomBetween([0.12, 0.48])) * (100 / columns)}%`,
      "--symbol-y": `${(Math.floor(index / columns) + randomBetween([0.2, 0.8])) * (100 / rows)}%`,
      "--symbol-depth": `${depth}`,
      "--symbol-size": `${randomBetween(SITE_BACKGROUND_CONFIG.symbolSizeRange) * (0.8 + depth * 0.2)}px`,
      "--symbol-duration": `${randomBetween(SITE_BACKGROUND_CONFIG.symbolDurationRangeMs)}ms`,
      "--symbol-delay": `${-Math.random() * SITE_BACKGROUND_CONFIG.symbolDurationRangeMs[1]}ms`,
      "--symbol-opacity": `${randomBetween(SITE_BACKGROUND_CONFIG.symbolOpacityRange) * depth}`,
      "--symbol-drift-x": `${randomBetween(SITE_BACKGROUND_CONFIG.symbolDriftRangePx)}px`,
      "--symbol-drift-y": `${randomBetween(SITE_BACKGROUND_CONFIG.symbolDriftRangePx)}px`,
      "--symbol-rotation": `${randomBetween(SITE_BACKGROUND_CONFIG.symbolRotationRangeDeg)}deg`,
      "--symbol-color":
        SITE_BACKGROUND_CONFIG.symbolColors[
          index % SITE_BACKGROUND_CONFIG.symbolColors.length
        ],
    };
  });
}

export function FloatingSymbols() {
  const layerRef = useRef<HTMLDivElement>(null);
  const lowPowerRef = useRef(false);
  const [symbolStyles, setSymbolStyles] = useState<SymbolStyle[]>([]);
  const [lowPower, setLowPower] = useState(false);

  useEffect(() => {
    const layer = layerRef.current;
    const background = layer?.parentElement;
    if (!layer || !background) return;

    const mobileQuery = window.matchMedia(SITE_BACKGROUND_CONFIG.mobileQuery);
    const pointerQuery = window.matchMedia(
      SITE_BACKGROUND_CONFIG.finePointerQuery,
    );
    const reducedMotionQuery = window.matchMedia(
      SITE_BACKGROUND_CONFIG.reducedMotionQuery,
    );
    let frame = 0;
    let pointer: { x: number; y: number } | null = null;

    const resetMotion = () => {
      pointer = null;
      background.classList.remove("has-pointer");
      for (const property of [
        "--site-pointer-x",
        "--site-pointer-y",
        "--site-pointer-shift-x",
        "--site-pointer-shift-y",
        "--site-scroll-parallax",
        "--site-scroll-progress",
      ]) {
        background.style.removeProperty(property);
      }
    };

    const updateMotion = () => {
      frame = 0;
      if (document.hidden || reducedMotionQuery.matches) return;
      const scrollRange = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const progress = Math.min(1, Math.max(0, window.scrollY / scrollRange));
      background.style.setProperty(
        "--site-scroll-progress",
        progress.toFixed(4),
      );
      background.style.setProperty(
        "--site-scroll-parallax",
        `${progress * SITE_BACKGROUND_CONFIG.scrollGlowMaxPx}px`,
      );
      const canFollowPointer =
        pointer && !lowPowerRef.current && pointerQuery.matches;
      background.classList.toggle("has-pointer", Boolean(canFollowPointer));
      const x = canFollowPointer ? pointer!.x : window.innerWidth / 2;
      const y = canFollowPointer ? pointer!.y : window.innerHeight / 2;
      background.style.setProperty("--site-pointer-x", `${x}px`);
      background.style.setProperty("--site-pointer-y", `${y}px`);
      background.style.setProperty(
        "--site-pointer-shift-x",
        `${(x / Math.max(1, window.innerWidth) - 0.5) * 40}px`,
      );
      background.style.setProperty(
        "--site-pointer-shift-y",
        `${(y / Math.max(1, window.innerHeight) - 0.5) * 32}px`,
      );
    };

    // At most one update per frame; pointer movement never re-renders React.
    const scheduleMotion = () => {
      if (!frame && !document.hidden && !reducedMotionQuery.matches) {
        frame = requestAnimationFrame(updateMotion);
      }
    };
    const setMousePosition = (event: PointerEvent) => {
      if (
        event.pointerType !== "mouse" ||
        lowPowerRef.current ||
        !pointerQuery.matches ||
        reducedMotionQuery.matches
      )
        return;
      pointer = { x: event.clientX, y: event.clientY };
      scheduleMotion();
    };
    const clearPointer = () => {
      pointer = null;
      background.classList.remove("has-pointer");
      scheduleMotion();
    };
    const setVisibility = () => {
      layer.classList.toggle("is-paused", document.hidden);
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
        clearPointer();
      } else scheduleMotion();
    };
    const refreshSymbols = () => {
      const isLowPower =
        mobileQuery.matches ||
        (navigator.hardwareConcurrency > 0 &&
          navigator.hardwareConcurrency <=
            SITE_BACKGROUND_CONFIG.maxLowPowerCores);
      lowPowerRef.current = isLowPower;
      setLowPower(isLowPower);
      setSymbolStyles(
        createSymbols(
          isLowPower
            ? SITE_BACKGROUND_CONFIG.reducedSymbolCount
            : SITE_BACKGROUND_CONFIG.desktopSymbolCount,
        ),
      );
      clearPointer();
    };
    const syncMotionPreference = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      resetMotion();
      scheduleMotion();
    };

    refreshSymbols();
    setVisibility();
    document.addEventListener("visibilitychange", setVisibility);
    document.documentElement.addEventListener("pointerleave", clearPointer);
    window.addEventListener("blur", clearPointer);
    window.addEventListener("scroll", scheduleMotion, { passive: true });
    window.addEventListener("resize", scheduleMotion, { passive: true });
    window.addEventListener("pointermove", setMousePosition, { passive: true });
    mobileQuery.addEventListener("change", refreshSymbols);
    pointerQuery.addEventListener("change", syncMotionPreference);
    reducedMotionQuery.addEventListener("change", syncMotionPreference);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", setVisibility);
      document.documentElement.removeEventListener(
        "pointerleave",
        clearPointer,
      );
      window.removeEventListener("blur", clearPointer);
      window.removeEventListener("scroll", scheduleMotion);
      window.removeEventListener("resize", scheduleMotion);
      window.removeEventListener("pointermove", setMousePosition);
      mobileQuery.removeEventListener("change", refreshSymbols);
      pointerQuery.removeEventListener("change", syncMotionPreference);
      reducedMotionQuery.removeEventListener("change", syncMotionPreference);
      resetMotion();
    };
  }, []);

  return (
    <div
      ref={layerRef}
      className={`site-background__symbols${lowPower ? " is-low-power" : ""}`}
      aria-hidden="true"
    >
      {symbolStyles.map((style, index) => (
        <span className="site-background__symbol" key={index} style={style}>
          <span>{SYMBOL_TEXT[index % SYMBOL_TEXT.length]}</span>
        </span>
      ))}
    </div>
  );
}
