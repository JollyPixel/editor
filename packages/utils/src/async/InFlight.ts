export class InFlight<T> {
  #pending = new Map<string, Promise<T>>();

  run(
    key: string,
    work: () => Promise<T>
  ): Promise<T> {
    const pending = this.#pending.get(key);
    if (pending !== undefined) {
      return pending;
    }

    const started = work().finally(() => this.#pending.delete(key));
    this.#pending.set(key, started);

    return started;
  }
}
