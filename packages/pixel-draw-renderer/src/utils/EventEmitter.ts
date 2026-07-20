export type EventListener<
  TEvent extends { type: string; },
  T extends TEvent["type"] = TEvent["type"]
> = (
  event: Extract<TEvent, { type: T; }>
) => void;

export class TypedEventEmitter<TEvent extends { type: string; }> {
  #listeners = new Map<TEvent["type"], Set<EventListener<TEvent>>>();

  on<T extends TEvent["type"]>(
    type: T,
    listener: EventListener<TEvent, T>
  ): void {
    let set = this.#listeners.get(type);
    if (!set) {
      set = new Set();
      this.#listeners.set(type, set);
    }
    set.add(listener as unknown as EventListener<TEvent>);
  }

  off<T extends TEvent["type"]>(
    type: T,
    listener: EventListener<TEvent, T>
  ): void {
    this.#listeners.get(type)?.delete(
      listener as unknown as EventListener<TEvent>
    );
  }

  protected emit<T extends TEvent["type"]>(
    event: Extract<TEvent, { type: T; }>
  ): void {
    const set = this.#listeners.get(event.type);
    if (!set) {
      return;
    }

    for (const listener of [...set]) {
      (listener as unknown as EventListener<TEvent, T>)(event);
    }
  }
}
