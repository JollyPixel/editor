export type HookListener<Args extends unknown[] = unknown[]> = (...args: Args) => void;

export class HookDb<
  Events extends Record<string, unknown[]>
> {
  #hooks: Map<keyof Events, HookListener[]> = new Map();

  on<K extends keyof Events>(
    event: K,
    listener: HookListener<Events[K]>
  ) {
    if (!this.#hooks.has(event)) {
      this.#hooks.set(event, []);
    }

    this.#hooks.get(event)!.push(listener as any);
  }

  off<K extends keyof Events>(
    event: K,
    listener: HookListener<Events[K]>
  ) {
    if (!this.#hooks.has(event)) {
      return;
    }

    const listeners = this.#hooks.get(event)!;
    this.#hooks.set(event, listeners.filter((l) => l !== listener));
  }

  emit<K extends keyof Events>(
    event: K,
    ...args: Events[K]
  ) {
    if (!this.#hooks.has(event)) {
      return;
    }

    for (const listener of this.#hooks.get(event)!) {
      listener(...args);
    }
  }
}
