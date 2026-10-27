// Import Third-party Dependencies
import {
  arbitrated,
  JSON_CONTENT_TYPE,
  JsonAssetFile,
  SNAPSHOT_OPTIONS_SCHEMA,
  type AssetKindHandler,
  type AssetKindPackage,
  type SnapshotPolicy
} from "@jolly-pixel/asset-server";
import { InvalidEntryError } from "@jolly-pixel/asset.common";

// Import Internal Dependencies
import {
  compactVoxelAnimationFile,
  compactVoxelAnimationFileSchema,
  expandVoxelAnimationFile,
  VOXEL_ANIMATION_ASSET,
  VOXEL_ANIMATION_COMMAND,
  VOXEL_ANIMATION_FILE_VERSION,
  VOXEL_ANIMATION_EXTENSION,
  VOXEL_ANIMATION_KIND
} from "./voxelAnimation.ts";
import { AnimationSet } from "../model/AnimationSet.ts";
import {
  animationCommandProtocol,
  animationSetSnapshotSchema
} from "../network/AnimationCommand.schema.ts";
import { animationConflictKeys } from "../network/AnimationCommandKeys.ts";
import type { AnimationNetworkCommand } from "../network/types.ts";

// CONSTANTS
export const VOXEL_ANIMATION_FILE = new JsonAssetFile({
  kind: VOXEL_ANIMATION_KIND,
  schema: compactVoxelAnimationFileSchema,
  expand: expandVoxelAnimationFile,
  compact: compactVoxelAnimationFile,
  isInvalid: (error) => error instanceof InvalidEntryError
});

export interface VoxelAnimationAssetKindOptions {
  snapshot?: SnapshotPolicy;
}

export function voxelAnimationAssetKind(
  options: VoxelAnimationAssetKindOptions = {}
): AssetKindHandler<AnimationSet, AnimationNetworkCommand> {
  const { snapshot } = options;

  return {
    kind: VOXEL_ANIMATION_KIND,
    extensions: {
      [VOXEL_ANIMATION_EXTENSION]: JSON_CONTENT_TYPE
    },
    snapshot,

    create(): AnimationSet {
      return new AnimationSet();
    },

    load(
      state: AnimationSet,
      content: Uint8Array
    ): void {
      VOXEL_ANIMATION_FILE.load(content, (file) => state.load(file));
    },

    clear(
      state: AnimationSet
    ): void {
      state.clear();
    },

    serialize(
      state: AnimationSet
    ): Promise<Uint8Array> {
      return Promise.resolve(
        VOXEL_ANIMATION_FILE.encode({
          version: VOXEL_ANIMATION_FILE_VERSION,
          ...state.toJSON()
        })
      );
    },

    commands: {
      eventType: VOXEL_ANIMATION_COMMAND,
      protocol: animationCommandProtocol,

      apply(state, command) {
        state.apply(command);
      },

      live({ state }) {
        return {
          snapshotSchema: animationSetSnapshotSchema,
          snapshot: () => state.toJSON(),
          ...arbitrated(state, {
            accepts: (set, command) => set.accepts(command),
            writes: (command) => {
              return { keys: animationConflictKeys(command) };
            }
          })
        };
      }
    }
  };
}

export const ASSET_KINDS: AssetKindPackage<VoxelAnimationAssetKindOptions> = {
  descriptors: [VOXEL_ANIMATION_ASSET],
  optionsSchema: SNAPSHOT_OPTIONS_SCHEMA,
  handlers: (options) => [voxelAnimationAssetKind(options)]
};
