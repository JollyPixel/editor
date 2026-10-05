// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  BlockShapeRegistry,
  occlusionMaskOf,
  type BlockShape,
  type BlockShapeID
} from "../../../../../src/document/blocks/shape/index.ts";
import {
  defineFace,
  type FaceDefinition
} from "../../../../../src/document/blocks/face/index.ts";
import {
  FACES,
  type Vec3
} from "../../../../../src/document/geometry/faceDirection.ts";
import { VoxelTransform } from "../../../../../src/document/geometry/VoxelTransform.ts";
import {
  mirrorsWinding,
  rotateNormal,
  rotateVertex,
  transformFace
} from "../../../../../src/document/geometry/rotation.ts";

interface ComplementCase {
  shape: BlockShapeID;
  complement: BlockShapeID;
  transform: VoxelTransform;
}

// CONSTANTS
const kShapes = BlockShapeRegistry.createDefault();
const kUpsideDownTurned = new VoxelTransform({
  rotation: 2,
  flipY: true
});
const kUpsideDown = new VoxelTransform({
  flipY: true
});
const kComplements: readonly ComplementCase[] = [
  {
    shape: "stair",
    complement: "slabBeam",
    transform: kUpsideDown
  },
  {
    shape: "stairCornerInner",
    complement: "slabCorner",
    transform: kUpsideDown
  },
  {
    shape: "stairCornerOuter",
    complement: "slabNotch",
    transform: kUpsideDown
  },
  {
    shape: "rampCornerInner",
    complement: "rampTip",
    transform: VoxelTransform.Identity
  },
  {
    shape: "rampCornerOuter",
    complement: "rampValley",
    transform: VoxelTransform.Identity
  },
  {
    shape: "slabBottom",
    complement: "slabTop",
    transform: VoxelTransform.Identity
  },
  {
    shape: "ramp",
    complement: "ramp",
    transform: kUpsideDownTurned
  },
  {
    shape: "stairCornerPeak",
    complement: "stairCornerPeak",
    transform: kUpsideDownTurned
  }
];
const kSamples = 7;
const kRay: Vec3 = [0.5772, 0.6931, 0.4142];

describe("Built-in shape complements", () => {
  for (const { shape, complement, transform } of kComplements) {
    describe(`${shape} + ${complement}`, () => {
      const filled = facesOf(shape, VoxelTransform.Identity);
      const rest = facesOf(complement, transform);

      it("fills every point of the cell exactly once", () => {
        for (const point of samplePoints()) {
          assert.equal(
            Number(contains(filled, point)) + Number(contains(rest, point)),
            1,
            `[${point.join(", ")}] is not filled exactly once`
          );
        }
      });

      it("covers every side of the cell", () => {
        assert.deepEqual(
          FACES.filter(
            (face) => (occlusionMaskOf([...filled, ...rest]) & (1 << face)) === 0
          ),
          []
        );
      });
    });
  }
});

function facesOf(
  id: BlockShapeID,
  transform: VoxelTransform
): FaceDefinition[] {
  const shape: BlockShape = kShapes.get(id)!;
  const mirrored = mirrorsWinding(transform);

  return shape.faces.map((definition) => {
    const vertices = definition.vertices.map(
      (vertex) => rotateVertex(vertex, transform)
    );

    return defineFace({
      face: transformFace(definition.face, transform),
      normal: rotateNormal(definition.normal, transform),
      vertices: mirrored ? vertices.toReversed() : vertices
    });
  });
}

function* samplePoints(): IterableIterator<Vec3> {
  for (let i = 0; i < kSamples; i++) {
    for (let j = 0; j < kSamples; j++) {
      for (let k = 0; k < kSamples; k++) {
        yield [
          (i + 0.37) / kSamples,
          (j + 0.41) / kSamples,
          (k + 0.29) / kSamples
        ];
      }
    }
  }
}

function contains(
  faces: readonly FaceDefinition[],
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
  if (Math.abs(determinant) < 1e-12) {
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
