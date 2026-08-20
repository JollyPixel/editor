// Import Third-party Dependencies
import type {
  RoomResolution,
  Server
} from "@jolly-pixel/network";
import { AssetId } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { AssetKindRegistry } from "../kinds/AssetKindRegistry.ts";
import type { CatalogProjection } from "../catalog/CatalogProjection.ts";
import type { AssetStateStore } from "../sync/AssetStateStore.ts";
import type { AssetProjector } from "../sync/AssetProjector.ts";
import type { SnapshotScheduler } from "../sync/SnapshotScheduler.ts";
import {
  silentLogger,
  type Logger
} from "../logger.ts";

export interface AssetRoomName {
  readonly kind: string;
  readonly assetId: string;
}

export function assetRoomName(
  kind: string,
  assetId: string
): string {
  return `${kind}:${assetId}`;
}

/**
 * Splits `${kind}:${assetId}` at the first colon.
 */
export function parseAssetRoomName(
  roomName: string
): AssetRoomName | null {
  const separator = roomName.indexOf(":");
  if (
    separator <= 0 ||
    separator === roomName.length - 1
  ) {
    return null;
  }

  return {
    kind: roomName.slice(0, separator),
    assetId: roomName.slice(separator + 1)
  };
}

export interface AssetRoomsOptions {
  server: Server;
  kinds: AssetKindRegistry;
  catalog: CatalogProjection;
  states: AssetStateStore;
  projector: AssetProjector;
  scheduler: SnapshotScheduler;
  /**
   * Grace period, in milliseconds, before an empty asset room is disposed.
   * Falls back to the Server's default when omitted.
   */
  graceMs?: number;
  logger?: Logger;
}

/**
 * Resolves cataloged assets whose kind can create a room extension.
 *
 * Eviction flushes the asset before releasing its live state.
 */
export function registerAssetRooms(
  options: AssetRoomsOptions
): () => void {
  const {
    server,
    kinds,
    catalog,
    states,
    projector,
    scheduler,
    graceMs,
    logger = silentLogger()
  } = options;

  server.setRoomResolver((roomName): RoomResolution | null => {
    function refuse(
      reason: string,
      metadata: Record<string, unknown> = {}
    ): null {
      logger
        .withMetadata({
          room: roomName,
          reason, ...metadata
        })
        .warn("asset room refused");

      return null;
    }

    const parsed = parseAssetRoomName(roomName);
    if (parsed === null) {
      return null;
    }

    const { kind, assetId } = parsed;
    if (!kinds.has(kind)) {
      return refuse("unknown kind");
    }

    const handler = kinds.get(kind);
    if (handler.createExtension === undefined) {
      return refuse("kind has no extension");
    }

    const id = new AssetId(assetId);
    if (
      !catalog.catalog.has(id) ||
      catalog.catalog.get(id).kind !== kind
    ) {
      return refuse("unknown asset");
    }

    const entry = states.acquire(assetId, kind);
    const extension = handler.createExtension({
      assetId,
      kind,
      roomId: roomName,
      state: entry.state
    });
    if (extension.id !== roomName) {
      states.release(assetId);

      return refuse(
        "extension id must match the room name",
        { extensionId: extension.id }
      );
    }

    return {
      extension,
      graceMs,
      onEvict: async() => {
        await scheduler.flush(assetId);
        await projector.flush(assetId);
        states.release(assetId);
      }
    };
  });

  return () => server.setRoomResolver(null);
}
