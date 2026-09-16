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
  type DeclaredLayout,
  type DockState
} from "../../../src/containers/dock/layout.ts";
import {
  parseLayout,
  serializeLayout
} from "../../../src/containers/dock/layoutParser.ts";

// CONSTANTS
const kDeclared: DeclaredLayout = {
  docks: [
    {
      key: "left",
      double: true,
      groups: [
        {
          panes: ["general", "blocks"],
          active: "general"
        },
        {
          panes: ["layers"]
        }
      ],
      secondary: []
    },
    {
      key: "right",
      groups: [
        {
          panes: ["inspector"]
        }
      ]
    }
  ],
  floating: [],
  locked: []
};

function columns(
  state: DockState
): string[][][] {
  return [
    state.groups.map((group) => group.panes),
    (state.secondary ?? []).map((group) => group.panes)
  ];
}

describe("Containers.layout double docks", () => {
  const base = reconcileLayout(null, kDeclared);

  test("gives only double docks a secondary column", () => {
    assert.deepEqual(base.docks.left.secondary, []);
    assert.equal(base.docks.right.secondary, undefined);
  });

  test("opens the secondary column with a moved pane", () => {
    const moved = movePane(base, "layers", {
      dock: "left",
      column: "secondary"
    }, 0);

    assert.deepEqual(columns(moved.docks.left), [
      [["general", "blocks"]],
      [["layers"]]
    ]);
    assert.deepEqual(panePlacement(moved, "layers"), {
      dock: "left",
      column: "secondary",
      index: 0,
      count: 1,
      group: ["layers"],
      active: true
    });
  });

  test("ignores a secondary target on a dock that is not double", () => {
    const moved = movePane(base, "layers", {
      dock: "right",
      column: "secondary"
    }, 0);

    assert.equal(moved, base);
  });

  test("closes the secondary column when its last pane leaves", () => {
    const opened = movePane(base, "layers", {
      dock: "left",
      column: "secondary"
    }, 0);
    const back = movePane(opened, "layers", "left", 0);

    assert.deepEqual(columns(back.docks.left), [
      [["layers"], ["general", "blocks"]],
      []
    ]);
  });

  test("moves secondary panes into an emptied primary column", () => {
    const opened = movePane(base, "inspector", {
      dock: "left",
      column: "secondary"
    }, 0);
    const layers = floatPane(opened, "layers", {});
    const emptied = movePane(layers, "general", "right", 0);
    const drained = movePane(emptied, "blocks", "right", 0);

    assert.deepEqual(columns(drained.docks.left), [
      [["inspector"]],
      []
    ]);
  });

  test("keeps a pane dropped into the secondary column of its own dock", () => {
    const opened = movePane(base, "layers", {
      dock: "left",
      column: "secondary"
    }, 0);
    const stacked = stackPane(opened, "blocks", {
      dock: "left",
      column: "secondary"
    }, 0, 1);

    assert.deepEqual(columns(stacked.docks.left), [
      [["general"]],
      [["layers", "blocks"]]
    ]);
  });

  test("reorders within the secondary column", () => {
    const one = movePane(base, "layers", {
      dock: "left",
      column: "secondary"
    }, 0);
    const two = movePane(one, "inspector", {
      dock: "left",
      column: "secondary"
    }, 1);
    const swapped = movePane(two, "layers", {
      dock: "left",
      column: "secondary"
    }, 2);

    assert.deepEqual(columns(swapped.docks.left)[1], [
      ["inspector"],
      ["layers"]
    ]);
  });

  test("switches the active tab of a secondary group", () => {
    const opened = movePane(base, "layers", {
      dock: "left",
      column: "secondary"
    }, 0);
    const stacked = stackPane(opened, "blocks", {
      dock: "left",
      column: "secondary"
    }, 0, 1);
    const shown = applyLayoutChange(stacked, {
      type: "group",
      pane: "layers"
    });

    assert.equal(shown.docks.left.secondary?.[0].active, "layers");
  });

  test("hides secondary panes when the dock collapses", () => {
    const opened = movePane(base, "layers", {
      dock: "left",
      column: "secondary"
    }, 0);
    const collapsed = applyLayoutChange(opened, {
      type: "dock",
      dock: "left",
      collapsed: true
    });

    assert.equal(paneVisible(opened, "layers"), true);
    assert.equal(paneVisible(collapsed, "layers"), false);
  });

  test("restores a stored secondary column", () => {
    const opened = movePane(base, "layers", {
      dock: "left",
      column: "secondary"
    }, 0);
    const restored = reconcileLayout(
      parseLayout(serializeLayout(opened)),
      kDeclared
    );

    assert.deepEqual(columns(restored.docks.left), [
      [["general", "blocks"]],
      [["layers"]]
    ]);
  });

  test("places authored secondary panes", () => {
    const declared: DeclaredLayout = {
      ...kDeclared,
      docks: [
        {
          key: "left",
          double: true,
          groups: [
            {
              panes: ["general"]
            }
          ],
          secondary: [
            {
              panes: ["layers"]
            }
          ]
        }
      ]
    };
    const snapshot = reconcileLayout(null, declared);

    assert.deepEqual(columns(snapshot.docks.left), [
      [["general"]],
      [["layers"]]
    ]);
  });

  test("returns secondary panes to the primary column when double is removed", () => {
    const opened = movePane(base, "layers", {
      dock: "left",
      column: "secondary"
    }, 0);
    const single: DeclaredLayout = {
      ...kDeclared,
      docks: [
        {
          key: "left",
          groups: kDeclared.docks[0].groups
        },
        kDeclared.docks[1]
      ]
    };
    const restored = reconcileLayout(opened, single);

    assert.deepEqual(columns(restored.docks.left), [
      [["general", "blocks"], ["layers"]],
      []
    ]);
    assert.equal(restored.docks.left.secondary, undefined);
  });

  test("moves a stored secondary into an empty primary column", () => {
    const restored = reconcileLayout(
      {
        ...base,
        docks: {
          left: {
            groups: [],
            secondary: [
              {
                panes: ["general", "blocks"],
                active: "blocks"
              },
              {
                panes: ["layers"],
                active: "layers"
              }
            ]
          },
          right: base.docks.right
        }
      },
      kDeclared
    );

    assert.deepEqual(columns(restored.docks.left), [
      [["general", "blocks"], ["layers"]],
      []
    ]);
    assert.equal(restored.docks.left.groups[0].active, "blocks");
  });
});

describe("Containers.parseLayout secondary column", () => {
  test("keeps a secondary column only when stored as an array", () => {
    const parsed = parseLayout(JSON.stringify({
      v: 1,
      docks: {
        left: {
          groups: [],
          secondary: [
            {
              panes: ["a"],
              active: "missing"
            },
            {
              panes: []
            }
          ]
        },
        right: {
          groups: [],
          secondary: "nope"
        }
      }
    }));

    assert.deepEqual(parsed?.docks.left.secondary, [
      {
        panes: ["a"],
        active: "a"
      }
    ]);
    assert.equal(parsed?.docks.right.secondary, undefined);
  });
});
