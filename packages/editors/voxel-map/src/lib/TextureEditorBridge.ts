// Import Third-party Dependencies
import type { TilesetManager, VoxelRenderer } from "@jolly-pixel/voxel.renderer";
import type * as network from "@jolly-pixel/network";
import {
  PixelSyncClient,
  type PixelArtCanvas,
  type PixelNetworkCommand,
  type PixelServerMessage
} from "@jolly-pixel/pixel-draw.renderer";

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

    const saved = localStorage.getItem(kTextureKeyPrefix + id);
    if (saved) {
      const img = new Image();
      img.onload = () => {
        this.#manager!.texture = img;
        this.syncToThree();
      };
      img.src = saved;
    }
    else {
      this.#manager.texture = texture.image as HTMLImageElement;
    }
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
  }
}
