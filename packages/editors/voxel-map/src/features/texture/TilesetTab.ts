// Import Third-party Dependencies
import type {
  TilesetDefinition,
  VoxelEngine
} from "@jolly-pixel/voxel.renderer";
import { PixelCollaboration } from "@jolly-pixel/asset.pixel-art/network/client.ts";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";
import {
  peerProfileColor,
  readUsername
} from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type { MapDocument } from "../../document/index.ts";
import {
  definitionsEqual,
  type BrushStore
} from "../../state/index.ts";
import { BlockUvBridge } from "./bridge/BlockUvBridge.ts";
import type { TilesetTexture } from "../tilesets/TilesetTextures.ts";

export interface TilesetTabOptions {
  canvas: PixelArtCanvas;
  engine: VoxelEngine;
  definition: TilesetDefinition;
  assetId: string | null;
  texture: TilesetTexture;
  brush: BrushStore;
  mapDocument: MapDocument;
}

export class TilesetTab {
  readonly canvas: PixelArtCanvas;
  readonly assetId: string | null;
  readonly #texture: TilesetTexture;
  readonly #uvBridge: BlockUvBridge;
  readonly #collaboration: PixelCollaboration | null;
  #definition: TilesetDefinition;

  constructor(
    options: TilesetTabOptions
  ) {
    const { canvas, engine, definition, texture } = options;

    this.canvas = canvas;
    this.assetId = options.assetId;
    this.#texture = texture;
    this.#definition = definition;
    this.#collaboration = texture.room === undefined ?
      null :
      new PixelCollaboration({
        room: texture.room,
        canvas,
        label: (_clientId, profile) => readUsername(profile),
        color: peerProfileColor
      });
    this.#uvBridge = new BlockUvBridge(canvas.uv, engine, {
      runLocalRestore: (fn) => canvas.runLocalRestore(fn),
      brush: options.brush,
      mapDocument: options.mapDocument
    });
    this.#apply();
  }

  get definition(): TilesetDefinition {
    return this.#definition;
  }

  update(
    definition: TilesetDefinition
  ): void {
    if (definitionsEqual(definition, this.#definition)) {
      return;
    }

    this.#definition = definition;
    this.#apply();
  }

  dispose(): void {
    this.#uvBridge.dispose();
    this.#collaboration?.destroy();
    this.#texture.release();
  }

  #apply(): void {
    this.#uvBridge.setActiveTileset(
      this.#definition.id,
      this.#definition.tileSize
    );
  }
}
