// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
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
import {
  FaceTemplateTable,
  VoxelMeshBuilder
} from "./mesh/index.ts";
import { ChunkMaterialCache } from "./render/ChunkMaterialCache.ts";
import {
  ChunkMeshLayout,
  type ChunkMeshTarget
} from "./render/ChunkMeshLayout.ts";
import { ChunkMeshStore } from "./render/ChunkMeshStore.ts";
import { ChunkMeshWorkers } from "./render/ChunkMeshWorkers.ts";
import { ChunkRebuildQueue } from "./render/ChunkRebuildQueue.ts";
import { ChunkViewport } from "./render/ChunkViewport.ts";
import { ChunkVisibility } from "./render/ChunkVisibility.ts";
import {
  VoxelLighting,
  VoxelRange,
  VoxelRendering,
  type VoxelLightingOptions,
  type VoxelMeshingOptions,
  type VoxelRangeOptions,
  type VoxelRenderingOptions
} from "./settings/index.ts";
import { TilesetManager } from "./tileset/TilesetManager.ts";
import type { TilesetSource } from "./tileset/loadTilesets.ts";
import type {
  TilesetDefinition,
  TilesetTexture
} from "./tileset/types.ts";
import type { VoxelWorldJSON } from "./serialization/types.ts";
import { NOOP_LOGGER, type VoxelLogger } from "./utils/logger.ts";
import type { VoxelLayer } from "./world/VoxelLayer.ts";

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
   * Shapes registered after the defaults from `BlockShapeRegistry`.
   */
  shapes?: BlockShape[];

  /**
   * Preloaded atlases (see `loadTilesets`) registered synchronously during
   * construction.
   */
  tilesets?: Iterable<TilesetSource>;

  /**
   * Debug logger; defaults to a no-op implementation.
   */
  logger?: VoxelLogger;

  /**
   * Initial inspector view; mesh counters are collected in every mode.
   */
  inspector?: VoxelInspectorOptions;

  /**
   * Chunk materials and atlas sampling; `tileMinification` and
   * `alphaToCoverage` stay assignable through `view.rendering`.
   */
  rendering?: VoxelRenderingOptions;

  /**
   * Baked ambient occlusion and shadows, assignable through `view.lighting`.
   */
  lighting?: VoxelLightingOptions;

  /**
   * Which chunks around `focus` are meshed, drawn and drawn flat, assignable
   * through `view.range`.
   */
  range?: VoxelRangeOptions;

  /**
   * Rebuild budget and mesh workers.
   */
  meshing?: VoxelMeshingOptions;
}

export class VoxelView {
  readonly root = new THREE.Group();

  readonly document: VoxelDocument;
  readonly shapes: BlockShapeRegistry;
  readonly tilesetManager: TilesetManager;
  readonly inspector: VoxelInspector;
  readonly range: VoxelRange;
  readonly lighting: VoxelLighting;
  readonly rendering: VoxelRendering;

  focus: THREE.Vector3Like | null = null;

  #chunkGroup = new THREE.Group();
  #layout: ChunkMeshLayout;
  #meshBuilder: VoxelMeshBuilder;
  #faceTemplates = new FaceTemplateTable();
  #materials: ChunkMaterialCache;
  #meshes: ChunkMeshStore;
  #workers: ChunkMeshWorkers | null = null;
  #queue = new ChunkRebuildQueue();
  #idleWaiters: Array<() => void> = [];
  #visibility: ChunkVisibility;
  #collider: VoxelCollider | null;
  #rebuildBudgetMs: number;
  #logger: VoxelLogger;
  #stagedTilesets: TilesetSource[] = [];
  #scannedViewport: ChunkViewport | null = null;
  #scannedRevisions = new Map<VoxelLayer, number>();

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
      collider,
      shapes = [],
      logger = NOOP_LOGGER,
      inspector,
      tilesets,
      rendering = {},
      lighting = {},
      range,
      meshing = {}
    } = options;
    const {
      material = "lambert",
      customizer,
      alphaTest = 0.1,
      alphaToCoverage = false,
      tileMinification = "average"
    } = rendering;
    const {
      castShadow = false,
      receiveShadow = false
    } = lighting;
    const ambientOcclusion = THREE.MathUtils.clamp(
      lighting.ambientOcclusion ?? 0,
      0,
      1
    );
    const { budgetMs = 8, workers } = meshing;

    this.document = document;
    this.root.name = "VoxelView";
    this.#chunkGroup.name = "VoxelView:chunks";
    this.root.add(this.#chunkGroup);

    this.#rebuildBudgetMs = budgetMs;
    this.range = new VoxelRange(range);
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
      faceTemplates: this.#faceTemplates,
      ambientOcclusion: ambientOcclusion > 0,
      logger: this.#logger
    });

    this.#collider = collider?.({
      blockRegistry: document.blocks,
      shapeRegistry: this.shapes
    }) ?? null;

    this.#materials = new ChunkMaterialCache({
      tilesetManager: this.tilesetManager,
      faceTemplates: this.#faceTemplates,
      materialGroups: document.materialGroups,
      type: material,
      customizer,
      tileAveraging: tileMinification === "average",
      ambientOcclusion,
      alphaToCoverage
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
      castShadow,
      receiveShadow
    });
    this.#workers = ChunkMeshWorkers.create(workers, {
      world: document.world,
      meshBuilder: this.#meshBuilder,
      definitions: {
        blockRegistry: document.blocks,
        shapeRegistry: this.shapes,
        tilesetManager: this.tilesetManager,
        alphaTest
      },
      logger: this.#logger,
      onCapacity: () => this.#refillWorkers()
    });
    this.#visibility = new ChunkVisibility({
      meshes: this.#meshes,
      unload: (key, entry) => {
        this.#queue.cancel(key);
        this.#workers?.cancel(key);
        this.#meshes.unload(key);
        for (const { chunk } of entry.members) {
          chunk.dirty = true;
        }
      }
    });

    const remesh = (source: string) => this.markAllChunksDirty(source);
    this.lighting = new VoxelLighting({
      meshBuilder: this.#meshBuilder,
      materials: this.#materials,
      meshes: this.#meshes,
      remesh
    });
    this.rendering = new VoxelRendering({
      materials: this.#materials,
      remesh
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
    this.#meshes.viewport = viewport;

    this.#visibility.update(viewport);
    this.#workers?.installInto(this.#meshes);
    this.#enqueueDirtyChunks(viewport);
    this.#queue.drain(
      this.#rebuildBudgetMs,
      (target) => this.#rebuildAdmitted(target, viewport, this.#offloads())
    );
    this.#settleIdleWaiters();
  }

  flush(): void {
    const viewport = this.#viewport();
    this.#meshes.viewport = viewport;
    this.#visibility.update(viewport);
    this.#workers?.installInto(this.#meshes);
    for (const target of this.#workers?.reclaim() ?? []) {
      this.#queue.push(target);
    }
    this.#enqueueDirtyChunks(viewport);
    this.#queue.drain(
      0,
      (target) => this.#rebuildAdmitted(target, viewport, false)
    );
    this.#settleIdleWaiters();
  }

  get pendingRebuilds(): number {
    return this.#queue.size + (this.#workers?.pending ?? 0);
  }

  whenIdle(): Promise<void> {
    if (this.#isIdle()) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.#idleWaiters.push(resolve);
    });
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
    this.#workers?.dispose();
    this.inspector.dispose();
    this.#collider?.dispose();
    this.#materials.dispose();
    this.#faceTemplates.dispose();
    this.tilesetManager.dispose();
  }

  #isIdle(): boolean {
    if (this.pendingRebuilds > 0) {
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
    const { chunkSize } = this.document.world;
    const { viewDistance, policy, farDistance } = this.range;

    return new ChunkViewport({
      focus: this.focus,
      viewDistance,
      policy,
      chunkSize,
      farDistance: farDistance * chunkSize
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

    if (this.#dirtyChunksChangedSinceScan(viewport)) {
      grew = this.#enqueueAdmittedDirtyChunks(viewport) || grew;
    }

    if (viewport.focus === null) {
      return;
    }

    if (grew || this.#queue.focusMovedSinceSort(viewport)) {
      this.#queue.sortBy(viewport);
    }
  }

  #dirtyChunksChangedSinceScan(
    viewport: ChunkViewport
  ): boolean {
    if (
      this.#scannedViewport === null ||
      viewport.differsFrom(this.#scannedViewport)
    ) {
      return true;
    }

    const layers = this.document.world.getLayers();

    return layers.length !== this.#scannedRevisions.size ||
      layers.some(
        (layer) => this.#scannedRevisions.get(layer) !== layer.dirtyRevision
      );
  }

  #enqueueAdmittedDirtyChunks(
    viewport: ChunkViewport
  ): boolean {
    const { world } = this.document;
    let grew = false;

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

    this.#scannedViewport = viewport;
    this.#scannedRevisions.clear();
    for (const layer of world.getLayers()) {
      this.#scannedRevisions.set(layer, layer.dirtyRevision);
    }

    return grew;
  }

  #rebuildAdmitted(
    target: ChunkMeshTarget,
    viewport: ChunkViewport,
    offload: boolean
  ): boolean {
    if (!viewport.contains(target.origin, false)) {
      const members = this.#layout.membersOf(target);
      if (members.length > 0) {
        for (const { chunk } of members) {
          chunk.dirty = true;
        }

        return true;
      }
    }

    const workers = this.#workers;
    if (!offload || workers === null) {
      this.#meshes.rebuild(target);

      return true;
    }
    if (!workers.hasCapacity) {
      return false;
    }

    const plan = this.#meshes.plan(target);
    if (plan !== null && !workers.dispatch(plan)) {
      this.#meshes.build(plan);
    }

    return true;
  }

  #refillWorkers(): void {
    const { viewport } = this.#meshes;
    if (viewport === null || !this.#offloads()) {
      return;
    }

    this.#queue.drain(
      this.#rebuildBudgetMs,
      (target) => this.#rebuildAdmitted(target, viewport, true)
    );
  }

  #offloads(): boolean {
    return this.#workers !== null && !this.#workers.broken;
  }

  #retire(
    target: ChunkMeshTarget
  ): boolean {
    if (target.layer === null) {
      return this.#queue.push(target);
    }

    this.#queue.cancel(target.key);
    this.#workers?.cancel(target.key);
    this.#meshes.remove(target.key);

    return false;
  }

  #clearChunkMeshes(): void {
    this.#workers?.reclaim();
    this.#meshes.clear();
    this.#visibility.reset();
    this.#scannedViewport = null;
  }

  #rebuildAllChunks(
    source?: string
  ): void {
    this.#logger.debug("Rebuilding all chunks...", { source });

    this.#queue.clear();
    this.#workers?.reclaim();
    this.markAllChunksDirty(source);
    if (!this.#offloads()) {
      this.flush();
    }
  }

  #syncAtlases(): void {
    for (const tilesetId of this.tilesetManager.syncAtlases()) {
      this.#materials.invalidate(tilesetId);
    }
  }
}
