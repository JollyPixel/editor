// Import Third-party Dependencies
import type {
  ResolvedBlockDefinition,
  TilesetAtlas,
  VoxelRenderer
} from "@jolly-pixel/voxel.renderer";
import type * as network from "@jolly-pixel/network";
import {
  PixelCursorSync,
  PixelStrokeGhostSync,
  PixelSyncClient,
  SelectionGhostSync,
  UVGhostSync,
  type PixelArtCanvas,
  type PixelNetworkCommand,
  type PixelServerMessage,
  type SelectionRect
} from "@jolly-pixel/pixel-draw.renderer";
import {
  PixelCanvasChangeTracker
} from "@jolly-pixel/editor.pixel-art/texture/PixelCanvasChangeTracker.ts";

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
  #uvGhostSync: UVGhostSync | null = null;
  #strokeGhostSync: PixelStrokeGhostSync | null = null;
  #selectionGhostSync: SelectionGhostSync | null = null;
  #atlas: TilesetAtlas | null = null;
  #tilesetId: string | null = null;
  #vr: VoxelRenderer | null = null;
  #unsubscribe: (() => void) | null = null;
  #syncing = false;
  #changes: PixelCanvasChangeTracker | null = null;
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
    this.#destroyGhostSyncs();
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
    this.#changes?.dispose();
    this.#changes = new PixelCanvasChangeTracker(canvas, { flush: "manual" });
    this.#changes.on("resized", this.#onSurfaceChanged);
    this.#changes.on("replaced", this.#onSurfaceChanged);
    this.#startFrameLoop();
    if (room) {
      this.#attachRoom(canvas, room);
    }
  }

  readonly #onSurfaceChanged = (): void => {
    // Resizes and snapshots invalidate regional padding.
    this.#needsFullSync = true;
  };

  #attachRoom(
    canvas: PixelArtCanvas,
    room: network.Room<PixelNetworkCommand, PixelServerMessage>
  ): void {
    this.#syncClient = new PixelSyncClient({ room });
    this.#syncClient.attach(canvas);
    this.#cursorSync = new PixelCursorSync({
      room,
      label: (identity) => readUsername(identity),
      color: (clientId, identity) => peerColor(clientId, identity)
    });
    this.#cursorSync.attach(canvas);
    this.#uvGhostSync = new UVGhostSync({ room });
    this.#uvGhostSync.attach(canvas);
    this.#strokeGhostSync = new PixelStrokeGhostSync({ room });
    this.#strokeGhostSync.attach(canvas);
    this.#selectionGhostSync = new SelectionGhostSync({ room });
    this.#selectionGhostSync.attach(canvas);
    room.join();
  }

  #destroyGhostSyncs(): void {
    this.#selectionGhostSync?.destroy();
    this.#selectionGhostSync = null;
    this.#strokeGhostSync?.destroy();
    this.#strokeGhostSync = null;
    this.#uvGhostSync?.destroy();
    this.#uvGhostSync = null;
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
    const dirty = this.#changes?.consume();
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

    if (this.#syncClient?.ready) {
      this.syncTransparency();

      return;
    }

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

  syncTransparency(
    bounds?: SelectionRect
  ): void {
    if (!this.#manager || !this.#vr || !this.#atlas || !this.#tilesetId) {
      return;
    }
    if (!editorState.blocksReady) {
      return;
    }

    const affected = findBlocksReferencingTileset(
      this.#vr.engine.blockRegistry.getAll(),
      (shapeId) => this.#vr!.engine.shapeRegistry.get(shapeId),
      this.#tilesetId,
      this.#atlas.def.tileSize
    );

    const updates: ResolvedBlockDefinition[] = [];
    for (const { block, rects, geometries } of affected) {
      if (bounds && !rects.some((rect) => rectsIntersect(rect, bounds))) {
        continue;
      }

      const transparent = geometries.some(
        (geometry) => this.#manager!.hasTransparency(geometry)
      );
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
    this.#changes?.dispose();
    this.#changes = null;
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#cursorSync?.destroy();
    this.#cursorSync = null;
    this.#destroyGhostSyncs();
    this.#syncClient?.destroy();
    this.#syncClient = null;
    this.#manager = null;
    this.#atlas = null;
    this.#tilesetId = null;
    this.#vr = null;
  }
}
