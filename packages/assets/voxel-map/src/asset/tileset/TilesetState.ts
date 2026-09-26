// Import Third-party Dependencies
import { applyCommandToBuffer } from "@jolly-pixel/asset.pixel-art/network/server.ts";
import {
  deserializePixelBuffer,
  pixelArtSnapshot,
  PixelBuffer,
  serializePixelBuffer,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";
import { TilesetDocument } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  TILESET_DOCUMENT_VERSION,
  type TilesetAssetDocument
} from "./document.ts";
import {
  isPixelNetworkCommand,
  type TilesetNetworkCommand,
  type TilesetSnapshot
} from "../../network/tileset/types.ts";

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
