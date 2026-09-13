const kClaimedEventTypes = [
  "keydown",
  "keypress"
] as const;

export interface InputLayersOptions {
  target?: () => EventTarget;
}

export class InputLayers {
  #target: () => EventTarget;
  #layers = new Set<symbol>();
  #claimed = new WeakSet<Event>();
  #engageListeners = new Set<() => void>();
  #listeningOn: EventTarget | null = null;

  constructor(
    options: InputLayersOptions = {}
  ) {
    this.#target = options.target ?? (() => window);
  }

  get open(): boolean {
    return this.#layers.size > 0;
  }

  push(): () => void {
    const layer = Symbol("InputLayer");
    const wasOpen = this.open;
    this.#layers.add(layer);

    if (!wasOpen) {
      this.#listen();
      for (const listener of [...this.#engageListeners]) {
        listener();
      }
    }

    return () => this.#release(layer);
  }

  blocks(
    event: Event
  ): boolean {
    return this.#claimed.has(event);
  }

  onEngage(
    listener: () => void
  ): () => void {
    this.#engageListeners.add(listener);

    return () => {
      this.#engageListeners.delete(listener);
    };
  }

  #release(
    layer: symbol
  ): void {
    if (!this.#layers.delete(layer) || this.open) {
      return;
    }

    this.#unlisten();
  }

  readonly #claim = (
    event: Event
  ): void => {
    this.#claimed.add(event);
  };

  #listen(): void {
    const target = this.#target();
    for (const type of kClaimedEventTypes) {
      target.addEventListener(type, this.#claim, true);
    }
    this.#listeningOn = target;
  }

  #unlisten(): void {
    const target = this.#listeningOn;
    if (target === null) {
      return;
    }

    for (const type of kClaimedEventTypes) {
      target.removeEventListener(type, this.#claim, true);
    }
    this.#listeningOn = null;
  }
}

export const inputLayers = new InputLayers();
