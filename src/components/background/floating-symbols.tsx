"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { SITE_BACKGROUND_CONFIG } from "./site-background-config";

const SYMBOL_TEXT = [
  "</>",
  "{ }",
  "[ ]",
  "( )",
  "->",
  "=>",
  "0x",
  "//",
  "&&",
  "||",
  ";",
  "#",
  "<>",
  "::",
  "O(n)",
  "1 0",
  "two pointers",
  "dfs",
  "[]",
  "{}",
  "==",
  "for",
  "while",
  "map",
];

type SymbolStyle = CSSProperties & Record<`--symbol-${string}`, string>;

function randomBetween([min, max]: readonly [number, number]) {
  return min + Math.random() * (max - min);
}

function createSymbols(count: number): SymbolStyle[] {
  return Array.from({ length: count }, (_, index) => {
    const depth = randomBetween([0.35, 1]);
    const duration = Math.min(
      randomBetween(SITE_BACKGROUND_CONFIG.symbolDurationRangeMs) *
        (1.5 - depth * 0.5),
      SITE_BACKGROUND_CONFIG.symbolDurationRangeMs[1],
    );
    return {
      "--symbol-x": `${Math.random() * 94 + 3}%`,
      "--symbol-y": `${Math.random() * 94 + 3}%`,
      "--symbol-depth": `${depth}`,
      "--symbol-size": `${randomBetween(SITE_BACKGROUND_CONFIG.symbolSizeRange) * (0.65 + depth * 0.35)}px`,
      "--symbol-duration": `${duration}ms`,
      "--symbol-delay": `${-Math.random() * SITE_BACKGROUND_CONFIG.symbolDurationRangeMs[1]}ms`,
      "--symbol-opacity": `${randomBetween(SITE_BACKGROUND_CONFIG.symbolOpacityRange) * depth}`,
      "--symbol-drift-x": `${randomBetween(SITE_BACKGROUND_CONFIG.symbolDriftRangePx)}px`,
      "--symbol-drift-y": `${randomBetween(SITE_BACKGROUND_CONFIG.symbolDriftRangePx)}px`,
      "--symbol-rotation": `${randomBetween(SITE_BACKGROUND_CONFIG.symbolRotationRangeDeg)}deg`,
      "--symbol-color":
        SITE_BACKGROUND_CONFIG.symbolColors[
          Math.floor(Math.random() * SITE_BACKGROUND_CONFIG.symbolColors.length)
        ],
      "--symbol-index": `${index}`,
    };
  });
}

export function FloatingSymbols() {
  const layerRef = useRef<HTMLDivElement>(null);
  const lowPowerRef = useRef(false);
  const [symbolStyles, setSymbolStyles] = useState<SymbolStyle[]>([]);
  const [lowPower, setLowPower] = useState(false);

  useEffect(() => {
    const mobileQuery = window.matchMedia(SITE_BACKGROUND_CONFIG.mobileQuery);
    const pointerQuery = window.matchMedia(
      SITE_BACKGROUND_CONFIG.finePointerQuery,
    );
    const reducedMotionQuery = window.matchMedia(
      SITE_BACKGROUND_CONFIG.reducedMotionQuery,
    );
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
    };
    const setVisibility = () => {
      layerRef.current?.classList.toggle("is-paused", document.hidden);
    };

    const setScrollParallax = () => {
      const parallax = `${Math.min(
        window.scrollY * SITE_BACKGROUND_CONFIG.scrollGlowFactor,
        SITE_BACKGROUND_CONFIG.scrollGlowMaxPx,
      )}px`;
      layerRef.current?.style.setProperty("--site-scroll-parallax", parallax);
      layerRef.current?.parentElement?.style.setProperty(
        "--site-scroll-parallax",
        parallax,
      );
    };

    const setMousePosition = (event: PointerEvent) => {
      if (
        lowPowerRef.current ||
        !pointerQuery.matches ||
        reducedMotionQuery.matches ||
        event.pointerType !== "mouse"
      ) {
        return;
      }

      const layer = layerRef.current;
      if (!layer) return;
      const bounds = layer.getBoundingClientRect();
      layer.style.setProperty(
        "--site-pointer-x",
        `${event.clientX - bounds.left}px`,
      );
      layer.style.setProperty(
        "--site-pointer-y",
        `${event.clientY - bounds.top}px`,
      );
      layer.parentElement?.style.setProperty(
        "--site-pointer-x",
        `${event.clientX - bounds.left}px`,
      );
      layer.parentElement?.style.setProperty(
        "--site-pointer-y",
        `${event.clientY - bounds.top}px`,
      );
      layer.parentElement?.classList.add("has-pointer");

      layer
        .querySelectorAll<HTMLElement>(".site-background__symbol")
        .forEach((el) => {
          const symbolBounds = el.getBoundingClientRect();
          const dx = symbolBounds.left + symbolBounds.width / 2 - event.clientX;
          const dy = symbolBounds.top + symbolBounds.height / 2 - event.clientY;
          const distance = Math.hypot(dx, dy);
          const influence =
            distance > SITE_BACKGROUND_CONFIG.symbolMouseRadiusPx
              ? 0
              : (1 - distance / SITE_BACKGROUND_CONFIG.symbolMouseRadiusPx) *
                SITE_BACKGROUND_CONFIG.symbolMouseDisplacementPx;
          const x = distance ? (dx / distance) * influence : 0;
          const y = distance ? (dy / distance) * influence : 0;
          el.style.setProperty("--symbol-mouse-x", `${x}px`);
          el.style.setProperty("--symbol-mouse-y", `${y}px`);
        });
    };

    refreshSymbols();
    setVisibility();
    setScrollParallax();
    document.addEventListener("visibilitychange", setVisibility);
    window.addEventListener("scroll", setScrollParallax, { passive: true });
    window.addEventListener("pointermove", setMousePosition, { passive: true });
    mobileQuery.addEventListener("change", refreshSymbols);

    return () => {
      document.removeEventListener("visibilitychange", setVisibility);
      window.removeEventListener("scroll", setScrollParallax);
      window.removeEventListener("pointermove", setMousePosition);
      mobileQuery.removeEventListener("change", refreshSymbols);
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
