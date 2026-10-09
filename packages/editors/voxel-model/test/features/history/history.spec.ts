// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  BlockUvLayouts,
  ModelDocument,
  type ModelChange
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import {
  ANIMATION_LIBRARY,
  bindHistoryShortcuts,
  createEditorHistory,
  describeModelChange,
  type EditorHistoryScope
} from "#src/features/history/index.ts";
import { ModelHierarchy } from "#src/model/index.ts";
import {
  buildEditsOf,
  createModelFixture
} from "../../fixtures/model.ts";

// CONSTANTS
const kNoMirror = { x: false, y: false, z: false };
const kScopes: readonly EditorHistoryScope[] = ["build", "material", ANIMATION_LIBRARY];

function changesOf(
  document: ModelDocument,
  edit: () => void
): ModelChange[] {
  const changes: ModelChange[] = [];
  function record(
    change: ModelChange
  ): void {
    changes.push(change);
  }
  document.on("change", record);
  edit();
  document.off("change", record);

  return changes;
}

describe("describeModelChange", () => {
  test("names a step after the node or material it touched", () => {
    const document = new ModelDocument();
    const iron = document.addMaterial({ name: "Iron" })!;
    const arm = document.addBlock({ name: "Arm" })!;

    const labels = changesOf(document, () => {
      document.addBlock({ name: "Leg" });
      document.rename(arm, "Left Arm");
      document.assignMaterial(arm, iron);
      document.changeMaterial(iron, { opacity: 0.5 });
      document.remove(arm);
      document.removeMaterial(iron);
    }).map(describeModelChange);

    assert.deepEqual(labels, [
      "Add Leg",
      "Rename Arm",
      "Set material of Left Arm",
      "Edit Iron",
      "Delete Left Arm",
      "Delete Iron"
    ]);
  });
});

describe("bindHistoryShortcuts", () => {
  test("binds undo and redo chords to the active history, and releases them", () => {
    const bound = new Map<string, () => void>();
    const calls: string[] = [];
    const release = bindHistoryShortcuts({
      keyboard: {
        bind: (chords, handler) => {
          const names = [chords].flat().map(String);
          for (const name of names) {
            bound.set(name, () => handler(new KeyboardEvent("keydown")));
          }

          return () => {
            for (const name of names) {
              bound.delete(name);
            }
          };
        }
      },
      history: {
        undo: () => calls.push("undo") > 0,
        redo: () => calls.push("redo") > 0
      }
    });

    bound.get("Mod+z")?.();
    bound.get("Mod+y")?.();
    bound.get("Mod+Shift+z")?.();
    assert.deepEqual(calls, ["undo", "redo", "redo"]);

    release();
    assert.equal(bound.size, 0);
  });
});

describe("ModelHierarchy undo steps", () => {
  function createHarness() {
    const fixture = createModelFixture();
    const history = createEditorHistory({ document: fixture.document });
    const hierarchy = new ModelHierarchy({
      document: fixture.document,
      edits: buildEditsOf(history),
      textureSize: () => {
        return { x: 256, y: 256 };
      },
      poses: fixture.blocks
    });

    return { ...fixture, history, hierarchy };
  }

  test("undoes a mirrored duplicate with children in one step", () => {
    const { addBlock, document, history, hierarchy } = createHarness();
    const body = addBlock({ name: "Body" });
    addBlock({ name: "Arm", parentId: body.uuid });
    const before = [...document.tree.values()];

    hierarchy.duplicate(body.uuid, {
      name: "Body Copy",
      includeChildren: true,
      mirrorAxes: { ...kNoMirror, x: true }
    });

    assert.equal(history.state("build").undoLabel, "Duplicate Body");
    assert.equal(history.undo("build"), true);
    assert.deepEqual([...document.tree.values()], before);
    assert.equal(history.state("build").canUndo, true);
  });

  test("undoes a delete that kept its children in one step", () => {
    const { addBlock, document, history, hierarchy } = createHarness();
    const body = addBlock({ name: "Body" });
    const arm = addBlock({ name: "Arm", parentId: body.uuid });

    hierarchy.remove(body.uuid, { withChildren: false });

    assert.equal(history.state("build").undoLabel, "Delete Body");
    assert.equal(history.undo("build"), true);
    assert.equal(document.tree.get(arm.uuid)?.parentId, body.uuid);
    assert.equal(document.tree.childrenOf(null).length, 1);
  });

  test("tree edits and transforms share Build, materials keep their own", () => {
    const { addBlock, document, history, hierarchy } = createHarness();
    const body = addBlock({ name: "Body" });
    const rest = document.tree.block(body.uuid)!.transform;

    hierarchy.rename(body.uuid, "Torso");
    const metal = document.addMaterial({ name: "Metal" })!;
    document.transform(body.uuid, { ...rest, position: { x: 4, y: 0, z: 0 } });

    assert.equal(history.state("build").undoLabel, "Transform Torso");
    assert.equal(history.undo("build"), true);
    assert.equal(history.undo("build"), true);
    assert.equal(document.tree.get(body.uuid)?.name, "Body");
    assert.notEqual(document.tree.materials.get(metal), undefined);

    assert.equal(history.state("material").undoLabel, "Add material Metal");
    assert.equal(history.undo("material"), true);
    assert.equal(document.tree.materials.get(metal), undefined);
  });

  test("a UV edit is in no history, and leaves the Build step before it undoable", () => {
    const { addBlock, document, history } = createHarness();
    const body = addBlock({ name: "Body" });
    const rest = document.tree.block(body.uuid)!.transform;
    document.transform(body.uuid, { ...rest, position: { x: 4, y: 0, z: 0 } });
    const steps = kScopes.map((scope) => history.state(scope).undoCount);

    const uv = BlockUvLayouts.net({ x: 32, y: 0 });
    document.setUv(body.uuid, uv);

    assert.deepEqual(kScopes.map((scope) => history.state(scope).undoCount), steps);
    assert.equal(history.undo("build"), true);
    assert.equal(document.tree.block(body.uuid)?.transform.position.x, rest.position.x);
    assert.deepEqual(document.tree.block(body.uuid)?.uv, uv);
  });
});
