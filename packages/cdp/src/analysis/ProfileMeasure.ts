export class ProfileMeasure {
  static readonly selfTime = new ProfileMeasure("Self time", 1000, 1, "ms");
  static readonly allocated = new ProfileMeasure("Allocated", 1024, 0, "KB");

  readonly title: string;
  readonly #divisor: number;
  readonly #digits: number;
  readonly #unit: string;

  constructor(
    title: string,
    divisor: number,
    digits: number,
    unit: string
  ) {
    this.title = title;
    this.#divisor = divisor;
    this.#digits = digits;
    this.#unit = unit;
  }

  format(
    value: number
  ): string {
    return `${(value / this.#divisor).toFixed(this.#digits)} ${this.#unit}`;
  }
}
