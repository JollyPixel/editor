// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { ModelBlock } from "#src/scene/blocks/ModelBlock.ts";
import { createBlock } from "./blockHelpers.ts";

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

describe("ModelBlock rotation space", () => {
  test("world rotation matches local rotation without a rotated ancestor", () => {
    const block = createBlock();
    const rotation = new THREE.Euler(
      THREE.MathUtils.degToRad(15),
      THREE.MathUtils.degToRad(30),
      0
    );

    block.rotation = rotation;

    assertEulerClose(block.worldRotation, rotation);
  });

  test("world rotation composes the parent's rotation on top of the local one", () => {
    const parent = createBlock();
    const child = createBlock();
    parent.node.add(child.node);

    const parentRotation = new THREE.Euler(0, THREE.MathUtils.degToRad(90), 0);
    const childRotation = new THREE.Euler(THREE.MathUtils.degToRad(45), 0, 0);
    parent.rotation = parentRotation;
    child.rotation = childRotation;

    const expectedQuaternion = new THREE.Quaternion()
      .setFromEuler(parentRotation)
      .multiply(new THREE.Quaternion().setFromEuler(childRotation));

    assertEulerClose(child.worldRotation, new THREE.Euler().setFromQuaternion(expectedQuaternion));
  });

  test("worldRotation round-trips through a rotated parent", () => {
    const parent = createBlock();
    const child = createBlock();
    parent.node.add(child.node);
    parent.rotation = new THREE.Euler(0, THREE.MathUtils.degToRad(60), 0);

    const desiredWorld = new THREE.Euler(
      THREE.MathUtils.degToRad(20),
      THREE.MathUtils.degToRad(10),
      0
    );
    child.worldRotation = desiredWorld;

    assertEulerClose(child.worldRotation, desiredWorld);
    const local = child.rotation;
    assert.ok(
      Math.abs(local.x - desiredWorld.x) > kEpsilon ||
      Math.abs(local.y - desiredWorld.y) > kEpsilon ||
      Math.abs(local.z - desiredWorld.z) > kEpsilon,
      "local rotation should differ from world rotation under a rotated parent"
    );
  });
});

describe("ModelBlock accessors", () => {
  test("returns copies, so mutating a read value leaves the block unchanged", () => {
    const block = createBlock({ position: new THREE.Vector3(1, 2, 3) });

    block.position.x = 99;

    assert.equal(block.position.x, 1);
  });

  test("moveBoxAroundPivot shifts the mesh and keeps the pivot in place", () => {
    const block = createBlock();

    block.moveBoxAroundPivot(new THREE.Vector3(0.5, 0, 0));

    assert.equal(block.position.x, 0);

    assert.equal(block.mesh.position.x, -0.5);
  });

  test("transform round-trips every component", () => {
    const source = createBlock({
      position: new THREE.Vector3(1, 2, 3),
      pivotOffset: new THREE.Vector3(0.5, 0, 0),
      size: new THREE.Vector3(2, 1, 1),
      scale: new THREE.Vector3(1, 3, 1),
      rotation: new THREE.Euler(0.1, 0.2, 0.3)
    });
    const target = createBlock();

    target.transform = source.transform;

    assert.deepEqual(target.transform, source.transform);
  });
});

describe("ModelBlock pivot placement", () => {
  function rotatedBlock(): ModelBlock {
    const block = createBlock({
      position: new THREE.Vector3(2, 0, 0),
      pivotOffset: new THREE.Vector3(0.5, 0, 0),
      rotation: new THREE.Euler(0, Math.PI / 4, Math.PI / 6)
    });
    new THREE.Scene().add(block.node);
    block.node.updateMatrixWorld(true);

    return block;
  }

  test("movePivot keeps a rotated box where it is and stores the offset as given", () => {
    const block = rotatedBlock();
    const before = block.mesh.matrixWorld.clone();

    block.movePivot(new THREE.Vector3(0.25, -0.5, 0.1));
    block.node.updateMatrixWorld(true);

    assert.deepEqual(block.pivotOffset.toArray(), [0.25, -0.5, 0.1]);
    block.mesh.matrixWorld.elements.forEach((value, index) => {
      assert.ok(Math.abs(value - before.elements[index]) < kEpsilon, `element ${index}`);
    });
  });

  test("movePivotTo puts the pivot on a world point without moving the box", () => {
    const block = rotatedBlock();
    const before = block.mesh.getWorldPosition(new THREE.Vector3());
    const target = new THREE.Vector3(3, 1, -1);

    block.movePivotTo(target);
    block.node.updateMatrixWorld(true);

    assert.ok(block.worldPosition.distanceTo(target) < kEpsilon);
    assert.ok(block.mesh.getWorldPosition(new THREE.Vector3()).distanceTo(before) < kEpsilon);
  });
});

describe("ModelBlock shape", () => {
  function verticesOf(
    geometry: THREE.BufferGeometry,
    name: string
  ): number[][] {
    const attribute = geometry.getAttribute(name);

    return Array.from(
      { length: attribute.count },
      (_, index) => [attribute.getX(index), attribute.getY(index), attribute.getZ(index)]
    );
  }

  test("a plane is one upward quad filling the size in X and Z", () => {
    const block = createBlock({
      shape: { type: "plane" },
      size: new THREE.Vector3(2, 3, 4)
    });
    const { geometry } = block.mesh;

    assert.deepEqual(
      verticesOf(geometry, "position").map(([x, y, z]) => [Math.abs(x), y, Math.abs(z)]),
      Array.from({ length: 4 }, () => [1, 0, 2])
    );
    assert.deepEqual(verticesOf(geometry, "normal"), Array.from({ length: 4 }, () => [0, 1, 0]));
    assert.equal(geometry.getIndex()?.count, 6);
  });

  test("a reflected round block stays reflected through a resize", () => {
    const shape = { type: "cone", sides: 5 } as const;
    const block = createBlock({ shape, size: new THREE.Vector3(1, 1, 1) });

    block.rebuild({ flip: { x: true, y: false, z: false } });
    block.resize(new THREE.Vector3(2, 1, 1));

    const plain = createBlock({ shape, size: new THREE.Vector3(2, 1, 1) });
    assert.deepEqual(
      verticesOf(block.mesh.geometry, "position"),
      verticesOf(plain.mesh.geometry, "position").map(([x, y, z]) => [0 - x, y, z])
    );
  });

  test("restores the base UVs a texture binding overwrote", () => {
    const block = createBlock({ shape: { type: "cylinder", sides: 4 } });
    const uv = block.mesh.geometry.getAttribute("uv");
    const base = Array.from(uv.array);
    uv.setXY(0, 0.25, 0.75);

    block.restoreBaseUv();

    assert.deepEqual(Array.from(uv.array), base);
  });

  test("reshaping swaps the geometry only for a new shape, and later resizes keep it", () => {
    const block = createBlock({ size: new THREE.Vector3(1, 1, 1) });
    const box = block.mesh.geometry;

    assert.equal(block.rebuild({ shape: { type: "box" } }), false);
    assert.equal(block.mesh.geometry, box);

    assert.equal(block.rebuild({ shape: { type: "plane" } }), true);
    block.resize(new THREE.Vector3(2, 1, 1));

    assert.notEqual(block.mesh.geometry, box);
    assert.deepEqual(block.shape, { type: "plane" });
    assert.equal(block.mesh.geometry.getAttribute("position").count, 4);
    assert.equal(block.mesh.geometry.boundingBox?.max.x, 1);
  });
});

describe("ModelBlock resize", () => {
  test("keeps the geometry and its vertices when the size is unchanged", () => {
    const block = createBlock({ size: new THREE.Vector3(1, 1, 1) });
    const geometry = block.mesh.geometry;
    const before = [...geometry.getAttribute("position").array];

    block.resize(new THREE.Vector3(1, 1, 1));

    assert.equal(block.mesh.geometry, geometry);
    assert.deepEqual([...geometry.getAttribute("position").array], before);
  });

  test("reshapes the same geometry in place when the size changes", () => {
    const block = createBlock({ size: new THREE.Vector3(1, 1, 1) });
    const geometry = block.mesh.geometry;

    block.resize(new THREE.Vector3(2, 1, 1));

    assert.equal(block.mesh.geometry, geometry);
    assert.equal(block.size.x, 2);
    assert.equal(geometry.boundingBox?.max.x, 1);
  });

  test("preserves a custom UV mapping when the size changes", () => {
    const block = createBlock({ size: new THREE.Vector3(1, 1, 1) });
    block.mesh.geometry.getAttribute("uv").setXY(0, 0.25, 0.25);

    block.resize(new THREE.Vector3(2, 1, 1));

    assert.equal(block.mesh.geometry.getAttribute("uv").getX(0), 0.25);
    assert.equal(block.mesh.geometry.getAttribute("uv").getY(0), 0.25);
  });
});
