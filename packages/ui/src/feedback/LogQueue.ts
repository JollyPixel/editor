// Import Internal Dependencies
import type {
  LogContent,
  LogEntry,
  LogListener,
  LogQueueOptions,
  LogScheduler
} from "./LogQueue.types.ts";

// CONSTANTS
const kDefaultMax = 5;
const kDefaultGracePeriod = 10_000;

function defaultScheduler(
  callback: () => void,
  delay: number
): () => void {
  const timer = setTimeout(callback, delay);

  return () => clearTimeout(timer);
}

export class LogQueue {
  #max: number;
  #gracePeriod: number;
  #now: () => number;
  #schedule: LogScheduler;
  #entries: readonly LogEntry[] = [];
  #timers = new Map<string, () => void>();
  #listeners = new Set<LogListener>();
  #sequence = 0;

  constructor(
    options: LogQueueOptions = {}
  ) {
    this.#max = Math.max(0, options.max ?? kDefaultMax);
    this.#gracePeriod = options.gracePeriod ?? kDefaultGracePeriod;
    this.#now = options.now ?? Date.now;
    this.#schedule = options.schedule ?? defaultScheduler;
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
      createdAt: this.#now()
    };

    const next = [entry, ...this.#entries];
    for (const evicted of next.slice(this.#max)) {
      this.#cancel(evicted.id);
    }
    this.#entries = next.slice(0, this.#max);

    if (this.#entries.includes(entry)) {
      this.#timers.set(id, this.#schedule(
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
    for (const cancel of this.#timers.values()) {
      cancel();
    }
    this.#timers.clear();
    this.#listeners.clear();
    this.#entries = [];
  }

  #cancel(
    id: string
  ): void {
    const cancel = this.#timers.get(id);
    if (cancel === undefined) {
      return;
    }

    cancel();
    this.#timers.delete(id);
  }

  #emit(): void {
    for (const listener of [...this.#listeners]) {
      listener(this.#entries);
    }
  }
}
