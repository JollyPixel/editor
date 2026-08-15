// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { SelectionManager, SelectionOutline, SelectionHighlight, SelectionBoundingBox, ToonOutlinePass } from "#src/index.ts";

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

/**
 * `ToonOutlinePass`'s constructor only reads `toneMapping`/`outputColorSpace`
 * off the renderer (see `RenderPipeline`'s own constructor) - a real
 * `WebGPURenderer` needs an async `init()` (a GPU context) neither available
 * nor needed for these tests, which never call `render()`.
 */
function createToonOutline(): ToonOutlinePass {
  const renderer = {
    toneMapping: THREE.NoToneMapping,
    outputColorSpace: THREE.SRGBColorSpace
  } as unknown as THREE.WebGPURenderer;

  return new ToonOutlinePass(renderer, new THREE.Scene(), new THREE.PerspectiveCamera());
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

  test("renders a SelectionHighlight for a mesh registered with style \"highlight\"", () => {
    const manager = new SelectionManager();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    manager.register("mesh-1", mesh, { style: "highlight" });

    manager.select("mesh-1");

    assert.ok(mesh.children[0] instanceof SelectionHighlight);
  });

  test("meshStyle option sets the default overlay for meshes without a per-id override", () => {
    const manager = new SelectionManager({ meshStyle: "highlight" });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    manager.register("mesh-1", mesh);

    manager.select("mesh-1");

    assert.ok(mesh.children[0] instanceof SelectionHighlight);
  });

  test("a per-id style overrides the manager's default meshStyle", () => {
    const manager = new SelectionManager({ meshStyle: "highlight" });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    manager.register("mesh-1", mesh, { style: "outline" });

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

describe("outline/highlight options", () => {
  test("outline option tunes the linewidth of an outline-styled overlay", () => {
    const { manager, mesh } = createManagerWithMeshAndGroup();
    const tunedManager = new SelectionManager({ outline: { linewidth: 3 } });
    tunedManager.register("mesh-1", mesh);
    tunedManager.select("mesh-1");

    const overlay = mesh.children[0] as SelectionOutline;
    assert.strictEqual(overlay.material.linewidth, 3);

    manager.dispose();
  });

  test("highlight option tunes the thickness of a highlight-styled overlay", () => {
    const manager = new SelectionManager({ meshStyle: "highlight", highlight: { thickness: 0.1 } });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    manager.register("mesh-1", mesh);
    manager.select("mesh-1");

    const overlay = mesh.children[0] as SelectionHighlight;
    const targetPosition = mesh.geometry.getAttribute("position");
    const hullPosition = overlay.geometry.getAttribute("position");
    const delta = new THREE.Vector3().fromBufferAttribute(hullPosition, 0)
      .sub(new THREE.Vector3().fromBufferAttribute(targetPosition, 0)).length();

    mesh.geometry.computeBoundingSphere();
    const expectedBias = mesh.geometry.boundingSphere!.radius * 0.1;
    assert.ok(Math.abs(delta - expectedBias) < 1e-6);
  });

  test("setOutlineOptions rebuilds the active overlay with the new tuning", () => {
    const { manager, mesh } = createManagerWithMeshAndGroup();
    manager.select("mesh-1");

    manager.setOutlineOptions({ linewidth: 5 });

    const overlay = mesh.children[0] as SelectionOutline;
    assert.strictEqual(overlay.material.linewidth, 5);
    assert.deepStrictEqual(manager.outlineOptions, { linewidth: 5 });
  });

  test("setHighlightOptions rebuilds the active overlay with the new tuning", () => {
    const manager = new SelectionManager({ meshStyle: "highlight" });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    manager.register("mesh-1", mesh);
    manager.select("mesh-1");

    manager.setHighlightOptions({ thickness: 0.1 });

    assert.deepStrictEqual(manager.highlightOptions, { thickness: 0.1 });
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

describe("setMeshStyle", () => {
  test("rebuilds the active selection overlay to reflect the new default", () => {
    const { manager, mesh } = createManagerWithMeshAndGroup();
    manager.select("mesh-1");

    manager.setMeshStyle("highlight");

    assert.strictEqual(manager.meshStyle, "highlight");
    assert.strictEqual(mesh.children.length, 1);
    assert.ok(mesh.children[0] instanceof SelectionHighlight);
  });

  test("rebuilds the active hover overlay to reflect the new default", () => {
    const { manager, mesh } = createManagerWithMeshAndGroup();
    manager.hover("mesh-1");

    manager.setMeshStyle("highlight");

    assert.strictEqual(mesh.children.length, 1);
    assert.ok(mesh.children[0] instanceof SelectionHighlight);
  });

  test("overrides an active mesh's per-id style", () => {
    const manager = new SelectionManager();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    manager.register("mesh-1", mesh, { style: "outline" });
    manager.select("mesh-1");

    manager.setMeshStyle("highlight");

    assert.ok(mesh.children[0] instanceof SelectionHighlight);
  });

  test("drops the per-id style so a later select also uses the new default", () => {
    const manager = new SelectionManager();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    manager.register("mesh-1", mesh, { style: "outline" });

    manager.setMeshStyle("highlight");

    assert.strictEqual(manager.styleFor("mesh-1"), "highlight");
    manager.select("mesh-1");
    assert.ok(mesh.children[0] instanceof SelectionHighlight);
  });

  test("does not affect a group's SelectionBoundingBox", () => {
    const { manager, group } = createManagerWithMeshAndGroup();
    manager.select("group-1");

    manager.setMeshStyle("highlight");

    assert.ok(group.children.at(-1) instanceof SelectionBoundingBox);
  });

  test("setting the same style is a no-op", () => {
    const { manager, mesh } = createManagerWithMeshAndGroup();
    manager.select("mesh-1");
    const overlayBefore = mesh.children[0];

    manager.setMeshStyle("outline");

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

describe("styleFor", () => {
  test("defaults to \"outline\" for a mesh registered without a style", () => {
    const { manager } = createManagerWithMeshAndGroup();

    assert.strictEqual(manager.styleFor("mesh-1"), "outline");
  });

  test("returns the per-id override given to register", () => {
    const manager = new SelectionManager();
    manager.register("mesh-1", new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)), { style: "highlight" });

    assert.strictEqual(manager.styleFor("mesh-1"), "highlight");
  });

  test("falls back to the manager's meshStyle default when no per-id override is set", () => {
    const manager = new SelectionManager({ meshStyle: "highlight" });
    manager.register("mesh-1", new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));

    assert.strictEqual(manager.styleFor("mesh-1"), "highlight");
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

describe("toonOutline", () => {
  test("select pushes the target into toonOutline instead of building a per-object overlay", () => {
    const toonOutline = createToonOutline();
    const manager = new SelectionManager({ meshStyle: "toonOutline", toonOutline });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    manager.register("mesh-1", mesh);

    manager.select("mesh-1");

    assert.strictEqual(toonOutline.selected, mesh);
    assert.strictEqual(mesh.children.length, 0, "must not add a per-object overlay child");
  });

  test("select(null) clears toonOutline's selected target", () => {
    const toonOutline = createToonOutline();
    const manager = new SelectionManager({ meshStyle: "toonOutline", toonOutline });
    manager.register("mesh-1", new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    manager.select("mesh-1");

    manager.select(null);

    assert.strictEqual(toonOutline.selected, null);
  });

  test("hover pushes the target into toonOutline", () => {
    const toonOutline = createToonOutline();
    const manager = new SelectionManager({ meshStyle: "toonOutline", toonOutline });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    manager.register("mesh-1", mesh);

    manager.hover("mesh-1");

    assert.strictEqual(toonOutline.hovered, mesh);
  });

  test("suppresses toonOutline's hover target once that id becomes the selection", () => {
    const toonOutline = createToonOutline();
    const manager = new SelectionManager({ meshStyle: "toonOutline", toonOutline });
    manager.register("mesh-1", new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    manager.hover("mesh-1");

    manager.select("mesh-1");

    assert.strictEqual(toonOutline.hovered, null);
  });

  test("a per-id toonOutline style is respected even when meshStyle is outline", () => {
    const toonOutline = createToonOutline();
    const manager = new SelectionManager({ toonOutline });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    manager.register("mesh-1", mesh, { style: "toonOutline" });

    manager.select("mesh-1");

    assert.strictEqual(toonOutline.selected, mesh);
    assert.strictEqual(mesh.children.length, 0);
  });

  test("a group registered with toonOutline style still renders a SelectionBoundingBox, not pushed into toonOutline", () => {
    const toonOutline = createToonOutline();
    const manager = new SelectionManager({ meshStyle: "toonOutline", toonOutline });
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    manager.register("group-1", group);

    manager.select("group-1");

    assert.strictEqual(toonOutline.selected, null);
    assert.ok(group.children.at(-1) instanceof SelectionBoundingBox);
  });

  test("unregister clears an active toonOutline selection", () => {
    const toonOutline = createToonOutline();
    const manager = new SelectionManager({ meshStyle: "toonOutline", toonOutline });
    manager.register("mesh-1", new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    manager.select("mesh-1");

    manager.unregister("mesh-1");

    assert.strictEqual(toonOutline.selected, null);
  });

  test("dispose clears both toonOutline slots", () => {
    const toonOutline = createToonOutline();
    const manager = new SelectionManager({ toonOutline });
    manager.register("mesh-1", new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)), { style: "toonOutline" });
    manager.register("mesh-2", new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)), { style: "toonOutline" });
    manager.select("mesh-1");
    manager.hover("mesh-2");

    manager.dispose();

    assert.strictEqual(toonOutline.selected, null);
    assert.strictEqual(toonOutline.hovered, null);
  });

  test("switching setMeshStyle to toonOutline disposes the previous per-object overlay", () => {
    const toonOutline = createToonOutline();
    const manager = new SelectionManager({ toonOutline });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    manager.register("mesh-1", mesh);
    manager.select("mesh-1");

    manager.setMeshStyle("toonOutline");

    assert.strictEqual(mesh.children.length, 0);
    assert.strictEqual(toonOutline.selected, mesh);
  });

  test("switching setMeshStyle away from toonOutline clears it and rebuilds a per-object overlay", () => {
    const toonOutline = createToonOutline();
    const manager = new SelectionManager({ meshStyle: "toonOutline", toonOutline });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    manager.register("mesh-1", mesh);
    manager.select("mesh-1");

    manager.setMeshStyle("outline");

    assert.strictEqual(toonOutline.selected, null);
    assert.ok(mesh.children[0] instanceof SelectionOutline);
  });

  test("resolving to toonOutline without a configured pipeline throws", () => {
    const manager = new SelectionManager({ meshStyle: "toonOutline" });
    manager.register("mesh-1", new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));

    assert.throws(() => manager.select("mesh-1"));
  });

  test("constructor pushes color/hoverColor/hoverOpacity/xray into toonOutline immediately", () => {
    const toonOutline = createToonOutline();
    new SelectionManager({
      toonOutline,
      color: "#ff0000",
      hoverColor: "#00ff00",
      hoverOpacity: 0.6,
      xray: true
    });

    assert.strictEqual(`#${toonOutline.color.getHexString()}`, "#ff0000");
    assert.strictEqual(`#${toonOutline.hoverColor.getHexString()}`, "#00ff00");
    assert.strictEqual(toonOutline.hoverOpacity, 0.6);
    assert.strictEqual(toonOutline.xray, true);
  });

  test("constructor pushes toonOutlineOptions into toonOutline immediately", () => {
    const toonOutline = createToonOutline();
    new SelectionManager({
      toonOutline,
      toonOutlineOptions: { edgeThickness: 3, hiddenColor: "#123456" }
    });

    assert.strictEqual(toonOutline.edgeThickness, 3);
    assert.strictEqual(`#${toonOutline.hiddenColor.getHexString()}`, "#123456");
  });

  test("setColor/setHoverColor/setHoverOpacity/setXray propagate to toonOutline regardless of the active style", () => {
    const toonOutline = createToonOutline();
    const manager = new SelectionManager({ toonOutline });

    manager.setColor("#ff0000");
    manager.setHoverColor("#00ff00");
    manager.setHoverOpacity(0.7);
    manager.setXray(true);

    assert.strictEqual(`#${toonOutline.color.getHexString()}`, "#ff0000");
    assert.strictEqual(`#${toonOutline.hoverColor.getHexString()}`, "#00ff00");
    assert.strictEqual(toonOutline.hoverOpacity, 0.7);
    assert.strictEqual(toonOutline.xray, true);
  });

  test("setToonOutlineOptions applies edgeThickness/hiddenColor to toonOutline", () => {
    const toonOutline = createToonOutline();
    const manager = new SelectionManager({ toonOutline });

    manager.setToonOutlineOptions({ edgeThickness: 4, hiddenColor: "#abcdef" });

    assert.strictEqual(toonOutline.edgeThickness, 4);
    assert.strictEqual(`#${toonOutline.hiddenColor.getHexString()}`, "#abcdef");
    assert.deepStrictEqual(manager.toonOutlineOptions, { edgeThickness: 4, hiddenColor: "#abcdef" });
  });

  test("setToonOutlineOptions is a no-op when no pipeline was configured", () => {
    const manager = new SelectionManager();

    assert.doesNotThrow(() => manager.setToonOutlineOptions({ edgeThickness: 4 }));
  });
});
