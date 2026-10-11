// Import Internal Dependencies
import type { PulledMeshData } from "../types.ts";
import type { BlockVariantFace } from "../variants/types.ts";
import { AO_UNOCCLUDED } from "../ambientOcclusion.ts";
import {
  BLEND_PATTERN_CODES,
  type FaceBlendNeighbour,
  type FaceBlendNeighbours
} from "../faceBlend.ts";
import type { FaceTemplateTable } from "./FaceTemplateTable.ts";
import {
  PulledChunkGeometry,
  PULLED_AO_BITS,
  PULLED_BLEND_TEXELS,
  PULLED_BLENDED_FACE_WORDS,
  PULLED_CELL_BITS,
  PULLED_FACE_WORDS,
  PULLED_MAX_BLEND_ENTRIES,
  PULLED_TEMPLATE_BITS
} from "./PulledChunkGeometry.ts";

// CONSTANTS
const kInitialFaces = 1024;
const kVerticesPerFace = 4;
const kEntryFloats = PULLED_BLEND_TEXELS * 4;
const kIndexBits = 8;
const kIndicesPerWord = 4;
const kUnorm16 = 65535;

export class PulledFaceBuffer {
  vertexCount = 0;
  triangleCount = 0;

  readonly blended: boolean;
  readonly bytesPerVertex: number;

  #templates: FaceTemplateTable;
  #faceWords: number;
  #words: Uint32Array<ArrayBuffer>;
  #faceCount = 0;
  #palette = new Float32Array(kEntryFloats * 16);
  #paletteIds = new Map<string, number>();
  #paletteEntries = new Map<FaceBlendNeighbour, number>();
  #paletteCount = 1;
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
    faceCapacity = kInitialFaces,
    blended = false
  ) {
    this.#templates = templates;
    this.blended = blended;
    this.#faceWords = blended ? PULLED_BLENDED_FACE_WORDS : PULLED_FACE_WORDS;
    this.bytesPerVertex = this.#faceWords *
      Uint32Array.BYTES_PER_ELEMENT / kVerticesPerFace;
    this.#words = new Uint32Array(faceCapacity * this.#faceWords);
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
    this.#paletteIds.clear();
    this.#paletteEntries.clear();
    this.#paletteCount = 1;
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

  /**
   * `neighbours` is read by a blended buffer only; an entry that no longer
   * fits the palette is dropped.
   */
  // eslint-disable-next-line max-params
  addFace(
    face: BlockVariantFace,
    wx: number,
    wy: number,
    wz: number,
    ao = AO_UNOCCLUDED,
    neighbours?: Readonly<FaceBlendNeighbours>
  ): void {
    const x = wx - this.#originX;
    const y = wy - this.#originY;
    const z = wz - this.#originZ;
    const shaded = face.cull < 0 ? AO_UNOCCLUDED : ao;
    const template = this.#templates.internFace(face);
    const flip = this.#templates.resolveDiagonalFlip(template, shaded);

    const offset = this.#reserve();
    this.#words[offset] = x |
      (y << PULLED_CELL_BITS) |
      (z << (PULLED_CELL_BITS * 2));
    this.#words[offset + 1] = (
      template |
      (shaded << PULLED_TEMPLATE_BITS) |
      (flip << (PULLED_TEMPLATE_BITS + PULLED_AO_BITS))
    ) >>> 0;
    if (this.blended) {
      this.#words[offset + 2] = this.#packIndices(neighbours, 0);
      this.#words[offset + 3] = this.#packIndices(neighbours, kIndicesPerWord);
    }

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
      PulledChunkGeometry.wordCapacity(this.#faceCount, this.#faceWords)
    );
    words.set(this.#words.subarray(0, this.#faceCount * this.#faceWords));

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
      ],
      ...(this.blended ? {
        blendPalette: this.#palette.slice(0, this.#paletteCount * kEntryFloats)
      } : {})
    };
  }

  #packIndices(
    neighbours: Readonly<FaceBlendNeighbours> | undefined,
    first: number
  ): number {
    let word = 0;
    for (let i = 0; i < kIndicesPerWord; i++) {
      const neighbour = neighbours?.[first + i] ?? null;
      if (neighbour !== null) {
        word |= this.#resolvePaletteEntry(neighbour) << (i * kIndexBits);
      }
    }

    return word >>> 0;
  }

  #resolvePaletteEntry(
    neighbour: FaceBlendNeighbour
  ): number {
    let entry = this.#paletteEntries.get(neighbour);
    if (entry === undefined) {
      entry = this.#entryByContent(neighbour);
      this.#paletteEntries.set(neighbour, entry);
    }

    return entry;
  }

  #entryByContent(
    neighbour: FaceBlendNeighbour
  ): number {
    const {
      region,
      group,
      strength,
      inverted
    } = neighbour;
    const key = [
      region.join(","),
      group.width,
      group.pattern,
      strength,
      inverted
    ].join(":");
    const known = this.#paletteIds.get(key);
    if (known !== undefined) {
      return known;
    }
    if (this.#paletteCount > PULLED_MAX_BLEND_ENTRIES) {
      return 0;
    }

    const entry = this.#paletteCount++;
    const offset = entry * kEntryFloats;
    if (offset + kEntryFloats > this.#palette.length) {
      const grown = new Float32Array(this.#palette.length * 2);
      grown.set(this.#palette);
      this.#palette = grown;
    }
    for (let i = 0; i < 4; i++) {
      this.#palette[offset + i] = region[i] / kUnorm16;
    }
    this.#palette[offset + 4] = group.width;
    this.#palette[offset + 5] = strength;
    this.#palette[offset + 6] = BLEND_PATTERN_CODES[group.pattern];
    this.#palette[offset + 7] = Number(inverted);
    this.#paletteIds.set(key, entry);

    return entry;
  }

  #reserve(): number {
    const offset = this.#faceCount * this.#faceWords;
    if (offset + this.#faceWords > this.#words.length) {
      const grown = new Uint32Array(this.#words.length * 2);
      grown.set(this.#words);
      this.#words = grown;
    }

    return offset;
  }
}
