// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type {
  AssetKindHandler,
  SnapshotPolicy
} from "@jolly-pixel/asset-server/kinds";

// Import Internal Dependencies
import {
  VOXEL_MODEL_COMMAND,
  VOXEL_MODEL_KIND
} from "./kind.ts";
import { VoxelModelState } from "./VoxelModelState.ts";
import {
  decodeVoxelModelDocument,
  encodeVoxelModelDocument
} from "./document.ts";
import {
  voxelModelCommandProtocol,
  voxelModelSnapshotSchema
} from "../network/VoxelModelCommand.schema.ts";
import { ModelCommandArbiter } from "../network/ModelCommandArbiter.ts";
import { FolderCommandArbiter } from "../network/FolderCommandArbiter.ts";
import {
  isModelCommand,
  type VoxelModelNetworkCommand
} from "../network/types.ts";

// CONSTANTS
const kDefaultMatch = ["**/*.voxelmodel.json"] as const;
const kContentTypes: Readonly<Record<string, string>> = {
  ".json": "application/json; charset=utf-8"
};

export interface VoxelModelAssetHandlerOptions {
  match?: readonly string[];
  snapshot?: SnapshotPolicy;
  conflictResolver?: network.ConflictResolver<VoxelModelNetworkCommand>;
}

export function voxelModelAssetHandler(
  options: VoxelModelAssetHandlerOptions = {}
): AssetKindHandler<VoxelModelState, VoxelModelNetworkCommand> {
  const {
    match = kDefaultMatch,
    snapshot,
    conflictResolver
  } = options;

  return {
    kind: VOXEL_MODEL_KIND,
    match,
    snapshot,
    contentTypes: kContentTypes,

    create(): VoxelModelState {
      return new VoxelModelState();
    },

    load(
      state: VoxelModelState,
      content: Uint8Array
    ): void {
      state.load(decodeVoxelModelDocument(content));
    },

    clear(
      state: VoxelModelState
    ): void {
      state.clear();
    },

    serialize(
      state: VoxelModelState
    ): Promise<Uint8Array> {
      return Promise.resolve(encodeVoxelModelDocument(state.toJSON()));
    },

    dependencies(
      state: VoxelModelState
    ) {
      return state.dependencies();
    },

    commands: {
      eventType: VOXEL_MODEL_COMMAND,
      protocol: voxelModelCommandProtocol,

      apply(state, command) {
        state.applyCommand(command);
      },

      live({ state }) {
        const models = new ModelCommandArbiter({
          conflictResolver
        });
        const folders = new FolderCommandArbiter({
          conflictResolver
        });

        return {
          snapshotSchema: voxelModelSnapshotSchema,
          snapshot: () => state.snapshot(),
          arbitrate(command) {
            if (!state.accepts(command)) {
              return null;
            }

            return isModelCommand(command) ?
              models.admit(command) :
              folders.admit(command);
          }
        };
      }
    }
  };
}
