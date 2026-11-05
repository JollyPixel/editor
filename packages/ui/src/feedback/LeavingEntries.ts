// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

// CONSTANTS
const kExitFallbackMs = 1_000;

export interface KeyedEntry {
  readonly id: string;
}

export class LeavingEntries<
  TEntry extends KeyedEntry
> implements ReactiveController {
  #host: ReactiveControllerHost;
  #rendered: readonly TEntry[] = [];
  #leaving = new Set<string>();
  #timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    host: ReactiveControllerHost
  ) {
    this.#host = host;
    host.addController(this);
  }

  get rendered(): readonly TEntry[] {
    return this.#rendered;
  }

  isLeaving(
    id: string
  ): boolean {
    return this.#leaving.has(id);
  }

  reconcile(
    incoming: readonly TEntry[]
  ): void {
    const byId = new Map(
      incoming.map((entry) => [entry.id, entry])
    );
    const known = new Set(
      this.#rendered.map((entry) => entry.id)
    );

    for (const entry of this.#rendered) {
      if (!byId.has(entry.id)) {
        this.#markLeaving(entry.id);
      }
    }

    const added = incoming.filter(
      (entry) => !known.has(entry.id)
    );
    const kept = this.#rendered
      .filter((entry) => byId.has(entry.id) || this.#leaving.has(entry.id))
      .map((entry) => byId.get(entry.id) ?? entry);

    this.#rendered = [
      ...added,
      ...kept
    ];
    this.#host.requestUpdate();
  }

  settle(
    event: Event,
    id: string
  ): void {
    if (event.target === event.currentTarget) {
      this.#drop(id);
    }
  }

  hostDisconnected(): void {
    for (const timer of this.#timers.values()) {
      clearTimeout(timer);
    }
    this.#timers.clear();
    this.#rendered = this.#rendered.filter(
      (entry) => !this.#leaving.has(entry.id)
    );
    this.#leaving.clear();
  }

  #markLeaving(
    id: string
  ): void {
    if (this.#leaving.has(id)) {
      return;
    }

    this.#leaving.add(id);
    this.#timers.set(id, setTimeout(
      () => this.#drop(id),
      kExitFallbackMs
    ));
  }

  #drop(
    id: string
  ): void {
    if (!this.#leaving.delete(id)) {
      return;
    }

    clearTimeout(this.#timers.get(id));
    this.#timers.delete(id);
    this.#rendered = this.#rendered.filter(
      (entry) => entry.id !== id
    );
    this.#host.requestUpdate();
  }
}
