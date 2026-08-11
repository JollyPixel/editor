// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { SelectionManager, SelectionOutline, SelectionBoundingBox } from "#src/index.ts";

function createManagerWithMeshAndGroup(): {
  manager: SelectionManager;
  mesh: THREE.Mesh;
  group: THREE.Group;
} {
  const manager = new SelectionManager();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));

  manager.register("mesh-1", mesh);
  manager.register("group-1", group);

  return { manager, mesh, group };
}

describe("select", () => {
  test("renders a SelectionOutline for a registered mesh", () => {
    const { manager, mesh } = createManagerWithMeshAndGroup();
    manager.select("mesh-1");

    assert.strictEqual(manager.selected, "mesh-1");
    assert.strictEqual(mesh.children.length, 1);
    assert.ok(mesh.children[0] instanceof SelectionOutline);
  });

  test("renders a SelectionBoundingBox for a registered group", () => {
    const { manager, group } = createManagerWithMeshAndGroup();
    manager.select("group-1");

    assert.strictEqual(manager.selected, "group-1");
    assert.ok(group.children.at(-1) instanceof SelectionBoundingBox);
  });

  test("disposes the previous overlay when selection changes", () => {
    const { manager, mesh, group } = createManagerWithMeshAndGroup();
    manager.select("mesh-1");
    manager.select("group-1");

    assert.strictEqual(mesh.children.length, 0);
    assert.strictEqual(group.children.length, 2);
  });

  test("select(null) clears the current selection", () => {
    const { manager, mesh } = createManagerWithMeshAndGroup();
    manager.select("mesh-1");
    manager.select(null);

    assert.strictEqual(manager.selected, null);
    assert.strictEqual(mesh.children.length, 0);
  });

  test("re-selecting the same id is a no-op", () => {
    const { manager } = createManagerWithMeshAndGroup();
    manager.select("mesh-1");

    let changeCount = 0;
    manager.addEventListener("selectionChange", () => {
      changeCount += 1;
    });
    manager.select("mesh-1");

    assert.strictEqual(changeCount, 0);
  });

  test("throws for an unregistered id", () => {
    const { manager } = createManagerWithMeshAndGroup();

    assert.throws(() => manager.select("unknown"));
  });

  test("dispatches selectionChange", () => {
    const { manager } = createManagerWithMeshAndGroup();

    let dispatched = false;
    manager.addEventListener("selectionChange", () => {
      dispatched = true;
    });
    manager.select("mesh-1");

    assert.ok(dispatched);
  });
});

describe("hover", () => {
  test("renders a dimmer overlay for a hovered id", () => {
    const { manager, mesh } = createManagerWithMeshAndGroup();
    manager.hover("mesh-1");

    assert.strictEqual(manager.hovered, "mesh-1");
    const overlay = mesh.children[0] as SelectionOutline;
    assert.ok(overlay instanceof SelectionOutline);
    assert.ok(overlay.material.opacity < 1);
  });

  test("does not render a hover overlay for the already-selected id", () => {
    const { manager, mesh } = createManagerWithMeshAndGroup();
    manager.select("mesh-1");
    manager.hover("mesh-1");

    assert.strictEqual(mesh.children.length, 1);
  });

  test("drops the hover overlay once that id becomes the selection", () => {
    const { manager, mesh } = createManagerWithMeshAndGroup();
    manager.hover("mesh-1");
    manager.select("mesh-1");

    const overlay = mesh.children[0] as SelectionOutline;
    assert.strictEqual(mesh.children.length, 1);
    assert.strictEqual(overlay.material.opacity, 1);
  });

  test("hover(null) clears the current hover", () => {
    const { manager, mesh } = createManagerWithMeshAndGroup();
    manager.hover("mesh-1");
    manager.hover(null);

    assert.strictEqual(manager.hovered, null);
    assert.strictEqual(mesh.children.length, 0);
  });
});

describe("unregister", () => {
  test("clears an active selection and forgets the id", () => {
    const { manager, mesh } = createManagerWithMeshAndGroup();
    manager.select("mesh-1");
    manager.unregister("mesh-1");

    assert.strictEqual(manager.selected, null);
    assert.strictEqual(mesh.children.length, 0);
    assert.throws(() => manager.select("mesh-1"));
  });
});

describe("dispose", () => {
  test("clears selection, hover and the registry", () => {
    const { manager, mesh, group } = createManagerWithMeshAndGroup();
    manager.select("mesh-1");
    manager.hover("group-1");
    manager.dispose();

    assert.strictEqual(manager.selected, null);
    assert.strictEqual(manager.hovered, null);
    assert.strictEqual(mesh.children.length, 0);
    assert.strictEqual(group.children.length, 1);
  });
});
