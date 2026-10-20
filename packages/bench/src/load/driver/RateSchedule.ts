// Import Node.js Dependencies
import { performance } from "node:perf_hooks";

// CONSTANTS
const kTickMs = 2;

export type PacedAction<TEntry> = (entry: TEntry) => void | Promise<unknown>;

export interface IndexedEntry<TEntry> {
  index: number;
  entry: TEntry;
}

export interface RateScheduleOptions<TEntry> {
  rate: number;
  entries: readonly IndexedEntry<TEntry>[];
  total: number;
  act: PacedAction<TEntry>;
  onRoundTrip: (startedAtMs: number, endedAtMs: number) => void;
}

interface Slot<TEntry> {
  entry: TEntry;
  offsetMs: number;
  nextAt: number;
  busy: boolean;
}

export class RateSchedule<TEntry> {
  #intervalMs: number;
  #slots: Slot<TEntry>[];
  #act: PacedAction<TEntry>;
  #onRoundTrip: (startedAtMs: number, endedAtMs: number) => void;
  #missed = 0;
  #timer: NodeJS.Timeout | null = null;

  constructor(
    options: RateScheduleOptions<TEntry>
  ) {
    const intervalMs = 1_000 / options.rate;

    this.#intervalMs = intervalMs;
    this.#act = options.act;
    this.#onRoundTrip = options.onRoundTrip;
    this.#slots = options.entries.map(({ index, entry }) => {
      return {
        entry,
        offsetMs: (index / options.total) * intervalMs,
        nextAt: 0,
        busy: false
      };
    });
  }

  get missed(): number {
    return this.#missed;
  }

  resetMissed(): void {
    this.#missed = 0;
  }

  start(): void {
    const now = performance.now();
    for (const slot of this.#slots) {
      slot.nextAt = now + slot.offsetMs;
    }
    this.#timer = setInterval(() => this.#tick(), kTickMs);
  }

  stop(): void {
    if (this.#timer !== null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  #tick(): void {
    const intervalMs = this.#intervalMs;
    const now = performance.now();
    for (const slot of this.#slots) {
      if (now < slot.nextAt) {
        continue;
      }

      slot.nextAt += intervalMs;
      if (now - slot.nextAt > intervalMs) {
        this.#missed++;
        slot.nextAt = now + intervalMs;
      }
      if (!slot.busy) {
        this.#run(slot);
      }
    }
  }

  #run(
    slot: Slot<TEntry>
  ): void {
    const startedAt = performance.now();
    const result = this.#act(slot.entry);
    if (result instanceof Promise) {
      slot.busy = true;
      void result
        .then(() => this.#onRoundTrip(startedAt, performance.now()))
        .finally(() => {
          slot.busy = false;
        });
    }
  }
}
