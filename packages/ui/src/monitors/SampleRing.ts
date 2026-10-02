// CONSTANTS
const kInitialCapacity = 64;

export class SampleRing {
  #samples = new Float64Array(kInitialCapacity);
  #head = 0;
  #length = 0;

  get length(): number {
    return this.#length;
  }

  reset(
    value: number
  ): void {
    this.#head = 0;
    this.#length = 1;
    this.#samples[0] = value;
  }

  push(
    value: number,
    limit: number
  ): void {
    if (this.#length === this.#samples.length) {
      this.#grow();
    }

    const capacity = this.#samples.length;
    this.#samples[(this.#head + this.#length) % capacity] = value;
    this.#length++;

    if (this.#length > limit) {
      const dropped = Math.min(
        this.#length,
        Math.max(0, Math.trunc(this.#length - limit))
      );
      this.#head = (this.#head + dropped) % capacity;
      this.#length -= dropped;
    }
  }

  at(
    index: number
  ): number {
    return this.#samples[(this.#head + index) % this.#samples.length];
  }

  min(): number {
    let min = Infinity;
    for (let index = 0; index < this.#length; index++) {
      min = Math.min(min, this.at(index));
    }

    return min;
  }

  max(): number {
    let max = -Infinity;
    for (let index = 0; index < this.#length; index++) {
      max = Math.max(max, this.at(index));
    }

    return max;
  }

  #grow(): void {
    const capacity = this.#samples.length;
    const next = new Float64Array(capacity * 2);
    for (let index = 0; index < this.#length; index++) {
      next[index] = this.#samples[(this.#head + index) % capacity];
    }
    this.#samples = next;
    this.#head = 0;
  }
}
