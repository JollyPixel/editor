// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { BlockSurface } from "./blocks/BlockSurface.ts";
import type { BlockShape } from "./blocks/shape/BlockShape.ts";
import { BlockShapeRegistry } from "./blocks/shape/BlockShapeRegistry.ts";
import type {
  VoxelCollider,
  VoxelColliderFactory
} from "./collision/VoxelCollider.ts";
import {
  isVoxelMaterialGroupCommand,
  isVoxelTilesetCommand
} from "./commands/categories.ts";
import type { VoxelCommand } from "./commands/types.ts";
import type {
  VoxelDocument,
  VoxelLoadOptions
} from "./VoxelDocument.ts";
import {
  VoxelInspector,
  type VoxelInspectorOptions
} from "./inspector/index.ts";
import { VoxelMeshBuilder } from "./mesh/index.ts";
import { ChunkMaterialCache } from "./render/ChunkMaterialCache.ts";
import {
  ChunkMeshLayout,
  type ChunkMeshTarget
} from "./render/ChunkMeshLayout.ts";
import { ChunkMeshStore } from "./render/ChunkMeshStore.ts";
import { ChunkRebuildQueue } from "./render/ChunkRebuildQueue.ts";
import { ChunkViewport } from "./render/ChunkViewport.ts";
import { ChunkVisibility } from "./render/ChunkVisibility.ts";
import { TilesetManager } from "./tileset/TilesetManager.ts";
import type { TilesetSource } from "./tileset/loadTilesets.ts";
import type {
  TilesetDefinition,
  TilesetTexture
} from "./tileset/types.ts";
import type { VoxelWorldJSON } from "./serialization/types.ts";
import { NOOP_LOGGER, type VoxelLogger } from "./utils/logger.ts";
import {
  ViewDistance,
  type ViewDistanceOptions
} from "./world/ViewDistance.ts";

export type ViewDistancePolicy =
  | "hide"
  | "unload";

export type MaterialCustomizerFn = (
  material: THREE.MeshLambertMaterial | THREE.MeshStandardMaterial,
  tilesetId: string,
  surface: BlockSurface
) => void;

export type TileMinification =
  | "average"
  | "nearest";

export interface VoxelViewLoadOptions
  extends Omit<VoxelLoadOptions, "tilesets"> {
  /**
   * Atlases to register before loading a world that uses them.
   */
  tilesets?: Iterable<TilesetSource>;
}

export interface VoxelViewOptions {
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
   * Called once for each new material with its tileset ID and surface;
   * `surface.materialGroup` tells grouped blocks apart.
   */
  materialCustomizer?: MaterialCustomizerFn;

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
   * Initial inspector view; mesh counters are collected in every mode.
   */
  inspector?: VoxelInspectorOptions;

  /**
   * Enables greedy merging; incompatible with custom UV shader compilation.
   * @default false
   */
  greedy?: boolean;

  /**
   * How atlas tiles are drawn once a screen pixel covers several texels.
   * `"average"` fades distant faces toward the average colour of their tile,
   * which stops the moire and shimmer that `"nearest"` shows far away.
   * Needs readable atlas pixels (a 2D canvas, same-origin images); falls
   * back to `"nearest"` otherwise.
   * @default "average"
   */
  tileMinification?: TileMinification;

  /**
   * Preloaded atlases (see `loadTilesets`) registered synchronously during
   * construction.
   */
  tilesets?: Iterable<TilesetSource>;

  /**
   * Per-tick rebuild budget in milliseconds; 0 drains the queue.
   * @default 8
   */
  rebuildBudgetMs?: number;

  /**
   * Chunk radius around `focus` kept meshed and drawn, as a radius in chunks
   * or a full `ViewDistance` description. Ignored while `focus` is null.
   * @default Infinity
   */
  viewDistance?: number | ViewDistanceOptions;

  /**
   * What happens to a chunk that leaves the view distance: `"hide"` keeps its
   * geometry ready to show again, `"unload"` frees it and remeshes on return.
   * @default "hide"
   */
  viewDistancePolicy?: ViewDistancePolicy;

  /**
   * Keeps the shader-only `tileRegion` and `tileRepeat` chunk attributes in
   * JavaScript memory after their first render uploads them. Raycasting and
   * colliders never read them; a renderer that did not draw the chunk first
   * cannot upload them once released.
   * @default false
   */
  retainVertexData?: boolean;

  /**
   * Strength of the ambient occlusion baked into chunk vertices, from 0 (off)
   * to 1 (fully occluded corners turn black). Darkens the albedo, so it
   * shades direct and indirect light alike.
   * @default 0
   */
  ambientOcclusion?: number;

  /**
   * Chunk meshes cast shadows; assignable later through `castShadow`.
   * @default false
   */
  castShadow?: boolean;

  /**
   * Chunk meshes receive shadows; assignable later through `receiveShadow`.
   * @default false
   */
  receiveShadow?: boolean;
}

export class VoxelView {
  readonly root = new THREE.Group();

  readonly document: VoxelDocument;
  readonly shapes: BlockShapeRegistry;
  readonly tilesetManager: TilesetManager;
  readonly inspector: VoxelInspector;

  focus: THREE.Vector3Like | null = null;
  viewDistance: ViewDistance;
  viewDistancePolicy: ViewDistancePolicy;

  #chunkGroup = new THREE.Group();
  #layout: ChunkMeshLayout;
  #meshBuilder: VoxelMeshBuilder;
  #materials: ChunkMaterialCache;
  #meshes: ChunkMeshStore;
  #queue = new ChunkRebuildQueue();
  #idleWaiters: Array<() => void> = [];
  #visibility: ChunkVisibility;
  #collider: VoxelCollider | null;
  #rebuildBudgetMs: number;
  #logger: VoxelLogger;
  #stagedTilesets: TilesetSource[] = [];

  #onCommand = (
    command: VoxelCommand
  ): void => {
    if (isVoxelTilesetCommand(command)) {
      this.#syncAtlases();
      this.markAllChunksDirty(command.action);
    }
    else if (isVoxelMaterialGroupCommand(command)) {
      const groupId = command.action === "material-group-defined" ?
        command.group.id :
        command.groupId;
      if (this.#materials.refreshGroup(groupId)) {
        this.markAllChunksDirty(command.action);
      }
    }
    else if (
      command.action === "block-defined" ||
      command.action === "block-removed"
    ) {
      this.markAllChunksDirty(command.action);
    }
  };

  #onLoaded = (): void => {
    this.#clearChunkMeshes();
    this.#logger.debug("Cleared existing chunk meshes while loading a world.");

    for (const { def, texture } of this.#stagedTilesets.splice(0)) {
      this.tilesetManager.registerTexture(def.id, texture);
    }
    this.tilesetManager.syncAtlases();
    for (const tilesetDef of this.document.tilesets) {
      if (!this.tilesetManager.get(tilesetDef.id)) {
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
      tileMinification = "average",
      rebuildBudgetMs = 8,
      viewDistance,
      viewDistancePolicy = "hide",
      retainVertexData = false,
      castShadow = false,
      receiveShadow = false,
      ambientOcclusion: requestedAo = 0
    } = options;
    const ambientOcclusion = THREE.MathUtils.clamp(requestedAo, 0, 1);

    this.document = document;
    this.root.name = "VoxelView";
    this.#chunkGroup.name = "VoxelView:chunks";
    this.root.add(this.#chunkGroup);

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
        solids: this.#chunkGroup,
        world: document.world,
        blockRegistry: document.blocks
      },
      inspector
    );
    this.shapes = BlockShapeRegistry.createDefault();
    shapes.forEach(
      (shape) => this.shapes.register(shape)
    );

    this.tilesetManager = new TilesetManager({
      tilesets: document.tilesets
    });

    this.#meshBuilder = new VoxelMeshBuilder({
      world: document.world,
      blockRegistry: document.blocks,
      shapeRegistry: this.shapes,
      tilesetManager: this.tilesetManager,
      alphaTest,
      greedy,
      ambientOcclusion: ambientOcclusion > 0,
      logger: this.#logger
    });

    this.#collider = collider?.({
      blockRegistry: document.blocks,
      shapeRegistry: this.shapes
    }) ?? null;

    this.#materials = new ChunkMaterialCache({
      tilesetManager: this.tilesetManager,
      materialGroups: document.materialGroups,
      type: material,
      customizer: materialCustomizer,
      tileWrapping: greedy,
      tileAveraging: tileMinification === "average",
      ambientOcclusion
    });
    this.#layout = new ChunkMeshLayout(document.world);
    this.#meshes = new ChunkMeshStore({
      root: this.#chunkGroup,
      layout: this.#layout,
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
      unload: (key, entry) => {
        this.#queue.cancel(key);
        this.#meshes.unload(key);
        for (const { chunk } of entry.members) {
          chunk.dirty = true;
        }
      }
    });

    for (const { def, texture } of tilesets ?? []) {
      if (!this.tilesetManager.get(def.id)) {
        this.loadTileset(def, texture);
      }
    }

    document.on("command", this.#onCommand);
    document.on("loaded", this.#onLoaded);
  }

  init(): void {
    this.#rebuildAllChunks("init");
  }

  tick(
    _deltaTime: number
  ): void {
    this.tilesetManager.refreshAverages();
    const viewport = this.#viewport();

    this.#visibility.update(viewport);
    this.#enqueueDirtyChunks(viewport);
    this.#queue.drain(
      this.#rebuildBudgetMs,
      (target) => this.#meshes.rebuild(target)
    );
    this.#settleIdleWaiters();
  }

  flush(): void {
    this.#enqueueDirtyChunks(this.#viewport());
    this.#queue.drain(
      0,
      (target) => this.#meshes.rebuild(target)
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

  get tileMinification(): TileMinification {
    return this.#materials.tileAveraging ? "average" : "nearest";
  }

  set tileMinification(
    value: TileMinification
  ) {
    const averaging = value === "average";
    if (averaging === this.#materials.tileAveraging) {
      return;
    }

    this.#materials.tileAveraging = averaging;
    this.#materials.invalidate();
    this.markAllChunksDirty("tileMinification");
  }

  get ambientOcclusion(): number {
    return this.#materials.aoStrength.value;
  }

  set ambientOcclusion(
    value: number
  ) {
    const strength = THREE.MathUtils.clamp(value, 0, 1);
    this.#materials.aoStrength.value = strength;

    const enabled = strength > 0;
    if (enabled !== this.#meshBuilder.ambientOcclusion) {
      this.#meshBuilder.ambientOcclusion = enabled;
      this.markAllChunksDirty("ambientOcclusion");
    }
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
    this.document.tilesets.declare(def);
    this.tilesetManager.registerTexture(def.id, texture);
    this.#logger.debug(
      `Loaded tileset '${def.id}' from '${def.src ?? def.asset?.id}'`
    );

    this.#materials.invalidate(def.id);
    this.markAllChunksDirty("loadTileset");
  }

  load(
    data: VoxelWorldJSON,
    options: VoxelViewLoadOptions = {}
  ): void {
    const { tilesets = [], mergeLayers } = options;

    this.#stagedTilesets = Array.from(tilesets).filter(
      ({ def }) => !this.tilesetManager.get(def.id)
    );
    try {
      this.document.load(data, {
        mergeLayers,
        tilesets: this.#stagedTilesets.map(({ def }) => def)
      });
    }
    finally {
      this.#stagedTilesets = [];
    }
  }

  markAllChunksDirty(
    source?: string
  ): void {
    this.#logger.debug("Marking all chunks dirty...", { source });

    for (const layer of this.document.world.getLayers()) {
      layer.markAllDirty();
    }
  }

  dispose(): void {
    this.#logger.debug("Disposing VoxelView.");
    this.document.off("command", this.#onCommand);
    this.document.off("loaded", this.#onLoaded);
    this.#queue.clear();
    this.#clearChunkMeshes();
    this.inspector.dispose();
    this.#collider?.dispose();
    this.#materials.dispose();
    this.tilesetManager.dispose();
  }

  #isIdle(): boolean {
    if (this.#queue.size > 0) {
      return false;
    }

    const viewport = this.#viewport();
    for (const layer of this.document.world.getLayers()) {
      for (const chunk of layer.getDirtyChunks()) {
        if (viewport.contains(this.#layout.originOf(layer, chunk), false)) {
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
    const { world } = this.document;
    let grew = false;

    for (const { chunk } of world.getAllChunksToBeRemoved()) {
      const placed = this.#meshes.targetContaining(chunk);
      if (placed !== undefined) {
        grew = this.#retire(placed) || grew;
      }
    }

    for (const { layer, chunk } of world.getAllDirtyChunks()) {
      const origin = this.#layout.originOf(layer, chunk);
      if (!viewport.contains(origin, false)) {
        continue;
      }

      chunk.dirty = false;
      const target = this.#layout.targetOf(layer, chunk);
      const placed = this.#meshes.targetContaining(chunk);
      if (placed !== undefined && placed.key !== target?.key) {
        grew = this.#retire(placed) || grew;
      }
      if (target !== null) {
        grew = this.#queue.push(target) || grew;
      }
    }

    if (viewport.focus === null) {
      return;
    }

    if (grew || this.#queue.focusMovedSinceSort(viewport)) {
      this.#queue.sortBy(viewport);
    }
  }

  #retire(
    target: ChunkMeshTarget
  ): boolean {
    if (target.layer === null) {
      return this.#queue.push(target);
    }

    this.#queue.cancel(target.key);
    this.#meshes.remove(target.key);

    return false;
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
    for (const tilesetId of this.tilesetManager.syncAtlases()) {
      this.#materials.invalidate(tilesetId);
    }
  }
}
