// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  GLASS_SURFACE,
  METAL_SURFACE,
  createMaterialHarness
} from "../materialHarness.ts";

describe("MaterialSurfaceController", () => {
  test("previews on every block of the material and writes one command on commit", () => {
    const harness = createMaterialHarness();
    const arm = harness.addBlock({ materialId: harness.glass });
    const leg = harness.addBlock({ materialId: harness.glass });
    const plain = harness.addBlock();
    harness.controller.select(harness.glass);
    harness.actions.length = 0;

    harness.surface.preview(METAL_SURFACE);

    assert.deepEqual(arm.surface, METAL_SURFACE);
    assert.deepEqual(leg.surface, METAL_SURFACE);
    assert.equal(plain.surface, null);
    assert.deepEqual(harness.document.tree.materials.material(harness.glass)?.surface, GLASS_SURFACE);
    assert.deepEqual(harness.actions, []);

    harness.surface.commit(METAL_SURFACE);

    assert.deepEqual(harness.document.tree.materials.material(harness.glass)?.surface, METAL_SURFACE);
    assert.deepEqual(harness.actions, ["material-changed"]);
  });

  test("keeps a field another person changes while this one previews", () => {
    const harness = createMaterialHarness();
    harness.controller.select(harness.glass);

    harness.surface.preview({ metalness: 0.8 });
    harness.document.changeMaterial(harness.glass, { roughness: 0.2 });

    assert.deepEqual(
      harness.surface.edited?.surface,
      { ...GLASS_SURFACE, roughness: 0.2, metalness: 0.8 }
    );

    harness.actions.length = 0;
    harness.surface.commit({ metalness: 0.8 });

    assert.deepEqual(
      harness.document.tree.materials.material(harness.glass)?.surface,
      { ...GLASS_SURFACE, roughness: 0.2, metalness: 0.8 }
    );
    assert.deepEqual(harness.actions, ["material-changed"]);
  });

  test("gathers previewed fields in this person's layer and ends it after writing them", () => {
    const harness = createMaterialHarness();
    harness.controller.select(harness.glass);
    const layerAtCommand: unknown[] = [];
    harness.document.on("change", () => {
      layerAtCommand.push(harness.previews.layer(harness.glass, null));
    });

    harness.surface.preview({ metalness: 0.5 });
    harness.surface.preview({ roughness: 0.2 });
    assert.deepEqual(
      harness.previews.layer(harness.glass, null),
      { metalness: 0.5, roughness: 0.2 }
    );

    harness.surface.commit({ roughness: 0.2 });

    assert.deepEqual(layerAtCommand, [{ metalness: 0.5, roughness: 0.2 }]);
    assert.equal(harness.previews.layer(harness.glass, null), undefined);
  });

  test("shows the fields peers drag under the ones this person previews", () => {
    const harness = createMaterialHarness();
    harness.controller.select(harness.glass);

    harness.previews.set(harness.glass, "bob", { roughness: 0.3, metalness: 0.1 });
    harness.surface.preview({ metalness: 0.9 });

    assert.deepEqual(
      harness.surface.edited?.surface,
      { ...GLASS_SURFACE, roughness: 0.3, metalness: 0.9 }
    );
  });

  test("writes nothing and shows the stored surface when the commit matches it", () => {
    const harness = createMaterialHarness();
    const block = harness.addBlock({ materialId: harness.glass });
    harness.controller.select(harness.glass);
    harness.actions.length = 0;

    harness.surface.preview(METAL_SURFACE);
    harness.surface.commit(GLASS_SURFACE);

    assert.deepEqual(block.surface, GLASS_SURFACE);
    assert.deepEqual(harness.actions, []);
  });

  test("puts the stored surface back when another row is picked mid-preview", () => {
    const harness = createMaterialHarness();
    const block = harness.addBlock({ materialId: harness.glass });
    const folder = harness.controller.createFolder()!;
    harness.controller.select(harness.glass);

    harness.surface.preview(METAL_SURFACE);
    harness.controller.select(folder);

    assert.deepEqual(block.surface, GLASS_SURFACE);
    assert.equal(harness.surface.edited, null);
  });

  test("counts the blocks using the edited material and outlines them on request", () => {
    const harness = createMaterialHarness();
    const arm = harness.addBlock({ materialId: harness.glass });
    const leg = harness.addBlock({ materialId: harness.glass });
    harness.addBlock();
    harness.controller.select(harness.glass);

    assert.equal(harness.surface.uses, 2);

    harness.surface.showUsers(true);
    assert.deepEqual(harness.selection.emphasized, [arm.uuid, leg.uuid]);

    harness.surface.showUsers(false);
    assert.deepEqual(harness.selection.emphasized, []);
  });

  test("stops outlining the users when another material is edited", () => {
    const harness = createMaterialHarness();
    harness.addBlock({ materialId: harness.glass });
    const metal = harness.document.addMaterial({ name: "Metal" })!;
    harness.controller.select(harness.glass);
    harness.surface.showUsers(true);

    harness.controller.select(metal);

    assert.deepEqual(harness.selection.emphasized, []);
    assert.equal(harness.surface.uses, 0);
  });

  test("follows whether the viewport shades with light", () => {
    const harness = createMaterialHarness();
    assert.equal(harness.surface.lit, true);

    harness.view.update({ shading: "flat" });

    assert.equal(harness.surface.lit, false);
  });

  test("names the peers editing the same material", () => {
    const harness = createMaterialHarness();
    harness.controller.select(harness.glass);
    const ada = { clientId: "ada", displayName: "Ada", color: "#ff0000" };

    harness.presence.materialEdits = new Map([[harness.glass, [ada]]]);

    assert.deepEqual(harness.surface.editors, [ada]);
  });

  test("stops editing a material deleted by any writer", () => {
    const harness = createMaterialHarness();
    harness.controller.select(harness.glass);

    harness.document.apply({ action: "material-removed", id: harness.glass });

    assert.equal(harness.surface.edited, null);
  });
});
