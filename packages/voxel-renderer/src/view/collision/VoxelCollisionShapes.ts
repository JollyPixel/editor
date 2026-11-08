// Import Third-party Dependencies
import type { ColliderDesc } from "@jolly-pixel/physics";

// Import Internal Dependencies
import type { VoxelChunkCollision } from "./VoxelCollider.ts";
import type { BlockRegistry } from "../../document/blocks/BlockRegistry.ts";
import type { BlockShape } from "../../document/blocks/shape/BlockShape.ts";
import type { BlockShapeRegistry } from "../../document/blocks/shape/BlockShapeRegistry.ts";
import type { VoxelChunk } from "../../document/world/storage/VoxelChunk.ts";
import {
  voxelBlockId,
  voxelTransform,
  type PackedVoxel
} from "../../document/world/storage/packedVoxel.ts";
import {
  isMergedVoxel,
  unmarkMerged
} from "../../document/world/storage/mergedVoxel.ts";
import { BlockComplements } from "../../document/blocks/BlockComplements.ts";
import { VoxelTransform } from "../../document/geometry/VoxelTransform.ts";
import {
  mirrorsWinding,
  rotateVertex
} from "../../document/geometry/rotation.ts";

export interface VoxelCollisionShapesOptions {
  blockRegistry: BlockRegistry;
  shapeRegistry: BlockShapeRegistry;
}

interface ShapeBounds {
  min: [number, number, number];
  max: [number, number, number];
  full: boolean;
}

interface ChunkSolids {
  cubes: number[];
  boxes: {
    origin: [number, number, number];
    bounds: ShapeBounds;
  }[];
  vertices: number[];
  indices: number[];
}

export class VoxelCollisionShapes {
  #blockRegistry: BlockRegistry;
  #shapeRegistry: BlockShapeRegistry;
  #complements: BlockComplements;

  #bounds = new Map<string, ShapeBounds>();
  #shapeVersion = -1;
  #filled = new Uint8Array(0);

  constructor(
    options: VoxelCollisionShapesOptions
  ) {
    this.#blockRegistry = options.blockRegistry;
    this.#shapeRegistry = options.shapeRegistry;
    this.#complements = new BlockComplements({
      blocks: this.#blockRegistry,
      shapes: this.#shapeRegistry
    });
  }

  extract(
    collision: VoxelChunkCollision
  ): ColliderDesc[] {
    if (this.#shapeVersion !== this.#shapeRegistry.version) {
      this.#bounds.clear();
      this.#shapeVersion = this.#shapeRegistry.version;
    }

    const { chunks } = collision;
    const solids: ChunkSolids = {
      cubes: [],
      boxes: [],
      vertices: [],
      indices: []
    };
    for (const chunk of chunks) {
      this.#collectSolids(chunk, solids);
    }
    if (
      solids.cubes.length === 0 &&
      solids.boxes.length === 0 &&
      solids.indices.length === 0
    ) {
      return [];
    }

    const colliders = this.#mergeCubes(solids.cubes, chunks[0].size);
    for (const { origin, bounds } of solids.boxes) {
      const box = boundsBox(origin, bounds);
      if (box !== null) {
        colliders.push(box);
      }
    }
    if (solids.indices.length > 0) {
      colliders.push({
        shape: {
          type: "trimesh",
          vertices: new Float32Array(solids.vertices),
          indices: new Uint32Array(solids.indices)
        }
      });
    }

    return colliders;
  }

  clear(): void {
    this.#bounds.clear();
    this.#filled = new Uint8Array(0);
  }

  #collectSolids(
    chunk: VoxelChunk,
    solids: ChunkSolids
  ): void {
    const { keys, values, capacity } = chunk.store;

    for (let slot = 0; slot < capacity; slot++) {
      const linearIdx = keys[slot];
      if (linearIdx < 0) {
        continue;
      }

      const packed = values[slot];
      if (!isMergedVoxel(packed)) {
        this.#collectPart(chunk, solids, linearIdx, packed);

        continue;
      }

      const { lx, ly, lz } = chunk.fromLinearIndex(linearIdx);
      const primary = unmarkMerged(packed);
      const partner = chunk.partnerAt(lx, ly, lz);
      if (this.#fillsCell(primary, partner)) {
        solids.cubes.push(linearIdx);

        continue;
      }
      this.#collectPart(chunk, solids, linearIdx, primary);
      this.#collectPart(chunk, solids, linearIdx, partner);
    }
  }

  #fillsCell(
    packed: PackedVoxel,
    partner: PackedVoxel
  ): boolean {
    return this.#isCollidable(packed) &&
      this.#isCollidable(partner) &&
      this.#complements.complements(packed, partner);
  }

  #isCollidable(
    packed: PackedVoxel
  ): boolean {
    return this.#blockRegistry.get(voxelBlockId(packed))?.collidable === true;
  }

  #collectPart(
    chunk: VoxelChunk,
    solids: ChunkSolids,
    linearIdx: number,
    packed: PackedVoxel
  ): void {
    const blockDef = this.#blockRegistry.get(voxelBlockId(packed));
    if (!blockDef?.collidable) {
      return;
    }

    const shape = this.#shapeRegistry.get(blockDef.shapeId);
    if (!shape || shape.collisionHint === "none") {
      return;
    }

    const { shift, mask } = chunk;
    const lx = linearIdx & mask;
    const ly = (linearIdx >> shift) & mask;
    const lz = linearIdx >> (shift * 2);
    const transform = VoxelTransform.fromPacked(voxelTransform(packed));

    if (shape.collisionHint === "trimesh") {
      appendShapeTriangles(solids, shape, transform, [lx, ly, lz]);

      return;
    }

    const bounds = this.#resolveShapeBounds(shape, transform);
    if (bounds.full) {
      solids.cubes.push(linearIdx);
    }
    else {
      solids.boxes.push({ origin: [lx, ly, lz], bounds });
    }
  }

  #resolveShapeBounds(
    shape: BlockShape,
    transform: VoxelTransform
  ): ShapeBounds {
    const key = `${shape.id}:${transform.packed}`;
    let bounds = this.#bounds.get(key);
    if (bounds !== undefined) {
      return bounds;
    }

    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (const face of shape.faces) {
      for (const vertex of face.vertices) {
        const [x, y, z] = rotateVertex(vertex, transform);
        min[0] = Math.min(min[0], x);
        min[1] = Math.min(min[1], y);
        min[2] = Math.min(min[2], z);
        max[0] = Math.max(max[0], x);
        max[1] = Math.max(max[1], y);
        max[2] = Math.max(max[2], z);
      }
    }

    bounds = {
      min,
      max,
      full: min.every((value) => value === 0) &&
        max.every((value) => value === 1)
    };
    this.#bounds.set(key, bounds);

    return bounds;
  }

  #mergeCubes(
    cubes: number[],
    size: number
  ): ColliderDesc[] {
    const boxes: ColliderDesc[] = [];
    if (cubes.length === 0) {
      return boxes;
    }

    const volume = size * size * size;
    if (this.#filled.length < volume) {
      this.#filled = new Uint8Array(volume);
    }
    cubes.sort((a, b) => a - b);

    for (const [x, y, z, sx, sy, sz] of mergeCubes(cubes, size, this.#filled)) {
      boxes.push(boxCollider(
        [x + (sx / 2), y + (sy / 2), z + (sz / 2)],
        [sx / 2, sy / 2, sz / 2]
      ));
    }

    return boxes;
  }
}

function boxCollider(
  center: readonly [number, number, number],
  halfExtents: readonly [number, number, number]
): ColliderDesc {
  return {
    shape: {
      type: "box",
      halfExtents: {
        x: halfExtents[0],
        y: halfExtents[1],
        z: halfExtents[2]
      }
    },
    offset: {
      x: center[0],
      y: center[1],
      z: center[2]
    }
  };
}

function boundsBox(
  origin: readonly [number, number, number],
  bounds: ShapeBounds
): ColliderDesc | null {
  const { min, max } = bounds;
  const hx = (max[0] - min[0]) / 2;
  const hy = (max[1] - min[1]) / 2;
  const hz = (max[2] - min[2]) / 2;
  if (hx <= 0 || hy <= 0 || hz <= 0) {
    return null;
  }

  return boxCollider(
    [
      origin[0] + min[0] + hx,
      origin[1] + min[1] + hy,
      origin[2] + min[2] + hz
    ],
    [hx, hy, hz]
  );
}

function appendShapeTriangles(
  solids: ChunkSolids,
  shape: BlockShape,
  transform: VoxelTransform,
  origin: readonly [number, number, number]
): void {
  const { vertices, indices } = solids;
  const mirrored = mirrorsWinding(transform);

  for (const face of shape.faces) {
    const base = vertices.length / 3;
    for (const vertex of face.vertices) {
      const [x, y, z] = rotateVertex(vertex, transform);
      vertices.push(origin[0] + x, origin[1] + y, origin[2] + z);
    }
    for (let i = 1; i < face.vertices.length - 1; i++) {
      if (mirrored) {
        indices.push(base, base + i + 1, base + i);
      }
      else {
        indices.push(base, base + i, base + i + 1);
      }
    }
  }
}

function* mergeCubes(
  cubes: readonly number[],
  size: number,
  filled: Uint8Array
): IterableIterator<[number, number, number, number, number, number]> {
  for (const index of cubes) {
    filled[index] = 1;
  }

  for (const index of cubes) {
    if (filled[index] === 1) {
      const x = index % size;
      const y = Math.floor(index / size) % size;
      const z = Math.floor(index / (size * size));

      yield growBox(filled, size, x, y, z);
    }
  }
}

function cellIndex(
  size: number,
  x: number,
  y: number,
  z: number
): number {
  return x + (size * (y + (size * z)));
}

// eslint-disable-next-line max-params
function growBox(
  filled: Uint8Array,
  size: number,
  x: number,
  y: number,
  z: number
): [number, number, number, number, number, number] {
  let sx = 1;
  while (x + sx < size && filled[cellIndex(size, x + sx, y, z)] === 1) {
    sx++;
  }
  let sy = 1;
  while (
    y + sy < size &&
    isFilledRun(filled, cellIndex(size, x, y + sy, z), sx)
  ) {
    sy++;
  }
  let sz = 1;
  while (
    z + sz < size &&
    isFilledRect(filled, size, cellIndex(size, x, y, z + sz), sx, sy)
  ) {
    sz++;
  }

  for (let dz = 0; dz < sz; dz++) {
    for (let dy = 0; dy < sy; dy++) {
      const row = cellIndex(size, x, y + dy, z + dz);
      filled.fill(0, row, row + sx);
    }
  }

  return [x, y, z, sx, sy, sz];
}

function isFilledRun(
  filled: Uint8Array,
  start: number,
  length: number
): boolean {
  for (let i = start; i < start + length; i++) {
    if (filled[i] === 0) {
      return false;
    }
  }

  return true;
}

function isFilledRect(
  filled: Uint8Array,
  size: number,
  start: number,
  sx: number,
  sy: number
): boolean {
  for (let dy = 0; dy < sy; dy++) {
    if (!isFilledRun(filled, start + (dy * size), sx)) {
      return false;
    }
  }

  return true;
}
