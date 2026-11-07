export class CommandLifetime {
  #controller: AbortController | null = null;
  #ended = false;

  get signal(): AbortSignal {
    if (this.#controller === null) {
      this.#controller = new AbortController();
      if (this.#ended) {
        this.#controller.abort();
      }
    }

    return this.#controller.signal;
  }

  end(): void {
    this.#ended = true;
    this.#controller?.abort();
  }
}
