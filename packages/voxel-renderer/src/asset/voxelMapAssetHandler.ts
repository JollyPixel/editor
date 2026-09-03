// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import type * as network from "@jolly-pixel/network";
import {
  ASSET_CREATED,
  ASSET_DELETED,
  ASSET_UPDATED,
  decodeContent,
  isAssetEvent,
  type AssetKindHandler,
  type AssetRoomBinding,
  type SnapshotPolicy
} from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import {
  isVoxelBlockCommand,
  isVoxelNetworkCommand
} from "../network/VoxelCommandValidator.ts";
import {
  decodeVoxelDocument,
  encodeVoxelDocument,
  parseVoxelDocument
} from "../serialization/document.ts";
import { VoxelMapAssetExtension } from "./VoxelMapAssetExtension.ts";
import { VoxelMapState } from "./VoxelMapState.ts";
import { applyBlockCommand } from "../network/applyBlockCommand.ts";
import type { VoxelNetworkCommand } from "../network/types.ts";

export const VOXEL_MAP_KIND = "voxelmap";
export const VOXEL_MAP_COMMAND = "voxelmap.command";

// CONSTANTS
const kDefaultMatch = ["**/*.voxelmap.json"] as const;
const kDefaultChunkSize = 16;
const kContentTypes: Readonly<Record<string, string>> = {
  ".json": "application/json; charset=utf-8"
};
/**
 * Uses a slower snapshot cadence for bursty, expensive terrain serialization.
 */
const kDefaultSnapshot: SnapshotPolicy = {
  delay: 5_000,
  maxDelay: 60_000
};

export interface VoxelMapAssetHandlerOptions {
  /**
   * Globs claiming voxel-map documents.
   * @default ["**\/*.voxelmap.json"]
   */
  match?: readonly string[];
  /**
   * Chunk size used when no document exists.
   * @default 16
   */
  chunkSize?: number;
  /**
   * @default 5s quiet period, 60s maximum
   */
  snapshot?: SnapshotPolicy;
  conflictResolver?: network.ConflictResolver<VoxelNetworkCommand>;
}

export function voxelMapAssetHandler(
  options: VoxelMapAssetHandlerOptions = {}
): AssetKindHandler<VoxelMapState> {
  const {
    match = kDefaultMatch,
    chunkSize = kDefaultChunkSize,
    snapshot = kDefaultSnapshot,
    conflictResolver
  } = options;

  return {
    kind: VOXEL_MAP_KIND,
    match,
    snapshot,
    contentTypes: kContentTypes,

    create(): VoxelMapState {
      return new VoxelMapState(chunkSize);
    },

    apply(
      state: VoxelMapState,
      event: EventStore.Event
    ): void {
      // Ignore malformed events to retain the last valid replay state.
      try {
        applyEvent(state, event);
      }
      catch (error) {
        console.error(
          `voxelMapAssetHandler: skipped malformed event (eventType="${event.eventType}"):`,
          error
        );
      }
    },

    serialize(
      state: VoxelMapState
    ): Promise<Uint8Array> {
      return Promise.resolve(
        encodeVoxelDocument(state.toJSON())
      );
    },

    createExtension(
      binding: AssetRoomBinding<VoxelMapState>
    ) {
      return new VoxelMapAssetExtension(binding, {
        commandEventType: VOXEL_MAP_COMMAND,
        conflictResolver
      });
    }
  };
}

function applyEvent(
  state: VoxelMapState,
  event: EventStore.Event
): void {
  if (isAssetEvent(event)) {
    if (
      event.eventType === ASSET_CREATED ||
      event.eventType === ASSET_UPDATED
    ) {
      state.load(
        decodeVoxelDocument(
          decodeContent(event.eventData.content)
        )
      );
    }
    else if (event.eventType === ASSET_DELETED) {
      state.clear();
    }

    return;
  }

  if (
    event.eventType !== VOXEL_MAP_COMMAND ||
    !isVoxelNetworkCommand(event.eventData)
  ) {
    return;
  }

  const command = event.eventData;
  if (command.action === "world-replace") {
    state.load(
      parseVoxelDocument(command.data)
    );

    return;
  }

  if (isVoxelBlockCommand(command)) {
    applyBlockCommand(state.blocks, command);

    return;
  }

  state.world.applyRemoteCommand(command);
}
