// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import {
  describeErrors,
  SchemaParser,
  type ConflictResolver
} from "@jolly-pixel/network";
import {
  InvalidAssetDocumentError,
  type AssetKindHandler,
  type SnapshotPolicy
} from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import {
  encodeVoxelModelDocument,
  VOXEL_MODEL_COMMAND,
  VOXEL_MODEL_DOCUMENT_VERSION,
  VOXEL_MODEL_EXTENSION,
  VOXEL_MODEL_KIND,
  voxelModelDocumentSchema,
  type VoxelModelDocument
} from "./voxelModel.ts";
import { ModelTree } from "../model/ModelTree.ts";
import {
  voxelModelCommandProtocol,
  voxelModelSnapshotSchema
} from "../network/VoxelModelCommand.schema.ts";
import { VoxelModelCommandArbiter } from "../network/VoxelModelCommandArbiter.ts";
import type {
  VoxelModelCommand,
  VoxelModelNetworkCommand,
  VoxelModelSnapshot
} from "../network/types.ts";

// CONSTANTS
const kDocumentParser = new SchemaParser(voxelModelDocumentSchema);

export function decodeVoxelModelDocument(
  content: Uint8Array
): VoxelModelDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(content));
  }
  catch (error) {
    throw new InvalidAssetDocumentError(
      VOXEL_MODEL_KIND,
      "content is not JSON",
      { cause: error }
    );
  }

  const result = kDocumentParser.parse(parsed);
  if (result.err) {
    throw new InvalidAssetDocumentError(
      VOXEL_MODEL_KIND,
      describeErrors(result.val)
    );
  }

  return result.val;
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
    document: VoxelModelDocument
  ): void {
    this.#tree.load(document.nodes);
    this.#texture = {
      id: document.texture.id,
      kind: document.texture.kind
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
    return this.#texture === null
      ? []
      : [{ ...this.#texture }];
  }

  snapshot(): VoxelModelSnapshot {
    return {
      nodes: this.#tree.toJSON()
    };
  }

  toJSON(): VoxelModelDocument {
    if (this.#texture === null) {
      throw new InvalidAssetDocumentError(
        VOXEL_MODEL_KIND,
        "texture is missing"
      );
    }

    return {
      version: VOXEL_MODEL_DOCUMENT_VERSION,
      ...this.snapshot(),
      texture: { ...this.#texture }
    };
  }
}

export interface VoxelModelAssetKindOptions {
  snapshot?: SnapshotPolicy;
  conflictResolver?: ConflictResolver<VoxelModelNetworkCommand>;
}

export function voxelModelAssetKind(
  options: VoxelModelAssetKindOptions = {}
): AssetKindHandler<VoxelModelState, VoxelModelNetworkCommand> {
  const {
    snapshot,
    conflictResolver
  } = options;

  return {
    kind: VOXEL_MODEL_KIND,
    extensions: {
      [VOXEL_MODEL_EXTENSION]: "application/json; charset=utf-8"
    },
    snapshot,

    create(): VoxelModelState {
      return new VoxelModelState();
    },

    load(
      state: VoxelModelState,
      content: Uint8Array
    ): void {
      state.load(
        decodeVoxelModelDocument(content)
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
        encodeVoxelModelDocument(state.toJSON())
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
      const document = state.toJSON();
      const { texture } = document;
      state.load({
        ...document,
        texture: {
          ...texture,
          id: idMap.get(texture.id) ?? texture.id
        }
      });
    },

    commands: {
      eventType: VOXEL_MODEL_COMMAND,
      protocol: voxelModelCommandProtocol,

      apply(state, command) {
        state.applyCommand(command);
      },

      live({ state }) {
        const arbiter = new VoxelModelCommandArbiter({
          conflictResolver
        });

        return {
          snapshotSchema: voxelModelSnapshotSchema,
          snapshot: () => state.snapshot(),
          arbitrate(command) {
            return state.accepts(command)
              ? arbiter.admit(command)
              : null;
          }
        };
      }
    }
  };
}
