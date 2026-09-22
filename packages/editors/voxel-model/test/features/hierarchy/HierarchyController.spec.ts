// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";

// Import Internal Dependencies
import {
  ModelHierarchy,
  type HierarchyNode
} from "#src/model/index.ts";
import { PresenceStore } from "#src/state/index.ts";
import {
  HierarchyController,
  type HierarchyDialogs
} from "#src/features/hierarchy/HierarchyController.ts";
import type {
  HierarchyNameContext,
  HierarchyNameResult
} from "#src/features/hierarchy/dialogs/HierarchyNameDialog.ts";
import type {
  HierarchyDuplicateContext,
  HierarchyDuplicateResult
} from "#src/features/hierarchy/dialogs/HierarchyDuplicateDialog.ts";
import type {
  HierarchyDeleteContext,
  HierarchyDeleteResult
} from "#src/features/hierarchy/dialogs/HierarchyDeleteDialog.ts";
import {
  createModelFixture,
  type ModelFixture
} from "../../fixtures/model.ts";

// CONSTANTS
const kNoMirror = {
  x: false,
  y: false,
  z: false
};

interface DialogAnswers {
  name?: HierarchyNameResult | null;
  duplicate?: HierarchyDuplicateResult | null;
  delete?: HierarchyDeleteResult | null;
}

interface DialogCalls {
  name: HierarchyNameContext[];
  duplicate: HierarchyDuplicateContext[];
  delete: HierarchyDeleteContext[];
}

interface Harness extends ModelFixture {
  controller: HierarchyController;
  hierarchy: ModelHierarchy;
  calls: DialogCalls;
}

function createHarness(
  answers: DialogAnswers = {}
): Harness {
  const fixture = createModelFixture();
  const { document, blocks } = fixture;
  const hierarchy = new ModelHierarchy({
    document,
    regions: {
      create: () => undefined,
      copy: () => undefined
    },
    poses: blocks
  });
  const calls: DialogCalls = {
    name: [],
    duplicate: [],
    delete: []
  };
  const dialogs: HierarchyDialogs = {
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
    }
  };
  const host: ReactiveControllerHost = {
    addController: () => undefined,
    removeController: () => undefined,
    requestUpdate: () => undefined,
    updateComplete: Promise.resolve(true)
  };
  const controller = new HierarchyController(host, dialogs);
  controller.attach({
    document,
    blocks,
    hierarchy,
    presence: new PresenceStore()
  });

  return {
    ...fixture,
    controller,
    hierarchy,
    calls
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
  harness.blocks.select(block);

  return block.uuid;
}

describe("HierarchyController.addBlock", () => {
  test("offers nesting only when a row is selected", async() => {
    const harness = createHarness();

    await harness.controller.addBlock();
    selectBlock(harness, "Body");
    await harness.controller.addBlock();

    assert.deepEqual(harness.calls.name, [
      {
        heading: "New Block",
        fieldLabel: "Block name",
        defaultName: "Block",
        offerAddAsChild: false
      },
      {
        heading: "New Block",
        fieldLabel: "Block name",
        defaultName: "Block",
        offerAddAsChild: true
      }
    ]);
  });

  test("nests the block under the selection when asked to", async() => {
    const harness = createHarness({
      name: {
        name: "Arm",
        addAsChild: true
      }
    });
    selectBlock(harness, "Body");

    await harness.controller.addBlock();

    assert.deepEqual(shapeOf(harness.hierarchy.nodes()), [
      ["Body", ["Arm"]]
    ]);
  });

  test("adds at the root when nesting is declined", async() => {
    const harness = createHarness({
      name: {
        name: "Arm",
        addAsChild: false
      }
    });
    selectBlock(harness, "Body");

    await harness.controller.addBlock();

    assert.deepEqual(shapeOf(harness.hierarchy.nodes()), ["Body", "Arm"]);
  });

  test("falls back to the default name when the name is blank", async() => {
    const harness = createHarness({
      name: {
        name: "",
        addAsChild: false
      }
    });

    await harness.controller.addBlock();

    assert.deepEqual(shapeOf(harness.hierarchy.nodes()), ["Block"]);
  });

  test("adds nothing when the dialog is dismissed", async() => {
    const harness = createHarness();

    await harness.controller.addBlock();

    assert.deepEqual(harness.hierarchy.nodes(), []);
  });
});

describe("HierarchyController.addFolder", () => {
  test("prompts for a folder and falls back to its default name", async() => {
    const harness = createHarness({
      name: {
        name: "",
        addAsChild: false
      }
    });

    await harness.controller.addFolder();

    assert.deepEqual(harness.calls.name, [
      {
        heading: "New Folder",
        fieldLabel: "Folder name",
        defaultName: "Folder",
        offerAddAsChild: false
      }
    ]);
    const [folder] = harness.hierarchy.nodes();
    assert.equal(folder.kind, "folder");
    assert.equal(folder.name, "Folder");
  });
});

describe("HierarchyController.duplicateSelected", () => {
  test("opens no dialog without a selection", async() => {
    const harness = createHarness();

    await harness.controller.duplicateSelected();

    assert.deepEqual(harness.calls.duplicate, []);
  });

  test("selects and expands the copy of a subtree", async() => {
    const harness = createHarness({
      duplicate: {
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

    assert.deepEqual(harness.calls.duplicate, [{ hasChildren: true }]);
    assert.equal(harness.hierarchy.nodes().length, 2);
    const [copyId] = harness.controller.selected;
    assert.notEqual(copyId, bodyUuid);
    assert.equal(harness.blocks.selected?.uuid, copyId);
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
    assert.equal(harness.blocks.selected, null);
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

describe("HierarchyController.attach", () => {
  test("expands the folders of a document loaded before attaching", () => {
    const fixture = createModelFixture();
    const { document, blocks } = fixture;
    const folderId = document.addFolder({ name: "Limbs" });
    document.addBlock({
      name: "Arm",
      parentId: folderId
    });

    const harness = createHarness();
    harness.controller.attach({
      document,
      blocks,
      hierarchy: new ModelHierarchy({
        document,
        regions: {
          create: () => undefined,
          copy: () => undefined
        },
        poses: blocks
      }),
      presence: new PresenceStore()
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
