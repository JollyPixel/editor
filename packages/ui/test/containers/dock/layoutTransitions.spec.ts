// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  applyLayoutChange,
  cloneLayout,
  floatPane,
  movePane,
  panePlacement,
  reconcileLayout,
  type DeclaredLayout
} from "../../../src/containers/dock/layout.ts";

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

describe("Containers.movePane", () => {
  const base = reconcileLayout(null, kDeclared);

  test("reorders within a dock using an insertion index that counts the pane", () => {
    const moved = movePane(base, "inspector", "right", 2);

    assert.deepEqual(moved.docks.right.panes, ["layers", "inspector"]);
    assert.deepEqual(base.docks.right.panes, ["inspector", "layers"]);
  });

  test("moves a pane across docks", () => {
    const moved = movePane(base, "hierarchy", "right", 1);

    assert.deepEqual(moved.docks.left.panes, []);
    assert.deepEqual(moved.docks.right.panes, [
      "inspector",
      "hierarchy",
      "layers"
    ]);
  });

  test("docks a floating pane and keeps its geometry remembered", () => {
    const floating = floatPane(base, "layers", {
      x: 10,
      y: 20,
      width: 200,
      height: 100
    });
    const docked = movePane(floating, "layers", "left", 0);

    assert.deepEqual(docked.floating, {});
    assert.deepEqual(docked.geometry.layers, {
      x: 10,
      y: 20,
      width: 200,
      height: 100
    });
    assert.deepEqual(docked.docks.left.panes, ["layers", "hierarchy"]);
  });

  test("clamps an out-of-range index and ignores an unknown dock", () => {
    assert.deepEqual(
      movePane(base, "hierarchy", "right", 99).docks.right.panes,
      ["inspector", "layers", "hierarchy"]
    );
    assert.equal(movePane(base, "hierarchy", "missing", 0), base);
  });
});

describe("Containers.floatPane", () => {
  test("detaches a docked pane into a floating window", () => {
    const base = reconcileLayout(null, kDeclared);
    const floating = floatPane(base, "inspector", {
      x: 4,
      width: 160
    });

    assert.deepEqual(floating.docks.right.panes, ["layers"]);
    assert.deepEqual(floating.floating.inspector, {
      x: 4,
      width: 160
    });
    assert.deepEqual(floating.geometry.inspector, {
      x: 4,
      width: 160
    });
    assert.equal(panePlacement(floating, "inspector"), null);
  });
});

describe("Containers.panePlacement", () => {
  test("reports the dock, index and pane count", () => {
    assert.deepEqual(
      panePlacement(reconcileLayout(null, kDeclared), "layers"),
      {
        dock: "right",
        index: 1,
        count: 2
      }
    );
  });
});

describe("Containers.applyLayoutChange", () => {
  const base = reconcileLayout(null, kDeclared);

  test("updates dock size and collapse", () => {
    const next = applyLayoutChange(base, {
      type: "dock",
      dock: "left",
      size: 320,
      collapsed: true
    });

    assert.equal(next.docks.left.size, 320);
    assert.equal(next.docks.left.collapsed, true);
    assert.equal(base.docks.left.size, undefined);
  });

  test("merges floating geometry into both floating and remembered geometry", () => {
    const floating = floatPane(base, "layers", {
      x: 1,
      y: 2,
      width: 3,
      height: 4
    });
    const next = applyLayoutChange(floating, {
      type: "floating",
      pane: "layers",
      geometry: {
        x: 50,
        width: undefined
      }
    });

    assert.deepEqual(next.floating.layers, {
      x: 50,
      y: 2,
      width: 3,
      height: 4
    });
    assert.deepEqual(next.geometry.layers, next.floating.layers);
  });

  test("ignores geometry for a pane that is not floating", () => {
    assert.equal(
      applyLayoutChange(base, {
        type: "floating",
        pane: "layers",
        geometry: { x: 1 }
      }),
      base
    );
  });

  test("records pane collapse and folder state", () => {
    const collapsed = applyLayoutChange(base, {
      type: "pane",
      pane: "inspector",
      collapsed: true
    });
    const folded = applyLayoutChange(collapsed, {
      type: "folder",
      pane: "inspector",
      folder: "transform",
      open: false
    });

    assert.deepEqual(folded.panes.inspector, { collapsed: true });
    assert.deepEqual(folded.folders.inspector, {
      transform: { open: false }
    });
  });
});

describe("Containers.cloneLayout", () => {
  test("returns a copy that shares no nested state", () => {
    const base = floatPane(reconcileLayout(null, kDeclared), "layers", { x: 1 });
    const copy = cloneLayout(base);
    copy.docks.left.panes.push("extra");
    copy.floating.layers.x = 99;

    assert.deepEqual(copy, {
      ...base,
      docks: {
        ...base.docks,
        left: {
          ...base.docks.left,
          panes: ["hierarchy", "extra"]
        }
      },
      floating: {
        layers: { x: 99 }
      }
    });
    assert.deepEqual(base.docks.left.panes, ["hierarchy"]);
    assert.equal(base.floating.layers.x, 1);
  });
});
