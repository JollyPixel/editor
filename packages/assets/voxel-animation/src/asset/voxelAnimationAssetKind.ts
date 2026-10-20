// Import Third-party Dependencies
import {
  describeErrors,
  KeyedCommandArbiter,
  SchemaParser,
  type ConflictResolver
} from "@jolly-pixel/network";
import {
  InvalidAssetDocumentError,
  SNAPSHOT_POLICY_SCHEMA,
  type AssetKindHandler,
  type AssetKindPackage,
  type SnapshotPolicy
} from "@jolly-pixel/asset-server";
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  encodeVoxelAnimationDocument,
  voxelAnimationDocumentSchema,
  VOXEL_ANIMATION_ASSET,
  VOXEL_ANIMATION_COMMAND,
  VOXEL_ANIMATION_DOCUMENT_VERSION,
  VOXEL_ANIMATION_EXTENSION,
  VOXEL_ANIMATION_KIND,
  type VoxelAnimationDocument
} from "./voxelAnimation.ts";
import { expandTrack } from "./storedTrack.ts";
import { AnimationSet } from "../model/AnimationSet.ts";
import {
  animationCommandProtocol,
  animationSetSnapshotSchema
} from "../network/AnimationCommand.schema.ts";
import { animationConflictKeys } from "../network/AnimationCommandKeys.ts";
import type { AnimationNetworkCommand } from "../network/types.ts";

// CONSTANTS
const kOptionsSchema = z.strictObject({
  snapshot: z.optional(SNAPSHOT_POLICY_SCHEMA)
});
const kDocumentParser = new SchemaParser(voxelAnimationDocumentSchema);

export function decodeVoxelAnimationDocument(
  content: Uint8Array
): VoxelAnimationDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(content));
  }
  catch (error) {
    throw new InvalidAssetDocumentError(
      VOXEL_ANIMATION_KIND,
      "content is not JSON",
      { cause: error }
    );
  }

  const result = kDocumentParser.parse(parsed);
  if (result.err) {
    throw new InvalidAssetDocumentError(
      VOXEL_ANIMATION_KIND,
      describeErrors(result.val)
    );
  }

  return {
    ...result.val,
    clips: result.val.clips.map((clip) => {
      return {
        ...clip,
        tracks: clip.tracks.map(expandTrack)
      };
    })
  };
}

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
        const arbiter = new KeyedCommandArbiter<
          AnimationNetworkCommand,
          AnimationSet
        >({
          accepts: (set, command) => set.accepts(command),
          keys: animationConflictKeys,
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
