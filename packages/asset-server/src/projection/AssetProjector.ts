// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import type { AssetSource } from "@jolly-pixel/asset-source";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  silentLogger,
  type Logger
} from "../logger.ts";
import {
  ASSET_CHECKPOINT_EVENT_TYPES,
  ASSET_EVENT_PREFIX,
  describeRejection,
  parseAssetEvent,
  type AssetEvent,
  type AssetEventRejection,
  type AssetEventType
} from "../events/AssetEvents.ts";
import type { AssetProjection } from "./applyProjection.ts";
import { AssetFold } from "./AssetFold.ts";
import type { ProjectionState } from "./ProjectionState.ts";
import { TaskChain } from "../utils/TaskChain.ts";
import { asError } from "../utils/asError.ts";

export interface AssetProjectionChange {
  readonly assetId: string;
  readonly eventType: AssetEventType;
  readonly desired: AssetProjection | null;
}

export type AssetProjectorEventMap = {
  changed: (
    change: AssetProjectionChange
  ) => void;
};

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
export class AssetProjector extends Emitter<
  AssetProjectorEventMap
> {
  #source: AssetSource;
  #eventStore: EventStore.EventStore;
  #state: ProjectionState;
  #logger: Logger;

  #folds = new Map<string, AssetFold>();
  #paths = new Map<string, string>();
  #dirty = new Set<string>();
  #writing = new Set<string>();
  #stateDirty = false;
  #queue = new TaskChain();
  #unsubscribe: (() => void) | null = null;

  constructor(
    options: AssetProjectorOptions
  ) {
    super();
    this.#source = options.source;
    this.#eventStore = options.eventStore;
    this.#state = options.state;
    this.#logger = options.logger ?? silentLogger();
  }

  load(): void {
    this.#folds.clear();
    this.#paths.clear();
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
        const absorbed = this.#absorb(event);
        if (absorbed !== null) {
          this.emit("changed", {
            assetId: event.assetId,
            eventType: absorbed.eventType,
            desired: this.desired(event.assetId)
          });
        }
        void this.flush(event.assetId);
      },
      { eventTypePrefix: ASSET_EVENT_PREFIX }
    );
  }

  async close(): Promise<void> {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.removeAllListeners();

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

  * desiredProjections(): IterableIterator<{
    assetId: string;
    projection: AssetProjection;
  }> {
    for (const [assetId, fold] of this.#folds) {
      if (fold.desired !== null) {
        yield { assetId, projection: fold.desired };
      }
    }
  }

  assetAt(
    path: string
  ): string | null {
    return this.#paths.get(path) ?? null;
  }

  async read(
    assetId: string
  ): Promise<Uint8Array | null> {
    return this.#folds.get(assetId)?.read(this.#source) ?? null;
  }

  isWriting(
    path: string
  ): boolean {
    return this.#writing.has(path);
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

    fold.settle();
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
  ): AssetEvent | null {
    const parsed = parseAssetEvent(event);
    if (!parsed.ok) {
      this.#reject(event, parsed.val);

      return null;
    }

    const assetEvent = parsed.val;
    const fold = this.#folds.get(event.assetId) ?? new AssetFold();

    this.#unindex(event.assetId, fold.desired);
    fold.apply(assetEvent, event.eventId);
    if (fold.desired !== null) {
      this.#paths.set(fold.desired.path, event.assetId);
    }
    if (event.eventId <= this.#state.checkpoint(event.assetId)) {
      fold.settle();
    }
    else {
      this.#dirty.add(event.assetId);
    }

    this.#folds.set(event.assetId, fold);

    return assetEvent;
  }

  #unindex(
    assetId: string,
    desired: AssetProjection | null
  ): void {
    if (desired !== null && this.#paths.get(desired.path) === assetId) {
      this.#paths.delete(desired.path);
    }
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
            reason: asError(error).message
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

    const {
      projected,
      desired,
      desiredEventId
    } = fold;
    try {
      await this.#applyOperations(fold);
    }
    catch (error) {
      const { message: reason } = asError(error);
      this.#state.recordFailure(assetId, desiredEventId, reason);
      this.#stateDirty = true;
      this.#logger
        .withMetadata({ assetId, eventId: desiredEventId, reason })
        .error("asset projection failed");

      return;
    }

    fold.settle(desired);
    if (fold.settled) {
      this.#dirty.delete(assetId);
    }
    this.#state.advance(assetId, desiredEventId);
    this.#stateDirty = true;
    if (this.#logger.isLevelEnabled("debug")) {
      this.#logger
        .withMetadata({
          assetId,
          eventId: desiredEventId,
          path: desired?.path ?? projected?.path
        })
        .debug("asset projected");
    }
  }

  async #applyOperations(
    fold: AssetFold
  ): Promise<void> {
    const { projected, desired } = fold;
    if (desired === null) {
      if (projected !== null) {
        await this.#source.delete(projected.path);
      }

      return;
    }

    const moved = projected !== null && projected.path !== desired.path;
    if (projected === null || moved || projected.hash !== desired.hash) {
      this.#writing.add(desired.path);
      try {
        await this.#source.write(
          desired.path,
          await this.#contentOf(fold)
        );
      }
      finally {
        this.#writing.delete(desired.path);
      }
    }

    if (moved) {
      await this.#source.delete(projected.path);
    }
  }

  async #contentOf(
    fold: AssetFold
  ): Promise<Uint8Array> {
    const data = await fold.read(this.#source);
    if (data === null) {
      throw new Error("asset content is neither held nor projected");
    }

    return data;
  }
}
