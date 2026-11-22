export class NumberRange {
  readonly min: number;
  readonly max: number;

  constructor(
    min: number,
    max: number
  ) {
    if (!(min <= max)) {
      throw new RangeError(
        `A range needs min <= max, got [${min}, ${max}].`
      );
    }

    this.min = min;
    this.max = max;
  }

  clamp(
    value: number
  ): number {
    return Math.min(this.max, Math.max(this.min, value));
  }
}
