// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import {
  arbitrated,
  InvalidAssetFileError,
  JSON_CONTENT_TYPE,
  JsonAssetFile,
  SNAPSHOT_OPTIONS_SCHEMA,
  type AssetKindHandler,
  type AssetKindPackage,
  type SnapshotPolicy
} from "@jolly-pixel/asset-server";
import { InvalidEntryError } from "@jolly-pixel/asset.common";
import { PIXEL_ART_KIND } from "@jolly-pixel/asset.pixel-art";

// Import Internal Dependencies
import {
  compactVoxelModelFile,
  createVoxelModelFile,
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
export const VOXEL_MODEL_FILE = new JsonAssetFile({
  kind: VOXEL_MODEL_KIND,
  schema: compactVoxelModelFileSchema,
  expand: expandVoxelModelFile,
  compact: compactVoxelModelFile,
  isInvalid: (error) => error instanceof InvalidEntryError
});

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
      [VOXEL_MODEL_EXTENSION]: JSON_CONTENT_TYPE
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
      VOXEL_MODEL_FILE.load(content, (file) => state.load(file));
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
        VOXEL_MODEL_FILE.encode(state.toJSON())
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
        return {
          snapshotSchema: voxelModelSnapshotSchema,
          snapshot: () => state.snapshot(),
          ...arbitrated(state, {
            accepts: (model, command) => model.accepts(command),
            writes: (command) => {
              return { keys: voxelModelConflictKeys(command) };
            }
          })
        };
      }
    }
  };
}

export const ASSET_KINDS: AssetKindPackage<VoxelModelAssetKindOptions> = {
  descriptors: [VOXEL_MODEL_ASSET],
  optionsSchema: SNAPSHOT_OPTIONS_SCHEMA,
  handlers: (options) => [voxelModelAssetKind(options)]
};
