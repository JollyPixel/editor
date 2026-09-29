// Import Third-party Dependencies
import * as THREE from "three";
import {
  BlockSurface,
  VoxelTransform,
  voxelBlockId,
  voxelTransform,
  type BlockRegistry,
  type VoxelTemplate
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  BLOCK_TEXTURED_MATERIAL,
  buildBlockGeometry,
  textureOf,
  type BlockPreviewSources
} from "../../blocks/blockPreviewMesh.ts";

// CONSTANTS
const kDefaultOpacity = 0.55;
const kDepthRenderOrder = 1000;
const kOrigin = {
  x: 0,
  y: 0,
  z: 0
};

export interface TemplateGhostOptions extends BlockPreviewSources {
  blockRegistry: BlockRegistry;
  /**
   * @default 0.55
   */
  opacity?: number;
}

interface CellPiece {
  geometry: THREE.BufferGeometry;
  batchKey: string;
  texture: THREE.Texture | null;
  surface: BlockSurface;
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
  #sources: BlockPreviewSources;
  #blockRegistry: BlockRegistry;
  #opacity: number;
  #pieces = new Map<string, CellPiece | null>();
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

    const {
      blockRegistry,
      opacity = kDefaultOpacity,
      ...sources
    } = options;

    this.name = "template-ghost";
    this.#sources = sources;
    this.#blockRegistry = blockRegistry;
    this.#opacity = opacity;
    this.visible = false;
  }

  /**
   * Shows `template` turned by `transform`, with its pivot at the group
   * origin. Rebuilds only when the template, transform or atlases changed.
   */
  draw(
    template: VoxelTemplate,
    transform: VoxelTransform
  ): void {
    const { version } = this.#sources.atlases;
    if (version !== this.#atlasVersion) {
      this.#clearMeshes();
      this.#clearMaterials();
      this.#clearPieces();
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
    for (const batch of this.#batchesOf(template, transform)) {
      this.add(...this.#meshesOf(batch));
    }
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }

  invalidate(): void {
    this.#clearPieces();
    this.#drawn = null;
  }

  override dispose(): void {
    this.#clearMeshes();
    this.#clearMaterials();
    this.#clearPieces();
    this.#drawn = null;
    super.dispose();
  }

  #batchesOf(
    template: VoxelTemplate,
    transform: VoxelTransform
  ): IterableIterator<Batch> {
    const batches = new Map<string, Batch>();
    for (const [x, y, z, packed] of template.placedVoxels(kOrigin, transform)) {
      const piece = this.#pieceOf(voxelBlockId(packed), voxelTransform(packed));
      if (piece === null) {
        continue;
      }

      let batch = batches.get(piece.batchKey);
      if (batch === undefined) {
        batch = {
          key: piece.batchKey,
          texture: piece.texture,
          surface: piece.surface,
          positions: [],
          normals: [],
          uvs: [],
          indices: []
        };
        batches.set(piece.batchKey, batch);
      }
      appendPiece(batch, piece.geometry, x, y, z);
    }

    return batches.values();
  }

  #pieceOf(
    blockId: number,
    packedTransform: number
  ): CellPiece | null {
    const key = `${blockId}:${packedTransform}`;
    const cached = this.#pieces.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const block = this.#blockRegistry.get(blockId);
    const geometry = block === undefined ?
      null :
      buildBlockGeometry(
        block,
        this.#sources,
        VoxelTransform.fromPacked(packedTransform)
      );
    if (block === undefined || geometry === null) {
      this.#pieces.set(key, null);

      return null;
    }

    const texture = textureOf(block, this.#sources);
    const surface = new BlockSurface(block);
    const piece: CellPiece = {
      geometry,
      batchKey: `${texture?.uuid ?? "none"}:${surface.alphaCutoff}:${surface.side}`,
      texture,
      surface
    };
    this.#pieces.set(key, piece);

    return piece;
  }

  #materialsOf(
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

  #meshesOf(
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

    const materials = this.#materialsOf(batch);
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

  #clearPieces(): void {
    for (const piece of this.#pieces.values()) {
      piece?.geometry.dispose();
    }
    this.#pieces.clear();
  }
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
    if (group.materialIndex !== BLOCK_TEXTURED_MATERIAL) {
      continue;
    }
    for (let at = group.start; at < group.start + group.count; at++) {
      batch.indices.push(index.getX(at) + offset);
    }
  }
}
