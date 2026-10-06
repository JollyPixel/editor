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
import {
  applyPixelCommand,
  correctPixelCommand,
  encodePixelSnapshot,
  isPixelCommand
} from "@jolly-pixel/asset.pixel-art/server";
import {
  deserializePixelDocument,
  parsePixelArtDocument,
  pixelArtSnapshot,
  PixelBuffer,
  PixelDocumentState,
  serializePixelDocument,
  type PixelArtDocumentData,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";
import {
  DEFAULT_TILE_SIZE,
  BlocksetDocument,
  type BlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  encodeBlocksetDocument,
  BLOCKSET_COMMAND,
  BLOCKSET_DOCUMENT_VERSION,
  BLOCKSET_EXTENSION,
  BLOCKSET_KIND,
  type BlocksetAssetDocument
} from "./blockset.ts";
import { tileSizeSchema } from "../network/schema.ts";
import {
  materialGroupSchema,
  blocksetCommandProtocol,
  blocksetSnapshotSchema
} from "../network/blockset/BlocksetCommand.schema.ts";
import { BlocksetCommandArbiter } from "../network/blockset/BlocksetCommandArbiter.ts";
import type {
  BlocksetNetworkCommand,
  BlocksetSnapshot
} from "../network/blockset/types.ts";

// CONSTANTS
const kDefaultGridSize = 8;
const kDocumentParser = new SchemaParser(defineSchema({
  type: "object",
  properties: {
    version: { const: BLOCKSET_DOCUMENT_VERSION },
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

export function parseBlocksetDocument(
  value: unknown
): BlocksetAssetDocument {
  const result = kDocumentParser.parse(value);
  if (result.err) {
    throw new InvalidAssetDocumentError(
      BLOCKSET_KIND,
      describeErrors(result.val)
    );
  }

  let pixels: PixelArtDocumentData;
  try {
    pixels = parsePixelArtDocument(result.val.pixels);
  }
  catch (error) {
    throw new InvalidAssetDocumentError(
      BLOCKSET_KIND,
      "pixels are invalid",
      { cause: error }
    );
  }

  let document: BlocksetDocument;
  try {
    document = new BlocksetDocument({
      tileSize: result.val.tileSize,
      blocks: result.val.blocks as BlockDefinition[],
      materialGroups: result.val.materialGroups
    });
  }
  catch (error) {
    throw new InvalidAssetDocumentError(
      BLOCKSET_KIND,
      "blocks are invalid",
      { cause: error }
    );
  }

  return {
    version: BLOCKSET_DOCUMENT_VERSION,
    pixels,
    ...document.toJSON()
  };
}

export function decodeBlocksetDocument(
  content: Uint8Array
): BlocksetAssetDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(content));
  }
  catch (error) {
    throw new InvalidAssetDocumentError(
      BLOCKSET_KIND,
      "payload is not JSON",
      { cause: error }
    );
  }

  return parseBlocksetDocument(parsed);
}

export interface BlocksetStateOptions {
  size: Vec2;
  tileSize: number;
}

export class BlocksetState {
  readonly pixels: PixelDocumentState;
  readonly document: BlocksetDocument;

  constructor(
    options: BlocksetStateOptions
  ) {
    this.pixels = new PixelDocumentState({
      buffer: new PixelBuffer({
        size: options.size
      })
    });
    this.document = new BlocksetDocument({
      tileSize: options.tileSize
    });
  }

  toJSON(): BlocksetAssetDocument {
    return {
      version: BLOCKSET_DOCUMENT_VERSION,
      pixels: serializePixelDocument(this.pixels),
      ...this.document.toJSON()
    };
  }

  snapshot(): BlocksetSnapshot {
    return {
      pixels: pixelArtSnapshot(this.pixels),
      ...this.document.toJSON()
    };
  }

  async encodeSnapshot(): Promise<BlocksetSnapshot> {
    const document = this.document.toJSON();

    return {
      pixels: await encodePixelSnapshot(this.pixels),
      ...document
    };
  }

  load(
    document: BlocksetAssetDocument
  ): void {
    this.document.load({
      tileSize: document.tileSize,
      blocks: document.blocks,
      materialGroups: document.materialGroups
    });
    deserializePixelDocument(document.pixels, this.pixels);
  }

  applyCommand(
    command: BlocksetNetworkCommand
  ): void {
    if (isPixelCommand(command)) {
      applyPixelCommand(this.pixels, command);

      return;
    }

    this.document.apply(command, { origin: "remote" });
  }

  clear(): void {
    const size = this.pixels.buffer.size();

    this.pixels.load({
      size,
      pixels: new Uint8ClampedArray(size.x * size.y * 4)
    });
    this.document.clear(this.document.tileSize);
  }
}

export interface BlocksetAssetKindOptions {
  tileSize?: number;
  defaultSize?: Vec2;
  snapshot?: SnapshotPolicy;
  conflictResolver?: ConflictResolver;
}

export function blocksetAssetKind(
  options: BlocksetAssetKindOptions = {}
): AssetKindHandler<BlocksetState, BlocksetNetworkCommand> {
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
    kind: BLOCKSET_KIND,
    extensions: {
      [BLOCKSET_EXTENSION]: "application/json; charset=utf-8"
    },
    snapshot,

    create(): BlocksetState {
      return new BlocksetState({
        size: defaultSize,
        tileSize
      });
    },

    load(
      state: BlocksetState,
      content: Uint8Array
    ): void {
      state.load(
        decodeBlocksetDocument(content)
      );
    },

    clear(
      state: BlocksetState
    ): void {
      state.clear();
    },

    serialize(
      state: BlocksetState
    ): Promise<Uint8Array> {
      return Promise.resolve(
        encodeBlocksetDocument(state.toJSON())
      );
    },

    commands: {
      eventType: BLOCKSET_COMMAND,
      protocol: blocksetCommandProtocol,

      apply(state, command) {
        state.applyCommand(command);
      },

      live({ state }) {
        const arbiter = new BlocksetCommandArbiter({
          conflictResolver
        });

        return {
          snapshotSchema: blocksetSnapshotSchema,
          snapshot: () => state.snapshot(),
          encodeSnapshot: () => state.encodeSnapshot(),
          arbitrate: (command) => arbiter.admit(state, command),
          correct: (command, admitted) => correctBlocksetCommand(
            state,
            command,
            admitted
          ),
          restore: (command, version) => arbiter.restore(command, version)
        };
      }
    }
  };
}

function correctBlocksetCommand(
  state: BlocksetState,
  command: BlocksetNetworkCommand,
  admitted: BlocksetNetworkCommand | null
): BlocksetNetworkCommand | null {
  if (!isPixelCommand(command)) {
    return null;
  }

  return correctPixelCommand(
    state.pixels.buffer,
    command,
    admitted !== null && isPixelCommand(admitted) ? admitted : null
  );
}
