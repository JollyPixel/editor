// Import Internal Dependencies
import {
  GameLoop,
  Interpolated,
  lerpNumber
} from "../../src/index.ts";
import { requireContext2d, requireElement } from "./utils/dom.ts";
import { createExamplePane } from "./utils/example-pane.ts";
import { framePlotColors } from "./utils/frame-plot.ts";

// CONSTANTS
const kRefreshIntervalMs = 250;
const kSquare = 46;
const kMargin = 40;
const kTrailSamples = 90;

const canvas = requireElement<HTMLCanvasElement>("#stage");
const context = requireContext2d(canvas);

const loop = new GameLoop({ fixedFps: 10 });
const settings = {
  fixedFps: 10,
  speed: 0.55,
  trails: true
};
const readout = {
  jumpsPerSecond: 0,
  alpha: 0
};

let position = 0;
let direction = 1;
const smoothed = new Interpolated(0, lerpNumber);
const rawTrail: number[] = [];
const smoothTrail: number[] = [];
let refreshedAt = 0;

const pane = createExamplePane({ title: "Interpolation" });

pane
  .addBinding(settings, "fixedFps", {
    label: "fixedFps",
    min: 2,
    max: 60,
    step: 1
  })
  .on("change", ({ value }) => {
    loop.scheduler.fixedFps = value;
  });
pane
  .addBinding(settings, "speed", {
    label: "speed",
    min: 0.1,
    max: 2,
    step: 0.05
  });
pane.addBinding(settings, "trails", { label: "motion trails" });

pane.addSeparator();
pane.addMonitors(readout, {
  jumpsPerSecond: {
    label: "fixed steps / s",
    format: (value) => value.toFixed(0)
  },
  alpha: { label: "alpha", format: (value) => value.toFixed(3) }
});

loop.start({
  fixedUpdate: (fixedDeltaMs) => {
    position += direction * settings.speed * (fixedDeltaMs / 1000);
    if (position >= 1) {
      position = 1;
      direction = -1;
    }
    else if (position <= 0) {
      position = 0;
      direction = 1;
    }
    smoothed.push(position);
  },
  update: (_frameDeltaMs, alpha) => {
    draw(alpha);
    refresh(alpha);
  }
});

function draw(
  alpha: number
): void {
  const { width, height } = resize();

  context.fillStyle = "#191922";
  context.fillRect(0, 0, width, height);

  const travel = width - (2 * kMargin) - kSquare;
  const smoothX = kMargin + (smoothed.at(alpha) * travel);
  const rawX = kMargin + (smoothed.current * travel);
  const topY = (height / 2) - kSquare - 24;
  const bottomY = (height / 2) + 24;

  pushTrail(smoothTrail, smoothX);
  pushTrail(rawTrail, rawX);

  drawTrack(topY, width);
  drawTrack(bottomY, width);

  if (settings.trails) {
    drawTrail(smoothTrail, topY, framePlotColors.accumulator);
    drawTrail(rawTrail, bottomY, framePlotColors.panicked);
  }

  drawSquare(smoothX, topY, framePlotColors.accumulator, "at(alpha)");
  drawSquare(rawX, bottomY, framePlotColors.panicked, "current");
}

function drawTrack(
  y: number,
  width: number
): void {
  context.strokeStyle = framePlotColors.grid;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(kMargin, y + kSquare + 10.5);
  context.lineTo(width - kMargin, y + kSquare + 10.5);
  context.stroke();
}

function drawSquare(
  x: number,
  y: number,
  color: string,
  label: string
): void {
  context.fillStyle = color;
  context.fillRect(x, y, kSquare, kSquare);
  context.fillStyle = framePlotColors.text;
  context.font = "11px monospace";
  context.textAlign = "left";
  context.fillText(label, kMargin, y - 8);
}

/**
 * Draws recent positions so repeated samples expose stuttering.
 */
function drawTrail(
  trail: number[],
  y: number,
  color: string
): void {
  trail.forEach((x, index) => {
    context.globalAlpha = (index / trail.length) * 0.35;
    context.fillStyle = color;
    context.fillRect(x, y + (kSquare / 2) - 2, 4, 4);
  });
  context.globalAlpha = 1;
}

function pushTrail(
  trail: number[],
  x: number
): void {
  trail.push(x);
  if (trail.length > kTrailSamples) {
    trail.shift();
  }
}

function resize(): { width: number; height: number; } {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const backingWidth = Math.round(width * ratio);
  const backingHeight = Math.round(height * ratio);

  if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
    canvas.width = backingWidth;
    canvas.height = backingHeight;
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  return { width, height };
}

function refresh(
  alpha: number
): void {
  const now = performance.now();
  if (now - refreshedAt < kRefreshIntervalMs) {
    return;
  }
  refreshedAt = now;

  readout.jumpsPerSecond = loop.scheduler.fixedFps;
  readout.alpha = alpha;
  pane.refresh();
}
