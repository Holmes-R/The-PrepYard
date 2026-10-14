"use client";

import { useEffect, useRef, useState } from "react";
import type { ThpaceGL as ThpaceGLInstance } from "thpace";
import {
  getThpaceSettings,
  SITE_BACKGROUND_CONFIG,
} from "./site-background-config";

export function ThpaceBackground({
  onReady,
  onFallback,
}: {
  onReady: () => void;
  onFallback: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const instanceRef = useRef<ThpaceGLInstance | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let didReveal = false;
    let readyFrame = 0;
    let secondReadyFrame = 0;
    const mobileQuery = window.matchMedia(SITE_BACKGROUND_CONFIG.mobileQuery);
    const reducedMotionQuery = window.matchMedia(
      SITE_BACKGROUND_CONFIG.reducedMotionQuery,
    );
    const lowPower = () =>
      mobileQuery.matches ||
      (navigator.hardwareConcurrency > 0 &&
        navigator.hardwareConcurrency <=
          SITE_BACKGROUND_CONFIG.maxLowPowerCores);

    const updatePowerSettings = () => {
      const instance = instanceRef.current;
      if (instance) instance.updateSettings(getThpaceSettings(lowPower()));
    };

    const revealCanvas = () => {
      if (didReveal || cancelled) return;
      readyFrame = requestAnimationFrame(() => {
        secondReadyFrame = requestAnimationFrame(() => {
          if (cancelled || document.hidden || reducedMotionQuery.matches)
            return;
          didReveal = true;
          setReady(true);
          onReady();
        });
      });
    };

    const syncVisibility = () => {
      const instance = instanceRef.current;
      if (!instance) return;
      if (document.hidden || reducedMotionQuery.matches) {
        cancelAnimationFrame(readyFrame);
        cancelAnimationFrame(secondReadyFrame);
        instance.stop();
      } else {
        instance.resume();
        instance.animate();
        revealCanvas();
      }
    };

    mobileQuery.addEventListener("change", updatePowerSettings);
    reducedMotionQuery.addEventListener("change", syncVisibility);
    document.addEventListener("visibilitychange", syncVisibility);

    void import("thpace")
      .then(({ ThpaceGL }) => {
        if (cancelled) return;
        if (!ThpaceGL.webglSupport()) {
          onFallback();
          return;
        }

        const instance = ThpaceGL.create(canvas, getThpaceSettings(lowPower()));
        if (!instance) {
          onFallback();
          return;
        }

        const animate = instance.animate.bind(instance);
        instance.animate = () => {
          if (instance.animating) animate();
        };
        instanceRef.current = instance;

        if (document.hidden || reducedMotionQuery.matches) {
          instance.stop();
          if (reducedMotionQuery.matches) onFallback();
        } else {
          revealCanvas();
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          onFallback();
          console.error("Unable to load the animated site background.", error);
        }
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(readyFrame);
      cancelAnimationFrame(secondReadyFrame);
      mobileQuery.removeEventListener("change", updatePowerSettings);
      reducedMotionQuery.removeEventListener("change", syncVisibility);
      document.removeEventListener("visibilitychange", syncVisibility);
      const instance = instanceRef.current;
      if (instance) {
        instance.stop();
        window.removeEventListener("resize", instance.resize);
        instanceRef.current = null;
      }
    };
  }, [onFallback, onReady]);

  return (
    <canvas
      ref={canvasRef}
      className={`site-background__canvas${ready ? " is-ready" : ""}`}
      aria-hidden="true"
    />
  );
}
