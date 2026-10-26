// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import {
  Err,
  Ok,
  type Result
} from "@openally/result";
import type { AssetSource } from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import { contentHash } from "../../common/contentHash.ts";
import {
  matchRenames,
  type ObservedEntry,
  type ProjectedEntry,
  type RenameMatch
} from "./matchRenames.ts";
import {
  silentLogger,
  type Logger
} from "../../common/logger.ts";
import type { AssetProjector } from "../projection/AssetProjector.ts";
import type { AssetWriter } from "../writer/AssetWriter.ts";
import type { AssetPartFiles } from "../AssetPartFiles.ts";
import type { AssetPartRef } from "../../model/events/AssetEvents.ts";
import { asError } from "../../common/asError.ts";
import { TaskChain } from "../../common/TaskChain.ts";

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

interface ReadOutcome {
  readonly path: string;
  readonly entry: ObservedEntry | null;
}

interface ObservedPart extends ObservedEntry {
  readonly partId: string;
}

interface SourceScan {
  readonly entries: ObservedEntry[];
  /**
   * Listed but unreadable. Excluded from both sides of the diff.
   */
  readonly unreadable: Set<string>;
  readonly writing: Set<string>;
  /**
   * Readable part files, by the path of their asset.
   */
  readonly parts: Map<string, ObservedPart[]>;
}

interface ProjectedParts {
  readonly assetId: string;
  readonly refs: ReadonlyMap<string, AssetPartRef>;
}

interface ChangedParts {
  readonly assetId: string;
  readonly observed: ObservedPart[];
}

export interface ReconcilerOptions {
  source: AssetSource;
  projector: AssetProjector;
  writer: AssetWriter;
  partFiles: AssetPartFiles;
  actor?: EventStore.Actor;
  logger?: Logger;
}

export class Reconciler {
  #source: AssetSource;
  #projector: AssetProjector;
  #writer: AssetWriter;
  #partFiles: AssetPartFiles;
  #actor: EventStore.Actor;
  #logger: Logger;
  #passes = new TaskChain();

  constructor(
    options: ReconcilerOptions
  ) {
    this.#source = options.source;
    this.#projector = options.projector;
    this.#writer = options.writer;
    this.#partFiles = options.partFiles;
    this.#actor = options.actor ?? kWatcherActor;
    this.#logger = options.logger ?? silentLogger();
  }

  reconcile(
    paths?: Iterable<string>
  ): Promise<Result<ReconcileReport, Error>> {
    const scope = paths === undefined ? null : this.#withOwners(paths);

    return this.#passes.run(() => this.#reconcile(scope));
  }

  async #reconcile(
    scope: ReadonlySet<string> | null
  ): Promise<Result<ReconcileReport, Error>> {
    let scan: SourceScan;
    try {
      scan = await this.#observe(
        scope === null ? await this.#source.list() : await this.#present(scope)
      );
    }
    catch (error) {
      return Err(asError(error));
    }

    const projected: ProjectedEntry[] = [];
    const projectedParts = new Map<string, ProjectedParts>();
    for (const { assetId, projection } of this.#projector.projections()) {
      if (
        scan.unreadable.has(projection.path) ||
        scan.writing.has(projection.path) ||
        (scope !== null && !scope.has(projection.path))
      ) {
        continue;
      }

      projected.push({
        id: assetId,
        path: projection.path,
        kind: projection.kind,
        hash: projection.hash
      });
      if (projection.parts !== undefined) {
        projectedParts.set(projection.path, {
          assetId,
          refs: projection.parts
        });
      }
    }

    const diff = matchRenames(
      projected,
      scan.entries
    );
    if (
      scope !== null &&
      (diff.created.length > 0 || diff.deleted.length > 0)
    ) {
      return this.#reconcile(null);
    }
    const report: MutableReport = {
      created: 0,
      updated: 0,
      renamed: 0,
      deleted: 0,
      failed: scan.unreadable.size
    };

    const changedParts = changedPartsByAsset(scan, projectedParts);
    for (const operation of this.#plan(diff, changedParts, scan.parts)) {
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
    diff: RenameMatch,
    changedParts: ReadonlyMap<string, ChangedParts>,
    observedParts: ReadonlyMap<string, ObservedPart[]>
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
    const updated = new Map(
      diff.updated.map((entry) => [entry.path, entry.id])
    );
    for (const [path, { assetId }] of changedParts) {
      updated.set(path, assetId);
    }
    for (const [path, assetId] of updated) {
      yield {
        outcome: "updated",
        path,
        run: async() => this.#writer.update({
          assetId,
          data: await this.#source.read(path),
          ...await this.#readParts(changedParts.get(path)?.observed),
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
          ...await this.#readParts(observedParts.get(entry.path)),
          actor: this.#actor,
          alreadyProjected: true
        })
      };
    }
  }

  async #readParts(
    observed: readonly ObservedPart[] | undefined
  ): Promise<{ parts?: Map<string, Uint8Array>; }> {
    if (observed === undefined) {
      return {};
    }

    const parts = new Map<string, Uint8Array>();
    for (const { partId, path } of observed) {
      parts.set(partId, await this.#source.read(path));
    }

    return { parts };
  }

  #withOwners(
    paths: Iterable<string>
  ): Set<string> {
    const scope = new Set<string>();
    for (const path of paths) {
      scope.add(path);
      const owner = this.#partFiles.owner(path);
      if (owner !== null) {
        scope.add(owner);
      }
    }

    return scope;
  }

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

  async #present(
    scope: ReadonlySet<string>
  ): Promise<string[]> {
    const present: string[] = [];
    for (const path of scope) {
      if (
        !this.#source.isIgnored(path) &&
        await this.#source.exists(path)
      ) {
        present.push(path);
      }
    }

    return present;
  }

  async #observe(
    paths: readonly string[]
  ): Promise<SourceScan> {
    const entries: ObservedEntry[] = [];
    const unreadable = new Set<string>();
    const writing = new Set<string>();
    const parts = new Map<string, ObservedPart[]>();

    for (let index = 0; index < paths.length; index += kReadConcurrency) {
      const batch = paths.slice(
        index,
        index + kReadConcurrency
      );

      const results = await Promise.all(
        batch.map((path) => this.#read(path))
      );

      for (const { path, entry } of results) {
        if (this.#partFiles.owner(path) !== null) {
          const part = this.#partFiles.part(path);
          if (part !== null && entry !== null && !this.#projector.isWriting(path)) {
            parts.set(part.assetPath, [
              ...parts.get(part.assetPath) ?? [],
              { ...entry, partId: part.partId }
            ]);
          }
        }
        else if (this.#projector.isWriting(path)) {
          writing.add(path);
        }
        else if (entry === null) {
          unreadable.add(path);
        }
        else {
          entries.push(entry);
        }
      }
    }

    return {
      entries,
      unreadable,
      writing,
      parts
    };
  }

  async #read(
    path: string
  ): Promise<ReadOutcome> {
    try {
      return {
        path,
        entry: {
          path,
          hash: await contentHash(
            await this.#source.read(path)
          )
        }
      };
    }
    catch (error) {
      this.#logger
        .withMetadata({
          path,
          reason: asError(error).message
        })
        .warn("asset not readable, left untouched");

      return {
        path,
        entry: null
      };
    }
  }
}

function changedPartsByAsset(
  scan: SourceScan,
  projected: ReadonlyMap<string, ProjectedParts>
): Map<string, ChangedParts> {
  const present = new Set(scan.entries.map((entry) => entry.path));
  const changed = new Map<string, ChangedParts>();
  for (const [path, observed] of scan.parts) {
    const parts = projected.get(path);
    if (parts === undefined || !present.has(path)) {
      continue;
    }

    const edited = observed.filter(
      (part) => parts.refs.get(part.partId)?.hash !== part.hash
    );
    if (edited.length > 0) {
      changed.set(path, {
        assetId: parts.assetId,
        observed: edited
      });
    }
  }

  return changed;
}
