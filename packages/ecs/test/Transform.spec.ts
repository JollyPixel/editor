// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { Mat4, Vector3Like } from "@jolly-pixel/math";

// Import Internal Dependencies
import { Transform } from "../src/actor/transform/Transform.ts";
import {
  assertQuaternionClose,
  assertVectorClose,
  vectorArray
} from "./helpers/math/assertClose.ts";

function transformAt(
  position: Readonly<Vector3Like>
): Transform {
  const transform = new Transform();
  transform.local.position = position;

  return transform;
}

function createChild() {
  const parent = transformAt({ x: 2, y: -1, z: 4 });
  parent.local.eulerAngles = { x: 0.3, y: 1.1, z: 0 };
  const transform = transformAt({ x: 1, y: 2, z: 3 }).attach(parent);

  return {
    parent,
    transform
  };
}

describe("Transform", () => {
  test("should read back the global orientation it was given", () => {
    const { transform } = createChild();
    const length = Math.hypot(0.1, -0.2, 0.3, 0.9);
    const target = {
      x: 0.1 / length,
      y: -0.2 / length,
      z: 0.3 / length,
      w: 0.9 / length
    };

    transform.global.orientation = target;

    assertQuaternionClose(transform.global.orientation, target);
  });

  test("should face another transform under a rotated parent", () => {
    const { transform } = createChild();
    const target = transformAt({ x: 5, y: 3, z: -2 });

    transform.lookAt(target);

    const { x, y, z } = transform.global.position;
    const length = Math.hypot(5 - x, 3 - y, -2 - z);
    assertVectorClose(transform.global.forward, {
      x: (5 - x) / length,
      y: (3 - y) / length,
      z: (-2 - z) / length
    });
  });

  test("should look towards a direction like looking at the matching point", () => {
    const { transform } = createChild();
    const reference = createChild().transform;
    const direction = { x: 1, y: -2, z: 0.5 };

    transform.lookTowards(direction);
    const { x, y, z } = reference.global.position;
    reference.lookAt({
      x: x - direction.x,
      y: y - direction.y,
      z: z - direction.z
    });

    assertQuaternionClose(
      transform.global.orientation,
      reference.global.orientation
    );
  });

  test("should move along its own orientation", () => {
    const transform = new Transform();
    transform.local.eulerAngles = { x: 0, y: Math.PI / 2, z: 0 };

    transform.moveOriented({ x: 0, y: 0, z: -1 });

    assertVectorClose(transform.local.position, { x: -1, y: 0, z: 0 });
  });

  for (const [method, expected] of [
    ["moveForward", { x: 10, y: 0, z: -2 }],
    ["moveRight", { x: 12, y: 0, z: 0 }],
    ["moveUp", { x: 10, y: 2, z: 0 }]
  ] as const) {
    test(`should ${method} from its current position`, () => {
      const transform = transformAt({ x: 10, y: 0, z: 0 });

      transform[method](2);

      assertVectorClose(transform.global.position, expected);
    });
  }

  test("should not move when a value read from it is mutated", () => {
    const { transform } = createChild();
    const local = vectorArray(transform.local.position);
    const world = vectorArray(transform.global.position);

    Object.assign(transform.local.position, { x: 5, y: 5, z: 5 });
    Object.assign(transform.global.position, { x: 0, y: 0, z: 0 });
    // @ts-expect-error
    transform.local.position.x = 9;

    assert.deepEqual(vectorArray(transform.local.position), local);
    assert.deepEqual(vectorArray(transform.global.position), world);
  });

  test("should be hidden in the hierarchy when an ancestor is hidden", () => {
    const { parent, transform } = createChild();

    assert.strictEqual(transform.visibleInHierarchy, true);
    parent.visible = false;
    assert.strictEqual(transform.visibleInHierarchy, false);
  });

  test("should measure the distance to another transform", () => {
    const { transform } = createChild();
    const { x, y, z } = transform.global.position;
    const other = transformAt({ x: x + 3, y: y + 4, z });

    assert.ok(Math.abs(transform.distanceTo(other) - 5) < 1e-6);
  });

  test("should follow an ancestor moved after its global position was read", () => {
    const grandparent = new Transform();
    const parent = new Transform().attach(grandparent);
    const transform = transformAt({ x: 1, y: 0, z: 0 }).attach(parent);
    assertVectorClose(transform.global.position, { x: 1, y: 0, z: 0 });

    grandparent.local.position = { x: 0, y: 5, z: 0 };
    assertVectorClose(parent.global.position, { x: 0, y: 5, z: 0 });
    grandparent.local.move({ x: 2, y: 0, z: 0 });

    assertVectorClose(transform.global.position, { x: 3, y: 5, z: 0 });
  });

  test("should offset its global pose by the socket it is seated on", () => {
    const parent = transformAt({ x: 10, y: 0, z: 0 });
    const matrix: Mat4 = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 3, 0, 1
    ];
    const socket = { matrix };
    const transform = transformAt({ x: 1, y: 0, z: 0 })
      .attach(parent)
      .seat(socket);

    assertVectorClose(transform.global.position, { x: 11, y: 3, z: 0 });

    transform.global.position = { x: 0, y: 0, z: 0 };
    assertVectorClose(transform.local.position, { x: -10, y: -3, z: 0 });
  });
});
