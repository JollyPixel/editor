export class MetricsDelta {
  readonly #before: ReadonlyMap<string, number>;
  readonly #after: ReadonlyMap<string, number>;

  constructor(
    before: ReadonlyMap<string, number>,
    after: ReadonlyMap<string, number>
  ) {
    this.#before = before;
    this.#after = after;
  }

  change(
    name: string
  ): number {
    return (this.#after.get(name) ?? 0) - (this.#before.get(name) ?? 0);
  }
}
