// Import Node.js Dependencies
import timers from "node:timers/promises";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import type { AssetKindRegistry } from "../kinds/AssetKindRegistry.ts";
import type { AssetKindHandler } from "../kinds/AssetKindHandler.ts";
import { ASSET_CHECKPOINT_EVENT_TYPES } from "../events/AssetEvents.ts";

// CONSTANTS
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
  #unsubscribe: (() => void) | null = null;

  constructor(
    options: AssetStateStoreOptions
  ) {
    this.#eventStore = options.eventStore;
    this.#kinds = options.kinds;
  }

  start(): void {
    this.#unsubscribe ??= this.#eventStore.subscribe((event) => {
      const entry = this.#entries.get(event.assetId);
      entry?.handler.apply(entry.state, event);
    });
  }

  close(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
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

  async serialize(
    assetId: string,
    kind: string
  ): Promise<Uint8Array> {
    const entry = this.#entries.get(assetId) ??
      await this.#replay(assetId, kind);

    return entry.handler.serialize(entry.state);
  }

  async #replay(
    assetId: string,
    kind: string
  ): Promise<AssetStateEntry> {
    const handler = this.#kinds.get(kind);
    const state = handler.create(assetId);
    let events = this.#eventStore.reader.listFromCheckpoint(
      assetId,
      ASSET_CHECKPOINT_EVENT_TYPES
    );
    let from = 0;
    let sinceYield = 0;

    while (events.length > 0) {
      for (const event of events) {
        handler.apply(state, event);
        from = event.eventVersion;
        if (++sinceYield >= kReplayYieldEvery) {
          sinceYield = 0;
          await timers.setImmediate();
        }
      }

      events = this.#eventStore.reader.list(assetId, from);
    }

    return {
      assetId,
      kind,
      handler,
      state
    };
  }
}
