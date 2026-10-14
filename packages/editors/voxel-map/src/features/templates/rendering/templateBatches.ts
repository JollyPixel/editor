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

// CONSTANTS
const kOrigin = {
  x: 0,
  y: 0,
  z: 0
};

export interface TemplateBatchSources {
  pieces: BlockPieces;
  blockRegistry: BlockRegistry;
}

export type TemplateBatchKey = (piece: BlockPiece) => string;

export interface TemplateBatch {
  readonly key: string;
  readonly texture: THREE.Texture | null;
  readonly surface: BlockSurface;
  readonly geometry: THREE.BufferGeometry;
}

interface BatchDraft {
  key: string;
  texture: THREE.Texture | null;
  surface: BlockSurface;
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
}

export function buildTemplateBatches(
  template: VoxelTemplate,
  transform: VoxelTransform,
  sources: TemplateBatchSources,
  batchKey: TemplateBatchKey = surfaceBatchKey
): TemplateBatch[] {
  const drafts = new Map<string, BatchDraft>();
  const placed = template.placedVoxels(kOrigin, transform);
  for (const [x, y, z, packed, partner] of placed) {
    const cell = { x, y, z };
    appendShape(drafts, sources, batchKey, packed, cell);
    appendShape(drafts, sources, batchKey, partner, cell);
  }

  return Array.from(drafts.values(), (draft): TemplateBatch => {
    return {
      key: draft.key,
      texture: draft.texture,
      surface: draft.surface,
      geometry: createGeometry(draft)
    };
  });
}

function appendShape(
  drafts: Map<string, BatchDraft>,
  sources: TemplateBatchSources,
  batchKey: TemplateBatchKey,
  packed: PackedVoxel,
  cell: VoxelCoord
): void {
  if (packed === VOXEL_ABSENT) {
    return;
  }

  const block = sources.blockRegistry.get(voxelBlockId(packed));
  const piece = block === undefined ?
    null :
    sources.pieces.resolvePiece(
      block,
      VoxelTransform.fromPacked(voxelTransform(packed))
    );
  if (piece === null) {
    return;
  }

  const key = batchKey(piece);
  let draft = drafts.get(key);
  if (draft === undefined) {
    draft = {
      key,
      texture: piece.texture,
      surface: piece.surface,
      positions: [],
      normals: [],
      uvs: [],
      indices: []
    };
    drafts.set(key, draft);
  }
  appendPiece(draft, piece.geometry, cell);
}

export function surfaceBatchKey(
  piece: BlockPiece
): string {
  const { surface } = piece;

  return [
    piece.texture?.uuid ?? "none",
    surface.alphaMode,
    surface.alphaCutoff,
    surface.side,
    surface.materialGroup ?? ""
  ].join(":");
}

function appendPiece(
  draft: BatchDraft,
  geometry: THREE.BufferGeometry,
  cell: VoxelCoord
): void {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const uv = geometry.getAttribute("uv");
  const index = geometry.getIndex();
  if (index === null) {
    return;
  }

  const offset = draft.positions.length / 3;
  for (let vertex = 0; vertex < position.count; vertex++) {
    draft.positions.push(
      position.getX(vertex) + cell.x,
      position.getY(vertex) + cell.y,
      position.getZ(vertex) + cell.z
    );
    draft.normals.push(
      normal.getX(vertex),
      normal.getY(vertex),
      normal.getZ(vertex)
    );
    draft.uvs.push(uv.getX(vertex), uv.getY(vertex));
  }

  for (const group of geometry.groups) {
    if (group.materialIndex !== BLOCK_PIECE_TEXTURED_GROUP) {
      continue;
    }
    for (let at = group.start; at < group.start + group.count; at++) {
      draft.indices.push(index.getX(at) + offset);
    }
  }
}

function createGeometry(
  draft: BatchDraft
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(draft.positions, 3)
  );
  geometry.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(draft.normals, 3)
  );
  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(draft.uvs, 2)
  );
  geometry.setIndex(draft.indices);

  return geometry;
}
