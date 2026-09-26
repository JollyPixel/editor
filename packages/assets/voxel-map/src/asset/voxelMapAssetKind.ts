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
} from "@jolly-pixel/asset-server/kinds";
import {
  applyVoxelWorldCommand,
  DEFAULT_CHUNK_SIZE,
  deserializeVoxelWorld,
  encodeVoxelDocument,
  parseVoxelDocument,
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
import type { VoxelNetworkCommand } from "../network/types.ts";

// CONSTANTS
const kDefaultLayerName = "Ground";
const kWorldParser = new SchemaParser(voxelWorldSchema);
/**
 * Uses a slower snapshot cadence for bursty, expensive terrain serialization.
 */
const kDefaultSnapshot: SnapshotPolicy = {
  delay: 5_000,
  maxDelay: 60_000
};

/**
 * The server's headless world: its layers and its tileset links.
 */
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
    command: VoxelNetworkCommand
  ): void {
    switch (command.action) {
      case "world-replace":
        this.load(
          parseVoxelDocument(command.data)
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
  /**
   * Tileset links declared in order; each receives the first free slot.
   */
  tilesets?: Iterable<TilesetDefinition>;
  /**
   * @default "Ground"
   */
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

  return encodeVoxelDocument(state.toJSON());
}

export interface VoxelMapAssetKindOptions {
  /**
   * Chunk size of the server-side world. A document saved with another size
   * is re-partitioned on load and saved back with this one.
   * @default 16
   */
  chunkSize?: number;
  /**
   * @default 5s quiet period, 60s maximum
   */
  snapshot?: SnapshotPolicy;
  conflictResolver?: ConflictResolver<VoxelNetworkCommand>;
}

export function voxelMapAssetKind(
  options: VoxelMapAssetKindOptions = {}
): AssetKindHandler<VoxelMapState, VoxelNetworkCommand> {
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
        encodeVoxelDocument(state.toJSON())
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
          arbitrate: (command) => arbiter.admit(command),
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
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(content));
  }
  catch (error) {
    throw new InvalidAssetDocumentError(
      VOXEL_MAP_KIND,
      "payload is not JSON",
      { cause: error }
    );
  }

  const result = kWorldParser.parse(parsed);
  if (result.err) {
    throw new InvalidAssetDocumentError(
      VOXEL_MAP_KIND,
      describeErrors(result.val)
    );
  }

  return parseVoxelDocument(result.val);
}

function landedAsSent(
  state: VoxelMapState,
  command: VoxelNetworkCommand
): boolean {
  if (command.action !== "tileset-added") {
    return true;
  }
  const { id, slot } = command.tileset;

  return state.tilesets.get(id)?.slot === slot;
}
