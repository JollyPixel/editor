// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import {
  BlockShape,
  type BlockShapeJSON,
  type MirrorAxes
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import { blockGeometry } from "#src/scene/blocks/blockGeometry.ts";

// CONSTANTS
const kUnit = new THREE.Vector3(1, 1, 1);
const kFaceVertexCount = 4;
const kShapes: BlockShapeJSON[] = [
  { type: "box" },
  { type: "plane" },
  { type: "cylinder", sides: 3 },
  { type: "cylinder", sides: 8 },
  { type: "cone", sides: 4 },
  { type: "cone", sides: 7 },
  { type: "torus", sides: 24, ringSides: 4, thickness: 0.6 }
];

const kMirrors: MirrorAxes[] = [false, true].flatMap((x) => [false, true].flatMap(
  (y) => [false, true].map((z) => {
    return { x, y, z };
  })
));

function label(
  axes: MirrorAxes
): string {
  const mirrored = (["x", "y", "z"] as const)
    .filter((axis) => axes[axis])
    .join("");

  return mirrored === "" ? "no mirror" : `${mirrored} mirror`;
}

function vertex(
  geometry: THREE.BufferGeometry,
  name: string,
  index: number
): THREE.Vector3 {
  return new THREE.Vector3().fromBufferAttribute(geometry.getAttribute(name), index);
}

function uvAt(
  geometry: THREE.BufferGeometry,
  index: number
): number[] {
  const uv = geometry.getAttribute("uv");

  return [uv.getX(index), uv.getY(index)];
}

function facesPointOutward(
  geometry: THREE.BufferGeometry,
  centerOf: (point: THREE.Vector3) => THREE.Vector3 = () => new THREE.Vector3()
): boolean {
  const index = geometry.getIndex()!;
  for (let triangle = 0; triangle < index.count; triangle += 3) {
    const [a, b, c] = [0, 1, 2].map((corner) => vertex(geometry, "position", index.getX(triangle + corner)));
    const wound = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
    const centroid = a.clone()
      .add(b)
      .add(c)
      .divideScalar(3);
    const stored = vertex(geometry, "normal", index.getX(triangle));
    if (wound.dot(centroid.clone().sub(centerOf(centroid))) <= 0 || stored.dot(wound) <= 0) {
      return false;
    }
  }

  return true;
}

function tubeCenter(
  point: THREE.Vector3
): THREE.Vector3 {
  return new THREE.Vector3(point.x, 0, point.z).setLength(0.5 * (1 - (0.6 / 2)));
}

describe("blockGeometry", () => {
  test("has one vertex range per UV slot the asset gives the shape", () => {
    for (const shape of kShapes) {
      const { faces } = blockGeometry(shape, kUnit);

      assert.deepEqual(Object.keys(faces).sort(), BlockShape.slots(shape).sort(), shape.type);
      assert.ok(Object.isFrozen(faces));
    }
  });

  test("winds every solid face outward, with matching normals, mirrored or not", () => {
    for (const shape of kShapes.filter((each) => each.type !== "plane")) {
      for (const axes of kMirrors) {
        const { geometry } = blockGeometry(shape, kUnit, axes);
        const centerOf = shape.type === "torus" ? tubeCenter : undefined;
        assert.ok(facesPointOutward(geometry, centerOf), `${shape.type} ${label(axes)}`);
      }
    }
  });

  test("keeps a hole in a torus at its thickest, so its front segment never crosses the centre", () => {
    const thickest = { type: "torus", sides: 8, ringSides: 6, thickness: 0.95 } as const;
    const { geometry, faces } = blockGeometry(thickest, kUnit);
    const { start, count } = faces["side-0"]![0];

    for (let index = start; index < start + count; index++) {
      assert.ok(vertex(geometry, "position", index).z > 0);
    }
  });

  test("wraps each torus segment once around its tube, one quad per ring side", () => {
    const { faces } = blockGeometry({ type: "torus", sides: 5, ringSides: 7, thickness: 0.3 }, kUnit);

    for (const slot of BlockShape.sideSlots(5)) {
      assert.equal(faces[slot]![0].count, 7 * kFaceVertexCount);
    }
  });

  test("stretches a round shape's polygon until it touches every side of the size", () => {
    const size = new THREE.Vector3(2, 3, 4);
    for (const sides of [3, 4, 7, 8]) {
      const shapes: BlockShapeJSON[] = [
        { type: "cylinder", sides },
        { type: "cone", sides },
        { type: "torus", sides, ringSides: 5, thickness: 0.4 }
      ];
      for (const shape of shapes) {
        const box = blockGeometry(shape, size).geometry.boundingBox!;

        assert.deepEqual(
          [box.min, box.max].map((corner) => corner.toArray().map((value) => Number(value.toFixed(6)))),
          [[-1, -1.5, -2], [1, 1.5, 2]],
          `${shape.type} ${sides}`
        );
      }
    }
  });

  test("gives a 4-sided cone a square base and a point at the top centre: a pyramid", () => {
    const { geometry, faces } = blockGeometry({ type: "cone", sides: 4 }, kUnit);
    const base = faces.bottom![0];
    const corners = Array.from({ length: base.count }, (_, index) => {
      const point = vertex(geometry, "position", base.start + index);

      return [Math.abs(point.x), point.y, Math.abs(point.z)];
    });

    assert.deepEqual(corners, Array.from({ length: 4 }, () => [0.5, -0.5, 0.5]));
    assert.deepEqual(vertex(geometry, "position", faces["side-0"]![0].start).toArray(), [0, 0.5, 0]);
  });

  test("faces its first side to the front", () => {
    const { geometry, faces } = blockGeometry({ type: "cylinder", sides: 6 }, kUnit);
    const normal = vertex(geometry, "normal", faces["side-0"]![0].start);

    assert.deepEqual(normal.toArray().map((value) => Number(value.toFixed(6))), [0, 0, 1]);
  });

  test("reflects every mirrored shape, so each face keeps its texture as a mirror image", () => {
    for (const shape of kShapes) {
      const plain = blockGeometry(shape, kUnit);
      for (const axes of kMirrors) {
        const mirrored = blockGeometry(shape, kUnit, axes);
        const sign = new THREE.Vector3(axes.x ? -1 : 1, axes.y ? -1 : 1, axes.z ? -1 : 1);

        assert.deepEqual(mirrored.faces, plain.faces, `${shape.type} ${label(axes)}`);
        for (let index = 0; index < plain.geometry.getAttribute("position").count; index++) {
          const expected = vertex(plain.geometry, "position", index).multiply(sign);

          assert.ok(vertex(mirrored.geometry, "position", index).distanceTo(expected) < 1e-9);
          assert.deepEqual(uvAt(mirrored.geometry, index), uvAt(plain.geometry, index));
        }
      }
    }
  });
});
