// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import type { AssetSource } from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import {
  silentLogger,
  type Logger
} from "../logger.ts";
import {
  ASSET_EVENT_PREFIX
} from "../constants.ts";
import {
  ASSET_CHECKPOINT_EVENT_TYPES,
  decodeContent,
  describeRejection,
  parseAssetEvent,
  type AssetEventRejection
} from "../events/AssetEvents.ts";
import {
  applyProjection,
  type AssetProjection
} from "./foldProjection.ts";
import type { ProjectionState } from "./ProjectionState.ts";
import { TaskChain } from "../utils/TaskChain.ts";

interface AssetFold {
  projected: AssetProjection | null;
  desired: AssetProjection | null;
  desiredEventId: number;
}

export interface AssetProjectorOptions {
  source: AssetSource;
  eventStore: EventStore.EventStore;
  state: ProjectionState;
  logger?: Logger;
}

/**
 * Projects each asset's folded event stream into physical storage.
 *
 * Idempotent writes make stale checkpoints safe to replay.
 */
export class AssetProjector {
  #source: AssetSource;
  #eventStore: EventStore.EventStore;
  #state: ProjectionState;
  #logger: Logger;

  #folds = new Map<string, AssetFold>();
  #dirty = new Set<string>();
  #stateDirty = false;
  #queue = new TaskChain();
  #unsubscribe: (() => void) | null = null;

  constructor(
    options: AssetProjectorOptions
  ) {
    this.#source = options.source;
    this.#eventStore = options.eventStore;
    this.#state = options.state;
    this.#logger = options.logger ?? silentLogger();
  }

  load(): void {
    this.#folds.clear();
    this.#dirty.clear();

    const events = this.#eventStore.reader.listFromCheckpoints({
      checkpointEventTypes: ASSET_CHECKPOINT_EVENT_TYPES,
      eventTypePrefix: ASSET_EVENT_PREFIX
    });
    for (const event of events) {
      this.#absorb(event);
    }
  }

  start(): void {
    this.#unsubscribe ??= this.#eventStore.subscribe(
      (event) => {
        this.#absorb(event);
        void this.flush(event.assetId);
      },
      { eventTypePrefix: ASSET_EVENT_PREFIX }
    );
  }

  async close(): Promise<void> {
    this.#unsubscribe?.();
    this.#unsubscribe = null;

    await this.flush();
  }

  projected(
    assetId: string
  ): AssetProjection | null {
    return this.#folds.get(assetId)?.projected ?? null;
  }

  * projections(): IterableIterator<{
    assetId: string;
    projection: AssetProjection;
  }> {
    for (const [assetId, fold] of this.#folds) {
      if (fold.projected !== null) {
        yield { assetId, projection: fold.projected };
      }
    }
  }

  desired(
    assetId: string
  ): AssetProjection | null {
    return this.#folds.get(assetId)?.desired ?? null;
  }

  get pending(): number {
    return this.#dirty.size;
  }

  markProjected(
    assetId: string
  ): void {
    const fold = this.#folds.get(assetId);
    if (fold === undefined) {
      this.#logger
        .withMetadata({ assetId })
        .warn(
          "asset marked projected before its event was absorbed; " +
          "is the projector started?"
        );

      return;
    }

    fold.projected = fold.desired;
    this.#dirty.delete(assetId);
    this.#state.advance(assetId, fold.desiredEventId);
    this.#stateDirty = true;
  }

  flush(
    assetId?: string
  ): Promise<void> {
    return this.#queue.run(() => this.#converge(assetId));
  }

  #absorb(
    event: EventStore.Event
  ): void {
    const parsed = parseAssetEvent(event);
    if (!parsed.ok) {
      this.#reject(event, parsed.val);

      return;
    }

    const assetEvent = parsed.val;
    const fold = this.#folds.get(event.assetId) ?? {
      projected: null,
      desired: null,
      desiredEventId: 0
    };

    fold.desired = applyProjection(fold.desired, assetEvent);
    fold.desiredEventId = event.eventId;
    if (event.eventId <= this.#state.checkpoint(event.assetId)) {
      fold.projected = fold.desired;
    }
    else {
      this.#dirty.add(event.assetId);
    }

    this.#folds.set(event.assetId, fold);
  }

  #reject(
    event: EventStore.Event,
    rejection: AssetEventRejection
  ): void {
    const log = this.#logger.withMetadata({
      assetId: event.assetId,
      eventId: event.eventId,
      eventType: event.eventType,
      reason: rejection.reason,
      detail: describeRejection(rejection)
    });

    if (rejection.reason === "foreign") {
      log.debug("unknown asset event skipped");

      return;
    }

    log.warn("asset event skipped");
  }

  async #converge(
    assetId?: string
  ): Promise<void> {
    const targets = assetId === undefined ?
      [...this.#dirty] :
      [assetId].filter((id) => this.#dirty.has(id));

    for (const target of targets) {
      await this.#convergeAsset(target);
    }

    if (this.#stateDirty) {
      this.#stateDirty = false;
      try {
        await this.#state.save();
      }
      catch (error) {
        this.#logger
          .withMetadata({
            reason: error instanceof Error ? error.message : String(error)
          })
          .warn("projection state not persisted");
      }
    }
  }

  async #convergeAsset(
    assetId: string
  ): Promise<void> {
    const fold = this.#folds.get(assetId);
    if (fold === undefined) {
      this.#dirty.delete(assetId);

      return;
    }

    const { projected, desired, desiredEventId } = fold;
    try {
      await this.#applyOperations(projected, desired);
    }
    catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.#state.recordFailure(assetId, desiredEventId, reason);
      this.#stateDirty = true;
      this.#logger
        .withMetadata({ assetId, eventId: desiredEventId, reason })
        .error("asset projection failed");

      return;
    }

    fold.projected = desired;
    this.#dirty.delete(assetId);
    this.#state.advance(assetId, desiredEventId);
    this.#stateDirty = true;
    this.#logger
      .withMetadata({
        assetId,
        eventId: desiredEventId,
        path: desired?.path ?? projected?.path
      })
      .debug("asset projected");
  }

  async #applyOperations(
    projected: AssetProjection | null,
    desired: AssetProjection | null
  ): Promise<void> {
    if (desired === null) {
      if (projected !== null) {
        await this.#source.delete(projected.path);
      }

      return;
    }

    const moved = projected !== null && projected.path !== desired.path;
    if (projected === null || moved || projected.hash !== desired.hash) {
      await this.#source.write(
        desired.path,
        decodeContent(desired.content)
      );
    }

    if (moved) {
      await this.#source.delete(projected.path);
    }
  }
}
