// Import Third-party Dependencies
import type {
  TilesetDefinition,
  TilesetDocumentListener,
  VoxelEngine
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
import { BlockUvBridge } from "./bridge/BlockUvBridge.ts";
import type {
  BlockWriter,
  LinkedTileset
} from "../tilesets/LinkedTilesets.ts";

export interface TilesetTabOptions {
  canvas: PixelArtCanvas;
  engine: VoxelEngine;
  linked: LinkedTileset;
  assetId: string | null;
  blocks: BlockWriter;
  brush: BrushStore;
  mapDocument: MapDocument;
}

export class TilesetTab {
  readonly canvas: PixelArtCanvas;
  readonly assetId: string | null;
  readonly #linked: LinkedTileset;
  readonly #uvBridge: BlockUvBridge;
  readonly #collaboration: PixelCollaboration;
  #definition: TilesetDefinition;

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
    const { canvas, engine, linked } = options;

    this.canvas = canvas;
    this.assetId = options.assetId;
    this.#linked = linked;
    this.#definition = linked.definition;
    this.#collaboration = new PixelCollaboration({
      room: linked.opened.room,
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
    linked.opened.tileset.on("command", this.#onTilesetCommand);
    linked.opened.tileset.on("loaded", this.#onTilesetLoaded);
    this.#apply();
  }

  get definition(): TilesetDefinition {
    return this.#definition;
  }

  update(
    definition: TilesetDefinition
  ): void {
    this.#definition = definition;
    this.#apply();
  }

  dispose(): void {
    this.#linked.opened.tileset.off("command", this.#onTilesetCommand);
    this.#linked.opened.tileset.off("loaded", this.#onTilesetLoaded);
    this.#uvBridge.dispose();
    this.#collaboration.destroy();
  }

  #apply(): void {
    this.#uvBridge.setActiveTileset(
      this.#definition.id,
      this.#linked.opened.tileset.tileSize
    );
  }
}
