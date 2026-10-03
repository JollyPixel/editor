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
  files: ReadonlySet<string>
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
 * receiving the file paths notified since the previous one. A batch of
 * folder notifications alone calls `onChange` with no file.
 */
export class SourceWatcher {
  #source: AssetSource;
  #onChange: SourceChangeHandler;
  #debounce: number;
  #logger: Logger;

  #unwatch: (() => void) | null = null;
  #ready: Promise<void> = Promise.resolve();
  #handle: ReturnType<typeof setTimeout> | null = null;
  #running: Promise<void> | null = null;
  #notified = new ChangeBatch();
  #due = new ChangeBatch();

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

  start(): Promise<void> {
    if (this.#unwatch !== null) {
      return this.#ready;
    }
    if (this.#source.watch === undefined) {
      return Promise.resolve();
    }

    const ready = Promise.withResolvers<void>();
    this.#ready = ready.promise;
    this.#unwatch = this.#source.watch(
      (path, type) => this.notify(path, type),
      { onReady: () => ready.resolve() }
    );

    return this.#ready;
  }

  notify(
    path: string,
    type: AssetEntryType
  ): void {
    this.#logger
      .withMetadata({ path, type })
      .debug("filesystem change observed");

    this.#notified.add(path, type);
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
    this.#notified = new ChangeBatch();

    await this.#running;
  }

  #pass(): Promise<void> {
    this.#handle = null;
    this.#due.merge(this.#notified);
    this.#notified = new ChangeBatch();

    if (this.#running === null && !this.#due.empty) {
      this.#running = this.#drain().finally(() => {
        this.#running = null;
      });
    }

    return this.#running ?? Promise.resolve();
  }

  async #drain(): Promise<void> {
    while (!this.#due.empty) {
      const { files } = this.#due;
      this.#due = new ChangeBatch();
      try {
        await this.#onChange(files);
      }
      catch (error) {
        this.#logger
          .withMetadata({ reason: asError(error).message })
          .error("source change not handled");
      }
    }
  }
}

class ChangeBatch {
  readonly files = new Set<string>();
  #folders = false;

  get empty(): boolean {
    return this.files.size === 0 && !this.#folders;
  }

  add(
    path: string,
    type: AssetEntryType
  ): void {
    if (type === "file") {
      this.files.add(path);
    }
    else {
      this.#folders = true;
    }
  }

  merge(
    batch: ChangeBatch
  ): void {
    for (const path of batch.files) {
      this.files.add(path);
    }
    this.#folders ||= batch.#folders;
  }
}
