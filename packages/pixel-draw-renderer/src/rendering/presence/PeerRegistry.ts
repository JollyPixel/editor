/**
 * Shared bookkeeping for peer-keyed state that renders into a lazily-created
 * per-peer view (an SVG element group, a border object, etc). Subclasses own
 * what a view looks like and how it's painted; this class only owns the two
 * `Map`s and the set/remove/clearAll/refresh/destroy lifecycle around them.
 */
export abstract class PeerRegistry<TState, TView> {
  readonly #states = new Map<string, TState>();
  readonly #views = new Map<string, TView>();

  set(
    clientId: string,
    state: TState
  ): void {
    this.#states.set(
      clientId,
      state
    );
    this.#renderOne(clientId);
  }

  remove(
    clientId: string
  ): void {
    this.#states.delete(clientId);
    const view = this.#views.get(clientId);
    if (view) {
      this.disposeView(view);
    }
    this.#views.delete(clientId);
  }

  clearAll(): void {
    for (const clientId of [...this.#states.keys()]) {
      this.remove(clientId);
    }
  }

  refresh(): void {
    for (const clientId of this.#states.keys()) {
      this.#renderOne(clientId);
    }
  }

  destroy(): void {
    for (const view of this.#views.values()) {
      this.disposeView(view);
    }
    this.#states.clear();
    this.#views.clear();
  }

  protected get size(): number {
    return this.#states.size;
  }

  protected entries(): IterableIterator<[string, TState]> {
    return this.#states.entries();
  }

  protected values(): IterableIterator<TState> {
    return this.#states.values();
  }

  protected view(
    clientId: string
  ): TView | undefined {
    return this.#views.get(clientId);
  }

  protected setView(
    clientId: string,
    view: TView
  ): void {
    this.#views.set(
      clientId,
      view
    );
  }

  /**
   * Drops a cached view without touching its peer's state, for subclasses
   * that must recreate a view mid-render (e.g. a shape-family change).
   */
  protected clearView(
    clientId: string
  ): void {
    this.#views.delete(clientId);
  }

  protected abstract render(
    clientId: string,
    state: TState
  ): void;
  protected abstract disposeView(
    view: TView
  ): void;

  #renderOne(
    clientId: string
  ): void {
    const state = this.#states.get(clientId);
    if (state) {
      this.render(clientId, state);
    }
  }
}
