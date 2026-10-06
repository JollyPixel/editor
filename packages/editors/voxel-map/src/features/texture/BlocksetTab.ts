// Import Third-party Dependencies
import type {
  BlocksetDocumentListener,
  VoxelView
} from "@jolly-pixel/voxel.renderer";
import { PixelCollaboration } from "@jolly-pixel/asset.pixel-art/client";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";
import {
  peerProfileColor,
  readUsername
} from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type { MapDocument } from "../../document/MapDocument.ts";
import type { BlockSelection } from "../../state/index.ts";
import type {
  BlockWriter,
  BlocksetBinding
} from "../blocksets/BlocksetBinding.ts";
import { BlockUvBridge } from "./bridge/BlockUvBridge.ts";

export interface BlocksetTabOptions {
  canvas: PixelArtCanvas;
  view: VoxelView;
  binding: BlocksetBinding;
  blocks: BlockWriter;
  block: BlockSelection;
  mapDocument: MapDocument;
}

export class BlocksetTab {
  readonly binding: BlocksetBinding;
  readonly #uvBridge: BlockUvBridge;
  readonly #collaboration: PixelCollaboration;

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
    this.#collaboration = new PixelCollaboration({
      room: binding.opened.room,
      canvas,
      label: (_clientId, profile) => readUsername(profile),
      color: peerProfileColor
    });
    this.#uvBridge = new BlockUvBridge(canvas.uv, view, {
      runLocalRestore: (fn) => canvas.document.runLocalRestore(fn),
      block: options.block,
      mapDocument: options.mapDocument,
      blocks: options.blocks
    });
    binding.opened.blockset.on("command", this.#onBlocksetCommand);
    binding.opened.blockset.on("loaded", this.#onBlocksetLoaded);
    this.#apply();
  }

  dispose(): void {
    this.binding.opened.blockset.off("command", this.#onBlocksetCommand);
    this.binding.opened.blockset.off("loaded", this.#onBlocksetLoaded);
    this.#uvBridge.dispose();
    this.#collaboration.destroy();
  }

  #apply(): void {
    this.#uvBridge.setActiveBlockset(
      this.binding.slot,
      this.binding.opened.blockset.tileSize
    );
  }
}
