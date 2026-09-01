// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { SelectionBoundingBox } from "#src/index.ts";

function createGroupOfTwoBoxes(): THREE.Group {
  const group = new THREE.Group();

  const first = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  first.position.set(0, 0, 0);

  const second = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  second.position.set(2, 0, 0);

  group.add(first, second);

  return group;
}

function assertVectorCloseTo(
  actual: THREE.Vector3,
  expected: THREE.Vector3,
  epsilon = 1e-9
): void {
  assert.ok(Math.abs(actual.x - expected.x) < epsilon, `x: ${actual.x} !~ ${expected.x}`);
  assert.ok(Math.abs(actual.y - expected.y) < epsilon, `y: ${actual.y} !~ ${expected.y}`);
  assert.ok(Math.abs(actual.z - expected.z) < epsilon, `z: ${actual.z} !~ ${expected.z}`);
}

describe("constructor", () => {
  test("adds itself as a child of the target", () => {
    const target = createGroupOfTwoBoxes();
    const box = new SelectionBoundingBox({ target });

    assert.strictEqual(target.children.length, 3);
    assert.strictEqual(target.children.at(-1), box);
  });

  test("positions itself at the union bounding box center, in the target's local space", () => {
    const target = createGroupOfTwoBoxes();
    const box = new SelectionBoundingBox({ target });

    assertVectorCloseTo(box.position, new THREE.Vector3(1, 0, 0));
  });

  test("scales itself to the union bounding box size (with a small size bias)", () => {
    const target = createGroupOfTwoBoxes();
    const box = new SelectionBoundingBox({ target });

    assertVectorCloseTo(box.scale, new THREE.Vector3(3, 1, 1).multiplyScalar(1.01), 1e-6);
  });

  test("is unaffected by the target's own rotation - computed in local space", () => {
    const target = createGroupOfTwoBoxes();
    target.rotation.set(0, Math.PI / 3, 0);
    target.updateMatrixWorld(true);

    const box = new SelectionBoundingBox({ target });

    assertVectorCloseTo(box.position, new THREE.Vector3(1, 0, 0));
  });

  test("hides itself when the target has no mesh descendants", () => {
    const target = new THREE.Group();
    const box = new SelectionBoundingBox({ target });

    assert.strictEqual(box.visible, false);
  });

  test("defaults to white, full opacity, non-transparent", () => {
    const box = new SelectionBoundingBox({ target: createGroupOfTwoBoxes() });

    assert.strictEqual(`#${box.material.color.getHexString()}`, "#ffffff");
    assert.strictEqual(box.material.opacity, 1);
    assert.strictEqual(box.material.transparent, false);
  });

  test("applies the given color and opacity", () => {
    const box = new SelectionBoundingBox({ target: createGroupOfTwoBoxes(), color: "#ff0000", opacity: 0.4 });

    assert.strictEqual(`#${box.material.color.getHexString()}`, "#ff0000");
    assert.strictEqual(box.material.opacity, 0.4);
    assert.strictEqual(box.material.transparent, true);
  });

  test("defaults to depth-tested with a low render order", () => {
    const box = new SelectionBoundingBox({ target: createGroupOfTwoBoxes() });

    assert.strictEqual(box.material.depthTest, true);
    assert.strictEqual(box.material.depthWrite, true);
    assert.strictEqual(box.renderOrder, 1);
  });

  test("xray disables depth test/write and raises the render order above default objects", () => {
    const box = new SelectionBoundingBox({ target: createGroupOfTwoBoxes(), xray: true });

    assert.strictEqual(box.material.depthTest, false);
    assert.strictEqual(box.material.depthWrite, false);
    assert.ok(box.renderOrder > 1);
  });
});

describe("fillOpacity", () => {
  test("builds no fill mesh by default", () => {
    const box = new SelectionBoundingBox({ target: createGroupOfTwoBoxes() });

    assert.strictEqual(box.children.length, 0);
  });

  test("builds a fill mesh matching the wireframe's own color when fillOpacity > 0", () => {
    const box = new SelectionBoundingBox({ target: createGroupOfTwoBoxes(), color: "#ff00ff", fillOpacity: 0.3 });

    assert.strictEqual(box.children.length, 1);
    const fill = box.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
    assert.strictEqual(`#${fill.material.color.getHexString()}`, "#ff00ff");
    assert.strictEqual(fill.material.opacity, 0.3);
    assert.strictEqual(fill.material.transparent, true);
  });

  test("the fill mesh never writes depth, regardless of xray", () => {
    const box = new SelectionBoundingBox({ target: createGroupOfTwoBoxes(), fillOpacity: 0.3 });
    const fill = box.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;

    assert.strictEqual(fill.material.depthWrite, false);
    box.setXray(true);
    assert.strictEqual(fill.material.depthWrite, false);
  });
});

describe("setFillOpacity", () => {
  test("updates the fill mesh's own opacity", () => {
    const box = new SelectionBoundingBox({ target: createGroupOfTwoBoxes(), fillOpacity: 0.3 });
    box.setFillOpacity(0.6);

    const fill = box.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
    assert.strictEqual(fill.material.opacity, 0.6);
  });

  test("builds a fill mesh on demand, matching the wireframe's current color and x-ray state", () => {
    const box = new SelectionBoundingBox({ target: createGroupOfTwoBoxes(), color: "#ff00ff", xray: true });
    assert.strictEqual(box.children.length, 0, "starts with no fill mesh - built with fillOpacity: 0");

    box.setFillOpacity(0.5);

    assert.strictEqual(box.children.length, 1);
    const fill = box.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
    assert.strictEqual(fill.material.opacity, 0.5);
    assert.strictEqual(`#${fill.material.color.getHexString()}`, "#ff00ff");
    assert.strictEqual(fill.material.depthTest, false, "matches the wireframe's own x-ray state");
  });

  test("remains a no-op for a non-positive opacity on a box with no fill mesh yet", () => {
    const box = new SelectionBoundingBox({ target: createGroupOfTwoBoxes() });

    assert.doesNotThrow(() => box.setFillOpacity(0));
    assert.strictEqual(box.children.length, 0);
  });
});

describe("update", () => {
  test("recomputes the box after a new child is added", () => {
    const target = createGroupOfTwoBoxes();
    const box = new SelectionBoundingBox({ target });

    const third = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    third.position.set(4, 0, 0);
    target.add(third);
    box.update();

    assertVectorCloseTo(box.position, new THREE.Vector3(2, 0, 0));
  });
});

describe("setColor", () => {
  test("updates the material color", () => {
    const box = new SelectionBoundingBox({ target: createGroupOfTwoBoxes(), color: "#000000" });
    box.setColor("#00ff00");

    assert.strictEqual(`#${box.material.color.getHexString()}`, "#00ff00");
  });

  test("also updates the fill mesh's own color, when one exists", () => {
    const box = new SelectionBoundingBox({ target: createGroupOfTwoBoxes(), color: "#000000", fillOpacity: 0.3 });
    box.setColor("#00ff00");

    const fill = box.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
    assert.strictEqual(`#${fill.material.color.getHexString()}`, "#00ff00");
  });
});

describe("setOpacity", () => {
  test("updates opacity and toggles transparent accordingly", () => {
    const box = new SelectionBoundingBox({ target: createGroupOfTwoBoxes() });

    box.setOpacity(0.5);
    assert.strictEqual(box.material.opacity, 0.5);
    assert.strictEqual(box.material.transparent, true);

    box.setOpacity(1);
    assert.strictEqual(box.material.opacity, 1);
    assert.strictEqual(box.material.transparent, false);
  });
});

describe("setXray", () => {
  test("toggling xray on disables depth test/write and raises render order", () => {
    const box = new SelectionBoundingBox({ target: createGroupOfTwoBoxes() });
    box.setXray(true);

    assert.strictEqual(box.material.depthTest, false);
    assert.strictEqual(box.material.depthWrite, false);
    assert.ok(box.renderOrder > 1);
  });

  test("toggling xray off restores depth test/write and the default render order", () => {
    const box = new SelectionBoundingBox({ target: createGroupOfTwoBoxes(), xray: true });
    box.setXray(false);

    assert.strictEqual(box.material.depthTest, true);
    assert.strictEqual(box.material.depthWrite, true);
    assert.strictEqual(box.renderOrder, 1);
  });

  test("also toggles the fill mesh's own depth test/render order, when one exists", () => {
    const box = new SelectionBoundingBox({ target: createGroupOfTwoBoxes(), fillOpacity: 0.3 });
    box.setXray(true);

    const fill = box.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
    assert.strictEqual(fill.material.depthTest, false);
    assert.ok(fill.renderOrder > 1);
  });
});

describe("dispose", () => {
  test("removes itself from the target and disposes geometry/material", () => {
    const target = createGroupOfTwoBoxes();
    const box = new SelectionBoundingBox({ target });

    let geometryDisposed = false;
    let materialDisposed = false;
    box.geometry.addEventListener("dispose", () => {
      geometryDisposed = true;
    });
    box.material.addEventListener("dispose", () => {
      materialDisposed = true;
    });

    box.dispose();

    assert.strictEqual(target.children.length, 2);
    assert.ok(geometryDisposed);
    assert.ok(materialDisposed);
  });

  test("also disposes the fill mesh's own geometry/material, when one exists", () => {
    const target = createGroupOfTwoBoxes();
    const box = new SelectionBoundingBox({ target, fillOpacity: 0.3 });
    const fill = box.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;

    let fillGeometryDisposed = false;
    let fillMaterialDisposed = false;
    fill.geometry.addEventListener("dispose", () => {
      fillGeometryDisposed = true;
    });
    fill.material.addEventListener("dispose", () => {
      fillMaterialDisposed = true;
    });

    box.dispose();

    assert.ok(fillGeometryDisposed);
    assert.ok(fillMaterialDisposed);
  });
});
