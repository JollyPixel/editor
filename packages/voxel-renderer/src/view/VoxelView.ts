// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { BlockShape } from "../document/blocks/shape/BlockShape.ts";
import { BlockShapeRegistry } from "../document/blocks/shape/BlockShapeRegistry.ts";
import { BlockComplements } from "../document/blocks/BlockComplements.ts";
import type { VoxelPart } from "../document/world/types.ts";
import {
  packVoxel,
  unpackVoxel,
  VOXEL_ABSENT
} from "../document/world/storage/packedVoxel.ts";
import type { Vec3 } from "../document/geometry/faceDirection.ts";
import type {
  VoxelCollider,
  VoxelColliderFactory
} from "./collision/VoxelCollider.ts";
import {
  isBlocksetDocumentCommand,
  isVoxelBlendGroupCommand,
  isVoxelMaterialGroupCommand,
  isVoxelBlocksetCommand
} from "../document/commands/categories.ts";
import type {
  VoxelCommand,
  VoxelCommandContext
} from "../document/commands/types.ts";
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
import { ChunkMeshWorkers } from "./workers/ChunkMeshWorkers.ts";
import { BlockLight } from "./lighting/BlockLight.ts";
import {
  VoxelLighting,
  VoxelRange,
  VoxelRendering,
  type VoxelLightingOptions,
  type VoxelMeshingOptions,
  type VoxelRangeOptions,
  type VoxelRenderingOptions
} from "./options/index.ts";
import { BlocksetAtlases } from "./atlases/BlocksetAtlases.ts";
import { VoxelLayerVisibility } from "./VoxelLayerVisibility.ts";
import type { AtlasSource } from "./atlases/loadBlocksets.ts";
import type {
  BlocksetDefinition,
  AtlasNormalTexture,
  AtlasTexture
} from "../document/blocksets/types.ts";
import type { VoxelWorldJSON } from "../document/serialization/types.ts";
import { NOOP_LOGGER, type VoxelLogger } from "../VoxelLogger.ts";

export interface VoxelViewLoadOptions
  extends Omit<VoxelLoadOptions, "blocksets"> {
  /**
   * Atlases to register before loading a world that uses them.
   */
  blocksets?: Iterable<AtlasSource>;
}

export interface BlocksetLoadOptions {
  normal?: AtlasNormalTexture;
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
   * Preloaded atlases (see `loadBlocksets`) registered synchronously during
   * construction.
   */
  blocksets?: Iterable<AtlasSource>;

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
  requestFrame?: () => void;
}

export class VoxelView {
  readonly root = new THREE.Group();

  readonly document: VoxelDocument;
  readonly shapes: BlockShapeRegistry;
  readonly complements: BlockComplements;
  readonly atlases: BlocksetAtlases;
  readonly inspector: VoxelInspector;
  readonly range: VoxelRange;
  readonly lighting: VoxelLighting;
  readonly rendering: VoxelRendering;
  readonly layerVisibility: VoxelLayerVisibility;

  focus: THREE.Vector3Like | null = null;

  #chunkGroup = new THREE.Group();
  #faceTemplates = new FaceTemplateTable();
  #meshBuilder: VoxelMeshBuilder;
  #materials: ChunkMaterialCache;
  #pipeline: ChunkPipeline;
  #meshes: ChunkMeshStore;
  #blockLight: BlockLight;
  #collider: VoxelCollider | null;
  #logger: VoxelLogger;
  #requestFrame: () => void;

  #onCommand = (
    command: VoxelCommand,
    context: VoxelCommandContext
  ): void => {
    this.requestFrame();
    if (isBlocksetDocumentCommand(command) || isVoxelBlocksetCommand(command)) {
      this.#blockLight.refreshSources();
    }
    if (isVoxelBlocksetCommand(command)) {
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
      const { redefinition = "added" } = context;
      const blended = command.block.blendGroup !== undefined;
      if (
        redefinition === "metadata" ||
        (redefinition === "tiles" && !blended && this.#meshBuilder.writeRegions(command.block.id))
      ) {
        return;
      }

      markBlockDirty(
        this.document.world.getLayers(),
        command.block.id,
        blended || redefinition === "added" || redefinition === "occlusion"
      );
    }
    else if (command.action === "block-removed") {
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
    for (const blocksetDef of this.document.blocksets) {
      if (!this.atlases.get(blocksetDef.id)) {
        this.#logger.warn(
          `Blockset '${blocksetDef.id}' is not loaded; its faces are skipped until it is.`
        );
      }
    }
    this.#materials.invalidate();
    this.#blockLight.invalidate();
    this.#rebuildAllChunks("load");
    this.requestFrame();
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
      blocksets = [],
      rendering = {},
      lighting,
      range,
      meshing = {},
      requestFrame = () => undefined
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
    this.#requestFrame = requestFrame;
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
    this.complements = new BlockComplements({
      blocks,
      shapes: this.shapes
    });
    this.atlases = new BlocksetAtlases({
      blocksets: document.blocksets
    });
    this.layerVisibility = new VoxelLayerVisibility(
      () => this.markAllChunksDirty("layerVisibility")
    );
    this.#blockLight = new BlockLight({
      world,
      blocks,
      shapes: this.shapes,
      materialGroups,
      visibility: this.layerVisibility
    });

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
    this.#meshBuilder = meshBuilder;
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
      light: this.#blockLight.textures,
      logger: this.#logger
    });
    this.#materials.blockLight.span.value = this.#blockLight.textures.span;
    this.#meshes = meshes;
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
        onCapacity: () => {
          this.#pipeline.refill();
          this.requestFrame();
        },
        visibility: this.layerVisibility
      })
    });

    const remesh = (source: string) => this.markAllChunksDirty(source);
    this.lighting = new VoxelLighting(
      {
        meshBuilder,
        materials: this.#materials,
        meshes,
        remesh,
        light: this.#blockLight
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

    for (const { def, texture, normal } of blocksets) {
      if (!this.atlases.get(def.id)) {
        this.loadBlockset(def, texture, { normal });
      }
    }

    document.on("command", this.#onCommand);
    document.on("loaded", this.#onLoaded);
  }

  get pendingRebuilds(): number {
    return this.#pipeline.pendingRebuilds;
  }

  get meshVersion(): number {
    return this.#meshes.version;
  }

  init(): void {
    this.#rebuildAllChunks("init");
  }

  tick(
    _deltaTime: number
  ): void {
    this.atlases.refreshAverages();
    this.#updateLight();
    this.#pipeline.tick(this.#viewport());
  }

  flush(): void {
    this.#updateLight();
    this.#pipeline.flush(this.#viewport());
  }

  whenIdle(): Promise<void> {
    return this.#pipeline.whenIdle(this.#viewport());
  }

  loadBlockset(
    def: BlocksetDefinition,
    texture: AtlasTexture,
    options: BlocksetLoadOptions = {}
  ): void {
    this.document.blocksets.declare(def);
    this.atlases.registerTexture(def.id, texture, options.normal);
    this.#logger.debug(
      `Loaded blockset '${def.id}' from '${def.src ?? def.asset?.id}'`
    );

    this.#materials.invalidate(def.id);
    this.markAllChunksDirty("loadBlockset");
  }

  load(
    data: VoxelWorldJSON,
    options: VoxelViewLoadOptions = {}
  ): void {
    const { blocksets = [], mergeLayers } = options;

    const declared: BlocksetDefinition[] = [];
    for (const { def, texture, normal } of blocksets) {
      if (!this.atlases.get(def.id)) {
        this.document.blocksets.declare(def);
        this.atlases.registerTexture(def.id, texture, normal);
        declared.push(def);
      }
    }
    this.document.load(data, {
      mergeLayers,
      blocksets: declared
    });
  }

  canMergeAt(
    layerName: string,
    position: THREE.Vector3Like,
    part: VoxelPart
  ): boolean {
    const layer = this.document.world.getLayer(layerName);
    if (
      layer === undefined ||
      layer.getPartnerVoxelAt(position) !== VOXEL_ABSENT
    ) {
      return false;
    }

    const packed = layer.getPackedVoxelAt(position);

    return packed !== VOXEL_ABSENT && this.complements.complements(
      packed,
      packVoxel(part.blockId, part.transform)
    );
  }

  partAt(
    layerName: string,
    position: THREE.Vector3Like,
    point: THREE.Vector3Like
  ): VoxelPart | null {
    const layer = this.document.world.getLayer(layerName);
    if (layer === undefined) {
      return null;
    }

    const packed = layer.getPackedVoxelAt(position);
    const partner = layer.getPartnerVoxelAt(position);
    if (packed === VOXEL_ABSENT) {
      return null;
    }
    if (partner === VOXEL_ABSENT) {
      return unpackVoxel(packed);
    }

    const occupancy = this.complements.occupancyOf(packed);
    const local: Vec3 = [
      point.x - position.x,
      point.y - position.y,
      point.z - position.z
    ];

    return unpackVoxel(
      occupancy === null || occupancy.contains(local) ? packed : partner
    );
  }

  markAllChunksDirty(
    source?: string
  ): void {
    this.#logger.debug("Marking all chunks dirty...", { source });
    this.document.world.markAllDirty();
    this.requestFrame();
  }

  requestFrame(): void {
    this.#requestFrame();
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

  #updateLight(): void {
    if (this.lighting.blockLight === 0) {
      return;
    }

    this.#meshes.refreshLight(this.#blockLight.update());
  }

  #syncAtlases(): void {
    for (const blocksetId of this.atlases.syncAtlases()) {
      this.#materials.invalidate(blocksetId);
    }
  }
}
