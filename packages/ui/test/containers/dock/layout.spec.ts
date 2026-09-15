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

// CONSTANTS
const kDeclared: DeclaredLayout = {
  docks: [
    {
      key: "left",
      groups: [
        {
          panes: ["hierarchy"]
        }
      ]
    },
    {
      key: "right",
      groups: [
        {
          panes: ["inspector"]
        },
        {
          panes: ["layers"]
        }
      ]
    }
  ],
  floating: [],
  locked: []
};

describe("Containers.reconcileLayout", () => {
  test("falls back to the markup when nothing is stored", () => {
    const snapshot = reconcileLayout(null, kDeclared);

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
      kDeclared
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
      kDeclared
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
      kDeclared
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
      kDeclared
    );

    // "inspector" is new to the store and is declared before "layers".
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
      kDeclared
    );

    assert.deepEqual(dockPanes(snapshot.docks.left), ["hierarchy"]);
    assert.deepEqual(snapshot.floating, {});
    assert.deepEqual(snapshot.panes, {});
  });

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
      kDeclared
    );

    assert.equal(
      snapshot.docks.bottom,
      undefined
    );
    // The pane returns to where the markup put it.
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
      kDeclared
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
      kDeclared
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
      kDeclared
    );
    const placements = [
      ...dockPanes(snapshot.docks.left),
      ...dockPanes(snapshot.docks.right),
      ...Object.keys(snapshot.floating)
    ].filter((key) => key === "inspector");

    assert.deepEqual(placements, ["inspector"]);
    // First writer wins; the duplicate dock entry and the floating one go.
    assert.deepEqual(
      dockPanes(snapshot.docks.left),
      ["hierarchy", "inspector"]
    );
    // "layers" was never stored, so it stays where it was declared.
    assert.deepEqual(dockPanes(snapshot.docks.right), ["layers"]);
    assert.deepEqual(snapshot.floating, {});
  });

  test("keeps a declared floating pane floating", () => {
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
    const snapshot = reconcileLayout(null, declared);

    assert.deepEqual(snapshot.floating, { assets: {} });
    assert.deepEqual(dockPanes(snapshot.docks.left), ["hierarchy"]);
  });

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

  test("brings a locked pane the store left floating back home", () => {
    const declared: DeclaredLayout = {
      ...kDeclared,
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
      ...kDeclared,
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

    // Docked, so nothing floats, and still known so it comes back at 180x120.
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

    /*
     * Written before the two records were kept apart: what a pane floats at
     * is also what it is remembered at.
     */
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
      reconcileLayout(stored, kDeclared).geometry,
      {}
    );
  });

  test("is idempotent when re-run against its own output", () => {
    const once = reconcileLayout(null, kDeclared);
    const twice = reconcileLayout(once, kDeclared);

    assert.deepEqual(twice, once);
  });
});
