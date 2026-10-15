// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { FrameSchedule } from "./FrameSchedule.ts";
import type { FrameScheduler } from "./FrameScheduler.ts";

export interface FrameRateGovernorOptions {
  /**
   * Share of rendered frames that must miss their refresh within one window
   * to halve the render rate. Defaults to 0.25.
   */
  missRatio?: number;
  /**
   * Measurement window in ms. Defaults to 2000.
   */
  window?: number;
  /**
   * Time spent at half rate before retrying the full rate, in ms.
   * Doubles after each failed retry. Defaults to 5000.
   */
  retryDelay?: number;
  /**
   * Upper bound of the doubled `retryDelay`, in ms. Defaults to 120000.
   */
  maxRetryDelay?: number;
}

export type FrameRateGovernorEvents = {
  change: (payload: { halved: boolean; maxFps: number; }) => void;
};

// CONSTANTS
const kMissFactor = 1.5;
const kHalfRateMargin = 0.99;

export class FrameRateGovernor extends Emitter<FrameRateGovernorEvents> {
  #scheduler: FrameScheduler;
  #missRatio: number;
  #window: number;
  #initialRetryDelay: number;
  #maxRetryDelay: number;

  #retryDelay: number;
  #halved = false;
  #probation = false;
  #restoredFps = Infinity;
  #windowTime = 0;
  #rendered = 0;
  #missed = 0;
  #halvedTime = 0;

  constructor(
    scheduler: FrameScheduler,
    options: FrameRateGovernorOptions = {}
  ) {
    super();
    const {
      missRatio = 0.25,
      window = 2000,
      retryDelay = 5000,
      maxRetryDelay = 120_000
    } = options;

    if (!(missRatio > 0 && missRatio <= 1)) {
      throw new RangeError(`missRatio must be in (0, 1], got ${missRatio}`);
    }
    for (const [name, value] of [
      ["window", window],
      ["retryDelay", retryDelay],
      ["maxRetryDelay", maxRetryDelay]
    ] as const) {
      if (!(value > 0 && Number.isFinite(value))) {
        throw new RangeError(`${name} must be a finite number > 0, got ${value}`);
      }
    }
    if (maxRetryDelay < retryDelay) {
      throw new RangeError(
        `maxRetryDelay must be >= retryDelay, got ${maxRetryDelay}`
      );
    }

    this.#scheduler = scheduler;
    this.#missRatio = missRatio;
    this.#window = window;
    this.#initialRetryDelay = retryDelay;
    this.#maxRetryDelay = maxRetryDelay;
    this.#retryDelay = retryDelay;
  }

  get halved(): boolean {
    return this.#halved;
  }

  observe(
    schedule: FrameSchedule
  ): void {
    const period = this.#scheduler.refreshPeriod;
    if (period === null) {
      return;
    }

    if (this.#halved) {
      this.#halvedTime += schedule.unscaledDelta;
      if (this.#halvedTime >= this.#retryDelay) {
        this.#retry();
      }

      return;
    }

    this.#windowTime += schedule.unscaledDelta;
    if (schedule.render) {
      this.#rendered++;
      const interval = Math.max(period, 1000 / this.#scheduler.maxFps);
      if (schedule.unscaledRenderDelta > interval * kMissFactor) {
        this.#missed++;
      }
    }
    if (this.#windowTime < this.#window) {
      return;
    }

    const overloaded = this.#missed > 0 &&
      this.#missed >= this.#rendered * this.#missRatio;
    if (overloaded) {
      this.#halve(period);
    }
    else if (this.#probation) {
      this.#probation = false;
      this.#retryDelay = this.#initialRetryDelay;
    }
    this.#clearWindow();
  }

  reset(): void {
    if (this.#halved) {
      this.#scheduler.maxFps = this.#restoredFps;
      this.#halved = false;
    }
    this.#probation = false;
    this.#retryDelay = this.#initialRetryDelay;
    this.#clearWindow();
  }

  #halve(
    period: number
  ): void {
    const halfRate = 1000 / (2 * period);
    if (this.#scheduler.maxFps * kHalfRateMargin <= halfRate) {
      return;
    }

    if (this.#probation) {
      this.#probation = false;
      this.#retryDelay = Math.min(this.#retryDelay * 2, this.#maxRetryDelay);
    }
    this.#restoredFps = this.#scheduler.maxFps;
    this.#scheduler.maxFps = halfRate;
    this.#halved = true;
    this.#halvedTime = 0;
    this.emit("change", {
      halved: true,
      maxFps: halfRate
    });
  }

  #retry(): void {
    this.#scheduler.maxFps = this.#restoredFps;
    this.#halved = false;
    this.#probation = true;
    this.#clearWindow();
    this.emit("change", {
      halved: false,
      maxFps: this.#restoredFps
    });
  }

  #clearWindow(): void {
    this.#windowTime = 0;
    this.#rendered = 0;
    this.#missed = 0;
  }
}
