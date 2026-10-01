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
  test("restores the declared geometry when nothing is stored", () => {
    const declared: DeclaredLayout = {
      docks: [
        { key: "left", size: 240, groups: [
          {
            panes: ["hierarchy"]
          }
        ] }
      ],
      floating: [
        { key: "assets", geometry: { x: 360, y: 140 } }
      ],
      locked: []
    };
    const snapshot = reconcileLayout(null, declared);

    assert.equal(snapshot.docks.left.size, 240);
    assert.deepEqual(snapshot.floating.assets, { x: 360, y: 140 });
  });

  test("stored geometry wins over the declared one", () => {
    const declared: DeclaredLayout = {
      docks: [
        { key: "left", size: 240, groups: [
          {
            panes: ["hierarchy"]
          }
        ] }
      ],
      floating: [
        { key: "assets", geometry: { x: 360, y: 140 } }
      ],
      locked: []
    };
    const stored = reconcileLayout(null, declared);
    stored.docks.left.size = 400;
    stored.floating.assets = { x: 12, y: 12 };
    const snapshot = reconcileLayout(stored, declared);

    assert.equal(snapshot.docks.left.size, 400);
    assert.deepEqual(snapshot.floating.assets, { x: 12, y: 12 });
  });

  test("remembers the geometry of a pane the store left docked", () => {
    const declared: DeclaredLayout = {
      docks: [
        { key: "left", groups: [
          {
            panes: ["hierarchy"]
          }
        ] }
      ],
      floating: [
        { key: "assets", geometry: { width: 180, height: 120 } }
      ],
      locked: []
    };
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
              panes: ["assets"],
              active: "assets"
            }
          ]
        }
      },
      geometry: {
        assets: {
          width: 180,
          height: 120
        }
      }
    };
    const snapshot = reconcileLayout(stored, declared);

    assert.deepEqual(snapshot.floating, {});
    assert.deepEqual(dockPanes(snapshot.docks.left), ["hierarchy", "assets"]);
    assert.deepEqual(snapshot.geometry.assets, {
      width: 180,
      height: 120
    });
  });

  test("takes the geometry of a floating pane that has none remembered", () => {
    const declared: DeclaredLayout = {
      docks: [
        { key: "left", groups: [
          {
            panes: ["hierarchy"]
          }
        ] }
      ],
      floating: [
        { key: "assets", geometry: {} }
      ],
      locked: []
    };
    const stored: LayoutSnapshot = {
      ...emptyLayout(),
      docks: {
        left: { groups: [
          {
            panes: ["hierarchy"],
            active: "hierarchy"
          }
        ] }
      },
      floating: {
        assets: {
          x: 12,
          y: 12,
          width: 200,
          height: 160
        }
      }
    };
    const snapshot = reconcileLayout(stored, declared);

    assert.deepEqual(snapshot.geometry.assets, snapshot.floating.assets);
    assert.equal(snapshot.geometry.assets.width, 200);
  });

  test("a reset forgets a geometry the markup never declared", () => {
    const declared: DeclaredLayout = {
      docks: [{ key: "left", groups: [
        {
          panes: ["hierarchy"]
        },
        {
          panes: ["assets"]
        }
      ] }],
      floating: [],
      locked: []
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
      },
      geometry: {
        assets: { width: 180 }
      }
    };

    assert.deepEqual(
      reconcileLayout(stored, declared).geometry.assets,
      { width: 180 }
    );
    assert.deepEqual(reconcileLayout(null, declared).geometry, {});
  });

  test("drops the geometry of a pane the markup no longer declares", () => {
    const stored: LayoutSnapshot = {
      ...emptyLayout(),
      docks: {
        left: { groups: [
          {
            panes: ["hierarchy"],
            active: "hierarchy"
          }
        ] }
      },
      geometry: {
        gone: { width: 180 }
      }
    };

    assert.deepEqual(
      reconcileLayout(stored, DECLARED_LAYOUT).geometry,
      {}
    );
  });
});
