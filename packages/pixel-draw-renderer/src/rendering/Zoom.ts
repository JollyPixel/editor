// Import Internal Dependencies
import {
  clamp
} from "../utils/math.ts";

// CONSTANTS
// Finer wheel deltas scale below this full sensitivity step.
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
   * Scales zoom steps for fine-grained trackpad and wheel deltas.
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
