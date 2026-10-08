export class ResyncThrottle {
  #intervalMs: number;
  #lastRun = new Map<string, number>();
  #deferred = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    intervalMs: number
  ) {
    this.#intervalMs = intervalMs;
  }

  request(
    clientId: string,
    run: () => Promise<void>
  ): Promise<void> {
    if (this.#deferred.has(clientId)) {
      return Promise.resolve();
    }

    const elapsed = Date.now() - (this.#lastRun.get(clientId) ?? -Infinity);
    if (elapsed >= this.#intervalMs) {
      this.#lastRun.set(clientId, Date.now());

      return run();
    }

    const handle = setTimeout(() => {
      this.#deferred.delete(clientId);
      this.#lastRun.set(clientId, Date.now());
      void run();
    }, this.#intervalMs - elapsed);
    handle.unref?.();
    this.#deferred.set(clientId, handle);

    return Promise.resolve();
  }

  forget(
    clientId: string
  ): void {
    clearTimeout(this.#deferred.get(clientId));
    this.#deferred.delete(clientId);
    this.#lastRun.delete(clientId);
  }

  clear(): void {
    for (const handle of this.#deferred.values()) {
      clearTimeout(handle);
    }
    this.#deferred.clear();
    this.#lastRun.clear();
  }
}
