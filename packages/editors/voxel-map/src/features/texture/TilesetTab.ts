// Import Third-party Dependencies
import type {
  TilesetDocumentListener,
  VoxelView
} from "@jolly-pixel/voxel.renderer";
import { PixelCollaboration } from "@jolly-pixel/asset.pixel-art/client";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";
import {
  peerProfileColor,
  readUsername
} from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type { MapDocument } from "../../document/index.ts";
import type { BrushStore } from "../../state/index.ts";
import type {
  BlockWriter,
  TilesetBinding
} from "../tilesets/TilesetBinding.ts";
import { BlockUvBridge } from "./bridge/BlockUvBridge.ts";

export interface TilesetTabOptions {
  canvas: PixelArtCanvas;
  engine: VoxelView;
  binding: TilesetBinding;
  blocks: BlockWriter;
  brush: BrushStore;
  mapDocument: MapDocument;
}

export class TilesetTab {
  readonly binding: TilesetBinding;
  readonly #uvBridge: BlockUvBridge;
  readonly #collaboration: PixelCollaboration;

  readonly #onTilesetCommand: TilesetDocumentListener = (command) => {
    if (command.action === "tile-size-updated") {
      this.#apply();
    }
  };

  readonly #onTilesetLoaded = (): void => {
    this.#apply();
  };

  constructor(
    options: TilesetTabOptions
  ) {
    const { canvas, engine, binding } = options;

    this.binding = binding;
    this.#collaboration = new PixelCollaboration({
      room: binding.opened.room,
      canvas,
      label: (_clientId, profile) => readUsername(profile),
      color: peerProfileColor
    });
    this.#uvBridge = new BlockUvBridge(canvas.uv, engine, {
      runLocalRestore: (fn) => canvas.runLocalRestore(fn),
      brush: options.brush,
      mapDocument: options.mapDocument,
      blocks: options.blocks
    });
    binding.opened.tileset.on("command", this.#onTilesetCommand);
    binding.opened.tileset.on("loaded", this.#onTilesetLoaded);
    this.#apply();
  }

  dispose(): void {
    this.binding.opened.tileset.off("command", this.#onTilesetCommand);
    this.binding.opened.tileset.off("loaded", this.#onTilesetLoaded);
    this.#uvBridge.dispose();
    this.#collaboration.destroy();
  }

  #apply(): void {
    this.#uvBridge.setActiveTileset(
      this.binding.definition.id,
      this.binding.opened.tileset.tileSize
    );
  }
}
