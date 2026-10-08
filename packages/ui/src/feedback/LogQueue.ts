// Import Internal Dependencies
import type {
  LogContent,
  LogEntry,
  LogListener,
  LogQueueOptions
} from "./LogQueue.types.ts";

// CONSTANTS
const kDefaultMax = 5;
const kDefaultGracePeriod = 10_000;

export class LogQueue {
  #max: number;
  #gracePeriod: number;
  #entries: readonly LogEntry[] = [];
  #timers = new Map<string, ReturnType<typeof setTimeout>>();
  #listeners = new Set<LogListener>();
  #sequence = 0;

  constructor(
    options: LogQueueOptions = {}
  ) {
    this.#max = Math.max(0, options.max ?? kDefaultMax);
    this.#gracePeriod = options.gracePeriod ?? kDefaultGracePeriod;
  }

  get entries(): readonly LogEntry[] {
    return this.#entries;
  }

  push(
    content: LogContent
  ): string {
    this.#sequence += 1;
    const id = `log-${this.#sequence}`;
    const entry: LogEntry = {
      id,
      content,
      createdAt: Date.now()
    };

    const next = [entry, ...this.#entries];
    for (const evicted of next.slice(this.#max)) {
      this.#cancel(evicted.id);
    }
    this.#entries = next.slice(0, this.#max);

    if (this.#entries.includes(entry)) {
      this.#timers.set(id, setTimeout(
        () => this.dismiss(id),
        this.#gracePeriod
      ));
    }
    this.#emit();

    return id;
  }

  dismiss(
    id: string
  ): void {
    if (!this.#entries.some((entry) => entry.id === id)) {
      return;
    }

    this.#cancel(id);
    this.#entries = this.#entries.filter(
      (entry) => entry.id !== id
    );
    this.#emit();
  }

  clear(): void {
    if (this.#entries.length === 0) {
      return;
    }

    for (const entry of this.#entries) {
      this.#cancel(entry.id);
    }
    this.#entries = [];
    this.#emit();
  }

  subscribe(
    listener: LogListener
  ): () => void {
    this.#listeners.add(listener);

    return () => {
      this.#listeners.delete(listener);
    };
  }

  dispose(): void {
    for (const timer of this.#timers.values()) {
      clearTimeout(timer);
    }
    this.#timers.clear();
    this.#listeners.clear();
    this.#entries = [];
  }

  #cancel(
    id: string
  ): void {
    clearTimeout(this.#timers.get(id));
    this.#timers.delete(id);
  }

  #emit(): void {
    for (const listener of [...this.#listeners]) {
      listener(this.#entries);
    }
  }
}
