// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { GridFadeValue } from "#src/grid/GridFadeValue.ts";

describe("GridFadeValue", () => {
  test("target defaults to null when not provided", () => {
    const fade = new GridFadeValue("camera");

    assert.strictEqual(fade.target, null);
  });

  describe("trackTarget", () => {
    test("writes the target's world position when from is \"target\"", () => {
      const object = new THREE.Object3D();
      object.position.set(1, 2, 3);
      const fade = new GridFadeValue("target", object);

      const uniform = new THREE.Vector3();
      fade.trackTarget(uniform);

      assert.deepStrictEqual(
        { x: uniform.x, y: uniform.y, z: uniform.z },
        { x: 1, y: 2, z: 3 }
      );
    });

    test("tracks the target's parent-relative world position", () => {
      const parent = new THREE.Object3D();
      parent.position.set(10, 0, 0);
      const child = new THREE.Object3D();
      child.position.set(1, 2, 3);
      parent.add(child);

      const fade = new GridFadeValue("target", child);
      const uniform = new THREE.Vector3();
      fade.trackTarget(uniform);

      assert.deepStrictEqual(
        { x: uniform.x, y: uniform.y, z: uniform.z },
        { x: 11, y: 2, z: 3 }
      );
    });

    test("leaves the uniform untouched when from is not \"target\"", () => {
      const fade = new GridFadeValue("camera");

      const uniform = new THREE.Vector3(9, 9, 9);
      fade.trackTarget(uniform);

      assert.deepStrictEqual(
        { x: uniform.x, y: uniform.y, z: uniform.z },
        { x: 9, y: 9, z: 9 }
      );
    });

    test("leaves the uniform untouched when target has been cleared", () => {
      const object = new THREE.Object3D();
      object.position.set(1, 2, 3);
      const fade = new GridFadeValue("target", object);
      fade.target = null;

      const uniform = new THREE.Vector3(9, 9, 9);
      fade.trackTarget(uniform);

      assert.deepStrictEqual(
        { x: uniform.x, y: uniform.y, z: uniform.z },
        { x: 9, y: 9, z: 9 }
      );
    });

    test("writes the fallback position when target has been cleared", () => {
      const object = new THREE.Object3D();
      const fade = new GridFadeValue("target", object);
      fade.target = null;

      const uniform = new THREE.Vector3(9, 9, 9);
      fade.trackTarget(
        uniform,
        { x: 4, y: 5, z: 6 }
      );

      assert.deepStrictEqual(
        { x: uniform.x, y: uniform.y, z: uniform.z },
        { x: 4, y: 5, z: 6 }
      );
    });
  });

  describe("anchorPosition", () => {
    const kCameraPosition = { x: 1, y: 2, z: 3 };
    const kTargetPosition = { x: 4, y: 5, z: 6 };
    const kCases = [
      {
        label: "target when from is \"target\" and target is set",
        create: () => new GridFadeValue("target", new THREE.Object3D()),
        expected: kTargetPosition
      },
      {
        label: "camera when from is \"target\" but target is cleared",
        create: () => {
          const fade = new GridFadeValue("target", new THREE.Object3D());
          fade.target = null;

          return fade;
        },
        expected: kCameraPosition
      },
      {
        label: "camera when from is \"camera\"",
        create: () => new GridFadeValue("camera"),
        expected: kCameraPosition
      },
      {
        label: "camera when from is \"origin\"",
        create: () => new GridFadeValue("origin"),
        expected: kCameraPosition
      }
    ];

    for (const { label, create, expected } of kCases) {
      test(`returns the ${label}`, () => {
        assert.strictEqual(
          create().anchorPosition(kCameraPosition, kTargetPosition),
          expected
        );
      });
    }
  });
});
