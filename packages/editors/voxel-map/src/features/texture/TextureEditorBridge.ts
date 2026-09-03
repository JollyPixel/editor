// Import Third-party Dependencies
import type {
  ResolvedBlockDefinition,
  TilesetAtlas,
  VoxelRenderer
} from "@jolly-pixel/voxel.renderer";
import type * as network from "@jolly-pixel/network";
import {
  PixelCursorSync,
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
import { findBlocksReferencingTileset } from "./blockTextureTiles.ts";
import { editorState } from "../../EditorState.ts";
import {
  peerColor,
  readUsername
} from "../../network/identity.ts";

function rectsUnion(
  a: SelectionRect,
  b: SelectionRect
): SelectionRect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);

  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y
  };
}

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
  #cursorSync: PixelCursorSync | null = null;
  #atlas: TilesetAtlas | null = null;
  #tilesetId: string | null = null;
  #vr: VoxelRenderer | null = null;
  #unsubscribe: (() => void) | null = null;
  #syncing = false;
  #texture: PixelCanvasTexture | null = null;
  readonly #scheduler: (callback: () => void) => void;
  #running = false;
  #needsFullSync = false;
  #pendingTransparency: SelectionRect | null = null;

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
    this.#cursorSync?.destroy();
    this.#cursorSync = null;
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
      this.#cursorSync = new PixelCursorSync({
        room,
        label: (identity) => readUsername(identity),
        color: (clientId, identity) => peerColor(clientId, identity)
      });
      this.#cursorSync.attach(this.#manager);
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
      this.#flushTransparency();

      return;
    }

    if (this.#needsFullSync) {
      this.#needsFullSync = false;
      this.#pendingTransparency = null;
      this.syncToThree();

      return;
    }

    if (!this.#manager || !this.#atlas) {
      return;
    }

    this.#atlas.updateSource(this.#manager.textureCanvas(), dirty);
    // A stroke reports a dirty region every frame and its tiles flip
    // alpha as it goes, so rescan once it settles, not once per frame.
    this.#pendingTransparency = this.#pendingTransparency === null
      ? dirty
      : rectsUnion(this.#pendingTransparency, dirty);
  }

  #flushTransparency(): void {
    const bounds = this.#pendingTransparency;
    if (bounds === null) {
      return;
    }

    this.#pendingTransparency = null;
    this.syncTransparency(bounds);
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

    // Deriving from a placeholder registry would publish, and persist,
    // block definitions the authoritative snapshot is about to replace.
    if (!editorState.blocksReady) {
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
      this.#vr.engine.defineBlocks(updates);
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
    this.#pendingTransparency = null;
    this.#texture?.dispose();
    this.#texture = null;
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#cursorSync?.destroy();
    this.#cursorSync = null;
    this.#syncClient?.destroy();
    this.#syncClient = null;
    this.#manager = null;
    this.#atlas = null;
    this.#tilesetId = null;
    this.#vr = null;
  }
}
