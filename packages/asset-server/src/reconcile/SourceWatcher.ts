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
import { asError } from "../utils/asError.ts";

// CONSTANTS
const kDefaultDebounce = 200;

export type SourceChangeHandler = (
  changed: ReadonlySet<AssetEntryType>
) => Promise<void>;

export interface SourceWatcherOptions {
  source: AssetSource;
  onChange: SourceChangeHandler;
  /**
   * Quiet period, in milliseconds, before a batch of notifications turns
   * into one `onChange` call.
   * @default 200
   */
  debounce?: number;
  logger?: Logger;
}

/**
 * Coalesces source notifications into sequential `onChange` calls, each
 * receiving the entry types notified since the previous one.
 */
export class SourceWatcher {
  #source: AssetSource;
  #onChange: SourceChangeHandler;
  #debounce: number;
  #logger: Logger;

  #unwatch: (() => void) | null = null;
  #handle: ReturnType<typeof setTimeout> | null = null;
  #running: Promise<void> | null = null;
  #notified = new Set<AssetEntryType>();
  #due = new Set<AssetEntryType>();

  constructor(
    options: SourceWatcherOptions
  ) {
    this.#source = options.source;
    this.#onChange = options.onChange;
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

    this.#notified.add(type);
    if (this.#handle !== null) {
      clearTimeout(this.#handle);
    }
    this.#handle = setTimeout(
      () => void this.#pass(),
      this.#debounce
    );
    this.#handle.unref?.();
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
    this.#notified.clear();

    await this.#running;
  }

  #pass(): Promise<void> {
    this.#handle = null;
    for (const type of this.#notified) {
      this.#due.add(type);
    }
    this.#notified.clear();

    if (this.#running === null && this.#due.size > 0) {
      this.#running = this.#drain().finally(() => {
        this.#running = null;
      });
    }

    return this.#running ?? Promise.resolve();
  }

  async #drain(): Promise<void> {
    while (this.#due.size > 0) {
      const changed = new Set(this.#due);
      this.#due.clear();
      try {
        await this.#onChange(changed);
      }
      catch (error) {
        this.#logger
          .withMetadata({ reason: asError(error).message })
          .error("source change not handled");
      }
    }
  }
}
