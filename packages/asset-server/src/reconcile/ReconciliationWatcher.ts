// Import Third-party Dependencies
import type {
  AssetEntryType,
  AssetSource
} from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import {
  silentLogger,
  type Logger
} from "../logger.ts";
import type { Reconciler } from "./Reconciler.ts";
import { asError } from "../utils/asError.ts";

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
  afterPass?: () => Promise<void>;
  logger?: Logger;
}

/**
 * Coalesces filesystem notifications into idempotent reconciliation passes.
 */
export class ReconciliationWatcher {
  #source: AssetSource;
  #reconciler: Reconciler;
  #debounce: number;
  #afterPass: () => Promise<void>;
  #logger: Logger;

  #unwatch: (() => void) | null = null;
  #handle: ReturnType<typeof setTimeout> | null = null;
  #running: Promise<void> | null = null;
  #again = false;
  #filesChanged = false;

  constructor(
    options: ReconciliationWatcherOptions
  ) {
    this.#source = options.source;
    this.#reconciler = options.reconciler;
    this.#debounce = options.debounce ?? kDefaultDebounce;
    this.#afterPass = options.afterPass ?? (() => Promise.resolve());
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

    this.#unwatch = this.#source.watch(
      (path, type) => this.notify(path, type)
    );
  }

  notify(
    path: string,
    type: AssetEntryType
  ): void {
    this.#logger
      .withMetadata({ path, type })
      .debug("filesystem change observed");

    if (type === "file") {
      this.#filesChanged = true;
    }

    if (this.#handle !== null) {
      clearTimeout(this.#handle);
    }
    this.#handle = setTimeout(
      () => void this.#pass(),
      this.#debounce
    );
    this.#handle.unref?.();
  }

  run(): Promise<void> {
    this.#filesChanged = true;

    return this.#pass();
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

  #pass(): Promise<void> {
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

  async #run(): Promise<void> {
    try {
      do {
        this.#again = false;
        if (this.#filesChanged) {
          this.#filesChanged = false;
          await this.#reconcile();
        }
        await this.#afterPass().catch((error: unknown) => this.#logger
          .withMetadata({ reason: asError(error).message })
          .error("reconciliation follow-up failed"));
      } while (this.#again);
    }
    finally {
      this.#running = null;
    }
  }

  async #reconcile(): Promise<void> {
    const result = await this.#reconciler.reconcile();
    if (!result.ok) {
      this.#logger
        .withMetadata({ reason: result.val.message })
        .error("reconciliation failed");
    }
  }
}
