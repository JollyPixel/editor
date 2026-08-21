// Import Third-party Dependencies
import {
  Extension,
  type ClientHandle,
  type PeerMetadata,
  type RoomBroadcast,
  type RoomContext
} from "@jolly-pixel/network";
import type { AssetManifestData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type {
  CatalogChange,
  CatalogProjection
} from "./CatalogProjection.ts";

export const CATALOG_ROOM = "asset-catalog";

export const CATALOG_SNAPSHOT = "catalog:snapshot";
export const CATALOG_CHANGED = "catalog:changed";

export type CatalogMessage =
  | { type: typeof CATALOG_SNAPSHOT; manifest: AssetManifestData; }
  | { type: typeof CATALOG_CHANGED; change: CatalogChange; };

export interface CatalogExtensionOptions {
  projection: CatalogProjection;
  /**
   * Room name clients join to follow the catalog.
   * @default CATALOG_ROOM
   */
  id?: string;
}

/**
 * Broadcasts the projected catalog without owning domain state.
 */
export class CatalogExtension extends Extension {
  readonly id: string;
  readonly name = CATALOG_ROOM;
  override readonly events: readonly string[] = [
    CATALOG_SNAPSHOT,
    CATALOG_CHANGED
  ];

  #projection: CatalogProjection;
  /**
   * Broadcast target retained while at least one client has joined.
   */
  #broadcast: RoomBroadcast | null = null;
  #members = new Set<string>();
  #onChanged: (change: CatalogChange) => void;

  constructor(
    options: CatalogExtensionOptions
  ) {
    super();
    this.id = options.id ?? CATALOG_ROOM;
    this.#projection = options.projection;
    this.#onChanged = (change) => this.#broadcast?.broadcast({
      type: CATALOG_CHANGED,
      change
    } satisfies CatalogMessage);
    this.#projection.on(
      "changed",
      this.#onChanged
    );
  }

  override getEventName(
    payload: unknown
  ): string {
    return typeof payload === "object" &&
      payload !== null &&
      "type" in payload &&
      typeof payload.type === "string" ?
      payload.type :
      CATALOG_CHANGED;
  }

  onClientConnect(
    client: ClientHandle,
    _identity: PeerMetadata,
    context: RoomContext
  ): void {
    this.#broadcast = context.room;
    this.#members.add(client.id);

    context.room.sendTo(client.id, {
      type: CATALOG_SNAPSHOT,
      manifest: this.#projection.snapshot()
    } satisfies CatalogMessage);
  }

  onClientDisconnect(
    clientId: string
  ): void {
    this.#members.delete(clientId);
    if (this.#members.size === 0) {
      this.#broadcast = null;
    }
  }

  /**
   * The catalog is read-only over the wire: it is derived from the log.
   */
  onMessage(): void {
    return void 0;
  }

  override dispose(): void {
    this.#projection.off(
      "changed",
      this.#onChanged
    );
    this.#members.clear();
    this.#broadcast = null;
  }
}
