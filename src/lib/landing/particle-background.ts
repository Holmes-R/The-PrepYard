const FRAME_INTERVAL = 1000 / 30;
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/** Project a gently moving 3D point field onto a transparent background canvas. */
export function createParticleBackground(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) return null;

  let seed = 27;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // Sort once by depth; no per-frame array allocations or sorting are needed.
  const particles = Array.from({ length: 1300 }, () => ({
    x: random() * 2 - 1,
    z: random() * 2 - 1,
    offset: random() * 2 - 1,
    phase: random() * Math.PI * 2,
    radius: 0.6 + random() * 1.6,
  })).sort((a, b) => b.z - a.z);

  let width = 0;
  let height = 0;
  let pixelRatio = 0;
  let frame: number | null = null;
  let running = false;
  let disposed = false;
  let time = 0;
  let lastDraw = 0;
  let targetDepth = 0;
  let depth = 0;
  let targetX = 0;
  let targetY = 0;
  let pointerX = 0;
  let pointerY = 0;

  function draw() {
    if (!context || !width || !height) return;
    context.clearRect(0, 0, width, height);
    const centerY = height * 0.7;
    const strength = (0.06 + depth * 0.12) * (20 / 55);
    const glow = context.createRadialGradient(
      width * 0.5,
      centerY,
      0,
      width * 0.5,
      centerY,
      width * (0.52 + depth * 0.13),
    );
    glow.addColorStop(0, `rgba(109,171,153,${strength})`);
    glow.addColorStop(0.45, `rgba(65,111,156,${strength * 0.75})`);
    glow.addColorStop(1, "rgba(19,19,20,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);

    const step = width < 640 ? 2 : 1;
    const horizontalScale = 0.32 + depth * 0.4;
    for (let index = 0; index < particles.length; index += step) {
      const point = particles[index];
      const perspective = 1 / (1.9 + point.z * 0.7 - depth * 0.18);
      const wave =
        Math.sin(point.x * 4.5 + point.z * 2.2 + time * 0.23) *
        (34 + depth * 18);
      const x =
        width * 0.5 +
        point.x * width * horizontalScale * perspective * 1.55 +
        pointerX * (point.z + 1) * 7;
      const y =
        centerY +
        (wave + point.offset * (13 + depth * 10)) * perspective +
        point.z * 55 +
        pointerY * (point.z + 1) * 4;
      const radius = point.radius * perspective * (1.05 + depth * 0.9);
      if (
        x < -radius ||
        x > width + radius ||
        y < -radius ||
        y > height + radius
      )
        continue;
      const mix = (point.x + 1) / 2;
      const red = Math.round(169 - mix * 3);
      const green = Math.round(215 - mix * 15);
      const blue = Math.round(199 + mix * 56);
      const alpha =
        (0.22 + (1 - point.z) * 0.21 + depth * 0.16) *
        (0.86 + Math.sin(time * 0.5 + point.phase) * 0.14);
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fillStyle = `rgba(${red},${green},${blue},${Math.min(alpha, 0.9)})`;
      context.fill();
    }
  }

  function tick(now: number) {
    frame = null;
    if (!running || disposed) return;
    const elapsed = now - lastDraw;
    if (elapsed >= FRAME_INTERVAL) {
      const delta = Math.min(elapsed / 1000, 0.1);
      time += delta;
      const smoothing = 1 - Math.exp(-delta * 5);
      depth += (targetDepth - depth) * smoothing;
      pointerX += (targetX - pointerX) * smoothing;
      pointerY += (targetY - pointerY) * smoothing;
      draw();
      lastDraw = now - (elapsed % FRAME_INTERVAL);
    }
    frame = requestAnimationFrame(tick);
  }

  function pause() {
    running = false;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  }

  function resize() {
    if (disposed) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const nextWidth = parent.clientWidth;
    const nextHeight = parent.clientHeight;
    const nextRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    if (
      width === nextWidth &&
      height === nextHeight &&
      pixelRatio === nextRatio
    )
      return;
    width = nextWidth;
    height = nextHeight;
    pixelRatio = nextRatio;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    draw();
  }

  resize();
  return {
    play() {
      if (running || disposed) return;
      running = true;
      lastDraw = performance.now();
      frame = requestAnimationFrame(tick);
    },
    pause,
    resize,
    setScroll(progress: number) {
      if (!disposed) targetDepth = clamp(progress, 0, 1);
    },
    setPointer(x: number, y: number) {
      if (disposed) return;
      targetX = clamp(x, -0.5, 0.5);
      targetY = clamp(y, -0.5, 0.5);
    },
    destroy() {
      pause();
      disposed = true;
      particles.length = 0;
    },
  };
}

export type ParticleBackground = NonNullable<
  ReturnType<typeof createParticleBackground>
>;
