// Import Third-party Dependencies
import type {
  BlocksetDocumentListener,
  VoxelView
} from "@jolly-pixel/voxel.renderer";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";
import {
  TextureRoom,
  type AccessPanel
} from "@jolly-pixel/editor.pixel-art";

// Import Internal Dependencies
import type { MapDocument } from "../../document/MapDocument.ts";
import type {
  BlockSelection,
  UvSyncStore
} from "../../state/index.ts";
import type {
  BlockWriter,
  BlocksetBinding
} from "../blocksets/BlocksetBinding.ts";
import { BlockUvBridge } from "./bridge/BlockUvBridge.ts";

export interface BlocksetTabOptions {
  panel: AccessPanel;
  canvas: PixelArtCanvas;
  view: VoxelView;
  binding: BlocksetBinding;
  blocks: BlockWriter;
  block: BlockSelection;
  uvSync: UvSyncStore;
  mapDocument: MapDocument;
}

export class BlocksetTab {
  readonly binding: BlocksetBinding;
  readonly #canvas: PixelArtCanvas;
  readonly #uvBridge: BlockUvBridge;
  readonly #room: TextureRoom;

  readonly #onBlocksetCommand: BlocksetDocumentListener = (command) => {
    if (command.action === "tile-size-updated") {
      this.#apply();
    }
  };

  readonly #onBlocksetLoaded = (): void => {
    this.#apply();
  };

  constructor(
    options: BlocksetTabOptions
  ) {
    const { canvas, view, binding } = options;

    this.binding = binding;
    this.#canvas = canvas;
    this.#room = new TextureRoom({
      room: binding.opened.room,
      canvas,
      panel: options.panel,
      textureId: binding.definition.id
    });
    this.#uvBridge = new BlockUvBridge(canvas.uv, view, {
      runLocalRestore: (fn) => canvas.document.runLocalRestore(fn),
      block: options.block,
      mapDocument: options.mapDocument,
      blocks: options.blocks,
      uvSync: options.uvSync
    });
    binding.opened.blockset.on("command", this.#onBlocksetCommand);
    binding.opened.blockset.on("loaded", this.#onBlocksetLoaded);
    this.#apply();
  }

  dispose(): void {
    this.binding.opened.blockset.off("command", this.#onBlocksetCommand);
    this.binding.opened.blockset.off("loaded", this.#onBlocksetLoaded);
    this.#uvBridge.dispose();
    this.#room.dispose();
  }

  #apply(): void {
    const { tileSize } = this.binding.opened.blockset;
    this.#canvas.grid.size = tileSize;
    this.#uvBridge.activateBlockset(
      this.binding.slot,
      tileSize
    );
  }
}
