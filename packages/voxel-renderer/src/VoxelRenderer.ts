// Import Third-party Dependencies
import * as THREE from "three";
import {
  Actor,
  ActorComponent,
  Systems
} from "@jolly-pixel/engine";

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
import {
  VoxelColliderBuilder,
  type RapierAPI,
  type RapierCollider,
  type RapierWorld
} from "./collision/VoxelColliderBuilder.ts";
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
import { VoxelWorld } from "./world/VoxelWorld.ts";
import {
  VoxelLayer,
  type VoxelLayerConfigurableOptions
} from "./world/VoxelLayer.ts";
import { VoxelChunk } from "./world/VoxelChunk.ts";
import type { VoxelEntry, VoxelCoord } from "./world/types.ts";
import { packTransform, type FACE } from "./utils/math.ts";
import { FACE_OFFSETS } from "./mesh/math.ts";
import type {
  VoxelLayerHookListener
} from "./hooks.ts";

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

export interface VoxelSetOptions {
  position: THREE.Vector3Like;
  blockId: number;
  /** Y-axis rotation. Use the `VoxelRotation` constants. Default: `VoxelRotation.None` */
  rotation?: typeof VoxelRotation[keyof typeof VoxelRotation];
  /** Mirror the block around x = 0.5. Default: false */
  flipX?: boolean;
  /** Mirror the block around z = 0.5. Default: false */
  flipZ?: boolean;
  /** Mirror the block around y = 0.5. Default: false */
  flipY?: boolean;
}

export interface VoxelRemoveOptions {
  position: THREE.Vector3Like;
}

export interface VoxelRendererOptions {
  /**
   * @default 16
   */
  chunkSize?: number;
  /**
   * Enables collision shapes when provided.
   * disabled by default to avoid forcing Rapier as a dependency for users who don't need physics.
   */
  rapier?: {
    /** Rapier3D module (static API) */
    api: RapierAPI;
    /** Rapier3D world instance */
    world: RapierWorld;
  };
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
   * Uses the engine's default logger if not provided.
   */
  logger?: Systems.Logger;

  /**
   * Optional callback that is called whenever a layer is added, removed, or updated.
   * Useful for synchronizing external systems with changes to the voxel world.
   */
  onLayerUpdated?: VoxelLayerHookListener;
}

/**
 * ActorComponent that renders a layered voxel world as chunked THREE.js meshes.
 *
 * Usage:
 *   const vr = actor.addComponentAndGet(VoxelRenderer, { chunkSize: 16 });
 *   await vr.loadTileset({ id: "default", src: "tileset.png", tileSize: 16, cols: 16, rows: 16 });
 *   vr.blockRegistry.register({ id: 1, name: "Grass", shapeId: "fullCube", ... });
 *   const layer = vr.addLayer("Ground");
 *   vr.setVoxel(layer.id, 0, 0, 0, 1);
 */
export class VoxelRenderer extends ActorComponent {
  readonly world: VoxelWorld;
  readonly blockRegistry: BlockRegistry;
  readonly shapeRegistry: BlockShapeRegistry;
  readonly tilesetManager: TilesetManager;
  readonly serializer: VoxelSerializer;

  #meshBuilder: VoxelMeshBuilder;
  #colliderBuilder: VoxelColliderBuilder | null = null;

  /**
   * "layerId:cx,cy,cz:tilesetId" → THREE.Mesh.
   * Each chunk may have one mesh per tileset (separate draw call per texture).
   **/
  #chunkMeshes = new Map<string, THREE.Mesh>();
  #chunkColliders = new Map<string, RapierCollider>();

  /**
   * One material per tileset ID. Created lazily; disposed on tileset reload or destroy.
   */
  #materials = new Map<
    string,
    THREE.MeshLambertMaterial | THREE.MeshStandardMaterial
  >();
  #materialCustomizer?: MaterialCustomizerFn;
  #materialType: "lambert" | "standard";
  #alphaTest: number;

  #logger: Systems.Logger;
  #onLayerUpdated?: VoxelLayerHookListener;

  constructor(
    actor: Actor<any>,
    options: VoxelRendererOptions = {}
  ) {
    super({
      actor,
      typeName: "VoxelRenderer"
    });

    const {
      chunkSize = 16,
      material = "lambert",
      materialCustomizer,
      layers = [],
      rapier,
      blocks = [],
      shapes = [],
      alphaTest = 0.1,
      logger = actor.world.logger,
      onLayerUpdated
    } = options;

    this.#materialType = material;
    this.#materialCustomizer = materialCustomizer;
    this.#alphaTest = alphaTest;
    this.#onLayerUpdated = onLayerUpdated;
    this.#logger = logger.child({
      namespace: "VoxelRenderer"
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

    this.tilesetManager = new TilesetManager();
    this.serializer = new VoxelSerializer();

    this.#meshBuilder = new VoxelMeshBuilder({
      world: this.world,
      blockRegistry: this.blockRegistry,
      shapeRegistry: this.shapeRegistry,
      tilesetManager: this.tilesetManager
    });

    if (rapier) {
      const { api, world } = rapier;

      this.#colliderBuilder = new VoxelColliderBuilder({
        rapier: api,
        world,
        blockRegistry: this.blockRegistry,
        shapeRegistry: this.shapeRegistry
      });
    }
  }

  // --- Lifecycle --- //
  awake(): void {
    // Build initial meshes for all existing chunks (e.g. after deserialize).
    this.#rebuildAllChunks("awake");
  }

  update(
    _deltaTime: number
  ): void {
    for (const { layer, chunk } of this.world.getAllChunksToBeRemoved()) {
      this.#removeChunk(layer, chunk);
    }

    // Rebuild only chunks that have been modified since the last frame.
    for (const { layer, chunk } of this.world.getAllDirtyChunks()) {
      if (!layer.visible) {
        if (layer.wasVisible) {
          this.#removeChunk(layer, chunk);
        }

        continue;
      }

      if (layer.visible) {
        this.#removeChunk(layer, chunk);
      }
      this.#rebuildChunk(layer, chunk);
      chunk.dirty = false;
    }
  }

  override destroy(): void {
    this.#logger.debug("Destroying VoxelRenderer.");
    // Remove and dispose all chunk meshes individually (we own the geometries
    // but share materials per tileset, so we must NOT call removeChildren).
    for (const mesh of this.#chunkMeshes.values()) {
      this.actor.object3D.remove(mesh);
      mesh.geometry.dispose();
    }
    this.#chunkMeshes.clear();
    this.#chunkColliders.clear();

    for (const mat of this.#materials.values()) {
      mat.dispose();
    }
    this.#materials.clear();

    this.tilesetManager.dispose();

    super.destroy();
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
    this.#onLayerUpdated?.({
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
    this.#onLayerUpdated?.({
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
  }

  removeVoxelBulk(
    layerName: string,
    entries: VoxelRemoveOptions[]
  ): void {
    for (const { position } of entries) {
      this.world.removeVoxelAt(layerName, position);
    }
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

  addLayer(
    name: string,
    options: VoxelLayerConfigurableOptions = {}
  ): VoxelLayer {
    const layer = this.world.addLayer(name, options);
    this.#onLayerUpdated?.({
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
      this.#onLayerUpdated?.({
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
      this.#onLayerUpdated?.({
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
    this.#onLayerUpdated?.({
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
    this.#onLayerUpdated?.({
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
    this.#onLayerUpdated?.({
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
    this.#onLayerUpdated?.({
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
      this.#onLayerUpdated?.({
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
      this.#onLayerUpdated?.({
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
      this.#onLayerUpdated?.({
        action: "object-added",
        layerName,
        metadata: { objectId: object.id }
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
      this.#onLayerUpdated?.({
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
      this.#onLayerUpdated?.({
        action: "object-updated",
        layerName,
        metadata: { objectId, patch }
      });
    }

    return result;
  }

  loadTilesetSync(
    def: TilesetDefinition,
    texture: THREE.Texture<HTMLImageElement>
  ): void {
    this.tilesetManager.registerTexture(def, texture);
    this.#logger.debug(`Loaded tileset '${def.id}' from '${def.src}' (synchronous)`);

    // Invalidate the cached material for this tileset so it is recreated
    // with the new texture.
    const existingMaterial = this.#materials.get(def.id);
    existingMaterial?.dispose();
    this.#materials.delete(def.id);

    // Force all chunks to rebuild geometry (UV offsets may have changed).
    this.markAllChunksDirty("loadTilesetSync");
  }

  async loadTileset(
    def: TilesetDefinition
  ): Promise<void> {
    const textureLoader = new THREE.TextureLoader(
      this.actor.world.loadingManager
    );
    const texture = await textureLoader.loadAsync(
      def.src
    );

    this.tilesetManager.registerTexture(def, texture);
    this.#logger.debug(`Loaded tileset '${def.id}' from '${def.src}' (asynchronous)`);

    // Invalidate the cached material for this tileset so it is recreated
    // with the new texture.
    const existingMaterial = this.#materials.get(def.id);
    existingMaterial?.dispose();
    this.#materials.delete(def.id);

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

  async load(
    data: VoxelWorldJSON
  ): Promise<void> {
    // Clear existing meshes before replacing world data.
    for (const mesh of this.#chunkMeshes.values()) {
      this.actor.object3D.remove(mesh);
      mesh.geometry.dispose();
    }
    this.#chunkMeshes.clear();
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

    const textureLoader = new THREE.TextureLoader(
      this.actor.world.loadingManager
    );

    // Reload any tilesets listed in the snapshot that are not already loaded.
    for (const tilesetDef of data.tilesets) {
      if (!this.tilesetManager.getTexture(tilesetDef.id)) {
        await this.tilesetManager.loadTileset(tilesetDef, textureLoader);
      }
    }

    // Dispose cached materials so they are recreated with the correct textures.
    for (const mat of this.#materials.values()) {
      mat.dispose();
    }
    this.#materials.clear();

    this.#rebuildAllChunks("load");
  }

  #getMaterial(
    tilesetId: string
  ): THREE.MeshLambertMaterial | THREE.MeshStandardMaterial {
    this.#logger.debug(`Getting material for tileset '${tilesetId}'`);

    let material = this.#materials.get(tilesetId);
    if (material) {
      return material;
    }

    const texture = this.tilesetManager.getTexture(
      tilesetId
    ) ?? null;

    if (this.#materialType === "standard") {
      material = new THREE.MeshStandardMaterial({
        map: texture,
        side: THREE.FrontSide,
        alphaTest: this.#alphaTest
      });
    }
    else {
      material = new THREE.MeshLambertMaterial({
        map: texture,
        side: THREE.FrontSide,
        alphaTest: this.#alphaTest
      });
    }
    this.#materialCustomizer?.(material, tilesetId);

    this.#materials.set(tilesetId, material);

    return material;
  }

  #removeChunk(
    layer: VoxelLayer,
    chunk: VoxelChunk
  ) {
    const chunkKeyBase = `${layer.id}:${chunk.toString()}`;
    this.#logger.debug(
      `Removing chunk '${chunkKeyBase}' with layer name '${layer.name}'`
    );

    // Remove all existing meshes for this chunk (rebuilt per tileset below).
    for (const key of this.#chunkMeshes.keys()) {
      if (!key.startsWith(`${chunkKeyBase}:`)) {
        continue;
      }

      const mesh = this.#chunkMeshes.get(key)!;
      this.actor.object3D.remove(mesh);
      mesh.geometry.dispose();
      this.#chunkMeshes.delete(key);
    }

    // Remove any existing collider for this chunk.
    this.#chunkColliders.delete(chunkKeyBase);
  }

  #rebuildChunk(
    layer: VoxelLayer,
    chunk: VoxelChunk
  ): void {
    const chunkKeyBase = `${layer.id}:${chunk.toString()}`;
    this.#logger.debug(
      `Rebuilding chunk '${chunkKeyBase}' with layer name '${layer.name}'`
    );

    const geometries = this.#meshBuilder.buildChunkGeometries(chunk, layer);
    if (!geometries) {
      return;
    }

    // Create one mesh per tileset so each can use the correct texture.
    for (const [tilesetId, geometry] of geometries) {
      const key = `${chunkKeyBase}:${tilesetId}`;
      const mesh = new THREE.Mesh(geometry, this.#getMaterial(tilesetId));
      mesh.name = `voxel_chunk_${key}`;

      this.actor.object3D.add(mesh);
      this.#chunkMeshes.set(key, mesh);
    }

    // Rebuild collision collider if physics is enabled.
    if (this.#colliderBuilder) {
      const offset = layer.offset;
      this.#logger.debug(
        `Rebuilding chunk geometries collider '${chunkKeyBase}' with layer name '${layer.name}'`,
        {
          offset
        }
      );

      const collider = this.#buildColliderFromGeometries(chunk, geometries, offset);
      if (collider) {
        this.#logger.debug(`Successfully built collider for chunk '${chunkKeyBase}'`);

        this.#chunkColliders.set(chunkKeyBase, collider);
      }
    }
  }

  /**
   * Merges all per-tileset geometries into a single combined shape for Rapier.
   * Collision is texture-agnostic so the tileset split is irrelevant here.
   */
  #buildColliderFromGeometries(
    chunk: VoxelChunk,
    geometries: Map<string, THREE.BufferGeometry>,
    layerOffset: { x: number; y: number; z: number; }
  ): RapierCollider | null {
    const colliderBuilder = this.#colliderBuilder;
    if (!colliderBuilder) {
      return null;
    }

    if (geometries.size === 1) {
      // Fast path: single tileset — pass the geometry directly.
      const [geometry] = geometries.values();

      return colliderBuilder.buildChunkCollider(chunk, geometry, layerOffset);
    }

    // Merge position/index arrays from all tileset geometries.
    const combinedPositions: number[] = [];
    const combinedIndices: number[] = [];
    let indexOffset = 0;

    for (const geo of geometries.values()) {
      const posAttr = geo.getAttribute("position");
      const idxAttr = geo.index;
      if (!idxAttr) {
        continue;
      }

      for (let i = 0; i < posAttr.array.length; i++) {
        combinedPositions.push(posAttr.array[i]);
      }
      for (let i = 0; i < idxAttr.array.length; i++) {
        combinedIndices.push(idxAttr.array[i] + indexOffset);
      }
      indexOffset += posAttr.count;
    }

    if (combinedPositions.length === 0) {
      return null;
    }

    const combinedGeo = new THREE.BufferGeometry();
    combinedGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(combinedPositions, 3)
    );
    combinedGeo.setIndex(combinedIndices);

    const collider = colliderBuilder.buildChunkCollider(chunk, combinedGeo, layerOffset);
    combinedGeo.dispose();

    return collider;
  }

  #rebuildAllChunks(
    source?: string
  ): void {
    this.#logger.debug("Rebuilding all chunks...", { source });

    for (const { layer, chunk } of this.world.getAllChunks()) {
      this.#rebuildChunk(layer, chunk);
      chunk.dirty = false;
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
