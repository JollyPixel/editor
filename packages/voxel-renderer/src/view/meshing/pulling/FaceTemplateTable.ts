// Import Third-party Dependencies
import * as THREE from "three";
import type { TextureNode } from "three/webgpu";
import { texture } from "three/tsl";

// Import Internal Dependencies
import type { BlockVariantFace } from "../variants/types.ts";
import {
  AO_UNOCCLUDED,
  aoUAxis,
  aoVAxis,
  shadeFace
} from "../ambientOcclusion.ts";
import { FACE_AXIS } from "../../../document/geometry/faceDirection.ts";
import { FaceRegionTable } from "./FaceRegionTable.ts";

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
const kAoStates = 256;
const kFlipUnknown = -1;

export type FaceTemplate = Pick<
  BlockVariantFace,
  | "cull"
  | "vertexCount"
  | "positions"
  | "uvs"
  | "regionId"
  | "normalX"
  | "normalY"
  | "normalZ"
>;

export class FaceTemplateTable {
  readonly node: TextureNode;
  readonly regions: FaceRegionTable;

  #ids = new WeakMap<FaceTemplate, number>();
  #faces: FaceTemplate[] = [];
  #contentIds = new Map<string, number>();
  #data: Float32Array<ArrayBuffer>;
  #texture: THREE.DataTexture;
  #count = 0;
  #flips = new Int8Array(0);
  #shade = new Int8Array(4);

  constructor(
    regions = new FaceRegionTable()
  ) {
    this.regions = regions;
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
    face: FaceTemplate
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

  diagonalFlipOf(
    id: number,
    ao: number
  ): number {
    if (ao === AO_UNOCCLUDED) {
      return 0;
    }

    const key = (id * kAoStates) + ao;
    if (key < this.#flips.length) {
      const known = this.#flips[key];
      if (known !== kFlipUnknown) {
        return known;
      }
    }
    else {
      const grown = new Int8Array(
        Math.max(key + 1, this.#flips.length * 2)
      ).fill(kFlipUnknown);
      grown.set(this.#flips);
      this.#flips = grown;
    }

    const flip = shadeFace(this.#faces[id], ao, this.#shade);
    this.#flips[key] = flip;

    return flip;
  }

  templatesSince(
    id: number
  ): FaceTemplate[] {
    return this.#faces.slice(id).map((face) => {
      return {
        cull: face.cull,
        vertexCount: face.vertexCount,
        positions: face.positions,
        uvs: face.uvs,
        regionId: face.regionId,
        normalX: face.normalX,
        normalY: face.normalY,
        normalZ: face.normalZ
      };
    });
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
    this.regions.dispose();
  }

  #append(
    face: FaceTemplate
  ): number {
    const id = this.#count;
    if (id >= MAX_FACE_TEMPLATES) {
      throw new RangeError(
        `FaceTemplateTable: more than ${MAX_FACE_TEMPLATES} distinct faces.`
      );
    }

    this.#reserve(id + 1);
    writeTemplate(this.#data, id * kTemplateFloats, face);
    this.#faces.push(face);
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
  face: FaceTemplate
): void {
  const { positions, uvs } = face;
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

  data[offset + (kRegionTexel * 4)] = face.regionId;

  const axis = face.cull < 0 ? 1 : FACE_AXIS[face.cull];
  const normalOffset = offset + (kNormalTexel * 4);
  data[normalOffset] = face.normalX / kSnorm8;
  data[normalOffset + 1] = face.normalY / kSnorm8;
  data[normalOffset + 2] = face.normalZ / kSnorm8;
  data[normalOffset + 3] = aoUAxis(axis) + (aoVAxis(axis) * 4);
}

function contentKey(
  face: FaceTemplate
): string {
  const parts: number[] = [face.cull, face.vertexCount];
  for (let i = 0; i < face.vertexCount * 3; i++) {
    parts.push(face.positions[i]);
  }
  for (let i = 0; i < face.vertexCount * 2; i++) {
    parts.push(face.uvs[i]);
  }
  parts.push(
    face.regionId,
    face.normalX,
    face.normalY,
    face.normalZ
  );

  return parts.join(",");
}
