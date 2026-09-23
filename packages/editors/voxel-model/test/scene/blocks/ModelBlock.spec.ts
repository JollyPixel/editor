// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { ModelBlock } from "#src/scene/blocks/ModelBlock.ts";
import { NEUTRAL_HIGHLIGHT_COLOR } from "#src/scene/blocks/PivotMarker.ts";

// CONSTANTS
const kEpsilon = 1e-6;

type TexturedMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;

function assertEulerClose(
  actual: THREE.Euler,
  expected: THREE.Euler
): void {
  assert.ok(Math.abs(actual.x - expected.x) < kEpsilon, `x: ${actual.x} !== ${expected.x}`);
  assert.ok(Math.abs(actual.y - expected.y) < kEpsilon, `y: ${actual.y} !== ${expected.y}`);
  assert.ok(Math.abs(actual.z - expected.z) < kEpsilon, `z: ${actual.z} !== ${expected.z}`);
}

function pivotMarkerOf(
  block: ModelBlock
): THREE.Sprite | undefined {
  return block.pivot.children.find(
    (child): child is THREE.Sprite => child.name === "pivot_visual"
  );
}

function textureGhostOf(
  block: ModelBlock
): TexturedMesh | undefined {
  return block.mesh.children.find(
    (child): child is TexturedMesh => child.name === "selection-texture-ghost"
  );
}

describe("ModelBlock rotation space", () => {
  test("world rotation matches local rotation without a rotated ancestor", () => {
    const block = new ModelBlock();
    const rotation = new THREE.Euler(
      THREE.MathUtils.degToRad(15),
      THREE.MathUtils.degToRad(30),
      0
    );

    block.rotation = rotation;

    assertEulerClose(block.worldRotation, rotation);
  });

  test("world rotation composes the parent's rotation on top of the local one", () => {
    const parent = new ModelBlock();
    const child = new ModelBlock();
    parent.pivot.add(child.root);

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
    const parent = new ModelBlock();
    const child = new ModelBlock();
    parent.pivot.add(child.root);
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
    const block = new ModelBlock({ position: new THREE.Vector3(1, 2, 3) });

    block.position.x = 99;

    assert.equal(block.position.x, 1);
  });

  test("moving the pivot keeps the mesh anchored to it", () => {
    const block = new ModelBlock();

    block.pivotOffset = new THREE.Vector3(0.5, 0, 0);

    assert.equal(block.mesh.position.x, -0.5);
  });

  test("transform round-trips every component", () => {
    const source = new ModelBlock({
      position: new THREE.Vector3(1, 2, 3),
      pivotOffset: new THREE.Vector3(0.5, 0, 0),
      size: new THREE.Vector3(2, 1, 1),
      scale: new THREE.Vector3(1, 3, 1),
      rotation: new THREE.Euler(0.1, 0.2, 0.3)
    });
    const target = new ModelBlock();

    target.transform = source.transform;

    assert.deepEqual(target.transform, source.transform);
  });
});

describe("ModelBlock resize", () => {
  test("keeps the geometry and its vertices when the size is unchanged", () => {
    const block = new ModelBlock({ size: new THREE.Vector3(1, 1, 1) });
    const geometry = block.mesh.geometry;
    const before = [...geometry.getAttribute("position").array];

    block.resize(new THREE.Vector3(1, 1, 1));

    assert.equal(block.mesh.geometry, geometry);
    assert.deepEqual([...geometry.getAttribute("position").array], before);
  });

  test("reshapes the same geometry in place when the size changes", () => {
    const block = new ModelBlock({ size: new THREE.Vector3(1, 1, 1) });
    const geometry = block.mesh.geometry;

    block.resize(new THREE.Vector3(2, 1, 1));

    assert.equal(block.mesh.geometry, geometry);
    assert.equal(block.size.x, 2);
    assert.equal(geometry.boundingBox?.max.x, 1);
  });

  test("preserves a custom UV mapping when the size changes", () => {
    const block = new ModelBlock({ size: new THREE.Vector3(1, 1, 1) });
    block.mesh.geometry.getAttribute("uv").setXY(0, 0.25, 0.25);

    block.resize(new THREE.Vector3(2, 1, 1));

    assert.equal(block.mesh.geometry.getAttribute("uv").getX(0), 0.25);
    assert.equal(block.mesh.geometry.getAttribute("uv").getY(0), 0.25);
  });
});

describe("ModelBlock name", () => {
  test("defaults to an empty name and can be renamed", () => {
    const block = new ModelBlock();

    assert.equal(block.name, "");

    block.name = "Torso";

    assert.equal(block.name, "Torso");
  });

  test("uses the constructor option as the initial name", () => {
    assert.equal(new ModelBlock({ name: "Head" }).name, "Head");
  });

  test("uses the constructor uuid when given one", () => {
    assert.equal(new ModelBlock({ uuid: "fixed" }).uuid, "fixed");
  });
});

describe("ModelBlock selection ghost", () => {
  test("adds a front-face-only texture duplicate when shown", () => {
    const block = new ModelBlock();

    block.showSelectionGhost();

    const ghost = textureGhostOf(block);
    assert.equal(ghost?.material.side, THREE.FrontSide);
    assert.equal(ghost?.material.depthTest, false);
    assert.equal(ghost?.material.depthWrite, false);
    assert.equal(ghost?.material.opacity, 1);
    assert.equal(ghost?.geometry, block.mesh.geometry);
  });

  test("keeps a single ghost when shown twice", () => {
    const block = new ModelBlock();

    block.showSelectionGhost();
    const first = textureGhostOf(block);
    block.showSelectionGhost();

    assert.equal(textureGhostOf(block), first);
  });

  test("is removed on hide", () => {
    const block = new ModelBlock();
    block.showSelectionGhost();
    const ghost = textureGhostOf(block);

    block.hideSelectionGhost();

    assert.equal(textureGhostOf(block), undefined);
    assert.equal(ghost?.parent, null);
  });

  test("tolerates hiding when nothing is shown", () => {
    const block = new ModelBlock();

    assert.doesNotThrow(() => block.hideSelectionGhost());
  });

  test("follows texture changes while shown", () => {
    const block = new ModelBlock();
    block.showSelectionGhost();
    const texture = new THREE.Texture();

    block.texture = texture;

    assert.equal(textureGhostOf(block)?.material.map, texture);
  });

  test("emphasize does not create a ghost", () => {
    const block = new ModelBlock();

    block.emphasize(0x00ff00);

    assert.equal(textureGhostOf(block), undefined);
  });
});

describe("ModelBlock emphasis", () => {
  test("shows and tints the pivot marker on emphasize, hides it again on clear", () => {
    const block = new ModelBlock();
    assert.equal(pivotMarkerOf(block)?.visible, false);

    block.emphasize(0x00ff00);
    assert.equal(pivotMarkerOf(block)?.visible, true);
    assert.equal(pivotMarkerOf(block)?.material.color.getHex(), 0x00ff00);

    block.clearEmphasis();
    assert.equal(pivotMarkerOf(block)?.visible, false);
  });

  test("tolerates clearing when nothing was emphasized", () => {
    const block = new ModelBlock();

    assert.doesNotThrow(() => block.clearEmphasis());
  });

  test("keeps the local pivot marker visible after a peer's emphasis clears", () => {
    const block = new ModelBlock();

    block.pivotMarkerVisible = true;
    block.emphasize(0x00ff00, "bob");
    block.clearEmphasis("bob");

    assert.equal(block.pivotMarkerVisible, true);
    assert.equal(pivotMarkerOf(block)?.visible, true);
    assert.equal(pivotMarkerOf(block)?.material.color.getHex(), NEUTRAL_HIGHLIGHT_COLOR);
  });

  test("falls back to the remaining peer's color when one of two peers clears", () => {
    const block = new ModelBlock();

    block.emphasize(0xff0000, "bob");
    block.emphasize(0x0000ff, "cleo");
    block.clearEmphasis("cleo");

    assert.equal(pivotMarkerOf(block)?.material.color.getHex(), 0xff0000);

    block.clearEmphasis("bob");
    assert.equal(pivotMarkerOf(block)?.visible, false);
  });
});
