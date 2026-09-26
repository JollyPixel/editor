// Import Third-party Dependencies
import * as THREE from "three";
import type { TextureNode } from "three/webgpu";
import { texture } from "three/tsl";

// Import Internal Dependencies
import type { BlockVariantFace } from "../variants/types.ts";
import {
  aoUAxis,
  aoVAxis
} from "../ambientOcclusion.ts";
import { FACE_AXIS } from "../../utils/math.ts";

// CONSTANTS
export const FACE_TEMPLATE_TEXELS = 8;
export const FACE_TEMPLATES_PER_ROW = 256;
export const MAX_FACE_TEMPLATES = 1 << 22;
const kRowTexels = FACE_TEMPLATES_PER_ROW * FACE_TEMPLATE_TEXELS;
const kTemplateFloats = FACE_TEMPLATE_TEXELS * 4;
const kUvTexel = 4;
const kRegionTexel = 5;
const kNormalTexel = 6;
const kUnorm16 = 65535;
const kSnorm8 = 127;

export class FaceTemplateTable {
  readonly node: TextureNode;

  #ids = new WeakMap<BlockVariantFace, number>();
  #contentIds = new Map<string, number>();
  #data: Float32Array<ArrayBuffer>;
  #texture: THREE.DataTexture;
  #count = 0;

  constructor() {
    this.#data = new Float32Array(kRowTexels * 4);
    this.#texture = createTexture(this.#data, 1);
    this.node = texture(this.#texture);
  }

  get count(): number {
    return this.#count;
  }

  get texture(): THREE.DataTexture {
    return this.#texture;
  }

  idOf(
    face: BlockVariantFace
  ): number {
    const known = this.#ids.get(face);
    if (known !== undefined) {
      return known;
    }

    const key = contentKey(face);
    let id = this.#contentIds.get(key);
    if (id === undefined) {
      id = this.#append(face);
      this.#contentIds.set(key, id);
    }
    this.#ids.set(face, id);

    return id;
  }

  copyVertexTo(
    id: number,
    corner: number,
    target: THREE.Vector3
  ): THREE.Vector3 {
    const offset = (id * kTemplateFloats) + (corner * 4);

    return target.set(
      this.#data[offset],
      this.#data[offset + 1],
      this.#data[offset + 2]
    );
  }

  copyNormalTo(
    id: number,
    target: THREE.Vector3
  ): THREE.Vector3 {
    const offset = (id * kTemplateFloats) + (kNormalTexel * 4);

    return target.set(
      this.#data[offset],
      this.#data[offset + 1],
      this.#data[offset + 2]
    );
  }

  dispose(): void {
    this.#texture.dispose();
  }

  #append(
    face: BlockVariantFace
  ): number {
    const id = this.#count;
    if (id >= MAX_FACE_TEMPLATES) {
      throw new RangeError(
        `FaceTemplateTable: more than ${MAX_FACE_TEMPLATES} distinct faces.`
      );
    }

    this.#reserve(id + 1);
    writeTemplate(this.#data, id * kTemplateFloats, face);
    this.#count = id + 1;
    this.#texture.needsUpdate = true;

    return id;
  }

  #reserve(
    count: number
  ): void {
    const rows = this.#texture.image.height;
    if (count <= rows * FACE_TEMPLATES_PER_ROW) {
      return;
    }

    const grown = new Float32Array(this.#data.length * 2);
    grown.set(this.#data);
    const previous = this.#texture;

    this.#data = grown;
    this.#texture = createTexture(grown, rows * 2);
    this.node.value = this.#texture;
    previous.dispose();
  }
}

function createTexture(
  data: Float32Array<ArrayBuffer>,
  rows: number
): THREE.DataTexture {
  const table = new THREE.DataTexture(
    data,
    kRowTexels,
    rows,
    THREE.RGBAFormat,
    THREE.FloatType
  );
  table.minFilter = THREE.NearestFilter;
  table.magFilter = THREE.NearestFilter;
  table.generateMipmaps = false;
  table.needsUpdate = true;

  return table;
}

function writeTemplate(
  data: Float32Array,
  offset: number,
  face: BlockVariantFace
): void {
  const { positions, uvs, region } = face;
  const last = face.vertexCount - 1;

  for (let corner = 0; corner < 4; corner++) {
    const source = corner > last ? last : corner;
    const texel = offset + (corner * 4);
    data[texel] = positions[source * 3];
    data[texel + 1] = positions[(source * 3) + 1];
    data[texel + 2] = positions[(source * 3) + 2];
    data[texel + 3] = uvs[source * 2] / kUnorm16;
    data[offset + (kUvTexel * 4) + corner] = uvs[(source * 2) + 1] / kUnorm16;
  }

  const regionOffset = offset + (kRegionTexel * 4);
  for (let i = 0; i < 4; i++) {
    data[regionOffset + i] = region[i] / kUnorm16;
  }

  const axis = face.cull < 0 ? 1 : FACE_AXIS[face.cull];
  const normalOffset = offset + (kNormalTexel * 4);
  data[normalOffset] = face.normalX / kSnorm8;
  data[normalOffset + 1] = face.normalY / kSnorm8;
  data[normalOffset + 2] = face.normalZ / kSnorm8;
  data[normalOffset + 3] = aoUAxis(axis) + (aoVAxis(axis) * 4);
}

function contentKey(
  face: BlockVariantFace
): string {
  const parts: number[] = [face.cull, face.vertexCount];
  for (let i = 0; i < face.vertexCount * 3; i++) {
    parts.push(face.positions[i]);
  }
  for (let i = 0; i < face.vertexCount * 2; i++) {
    parts.push(face.uvs[i]);
  }
  parts.push(
    ...face.region,
    face.normalX,
    face.normalY,
    face.normalZ
  );

  return parts.join(",");
}
