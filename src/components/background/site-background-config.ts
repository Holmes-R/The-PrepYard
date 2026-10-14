import type { Settings } from "thpace/lib/interfaces";

export const SITE_BACKGROUND_CONFIG = {
  colors: ["#050505", "#0a2a1f", "#14532d", "#1c1f1d"],
  triangleSize: 120,
  mobileTriangleSize: 180,
  noise: 60,
  pointAnimationSpeed: 9000,
  maxFps: 60,
  mobileMaxFps: 30,
  automaticResize: true,
  particleSettings: {
    count: 0,
    opacity: 0,
  },
  mobileQuery: "(max-width: 767px)",
  finePointerQuery: "(hover: hover) and (pointer: fine)",
  reducedMotionQuery: "(prefers-reduced-motion: reduce)",
  maxLowPowerCores: 4,
  desktopSymbolCount: 24,
  reducedSymbolCount: 10,
  symbolSizeRange: [12, 28],
  symbolDurationRangeMs: [20000, 60000],
  symbolOpacityRange: [0.06, 0.2],
  symbolDriftRangePx: [-90, 90],
  symbolRotationRangeDeg: [-8, 8],
  symbolColors: ["#d4d4d4", "#a3a3a3", "#4edea3"],
  symbolMouseRadiusPx: 130,
  symbolMouseDisplacementPx: 18,
  mouseGlowSizePx: 480,
  mouseGlowOpacity: 0.12,
  canvasOpacity: 0.78,
  mobileCanvasOpacity: 0.64,
  reducedSymbolOpacityFactor: 0.55,
  scrollGlowFactor: 0.08,
  scrollGlowMaxPx: 180,
  canvasFadeDurationMs: 900,
  mouseGlowTransitionMs: 350,
  overlayOpacity: 0.56,
} as const;

export function getThpaceSettings(lowPower: boolean): Settings {
  return {
    colors: [...SITE_BACKGROUND_CONFIG.colors],
    triangleSize: lowPower
      ? SITE_BACKGROUND_CONFIG.mobileTriangleSize
      : SITE_BACKGROUND_CONFIG.triangleSize,
    noise: SITE_BACKGROUND_CONFIG.noise,
    pointAnimationSpeed: SITE_BACKGROUND_CONFIG.pointAnimationSpeed,
    maxFps: lowPower
      ? SITE_BACKGROUND_CONFIG.mobileMaxFps
      : SITE_BACKGROUND_CONFIG.maxFps,
    automaticResize: SITE_BACKGROUND_CONFIG.automaticResize,
    particleSettings: { ...SITE_BACKGROUND_CONFIG.particleSettings },
  };
}
