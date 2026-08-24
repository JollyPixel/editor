// Import Internal Dependencies
import type { FrameSchedule } from "./FrameSchedule.ts";

export interface FrameSchedulerOptions {
  /**
   * Fixed simulation steps per second. Defaults to 60.
   */
  fixedFps?: number;
  /**
   * Rendered frames per second. Defaults to `Infinity`.
   */
  maxFps?: number;
  /**
   * Maximum wall-clock delta in ms. Defaults to 250.
   */
  maxFrameDelta?: number;
  /**
   * Maximum fixed steps per frame. Defaults to 5.
   */
  maxStepsPerFrame?: number;
  /**
   * Frame-delta multiplier. Defaults to 1.
   */
  timeScale?: number;
}

interface NumberRule {
  min: number;
  exclusive?: boolean;
  integer?: boolean;
  allowInfinite?: boolean;
}

// CONSTANTS
const kDefaults: Required<FrameSchedulerOptions> = {
  fixedFps: 60,
  maxFps: Infinity,
  maxFrameDelta: 250,
  maxStepsPerFrame: 5,
  timeScale: 1
};

const kRules: Record<keyof FrameSchedulerOptions, NumberRule> = {
  fixedFps: { min: 0, exclusive: true },
  maxFps: { min: 0, exclusive: true, allowInfinite: true },
  maxFrameDelta: { min: 0, exclusive: true },
  maxStepsPerFrame: { min: 1, integer: true },
  timeScale: { min: 0 }
};

/**
 * Turns wall-clock timestamps into fixed simulation steps.
 * Clamps long frames and discards time beyond `maxStepsPerFrame`.
 * All time values use milliseconds.
 */
export class FrameScheduler {
  #fixedFps = kDefaults.fixedFps;
  #fixedDelta = 1000 / kDefaults.fixedFps;
  #maxFps = kDefaults.maxFps;
  #renderInterval = 1000 / kDefaults.maxFps;
  #maxFrameDelta = kDefaults.maxFrameDelta;
  #maxStepsPerFrame = kDefaults.maxStepsPerFrame;
  #timeScale = kDefaults.timeScale;

  #lastNow: number | null = null;
  #accumulator = 0;
  #renderAccumulator = 0;
  #time = 0;
  #elapsed = 0;
  #droppedTime = 0;
  #frameCount = 0;

  constructor(
    options: FrameSchedulerOptions = {}
  ) {
    this.fixedFps = options.fixedFps ?? kDefaults.fixedFps;
    this.maxFps = options.maxFps ?? kDefaults.maxFps;
    this.maxFrameDelta = options.maxFrameDelta ?? kDefaults.maxFrameDelta;
    this.maxStepsPerFrame = options.maxStepsPerFrame ??
      kDefaults.maxStepsPerFrame;
    this.timeScale = options.timeScale ?? kDefaults.timeScale;
  }

  get fixedFps(): number {
    return this.#fixedFps;
  }

  set fixedFps(value: number) {
    this.#fixedFps = assertNumber("fixedFps", value);
    this.#fixedDelta = 1000 / this.#fixedFps;
  }

  get fixedDelta(): number {
    return this.#fixedDelta;
  }

  get maxFps(): number {
    return this.#maxFps;
  }

  set maxFps(value: number) {
    this.#maxFps = assertNumber("maxFps", value);
    this.#renderInterval = 1000 / this.#maxFps;
    this.#renderAccumulator = 0;
  }

  get maxFrameDelta(): number {
    return this.#maxFrameDelta;
  }

  set maxFrameDelta(value: number) {
    this.#maxFrameDelta = assertNumber("maxFrameDelta", value);
  }

  get maxStepsPerFrame(): number {
    return this.#maxStepsPerFrame;
  }

  set maxStepsPerFrame(value: number) {
    this.#maxStepsPerFrame = assertNumber("maxStepsPerFrame", value);
  }

  get timeScale(): number {
    return this.#timeScale;
  }

  set timeScale(value: number) {
    this.#timeScale = assertNumber("timeScale", value);
  }

  get accumulator(): number {
    return this.#accumulator;
  }

  get time(): number {
    return this.#time;
  }

  get elapsed(): number {
    return this.#elapsed;
  }

  get droppedTime(): number {
    return this.#droppedTime;
  }

  get frameCount(): number {
    return this.#frameCount;
  }

  /**
   * Clears state; the next `advance()` reports a zero delta.
   */
  reset(): void {
    this.#lastNow = null;
    this.#accumulator = 0;
    this.#renderAccumulator = 0;
    this.#time = 0;
    this.#elapsed = 0;
    this.#droppedTime = 0;
    this.#frameCount = 0;
  }

  /**
   * Returns the work due since the previous timestamp.
   * The first call reports zero delta, zero steps, and renders.
   */
  advance(
    now: number
  ): FrameSchedule {
    const lastNow = this.#lastNow;
    const firstFrame = lastNow === null;
    const rawDelta = firstFrame ? 0 : Math.max(now - lastNow, 0);
    this.#lastNow = now;
    this.#frameCount++;

    const clamped = rawDelta > this.#maxFrameDelta;
    const wallDelta = clamped ? this.#maxFrameDelta : rawDelta;
    const frameDelta = wallDelta * this.#timeScale;

    this.#elapsed += frameDelta;
    this.#accumulator += frameDelta;

    const wantedSteps = Math.floor(this.#accumulator / this.#fixedDelta);
    const steps = Math.min(wantedSteps, this.#maxStepsPerFrame);
    const panicked = wantedSteps > this.#maxStepsPerFrame;

    this.#accumulator -= steps * this.#fixedDelta;
    this.#time += steps * this.#fixedDelta;

    let droppedMs = 0;
    if (panicked) {
      droppedMs = this.#accumulator;
      this.#accumulator = 0;
      this.#droppedTime += droppedMs;
    }

    // Compute first because rendering updates its accumulator.
    const render = this.#shouldRender(firstFrame, wallDelta);

    return {
      rawDelta,
      frameDelta,
      fixedDelta: this.#fixedDelta,
      steps,
      alpha: this.#accumulator / this.#fixedDelta,
      render,
      clamped,
      panicked,
      droppedMs
    };
  }

  #shouldRender(
    firstFrame: boolean,
    wallDelta: number
  ): boolean {
    if (this.#maxFps === Infinity) {
      return true;
    }
    if (firstFrame) {
      this.#renderAccumulator = 0;

      return true;
    }

    this.#renderAccumulator += wallDelta;
    if (this.#renderAccumulator < this.#renderInterval) {
      return false;
    }
    this.#renderAccumulator %= this.#renderInterval;

    return true;
  }
}

function assertNumber(
  name: keyof FrameSchedulerOptions,
  value: number
): number {
  const {
    min,
    exclusive = false,
    integer = false,
    allowInfinite = false
  } = kRules[name];

  const inRange = exclusive ? value > min : value >= min;
  const valid = inRange &&
    (Number.isFinite(value) || allowInfinite) &&
    (!integer || Number.isInteger(value));
  if (!valid) {
    const kind = integer ?
      "an integer" :
      `a${allowInfinite ? "" : " finite"} number`;

    throw new RangeError(
      `${name} must be ${kind} ${exclusive ? ">" : ">="} ${min}, got ${value}`
    );
  }

  return value;
}
