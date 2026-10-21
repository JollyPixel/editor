// Import Third-party Dependencies
import type { AssetSource } from "@jolly-pixel/asset-source";
import type { Result } from "@openally/result";

// Import Internal Dependencies
import {
  silentLogger,
  type Logger
} from "../../common/logger.ts";
import type { AssetProjector } from "../projection/AssetProjector.ts";
import type { AssetWriter } from "../writer/AssetWriter.ts";
import {
  Reconciler,
  type ReconcileReport
} from "./Reconciler.ts";
import { SourceWatcher } from "./SourceWatcher.ts";

export interface ReconcilePolicy {
  /**
   * Reconcile the physical store on startup.
   * @default true
   */
  onStart?: boolean;
  /**
   * Watch the source for external changes, when it supports it.
   * @default true
   */
  watch?: boolean;
  /**
   * Quiet period, in milliseconds, before filesystem notifications become
   * one reconciliation pass.
   */
  debounce?: number;
}

export interface SourceSyncOptions extends ReconcilePolicy {
  source: AssetSource;
  projector: AssetProjector;
  writer: AssetWriter;
  afterPass: () => Promise<void>;
  logger?: Logger;
}

export class SourceSync {
  #projector: AssetProjector;
  #reconciler: Reconciler;
  #watcher: SourceWatcher;
  #onStart: boolean;
  #watch: boolean;
  #afterPass: () => Promise<void>;
  #logger: Logger;
  #starting: Promise<void> = Promise.resolve();

  constructor(
    options: SourceSyncOptions
  ) {
    this.#projector = options.projector;
    this.#onStart = options.onStart ?? true;
    this.#watch = options.watch ?? true;
    this.#afterPass = options.afterPass;
    this.#logger = options.logger ?? silentLogger();
    this.#reconciler = new Reconciler({
      source: options.source,
      projector: options.projector,
      writer: options.writer,
      logger: this.#logger
    });
    this.#watcher = new SourceWatcher({
      source: options.source,
      onChange: (files) => this.#onSourceChange(files),
      debounce: options.debounce,
      logger: this.#logger
    });
  }

  start(): Promise<void> {
    this.#starting = this.#start();

    return this.#starting;
  }

  async reconcile(): Promise<Result<ReconcileReport, Error>> {
    const report = await this.#reconciler.reconcile();
    await this.#afterPass();

    return report;
  }

  close(): Promise<void> {
    return this.#watcher.close();
  }

  async #start(): Promise<void> {
    if (this.#watch) {
      await this.#watcher.start();
    }
    if (this.#onStart) {
      (await this.#reconciler.reconcile()).orTee(
        (error) => this.#logFailure(error)
      );
      await this.#projector.flush();
    }

    await this.#afterPass();
  }

  async #onSourceChange(
    files: ReadonlySet<string>
  ): Promise<void> {
    await this.#starting;
    if (files.size > 0) {
      (await this.#reconciler.reconcile(files)).orTee(
        (error) => this.#logFailure(error)
      );
    }
    await this.#afterPass();
  }

  #logFailure(
    error: Error
  ): void {
    this.#logger
      .withMetadata({ reason: error.message })
      .error("reconciliation failed");
  }
}
