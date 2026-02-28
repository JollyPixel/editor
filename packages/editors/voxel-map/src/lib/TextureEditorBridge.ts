// Import Third-party Dependencies
import type { VoxelRenderer } from "@jolly-pixel/voxel.renderer";
import {
  CanvasManager,
  type CanvasManagerOptions
} from "@jolly-pixel/pixel-draw.renderer";

// CONSTANTS
const kTextureKeyPrefix = "jolly-pixel-voxel-map-texture-";

export interface TextureEditorBridgeOptions {
  canvasManager?: CanvasManagerOptions;
}

/**
 * Bridges the pixel-art CanvasManager with the Three.js tileset texture.
 * Call mount() once to create the CanvasManager, then loadTileset() each time
 * the active tileset changes. destroy() cleans up all DOM and event state.
 */
export class TextureEditorBridge {
  #manager: CanvasManager | null = null;
  #threeTexture: { image: unknown; needsUpdate: boolean; } | null = null;
  #options: TextureEditorBridgeOptions;
  #tilesetId: string | null = null;

  constructor(
    options: TextureEditorBridgeOptions = {}
  ) {
    this.#options = options;
  }

  get isActive(): boolean {
    return this.#manager !== null;
  }

  mount(
    container: HTMLDivElement,
    extraOptions?: CanvasManagerOptions
  ): void {
    if (this.#manager) {
      this.#manager.destroy();
    }

    const managerOptions: CanvasManagerOptions = {
      ...this.#options.canvasManager,
      ...extraOptions,
      onDrawEnd: () => this.#syncToThree()
    };

    this.#manager = new CanvasManager(container, managerOptions);
  }

  loadTileset(
    vr: VoxelRenderer,
    tilesetId: string | null | undefined
  ): void {
    if (!this.#manager) {
      return;
    }

    const id = tilesetId ?? vr.tilesetManager.defaultTilesetId;
    if (!id) {
      return;
    }

    const texture = vr.tilesetManager.getTexture(id);
    if (!texture) {
      return;
    }

    this.#tilesetId = id;
    this.#threeTexture = texture as { image: unknown; needsUpdate: boolean; };

    const saved = localStorage.getItem(kTextureKeyPrefix + id);
    if (saved) {
      const img = new Image();
      img.onload = () => {
        this.#manager!.setTexture(img);
        this.#syncToThree();
      };
      img.src = saved;
    }
    else {
      this.#manager.setTexture(texture.image as HTMLImageElement);
    }
  }

  #syncToThree(): void {
    if (!this.#manager || !this.#threeTexture) {
      return;
    }

    const canvas = this.#manager.getTextureCanvas();
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

    const canvas = this.#manager.getTextureCanvas();
    const url = canvas.toDataURL("image/png");
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
  }

  setMode(
    mode: import("@jolly-pixel/pixel-draw.renderer").Mode
  ): void {
    this.#manager?.setMode(mode);
  }

  setBrushSize(
    size: number
  ): void {
    if (this.#manager) {
      this.#manager.brush.setSize(size);
    }
  }

  setBrushColor(
    hex: string,
    opacity = 1
  ): void {
    if (this.#manager) {
      this.#manager.brush.setColorWithOpacity(hex, opacity);
    }
  }

  onResize(): void {
    this.#manager?.onResize();
  }

  destroy(): void {
    this.#manager?.destroy();
    this.#manager = null;
    this.#threeTexture = null;
    this.#tilesetId = null;
  }
}
