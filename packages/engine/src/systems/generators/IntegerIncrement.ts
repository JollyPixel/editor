export class IntegerIncrement {
  #value = 0;

  incr(): number {
    return this.#value++;
  }

  clear(): void {
    this.#value = 0;
  }
}
