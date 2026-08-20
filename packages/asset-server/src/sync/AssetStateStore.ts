// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import type { AssetKindRegistry } from "../kinds/AssetKindRegistry.ts";
import type { AssetKindHandler } from "../kinds/AssetKindHandler.ts";

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
   */
  acquire(
    assetId: string,
    kind: string
  ): AssetStateEntry {
    const existing = this.#entries.get(assetId);
    if (existing !== undefined) {
      return existing;
    }

    const entry = this.#replay(assetId, kind);
    this.#entries.set(assetId, entry);

    return entry;
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
  serialize(
    assetId: string,
    kind: string
  ): Promise<Uint8Array> {
    const entry = this.#entries.get(assetId) ?? this.#replay(assetId, kind);

    return entry.handler.serialize(entry.state);
  }

  /**
   * Folds an asset's whole stream into a fresh state. Not registered as
   * live: `acquire` keeps the result, `serialize` throws it away.
   */
  #replay(
    assetId: string,
    kind: string
  ): AssetStateEntry {
    const handler = this.#kinds.get(kind);
    const state = handler.create(assetId);
    for (const event of this.#eventStore.reader.list(assetId)) {
      handler.apply(state, event);
    }

    return {
      assetId,
      kind,
      handler,
      state
    };
  }
}
