// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import GroupManager from "#src/features/groups/GroupManager.ts";

// CONSTANTS
const kEpsilon = 1e-6;

function assertEulerClose(
  actual: THREE.Euler,
  expected: THREE.Euler
): void {
  assert.ok(Math.abs(actual.x - expected.x) < kEpsilon, `x: ${actual.x} !== ${expected.x}`);
  assert.ok(Math.abs(actual.y - expected.y) < kEpsilon, `y: ${actual.y} !== ${expected.y}`);
  assert.ok(Math.abs(actual.z - expected.z) < kEpsilon, `z: ${actual.z} !== ${expected.z}`);
}

describe("GroupManager rotation space", () => {
  test("world rotation matches local rotation without a rotated ancestor", () => {
    const group = new GroupManager();
    const rotation = new THREE.Euler(
      THREE.MathUtils.degToRad(15),
      THREE.MathUtils.degToRad(30),
      0
    );

    group.setRotation(rotation);

    assertEulerClose(group.getRotationWorld(), rotation);
  });

  test("world rotation composes the parent's rotation on top of the local one", () => {
    const parent = new GroupManager();
    const child = new GroupManager();
    parent.getPivot().add(child.getGroup());

    const parentRotation = new THREE.Euler(0, THREE.MathUtils.degToRad(90), 0);
    const childRotation = new THREE.Euler(THREE.MathUtils.degToRad(45), 0, 0);
    parent.setRotation(parentRotation);
    child.setRotation(childRotation);

    const expectedQuaternion = new THREE.Quaternion()
      .setFromEuler(parentRotation)
      .multiply(new THREE.Quaternion().setFromEuler(childRotation));
    const expected = new THREE.Euler().setFromQuaternion(expectedQuaternion);

    assertEulerClose(child.getRotationWorld(), expected);
  });

  test("setRotationWorld round-trips through a rotated parent", () => {
    const parent = new GroupManager();
    const child = new GroupManager();
    parent.getPivot().add(child.getGroup());

    parent.setRotation(new THREE.Euler(0, THREE.MathUtils.degToRad(60), 0));

    const desiredWorld = new THREE.Euler(
      THREE.MathUtils.degToRad(20),
      THREE.MathUtils.degToRad(10),
      0
    );
    child.setRotationWorld(desiredWorld);

    assertEulerClose(child.getRotationWorld(), desiredWorld);

    const local = child.getRotation();
    assert.ok(
      Math.abs(local.x - desiredWorld.x) > kEpsilon ||
      Math.abs(local.y - desiredWorld.y) > kEpsilon ||
      Math.abs(local.z - desiredWorld.z) > kEpsilon,
      "local rotation should differ from world rotation under a rotated parent"
    );
  });
});

describe("GroupManager name", () => {
  test("defaults to an empty name and can be renamed", () => {
    const group = new GroupManager();

    assert.equal(group.name, "");

    group.name = "Torso";

    assert.equal(group.name, "Torso");
  });

  test("uses the constructor option as the initial name", () => {
    const group = new GroupManager({ name: "Head" });

    assert.equal(group.name, "Head");
  });
});
