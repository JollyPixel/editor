export type SignalListener<
  T extends unknown[]
> = (...args: T) => void;

export class SignalEvent<
  T extends unknown[] = []
> {
  #listeners: readonly SignalListener<T>[] = [];

  emit(...args: T) {
    for (const listener of this.#listeners) {
      listener(...args);
    }
  }

  connect(
    listener: SignalListener<T>
  ) {
    this.#listeners = [...this.#listeners, listener];
  }

  disconnect(
    listener: SignalListener<T>
  ) {
    const index = this.#listeners.indexOf(listener);
    if (index !== -1) {
      this.#listeners = this.#listeners.toSpliced(index, 1);
    }
  }

  clear() {
    this.#listeners = [];
  }
}
