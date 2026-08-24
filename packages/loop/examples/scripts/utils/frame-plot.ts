// Import Internal Dependencies
import type { FrameSchedule } from "../../../src/index.ts";
import { requireContext2d } from "./dom.ts";

// CONSTANTS
const kDefaultSamples = 320;
const kLanePadding = 26;
const kColors = {
  background: "#191922",
  grid: "#2b2b3a",
  text: "#6f6f88",
  normal: "#4a90d9",
  stepless: "#33556f",
  clamped: "#e0a531",
  panicked: "#e05252",
  accumulator: "#5fd08a",
  reference: "#3f3f55",
  mark: "#8f8fb0"
} as const;

export interface FramePlotOptions {
  /**
   * Frames retained in the ring buffer.
   */
  samples?: number;
}

/**
 * Scheduler limits the plot cannot read from a `FrameSchedule`.
 * Drawn as dashed reference lines so a moved slider shows up on the plot.
 */
export interface FramePlotLimits {
  maxFrameDelta?: number;
  maxStepsPerFrame?: number;
}

interface Reference {
  value: number;
  label: string;
}

interface Lane {
  label: string;
  value: (schedule: FrameSchedule) => number;
  scale: (
    samples: FrameSchedule[],
    limits: FramePlotLimits
  ) => number;
  format: (value: number) => string;
  style: "bar" | "line";
  color: string;
  reference?: (
    samples: FrameSchedule[],
    limits: FramePlotLimits
  ) => Reference | null;
}

interface Mark {
  /**
   * Absolute frame index, so the mark scrolls with the ring buffer.
   */
  at: number;
  label: string;
}

/**
 * Plots frame delta, step count, and accumulator depth per frame.
 * Clamp and panic states use distinct colors.
 */
export class FramePlot {
  /**
   * Mutable so a demo can keep the reference lines in sync with its sliders.
   */
  limits: FramePlotLimits = {};

  #canvas: HTMLCanvasElement;
  #context: CanvasRenderingContext2D;
  #samples: FrameSchedule[] = [];
  #capacity: number;
  #columns: number;
  #pushed = 0;
  #marks: Mark[] = [];
  #lanes: Lane[];

  constructor(
    canvas: HTMLCanvasElement,
    options: FramePlotOptions = {}
  ) {
    const { samples = kDefaultSamples } = options;

    this.#canvas = canvas;
    this.#context = requireContext2d(canvas);
    this.#capacity = samples;
    this.#columns = samples;
    this.#lanes = createLanes();
  }

  get samples(): readonly FrameSchedule[] {
    return this.#samples;
  }

  push(
    schedule: FrameSchedule
  ): void {
    this.#columns = this.#capacity;
    this.#samples.push(schedule);
    this.#pushed++;
    if (this.#samples.length > this.#capacity) {
      this.#samples.shift();
    }
    this.#dropScrolledMarks();
  }

  /**
   * Flags the current frame, so a settings change stays legible on the plot.
   */
  mark(
    label: string
  ): void {
    this.#marks.push({ at: this.#pushed, label });
  }

  /**
   * Replaces retained frames with the latest schedules.
   * A replayed tape owns the full width instead of one column per capacity.
   */
  replace(
    schedules: Iterable<FrameSchedule>
  ): void {
    this.#samples = [...schedules].slice(-this.#capacity);
    this.#columns = Math.max(this.#samples.length, 1);
    this.#pushed = this.#samples.length;
    this.#marks = [];
  }

  clear(): void {
    this.#samples = [];
    this.#columns = this.#capacity;
    this.#pushed = 0;
    this.#marks = [];
  }

  draw(): void {
    const { width, height } = this.#resize();
    const context = this.#context;

    context.fillStyle = kColors.background;
    context.fillRect(0, 0, width, height);

    const laneHeight = height / this.#lanes.length;
    this.#lanes.forEach((lane, index) => {
      this.#drawLane(lane, index * laneHeight, laneHeight, width);
    });
    this.#drawMarks(width, height);
  }

  #drawLane(
    lane: Lane,
    top: number,
    height: number,
    width: number
  ): void {
    const context = this.#context;
    const plotTop = top + kLanePadding;
    const plotHeight = height - kLanePadding - 8;
    const scale = Math.max(
      lane.scale(this.#samples, this.limits),
      Number.EPSILON
    );
    const columnWidth = width / this.#columns;

    context.strokeStyle = kColors.grid;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, plotTop + plotHeight + 0.5);
    context.lineTo(width, plotTop + plotHeight + 0.5);
    context.stroke();

    const reference = lane.reference?.(this.#samples, this.limits) ?? null;
    if (reference !== null && reference.value <= scale) {
      const y = plotTop + plotHeight - ((reference.value / scale) * plotHeight);
      context.strokeStyle = kColors.reference;
      context.setLineDash([4, 4]);
      context.beginPath();
      context.moveTo(0, y + 0.5);
      context.lineTo(width, y + 0.5);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = kColors.text;
      context.font = "10px monospace";
      context.textAlign = "right";
      context.fillText(reference.label, width - 6, y - 4);
    }

    if (lane.style === "bar") {
      this.#drawBars(lane, plotTop, plotHeight, columnWidth, scale);
    }
    else {
      this.#drawLine(lane, plotTop, plotHeight, columnWidth, scale);
    }

    const last = this.#samples.at(-1);
    context.font = "11px monospace";
    context.textAlign = "left";
    context.fillStyle = kColors.text;
    // Every lane auto-scales to its window. Without the top printed, the same
    // settings can draw two plots that look nothing alike.
    context.fillText(`${lane.label} (top ${lane.format(scale)})`, 8, top + 15);
    if (last) {
      context.fillStyle = lane.color;
      context.textAlign = "right";
      context.fillText(lane.format(lane.value(last)), width - 8, top + 15);
    }
  }

  #drawBars(
    lane: Lane,
    plotTop: number,
    plotHeight: number,
    columnWidth: number,
    scale: number
  ): void {
    const context = this.#context;

    this.#samples.forEach((schedule, index) => {
      const value = Math.min(lane.value(schedule), scale);
      const barHeight = Math.max((value / scale) * plotHeight, 1);
      context.fillStyle = colorOf(schedule, lane.color);
      context.fillRect(
        index * columnWidth,
        plotTop + plotHeight - barHeight,
        Math.max(columnWidth - 0.5, 1),
        barHeight
      );
    });
  }

  #drawLine(
    lane: Lane,
    plotTop: number,
    plotHeight: number,
    columnWidth: number,
    scale: number
  ): void {
    const context = this.#context;

    context.strokeStyle = lane.color;
    context.lineWidth = 1.5;
    context.beginPath();
    this.#samples.forEach((schedule, index) => {
      const value = Math.min(lane.value(schedule), scale);
      const x = (index * columnWidth) + (columnWidth / 2);
      const y = plotTop + plotHeight - ((value / scale) * plotHeight);
      if (index === 0) {
        context.moveTo(x, y);
      }
      else {
        context.lineTo(x, y);
      }
    });
    context.stroke();
  }

  #drawMarks(
    width: number,
    height: number
  ): void {
    if (this.#marks.length === 0) {
      return;
    }

    const context = this.#context;
    const columnWidth = width / this.#columns;
    const oldest = this.#pushed - this.#samples.length;

    context.font = "10px monospace";
    context.textAlign = "left";
    for (const { at, label } of this.#marks) {
      const x = (at - oldest) * columnWidth;
      context.strokeStyle = kColors.mark;
      context.setLineDash([2, 3]);
      context.beginPath();
      context.moveTo(x + 0.5, 0);
      context.lineTo(x + 0.5, height);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = kColors.mark;
      context.fillText(label, Math.min(x + 4, width - 90), height - 6);
    }
  }

  #dropScrolledMarks(): void {
    const oldest = this.#pushed - this.#samples.length;
    if (this.#marks.length > 0 && this.#marks[0].at < oldest) {
      this.#marks = this.#marks.filter(({ at }) => at >= oldest);
    }
  }

  /**
   * Resizes the backing store and returns its CSS-pixel dimensions.
   */
  #resize(): { width: number; height: number; } {
    const ratio = window.devicePixelRatio || 1;
    const width = this.#canvas.clientWidth;
    const height = this.#canvas.clientHeight;
    const backingWidth = Math.round(width * ratio);
    const backingHeight = Math.round(height * ratio);

    if (
      this.#canvas.width !== backingWidth ||
      this.#canvas.height !== backingHeight
    ) {
      this.#canvas.width = backingWidth;
      this.#canvas.height = backingHeight;
    }
    this.#context.setTransform(ratio, 0, 0, ratio, 0, 0);

    return { width, height };
  }
}

/**
 * Gives panic color precedence over clamp color.
 */
function colorOf(
  schedule: FrameSchedule,
  fallback: string
): string {
  if (schedule.panicked) {
    return kColors.panicked;
  }
  if (schedule.clamped) {
    return kColors.clamped;
  }
  if (schedule.steps === 0) {
    return kColors.stepless;
  }

  return fallback;
}

function createLanes(): Lane[] {
  return [
    {
      label: "frame delta",
      value: ({ frameDelta }) => frameDelta,
      scale: (samples) => Math.max(
        50,
        ...samples.map(({ frameDelta }) => frameDelta)
      ),
      format: (value) => `${value.toFixed(1)} ms`,
      style: "bar",
      color: kColors.normal,
      reference: (_samples, { maxFrameDelta }) => (
        maxFrameDelta === undefined ?
          null :
          { value: maxFrameDelta, label: "maxFrameDelta" }
      )
    },
    {
      label: "steps per frame",
      value: ({ steps }) => steps,
      // The budget is part of the scale, so its line is on screen before the
      // first frame ever reaches it.
      scale: (samples, { maxStepsPerFrame = 0 }) => Math.max(
        2,
        maxStepsPerFrame,
        ...samples.map(({ steps }) => steps)
      ) + 1,
      format: (value) => `${value}`,
      style: "bar",
      color: kColors.normal,
      // Read from the live limit, never from the first panic in the window:
      // that one reports the budget as it was, not as it is now.
      reference: (_samples, { maxStepsPerFrame }) => (
        maxStepsPerFrame === undefined ?
          null :
          { value: maxStepsPerFrame, label: "step budget" }
      )
    },
    {
      label: "accumulator",
      value: ({ alpha, fixedDelta }) => alpha * fixedDelta,
      scale: (samples) => samples.at(-1)?.fixedDelta ?? 16.7,
      format: (value) => `${value.toFixed(2)} ms`,
      style: "line",
      color: kColors.accumulator,
      reference: (samples) => {
        const fixedDelta = samples.at(-1)?.fixedDelta;

        return fixedDelta ?
          { value: fixedDelta, label: "fixed delta" } :
          null;
      }
    }
  ];
}

export const framePlotColors = kColors;
