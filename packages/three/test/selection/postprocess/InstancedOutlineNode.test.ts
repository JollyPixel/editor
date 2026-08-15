// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { InstancedOutlineNode, instancedOutline } from "#src/index.ts";

/**
 * Unlike `ToonOutlinePass`/`ColoredOutlinePass`, the constructor here needs
 * no renderer at all - only `updateBefore()`/`setup()` (never called by
 * these tests, same convention those two test files use for the same
 * reason: no real `THREE.WebGPURenderer` GPU context in `node:test`) touch
 * one.
 */
function createNode(
  params?: ConstructorParameters<typeof InstancedOutlineNode>[2]
): InstancedOutlineNode {
  return new InstancedOutlineNode(new THREE.Scene(), new THREE.PerspectiveCamera(), params);
}

describe("constructor", () => {
  test("defaults to empty selectedObjects/selectedInstances", () => {
    const node = createNode();

    assert.deepStrictEqual(node.selectedObjects, []);
    assert.deepStrictEqual(node.selectedInstances, []);
  });

  test("defaults downSampleRatio to 2", () => {
    const node = createNode();

    assert.strictEqual(node.downSampleRatio, 2);
  });

  test("applies the given selectedObjects/selectedInstances/downSampleRatio", () => {
    const object = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const instancedMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 5);

    const node = createNode({
      selectedObjects: [object],
      selectedInstances: [{ mesh: instancedMesh, instanceId: 2 }],
      downSampleRatio: 4
    });

    assert.deepStrictEqual(node.selectedObjects, [object]);
    assert.deepStrictEqual(node.selectedInstances, [{ mesh: instancedMesh, instanceId: 2 }]);
    assert.strictEqual(node.downSampleRatio, 4);
  });

  test("exposes scene and camera", () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const node = new InstancedOutlineNode(scene, camera);

    assert.strictEqual(node.scene, scene);
    assert.strictEqual(node.camera, camera);
  });
});

describe("visibleEdge / hiddenEdge / getTextureNode", () => {
  test("does not throw reading visibleEdge", () => {
    const node = createNode();

    assert.doesNotThrow(() => node.visibleEdge);
  });

  test("does not throw reading hiddenEdge", () => {
    const node = createNode();

    assert.doesNotThrow(() => node.hiddenEdge);
  });

  test("getTextureNode returns a node", () => {
    const node = createNode();

    assert.ok(node.getTextureNode());
  });
});

describe("dispose", () => {
  test("does not throw", () => {
    const node = createNode();

    assert.doesNotThrow(() => node.dispose());
  });

  test("empties selectedObjects and selectedInstances", () => {
    const object = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const instancedMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 5);
    const node = createNode({
      selectedObjects: [object],
      selectedInstances: [{ mesh: instancedMesh, instanceId: 0 }]
    });

    node.dispose();

    assert.strictEqual(node.selectedObjects.length, 0);
    assert.strictEqual(node.selectedInstances.length, 0);
  });
});

describe("instancedOutline", () => {
  test("factory returns an InstancedOutlineNode", () => {
    const node = instancedOutline(new THREE.Scene(), new THREE.PerspectiveCamera());

    assert.ok(node instanceof InstancedOutlineNode);
  });
});
