// Import Third-party Dependencies
import * as THREE from "three";
import type { MeshStandardNodeMaterial } from "three/webgpu";

// Import Internal Dependencies
import type { ChunkCoord } from "../document/ChunkCoord.ts";
import type { TerrainReader } from "../document/TerrainDocument.ts";
import { LodRanges } from "./lod/LodRanges.ts";
import {
  QuadtreeSelection,
  type SelectedNode
} from "./lod/QuadtreeSelection.ts";
import {
  GridMeshProvider,
  type NodeMeshData,
  type NodeMeshProvider
} from "./mesh/GridMeshProvider.ts";
import {
  createTerrainMaterial,
  GRID_ATTRIBUTE,
  MORPH_OFFSETS_ATTRIBUTE,
  NODE_DATA_ATTRIBUTE,
  NODE_MORPH_ATTRIBUTE
} from "./shading/terrainNodes.ts";
import { ChunkTextureStore } from "./textures/ChunkTextureStore.ts";
import { HeightApronStore } from "./textures/HeightApronStore.ts";

// CONSTANTS
export const NODE_RESOLUTION = 32;
const kSkirtDepthPerSpacing = 2;
const kInitialCapacity = 64;

export interface TerrainViewOptions {
  ranges?: LodRanges;
  meshes?: NodeMeshProvider;
}

export class TerrainView {
  readonly root = new THREE.Group();
  readonly selection: QuadtreeSelection;
  readonly material: MeshStandardNodeMaterial;

  #terrain: TerrainReader;
  #textures: ChunkTextureStore;
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
      meshes = new GridMeshProvider()
    } = options;
    this.#terrain = terrain;
    this.selection = new QuadtreeSelection(terrain, ranges);
    this.#textures = new ChunkTextureStore(new HeightApronStore(terrain));
    this.material = createTerrainMaterial(this.#textures);
    this.#nodes = new NodeBatch(meshes.mesh(NODE_RESOLUTION), this.material);
    this.#quarters = new NodeBatch(meshes.mesh(NODE_RESOLUTION / 2), this.material);
    this.root.name = "TerrainView";
    this.root.add(this.#nodes.mesh, this.#quarters.mesh);
    this.reset();
  }

  chunkAdded(
    coord: ChunkCoord
  ): void {
    this.#textures.chunkAdded(coord);
  }

  chunkRemoved(
    coord: ChunkCoord
  ): void {
    this.#textures.chunkRemoved(coord);
  }

  reset(): void {
    this.#textures.clear();
    for (const { coord } of this.#terrain.chunks()) {
      this.#textures.chunkAdded(coord);
    }
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
    this.#nodes.write(
      selected.filter((node) => node.size === ranges.nodeSize(node.level)),
      ranges
    );
    this.#quarters.write(
      selected.filter((node) => node.size !== ranges.nodeSize(node.level)),
      ranges
    );

    return selected;
  }

  dispose(): void {
    this.#nodes.dispose();
    this.#quarters.dispose();
    this.material.dispose();
    this.#textures.dispose();
  }
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
      data.setXYZW(index, node.x, node.z, spacing, spacing * kSkirtDepthPerSpacing);
      morph.setXY(index, ranges.morphStart(node.level), ranges.morphEnd(node.level));
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
      new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2)
    );
  }
}
