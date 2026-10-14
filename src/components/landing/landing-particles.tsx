"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ParticleBackground } from "@/lib/landing/particle-background";

const query = "(prefers-reduced-motion: reduce)";
function subscribe(callback: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const getMotionPreference = () => window.matchMedia(query).matches;
const getServerPreference = () => true;

export function LandingParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ParticleBackground | null>(null);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribe,
    getMotionPreference,
    getServerPreference,
  );
  const motionAllowed = !paused && !reducedMotion;
  const motionRef = useRef(motionAllowed);

  useEffect(() => {
    motionRef.current = motionAllowed;
    if (motionAllowed && !document.hidden) rendererRef.current?.play();
    else rendererRef.current?.pause();
  }, [motionAllowed]);

  useEffect(() => {
    let disposed = false;
    let renderer: ParticleBackground | null = null;
    let resizeFrame: number | null = null;
    const visibility = () => {
      if (motionRef.current && !document.hidden) renderer?.play();
      else renderer?.pause();
    };
    const scroll = () => {
      renderer?.setScroll(window.scrollY / Math.max(window.innerHeight * 2, 1));
    };
    const pointer = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !motionRef.current) return;
      renderer?.setPointer(
        event.clientX / Math.max(window.innerWidth, 1) - 0.5,
        event.clientY / Math.max(window.innerHeight, 1) - 0.5,
      );
    };
    const leave = () => renderer?.setPointer(0, 0);
    const resize = () => {
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = null;
        renderer?.resize();
        scroll();
      });
    };

    // The session wrapper can reveal the landing page without a window resize.
    const host = canvasRef.current?.parentElement;
    const sizeObserver =
      host && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(resize)
        : null;
    if (host) sizeObserver?.observe(host);

    // Only decorative code is deferred; the landing content renders immediately.
    void import("@/lib/landing/particle-background")
      .then(({ createParticleBackground }) => {
        if (disposed || !canvasRef.current) return;
        renderer = createParticleBackground(canvasRef.current);
        if (!renderer) return;
        rendererRef.current = renderer;
        scroll();
        visibility();
        setReady(true);
      })
      .catch(() => {
        // The quiet CSS gradient remains available if canvas cannot initialize.
      });

    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", pointer, { passive: true });
    document.addEventListener("pointerleave", leave);
    return () => {
      disposed = true;
      sizeObserver?.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", pointer);
      document.removeEventListener("pointerleave", leave);
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      renderer?.destroy();
      rendererRef.current = null;
    };
  }, []);

  return (
    <>
      <div className="yard-particle-background" aria-hidden="true">
        <canvas className="yard-particle-canvas" ref={canvasRef} />
        <div className="yard-particle-scrim" />
      </div>
      {ready && !reducedMotion && (
        <button
          type="button"
          className="yard-particle-toggle"
          aria-label={
            paused ? "Resume background motion" : "Pause background motion"
          }
          title={
            paused ? "Resume background motion" : "Pause background motion"
          }
          onClick={() => {
            const nextPaused = !paused;
            motionRef.current = !nextPaused && !reducedMotion;
            if (nextPaused) rendererRef.current?.pause();
            else if (!document.hidden) rendererRef.current?.play();
            setPaused(nextPaused);
          }}
        >
          {paused ? (
            <Play size={16} aria-hidden="true" />
          ) : (
            <Pause size={16} aria-hidden="true" />
          )}
        </button>
      )}
    </>
  );
}
