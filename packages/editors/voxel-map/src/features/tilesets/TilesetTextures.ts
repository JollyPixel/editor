// Import Third-party Dependencies
import { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";
import type { VoxelEngine } from "@jolly-pixel/voxel.renderer";
import {
  pixelArtDocumentKind,
  type PixelArtRoom
} from "@jolly-pixel/asset.pixel-art/network/client.ts";
import type { AssetLeases } from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import type { TilesetEntry } from "../../state/index.ts";

// CONSTANTS
export const TILESET_MAX_SIZE = 2048;
export const TILESET_TEXTURE_KIND = pixelArtDocumentKind({
  maxSize: TILESET_MAX_SIZE,
  history: {
    enabled: true
  }
});

export interface TilesetTexture {
  readonly document: PixelDocument;
  readonly room: PixelArtRoom | undefined;
  readonly ready: Promise<void>;
  release(): void;
}

export interface TilesetTextures {
  open(entry: TilesetEntry): TilesetTexture | null;
}

export class LocalTilesetTextures implements TilesetTextures {
  readonly #engine: VoxelEngine;
  readonly #documents = new Map<string, PixelDocument>();

  constructor(
    engine: VoxelEngine
  ) {
    this.#engine = engine;
  }

  open(
    entry: TilesetEntry
  ): TilesetTexture | null {
    const document = this.#document(entry.definition.id);
    if (document === null) {
      return null;
    }

    return {
      document,
      room: undefined,
      ready: Promise.resolve(),
      release: () => void 0
    };
  }

  #document(
    tilesetId: string
  ): PixelDocument | null {
    const existing = this.#documents.get(tilesetId);
    if (existing !== undefined) {
      return existing;
    }

    const atlas = this.#engine.tilesetManager.get(tilesetId);
    if (atlas === undefined) {
      return null;
    }

    const document = new PixelDocument({
      size: { x: 1, y: 1 },
      maxSize: TILESET_MAX_SIZE,
      history: {
        enabled: true
      }
    });
    try {
      document.buffer.loadTexture(atlas.texture.image);
    }
    catch (error) {
      console.error(
        `LocalTilesetTextures: tileset "${tilesetId}" cannot be edited`,
        error
      );

      return null;
    }
    this.#documents.set(tilesetId, document);

    return document;
  }
}

export class SessionTilesetTextures implements TilesetTextures {
  readonly #assets: AssetLeases;
  readonly #local: LocalTilesetTextures;

  constructor(
    assets: AssetLeases,
    local: LocalTilesetTextures
  ) {
    this.#assets = assets;
    this.#local = local;
  }

  open(
    entry: TilesetEntry
  ): TilesetTexture | null {
    if (entry.assetId === null) {
      return this.#local.open(entry);
    }

    const lease = this.#assets.open(TILESET_TEXTURE_KIND, entry.assetId);

    return {
      document: lease.document,
      room: lease.room,
      ready: lease.ready,
      release: () => lease.release()
    };
  }
}
