// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { BlockShape } from "../document/blocks/shape/BlockShape.ts";
import { BlockShapeRegistry } from "../document/blocks/shape/BlockShapeRegistry.ts";
import type {
  VoxelCollider,
  VoxelColliderFactory
} from "./collision/VoxelCollider.ts";
import {
  isVoxelBlendGroupCommand,
  isVoxelMaterialGroupCommand,
  isVoxelTilesetCommand
} from "../document/commands/categories.ts";
import type { VoxelCommand } from "../document/commands/types.ts";
import { markBlockDirty } from "../document/world/editing/markBlockDirty.ts";
import type {
  VoxelDocument,
  VoxelLoadOptions
} from "../document/VoxelDocument.ts";
import {
  VoxelInspector,
  type VoxelInspectorOptions
} from "./inspector/index.ts";
import {
  FaceTemplateTable,
  VoxelMeshBuilder
} from "./meshing/index.ts";
import { ChunkMaterialCache } from "./shading/ChunkMaterialCache.ts";
import { ChunkMeshLayout } from "./chunks/ChunkMeshLayout.ts";
import { ChunkMeshStore } from "./chunks/ChunkMeshStore.ts";
import { ChunkPipeline } from "./chunks/ChunkPipeline.ts";
import { ChunkViewport } from "./chunks/ChunkViewport.ts";
import { BlockReach } from "./chunks/BlockReach.ts";
import { ChunkMeshWorkers } from "./workers/ChunkMeshWorkers.ts";
import {
  VoxelLighting,
  VoxelRange,
  VoxelRendering,
  type VoxelLightingOptions,
  type VoxelMeshingOptions,
  type VoxelRangeOptions,
  type VoxelRenderingOptions
} from "./options/index.ts";
import { TilesetAtlases } from "./atlases/TilesetAtlases.ts";
import { VoxelLayerVisibility } from "./VoxelLayerVisibility.ts";
import type { TilesetSource } from "./atlases/loadTilesets.ts";
import type {
  TilesetDefinition,
  TilesetTexture
} from "../document/tilesets/types.ts";
import type { VoxelWorldJSON } from "../document/serialization/types.ts";
import { NOOP_LOGGER, type VoxelLogger } from "../VoxelLogger.ts";

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
  readonly atlases: TilesetAtlases;
  readonly inspector: VoxelInspector;
  readonly range: VoxelRange;
  readonly lighting: VoxelLighting;
  readonly rendering: VoxelRendering;
  readonly layerVisibility: VoxelLayerVisibility;

  focus: THREE.Vector3Like | null = null;

  #chunkGroup = new THREE.Group();
  #faceTemplates = new FaceTemplateTable();
  #materials: ChunkMaterialCache;
  #pipeline: ChunkPipeline;
  #collider: VoxelCollider | null;
  #logger: VoxelLogger;
  #blockReach = new BlockReach();

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
    else if (command.action === "block-defined") {
      markBlockDirty(
        this.document.world.getLayers(),
        command.block.id,
        this.#blockReach.redefine(command.block)
      );
    }
    else if (command.action === "block-removed") {
      this.#blockReach.forget(command.blockId);
      markBlockDirty(
        this.document.world.getLayers(),
        command.blockId,
        true
      );
    }
    else if (isVoxelBlendGroupCommand(command)) {
      this.markAllChunksDirty(command.action);
    }
  };

  #onLoaded = (): void => {
    this.#pipeline.clear();
    this.#logger.debug("Cleared existing chunk meshes while loading a world.");

    this.atlases.syncAtlases();
    for (const tilesetDef of this.document.tilesets) {
      if (!this.atlases.get(tilesetDef.id)) {
        this.#logger.warn(
          `Tileset '${tilesetDef.id}' is not loaded; its faces are skipped until it is.`
        );
      }
    }
    this.#materials.invalidate();
    this.#blockReach.reset(this.document.blocks.getAll());
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
      tilesets = [],
      rendering = {},
      lighting,
      range,
      meshing = {}
    } = options;
    const {
      material = "lambert",
      customizer,
      alphaTest = 0.1
    } = rendering;
    const { budgetMs = 8, workers } = meshing;
    const {
      world,
      blocks,
      materialGroups,
      blendGroups
    } = document;

    this.document = document;
    this.root.name = "VoxelView";
    this.#chunkGroup.name = "VoxelView:chunks";
    this.root.add(this.#chunkGroup);

    this.range = new VoxelRange(range);
    this.#logger = logger.child({
      namespace: "VoxelView"
    });

    this.inspector = new VoxelInspector(
      {
        parent: this.root,
        solids: this.#chunkGroup,
        world,
        blockRegistry: blocks
      },
      inspector
    );
    this.shapes = BlockShapeRegistry.createDefault();
    shapes.forEach(
      (shape) => this.shapes.register(shape)
    );
    this.atlases = new TilesetAtlases({
      tilesets: document.tilesets
    });
    this.layerVisibility = new VoxelLayerVisibility(
      () => this.markAllChunksDirty("layerVisibility")
    );

    const meshBuilder = new VoxelMeshBuilder({
      world,
      blockRegistry: blocks,
      shapeRegistry: this.shapes,
      atlases: this.atlases,
      blendGroups,
      alphaTest,
      faceTemplates: this.#faceTemplates,
      logger: this.#logger,
      visibility: this.layerVisibility
    });
    this.#collider = collider?.({
      blockRegistry: blocks,
      shapeRegistry: this.shapes
    }) ?? null;
    this.#materials = new ChunkMaterialCache({
      atlases: this.atlases,
      faceTemplates: this.#faceTemplates,
      materialGroups,
      type: material,
      customizer
    });

    const layout = new ChunkMeshLayout(world, this.layerVisibility);
    const meshes = new ChunkMeshStore({
      root: this.#chunkGroup,
      layout,
      meshBuilder,
      materials: this.#materials,
      inspector: this.inspector,
      collider: this.#collider,
      logger: this.#logger
    });
    this.#pipeline = new ChunkPipeline({
      world,
      layout,
      meshes,
      budgetMs,
      workers: ChunkMeshWorkers.create(workers, {
        world,
        meshBuilder,
        definitions: {
          blockRegistry: blocks,
          shapeRegistry: this.shapes,
          atlases: this.atlases,
          blendGroups,
          alphaTest
        },
        logger: this.#logger,
        onCapacity: () => this.#pipeline.refill(),
        visibility: this.layerVisibility
      })
    });

    const remesh = (source: string) => this.markAllChunksDirty(source);
    this.lighting = new VoxelLighting(
      {
        meshBuilder,
        materials: this.#materials,
        meshes,
        remesh
      },
      lighting
    );
    this.rendering = new VoxelRendering(
      {
        materials: this.#materials,
        remesh
      },
      rendering
    );

    for (const { def, texture } of tilesets) {
      if (!this.atlases.get(def.id)) {
        this.loadTileset(def, texture);
      }
    }

    this.#blockReach.reset(blocks.getAll());
    document.on("command", this.#onCommand);
    document.on("loaded", this.#onLoaded);
  }

  get pendingRebuilds(): number {
    return this.#pipeline.pendingRebuilds;
  }

  init(): void {
    this.#rebuildAllChunks("init");
  }

  tick(
    _deltaTime: number
  ): void {
    this.atlases.refreshAverages();
    this.#pipeline.tick(this.#viewport());
  }

  flush(): void {
    this.#pipeline.flush(this.#viewport());
  }

  whenIdle(): Promise<void> {
    return this.#pipeline.whenIdle(this.#viewport());
  }

  loadTileset(
    def: TilesetDefinition,
    texture: TilesetTexture
  ): void {
    this.document.tilesets.declare(def);
    this.atlases.registerTexture(def.id, texture);
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

    const declared: TilesetDefinition[] = [];
    for (const { def, texture } of tilesets) {
      if (!this.atlases.get(def.id)) {
        this.document.tilesets.declare(def);
        this.atlases.registerTexture(def.id, texture);
        declared.push(def);
      }
    }
    this.document.load(data, {
      mergeLayers,
      tilesets: declared
    });
  }

  markAllChunksDirty(
    source?: string
  ): void {
    this.#logger.debug("Marking all chunks dirty...", { source });
    this.document.world.markAllDirty();
  }

  dispose(): void {
    this.#logger.debug("Disposing VoxelView.");
    this.document.off("command", this.#onCommand);
    this.document.off("loaded", this.#onLoaded);
    this.#pipeline.dispose();
    this.inspector.dispose();
    this.#collider?.dispose();
    this.#materials.dispose();
    this.#faceTemplates.dispose();
    this.atlases.dispose();
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

  #rebuildAllChunks(
    source: string
  ): void {
    this.#logger.debug("Rebuilding all chunks...", { source });
    this.#pipeline.rebuildAll(this.#viewport());
  }

  #syncAtlases(): void {
    for (const tilesetId of this.atlases.syncAtlases()) {
      this.#materials.invalidate(tilesetId);
    }
  }
}
