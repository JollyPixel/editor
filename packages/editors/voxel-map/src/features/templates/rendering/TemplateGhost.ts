// Import Third-party Dependencies
import * as THREE from "three";
import type {
  BlockPiece,
  BlockPieces,
  BlockRegistry,
  VoxelTemplate,
  VoxelTransform
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { BlockRenderSources } from "../../blocks/rendering/BlockRenderSources.ts";
import type { BlockRenderChanges } from "../../blocks/rendering/BlockRenderChanges.ts";
import { surfaceSide } from "../../blocks/rendering/surfaceMaterial.ts";
import {
  buildTemplateBatches,
  type TemplateBatch
} from "./templateBatches.ts";

// CONSTANTS
const kOpacity = 0.7;
const kDepthRenderOrder = 1000;

export interface TemplateGhostOptions {
  sources: BlockRenderSources;
  blockRegistry: BlockRegistry;
  opacity?: number;
}

interface BatchMaterials {
  color: THREE.MeshLambertMaterial;
  depth: THREE.MeshBasicMaterial;
}

export class TemplateGhost extends THREE.Group {
  #blockRegistry: BlockRegistry;
  #opacity: number;
  #pieces: BlockPieces;
  #changes: BlockRenderChanges;
  #materials = new Map<string, BatchMaterials>();
  #drawn: {
    template: VoxelTemplate;
    transform: VoxelTransform;
  } | null = null;

  constructor(
    options: TemplateGhostOptions
  ) {
    super();

    this.name = "template-ghost";
    this.#blockRegistry = options.blockRegistry;
    this.#opacity = options.opacity ?? kOpacity;
    this.#pieces = options.sources.createPieces();
    this.#changes = options.sources.watchChanges();
    this.visible = false;
  }

  draw(
    template: VoxelTemplate,
    transform: VoxelTransform
  ): void {
    if (this.#changes.poll() === "atlases") {
      this.#clearMeshes();
      this.#clearMaterials();
      this.#pieces.clear();
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
    const batches = buildTemplateBatches(
      template,
      transform,
      {
        pieces: this.#pieces,
        blockRegistry: this.#blockRegistry
      },
      ghostBatchKey
    );
    for (const batch of batches) {
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

  #resolveBatchMaterials(
    batch: TemplateBatch
  ): BatchMaterials {
    const cached = this.#materials.get(batch.key);
    if (cached !== undefined) {
      return cached;
    }

    const side = surfaceSide(batch.surface);
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
    batch: TemplateBatch
  ): [THREE.Mesh, THREE.Mesh] {
    const { geometry } = batch;
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

function ghostBatchKey(
  piece: BlockPiece
): string {
  return `${piece.texture?.uuid ?? "none"}:${piece.surface.alphaCutoff}:${piece.surface.side}`;
}
