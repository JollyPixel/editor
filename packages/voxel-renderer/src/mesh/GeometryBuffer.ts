// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { BlockVariantFace } from "./variants/types.ts";
import type { QuadIndex } from "./QuadIndex.ts";
import {
  AO_UNOCCLUDED,
  aoUAxis,
  aoVAxis,
  aoVertexByte
} from "./ambientOcclusion.ts";
import { FACE_AXIS } from "../utils/math.ts";

// CONSTANTS
const kInitialVertices = 4096;
const kIndicesPerQuad = 6;
const kUnoccludedShade = 127;

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
export class GeometryBuffer {
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

  /**
   * Empties the buffer; later faces are written relative to the origin.
   */
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

  /**
   * Appends a face at the voxel's world position, stored relative to the
   * buffer origin. `ao` packs the face's corner levels (see
   * `packAoCorners`).
   */
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
    spanV: number,
    ao = AO_UNOCCLUDED
  ): void {
    this.#prepareShade(face, ao);
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

    this.#writeTiled(face, wx, wy, wz, sx, sy, sz, repeatU, repeatV);
  }

  /**
   * Resolves per-vertex brightness, and rotates a quad by one vertex when
   * its default diagonal would join the two darker corners.
   */
  #prepareShade(
    face: BlockVariantFace,
    ao: number
  ): void {
    const shade = this.#shade;
    this.#start = 0;
    if (ao === AO_UNOCCLUDED || face.cull < 0) {
      shade.fill(kUnoccludedShade);

      return;
    }

    const axis = FACE_AXIS[face.cull];
    const uAxis = aoUAxis(axis);
    const vAxis = aoVAxis(axis);
    const local = face.positions;
    const last = face.vertexCount - 1;
    for (let i = 0; i < 4; i++) {
      const i3 = (i > last ? last : i) * 3;
      shade[i] = aoVertexByte(ao, local[i3 + uAxis], local[i3 + vAxis]);
    }

    if (face.vertexCount === 4 && shade[0] + shade[2] < shade[1] + shade[3]) {
      this.#start = 1;
    }
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
  toGeometry(
    quadIndex: QuadIndex
  ): THREE.BufferGeometry {
    const { vertexCount, tiled } = this;
    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.#positions.slice(0, vertexCount * 3), 3)
    );
    geometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(this.#normals.slice(0, vertexCount * 4), 4, true)
    );
    geometry.setAttribute(
      "uv",
      tiled ?
        new THREE.BufferAttribute(this.#tileUvs.slice(0, vertexCount * 2), 2) :
        new THREE.BufferAttribute(this.#atlasUvs.slice(0, vertexCount * 2), 2, true)
    );
    geometry.setAttribute(
      "tileRegion",
      new THREE.BufferAttribute(this.#regions.slice(0, vertexCount * 4), 4, true)
    );
    if (tiled) {
      geometry.setAttribute(
        "tileRepeat",
        new THREE.BufferAttribute(this.#repeats.slice(0, vertexCount * 2), 2, true)
      );
    }

    const quads = this.quadCount;
    geometry.setIndex(quadIndex.forQuads(quads));
    geometry.setDrawRange(0, quads * kIndicesPerQuad);

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
