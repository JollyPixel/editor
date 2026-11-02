// Import Third-party Dependencies
import {
  describeErrors,
  SchemaParser
} from "@jolly-pixel/network";
import {
  arbitrated,
  InvalidAssetFileError,
  JSON_CONTENT_TYPE,
  SNAPSHOT_POLICY_SCHEMA,
  type AssetKindHandler,
  type AssetKindPackage,
  type SnapshotPolicy
} from "@jolly-pixel/asset-server";
import {
  applyVoxelWorldCommand,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_TILE_SIZE,
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
import * as z from "zod/mini";

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
import { tileSizeSchema } from "../network/schema.ts";
import {
  voxelCommandProtocol,
  voxelWorldSchema
} from "../network/voxelMap/VoxelCommand.schema.ts";
import { VOXEL_COMMAND_RULES } from "../network/voxelMap/VoxelCommandRules.ts";
import { correctVoxelCommand } from "../network/voxelMap/VoxelCorrection.ts";
import type { VoxelMapNetworkCommand } from "../network/voxelMap/types.ts";

// CONSTANTS
const kDefaultLayerName = "Ground";
const kCompanionBlocksetId = "default";
const kWorldParser = new SchemaParser(voxelWorldSchema);
const kPositiveIntegerSchema = z.int().check(z.minimum(1));
const kOptionsSchema = z.strictObject({
  blockset: z.optional(z.strictObject({
    tileSize: z.optional(
      tileSizeSchema.check(z.meta({ default: DEFAULT_TILE_SIZE }))
    ),
    defaultSize: z.optional(z.object({
      x: kPositiveIntegerSchema,
      y: kPositiveIntegerSchema
    })),
    snapshot: z.optional(SNAPSHOT_POLICY_SCHEMA)
  })),
  voxelmap: z.optional(z.strictObject({
    chunkSize: z.optional(
      kPositiveIntegerSchema.check(z.meta({ default: DEFAULT_CHUNK_SIZE }))
    ),
    snapshot: z.optional(SNAPSHOT_POLICY_SCHEMA)
  }))
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
    file: VoxelWorldJSON
  ): void {
    deserializeVoxelWorld(file, this.world, {
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

export interface VoxelMapFileOptions {
  chunkSize: number;
  blocksets?: Iterable<BlocksetDefinition>;
  layer?: string;
}

export function createVoxelMapFile(
  options: VoxelMapFileOptions
): VoxelWorldJSON {
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

  return state.toJSON();
}

export interface VoxelMapAssetKindOptions {
  chunkSize?: number;
  snapshot?: SnapshotPolicy;
}

export function voxelMapAssetKind(
  options: VoxelMapAssetKindOptions = {}
): AssetKindHandler<VoxelMapState, VoxelMapNetworkCommand> {
  const {
    chunkSize = DEFAULT_CHUNK_SIZE,
    snapshot = kDefaultSnapshot
  } = options;

  return {
    kind: VOXEL_MAP_KIND,
    extensions: {
      [VOXEL_MAP_EXTENSION]: JSON_CONTENT_TYPE
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
        decodeVoxelMapFile(content)
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
        return {
          snapshotSchema: voxelWorldSchema,
          snapshot: () => state.toJSON(),
          ...arbitrated(state, VOXEL_COMMAND_RULES),
          correct: (command, admitted) => correctVoxelCommand(
            state,
            command,
            admitted
          ),
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

function decodeVoxelMapFile(
  content: Uint8Array
): VoxelWorldJSON {
  let file: VoxelWorldJSON;
  try {
    file = decodeVoxelWorld(content);
  }
  catch (error) {
    if (!(error instanceof InvalidVoxelWorldError)) {
      throw error;
    }

    throw new InvalidAssetFileError(
      VOXEL_MAP_KIND,
      error.message,
      { cause: error }
    );
  }

  const result = kWorldParser.parse(file);
  if (result.err) {
    throw new InvalidAssetFileError(
      VOXEL_MAP_KIND,
      describeErrors(result.val)
    );
  }

  return file;
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
