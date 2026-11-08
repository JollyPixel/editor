export class IntegerIncrement {
  #value = 0;

  next(): number {
    return this.#value++;
  }

  clear(): void {
    this.#value = 0;
  }
}
