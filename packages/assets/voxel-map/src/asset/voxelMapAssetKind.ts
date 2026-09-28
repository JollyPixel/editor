// Import Third-party Dependencies
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
import {
  applyVoxelWorldCommand,
  DEFAULT_CHUNK_SIZE,
  decodeVoxelWorld,
  deserializeVoxelWorld,
  encodeVoxelWorld,
  InvalidVoxelWorldError,
  parseVoxelWorld,
  serializeVoxelWorld,
  TilesetList,
  VoxelWorld,
  type TilesetAssetReference,
  type TilesetDefinition,
  type VoxelWorldCommandTarget,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  VOXEL_MAP_COMMAND,
  VOXEL_MAP_EXTENSION,
  VOXEL_MAP_KIND
} from "./voxelMap.ts";
import {
  voxelCommandProtocol,
  voxelWorldSchema
} from "../network/VoxelCommand.schema.ts";
import { VoxelCommandArbiter } from "../network/VoxelCommandArbiter.ts";
import type { VoxelMapNetworkCommand } from "../network/types.ts";

// CONSTANTS
const kDefaultLayerName = "Ground";
const kWorldParser = new SchemaParser(voxelWorldSchema);
const kDefaultSnapshot: SnapshotPolicy = {
  delay: 5_000,
  maxDelay: 60_000
};

export class VoxelMapState implements VoxelWorldCommandTarget {
  readonly world: VoxelWorld;
  readonly tilesets = new TilesetList();

  constructor(
    chunkSize: number
  ) {
    this.world = new VoxelWorld(chunkSize);
  }

  toJSON(): VoxelWorldJSON {
    return serializeVoxelWorld(this.world, {
      tilesets: this.tilesets
    });
  }

  load(
    document: VoxelWorldJSON
  ): void {
    deserializeVoxelWorld(document, this.world, {
      tilesets: this.tilesets
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

  dependencies(): TilesetAssetReference[] {
    return [...this.tilesets].flatMap(
      ({ asset }) => (asset === undefined ? [] : [{ ...asset }])
    );
  }

  clear(): void {
    this.world.clear();
    this.tilesets.clear();
  }
}

export interface VoxelMapDocumentOptions {
  chunkSize: number;
  tilesets?: Iterable<TilesetDefinition>;
  layer?: string;
}

export function createVoxelMapDocument(
  options: VoxelMapDocumentOptions
): Uint8Array {
  const {
    chunkSize,
    tilesets = [],
    layer = kDefaultLayerName
  } = options;

  const state = new VoxelMapState(chunkSize);
  for (const tileset of tilesets) {
    state.tilesets.add(tileset);
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
      state.tilesets.replace(
        state.tilesets.definitions().map((definition) => {
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
  if (command.action !== "tileset-added") {
    return true;
  }
  const { id, slot } = command.tileset;

  return state.tilesets.get(id)?.slot === slot;
}
