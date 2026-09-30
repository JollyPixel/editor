// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { InstancedHighlightMask } from "#src/mesh-highlight/postprocess/InstancedHighlightMask.ts";
import { watchDisposal } from "../../fixtures/disposal.ts";
import { createInstancedMesh } from "./helpers.ts";

function createMask(
  mesh: THREE.InstancedMesh,
  instanceId = 0
): InstancedHighlightMask {
  const mask = new InstancedHighlightMask();
  mask.add(mesh, instanceId, new THREE.Color("#ff0000"), false);
  mask.sync();

  return mask;
}

describe("materialsFor", () => {
  test("resolves materials only for a mesh with an added instance", () => {
    const mesh = createInstancedMesh();
    const mask = createMask(mesh, 3);

    assert.strictEqual(mask.size, 1);
    assert.ok(mask.materialsFor(mesh));
    assert.strictEqual(mask.materialsFor(createInstancedMesh()), undefined);
  });

  test("resolves nothing once cleared", () => {
    const mesh = createInstancedMesh();
    const mask = createMask(mesh);

    mask.clear();

    assert.strictEqual(mask.size, 0);
    assert.strictEqual(mask.materialsFor(mesh), undefined);
  });
});

describe("sync", () => {
  test("keeps the materials while the instance count is unchanged", () => {
    const mesh = createInstancedMesh();
    const mask = createMask(mesh);
    const before = mask.materialsFor(mesh)!;
    const counts = watchDisposal(before.material, before.priorityMaterial);

    mask.clear();
    mask.add(mesh, 4, new THREE.Color("#00ff00"), true);
    mask.sync();

    assert.strictEqual(mask.materialsFor(mesh)!.material, before.material);
    assert.deepStrictEqual(counts, [0, 0]);
  });

  test("replaces and releases the materials once the instance count changes", () => {
    const mesh = createInstancedMesh();
    const mask = createMask(mesh);
    const before = mask.materialsFor(mesh)!;
    const counts = watchDisposal(before.material, before.priorityMaterial);

    mesh.count = 20;
    mask.clear();
    mask.add(mesh, 15, new THREE.Color("#00ff00"), false);
    mask.sync();

    assert.notStrictEqual(mask.materialsFor(mesh)!.material, before.material);
    assert.deepStrictEqual(counts, [1, 1]);
  });
});

describe("dispose", () => {
  test("releases every material and forgets every mesh", () => {
    const mesh = createInstancedMesh();
    const mask = createMask(mesh);
    const { material, priorityMaterial } = mask.materialsFor(mesh)!;
    const counts = watchDisposal(material, priorityMaterial);

    mask.dispose();

    assert.deepStrictEqual(counts, [1, 1]);
    assert.strictEqual(mask.materialsFor(mesh), undefined);
  });
});
