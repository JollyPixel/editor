// Import Internal Dependencies
import {
  clamp
} from "../utils/math.ts";

// CONSTANTS
// Pixel delta of a "standard" mouse-wheel notch. One notch moves a full
// sensitivity step; finer trackpad deltas scale down proportionally.
const kReferenceNotch = 100;

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
   * Mouse-wheel zoom sensitivity.
   * @default 0.1
   */
  sensitivity?: number;
}

/**
 * Stores zoom state and bounds.
 */
export class Zoom {
  #value: number;
  #min: number;
  #max: number;
  #sensitivity: number;

  constructor(
    options: ZoomOptions = {}
  ) {
    const {
      default: value = 4,
      min = 1,
      max = 32,
      sensitivity = 0.1
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
    this.#sensitivity = sensitivity;
  }

  get value(): number {
    return this.#value;
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

  /**
   * Adjusts zoom from a wheel delta. `delta` is a pixel-space amount (a
   * standard notch is ~100px); the step scales with its magnitude so
   * fine-grained trackpad pinch/scroll deltas zoom smoothly instead of each
   * event counting as a full notch.
   */
  applyDelta(
    delta: number
  ): number {
    const direction = Math.sign(delta);
    if (direction === 0) {
      return this.#value;
    }

    const magnitude = Math.abs(delta) / kReferenceNotch;
    const smoothSensitivity =
      this.#value - direction * this.#sensitivity < 1 || this.#value < 1
        ? this.#sensitivity / 10
        : this.#sensitivity;

    this.#value = clamp(
      this.#value - direction * smoothSensitivity * magnitude,
      this.#min,
      this.#max
    );

    return this.#value;
  }
}
