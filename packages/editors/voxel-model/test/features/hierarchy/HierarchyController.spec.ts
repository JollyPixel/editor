// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  NO_MIRROR,
  shapeOf
} from "../../fixtures/hierarchy.ts";
import {
  createHierarchyHarness,
  selectBlock
} from "./hierarchyHarness.ts";
import { BLOCK_SHAPE_OPTIONS } from "#src/shared/blockShapes.ts";

describe("HierarchyController.addBlock", () => {
  test("adds the shape picked in the dialog under the selected block, then selects it", async() => {
    const harness = createHierarchyHarness({
      name: { name: "Arm", choice: "plane" }
    });
    selectBlock(harness, "Body");

    await harness.controller.addBlock();

    const [{ validate: _validate, ...context }] = harness.calls.name;
    assert.deepEqual(context, {
      heading: "New Block",
      fieldLabel: "Block name",
      defaultName: "Block",
      choice: {
        label: "Shape",
        options: BLOCK_SHAPE_OPTIONS,
        value: "box"
      }
    });
    const [body] = harness.hierarchy.nodes();
    assert.deepEqual(shapeOf(harness.hierarchy.nodes()), [["Body", ["Arm"]]]);
    assert.deepEqual(body.children[0].shape, { type: "plane" });
    assert.deepEqual(harness.controller.selected, [body.children[0].id]);
  });

  test("offers the last shape picked the next time", async() => {
    const harness = createHierarchyHarness({
      name: { name: "Ring", choice: "torus" }
    });

    await harness.controller.addBlock();
    await harness.controller.addBlock();

    assert.deepEqual(harness.calls.name.map(({ choice }) => choice?.value), ["box", "torus"]);
  });

  test("prefills a free name and refuses one a sibling block already has", async() => {
    const harness = createHierarchyHarness();
    harness.addBlock({ name: "Block" });

    await harness.controller.addBlock();

    const [{ defaultName, validate }] = harness.calls.name;
    assert.equal(defaultName, "Block 2");
    assert.equal(validate?.("block"), "A root block is already named \"block\"");
    assert.equal(validate?.("Arm"), null);
  });

  test("adds at the root without a selection", async() => {
    const harness = createHierarchyHarness({
      name: { name: "Arm", choice: "box" }
    });
    harness.addBlock({ name: "Body" });

    await harness.controller.addBlock();

    assert.deepEqual(shapeOf(harness.hierarchy.nodes()), ["Body", "Arm"]);
  });

  test("adds nothing when the dialog is dismissed", async() => {
    const harness = createHierarchyHarness();

    await harness.controller.addBlock();

    assert.deepEqual(harness.hierarchy.nodes(), []);
  });
});

describe("HierarchyController.addFolder", () => {
  test("prompts for a folder without refusing any name", async() => {
    const harness = createHierarchyHarness({
      name: { name: "Folder" }
    });

    await harness.controller.addFolder();

    assert.deepEqual(harness.calls.name, [
      {
        heading: "New Folder",
        fieldLabel: "Folder name",
        defaultName: "Folder"
      }
    ]);
    const [folder] = harness.hierarchy.nodes();
    assert.equal(folder.kind, "folder");
    assert.equal(folder.name, "Folder");
  });

  test("adds under the selected item", async() => {
    const harness = createHierarchyHarness({
      name: { name: "Limbs" }
    });
    selectBlock(harness, "Body");

    await harness.controller.addFolder();

    assert.deepEqual(shapeOf(harness.hierarchy.nodes()), [["Body", ["Limbs"]]]);
    assert.equal(harness.hierarchy.nodes()[0].children[0].kind, "folder");
  });
});

describe("HierarchyController.validateRename", () => {
  test("refuses a block name a sibling block has, never a folder name", () => {
    const harness = createHierarchyHarness();
    const arm = harness.addBlock({ name: "Arm" });
    harness.addBlock({ name: "Leg" });
    const folderId = harness.hierarchy.createFolder("Limbs", null)!;

    assert.equal(
      harness.controller.validateRename({ id: arm.uuid, name: "LEG" }),
      "A root block is already named \"LEG\""
    );
    assert.equal(harness.controller.validateRename({ id: arm.uuid, name: "Hand" }), null);
    assert.equal(harness.controller.validateRename({ id: folderId, name: "Leg" }), null);
  });
});

describe("HierarchyController.duplicateSelected", () => {
  test("opens no dialog without a selection", async() => {
    const harness = createHierarchyHarness();

    await harness.controller.duplicateSelected();

    assert.deepEqual(harness.calls.duplicate, []);
  });

  test("selects and expands the copy of a subtree", async() => {
    const harness = createHierarchyHarness({
      duplicate: {
        name: "Body Copy",
        includeChildren: true,
        mirrorAxes: NO_MIRROR
      }
    });
    const bodyUuid = selectBlock(harness, "Body");
    harness.addBlock({
      name: "Arm",
      parentId: bodyUuid
    });

    await harness.controller.duplicateSelected();

    const [{ validate, ...context }] = harness.calls.duplicate;
    assert.deepEqual(context, {
      defaultName: "Body Copy",
      hasChildren: true
    });
    assert.equal(validate?.("body"), "A root block is already named \"body\"");
    assert.deepEqual(shapeOf(harness.hierarchy.nodes()), [
      ["Body", ["Arm"]],
      ["Body Copy", ["Arm"]]
    ]);
    const [copyId] = harness.controller.selected;
    assert.notEqual(copyId, bodyUuid);
    assert.equal(harness.selection.selected, copyId);
    assert.ok(harness.controller.expanded.includes(copyId));
  });

  test("duplicates nothing when the dialog is dismissed", async() => {
    const harness = createHierarchyHarness();
    selectBlock(harness, "Body");

    await harness.controller.duplicateSelected();

    assert.deepEqual(shapeOf(harness.hierarchy.nodes()), ["Body"]);
  });
});

describe("HierarchyController.deleteSelected", () => {
  test("names the dialog after the selected kind", async() => {
    const harness = createHierarchyHarness();
    const bodyUuid = selectBlock(harness, "Body");
    harness.addBlock({
      name: "Arm",
      parentId: bodyUuid
    });

    await harness.controller.deleteSelected();

    assert.deepEqual(harness.calls.delete, [
      {
        heading: "Delete Block",
        hasChildren: true
      }
    ]);
    assert.deepEqual(shapeOf(harness.hierarchy.nodes()), [
      ["Body", ["Arm"]]
    ]);
  });

  test("promotes the children when they are kept", async() => {
    const harness = createHierarchyHarness({
      delete: { deleteChildren: false }
    });
    const bodyUuid = selectBlock(harness, "Body");
    harness.addBlock({
      name: "Arm",
      parentId: bodyUuid
    });

    await harness.controller.deleteSelected();

    assert.deepEqual(shapeOf(harness.hierarchy.nodes()), ["Arm"]);
    assert.equal(harness.selection.selected, null);
  });

  test("removes the subtree when the children go too", async() => {
    const harness = createHierarchyHarness({
      delete: { deleteChildren: true }
    });
    const bodyUuid = selectBlock(harness, "Body");
    harness.addBlock({
      name: "Arm",
      parentId: bodyUuid
    });

    await harness.controller.deleteSelected();

    assert.deepEqual(harness.hierarchy.nodes(), []);
  });
});
