// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { InvalidEntryError } from "@jolly-pixel/asset.common";
import { CommandHistory } from "@jolly-pixel/history";

// Import Internal Dependencies
import { ModelDocument, type ModelChange } from "#src/model/ModelDocument.ts";
import { modelHistoryKeys } from "#src/model/history/modelHistoryKeys.ts";
import { BlockTransform } from "#src/model/nodes/BlockTransform.ts";
import { BlockUvLayouts } from "#src/model/nodes/BlockUvLayouts.ts";
import { invert } from "#src/model/history/modelInverse.ts";
import type { ModelTreeReader } from "#src/model/ModelTree.ts";

// CONSTANTS
const kScope = "model";

type ModelHistory = CommandHistory<typeof kScope>;

interface Fixture {
  document: ModelDocument;
  history: ModelHistory;
  ids: Record<string, string>;
}

function createHistory(
  document: ModelDocument,
  options: { limit?: number; label?: (change: ModelChange) => string; } = {}
): ModelHistory {
  const history = new CommandHistory<typeof kScope>({ limit: options.limit });
  history.register({
    id: "model",
    document,
    keys: modelHistoryKeys(document.tree),
    resolveScope: () => kScope,
    ...options.label === undefined ? {} : { label: options.label }
  });

  return history;
}

function createFixture(): Fixture {
  const document = new ModelDocument();
  const metal = document.addMaterialFolder({ name: "Metals" })!;
  const iron = document.addMaterial({ name: "Iron", parentId: metal })!;
  const glass = document.addMaterial({ name: "Glass" })!;
  const body = document.addBlock({ name: "Body", materialId: iron })!;
  const limbs = document.addFolder({ name: "Limbs", parentId: body })!;
  const arm = document.addBlock({ name: "Arm", parentId: limbs, materialId: iron })!;
  const hand = document.addBlock({ name: "Hand", parentId: arm })!;
  const leg = document.addBlock({ name: "Leg", parentId: limbs })!;
  const head = document.addBlock({ name: "Head", parentId: body })!;
  const walk = "walk-set";
  document.linkAnimationSet({ id: walk, kind: "voxelanimation" });
  document.remapAnimationTrack(walk, "Body/Tail", null);

  return {
    document,
    history: createHistory(document),
    ids: { metal, iron, glass, body, limbs, arm, hand, leg, head, walk }
  };
}

function readShape(
  tree: ModelTreeReader
): unknown {
  function nodes(
    parentId: string | null
  ): unknown[] {
    return tree.listChildren(parentId).map((node) => [node, nodes(node.id)]);
  }
  function materials(
    parentId: string | null
  ): unknown[] {
    return tree.materials.listChildren(parentId).map((entry) => [entry, materials(entry.id)]);
  }

  return {
    nodes: nodes(null),
    materials: materials(null),
    animationSets: [...tree.animationSets.values()]
  };
}

describe("invert", () => {
  test("throws for a command the tree would refuse instead of undoing nothing", () => {
    const { document } = createFixture();

    assert.throws(
      () => invert(document.tree, { action: "node-renamed", id: "missing", name: "A" }),
      InvalidEntryError
    );
  });
});

describe("model history round trips", () => {
  const kEdits: Record<string, (fixture: Fixture) => void> = {
    "add a block": ({ document, ids }) => {
      document.addBlock({ name: "Tail", parentId: ids.body, beforeId: ids.limbs });
    },
    "remove a subtree": ({ document, ids }) => {
      document.remove(ids.limbs);
    },
    "rename a node": ({ document, ids }) => {
      document.rename(ids.arm, "Left Arm");
    },
    "move a node with transforms": ({ document, ids }) => {
      document.move(ids.arm, null, {
        transforms: [{ id: ids.arm, transform: BlockTransform.create({ position: { x: 3, y: 0, z: 0 } }) }],
        beforeId: ids.body
      });
    },
    "transform and flip a block": ({ document, ids }) => {
      document.transform(
        ids.hand,
        BlockTransform.create({ scale: { x: 2, y: 1, z: 1 } }),
        { x: true, y: false, z: false }
      );
    },
    "change a UV layout": ({ document, ids }) => {
      document.updateUv(ids.leg, {
        state: "stacked",
        rect: { x: 32, y: 0, width: 8, height: 8 }
      });
    },
    "reshape blocks with their UV layouts": ({ document, ids }) => {
      document.updateShape(
        ids.leg,
        { type: "plane" },
        BlockUvLayouts.net({ x: 48, y: 0 }, { type: "plane" })
      );
      document.updateShape(ids.leg, { type: "box" }, BlockUvLayouts.net({ x: 64, y: 0 }));
    },
    "assign and clear a material": ({ document, ids }) => {
      document.assignMaterial(ids.leg, ids.glass);
      document.assignMaterial(ids.arm, null);
    },
    "add materials and folders": ({ document, ids }) => {
      document.addMaterial({ name: "Gold", parentId: ids.metal, beforeId: ids.iron });
      document.addMaterialFolder({ name: "Woods" });
    },
    "remove a used material folder": ({ document, ids }) => {
      document.removeMaterial(ids.metal);
    },
    "remove a folder keeping its materials": ({ document, ids }) => {
      document.removeMaterial(ids.metal, { keepContents: true });
    },
    "move and rename a material": ({ document, ids }) => {
      document.moveMaterial(ids.glass, ids.metal, ids.iron);
      document.renameMaterial(ids.iron, "Steel");
    },
    "change a material surface": ({ document, ids }) => {
      document.changeMaterial(ids.iron, { opacity: 0.5, color: "#ff0000" });
    },
    "link an animation set": ({ document }) => {
      document.linkAnimationSet({ id: "run-set", kind: "voxelanimation" });
    },
    "unlink an animation set": ({ document, ids }) => {
      document.unlinkAnimationSet(ids.walk);
    },
    "link the model's own set and share it": ({ document }) => {
      document.linkAnimationSet({ id: "own-set", kind: "voxelanimation" }, { own: true });
      document.shareAnimationSet("own-set");
    },
    "remap, change and drop track remaps": ({ document, ids }) => {
      document.remapAnimationTrack(ids.walk, "Body/Arm", "Body/Leg");
      document.remapAnimationTrack(ids.walk, "Body/Tail", "Body/Head");
      document.clearAnimationTrackRemap(ids.walk, "Body/Tail");
    }
  };

  for (const [name, edit] of Object.entries(kEdits)) {
    test(`undoes and redoes: ${name}`, () => {
      const fixture = createFixture();
      const { document, history } = fixture;
      const before = readShape(document.tree);

      history.record(kScope, name, () => edit(fixture));
      const after = readShape(document.tree);
      assert.notDeepEqual(after, before);

      assert.equal(history.undo(kScope), true);
      assert.deepEqual(readShape(document.tree), before);
      assert.equal(history.redo(kScope), true);
      assert.deepEqual(readShape(document.tree), after);
      assert.equal(history.undo(kScope), true);
      assert.deepEqual(readShape(document.tree), before);
    });
  }
});
