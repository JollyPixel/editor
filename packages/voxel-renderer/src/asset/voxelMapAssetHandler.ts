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
import { applyCommandToWorld } from "../network/VoxelCommandApplier.ts";
import { isVoxelNetworkCommand } from "../network/VoxelCommandValidator.ts";
import {
  asVoxelWorldJSON,
  createVoxelMapState,
  decodeVoxelMapDocument,
  encodeVoxelMapDocument,
  loadVoxelMapDocument
} from "./VoxelMapDocument.ts";
import { VoxelMapAssetExtension } from "./VoxelMapAssetExtension.ts";
import type { VoxelMapState } from "./VoxelMapState.ts";
import type { VoxelNetworkCommand } from "../network/types.ts";

export const VOXEL_MAP_KIND = "voxelmap";
export const VOXEL_MAP_COMMAND = "voxelmap.command";

// CONSTANTS
const kDefaultMatch = ["**/*.voxelmap.json"] as const;
const kDefaultChunkSize = 16;
/**
 * Terrain edits arrive in bursts and a large world is expensive to
 * serialize, so the default cadence is slower than the back-end's.
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
   * Chunk size for a world without a document.
   * Documents must use the same chunk size.
   * @default 16
   */
  chunkSize?: number;
  /**
   * @default 5s quiet period, 60s maximum
   */
  snapshot?: SnapshotPolicy;
  conflictResolver?: network.ConflictResolver<VoxelNetworkCommand>;
}

/**
 * Uses `apply` as the sole writer to avoid applying offset deltas twice.
 */
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

    create(): VoxelMapState {
      return createVoxelMapState(chunkSize);
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
        encodeVoxelMapDocument(state)
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
      loadVoxelMapDocument(
        state,
        decodeVoxelMapDocument(
          decodeContent(event.eventData.content)
        )
      );
    }
    else if (event.eventType === ASSET_DELETED) {
      state.world.clear();
      state.tilesets = [];
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
    loadVoxelMapDocument(
      state,
      asVoxelWorldJSON(command.data)
    );

    return;
  }

  // Ignore commands for layers removed by a later world replacement.
  applyCommandToWorld(state.world, command);
}
