// Import Node.js Dependencies
import { randomUUID } from "node:crypto";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import {
  Err,
  Ok,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import type { AssetSource } from "../sources/AssetSource.ts";
import type { AssetKindRegistry } from "../kinds/AssetKindRegistry.ts";
import { contentHash } from "../utils/contentHash.ts";
import {
  matchRenames,
  type ObservedEntry,
  type ProjectedEntry,
  type RenameMatch
} from "./matchRenames.ts";
import {
  silentLogger,
  type Logger
} from "../logger.ts";
import type { AssetProjector } from "./AssetProjector.ts";
import type { AssetWriter } from "./AssetWriter.ts";

// CONSTANTS
const kWatcherActor: EventStore.Actor = {
  type: "system",
  source: "fs-watcher"
};
const kReadConcurrency = 16;

export interface ReconcileReport {
  readonly created: number;
  readonly updated: number;
  readonly renamed: number;
  readonly deleted: number;
  /**
   * Entries skipped after an append or read failure.
   */
  readonly failed: number;
}

type ReconcileOutcome = Exclude<keyof ReconcileReport, "failed">;

type MutableReport = {
  -readonly [K in keyof ReconcileReport]: number;
};

interface ReconcileOperation {
  readonly outcome: ReconcileOutcome;
  readonly path: string;
  run(): Promise<Result<EventStore.Event, Error>>;
}

/**
 * One scanned path with its hash, or `null` when it could not be read.
 * Pairing both in one value keeps the caller from re-indexing the batch.
 */
interface ReadOutcome {
  readonly path: string;
  readonly entry: ObservedEntry | null;
}

interface WorkspaceScan {
  readonly entries: ObservedEntry[];
  /**
   * Listed but unreadable. Excluded from both sides of the diff.
   */
  readonly unreadable: Set<string>;
}

export interface ReconcilerOptions {
  source: AssetSource;
  projector: AssetProjector;
  writer: AssetWriter;
  kinds: AssetKindRegistry;
  actor?: EventStore.Actor;
  logger?: Logger;
}

/**
 * Reconciles physical files against the last projected event state.
 *
 * Hash equality suppresses echoed writes and makes notifications idempotent.
 */
export class Reconciler {
  #source: AssetSource;
  #projector: AssetProjector;
  #writer: AssetWriter;
  #kinds: AssetKindRegistry;
  #actor: EventStore.Actor;
  #logger: Logger;

  constructor(
    options: ReconcilerOptions
  ) {
    this.#source = options.source;
    this.#projector = options.projector;
    this.#writer = options.writer;
    this.#kinds = options.kinds;
    this.#actor = options.actor ?? kWatcherActor;
    this.#logger = options.logger ?? silentLogger();
  }

  async reconcile(): Promise<Result<ReconcileReport, Error>> {
    let scan: WorkspaceScan;
    try {
      scan = await this.#observe();
    }
    catch (error) {
      return Err(asError(error));
    }

    const projected: ProjectedEntry[] = [];
    for (const { assetId, projection } of this.#projector.projections()) {
      if (scan.unreadable.has(projection.path)) {
        continue;
      }

      projected.push({
        id: assetId,
        path: projection.path,
        kind: projection.kind,
        hash: projection.hash
      });
    }

    const diff = matchRenames(projected, scan.entries);
    const report: MutableReport = {
      created: 0,
      updated: 0,
      renamed: 0,
      deleted: 0,
      failed: scan.unreadable.size
    };

    /**
     * Deletes run first so creates can reuse paths freed by this pass.
     */
    for (const operation of this.#plan(diff)) {
      await this.#apply(operation, report);
    }

    if (this.#total(report) > 0) {
      this.#logger
        .withMetadata({ ...report })
        .info("reconciled external changes");
    }

    return Ok(report);
  }

  * #plan(
    diff: RenameMatch
  ): IterableIterator<ReconcileOperation> {
    for (const entry of diff.deleted) {
      yield {
        outcome: "deleted",
        path: entry.path,
        run: () => this.#writer.remove({
          assetId: entry.id,
          actor: this.#actor,
          alreadyProjected: true
        })
      };
    }
    for (const entry of diff.renamed) {
      yield {
        outcome: "renamed",
        path: entry.to,
        run: () => this.#writer.rename({
          assetId: entry.id,
          to: entry.to,
          actor: this.#actor,
          alreadyProjected: true
        })
      };
    }
    for (const entry of diff.updated) {
      yield {
        outcome: "updated",
        path: entry.path,
        run: async() => this.#writer.update({
          assetId: entry.id,
          data: await this.#source.read(entry.path),
          actor: this.#actor,
          alreadyProjected: true
        })
      };
    }
    for (const entry of diff.created) {
      yield {
        outcome: "created",
        path: entry.path,
        run: async() => this.#writer.create({
          path: entry.path,
          data: await this.#source.read(entry.path),
          kind: this.#kinds.resolve(entry.path).kind,
          assetId: this.#writer.identity.byPath(entry.path)?.id ?? randomUUID(),
          actor: this.#actor,
          alreadyProjected: true
        })
      };
    }
  }

  /**
   * Counts and logs an operation failure without aborting independent work.
   */
  async #apply(
    operation: ReconcileOperation,
    report: MutableReport
  ): Promise<void> {
    const result = await operation.run()
      .catch((error: unknown) => Err(asError(error)));

    if (result.ok) {
      report[operation.outcome] += 1;

      return;
    }

    report.failed += 1;
    this.#logger
      .withMetadata({
        path: operation.path,
        outcome: operation.outcome,
        reason: result.val.message
      })
      .error("asset reconciliation failed");
  }

  #total(
    report: MutableReport
  ): number {
    return report.created +
      report.updated +
      report.renamed +
      report.deleted +
      report.failed;
  }

  /**
   * Hashes files in bounded batches and records unreadable paths.
   *
   * Both sides of the diff skip unreadable paths to prevent false deletes.
   */
  async #observe(): Promise<WorkspaceScan> {
    const paths = await this.#source.list();
    const entries: ObservedEntry[] = [];
    const unreadable = new Set<string>();

    for (let index = 0; index < paths.length; index += kReadConcurrency) {
      const batch = paths.slice(index, index + kReadConcurrency);
      const results = await Promise.all(
        batch.map(async(path): Promise<ReadOutcome> => {
          try {
            return {
              path,
              entry: {
                path,
                hash: contentHash(await this.#source.read(path))
              }
            };
          }
          catch (error) {
            this.#logger
              .withMetadata({ path, reason: asError(error).message })
              .warn("asset not readable, left untouched");

            return { path, entry: null };
          }
        })
      );

      for (const { path, entry } of results) {
        if (entry === null) {
          unreadable.add(path);
        }
        else {
          entries.push(entry);
        }
      }
    }

    return { entries, unreadable };
  }
}

function asError(
  error: unknown
): Error {
  return error instanceof Error ? error : new Error(String(error));
}
