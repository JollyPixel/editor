// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  CommandHistory,
  type HistoryStepInfo
} from "@jolly-pixel/history";

// Import Internal Dependencies
import {
  ModelDocument,
  type ModelChange
} from "#src/model/ModelDocument.ts";
import { modelHistoryKeys } from "#src/model/modelHistoryKeys.ts";
import { createBlockTransform } from "#src/model/blockTransform.ts";
import { createMaterialSurface } from "#src/model/materialSurface.ts";
import { inverseOf } from "#src/model/modelInverse.ts";
import { InvalidModelTreeError } from "#src/model/errors/InvalidModelTreeError.ts";
import type { ModelTreeReader } from "#src/model/ModelTree.ts";
import { networkCommand } from "../helpers/commands.ts";

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
    scopeOf: () => kScope,
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

function shapeOf(
  tree: ModelTreeReader
): unknown {
  function nodes(
    parentId: string | null
  ): unknown[] {
    return tree.childrenOf(parentId).map((node) => [node, nodes(node.id)]);
  }
  function materials(
    parentId: string | null
  ): unknown[] {
    return tree.materials.childrenOf(parentId).map((entry) => [entry, materials(entry.id)]);
  }

  return {
    nodes: nodes(null),
    materials: materials(null),
    animationSets: [...tree.animationSets.values()]
  };
}

describe("inverseOf", () => {
  test("throws for a command the tree would refuse instead of undoing nothing", () => {
    const { document } = createFixture();

    assert.throws(
      () => inverseOf(document.tree, { action: "node-renamed", id: "missing", name: "A" }),
      InvalidModelTreeError
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
        transforms: [{ id: ids.arm, transform: createBlockTransform({ position: { x: 3, y: 0, z: 0 } }) }],
        beforeId: ids.body
      });
    },
    "transform and flip a block": ({ document, ids }) => {
      document.transform(
        ids.hand,
        createBlockTransform({ scale: { x: 2, y: 1, z: 1 } }),
        { x: true, y: false, z: false }
      );
    },
    "change a UV layout": ({ document, ids }) => {
      document.setUv(ids.leg, {
        state: "stacked",
        rect: { x: 32, y: 0, width: 8, height: 8 }
      });
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
      const before = shapeOf(document.tree);

      history.record(kScope, name, () => edit(fixture));
      const after = shapeOf(document.tree);
      assert.notDeepEqual(after, before);

      assert.equal(history.undo(kScope), true);
      assert.deepEqual(shapeOf(document.tree), before);
      assert.equal(history.redo(kScope), true);
      assert.deepEqual(shapeOf(document.tree), after);
      assert.equal(history.undo(kScope), true);
      assert.deepEqual(shapeOf(document.tree), before);
    });
  }
});

describe("modelHistoryKeys", () => {
  test("records each local edit as its own step, in order", () => {
    const { document, history, ids } = createFixture();
    const before = shapeOf(document.tree);

    document.rename(ids.arm, "A");
    const renamed = shapeOf(document.tree);
    document.rename(ids.arm, "B");

    history.undo(kScope);
    assert.deepEqual(shapeOf(document.tree), renamed);
    history.undo(kScope);
    assert.deepEqual(shapeOf(document.tree), before);
    assert.equal(history.state(kScope).canUndo, false);
    assert.equal(history.state(kScope).canRedo, true);
  });

  test("groups a transaction into one step, nested ones included", () => {
    const { document, history, ids } = createFixture();
    const before = shapeOf(document.tree);

    history.record(kScope, "Outer", () => {
      document.rename(ids.arm, "A");
      history.record(kScope, "Inner", () => document.remove(ids.head));
    });

    assert.equal(history.state(kScope).undoLabel, "Outer");
    history.undo(kScope);
    assert.deepEqual(shapeOf(document.tree), before);
    assert.equal(history.state(kScope).canUndo, false);
  });

  test("names a single-change step with the adapter's label and keeps the name for redo", () => {
    const document = new ModelDocument();
    const history = createHistory(document, {
      label: ({ command }) => `Do ${command.action}`
    });

    document.addBlock({ name: "Arm" });
    assert.equal(history.state(kScope).undoLabel, "Do node-added");

    history.undo(kScope);
    const { canUndo, canRedo, undoLabel, redoLabel } = history.state(kScope);
    assert.deepEqual([canUndo, canRedo, undoLabel, redoLabel], [false, true, null, "Do node-added"]);
  });

  test("ignores remote edits and a new local edit drops the redo steps", () => {
    const { document, history, ids } = createFixture();

    document.apply(networkCommand({ action: "node-renamed", id: ids.leg, name: "Peer" }));
    assert.equal(history.state(kScope).canUndo, false);

    document.rename(ids.arm, "A");
    history.undo(kScope);
    document.rename(ids.head, "H");

    assert.equal(history.state(kScope).canRedo, false);
  });

  test("passes over a step a peer changed since, naming the peer, and undoes the one below", () => {
    const { document, history, ids } = createFixture();
    const skips: HistoryStepInfo[] = [];
    history.on("skipped", (_scope, step) => skips.push(step));

    document.rename(ids.head, "Skull");
    history.record(kScope, "Rename arm", () => document.rename(ids.arm, "A"));
    document.apply(networkCommand(
      { action: "node-renamed", id: ids.arm, name: "Peer" },
      { clientId: "peer-1" }
    ), "peer-1");

    assert.equal(history.state(kScope).undoLabel, null);
    assert.equal(history.undo(kScope), true);
    assert.deepEqual(skips, [{ label: "Rename arm", refused: { reason: "peer", clientId: "peer-1" } }]);
    assert.equal(document.tree.get(ids.arm)?.name, "Peer");
    assert.equal(document.tree.get(ids.head)?.name, "Head");
  });

  test("still undoes a move after a peer renamed the same block", () => {
    const { document, history, ids } = createFixture();
    const transform = createBlockTransform({ position: { x: 3, y: 0, z: 0 } });

    document.transform(ids.arm, transform);
    document.apply(networkCommand({ action: "node-renamed", id: ids.arm, name: "Peer" }));

    assert.equal(history.undo(kScope), true);
    assert.notDeepEqual(document.tree.block(ids.arm)?.transform, transform);
    assert.equal(document.tree.get(ids.arm)?.name, "Peer");
  });

  test("refuses undoing a creation after a peer added inside it", () => {
    const { document, history } = createFixture();
    const folder = document.addFolder({ name: "Props" })!;

    document.apply(networkCommand({
      action: "node-added",
      node: { kind: "folder", id: "peer-box", parentId: folder, name: "Box" }
    }));

    assert.equal(history.state(kScope).canUndo, false);
  });

  test("still undoes when peers only touched other nodes", () => {
    const { document, history, ids } = createFixture();

    document.rename(ids.arm, "A");
    document.apply(networkCommand({ action: "node-renamed", id: ids.leg, name: "Peer" }));

    assert.equal(history.undo(kScope), true);
    assert.equal(document.tree.get(ids.arm)?.name, "Arm");
    assert.equal(document.tree.get(ids.leg)?.name, "Peer");
  });

  test("re-adds a node last when its old next sibling is gone", () => {
    const { document, history, ids } = createFixture();

    document.remove(ids.arm);
    document.apply(networkCommand({ action: "node-removed", id: ids.leg }));

    assert.equal(history.undo(kScope), true);
    assert.deepEqual(
      document.tree.childrenOf(ids.limbs).map(({ id }) => id),
      [ids.arm]
    );
    assert.deepEqual(
      document.tree.childrenOf(ids.arm).map(({ id }) => id),
      [ids.hand]
    );
  });

  test("keeps steps across a reload and passes over the ones it changed", () => {
    const { document, history, ids } = createFixture();
    document.rename(ids.head, "Skull");
    document.rename(ids.arm, "A");

    const nodes = [...document.tree.values()].map((node) => (node.id === ids.arm ?
      {
        ...node,
        name: "Reloaded"
      } :
      node));
    document.load({
      nodes,
      materials: [...document.tree.materials.values()],
      animationSets: []
    });

    assert.equal(history.undo(kScope), true);
    assert.equal(document.tree.get(ids.arm)?.name, "Reloaded");
    assert.equal(document.tree.get(ids.head)?.name, "Head");
  });

  test("records nothing for an edit the tree refused", () => {
    const { document, history } = createFixture();

    document.rename("missing", "A");

    assert.equal(history.state(kScope).canUndo, false);
  });

  test("undoes a material field a peer left alone, keeping the field the peer changed", () => {
    const document = new ModelDocument();
    const history = createHistory(document);
    const id = document.addMaterial({ name: "Iron", surface: createMaterialSurface({ opacity: 0.4 }) })!;
    const { color } = document.tree.materials.material(id)!.surface;

    document.changeMaterial(id, { color: "#00ff00" });
    document.apply(networkCommand({ action: "material-changed", id, surface: { opacity: 0.9 } }));

    assert.equal(history.undo(kScope), true);
    const surface = document.tree.materials.material(id)?.surface;
    assert.deepEqual([surface?.color, surface?.opacity], [color, 0.9]);
  });
});
