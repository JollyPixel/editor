// Import Internal Dependencies
import type { InputReader } from "../types.ts";

export interface Accumulator<TSelf> {
  readonly empty: boolean;
  addTo(target: TSelf): void;
  clear(): void;
}

export class ReaderBuffer<TSample extends Accumulator<TSample>> {
  readonly queued: TSample;

  #pending: Record<InputReader, TSample>;
  #published: TSample;

  constructor(
    create: () => TSample
  ) {
    this.queued = create();
    this.#pending = {
      step: create(),
      frame: create()
    };
    this.#published = create();
  }

  get published(): TSample {
    return this.#published;
  }

  sample(): void {
    if (this.queued.empty) {
      return;
    }

    this.queued.addTo(this.#pending.step);
    this.queued.addTo(this.#pending.frame);
    this.queued.clear();
  }

  publish(
    reader: InputReader
  ): void {
    const taken = this.#pending[reader];
    if (taken.empty && this.#published.empty) {
      return;
    }

    this.#published.clear();
    this.#pending[reader] = this.#published;
    this.#published = taken;
  }

  reset(): void {
    this.queued.clear();
    this.#pending.step.clear();
    this.#pending.frame.clear();
    this.#published.clear();
  }
}
