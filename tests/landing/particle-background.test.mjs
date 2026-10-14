import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const source = fs.readFileSync(
  new URL("../../src/lib/landing/particle-background.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;

function setup(width = 1024) {
  let clock = 0;
  let nextId = 0;
  let draws = 0;
  let points = [];
  let glow = [];
  const scheduled = new Map();
  const context = {
    clearRect() {
      draws++;
      points = [];
      glow = [];
    },
    createRadialGradient() {
      return { addColorStop: (offset, color) => glow.push({ offset, color }) };
    },
    fillRect() {},
    setTransform() {},
    beginPath() {},
    fill() {},
    arc(x, y, radius) {
      points.push({ x, y, radius });
    },
  };
  const canvas = {
    width: 0,
    height: 0,
    parentElement: { clientWidth: width, clientHeight: 720 },
    getContext: () => context,
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    window: { devicePixelRatio: 3 },
    performance: { now: () => clock },
    requestAnimationFrame: (callback) => {
      const id = ++nextId;
      scheduled.set(id, callback);
      return id;
    },
    cancelAnimationFrame: (id) => scheduled.delete(id),
  });
  const controller = exports.createParticleBackground(canvas);
  return {
    controller,
    canvas,
    scheduled,
    get draws() {
      return draws;
    },
    get points() {
      return points;
    },
    get glow() {
      return glow;
    },
    create: exports.createParticleBackground,
    runFrame(time) {
      clock = time;
      const [id, callback] = scheduled.entries().next().value;
      scheduled.delete(id);
      callback(time);
    },
  };
}

test("initial still frame requires no RAF and caps retina rendering", () => {
  const state = setup();
  assert.equal(state.draws, 1);
  assert.equal(state.points.length, 1300);
  assert.equal(state.scheduled.size, 0);
  assert.equal(state.canvas.width, 1536);
  assert.equal(state.canvas.height, 1080);
});

test("continuous playback is idempotent and capped at 30 FPS", () => {
  const state = setup();
  state.controller.play();
  state.controller.play();
  assert.equal(state.scheduled.size, 1);
  state.runFrame(16);
  assert.equal(state.draws, 1);
  state.runFrame(34);
  assert.equal(state.draws, 2);
  state.runFrame(50);
  assert.equal(state.draws, 2);
  assert.equal(state.scheduled.size, 1);
});

test("scrolling increases horizontal spread, particle size and gradient", () => {
  const state = setup();
  const radius = Math.max(...state.points.map((p) => p.radius));
  const spread = Math.max(...state.points.map((p) => Math.abs(p.x - 512)));
  const glow = state.glow[0].color;
  state.controller.setScroll(1);
  state.controller.play();
  for (let time = 40; time <= 800; time += 40) state.runFrame(time);
  assert.ok(Math.max(...state.points.map((p) => p.radius)) > radius);
  assert.ok(Math.max(...state.points.map((p) => Math.abs(p.x - 512))) > spread);
  assert.notEqual(state.glow[0].color, glow);
});

test("paused and destroyed backgrounds leave no scheduled animation", () => {
  const state = setup();
  state.controller.play();
  state.controller.pause();
  assert.equal(state.scheduled.size, 0);
  state.controller.setScroll(0.8);
  assert.equal(state.draws, 1);
  state.controller.play();
  assert.equal(state.scheduled.size, 1);
  state.controller.destroy();
  state.controller.play();
  state.controller.resize();
  assert.equal(state.scheduled.size, 0);
  assert.equal(state.draws, 1);
});

test("mobile keeps both near and far particles with half the draw count", () => {
  const desktop = setup();
  const mobile = setup(390);
  assert.equal(mobile.points.length, 650);
  assert.ok(Math.max(...mobile.points.map((p) => p.radius)) > 1.6);
  assert.ok(Math.min(...mobile.points.map((p) => p.radius)) < 0.4);
  mobile.controller.resize();
  assert.equal(mobile.draws, 1);
  assert.equal(desktop.points.length, mobile.points.length * 2);
});

test("unsupported canvas uses the CSS fallback", () => {
  const state = setup();
  assert.equal(state.create({ getContext: () => null }), null);
});
