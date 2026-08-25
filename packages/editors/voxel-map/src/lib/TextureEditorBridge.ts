// Import Third-party Dependencies
import type { TilesetManager, VoxelRenderer } from "@jolly-pixel/voxel.renderer";
import type * as network from "@jolly-pixel/network";
import {
  PixelSyncClient,
  type PixelArtCanvas,
  type PixelNetworkCommand,
  type PixelServerMessage
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { applyBlockUpdate } from "./applyBlockUpdate.ts";
import { findBlocksReferencingTileset } from "./blockTextureTiles.ts";

// CONSTANTS
const kTextureKeyPrefix = "jolly-pixel-voxel-map-texture-";

/**
 * Bridges a `PixelArtCanvas` owned by `<pixel-draw-panel>` with the Three.js
 * tileset texture. Call attach() once the panel has finished initializing,
 * then loadTileset() each time the active tileset changes. destroy() cleans
 * up the sync client.
 */
export class TextureEditorBridge {
  #manager: PixelArtCanvas | null = null;
  #syncClient: PixelSyncClient | null = null;
  #tilesetManager: TilesetManager | null = null;
  #tilesetId: string | null = null;
  #vr: VoxelRenderer | null = null;
  #tileSize = 1;

  get isActive(): boolean {
    return this.#manager !== null;
  }

  attach(
    canvas: PixelArtCanvas,
    room?: network.Room<PixelNetworkCommand, PixelServerMessage>
  ): void {
    this.#manager = canvas;

    if (room) {
      this.#syncClient = new PixelSyncClient({ room });
      this.#syncClient.attach(this.#manager);
    }
  }

  loadTileset(
    vr: VoxelRenderer,
    tilesetId: string | null | undefined
  ): void {
    if (!this.#manager) {
      return;
    }

    const { tilesetManager } = vr.engine;
    const id = tilesetId ?? tilesetManager.defaultTilesetId;
    if (!id) {
      return;
    }

    // The unpadded atlas: its pixel grid is the one the editor draws on.
    const texture = tilesetManager.getSourceTexture(id);
    if (!texture) {
      return;
    }

    this.#tilesetId = id;
    this.#tilesetManager = tilesetManager;
    this.#vr = vr;
    this.#tileSize = tilesetManager.getDefinitions().find((def) => def.id === id)?.tileSize ?? 1;

    const saved = localStorage.getItem(kTextureKeyPrefix + id);
    if (saved) {
      const img = new Image();
      img.onload = () => {
        if (this.#applyTexture(img, "locally cached edit")) {
          this.syncToThree();
        }
      };
      img.src = saved;
    }
    else {
      this.#applyTexture(texture.image as HTMLImageElement, "tileset source image");
    }
  }

  /**
   * Hands a texture to the canvas, refusing oversized ones instead of letting
   * them throw. `PixelArtCanvas` rejects any dimension above `maxTextureSize`,
   * and from an `Image.onload` handler that RangeError escapes as an unhandled
   * rejection, leaving the editor wedged with no visible cause.
   */
  #applyTexture(
    source: HTMLImageElement,
    origin: string
  ): boolean {
    const manager = this.#manager;
    if (!manager) {
      return false;
    }

    const width = source.naturalWidth || source.width;
    const height = source.naturalHeight || source.height;
    const { maxTextureSize } = manager;

    if (width > maxTextureSize || height > maxTextureSize) {
      console.error(
        `TextureEditorBridge: ${origin} for tileset "${this.#tilesetId}" is ` +
        `${width}x${height}, above the editor limit of ${maxTextureSize}px per side. ` +
        "Raise `texture.maxSize` on the pixel-draw panel or use a smaller atlas."
      );

      return false;
    }

    manager.texture = source;

    return true;
  }

  /**
   * Pushes the current texture canvas back into the tileset — which repacks it
   * with its gutter — and caches it to localStorage. Called from the
   * `onDrawEnd` hook passed to `PixelDrawPanel.initialize()`.
   */
  syncToThree(): void {
    if (!this.#manager || !this.#tilesetManager) {
      return;
    }

    const canvas = this.#manager.textureCanvas();
    this.#tilesetManager.updateSourceImage(canvas, this.#tilesetId ?? undefined);

    if (this.#tilesetId) {
      localStorage.setItem(
        kTextureKeyPrefix + this.#tilesetId,
        canvas.toDataURL("image/png")
      );
    }

    this.#syncTransparency();
  }

  /**
   * Keeps `BlockDefinition.transparent` in sync with what the tile actually
   * looks like: a block referencing a tile that just gained (or lost) alpha
   * has its flag flipped, which re-registers it and rebuilds every chunk so
   * culling/greedy meshing pick up the change immediately.
   */
  #syncTransparency(): void {
    if (!this.#manager || !this.#vr || !this.#tilesetId) {
      return;
    }

    const affected = findBlocksReferencingTileset(
      this.#vr.engine.blockRegistry.getAll(),
      this.#tilesetId,
      this.#tileSize
    );

    for (const { block, rects } of affected) {
      const transparent = rects.some((rect) => this.#manager!.hasTransparency(rect));
      if (transparent === (block.transparent === true)) {
        continue;
      }

      applyBlockUpdate(this.#vr, { ...block, transparent });
    }
  }

  exportPng(filename: string): void {
    if (!this.#manager) {
      return;
    }

    const canvas = this.#manager.textureCanvas();
    const url = canvas.toDataURL("image/png");
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
  }

  destroy(): void {
    this.#syncClient?.destroy();
    this.#syncClient = null;
    this.#manager = null;
    this.#tilesetManager = null;
    this.#tilesetId = null;
    this.#vr = null;
  }
}
