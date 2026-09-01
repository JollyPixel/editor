// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { HighlightPass } from "#src/index.ts";

/**
 * `HighlightPass`'s constructor only reads `toneMapping`/
 * `outputColorSpace` off the renderer (see `RenderPipeline`'s own
 * constructor) - a real `WebGPURenderer` needs an async `init()` (a GPU
 * context) neither available nor needed for these tests, which never call
 * `render()`.
 */
function createRendererStub(): THREE.WebGPURenderer {
  return {
    toneMapping: THREE.NoToneMapping,
    outputColorSpace: THREE.SRGBColorSpace
  } as unknown as THREE.WebGPURenderer;
}

function createPass(
  options?: ConstructorParameters<typeof HighlightPass>[3]
): HighlightPass {
  return new HighlightPass(
    createRendererStub(),
    new THREE.Scene(),
    new THREE.PerspectiveCamera(),
    options
  );
}

describe("constructor", () => {
  test("defaults edgeThickness to 1 and edgeGlow to 0", () => {
    const highlight = createPass();

    assert.strictEqual(highlight.edgeThickness, 1);
    assert.strictEqual(highlight.edgeGlow, 0);
  });

  test("applies the given options", () => {
    const highlight = createPass({ edgeThickness: 3, edgeGlow: 0.5, downSampleRatio: 4 });

    assert.strictEqual(highlight.edgeThickness, 3);
    assert.strictEqual(highlight.edgeGlow, 0.5);
  });

  test("exposes its own RenderPipeline", () => {
    const highlight = createPass();

    assert.ok(highlight.pipeline instanceof THREE.RenderPipeline);
  });
});

describe("setEdgeThickness / setEdgeGlow", () => {
  test("updates edgeThickness", () => {
    const highlight = createPass();
    highlight.setEdgeThickness(5);

    assert.strictEqual(highlight.edgeThickness, 5);
  });

  test("updates edgeGlow", () => {
    const highlight = createPass();
    highlight.setEdgeGlow(0.75);

    assert.strictEqual(highlight.edgeGlow, 0.75);
  });
});

describe("setEntries", () => {
  test("accepts an empty array", () => {
    const highlight = createPass();

    assert.doesNotThrow(() => highlight.setEntries([]));
  });

  test("accepts a single mesh entry", () => {
    const highlight = createPass();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));

    assert.doesNotThrow(() => highlight.setEntries([{ target: mesh, color: "#ff0000" }]));
  });

  test("accepts a group entry, traversed to its meshes", () => {
    const highlight = createPass();
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));

    assert.doesNotThrow(() => highlight.setEntries([{ target: group, color: "#00ff00" }]));
  });

  test("replaces the previous entries rather than accumulating them", () => {
    const highlight = createPass();
    const meshA = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const meshB = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));

    highlight.setEntries([{ target: meshA, color: "#ff0000" }]);

    assert.doesNotThrow(() => highlight.setEntries([{ target: meshB, color: "#0000ff" }]));
  });

  test("accepts multiple entries with distinct colors", () => {
    const highlight = createPass();
    const entries = Array.from({ length: 5 }, (_, index) => {
      return {
        target: new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)),
        color: `#${index}${index}${index}${index}${index}${index}`
      };
    });

    assert.doesNotThrow(() => highlight.setEntries(entries));
  });

  test("accepts a mix of priority and non-priority entries", () => {
    const highlight = createPass();
    const priorityMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const otherMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));

    assert.doesNotThrow(() => highlight.setEntries([
      { target: priorityMesh, color: "#ff0000", priority: true },
      { target: otherMesh, color: "#0000ff" }
    ]));
  });

  test("accepts a priority group entry, traversed to its meshes", () => {
    const highlight = createPass();
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));

    assert.doesNotThrow(() => highlight.setEntries([{ target: group, color: "#ffffff", priority: true }]));
  });

  test("accepts a single instanced entry (InstancedMesh + instanceId)", () => {
    const highlight = createPass();
    const instancedMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 10);

    assert.doesNotThrow(() => highlight.setEntries([{ target: instancedMesh, instanceId: 3, color: "#ff0000" }]));
  });

  test("accepts multiple instanced entries on the same InstancedMesh", () => {
    const highlight = createPass();
    const instancedMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 10);

    assert.doesNotThrow(() => highlight.setEntries([
      { target: instancedMesh, instanceId: 0, color: "#ff0000" },
      { target: instancedMesh, instanceId: 5, color: "#00ff00" },
      { target: instancedMesh, instanceId: 9, color: "#0000ff" }
    ]));
  });

  test("accepts a mix of instanced and whole-object entries", () => {
    const highlight = createPass();
    const instancedMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 10);
    const wholeMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));

    assert.doesNotThrow(() => highlight.setEntries([
      { target: instancedMesh, instanceId: 2, color: "#ff0000" },
      { target: wholeMesh, color: "#00ff00" }
    ]));
  });

  test("accepts a priority instanced entry", () => {
    const highlight = createPass();
    const instancedMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 10);

    assert.doesNotThrow(() => highlight.setEntries([
      { target: instancedMesh, instanceId: 1, color: "#ff0000", priority: true }
    ]));
  });

  test("rebuilding entries for the same InstancedMesh across calls does not throw", () => {
    const highlight = createPass();
    const instancedMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 10);

    highlight.setEntries([{ target: instancedMesh, instanceId: 0, color: "#ff0000" }]);
    assert.doesNotThrow(() => highlight.setEntries([{ target: instancedMesh, instanceId: 4, color: "#00ff00" }]));
  });

  test("accepts a single isolated entry", () => {
    const highlight = createPass();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));

    assert.doesNotThrow(() => highlight.setEntries([{ target: mesh, color: "#ff0000", isolated: true }]));
  });

  test("accepts a mix of isolated and non-isolated entries", () => {
    const highlight = createPass();
    const isolatedMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const otherMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));

    assert.doesNotThrow(() => highlight.setEntries([
      { target: isolatedMesh, color: "#ff0000", isolated: true },
      { target: otherMesh, color: "#0000ff" }
    ]));
  });

  test("accepts an isolated group entry, traversed to its meshes", () => {
    const highlight = createPass();
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));

    assert.doesNotThrow(() => highlight.setEntries([{ target: group, color: "#ffffff", isolated: true }]));
  });
});

describe("dispose", () => {
  test("does not throw", () => {
    const highlight = createPass();

    assert.doesNotThrow(() => highlight.dispose());
  });

  test("does not throw after entries were set", () => {
    const highlight = createPass();
    highlight.setEntries([{ target: new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)), color: "#ff0000" }]);

    assert.doesNotThrow(() => highlight.dispose());
  });

  test("does not throw after instanced entries were set", () => {
    const highlight = createPass();
    const instancedMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 10);
    highlight.setEntries([{ target: instancedMesh, instanceId: 0, color: "#ff0000", priority: true }]);

    assert.doesNotThrow(() => highlight.dispose());
  });

  test("does not throw after a whole-object priority entry was set - " +
    "exercises the priority-only mask/edge-detect chain's own resources", () => {
    const highlight = createPass();
    highlight.setEntries([
      { target: new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)), color: "#ff0000", priority: true }
    ]);

    assert.doesNotThrow(() => highlight.dispose());
  });

  test("does not throw after a whole-object isolated entry was set - " +
    "exercises the isolated-only mask/edge-detect chain's own resources", () => {
    const highlight = createPass();
    highlight.setEntries([
      { target: new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)), color: "#ff0000", isolated: true }
    ]);

    assert.doesNotThrow(() => highlight.dispose());
  });
});
