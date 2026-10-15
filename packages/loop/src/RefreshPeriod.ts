// CONSTANTS
const kSampleCount = 32;
const kMinSamples = 8;
const kSamplesPerEstimate = 16;
const kSampleSpread = 3;
const kMaxRatioError = 0.01;

export class RefreshPeriod {
  #samples = new Float64Array(kSampleCount);
  #sorted = new Float64Array(kSampleCount);
  #count = 0;
  #next = 0;
  #unestimated = 0;
  #measured: number | null = null;

  get measured(): number | null {
    const due = this.#measured === null ?
      this.#count >= kMinSamples :
      this.#unestimated >= kSamplesPerEstimate;
    if (due) {
      this.#measured = this.#estimate();
      this.#unestimated = 0;
    }

    return this.#measured;
  }

  observe(
    delta: number
  ): void {
    if (delta <= 0) {
      return;
    }

    this.#samples[this.#next] = delta;
    this.#next = (this.#next + 1) % kSampleCount;
    this.#count = Math.min(this.#count + 1, kSampleCount);
    this.#unestimated++;
  }

  clear(): void {
    this.#count = 0;
    this.#next = 0;
    this.#unestimated = 0;
    this.#measured = null;
  }

  lockTo(
    fixedDelta: number
  ): number | null {
    const period = this.measured;
    if (period === null) {
      return null;
    }

    if (period <= fixedDelta) {
      const periodsPerStep = wholeRatio(fixedDelta, period, kMaxRatioError);

      return periodsPerStep === 0 ? null : fixedDelta / periodsPerStep;
    }
    const stepsPerPeriod = wholeRatio(period, fixedDelta, kMaxRatioError);

    return stepsPerPeriod === 0 ? null : fixedDelta * stepsPerPeriod;
  }

  #estimate(): number {
    const previous = this.#measured;
    const reference = previous !== null && this.#describes(previous) ?
      previous :
      this.#median();

    let sum = 0;
    let periods = 0;
    for (let index = 0; index < this.#count; index++) {
      const delta = this.#samples[index];
      const whole = Math.round(delta / reference);
      if (whole >= 1 && Math.abs(delta - (whole * reference)) <= kSampleSpread) {
        sum += delta;
        periods += whole;
      }
    }

    return sum / periods;
  }

  #describes(
    reference: number
  ): boolean {
    let single = 0;
    for (let index = 0; index < this.#count; index++) {
      if (Math.abs(this.#samples[index] - reference) <= kSampleSpread) {
        single++;
      }
    }

    return single * 2 >= this.#count;
  }

  #median(): number {
    const count = this.#count;
    const sorted = this.#sorted;
    for (let index = 0; index < count; index++) {
      const delta = this.#samples[index];
      let slot = index;
      while (slot > 0 && sorted[slot - 1] > delta) {
        sorted[slot] = sorted[slot - 1];
        slot--;
      }
      sorted[slot] = delta;
    }

    return sorted[Math.floor((count - 1) / 2)];
  }
}

export function wholeRatio(
  larger: number,
  smaller: number,
  maxError: number
): number {
  const ratio = larger / smaller;
  const whole = Math.round(ratio);

  return whole >= 1 && Math.abs(ratio - whole) <= maxError ? whole : 0;
}
