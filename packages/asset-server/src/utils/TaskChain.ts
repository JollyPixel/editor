/**
 * Serializes async work without letting a rejection break the chain.
 */
export class TaskChain {
  #tail: Promise<unknown> = Promise.resolve();

  run<TResult>(
    task: () => Promise<TResult>
  ): Promise<TResult> {
    const next = this.#tail.then(
      task,
      task
    );
    this.#tail = next.catch(
      () => void 0
    );

    return next;
  }

  async settled(): Promise<void> {
    await this.#tail;
  }
}
