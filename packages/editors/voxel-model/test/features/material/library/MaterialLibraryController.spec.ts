// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { ContextMenuEntry } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  GLASS_SURFACE,
  createMaterialHarness as createHarness,
  preset,
  type MaterialHarness
} from "../materialHarness.ts";

// CONSTANTS
const kMenuPoint = {
  x: 12,
  y: 34
};

function namesOf(
  harness: MaterialHarness
): string[] {
  return [...harness.document.tree.materials.values()].map(({ name }) => name);
}

async function choose(
  harness: MaterialHarness,
  id: string | null,
  action: string
): Promise<void> {
  await harness.controller.menuFor(id).run(action, kMenuPoint);
}

function drop(
  harness: MaterialHarness,
  movedIds: string[],
  targetId: string
): void {
  harness.controller.handleReparent(new CustomEvent("jolly-reparent", {
    detail: {
      movedIds,
      targetId,
      where: "inside"
    }
  }));
}

function labelsOf(
  entries: readonly ContextMenuEntry[]
): string[] {
  return entries.map((entry) => (entry === "separator" ? "-" : entry.label));
}

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
      materialId: harness.glass,
      materialName: "Glass"
    });

    harness.selection.select(leg.uuid);
    assert.deepEqual(harness.controller.state.block, {
      name: "Leg",
      materialId: null,
      materialName: null
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

describe("MaterialLibraryController folders", () => {
  test("nests rows under their folder and opens the folders above a selected material", () => {
    const harness = createHarness();
    const metals = harness.document.addMaterialFolder({ name: "Metals" })!;
    const steel = harness.document.addMaterial({ name: "Steel", parentId: metals })!;
    harness.controller.handleToggleExpand(new CustomEvent("jolly-toggle-expand", {
      detail: {
        id: metals,
        expanded: false
      }
    }));
    const bolt = harness.addBlock({ materialId: steel });

    harness.selection.select(bolt.uuid);

    const [, folder] = harness.controller.state.nodes;
    assert.equal(folder.icon, "folder");
    assert.deepEqual(folder.children?.map(({ id }) => id), [steel]);
    assert.deepEqual(harness.controller.state.expanded, [metals]);
    assert.equal(harness.controller.state.editedId, steel);
  });

  test("writes nothing for a drop the tree refuses", () => {
    const harness = createHarness();
    const metals = harness.controller.createFolder()!;
    drop(harness, [harness.glass], metals);
    harness.actions.length = 0;

    drop(harness, [metals], harness.glass);

    assert.deepEqual(harness.actions, []);
  });

  test("moves a dropped material inside a folder and refuses drops inside a material", () => {
    const harness = createHarness();
    const metals = harness.controller.createFolder()!;

    drop(harness, [harness.glass], metals);

    assert.equal(harness.document.tree.materials.get(harness.glass)?.parentId, metals);
    assert.equal(
      harness.controller.acceptDrop({ movedIds: [metals], targetId: harness.glass, where: "inside" }),
      false
    );
    assert.equal(
      harness.controller.acceptDrop({ movedIds: [harness.glass], targetId: metals, where: "above" }),
      true
    );
  });

  test("deletes a folder with its materials, or moves them up in its place", async() => {
    const keep = createHarness({ deleteAnswer: { deleteChildren: false } });
    const keptFolder = keep.document.addMaterialFolder({ name: "Metals" })!;
    keep.document.addMaterial({ name: "Steel", parentId: keptFolder });
    keep.document.addMaterial({ name: "Gold", parentId: keptFolder });
    keep.document.addMaterial({ name: "Wood" });
    keep.actions.length = 0;

    await keep.controller.remove(keptFolder);

    assert.deepEqual(namesOf(keep), ["Glass", "Steel", "Gold", "Wood"]);
    assert.deepEqual(keep.actions, ["material-removed"]);
    assert.deepEqual(keep.calls.deletes, [{
      heading: "Delete Folder",
      hasChildren: true,
      childrenLabel: "Delete its materials too"
    }]);

    const drop = createHarness({ deleteAnswer: { deleteChildren: true } });
    const droppedFolder = drop.document.addMaterialFolder({ name: "Metals" })!;
    const steel = drop.document.addMaterial({ name: "Steel", parentId: droppedFolder })!;
    const bolt = drop.addBlock({ materialId: steel });

    await drop.controller.remove(droppedFolder);

    assert.deepEqual(namesOf(drop), ["Glass"]);
    assert.equal(bolt.surface, null);
  });

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

  test("keeps a folder when its delete is cancelled and deletes an empty one at once", async() => {
    const harness = createHarness();
    const full = harness.document.addMaterialFolder({ name: "Full" })!;
    harness.document.addMaterial({ name: "Steel", parentId: full });
    const empty = harness.document.addMaterialFolder({ name: "Empty" })!;

    await harness.controller.remove(full);
    await harness.controller.remove(empty);

    assert.deepEqual(namesOf(harness), ["Glass", "Full", "Steel"]);
    assert.equal(harness.calls.deletes.length, 1);
  });
});

describe("MaterialLibraryController.menuFor", () => {
  test("lists the actions of the tree, a folder and a material", () => {
    const harness = createHarness();
    const folder = harness.controller.createFolder()!;

    assert.deepEqual(labelsOf(harness.controller.menuFor(null).items), [
      "New Material…",
      "New Folder",
      "-",
      "Paste"
    ]);
    assert.deepEqual(labelsOf(harness.controller.menuFor(folder).items), [
      "New Material…",
      "New Folder",
      "Rename",
      "-",
      "Delete"
    ]);
    assert.deepEqual(labelsOf(harness.controller.menuFor(harness.glass).items), [
      "Rename",
      "Duplicate",
      "Copy",
      "-",
      "Delete"
    ]);
  });

  test("offers a material to the selected block only when that block uses another", async() => {
    const harness = createHarness();
    const block = harness.addBlock({ name: "Arm" });
    harness.selection.select(block.uuid);

    assert.equal(labelsOf(harness.controller.menuFor(harness.glass).items)[0], "Assign to Arm");

    await choose(harness, harness.glass, "assign");

    assert.equal(labelsOf(harness.controller.menuFor(harness.glass).items)[0], "Rename");
  });

  test("adds a preset offered where it was asked and a folder to rename, in the row's folder", async() => {
    const harness = createHarness();
    const folder = harness.controller.createFolder()!;

    await choose(harness, folder, "new-material");
    await choose(harness, folder, "new-folder");

    const children = harness.document.tree.materials.childrenOf(folder);
    assert.deepEqual(children.map(({ name }) => name), ["Metal", "Folder"]);
    assert.deepEqual(harness.calls.renamed, [children[1].id]);
    assert.deepEqual(harness.calls.presetPoints, [kMenuPoint]);
  });

  test("copies through the clipboard and pastes from it", async() => {
    const harness = createHarness({ clipboard: null });

    await choose(harness, harness.glass, "copy");
    await choose(harness, null, "paste");

    assert.equal(harness.calls.written.length, 1);
    assert.deepEqual(namesOf(harness), ["Glass"]);
  });

  test("runs nothing for a row removed since its menu opened, or an action it did not list", async() => {
    const harness = createHarness();
    const menu = harness.controller.menuFor(harness.glass);

    await choose(harness, null, "delete");
    harness.document.removeMaterial(harness.glass);
    await menu.run("duplicate", kMenuPoint);

    assert.deepEqual(namesOf(harness), []);
  });
});

describe("MaterialLibraryController peers", () => {
  test("shares the edited material and shows peers on the rows they edit", () => {
    const harness = createHarness();
    const folder = harness.controller.createFolder()!;

    harness.controller.select(harness.glass);
    assert.equal(harness.materialFocus.edited, harness.glass);

    harness.controller.select(folder);
    assert.equal(harness.materialFocus.edited, null);

    harness.presence.materialEdits = new Map([
      [harness.glass, [{ clientId: "b", color: "#ff0000", displayName: "Bea" }]]
    ]);

    assert.deepEqual(harness.controller.state.nodes[0].badges, [
      { color: "#ff0000", title: "Bea" }
    ]);
  });
});
