// Import Third-party Dependencies
import {
  defineMessageProtocol,
  Extension,
  NO_MESSAGES,
  type ClientHandle,
  type MessageProtocols,
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

// CONSTANTS
export const CATALOG_ROOM = "asset-catalog";

export const CATALOG_SNAPSHOT = "catalog:snapshot";
export const CATALOG_CHANGED = "catalog:changed";

export type CatalogMessage =
  | { type: typeof CATALOG_SNAPSHOT; manifest: AssetManifestData; }
  | { type: typeof CATALOG_CHANGED; change: CatalogChange; };

export const catalogProtocols: MessageProtocols = {
  inbound: NO_MESSAGES,
  outbound: defineMessageProtocol({
    discriminator: "type",
    schema: {
      oneOf: [
        {
          type: "object",
          properties: {
            type: { const: CATALOG_SNAPSHOT },
            manifest: { type: "object" }
          },
          required: [
            "type",
            "manifest"
          ]
        },
        {
          type: "object",
          properties: {
            type: { const: CATALOG_CHANGED },
            change: { type: "object" }
          },
          required: [
            "type",
            "change"
          ]
        }
      ]
    }
  })
};

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
  readonly protocols: MessageProtocols = catalogProtocols;

  #projection: CatalogProjection;
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

  override onClientConnect(
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

  override onClientDisconnect(
    clientId: string
  ): void {
    this.#members.delete(clientId);
    if (this.#members.size === 0) {
      this.#broadcast = null;
    }
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
