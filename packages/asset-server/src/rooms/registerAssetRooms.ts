// Import Third-party Dependencies
import type {
  RoomResolution,
  Server
} from "@jolly-pixel/network";
import type * as EventStore from "@jolly-pixel/event-store";
import { AssetRoom } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { AssetRoomExtension } from "./AssetRoomExtension.ts";
import type { AssetKindRegistry } from "../kinds/AssetKindRegistry.ts";
import type { AssetRoomBinding } from "../kinds/AssetKindHandler.ts";
import type { CatalogProjection } from "../catalog/CatalogProjection.ts";
import type { CatalogChange } from "../catalog/client/protocol.ts";
import type { AssetStateStore } from "../state/AssetStateStore.ts";
import {
  silentLogger,
  type Logger
} from "../logger.ts";

export interface AssetRoomsOptions {
  server: Server;
  events: EventStore.EventWriter;
  reader?: EventStore.EventReader;
  kinds: AssetKindRegistry;
  catalog: CatalogProjection;
  states: AssetStateStore;
  flush: (assetId: string) => Promise<void>;
  graceMs?: number;
  logger?: Logger;
}

export function registerAssetRooms(
  options: AssetRoomsOptions
): () => void {
  const {
    server,
    events,
    reader,
    kinds,
    catalog,
    states,
    flush,
    graceMs,
    logger = silentLogger()
  } = options;

  const liveRooms = new Map<string, AssetRoomExtension>();
  function onCatalogChanged(
    change: CatalogChange
  ): void {
    if (change.record === null) {
      liveRooms.get(change.assetId)?.markDeleted();
    }
  }
  catalog.on("changed", onCatalogChanged);
  function onStateReplaced(
    assetId: string
  ): void {
    liveRooms.get(assetId)?.reload();
  }
  states.on("replaced", onStateReplaced);

  server.setRoomResolver(async(roomName): Promise<RoomResolution | null> => {
    function refuse(
      reason: string
    ): null {
      logger
        .withMetadata({
          room: roomName,
          reason
        })
        .warn("asset room refused");

      return null;
    }

    const room = AssetRoom.parse(roomName);
    if (room === null) {
      return null;
    }

    const { kind, assetId: id } = room;
    if (!kinds.has(kind)) {
      return refuse("unknown kind");
    }

    const { commands } = kinds.get(kind);
    if (commands?.live === undefined) {
      return refuse("kind has no live protocol");
    }

    const assetId = id.value;
    if (catalog.record(id.value)?.kind !== kind) {
      return refuse("unknown asset");
    }

    const entry = await states.acquire(assetId, kind);
    const binding: AssetRoomBinding = {
      assetId,
      kind,
      roomId: roomName,
      state: entry.state,
      version: () => states.versionOf(assetId)
    };
    const extension = new AssetRoomExtension(
      binding,
      commands,
      commands.live(binding),
      events,
      {
        reader,
        restore: states.takeCommandsSinceCheckpoint(assetId)
      }
    );
    liveRooms.set(assetId, extension);

    return {
      extension,
      graceMs,
      onEvict: async() => {
        if (liveRooms.get(assetId) === extension) {
          liveRooms.delete(assetId);
        }
        await flush(assetId);
        states.release(assetId);
      }
    };
  });

  return () => {
    catalog.off("changed", onCatalogChanged);
    states.off("replaced", onStateReplaced);
    liveRooms.clear();
    server.setRoomResolver(null);
  };
}
