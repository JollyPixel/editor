// Import Third-party Dependencies
import type { Infer } from "@jolly-pixel/network";
import {
  arbitrated,
  InvalidAssetFileError,
  JSON_CONTENT_TYPE,
  JsonAssetFile,
  type AssetKindHandler,
  type SnapshotPolicy
} from "@jolly-pixel/asset-server";
import { PixelArtState } from "@jolly-pixel/asset.pixel-art";
import {
  applyPixelCommand,
  correctPixelCommand,
  encodePixelSnapshot,
  isPixelCommand
} from "@jolly-pixel/asset.pixel-art/server";
import {
  parsePixelArtFile,
  pixelArtSnapshot,
  type PixelArtFile,
  type PixelDocumentState,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";
import {
  DEFAULT_TILE_SIZE,
  BlocksetDocument,
  type BlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  BLOCKSET_COMMAND,
  BLOCKSET_FILE_VERSION,
  BLOCKSET_EXTENSION,
  BLOCKSET_KIND,
  type BlocksetFile
} from "./blockset.ts";
import { blocksetFileSchema } from "./blocksetFile.schema.ts";
import {
  blocksetCommandProtocol,
  blocksetSnapshotSchema
} from "../network/blockset/BlocksetCommand.schema.ts";
import { BLOCKSET_COMMAND_RULES } from "../network/blockset/BlocksetCommandRules.ts";
import type {
  BlocksetNetworkCommand,
  BlocksetSnapshot
} from "../network/blockset/types.ts";

// CONSTANTS
const kDefaultGridSize = 8;

export const BLOCKSET_FILE = new JsonAssetFile({
  kind: BLOCKSET_KIND,
  schema: blocksetFileSchema,
  expand: expandBlocksetFile,
  compact: (file) => {
    return {
      ...file,
      pixels: { ...file.pixels }
    };
  }
});

function expandBlocksetFile(
  stored: Infer<typeof blocksetFileSchema>
): BlocksetFile {
  let pixels: PixelArtFile;
  try {
    pixels = parsePixelArtFile(stored.pixels);
  }
  catch (error) {
    throw new InvalidAssetFileError(
      BLOCKSET_KIND,
      "pixels are invalid",
      { cause: error }
    );
  }

  let document: BlocksetDocument;
  try {
    document = new BlocksetDocument({
      tileSize: stored.tileSize,
      blocks: stored.blocks as BlockDefinition[],
      materialGroups: stored.materialGroups
    });
  }
  catch (error) {
    throw new InvalidAssetFileError(
      BLOCKSET_KIND,
      "blocks are invalid",
      { cause: error }
    );
  }

  return {
    version: BLOCKSET_FILE_VERSION,
    pixels,
    ...document.toJSON()
  };
}

export interface BlocksetStateOptions {
  size: Vec2;
  tileSize: number;
}

export class BlocksetState {
  readonly document: BlocksetDocument;

  #pixelArt: PixelArtState;

  constructor(
    options: BlocksetStateOptions
  ) {
    this.#pixelArt = new PixelArtState(options.size);
    this.document = new BlocksetDocument({
      tileSize: options.tileSize
    });
  }

  get pixels(): PixelDocumentState {
    return this.#pixelArt.document;
  }

  toJSON(): BlocksetFile {
    return {
      version: BLOCKSET_FILE_VERSION,
      pixels: this.#pixelArt.toJSON(),
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
    const blockset = this.document.toJSON();

    return {
      pixels: await encodePixelSnapshot(this.pixels),
      ...blockset
    };
  }

  load(
    file: BlocksetFile
  ): void {
    this.document.load({
      tileSize: file.tileSize,
      blocks: file.blocks,
      materialGroups: file.materialGroups
    });
    this.#pixelArt.load(file.pixels);
  }

  applyCommand(
    command: BlocksetNetworkCommand
  ): void {
    if (isPixelCommand(command)) {
      applyPixelCommand(this.pixels, command);

      return;
    }

    this.document.applyCommand(command, { origin: "remote" });
  }

  clear(): void {
    this.#pixelArt.clear();
    this.document.clear(this.document.tileSize);
  }
}

export interface BlocksetAssetKindOptions {
  tileSize?: number;
  defaultSize?: Vec2;
  snapshot?: SnapshotPolicy;
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
    snapshot
  } = options;

  return {
    kind: BLOCKSET_KIND,
    extensions: {
      [BLOCKSET_EXTENSION]: JSON_CONTENT_TYPE
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
      BLOCKSET_FILE.load(content, (file) => state.load(file));
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
        BLOCKSET_FILE.encode(state.toJSON())
      );
    },

    commands: {
      eventType: BLOCKSET_COMMAND,
      protocol: blocksetCommandProtocol,

      apply(state, command) {
        state.applyCommand(command);
      },

      live({ state }) {
        return {
          snapshotSchema: blocksetSnapshotSchema,
          snapshot: () => state.snapshot(),
          encodeSnapshot: () => state.encodeSnapshot(),
          ...arbitrated(state, BLOCKSET_COMMAND_RULES),
          correct: (command, admitted) => correctBlocksetCommand(
            state,
            command,
            admitted
          )
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
