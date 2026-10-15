// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  reconcileLayout,
  type DeclaredLayout,
  type DockState
} from "../../../src/containers/dock/layout.ts";
import {
  PaneStepper,
  type SteppableDock
} from "../../../src/containers/dock/PaneStepper.ts";

// CONSTANTS
const kSides = ["left", "bottom", "right"] as const;
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
      key: "bottom",
      groups: [
        {
          panes: ["console"]
        }
      ]
    },
    {
      key: "right",
      groups: [
        {
          panes: ["inspector", "assets"]
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

function stepper(
  overrides: Partial<Record<string, Partial<SteppableDock>>> = {}
): PaneStepper {
  return new PaneStepper(kSides.map((key) => {
    return {
      layoutKey: key,
      side: key,
      drop: "any",
      ...overrides[key]
    };
  }));
}

describe("Containers.PaneStepper", () => {
  const base = reconcileLayout(null, kDeclared);

  test("up and down move a lone pane within its column and stop at the ends", () => {
    const up = stepper().step(base, "layers", "up");
    const down = stepper().step(base, "layers", "down");

    assert.deepEqual(columns(up.docks.left)[0], [["layers"], ["general", "blocks"]]);
    assert.equal(down, base);
  });

  test("down takes a grouped pane out of its group, below it", () => {
    const next = stepper().step(base, "blocks", "down");

    assert.deepEqual(columns(next.docks.left)[0], [["general"], ["blocks"], ["layers"]]);
  });

  test("a tabs dock keeps a grouped pane in its group", () => {
    const next = stepper({ left: { drop: "tabs" } }).step(base, "blocks", "down");

    assert.equal(next, base);
  });

  test("join stacks a pane into the neighbouring group as its last tab", () => {
    const next = stepper().step(base, "layers", "join-previous");

    assert.deepEqual(columns(next.docks.left)[0], [["general", "blocks", "layers"]]);
    assert.equal(stepper().step(base, "layers", "join-next"), base);
  });

  test("next opens the second column of a double dock before leaving it", () => {
    const next = stepper().step(base, "layers", "next");

    assert.deepEqual(columns(next.docks.left), [[["general", "blocks"]], [["layers"]]]);
  });

  test("next skips a dock that takes no drop", () => {
    const steps = stepper({ bottom: { drop: "none" } });
    const once = steps.step(base, "console", "next");
    const twice = steps.step(steps.step(base, "layers", "next"), "layers", "next");

    assert.deepEqual(columns(once.docks.right)[0], [["inspector", "assets"], ["console"]]);
    assert.deepEqual(columns(twice.docks.right)[0], [["inspector", "assets"], ["layers"]]);
    assert.deepEqual(columns(twice.docks.bottom)[0], [["console"]]);
  });

  test("next into a tabs dock joins its last group", () => {
    const next = stepper({ right: { drop: "tabs" } }).step(base, "console", "next");

    assert.deepEqual(columns(next.docks.right)[0], [["inspector", "assets", "console"]]);
  });

  test("describes the dock side, column, position and tab", () => {
    const steps = stepper();
    const second = steps.step(base, "layers", "next");

    assert.equal(
      steps.describe(base, "blocks", "Blocks"),
      "Blocks, left dock, position 1 of 2, tab 2 of 2"
    );
    assert.equal(
      steps.describe(second, "layers", "Layers"),
      "Layers, left dock, second column, position 1 of 1"
    );
    assert.equal(steps.describe(base, "missing", "Missing"), "Missing, floating");
  });
});
