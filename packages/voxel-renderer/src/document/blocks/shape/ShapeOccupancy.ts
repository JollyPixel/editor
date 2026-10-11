// Import Internal Dependencies
import type { BlockShape } from "./BlockShape.ts";
import { computeSideCoverage } from "./shapeOcclusion.ts";
import type { FacePlacement } from "../face/index.ts";
import {
  FACES,
  type Vec3
} from "../../geometry/faceDirection.ts";
import {
  VoxelTransform,
  VOXEL_TRANSFORM_MASK
} from "../../geometry/VoxelTransform.ts";
import {
  rotateVertex,
  transformFace
} from "../../geometry/rotation.ts";

// CONSTANTS
const kSamples = 7;
const kSampleCount = kSamples ** 3;
const kWordBits = 32;
const kWordCount = Math.ceil(kSampleCount / kWordBits);
const kLastWordMask = (2 ** (kSampleCount - ((kWordCount - 1) * kWordBits))) - 1;
const kJitter: Vec3 = [0.37, 0.41, 0.29];
const kRay: Vec3 = [0.5772, 0.6931, 0.4142];
const kCoverageEpsilon = 1e-9;
const kParallelEpsilon = 1e-12;
const kCache = new WeakMap<BlockShape, (ShapeOccupancy | undefined)[]>();

export class ShapeOccupancy {
  static fromShape(
    shape: BlockShape,
    transform: VoxelTransform = VoxelTransform.Identity
  ): ShapeOccupancy {
    let variants = kCache.get(shape);
    if (variants === undefined) {
      variants = Array.from<ShapeOccupancy | undefined>({ length: VOXEL_TRANSFORM_MASK + 1 });
      kCache.set(shape, variants);
    }

    let occupancy = variants[transform.packed];
    if (occupancy === undefined) {
      occupancy = new ShapeOccupancy(placedFaces(shape, transform));
      variants[transform.packed] = occupancy;
    }

    return occupancy;
  }

  readonly #faces: readonly FacePlacement[];
  readonly #samples = new Uint32Array(kWordCount);
  readonly #coverage: Float64Array;

  constructor(
    faces: readonly FacePlacement[]
  ) {
    this.#faces = faces;
    this.#coverage = computeSideCoverage(faces);

    let index = 0;
    for (const point of samplePoints()) {
      if (contains(faces, point)) {
        this.#samples[index >>> 5] |= 1 << (index & 31);
      }
      index++;
    }
  }

  complements(
    other: ShapeOccupancy
  ): boolean {
    for (let word = 0; word < kWordCount; word++) {
      const a = this.#samples[word];
      const b = other.#samples[word];
      const full = word === kWordCount - 1 ? kLastWordMask : 0xFFFFFFFF;
      if ((a & b) !== 0 || ((a | b) >>> 0) !== full) {
        return false;
      }
    }

    return FACES.every(
      (face) => this.#coverage[face] + other.#coverage[face] >=
        1 - kCoverageEpsilon
    );
  }

  contains(
    point: Vec3
  ): boolean {
    return contains(this.#faces, point);
  }
}

function placedFaces(
  shape: BlockShape,
  transform: VoxelTransform
): FacePlacement[] {
  return shape.faces.map((definition) => {
    return {
      face: transformFace(definition.face, transform),
      vertices: definition.vertices.map(
        (vertex) => rotateVertex(vertex, transform)
      )
    };
  });
}

function* samplePoints(): IterableIterator<Vec3> {
  for (let i = 0; i < kSamples; i++) {
    for (let j = 0; j < kSamples; j++) {
      for (let k = 0; k < kSamples; k++) {
        yield [
          (i + kJitter[0]) / kSamples,
          (j + kJitter[1]) / kSamples,
          (k + kJitter[2]) / kSamples
        ];
      }
    }
  }
}

function contains(
  faces: readonly FacePlacement[],
  point: Vec3
): boolean {
  let crossings = 0;
  for (const { vertices } of faces) {
    for (let corner = 1; corner < vertices.length - 1; corner++) {
      if (rayHits(point, vertices[0], vertices[corner], vertices[corner + 1])) {
        crossings++;
      }
    }
  }

  return crossings % 2 === 1;
}

function rayHits(
  origin: Vec3,
  a: Vec3,
  b: Vec3,
  c: Vec3
): boolean {
  const edge1 = subtract(b, a);
  const edge2 = subtract(c, a);
  const p = cross(kRay, edge2);
  const determinant = dot(edge1, p);
  if (Math.abs(determinant) < kParallelEpsilon) {
    return false;
  }

  const toOrigin = subtract(origin, a);
  const u = dot(toOrigin, p) / determinant;
  if (u < 0 || u > 1) {
    return false;
  }

  const q = cross(toOrigin, edge1);
  const v = dot(kRay, q) / determinant;
  if (v < 0 || u + v > 1) {
    return false;
  }

  return dot(edge2, q) / determinant > 0;
}

function subtract(
  a: Vec3,
  b: Vec3
): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(
  a: Vec3,
  b: Vec3
): Vec3 {
  return [
    (a[1] * b[2]) - (a[2] * b[1]),
    (a[2] * b[0]) - (a[0] * b[2]),
    (a[0] * b[1]) - (a[1] * b[0])
  ];
}

function dot(
  a: Vec3,
  b: Vec3
): number {
  return (a[0] * b[0]) + (a[1] * b[1]) + (a[2] * b[2]);
}
