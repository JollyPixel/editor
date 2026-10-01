// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  dockPanes,
  emptyLayout,
  reconcileLayout,
  type DeclaredLayout,
  type LayoutSnapshot
} from "../../../src/containers/dock/layout.ts";
import { DECLARED_LAYOUT } from "../../fixtures/dockLayout.ts";

describe("Containers.reconcileLayout", () => {
  test("brings a locked pane the store left floating back home", () => {
    const declared: DeclaredLayout = {
      ...DECLARED_LAYOUT,
      locked: ["hierarchy"]
    };
    const stored: LayoutSnapshot = {
      ...emptyLayout(),
      docks: {
        left: {
          groups: []
        },
        right: {
          groups: [
            {
              panes: ["inspector"],
              active: "inspector"
            },
            {
              panes: ["layers"],
              active: "layers"
            }
          ]
        }
      },
      floating: {
        hierarchy: {
          x: 700,
          y: 600
        }
      }
    };
    const snapshot = reconcileLayout(stored, declared);

    assert.deepEqual(dockPanes(snapshot.docks.left), ["hierarchy"]);
    assert.deepEqual(snapshot.floating, {});
  });

  test("keeps a locked pane in the dock that declares it", () => {
    const declared: DeclaredLayout = {
      ...DECLARED_LAYOUT,
      locked: ["hierarchy"]
    };
    const stored: LayoutSnapshot = {
      ...emptyLayout(),
      docks: {
        left: { groups: [] },
        right: { groups: [
          {
            panes: ["hierarchy"],
            active: "hierarchy"
          },
          {
            panes: ["inspector"],
            active: "inspector"
          },
          {
            panes: ["layers"],
            active: "layers"
          }
        ] }
      }
    };
    const snapshot = reconcileLayout(stored, declared);

    assert.deepEqual(dockPanes(snapshot.docks.left), ["hierarchy"]);
    assert.deepEqual(
      dockPanes(snapshot.docks.right),
      ["inspector", "layers"]
    );
  });

  test("a locked pane keeps floating when that is what was authored", () => {
    const declared: DeclaredLayout = {
      docks: [
        { key: "left", groups: [
          {
            panes: ["hierarchy"]
          }
        ] }
      ],
      floating: [
        { key: "assets", geometry: { x: 12, y: 12 } }
      ],
      locked: ["assets"]
    };
    const stored: LayoutSnapshot = {
      ...emptyLayout(),
      docks: {
        left: { groups: [
          {
            panes: ["hierarchy"],
            active: "hierarchy"
          },
          {
            panes: ["assets"],
            active: "assets"
          }
        ] }
      }
    };
    const snapshot = reconcileLayout(stored, declared);

    assert.deepEqual(dockPanes(snapshot.docks.left), ["hierarchy"]);
    assert.deepEqual(snapshot.floating.assets, { x: 12, y: 12 });
  });
});
