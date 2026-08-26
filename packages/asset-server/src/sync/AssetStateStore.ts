// Import Node.js Dependencies
import timers from "node:timers/promises";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import type { AssetKindRegistry } from "../kinds/AssetKindRegistry.ts";
import type { AssetKindHandler } from "../kinds/AssetKindHandler.ts";
import {
  ASSET_CREATED,
  ASSET_DELETED,
  ASSET_UPDATED
} from "../events/AssetEvents.ts";

// CONSTANTS
/** Lifecycle events a handler folds by replacing the whole state. */
const kCheckpointEventTypes: readonly string[] = [
  ASSET_CREATED,
  ASSET_UPDATED,
  ASSET_DELETED
];
/** Events folded between yields, so one long replay cannot hold the loop. */
const kReplayYieldEvery = 250;

export interface AssetStateEntry {
  readonly assetId: string;
  readonly kind: string;
  readonly handler: AssetKindHandler;
  readonly state: unknown;
}

export interface AssetStateStoreOptions {
  eventStore: EventStore.EventStore;
  kinds: AssetKindRegistry;
}

/**
 * Holds live per-asset state folded by each asset's kind handler.
 */
export class AssetStateStore {
  #eventStore: EventStore.EventStore;
  #kinds: AssetKindRegistry;
  #entries = new Map<string, AssetStateEntry>();
  #replays = new Map<string, Promise<AssetStateEntry>>();
  #onAppend: ((event: EventStore.Event) => void) | null = null;

  constructor(
    options: AssetStateStoreOptions
  ) {
    this.#eventStore = options.eventStore;
    this.#kinds = options.kinds;
  }

  start(): void {
    if (this.#onAppend !== null) {
      return;
    }

    this.#onAppend = (event) => {
      const entry = this.#entries.get(event.assetId);
      entry?.handler.apply(entry.state, event);
    };
    this.#eventStore.writer.on("append", this.#onAppend);
  }

  close(): void {
    if (this.#onAppend !== null) {
      this.#eventStore.writer.off("append", this.#onAppend);
      this.#onAppend = null;
    }

    this.#entries.clear();
  }

  has(
    assetId: string
  ): boolean {
    return this.#entries.has(assetId);
  }

  get(
    assetId: string
  ): AssetStateEntry | undefined {
    return this.#entries.get(assetId);
  }

  /**
   * Returns the live entry, replaying the asset's stream on first access.
   * Concurrent callers share one replay.
   */
  acquire(
    assetId: string,
    kind: string
  ): Promise<AssetStateEntry> {
    const existing = this.#entries.get(assetId);
    if (existing !== undefined) {
      return Promise.resolve(existing);
    }

    const inFlight = this.#replays.get(assetId);
    if (inFlight !== undefined) {
      return inFlight;
    }

    const replay = this.#replay(assetId, kind)
      .then((entry) => {
        this.#entries.set(assetId, entry);

        return entry;
      })
      .finally(() => this.#replays.delete(assetId));
    this.#replays.set(assetId, replay);

    return replay;
  }

  release(
    assetId: string
  ): void {
    this.#entries.delete(assetId);
  }

  /**
   * Serializes an asset's state to the bytes its projection stores.
   * Replays the stream when the asset is not live.
   */
  async serialize(
    assetId: string,
    kind: string
  ): Promise<Uint8Array> {
    const entry = this.#entries.get(assetId) ??
      await this.#replay(assetId, kind);

    return entry.handler.serialize(entry.state);
  }

  /**
   * Folds an asset's stream into a fresh state from its last checkpoint. Not
   * registered as live: `acquire` keeps the result, `serialize` drops it.
   */
  async #replay(
    assetId: string,
    kind: string
  ): Promise<AssetStateEntry> {
    const handler = this.#kinds.get(kind);
    const state = handler.create(assetId);
    const checkpoint = this.#eventStore.reader.lastVersionOf(
      assetId,
      kCheckpointEventTypes
    );
    // `list` is exclusive, so step back one to fold the checkpoint itself.
    let from = Math.max(checkpoint - 1, 0);
    let sinceYield = 0;

    for (;;) {
      const events = this.#eventStore.reader.list(assetId, from);
      if (events.length === 0) {
        break;
      }

      for (const event of events) {
        handler.apply(state, event);
        from = event.eventVersion;
        if (++sinceYield >= kReplayYieldEvery) {
          sinceYield = 0;
          await timers.setImmediate();
        }
      }
    }

    return {
      assetId,
      kind,
      handler,
      state
    };
  }
}
