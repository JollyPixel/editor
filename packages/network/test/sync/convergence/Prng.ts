export class Prng {
  #state: number;

  constructor(
    seed: number
  ) {
    this.#state = seed >>> 0;
  }

  next(): number {
    this.#state = (this.#state + 0x6D2B79F5) >>> 0;
    let value = this.#state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  int(
    max: number
  ): number {
    return Math.floor(this.next() * max);
  }

  pick<T>(
    items: readonly T[]
  ): T {
    return items[this.int(items.length)];
  }
}
