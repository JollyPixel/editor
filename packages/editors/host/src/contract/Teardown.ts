export class Teardown {
  readonly #steps: Array<() => void> = [];
  #closing: AbortController | null = null;
  #closed = false;

  get signal(): AbortSignal {
    if (this.#closing === null) {
      this.#closing = new AbortController();
      if (this.#closed) {
        this.#closing.abort();
      }
    }

    return this.#closing.signal;
  }

  defer(
    step: () => void
  ): void {
    this.#steps.push(step);
  }

  run(): void {
    this.#closed = true;
    this.#closing?.abort();
    for (const step of this.#steps.splice(0).reverse()) {
      step();
    }
  }
}
