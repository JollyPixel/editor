export class TimeWindow {
  readonly #fromUs: number;
  readonly #untilUs: number;

  static between(
    fromMs = -Infinity,
    untilMs = Infinity
  ): TimeWindow {
    return new TimeWindow(fromMs * 1000, untilMs * 1000);
  }

  static following(
    startUs: number,
    lengthMs: number
  ): TimeWindow {
    return new TimeWindow(startUs, startUs + lengthMs * 1000);
  }

  constructor(
    fromUs: number,
    untilUs: number
  ) {
    if (fromUs > untilUs) {
      throw new RangeError(`Time window ends at ${untilUs} µs, before it starts at ${fromUs} µs`);
    }
    this.#fromUs = fromUs;
    this.#untilUs = untilUs;
  }

  contains(
    us: number
  ): boolean {
    return us >= this.#fromUs && us <= this.#untilUs;
  }
}
