// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { ToonOutlinePass, SelectionManager } from "#src/index.ts";

/**
 * `ToonOutlinePass`'s constructor only reads `toneMapping`/`outputColorSpace`
 * off the renderer (see `RenderPipeline`'s own constructor) - a real
 * `WebGPURenderer` needs an async `init()` (a GPU context) neither available
 * nor needed for these tests, which never call `render()`.
 */
function createRendererStub(): THREE.WebGPURenderer {
  return {
    toneMapping: THREE.NoToneMapping,
    outputColorSpace: THREE.SRGBColorSpace
  } as unknown as THREE.WebGPURenderer;
}

function createPass(
  options?: ConstructorParameters<typeof ToonOutlinePass>[3]
): ToonOutlinePass {
  return new ToonOutlinePass(
    createRendererStub(),
    new THREE.Scene(),
    new THREE.PerspectiveCamera(),
    options
  );
}

describe("constructor", () => {
  test("defaults to white selected color, blue hover color", () => {
    const toonOutline = createPass();

    assert.strictEqual(`#${toonOutline.color.getHexString()}`, "#ffffff");
    assert.strictEqual(`#${toonOutline.hoverColor.getHexString()}`, "#8ab4f8");
  });

  test("defaults hover opacity to 0.35 and xray to false", () => {
    const toonOutline = createPass();

    assert.strictEqual(toonOutline.hoverOpacity, 0.35);
    assert.strictEqual(toonOutline.xray, false);
  });

  test("defaults hiddenColor to a dim gray and edgeThickness to 1", () => {
    const toonOutline = createPass();

    assert.strictEqual(`#${toonOutline.hiddenColor.getHexString()}`, "#404040");
    assert.strictEqual(toonOutline.edgeThickness, 1);
  });

  test("applies the given options", () => {
    const toonOutline = createPass({
      color: "#ff0000",
      hoverColor: "#00ff00",
      hiddenColor: "#0000ff",
      hoverOpacity: 0.5,
      edgeThickness: 3,
      xray: true
    });

    assert.strictEqual(`#${toonOutline.color.getHexString()}`, "#ff0000");
    assert.strictEqual(`#${toonOutline.hoverColor.getHexString()}`, "#00ff00");
    assert.strictEqual(`#${toonOutline.hiddenColor.getHexString()}`, "#0000ff");
    assert.strictEqual(toonOutline.hoverOpacity, 0.5);
    assert.strictEqual(toonOutline.edgeThickness, 3);
    assert.strictEqual(toonOutline.xray, true);
  });

  test("starts with no selected/hovered target", () => {
    const toonOutline = createPass();

    assert.strictEqual(toonOutline.selected, null);
    assert.strictEqual(toonOutline.hovered, null);
  });
});

describe("setColor / setHoverColor", () => {
  test("updates the selected color", () => {
    const toonOutline = createPass();
    toonOutline.setColor("#123456");

    assert.strictEqual(`#${toonOutline.color.getHexString()}`, "#123456");
  });

  test("updates the hover color", () => {
    const toonOutline = createPass();
    toonOutline.setHoverColor("#abcdef");

    assert.strictEqual(`#${toonOutline.hoverColor.getHexString()}`, "#abcdef");
  });
});

describe("setHiddenColor", () => {
  test("updates hiddenColor", () => {
    const toonOutline = createPass();
    toonOutline.setHiddenColor("#ff00ff");

    assert.strictEqual(`#${toonOutline.hiddenColor.getHexString()}`, "#ff00ff");
  });
});

describe("setHoverOpacity", () => {
  test("updates hoverOpacity", () => {
    const toonOutline = createPass();
    toonOutline.setHoverOpacity(0.75);

    assert.strictEqual(toonOutline.hoverOpacity, 0.75);
  });
});

describe("setEdgeThickness", () => {
  test("updates edgeThickness", () => {
    const toonOutline = createPass();
    toonOutline.setEdgeThickness(5);

    assert.strictEqual(toonOutline.edgeThickness, 5);
  });
});

describe("setXray", () => {
  test("toggles xray", () => {
    const toonOutline = createPass();
    toonOutline.setXray(true);

    assert.strictEqual(toonOutline.xray, true);
  });
});

describe("setSelected / setHovered", () => {
  test("setSelected outlines the given target", () => {
    const toonOutline = createPass();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    toonOutline.setSelected(mesh);

    assert.strictEqual(toonOutline.selected, mesh);
  });

  test("setSelected(null) clears the selected target", () => {
    const toonOutline = createPass();
    toonOutline.setSelected(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    toonOutline.setSelected(null);

    assert.strictEqual(toonOutline.selected, null);
  });

  test("setHovered outlines the given target", () => {
    const toonOutline = createPass();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    toonOutline.setHovered(mesh);

    assert.strictEqual(toonOutline.hovered, mesh);
  });

  test("setSelected accepts a single InstancedMesh instance", () => {
    const toonOutline = createPass();
    const instancedMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 5);
    const target = { mesh: instancedMesh, instanceId: 2 };
    toonOutline.setSelected(target);

    assert.deepStrictEqual(toonOutline.selected, target);
  });

  test("setSelected(null) clears a previously selected instance", () => {
    const toonOutline = createPass();
    const instancedMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 5);
    toonOutline.setSelected({ mesh: instancedMesh, instanceId: 0 });
    toonOutline.setSelected(null);

    assert.strictEqual(toonOutline.selected, null);
  });

  test("setHovered accepts a single InstancedMesh instance", () => {
    const toonOutline = createPass();
    const instancedMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 5);
    const target = { mesh: instancedMesh, instanceId: 1 };
    toonOutline.setHovered(target);

    assert.deepStrictEqual(toonOutline.hovered, target);
  });

  test("a whole-object setSelected replaces a previous instanced one", () => {
    const toonOutline = createPass();
    const instancedMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 5);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    toonOutline.setSelected({ mesh: instancedMesh, instanceId: 0 });
    toonOutline.setSelected(mesh);

    assert.strictEqual(toonOutline.selected, mesh);
  });
});

describe("setSelectedMany", () => {
  test("outlines every given target, selected reading back the first", () => {
    const toonOutline = createPass();
    const meshA = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const meshB = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    toonOutline.setSelectedMany([meshA, meshB]);

    assert.strictEqual(toonOutline.selected, meshA);
  });

  test("an empty array clears the selected target", () => {
    const toonOutline = createPass();
    toonOutline.setSelected(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    toonOutline.setSelectedMany([]);

    assert.strictEqual(toonOutline.selected, null);
  });

  test("replaces a previous setSelected target", () => {
    const toonOutline = createPass();
    const single = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const many = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    toonOutline.setSelected(single);
    toonOutline.setSelectedMany([many]);

    assert.strictEqual(toonOutline.selected, many);
  });

  test("accepts a mix of whole-object and instanced targets", () => {
    const toonOutline = createPass();
    const instancedMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 5);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const instanceTarget = { mesh: instancedMesh, instanceId: 3 };
    toonOutline.setSelectedMany([mesh, instanceTarget]);

    // Whole-object targets are read back first, same as `selectedObjects`
    // taking priority over `selectedInstances` in `selected`'s own getter.
    assert.strictEqual(toonOutline.selected, mesh);
  });

  test("selected reads back the instanced target when only instanced targets were given", () => {
    const toonOutline = createPass();
    const instancedMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 5);
    const instanceTarget = { mesh: instancedMesh, instanceId: 4 };
    toonOutline.setSelectedMany([instanceTarget]);

    assert.deepStrictEqual(toonOutline.selected, instanceTarget);
  });
});

describe("sync", () => {
  function createManagerWithMesh(): {
    manager: SelectionManager;
    mesh: THREE.Mesh;
  } {
    const manager = new SelectionManager();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    manager.register("mesh-1", mesh);

    return { manager, mesh };
  }

  test("mirrors an already-selected id at sync time", () => {
    const { manager, mesh } = createManagerWithMesh();
    manager.select("mesh-1");

    const toonOutline = createPass();
    toonOutline.sync(manager);

    assert.strictEqual(toonOutline.selected, mesh);
  });

  test("mirrors a later selectionChange", () => {
    const { manager, mesh } = createManagerWithMesh();
    const toonOutline = createPass();
    toonOutline.sync(manager);

    manager.select("mesh-1");

    assert.strictEqual(toonOutline.selected, mesh);
  });

  test("mirrors a later hoverChange", () => {
    const { manager, mesh } = createManagerWithMesh();
    const toonOutline = createPass();
    toonOutline.sync(manager);

    manager.hover("mesh-1");

    assert.strictEqual(toonOutline.hovered, mesh);
  });

  test("suppresses the hover outline while it matches the current selection", () => {
    const { manager } = createManagerWithMesh();
    const toonOutline = createPass();
    toonOutline.sync(manager);

    manager.select("mesh-1");
    manager.hover("mesh-1");

    assert.strictEqual(toonOutline.hovered, null);
  });

  test("clears the selected outline once the manager deselects", () => {
    const { manager } = createManagerWithMesh();
    const toonOutline = createPass();
    toonOutline.sync(manager);

    manager.select("mesh-1");
    manager.select(null);

    assert.strictEqual(toonOutline.selected, null);
  });

  test("replaces a previous sync target", () => {
    const { manager: managerA, mesh: meshA } = createManagerWithMesh();
    const { manager: managerB, mesh: meshB } = createManagerWithMesh();
    const toonOutline = createPass();

    toonOutline.sync(managerA);
    toonOutline.sync(managerB);
    managerA.select("mesh-1");
    managerB.select("mesh-1");

    assert.strictEqual(toonOutline.selected, meshB);
    assert.notStrictEqual(toonOutline.selected, meshA);
  });
});

describe("unsync", () => {
  test("stops mirroring further selectionChange/hoverChange events", () => {
    const manager = new SelectionManager();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    manager.register("mesh-1", mesh);

    const toonOutline = createPass();
    toonOutline.sync(manager);
    toonOutline.unsync();
    manager.select("mesh-1");

    assert.strictEqual(toonOutline.selected, null);
  });

  test("is a no-op when not synced", () => {
    const toonOutline = createPass();

    assert.doesNotThrow(() => toonOutline.unsync());
  });
});

describe("dispose", () => {
  test("does not throw, even when synced", () => {
    const manager = new SelectionManager();
    const toonOutline = createPass();
    toonOutline.sync(manager);

    assert.doesNotThrow(() => toonOutline.dispose());
  });

  test("unsyncs, so the manager no longer holds a reference to it", () => {
    const manager = new SelectionManager();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    manager.register("mesh-1", mesh);

    const toonOutline = createPass();
    toonOutline.sync(manager);
    toonOutline.dispose();

    assert.doesNotThrow(() => manager.select("mesh-1"));
  });
});
