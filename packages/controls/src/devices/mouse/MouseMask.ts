// Import Internal Dependencies
import type { InputReader } from "../../types.ts";
import { EdgeBuffer } from "../EdgeBuffer.ts";

/**
 * Bitmask fed by DOM events and samples, published to one reader at a time.
 */
export class MouseMask {
  #value = 0;
  #pending = 0;
  #edges = new EdgeBuffer();

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
    this.#edges.push(bits | this.#pending);
    this.#pending = 0;
  }

  take(
    reader: InputReader
  ): void {
    this.#value = this.#edges.take(reader);
  }

  reset(): void {
    this.#value = 0;
    this.#pending = 0;
    this.#edges.reset();
  }
}
