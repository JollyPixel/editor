// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import * as THREE from "three";

// Import Internal Dependencies
import { BlockRegistry } from "./blocks/BlockRegistry.ts";
import { applyBlockCommand } from "./blocks/applyBlockCommand.ts";
import { BlockShapeRegistry } from "./blocks/shape/BlockShapeRegistry.ts";
import type { VoxelCollider } from "./collision/VoxelCollider.ts";
import { VoxelInspector } from "./inspector/index.ts";
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
import type { TilesetList } from "./tileset/TilesetList.ts";
import type {
  TilesetDefinition,
  TilesetTexture
} from "./tileset/types.ts";
import type { TilesetSource } from "./tileset/loadTilesets.ts";
import { VoxelWorld } from "./world/VoxelWorld.ts";
import type { VoxelLayer } from "./world/VoxelLayer.ts";
import type { VoxelChunk } from "./world/VoxelChunk.ts";
import { ViewDistance } from "./world/ViewDistance.ts";
import {
  isVoxelTilesetCommand,
  type VoxelBlockCommand,
  type VoxelCommand,
  type VoxelCommandOrigin
} from "./commands.ts";
import { applyVoxelCommand } from "./applyVoxelCommand.ts";
import {
  resolveBlockDefinition,
  type BlockDefinition,
  type BlockProperties,
  type ResolvedBlockDefinition
} from "./blocks/BlockDefinition.ts";
import { BlockTextures } from "./blocks/BlockTextures.ts";
import { NOOP_LOGGER, type VoxelLogger } from "./utils/logger.ts";
import type {
  VoxelApplyOptions,
  VoxelEngineEvents,
  VoxelEngineOptions,
  VoxelLoadOptions,
  ViewDistancePolicy
} from "./VoxelEngine.types.ts";

type BlockDefinedCommand = Extract<
  VoxelBlockCommand,
  { action: "block-defined"; }
>;

export class VoxelEngine extends Emitter<VoxelEngineEvents> {
  readonly root = new THREE.Group();

  readonly world: VoxelWorld;
  readonly blockRegistry: BlockRegistry;
  readonly shapeRegistry: BlockShapeRegistry;
  readonly tilesetManager: TilesetManager;

  readonly inspector: VoxelInspector;

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
      onCommand,
      inspector,
      tilesets,
      greedy = false,
      rebuildBudgetMs = 8,
      viewDistance,
      viewDistancePolicy = "hide"
    } = options;
    super();

    if (onCommand) {
      this.on("command", onCommand);
    }

    this.root.name = "VoxelEngine";

    this.#rebuildBudgetMs = rebuildBudgetMs;
    this.viewDistance = viewDistance === undefined ?
      ViewDistance.Unlimited :
      ViewDistance.from(viewDistance);
    this.viewDistancePolicy = viewDistancePolicy;
    this.#logger = logger.child({
      namespace: "VoxelEngine"
    });

    this.world = new VoxelWorld(chunkSize);
    this.world.on(
      "command",
      (command) => this.#emitCommand(command, "local")
    );
    layers.forEach((name) => this.world.addLayer(name));

    this.blockRegistry = new BlockRegistry(blocks);
    this.inspector = new VoxelInspector(
      {
        parent: this.root,
        world: this.world,
        blockRegistry: this.blockRegistry
      },
      inspector
    );
    this.shapeRegistry = BlockShapeRegistry
      .createDefault();
    shapes.forEach(
      (shape) => this.shapeRegistry.register(shape)
    );

    this.tilesetManager = new TilesetManager();
    this.#registerTilesets(tilesets);

    this.#meshBuilder = new VoxelMeshBuilder({
      world: this.world,
      blockRegistry: this.blockRegistry,
      shapeRegistry: this.shapeRegistry,
      tilesetManager: this.tilesetManager,
      alphaTest,
      greedy
    });

    this.#collider = collider?.({
      blockRegistry: this.blockRegistry,
      shapeRegistry: this.shapeRegistry
    }) ?? null;

    this.#materials = new ChunkMaterialCache({
      tilesetManager: this.tilesetManager,
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

  apply(
    command: VoxelCommand,
    options: VoxelApplyOptions = {}
  ): boolean {
    const { origin = "local" } = options;

    const resolved = command.action === "block-defined" ?
      this.#blockDefined(command.block) :
      command;
    const applied = applyVoxelCommand(
      {
        world: this.world,
        blocks: this.blockRegistry,
        tilesets: this.tilesets
      },
      resolved,
      this.#logger
    );
    if (!applied) {
      return false;
    }

    if (isVoxelTilesetCommand(resolved)) {
      this.#syncAtlases(resolved.action);
    }
    else if (resolved.action === "block-moved") {
      this.#emitCommand({
        ...resolved,
        toIndex: this.blockRegistry.indexOf(resolved.blockId)
      }, origin);

      return true;
    }
    else if (
      resolved.action === "block-defined" ||
      resolved.action === "block-removed"
    ) {
      this.markAllChunksDirty(resolved.action);
    }

    this.#emitCommand(resolved, origin);

    return true;
  }

  defineBlock(
    def: BlockDefinition
  ): void {
    this.defineBlocks([def]);
  }

  defineBlocks(
    defs: Iterable<BlockDefinition>
  ): void {
    const commands = Array.from(defs, (def) => this.#blockDefined(def));
    if (commands.length === 0) {
      return;
    }

    for (const command of commands) {
      applyBlockCommand(this.blockRegistry, command);
    }
    this.markAllChunksDirty("block-defined");

    for (const command of commands) {
      this.#emitCommand(command, "local");
    }
  }

  blockAt(
    position: THREE.Vector3Like
  ): ResolvedBlockDefinition | undefined {
    const entry = this.world.getVoxelAt(position);

    return entry && this.blockRegistry.get(entry.blockId);
  }

  blockPropertiesAt(
    position: THREE.Vector3Like
  ): BlockProperties | undefined {
    const entry = this.world.getVoxelAt(position);

    return entry && this.blockRegistry.propertiesOf(entry.blockId);
  }

  removeBlock(
    blockId: number
  ): boolean {
    return this.apply({
      action: "block-removed",
      blockId
    });
  }

  moveBlock(
    blockId: number,
    toIndex: number
  ): boolean {
    return this.apply({
      action: "block-moved",
      blockId,
      toIndex
    });
  }

  get tilesets(): TilesetList {
    return this.tilesetManager.tilesets;
  }

  get defaultTileSize(): number | undefined {
    return this.tilesets.defaultTileSize;
  }

  set defaultTileSize(
    defaultTileSize: number
  ) {
    this.apply({
      action: "default-tile-size-updated",
      defaultTileSize
    });
  }

  loadTileset(
    def: TilesetDefinition,
    texture: TilesetTexture
  ): void {
    this.tilesets.add(def);
    this.tilesetManager.registerTexture(def.id, texture);
    this.#logger.debug(`Loaded tileset '${def.id}' from '${def.src}'`);

    this.#materials.invalidate(def.id);
    this.markAllChunksDirty("loadTileset");
  }

  addTileset(
    tileset: TilesetDefinition
  ): boolean {
    return this.apply({
      action: "tileset-added",
      tileset
    });
  }

  removeTileset(
    tilesetId: string
  ): boolean {
    return this.apply({
      action: "tileset-removed",
      tilesetId
    });
  }

  resizeTileset(
    tilesetId: string,
    tileSize: number
  ): boolean {
    return this.apply({
      action: "tileset-resized",
      tilesetId,
      tileSize
    });
  }

  save(): VoxelWorldJSON {
    this.#logger.debug("Serializing world to JSON...");

    return serializeVoxelWorld(this.world, {
      tilesets: this.tilesets,
      defaultTileSize: this.tilesets.defaultTileSize,
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
        blocks: this.blockRegistry,
        tilesets: this.tilesets
      })
    );

    this.tilesetManager.syncAtlases();
    this.#registerTilesets(options.tilesets);
    for (const tilesetDef of this.tilesets) {
      if (!this.tilesetManager.get(tilesetDef.id)) {
        this.#logger.warn(
          `Tileset '${tilesetDef.id}' is not loaded; its faces are skipped until it is.`
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
    this.inspector.dispose();
    this.#collider?.dispose();
    this.#materials.dispose();
    this.tilesetManager.dispose();
    this.world.removeAllListeners();
    this.removeAllListeners();
  }

  #blockDefined(
    block: BlockDefinition
  ): BlockDefinedCommand {
    const resolved = resolveBlockDefinition(block);

    return {
      action: "block-defined",
      block: BlockTextures.of(resolved)
        .withTileset(this.tilesets.defaultTilesetId)
        .applyTo(resolved)
    };
  }

  #emitCommand(
    command: VoxelCommand,
    origin: VoxelCommandOrigin
  ): void {
    this.emit("command", command, { origin });
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

  #syncAtlases(
    source: string
  ): void {
    for (const tilesetId of this.tilesetManager.syncAtlases()) {
      this.#materials.invalidate(tilesetId);
    }
    this.markAllChunksDirty(source);
  }

  #registerTilesets(
    sources: Iterable<TilesetSource> = []
  ): void {
    for (const { def, texture } of sources) {
      if (!this.tilesetManager.get(def.id)) {
        this.tilesets.add(def);
        this.tilesetManager.registerTexture(def.id, texture);
      }
    }
  }
}
