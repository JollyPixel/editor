// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  dockPanes,
  emptyLayout,
  reconcileLayout,
  type LayoutSnapshot
} from "../../../src/containers/dock/layout.ts";
import { DECLARED_LAYOUT } from "../../fixtures/dockLayout.ts";

describe("Containers.reconcileLayout", () => {
  test("drops docks the markup no longer declares", () => {
    const stored: LayoutSnapshot = {
      ...emptyLayout(),
      docks: {
        bottom: {
          size: 180,
          groups: [
            {
              panes: ["hierarchy"],
              active: "hierarchy"
            }
          ]
        }
      }
    };
    const snapshot = reconcileLayout(
      stored,
      DECLARED_LAYOUT
    );

    assert.equal(
      snapshot.docks.bottom,
      undefined
    );
    assert.deepEqual(
      dockPanes(snapshot.docks.left),
      ["hierarchy"]
    );
  });

  test("carries dock geometry across for docks that survive", () => {
    const stored: LayoutSnapshot = {
      ...emptyLayout(),
      docks: {
        left: {
          size: 320,
          collapsed: true,
          groups: [
            {
              panes: ["hierarchy"],
              active: "hierarchy"
            }
          ]
        }
      }
    };
    const snapshot = reconcileLayout(
      stored,
      DECLARED_LAYOUT
    );

    assert.equal(snapshot.docks.left.size, 320);
    assert.equal(snapshot.docks.left.collapsed, true);
    assert.equal(snapshot.docks.right.collapsed, false);
    assert.equal(snapshot.docks.right.size, undefined);
  });

  test("carries pane collapse across", () => {
    const stored: LayoutSnapshot = {
      ...emptyLayout(),
      panes: {
        inspector: {
          collapsed: true
        }
      }
    };
    const snapshot = reconcileLayout(
      stored,
      DECLARED_LAYOUT
    );

    assert.deepEqual(snapshot.panes, {
      inspector: {
        collapsed: true
      }
    });
  });

  test("never places one pane in two containers", () => {
    const stored: LayoutSnapshot = {
      ...emptyLayout(),
      docks: {
        left: {
          groups: [
            {
              panes: ["inspector"],
              active: "inspector"
            }
          ]
        },
        right: {
          groups: [
            {
              panes: ["inspector"],
              active: "inspector"
            }
          ]
        }
      },
      floating: {
        inspector: {
          x: 0,
          y: 0
        }
      }
    };
    const snapshot = reconcileLayout(
      stored,
      DECLARED_LAYOUT
    );
    const placements = [
      ...dockPanes(snapshot.docks.left),
      ...dockPanes(snapshot.docks.right),
      ...Object.keys(snapshot.floating)
    ].filter((key) => key === "inspector");

    assert.deepEqual(placements, ["inspector"]);
    assert.deepEqual(
      dockPanes(snapshot.docks.left),
      ["hierarchy", "inspector"]
    );
    assert.deepEqual(dockPanes(snapshot.docks.right), ["layers"]);
    assert.deepEqual(snapshot.floating, {});
  });
});
