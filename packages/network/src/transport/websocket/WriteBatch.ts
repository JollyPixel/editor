export interface CorkableStream {
  cork(): void;
  uncork(): void;
}

export class WriteBatch {
  #held = new Set<CorkableStream>();
  #pending: ReturnType<typeof setImmediate> | null = null;

  hold(
    stream: CorkableStream
  ): void {
    if (this.#held.has(stream)) {
      return;
    }

    stream.cork();
    this.#held.add(stream);
    this.#pending ??= setImmediate(this.flush);
  }

  flush = (): void => {
    if (this.#pending !== null) {
      clearImmediate(this.#pending);
      this.#pending = null;
    }
    for (const stream of this.#held) {
      stream.uncork();
    }
    this.#held.clear();
  };
}
