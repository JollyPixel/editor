// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  GLASS_SURFACE,
  createMaterialHarness as createHarness,
  dropMaterials as drop,
  listMaterialNames as namesOf,
  preset,
  type MaterialHarness
} from "../materialHarness.ts";

describe("MaterialLibraryController", () => {
  test("shows each material's use count on its row", () => {
    const harness = createHarness();
    harness.addBlock({ materialId: harness.glass });
    harness.addBlock({ materialId: harness.glass });
    const metal = harness.document.addMaterial({ name: "Metal" })!;

    assert.deepEqual(
      harness.controller.state.nodes.map(({ id, detail }) => [id, detail]),
      [[harness.glass, "2"], [metal, "0"]]
    );
  });

  test("hands a created or duplicated material to a selected block without one", () => {
    const harness = createHarness();
    const bare = harness.addBlock();
    const other = harness.addBlock();
    harness.selection.select(bare.uuid);

    harness.controller.create(preset("glass"));
    const created = harness.controller.state.editedId!;

    assert.notEqual(created, harness.glass);
    assert.equal(harness.document.tree.materials.get(created)?.name, "Glass");
    assert.equal(harness.document.tree.block(bare.uuid)?.materialId, created);

    harness.selection.select(other.uuid);
    harness.controller.duplicate(harness.glass);
    const copy = harness.controller.state.editedId!;

    assert.deepEqual(namesOf(harness), ["Glass", "Glass Copy", "Glass"]);
    assert.equal(harness.document.tree.block(other.uuid)?.materialId, copy);

    const dressed = harness.addBlock({ materialId: harness.glass });
    harness.selection.select(dressed.uuid);
    harness.controller.create(preset("metal"));

    assert.equal(harness.document.tree.block(dressed.uuid)?.materialId, harness.glass);
  });

  test("stops selecting a material deleted by any writer", () => {
    const harness = createHarness();
    const block = harness.addBlock({ materialId: harness.glass });
    harness.controller.select(harness.glass);

    harness.document.apply({ action: "material-removed", id: harness.glass });

    assert.equal(harness.controller.state.selectedId, null);
    assert.equal(harness.materialFocus.edited, null);
    assert.equal(block.surface, null);
  });

  test("rebuilds the state on every change it shows, and keeps it across previews", () => {
    const harness = createHarness();
    const block = harness.addBlock({ name: "Arm" });
    harness.controller.select(harness.glass);

    const before = harness.controller.state;
    harness.surface.preview({ metalness: 0.5 });
    assert.strictEqual(harness.controller.state, before);

    harness.document.assignMaterial(block.uuid, harness.glass);
    assert.equal(harness.controller.state.nodes[0].detail, "1");

    harness.document.apply({ action: "material-renamed", id: harness.glass, name: "Window" });
    assert.equal(harness.controller.state.nodes[0].label, "Window");
  });

  test("pastes a new copy of a material into another model each time", () => {
    const source = createHarness();
    const target = createHarness();
    target.document.renameMaterial(target.glass, "Window");
    const text = source.controller.copy(source.glass)!;

    assert.equal(target.controller.paste(text), true);
    const first = target.controller.state.editedId!;
    assert.equal(target.controller.paste(text), true);
    assert.equal(target.controller.paste("Glass"), false);

    const second = target.controller.state.editedId!;
    assert.notEqual(first, source.glass);
    assert.notEqual(second, first);
    assert.deepEqual(namesOf(target), ["Window", "Glass", "Glass"]);
    assert.deepEqual(target.document.tree.materials.material(second)?.surface, GLASS_SURFACE);
  });
});

describe("MaterialLibraryController selected block", () => {
  test("shows the selected block's material in the library and keeps it for a block without one", () => {
    const harness = createHarness();
    const arm = harness.addBlock({ name: "Arm", materialId: harness.glass });
    const leg = harness.addBlock({ name: "Leg" });

    harness.selection.select(arm.uuid);
    assert.equal(harness.controller.state.editedId, harness.glass);
    assert.deepEqual(harness.controller.state.block, {
      name: "Arm",
      materialId: harness.glass
    });

    harness.selection.select(leg.uuid);
    assert.deepEqual(harness.controller.state.block, {
      name: "Leg",
      materialId: null
    });
    assert.equal(harness.controller.state.editedId, harness.glass);

    harness.selection.select(null);
    assert.equal(harness.controller.state.block, null);
  });

  test("follows a material given to the selected block by any writer", () => {
    const harness = createHarness();
    const metal = harness.document.addMaterial({ name: "Metal" })!;
    const block = harness.addBlock();
    harness.selection.select(block.uuid);

    harness.document.assignMaterial(block.uuid, metal);

    assert.equal(harness.controller.state.editedId, metal);
  });

  test("assigns and clears the selected block's material", () => {
    const harness = createHarness();
    const block = harness.addBlock();
    harness.selection.select(block.uuid);
    harness.actions.length = 0;

    harness.controller.assign(harness.glass);
    assert.deepEqual(block.surface, GLASS_SURFACE);

    harness.controller.assign(harness.glass);
    harness.controller.assign(null);
    assert.equal(block.surface, null);
    assert.deepEqual(harness.actions, ["node-material-changed", "node-material-changed"]);
  });

  test("keeps an open preview when the selected block's material is already shown", () => {
    const harness = createHarness();
    const block = harness.addBlock({ materialId: harness.glass });
    harness.controller.select(harness.glass);
    harness.surface.preview({ metalness: 0.5 });

    harness.selection.select(block.uuid);

    assert.deepEqual(harness.previews.layer(harness.glass, null), { metalness: 0.5 });
  });
});

describe("MaterialLibraryController delete", () => {
  test("asks before deleting a material blocks use and deletes an unused one at once", async() => {
    const cancel = createHarness();
    cancel.addBlock({ materialId: cancel.glass });
    cancel.addBlock({ materialId: cancel.glass });
    const unused = cancel.document.addMaterial({ name: "Wood" })!;

    await cancel.controller.remove(cancel.glass);
    await cancel.controller.remove(unused);

    assert.deepEqual(namesOf(cancel), ["Glass"]);
    assert.deepEqual(cancel.calls.deletes, [{
      heading: "Delete Material",
      hasChildren: false,
      message: "Glass is used by 2 blocks. They will have no material."
    }]);

    const confirm = createHarness({ deleteAnswer: { deleteChildren: false } });
    const block = confirm.addBlock({ materialId: confirm.glass });

    await confirm.controller.remove(confirm.glass);

    assert.deepEqual(namesOf(confirm), []);
    assert.equal(block.surface, null);
  });
});

describe("MaterialLibraryController peers", () => {
  test("shares the edited material and shows peers on the rows they edit", () => {
    const harness = createHarness();

    harness.controller.select(harness.glass);
    assert.equal(harness.materialFocus.edited, harness.glass);

    harness.controller.select(null);
    assert.equal(harness.materialFocus.edited, null);

    harness.presence.materialEdits = new Map([
      [harness.glass, [{ clientId: "b", color: "#ff0000", displayName: "Bea" }]]
    ]);

    assert.deepEqual(harness.controller.state.nodes[0].badges, [
      { color: "#ff0000", title: "Bea" }
    ]);
  });
});

describe("MaterialLibraryController without material rights", () => {
  test("sends no material command and keeps only Copy in the menus until rights return", async() => {
    const harness = createHarness();
    const block = harness.addBlock();
    harness.selection.select(block.uuid);
    harness.access.grant("hierarchy");
    harness.actions.length = 0;

    harness.controller.create(preset("metal"));
    harness.controller.duplicate(harness.glass);
    harness.controller.rename(harness.glass, "Frosted");
    harness.controller.assign(harness.glass);
    await harness.controller.remove(harness.glass);
    assert.equal(harness.controller.paste(harness.controller.copy(harness.glass)!), false);
    drop(harness, [harness.glass], harness.glass, "below");
    harness.surface.commit(GLASS_SURFACE);

    assert.deepEqual(harness.actions, []);
    assert.equal(harness.controller.editable, false);
    assert.deepEqual(enabledLabels(harness, null), []);
    assert.deepEqual(enabledLabels(harness, harness.glass), ["Copy"]);

    harness.access.grant("materials");
    harness.controller.assign(harness.glass);

    assert.deepEqual(harness.actions, ["node-material-changed"]);
    assert.deepEqual(enabledLabels(harness, null), ["New Material…", "Paste"]);
  });
});

function enabledLabels(
  harness: MaterialHarness,
  id: string | null
): string[] {
  return harness.controller.openMenu(id).items.flatMap((entry) => (
    entry === "separator" || entry.disabled === true ? [] : [entry.label]
  ));
}
