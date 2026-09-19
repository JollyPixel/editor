// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type {
  AssetKindHandler,
  SnapshotPolicy
} from "@jolly-pixel/asset-server/kinds";
import {
  decodeVoxelDocument,
  encodeVoxelDocument
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  voxelCommandProtocol,
  voxelWorldSchema
} from "../network/VoxelCommand.schema.ts";
import { VoxelMapState } from "./VoxelMapState.ts";
import {
  VOXEL_MAP_COMMAND,
  VOXEL_MAP_EXTENSION,
  VOXEL_MAP_KIND
} from "./kind.ts";
import { VoxelCommandArbiter } from "../network/VoxelCommandArbiter.ts";
import type { VoxelNetworkCommand } from "../network/types.ts";

// CONSTANTS
const kDefaultChunkSize = 16;
/**
 * Uses a slower snapshot cadence for bursty, expensive terrain serialization.
 */
const kDefaultSnapshot: SnapshotPolicy = {
  delay: 5_000,
  maxDelay: 60_000
};

export interface VoxelMapAssetKindOptions {
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

export function voxelMapAssetKind(
  options: VoxelMapAssetKindOptions = {}
): AssetKindHandler<VoxelMapState, VoxelNetworkCommand> {
  const {
    chunkSize = kDefaultChunkSize,
    snapshot = kDefaultSnapshot,
    conflictResolver
  } = options;

  return {
    kind: VOXEL_MAP_KIND,
    extensions: {
      [VOXEL_MAP_EXTENSION]: "application/json; charset=utf-8"
    },
    snapshot,

    create(): VoxelMapState {
      return new VoxelMapState(chunkSize);
    },

    load(
      state: VoxelMapState,
      content: Uint8Array
    ): void {
      state.load(
        decodeVoxelDocument(content)
      );
    },

    clear(
      state: VoxelMapState
    ): void {
      state.clear();
    },

    serialize(
      state: VoxelMapState
    ): Promise<Uint8Array> {
      return Promise.resolve(
        encodeVoxelDocument(state.toJSON())
      );
    },

    dependencies(
      state: VoxelMapState
    ) {
      return state.dependencies();
    },

    commands: {
      eventType: VOXEL_MAP_COMMAND,
      protocol: voxelCommandProtocol,

      apply(state, command) {
        state.applyCommand(command);
      },

      live({ state }) {
        const arbiter = new VoxelCommandArbiter({
          conflictResolver
        });

        return {
          snapshotSchema: voxelWorldSchema,
          snapshot: () => state.toJSON(),
          arbitrate: (command) => arbiter.admit(command),
          broadcast(command) {
            if (command.action === "world-replace") {
              return {
                type: "snapshot",
                data: state.toJSON()
              };
            }

            return {
              type: "command",
              data: command
            };
          }
        };
      }
    }
  };
}
