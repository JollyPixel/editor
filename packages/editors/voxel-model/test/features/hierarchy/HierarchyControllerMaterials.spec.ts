// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  listEnabledLabels,
  listLabels,
  materialItems
} from "./menuLabels.ts";
import {
  chooseFromMenu,
  createHierarchyHarness,
  type HierarchyHarness
} from "./hierarchyHarness.ts";

function assignedMaterial(
  harness: HierarchyHarness,
  uuid: string
): string | null {
  return harness.document.tree.nodes.block(uuid)?.materialId ?? null;
}

describe("HierarchyController Material submenu", () => {
  test("lists the library in the Material submenu, the block's own disabled", () => {
    const harness = createHierarchyHarness();
    const block = harness.addBlock();
    const metal = harness.document.addMaterial({ name: "Metal" })!;
    harness.document.addMaterial({ name: "Glass" });
    harness.document.assignMaterial(block.uuid, metal);

    const items = materialItems(harness.controller.openMenu(block.uuid).items);

    assert.deepEqual(listLabels(items), [
      "Edit Material…",
      "-",
      "None",
      "Metal",
      "Glass",
      "-",
      "New Material",
      "-",
      "Copy Material",
      "Paste Material"
    ]);
    assert.deepEqual(
      listEnabledLabels(items),
      ["Edit Material…", "None", "Glass", "New Material", "Copy Material"]
    );
  });
});

describe("HierarchyController material actions", () => {
  test("assigns from the submenu as one Material step and opens the Material tab", async() => {
    const harness = createHierarchyHarness();
    const block = harness.addBlock();
    const metal = harness.document.addMaterial({ name: "Metal" })!;

    await chooseFromMenu(harness, block.uuid, `assign:${metal}`);

    assert.equal(assignedMaterial(harness, block.uuid), metal);
    assert.equal(harness.calls.materialShown, 1);
    assert.equal(harness.selection.selected, block.uuid);
    assert.equal(harness.history.undo("material"), true);
    assert.equal(assignedMaterial(harness, block.uuid), null);
  });

  test("applies a material to every block under a folder in one undo step", async() => {
    const harness = createHierarchyHarness();
    const folderId = harness.hierarchy.createFolder("Limbs", null)!;
    const arm = harness.addBlock({ name: "Arm", parentId: folderId });
    const hand = harness.addBlock({ name: "Hand", parentId: arm.uuid });
    const body = harness.addBlock({ name: "Body" });
    const metal = harness.document.addMaterial({ name: "Metal" })!;

    await chooseFromMenu(harness, folderId, `assign:${metal}`);

    assert.deepEqual(
      [arm, hand, body].map(({ uuid }) => assignedMaterial(harness, uuid)),
      [metal, metal, null]
    );
    assert.equal(harness.history.state("material").undoLabel, "Set Metal on 2 blocks");

    harness.history.undo("material");
    assert.deepEqual([arm, hand].map(({ uuid }) => assignedMaterial(harness, uuid)), [null, null]);
  });

  test("pastes the material copied from another block", async() => {
    const harness = createHierarchyHarness();
    const source = harness.addBlock({ name: "Source" });
    const target = harness.addBlock({ name: "Target" });
    const metal = harness.document.addMaterial({ name: "Metal" })!;
    harness.document.assignMaterial(source.uuid, metal);

    await chooseFromMenu(harness, source.uuid, "copy-material");
    await chooseFromMenu(harness, target.uuid, "paste-material");

    assert.equal(harness.document.tree.nodes.block(target.uuid)?.materialId, metal);
  });

  test("creates a material from a preset and assigns it", async() => {
    const harness = createHierarchyHarness();
    const block = harness.addBlock();

    await chooseFromMenu(harness, block.uuid, "preset:glass");

    const [glass] = harness.document.tree.materials.materials();
    assert.equal(glass.name, "Glass");
    assert.equal(harness.document.tree.nodes.block(block.uuid)?.materialId, glass.id);
    assert.equal(harness.history.undo("material"), true);
    assert.deepEqual([...harness.document.tree.materials.materials()], []);
  });
});
