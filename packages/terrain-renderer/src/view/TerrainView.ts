// Import Third-party Dependencies
import * as THREE from "three";
import type { MeshStandardNodeMaterial } from "three/webgpu";

// Import Internal Dependencies
import type { ChunkCoord } from "../terrain/ChunkCoord.ts";
import type { TerrainReader } from "../terrain/Terrain.ts";
import type { TileCoord } from "../terrain/TileCoord.ts";
import {
  LEAF_NODE_SIZE,
  LodRanges
} from "./lod/LodRanges.ts";
import type { LodFocusArea } from "./lod/LodFocus.ts";
import {
  QuadtreeSelection,
  type SelectedNode
} from "./lod/QuadtreeSelection.ts";
import {
  buildGridMesh,
  type NodeMeshData
} from "./mesh/buildGridMesh.ts";
import {
  createTerrainShading,
  DEFAULT_WALKABLE_SLOPE,
  GRID_ATTRIBUTE,
  MAX_WALKABLE_SLOPE,
  MORPH_OFFSETS_ATTRIBUTE,
  NODE_DATA_ATTRIBUTE,
  NODE_MORPH_ATTRIBUTE,
  type TerrainOverlay,
  type TerrainShading
} from "./shading/terrainNodes.ts";
import { ChunkTextureStore } from "./textures/ChunkTextureStore.ts";
import {
  MaterialTextureStore,
  type MaterialImage,
  type MaterialMap,
  type MaterialSurface,
  type TextureCopier
} from "./textures/MaterialTextureStore.ts";

// CONSTANTS
export const NODE_RESOLUTION = LEAF_NODE_SIZE;
const kInitialCapacity = 64;

export interface TerrainViewOptions {
  ranges?: LodRanges;
  /**
   * Called when the view changes without the camera moving, for renderers
   * that draw on demand.
   */
  requestFrame?: () => void;
  /**
   * Copies material images into the material texture arrays on the GPU.
   * Without it, the view draws every material in its fallback colour.
   */
  textureCopier?: TextureCopier;
}

export class TerrainView {
  readonly root = new THREE.Group();
  readonly selection: QuadtreeSelection;
  readonly material: MeshStandardNodeMaterial;

  #terrain: TerrainReader;
  #requestFrame: () => void;
  #shading: TerrainShading;
  #overlay: TerrainOverlay = "none";
  #revealHoles = false;
  #revealChunks = false;
  #walkableSlope = DEFAULT_WALKABLE_SLOPE;
  #highlightedMaterial: number | null = null;
  #textures: ChunkTextureStore;
  #materials: MaterialTextureStore;
  #nodes: NodeBatch;
  #quarters: NodeBatch;
  #frustum = new THREE.Frustum();
  #projection = new THREE.Matrix4();
  #box = new THREE.Box3();

  constructor(
    terrain: TerrainReader,
    options: TerrainViewOptions = {}
  ) {
    const {
      ranges = new LodRanges(),
      requestFrame = () => undefined,
      textureCopier = null
    } = options;
    this.#terrain = terrain;
    this.#requestFrame = requestFrame;
    this.selection = new QuadtreeSelection(terrain, ranges);
    this.#textures = new ChunkTextureStore(terrain, {
      replaced: (tier, arrays) => this.#shading.refinedArrays(tier, arrays)
    });
    this.#materials = new MaterialTextureStore({
      copier: textureCopier,
      replaced: (arrays) => this.#shading.materialArrays(arrays)
    });
    this.#shading = createTerrainShading({
      heights: this.#textures.heights,
      splatIndices: this.#textures.splatIndices,
      splatWeights: this.#textures.splatWeights,
      holes: this.#textures.holes,
      refined: {
        2: this.#textures.refinedArrays(2),
        4: this.#textures.refinedArrays(4)
      },
      lookup: this.#textures.lookup,
      overview: this.#textures.overview,
      overviewMaterials: this.#textures.overviewMaterials,
      materialSlots: this.#materials.slots,
      materialArrays: this.#materials.arrays
    });
    this.material = this.#shading.material;
    this.#nodes = new NodeBatch(buildGridMesh(NODE_RESOLUTION), this.material);
    this.#quarters = new NodeBatch(buildGridMesh(NODE_RESOLUTION / 2), this.material);
    this.root.name = "TerrainView";
    this.root.add(this.#nodes.mesh, this.#quarters.mesh);
    this.reset();
  }

  get overlay(): TerrainOverlay {
    return this.#overlay;
  }

  set overlay(
    mode: TerrainOverlay
  ) {
    this.#overlay = mode;
    this.#shading.overlay(mode);
    this.#requestFrame();
  }

  get revealHoles(): boolean {
    return this.#revealHoles;
  }

  set revealHoles(
    revealed: boolean
  ) {
    this.#revealHoles = revealed;
    this.#shading.revealHoles(revealed);
    this.#requestFrame();
  }

  get revealChunks(): boolean {
    return this.#revealChunks;
  }

  set revealChunks(
    revealed: boolean
  ) {
    this.#revealChunks = revealed;
    this.#shading.revealChunks(revealed);
    this.#requestFrame();
  }

  get highlightedMaterial(): number | null {
    return this.#highlightedMaterial;
  }

  set highlightedMaterial(
    slot: number | null
  ) {
    this.#highlightedMaterial = slot;
    this.#shading.highlightSlot(slot);
    this.#requestFrame();
  }

  focusOn(
    areas: Iterable<LodFocusArea>
  ): void {
    this.selection.focusOn(areas);
    this.#requestFrame();
  }

  get walkableSlope(): number {
    return this.#walkableSlope;
  }

  set walkableSlope(
    degrees: number
  ) {
    this.#walkableSlope = Number.isFinite(degrees) ?
      Math.min(Math.max(degrees, 0), MAX_WALKABLE_SLOPE) :
      DEFAULT_WALKABLE_SLOPE;
    this.#shading.walkableSlope(this.#walkableSlope);
    this.#requestFrame();
  }

  get materialTextureSize(): number {
    return this.#materials.size;
  }

  set materialTextureSize(
    size: number
  ) {
    this.#materials.resize(size);
    this.#requestFrame();
  }

  materialChanged(
    slot: number,
    surface: MaterialSurface
  ): void {
    this.#materials.materialChanged(slot, surface);
    this.#requestFrame();
  }

  materialRemoved(
    slot: number
  ): void {
    this.#materials.materialRemoved(slot);
    this.#requestFrame();
  }

  writeMaterialMap(
    slot: number,
    map: MaterialMap,
    image: MaterialImage | null
  ): void {
    this.#materials.writeMap(slot, map, image);
    this.#requestFrame();
  }

  chunkAdded(
    coord: ChunkCoord
  ): void {
    this.#textures.chunkAdded(coord);
    this.selection.invalidate([coord]);
    this.#requestFrame();
  }

  chunkRemoved(
    coord: ChunkCoord
  ): void {
    this.#textures.chunkRemoved(coord);
    this.selection.invalidate([coord]);
    this.#requestFrame();
  }

  tilesChanged(
    tiles: Iterable<TileCoord>
  ): void {
    const changed = [...tiles];
    this.#textures.tilesChanged(changed);
    this.selection.invalidate(new Map(changed.map(({ chunk }) => [chunk.key, chunk])).values());
    this.#requestFrame();
  }

  splatChanged(
    tiles: Iterable<TileCoord>
  ): void {
    this.#textures.splatChanged(tiles);
    this.#requestFrame();
  }

  holesChanged(
    tiles: Iterable<TileCoord>
  ): void {
    this.#textures.holesChanged(tiles);
    this.#requestFrame();
  }

  overviewChanged(
    coords: Iterable<ChunkCoord>
  ): void {
    const changed = [...coords];
    this.#textures.overviewChanged(changed);
    this.selection.invalidate(changed);
    this.#requestFrame();
  }

  reset(): void {
    this.selection.invalidate();
    this.#textures.clear();
    for (const { coord } of this.#terrain.chunks()) {
      this.#textures.chunkAdded(coord);
    }
    this.#textures.overviewChanged(
      [...this.#terrain.overview.coords()].filter((coord) => !this.#terrain.has(coord))
    );
    this.#requestFrame();
  }

  update(
    camera: THREE.Camera
  ): readonly SelectedNode[] {
    camera.updateMatrixWorld();
    this.#projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.#frustum.setFromProjectionMatrix(this.#projection);
    const eye = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);

    const selected = this.selection.select(eye, {
      visible: (bounds) => {
        this.#box.min.set(bounds.min.x, bounds.min.y, bounds.min.z);
        this.#box.max.set(bounds.max.x, bounds.max.y, bounds.max.z);

        return this.#frustum.intersectsBox(this.#box);
      }
    });
    const { ranges } = this.selection;
    this.#nodes.write(selected.filter((node) => !isQuarter(node, ranges)), ranges);
    this.#quarters.write(selected.filter((node) => isQuarter(node, ranges)), ranges);

    return selected;
  }

  dispose(): void {
    this.#nodes.dispose();
    this.#quarters.dispose();
    this.material.dispose();
    this.#textures.dispose();
    this.#materials.dispose();
  }
}

function isQuarter(
  node: SelectedNode,
  ranges: LodRanges
): boolean {
  return node.size < ranges.nodeSize(node.level);
}

function gridPositions(
  data: NodeMeshData
): Float32Array {
  const positions = new Float32Array(data.grid.length / 4 * 3);
  for (let vertex = 0; vertex < positions.length / 3; vertex++) {
    positions[vertex * 3] = data.grid[vertex * 4];
    positions[vertex * 3 + 2] = data.grid[vertex * 4 + 1];
  }

  return positions;
}

class NodeBatch {
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, MeshStandardNodeMaterial>;

  #capacity = 0;

  constructor(
    data: NodeMeshData,
    material: MeshStandardNodeMaterial
  ) {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
    geometry.setAttribute(GRID_ATTRIBUTE, new THREE.BufferAttribute(data.grid, 4));
    geometry.setAttribute(MORPH_OFFSETS_ATTRIBUTE, new THREE.BufferAttribute(data.morph, 4));
    geometry.setAttribute("position", new THREE.BufferAttribute(gridPositions(data), 3));
    geometry.instanceCount = 0;
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.#reserve(kInitialCapacity);
  }

  write(
    nodes: readonly SelectedNode[],
    ranges: LodRanges
  ): void {
    if (nodes.length > this.#capacity) {
      this.#reserve(Math.max(nodes.length, this.#capacity * 2));
    }

    const geometry = this.mesh.geometry;
    const data = geometry.getAttribute(NODE_DATA_ATTRIBUTE) as THREE.InstancedBufferAttribute;
    const morph = geometry.getAttribute(NODE_MORPH_ATTRIBUTE) as THREE.InstancedBufferAttribute;
    nodes.forEach((node, index) => {
      const spacing = ranges.nodeSize(node.level) / NODE_RESOLUTION;
      data.setXYZW(index, node.x, node.z, spacing, spacing);
      morph.setXYZ(
        index,
        ranges.morphStart(node.level) * node.bias,
        ranges.morphEnd(node.level) * node.bias,
        node.skirts
      );
    });
    data.needsUpdate = true;
    morph.needsUpdate = true;
    geometry.instanceCount = nodes.length;
    this.mesh.visible = nodes.length > 0;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
  }

  #reserve(
    capacity: number
  ): void {
    this.#capacity = capacity;
    this.mesh.geometry.setAttribute(
      NODE_DATA_ATTRIBUTE,
      new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4)
    );
    this.mesh.geometry.setAttribute(
      NODE_MORPH_ATTRIBUTE,
      new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3)
    );
  }
}
