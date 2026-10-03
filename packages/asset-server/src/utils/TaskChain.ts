/**
 * Serializes async work without letting a rejection break the chain.
 */
export class TaskChain {
  #tail: Promise<unknown> = Promise.resolve();
  #queued = 0;

  get idle(): boolean {
    return this.#queued === 0;
  }

  run<TResult>(
    task: () => Promise<TResult>
  ): Promise<TResult> {
    this.#queued += 1;
    const next = this.#tail.then(
      task,
      task
    );
    const settle = (): void => {
      this.#queued -= 1;
    };
    this.#tail = next.then(settle, settle);

    return next;
  }

  async settled(): Promise<void> {
    await this.#tail;
  }
}
