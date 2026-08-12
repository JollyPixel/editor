// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  emptyLayout,
  parseLayout,
  reconcileLayout,
  serializeLayout,
  type DeclaredLayout,
  type LayoutSnapshot
} from "../../src/containers/layout.ts";

// CONSTANTS
const kDeclared: DeclaredLayout = {
  docks: [
    {
      key: "left",
      panes: ["hierarchy"]
    },
    {
      key: "right",
      panes: ["inspector", "layers"]
    }
  ],
  floating: [],
  locked: []
};

describe("Containers.parseLayout", () => {
  test("returns null for absent or empty input", () => {
    assert.equal(parseLayout(null), null);
    assert.equal(parseLayout(""), null);
  });

  test("returns null for malformed JSON", () => {
    assert.equal(parseLayout("{ not json"), null);
  });

  test("returns null for a foreign version", () => {
    assert.equal(
      parseLayout(JSON.stringify({ v: 99, docks: {} })),
      null
    );
  });

  test("survives a payload missing every section", () => {
    assert.deepEqual(
      parseLayout(JSON.stringify({ v: 1 })),
      emptyLayout()
    );
  });

  test("drops non-finite geometry instead of storing NaN", () => {
    const parsed = parseLayout(JSON.stringify({
      v: 1,
      docks: {
        left: {
          size: "wide",
          panes: ["a"]
        }
      },
      floating: {
        b: {
          x: 10,
          y: null
        }
      },
      panes: {}
    }));

    assert.deepEqual(parsed?.docks.left, {
      collapsed: false,
      panes: ["a"]
    });
    assert.deepEqual(parsed?.floating.b, { x: 10 });
  });

  test("keeps only string entries in a pane list", () => {
    const parsed = parseLayout(JSON.stringify({
      v: 1,
      docks: {
        left: {
          panes: ["a", 7, null, "b"]
        }
      }
    }));

    assert.deepEqual(parsed?.docks.left.panes, ["a", "b"]);
  });

  test("round-trips a serialized snapshot", () => {
    const snapshot: LayoutSnapshot = {
      ...emptyLayout(),
      docks: {
        left: {
          size: 240,
          collapsed: false,
          panes: ["hierarchy"]
        }
      },
      floating: {
        assets: {
          x: 20,
          y: 30,
          width: 320,
          height: 400
        }
      },
      panes: {
        hierarchy: {
          collapsed: true
        }
      }
    };

    assert.deepEqual(
      parseLayout(serializeLayout(snapshot)),
      snapshot
    );
  });
});

describe("Containers.reconcileLayout", () => {
  test("falls back to the markup when nothing is stored", () => {
    const snapshot = reconcileLayout(null, kDeclared);

    assert.deepEqual(
      snapshot.docks.left.panes,
      ["hierarchy"]
    );
    assert.deepEqual(
      snapshot.docks.right.panes,
      ["inspector", "layers"]
    );
    assert.deepEqual(snapshot.floating, {});
  });

  test("stored placement wins over the declared dock", () => {
    const stored: LayoutSnapshot = {
      ...emptyLayout(),
      docks: {
        left: {
          panes: ["hierarchy", "layers"]
        },
        right: {
          panes: ["inspector"]
        }
      }
    };
    const snapshot = reconcileLayout(
      stored,
      kDeclared
    );

    assert.deepEqual(
      snapshot.docks.left.panes,
      ["hierarchy", "layers"]
    );
    assert.deepEqual(
      snapshot.docks.right.panes,
      ["inspector"]
    );
  });

  test("stored order wins inside a dock", () => {
    const stored: LayoutSnapshot = {
      ...emptyLayout(),
      docks: {
        right: {
          panes: ["layers", "inspector"]
        }
      }
    };
    const snapshot = reconcileLayout(
      stored,
      kDeclared
    );

    assert.deepEqual(
      snapshot.docks.right.panes,
      ["layers", "inspector"]
    );
  });

  test("keeps a pane the store left floating", () => {
    const stored: LayoutSnapshot = {
      ...emptyLayout(),
      docks: {
        right: {
          panes: ["inspector"]
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

    assert.deepEqual(snapshot.docks.right.panes, ["inspector"]);
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
          panes: ["layers"]
        }
      }
    };
    const snapshot = reconcileLayout(
      stored,
      kDeclared
    );

    // "inspector" is new to the store and is declared before "layers".
    assert.deepEqual(
      snapshot.docks.right.panes,
      ["inspector", "layers"]
    );
  });

  test("drops panes the markup no longer declares", () => {
    const stored: LayoutSnapshot = {
      ...emptyLayout(),
      docks: {
        left: {
          panes: ["hierarchy", "removed"]
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

    assert.deepEqual(snapshot.docks.left.panes, ["hierarchy"]);
    assert.deepEqual(snapshot.floating, {});
    assert.deepEqual(snapshot.panes, {});
  });

  test("drops docks the markup no longer declares", () => {
    const stored: LayoutSnapshot = {
      ...emptyLayout(),
      docks: {
        bottom: {
          size: 180,
          panes: ["hierarchy"]
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
      snapshot.docks.left.panes,
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
          panes: ["hierarchy"]
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
          panes: ["inspector"]
        },
        right: {
          panes: ["inspector"]
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
      ...snapshot.docks.left.panes,
      ...snapshot.docks.right.panes,
      ...Object.keys(snapshot.floating)
    ].filter((key) => key === "inspector");

    assert.deepEqual(placements, ["inspector"]);
    // First writer wins; the duplicate dock entry and the floating one go.
    assert.deepEqual(
      snapshot.docks.left.panes,
      ["hierarchy", "inspector"]
    );
    // "layers" was never stored, so it stays where it was declared.
    assert.deepEqual(snapshot.docks.right.panes, ["layers"]);
    assert.deepEqual(snapshot.floating, {});
  });

  test("keeps a declared floating pane floating", () => {
    const declared: DeclaredLayout = {
      docks: [
        { key: "left", panes: ["hierarchy"] }
      ],
      floating: [
        { key: "assets", geometry: {} }
      ],
      locked: []
    };
    const snapshot = reconcileLayout(null, declared);

    assert.deepEqual(snapshot.floating, { assets: {} });
    assert.deepEqual(snapshot.docks.left.panes, ["hierarchy"]);
  });

  test("restores the declared geometry when nothing is stored", () => {
    const declared: DeclaredLayout = {
      docks: [
        { key: "left", size: 240, panes: ["hierarchy"] }
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
        { key: "left", size: 240, panes: ["hierarchy"] }
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
          panes: []
        },
        right: {
          panes: ["inspector", "layers"]
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

    assert.deepEqual(snapshot.docks.left.panes, ["hierarchy"]);
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
        left: { panes: [] },
        right: { panes: ["hierarchy", "inspector", "layers"] }
      }
    };
    const snapshot = reconcileLayout(stored, declared);

    assert.deepEqual(snapshot.docks.left.panes, ["hierarchy"]);
    assert.deepEqual(
      snapshot.docks.right.panes,
      ["inspector", "layers"]
    );
  });

  test("a locked pane keeps floating when that is what was authored", () => {
    const declared: DeclaredLayout = {
      docks: [
        { key: "left", panes: ["hierarchy"] }
      ],
      floating: [
        { key: "assets", geometry: { x: 12, y: 12 } }
      ],
      locked: ["assets"]
    };
    const stored: LayoutSnapshot = {
      ...emptyLayout(),
      docks: {
        left: { panes: ["hierarchy", "assets"] }
      }
    };
    const snapshot = reconcileLayout(stored, declared);

    assert.deepEqual(snapshot.docks.left.panes, ["hierarchy"]);
    assert.deepEqual(snapshot.floating.assets, { x: 12, y: 12 });
  });

  test("remembers the geometry of a pane the store left docked", () => {
    const declared: DeclaredLayout = {
      docks: [
        { key: "left", panes: ["hierarchy"] }
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
          panes: ["hierarchy", "assets"]
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
    assert.deepEqual(snapshot.docks.left.panes, ["hierarchy", "assets"]);
    assert.deepEqual(snapshot.geometry.assets, {
      width: 180,
      height: 120
    });
  });

  test("takes the geometry of a floating pane that has none remembered", () => {
    const declared: DeclaredLayout = {
      docks: [
        { key: "left", panes: ["hierarchy"] }
      ],
      floating: [
        { key: "assets", geometry: {} }
      ],
      locked: []
    };
    const stored: LayoutSnapshot = {
      ...emptyLayout(),
      docks: {
        left: { panes: ["hierarchy"] }
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

    // Written before the two records were kept apart: what a pane floats at
    // is also what it is remembered at.
    assert.deepEqual(snapshot.geometry.assets, snapshot.floating.assets);
    assert.equal(snapshot.geometry.assets.width, 200);
  });

  test("a reset forgets a geometry the markup never declared", () => {
    const declared: DeclaredLayout = {
      docks: [{ key: "left", panes: ["hierarchy", "assets"] }],
      floating: [],
      locked: []
    };
    const stored: LayoutSnapshot = {
      ...emptyLayout(),
      docks: {
        left: { panes: ["hierarchy", "assets"] }
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
        left: { panes: ["hierarchy"] }
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
