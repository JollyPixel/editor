// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { MeshHighlightState, HighlightOutline, HighlightBoundingBox } from "#src/index.ts";
import {
  createDefaultHighlightOverlayRegistry
} from "#src/mesh-highlight/overlays/builtinHighlightOverlayFactories.ts";

function createStateWithMeshAndGroup(): {
  state: MeshHighlightState;
  mesh: THREE.Mesh;
  group: THREE.Group;
} {
  const state = new MeshHighlightState();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));

  state.register("mesh-1", mesh);
  state.register("group-1", group);

  return { state, mesh, group };
}

describe("select", () => {
  test("renders a HighlightOutline for a registered mesh", () => {
    const { state, mesh } = createStateWithMeshAndGroup();
    state.select("mesh-1");

    assert.strictEqual(state.selected, "mesh-1");
    assert.strictEqual(mesh.children.length, 1);
    assert.ok(mesh.children[0] instanceof HighlightOutline);
  });

  test("renders a HighlightBoundingBox for a registered group", () => {
    const { state, group } = createStateWithMeshAndGroup();
    state.select("group-1");

    assert.strictEqual(state.selected, "group-1");
    assert.ok(group.children.at(-1) instanceof HighlightBoundingBox);
  });

  test("disposes the previous overlay when selection changes", () => {
    const { state, mesh, group } = createStateWithMeshAndGroup();
    state.select("mesh-1");
    state.select("group-1");

    assert.strictEqual(mesh.children.length, 0);
    assert.strictEqual(group.children.length, 2);
  });

  test("select(null) clears the current selection", () => {
    const { state, mesh } = createStateWithMeshAndGroup();
    state.select("mesh-1");
    state.select(null);

    assert.strictEqual(state.selected, null);
    assert.strictEqual(mesh.children.length, 0);
  });

  test("re-selecting the same id is a no-op", () => {
    const { state } = createStateWithMeshAndGroup();
    state.select("mesh-1");

    let changeCount = 0;
    state.addEventListener("selectionChange", () => {
      changeCount += 1;
    });
    state.select("mesh-1");

    assert.strictEqual(changeCount, 0);
  });

  test("throws for an unregistered id", () => {
    const { state } = createStateWithMeshAndGroup();

    assert.throws(() => state.select("unknown"));
  });

  test("an unregistered id leaves the current selection untouched", () => {
    const { state, mesh } = createStateWithMeshAndGroup();
    state.select("mesh-1");
    const overlay = mesh.children[0];

    assert.throws(() => state.select("unknown"));

    assert.strictEqual(state.selected, "mesh-1");
    assert.strictEqual(mesh.children[0], overlay);
  });

  test("moving selection restores a hover hidden under the old selection", () => {
    const { state, mesh } = createStateWithMeshAndGroup();
    state.hover("mesh-1");
    state.select("mesh-1");
    assert.strictEqual(mesh.children.length, 1);
    assert.strictEqual(
      (mesh.children[0] as HighlightOutline).material.opacity,
      state.appearance.selected.opacity
    );

    state.select("group-1");

    assert.ok(mesh.children[0] instanceof HighlightOutline);
    assert.strictEqual(
      (mesh.children[0] as HighlightOutline).material.opacity,
      state.appearance.hovered.opacity
    );
  });

  test("does not render a per-object overlay for a mesh registered with technique \"highlight\"", () => {
    const state = new MeshHighlightState();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    state.register("mesh-1", mesh, { technique: "highlight" });

    state.select("mesh-1");

    assert.strictEqual(state.selected, "mesh-1");
    assert.strictEqual(mesh.children.length, 0);
  });

  test("technique option sets the default overlay for meshes without a per-id override", () => {
    const state = new MeshHighlightState({ technique: "highlight" });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    state.register("mesh-1", mesh);

    state.select("mesh-1");

    assert.strictEqual(mesh.children.length, 0);
  });

  test("a per-id technique overrides the state's default technique", () => {
    const state = new MeshHighlightState({ technique: "highlight" });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    state.register("mesh-1", mesh, { technique: "outline" });

    state.select("mesh-1");

    assert.ok(mesh.children[0] instanceof HighlightOutline);
  });

  test("dispatches selectionChange", () => {
    const { state } = createStateWithMeshAndGroup();

    let dispatched = false;
    state.addEventListener("selectionChange", () => {
      dispatched = true;
    });
    state.select("mesh-1");

    assert.ok(dispatched);
  });
});

describe("appearance", () => {
  test("configure rebuilds the active selection overlay with the new color", () => {
    const { state, mesh } = createStateWithMeshAndGroup();
    state.select("mesh-1");
    const overlayBefore = mesh.children[0] as HighlightOutline;

    state.configure({ selected: { color: "#ff0000" } });

    const overlayAfter = mesh.children[0] as HighlightOutline;
    assert.notStrictEqual(overlayAfter, overlayBefore);
    assert.strictEqual(`#${overlayAfter.material.color.getHexString()}`, "#ff0000");
    assert.strictEqual(state.appearance.selected.color, "#ff0000");
  });

  test("configure changes the active hover color", () => {
    const { state, mesh } = createStateWithMeshAndGroup();
    state.hover("mesh-1");
    const overlayBefore = mesh.children[0] as HighlightOutline;

    state.configure({ hovered: { color: "#00ff00" } });

    const overlayAfter = mesh.children[0] as HighlightOutline;
    assert.notStrictEqual(overlayAfter, overlayBefore);
    assert.strictEqual(`#${overlayAfter.material.color.getHexString()}`, "#00ff00");
    assert.strictEqual(state.appearance.hovered.color, "#00ff00");
  });

  test("configure changes the active hover opacity", () => {
    const { state, mesh } = createStateWithMeshAndGroup();
    state.hover("mesh-1");
    const overlayBefore = mesh.children[0] as HighlightOutline;

    state.configure({ hovered: { opacity: 0.6 } });

    const overlayAfter = mesh.children[0] as HighlightOutline;
    assert.notStrictEqual(overlayAfter, overlayBefore);
    assert.strictEqual(overlayAfter.material.opacity, 0.6);
    assert.strictEqual(state.appearance.hovered.opacity, 0.6);
  });
});

describe("outline options", () => {
  test("outline option tunes the linewidth of an outline-styled overlay", () => {
    const { state, mesh } = createStateWithMeshAndGroup();
    const tunedManager = new MeshHighlightState({
      appearance: { outline: { linewidth: 3 } }
    });
    tunedManager.register("mesh-1", mesh);
    tunedManager.select("mesh-1");

    const overlay = mesh.children[0] as HighlightOutline;
    assert.strictEqual(overlay.material.linewidth, 3);

    state.dispose();
  });

  test("configure rebuilds the active overlay with new outline tuning", () => {
    const { state, mesh } = createStateWithMeshAndGroup();
    state.select("mesh-1");

    state.configure({ outline: { linewidth: 5 } });

    const overlay = mesh.children[0] as HighlightOutline;
    assert.strictEqual(overlay.material.linewidth, 5);
    assert.strictEqual(state.appearance.outline.linewidth, 5);
  });
});

describe("bounding box options", () => {
  test("boundingBox option tunes the fillOpacity of a group's HighlightBoundingBox", () => {
    const { state, group } = createStateWithMeshAndGroup();
    const tunedManager = new MeshHighlightState({
      appearance: { bounds: { fillOpacity: 0.3 } }
    });
    tunedManager.register("group-1", group);
    tunedManager.select("group-1");

    const overlay = group.children.at(-1) as HighlightBoundingBox;
    assert.strictEqual(
      (overlay.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>).material.opacity,
      0.3
    );

    state.dispose();
    tunedManager.dispose();
  });

  test("defaults to no fill mesh", () => {
    const { state, group } = createStateWithMeshAndGroup();
    state.select("group-1");

    const overlay = group.children.at(-1) as HighlightBoundingBox;
    assert.strictEqual(overlay.children.length, 0);
  });

  test("configure rebuilds the active overlay with new bounds tuning", () => {
    const { state, group } = createStateWithMeshAndGroup();
    state.select("group-1");

    state.configure({ bounds: { fillOpacity: 0.5 } });

    const overlay = group.children.at(-1) as HighlightBoundingBox;
    assert.strictEqual(overlay.children.length, 1);
    assert.strictEqual(
      (overlay.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>).material.opacity,
      0.5
    );
    assert.strictEqual(state.appearance.bounds.fillOpacity, 0.5);
  });
});

describe("xray", () => {
  test("defaults to false and applies to a newly built outline overlay", () => {
    const { state, mesh } = createStateWithMeshAndGroup();
    state.select("mesh-1");

    const overlay = mesh.children[0] as HighlightOutline;
    assert.strictEqual(state.appearance.xray, false);
    assert.strictEqual(overlay.material.depthTest, true);
  });

  test("xray option applies to a newly built outline overlay", () => {
    const state = new MeshHighlightState({ appearance: { xray: true } });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    state.register("mesh-1", mesh);
    state.select("mesh-1");

    const overlay = mesh.children[0] as HighlightOutline;
    assert.strictEqual(overlay.material.depthTest, false);
    assert.strictEqual(overlay.material.depthWrite, false);
  });

  test("xray option applies to a newly built group HighlightBoundingBox", () => {
    const state = new MeshHighlightState({ appearance: { xray: true } });
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    state.register("group-1", group);
    state.select("group-1");

    const overlay = group.children.at(-1) as HighlightBoundingBox;
    assert.strictEqual(overlay.material.depthTest, false);
  });

  test("configure rebuilds the active selection overlay with x-ray enabled", () => {
    const { state, mesh } = createStateWithMeshAndGroup();
    state.select("mesh-1");
    const overlayBefore = mesh.children[0] as HighlightOutline;

    state.configure({ xray: true });

    const overlayAfter = mesh.children[0] as HighlightOutline;
    assert.notStrictEqual(overlayAfter, overlayBefore);
    assert.strictEqual(overlayAfter.material.depthTest, false);
    assert.strictEqual(overlayAfter.material.depthWrite, false);
    assert.strictEqual(state.appearance.xray, true);
  });

  test("configure also applies x-ray to the active hover overlay", () => {
    const { state, mesh } = createStateWithMeshAndGroup();
    state.hover("mesh-1");

    state.configure({ xray: true });

    assert.strictEqual((mesh.children[0] as HighlightOutline).material.depthTest, false);
  });
});

describe("technique", () => {
  test("rebuilds the active selection overlay to reflect the new default", () => {
    const { state, mesh } = createStateWithMeshAndGroup();
    state.select("mesh-1");

    state.technique = "highlight";

    assert.strictEqual(state.technique, "highlight");
    assert.strictEqual(mesh.children.length, 0, "highlight skips the per-object overlay entirely");
  });

  test("rebuilds the active hover overlay to reflect the new default", () => {
    const { state, mesh } = createStateWithMeshAndGroup();
    state.hover("mesh-1");

    state.technique = "highlight";

    assert.strictEqual(mesh.children.length, 0);
  });

  test("preserves an active mesh's per-id technique", () => {
    const state = new MeshHighlightState();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    state.register("mesh-1", mesh, { technique: "outline" });
    state.select("mesh-1");

    state.technique = "highlight";

    assert.ok(mesh.children[0] instanceof HighlightOutline);
  });

  test("preserves a per-id technique for a later selection", () => {
    const state = new MeshHighlightState();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    state.register("mesh-1", mesh, { technique: "outline" });

    state.technique = "highlight";

    assert.strictEqual(state.techniqueFor("mesh-1"), "outline");
    state.select("mesh-1");
    assert.ok(mesh.children[0] instanceof HighlightOutline);
  });

  test("does not affect a group's HighlightBoundingBox", () => {
    const { state, group } = createStateWithMeshAndGroup();
    state.select("group-1");

    state.technique = "highlight";

    assert.ok(group.children.at(-1) instanceof HighlightBoundingBox);
  });

  test("setting the same technique is a no-op", () => {
    const { state, mesh } = createStateWithMeshAndGroup();
    state.select("mesh-1");
    const overlayBefore = mesh.children[0];

    state.technique = "outline";

    assert.strictEqual(mesh.children[0], overlayBefore);
  });
});

describe("hover", () => {
  test("renders a dimmer overlay for a hovered id", () => {
    const { state, mesh } = createStateWithMeshAndGroup();
    state.hover("mesh-1");

    assert.strictEqual(state.hovered, "mesh-1");
    const overlay = mesh.children[0] as HighlightOutline;
    assert.ok(overlay instanceof HighlightOutline);
    assert.ok(overlay.material.opacity < 1);
  });

  test("does not render a hover overlay for the already-selected id", () => {
    const { state, mesh } = createStateWithMeshAndGroup();
    state.select("mesh-1");
    state.hover("mesh-1");

    assert.strictEqual(mesh.children.length, 1);
  });

  test("drops the hover overlay once that id becomes the selection", () => {
    const { state, mesh } = createStateWithMeshAndGroup();
    state.hover("mesh-1");
    state.select("mesh-1");

    const overlay = mesh.children[0] as HighlightOutline;
    assert.strictEqual(mesh.children.length, 1);
    assert.strictEqual(overlay.material.opacity, 1);
  });

  test("hover(null) clears the current hover", () => {
    const { state, mesh } = createStateWithMeshAndGroup();
    state.hover("mesh-1");
    state.hover(null);

    assert.strictEqual(state.hovered, null);
    assert.strictEqual(mesh.children.length, 0);
  });
});

describe("unregister", () => {
  test("clears an active selection and forgets the id", () => {
    const { state, mesh } = createStateWithMeshAndGroup();
    state.select("mesh-1");
    state.unregister("mesh-1");

    assert.strictEqual(state.selected, null);
    assert.strictEqual(mesh.children.length, 0);
    assert.throws(() => state.select("mesh-1"));
  });
});

describe("dispose", () => {
  test("clears selection, hover and the registry", () => {
    const { state, mesh, group } = createStateWithMeshAndGroup();
    state.select("mesh-1");
    state.hover("group-1");
    state.dispose();

    assert.strictEqual(state.selected, null);
    assert.strictEqual(state.hovered, null);
    assert.strictEqual(mesh.children.length, 0);
    assert.strictEqual(group.children.length, 1);
  });
});

describe("techniqueFor", () => {
  test("defaults to \"outline\" for a mesh registered without a technique", () => {
    const { state } = createStateWithMeshAndGroup();

    assert.strictEqual(state.techniqueFor("mesh-1"), "outline");
  });

  test("returns the per-id override given to register", () => {
    const state = new MeshHighlightState();
    state.register("mesh-1", new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)), { technique: "highlight" });

    assert.strictEqual(state.techniqueFor("mesh-1"), "highlight");
  });

  test("falls back to the state's technique default when no per-id override is set", () => {
    const state = new MeshHighlightState({ technique: "highlight" });
    state.register("mesh-1", new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));

    assert.strictEqual(state.techniqueFor("mesh-1"), "highlight");
  });
});

describe("targetFor", () => {
  test("returns the object registered for id", () => {
    const { state, mesh } = createStateWithMeshAndGroup();

    assert.strictEqual(state.targetFor("mesh-1"), mesh);
  });

  test("returns undefined for an unregistered id", () => {
    const { state } = createStateWithMeshAndGroup();

    assert.strictEqual(state.targetFor("unknown"), undefined);
  });
});

describe("highlight technique", () => {
  test("select skips building a per-object overlay entirely", () => {
    const state = new MeshHighlightState({ technique: "highlight" });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    state.register("mesh-1", mesh);

    state.select("mesh-1");

    assert.strictEqual(state.selected, "mesh-1");
    assert.strictEqual(mesh.children.length, 0);
  });

  test("hover skips building a per-object overlay entirely", () => {
    const state = new MeshHighlightState({ technique: "highlight" });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    state.register("mesh-1", mesh);

    state.hover("mesh-1");

    assert.strictEqual(state.hovered, "mesh-1");
    assert.strictEqual(mesh.children.length, 0);
  });

  test("does not throw when nothing external is actually driving a HighlightPass", () => {
    const state = new MeshHighlightState({ technique: "highlight" });
    state.register("mesh-1", new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));

    assert.doesNotThrow(() => state.select("mesh-1"));
  });

  test("a group still renders a HighlightBoundingBox, ignoring the technique", () => {
    const state = new MeshHighlightState({ technique: "highlight" });
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    state.register("group-1", group);

    state.select("group-1");

    assert.ok(group.children.at(-1) instanceof HighlightBoundingBox);
  });

  test("unregister clears an active highlight selection without throwing", () => {
    const state = new MeshHighlightState({ technique: "highlight" });
    state.register("mesh-1", new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    state.select("mesh-1");

    assert.doesNotThrow(() => state.unregister("mesh-1"));
    assert.strictEqual(state.selected, null);
  });

  test("switching technique to highlight disposes the previous per-object overlay", () => {
    const state = new MeshHighlightState();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    state.register("mesh-1", mesh);
    state.select("mesh-1");

    state.technique = "highlight";

    assert.strictEqual(mesh.children.length, 0);
  });

  test("switching technique away from highlight rebuilds a per-object overlay", () => {
    const state = new MeshHighlightState({ technique: "highlight" });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    state.register("mesh-1", mesh);
    state.select("mesh-1");

    state.technique = "outline";

    assert.ok(mesh.children[0] instanceof HighlightOutline);
  });
});

describe("highlightJfa technique", () => {
  test("select skips building a per-object overlay entirely", () => {
    const state = new MeshHighlightState({ technique: "highlightJfa" });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    state.register("mesh-1", mesh);

    state.select("mesh-1");

    assert.strictEqual(state.selected, "mesh-1");
    assert.strictEqual(mesh.children.length, 0);
  });

  test("hover skips building a per-object overlay entirely", () => {
    const state = new MeshHighlightState({ technique: "highlightJfa" });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    state.register("mesh-1", mesh);

    state.hover("mesh-1");

    assert.strictEqual(state.hovered, "mesh-1");
    assert.strictEqual(mesh.children.length, 0);
  });

  test("does not throw when nothing external is actually driving a HighlightPassJfa", () => {
    const state = new MeshHighlightState({ technique: "highlightJfa" });
    state.register("mesh-1", new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));

    assert.doesNotThrow(() => state.select("mesh-1"));
  });

  test("a group still renders a HighlightBoundingBox, ignoring the technique", () => {
    const state = new MeshHighlightState({ technique: "highlightJfa" });
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    state.register("group-1", group);

    state.select("group-1");

    assert.ok(group.children.at(-1) instanceof HighlightBoundingBox);
  });

  test("unregister clears an active highlightJfa selection without throwing", () => {
    const state = new MeshHighlightState({ technique: "highlightJfa" });
    state.register("mesh-1", new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    state.select("mesh-1");

    assert.doesNotThrow(() => state.unregister("mesh-1"));
    assert.strictEqual(state.selected, null);
  });

  test("switching technique to highlightJfa disposes the previous per-object overlay", () => {
    const state = new MeshHighlightState();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    state.register("mesh-1", mesh);
    state.select("mesh-1");

    state.technique = "highlightJfa";

    assert.strictEqual(mesh.children.length, 0);
  });

  test("switching technique away from highlightJfa rebuilds a per-object overlay", () => {
    const state = new MeshHighlightState({ technique: "highlightJfa" });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    state.register("mesh-1", mesh);
    state.select("mesh-1");

    state.technique = "outline";

    assert.ok(mesh.children[0] instanceof HighlightOutline);
  });
});

describe("overlayRegistry", () => {
  test("defaults to a registry holding the built-in techniques", () => {
    const state = new MeshHighlightState();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));

    assert.strictEqual(state.overlayRegistry.resolve("outline", mesh).id, "outline");
    assert.strictEqual(state.overlayRegistry.resolve("boundingBox", mesh).id, "boundingBox");
  });

  test("each state owns its own default registry", () => {
    const first = new MeshHighlightState();
    const second = new MeshHighlightState();

    assert.notStrictEqual(first.overlayRegistry, second.overlayRegistry);
  });

  test("a custom registry resolves a technique the built-ins do not know", () => {
    const overlayRegistry = createDefaultHighlightOverlayRegistry();
    const disposed: string[] = [];
    overlayRegistry.register({
      id: "custom",
      supports: () => true,
      create: () => {
        return {
          color: "#ffffff",
          opacity: 1,
          xray: false,
          dispose: () => disposed.push("custom")
        };
      }
    });

    const state = new MeshHighlightState({ technique: "custom", overlayRegistry });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    state.register("mesh-1", mesh);
    state.select("mesh-1");
    state.select(null);

    assert.deepStrictEqual(disposed, ["custom"]);
    assert.strictEqual(mesh.children.length, 0);
  });

  test("a custom registry is not shared with another state", () => {
    const overlayRegistry = createDefaultHighlightOverlayRegistry();
    overlayRegistry.register({
      id: "custom",
      supports: () => true,
      create: () => {
        return {
          color: "#ffffff",
          opacity: 1,
          xray: false,
          dispose: () => void 0
        };
      }
    });
    new MeshHighlightState({ overlayRegistry });

    const other = new MeshHighlightState({ technique: "custom" });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    other.register("mesh-1", mesh);
    other.select("mesh-1");

    assert.ok(mesh.children[0] instanceof HighlightOutline);
  });
});

describe("register", () => {
  test("replaces the overlay target when an active id is re-registered", () => {
    const { state, mesh } = createStateWithMeshAndGroup();
    const replacement = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    state.select("mesh-1");

    state.register("mesh-1", replacement);

    assert.strictEqual(mesh.children.length, 0);
    assert.ok(replacement.children[0] instanceof HighlightOutline);
    assert.strictEqual(state.targetFor("mesh-1"), replacement);
  });
});
