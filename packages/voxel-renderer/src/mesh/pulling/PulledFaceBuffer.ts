// Import Internal Dependencies
import type { PulledMeshData } from "../types.ts";
import type { BlockVariantFace } from "../variants/types.ts";
import {
  AO_UNOCCLUDED,
  shadeFace
} from "../ambientOcclusion.ts";
import type { FaceTemplateTable } from "./FaceTemplateTable.ts";
import {
  PulledChunkGeometry,
  PULLED_AO_BITS,
  PULLED_CELL_BITS,
  PULLED_FACE_WORDS,
  PULLED_TEMPLATE_BITS
} from "./PulledChunkGeometry.ts";

// CONSTANTS
const kInitialFaces = 1024;
const kVerticesPerFace = 4;

export class PulledFaceBuffer {
  vertexCount = 0;
  triangleCount = 0;

  readonly bytesPerVertex = PULLED_FACE_WORDS *
    Uint32Array.BYTES_PER_ELEMENT / kVerticesPerFace;

  #templates: FaceTemplateTable;
  #words: Uint32Array<ArrayBuffer>;
  #faceCount = 0;
  #shade = new Int8Array(4);
  #originX = 0;
  #originY = 0;
  #originZ = 0;
  #minX = Infinity;
  #minY = Infinity;
  #minZ = Infinity;
  #maxX = -Infinity;
  #maxY = -Infinity;
  #maxZ = -Infinity;

  constructor(
    templates: FaceTemplateTable,
    faceCapacity = kInitialFaces
  ) {
    this.#templates = templates;
    this.#words = new Uint32Array(faceCapacity * PULLED_FACE_WORDS);
  }

  get faceCount(): number {
    return this.#faceCount;
  }

  reset(
    originX = 0,
    originY = 0,
    originZ = 0
  ): void {
    this.vertexCount = 0;
    this.triangleCount = 0;
    this.#faceCount = 0;
    this.#originX = originX;
    this.#originY = originY;
    this.#originZ = originZ;
    this.#minX = Infinity;
    this.#minY = Infinity;
    this.#minZ = Infinity;
    this.#maxX = -Infinity;
    this.#maxY = -Infinity;
    this.#maxZ = -Infinity;
  }

  // eslint-disable-next-line max-params
  addFace(
    face: BlockVariantFace,
    wx: number,
    wy: number,
    wz: number,
    ao = AO_UNOCCLUDED
  ): void {
    const x = wx - this.#originX;
    const y = wy - this.#originY;
    const z = wz - this.#originZ;
    const shaded = face.cull < 0 ? AO_UNOCCLUDED : ao;
    const flip = shadeFace(face, shaded, this.#shade);
    const template = this.#templates.idOf(face);

    const offset = this.#reserve();
    this.#words[offset] = x |
      (y << PULLED_CELL_BITS) |
      (z << (PULLED_CELL_BITS * 2));
    this.#words[offset + 1] = (
      template |
      (shaded << PULLED_TEMPLATE_BITS) |
      (flip << (PULLED_TEMPLATE_BITS + PULLED_AO_BITS))
    ) >>> 0;

    this.#faceCount++;
    this.vertexCount += kVerticesPerFace;
    this.triangleCount += face.vertexCount - 2;
    this.#minX = Math.min(this.#minX, x);
    this.#minY = Math.min(this.#minY, y);
    this.#minZ = Math.min(this.#minZ, z);
    this.#maxX = Math.max(this.#maxX, x + 1);
    this.#maxY = Math.max(this.#maxY, y + 1);
    this.#maxZ = Math.max(this.#maxZ, z + 1);
  }

  toMeshData(): PulledMeshData {
    const words = new Uint32Array(
      PulledChunkGeometry.wordCapacity(this.#faceCount)
    );
    words.set(this.#words.subarray(0, this.#faceCount * PULLED_FACE_WORDS));

    return {
      words,
      faceCount: this.#faceCount,
      vertexCount: this.vertexCount,
      triangleCount: this.triangleCount,
      bytesPerVertex: this.bytesPerVertex,
      bounds: [
        this.#minX,
        this.#minY,
        this.#minZ,
        this.#maxX,
        this.#maxY,
        this.#maxZ
      ]
    };
  }

  #reserve(): number {
    const offset = this.#faceCount * PULLED_FACE_WORDS;
    if (offset + PULLED_FACE_WORDS > this.#words.length) {
      const grown = new Uint32Array(this.#words.length * 2);
      grown.set(this.#words);
      this.#words = grown;
    }

    return offset;
  }
}
