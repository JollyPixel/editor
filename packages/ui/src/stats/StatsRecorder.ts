// Import Internal Dependencies
import {
  FPS_METRIC,
  MS_METRIC,
  WORST_MS_METRIC,
  memoryMetric,
  type StatsPerformance
} from "./builtins.ts";
import type {
  MetricAggregation,
  MetricDefinition
} from "./MetricDefinition.ts";
import type { MetricSource } from "./MetricSource.ts";

// CONSTANTS
const kDefaultHistorySize = 60;
const kDefaultRefreshInterval = 250;

export interface StatsRecorderOptions {
  /**
   * Maximum snapshots retained for each metric.
   */
  historySize?: number;
  /**
   * Refresh window duration in milliseconds.
   */
  refreshInterval?: number;
  /**
   * Injectable timing and memory source for headless use and tests.
   */
  performance?: StatsPerformance;
}

export type StatsSnapshot = Record<string, number>;

export type StatsListener = (
  snapshot: StatsSnapshot
) => void;

interface MetricState {
  definition: MetricDefinition;
  pending: PendingWindow;
  current: number;
  history: number[];
  historyCount: number;
  historyIndex: number;
}

export class StatsRecorder {
  readonly #historySize: number;
  readonly #refreshInterval: number;
  readonly #performance: StatsPerformance;
  readonly #metrics = new Map<string, MetricState>();
  readonly #listeners = new Set<StatsListener>();

  #beginTime: number | null = null;
  #windowStart: number;
  #frames = 0;
  #revision = 0;

  constructor(
    options: StatsRecorderOptions = {}
  ) {
    this.#historySize = positiveInteger(
      options.historySize,
      kDefaultHistorySize
    );
    this.#refreshInterval = positiveNumber(
      options.refreshInterval,
      kDefaultRefreshInterval
    );
    this.#performance = options.performance ?? globalThis.performance;
    this.#windowStart = this.#performance.now();

    this.addMetric(FPS_METRIC);
    this.addMetric(MS_METRIC);
    this.addMetric(WORST_MS_METRIC);

    const memory = memoryMetric(this.#performance);
    if (memory !== null) {
      this.addMetric(memory);
    }
  }

  get revision(): number {
    return this.#revision;
  }

  get definitions(): readonly MetricDefinition[] {
    return [...this.#metrics.values()].map(
      ({ definition }) => {
        return { ...definition };
      }
    );
  }

  begin(): void {
    this.#beginTime = this.#performance.now();
  }

  end(): void {
    if (this.#beginTime === null) {
      return;
    }

    const now = this.#performance.now();
    const duration = Math.max(
      0,
      now - this.#beginTime
    );
    this.#beginTime = null;
    this.#frames++;
    this.#push("ms", duration);
    this.#push("worstMs", duration);

    const elapsed = now - this.#windowStart;
    if (elapsed < this.#refreshInterval) {
      return;
    }

    this.#push(
      "fps",
      (this.#frames * 1000) / elapsed
    );
    this.#flush(now);
  }

  track(
    id: string,
    value: number
  ): void {
    if (!this.#metrics.has(id)) {
      throw new Error(`Unknown stats metric: ${id}`);
    }
    if (!Number.isFinite(value)) {
      return;
    }

    this.#push(id, value);
  }

  addMetric(
    definition: MetricDefinition
  ): () => void {
    if (definition.id === "") {
      throw new Error("Stats metric id cannot be empty");
    }
    if (this.#metrics.has(definition.id)) {
      throw new Error(`Stats metric already exists: ${definition.id}`);
    }

    this.#metrics.set(definition.id, {
      definition: { ...definition },
      pending: new PendingWindow(),
      current: 0,
      history: new Array<number>(this.#historySize),
      historyCount: 0,
      historyIndex: 0
    });
    this.#revision++;

    return () => this.removeMetric(definition.id);
  }

  addSource(
    source: MetricSource
  ): () => void {
    const removals: (() => void)[] = [];
    try {
      for (const definition of source.metrics) {
        removals.push(this.addMetric(definition));
      }
    }
    catch (error) {
      release(removals);

      throw error;
    }

    return () => release(removals);
  }

  removeMetric(
    id: string
  ): boolean {
    const removed = this.#metrics.delete(id);
    if (removed) {
      this.#revision++;
    }

    return removed;
  }

  snapshot(): StatsSnapshot {
    const snapshot: StatsSnapshot = {};
    for (const [id, state] of this.#metrics) {
      snapshot[id] = state.current;
    }

    return snapshot;
  }

  history(
    id: string
  ): number[] {
    const state = this.#metrics.get(id);
    if (state === undefined || state.historyCount === 0) {
      return [];
    }
    if (state.historyCount < this.#historySize) {
      return state.history.slice(0, state.historyCount);
    }

    const ordered: number[] = [];
    for (let offset = 0; offset < this.#historySize; offset++) {
      ordered.push(
        state.history[(state.historyIndex + offset) % this.#historySize]
      );
    }

    return ordered;
  }

  subscribe(
    listener: StatsListener
  ): () => void {
    this.#listeners.add(listener);

    return () => this.#listeners.delete(listener);
  }

  #flush(
    now: number
  ): void {
    for (const state of this.#metrics.values()) {
      const sample = state.definition.sample?.();
      if (sample !== undefined && Number.isFinite(sample)) {
        state.pending.add(sample);
      }

      if (state.pending.empty) {
        continue;
      }

      state.current = state.pending.drain(
        state.definition.aggregate ?? "last"
      );
      state.history[state.historyIndex] = state.current;
      state.historyIndex = (state.historyIndex + 1) % this.#historySize;
      state.historyCount = Math.min(
        this.#historySize,
        state.historyCount + 1
      );
    }

    this.#windowStart = now;
    this.#frames = 0;
    const snapshot = this.snapshot();
    for (const listener of this.#listeners) {
      listener(snapshot);
    }
  }

  #push(
    id: string,
    value: number
  ): void {
    this.#metrics.get(id)?.pending.add(value);
  }
}

class PendingWindow {
  #count = 0;
  #sum = 0;
  #max = -Infinity;
  #last = 0;

  get empty(): boolean {
    return this.#count === 0;
  }

  add(
    value: number
  ): void {
    this.#count++;
    this.#sum += value;
    this.#max = Math.max(this.#max, value);
    this.#last = value;
  }

  drain(
    mode: MetricAggregation
  ): number {
    const value = this.#reduce(mode);
    this.#count = 0;
    this.#sum = 0;
    this.#max = -Infinity;

    return value;
  }

  #reduce(
    mode: MetricAggregation
  ): number {
    switch (mode) {
      case "average":
        return this.#sum / this.#count;
      case "max":
        return this.#max;
      default:
        return this.#last;
    }
  }
}

function release(
  removals: readonly (() => void)[]
): void {
  for (const remove of removals) {
    remove();
  }
}

function positiveInteger(
  value: number | undefined,
  fallback: number
): number {
  return value === undefined || !Number.isInteger(value) || value <= 0
    ? fallback
    : value;
}

function positiveNumber(
  value: number | undefined,
  fallback: number
): number {
  return value === undefined || !Number.isFinite(value) || value <= 0
    ? fallback
    : value;
}
