// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { BlockVariantFace } from "./variants/types.ts";
import type { QuadIndex } from "./QuadIndex.ts";
import type {
  ChunkMeshAttribute,
  FaceBuffer,
  QuadMeshData
} from "./types.ts";
import {
  AO_UNOCCLUDED,
  shadeFace
} from "./ambientOcclusion.ts";

// CONSTANTS
const kInitialVertices = 4096;
const kIndicesPerQuad = 6;

export const TILE_REPEAT_SCALE = 65535;

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
export class GeometryBuffer implements FaceBuffer {
  vertexCount = 0;
  triangleCount = 0;

  readonly tiled: boolean;

  #positions: Float32Array;
  #normals: Int8Array;
  #tileUvs: Float32Array;
  #atlasUvs: Uint16Array;
  #regions: Uint16Array;
  #repeats: Uint16Array;

  #vertexCapacity: number;
  #shade = new Int8Array(4);
  #start = 0;
  #originX = 0;
  #originY = 0;
  #originZ = 0;

  constructor(
    options: GeometryBufferOptions = {}
  ) {
    const {
      vertexCapacity = kInitialVertices,
      tiled = false
    } = options;

    this.tiled = tiled;
    this.#vertexCapacity = vertexCapacity;

    this.#positions = new Float32Array(vertexCapacity * 3);
    this.#normals = new Int8Array(vertexCapacity * 4);
    this.#tileUvs = new Float32Array(tiled ? vertexCapacity * 2 : 0);
    this.#atlasUvs = new Uint16Array(tiled ? 0 : vertexCapacity * 2);
    this.#regions = new Uint16Array(vertexCapacity * 4);
    this.#repeats = new Uint16Array(tiled ? vertexCapacity * 2 : 0);
  }

  get quadCount(): number {
    return this.vertexCount >> 2;
  }

  get bytesPerVertex(): number {
    const uvBytes = this.tiled ?
      (2 * Float32Array.BYTES_PER_ELEMENT) + (2 * Uint16Array.BYTES_PER_ELEMENT) :
      2 * Uint16Array.BYTES_PER_ELEMENT;

    return (3 * Float32Array.BYTES_PER_ELEMENT) +
      (4 * Int8Array.BYTES_PER_ELEMENT) +
      (4 * Uint16Array.BYTES_PER_ELEMENT) +
      uvBytes;
  }

  reset(
    originX = 0,
    originY = 0,
    originZ = 0
  ): void {
    this.vertexCount = 0;
    this.triangleCount = 0;
    this.#originX = originX;
    this.#originY = originY;
    this.#originZ = originZ;
  }

  // eslint-disable-next-line max-params
  addFace(
    face: BlockVariantFace,
    wx: number,
    wy: number,
    wz: number,
    ao = AO_UNOCCLUDED
  ): void {
    this.#prepareShade(face, ao);
    if (this.tiled) {
      this.#writeTiled(face, wx, wy, wz, 1, 1, 1, 1, 1);
    }
    else {
      this.#writeAtlas(face, wx, wy, wz);
    }
  }

  // eslint-disable-next-line max-params
  addMergedFace(
    face: BlockVariantFace,
    wx: number,
    wy: number,
    wz: number,
    spanU: number,
    spanV: number,
    ao = AO_UNOCCLUDED
  ): void {
    this.#prepareShade(face, ao);
    const merge = face.merge!;

    const sx = merge.axis === 0 ? 1 : spanU;
    const sz = merge.axis === 2 ? 1 : spanV;
    let sy = 1;
    if (merge.axis === 0) {
      sy = spanU;
    }
    else if (merge.axis === 2) {
      sy = spanV;
    }

    const repeatU = merge.swapped ? spanV : spanU;
    const repeatV = merge.swapped ? spanU : spanV;

    this.#writeTiled(face, wx, wy, wz, sx, sy, sz, repeatU, repeatV);
  }

  #prepareShade(
    face: BlockVariantFace,
    ao: number
  ): void {
    this.#start = shadeFace(face, ao, this.#shade);
  }

  #reserve(): number {
    const base = this.vertexCount;
    if (base + 4 > this.#vertexCapacity) {
      this.#growVertices(base + 4);
    }

    return base;
  }

  // eslint-disable-next-line max-params
  #writeCommon(
    face: BlockVariantFace,
    base: number,
    wx: number,
    wy: number,
    wz: number,
    sx: number,
    sy: number,
    sz: number
  ): void {
    const positions = this.#positions;
    const normals = this.#normals;
    const regions = this.#regions;
    const local = face.positions;
    const shade = this.#shade;
    const start = this.#start;
    const { region, normalX, normalY, normalZ } = face;
    const last = face.vertexCount - 1;
    const x = wx - this.#originX;
    const y = wy - this.#originY;
    const z = wz - this.#originZ;

    for (let i = 0, n = base * 4, p = base * 3; i < 4; i++, p += 3, n += 4) {
      const source = (i + start) & 3;
      const i3 = (source > last ? last : source) * 3;
      positions[p] = x + (local[i3] * sx);
      positions[p + 1] = y + (local[i3 + 1] * sy);
      positions[p + 2] = z + (local[i3 + 2] * sz);
      normals[n] = normalX;
      normals[n + 1] = normalY;
      normals[n + 2] = normalZ;
      normals[n + 3] = shade[source];
      regions[n] = region[0];
      regions[n + 1] = region[1];
      regions[n + 2] = region[2];
      regions[n + 3] = region[3];
    }

    this.vertexCount = base + 4;
    this.triangleCount += last - 1;
  }

  #writeAtlas(
    face: BlockVariantFace,
    wx: number,
    wy: number,
    wz: number
  ): void {
    const base = this.#reserve();
    const atlasUvs = this.#atlasUvs;
    const local = face.uvs;
    const last = face.vertexCount - 1;
    const start = this.#start;

    for (let i = 0, u = base * 2; i < 4; i++, u += 2) {
      const source = (i + start) & 3;
      const i2 = (source > last ? last : source) * 2;
      atlasUvs[u] = local[i2];
      atlasUvs[u + 1] = local[i2 + 1];
    }

    this.#writeCommon(face, base, wx, wy, wz, 1, 1, 1);
  }

  // eslint-disable-next-line max-params
  #writeTiled(
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
    const base = this.#reserve();
    const tileUvs = this.#tileUvs;
    const repeats = this.#repeats;
    const local = face.tileUvs;
    const last = face.vertexCount - 1;
    const start = this.#start;

    for (let i = 0, u = base * 2; i < 4; i++, u += 2) {
      const source = (i + start) & 3;
      const i2 = (source > last ? last : source) * 2;
      tileUvs[u] = local[i2] * repeatU;
      tileUvs[u + 1] = local[i2 + 1] * repeatV;
      repeats[u] = repeatU;
      repeats[u + 1] = repeatV;
    }

    this.#writeCommon(face, base, wx, wy, wz, sx, sy, sz);
  }

  /**
   * Copies written ranges into exact-size geometry attributes that draw
   * through the shared `quadIndex`.
   */
  toMeshData(): QuadMeshData {
    const { vertexCount, tiled } = this;
    const attributes: ChunkMeshAttribute[] = [
      {
        name: "position",
        array: this.#positions.slice(0, vertexCount * 3),
        itemSize: 3,
        normalized: false
      },
      {
        name: "normal",
        array: this.#normals.slice(0, vertexCount * 4),
        itemSize: 4,
        normalized: true
      },
      tiled ?
        {
          name: "uv",
          array: this.#tileUvs.slice(0, vertexCount * 2),
          itemSize: 2,
          normalized: false
        } :
        {
          name: "uv",
          array: this.#atlasUvs.slice(0, vertexCount * 2),
          itemSize: 2,
          normalized: true
        },
      {
        name: "tileRegion",
        array: this.#regions.slice(0, vertexCount * 4),
        itemSize: 4,
        normalized: true
      }
    ];
    if (tiled) {
      attributes.push({
        name: "tileRepeat",
        array: this.#repeats.slice(0, vertexCount * 2),
        itemSize: 2,
        normalized: true
      });
    }

    return {
      kind: "quads",
      attributes,
      vertexCount,
      triangleCount: this.triangleCount,
      quadCount: this.quadCount,
      bytesPerVertex: this.bytesPerVertex
    };
  }

  #growVertices(
    required: number
  ): void {
    let capacity = this.#vertexCapacity;
    while (capacity < required) {
      capacity *= 2;
    }

    this.#positions = grow(this.#positions, capacity * 3);
    this.#normals = grow(this.#normals, capacity * 4);
    this.#regions = grow(this.#regions, capacity * 4);
    if (this.tiled) {
      this.#tileUvs = grow(this.#tileUvs, capacity * 2);
      this.#repeats = grow(this.#repeats, capacity * 2);
    }
    else {
      this.#atlasUvs = grow(this.#atlasUvs, capacity * 2);
    }
    this.#vertexCapacity = capacity;
  }
}

export function createQuadGeometry(
  data: QuadMeshData,
  quadIndex: QuadIndex
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  for (const { name, array, itemSize, normalized } of data.attributes) {
    geometry.setAttribute(
      name,
      new THREE.BufferAttribute(array, itemSize, normalized)
    );
  }

  geometry.setIndex(quadIndex.forQuads(data.quadCount));
  geometry.setDrawRange(0, data.quadCount * kIndicesPerQuad);

  return geometry;
}

export function quadMeshBytes(
  data: QuadMeshData
): number {
  let bytes = data.quadCount * kIndicesPerQuad * Uint32Array.BYTES_PER_ELEMENT;
  for (const { array } of data.attributes) {
    bytes += array.byteLength;
  }

  return bytes;
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
