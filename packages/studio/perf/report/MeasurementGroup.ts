export type MeasurementPick<T> = (measurement: T) => number | undefined;

export class MeasurementGroup<T> {
  readonly sample: T;
  readonly items: T[];

  static groupBy<T>(
    measurements: Iterable<T>,
    keyFor: (measurement: T) => readonly string[]
  ): MeasurementGroup<T>[] {
    const groups = new Map<string, MeasurementGroup<T>>();
    for (const measurement of measurements) {
      const key = keyFor(measurement).join("\0");
      const group = groups.get(key);
      if (group === undefined) {
        groups.set(key, new MeasurementGroup(measurement));
      }
      else {
        group.items.push(measurement);
      }
    }

    return [...groups.values()];
  }

  constructor(
    sample: T
  ) {
    this.sample = sample;
    this.items = [sample];
  }

  median(
    pick: MeasurementPick<T>
  ): number {
    const sorted = this.#sorted(pick);
    const middle = sorted.length >> 1;

    return sorted.length % 2 ?
      sorted[middle] :
      (sorted[middle - 1] + sorted[middle]) / 2;
  }

  percentile(
    pick: MeasurementPick<T>,
    rank: number
  ): number {
    const sorted = this.#sorted(pick);

    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * rank) - 1)];
  }

  #sorted(
    pick: MeasurementPick<T>
  ): number[] {
    return this.items
      .map(pick)
      .filter((value) => value !== undefined)
      .sort((left, right) => left - right);
  }
}
