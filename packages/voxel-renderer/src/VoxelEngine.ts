/* eslint-disable max-lines */
// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  BlockRegistry
} from "./blocks/BlockRegistry.ts";
import type {
  BlockDefinition
} from "./blocks/BlockDefinition.ts";
import {
  BlockShapeRegistry
} from "./blocks/BlockShapeRegistry.ts";
import type {
  BlockShape
} from "./blocks/BlockShape.ts";
import type {
  VoxelCollider,
  VoxelColliderFactory
} from "./collision/VoxelCollider.ts";
import {
  VoxelDebugger,
  type VoxelDebuggerOptions
} from "./debug/VoxelDebugger.ts";
import { VoxelMeshBuilder } from "./mesh/VoxelMeshBuilder.ts";
import { parseChunkGeometryKey } from "./mesh/chunkGeometryKey.ts";
import {
  VoxelSerializer,
  type VoxelWorldJSON,
  type VoxelObjectLayerJSON,
  type VoxelObjectJSON
} from "./serialization/VoxelSerializer.ts";
import {
  TilesetManager,
  type TilesetDefinition
} from "./tileset/TilesetManager.ts";
import type { TilesetLoader } from "./tileset/TilesetLoader.ts";
import { enableTileWrapping } from "./tileset/tileWrapping.ts";
import { VoxelWorld } from "./world/VoxelWorld.ts";
import {
  VoxelLayer,
  type VoxelLayerConfigurableOptions,
  type VoxelLayerOptions
} from "./world/VoxelLayer.ts";
import { VoxelChunk } from "./world/VoxelChunk.ts";
import type { VoxelEntry, VoxelCoord } from "./world/types.ts";
import {
  packTransform,
  FACE_OFFSETS,
  type FACE
} from "./utils/math.ts";
import type {
  VoxelLayerHookListener,
  VoxelLayerHookEvent
} from "./hooks.ts";
import type { VoxelSetOptions, VoxelRemoveOptions, PartialExcept } from "./types.ts";

export type { VoxelSetOptions, VoxelRemoveOptions };

// CONSTANTS
/**
 * Thirty-two translucent buckets plus one fully opaque material per tileset.
 */
const kOpacitySteps = 32;

export interface VoxelLoadOptions {
  /**
   * Collapses layers before rendering; higher-priority voxels win overlaps.
   */
  mergeLayers?: boolean;
}

type MaterialCustomizerFn = (
  material: THREE.MeshLambertMaterial | THREE.MeshStandardMaterial,
  tilesetId: string
) => void;

export const VoxelRotation = {
  None: 0,
  CCW90: 1,
  Deg180: 2,
  CW90: 3
} as const;

/**
 * Logger shape kept independent from the engine package's concrete logger.
 */
export interface VoxelLogger {
  child(options: { namespace: string; }): VoxelLogger;
  debug(msg: string, meta?: Record<string, unknown>): void;
}

const kNoopLogger: VoxelLogger = {
  child() {
    return kNoopLogger;
  },
  debug() {
    // Intentionally empty.
  }
};

export interface VoxelEngineOptions {
  /**
   * @default 16
   */
  chunkSize?: number;
  /**
   * Collision factory called once with the registries; disabled when omitted.
   */
  collider?: VoxelColliderFactory;
  /**
   * Chunk material type.
   * @default "lambert"
   */
  material?: "lambert" | "standard";

  /**
   * Called once for each new material with its tileset ID.
   */
  materialCustomizer?: MaterialCustomizerFn;

  layers?: string[];
  /**
   * Initial block definitions; block ID 0 is reserved for air.
   */
  blocks?: BlockDefinition[];
  /**
   * Shapes registered after the defaults from `BlockShapeRegistry`.
   */
  shapes?: BlockShape[];
  /**
   * Alpha-test cutoff; 0 disables fragment discards.
   * @default 0.1
   */
  alphaTest?: number;

  /**
   * Debug logger; defaults to a no-op implementation.
   */
  logger?: VoxelLogger;

  /**
   * Receives local layer mutations for external synchronization.
   */
  onLayerUpdated?: VoxelLayerHookListener;

  /**
   * Initial debug view; counters are collected in every mode.
   */
  debug?: VoxelDebuggerOptions;

  /**
   * Atlas gutter in texels; 0 disables padding.
   * @default half the tile size, clamped to 2..8
   */
  tilesetPadding?: number;

  /**
   * Enables greedy merging; incompatible with custom UV shader compilation.
   * @default false
   */
  greedy?: boolean;

  /**
   * Preloaded tilesets registered synchronously during construction.
   */
  tilesetLoader?: TilesetLoader;

  /**
   * Per-tick rebuild budget in milliseconds; 0 drains the queue.
   * @default 8
   */
  rebuildBudgetMs?: number;
}

interface PendingRebuild {
  layer: VoxelLayer;
  chunk: VoxelChunk;
}

/**
 * Owns a voxel world and its chunked Three.js meshes.
 */
export class VoxelEngine {
  /**
   * Scene group that owns every generated chunk mesh.
   */
  readonly root = new THREE.Group();

  readonly world: VoxelWorld;
  readonly blockRegistry: BlockRegistry;
  readonly shapeRegistry: BlockShapeRegistry;
  readonly tilesetManager: TilesetManager;
  readonly serializer: VoxelSerializer;

  readonly debug: VoxelDebugger;

  /**
   * Optional world-space point used to prioritize nearby chunk rebuilds.
   */
  rebuildFocus: THREE.Vector3Like | null = null;

  #meshBuilder: VoxelMeshBuilder;
  #collider: VoxelCollider | null = null;

  /**
   * Deferred chunks; membership in `#queuedChunks` is authoritative.
   */
  #rebuildQueue: PendingRebuild[] = [];
  #queuedChunks = new Set<VoxelChunk>();
  #rebuildBudgetMs: number;

  /**
   * Chunk key to one mesh per tileset used by that chunk.
   */
  #chunkMeshes = new Map<string, THREE.Mesh[]>();

  /**
   * Lazily created materials keyed by tileset, opacity bucket, and cutout mode.
   */
  #materials = new Map<
    string,
    THREE.MeshLambertMaterial | THREE.MeshStandardMaterial
  >();
  #materialCustomizer?: MaterialCustomizerFn;
  #materialType: "lambert" | "standard";
  #alphaTest: number;

  #tilesetLoader: TilesetLoader | null;
  #logger: VoxelLogger;
  #onLayerUpdated?: VoxelLayerHookListener;

  #isApplyingRemote = false;

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
      logger = kNoopLogger,
      onLayerUpdated,
      debug,
      tilesetPadding,
      tilesetLoader,
      greedy = false,
      rebuildBudgetMs = 8
    } = options;

    this.root.name = "VoxelEngine";
    this.debug = new VoxelDebugger(this.root, debug);

    this.#materialType = material;
    this.#materialCustomizer = materialCustomizer;
    this.#alphaTest = alphaTest;
    this.#rebuildBudgetMs = rebuildBudgetMs;
    this.#onLayerUpdated = onLayerUpdated;
    this.#logger = logger.child({
      namespace: "VoxelEngine"
    });

    this.world = new VoxelWorld(chunkSize);
    if (layers.length > 0) {
      layers.forEach((name) => this.addLayer(name));
    }

    this.blockRegistry = new BlockRegistry(blocks);
    this.shapeRegistry = BlockShapeRegistry
      .createDefault();
    shapes.forEach(
      (shape) => this.shapeRegistry.register(shape)
    );

    this.tilesetManager = new TilesetManager({ padding: tilesetPadding });
    this.#tilesetLoader = tilesetLoader ?? null;
    if (tilesetLoader) {
      for (const entry of tilesetLoader.tilesets.values()) {
        this.tilesetManager.registerTexture(entry.def, entry.texture);
      }
    }
    this.serializer = new VoxelSerializer();

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

    this.#enqueueDirtyChunks();
    this.#drainRebuildQueue(this.#rebuildBudgetMs);
  }

  /**
   * Rebuilds all queued and dirty chunks without applying the tick budget.
   */
  flush(): void {
    this.#enqueueDirtyChunks();
    this.#drainRebuildQueue(0);
  }

  get pendingRebuilds(): number {
    return this.#queuedChunks.size;
  }

  /**
   * Clears dirty flags before queuing so later edits can dirty a chunk again.
   */
  #enqueueDirtyChunks(): void {
    const before = this.#rebuildQueue.length;

    for (const { layer, chunk } of this.world.getAllDirtyChunks()) {
      chunk.dirty = false;

      // Zero opacity removes the layer from rendering and compositing.
      if (!layer.visible || layer.opacity === 0) {
        if (layer.wasVisible) {
          this.#removeChunk(layer, chunk);
        }

        continue;
      }

      if (!this.#queuedChunks.has(chunk)) {
        this.#queuedChunks.add(chunk);
        this.#rebuildQueue.push({ layer, chunk });
      }
    }

    if (this.rebuildFocus !== null && this.#rebuildQueue.length !== before) {
      this.#sortRebuildQueue();
    }
  }

  /**
   * Rebuilds at least one chunk, then stops when the positive budget is spent.
   */
  #drainRebuildQueue(
    budgetMs: number
  ): void {
    const queue = this.#rebuildQueue;
    if (queue.length === 0) {
      return;
    }

    const deadline = budgetMs > 0 ? performance.now() + budgetMs : Infinity;
    let index = 0;

    while (index < queue.length) {
      const { layer, chunk } = queue[index++];
      if (!this.#queuedChunks.delete(chunk)) {
        continue;
      }

      this.#rebuildChunk(layer, chunk);

      if (performance.now() >= deadline) {
        break;
      }
    }

    this.#rebuildQueue = index < queue.length ? queue.slice(index) : [];
  }

  #sortRebuildQueue(): void {
    const focus = this.rebuildFocus!;
    const { chunkSize } = this.world;
    const half = chunkSize / 2;

    this.#rebuildQueue.sort((a, b) => squaredDistance(a, focus, chunkSize, half) -
      squaredDistance(b, focus, chunkSize, half));
  }

  dispose(): void {
    this.#logger.debug("Disposing VoxelEngine.");
    this.#rebuildQueue = [];
    this.#queuedChunks.clear();
    // Mesh geometries are owned here; materials are shared per tileset.
    this.#disposeChunkMeshes();
    this.debug.dispose();
    this.#collider?.dispose();

    for (const mat of this.#materials.values()) {
      mat.dispose();
    }
    this.#materials.clear();

    this.tilesetManager.dispose();
  }

  get greedy(): boolean {
    return this.#meshBuilder.greedy;
  }

  /**
   * Changes meshing mode and invalidates all geometry and materials.
   */
  set greedy(value: boolean) {
    if (value === this.#meshBuilder.greedy) {
      return;
    }

    this.#meshBuilder.greedy = value;
    for (const material of this.#materials.values()) {
      material.dispose();
    }
    this.#materials.clear();
    this.#disposeChunkMeshes();
    this.markAllChunksDirty("greedy");
  }

  get onLayerUpdated(): VoxelLayerHookListener | undefined {
    return this.#onLayerUpdated;
  }

  set onLayerUpdated(fn: VoxelLayerHookListener | undefined) {
    this.#onLayerUpdated = fn;
  }

  #emitHook(event: VoxelLayerHookEvent): void {
    if (this.#isApplyingRemote) {
      return;
    }
    this.#onLayerUpdated?.(event);
  }

  #dispatchCommand(event: VoxelLayerHookEvent): void {
    switch (event.action) {
      case "added":
        this.addLayer(event.layerName, event.metadata.options);
        break;

      case "removed":
        this.removeLayer(event.layerName);
        break;

      case "updated":
        this.updateLayer(event.layerName, event.metadata.options);
        break;

      case "offset-updated":
        if ("offset" in event.metadata) {
          this.setLayerOffset(event.layerName, event.metadata.offset);
        }
        else {
          this.translateLayer(event.layerName, event.metadata.delta);
        }
        break;

      case "voxel-set": {
        const { position, blockId, rotation, flipX, flipZ, flipY } = event.metadata;
        this.setVoxel(event.layerName, {
          position,
          blockId,
          rotation: rotation as 0 | 1 | 2 | 3,
          flipX,
          flipZ,
          flipY
        });
        break;
      }

      case "voxel-removed":
        this.removeVoxel(event.layerName, { position: event.metadata.position });
        break;

      case "voxels-set":
        this.setVoxelBulk(event.layerName, event.metadata.entries);
        break;

      case "voxels-removed":
        this.removeVoxelBulk(event.layerName, event.metadata.entries);
        break;

      case "reordered":
        this.moveLayer(event.layerName, event.metadata.direction);
        break;

      case "object-layer-added":
        this.addObjectLayer(event.layerName);
        break;

      case "object-layer-removed":
        this.removeObjectLayer(event.layerName);
        break;

      case "object-layer-updated":
        this.updateObjectLayer(event.layerName, event.metadata.patch);
        break;

      case "object-added":
        this.addObject(event.layerName, event.metadata.object);
        break;

      case "object-removed":
        this.removeObject(event.layerName, event.metadata.objectId);
        break;

      case "object-updated":
        this.updateObject(
          event.layerName,
          event.metadata.objectId,
          event.metadata.patch
        );
        break;
    }
  }

  /**
   * Applies a remote command without re-emitting it through the local hook.
   */
  applyRemoteCommand(cmd: VoxelLayerHookEvent): void {
    this.#isApplyingRemote = true;
    try {
      this.#dispatchCommand(cmd);
    }
    finally {
      this.#isApplyingRemote = false;
    }
  }

  /**
   * Places a voxel; rotation uses 0..3 quarter-turns around Y.
   */
  setVoxel(
    layerName: string,
    options: VoxelSetOptions
  ): void {
    const {
      position,
      blockId,
      rotation = 0,
      flipX = false,
      flipZ = false,
      flipY = false
    } = options;
    const transform = packTransform(rotation, flipX, flipZ, flipY);

    this.world.setVoxelAt(
      layerName,
      position,
      { blockId, transform }
    );
    this.#emitHook({
      action: "voxel-set",
      layerName,
      metadata: { position, blockId, rotation, flipX, flipZ, flipY }
    });
  }

  removeVoxel(
    layerName: string,
    options: VoxelRemoveOptions
  ): void {
    this.world.removeVoxelAt(layerName, options.position);
    this.#emitHook({
      action: "voxel-removed",
      layerName,
      metadata: { position: options.position }
    });
  }

  setVoxelBulk(
    layerName: string,
    entries: VoxelSetOptions[]
  ): void {
    for (const {
      position,
      blockId,
      rotation = 0,
      flipX = false,
      flipZ = false,
      flipY = false
    } of entries) {
      this.world.setVoxelAt(
        layerName,
        position,
        { blockId, transform: packTransform(rotation, flipX, flipZ, flipY) }
      );
    }
    this.#emitHook({
      action: "voxels-set",
      layerName,
      metadata: { entries }
    });
  }

  removeVoxelBulk(
    layerName: string,
    entries: VoxelRemoveOptions[]
  ): void {
    for (const { position } of entries) {
      this.world.removeVoxelAt(layerName, position);
    }
    this.#emitHook({
      action: "voxels-removed",
      layerName,
      metadata: { entries }
    });
  }

  getVoxel(position: THREE.Vector3Like): VoxelEntry | undefined;
  getVoxel(layerName: string, position: THREE.Vector3Like): VoxelEntry | undefined;
  getVoxel(
    posOrLayer: THREE.Vector3Like | string,
    posArg?: THREE.Vector3Like
  ): VoxelEntry | undefined {
    if (typeof posOrLayer === "string") {
      return this.world.getLayer(posOrLayer)?.getVoxelAt(posArg!);
    }

    return this.world.getVoxelAt(posOrLayer);
  }

  getVoxelNeighbour(position: THREE.Vector3Like, face: FACE): VoxelEntry | undefined;
  getVoxelNeighbour(layerName: string, position: THREE.Vector3Like, face: FACE): VoxelEntry | undefined;
  getVoxelNeighbour(
    posOrLayer: THREE.Vector3Like | string,
    faceOrPos: FACE | THREE.Vector3Like,
    faceArg?: FACE
  ): VoxelEntry | undefined {
    if (typeof faceOrPos === "number") {
      return this.world.getVoxelNeighbour(
        posOrLayer as THREE.Vector3Like,
        faceOrPos
      );
    }

    const offset = FACE_OFFSETS[faceArg!];

    return this.world.getLayer(posOrLayer as string)?.getVoxelAt({
      x: faceOrPos.x + offset[0],
      y: faceOrPos.y + offset[1],
      z: faceOrPos.z + offset[2]
    });
  }

  getLayer(
    name: string
  ): VoxelLayer | undefined {
    return this.world.getLayer(name);
  }

  cloneLayer(name: string, options: PartialExcept<VoxelLayerOptions, "name">): VoxelLayer | undefined {
    const clone = this.world.cloneLayer(name, options);
    if (!clone) {
      return undefined;
    }

    this.#emitHook({
      action: "cloned",
      layerName: name,
      metadata: { options }
    });

    return clone;
  }

  mergeLayer(
    sourceLayerName: string,
    targetLayerName: string
  ): boolean {
    const merged = this.world.mergeLayer(sourceLayerName, targetLayerName);
    if (!merged) {
      return false;
    }

    this.#emitHook({
      action: "merged",
      layerName: sourceLayerName,
      metadata: { targetLayerName }
    });

    return true;
  }

  addLayer(
    name: string,
    options: VoxelLayerConfigurableOptions = {}
  ): VoxelLayer {
    const layer = this.world.addLayer(name, options);
    this.#emitHook({
      action: "added",
      layerName: name,
      metadata: { options }
    });

    return layer;
  }

  updateLayer(
    name: string,
    options: Partial<VoxelLayerConfigurableOptions>
  ): boolean {
    const result = this.world.updateLayer(name, options);
    if (result) {
      this.#emitHook({
        action: "updated",
        layerName: name,
        metadata: { options }
      });
    }

    return result;
  }

  removeLayer(
    name: string
  ): boolean {
    const result = this.world.removeLayer(name);
    if (result) {
      this.#emitHook({
        action: "removed",
        layerName: name,
        metadata: {}
      });
    }

    return result;
  }

  setLayerOffset(
    name: string,
    offset: VoxelCoord
  ): void {
    this.world.setLayerOffset(name, offset);
    this.#emitHook({
      action: "offset-updated",
      layerName: name,
      metadata: { offset }
    });
  }

  translateLayer(
    name: string,
    delta: VoxelCoord
  ): void {
    this.world.translateLayer(name, delta);
    this.#emitHook({
      action: "offset-updated",
      layerName: name,
      metadata: { delta }
    });
  }

  moveLayer(
    name: string,
    direction: "up" | "down"
  ): void {
    this.world.moveLayer(name, direction);
    this.markAllChunksDirty("moveLayer");
    this.#emitHook({
      action: "reordered",
      layerName: name,
      metadata: { direction }
    });
  }

  getLayerCenter(
    name: string
  ): THREE.Vector3 | null {
    const layer = this.world.getLayer(name);
    if (!layer) {
      return null;
    }

    return layer.centerToWorld();
  }

  addObjectLayer(
    name: string,
    options?: Partial<Pick<VoxelObjectLayerJSON, "visible" | "order">>
  ): VoxelObjectLayerJSON {
    const layer = this.world.addObjectLayer(name, options);
    this.#emitHook({
      action: "object-layer-added",
      layerName: name,
      metadata: {}
    });

    return layer;
  }

  removeObjectLayer(
    name: string
  ): boolean {
    const result = this.world.removeObjectLayer(name);
    if (result) {
      this.#emitHook({
        action: "object-layer-removed",
        layerName: name,
        metadata: {}
      });
    }

    return result;
  }

  getObjectLayer(
    name: string
  ): VoxelObjectLayerJSON | undefined {
    return this.world.getObjectLayer(name);
  }

  getObjectLayers(): readonly VoxelObjectLayerJSON[] {
    return this.world.getObjectLayers();
  }

  updateObjectLayer(
    name: string,
    patch: Partial<Pick<VoxelObjectLayerJSON, "visible">>
  ): boolean {
    const result = this.world.updateObjectLayer(name, patch);
    if (result) {
      this.#emitHook({
        action: "object-layer-updated",
        layerName: name,
        metadata: { patch }
      });
    }

    return result;
  }

  addObject(
    layerName: string,
    object: VoxelObjectJSON
  ): boolean {
    const result = this.world.addObjectToLayer(layerName, object);
    if (result) {
      this.#emitHook({
        action: "object-added",
        layerName,
        metadata: { object }
      });
    }

    return result;
  }

  removeObject(
    layerName: string,
    objectId: string
  ): boolean {
    const result = this.world.removeObjectFromLayer(layerName, objectId);
    if (result) {
      this.#emitHook({
        action: "object-removed",
        layerName,
        metadata: { objectId }
      });
    }

    return result;
  }

  updateObject(
    layerName: string,
    objectId: string,
    patch: Partial<VoxelObjectJSON>
  ): boolean {
    const result = this.world.updateObjectInLayer(layerName, objectId, patch);
    if (result) {
      this.#emitHook({
        action: "object-updated",
        layerName,
        metadata: { objectId, patch }
      });
    }

    return result;
  }

  loadTileset(
    def: TilesetDefinition,
    texture: THREE.Texture<HTMLImageElement>
  ): void {
    this.tilesetManager.registerTexture(def, texture);
    this.#logger.debug(`Loaded tileset '${def.id}' from '${def.src}'`);

    // Material keys share the tileset ID prefix across opacity variants.
    const prefix = `${def.id}:`;
    for (const [key, material] of this.#materials) {
      if (key.startsWith(prefix)) {
        material.dispose();
        this.#materials.delete(key);
      }
    }

    this.markAllChunksDirty("loadTileset");
  }

  save(): VoxelWorldJSON {
    this.#logger.debug("Serializing world to JSON...");

    return {
      ...this.serializer.serialize(
        this.world,
        this.tilesetManager
      ),
      blocks: [...this.blockRegistry]
    };
  }

  load(
    data: VoxelWorldJSON,
    options: VoxelLoadOptions = {}
  ): void {
    this.#disposeChunkMeshes();
    this.#logger.debug("Cleared existing chunk meshes while loading new world.");

    // Existing registrations override definitions embedded by converters.
    if (data.blocks) {
      for (const blockDef of data.blocks) {
        if (!this.blockRegistry.has(blockDef.id)) {
          this.blockRegistry.register(blockDef);
        }
      }
    }

    this.serializer.deserialize(data, this.world);

    for (const tilesetDef of data.tilesets) {
      if (this.tilesetManager.getTexture(tilesetDef.id)) {
        continue;
      }
      const entry = this.#tilesetLoader?.tilesets.get(tilesetDef.id);
      if (!entry) {
        throw new Error(
          `VoxelEngine.load(): tileset '${tilesetDef.id}' is not pre-loaded. ` +
          "Call TilesetLoader.fromWorld() before constructing VoxelEngine."
        );
      }
      this.tilesetManager.registerTexture(entry.def, entry.texture);
    }

    for (const mat of this.#materials.values()) {
      mat.dispose();
    }
    this.#materials.clear();

    if (options.mergeLayers) {
      this.world.mergeAllLayers();
    }

    this.#rebuildAllChunks("load");
  }

  /**
   * Quantizes opacity while reserving the top bucket for exactly opaque layers.
   */
  #opacityBucket(
    opacity: number
  ): number {
    if (opacity >= 1) {
      return kOpacitySteps;
    }

    return Math.min(
      kOpacitySteps - 1,
      Math.max(0, Math.round(opacity * kOpacitySteps))
    );
  }

  /**
   * Applies layer opacity through shared materials without a vertex color.
   */
  #getMaterial(
    tilesetId: string,
    opacity: number,
    cutout = false
  ): THREE.MeshLambertMaterial | THREE.MeshStandardMaterial {
    const bucket = this.#opacityBucket(opacity);
    const key = `${tilesetId}:${bucket}${cutout ? ":cutout" : ""}`;
    this.#logger.debug(`Getting material for tileset '${tilesetId}' (opacity=${opacity})`);

    let material = this.#materials.get(key);
    if (material) {
      return material;
    }

    const texture = this.tilesetManager.getTexture(
      tilesetId
    ) ?? null;
    const transparent = bucket < kOpacitySteps;

    const materialOptions = {
      map: texture,
      // Transparent and cutout geometry exposes both sides of a surface.
      side: transparent || cutout ? THREE.DoubleSide : THREE.FrontSide,
      alphaTest: this.#alphaTest,
      opacity: bucket / kOpacitySteps,
      transparent,
      // Depth writes would hide translucent faces that should blend.
      depthWrite: !transparent
    };

    if (this.#materialType === "standard") {
      material = new THREE.MeshStandardMaterial(materialOptions);
    }
    else {
      material = new THREE.MeshLambertMaterial(materialOptions);
    }

    // Greedy quads need tile-local UV repetition.
    if (this.#meshBuilder.greedy) {
      enableTileWrapping(material);
    }
    this.#materialCustomizer?.(material, tilesetId);

    this.#materials.set(key, material);

    return material;
  }

  /**
   * Disposes chunk meshes while retaining materials owned by `#materials`.
   */
  #disposeChunkMeshes(): void {
    this.debug.clear();

    for (const meshes of this.#chunkMeshes.values()) {
      for (const mesh of meshes) {
        this.root.remove(mesh);
        mesh.geometry.dispose();
      }
    }
    this.#chunkMeshes.clear();
  }

  #removeChunk(
    layer: VoxelLayer,
    chunk: VoxelChunk
  ) {
    this.#queuedChunks.delete(chunk);

    const chunkKeyBase = `${layer.id}:${chunk.toString()}`;
    this.#logger.debug(
      `Removing chunk '${chunkKeyBase}' with layer name '${layer.name}'`
    );

    this.debug.unregisterChunk(chunkKeyBase);

    const meshes = this.#chunkMeshes.get(chunkKeyBase);
    if (meshes) {
      for (const mesh of meshes) {
        this.root.remove(mesh);
        mesh.geometry.dispose();
      }
      this.#chunkMeshes.delete(chunkKeyBase);
    }

    this.#collider?.removeChunk(chunkKeyBase);
  }

  #rebuildChunk(
    layer: VoxelLayer,
    chunk: VoxelChunk
  ): void {
    const chunkKeyBase = `${layer.id}:${chunk.toString()}`;
    this.#logger.debug(
      `Rebuilding chunk '${chunkKeyBase}' with layer name '${layer.name}'`
    );

    this.#removeChunk(layer, chunk);

    const geometries = this.#meshBuilder.buildChunkGeometries(chunk, layer);
    if (!geometries) {
      // Culled chunks still contribute voxel statistics.
      this.debug.registerChunk(chunkKeyBase, [], this.#meshBuilder.stats);

      return;
    }

    const { opacity } = layer;

    const meshes: THREE.Mesh[] = [];
    for (const [key, geometry] of geometries) {
      const { tilesetId, cutout } = parseChunkGeometryKey(key);
      const mesh = new THREE.Mesh(
        geometry,
        this.#getMaterial(tilesetId, opacity, cutout)
      );
      mesh.name = `voxel_chunk_${chunkKeyBase}:${key}`;

      this.root.add(mesh);
      meshes.push(mesh);
    }
    this.#chunkMeshes.set(chunkKeyBase, meshes);
    this.debug.registerChunk(chunkKeyBase, meshes, this.#meshBuilder.stats);

    if (this.#collider) {
      const layerOffset = layer.offset;
      this.#logger.debug(
        `Rebuilding collision for chunk '${chunkKeyBase}' with layer name '${layer.name}'`,
        { offset: layerOffset }
      );

      this.#collider.rebuildChunk(chunkKeyBase, {
        chunk,
        geometries,
        layerOffset
      });
    }
  }

  #rebuildAllChunks(
    source?: string
  ): void {
    this.#logger.debug("Rebuilding all chunks...", { source });

    this.#rebuildQueue = [];
    this.#queuedChunks.clear();

    for (const { layer, chunk } of this.world.getAllChunks()) {
      chunk.dirty = false;
      this.#rebuildChunk(layer, chunk);
    }
  }

  markAllChunksDirty(
    source?: string
  ): void {
    this.#logger.debug("Marking all chunks dirty...", { source });

    for (const { chunk } of this.world.getAllChunks()) {
      chunk.dirty = true;
    }
  }
}

function squaredDistance(
  pending: PendingRebuild,
  focus: THREE.Vector3Like,
  chunkSize: number,
  half: number
): number {
  const { chunk, layer } = pending;
  const dx = (chunk.cx * chunkSize) + half + layer.offset.x - focus.x;
  const dy = (chunk.cy * chunkSize) + half + layer.offset.y - focus.y;
  const dz = (chunk.cz * chunkSize) + half + layer.offset.z - focus.z;

  return (dx * dx) + (dy * dy) + (dz * dz);
}
