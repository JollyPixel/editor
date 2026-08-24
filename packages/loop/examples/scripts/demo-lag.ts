// Import Internal Dependencies
import {
  FrameScheduler,
  GameLoop,
  RafFrameSource,
  type FrameCallback,
  type FrameSchedule,
  type FrameSource,
  type FrameTape
} from "../../src/index.ts";
import { SCENARIO_NAMES, scenarios } from "../../fixtures/scenarios.ts";
import { burn } from "./utils/burn.ts";
import { requireElement } from "./utils/dom.ts";
import { createExamplePane } from "./utils/example-pane.ts";
import { FramePlot } from "./utils/frame-plot.ts";

// CONSTANTS
const kRefreshIntervalMs = 150;
const kTabSwitchMs = 5000;
const kLiveMode = "live";

/**
 * Drops frames to simulate a hidden tab. Demo use only.
 */
class GatedFrameSource implements FrameSource {
  #inner: FrameSource;
  #gatedUntil = 0;

  constructor(
    inner: FrameSource
  ) {
    this.#inner = inner;
  }

  gate(
    durationMs: number
  ): void {
    this.#gatedUntil = performance.now() + durationMs;
  }

  start(
    callback: FrameCallback
  ): void {
    this.#inner.start((now) => {
      if (performance.now() < this.#gatedUntil) {
        return;
      }
      callback(now);
    });
  }

  stop(): void {
    this.#inner.stop();
  }
}

const canvas = requireElement<HTMLCanvasElement>("#plot");
const plot = new FramePlot(canvas);
const source = new GatedFrameSource(new RafFrameSource());
const loop = new GameLoop({ source });

const injection = {
  overload: false,
  // Sits well over the step budget below, so the toggle either clearly panics
  // or clearly does not.
  workPerFrameMs: 120
};

const readout = {
  mode: kLiveMode,
  budget: budgetOf(loop.scheduler),
  behind: "0 ms",
  droppedMs: 0,
  clamps: 0,
  panics: 0,
  drawn: 0
};

let drawnInWindow = 0;
let windowStartedAt = performance.now();
let refreshedAt = 0;

const pane = createExamplePane({ title: "Lag" });

useLimits(loop.scheduler);

const inject = pane.addFolder({ title: "Inject (live)", expanded: true });
inject
  .addButton({ title: "One-off stall (400 ms)" })
  .on("click", () => stall(400));
inject
  .addButton({ title: "One-off stall (1.2 s)" })
  .on("click", () => stall(1200));
inject
  .addBinding(injection, "workPerFrameMs", {
    label: "work / frame",
    min: 5,
    max: 250,
    step: 5
  });
inject
  .addBinding(injection, "overload", { label: "sustained overload" })
  .on("change", ({ value }) => {
    plot.mark(
      value ? `overload ${injection.workPerFrameMs} ms` : "overload off"
    );
  });
inject
  .addButton({ title: `Hide the tab (${kTabSwitchMs / 1000} s)` })
  .on("click", () => {
    source.gate(kTabSwitchMs);
    plot.mark("tab hidden");
  });

pane.addSeparator();

const replay = pane.addFolder({ title: "Replay (deterministic)", expanded: true });
for (const name of SCENARIO_NAMES) {
  replay
    .addButton({ title: name })
    .on("click", () => replayTape(scenarios[name]));
}
replay
  .addButton({ title: "Back to live" })
  .on("click", () => resumeLive());

pane.addSeparator();

const totals = pane.addFolder({ title: "Totals", expanded: true });
totals.addMonitors(readout, {
  mode: { label: "showing" },
  drawn: { label: "fps (live)", format: (value) => value.toFixed(0) },
  budget: {
    label: "step budget",
    format: (value) => `${value.toFixed(0)} ms/frame`
  },
  behind: { label: "unstepped" },
  droppedMs: {
    label: "dropped",
    format: (value) => `${value.toFixed(0)} ms`
  },
  clamps: { label: "clamps", format: (value) => value.toFixed(0) },
  panics: { label: "panics", format: (value) => value.toFixed(0) }
});
totals
  .addButton({ title: "Reset counters" })
  .on("click", () => {
    resetCounters();
    plot.clear();
  });

// A replay freezes its own totals on the panel; the live loop keeps running
// behind it and must not write into them.
loop.on("clamp", () => {
  if (readout.mode === kLiveMode) {
    readout.clamps++;
  }
});
loop.on("panic", ({ droppedMs }) => {
  if (readout.mode !== kLiveMode) {
    return;
  }
  readout.panics++;
  readout.droppedMs += droppedMs;
});

loop.start({
  frame: (schedule) => {
    if (readout.mode === kLiveMode) {
      plot.push(schedule);
    }
  },
  update: () => {
    drawnInWindow++;
    if (readout.mode === kLiveMode) {
      plot.draw();
    }
    refresh();

    // End-of-frame work becomes the next delta. Past the step budget, the
    // extra simulation time is dropped instead of stepped.
    if (injection.overload) {
      burn(injection.workPerFrameMs);
    }
  }
});

/**
 * Milliseconds of simulation one frame may run before the budget drops time.
 */
function budgetOf(
  scheduler: FrameScheduler
): number {
  return scheduler.maxStepsPerFrame * scheduler.fixedDelta;
}

/**
 * Points the plot reference lines and the budget readout at one scheduler.
 */
function useLimits(
  scheduler: FrameScheduler
): void {
  plot.limits = {
    maxFrameDelta: scheduler.maxFrameDelta,
    maxStepsPerFrame: scheduler.maxStepsPerFrame
  };
  readout.budget = budgetOf(scheduler);
}

function stall(
  durationMs: number
): void {
  plot.mark(`stall ${durationMs} ms`);
  burn(durationMs);
}

/**
 * Replays a shared scenario through a temporary scheduler.
 */
function replayTape(
  tape: FrameTape
): void {
  const scheduler = new FrameScheduler(tape.options);
  const schedules: FrameSchedule[] = [];
  let now = 0;
  scheduler.advance(now);

  for (const delta of tape.deltas) {
    now += delta;
    schedules.push(scheduler.advance(now));
  }

  readout.mode = tape.name;
  readout.behind = `${(scheduler.elapsed - scheduler.time).toFixed(0)} ms`;
  readout.droppedMs = scheduler.droppedTime;
  readout.clamps = schedules.filter(({ clamped }) => clamped).length;
  readout.panics = schedules.filter(({ panicked }) => panicked).length;
  useLimits(scheduler);
  plot.replace(schedules);
  plot.draw();
  pane.refresh();
  console.info(`${tape.name}: ${tape.description}`);
}

function resumeLive(): void {
  readout.mode = kLiveMode;
  resetCounters();
  useLimits(loop.scheduler);
  plot.clear();
}

function resetCounters(): void {
  readout.droppedMs = 0;
  readout.clamps = 0;
  readout.panics = 0;
}

function refresh(): void {
  const now = performance.now();
  const windowMs = now - windowStartedAt;
  if (windowMs >= 1000) {
    readout.drawn = (drawnInWindow / windowMs) * 1000;
    drawnInWindow = 0;
    windowStartedAt = now;
  }

  if (now - refreshedAt < kRefreshIntervalMs) {
    return;
  }
  refreshedAt = now;

  // Keep live frame-rate reporting active while replay values stay frozen.
  if (readout.mode === kLiveMode) {
    const { scheduler } = loop;
    readout.behind = `${(scheduler.elapsed - scheduler.time).toFixed(0)} ms`;
  }
  pane.refresh();
}
