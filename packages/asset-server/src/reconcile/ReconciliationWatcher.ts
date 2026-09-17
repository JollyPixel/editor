// Import Third-party Dependencies
import type { AssetSource } from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import {
  silentLogger,
  type Logger
} from "../logger.ts";
import type { Reconciler } from "./Reconciler.ts";

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
  logger?: Logger;
}

/**
 * Coalesces filesystem notifications into idempotent reconciliation passes.
 */
export class ReconciliationWatcher {
  #source: AssetSource;
  #reconciler: Reconciler;
  #debounce: number;
  #logger: Logger;

  #unwatch: (() => void) | null = null;
  #handle: NodeJS.Timeout | null = null;
  #running: Promise<void> | null = null;
  #again = false;

  constructor(
    options: ReconciliationWatcherOptions
  ) {
    this.#source = options.source;
    this.#reconciler = options.reconciler;
    this.#debounce = options.debounce ?? kDefaultDebounce;
    this.#logger = options.logger ?? silentLogger();
  }

  get watching(): boolean {
    return this.#unwatch !== null;
  }

  start(): void {
    if (
      this.#unwatch !== null ||
      this.#source.watch === undefined
    ) {
      return;
    }

    this.#unwatch = this.#source.watch((path) => this.notify(path));
  }

  notify(
    path: string
  ): void {
    this.#logger
      .withMetadata({ path })
      .debug("filesystem change observed");

    if (this.#handle !== null) {
      clearTimeout(this.#handle);
    }
    this.#handle = setTimeout(
      () => void this.run(),
      this.#debounce
    );
    this.#handle.unref();
  }

  run(): Promise<void> {
    if (this.#handle !== null) {
      clearTimeout(this.#handle);
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
      clearTimeout(this.#handle);
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
