// Import Node.js Dependencies
import { performance } from "node:perf_hooks";

// CONSTANTS
const kDefaultTickMs = 2;

export interface PacedEntry {
  nextAt: number;
  busy: boolean;
}

export interface RateScheduleOptions<TEntry extends PacedEntry> {
  /**
   * Actions per entry per second.
   */
  rate: number;
  entries: readonly TEntry[];
  act: (entry: TEntry) => void;
  /**
   * @default 2
   */
  tickMs?: number;
}

export class RateSchedule<TEntry extends PacedEntry> {
  missed = 0;

  #intervalMs: number;
  #entries: readonly TEntry[];
  #act: (entry: TEntry) => void;
  #tickMs: number;
  #timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    options: RateScheduleOptions<TEntry>
  ) {
    this.#intervalMs = 1_000 / options.rate;
    this.#entries = options.entries;
    this.#act = options.act;
    this.#tickMs = options.tickMs ?? kDefaultTickMs;
  }

  static staggered(
    indices: readonly number[],
    total: number,
    rate: number
  ): number[] {
    const intervalMs = 1_000 / rate;

    return indices.map((index) => (index / total) * intervalMs);
  }

  start(
    offsets: readonly number[]
  ): void {
    const now = performance.now();
    for (const [index, entry] of this.#entries.entries()) {
      entry.nextAt = now + (offsets[index] ?? 0);
    }
    this.#timer = setInterval(() => this.#tick(), this.#tickMs);
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
    for (const entry of this.#entries) {
      if (now < entry.nextAt) {
        continue;
      }

      entry.nextAt += intervalMs;
      if (now - entry.nextAt > intervalMs) {
        this.missed++;
        entry.nextAt = now + intervalMs;
      }
      if (!entry.busy) {
        this.#act(entry);
      }
    }
  }
}
