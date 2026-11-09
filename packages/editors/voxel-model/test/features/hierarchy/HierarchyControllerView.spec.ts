// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  chooseFromMenu,
  createHierarchyHarness
} from "./hierarchyHarness.ts";

describe("HierarchyController view actions", () => {
  test("isolates a block with its children, then shows everything again", async() => {
    const harness = createHierarchyHarness();
    const arm = harness.addBlock({ name: "Arm" });
    const hand = harness.addBlock({ name: "Hand", parentId: arm.uuid });
    const body = harness.addBlock({ name: "Body" });

    await chooseFromMenu(harness, arm.uuid, "isolate");
    assert.deepEqual([arm, hand, body].map((block) => block.visible), [true, true, false]);

    await chooseFromMenu(harness, null, "show-all");
    assert.deepEqual([arm, hand, body].map((block) => block.visible), [true, true, true]);
  });

  test("frames a folder's blocks", async() => {
    const harness = createHierarchyHarness();
    const folderId = harness.hierarchy.createFolder("Limbs", null)!;
    const arm = harness.addBlock({ name: "Arm", parentId: folderId });
    harness.addBlock({ name: "Body" });

    await chooseFromMenu(harness, folderId, "focus");

    assert.deepEqual(harness.calls.framed, [[arm.uuid]]);
  });

  test("collapses and expands a folder's whole subtree", async() => {
    const harness = createHierarchyHarness();
    const folderId = harness.hierarchy.createFolder("Limbs", null)!;
    const arm = harness.addBlock({ name: "Arm", parentId: folderId });
    harness.addBlock({ name: "Hand", parentId: arm.uuid });

    await chooseFromMenu(harness, folderId, "collapse-all");
    assert.deepEqual(harness.controller.expanded, []);

    await chooseFromMenu(harness, folderId, "expand-all");
    assert.deepEqual([...harness.controller.expanded].sort(), [folderId, arm.uuid].sort());
  });
});
