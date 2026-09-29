// Import Third-party Dependencies
import * as THREE from "three";
import {
  buildShapeGeometry,
  shapeSlots,
  BlockSurface,
  BlockTextures,
  VoxelTransform,
  type FaceDefinition,
  type ResolvedBlockDefinition,
  type BlockShapeRegistry,
  type MaterialGroupList,
  type TilesetAtlases,
  type VoxelView
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { TileOpacityProbe } from "./tileOpacity.ts";

// CONSTANTS
export const BLOCK_TEXTURED_MATERIAL = 0;
export const BLOCK_EMPTY_MATERIAL = 1;

export interface BlockRenderSources {
  shapeRegistry: BlockShapeRegistry;
  atlases: TilesetAtlases;
  tileOpacity: TileOpacityProbe;
  materialGroups?: MaterialGroupList;
}

export function blockRenderSourcesOf(
  engine: VoxelView
): BlockRenderSources {
  return {
    shapeRegistry: engine.shapes,
    atlases: engine.atlases,
    tileOpacity: new TileOpacityProbe(engine.atlases),
    materialGroups: engine.document.materialGroups
  };
}

export function emptyTextureSlots(
  block: ResolvedBlockDefinition,
  sources: BlockRenderSources
): string[] {
  const shape = sources.shapeRegistry.get(block.shapeId);
  if (!shape) {
    return [];
  }

  const textures = BlockTextures.of(block);
  const { alphaCutoff } = new BlockSurface(block);

  return shapeSlots(shape)
    .map((slot) => slot.id)
    .filter((slot) => sources.tileOpacity.isEmpty(
      textures.forSlot(slot),
      alphaCutoff
    ));
}

export function buildBlockGeometry(
  block: ResolvedBlockDefinition,
  sources: BlockRenderSources,
  transform: VoxelTransform = VoxelTransform.Identity
): THREE.BufferGeometry | null {
  const { shapeRegistry, atlases } = sources;
  const shape = shapeRegistry.get(block.shapeId);
  if (!shape) {
    return null;
  }

  const texture = textureOf(block, sources);
  const { positions, normals, uvs, indices, ranges } = buildShapeGeometry(
    shape,
    transform
  );

  const atlasUvs = Float32Array.from(uvs);
  const geo = new THREE.BufferGeometry();

  const empty = new Set(emptyTextureSlots(block, sources));
  const textures = BlockTextures.of(block);
  let indexStart = 0;
  for (const range of ranges) {
    const indexCount = triangleIndexCount(range.definitions);
    const isEmpty = empty.has(range.slot);
    geo.addGroup(
      indexStart,
      indexCount,
      isEmpty ? BLOCK_EMPTY_MATERIAL : BLOCK_TEXTURED_MATERIAL
    );
    indexStart += indexCount;

    const tileRef = textures.forSlot(range.slot);
    if (isEmpty || !tileRef || !texture) {
      continue;
    }

    const region = atlases
      .get(tileRef.tilesetId)
      ?.uvFor(
        tileRef.col,
        tileRef.row,
        tileRef.size,
        textures.spanFor(range.slot, range.span)
      );
    if (!region) {
      continue;
    }

    const end = range.start + range.count;
    for (let index = range.start; index < end; index++) {
      atlasUvs[index * 2] = region.offsetU +
        (atlasUvs[index * 2] * region.scaleU);
      atlasUvs[(index * 2) + 1] = region.offsetV +
        (atlasUvs[(index * 2) + 1] * region.scaleV);
    }
  }

  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(Float32Array.from(positions), 3)
  );
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(atlasUvs, 2));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));

  return geo;
}

export function textureOf(
  block: ResolvedBlockDefinition,
  sources: BlockRenderSources
): THREE.Texture | null {
  return sources.atlases
    .get(block.defaultTexture?.tilesetId)
    ?.texture ?? null;
}

function triangleIndexCount(
  definitions: readonly FaceDefinition[]
): number {
  return definitions.reduce(
    (count, definition) => count + ((definition.vertices.length - 2) * 3),
    0
  );
}
