// Import Internal Dependencies
import {
  clamp
} from "../utils/math.ts";

// CONSTANTS
const kReferenceNotch = 100;
const kNearStepRatio = 0.5;
const kWholeZoomTolerance = 0.03;
const kSettleThreshold = 0.001;

export interface ZoomOptions {
  /**
   * Default zoom level.
   * @default 4
   */
  default?: number;
  /**
   * Minimum zoom level.
   * @default 1
   */
  min?: number;
  /**
   * Maximum zoom level.
   * @default 32
   */
  max?: number;
  /**
   * Relative zoom change per mouse-wheel notch at `min` (`0.25` is 25%).
   * The step shrinks to half of it at `max`.
   * @default 0.25
   */
  sensitivity?: number;
  /**
   * Easing time constant in milliseconds; `0` applies zoom instantly.
   * @default 50
   */
  smoothing?: number;
}

export class Zoom {
  #value: number;
  #target: number;
  #desired: number;
  #min: number;
  #max: number;
  #sensitivity: number;
  #smoothing: number;

  constructor(
    options: ZoomOptions = {}
  ) {
    const {
      default: value = 4,
      min = 1,
      max = 32,
      sensitivity = 0.25,
      smoothing = 50
    } = options;

    this.#min = min;
    this.#max = max;

    if (this.#max < this.#min) {
      throw new Error(
        `Max zoom (${this.#max}) can't be under min zoom (${this.#min})`
      );
    }

    this.#value = clamp(
      value,
      this.#min,
      this.#max
    );
    this.#target = this.#value;
    this.#desired = this.#value;
    this.#sensitivity = Math.max(0.01, sensitivity);
    this.#smoothing = Math.max(0, smoothing);
  }

  get value(): number {
    return this.#value;
  }

  get target(): number {
    return this.#target;
  }

  get isAnimating(): boolean {
    return this.#value !== this.#target;
  }

  get min(): number {
    return this.#min;
  }

  get max(): number {
    return this.#max;
  }

  get sensitivity(): number {
    return this.#sensitivity;
  }

  set sensitivity(
    value: number
  ) {
    this.#sensitivity = Math.max(0.01, value);
  }

  get smoothing(): number {
    return this.#smoothing;
  }

  set smoothing(
    value: number
  ) {
    this.#smoothing = Math.max(0, value);
    if (this.#smoothing === 0) {
      this.settle();
    }
  }

  applyDelta(
    delta: number
  ): number {
    if (delta === 0) {
      return this.#target;
    }

    const factor = 1 + this.#stepAt(this.#desired);
    this.#desired = clamp(
      this.#desired * (factor ** (-delta / kReferenceNotch)),
      this.#min,
      this.#max
    );
    this.#target = clamp(
      snapToWhole(this.#desired),
      this.#min,
      this.#max
    );

    if (this.#smoothing === 0) {
      this.settle();
    }

    return this.#target;
  }

  update(
    elapsedMs: number
  ): boolean {
    if (!this.isAnimating) {
      return false;
    }

    const distance = Math.log(this.#value / this.#target);
    const remaining = distance * Math.exp(
      -Math.max(0, elapsedMs) / this.#smoothing
    );
    if (Math.abs(remaining) < kSettleThreshold) {
      this.#value = this.#target;
    }
    else {
      this.#value = this.#target * Math.exp(remaining);
    }

    return this.isAnimating;
  }

  settle(): void {
    this.#value = this.#target;
  }

  #stepAt(
    zoom: number
  ): number {
    const range = Math.log(this.#max / this.#min);
    const t = range > 0
      ? clamp(Math.log(zoom / this.#min) / range, 0, 1)
      : 0;

    return this.#sensitivity * (1 + ((kNearStepRatio - 1) * t));
  }
}

function snapToWhole(
  zoom: number
): number {
  const whole = Math.round(zoom);
  if (whole < 1) {
    return zoom;
  }

  return Math.abs((zoom / whole) - 1) <= kWholeZoomTolerance ? whole : zoom;
}
