// Import Internal Dependencies
import type {
  VoxelCollider,
  VoxelChunkCollision
} from "../../collision/VoxelCollider.ts";
import type { BlockRegistry } from "../../blocks/BlockRegistry.ts";
import type { BlockShape } from "../../blocks/shape/BlockShape.ts";
import type { BlockShapeRegistry } from "../../blocks/shape/BlockShapeRegistry.ts";
import type { VoxelChunk } from "../../world/VoxelChunk.ts";
import {
  voxelBlockId,
  voxelTransform
} from "../../world/packedVoxel.ts";
import { VoxelTransform } from "../../world/VoxelTransform.ts";
import {
  mirrorsWinding,
  rotateVertex
} from "../../mesh/variants/rotation.ts";

/**
 * Structural Rapier3D subset that keeps the WASM module consumer-owned.
 */

export interface RapierColliderDesc {
  setTranslation(
    x: number,
    y: number,
    z: number
  ): this;
}

export interface RapierRigidBodyDesc {
  setTranslation(
    x: number,
    y: number,
    z: number
  ): this;
}

export interface RapierRigidBody {
  readonly handle: number;
}

export interface RapierCollider {
  readonly handle: number;
}

export interface RapierWorld {
  createRigidBody(
    desc: RapierRigidBodyDesc
  ): RapierRigidBody;
  createCollider(
    desc: RapierColliderDesc,
    parent?: RapierRigidBody
  ): RapierCollider;
  removeCollider(
    collider: RapierCollider,
    wakeUp: boolean
  ): void;
  removeRigidBody(
    body: RapierRigidBody
  ): void;
}

export interface RapierAPI {
  RigidBodyDesc: {
    fixed(): RapierRigidBodyDesc;
  };
  ColliderDesc: {
    cuboid(
      hx: number,
      hy: number,
      hz: number
    ): RapierColliderDesc;
    trimesh(
      vertices: Float32Array,
      indices: Uint32Array
    ): RapierColliderDesc;
  };
}

export interface RapierVoxelColliderOptions {
  api: RapierAPI;
  world: RapierWorld;
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

/**
 * Builds one fixed body per chunk: full cubes greedily merged into cuboids,
 * partial boxes as their own cuboids, and trimesh-hinted blocks as a
 * triangle mesh of their shape faces.
 */
export class RapierVoxelCollider implements VoxelCollider {
  #rapier: RapierAPI;
  #world: RapierWorld;
  #blockRegistry: BlockRegistry;
  #shapeRegistry: BlockShapeRegistry;

  #bodies = new Map<string, RapierRigidBody>();
  #bounds = new Map<string, ShapeBounds>();
  #shapeVersion = -1;
  #filled = new Uint8Array(0);

  constructor(
    options: RapierVoxelColliderOptions
  ) {
    this.#rapier = options.api;
    this.#world = options.world;
    this.#blockRegistry = options.blockRegistry;
    this.#shapeRegistry = options.shapeRegistry;
  }

  rebuildChunk(
    key: string,
    collision: VoxelChunkCollision
  ): void {
    this.removeChunk(key);
    if (this.#shapeVersion !== this.#shapeRegistry.version) {
      this.#bounds.clear();
      this.#shapeVersion = this.#shapeRegistry.version;
    }

    const body = this.#buildChunkBody(collision);
    if (body) {
      this.#bodies.set(key, body);
    }
  }

  removeChunk(
    key: string
  ): void {
    const body = this.#bodies.get(key);
    if (!body) {
      return;
    }

    this.#world.removeRigidBody(body);
    this.#bodies.delete(key);
  }

  dispose(): void {
    for (const body of this.#bodies.values()) {
      this.#world.removeRigidBody(body);
    }
    this.#bodies.clear();
    this.#bounds.clear();
    this.#filled = new Uint8Array(0);
  }

  #buildChunkBody(
    collision: VoxelChunkCollision
  ): RapierRigidBody | null {
    const { origin, chunks } = collision;
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
      return null;
    }

    const body = this.#world.createRigidBody(
      this.#rapier.RigidBodyDesc
        .fixed()
        .setTranslation(origin.x, origin.y, origin.z)
    );

    this.#buildCubes(body, solids.cubes, chunks[0].size);
    for (const { origin, bounds } of solids.boxes) {
      this.#buildBox(body, origin, bounds);
    }
    if (solids.indices.length > 0) {
      this.#world.createCollider(
        this.#rapier.ColliderDesc.trimesh(
          new Float32Array(solids.vertices),
          new Uint32Array(solids.indices)
        ),
        body
      );
    }

    return body;
  }

  #collectSolids(
    chunk: VoxelChunk,
    solids: ChunkSolids
  ): void {
    const { shift, mask } = chunk;
    const { keys, values, capacity } = chunk.store;

    for (let slot = 0; slot < capacity; slot++) {
      const linearIdx = keys[slot];
      if (linearIdx < 0) {
        continue;
      }

      const packed = values[slot];
      const blockDef = this.#blockRegistry.get(voxelBlockId(packed));
      if (!blockDef?.collidable) {
        continue;
      }

      const shape = this.#shapeRegistry.get(blockDef.shapeId);
      if (!shape || shape.collisionHint === "none") {
        continue;
      }

      const lx = linearIdx & mask;
      const ly = (linearIdx >> shift) & mask;
      const lz = linearIdx >> (shift * 2);
      const transform = VoxelTransform.fromPacked(voxelTransform(packed));

      if (shape.collisionHint === "trimesh") {
        appendShapeTriangles(solids, shape, transform, [lx, ly, lz]);

        continue;
      }

      const bounds = this.#boundsOf(shape, transform);
      if (bounds.full) {
        solids.cubes.push(linearIdx);
      }
      else {
        solids.boxes.push({ origin: [lx, ly, lz], bounds });
      }
    }
  }

  #boundsOf(
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

  #buildCubes(
    body: RapierRigidBody,
    cubes: number[],
    size: number
  ): void {
    if (cubes.length === 0) {
      return;
    }

    const volume = size * size * size;
    if (this.#filled.length < volume) {
      this.#filled = new Uint8Array(volume);
    }
    cubes.sort((a, b) => a - b);

    try {
      for (const [x, y, z, sx, sy, sz] of mergeCubes(
        cubes, size, this.#filled
      )) {
        this.#world.createCollider(
          this.#rapier.ColliderDesc
            .cuboid(sx / 2, sy / 2, sz / 2)
            .setTranslation(x + (sx / 2), y + (sy / 2), z + (sz / 2)),
          body
        );
      }
    }
    finally {
      for (const index of cubes) {
        this.#filled[index] = 0;
      }
    }
  }

  #buildBox(
    body: RapierRigidBody,
    origin: readonly [number, number, number],
    bounds: ShapeBounds
  ): void {
    const { min, max } = bounds;
    const hx = (max[0] - min[0]) / 2;
    const hy = (max[1] - min[1]) / 2;
    const hz = (max[2] - min[2]) / 2;
    if (hx <= 0 || hy <= 0 || hz <= 0) {
      return;
    }

    this.#world.createCollider(
      this.#rapier.ColliderDesc
        .cuboid(hx, hy, hz)
        .setTranslation(
          origin[0] + min[0] + hx,
          origin[1] + min[1] + hy,
          origin[2] + min[2] + hz
        ),
      body
    );
  }
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
