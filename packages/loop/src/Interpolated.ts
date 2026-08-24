/**
 * Blends samples; alpha maps zero to `previous` and one to `current`.
 */
export type Lerp<T> = (previous: T, current: T, alpha: number) => T;

export function lerpNumber(
  previous: number,
  current: number,
  alpha: number
): number {
  return previous + ((current - previous) * alpha);
}

/**
 * Stores fixed-step samples for interpolation.
 * The caller supplies the blending function.
 */
export class Interpolated<T> {
  #previous: T;
  #current: T;
  #lerp: Lerp<T>;

  constructor(
    initial: T,
    lerp: Lerp<T>
  ) {
    this.#previous = initial;
    this.#current = initial;
    this.#lerp = lerp;
  }

  get previous(): T {
    return this.#previous;
  }

  get current(): T {
    return this.#current;
  }

  push(
    value: T
  ): this {
    this.#previous = this.#current;
    this.#current = value;

    return this;
  }

  /**
   * Replaces both samples, bypassing interpolation from the old value.
   */
  reset(
    value: T
  ): this {
    this.#previous = value;
    this.#current = value;

    return this;
  }

  /**
   * Blends at alpha clamped to `[0, 1]`.
   */
  at(
    alpha: number
  ): T {
    if (alpha <= 0) {
      return this.#previous;
    }
    if (alpha >= 1) {
      return this.#current;
    }

    return this.#lerp(this.#previous, this.#current, alpha);
  }
}
