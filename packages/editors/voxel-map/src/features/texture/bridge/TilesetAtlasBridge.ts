// Import Third-party Dependencies
import * as THREE from "three";
import type {
  ResolvedBlockDefinition,
  TilesetAtlas,
  TilesetDefinition,
  TilesetImage,
  VoxelEngine
} from "@jolly-pixel/voxel.renderer";
import type {
  PixelDocument,
  SelectionRect
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { findBlocksReferencingTileset } from "../uv/blockTextureTiles.ts";
import { definitionsEqual } from "../../tilesets/tilesetEntries.ts";
import {
  editorState,
  type WorldStore
} from "../../../app/state/index.ts";

export interface TilesetAtlasBridgeOptions {
  engine: VoxelEngine;
  document: PixelDocument;
  definition: TilesetDefinition;
  worldStore?: WorldStore;
  scheduler?: (callback: () => void) => void;
}

export class TilesetAtlasBridge {
  readonly #engine: VoxelEngine;
  readonly #document: PixelDocument;
  readonly #worldStore: WorldStore;
  readonly #scheduler: (callback: () => void) => void;
  readonly #unsubscribe: () => void;
  #definition: TilesetDefinition;
  #atlas: TilesetAtlas | null = null;
  #dirty: SelectionRect | null = null;
  #pendingTransparency: SelectionRect | null = null;
  #needsFullSync = false;
  #syncing = false;
  #running = true;

  readonly #onChanged = (event: { bounds: SelectionRect; }): void => {
    this.#dirty = this.#dirty === null ?
      event.bounds :
      rectsUnion(this.#dirty, event.bounds);
  };

  readonly #onSurfaceChanged = (): void => {
    this.#needsFullSync = true;
  };

  readonly #onBlockRegistryChanged = (): void => {
    if (!this.#syncing) {
      this.syncTransparency();
    }
  };

  readonly #tick = (): void => {
    if (!this.#running) {
      return;
    }

    this.#flush();
    this.#scheduler(this.#tick);
  };

  constructor(
    options: TilesetAtlasBridgeOptions
  ) {
    this.#engine = options.engine;
    this.#document = options.document;
    this.#definition = options.definition;
    this.#worldStore = options.worldStore ?? editorState.world;
    this.#scheduler = options.scheduler ??
      ((callback) => requestAnimationFrame(callback));

    this.#document.on("changed", this.#onChanged);
    this.#document.on("resized", this.#onSurfaceChanged);
    this.#document.on("replaced", this.#onSurfaceChanged);
    this.#unsubscribe = this.#worldStore.watch(
      "blockRegistryChanged",
      this.#onBlockRegistryChanged
    );

    this.#bind();
    this.#scheduler(this.#tick);
  }

  get definition(): TilesetDefinition {
    return this.#definition;
  }

  update(
    definition: TilesetDefinition
  ): void {
    if (definitionsEqual(definition, this.#definition)) {
      return;
    }

    this.#definition = definition;
    this.#bind();
  }

  syncToThree(): void {
    this.#registerAtlas();
    if (this.#atlas === null) {
      return;
    }

    this.#atlas.updateImage(this.#document.buffer.canvas());
    this.syncTransparency();
  }

  syncTransparency(
    bounds?: SelectionRect
  ): void {
    if (!this.#worldStore.blocksReady) {
      return;
    }

    const engine = this.#engine;
    const definition = this.#definition;
    const affected = findBlocksReferencingTileset(
      engine.blockRegistry.getAll(),
      (shapeId) => engine.shapeRegistry.get(shapeId),
      definition.id,
      definition.tileSize
    );

    const updates: ResolvedBlockDefinition[] = [];
    for (const { block, rects, geometries } of affected) {
      if (bounds && !rects.some((rect) => rectsIntersect(rect, bounds))) {
        continue;
      }

      const transparent = geometries.some(
        (geometry) => this.#document.hasTransparency(geometry)
      );
      const alphaMode = transparent ? "blend" : "opaque";
      if (
        block.alphaMode === "mask" ||
        alphaMode === (block.alphaMode ?? "opaque")
      ) {
        continue;
      }

      updates.push({ ...block, alphaMode });
    }

    this.#syncing = true;
    try {
      engine.defineBlocks(updates);
    }
    finally {
      this.#syncing = false;
    }
  }

  destroy(): void {
    this.#running = false;
    this.#document.off("changed", this.#onChanged);
    this.#document.off("resized", this.#onSurfaceChanged);
    this.#document.off("replaced", this.#onSurfaceChanged);
    this.#unsubscribe();
    this.#atlas = null;
  }

  #bind(): void {
    this.#atlas = this.#engine.tilesetManager.get(this.#definition.id) ?? null;
    this.#needsFullSync = true;
    this.#flush();
  }

  #flush(): void {
    const dirty = this.#dirty;
    this.#dirty = null;
    if (this.#needsFullSync) {
      this.#needsFullSync = false;
      this.#pendingTransparency = null;
      this.syncToThree();

      return;
    }
    if (dirty === null) {
      this.#flushTransparency();

      return;
    }
    if (this.#atlas === null) {
      return;
    }

    this.#atlas.updateImage(this.#document.buffer.canvas());
    this.#pendingTransparency = this.#pendingTransparency === null ?
      dirty :
      rectsUnion(this.#pendingTransparency, dirty);
  }

  #flushTransparency(): void {
    const bounds = this.#pendingTransparency;
    if (bounds !== null) {
      this.#pendingTransparency = null;
      this.syncTransparency(bounds);
    }
  }

  #registerAtlas(): void {
    const definition = this.#definition;
    const { tileSize } = definition;
    const size = this.#document.size();
    const cols = Math.floor(size.x / tileSize);
    const rows = Math.floor(size.y / tileSize);
    const current = this.#atlas?.def;
    const unchanged = current !== undefined &&
      current.tileSize === tileSize &&
      current.cols === cols &&
      current.rows === rows;
    if (unchanged || cols === 0 || rows === 0) {
      return;
    }

    const texture = new THREE.Texture<TilesetImage>(
      this.#document.buffer.canvas()
    );
    texture.needsUpdate = true;
    const {
      cols: _cols,
      rows: _rows,
      ...source
    } = definition;
    this.#engine.loadTileset(
      {
        ...source,
        tileSize
      },
      texture
    );
    this.#atlas = this.#engine.tilesetManager.atlas(definition.id);
  }
}

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
