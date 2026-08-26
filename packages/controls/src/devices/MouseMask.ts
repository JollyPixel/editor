/**
 * Bitmask with separate event, input-sample, and rendered-frame state.
 */
export class MouseMask {
  #value = 0;
  #pending = 0;
  #frame = 0;

  get value(): number {
    return this.#value;
  }

  get any(): boolean {
    return this.#value !== 0;
  }

  get queued(): boolean {
    return this.#pending !== 0;
  }

  has(
    bits: number
  ): boolean {
    return (this.#value & bits) !== 0;
  }

  queue(
    bits: number
  ): void {
    this.#pending |= bits;
  }

  sample(
    bits = 0
  ): void {
    this.#value = bits | this.#pending;
    this.#pending = 0;
    this.#frame |= this.#value;
  }

  publishFrame(): void {
    this.#value = this.#frame;
    this.#frame = 0;
  }

  reset(): void {
    this.#value = 0;
    this.#pending = 0;
    this.#frame = 0;
  }
}
