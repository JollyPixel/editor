// Import Internal Dependencies
import type { AssetSource } from "../sources/AssetSource.ts";
import {
  silentLogger,
  type Logger
} from "../logger.ts";
import type { Reconciler } from "./Reconciler.ts";
import {
  systemTimers,
  type TimerHandle,
  type Timers
} from "../utils/timers.ts";

// CONSTANTS
const kDefaultDebounce = 200;

export interface ReconciliationWatcherOptions {
  source: AssetSource;
  reconciler: Reconciler;
  /**
   * Quiet period, in milliseconds, before a batch of notifications turns
   * into one reconciliation pass.
   * @default 200
   */
  debounce?: number;
  timers?: Timers;
  logger?: Logger;
}

/**
 * Coalesces filesystem notifications into idempotent reconciliation passes.
 */
export class ReconciliationWatcher {
  #source: AssetSource;
  #reconciler: Reconciler;
  #debounce: number;
  #timers: Timers;
  #logger: Logger;

  #unwatch: (() => void) | null = null;
  #handle: TimerHandle | null = null;
  #running: Promise<void> | null = null;
  #again = false;

  constructor(
    options: ReconciliationWatcherOptions
  ) {
    this.#source = options.source;
    this.#reconciler = options.reconciler;
    this.#debounce = options.debounce ?? kDefaultDebounce;
    this.#timers = options.timers ?? systemTimers;
    this.#logger = options.logger ?? silentLogger();
  }

  get watching(): boolean {
    return this.#unwatch !== null;
  }

  /**
   * Subscribes to the source. Sources with no `watch` are a no-op: the host
   * can still call `notify` or reconcile explicitly.
   */
  start(): void {
    if (
      this.#unwatch !== null ||
      this.#source.watch === undefined
    ) {
      return;
    }

    this.#unwatch = this.#source.watch((path) => this.notify(path));
  }

  /**
   * Records a change and resets the debounce.
   */
  notify(
    path: string
  ): void {
    this.#logger
      .withMetadata({ path })
      .debug("filesystem change observed");

    if (this.#handle !== null) {
      this.#timers.clearTimeout(this.#handle);
    }
    this.#handle = this.#timers.setTimeout(
      () => void this.run(),
      this.#debounce
    );
  }

  /**
   * Runs now and repeats when changes arrive during the pass.
   */
  run(): Promise<void> {
    if (this.#handle !== null) {
      this.#timers.clearTimeout(this.#handle);
      this.#handle = null;
    }

    if (this.#running !== null) {
      this.#again = true;

      return this.#running;
    }

    const pass = this.#run();
    this.#running = pass;

    return pass;
  }

  async settle(): Promise<void> {
    await this.#running;
  }

  async close(): Promise<void> {
    if (this.#unwatch !== null) {
      this.#unwatch();
      this.#unwatch = null;
    }
    if (this.#handle !== null) {
      this.#timers.clearTimeout(this.#handle);
      this.#handle = null;
    }

    await this.#running;
  }

  async #run(): Promise<void> {
    try {
      do {
        this.#again = false;
        const result = await this.#reconciler.reconcile();
        if (!result.ok) {
          this.#logger
            .withMetadata({ reason: result.val.message })
            .error("reconciliation failed");
        }
      } while (this.#again);
    }
    finally {
      this.#running = null;
    }
  }
}
