// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import {
  describeErrors,
  KeyedCommandArbiter,
  SchemaParser
} from "@jolly-pixel/network";
import {
  InvalidAssetFileError,
  SNAPSHOT_POLICY_SCHEMA,
  type AssetKindHandler,
  type AssetKindPackage,
  type SnapshotPolicy
} from "@jolly-pixel/asset-server";

import { PIXEL_ART_KIND } from "@jolly-pixel/asset.pixel-art";
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  createVoxelModelFile,
  encodeVoxelModelFile,
  VOXEL_MODEL_ASSET,
  VOXEL_MODEL_COMMAND,
  VOXEL_MODEL_FILE_VERSION,
  VOXEL_MODEL_EXTENSION,
  VOXEL_MODEL_KIND,
  compactVoxelModelFileSchema,
  expandVoxelModelFile,
  type VoxelModelFile
} from "./voxelModel.ts";
import { ModelTree } from "../model/ModelTree.ts";
import {
  voxelModelCommandProtocol,
  voxelModelSnapshotSchema
} from "../network/VoxelModelCommand.schema.ts";
import { voxelModelConflictKeys } from "../network/VoxelModelCommandKeys.ts";
import type {
  VoxelModelCommand,
  VoxelModelNetworkCommand,
  VoxelModelSnapshot
} from "../network/types.ts";

// CONSTANTS
const kFileParser = new SchemaParser(compactVoxelModelFileSchema);
const kOptionsSchema = z.strictObject({
  snapshot: z.optional(SNAPSHOT_POLICY_SCHEMA)
});

export function decodeVoxelModelFile(
  content: Uint8Array
): VoxelModelFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(content));
  }
  catch (error) {
    throw new InvalidAssetFileError(
      VOXEL_MODEL_KIND,
      "content is not JSON",
      { cause: error }
    );
  }

  const result = kFileParser.parse(parsed);
  if (result.err) {
    throw new InvalidAssetFileError(
      VOXEL_MODEL_KIND,
      describeErrors(result.val)
    );
  }

  return expandVoxelModelFile(result.val);
}

export class VoxelModelState {
  #tree = new ModelTree();
  #texture: AssetReferenceData | null = null;

  get texture(): AssetReferenceData | null {
    return this.#texture === null ?
      null :
      { ...this.#texture };
  }

  load(
    file: VoxelModelFile
  ): void {
    this.#tree.load(file);
    this.#texture = {
      id: file.texture.id,
      kind: file.texture.kind
    };
  }

  clear(): void {
    this.#tree.clear();
    this.#texture = null;
  }

  accepts(
    command: VoxelModelCommand
  ): boolean {
    return this.#tree.accepts(command);
  }

  applyCommand(
    command: VoxelModelCommand
  ): void {
    this.#tree.apply(command);
  }

  dependencies(): AssetReferenceData[] {
    const sets = [...this.#tree.animationSets.values()].map(({ id, kind }) => {
      return { id, kind };
    });

    return this.#texture === null ?
      sets :
      [{ ...this.#texture }, ...sets];
  }

  snapshot(): VoxelModelSnapshot {
    return this.#tree.toJSON();
  }

  toJSON(): VoxelModelFile {
    if (this.#texture === null) {
      throw new InvalidAssetFileError(
        VOXEL_MODEL_KIND,
        "texture is missing"
      );
    }

    return {
      version: VOXEL_MODEL_FILE_VERSION,
      ...this.snapshot(),
      texture: { ...this.#texture }
    };
  }
}

export interface VoxelModelAssetKindOptions {
  snapshot?: SnapshotPolicy;
}

export function voxelModelAssetKind(
  options: VoxelModelAssetKindOptions = {}
): AssetKindHandler<VoxelModelState, VoxelModelNetworkCommand> {
  const { snapshot } = options;

  return {
    kind: VOXEL_MODEL_KIND,
    extensions: {
      [VOXEL_MODEL_EXTENSION]: "application/json; charset=utf-8"
    },
    snapshot,
    companions: [
      {
        kind: PIXEL_ART_KIND,
        link(state, texture) {
          state.load(
            createVoxelModelFile({ texture })
          );
        }
      }
    ],

    create(): VoxelModelState {
      return new VoxelModelState();
    },

    load(
      state: VoxelModelState,
      content: Uint8Array
    ): void {
      state.load(
        decodeVoxelModelFile(content)
      );
    },

    clear(
      state: VoxelModelState
    ): void {
      state.clear();
    },

    serialize(
      state: VoxelModelState
    ): Promise<Uint8Array> {
      return Promise.resolve(
        encodeVoxelModelFile(state.toJSON())
      );
    },

    dependencies(
      state: VoxelModelState
    ) {
      return state.dependencies();
    },

    rebind(
      state: VoxelModelState,
      idMap: ReadonlyMap<string, string>
    ): void {
      const file = state.toJSON();
      const { texture, animationSets } = file;
      state.load({
        ...file,
        texture: {
          ...texture,
          id: idMap.get(texture.id) ?? texture.id
        },
        animationSets: animationSets.map((link) => {
          return {
            ...link,
            id: idMap.get(link.id) ?? link.id
          };
        })
      });
    },

    commands: {
      eventType: VOXEL_MODEL_COMMAND,
      protocol: voxelModelCommandProtocol,

      apply(state, command) {
        state.applyCommand(command);
      },

      live({ state }) {
        const arbiter = new KeyedCommandArbiter<
          VoxelModelNetworkCommand,
          VoxelModelState
        >({
          accepts: (model, command) => model.accepts(command),
          writes: (command) => {
            return { keys: voxelModelConflictKeys(command) };
          }
        });

        return {
          snapshotSchema: voxelModelSnapshotSchema,
          snapshot: () => state.snapshot(),
          arbitrate: (command) => arbiter.admit(state, command),
          restore: (command, version) => arbiter.restore(command, version)
        };
      }
    }
  };
}

export const ASSET_KINDS: AssetKindPackage<VoxelModelAssetKindOptions> = {
  descriptors: [VOXEL_MODEL_ASSET],
  optionsSchema: kOptionsSchema,
  handlers: (options) => [voxelModelAssetKind(options)]
};
