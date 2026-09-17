// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import GroupManager from "#src/features/groups/GroupManager.ts";
import { NEUTRAL_HIGHLIGHT_COLOR } from "#src/features/groups/PivotMarker.ts";

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

describe("GroupManager resize", () => {
  test("keeps the current geometry when the requested size is unchanged", () => {
    const group = new GroupManager({ size: new THREE.Vector3(1, 1, 1) });
    const geometry = group.getMesh().geometry;

    group.resize(new THREE.Vector3(1, 1, 1));

    assert.equal(group.getMesh().geometry, geometry);
  });

  test("preserves a custom UV mapping when the size is unchanged", () => {
    const group = new GroupManager({ size: new THREE.Vector3(1, 1, 1) });
    const uv = group.getMesh().geometry.attributes.uv;
    uv.setXY(0, 0.25, 0.25);

    group.resize(new THREE.Vector3(1, 1, 1));

    assert.equal(group.getMesh().geometry.attributes.uv.getX(0), 0.25);
    assert.equal(group.getMesh().geometry.attributes.uv.getY(0), 0.25);
  });

  test("rebuilds the geometry when the size actually changes", () => {
    const group = new GroupManager({ size: new THREE.Vector3(1, 1, 1) });
    const geometry = group.getMesh().geometry;

    group.resize(new THREE.Vector3(2, 1, 1));

    assert.notEqual(group.getMesh().geometry, geometry);
    assert.equal(group.getSize().x, 2);
  });

  test("preserves a custom UV mapping when the size actually changes", () => {
    const group = new GroupManager({ size: new THREE.Vector3(1, 1, 1) });
    const uv = group.getMesh().geometry.attributes.uv;
    uv.setXY(0, 0.25, 0.25);

    group.resize(new THREE.Vector3(2, 1, 1));

    assert.equal(group.getMesh().geometry.attributes.uv.getX(0), 0.25);
    assert.equal(group.getMesh().geometry.attributes.uv.getY(0), 0.25);
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

function findEmphasisShell(
  group: GroupManager
): THREE.Mesh | undefined {
  return group.getMesh().children
    .find((child) => child.name === "emphasis-shell") as THREE.Mesh | undefined;
}

function findSelectionShell(
  group: GroupManager
): THREE.Mesh | undefined {
  return group.getMesh().children
    .find((child) => child.name === "selection-shell") as THREE.Mesh | undefined;
}

function findPivotMarker(
  group: GroupManager
): THREE.Sprite | undefined {
  return group.getPivot().children
    .find((child) => child.name === "pivot_visual") as THREE.Sprite | undefined;
}

describe("GroupManager selection", () => {
  test("adds a glow shell on select", () => {
    const group = new GroupManager();

    group.select();

    const shell = findSelectionShell(group);
    assert.ok(shell);
    assert.equal((shell.material as THREE.MeshBasicMaterial).color.getHex(), NEUTRAL_HIGHLIGHT_COLOR);
  });

  test("is a no-op when already selected", () => {
    const group = new GroupManager();

    group.select();
    const first = findSelectionShell(group);
    group.select();

    assert.equal(findSelectionShell(group), first);
  });

  test("removes the shell on deselect", () => {
    const group = new GroupManager();
    group.select();
    const shell = findSelectionShell(group);

    group.deselect();

    assert.equal(findSelectionShell(group), undefined);
    assert.equal(shell?.parent, null);
  });

  test("deselect is a no-op when not selected", () => {
    const group = new GroupManager();

    assert.doesNotThrow(() => group.deselect());
  });
});

describe("GroupManager emphasis outline", () => {
  test("adds a peer-colored glow shell independent of the selection outline", () => {
    const group = new GroupManager();

    group.emphasize(0x00ff00);

    const emphasis = findEmphasisShell(group);
    assert.ok(emphasis);
    assert.equal((emphasis.material as THREE.MeshBasicMaterial).color.getHex(), 0x00ff00);
  });

  test("renders the shell as a back-face-only additive glow around the mesh", () => {
    const group = new GroupManager();

    group.emphasize(0x00ff00);

    const material = findEmphasisShell(group)?.material as THREE.MeshBasicMaterial;
    assert.equal(material.side, THREE.BackSide);
    assert.equal(material.blending, THREE.AdditiveBlending);
    assert.equal(material.depthWrite, false);
  });

  test("shares geometry with the mesh instead of cloning it", () => {
    const group = new GroupManager();

    group.emphasize(0x00ff00);

    assert.equal(findEmphasisShell(group)?.geometry, group.getMesh().geometry);
  });

  test("updates the color of an existing shell instead of duplicating it", () => {
    const group = new GroupManager();

    group.emphasize(0x00ff00);
    group.emphasize(0x0000ff);

    const shells = group.getMesh().children.filter((child) => child.name === "emphasis-shell");
    assert.equal(shells.length, 1);
    const material = (shells[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
    assert.equal(material.color.getHex(), 0x0000ff);
  });

  test("removes the shell from the mesh on clearEmphasis", () => {
    const group = new GroupManager();
    group.emphasize(0x00ff00);
    const emphasis = findEmphasisShell(group);

    group.clearEmphasis();

    assert.equal(findEmphasisShell(group), undefined);
    assert.equal(emphasis?.parent, null);
  });

  test("clearEmphasis is a no-op when nothing was emphasized", () => {
    const group = new GroupManager();

    assert.doesNotThrow(() => group.clearEmphasis());
  });

  test("coexists with the local selection glow as an independent shell", () => {
    const group = new GroupManager();

    group.select();
    group.emphasize(0x00ff00);

    const selection = findSelectionShell(group);
    const emphasis = findEmphasisShell(group);
    assert.ok(selection);
    assert.ok(emphasis);
    assert.notEqual(selection, emphasis);
    assert.equal((selection.material as THREE.MeshBasicMaterial).color.getHex(), NEUTRAL_HIGHLIGHT_COLOR);
    assert.equal((emphasis.material as THREE.MeshBasicMaterial).color.getHex(), 0x00ff00);

    group.deselect();

    assert.equal(findSelectionShell(group), undefined);
    assert.ok(findEmphasisShell(group), "clearing selection must not affect the emphasis shell");
  });

  test("shows and tints the pivot marker on emphasize, hides it again on clearEmphasis", () => {
    const group = new GroupManager();

    assert.equal(findPivotMarker(group)?.visible, false);

    group.emphasize(0x00ff00);
    assert.equal(findPivotMarker(group)?.visible, true);
    assert.equal(
      (findPivotMarker(group)?.material as THREE.SpriteMaterial).color.getHex(),
      0x00ff00
    );

    group.clearEmphasis();
    assert.equal(findPivotMarker(group)?.visible, false);
  });

  test("keeps the pivot marker visible for the local panel after a peer's emphasis clears", () => {
    const group = new GroupManager();

    group.setPivotMarkerVisible(true);
    group.emphasize(0x00ff00, "bob");
    group.clearEmphasis("bob");

    assert.equal(findPivotMarker(group)?.visible, true);
    assert.equal(
      (findPivotMarker(group)?.material as THREE.SpriteMaterial).color.getHex(),
      NEUTRAL_HIGHLIGHT_COLOR
    );
  });

  test("keeps the glow when a second peer emphasizes the same group", () => {
    const group = new GroupManager();

    group.emphasize(0xff0000, "bob");
    group.emphasize(0x0000ff, "cleo");

    const shells = group.getMesh().children.filter((child) => child.name === "emphasis-shell");
    assert.equal(shells.length, 1);
    const material = (shells[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
    assert.equal(material.color.getHex(), 0x0000ff);
  });

  test("falls back to the remaining peer's color when one of two peers clears", () => {
    const group = new GroupManager();

    group.emphasize(0xff0000, "bob");
    group.emphasize(0x0000ff, "cleo");
    group.clearEmphasis("cleo");

    const emphasis = findEmphasisShell(group);
    assert.ok(emphasis, "the shell must stay while bob still emphasizes the group");
    assert.equal((emphasis.material as THREE.MeshBasicMaterial).color.getHex(), 0xff0000);

    group.clearEmphasis("bob");
    assert.equal(findEmphasisShell(group), undefined);
  });
});
