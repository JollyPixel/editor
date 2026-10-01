// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  MeshHighlightState,
  HighlightOutline,
  HighlightBoundingBox,
  type HighlightTechnique,
  type MeshHighlightAppearanceOptions
} from "#src/index.ts";
import {
  createDefaultHighlightOverlayRegistry
} from "#src/mesh-highlight/overlays/builtinHighlightOverlayFactories.ts";
import {
  createBoxMesh,
  createStateWithMeshAndGroup
} from "./helpers.ts";

// CONSTANTS
const kScenePipelineTechniques: HighlightTechnique[] = ["highlight", "highlightJfa"];

interface ConfigureCase {
  name: string;
  activate: (state: MeshHighlightState) => void;
  options: MeshHighlightAppearanceOptions;
  read: (overlay: HighlightOutline) => unknown;
  expected: unknown;
}

const kConfigureCases: ConfigureCase[] = [
  {
    name: "selection color",
    activate: (state) => state.select("mesh-1"),
    options: { selected: { color: "#ff0000" } },
    read: (overlay) => `#${overlay.color.getHexString()}`,
    expected: "#ff0000"
  },
  {
    name: "hover color",
    activate: (state) => state.hover("mesh-1"),
    options: { hovered: { color: "#00ff00" } },
    read: (overlay) => `#${overlay.color.getHexString()}`,
    expected: "#00ff00"
  },
  {
    name: "hover opacity",
    activate: (state) => state.hover("mesh-1"),
    options: { hovered: { opacity: 0.6 } },
    read: (overlay) => overlay.opacity,
    expected: 0.6
  },
  {
    name: "hover x-ray",
    activate: (state) => state.hover("mesh-1"),
    options: { xray: true },
    read: (overlay) => overlay.xray,
    expected: true
  }
];

describe("configure", () => {
  for (const { name, activate, options, read, expected } of kConfigureCases) {
    test(`rebuilds the active overlay with the new ${name}`, () => {
      const { state, mesh } = createStateWithMeshAndGroup();
      activate(state);
      const overlayBefore = mesh.children[0];

      state.configure(options);

      const overlayAfter = mesh.children[0];
      assert.ok(overlayAfter instanceof HighlightOutline);
      assert.notStrictEqual(overlayAfter, overlayBefore);
      assert.strictEqual(read(overlayAfter), expected);
    });
  }

  test("rebuilds the active overlay with new outline tuning", () => {
    const { state, mesh } = createStateWithMeshAndGroup();
    state.select("mesh-1");

    state.configure({ outline: { linewidth: 5 } });

    const overlay = mesh.children[0] as HighlightOutline;
    assert.strictEqual(overlay.material.linewidth, 5);
    assert.strictEqual(state.appearance.outline.linewidth, 5);
  });

  test("rebuilds the active overlay with new bounds tuning", () => {
    const { state, group } = createStateWithMeshAndGroup();
    state.select("group-1");

    state.configure({ bounds: { fillOpacity: 0.5 } });

    const overlay = group.children.at(-1) as HighlightBoundingBox;
    assert.strictEqual(overlay.fillOpacity, 0.5);
    assert.strictEqual(state.appearance.bounds.fillOpacity, 0.5);
  });

  test("rebuilds the active selection overlay with x-ray enabled", () => {
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
});

describe("technique", () => {
  test("preserves an active mesh's per-id technique", () => {
    const state = new MeshHighlightState();
    const mesh = createBoxMesh();
    state.register("mesh-1", mesh, { technique: "outline" });
    state.select("mesh-1");

    state.technique = "highlight";

    assert.ok(mesh.children[0] instanceof HighlightOutline);
  });

  test("preserves a per-id technique for a later selection", () => {
    const state = new MeshHighlightState();
    const mesh = createBoxMesh();
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

describe("scene pipeline techniques", () => {
  for (const technique of kScenePipelineTechniques) {
    test(`select skips building a per-object overlay with "${technique}"`, () => {
      const state = new MeshHighlightState({ technique });
      const mesh = createBoxMesh();
      state.register("mesh-1", mesh);

      state.select("mesh-1");

      assert.strictEqual(state.selected, "mesh-1");
      assert.strictEqual(mesh.children.length, 0);
    });

    test(`hover skips building a per-object overlay with "${technique}"`, () => {
      const state = new MeshHighlightState({ technique });
      const mesh = createBoxMesh();
      state.register("mesh-1", mesh);

      state.hover("mesh-1");

      assert.strictEqual(state.hovered, "mesh-1");
      assert.strictEqual(mesh.children.length, 0);
    });

    test(`unregister clears an active "${technique}" selection`, () => {
      const state = new MeshHighlightState({ technique });
      state.register("mesh-1", createBoxMesh());
      state.select("mesh-1");

      state.unregister("mesh-1");

      assert.strictEqual(state.selected, null);
    });

    test(`switching technique to "${technique}" disposes the active per-object overlay`, () => {
      const { state, mesh } = createStateWithMeshAndGroup();
      state.select("mesh-1");

      state.technique = technique;

      assert.strictEqual(state.technique, technique);
      assert.strictEqual(mesh.children.length, 0);
    });

    test(`switching technique away from "${technique}" rebuilds a per-object overlay`, () => {
      const state = new MeshHighlightState({ technique });
      const mesh = createBoxMesh();
      state.register("mesh-1", mesh);
      state.select("mesh-1");

      state.technique = "outline";

      assert.ok(mesh.children[0] instanceof HighlightOutline);
    });
  }
});

describe("overlayRegistry", () => {
  test("defaults to a registry holding the built-in techniques", () => {
    const state = new MeshHighlightState();
    const mesh = createBoxMesh();
    const { overlayRegistry } = state;

    assert.strictEqual(overlayRegistry.resolve("outline", mesh).id, "outline");
    assert.strictEqual(overlayRegistry.resolve("boxSilhouette", mesh).id, "boxSilhouette");
    assert.strictEqual(overlayRegistry.resolve("boundingBox", mesh).id, "boundingBox");
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
    const mesh = createBoxMesh();
    state.register("mesh-1", mesh);
    state.select("mesh-1");
    state.select(null);

    assert.deepStrictEqual(disposed, ["custom"]);
    assert.strictEqual(mesh.children.length, 0);
  });
});
