// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type {
  AssetKindHandler,
  SnapshotPolicy
} from "@jolly-pixel/asset-server/kinds";
import type { Vec2 } from "@jolly-pixel/pixel-draw.renderer";
import { DEFAULT_TILE_SIZE } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  decodeTilesetDocument,
  encodeTilesetDocument
} from "./document.ts";
import {
  TILESET_COMMAND,
  TILESET_EXTENSION,
  TILESET_KIND
} from "./kind.ts";
import { TilesetState } from "./TilesetState.ts";
import {
  tilesetCommandProtocol,
  tilesetSnapshotSchema
} from "../../network/tileset/TilesetCommand.schema.ts";
import {
  TilesetCommandArbiter
} from "../../network/tileset/TilesetCommandArbiter.ts";
import type { TilesetNetworkCommand } from "../../network/tileset/types.ts";

// CONSTANTS
const kDefaultGridSize = 8;

export interface TilesetAssetKindOptions {
  /**
   * Tile size of a tileset created without content.
   * @default 32
   */
  tileSize?: number;
  /**
   * Pixel size of a tileset created without content.
   * @default 8 by 8 tiles
   */
  defaultSize?: Vec2;
  snapshot?: SnapshotPolicy;
  conflictResolver?: network.ConflictResolver;
}

export function tilesetAssetKind(
  options: TilesetAssetKindOptions = {}
): AssetKindHandler<TilesetState, TilesetNetworkCommand> {
  const {
    tileSize = DEFAULT_TILE_SIZE,
    defaultSize = {
      x: kDefaultGridSize * tileSize,
      y: kDefaultGridSize * tileSize
    },
    snapshot,
    conflictResolver
  } = options;

  return {
    kind: TILESET_KIND,
    extensions: {
      [TILESET_EXTENSION]: "application/json; charset=utf-8"
    },
    snapshot,

    create(): TilesetState {
      return new TilesetState({
        size: defaultSize,
        tileSize
      });
    },

    load(
      state: TilesetState,
      content: Uint8Array
    ): void {
      state.load(
        decodeTilesetDocument(content)
      );
    },

    clear(
      state: TilesetState
    ): void {
      state.clear();
    },

    serialize(
      state: TilesetState
    ): Promise<Uint8Array> {
      return Promise.resolve(
        encodeTilesetDocument(state.toJSON())
      );
    },

    commands: {
      eventType: TILESET_COMMAND,
      protocol: tilesetCommandProtocol,

      apply(state, command) {
        state.applyCommand(command);
      },

      live({ state }) {
        const arbiter = new TilesetCommandArbiter({
          conflictResolver
        });

        return {
          snapshotSchema: tilesetSnapshotSchema,
          snapshot: () => state.snapshot(),
          arbitrate: (command) => arbiter.admit(state, command)
        };
      }
    }
  };
}
