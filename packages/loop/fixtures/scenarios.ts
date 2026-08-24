// Import Internal Dependencies
import type { FrameTape } from "../src/index.ts";

// CONSTANTS
const kFrame60 = 1000 / 60;
const kFrame144 = 1000 / 144;

export const SCENARIO_NAMES = [
  "tabSwitch",
  "sustainedOverload",
  "singleSlowFrame",
  "highRefresh144",
  "fixedFasterThanRender",
  "timeScaleZero"
] as const;

export type ScenarioName = typeof SCENARIO_NAMES[number];

function repeat(
  delta: number,
  count: number
): number[] {
  return Array.from({ length: count }, () => delta);
}

export const scenarios = {
  tabSwitch: {
    name: "tabSwitch",
    description: "Five seconds hidden: the return frame is clamped to " +
      "maxFrameDelta, panics once, and drops the rest.",
    options: {},
    deltas: [
      ...repeat(kFrame60, 4),
      5000,
      ...repeat(kFrame60, 4)
    ]
  },
  sustainedOverload: {
    name: "sustainedOverload",
    description: "200ms frames against a 60Hz simulation: every frame panics " +
      "and drop time climbs while the frame rate holds.",
    options: {},
    deltas: repeat(200, 10)
  },
  singleSlowFrame: {
    name: "singleSlowFrame",
    description: "One 80ms hitch: the next frame catches up within budget, " +
      "no panic and no clamp.",
    options: {},
    deltas: [
      ...repeat(kFrame60, 4),
      80,
      ...repeat(kFrame60, 4)
    ]
  },
  highRefresh144: {
    name: "highRefresh144",
    description: "144Hz display, 60Hz simulation: step-less frames are normal.",
    options: {},
    deltas: repeat(kFrame144, 16)
  },
  fixedFasterThanRender: {
    name: "fixedFasterThanRender",
    description: "120Hz simulation behind a 30fps render cap: time keeps " +
      "accumulating on frames that do not draw.",
    options: {
      fixedFps: 120,
      maxFps: 30
    },
    deltas: repeat(kFrame60, 16)
  },
  timeScaleZero: {
    name: "timeScaleZero",
    description: "Paused simulation: no steps ever run, rendering continues.",
    options: {
      timeScale: 0
    },
    deltas: repeat(kFrame60, 8)
  }
} satisfies Record<ScenarioName, FrameTape>;
