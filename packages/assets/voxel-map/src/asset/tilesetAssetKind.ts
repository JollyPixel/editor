// Import Third-party Dependencies
import {
  defineSchema,
  describeErrors,
  SchemaParser,
  type ConflictResolver
} from "@jolly-pixel/network";
import {
  InvalidAssetDocumentError,
  type AssetKindHandler,
  type SnapshotPolicy
} from "@jolly-pixel/asset-server";
import { applyCommandToBuffer } from "@jolly-pixel/asset.pixel-art/server";
import {
  deserializePixelBuffer,
  parsePixelArtDocument,
  pixelArtSnapshot,
  PixelBuffer,
  serializePixelBuffer,
  type PixelArtDocumentData,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";
import {
  DEFAULT_TILE_SIZE,
  TilesetDocument,
  type BlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  encodeTilesetDocument,
  TILESET_COMMAND,
  TILESET_DOCUMENT_VERSION,
  TILESET_EXTENSION,
  TILESET_KIND,
  type TilesetAssetDocument
} from "./tileset.ts";
import { tileSizeSchema } from "../network/schema.ts";
import {
  materialGroupSchema,
  tilesetCommandProtocol,
  tilesetSnapshotSchema
} from "../network/tileset/TilesetCommand.schema.ts";
import { TilesetCommandArbiter } from "../network/tileset/TilesetCommandArbiter.ts";
import {
  isPixelNetworkCommand,
  type TilesetNetworkCommand,
  type TilesetSnapshot
} from "../network/tileset/types.ts";

// CONSTANTS
const kDefaultGridSize = 8;
const kDocumentParser = new SchemaParser(defineSchema({
  type: "object",
  properties: {
    version: { const: TILESET_DOCUMENT_VERSION },
    tileSize: tileSizeSchema,
    pixels: { type: "object" },
    blocks: { type: "array" },
    materialGroups: {
      type: "array",
      items: materialGroupSchema
    }
  },
  required: [
    "version",
    "tileSize",
    "pixels",
    "blocks",
    "materialGroups"
  ]
}));

export function parseTilesetDocument(
  value: unknown
): TilesetAssetDocument {
  const result = kDocumentParser.parse(value);
  if (result.err) {
    throw new InvalidAssetDocumentError(
      TILESET_KIND,
      describeErrors(result.val)
    );
  }

  let pixels: PixelArtDocumentData;
  try {
    pixels = parsePixelArtDocument(result.val.pixels);
  }
  catch (error) {
    throw new InvalidAssetDocumentError(
      TILESET_KIND,
      "pixels are invalid",
      { cause: error }
    );
  }

  let document: TilesetDocument;
  try {
    document = new TilesetDocument({
      tileSize: result.val.tileSize,
      blocks: result.val.blocks as BlockDefinition[],
      materialGroups: result.val.materialGroups
    });
  }
  catch (error) {
    throw new InvalidAssetDocumentError(
      TILESET_KIND,
      "blocks are invalid",
      { cause: error }
    );
  }

  return {
    version: TILESET_DOCUMENT_VERSION,
    pixels,
    ...document.toJSON()
  };
}

export function decodeTilesetDocument(
  content: Uint8Array
): TilesetAssetDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(content));
  }
  catch (error) {
    throw new InvalidAssetDocumentError(
      TILESET_KIND,
      "payload is not JSON",
      { cause: error }
    );
  }

  return parseTilesetDocument(parsed);
}

export interface TilesetStateOptions {
  size: Vec2;
  tileSize: number;
}

/**
 * The server's headless tileset: its pixel buffer and its tileset document.
 */
export class TilesetState {
  readonly pixels: PixelBuffer;
  readonly document: TilesetDocument;

  #defaultSize: Vec2;
  #defaultTileSize: number;

  constructor(
    options: TilesetStateOptions
  ) {
    this.#defaultSize = { ...options.size };
    this.#defaultTileSize = options.tileSize;
    this.pixels = new PixelBuffer({
      size: options.size
    });
    this.document = new TilesetDocument({
      tileSize: options.tileSize
    });
  }

  toJSON(): TilesetAssetDocument {
    return {
      version: TILESET_DOCUMENT_VERSION,
      pixels: serializePixelBuffer(this.pixels),
      ...this.document.toJSON()
    };
  }

  snapshot(): TilesetSnapshot {
    return {
      pixels: pixelArtSnapshot(this.pixels),
      ...this.document.toJSON()
    };
  }

  load(
    document: TilesetAssetDocument
  ): void {
    this.document.load({
      tileSize: document.tileSize,
      blocks: document.blocks,
      materialGroups: document.materialGroups
    });
    deserializePixelBuffer(document.pixels, this.pixels);
  }

  applyCommand(
    command: TilesetNetworkCommand
  ): void {
    if (isPixelNetworkCommand(command)) {
      applyCommandToBuffer(this.pixels, command);

      return;
    }

    this.document.apply(command, { origin: "remote" });
  }

  clear(): void {
    const { x, y } = this.#defaultSize;

    this.pixels.replacePixels(
      new Uint8ClampedArray(x * y * 4),
      this.#defaultSize
    );
    this.pixels.uvRegions.clear();
    this.document.clear(this.#defaultTileSize);
  }
}

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
  conflictResolver?: ConflictResolver;
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
