// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  FACE_TEMPLATE_TEXELS,
  PULLED_AO_BITS,
  PULLED_CELL_BITS,
  PULLED_TEMPLATE_BITS,
  type PulledChunkGeometry
} from "../../src/view/meshing/index.ts";
import {
  AO_UNOCCLUDED,
  aoVertexByte
} from "../../src/view/meshing/ambientOcclusion.ts";

// CONSTANTS
const kCellMask = (1 << PULLED_CELL_BITS) - 1;
const kTemplateMask = (1 << PULLED_TEMPLATE_BITS) - 1;
const kAoMask = (1 << PULLED_AO_BITS) - 1;
const kFlipShift = PULLED_TEMPLATE_BITS + PULLED_AO_BITS;
const kTemplateFloats = FACE_TEMPLATE_TEXELS * 4;
const kUvTexel = 4;
const kRegionTexel = 5;
const kNormalTexel = 6;
const kUnorm16 = 65535;
const kSnorm8 = 127;
const kAoLevelBits = 2;
const kAoLevelMask = 0b11;
const kAoMaxLevel = 3;
const kQuadIndices = [0, 1, 2, 0, 2, 3];

interface PulledFace {
  cell: [number, number, number];
  template: number;
  ao: number;
  flip: number;
  region: [number, number, number, number];
}

function pulledFaces(
  geometry: PulledChunkGeometry
): PulledFace[] {
  const words = geometry.faces.image.data as Uint32Array;
  const templates = geometry.templates.texture.image.data as Float32Array;
  const faces: PulledFace[] = [];

  for (let face = 0; face < geometry.faceCount; face++) {
    const cell = words[face * geometry.faceWords];
    const packed = words[(face * geometry.faceWords) + 1];
    const template = packed & kTemplateMask;
    const regionOffset = (template * kTemplateFloats) + (kRegionTexel * 4);

    faces.push({
      cell: [
        cell & kCellMask,
        (cell >>> PULLED_CELL_BITS) & kCellMask,
        (cell >>> (PULLED_CELL_BITS * 2)) & kCellMask
      ],
      template,
      ao: (packed >>> PULLED_TEMPLATE_BITS) & kAoMask,
      flip: packed >>> kFlipShift,
      region: [0, 1, 2, 3].map(
        (i) => Math.round(templates[regionOffset + i] * kUnorm16)
      ) as PulledFace["region"]
    });
  }

  return faces;
}

export function expandPulled(
  geometry: THREE.BufferGeometry
): THREE.BufferGeometry {
  const pulled = geometry as PulledChunkGeometry;
  const templates = pulled.templates.texture.image.data as Float32Array;
  const faces = pulledFaces(pulled);
  const positions = new Float32Array(faces.length * 4 * 3);
  const normals = new Int8Array(faces.length * 4 * 4);
  const uvs = new Uint16Array(faces.length * 4 * 2);
  const faceShades = new Float32Array(faces.length * 4);
  const indices = new Uint32Array(faces.length * 6);

  faces.forEach(({ cell, template, ao, flip }, face) => {
    const offset = template * kTemplateFloats;
    const normalOffset = offset + (kNormalTexel * 4);
    const axes = templates[normalOffset + 3];
    const uAxis = axes % 4;
    const vAxis = Math.floor(axes / 4);

    for (let corner = 0; corner < 4; corner++) {
      const vertex = (face * 4) + corner;
      const source = (corner + flip) & 3;
      const texel = offset + (source * 4);
      const local = [templates[texel], templates[texel + 1], templates[texel + 2]];

      for (let axis = 0; axis < 3; axis++) {
        positions[(vertex * 3) + axis] = cell[axis] + local[axis];
        normals[(vertex * 4) + axis] = Math.round(
          templates[normalOffset + axis] * kSnorm8
        );
      }
      normals[(vertex * 4) + 3] = ao === AO_UNOCCLUDED ?
        kSnorm8 :
        aoVertexByte(ao, local[uAxis], local[vAxis]);
      uvs[vertex * 2] = Math.round(templates[texel + 3] * kUnorm16);
      uvs[(vertex * 2) + 1] = Math.round(
        templates[offset + (kUvTexel * 4) + source] * kUnorm16
      );
    }
    faceShades.fill(faceShade(ao), face * 4, (face * 4) + 4);
    kQuadIndices.forEach((index, i) => {
      indices[(face * 6) + i] = (face * 4) + index;
    });
  });

  const expanded = new THREE.BufferGeometry();
  expanded.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  expanded.setAttribute("normal", new THREE.BufferAttribute(normals, 4, true));
  expanded.setAttribute("uv", new THREE.BufferAttribute(uvs, 2, true));
  expanded.setAttribute("faceShade", new THREE.BufferAttribute(faceShades, 1));
  expanded.setIndex(new THREE.BufferAttribute(indices, 1));

  return expanded;
}

function faceShade(
  ao: number
): number {
  let sum = 0;
  for (let corner = 0; corner < 4; corner++) {
    sum += (ao >>> (corner * kAoLevelBits)) & kAoLevelMask;
  }

  return Math.round(sum / 4 * kSnorm8 / kAoMaxLevel) / kSnorm8;
}

export interface PulledBlendEntry {
  region: number[];
  width: number;
  strength: number;
  pattern: number;
  inverted: boolean;
}

export interface PulledBlendedFace {
  cell: [number, number, number];
  normalY: number;
  neighbours: (PulledBlendEntry | null)[];
}

export function blendedFaces(
  geometry: PulledChunkGeometry
): PulledBlendedFace[] {
  const words = geometry.faces.image.data as Uint32Array;
  const templates = geometry.templates.texture.image.data as Float32Array;
  const palette = geometry.blends?.image.data as Float32Array;
  const faces: PulledBlendedFace[] = [];

  for (let face = 0; face < geometry.faceCount; face++) {
    const offset = face * geometry.faceWords;
    const cell = words[offset];
    const template = words[offset + 1] & kTemplateMask;
    const neighbours: (PulledBlendEntry | null)[] = [];
    for (let i = 0; i < 8; i++) {
      const word = words[offset + 2 + (i >> 2)];
      const index = (word >>> ((i & 3) * 8)) & 0xFF;
      const entry = palette.subarray(index * 8, (index + 1) * 8);
      neighbours.push(index === 0 ? null : {
        region: Array.from(entry.subarray(0, 4), (value) => Math.round(value * kUnorm16)),
        width: entry[4],
        strength: entry[5],
        pattern: entry[6],
        inverted: entry[7] === 1
      });
    }

    faces.push({
      cell: [
        cell & kCellMask,
        (cell >>> PULLED_CELL_BITS) & kCellMask,
        (cell >>> (PULLED_CELL_BITS * 2)) & kCellMask
      ],
      normalY: templates[(template * kTemplateFloats) + (kNormalTexel * 4) + 1],
      neighbours
    });
  }

  return faces;
}
