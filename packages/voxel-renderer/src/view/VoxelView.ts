// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { BlockShapeRegistry } from "../blocks/shape/BlockShapeRegistry.ts";
import type { VoxelCollider } from "../collision/VoxelCollider.ts";
import {
  isVoxelTilesetCommand,
  type VoxelCommand
} from "../commands.ts";
import type { VoxelDocument } from "../document/VoxelDocument.ts";
import type { VoxelInvalidation } from "../document/VoxelDocument.types.ts";
import { VoxelInspector } from "../inspector/index.ts";
import { VoxelMeshBuilder } from "../mesh/index.ts";
import { ChunkMaterialCache } from "../render/ChunkMaterialCache.ts";
import { ChunkMeshStore } from "../render/ChunkMeshStore.ts";
import { ChunkRebuildQueue } from "../render/ChunkRebuildQueue.ts";
import { ChunkViewport } from "../render/ChunkViewport.ts";
import { ChunkVisibility } from "../render/ChunkVisibility.ts";
import { TilesetManager } from "../tileset/TilesetManager.ts";
import type { TilesetSource } from "../tileset/loadTilesets.ts";
import type {
  TilesetDefinition,
  TilesetTexture
} from "../tileset/types.ts";
import { NOOP_LOGGER, type VoxelLogger } from "../utils/logger.ts";
import { ViewDistance } from "../world/ViewDistance.ts";
import type { VoxelChunk } from "../world/VoxelChunk.ts";
import type { VoxelLayer } from "../world/VoxelLayer.ts";
import type {
  ViewDistancePolicy,
  VoxelViewOptions
} from "./VoxelView.types.ts";

export class VoxelView {
  readonly root = new THREE.Group();

  readonly document: VoxelDocument;
  readonly shapes: BlockShapeRegistry;
  readonly tilesets: TilesetManager;
  readonly inspector: VoxelInspector;

  focus: THREE.Vector3Like | null = null;
  viewDistance: ViewDistance;
  viewDistancePolicy: ViewDistancePolicy;

  #meshBuilder: VoxelMeshBuilder;
  #materials: ChunkMaterialCache;
  #meshes: ChunkMeshStore;
  #queue = new ChunkRebuildQueue();
  #idleWaiters: Array<() => void> = [];
  #visibility: ChunkVisibility;
  #collider: VoxelCollider | null;
  #rebuildBudgetMs: number;
  #logger: VoxelLogger;

  #onCommand = (
    command: VoxelCommand
  ): void => {
    if (isVoxelTilesetCommand(command)) {
      this.#syncAtlases();
    }
  };

  #onInvalidated = (
    invalidation: VoxelInvalidation
  ): void => {
    this.markAllChunksDirty(invalidation.reason);
  };

  #onLoaded = (): void => {
    this.#clearChunkMeshes();
    this.#logger.debug("Cleared existing chunk meshes while loading a world.");

    this.tilesets.syncAtlases();
    for (const tilesetDef of this.document.tilesets) {
      if (!this.tilesets.get(tilesetDef.id)) {
        this.#logger.warn(
          `Tileset '${tilesetDef.id}' is not loaded; its faces are skipped until it is.`
        );
      }
    }
    this.#materials.invalidate();
    this.#rebuildAllChunks("load");
  };

  constructor(
    document: VoxelDocument,
    options: VoxelViewOptions = {}
  ) {
    const {
      material = "lambert",
      materialCustomizer,
      collider,
      shapes = [],
      alphaTest = 0.1,
      logger = NOOP_LOGGER,
      inspector,
      tilesets,
      greedy = false,
      rebuildBudgetMs = 8,
      viewDistance,
      viewDistancePolicy = "hide",
      retainVertexData = false,
      castShadow = false,
      receiveShadow = false
    } = options;

    this.document = document;
    this.root.name = "VoxelView";

    this.#rebuildBudgetMs = rebuildBudgetMs;
    this.viewDistance = viewDistance === undefined ?
      ViewDistance.Unlimited :
      ViewDistance.from(viewDistance);
    this.viewDistancePolicy = viewDistancePolicy;
    this.#logger = logger.child({
      namespace: "VoxelView"
    });

    this.inspector = new VoxelInspector(
      {
        parent: this.root,
        world: document.world,
        blockRegistry: document.blocks
      },
      inspector
    );
    this.shapes = BlockShapeRegistry.createDefault();
    shapes.forEach(
      (shape) => this.shapes.register(shape)
    );

    this.tilesets = new TilesetManager({
      tilesets: document.tilesets
    });
    this.#registerTilesets(tilesets);

    this.#meshBuilder = new VoxelMeshBuilder({
      world: document.world,
      blockRegistry: document.blocks,
      shapeRegistry: this.shapes,
      tilesetManager: this.tilesets,
      alphaTest,
      greedy
    });

    this.#collider = collider?.({
      blockRegistry: document.blocks,
      shapeRegistry: this.shapes
    }) ?? null;

    this.#materials = new ChunkMaterialCache({
      tilesetManager: this.tilesets,
      type: material,
      customizer: materialCustomizer,
      tileWrapping: greedy
    });
    this.#meshes = new ChunkMeshStore({
      root: this.root,
      meshBuilder: this.#meshBuilder,
      materials: this.#materials,
      inspector: this.inspector,
      collider: this.#collider,
      logger: this.#logger,
      retainVertexData,
      castShadow,
      receiveShadow
    });
    this.#visibility = new ChunkVisibility({
      meshes: this.#meshes,
      unload: (layer, chunk) => {
        this.#removeChunk(
          layer,
          chunk,
          { collider: false }
        );
        chunk.dirty = true;
      }
    });

    document.on("command", this.#onCommand);
    document.on("invalidated", this.#onInvalidated);
    document.on("loaded", this.#onLoaded);
  }

  init(): void {
    this.#rebuildAllChunks("init");
  }

  tick(
    _deltaTime: number
  ): void {
    const { world } = this.document;
    for (const { layer, chunk } of world.getAllChunksToBeRemoved()) {
      this.#removeChunk(layer, chunk);
    }

    const viewport = this.#viewport();

    this.#visibility.update(viewport);
    this.#enqueueDirtyChunks(viewport);
    this.#queue.drain(
      this.#rebuildBudgetMs,
      (layer, chunk) => this.#meshes.rebuild(layer, chunk)
    );
    this.#settleIdleWaiters();
  }

  flush(): void {
    this.#enqueueDirtyChunks(this.#viewport());
    this.#queue.drain(
      0,
      (layer, chunk) => this.#meshes.rebuild(layer, chunk)
    );
    this.#settleIdleWaiters();
  }

  get pendingRebuilds(): number {
    return this.#queue.size;
  }

  whenIdle(): Promise<void> {
    if (this.#isIdle()) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.#idleWaiters.push(resolve);
    });
  }

  get greedy(): boolean {
    return this.#meshBuilder.greedy;
  }

  set greedy(value: boolean) {
    if (value === this.#meshBuilder.greedy) {
      return;
    }

    this.#meshBuilder.greedy = value;
    this.#materials.tileWrapping = value;
    this.#materials.invalidate();
    this.#clearChunkMeshes();
    this.markAllChunksDirty("greedy");
  }

  get castShadow(): boolean {
    return this.#meshes.castShadow;
  }

  set castShadow(
    value: boolean
  ) {
    this.#meshes.castShadow = value;
  }

  get receiveShadow(): boolean {
    return this.#meshes.receiveShadow;
  }

  set receiveShadow(
    value: boolean
  ) {
    this.#meshes.receiveShadow = value;
  }

  loadTileset(
    def: TilesetDefinition,
    texture: TilesetTexture
  ): void {
    this.document.registerTileset(def);
    this.tilesets.registerTexture(def.id, texture);
    this.#logger.debug(
      `Loaded tileset '${def.id}' from '${def.src ?? def.asset?.id}'`
    );

    this.#materials.invalidate(def.id);
    this.markAllChunksDirty("loadTileset");
  }

  markAllChunksDirty(
    source?: string
  ): void {
    this.#logger.debug("Marking all chunks dirty...", { source });

    for (const { chunk } of this.document.world.getAllChunks()) {
      chunk.dirty = true;
    }
  }

  dispose(): void {
    this.#logger.debug("Disposing VoxelView.");
    this.document.off("command", this.#onCommand);
    this.document.off("invalidated", this.#onInvalidated);
    this.document.off("loaded", this.#onLoaded);
    this.#queue.clear();
    this.#clearChunkMeshes();
    this.inspector.dispose();
    this.#collider?.dispose();
    this.#materials.dispose();
    this.tilesets.dispose();
  }

  #isIdle(): boolean {
    if (this.#queue.size > 0) {
      return false;
    }

    const viewport = this.#viewport();
    for (const layer of this.document.world.getLayers()) {
      for (const chunk of layer.getDirtyChunks()) {
        if (viewport.contains(layer, chunk, false)) {
          return false;
        }
      }
    }

    return true;
  }

  #settleIdleWaiters(): void {
    if (this.#idleWaiters.length === 0 || !this.#isIdle()) {
      return;
    }

    for (const resolve of this.#idleWaiters.splice(0)) {
      resolve();
    }
  }

  #viewport(): ChunkViewport {
    return new ChunkViewport({
      focus: this.focus,
      viewDistance: this.viewDistance,
      policy: this.viewDistancePolicy,
      chunkSize: this.document.world.chunkSize
    });
  }

  #enqueueDirtyChunks(
    viewport: ChunkViewport
  ): void {
    let grew = false;

    for (const { layer, chunk } of this.document.world.getAllDirtyChunks()) {
      if (!viewport.contains(layer, chunk, false)) {
        continue;
      }

      chunk.dirty = false;
      if (!layer.visible || layer.opacity === 0) {
        if (layer.wasVisible) {
          this.#removeChunk(layer, chunk);
        }

        continue;
      }

      grew = this.#queue.push(layer, chunk) || grew;
    }

    if (viewport.focus === null) {
      return;
    }

    if (grew || this.#queue.focusMovedSinceSort(viewport)) {
      this.#queue.sortBy(viewport);
    }
  }

  #removeChunk(
    layer: VoxelLayer,
    chunk: VoxelChunk,
    options: { collider?: boolean; } = {}
  ): void {
    this.#queue.cancel(chunk);
    this.#meshes.remove(layer, chunk, options);
  }

  #clearChunkMeshes(): void {
    this.#meshes.clear();
    this.#visibility.reset();
  }

  #rebuildAllChunks(
    source?: string
  ): void {
    this.#logger.debug("Rebuilding all chunks...", { source });

    this.#queue.clear();
    this.markAllChunksDirty(source);
    this.flush();
  }

  #syncAtlases(): void {
    for (const tilesetId of this.tilesets.syncAtlases()) {
      this.#materials.invalidate(tilesetId);
    }
  }

  #registerTilesets(
    sources: Iterable<TilesetSource> = []
  ): void {
    for (const { def, texture } of sources) {
      if (!this.tilesets.get(def.id)) {
        this.document.registerTileset(def);
        this.tilesets.registerTexture(def.id, texture);
      }
    }
  }
}
