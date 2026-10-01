// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  MeshHighlightState,
  HighlightOutline,
  HighlightBoundingBox
} from "#src/index.ts";
import {
  createBoxMesh,
  createStateWithMeshAndGroup
} from "./helpers.ts";

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
    const mesh = createBoxMesh();
    state.register("mesh-1", mesh, { technique: "highlight" });

    state.select("mesh-1");

    assert.strictEqual(state.selected, "mesh-1");
    assert.strictEqual(mesh.children.length, 0);
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

  test("hover(null) clears the current hover", () => {
    const { state, mesh } = createStateWithMeshAndGroup();
    state.hover("mesh-1");
    state.hover(null);

    assert.strictEqual(state.hovered, null);
    assert.strictEqual(mesh.children.length, 0);
  });
});

describe("emphasize", () => {
  test("outlines every emphasized id like a hover, and clears with an empty list", () => {
    const { state, mesh, group } = createStateWithMeshAndGroup();
    const changes: string[][] = [];
    state.addEventListener("emphasisChange", (event) => {
      changes.push([...event.detail.objectIds]);
    });

    state.emphasize(["mesh-1", "group-1"]);

    assert.deepStrictEqual([...state.emphasized], ["mesh-1", "group-1"]);
    assert.ok((mesh.children[0] as HighlightOutline).material.opacity < 1);
    assert.ok(group.children.at(-1) instanceof HighlightBoundingBox);

    state.emphasize([]);

    assert.strictEqual(state.emphasized.size, 0);
    assert.strictEqual(mesh.children.length, 0);
    assert.strictEqual(group.children.length, 1);
    assert.deepStrictEqual(changes, [["mesh-1", "group-1"], ["mesh-1", "group-1"]]);
  });

  test("leaves the selected id to its own overlay and gives it back once deselected", () => {
    const { state, mesh } = createStateWithMeshAndGroup();
    state.emphasize(["mesh-1"]);
    state.select("mesh-1");

    assert.strictEqual(mesh.children.length, 1);
    assert.strictEqual((mesh.children[0] as HighlightOutline).material.opacity, 1);

    state.select(null);

    assert.strictEqual(mesh.children.length, 1);
    assert.ok((mesh.children[0] as HighlightOutline).material.opacity < 1);
  });

  test("throws for an unknown id without changing the group, and ignores a repeat", () => {
    const { state } = createStateWithMeshAndGroup();
    let changes = 0;
    state.addEventListener("emphasisChange", () => changes++);
    state.emphasize(["mesh-1"]);

    assert.throws(() => state.emphasize(["mesh-1", "missing"]));
    state.emphasize(["mesh-1"]);

    assert.deepStrictEqual([...state.emphasized], ["mesh-1"]);
    assert.strictEqual(changes, 1);
  });

  test("keeps the group's overlays while another id is hovered or selected", () => {
    const { state, mesh } = createStateWithMeshAndGroup();
    state.emphasize(["mesh-1"]);
    const outline = mesh.children[0];

    state.hover("group-1");
    state.select("group-1");
    state.hover(null);

    assert.strictEqual(mesh.children.length, 1);
    assert.strictEqual(mesh.children[0], outline);
  });

  test("drops an unregistered id from the group", () => {
    const { state, group } = createStateWithMeshAndGroup();
    state.emphasize(["mesh-1", "group-1"]);

    state.unregister("mesh-1");

    assert.deepStrictEqual([...state.emphasized], ["group-1"]);
    assert.strictEqual(group.children.length, 2);
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
    assert.strictEqual(state.targetFor("mesh-1"), undefined);
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
    state.register("mesh-1", createBoxMesh(), { technique: "highlight" });

    assert.strictEqual(state.techniqueFor("mesh-1"), "highlight");
  });

  test("falls back to the state's technique default when no per-id override is set", () => {
    const state = new MeshHighlightState({ technique: "highlight" });
    state.register("mesh-1", createBoxMesh());

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

describe("register", () => {
  test("replaces the overlay target when an active id is re-registered", () => {
    const { state, mesh } = createStateWithMeshAndGroup();
    const replacement = createBoxMesh();
    state.select("mesh-1");

    state.register("mesh-1", replacement);

    assert.strictEqual(mesh.children.length, 0);
    assert.ok(replacement.children[0] instanceof HighlightOutline);
    assert.strictEqual(state.targetFor("mesh-1"), replacement);
  });
});
