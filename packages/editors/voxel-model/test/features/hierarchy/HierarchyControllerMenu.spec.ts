// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { ContextMenuEntry } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  NO_MIRROR,
  readShape
} from "../../fixtures/hierarchy.ts";
import {
  MENU_POINT,
  chooseFromMenu,
  createHierarchyHarness,
  selectBlock
} from "./hierarchyHarness.ts";

function listLabels(
  entries: readonly ContextMenuEntry[]
): string[] {
  return entries.map((entry) => (entry === "separator" ? "-" : entry.label));
}

function listEnabledLabels(
  entries: readonly ContextMenuEntry[]
): string[] {
  return entries.flatMap((entry) => (
    entry === "separator" || entry.disabled === true ? [] : [entry.label]
  ));
}

describe("HierarchyController without hierarchy rights", () => {
  test("keeps only Material… in the row menu, redrawing when rights change", () => {
    const harness = createHierarchyHarness();
    const block = harness.addBlock({ name: "Body" });
    const before = harness.updates();

    harness.access.grant("materials");

    assert.deepEqual([harness.controller.writable, harness.updates()], [false, before + 1]);
    assert.deepEqual(listEnabledLabels(harness.controller.openMenu(block.uuid).items), ["Material…"]);
    assert.deepEqual(listEnabledLabels(harness.controller.openMenu(null).items), []);

    harness.access.grant("hierarchy");
    assert.equal(harness.controller.writable, true);
  });
});

describe("HierarchyController.openMenu", () => {
  test("offers a block its material and one child block", () => {
    const harness = createHierarchyHarness();
    const block = harness.addBlock();

    assert.deepEqual(listLabels(harness.controller.openMenu(block.uuid).items), [
      "Add Child Block",
      "Rename",
      "Duplicate",
      "-",
      "Material…",
      "-",
      "Delete"
    ]);
  });

  test("offers a folder both kinds of child and no material", () => {
    const harness = createHierarchyHarness();
    const folderId = harness.hierarchy.createFolder("Limbs", null)!;

    assert.deepEqual(listLabels(harness.controller.openMenu(folderId).items), [
      "Add Block",
      "Add Folder",
      "Rename",
      "Duplicate",
      "-",
      "Delete"
    ]);
  });

  test("is empty for a node that is gone", () => {
    const harness = createHierarchyHarness();

    assert.deepEqual(harness.controller.openMenu("missing").items, []);
  });

  test("offers the tree itself only the root adds", () => {
    const harness = createHierarchyHarness();

    assert.deepEqual(listLabels(harness.controller.openMenu(null).items), [
      "Add Block",
      "Add Folder"
    ]);
  });
});

describe("HierarchyController.openMenu run", () => {
  test("renames through the view and selects the block to show its material", async() => {
    const harness = createHierarchyHarness();
    const block = harness.addBlock();

    await chooseFromMenu(harness, block.uuid, "rename");
    await chooseFromMenu(harness, block.uuid, "material");

    assert.deepEqual(harness.calls.renamed, [block.uuid]);
    assert.equal(harness.calls.materialShown, 1);
    assert.equal(harness.selection.selected, block.uuid);
  });

  test("adds a child under the row it was opened on", async() => {
    const harness = createHierarchyHarness({
      name: { name: "Arm", choice: "pyramid" }
    });
    const folderId = harness.hierarchy.createFolder("Limbs", null)!;

    await chooseFromMenu(harness, folderId, "add-block");
    await chooseFromMenu(harness, folderId, "add-folder");

    const [limbs] = harness.hierarchy.nodes();
    assert.deepEqual(readShape([limbs]), [
      ["Limbs", ["Arm", "Arm"]]
    ]);
    assert.deepEqual(
      limbs.children.map((child) => [child.kind, child.shape]),
      [["block", { type: "cone", sides: 4 }], ["folder", null]]
    );
  });

  test("duplicates and deletes the row it was opened on, not the selection", async() => {
    const harness = createHierarchyHarness({
      duplicate: {
        name: "Left Arm",
        includeChildren: false,
        mirrorAxes: NO_MIRROR
      },
      delete: { deleteChildren: true }
    });
    const arm = harness.addBlock({ name: "Arm" });
    const leg = harness.addBlock({ name: "Leg" });
    harness.selection.select(leg.uuid);

    await chooseFromMenu(harness, arm.uuid, "duplicate");
    assert.deepEqual(readShape(harness.hierarchy.nodes()), ["Arm", "Left Arm", "Leg"]);

    await chooseFromMenu(harness, arm.uuid, "delete");
    assert.deepEqual(readShape(harness.hierarchy.nodes()), ["Left Arm", "Leg"]);
  });

  test("does nothing for a node removed while the menu was open", async() => {
    const harness = createHierarchyHarness({
      delete: { deleteChildren: true }
    });
    const arm = harness.addBlock();
    const menu = harness.controller.openMenu(arm.uuid);
    harness.document.remove(arm.uuid);

    await menu.run("delete", MENU_POINT);

    assert.deepEqual(harness.calls.delete, []);
  });

  test("adds at the root from the tree's menu, whatever is selected", async() => {
    const harness = createHierarchyHarness({
      name: { name: "Arm", choice: "box" }
    });
    selectBlock(harness, "Body");

    await chooseFromMenu(harness, null, "add-block");

    assert.deepEqual(readShape(harness.hierarchy.nodes()), ["Body", "Arm"]);
  });

  test("ignores a row action chosen on the tree's menu", async() => {
    const harness = createHierarchyHarness();
    selectBlock(harness, "Body");

    await chooseFromMenu(harness, null, "delete");

    assert.deepEqual(harness.calls.delete, []);
  });

  test("ignores an unknown action", async() => {
    const harness = createHierarchyHarness();
    const block = harness.addBlock();

    await chooseFromMenu(harness, block.uuid, "unknown");

    assert.deepEqual(harness.calls.renamed, []);
    assert.deepEqual(harness.calls.delete, []);
  });
});
