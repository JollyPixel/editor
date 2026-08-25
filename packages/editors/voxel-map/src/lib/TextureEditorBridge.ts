// Import Third-party Dependencies
import type {
  BlockDefinition,
  TilesetManager,
  VoxelRenderer
} from "@jolly-pixel/voxel.renderer";
import type * as network from "@jolly-pixel/network";
import {
  PixelSyncClient,
  type PixelArtCanvas,
  type PixelNetworkCommand,
  type PixelServerMessage
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { applyBlockUpdates } from "./applyBlockUpdate.ts";
import { findBlocksReferencingTileset } from "./blockTextureTiles.ts";
import { editorState } from "../EditorState.ts";

export class TextureEditorBridge {
  #manager: PixelArtCanvas | null = null;
  #syncClient: PixelSyncClient | null = null;
  #tilesetManager: TilesetManager | null = null;
  #tilesetId: string | null = null;
  #vr: VoxelRenderer | null = null;
  #tileSize = 1;
  #unsubscribe: (() => void) | null = null;
  #syncing = false;

  get isActive(): boolean {
    return this.#manager !== null;
  }

  attach(
    canvas: PixelArtCanvas,
    room?: network.Room<PixelNetworkCommand, PixelServerMessage>
  ): void {
    this.#syncClient?.destroy();
    this.#syncClient = null;
    this.#manager = canvas;
    this.#unsubscribe ??= editorState.on(
      "blockRegistryChanged",
      this.#onBlockRegistryChanged
    );

    if (room) {
      this.#syncClient = new PixelSyncClient({ room });
      this.#syncClient.attach(this.#manager);
      // The room owns the atlas pixels, so every replacement has to reach the
      // Three.js tileset — not only the strokes drawn here.
      this.#syncClient.on("snapshot", () => this.syncToThree());
      room.join();
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

    const texture = tilesetManager.getSourceTexture(id);
    if (!texture) {
      return;
    }

    this.#tilesetId = id;
    this.#tilesetManager = tilesetManager;
    this.#vr = vr;
    this.#tileSize = tilesetManager.getDefinitions().find((def) => def.id === id)?.tileSize ?? 1;

    // A room snapshot overwrites this with the shared atlas as soon as it
    // lands; until then the shipped image keeps the canvas usable.
    if (this.#applyTexture(texture.image as HTMLImageElement, "tileset source image")) {
      this.syncTransparency();
    }
  }

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

  syncToThree(): void {
    if (!this.#manager || !this.#tilesetManager) {
      return;
    }

    this.#tilesetManager.updateSourceImage(
      this.#manager.textureCanvas(),
      this.#tilesetId ?? undefined
    );

    this.syncTransparency();
  }

  /**
   * Derives `transparent` for every block drawing from the active tileset,
   * out of the alpha of the pixels under its tiles.
   */
  syncTransparency(): void {
    if (!this.#manager || !this.#vr || !this.#tilesetId) {
      return;
    }

    const affected = findBlocksReferencingTileset(
      this.#vr.engine.blockRegistry.getAll(),
      this.#tilesetId,
      this.#tileSize
    );

    const updates: BlockDefinition[] = [];
    for (const { block, rects } of affected) {
      const transparent = rects.some((rect) => this.#manager!.hasTransparency(rect));
      if (transparent === (block.transparent === true)) {
        continue;
      }

      updates.push({ ...block, transparent });
    }

    this.#syncing = true;
    try {
      applyBlockUpdates(this.#vr, updates);
    }
    finally {
      this.#syncing = false;
    }
  }

  /**
   * Moving a UV region, switching a block to another tileset or registering a
   * new block all change which pixels a block reads, so the flag is derived
   * again. The write-back re-enters this listener, hence the guard.
   */
  readonly #onBlockRegistryChanged = (): void => {
    if (this.#syncing) {
      return;
    }

    this.syncTransparency();
  };

  destroy(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#syncClient?.destroy();
    this.#syncClient = null;
    this.#manager = null;
    this.#tilesetManager = null;
    this.#tilesetId = null;
    this.#vr = null;
  }
}
