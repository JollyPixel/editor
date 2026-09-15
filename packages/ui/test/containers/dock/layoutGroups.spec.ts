// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  applyLayoutChange,
  floatPane,
  movePane,
  panePlacement,
  paneVisible,
  reconcileLayout,
  stackPane,
  type DeclaredLayout
} from "../../../src/containers/dock/layout.ts";

// CONSTANTS
const kDeclared: DeclaredLayout = {
  docks: [
    {
      key: "left",
      groups: [
        {
          panes: ["general", "blocks", "paint"],
          active: "blocks"
        },
        {
          panes: ["layers"]
        }
      ]
    },
    {
      key: "right",
      groups: []
    }
  ],
  floating: [],
  locked: []
};

describe("Containers.reconcileLayout groups", () => {
  test("builds the declared groups with their declared active pane", () => {
    const snapshot = reconcileLayout(null, kDeclared);

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
      ...kDeclared,
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
      movePane(reconcileLayout(null, kDeclared), "paint", "right", 0),
      "layers",
      "right",
      0,
      1
    );
    const snapshot = reconcileLayout(stored, kDeclared);

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
      ...kDeclared,
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
    const snapshot = reconcileLayout(stored, kDeclared);

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
      reconcileLayout(null, kDeclared),
      "layers",
      "left",
      0,
      0
    );
    const once = reconcileLayout(stored, kDeclared);

    assert.deepEqual(reconcileLayout(once, kDeclared), once);
  });
});

describe("Containers.movePane groups", () => {
  const base = reconcileLayout(null, kDeclared);

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
  const base = reconcileLayout(null, kDeclared);

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

describe("Containers.applyLayoutChange group", () => {
  const base = reconcileLayout(null, kDeclared);

  test("activates a pane inside its group", () => {
    const next = applyLayoutChange(base, {
      type: "group",
      pane: "paint"
    });

    assert.equal(next.docks.left.groups[0].active, "paint");
    assert.equal(base.docks.left.groups[0].active, "blocks");
  });

  test("returns the same snapshot when nothing changes", () => {
    assert.equal(
      applyLayoutChange(base, {
        type: "group",
        pane: "blocks"
      }),
      base
    );
    assert.equal(
      applyLayoutChange(base, {
        type: "group",
        pane: "missing"
      }),
      base
    );
  });
});

describe("Containers.paneVisible", () => {
  const base = reconcileLayout(null, kDeclared);

  test("shows only the active pane of a group", () => {
    assert.equal(paneVisible(base, "blocks"), true);
    assert.equal(paneVisible(base, "paint"), false);
    assert.deepEqual(panePlacement(base, "paint"), {
      dock: "left",
      index: 0,
      count: 2,
      group: ["general", "blocks", "paint"],
      active: false
    });
  });

  test("hides every pane of a collapsed dock", () => {
    const collapsed = applyLayoutChange(base, {
      type: "dock",
      dock: "left",
      collapsed: true
    });

    assert.equal(paneVisible(collapsed, "blocks"), false);
    assert.equal(paneVisible(collapsed, "layers"), false);
  });

  test("hides a folded lone pane but not a folded grouped one", () => {
    const folded = applyLayoutChange(
      applyLayoutChange(base, {
        type: "pane",
        pane: "layers",
        collapsed: true
      }),
      {
        type: "pane",
        pane: "blocks",
        collapsed: true
      }
    );

    assert.equal(paneVisible(folded, "layers"), false);
    assert.equal(paneVisible(folded, "blocks"), true);
  });

  test("shows a floating pane and hides an unknown one", () => {
    assert.equal(paneVisible(floatPane(base, "paint", {}), "paint"), true);
    assert.equal(paneVisible(base, "missing"), false);
  });
});
