// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  silentLogger,
  type Logger
} from "../logger.ts";
import { contentHash } from "../utils/contentHash.ts";
import {
  ASSET_CHECKPOINT_EVENT_TYPES,
  isAssetEventType,
  SNAPSHOT_ACTOR
} from "../events/AssetEvents.ts";
import type { SnapshotPolicy } from "../kinds/AssetKindHandler.ts";
import type { AssetStateStore } from "./AssetStateStore.ts";
import type { AssetProjector } from "../projection/AssetProjector.ts";
import type { AssetWriter } from "../writer/AssetWriter.ts";
import { TaskChain } from "../utils/TaskChain.ts";

// CONSTANTS
const kDefaultDelay = 2_000;
const kDefaultMaxDelay = 30_000;
const kFlushAttempts = 3;

interface PendingSnapshot {
  handle: ReturnType<typeof setTimeout>;
  firstEventAt: number;
}

type SnapshotOutcome = "written" | "skipped" | "superseded";

export interface SnapshotSchedulerOptions {
  eventStore: EventStore.EventStore;
  states: AssetStateStore;
  projector: AssetProjector;
  writer: AssetWriter;
  snapshot?: SnapshotPolicy;
  compact?: boolean;
  logger?: Logger;
}

/**
 * Schedules snapshots by quiet period and maximum delay per asset.
 *
 * Snapshots append events; the projector performs the physical write.
 */
export class SnapshotScheduler {
  #eventStore: EventStore.EventStore;
  #states: AssetStateStore;
  #projector: AssetProjector;
  #writer: AssetWriter;
  #policy: Required<SnapshotPolicy>;
  #compact: boolean;
  #logger: Logger;

  #pending = new Map<string, PendingSnapshot>();
  #chains = new Map<string, TaskChain>();
  #unsubscribe: (() => void) | null = null;

  constructor(
    options: SnapshotSchedulerOptions
  ) {
    this.#eventStore = options.eventStore;
    this.#states = options.states;
    this.#projector = options.projector;
    this.#writer = options.writer;
    this.#policy = {
      delay: options.snapshot?.delay ?? kDefaultDelay,
      maxDelay: options.snapshot?.maxDelay ?? kDefaultMaxDelay
    };
    this.#compact = options.compact ?? false;
    this.#logger = options.logger ?? silentLogger();
  }

  get pending(): number {
    return this.#pending.size;
  }

  start(): void {
    this.#unsubscribe ??= this.#eventStore.subscribe((event) => {
      if (!isAssetEventType(event.eventType)) {
        this.schedule(event.assetId);
      }
    });
  }

  async close(): Promise<void> {
    this.#unsubscribe?.();
    this.#unsubscribe = null;

    await this.flush();
  }

  schedule(
    assetId: string
  ): void {
    const entry = this.#states.get(assetId);
    if (entry === undefined) {
      return;
    }

    const policy = {
      delay: entry.handler.snapshot?.delay ?? this.#policy.delay,
      maxDelay: entry.handler.snapshot?.maxDelay ?? this.#policy.maxDelay
    };

    const pending = this.#pending.get(assetId);
    const firstEventAt = pending?.firstEventAt ?? Date.now();
    if (pending !== undefined) {
      clearTimeout(pending.handle);
    }

    const elapsed = Date.now() - firstEventAt;
    const delay = Math.max(
      0,
      Math.min(policy.delay, policy.maxDelay - elapsed)
    );

    const handle = setTimeout(
      () => void this.snapshot(assetId),
      delay
    );
    handle.unref?.();

    this.#pending.set(assetId, {
      firstEventAt,
      handle
    });
  }

  async flush(
    assetId?: string
  ): Promise<void> {
    const targets = assetId === undefined ?
      [...this.#pending.keys()] :
      [assetId].filter((id) => this.#pending.has(id));

    for (const target of targets) {
      for (let attempt = 0; attempt < kFlushAttempts; attempt++) {
        if (await this.#run(target) !== "superseded") {
          break;
        }
      }
    }

    const chains = assetId === undefined ?
      [...this.#chains.values()] :
      [this.#chains.get(assetId)];
    await Promise.all(
      chains.map((chain) => chain?.settled())
    );
  }

  async snapshot(
    assetId: string
  ): Promise<boolean> {
    return await this.#run(assetId) === "written";
  }

  #run(
    assetId: string
  ): Promise<SnapshotOutcome> {
    const chain = this.#chains.get(assetId) ?? new TaskChain();
    this.#chains.set(assetId, chain);

    const snapshot = chain.run(() => this.#snapshot(assetId));
    const release = (): void => {
      if (chain.idle && this.#chains.get(assetId) === chain) {
        this.#chains.delete(assetId);
      }
    };
    snapshot.then(release, release);

    return snapshot;
  }

  async #snapshot(
    assetId: string
  ): Promise<SnapshotOutcome> {
    const pending = this.#pending.get(assetId);
    if (pending !== undefined) {
      clearTimeout(pending.handle);
      this.#pending.delete(assetId);
    }

    const entry = this.#states.get(assetId);
    const version = this.#states.versionOf(assetId);
    const desired = this.#projector.desired(assetId);
    if (
      entry === undefined ||
      version === undefined ||
      desired === null
    ) {
      return "skipped";
    }

    const dependencies = entry.handler.dependencies?.(entry.state);
    const data = await entry.handler.serialize(entry.state);
    if (await contentHash(data) === desired.hash) {
      return "skipped";
    }

    if (this.#compact) {
      this.#compactBeforeSnapshot(assetId);
    }
    const updated = await this.#writer.update({
      assetId,
      data,
      dependencies,
      actor: SNAPSHOT_ACTOR,
      expectedVersion: version
    });
    if (!updated.ok) {
      const log = this.#logger.withMetadata({
        assetId,
        reason: updated.val.message
      });
      if (this.#states.versionOf(assetId) !== version) {
        log.debug("asset snapshot superseded");

        return "superseded";
      }
      log.error("asset snapshot failed");

      return "skipped";
    }

    await this.#projector.flush(assetId);

    return "written";
  }

  #compactBeforeSnapshot(
    assetId: string
  ): void {
    const report = this.#eventStore.compact({
      checkpointEventTypes: ASSET_CHECKPOINT_EVENT_TYPES,
      assetId,
      reclaim: false
    });
    if (report.removed > 0) {
      this.#logger
        .withMetadata({
          assetId,
          removed: report.removed
        })
        .debug("asset events compacted");
    }
  }
}
