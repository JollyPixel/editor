export class Teardown {
  readonly #closing = new AbortController();
  readonly #steps: Array<() => void> = [];

  get signal(): AbortSignal {
    return this.#closing.signal;
  }

  defer(
    step: () => void
  ): void {
    this.#steps.push(step);
  }

  run(): void {
    this.#closing.abort();
    for (const step of this.#steps.splice(0).reverse()) {
      step();
    }
  }
}
