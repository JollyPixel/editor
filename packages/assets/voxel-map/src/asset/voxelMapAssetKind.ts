// Import Third-party Dependencies
import {
  defineSchema,
  describeErrors,
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
import {
  applyVoxelWorldCommand,
  DEFAULT_CHUNK_SIZE,
  decodeVoxelWorld,
  deserializeVoxelWorld,
  encodeVoxelWorld,
  InvalidVoxelWorldError,
  parseVoxelWorld,
  serializeVoxelWorld,
  BlocksetList,
  VoxelWorld,
  type BlocksetAssetReference,
  type BlocksetDefinition,
  type VoxelWorldCommandTarget,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  VOXEL_MAP_ASSET,
  VOXEL_MAP_COMMAND,
  VOXEL_MAP_EXTENSION,
  VOXEL_MAP_KIND
} from "./voxelMap.ts";
import {
  blocksetAsset,
  BLOCKSET_ASSET,
  BLOCKSET_KIND
} from "./blockset.ts";
import {
  blocksetAssetKind,
  type BlocksetAssetKindOptions
} from "./blocksetAssetKind.ts";
import {
  objectSchema,
  tileSizeSchema
} from "../network/schema.ts";
import {
  voxelCommandProtocol,
  voxelWorldSchema
} from "../network/VoxelCommand.schema.ts";
import { VoxelCommandArbiter } from "../network/VoxelCommandArbiter.ts";
import { correctVoxelCommand } from "../network/VoxelCorrection.ts";
import type { VoxelMapNetworkCommand } from "../network/types.ts";

// CONSTANTS
const kDefaultLayerName = "Ground";
const kCompanionBlocksetId = "default";
const kWorldParser = new SchemaParser(voxelWorldSchema);
const kPositiveIntegerSchema = defineSchema({
  type: "integer",
  minimum: 1
});
const kOptionsSchema = defineSchema({
  type: "object",
  properties: {
    blockset: {
      type: "object",
      properties: {
        tileSize: tileSizeSchema,
        defaultSize: objectSchema({
          x: kPositiveIntegerSchema,
          y: kPositiveIntegerSchema
        }),
        snapshot: SNAPSHOT_POLICY_SCHEMA
      },
      additionalProperties: false
    },
    voxelmap: {
      type: "object",
      properties: {
        chunkSize: kPositiveIntegerSchema,
        snapshot: SNAPSHOT_POLICY_SCHEMA
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
});
const kDefaultSnapshot: SnapshotPolicy = {
  delay: 5_000,
  maxDelay: 60_000
};

export class VoxelMapState implements VoxelWorldCommandTarget {
  readonly world: VoxelWorld;
  readonly blocksets = new BlocksetList();

  constructor(
    chunkSize: number
  ) {
    this.world = new VoxelWorld(chunkSize);
  }

  toJSON(): VoxelWorldJSON {
    return serializeVoxelWorld(this.world, {
      blocksets: this.blocksets
    });
  }

  load(
    document: VoxelWorldJSON
  ): void {
    deserializeVoxelWorld(document, this.world, {
      blocksets: this.blocksets
    });
  }

  applyCommand(
    command: VoxelMapNetworkCommand
  ): void {
    switch (command.action) {
      case "world-replace":
        this.load(
          parseVoxelWorld(command.data)
        );
        break;
      default:
        applyVoxelWorldCommand(this, command);
    }
  }

  dependencies(): BlocksetAssetReference[] {
    return [...this.blocksets].flatMap(
      ({ asset }) => (asset === undefined ? [] : [{ ...asset }])
    );
  }

  clear(): void {
    this.world.clear();
    this.blocksets.clear();
  }
}

export interface VoxelMapDocumentOptions {
  chunkSize: number;
  blocksets?: Iterable<BlocksetDefinition>;
  layer?: string;
}

export function createVoxelMapDocument(
  options: VoxelMapDocumentOptions
): Uint8Array {
  const {
    chunkSize,
    blocksets = [],
    layer = kDefaultLayerName
  } = options;

  const state = new VoxelMapState(chunkSize);
  for (const blockset of blocksets) {
    state.blocksets.add(blockset);
  }
  state.world.addLayer(layer);

  return encodeVoxelWorld(state.toJSON());
}

export interface VoxelMapAssetKindOptions {
  chunkSize?: number;
  snapshot?: SnapshotPolicy;
  conflictResolver?: ConflictResolver<VoxelMapNetworkCommand>;
}

export function voxelMapAssetKind(
  options: VoxelMapAssetKindOptions = {}
): AssetKindHandler<VoxelMapState, VoxelMapNetworkCommand> {
  const {
    chunkSize = DEFAULT_CHUNK_SIZE,
    snapshot = kDefaultSnapshot,
    conflictResolver
  } = options;

  return {
    kind: VOXEL_MAP_KIND,
    extensions: {
      [VOXEL_MAP_EXTENSION]: "application/json; charset=utf-8"
    },
    snapshot,
    companions: [
      {
        kind: BLOCKSET_KIND,
        link(state, blockset) {
          state.blocksets.add({
            id: kCompanionBlocksetId,
            asset: blocksetAsset(blockset.id)
          });
        }
      }
    ],

    create(): VoxelMapState {
      return new VoxelMapState(chunkSize);
    },

    load(
      state: VoxelMapState,
      content: Uint8Array
    ): void {
      state.load(
        decodeVoxelMapDocument(content)
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
        encodeVoxelWorld(state.toJSON())
      );
    },

    dependencies(
      state: VoxelMapState
    ) {
      return state.dependencies();
    },

    rebind(
      state: VoxelMapState,
      idMap: ReadonlyMap<string, string>
    ): void {
      state.blocksets.replace(
        state.blocksets.definitions().map((definition) => {
          const asset = definition.asset;
          if (asset === undefined) {
            return definition;
          }
          const id = idMap.get(asset.id);

          return id === undefined ? definition : {
            ...definition,
            asset: {
              ...asset,
              id
            }
          };
        })
      );
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
          arbitrate: (command) => arbiter.admit(state, command),
          correct: (command, admitted) => correctVoxelCommand(
            state,
            command,
            admitted
          ),
          restore: (command, version) => arbiter.restore(command, version),
          broadcast(command) {
            if (
              command.action === "world-replace" ||
              !landedAsSent(state, command)
            ) {
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

function decodeVoxelMapDocument(
  content: Uint8Array
): VoxelWorldJSON {
  let document: VoxelWorldJSON;
  try {
    document = decodeVoxelWorld(content);
  }
  catch (error) {
    if (!(error instanceof InvalidVoxelWorldError)) {
      throw error;
    }

    throw new InvalidAssetDocumentError(
      VOXEL_MAP_KIND,
      error.message,
      { cause: error }
    );
  }

  const result = kWorldParser.parse(document);
  if (result.err) {
    throw new InvalidAssetDocumentError(
      VOXEL_MAP_KIND,
      describeErrors(result.val)
    );
  }

  return document;
}

function landedAsSent(
  state: VoxelMapState,
  command: VoxelMapNetworkCommand
): boolean {
  if (command.action !== "blockset-added") {
    return true;
  }
  const { id, slot } = command.blockset;

  return state.blocksets.get(id)?.slot === slot;
}

export interface VoxelMapAssetKindsOptions {
  blockset?: BlocksetAssetKindOptions;
  voxelmap?: VoxelMapAssetKindOptions;
}

export const ASSET_KINDS: AssetKindPackage<VoxelMapAssetKindsOptions> = {
  descriptors: [
    BLOCKSET_ASSET,
    VOXEL_MAP_ASSET
  ],
  optionsSchema: kOptionsSchema,
  handlers: (options = {}) => [
    blocksetAssetKind(options.blockset),
    voxelMapAssetKind(options.voxelmap)
  ]
};
