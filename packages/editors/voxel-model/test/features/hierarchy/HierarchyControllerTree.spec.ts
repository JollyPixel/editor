// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  PresenceStore,
  TabStore
} from "#src/state/index.ts";
import { createModelFixture } from "../../fixtures/model.ts";
import {
  createHierarchyFor,
  shapeOf
} from "../../fixtures/hierarchy.ts";
import {
  createHierarchyHarness,
  type HierarchyHarness
} from "./hierarchyHarness.ts";

function toggleVisible(
  harness: HierarchyHarness,
  id: string,
  visible: boolean
): void {
  harness.controller.handleToggleVisible(
    new CustomEvent("jolly-toggle-visible", {
      detail: {
        id,
        visible
      }
    })
  );
}

describe("HierarchyController.editable", () => {
  test("edits only in Build, redrawing when the tab changes", () => {
    const { controller, tab, updates } = createHierarchyHarness();
    const before = updates();

    tab.activate("animate");
    assert.deepEqual([controller.editable, updates()], [false, before + 1]);

    tab.activate("build");
    assert.equal(controller.editable, true);
  });
});

describe("HierarchyController.handleToggleVisible", () => {
  test("hides only that block's mesh and reflects it on its row", () => {
    const harness = createHierarchyHarness();
    const body = harness.addBlock({ name: "Body" });
    const arm = harness.addBlock({
      name: "Arm",
      parentId: body.uuid
    });

    toggleVisible(harness, body.uuid, false);

    assert.equal(body.mesh.visible, false);
    assert.equal(arm.mesh.visible, true);
    const [row] = harness.controller.nodes;
    assert.equal(row.visible, false);
    assert.equal(row.children?.[0].visible, true);
  });

  test("a folder follows its blocks: showing one child turns it back on", () => {
    const harness = createHierarchyHarness();
    const folderId = harness.hierarchy.createFolder("Limbs", null)!;
    const arm = harness.addBlock({ name: "Arm", parentId: folderId });
    const leg = harness.addBlock({ name: "Leg", parentId: folderId });

    toggleVisible(harness, folderId, false);
    assert.deepEqual([arm.visible, leg.visible], [false, false]);
    assert.equal(harness.controller.nodes[0].visible, false);

    toggleVisible(harness, arm.uuid, true);
    assert.equal(harness.controller.nodes[0].visible, true);

    toggleVisible(harness, folderId, false);
    assert.deepEqual([arm.visible, leg.visible], [false, false]);

    toggleVisible(harness, folderId, true);
    assert.deepEqual([arm.visible, leg.visible], [true, true]);
  });

  test("a folder reaches blocks in nested folders and under other blocks", () => {
    const harness = createHierarchyHarness();
    const outerId = harness.hierarchy.createFolder("Outer", null)!;
    const innerId = harness.hierarchy.createFolder("Inner", outerId)!;
    const hand = harness.addBlock({ name: "Hand", parentId: innerId });
    const finger = harness.addBlock({ name: "Finger", parentId: hand.uuid });

    toggleVisible(harness, outerId, false);
    assert.deepEqual([hand.visible, finger.visible], [false, false]);
    const [outer] = harness.controller.nodes;
    assert.equal(outer.visible, false);
    assert.equal(outer.children?.[0].visible, false);

    toggleVisible(harness, finger.uuid, true);
    const [shown] = harness.controller.nodes;
    assert.equal(shown.visible, true);
    assert.equal(shown.children?.[0].visible, true);
  });
});

describe("HierarchyController.handleActivate", () => {
  test("toggles a folder and leaves a block as it is", () => {
    const harness = createHierarchyHarness();
    const folderId = harness.hierarchy.createFolder("Limbs", null)!;
    const block = harness.addBlock({ parentId: folderId });
    const wasExpanded = harness.controller.expanded.includes(folderId);

    for (const id of [folderId, block.uuid]) {
      harness.controller.handleActivate(new CustomEvent("jolly-activate", {
        detail: { id }
      }));
    }

    assert.equal(harness.controller.expanded.includes(folderId), !wasExpanded);
    assert.equal(harness.controller.expanded.includes(block.uuid), false);
  });
});

describe("HierarchyController.editMaterial", () => {
  test("selects the block in the tree and the scene, then shows its material", () => {
    const harness = createHierarchyHarness();
    const block = harness.addBlock();

    harness.controller.editMaterial(block.uuid);

    assert.deepEqual(harness.controller.selected, [block.uuid]);
    assert.equal(harness.selection.selected, block.uuid);
    assert.equal(harness.calls.materialShown, 1);
  });
});

describe("HierarchyController.handleReparent", () => {
  function reparent(
    harness: HierarchyHarness,
    movedIds: string[],
    targetId: string,
    where: "above" | "inside" | "below"
  ): void {
    harness.controller.handleReparent(new CustomEvent("jolly-reparent", {
      detail: {
        movedIds,
        targetId,
        where
      }
    }));
  }

  test("reorders siblings from above and below drops", () => {
    const harness = createHierarchyHarness();
    const a = harness.addBlock({ name: "A" });
    const b = harness.addBlock({ name: "B" });
    const c = harness.addBlock({ name: "C" });

    reparent(harness, [c.uuid], a.uuid, "above");
    assert.deepEqual(shapeOf(harness.hierarchy.nodes()), ["C", "A", "B"]);

    reparent(harness, [c.uuid, a.uuid], b.uuid, "below");
    assert.deepEqual(shapeOf(harness.hierarchy.nodes()), ["B", "C", "A"]);
  });

  test("keeps the drop position when a row changes parent", () => {
    const harness = createHierarchyHarness();
    const body = harness.addBlock({ name: "Body" });
    const head = harness.addBlock({ name: "Head", parentId: body.uuid });
    harness.addBlock({ name: "Tail", parentId: body.uuid });
    const arm = harness.addBlock({ name: "Arm" });

    reparent(harness, [arm.uuid], head.uuid, "below");

    assert.deepEqual(
      shapeOf(harness.hierarchy.nodes()),
      [["Body", ["Head", "Arm", "Tail"]]]
    );
  });
});

describe("HierarchyController.attach", () => {
  test("expands the folders of a document loaded before attaching", () => {
    const fixture = createModelFixture();
    const { document, blocks, selection } = fixture;
    const folderId = document.addFolder({ name: "Limbs" });
    document.addBlock({
      name: "Arm",
      parentId: folderId
    });

    const harness = createHierarchyHarness();
    harness.controller.attach({
      access: harness.access,
      document,
      blocks,
      selection,
      hierarchy: createHierarchyFor(fixture, harness.access),
      presence: new PresenceStore(),
      tab: new TabStore()
    });

    const [folder] = harness.controller.nodes;

    assert.equal(folder.label, "Limbs");
    assert.deepEqual(
      folder.children?.map((child) => child.label),
      ["Arm"]
    );
    assert.deepEqual(harness.controller.expanded, [folderId]);
  });
});
