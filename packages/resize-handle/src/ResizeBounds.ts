/**
 * Immutable pixel bounds for a resize interaction.
 */
export class ResizeBounds {
  readonly min: number;
  readonly max: number;

  get hasMaximum(): boolean {
    return Number.isFinite(this.max);
  }

  constructor(
    min = 0,
    max = Number.POSITIVE_INFINITY
  ) {
    if (!Number.isFinite(min) || min < 0) {
      throw new RangeError(
        "minSize must be a non-negative finite number"
      );
    }
    if (
      (!Number.isFinite(max) && max !== Number.POSITIVE_INFINITY) ||
      max < min
    ) {
      throw new RangeError(
        "maxSize must be greater than or equal to minSize"
      );
    }

    this.min = min;
    this.max = max;
  }

  clamp(
    size: number
  ): number {
    return Math.min(
      Math.max(size, this.min),
      this.max
    );
  }
}
