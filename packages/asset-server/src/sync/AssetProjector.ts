// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import type { AssetSource } from "../sources/AssetSource.ts";
import {
  silentLogger,
  type Logger
} from "../logger.ts";
import {
  ASSET_EVENT_PREFIX
} from "../constants.ts";
import {
  decodeContent,
  isAssetEvent
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
  #onAppend: ((event: EventStore.Event) => void) | null = null;

  constructor(
    options: AssetProjectorOptions
  ) {
    this.#source = options.source;
    this.#eventStore = options.eventStore;
    this.#state = options.state;
    this.#logger = options.logger ?? silentLogger();
  }

  /**
   * Rebuilds both folds from the log. Events at or below an asset's
   * checkpoint are the ones already written.
   */
  load(): void {
    this.#folds.clear();
    this.#dirty.clear();

    const events = this.#eventStore.reader.listAll({
      eventTypePrefix: ASSET_EVENT_PREFIX
    });
    for (const event of events) {
      this.#absorb(event);
    }
  }

  /**
   * Subscribes to the log so later appends converge automatically.
   */
  start(): void {
    if (this.#onAppend !== null) {
      return;
    }

    this.#onAppend = (event) => {
      if (!event.eventType.startsWith(ASSET_EVENT_PREFIX)) {
        return;
      }

      this.#absorb(event);
      void this.flush(event.assetId);
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

  /**
   * Marks reconciled bytes as projected without writing them again.
   *
   * The fold must exist because `start()` subscribes before writer appends.
   */
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

  /**
   * Serializes pending writes and checkpoint updates.
   */
  flush(
    assetId?: string
  ): Promise<void> {
    return this.#queue.run(() => this.#converge(assetId));
  }

  /**
   * Folds one lifecycle event. Payloads that do not match their event type
   * are skipped: the asset keeps its last good projection rather than
   * failing the whole replay.
   */
  #absorb(
    event: EventStore.Event
  ): void {
    if (!isAssetEvent(event)) {
      this.#logger
        .withMetadata({
          assetId: event.assetId,
          eventId: event.eventId,
          eventType: event.eventType
        })
        .warn("malformed asset event skipped");

      return;
    }

    const fold = this.#folds.get(event.assetId) ?? {
      projected: null,
      desired: null,
      desiredEventId: 0
    };

    fold.desired = applyProjection(fold.desired, event);
    fold.desiredEventId = event.eventId;
    if (event.eventId <= this.#state.checkpoint(event.assetId)) {
      fold.projected = fold.desired;
    }
    else {
      this.#dirty.add(event.assetId);
    }

    this.#folds.set(event.assetId, fold);
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
      /**
       * A failed checkpoint causes a safe repeated write on the next run.
       */
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

    /**
     * Writing first ensures a crash leaves both paths, never neither.
     */
    if (moved) {
      await this.#source.delete(projected.path);
    }
  }
}
