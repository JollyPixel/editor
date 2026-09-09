// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import type * as network from "@jolly-pixel/network";
import {
  ASSET_CREATED,
  ASSET_DELETED,
  ASSET_UPDATED,
  decodeContent,
  parseAssetEvent,
  type AssetKindHandler,
  type AssetLiveProtocol,
  type AssetRoomBinding,
  type AssetRoomMessage,
  type SnapshotPolicy
} from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { voxelProtocols } from "../network/VoxelCommand.schema.ts";
import {
  isVoxelBlockCommand,
  isVoxelNetworkCommand
} from "../network/VoxelCommandValidator.ts";
import {
  decodeVoxelDocument,
  encodeVoxelDocument,
  parseVoxelDocument
} from "../serialization/document.ts";
import { VoxelMapState } from "./VoxelMapState.ts";
import { VoxelCommandArbiter } from "../network/VoxelCommandArbiter.ts";
import {
  VOXEL_BLOCK_HOOK_ACTIONS,
  VOXEL_LAYER_HOOK_ACTIONS
} from "../hooks.ts";
import { applyBlockCommand } from "../network/applyBlockCommand.ts";
import type { VoxelNetworkCommand } from "../network/types.ts";
import { NOOP_LOGGER, type VoxelLogger } from "../utils/logger.ts";

export const VOXEL_MAP_KIND = "voxelmap";
export const VOXEL_MAP_COMMAND = "voxelmap.command";
export const VOXEL_MAP_ACTIONS: readonly string[] = [
  ...VOXEL_LAYER_HOOK_ACTIONS,
  ...VOXEL_BLOCK_HOOK_ACTIONS,
  "world-replace"
];

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
  logger?: VoxelLogger;
}

export function voxelMapAssetHandler(
  options: VoxelMapAssetHandlerOptions = {}
): AssetKindHandler<VoxelMapState, VoxelNetworkCommand> {
  const {
    match = kDefaultMatch,
    chunkSize = kDefaultChunkSize,
    snapshot = kDefaultSnapshot,
    conflictResolver,
    logger = NOOP_LOGGER
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
        logger.error(
          "voxelMapAssetHandler: skipped malformed event.",
          {
            eventType: event.eventType,
            error
          }
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

    live(
      binding: AssetRoomBinding<VoxelMapState>
    ): AssetLiveProtocol<VoxelNetworkCommand> {
      const arbiter = new VoxelCommandArbiter({ conflictResolver });
      const { state } = binding;

      return {
        commandEventType: VOXEL_MAP_COMMAND,
        protocols: voxelProtocols,

        parse(payload) {
          return isVoxelNetworkCommand(payload) ? payload : null;
        },

        snapshot() {
          return state.toJSON();
        },

        arbitrate(command) {
          if (command.action === "world-replace") {
            return { command };
          }

          const admitted = arbiter.admit(command);
          if (admitted === null) {
            return null;
          }

          return {
            command: admitted,
            commit: () => arbiter.record(admitted)
          };
        },

        broadcast(command): AssetRoomMessage {
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
  };
}

function applyEvent(
  state: VoxelMapState,
  event: EventStore.Event
): void {
  const parsed = parseAssetEvent(event);
  if (parsed.ok) {
    const assetEvent = parsed.val;
    if (
      assetEvent.eventType === ASSET_CREATED ||
      assetEvent.eventType === ASSET_UPDATED
    ) {
      state.load(
        decodeVoxelDocument(
          decodeContent(assetEvent.eventData.content)
        )
      );
    }
    else if (assetEvent.eventType === ASSET_DELETED) {
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
