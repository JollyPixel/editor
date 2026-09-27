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
import {
  DownsampledWorld,
  FaceTemplateTable,
  VoxelMeshBuilder
} from "./mesh/index.ts";
import { ChunkMaterialCache } from "./render/ChunkMaterialCache.ts";
import {
  ChunkMeshLayout,
  type ChunkMeshTarget
} from "./render/ChunkMeshLayout.ts";
import { ChunkMeshStore } from "./render/ChunkMeshStore.ts";
import {
  ChunkMeshWorkers,
  type MeshWorkerOptions
} from "./render/ChunkMeshWorkers.ts";
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
import { FACE_OFFSETS } from "./utils/math.ts";
import type { VoxelChunk } from "./world/VoxelChunk.ts";
import type { VoxelLayer } from "./world/VoxelLayer.ts";
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

  vertexPulling?: boolean;

  /**
   * How atlas tiles are drawn once a screen pixel covers several texels.
   * `"average"` box-filters the texels each pixel covers, which stops the
   * moire and shimmer that `"nearest"` shows far away.
   *
   * Needs readable atlas pixels (a 2D canvas, same-origin images); falls back to `"nearest" otherwise.
   * @default "average"
   */
  tileMinification?: TileMinification;

  /**
   * Mask blocks write their texel coverage as MSAA sample coverage.
   * Needs a multisampled target and an opaque canvas.
   * @default false
   */
  alphaToCoverage?: boolean;

  /**
   * World units from `focus` beyond which chunks draw flat tile colours
   * and blend blocks opaque.
   * @default Infinity
   */
  farDistance?: number;

  /**
   * World units from `focus` beyond which chunks mesh at half resolution,
   * one block per 2x2x2 cell.
   * @default Infinity
   */
  lodDistance?: number;

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

  meshWorkers?: MeshWorkerOptions;
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
  farDistance: number;
  lodDistance: number;

  #chunkGroup = new THREE.Group();
  #layout: ChunkMeshLayout;
  #meshBuilder: VoxelMeshBuilder;
  #lodBuilder: VoxelMeshBuilder;
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
      material = "lambert",
      materialCustomizer,
      collider,
      shapes = [],
      alphaTest = 0.1,
      logger = NOOP_LOGGER,
      inspector,
      tilesets,
      greedy = false,
      vertexPulling = false,
      tileMinification = "average",
      rebuildBudgetMs = 8,
      viewDistance,
      viewDistancePolicy = "hide",
      farDistance = Infinity,
      lodDistance = Infinity,
      alphaToCoverage = false,
      retainVertexData = false,
      castShadow = false,
      receiveShadow = false,
      ambientOcclusion: requestedAo = 0,
      meshWorkers
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
    this.farDistance = farDistance;
    this.lodDistance = lodDistance;
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

    const builderOptions = {
      blockRegistry: document.blocks,
      shapeRegistry: this.shapes,
      tilesetManager: this.tilesetManager,
      alphaTest,
      greedy,
      vertexPulling,
      faceTemplates: this.#faceTemplates,
      ambientOcclusion: ambientOcclusion > 0,
      logger: this.#logger
    };
    this.#meshBuilder = new VoxelMeshBuilder({
      ...builderOptions,
      world: document.world
    });
    const lodWorld = new DownsampledWorld(document.world);
    this.#lodBuilder = new VoxelMeshBuilder({
      ...builderOptions,
      world: lodWorld
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
      ambientOcclusion,
      alphaToCoverage,
      faceTemplates: this.#faceTemplates,
      vertexPulling
    });
    this.#layout = new ChunkMeshLayout(document.world);
    this.#meshes = new ChunkMeshStore({
      root: this.#chunkGroup,
      layout: this.#layout,
      meshBuilder: this.#meshBuilder,
      materials: this.#materials,
      inspector: this.inspector,
      collider: this.#collider,
      lod: {
        world: lodWorld,
        meshBuilder: this.#lodBuilder
      },
      logger: this.#logger,
      retainVertexData,
      castShadow,
      receiveShadow
    });
    this.#workers = ChunkMeshWorkers.create(meshWorkers, {
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
      },
      relevel: (_key, entry) => {
        for (const { layer, chunk } of entry.members) {
          chunk.dirty = true;
          this.#dirtyCoarseNeighbours(layer, chunk);
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

  get greedy(): boolean {
    return this.#meshBuilder.greedy;
  }

  set greedy(value: boolean) {
    if (value === this.#meshBuilder.greedy) {
      return;
    }

    this.#meshBuilder.greedy = value;
    this.#lodBuilder.greedy = value;
    this.#materials.tileWrapping = value;
    this.#materials.invalidate();
    this.#clearChunkMeshes();
    this.markAllChunksDirty("greedy");
  }

  get vertexPulling(): boolean {
    return this.#meshBuilder.vertexPulling;
  }

  set vertexPulling(value: boolean) {
    if (value === this.#meshBuilder.vertexPulling) {
      return;
    }

    this.#meshBuilder.vertexPulling = value;
    this.#lodBuilder.vertexPulling = value;
    this.#materials.vertexPulling = value;
    this.#materials.invalidate();
    this.#clearChunkMeshes();
    this.markAllChunksDirty("vertexPulling");
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

  get alphaToCoverage(): boolean {
    return this.#materials.alphaToCoverage;
  }

  set alphaToCoverage(
    value: boolean
  ) {
    if (value === this.#materials.alphaToCoverage) {
      return;
    }

    this.#materials.alphaToCoverage = value;
    this.#materials.invalidate();
    this.markAllChunksDirty("alphaToCoverage");
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
      this.#lodBuilder.ambientOcclusion = enabled;
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
    return new ChunkViewport({
      focus: this.focus,
      viewDistance: this.viewDistance,
      policy: this.viewDistancePolicy,
      chunkSize: this.document.world.chunkSize,
      farDistance: this.farDistance,
      lodDistance: this.lodDistance
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
    if (plan !== null && (plan.lod !== null || !workers.dispatch(plan))) {
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

  #dirtyCoarseNeighbours(
    layer: VoxelLayer,
    chunk: VoxelChunk
  ): void {
    for (const [dx, dy, dz] of FACE_OFFSETS) {
      const neighbour = layer.getChunk(
        chunk.cx + dx,
        chunk.cy + dy,
        chunk.cz + dz
      );
      if (
        neighbour !== undefined &&
        (this.#meshes.detailOf(neighbour)?.lod ?? 0) > 0
      ) {
        neighbour.dirty = true;
      }
    }
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
