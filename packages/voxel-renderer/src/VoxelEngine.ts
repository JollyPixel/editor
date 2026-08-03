/* eslint-disable max-lines */
// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  BlockRegistry
} from "./blocks/BlockRegistry.ts";
import type {
  BlockDefinitionIn
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
 * Distinct layer opacities a tileset's materials are bucketed into, plus one
 * reserved bucket for fully opaque. Caps the material cache at 33 per tileset.
 */
const kOpacitySteps = 32;

export interface VoxelLoadOptions {
  /**
   * When true, all voxel layers are collapsed into one before rendering.
   * Higher-priority layers overwrite lower ones at the same world position.
   * Use this for runtime loading when multi-layer editing is not needed.
   */
  mergeLayers?: boolean;
}

type MaterialCustomizerFn = (
  material: THREE.MeshLambertMaterial | THREE.MeshStandardMaterial,
  tilesetId: string
) => void;

export const VoxelRotation = {
  /** No rotation (default). */
  None: 0,
  /** 90° counter-clockwise around the Y axis. */
  CCW90: 1,
  /** 180° around the Y axis. */
  Deg180: 2,
  /** 270° counter-clockwise (= 90° clockwise) around the Y axis. */
  CW90: 3
} as const;

/**
 * Structural logging interface so VoxelEngine never imports the concrete
 * `Systems.Logger` class from `@jolly-pixel/engine`. Any logger that satisfies
 * this shape (including `Systems.Logger`) can be passed in.
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
    // no-op
  }
};

export interface VoxelEngineOptions {
  /**
   * @default 16
   */
  chunkSize?: number;
  /**
   * Enables collision when provided, disabled by default so no physics backend
   * is required. Called once during construction with the registries.
   * See `plugins/rapier` for the bundled Rapier3D implementation.
   */
  collider?: VoxelColliderFactory;
  /**
   * @default "lambert"
   * The type of material to use for rendering chunks. "standard" supports
   * roughness and metalness maps but is more expensive to render; "lambert"
   * is faster but only supports a simple diffuse map.
   */
  material?: "lambert" | "standard";

  /**
   * Optional callback to customize each material after it is created.
   * Called with the material instance and the tileset ID it corresponds to
   */
  materialCustomizer?: MaterialCustomizerFn;

  /**
   * Optional list of layer names to create on initialization.
   */
  layers?: string[];
  /**
   * Optional initial block definitions to register.
   * Block ID 0 is reserved for air
   */
  blocks?: BlockDefinitionIn[];
  /**
   * Optional block shapes to register in addition to the default
   * shapes provided by BlockShapeRegistry.createDefault().
   */
  shapes?: BlockShape[];
  /**
   * Alpha value below which fragments are discarded (cutout transparency).
   * Set to 0 to disable alpha testing entirely (useful when your tileset tiles
   * have no transparency, or during debugging to confirm geometry is present).
   * @default 0.1
   */
  alphaTest?: number;

  /**
   * Optional logger instance for debug output.
   * Defaults to a no-op logger.
   */
  logger?: VoxelLogger;

  /**
   * Optional callback that is called whenever a layer is added, removed, or updated.
   * Useful for synchronizing external systems with changes to the voxel world.
   */
  onLayerUpdated?: VoxelLayerHookListener;

  /**
   * Initial state of the debug inspector (`engine.debug`). Mesh counters are
   * always collected; this only decides whether the wireframe is drawn from
   * the start.
   */
  debug?: VoxelDebuggerOptions;

  /**
   * Texels of edge-replicated gutter added around every tile of an atlas before
   * it is bound to a material. Prevents distant geometry from sampling
   * neighbouring tiles, which MSAA causes by shading partially covered pixels
   * outside the triangle. Set to 0 to render atlases untouched.
   * @default half the tile size, clamped to 2..8
   */
  tilesetPadding?: number;

  /**
   * Merge coplanar identical block faces into the largest quads possible
   * (greedy meshing) instead of emitting one quad per voxel face. Cuts the
   * triangle count by roughly 3× on terrain-like worlds; the win grows with how
   * flat and uniform the world is.
   *
   * Only faces that are a full unit quad on the block boundary merge — cubes,
   * slabs, the base and back of a ramp. Slopes, stair risers and poles keep
   * emitting one quad per voxel, so mixed worlds render identically either way.
   *
   * Chunk materials are compiled with a shader that repeats a single atlas tile
   * across a merged quad, which makes this incompatible with a
   * `materialCustomizer` that overrides `onBeforeCompile` or swaps `map` UVs.
   * Can be toggled at runtime through `engine.greedy`.
   * @default false
   */
  greedy?: boolean;

  /**
   * Optional pre-loaded tileset collection. All tilesets in the loader are
   * registered synchronously during construction so no async is needed inside
   * lifecycle methods. Use `TilesetLoader.fromTileDefinition()` or
   * `TilesetLoader.fromWorld()` before constructing `VoxelEngine`.
   */
  tilesetLoader?: TilesetLoader;

  /**
   * Milliseconds `tick()` may spend rebuilding dirty chunks before deferring
   * the rest to the next frame. A single edit dirties a handful of chunks, but
   * a layer offset drag or an opacity change dirties the whole world, which
   * without a budget lands as one multi-second stall.
   *
   * Set to 0 to rebuild every dirty chunk in the same tick. `flush()` ignores
   * the budget regardless.
   * @default 8
   */
  rebuildBudgetMs?: number;
}

/** One chunk waiting to be rebuilt, in the order `tick()` will get to it. */
interface PendingRebuild {
  layer: VoxelLayer;
  chunk: VoxelChunk;
}

/**
 * Engine-agnostic voxel world + chunked THREE.js mesh builder.
 */
export class VoxelEngine {
  /**
   * Container for every chunk mesh this engine builds. Attach this single
   * group to a scene graph (e.g. `actor.object3D.add(engine.root)`) — chunk
   * meshes are added/removed from it internally as chunks rebuild.
   */
  readonly root = new THREE.Group();

  readonly world: VoxelWorld;
  readonly blockRegistry: BlockRegistry;
  readonly shapeRegistry: BlockShapeRegistry;
  readonly tilesetManager: TilesetManager;
  readonly serializer: VoxelSerializer;

  /**
   * Live mesh statistics and wireframe visualization.
   * See `debug.stats` and `debug.mode`.
   */
  readonly debug: VoxelDebugger;

  /**
   * World-space point rebuilds are ordered around, nearest first — set it to
   * the camera position so what the user is looking at reappears first. Left
   * null the queue keeps world order.
   */
  rebuildFocus: THREE.Vector3Like | null = null;

  #meshBuilder: VoxelMeshBuilder;
  #collider: VoxelCollider | null = null;

  /**
   * Chunks whose rebuild has been deferred, and the set of chunks already in
   * it. The set is authoritative: `#removeChunk` drops entries from it and the
   * drain skips array entries it no longer holds, so a chunk unloaded while
   * queued is never rebuilt.
   */
  #rebuildQueue: PendingRebuild[] = [];
  #queuedChunks = new Set<VoxelChunk>();
  #rebuildBudgetMs: number;

  /**
   * "layerId:cx,cy,cz" → one THREE.Mesh per tileset the chunk uses
   * (separate draw call per texture).
   **/
  #chunkMeshes = new Map<string, THREE.Mesh[]>();

  /**
   * Up to two materials per tileset ID — one opaque, one translucent (keyed by
   * "tilesetId:opaque" / "tilesetId:transparent") — so a layer with opacity < 1
   * never forces an otherwise-fully-opaque layer sharing the same tileset onto
   * the transparent render queue. Created lazily; disposed on tileset reload or dispose.
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

  /**
   * When true, hook events are suppressed so that remote commands applied via
   * `applyRemoteCommand` do not re-broadcast to the transport layer.
   */
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

  // --- Lifecycle --- //

  /**
   * Builds initial meshes for all existing chunks (e.g. after deserialize).
   */
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
   * Rebuilds every queued and dirty chunk right now, ignoring the per-tick
   * budget. Use it when the meshes must exist before the next line runs — a
   * screenshot, a test assertion, an export.
   */
  flush(): void {
    this.#enqueueDirtyChunks();
    this.#drainRebuildQueue(0);
  }

  /** Chunks waiting on a deferred rebuild. 0 once the world is up to date. */
  get pendingRebuilds(): number {
    return this.#queuedChunks.size;
  }

  /**
   * Moves dirty chunks onto the rebuild queue, clearing the flag as it goes.
   *
   * The flag is cleared here rather than after the rebuild so an edit landing
   * between now and the rebuild re-dirties the chunk and is picked up next
   * tick, instead of being swallowed by the clear.
   */
  #enqueueDirtyChunks(): void {
    const before = this.#rebuildQueue.length;

    for (const { layer, chunk } of this.world.getAllDirtyChunks()) {
      chunk.dirty = false;

      // opacity === 0 is treated the same as an invisible layer: no mesh,
      // no collider, and the layer stops winning world compositing.
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
   * Rebuilds queued chunks until `budgetMs` is spent. A budget of 0 (or less)
   * drains the queue completely.
   *
   * The first chunk is always rebuilt, so a budget smaller than one chunk's
   * build time still makes progress instead of deadlocking the queue.
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
      // Absent from the set means the chunk was unloaded while queued.
      if (!this.#queuedChunks.delete(chunk)) {
        continue;
      }

      // #rebuildChunk() drops the previous meshes itself.
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
    // Remove and dispose all chunk meshes individually (we own the geometries
    // but share materials per tileset, so we must NOT call removeChildren).
    this.#disposeChunkMeshes();
    this.debug.dispose();
    this.#collider?.dispose();

    for (const mat of this.#materials.values()) {
      mat.dispose();
    }
    this.#materials.clear();

    this.tilesetManager.dispose();
  }

  /**
   * Whether chunks are meshed with greedy face merging.
   * See `VoxelEngineOptions.greedy`.
   */
  get greedy(): boolean {
    return this.#meshBuilder.greedy;
  }

  /**
   * Switches meshing mode and rebuilds the world. Geometry and materials are
   * both mode-specific, so the cached materials are dropped along with the
   * meshes.
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

  // --- Hook management --- //

  /**
   * Current hook listener, if any. Lets callers (e.g. `VoxelSyncClient`) chain
   * onto an existing handler instead of silently replacing it.
   */
  get onLayerUpdated(): VoxelLayerHookListener | undefined {
    return this.#onLayerUpdated;
  }

  /**
   * Replace the hook listener after construction. Setting to `undefined` disables hooks.
   * Used by `VoxelSyncClient` to inject itself.
   */
  set onLayerUpdated(fn: VoxelLayerHookListener | undefined) {
    this.#onLayerUpdated = fn;
  }

  /**
   * Emits a hook event unless a remote command is currently being applied.
   */
  #emitHook(event: VoxelLayerHookEvent): void {
    if (this.#isApplyingRemote) {
      return;
    }
    this.#onLayerUpdated?.(event);
  }

  /**
   * Dispatches a hook event to the corresponding local mutation method.
   * Called from `applyRemoteCommand` with `#isApplyingRemote = true` so
   * the mutation does not re-fire the hook.
   */
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
   * Applies a remote command (received from a network peer) to the local world
   * without re-emitting the hook, preventing echo loops.
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

  // --- API --- //

  /**
   * Places a voxel in the specified layer.
   * Rotation is expressed as Y-axis steps (0–3 × 90°); flipX/flipZ mirror the block.
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

  // --- Object Layer API --- //

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

    // Invalidate every cached opacity variant for this tileset so they are
    // recreated with the new texture.
    const prefix = `${def.id}:`;
    for (const [key, material] of this.#materials) {
      if (key.startsWith(prefix)) {
        material.dispose();
        this.#materials.delete(key);
      }
    }

    // Force all chunks to rebuild geometry (UV offsets may have changed).
    this.markAllChunksDirty("loadTileset");
  }

  // --- Serialization --- //
  save(): VoxelWorldJSON {
    this.#logger.debug("Serializing world to JSON...");

    return {
      ...this.serializer.serialize(
        this.world,
        this.tilesetManager
      ),
      blocks: [...this.blockRegistry.getAll()]
    };
  }

  load(
    data: VoxelWorldJSON,
    options: VoxelLoadOptions = {}
  ): void {
    // Clear existing meshes before replacing world data.
    this.#disposeChunkMeshes();
    this.#logger.debug("Cleared existing chunk meshes while loading new world.");

    // Register block definitions embedded by a converter, if present.
    // Skips IDs already registered so callers can pre-register overrides.
    if (data.blocks) {
      for (const blockDef of data.blocks) {
        if (!this.blockRegistry.has(blockDef.id)) {
          this.blockRegistry.register(blockDef);
        }
      }
    }

    this.serializer.deserialize(data, this.world);

    // Register any tilesets in the snapshot that are not already loaded.
    // Tilesets must have been pre-loaded via TilesetLoader before this call.
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

    // Dispose cached materials so they are recreated with the correct textures.
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
   * Opacity is quantised into `kOpacitySteps` buckets so dragging an opacity
   * slider cannot mint an unbounded number of materials. The top bucket is
   * reserved for fully opaque layers, which keeps an opacity of `0.999` from
   * being rounded into the opaque variant.
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
   * The layer's opacity rides on the material rather than on a per-vertex
   * color, which is 4 constant bytes saved on every vertex. Three multiplies
   * `material.opacity` into `diffuseColor.a` exactly where the vertex alpha
   * used to land, so alpha testing and blending are unchanged.
   */
  #getMaterial(
    tilesetId: string,
    opacity: number
  ): THREE.MeshLambertMaterial | THREE.MeshStandardMaterial {
    const bucket = this.#opacityBucket(opacity);
    const key = `${tilesetId}:${bucket}`;
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
      side: THREE.FrontSide,
      alphaTest: this.#alphaTest,
      // The bucketed value, not the raw one, so the material matches its key.
      opacity: bucket / kOpacitySteps,
      transparent,
      // Translucent chunks must not write depth, otherwise nearer
      // translucent faces would hide farther ones behind solid Z-rejection
      // instead of blending.
      depthWrite: !transparent
    };

    if (this.#materialType === "standard") {
      material = new THREE.MeshStandardMaterial(materialOptions);
    }
    else {
      material = new THREE.MeshLambertMaterial(materialOptions);
    }

    // Greedy meshing emits quads spanning several voxels; without this the tile
    // would stretch across the whole quad instead of repeating over it.
    if (this.#meshBuilder.greedy) {
      enableTileWrapping(material);
    }
    this.#materialCustomizer?.(material, tilesetId);

    this.#materials.set(key, material);

    return material;
  }

  /**
   * Detaches and disposes every chunk mesh. Materials are shared per tileset
   * and owned by `#materials`, so they are deliberately left alone.
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

    // Remove all existing meshes for this chunk (rebuilt per tileset below).
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

    // Remove any existing meshes for this chunk before adding new ones.
    // This prevents orphaned Three.js objects when a chunk is rebuilt multiple
    // times (e.g. load() followed by init()).
    this.#removeChunk(layer, chunk);

    const geometries = this.#meshBuilder.buildChunkGeometries(chunk, layer);
    if (!geometries) {
      // Still recorded: a chunk whose faces are all culled has no mesh but
      // its voxels count toward the debug statistics.
      this.debug.registerChunk(chunkKeyBase, [], this.#meshBuilder.stats);

      return;
    }

    // Opacity is uniform across a layer, so every tileset mesh for this
    // chunk shares the same material variant.
    const { opacity } = layer;

    // Create one mesh per tileset so each can use the correct texture.
    const meshes: THREE.Mesh[] = [];
    for (const [tilesetId, geometry] of geometries) {
      const mesh = new THREE.Mesh(geometry, this.#getMaterial(tilesetId, opacity));
      mesh.name = `voxel_chunk_${chunkKeyBase}:${tilesetId}`;

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

    // Everything is about to be rebuilt, so anything already queued is stale.
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

/** Squared distance from `focus` to the centre of a queued chunk. */
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
