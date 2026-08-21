/**
 * Serializes async work without letting a rejection break the chain.
 */
export class TaskChain {
  #tail: Promise<unknown> = Promise.resolve();

  /**
   * Queues a task, resolving with its result. The caller sees the task's
   * own rejection; the chain itself absorbs it and carries on.
   */
  run<TResult>(
    task: () => Promise<TResult>
  ): Promise<TResult> {
    const next = this.#tail.then(task, task);
    this.#tail = next.catch(() => void 0);

    return next;
  }

  /**
   * Resolves once everything queued so far has settled, successfully or
   * not. Queues nothing of its own.
   */
  async settled(): Promise<void> {
    await this.#tail;
  }
}
