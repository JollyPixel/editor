// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { BlockVariantFace } from "./BlockVariantCache.ts";

// CONSTANTS
const kInitialVertices = 4096;
// Above this vertex count a chunk can no longer be indexed with 16-bit values.
const kUint16Limit = 65536;

export interface GeometryBufferOptions {
  /**
   * @default 4096
   */
  vertexCapacity?: number;
  /**
   * Emit the `tileRegion` / `tileRepeat` attributes and write `uv` in tile
   * space instead of atlas space, so the material can repeat a tile across a
   * merged quad. Required by greedy meshing, useless without it.
   * @default false
   */
  tiled?: boolean;
}

/**
 * Growable typed-array accumulator for the geometry of a single tileset.
 *
 * Attributes are written straight into their final binary layout instead of
 * being staged in `number[]`, which removes both the per-value boxing and the
 * full double→float conversion pass `Float32BufferAttribute` would otherwise
 * run over millions of entries.
 *
 * Buffers are reused between chunks (see `reset()`), so a chunk only ever pays
 * for growth once.
 */
export class GeometryBuffer {
  vertexCount = 0;
  indexCount = 0;

  readonly tiled: boolean;

  #positions: Float32Array;
  #normals: Float32Array;
  #uvs: Float32Array;
  #colors: Uint8Array;
  #indices: Uint32Array;
  /** `vertexCount × 4` atlas rects; empty unless `tiled`. */
  #regions: Float32Array;
  /** `vertexCount × 2` tile repeat counts; empty unless `tiled`. */
  #repeats: Float32Array;

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
    // A quad emits 6 indices for 4 vertices.
    this.#indexCapacity = (vertexCapacity * 3) >> 1;

    this.#positions = new Float32Array(vertexCapacity * 3);
    this.#normals = new Float32Array(vertexCapacity * 3);
    this.#uvs = new Float32Array(vertexCapacity * 2);
    this.#colors = new Uint8Array(vertexCapacity * 4);
    this.#indices = new Uint32Array(this.#indexCapacity);
    this.#regions = new Float32Array(tiled ? vertexCapacity * 4 : 0);
    this.#repeats = new Float32Array(tiled ? vertexCapacity * 2 : 0);
  }

  reset(): void {
    this.vertexCount = 0;
    this.indexCount = 0;
  }

  /**
   * Appends one face, translated to the voxel's world position.
   * `alpha` is the owning layer's opacity as an 8-bit value.
   *
   * Positional parameters rather than an options object: this runs once per
   * emitted face, so the object would be allocated millions of times per world.
   */
  // eslint-disable-next-line max-params
  addFace(
    face: BlockVariantFace,
    wx: number,
    wy: number,
    wz: number,
    alpha: number
  ): void {
    this.#write(face, wx, wy, wz, alpha, 1, 1, 1, 1, 1);
  }

  /**
   * Appends one face stretched over `spanU × spanV` voxels along its in-plane
   * world axes, the quad a greedy sweep merged. Only valid on a `tiled` buffer:
   * the UVs run past 1 and rely on the material folding them back into the
   * tile's atlas rect.
   */
  // eslint-disable-next-line max-params
  addMergedFace(
    face: BlockVariantFace,
    wx: number,
    wy: number,
    wz: number,
    alpha: number,
    spanU: number,
    spanV: number
  ): void {
    const merge = face.merge!;

    // The face lies flat on `axis`, so only the two in-plane axes stretch:
    // axis 0 → (1, spanU, spanV), axis 1 → (spanU, 1, spanV), axis 2 → (spanU, spanV, 1).
    const sx = merge.axis === 0 ? 1 : spanU;
    const sz = merge.axis === 2 ? 1 : spanV;
    let sy = 1;
    if (merge.axis === 0) {
      sy = spanU;
    }
    else if (merge.axis === 2) {
      sy = spanV;
    }

    // A rotated block turns the tile sideways, so the repeat counts follow the
    // tile's own axes rather than the world's.
    const repeatU = merge.swapped ? spanV : spanU;
    const repeatV = merge.swapped ? spanU : spanV;

    this.#write(face, wx, wy, wz, alpha, sx, sy, sz, repeatU, repeatV);
  }

  /**
   * Shared vertex writer. `sx/sy/sz` scale the block-local positions (1 for an
   * unmerged face) and `repeatU/repeatV` scale the tile UVs. On a non-tiled
   * buffer both are always 1, so the atlas UVs are copied verbatim.
   */
  // eslint-disable-next-line max-params
  #write(
    face: BlockVariantFace,
    wx: number,
    wy: number,
    wz: number,
    alpha: number,
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
    const uvs = this.#uvs;
    const colors = this.#colors;
    const regions = this.#regions;
    const repeats = this.#repeats;
    const localPositions = face.positions;
    const localUvs = tiled ? face.tileUvs : face.uvs;
    const { region, normalX, normalY, normalZ } = face;

    let p = base * 3;
    let u = base * 2;
    let c = base * 4;
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
      uvs[u] = localUvs[i2] * repeatU;
      uvs[u + 1] = localUvs[i2 + 1] * repeatV;

      if (tiled) {
        repeats[u] = repeatU;
        repeats[u + 1] = repeatV;

        const r = base * 4 + (i * 4);
        regions[r] = region[0];
        regions[r + 1] = region[1];
        regions[r + 2] = region[2];
        regions[r + 3] = region[3];
      }
      u += 2;

      // RGB stays white so the texture map is unaffected; alpha carries the
      // owning layer's opacity.
      colors[c] = 255;
      colors[c + 1] = 255;
      colors[c + 2] = 255;
      colors[c + 3] = alpha;
      c += 4;
    }

    // Triangulate via fan from vertex 0: [0,1,2] and (if quad) [0,2,3].
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
   * Copies the written range into exact-size attributes. Normals stay float32
   * (shapes such as ramps have non-axis-aligned normals) while colors are
   * stored as normalized bytes — the alpha they carry never has more than 8
   * bits of meaning once rendered.
   */
  toGeometry(): THREE.BufferGeometry {
    const { vertexCount } = this;
    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.#positions.slice(0, vertexCount * 3), 3)
    );
    geometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(this.#normals.slice(0, vertexCount * 3), 3)
    );
    geometry.setAttribute(
      "uv",
      new THREE.BufferAttribute(this.#uvs.slice(0, vertexCount * 2), 2)
    );
    geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(this.#colors.slice(0, vertexCount * 4), 4, true)
    );

    if (this.tiled) {
      geometry.setAttribute(
        "tileRegion",
        new THREE.BufferAttribute(this.#regions.slice(0, vertexCount * 4), 4)
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
    this.#uvs = grow(this.#uvs, capacity * 2);
    this.#colors = grow(this.#colors, capacity * 4);
    if (this.tiled) {
      this.#regions = grow(this.#regions, capacity * 4);
      this.#repeats = grow(this.#repeats, capacity * 2);
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

function grow<TArray extends Float32Array | Uint8Array | Uint32Array>(
  source: TArray,
  length: number
): TArray {
  const next = new (source.constructor as new(length: number) => TArray)(length);
  next.set(source);

  return next;
}
