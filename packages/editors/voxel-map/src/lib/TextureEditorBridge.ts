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
  type PixelServerMessage,
  type SelectionRect
} from "@jolly-pixel/pixel-draw.renderer";
import {
  PixelCanvasTexture
} from "@jolly-pixel/editor.pixel-art/three/PixelCanvasTexture.ts";

// Import Internal Dependencies
import { applyBlockUpdates } from "./applyBlockUpdate.ts";
import { findBlocksReferencingTileset } from "./blockTextureTiles.ts";
import { editorState } from "../EditorState.ts";

function rectsIntersect(
  a: SelectionRect,
  b: SelectionRect
): boolean {
  return a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height;
}

export interface TextureEditorBridgeOptions {
  /**
   * Test scheduler override.
   */
  scheduler?: (callback: () => void) => void;
}

export class TextureEditorBridge {
  #manager: PixelArtCanvas | null = null;
  #syncClient: PixelSyncClient | null = null;
  #tilesetManager: TilesetManager | null = null;
  #tilesetId: string | null = null;
  #vr: VoxelRenderer | null = null;
  #tileSize = 1;
  #unsubscribe: (() => void) | null = null;
  #syncing = false;
  #texture: PixelCanvasTexture | null = null;
  readonly #scheduler: (callback: () => void) => void;
  #running = false;
  /**
   * Requires one full repad before regional updates resume.
   */
  #needsFullSync = false;

  constructor(
    options: TextureEditorBridgeOptions = {}
  ) {
    this.#scheduler = options.scheduler ??
      ((callback) => requestAnimationFrame(callback));
  }

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

    // Manual flush batches local and remote writes once per frame.
    this.#texture?.dispose();
    this.#texture = new PixelCanvasTexture(canvas, { flush: "manual" });
    this.#texture.on("resized", () => {
      // Resizes and snapshots require a full repad.
      this.#needsFullSync = true;
    });
    this.#startFrameLoop();

    if (room) {
      this.#syncClient = new PixelSyncClient({ room });
      this.#syncClient.attach(this.#manager);
      room.join();
    }
  }

  #startFrameLoop(): void {
    if (this.#running) {
      return;
    }
    this.#running = true;

    const tick = () => {
      if (!this.#running) {
        return;
      }
      this.#flush();
      this.#scheduler(tick);
    };
    this.#scheduler(tick);
  }

  #flush(): void {
    const dirty = this.#texture?.consume();
    if (!dirty) {
      return;
    }

    if (this.#needsFullSync) {
      this.#needsFullSync = false;
      this.syncToThree();

      return;
    }

    if (!this.#manager || !this.#tilesetManager) {
      return;
    }

    this.#tilesetManager.updateSourceRegion(
      this.#manager.textureCanvas(),
      dirty,
      this.#tilesetId ?? undefined
    );
    this.syncTransparency(dirty);
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

    // Use the shipped atlas until the room snapshot arrives.
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
   * Recomputes transparency; `bounds` limits work to touched tiles.
   */
  syncTransparency(
    bounds?: SelectionRect
  ): void {
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
      if (bounds && !rects.some((rect) => rectsIntersect(rect, bounds))) {
        continue;
      }

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
   * Recomputes after registry changes; the guard prevents recursion.
   */
  readonly #onBlockRegistryChanged = (): void => {
    if (this.#syncing) {
      return;
    }

    this.syncTransparency();
  };

  destroy(): void {
    this.#running = false;
    this.#texture?.dispose();
    this.#texture = null;
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
