// Import Third-party Dependencies
import * as THREE from "three";
import {
  BLOCK_PIECE_TEXTURED_GROUP,
  VOXEL_ABSENT,
  VoxelTransform,
  voxelBlockId,
  voxelTransform,
  type BlockPiece,
  type BlockPieces,
  type BlockRegistry,
  type BlockSurface,
  type PackedVoxel,
  type VoxelCoord,
  type VoxelTemplate
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { BlockRenderSources } from "../blocks/rendering/BlockRenderSources.ts";

// CONSTANTS
const kOpacity = 0.7;
const kDepthRenderOrder = 1000;
const kOrigin = {
  x: 0,
  y: 0,
  z: 0
};

export interface TemplateGhostOptions {
  sources: BlockRenderSources;
  blockRegistry: BlockRegistry;
  opacity?: number;
}

interface BatchMaterials {
  color: THREE.MeshLambertMaterial;
  depth: THREE.MeshBasicMaterial;
}

interface Batch {
  key: string;
  texture: THREE.Texture | null;
  surface: BlockSurface;
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
}

export class TemplateGhost extends THREE.Group {
  #sources: BlockRenderSources;
  #blockRegistry: BlockRegistry;
  #opacity: number;
  #pieces: BlockPieces;
  #materials = new Map<string, BatchMaterials>();
  #atlasVersion = -1;
  #drawn: {
    template: VoxelTemplate;
    transform: VoxelTransform;
  } | null = null;

  constructor(
    options: TemplateGhostOptions
  ) {
    super();

    this.name = "template-ghost";
    this.#sources = options.sources;
    this.#blockRegistry = options.blockRegistry;
    this.#opacity = options.opacity ?? kOpacity;
    this.#pieces = options.sources.createPieces();
    this.visible = false;
  }

  draw(
    template: VoxelTemplate,
    transform: VoxelTransform
  ): void {
    const { version } = this.#sources.atlases;
    if (version !== this.#atlasVersion) {
      this.#clearMeshes();
      this.#clearMaterials();
      this.#pieces.clear();
      this.#atlasVersion = version;
    }
    else if (
      this.#drawn?.template === template &&
      this.#drawn.transform === transform
    ) {
      this.visible = true;

      return;
    }

    this.#clearMeshes();
    this.#drawn = {
      template,
      transform
    };
    for (const batch of this.#collectBatches(template, transform)) {
      this.add(...this.#createBatchMeshes(batch));
    }
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }

  invalidate(): void {
    this.#pieces.clear();
    this.#drawn = null;
  }

  override dispose(): void {
    this.#clearMeshes();
    this.#clearMaterials();
    this.#pieces.clear();
    this.#drawn = null;
    super.dispose();
  }

  #collectBatches(
    template: VoxelTemplate,
    transform: VoxelTransform
  ): IterableIterator<Batch> {
    const batches = new Map<string, Batch>();
    const placed = template.placedVoxels(kOrigin, transform);
    for (const [x, y, z, packed, partner] of placed) {
      const cell = { x, y, z };
      this.#appendShape(batches, packed, cell);
      this.#appendShape(batches, partner, cell);
    }

    return batches.values();
  }

  #appendShape(
    batches: Map<string, Batch>,
    packed: PackedVoxel,
    cell: VoxelCoord
  ): void {
    if (packed === VOXEL_ABSENT) {
      return;
    }

    const block = this.#blockRegistry.get(voxelBlockId(packed));
    const piece = block === undefined ?
      null :
      this.#pieces.resolvePiece(block, VoxelTransform.fromPacked(voxelTransform(packed)));
    if (piece === null) {
      return;
    }

    const key = batchKey(piece);
    let batch = batches.get(key);
    if (batch === undefined) {
      batch = {
        key,
        texture: piece.texture,
        surface: piece.surface,
        positions: [],
        normals: [],
        uvs: [],
        indices: []
      };
      batches.set(key, batch);
    }
    appendPiece(
      batch,
      piece.geometry,
      cell.x,
      cell.y,
      cell.z
    );
  }

  #resolveBatchMaterials(
    batch: Batch
  ): BatchMaterials {
    const cached = this.#materials.get(batch.key);
    if (cached !== undefined) {
      return cached;
    }

    const side = batch.surface.side === "double" ?
      THREE.DoubleSide :
      THREE.FrontSide;
    const materials: BatchMaterials = {
      color: new THREE.MeshLambertMaterial({
        map: batch.texture,
        alphaTest: batch.surface.alphaCutoff,
        side,
        transparent: true,
        opacity: this.#opacity,
        depthWrite: false
      }),
      depth: new THREE.MeshBasicMaterial({
        side,
        colorWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1
      })
    };
    this.#materials.set(batch.key, materials);

    return materials;
  }

  #createBatchMeshes(
    batch: Batch
  ): [THREE.Mesh, THREE.Mesh] {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(batch.positions, 3)
    );
    geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(batch.normals, 3)
    );
    geometry.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute(batch.uvs, 2)
    );
    geometry.setIndex(batch.indices);

    const materials = this.#resolveBatchMaterials(batch);
    const color = new THREE.Mesh(geometry, materials.color);
    const depth = new THREE.Mesh(geometry, materials.depth);
    depth.renderOrder = kDepthRenderOrder;
    for (const mesh of [color, depth]) {
      mesh.frustumCulled = false;
    }

    return [color, depth];
  }

  #clearMeshes(): void {
    const geometries = new Set<THREE.BufferGeometry>();
    for (const child of this.children) {
      if (child instanceof THREE.Mesh) {
        geometries.add(child.geometry);
      }
    }
    for (const geometry of geometries) {
      geometry.dispose();
    }
    this.clear();
  }

  #clearMaterials(): void {
    for (const { color, depth } of this.#materials.values()) {
      color.dispose();
      depth.dispose();
    }
    this.#materials.clear();
  }
}

function batchKey(
  piece: BlockPiece
): string {
  return `${piece.texture?.uuid ?? "none"}:${piece.surface.alphaCutoff}:${piece.surface.side}`;
}

function appendPiece(
  batch: Batch,
  geometry: THREE.BufferGeometry,
  x: number,
  y: number,
  z: number
): void {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const uv = geometry.getAttribute("uv");
  const index = geometry.getIndex();
  if (index === null) {
    return;
  }

  const offset = batch.positions.length / 3;
  for (let vertex = 0; vertex < position.count; vertex++) {
    batch.positions.push(
      position.getX(vertex) + x,
      position.getY(vertex) + y,
      position.getZ(vertex) + z
    );
    batch.normals.push(
      normal.getX(vertex),
      normal.getY(vertex),
      normal.getZ(vertex)
    );
    batch.uvs.push(uv.getX(vertex), uv.getY(vertex));
  }

  for (const group of geometry.groups) {
    if (group.materialIndex !== BLOCK_PIECE_TEXTURED_GROUP) {
      continue;
    }
    for (let at = group.start; at < group.start + group.count; at++) {
      batch.indices.push(index.getX(at) + offset);
    }
  }
}
