// Import Third-party Dependencies
import type {
  RoomResolution,
  Server
} from "@jolly-pixel/network";
import type * as EventStore from "@jolly-pixel/event-store";
import { AssetRoom } from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  AssetRoomExtension,
  type AssetRoomExtensionOptions
} from "./AssetRoomExtension.ts";
import { AssetRoomProtocols } from "./AssetRoomProtocols.ts";
import type { AssetKindRegistry } from "../model/kinds/AssetKindRegistry.ts";
import type { AnyAssetKindHandler } from "../model/kinds/AssetKindHandler.ts";
import type { AssetCommandHeader } from "../model/kinds/AssetLiveProtocol.ts";
import type { CatalogProjection } from "../catalog/CatalogProjection.ts";
import type { CatalogChange } from "../catalog/client/protocol.ts";
import type { AssetStateStore } from "./AssetStateStore.ts";
import type {
  AssetTags,
  TaggedVersion
} from "../catalog/tags/AssetTags.ts";
import {
  silentLogger,
  type Logger
} from "../common/logger.ts";

export interface AssetRoomsOptions {
  server: Server;
  events: EventStore.EventWriter;
  reader?: EventStore.EventReader;
  kinds: AssetKindRegistry;
  catalog: CatalogProjection;
  states: AssetStateStore;
  flush: (assetId: string) => Promise<void>;
  tags: Pick<AssetTags, "read">;
  graceMs?: number;
  logger?: Logger;
}

type AnyAssetCommands = NonNullable<AnyAssetKindHandler["commands"]>;
type LiveCommands = AnyAssetCommands &
  Required<Pick<AnyAssetCommands, "live">>;
type AnyAssetRoomExtension = AssetRoomExtension<AssetCommandHeader, object>;

interface ResolvedRoom {
  readonly roomId: string;
  readonly assetId: string;
  readonly handler: AnyAssetKindHandler;
  readonly commands: LiveCommands;
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
    tags,
    graceMs,
    logger = silentLogger()
  } = options;
  for (const kind of kinds.kinds()) {
    const { commands, parts } = kinds.get(kind);
    if (hasLiveProtocol(commands)) {
      AssetRoomProtocols.validate(commands, parts !== undefined);
    }
  }

  const liveRooms = new Map<string, AnyAssetRoomExtension>();
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

  function roomExtension(
    room: ResolvedRoom,
    state: unknown,
    version: () => number | undefined,
    extensionOptions?: AssetRoomExtensionOptions<AssetCommandHeader>
  ): AnyAssetRoomExtension {
    const binding = {
      assetId: room.assetId,
      kind: room.handler.kind,
      roomId: room.roomId,
      state,
      version
    };

    return new AssetRoomExtension(
      binding,
      room.commands,
      room.commands.live(binding),
      events,
      {
        ...extensionOptions,
        ...roomParts(room.handler, state)
      }
    );
  }

  function openTagRoom(
    room: ResolvedRoom,
    tagged: TaggedVersion
  ): RoomResolution {
    const state = room.handler.create(room.assetId);
    room.handler.load(state, tagged.data);
    for (const [partId, data] of tagged.parts ?? []) {
      room.handler.parts?.load(state, partId, data);
    }

    return {
      extension: roomExtension(room, state, () => tagged.eventVersion, {
        pushParts: true
      }),
      graceMs,
      readOnly: true
    };
  }

  async function openLiveRoom(
    room: ResolvedRoom
  ): Promise<RoomResolution> {
    const { assetId } = room;
    const entry = await states.acquire(assetId, room.handler.kind);
    let extension: AnyAssetRoomExtension;
    try {
      extension = roomExtension(
        room,
        entry.state,
        () => states.openVersion(assetId),
        {
          reader,
          restore: states.takeCommandsSinceCheckpoint(assetId)
        }
      );
    }
    catch (error) {
      states.release(assetId);
      throw error;
    }
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
  }

  server.useRoomResolver(async(roomName): Promise<RoomResolution | null> => {
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

    const { kind, tag } = room;
    if (!kinds.has(kind.value)) {
      return refuse("unknown kind");
    }

    const handler = kinds.get(kind.value);
    const { commands } = handler;
    if (!hasLiveProtocol(commands)) {
      return refuse("kind has no live protocol");
    }

    const assetId = room.assetId.value;
    const record = catalog.record(assetId);
    if (record === undefined || !record.hasKind(kind)) {
      return refuse("unknown asset");
    }

    const resolved: ResolvedRoom = {
      roomId: roomName,
      assetId,
      handler,
      commands
    };
    if (tag === null) {
      return openLiveRoom(resolved);
    }

    const tagged = tags.read(assetId, tag);

    return tagged.ok ?
      openTagRoom(resolved, tagged.val) :
      refuse("unknown tag");
  });

  return () => {
    catalog.off("changed", onCatalogChanged);
    states.off("replaced", onStateReplaced);
    liveRooms.clear();
    server.useRoomResolver(null);
  };
}

function roomParts(
  handler: AnyAssetKindHandler,
  state: unknown
): Pick<AssetRoomExtensionOptions<AssetCommandHeader>, "parts"> {
  const { parts } = handler;
  if (parts === undefined) {
    return {};
  }

  return {
    parts: {
      touched: (command) => parts.touched(command),
      list: () => parts.list(state)
    }
  };
}

function hasLiveProtocol(
  commands: AnyAssetCommands | undefined
): commands is LiveCommands {
  return commands?.live !== undefined;
}
