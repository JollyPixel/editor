// Import Internal Dependencies
import { clamp } from "../utils/math.ts";

export interface ZoomOptions {
  /**
   * Default zoom level.
   * @default 4
   */
  default?: number;
  /**
   * Minimum zoom level. Must be under the max zoom level.
   * @default 1
   */
  min?: number;
  /**
   * Maximum zoom level. Must be above the min zoom level.
   * @default 32
   */
  max?: number;
  /**
   * Sensitivity of zooming when using the mouse wheel. The higher, the faster the zoom changes.
   * If the zoom level is under 1, the sensitivity is divided by 10 to allow finer control.
   * @default 0.1
   */
  sensitivity?: number;
}

/**
 * Zoom holds the current zoom level along with its bounds and wheel sensitivity,
 * and knows how to step itself in response to a wheel delta.
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

    this.#value = clamp(value, this.#min, this.#max);
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
   * Steps the zoom level for a wheel `delta` and clamps the result to [min, max].
   * Sensitivity is reduced near/under 1x so small pixel-art textures stay controllable.
   * Returns the resulting value.
   */
  applyDelta(
    delta: number
  ): number {
    const signDelta = Math.sign(delta);
    const smoothSensitivity =
      this.#value - signDelta * this.#sensitivity < 1 || this.#value < 1
        ? this.#sensitivity / 10
        : this.#sensitivity;

    this.#value = clamp(this.#value - signDelta * smoothSensitivity, this.#min, this.#max);

    return this.#value;
  }
}
