// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";
import type { ContextMenuEntry } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  ModelHierarchy,
  type HierarchyNode
} from "#src/model/index.ts";
import { createEditorHistory } from "#src/features/history/index.ts";
import {
  PresenceStore,
  TabStore
} from "#src/state/index.ts";
import {
  HierarchyController,
  type HierarchyView
} from "#src/features/hierarchy/HierarchyController.ts";
import type {
  NameDialogContext,
  NameDialogResult
} from "#src/shared/NameDialog.ts";
import type {
  HierarchyDuplicateContext,
  HierarchyDuplicateResult
} from "#src/features/hierarchy/dialogs/HierarchyDuplicateDialog.ts";
import type {
  DeleteContext,
  DeleteResult
} from "#src/shared/DeleteDialog.ts";
import {
  buildEditsOf,
  createModelFixture,
  type ModelFixture
} from "../../fixtures/model.ts";

// CONSTANTS
const kNoMirror = {
  x: false,
  y: false,
  z: false
};
const kTextureSize = {
  x: 256,
  y: 256
};
const kMenuPoint = {
  x: 0,
  y: 0
};

interface DialogAnswers {
  name?: NameDialogResult | null;
  duplicate?: HierarchyDuplicateResult | null;
  delete?: DeleteResult | null;
}

interface DialogCalls {
  name: NameDialogContext[];
  duplicate: HierarchyDuplicateContext[];
  delete: DeleteContext[];
  renamed: string[];
  materialShown: number;
}

interface Harness extends ModelFixture {
  controller: HierarchyController;
  hierarchy: ModelHierarchy;
  calls: DialogCalls;
  tab: TabStore;
  updates(): number;
}

function createHarness(
  answers: DialogAnswers = {}
): Harness {
  const fixture = createModelFixture();
  const { document, blocks, selection } = fixture;
  const hierarchy = new ModelHierarchy({
    document,
    edits: buildEditsOf(createEditorHistory({ document })),
    textureSize: () => kTextureSize,
    poses: blocks
  });
  const calls: DialogCalls = {
    name: [],
    duplicate: [],
    delete: [],
    renamed: [],
    materialShown: 0
  };
  const view: HierarchyView = {
    promptName(context) {
      calls.name.push(context);

      return Promise.resolve(answers.name ?? null);
    },
    promptDuplicate(context) {
      calls.duplicate.push(context);

      return Promise.resolve(answers.duplicate ?? null);
    },
    promptDelete(context) {
      calls.delete.push(context);

      return Promise.resolve(answers.delete ?? null);
    },
    beginRename(id) {
      calls.renamed.push(id);
    },
    showMaterial() {
      calls.materialShown++;
    }
  };
  let updates = 0;
  const host: ReactiveControllerHost = {
    addController: (controller) => controller.hostConnected?.(),
    removeController: () => undefined,
    requestUpdate: () => {
      updates++;
    },
    updateComplete: Promise.resolve(true)
  };
  const tab = new TabStore();
  const controller = new HierarchyController(host, view);
  controller.attach({
    document,
    blocks,
    selection,
    hierarchy,
    presence: new PresenceStore(),
    tab
  });

  return {
    ...fixture,
    controller,
    hierarchy,
    calls,
    tab,
    updates: () => updates
  };
}

function shapeOf(
  nodes: readonly HierarchyNode[]
): unknown[] {
  return nodes.map((node) => (
    node.children.length > 0 ? [node.name, shapeOf(node.children)] : node.name
  ));
}

function selectBlock(
  harness: Harness,
  name: string
): string {
  const block = harness.addBlock({ name });
  harness.selection.select(block.uuid);

  return block.uuid;
}

describe("HierarchyController.addBlock", () => {
  test("adds under the selected block, then selects the new block", async() => {
    const harness = createHarness({
      name: { name: "Arm" }
    });
    selectBlock(harness, "Body");

    await harness.controller.addBlock();

    const [{ validate: _validate, ...context }] = harness.calls.name;
    assert.deepEqual(context, {
      heading: "New Block",
      fieldLabel: "Block name",
      defaultName: "Block"
    });
    const [body] = harness.hierarchy.nodes();
    assert.deepEqual(shapeOf(harness.hierarchy.nodes()), [["Body", ["Arm"]]]);
    assert.deepEqual(harness.controller.selected, [body.children[0].id]);
  });

  test("prefills a free name and refuses one a sibling block already has", async() => {
    const harness = createHarness();
    harness.addBlock({ name: "Block" });

    await harness.controller.addBlock();

    const [{ defaultName, validate }] = harness.calls.name;
    assert.equal(defaultName, "Block 2");
    assert.equal(validate?.("block"), "A root block is already named \"block\"");
    assert.equal(validate?.("Arm"), null);
  });

  test("adds at the root without a selection", async() => {
    const harness = createHarness({
      name: { name: "Arm" }
    });
    harness.addBlock({ name: "Body" });

    await harness.controller.addBlock();

    assert.deepEqual(shapeOf(harness.hierarchy.nodes()), ["Body", "Arm"]);
  });

  test("adds nothing when the dialog is dismissed", async() => {
    const harness = createHarness();

    await harness.controller.addBlock();

    assert.deepEqual(harness.hierarchy.nodes(), []);
  });
});

describe("HierarchyController.addFolder", () => {
  test("prompts for a folder without refusing any name", async() => {
    const harness = createHarness({
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
    const harness = createHarness({
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
    const harness = createHarness();
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

describe("HierarchyController.editable", () => {
  test("edits only in Build, redrawing when the tab changes", () => {
    const { controller, tab, updates } = createHarness();
    const before = updates();

    tab.activate("animate");
    assert.deepEqual([controller.editable, updates()], [false, before + 1]);

    tab.activate("build");
    assert.equal(controller.editable, true);
  });
});

describe("HierarchyController.handleToggleVisible", () => {
  test("hides only that block's mesh and reflects it on its row", () => {
    const harness = createHarness();
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
    const harness = createHarness();
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
    const harness = createHarness();
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

function toggleVisible(
  harness: Harness,
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

describe("HierarchyController.duplicateSelected", () => {
  test("opens no dialog without a selection", async() => {
    const harness = createHarness();

    await harness.controller.duplicateSelected();

    assert.deepEqual(harness.calls.duplicate, []);
  });

  test("selects and expands the copy of a subtree", async() => {
    const harness = createHarness({
      duplicate: {
        name: "Body Copy",
        includeChildren: true,
        mirrorAxes: kNoMirror
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
    assert.equal(harness.hierarchy.nodes().length, 2);
    const [copyId] = harness.controller.selected;
    assert.notEqual(copyId, bodyUuid);
    assert.equal(harness.selection.selected, copyId);
    assert.ok(harness.controller.expanded.includes(copyId));
  });

  test("duplicates nothing when the dialog is dismissed", async() => {
    const harness = createHarness();
    selectBlock(harness, "Body");

    await harness.controller.duplicateSelected();

    assert.deepEqual(shapeOf(harness.hierarchy.nodes()), ["Body"]);
  });
});

describe("HierarchyController.deleteSelected", () => {
  test("names the dialog after the selected kind", async() => {
    const harness = createHarness();
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
    const harness = createHarness({
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
    const harness = createHarness({
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

async function chooseFromMenu(
  harness: Harness,
  id: string | null,
  action: string
): Promise<void> {
  await harness.controller.menuFor(id).run(action, kMenuPoint);
}

describe("HierarchyController.menuFor", () => {
  function labelsOf(
    entries: readonly ContextMenuEntry[]
  ): string[] {
    return entries.map((entry) => (entry === "separator" ? "-" : entry.label));
  }

  test("offers a block its material and one child block", () => {
    const harness = createHarness();
    const block = harness.addBlock();

    assert.deepEqual(labelsOf(harness.controller.menuFor(block.uuid).items), [
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
    const harness = createHarness();
    const folderId = harness.hierarchy.createFolder("Limbs", null)!;

    assert.deepEqual(labelsOf(harness.controller.menuFor(folderId).items), [
      "Add Block",
      "Add Folder",
      "Rename",
      "Duplicate",
      "-",
      "Delete"
    ]);
  });

  test("is empty for a node that is gone", () => {
    const harness = createHarness();

    assert.deepEqual(harness.controller.menuFor("missing").items, []);
  });

  test("offers the tree itself only the root adds", () => {
    const harness = createHarness();

    assert.deepEqual(labelsOf(harness.controller.menuFor(null).items), [
      "Add Block",
      "Add Folder"
    ]);
  });
});

describe("HierarchyController.menuFor run", () => {
  test("renames through the view and selects the block to show its material", async() => {
    const harness = createHarness();
    const block = harness.addBlock();

    await chooseFromMenu(harness, block.uuid, "rename");
    await chooseFromMenu(harness, block.uuid, "material");

    assert.deepEqual(harness.calls.renamed, [block.uuid]);
    assert.equal(harness.calls.materialShown, 1);
    assert.equal(harness.selection.selected, block.uuid);
  });

  test("adds a child under the row it was opened on", async() => {
    const harness = createHarness({
      name: { name: "Arm" }
    });
    const folderId = harness.hierarchy.createFolder("Limbs", null)!;

    await chooseFromMenu(harness, folderId, "add-block");
    await chooseFromMenu(harness, folderId, "add-folder");

    assert.deepEqual(shapeOf(harness.hierarchy.nodes()), [
      ["Limbs", ["Arm", "Arm"]]
    ]);
  });

  test("duplicates and deletes the row it was opened on, not the selection", async() => {
    const harness = createHarness({
      duplicate: {
        name: "Left Arm",
        includeChildren: false,
        mirrorAxes: kNoMirror
      },
      delete: { deleteChildren: true }
    });
    const arm = harness.addBlock({ name: "Arm" });
    const leg = harness.addBlock({ name: "Leg" });
    harness.selection.select(leg.uuid);

    await chooseFromMenu(harness, arm.uuid, "duplicate");
    assert.deepEqual(shapeOf(harness.hierarchy.nodes()), ["Arm", "Left Arm", "Leg"]);

    await chooseFromMenu(harness, arm.uuid, "delete");
    assert.deepEqual(shapeOf(harness.hierarchy.nodes()), ["Left Arm", "Leg"]);
  });

  test("does nothing for a node removed while the menu was open", async() => {
    const harness = createHarness({
      delete: { deleteChildren: true }
    });
    const arm = harness.addBlock();
    const menu = harness.controller.menuFor(arm.uuid);
    harness.document.remove(arm.uuid);

    await menu.run("delete", kMenuPoint);

    assert.deepEqual(harness.calls.delete, []);
  });

  test("adds at the root from the tree's menu, whatever is selected", async() => {
    const harness = createHarness({
      name: { name: "Arm" }
    });
    selectBlock(harness, "Body");

    await chooseFromMenu(harness, null, "add-block");

    assert.deepEqual(shapeOf(harness.hierarchy.nodes()), ["Body", "Arm"]);
  });

  test("ignores a row action chosen on the tree's menu", async() => {
    const harness = createHarness();
    selectBlock(harness, "Body");

    await chooseFromMenu(harness, null, "delete");

    assert.deepEqual(harness.calls.delete, []);
  });

  test("ignores an unknown action", async() => {
    const harness = createHarness();
    const block = harness.addBlock();

    await chooseFromMenu(harness, block.uuid, "unknown");

    assert.deepEqual(harness.calls.renamed, []);
    assert.deepEqual(harness.calls.delete, []);
  });
});

describe("HierarchyController.handleActivate", () => {
  function activate(
    harness: Harness,
    id: string
  ): void {
    harness.controller.handleActivate(new CustomEvent("jolly-activate", {
      detail: { id }
    }));
  }

  test("toggles a folder and leaves a block as it is", () => {
    const harness = createHarness();
    const folderId = harness.hierarchy.createFolder("Limbs", null)!;
    const block = harness.addBlock({ parentId: folderId });
    const wasExpanded = harness.controller.expanded.includes(folderId);

    activate(harness, folderId);
    activate(harness, block.uuid);

    assert.equal(harness.controller.expanded.includes(folderId), !wasExpanded);
    assert.equal(harness.controller.expanded.includes(block.uuid), false);
  });
});

describe("HierarchyController.editMaterial", () => {
  test("selects the block in the tree and the scene, then shows its material", () => {
    const harness = createHarness();
    const block = harness.addBlock();

    harness.controller.editMaterial(block.uuid);

    assert.deepEqual(harness.controller.selected, [block.uuid]);
    assert.equal(harness.selection.selected, block.uuid);
    assert.equal(harness.calls.materialShown, 1);
  });
});

describe("HierarchyController.handleReparent", () => {
  function reparent(
    harness: Harness,
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
    const harness = createHarness();
    const a = harness.addBlock({ name: "A" });
    const b = harness.addBlock({ name: "B" });
    const c = harness.addBlock({ name: "C" });

    reparent(harness, [c.uuid], a.uuid, "above");
    assert.deepEqual(shapeOf(harness.hierarchy.nodes()), ["C", "A", "B"]);

    reparent(harness, [c.uuid, a.uuid], b.uuid, "below");
    assert.deepEqual(shapeOf(harness.hierarchy.nodes()), ["B", "C", "A"]);
  });

  test("keeps the drop position when a row changes parent", () => {
    const harness = createHarness();
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

    const harness = createHarness();
    harness.controller.attach({
      document,
      blocks,
      selection,
      hierarchy: new ModelHierarchy({
        document,
        edits: buildEditsOf(createEditorHistory({ document })),
        textureSize: () => kTextureSize,
        poses: blocks
      }),
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
