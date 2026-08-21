// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  silentLogger,
  type Logger
} from "../logger.ts";
import { ASSET_EVENT_PREFIX } from "../constants.ts";
import { contentHash } from "../utils/contentHash.ts";
import {
  ASSET_UPDATED,
  encodeContent,
  type AssetUpdatedData
} from "../events/AssetEvents.ts";
import type { SnapshotPolicy } from "../kinds/AssetKindHandler.ts";
import type { AssetStateStore } from "./AssetStateStore.ts";
import type { AssetProjector } from "./AssetProjector.ts";
import {
  systemTimers,
  type TimerHandle,
  type Timers
} from "../utils/timers.ts";
import { TaskChain } from "../utils/TaskChain.ts";

// CONSTANTS
const kDefaultDelay = 2_000;
const kDefaultMaxDelay = 30_000;

interface PendingSnapshot {
  handle: TimerHandle;
  firstEventAt: number;
}

export interface SnapshotSchedulerOptions {
  eventStore: EventStore.EventStore;
  states: AssetStateStore;
  projector: AssetProjector;
  snapshot?: SnapshotPolicy;
  timers?: Timers;
  now?: () => number;
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
  #policy: Required<SnapshotPolicy>;
  #timers: Timers;
  #now: () => number;
  #logger: Logger;

  #pending = new Map<string, PendingSnapshot>();
  #chains = new Map<string, TaskChain>();
  #onAppend: ((event: EventStore.Event) => void) | null = null;

  constructor(
    options: SnapshotSchedulerOptions
  ) {
    this.#eventStore = options.eventStore;
    this.#states = options.states;
    this.#projector = options.projector;
    this.#policy = {
      delay: options.snapshot?.delay ?? kDefaultDelay,
      maxDelay: options.snapshot?.maxDelay ?? kDefaultMaxDelay
    };
    this.#timers = options.timers ?? systemTimers;
    this.#now = options.now ?? Date.now;
    this.#logger = options.logger ?? silentLogger();
  }

  get pending(): number {
    return this.#pending.size;
  }

  start(): void {
    if (this.#onAppend !== null) {
      return;
    }

    this.#onAppend = (event) => {
      if (event.eventType.startsWith(ASSET_EVENT_PREFIX)) {
        return;
      }

      this.schedule(event.assetId);
    };
    this.#eventStore.writer.on("append", this.#onAppend);
  }

  async close(): Promise<void> {
    if (this.#onAppend !== null) {
      this.#eventStore.writer.off("append", this.#onAppend);
      this.#onAppend = null;
    }

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
    const firstEventAt = pending?.firstEventAt ?? this.#now();
    if (pending !== undefined) {
      this.#timers.clearTimeout(pending.handle);
    }

    const elapsed = this.#now() - firstEventAt;
    const delay = Math.max(
      0,
      Math.min(policy.delay, policy.maxDelay - elapsed)
    );

    this.#pending.set(assetId, {
      firstEventAt,
      handle: this.#timers.setTimeout(
        () => void this.snapshot(assetId),
        delay
      )
    });
  }

  /**
   * Snapshots the pending assets, or one of them, and waits for every
   * snapshot already in flight, including timer-fired ones.
   */
  async flush(
    assetId?: string
  ): Promise<void> {
    const targets = assetId === undefined ?
      [...this.#pending.keys()] :
      [assetId].filter((id) => this.#pending.has(id));

    for (const target of targets) {
      await this.snapshot(target);
    }

    /**
     * Drain chains separately because timer-fired work has left `#pending`.
     */
    const chains = assetId === undefined ?
      [...this.#chains.values()] :
      [this.#chains.get(assetId)];
    await Promise.all(
      chains.map((chain) => chain?.settled())
    );
  }

  /**
   * Serializes snapshots per asset while allowing different assets in parallel.
   */
  snapshot(
    assetId: string
  ): Promise<boolean> {
    let chain = this.#chains.get(assetId);
    if (chain === undefined) {
      chain = new TaskChain();
      this.#chains.set(assetId, chain);
    }

    return chain.run(() => this.#snapshot(assetId));
  }

  async #snapshot(
    assetId: string
  ): Promise<boolean> {
    const pending = this.#pending.get(assetId);
    if (pending !== undefined) {
      this.#timers.clearTimeout(pending.handle);
      this.#pending.delete(assetId);
    }

    const entry = this.#states.get(assetId);
    const desired = this.#projector.desired(assetId);
    if (entry === undefined || desired === null) {
      return false;
    }

    const data = await entry.handler.serialize(entry.state);
    const hash = contentHash(data);
    if (hash === desired.hash) {
      return false;
    }

    const eventData: AssetUpdatedData = {
      path: desired.path,
      kind: desired.kind,
      hash,
      size: data.byteLength,
      content: encodeContent(data)
    };
    const appended = this.#eventStore.writer.append({
      assetType: entry.kind,
      assetId,
      eventType: ASSET_UPDATED,
      eventData,
      actor: {
        type: "system",
        source: "snapshot"
      }
    });
    if (!appended.ok) {
      this.#logger
        .withMetadata({ assetId, reason: appended.val.message })
        .error("asset snapshot failed");

      return false;
    }

    await this.#projector.flush(assetId);

    return true;
  }
}
