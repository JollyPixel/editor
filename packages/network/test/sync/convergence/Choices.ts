export class Choices {
  #stream: readonly number[];
  #next = 0;

  constructor(
    stream: readonly number[]
  ) {
    this.#stream = stream;
  }

  int(
    max: number
  ): number {
    const value = this.#stream[this.#next++] ?? 0;

    return value % max;
  }

  pick<T>(
    items: readonly T[]
  ): T {
    return items[this.int(items.length)];
  }
}
