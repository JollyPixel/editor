// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

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

  test("does not render a per-object overlay for a mesh registered with technique \"highlight\"", () => {
    const manager = new SelectionManager();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    manager.register("mesh-1", mesh, { technique: "highlight" });

    manager.select("mesh-1");

    assert.strictEqual(manager.selected, "mesh-1");
    assert.strictEqual(mesh.children.length, 0);
  });

  test("technique option sets the default overlay for meshes without a per-id override", () => {
    const manager = new SelectionManager({ technique: "highlight" });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    manager.register("mesh-1", mesh);

    manager.select("mesh-1");

    assert.strictEqual(mesh.children.length, 0);
  });

  test("a per-id technique overrides the manager's default technique", () => {
    const manager = new SelectionManager({ technique: "highlight" });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    manager.register("mesh-1", mesh, { technique: "outline" });

    manager.select("mesh-1");

    assert.ok(mesh.children[0] instanceof SelectionOutline);
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

describe("setColor/setHoverColor/setHoverOpacity", () => {
  test("setColor recolors the active selection overlay in place", () => {
    const { manager, mesh } = createManagerWithMeshAndGroup();
    manager.select("mesh-1");
    const overlayBefore = mesh.children[0] as SelectionOutline;

    manager.setColor("#ff0000");

    assert.strictEqual(mesh.children[0], overlayBefore, "must not rebuild the overlay");
    assert.strictEqual(`#${overlayBefore.material.color.getHexString()}`, "#ff0000");
    assert.strictEqual(manager.color, "#ff0000");
  });

  test("setHoverColor recolors the active hover overlay in place", () => {
    const { manager, mesh } = createManagerWithMeshAndGroup();
    manager.hover("mesh-1");
    const overlayBefore = mesh.children[0] as SelectionOutline;

    manager.setHoverColor("#00ff00");

    assert.strictEqual(mesh.children[0], overlayBefore);
    assert.strictEqual(`#${overlayBefore.material.color.getHexString()}`, "#00ff00");
    assert.strictEqual(manager.hoverColor, "#00ff00");
  });

  test("setHoverOpacity updates the active hover overlay's opacity", () => {
    const { manager, mesh } = createManagerWithMeshAndGroup();
    manager.hover("mesh-1");
    const overlayBefore = mesh.children[0] as SelectionOutline;

    manager.setHoverOpacity(0.6);

    assert.strictEqual(overlayBefore.material.opacity, 0.6);
    assert.strictEqual(manager.hoverOpacity, 0.6);
  });
});

describe("outline options", () => {
  test("outline option tunes the linewidth of an outline-styled overlay", () => {
    const { manager, mesh } = createManagerWithMeshAndGroup();
    const tunedManager = new SelectionManager({ outline: { linewidth: 3 } });
    tunedManager.register("mesh-1", mesh);
    tunedManager.select("mesh-1");

    const overlay = mesh.children[0] as SelectionOutline;
    assert.strictEqual(overlay.material.linewidth, 3);

    manager.dispose();
  });

  test("setOutlineOptions rebuilds the active overlay with the new tuning", () => {
    const { manager, mesh } = createManagerWithMeshAndGroup();
    manager.select("mesh-1");

    manager.setOutlineOptions({ linewidth: 5 });

    const overlay = mesh.children[0] as SelectionOutline;
    assert.strictEqual(overlay.material.linewidth, 5);
    assert.deepStrictEqual(manager.outlineOptions, { linewidth: 5 });
  });
});

describe("bounding box options", () => {
  test("boundingBox option tunes the fillOpacity of a group's SelectionBoundingBox", () => {
    const { manager, group } = createManagerWithMeshAndGroup();
    const tunedManager = new SelectionManager({ boundingBox: { fillOpacity: 0.3 } });
    tunedManager.register("group-1", group);
    tunedManager.select("group-1");

    const overlay = group.children.at(-1) as SelectionBoundingBox;
    assert.strictEqual((overlay.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>).material.opacity, 0.3);

    manager.dispose();
    tunedManager.dispose();
  });

  test("defaults to no fill mesh", () => {
    const { manager, group } = createManagerWithMeshAndGroup();
    manager.select("group-1");

    const overlay = group.children.at(-1) as SelectionBoundingBox;
    assert.strictEqual(overlay.children.length, 0);
  });

  test("setBoundingBoxOptions rebuilds the active overlay with the new tuning", () => {
    const { manager, group } = createManagerWithMeshAndGroup();
    manager.select("group-1");

    manager.setBoundingBoxOptions({ fillOpacity: 0.5 });

    const overlay = group.children.at(-1) as SelectionBoundingBox;
    assert.strictEqual(overlay.children.length, 1);
    assert.strictEqual((overlay.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>).material.opacity, 0.5);
    assert.deepStrictEqual(manager.boundingBoxOptions, { fillOpacity: 0.5 });
  });
});

describe("xray", () => {
  test("defaults to false and applies to a newly built outline overlay", () => {
    const { manager, mesh } = createManagerWithMeshAndGroup();
    manager.select("mesh-1");

    const overlay = mesh.children[0] as SelectionOutline;
    assert.strictEqual(manager.xray, false);
    assert.strictEqual(overlay.material.depthTest, true);
  });

  test("xray option applies to a newly built outline overlay", () => {
    const manager = new SelectionManager({ xray: true });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    manager.register("mesh-1", mesh);
    manager.select("mesh-1");

    const overlay = mesh.children[0] as SelectionOutline;
    assert.strictEqual(overlay.material.depthTest, false);
    assert.strictEqual(overlay.material.depthWrite, false);
  });

  test("xray option applies to a newly built group SelectionBoundingBox", () => {
    const manager = new SelectionManager({ xray: true });
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    manager.register("group-1", group);
    manager.select("group-1");

    const overlay = group.children.at(-1) as SelectionBoundingBox;
    assert.strictEqual(overlay.material.depthTest, false);
  });

  test("setXray toggles the active selection overlay in place, without rebuilding it", () => {
    const { manager, mesh } = createManagerWithMeshAndGroup();
    manager.select("mesh-1");
    const overlayBefore = mesh.children[0] as SelectionOutline;

    manager.setXray(true);

    assert.strictEqual(mesh.children[0], overlayBefore, "must not rebuild the overlay");
    assert.strictEqual(overlayBefore.material.depthTest, false);
    assert.strictEqual(overlayBefore.material.depthWrite, false);
    assert.strictEqual(manager.xray, true);
  });

  test("setXray also toggles the active hover overlay", () => {
    const { manager, mesh } = createManagerWithMeshAndGroup();
    manager.hover("mesh-1");
    const overlay = mesh.children[0] as SelectionOutline;

    manager.setXray(true);

    assert.strictEqual(overlay.material.depthTest, false);
  });
});

describe("setTechnique", () => {
  test("rebuilds the active selection overlay to reflect the new default", () => {
    const { manager, mesh } = createManagerWithMeshAndGroup();
    manager.select("mesh-1");

    manager.setTechnique("highlight");

    assert.strictEqual(manager.technique, "highlight");
    assert.strictEqual(mesh.children.length, 0, "highlight skips the per-object overlay entirely");
  });

  test("rebuilds the active hover overlay to reflect the new default", () => {
    const { manager, mesh } = createManagerWithMeshAndGroup();
    manager.hover("mesh-1");

    manager.setTechnique("highlight");

    assert.strictEqual(mesh.children.length, 0);
  });

  test("overrides an active mesh's per-id technique", () => {
    const manager = new SelectionManager();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    manager.register("mesh-1", mesh, { technique: "outline" });
    manager.select("mesh-1");

    manager.setTechnique("highlight");

    assert.strictEqual(mesh.children.length, 0);
  });

  test("drops the per-id technique so a later select also uses the new default", () => {
    const manager = new SelectionManager();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    manager.register("mesh-1", mesh, { technique: "outline" });

    manager.setTechnique("highlight");

    assert.strictEqual(manager.techniqueFor("mesh-1"), "highlight");
    manager.select("mesh-1");
    assert.strictEqual(mesh.children.length, 0);
  });

  test("does not affect a group's SelectionBoundingBox", () => {
    const { manager, group } = createManagerWithMeshAndGroup();
    manager.select("group-1");

    manager.setTechnique("highlight");

    assert.ok(group.children.at(-1) instanceof SelectionBoundingBox);
  });

  test("setting the same technique is a no-op", () => {
    const { manager, mesh } = createManagerWithMeshAndGroup();
    manager.select("mesh-1");
    const overlayBefore = mesh.children[0];

    manager.setTechnique("outline");

    assert.strictEqual(mesh.children[0], overlayBefore);
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

describe("techniqueFor", () => {
  test("defaults to \"outline\" for a mesh registered without a technique", () => {
    const { manager } = createManagerWithMeshAndGroup();

    assert.strictEqual(manager.techniqueFor("mesh-1"), "outline");
  });

  test("returns the per-id override given to register", () => {
    const manager = new SelectionManager();
    manager.register("mesh-1", new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)), { technique: "highlight" });

    assert.strictEqual(manager.techniqueFor("mesh-1"), "highlight");
  });

  test("falls back to the manager's technique default when no per-id override is set", () => {
    const manager = new SelectionManager({ technique: "highlight" });
    manager.register("mesh-1", new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));

    assert.strictEqual(manager.techniqueFor("mesh-1"), "highlight");
  });
});

describe("targetFor", () => {
  test("returns the object registered for id", () => {
    const { manager, mesh } = createManagerWithMeshAndGroup();

    assert.strictEqual(manager.targetFor("mesh-1"), mesh);
  });

  test("returns undefined for an unregistered id", () => {
    const { manager } = createManagerWithMeshAndGroup();

    assert.strictEqual(manager.targetFor("unknown"), undefined);
  });
});

describe("highlight technique", () => {
  test("select skips building a per-object overlay entirely", () => {
    const manager = new SelectionManager({ technique: "highlight" });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    manager.register("mesh-1", mesh);

    manager.select("mesh-1");

    assert.strictEqual(manager.selected, "mesh-1");
    assert.strictEqual(mesh.children.length, 0);
  });

  test("hover skips building a per-object overlay entirely", () => {
    const manager = new SelectionManager({ technique: "highlight" });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    manager.register("mesh-1", mesh);

    manager.hover("mesh-1");

    assert.strictEqual(manager.hovered, "mesh-1");
    assert.strictEqual(mesh.children.length, 0);
  });

  test("does not throw when nothing external is actually driving a HighlightPass", () => {
    const manager = new SelectionManager({ technique: "highlight" });
    manager.register("mesh-1", new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));

    assert.doesNotThrow(() => manager.select("mesh-1"));
  });

  test("a group still renders a SelectionBoundingBox, ignoring the technique", () => {
    const manager = new SelectionManager({ technique: "highlight" });
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    manager.register("group-1", group);

    manager.select("group-1");

    assert.ok(group.children.at(-1) instanceof SelectionBoundingBox);
  });

  test("unregister clears an active highlight selection without throwing", () => {
    const manager = new SelectionManager({ technique: "highlight" });
    manager.register("mesh-1", new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    manager.select("mesh-1");

    assert.doesNotThrow(() => manager.unregister("mesh-1"));
    assert.strictEqual(manager.selected, null);
  });

  test("switching setTechnique to highlight disposes the previous per-object overlay", () => {
    const manager = new SelectionManager();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    manager.register("mesh-1", mesh);
    manager.select("mesh-1");

    manager.setTechnique("highlight");

    assert.strictEqual(mesh.children.length, 0);
  });

  test("switching setTechnique away from highlight rebuilds a per-object overlay", () => {
    const manager = new SelectionManager({ technique: "highlight" });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    manager.register("mesh-1", mesh);
    manager.select("mesh-1");

    manager.setTechnique("outline");

    assert.ok(mesh.children[0] instanceof SelectionOutline);
  });
});

describe("highlightJfa technique", () => {
  test("select skips building a per-object overlay entirely", () => {
    const manager = new SelectionManager({ technique: "highlightJfa" });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    manager.register("mesh-1", mesh);

    manager.select("mesh-1");

    assert.strictEqual(manager.selected, "mesh-1");
    assert.strictEqual(mesh.children.length, 0);
  });

  test("hover skips building a per-object overlay entirely", () => {
    const manager = new SelectionManager({ technique: "highlightJfa" });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    manager.register("mesh-1", mesh);

    manager.hover("mesh-1");

    assert.strictEqual(manager.hovered, "mesh-1");
    assert.strictEqual(mesh.children.length, 0);
  });

  test("does not throw when nothing external is actually driving a HighlightPassJfa", () => {
    const manager = new SelectionManager({ technique: "highlightJfa" });
    manager.register("mesh-1", new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));

    assert.doesNotThrow(() => manager.select("mesh-1"));
  });

  test("a group still renders a SelectionBoundingBox, ignoring the technique", () => {
    const manager = new SelectionManager({ technique: "highlightJfa" });
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    manager.register("group-1", group);

    manager.select("group-1");

    assert.ok(group.children.at(-1) instanceof SelectionBoundingBox);
  });

  test("unregister clears an active highlightJfa selection without throwing", () => {
    const manager = new SelectionManager({ technique: "highlightJfa" });
    manager.register("mesh-1", new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    manager.select("mesh-1");

    assert.doesNotThrow(() => manager.unregister("mesh-1"));
    assert.strictEqual(manager.selected, null);
  });

  test("switching setTechnique to highlightJfa disposes the previous per-object overlay", () => {
    const manager = new SelectionManager();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    manager.register("mesh-1", mesh);
    manager.select("mesh-1");

    manager.setTechnique("highlightJfa");

    assert.strictEqual(mesh.children.length, 0);
  });

  test("switching setTechnique away from highlightJfa rebuilds a per-object overlay", () => {
    const manager = new SelectionManager({ technique: "highlightJfa" });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    manager.register("mesh-1", mesh);
    manager.select("mesh-1");

    manager.setTechnique("outline");

    assert.ok(mesh.children[0] instanceof SelectionOutline);
  });
});
