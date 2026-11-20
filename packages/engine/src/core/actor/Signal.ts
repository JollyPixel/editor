export type SignalListener<
  T extends unknown[]
> = (...args: T) => void;

export interface SignalConnectOptions {
  /**
   * Disconnects the listener before its first call.
   * @default false
   */
  once?: boolean;
}

export interface SignalConnection {
  disconnect(): void;
}

interface SignalEntry<T extends unknown[]> {
  listener: SignalListener<T>;
  once: boolean;
}

export class SignalEvent<
  T extends unknown[] = []
> {
  #entries: readonly SignalEntry<T>[] = [];

  emit(...args: T) {
    for (const entry of this.#entries) {
      if (entry.once) {
        this.#remove(entry);
      }
      entry.listener(...args);
    }
  }

  connect(
    listener: SignalListener<T>,
    options: SignalConnectOptions = {}
  ): SignalConnection {
    const entry: SignalEntry<T> = {
      listener,
      once: options.once ?? false
    };
    this.#entries = [...this.#entries, entry];

    return {
      disconnect: () => this.#remove(entry)
    };
  }

  next(): Promise<T> {
    return new Promise((resolve) => {
      this.connect((...args) => resolve(args), { once: true });
    });
  }

  clear() {
    this.#entries = [];
  }

  #remove(
    entry: SignalEntry<T>
  ): void {
    this.#entries = this.#entries.filter((current) => current !== entry);
  }
}
