// Import Third-party Dependencies
import * as THREE from "three";
import type { TextureNode } from "three/webgpu";
import { texture } from "three/tsl";

// Import Internal Dependencies
import type { AtlasUVRegion } from "../../../document/blocksets/types.ts";
import { toUnorm16 } from "../variants/quantize.ts";

// CONSTANTS
export const FACE_REGIONS_PER_ROW = 256;
const kUnorm16 = 65535;

export type FaceRegionAssignment = [
  blockId: number,
  textureSlot: string,
  id: number
];

export class FaceRegionTable {
  readonly node: TextureNode;

  #ids = new Map<number, Map<string, number>>();
  #count = 0;
  #data: Float32Array<ArrayBuffer>;
  #texture: THREE.DataTexture;

  constructor(
    assignments: Iterable<FaceRegionAssignment> = []
  ) {
    this.#data = new Float32Array(FACE_REGIONS_PER_ROW * 4);
    this.#texture = createTexture(this.#data, 1);
    this.node = texture(this.#texture);
    for (const [blockId, textureSlot, id] of assignments) {
      this.#assign(blockId, textureSlot, id);
    }
  }

  get count(): number {
    return this.#count;
  }

  get texture(): THREE.DataTexture {
    return this.#texture;
  }

  idOf(
    blockId: number,
    textureSlot: string
  ): number {
    const known = this.#ids.get(blockId)?.get(textureSlot);
    if (known !== undefined) {
      return known;
    }

    const id = this.#count;
    this.#assign(blockId, textureSlot, id);

    return id;
  }

  write(
    id: number,
    region: AtlasUVRegion
  ): void {
    const offset = id * 4;
    const offsetU = quantize(region.offsetU);
    const offsetV = quantize(region.offsetV);
    const scaleU = quantize(region.scaleU);
    const scaleV = quantize(region.scaleV);
    const data = this.#data;
    if (
      data[offset] === offsetU &&
      data[offset + 1] === offsetV &&
      data[offset + 2] === scaleU &&
      data[offset + 3] === scaleV
    ) {
      return;
    }

    data[offset] = offsetU;
    data[offset + 1] = offsetV;
    data[offset + 2] = scaleU;
    data[offset + 3] = scaleV;
    this.#texture.needsUpdate = true;
  }

  * assignments(): IterableIterator<FaceRegionAssignment> {
    for (const [blockId, ids] of this.#ids) {
      for (const [textureSlot, id] of ids) {
        yield [blockId, textureSlot, id];
      }
    }
  }

  dispose(): void {
    this.#texture.dispose();
  }

  #assign(
    blockId: number,
    textureSlot: string,
    id: number
  ): void {
    let ids = this.#ids.get(blockId);
    if (ids === undefined) {
      ids = new Map();
      this.#ids.set(blockId, ids);
    }
    ids.set(textureSlot, id);
    this.#count = Math.max(this.#count, id + 1);
    this.#reserve(this.#count);
  }

  #reserve(
    count: number
  ): void {
    const rows = this.#texture.image.height;
    if (count <= rows * FACE_REGIONS_PER_ROW) {
      return;
    }

    let grownRows = rows * 2;
    while (count > grownRows * FACE_REGIONS_PER_ROW) {
      grownRows *= 2;
    }
    const grown = new Float32Array(grownRows * FACE_REGIONS_PER_ROW * 4);
    grown.set(this.#data);
    const previous = this.#texture;

    this.#data = grown;
    this.#texture = createTexture(grown, grownRows);
    this.node.value = this.#texture;
    previous.dispose();
  }
}

function quantize(
  value: number
): number {
  return Math.fround(toUnorm16(Math.fround(value)) / kUnorm16);
}

function createTexture(
  data: Float32Array<ArrayBuffer>,
  rows: number
): THREE.DataTexture {
  const table = new THREE.DataTexture(
    data,
    FACE_REGIONS_PER_ROW,
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
