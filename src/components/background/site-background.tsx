"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useState, type CSSProperties } from "react";
import { FloatingSymbols } from "./floating-symbols";
import { SITE_BACKGROUND_CONFIG } from "./site-background-config";

type BackgroundStyle = CSSProperties &
  Record<`--site-background-${string}`, string>;

const ThpaceBackground = dynamic(
  () => import("./thpace-background").then((module) => module.ThpaceBackground),
  { ssr: false },
);

export function SiteBackground() {
  const pathname = usePathname();
  const [backgroundReady, setBackgroundReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const handleReady = useCallback(() => setBackgroundReady(true), []);
  const handleFallback = useCallback(() => setFallback(true), []);
  const style: BackgroundStyle = {
    "--site-background-overlay-opacity": `${SITE_BACKGROUND_CONFIG.overlayOpacity * 100}%`,
    "--site-background-canvas-opacity": `${SITE_BACKGROUND_CONFIG.canvasOpacity}`,
    "--site-background-mobile-canvas-opacity": `${SITE_BACKGROUND_CONFIG.mobileCanvasOpacity}`,
    "--site-background-canvas-fade-duration": `${SITE_BACKGROUND_CONFIG.canvasFadeDurationMs}ms`,
    "--site-background-mouse-glow-size": `${SITE_BACKGROUND_CONFIG.mouseGlowSizePx}px`,
    "--site-background-mouse-glow-opacity": `${SITE_BACKGROUND_CONFIG.mouseGlowOpacity * 100}%`,
    "--site-background-reduced-symbol-opacity": `${SITE_BACKGROUND_CONFIG.reducedSymbolOpacityFactor}`,
    "--site-background-mouse-glow-transition": `${SITE_BACKGROUND_CONFIG.mouseGlowTransitionMs}ms`,
  };

  if (pathname !== "/" && pathname !== "/login" && pathname !== "/signup")
    return null;

  return (
    <div
      className={`site-background${backgroundReady ? " is-ready" : ""}${fallback ? " is-fallback" : ""}`}
      style={style}
      aria-hidden="true"
    >
      <div className="site-background__fallback" />
      <ThpaceBackground onReady={handleReady} onFallback={handleFallback} />
      <div className="site-background__overlay" />
      <div className="site-background__aurora" />
      <div className="site-background__mouse-glow" />
      <FloatingSymbols />
    </div>
  );
}
