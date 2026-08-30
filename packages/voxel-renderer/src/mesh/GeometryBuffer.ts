// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { BlockVariantFace } from "./variants/types.ts";

// CONSTANTS
const kInitialVertices = 4096;
const kUint16Limit = 65536;

export interface GeometryBufferOptions {
  /**
   * @default 4096
   */
  vertexCapacity?: number;
  /**
   * Emits attributes required by tiled greedy geometry.
   * @default false
   */
  tiled?: boolean;
}

/**
 * Reusable typed-array accumulator for one tileset's geometry.
 */
export class GeometryBuffer {
  vertexCount = 0;
  indexCount = 0;

  readonly tiled: boolean;

  #positions: Float32Array;
  #normals: Int8Array;
  #tileUvs: Float32Array;
  #atlasUvs: Uint16Array;
  #indices: Uint32Array;
  #regions: Uint16Array;
  #repeats: Uint16Array;

  #vertexCapacity: number;
  #indexCapacity: number;

  constructor(
    options: GeometryBufferOptions = {}
  ) {
    const {
      vertexCapacity = kInitialVertices,
      tiled = false
    } = options;

    this.tiled = tiled;
    this.#vertexCapacity = vertexCapacity;
    this.#indexCapacity = (vertexCapacity * 3) >> 1;

    this.#positions = new Float32Array(vertexCapacity * 3);
    this.#normals = new Int8Array(vertexCapacity * 3);
    this.#indices = new Uint32Array(this.#indexCapacity);
    this.#tileUvs = new Float32Array(tiled ? vertexCapacity * 2 : 0);
    this.#atlasUvs = new Uint16Array(tiled ? 0 : vertexCapacity * 2);
    this.#regions = new Uint16Array(tiled ? vertexCapacity * 4 : 0);
    this.#repeats = new Uint16Array(tiled ? vertexCapacity * 2 : 0);
  }

  reset(): void {
    this.vertexCount = 0;
    this.indexCount = 0;
  }

  /**
   * Appends a face translated to the voxel's world position.
   */
  addFace(
    face: BlockVariantFace,
    wx: number,
    wy: number,
    wz: number
  ): void {
    this.#write(face, wx, wy, wz, 1, 1, 1, 1, 1);
  }

  /**
   * Appends a tiled face stretched over `spanU × spanV` voxels.
   */
  // eslint-disable-next-line max-params
  addMergedFace(
    face: BlockVariantFace,
    wx: number,
    wy: number,
    wz: number,
    spanU: number,
    spanV: number
  ): void {
    const merge = face.merge!;

    // Only the two axes in the face plane stretch.
    const sx = merge.axis === 0 ? 1 : spanU;
    const sz = merge.axis === 2 ? 1 : spanV;
    let sy = 1;
    if (merge.axis === 0) {
      sy = spanU;
    }
    else if (merge.axis === 2) {
      sy = spanV;
    }

    // Repeat counts follow the tile axes after rotation.
    const repeatU = merge.swapped ? spanV : spanU;
    const repeatV = merge.swapped ? spanU : spanV;

    this.#write(face, wx, wy, wz, sx, sy, sz, repeatU, repeatV);
  }

  /**
   * Writes scaled positions and repeated or atlas-space UVs.
   */
  // eslint-disable-next-line max-params
  #write(
    face: BlockVariantFace,
    wx: number,
    wy: number,
    wz: number,
    sx: number,
    sy: number,
    sz: number,
    repeatU: number,
    repeatV: number
  ): void {
    const { vertexCount } = face;
    if (this.vertexCount + vertexCount > this.#vertexCapacity) {
      this.#growVertices(this.vertexCount + vertexCount);
    }
    if (this.indexCount + face.indexCount > this.#indexCapacity) {
      this.#growIndices(this.indexCount + face.indexCount);
    }

    const { tiled } = this;
    const base = this.vertexCount;
    const positions = this.#positions;
    const normals = this.#normals;
    const tileUvs = this.#tileUvs;
    const atlasUvs = this.#atlasUvs;
    const regions = this.#regions;
    const repeats = this.#repeats;
    const localPositions = face.positions;
    const localTileUvs = face.tileUvs;
    const localAtlasUvs = face.uvs;
    const { region, normalX, normalY, normalZ } = face;

    let p = base * 3;
    let u = base * 2;
    for (let i = 0; i < vertexCount; i++) {
      const i3 = i * 3;
      positions[p] = wx + (localPositions[i3] * sx);
      positions[p + 1] = wy + (localPositions[i3 + 1] * sy);
      positions[p + 2] = wz + (localPositions[i3 + 2] * sz);
      normals[p] = normalX;
      normals[p + 1] = normalY;
      normals[p + 2] = normalZ;
      p += 3;

      const i2 = i * 2;
      if (tiled) {
        tileUvs[u] = localTileUvs[i2] * repeatU;
        tileUvs[u + 1] = localTileUvs[i2 + 1] * repeatV;
        repeats[u] = repeatU;
        repeats[u + 1] = repeatV;

        const r = base * 4 + (i * 4);
        regions[r] = region[0];
        regions[r + 1] = region[1];
        regions[r + 2] = region[2];
        regions[r + 3] = region[3];
      }
      else {
        atlasUvs[u] = localAtlasUvs[i2];
        atlasUvs[u + 1] = localAtlasUvs[i2 + 1];
      }
      u += 2;
    }

    const indices = this.#indices;
    let n = this.indexCount;
    indices[n++] = base;
    indices[n++] = base + 1;
    indices[n++] = base + 2;
    if (vertexCount === 4) {
      indices[n++] = base;
      indices[n++] = base + 2;
      indices[n++] = base + 3;
    }

    this.indexCount = n;
    this.vertexCount = base + vertexCount;
  }

  /**
   * Copies written ranges into exact-size geometry attributes.
   */
  toGeometry(): THREE.BufferGeometry {
    const { vertexCount, tiled } = this;
    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.#positions.slice(0, vertexCount * 3), 3)
    );
    geometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(this.#normals.slice(0, vertexCount * 3), 3, true)
    );
    geometry.setAttribute(
      "uv",
      tiled ?
        new THREE.BufferAttribute(this.#tileUvs.slice(0, vertexCount * 2), 2) :
        new THREE.BufferAttribute(this.#atlasUvs.slice(0, vertexCount * 2), 2, true)
    );
    if (tiled) {
      geometry.setAttribute(
        "tileRegion",
        new THREE.BufferAttribute(this.#regions.slice(0, vertexCount * 4), 4, true)
      );
      geometry.setAttribute(
        "tileRepeat",
        new THREE.BufferAttribute(this.#repeats.slice(0, vertexCount * 2), 2)
      );
    }

    const indices = this.#indices.subarray(0, this.indexCount);
    geometry.setIndex(
      new THREE.BufferAttribute(
        vertexCount < kUint16Limit ? new Uint16Array(indices) : indices.slice(),
        1
      )
    );

    return geometry;
  }

  #growVertices(
    required: number
  ): void {
    let capacity = this.#vertexCapacity;
    while (capacity < required) {
      capacity *= 2;
    }

    this.#positions = grow(this.#positions, capacity * 3);
    this.#normals = grow(this.#normals, capacity * 3);
    if (this.tiled) {
      this.#tileUvs = grow(this.#tileUvs, capacity * 2);
      this.#regions = grow(this.#regions, capacity * 4);
      this.#repeats = grow(this.#repeats, capacity * 2);
    }
    else {
      this.#atlasUvs = grow(this.#atlasUvs, capacity * 2);
    }
    this.#vertexCapacity = capacity;
  }

  #growIndices(
    required: number
  ): void {
    let capacity = this.#indexCapacity;
    while (capacity < required) {
      capacity *= 2;
    }

    this.#indices = grow(this.#indices, capacity);
    this.#indexCapacity = capacity;
  }
}

function grow<
  TArray extends Float32Array | Int8Array | Uint8Array | Uint16Array | Uint32Array
>(
  source: TArray,
  length: number
): TArray {
  const next = new (source.constructor as new(length: number) => TArray)(length);
  next.set(source);

  return next;
}
