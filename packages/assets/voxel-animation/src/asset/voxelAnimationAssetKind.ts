// Import Third-party Dependencies
import {
  defineSchema,
  type ConflictResolver
} from "@jolly-pixel/network";
import {
  SNAPSHOT_POLICY_SCHEMA,
  type AssetKindHandler,
  type AssetKindPackage,
  type SnapshotPolicy
} from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import {
  decodeVoxelAnimationDocument,
  encodeVoxelAnimationDocument,
  VOXEL_ANIMATION_ASSET,
  VOXEL_ANIMATION_COMMAND,
  VOXEL_ANIMATION_DOCUMENT_VERSION,
  VOXEL_ANIMATION_EXTENSION,
  VOXEL_ANIMATION_KIND
} from "./voxelAnimation.ts";
import { AnimationSet } from "../model/AnimationSet.ts";
import {
  animationCommandProtocol,
  animationSetSnapshotSchema
} from "../network/AnimationCommand.schema.ts";
import { AnimationCommandArbiter } from "../network/AnimationCommandArbiter.ts";
import type { AnimationNetworkCommand } from "../network/types.ts";

// CONSTANTS
const kOptionsSchema = defineSchema({
  type: "object",
  properties: {
    snapshot: SNAPSHOT_POLICY_SCHEMA
  },
  additionalProperties: false
});

export interface VoxelAnimationAssetKindOptions {
  snapshot?: SnapshotPolicy;
  conflictResolver?: ConflictResolver<AnimationNetworkCommand>;
}

export function voxelAnimationAssetKind(
  options: VoxelAnimationAssetKindOptions = {}
): AssetKindHandler<AnimationSet, AnimationNetworkCommand> {
  const {
    snapshot,
    conflictResolver
  } = options;

  return {
    kind: VOXEL_ANIMATION_KIND,
    extensions: {
      [VOXEL_ANIMATION_EXTENSION]: "application/json; charset=utf-8"
    },
    snapshot,

    create(): AnimationSet {
      return new AnimationSet();
    },

    load(
      state: AnimationSet,
      content: Uint8Array
    ): void {
      state.load(
        decodeVoxelAnimationDocument(content)
      );
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
        encodeVoxelAnimationDocument({
          version: VOXEL_ANIMATION_DOCUMENT_VERSION,
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
        const arbiter = new AnimationCommandArbiter({
          conflictResolver
        });

        return {
          snapshotSchema: animationSetSnapshotSchema,
          snapshot: () => state.toJSON(),
          arbitrate: (command) => arbiter.admit(state, command),
          restore: (command, version) => arbiter.restore(command, version)
        };
      }
    }
  };
}

export const ASSET_KINDS: AssetKindPackage<VoxelAnimationAssetKindOptions> = {
  descriptors: [VOXEL_ANIMATION_ASSET],
  optionsSchema: kOptionsSchema,
  handlers: (options) => [voxelAnimationAssetKind(options)]
};
