export type EventListener = (...args: any[]) => void;

export class MockEmitter<TEvents extends { [K in keyof TEvents]: EventListener; }> {
  #listeners = new Map<keyof TEvents, Set<EventListener>>();

  on<K extends keyof TEvents>(
    type: K,
    listener: TEvents[K]
  ): void {
    const listeners = this.#listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.#listeners.set(type, listeners);
  }

  off<K extends keyof TEvents>(
    type: K,
    listener: TEvents[K]
  ): void {
    this.#listeners.get(type)?.delete(listener);
  }

  emit<K extends keyof TEvents>(
    type: K,
    ...args: Parameters<TEvents[K]>
  ): void {
    for (const listener of this.#listeners.get(type) ?? []) {
      listener(...args);
    }
  }
}
