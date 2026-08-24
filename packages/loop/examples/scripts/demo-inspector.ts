// Import Third-party Dependencies
import type { BindingOptions } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { GameLoop } from "../../src/index.ts";
import { requireElement } from "./utils/dom.ts";
import { createExamplePane } from "./utils/example-pane.ts";
import { FramePlot } from "./utils/frame-plot.ts";

// CONSTANTS
const kRefreshIntervalMs = 200;

const canvas = requireElement<HTMLCanvasElement>("#plot");
const plot = new FramePlot(canvas);
const loop = new GameLoop();

const settings = {
  fixedFps: loop.scheduler.fixedFps,
  maxFps: 0,
  timeScale: loop.timeScale,
  maxFrameDelta: loop.scheduler.maxFrameDelta,
  maxStepsPerFrame: loop.scheduler.maxStepsPerFrame
};

const readout = {
  fps: 0,
  drawn: 0,
  stepsPerSecond: 0,
  alpha: 0,
  paused: "no",
  simulated: "0.0 s",
  unstepped: "0 ms",
  droppedMs: 0,
  clamps: 0,
  panics: 0
};

let framesInWindow = 0;
let drawnInWindow = 0;
let stepsInWindow = 0;
let windowStartedAt = performance.now();
let refreshedAt = 0;

const pane = createExamplePane({ title: "Scheduler" });

syncLimits();

bindSetting(
  "fixedFps",
  { min: 5, max: 240, step: 1 },
  (value) => {
    loop.scheduler.fixedFps = value;
  }
);
bindSetting(
  "maxFps",
  { label: "maxFps (0 = off)", min: 0, max: 240, step: 1 },
  (value) => {
    loop.scheduler.maxFps = value === 0 ? Infinity : value;
  }
);
bindSetting(
  "timeScale",
  { min: 0, max: 4, step: 0.05 },
  (value) => {
    loop.timeScale = value;
  }
);
bindSetting(
  "maxFrameDelta",
  { min: 20, max: 2000, step: 10 },
  (value) => {
    loop.scheduler.maxFrameDelta = value;
  }
);
bindSetting(
  "maxStepsPerFrame",
  { min: 1, max: 30, step: 1 },
  (value) => {
    loop.scheduler.maxStepsPerFrame = value;
  }
);

pane.addSeparator();
pane
  .addButton({ title: "Pause / resume" })
  .on("click", () => {
    if (loop.paused) {
      loop.resume();
    }
    else {
      loop.pause();
    }
    readout.paused = loop.paused ? "yes" : "no";
    plot.mark(loop.paused ? "paused" : "resumed");
    pane.refresh();
  });
pane
  .addButton({ title: "Clear plot" })
  .on("click", () => plot.clear());

const state = pane.addFolder({ title: "This second", expanded: true });
state.addMonitors(readout, {
  fps: { label: "frames", format: (value) => value.toFixed(0) },
  drawn: { label: "drawn", format: (value) => value.toFixed(0) },
  stepsPerSecond: { label: "fixed steps", format: (value) => value.toFixed(0) },
  alpha: { label: "alpha", format: (value) => value.toFixed(3) },
  paused: { label: "paused" }
});

const totals = pane.addFolder({ title: "Since start", expanded: true });
totals.addMonitors(readout, {
  simulated: { label: "simulated" },
  // `elapsed - time` is accumulator + dropped time, not lag against the wall
  // clock: elapsed is already clamped and scaled.
  unstepped: { label: "unstepped" },
  droppedMs: {
    label: "dropped",
    format: (value) => `${value.toFixed(0)} ms`
  },
  clamps: { label: "clamps", format: (value) => value.toFixed(0) },
  panics: { label: "panics", format: (value) => value.toFixed(0) }
});

loop.on("clamp", () => {
  readout.clamps++;
});
loop.on("panic", ({ droppedMs }) => {
  readout.panics++;
  readout.droppedMs += droppedMs;
});

loop.start({
  frame: (schedule) => {
    plot.push(schedule);
    framesInWindow++;
    stepsInWindow += schedule.steps;
    tickWindow();
  },
  update: () => {
    drawnInWindow++;
    plot.draw();
    refresh();
  }
});

/**
 * Applies a slider to the scheduler and flags the change on the plot, so the
 * frames drawn before it are not mistaken for the new setting.
 */
function bindSetting(
  key: keyof typeof settings,
  options: BindingOptions<number>,
  apply: (value: number) => void
): void {
  pane
    .addBinding(settings, key, options)
    .on("change", ({ value }) => {
      apply(value);
      syncLimits();
      plot.mark(`${key} = ${value}`);
    });
}

/**
 * Keeps the plot reference lines on the values the scheduler holds now.
 */
function syncLimits(): void {
  plot.limits = {
    maxFrameDelta: loop.scheduler.maxFrameDelta,
    maxStepsPerFrame: loop.scheduler.maxStepsPerFrame
  };
}

/**
 * Per second counters. Frame rate is measured here rather than in the package:
 * `@jolly-pixel/ui` already owns metric aggregation, and a second copy of a
 * rolling average is how the same value ends up computed three different ways.
 */
function tickWindow(): void {
  const now = performance.now();
  const windowMs = now - windowStartedAt;
  if (windowMs < 1000) {
    return;
  }

  readout.fps = (framesInWindow / windowMs) * 1000;
  readout.drawn = (drawnInWindow / windowMs) * 1000;
  readout.stepsPerSecond = (stepsInWindow / windowMs) * 1000;
  framesInWindow = 0;
  drawnInWindow = 0;
  stepsInWindow = 0;
  windowStartedAt = now;
}

function refresh(): void {
  const now = performance.now();
  if (now - refreshedAt < kRefreshIntervalMs) {
    return;
  }
  refreshedAt = now;

  const { scheduler } = loop;
  readout.alpha = scheduler.accumulator / scheduler.fixedDelta;
  readout.simulated = `${(scheduler.time / 1000).toFixed(1)} s`;
  readout.unstepped = `${(scheduler.elapsed - scheduler.time).toFixed(0)} ms`;
  pane.refresh();
}
