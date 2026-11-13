// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import {
  arbitrated,
  InvalidAssetFileError,
  JSON_CONTENT_TYPE,
  SNAPSHOT_OPTIONS_SCHEMA,
  type AssetKindHandler,
  type AssetKindPackage,
  type SnapshotPolicy
} from "@jolly-pixel/asset-server";
import { PIXEL_ART_KIND } from "@jolly-pixel/asset.pixel-art";

// Import Internal Dependencies
import {
  createVoxelModelFile,
  VOXEL_MODEL_ASSET,
  VOXEL_MODEL_COMMAND,
  VOXEL_MODEL_FILE_VERSION,
  VOXEL_MODEL_EXTENSION,
  VOXEL_MODEL_KIND,
  type VoxelModelFile
} from "./voxelModel.ts";
import { VOXEL_MODEL_FILE } from "./voxelModelFile.ts";
import { ModelTree } from "../model/ModelTree.ts";
import { voxelModelSnapshotSchema } from "../model/VoxelModel.schema.ts";
import { voxelModelCommandProtocol } from "../network/voxelModelCommandProtocol.ts";
import { modelFootprint } from "../model/command/modelCommands.ts";
import { modelValueKey } from "../model/command/ModelValueRef.ts";
import { upcastVoxelModelCommand } from "../network/upcastVoxelModelCommand.ts";
import {
  CSMODEL_EXTENSION,
  voxelModelFromCsModel
} from "../conversion/csmodel/csModelConversion.ts";
import type {
  VoxelModelCommand,
  VoxelModelSnapshot
} from "../model/types.ts";
import type { VoxelModelNetworkCommand } from "../network/types.ts";

// CONSTANTS
const kEncoder = new TextEncoder();

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

  rebind(
    idMap: ReadonlyMap<string, string>
  ): void {
    const file = this.toJSON();
    this.load({
      ...file,
      texture: {
        ...file.texture,
        id: idMap.get(file.texture.id) ?? file.texture.id
      },
      animationSets: file.animationSets.map((link) => {
        return {
          ...link,
          id: idMap.get(link.id) ?? link.id
        };
      })
    });
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
    build: {
      build: (state) => Promise.resolve(
        kEncoder.encode(JSON.stringify(state.toJSON()))
      )
    },
    conversions: {
      [CSMODEL_EXTENSION]: voxelModelFromCsModel
    },
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
      state.rebind(idMap);
    },

    commands: {
      eventType: VOXEL_MODEL_COMMAND,
      protocol: voxelModelCommandProtocol,
      upcast: upcastVoxelModelCommand,

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
              return { keys: modelFootprint(command).conflicts.map(modelValueKey) };
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
