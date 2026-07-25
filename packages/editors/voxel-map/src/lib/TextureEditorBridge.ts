// Import Third-party Dependencies
import type { VoxelRenderer } from "@jolly-pixel/voxel.renderer";
import {
  PixelSyncSession,
  type PixelArtCanvas,
  type PixelTransport
} from "@jolly-pixel/pixel-draw.renderer";

// CONSTANTS
const kTextureKeyPrefix = "jolly-pixel-voxel-map-texture-";

/**
 * Bridges a `PixelArtCanvas` owned by `<pixel-draw-panel>` with the Three.js
 * tileset texture. Call attach() once the panel has finished initializing,
 * then loadTileset() each time the active tileset changes. destroy() cleans
 * up the sync session.
 */
export class TextureEditorBridge {
  #manager: PixelArtCanvas | null = null;
  #session: PixelSyncSession | null = null;
  #threeTexture: { image: unknown; needsUpdate: boolean; } | null = null;
  #tilesetId: string | null = null;

  get isActive(): boolean {
    return this.#manager !== null;
  }

  attach(
    canvas: PixelArtCanvas,
    transport?: PixelTransport
  ): void {
    this.#manager = canvas;

    if (transport) {
      this.#session = new PixelSyncSession({ transport });
      this.#session.attach(this.#manager);
    }
  }

  loadTileset(
    vr: VoxelRenderer,
    tilesetId: string | null | undefined
  ): void {
    if (!this.#manager) {
      return;
    }

    const id = tilesetId ?? vr.engine.tilesetManager.defaultTilesetId;
    if (!id) {
      return;
    }

    const texture = vr.engine.tilesetManager.getTexture(id);
    if (!texture) {
      return;
    }

    this.#tilesetId = id;
    this.#threeTexture = texture as { image: unknown; needsUpdate: boolean; };

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
   * Pushes the current texture canvas into the live Three.js texture and
   * caches it to localStorage. Called from the `onDrawEnd` hook passed to
   * `PixelDrawPanel.initialize()`.
   */
  syncToThree(): void {
    if (!this.#manager || !this.#threeTexture) {
      return;
    }

    const canvas = this.#manager.textureCanvas();
    this.#threeTexture.image = canvas;
    this.#threeTexture.needsUpdate = true;

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
    this.#session?.destroy();
    this.#session = null;
    this.#manager = null;
    this.#threeTexture = null;
    this.#tilesetId = null;
  }
}
