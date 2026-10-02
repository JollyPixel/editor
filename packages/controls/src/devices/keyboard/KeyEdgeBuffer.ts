// Import Internal Dependencies
import type { InputReader } from "../../types.ts";

export type KeyEdge = "pressed" | "autoRepeated" | "released";

export class KeyEdges {
  pressed = new Set<string>();
  autoRepeated = new Set<string>();
  released = new Set<string>();
  char = "";

  get empty(): boolean {
    return this.pressed.size === 0 &&
      this.autoRepeated.size === 0 &&
      this.released.size === 0 &&
      this.char === "";
  }

  clear(): void {
    this.pressed.clear();
    this.autoRepeated.clear();
    this.released.clear();
    this.char = "";
  }
}

/**
 * Key edges and typed characters observed once and kept for both readers
 * until each takes them.
 */
export class KeyEdgeBuffer {
  #step = new KeyEdges();
  #frame = new KeyEdges();
  #spare = new KeyEdges();

  push(
    edge: KeyEdge,
    code: string
  ): void {
    this.#step[edge].add(code);
    this.#frame[edge].add(code);
  }

  pushChar(
    char: string
  ): void {
    this.#step.char += char;
    this.#frame.char += char;
  }

  /**
   * The returned edges stay valid until the next `take()`.
   */
  take(
    reader: InputReader
  ): Readonly<KeyEdges> {
    const taken = reader === "step" ? this.#step : this.#frame;
    if (taken.empty) {
      return taken;
    }

    this.#spare.clear();
    if (reader === "step") {
      this.#step = this.#spare;
    }
    else {
      this.#frame = this.#spare;
    }
    this.#spare = taken;

    return taken;
  }

  reset(): void {
    this.#step.clear();
    this.#frame.clear();
    this.#spare.clear();
  }
}
