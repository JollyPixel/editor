// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  applyLayoutChange,
  floatPane,
  panePlacement,
  paneVisible,
  reconcileLayout
} from "../../../src/containers/dock/layout.ts";
import { GROUPED_LAYOUT } from "../../fixtures/dockLayout.ts";

describe("Containers.applyLayoutChange group", () => {
  const base = reconcileLayout(null, GROUPED_LAYOUT);

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
  const base = reconcileLayout(null, GROUPED_LAYOUT);

  test("shows only the active pane of a group", () => {
    assert.equal(paneVisible(base, "blocks"), true);
    assert.equal(paneVisible(base, "paint"), false);
    assert.deepEqual(panePlacement(base, "paint"), {
      dock: "left",
      column: "primary",
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
