// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  applyLayoutChange,
  floatPane,
  movePane,
  reconcileLayout,
  stackPane
} from "../../../src/containers/dock/layout.ts";
import { GROUPED_LAYOUT } from "../../fixtures/dockLayout.ts";

describe("Containers.reconcileLayout groups", () => {
  test("builds the declared groups with their declared active pane", () => {
    const snapshot = reconcileLayout(null, GROUPED_LAYOUT);

    assert.deepEqual(snapshot.docks.left.groups, [
      {
        panes: ["general", "blocks", "paint"],
        active: "blocks"
      },
      {
        panes: ["layers"],
        active: "layers"
      }
    ]);
    assert.deepEqual(snapshot.docks.right.groups, []);
  });

  test("activates the first pane when the markup names none", () => {
    const snapshot = reconcileLayout(null, {
      ...GROUPED_LAYOUT,
      docks: [
        {
          key: "left",
          groups: [
            {
              panes: ["general", "blocks"]
            }
          ]
        }
      ]
    });

    assert.equal(snapshot.docks.left.groups[0].active, "general");
  });

  test("stored groups win over the declared grouping", () => {
    const stored = stackPane(
      movePane(reconcileLayout(null, GROUPED_LAYOUT), "paint", "right", 0),
      "layers",
      "right",
      0,
      1
    );
    const snapshot = reconcileLayout(stored, GROUPED_LAYOUT);

    assert.deepEqual(snapshot.docks.left.groups, [
      {
        panes: ["general", "blocks"],
        active: "blocks"
      }
    ]);
    assert.deepEqual(snapshot.docks.right.groups, [
      {
        panes: ["paint", "layers"],
        active: "layers"
      }
    ]);
  });

  test("a pane the store never saw joins its declared siblings", () => {
    const stored = reconcileLayout(null, {
      ...GROUPED_LAYOUT,
      docks: [
        {
          key: "left",
          groups: [
            {
              panes: ["general", "paint"],
              active: "paint"
            }
          ]
        }
      ]
    });
    const snapshot = reconcileLayout(stored, GROUPED_LAYOUT);

    assert.deepEqual(snapshot.docks.left.groups, [
      {
        panes: ["general", "blocks", "paint"],
        active: "paint"
      },
      {
        panes: ["layers"],
        active: "layers"
      }
    ]);
  });

  test("is idempotent when re-run against its own output", () => {
    const stored = stackPane(
      reconcileLayout(null, GROUPED_LAYOUT),
      "layers",
      "left",
      0,
      0
    );
    const once = reconcileLayout(stored, GROUPED_LAYOUT);

    assert.deepEqual(reconcileLayout(once, GROUPED_LAYOUT), once);
  });
});

describe("Containers.movePane groups", () => {
  const base = reconcileLayout(null, GROUPED_LAYOUT);

  test("takes the active pane out of its group and activates a neighbour", () => {
    const moved = movePane(base, "blocks", "right", 0);

    assert.deepEqual(moved.docks.left.groups[0], {
      panes: ["general", "paint"],
      active: "paint"
    });
    assert.deepEqual(moved.docks.right.groups, [
      {
        panes: ["blocks"],
        active: "blocks"
      }
    ]);
  });

  test("opens the collapsed dock it lands in", () => {
    const collapsed = applyLayoutChange(base, {
      type: "dock",
      dock: "right",
      collapsed: true
    });

    assert.equal(movePane(collapsed, "layers", "right", 0).docks.right.collapsed, false);
  });

  test("does not shift the index past a group that keeps its slot", () => {
    const moved = movePane(base, "general", "left", 1);

    assert.deepEqual(
      moved.docks.left.groups.map((group) => group.panes),
      [["blocks", "paint"], ["general"], ["layers"]]
    );
  });
});

describe("Containers.stackPane", () => {
  const base = reconcileLayout(null, GROUPED_LAYOUT);

  test("joins a lone pane into a group and makes it active", () => {
    const stacked = stackPane(base, "layers", "left", 0, 1);

    assert.deepEqual(stacked.docks.left.groups, [
      {
        panes: ["general", "layers", "blocks", "paint"],
        active: "layers"
      }
    ]);
  });

  test("accounts for the slot its own lone pane leaves behind", () => {
    const split = movePane(base, "paint", "left", 0);
    const stacked = stackPane(split, "paint", "left", 2, 0);

    assert.deepEqual(stacked.docks.left.groups, [
      {
        panes: ["general", "blocks"],
        active: "blocks"
      },
      {
        panes: ["paint", "layers"],
        active: "paint"
      }
    ]);
  });

  test("opens the collapsed dock holding the group", () => {
    const collapsed = applyLayoutChange(base, {
      type: "dock",
      dock: "left",
      collapsed: true
    });

    assert.equal(stackPane(collapsed, "layers", "left", 0, 0).docks.left.collapsed, false);
  });

  test("reorders inside a group using an index that counts the pane", () => {
    const stacked = stackPane(base, "general", "left", 0, 3);

    assert.deepEqual(stacked.docks.left.groups[0].panes, [
      "blocks",
      "paint",
      "general"
    ]);
  });

  test("docks a floating pane into a group", () => {
    const floating = floatPane(base, "layers", { x: 4 });
    const stacked = stackPane(floating, "layers", "left", 0, 0);

    assert.deepEqual(stacked.floating, {});
    assert.deepEqual(stacked.docks.left.groups[0].panes, [
      "layers",
      "general",
      "blocks",
      "paint"
    ]);
  });

  test("ignores its own lone slot and an unknown target", () => {
    assert.equal(stackPane(base, "layers", "left", 1, 0), base);
    assert.equal(stackPane(base, "layers", "left", 9, 0), base);
    assert.equal(stackPane(base, "layers", "missing", 0, 0), base);
  });
});
