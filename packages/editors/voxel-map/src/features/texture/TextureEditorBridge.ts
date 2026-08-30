// Import Third-party Dependencies
import type {
  ResolvedBlockDefinition,
  TilesetAtlas,
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
import { applyBlockUpdates } from "../blocks/applyBlockUpdate.ts";
import { findBlocksReferencingTileset } from "./blockTextureTiles.ts";
import { editorState } from "../../EditorState.ts";

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
  #atlas: TilesetAtlas | null = null;
  #tilesetId: string | null = null;
  #vr: VoxelRenderer | null = null;
  #unsubscribe: (() => void) | null = null;
  #syncing = false;
  #texture: PixelCanvasTexture | null = null;
  readonly #scheduler: (callback: () => void) => void;
  #running = false;
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

    // Batch local and remote writes once per frame.
    this.#texture?.dispose();
    this.#texture = new PixelCanvasTexture(canvas, { flush: "manual" });
    this.#texture.on("resized", () => {
      // Resizes and snapshots invalidate regional padding.
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

    if (!this.#manager || !this.#atlas) {
      return;
    }

    this.#atlas.updateSource(this.#manager.textureCanvas(), dirty);
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
    if (id === null || !tilesetManager.has(id)) {
      return;
    }

    const atlas = tilesetManager.atlas(id);

    this.#tilesetId = id;
    this.#atlas = atlas;
    this.#vr = vr;

    // Do not overwrite an attached room's snapshot.
    if (this.#syncClient?.ready) {
      this.syncTransparency();

      return;
    }

    // Local restore keeps the placeholder out of shared history.
    const applied = this.#manager.runLocalRestore(
      () => this.#applyTexture(
        atlas.sourceTexture.image as HTMLImageElement,
        "tileset source image"
      )
    );
    if (applied) {
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
    if (!this.#manager || !this.#atlas) {
      return;
    }

    this.#atlas.updateSource(this.#manager.textureCanvas());

    this.syncTransparency();
  }

  /** Recomputes transparency within optional tile bounds. */
  syncTransparency(
    bounds?: SelectionRect
  ): void {
    if (!this.#manager || !this.#vr || !this.#atlas || !this.#tilesetId) {
      return;
    }

    const affected = findBlocksReferencingTileset(
      this.#vr.engine.blockRegistry.getAll(),
      this.#tilesetId,
      this.#atlas.def.tileSize
    );

    const updates: ResolvedBlockDefinition[] = [];
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
    this.#atlas = null;
    this.#tilesetId = null;
    this.#vr = null;
  }
}
