// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { BlockRegistry } from "./blocks/BlockRegistry.ts";
import { BlockShapeRegistry } from "./blocks/BlockShapeRegistry.ts";
import type { VoxelCollider } from "./collision/VoxelCollider.ts";
import { VoxelDebugger } from "./debug/VoxelDebugger.ts";
import { VoxelMeshBuilder } from "./mesh/index.ts";
import { ChunkMaterialCache } from "./render/ChunkMaterialCache.ts";
import { ChunkMeshStore } from "./render/ChunkMeshStore.ts";
import { ChunkRebuildQueue } from "./render/ChunkRebuildQueue.ts";
import { ChunkViewport } from "./render/ChunkViewport.ts";
import { ChunkVisibility } from "./render/ChunkVisibility.ts";
import {
  deserializeVoxelWorld,
  serializeVoxelWorld
} from "./serialization/world.ts";
import type { VoxelWorldJSON } from "./serialization/types.ts";
import { TilesetManager } from "./tileset/TilesetManager.ts";
import type { TilesetDefinition } from "./tileset/types.ts";
import type { TilesetSource } from "./tileset/loadTilesets.ts";
import { VoxelWorld } from "./world/VoxelWorld.ts";
import type { VoxelLayer } from "./world/VoxelLayer.ts";
import type { VoxelChunk } from "./world/VoxelChunk.ts";
import { ViewDistance } from "./world/ViewDistance.ts";
import type { VoxelLayerHookEvent, VoxelLayerHookListener } from "./hooks.ts";
import { NOOP_LOGGER, type VoxelLogger } from "./utils/logger.ts";
import type {
  VoxelEngineOptions,
  VoxelLoadOptions,
  ViewDistancePolicy
} from "./VoxelEngine.types.ts";

/**
 * Owns a voxel world and its chunked Three.js meshes.
 */
export class VoxelEngine {
  readonly root = new THREE.Group();

  readonly world: VoxelWorld;
  readonly blockRegistry: BlockRegistry;
  readonly shapeRegistry: BlockShapeRegistry;
  readonly tilesetManager: TilesetManager;

  readonly debug: VoxelDebugger;

  focus: THREE.Vector3Like | null = null;
  viewDistance: ViewDistance;
  viewDistancePolicy: ViewDistancePolicy;

  #meshBuilder: VoxelMeshBuilder;
  #materials: ChunkMaterialCache;
  #meshes: ChunkMeshStore;
  #queue = new ChunkRebuildQueue();
  #visibility: ChunkVisibility;
  #collider: VoxelCollider | null;
  #rebuildBudgetMs: number;
  #logger: VoxelLogger;

  constructor(
    options: VoxelEngineOptions = {}
  ) {
    const {
      chunkSize = 16,
      material = "lambert",
      materialCustomizer,
      layers = [],
      collider,
      blocks = [],
      shapes = [],
      alphaTest = 0.1,
      logger = NOOP_LOGGER,
      onLayerUpdated,
      debug,
      tilesetPadding,
      tilesets,
      greedy = false,
      rebuildBudgetMs = 8,
      viewDistance,
      viewDistancePolicy = "hide"
    } = options;

    this.root.name = "VoxelEngine";
    this.debug = new VoxelDebugger(this.root, debug);

    this.#rebuildBudgetMs = rebuildBudgetMs;
    this.viewDistance = viewDistance === undefined ?
      ViewDistance.Unlimited :
      ViewDistance.from(viewDistance);
    this.viewDistancePolicy = viewDistancePolicy;
    this.#logger = logger.child({
      namespace: "VoxelEngine"
    });

    this.world = new VoxelWorld(chunkSize);
    this.world.onLayerUpdated = onLayerUpdated;
    layers.forEach((name) => this.world.addLayer(name));

    this.blockRegistry = new BlockRegistry(blocks);
    this.shapeRegistry = BlockShapeRegistry
      .createDefault();
    shapes.forEach(
      (shape) => this.shapeRegistry.register(shape)
    );

    this.tilesetManager = new TilesetManager({ padding: tilesetPadding });
    this.#registerTilesets(tilesets);

    this.#meshBuilder = new VoxelMeshBuilder({
      world: this.world,
      blockRegistry: this.blockRegistry,
      shapeRegistry: this.shapeRegistry,
      tilesetManager: this.tilesetManager,
      greedy
    });

    this.#collider = collider?.({
      blockRegistry: this.blockRegistry,
      shapeRegistry: this.shapeRegistry
    }) ?? null;

    this.#materials = new ChunkMaterialCache({
      tilesetManager: this.tilesetManager,
      type: material,
      alphaTest,
      customizer: materialCustomizer,
      tileWrapping: greedy
    });
    this.#meshes = new ChunkMeshStore({
      root: this.root,
      meshBuilder: this.#meshBuilder,
      materials: this.#materials,
      debug: this.debug,
      collider: this.#collider,
      logger: this.#logger
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
  }

  init(): void {
    this.#rebuildAllChunks("init");
  }

  tick(
    _deltaTime: number
  ): void {
    for (const { layer, chunk } of this.world.getAllChunksToBeRemoved()) {
      this.#removeChunk(layer, chunk);
    }

    const viewport = this.#viewport();

    this.#visibility.update(viewport);
    this.#enqueueDirtyChunks(viewport);
    this.#queue.drain(
      this.#rebuildBudgetMs,
      (layer, chunk) => this.#meshes.rebuild(layer, chunk)
    );
  }

  /**
   * Rebuilds all queued and dirty chunks without applying the tick budget.
   */
  flush(): void {
    this.#enqueueDirtyChunks(this.#viewport());
    this.#queue.drain(
      0,
      (layer, chunk) => this.#meshes.rebuild(layer, chunk)
    );
  }

  get pendingRebuilds(): number {
    return this.#queue.size;
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

  get onLayerUpdated(): VoxelLayerHookListener | undefined {
    return this.world.onLayerUpdated;
  }

  set onLayerUpdated(fn: VoxelLayerHookListener | undefined) {
    this.world.onLayerUpdated = fn;
  }

  applyRemoteCommand(
    cmd: VoxelLayerHookEvent
  ): void {
    this.world.applyRemoteCommand(cmd);
  }

  loadTileset(
    def: TilesetDefinition,
    texture: THREE.Texture<HTMLImageElement>
  ): void {
    this.tilesetManager.registerTexture(def, texture);
    this.#logger.debug(`Loaded tileset '${def.id}' from '${def.src}'`);

    this.#materials.invalidate(def.id);
    this.markAllChunksDirty("loadTileset");
  }

  save(): VoxelWorldJSON {
    this.#logger.debug("Serializing world to JSON...");

    return serializeVoxelWorld(this.world, {
      tilesets: this.tilesetManager.definitions(),
      blocks: this.blockRegistry
    });
  }

  load(
    data: VoxelWorldJSON,
    options: VoxelLoadOptions = {}
  ): void {
    this.#clearChunkMeshes();
    this.#logger.debug("Cleared existing chunk meshes while loading new world.");

    this.world.silently(
      () => deserializeVoxelWorld(data, this.world, {
        blocks: this.blockRegistry
      })
    );

    this.#registerTilesets(options.tilesets);
    for (const tilesetDef of data.tilesets) {
      if (!this.tilesetManager.has(tilesetDef.id)) {
        throw new Error(
          `VoxelEngine.load(): tileset '${tilesetDef.id}' is not registered. ` +
          "Pass it through loadTilesets() first."
        );
      }
    }

    this.#materials.invalidate();

    if (options.mergeLayers) {
      this.world.mergeAllLayers();
    }

    this.#rebuildAllChunks("load");
  }

  markAllChunksDirty(
    source?: string
  ): void {
    this.#logger.debug("Marking all chunks dirty...", { source });

    for (const { chunk } of this.world.getAllChunks()) {
      chunk.dirty = true;
    }
  }

  dispose(): void {
    this.#logger.debug("Disposing VoxelEngine.");
    this.#queue.clear();
    this.#clearChunkMeshes();
    this.debug.dispose();
    this.#collider?.dispose();
    this.#materials.dispose();
    this.tilesetManager.dispose();
  }

  #viewport(): ChunkViewport {
    return new ChunkViewport({
      focus: this.focus,
      viewDistance: this.viewDistance,
      policy: this.viewDistancePolicy,
      chunkSize: this.world.chunkSize
    });
  }

  #enqueueDirtyChunks(
    viewport: ChunkViewport
  ): void {
    let grew = false;

    for (const { layer, chunk } of this.world.getAllDirtyChunks()) {
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

  #registerTilesets(
    sources: Iterable<TilesetSource> = []
  ): void {
    for (const { def, texture } of sources) {
      if (!this.tilesetManager.has(def.id)) {
        this.tilesetManager.registerTexture(def, texture);
      }
    }
  }
}
