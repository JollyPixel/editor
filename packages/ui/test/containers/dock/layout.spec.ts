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
  test("falls back to the markup when nothing is stored", () => {
    const snapshot = reconcileLayout(null, DECLARED_LAYOUT);

    assert.deepEqual(
      dockPanes(snapshot.docks.left),
      ["hierarchy"]
    );
    assert.deepEqual(
      dockPanes(snapshot.docks.right),
      ["inspector", "layers"]
    );
    assert.deepEqual(snapshot.floating, {});
  });

  test("stored placement wins over the declared dock", () => {
    const stored: LayoutSnapshot = {
      ...emptyLayout(),
      docks: {
        left: {
          groups: [
            {
              panes: ["hierarchy"],
              active: "hierarchy"
            },
            {
              panes: ["layers"],
              active: "layers"
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
      }
    };
    const snapshot = reconcileLayout(
      stored,
      DECLARED_LAYOUT
    );

    assert.deepEqual(
      dockPanes(snapshot.docks.left),
      ["hierarchy", "layers"]
    );
    assert.deepEqual(
      dockPanes(snapshot.docks.right),
      ["inspector"]
    );
  });

  test("stored order wins inside a dock", () => {
    const stored: LayoutSnapshot = {
      ...emptyLayout(),
      docks: {
        right: {
          groups: [
            {
              panes: ["layers"],
              active: "layers"
            },
            {
              panes: ["inspector"],
              active: "inspector"
            }
          ]
        }
      }
    };
    const snapshot = reconcileLayout(
      stored,
      DECLARED_LAYOUT
    );

    assert.deepEqual(
      dockPanes(snapshot.docks.right),
      ["layers", "inspector"]
    );
  });

  test("keeps a pane the store left floating", () => {
    const stored: LayoutSnapshot = {
      ...emptyLayout(),
      docks: {
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
        layers: {
          x: 40,
          y: 60,
          width: 300,
          height: 200
        }
      }
    };
    const snapshot = reconcileLayout(
      stored,
      DECLARED_LAYOUT
    );

    assert.deepEqual(dockPanes(snapshot.docks.right), ["inspector"]);
    assert.deepEqual(snapshot.floating.layers, {
      x: 40,
      y: 60,
      width: 300,
      height: 200
    });
  });

  test("places a pane the store never saw at its declared spot", () => {
    const stored: LayoutSnapshot = {
      ...emptyLayout(),
      docks: {
        right: {
          groups: [
            {
              panes: ["layers"],
              active: "layers"
            }
          ]
        }
      }
    };
    const snapshot = reconcileLayout(
      stored,
      DECLARED_LAYOUT
    );

    assert.deepEqual(
      dockPanes(snapshot.docks.right),
      ["inspector", "layers"]
    );
  });

  test("drops panes the markup no longer declares", () => {
    const stored: LayoutSnapshot = {
      ...emptyLayout(),
      docks: {
        left: {
          groups: [
            {
              panes: ["hierarchy"],
              active: "hierarchy"
            },
            {
              panes: ["removed"],
              active: "removed"
            }
          ]
        }
      },
      floating: {
        gone: {
          x: 0,
          y: 0
        }
      },
      panes: {
        gone: {
          collapsed: true
        }
      }
    };
    const snapshot = reconcileLayout(
      stored,
      DECLARED_LAYOUT
    );

    assert.deepEqual(dockPanes(snapshot.docks.left), ["hierarchy"]);
    assert.deepEqual(snapshot.floating, {});
    assert.deepEqual(snapshot.panes, {});
  });
});
