// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  TabStrip,
  type StripTab
} from "../../../src/containers/tabs/TabStrip.ts";

// CONSTANTS
const kTabs: StripTab[] = [
  {
    key: "build",
    disabled: false
  },
  {
    key: "paint",
    disabled: false
  },
  {
    key: "animate",
    disabled: true
  }
];

function disabled(
  tabs: readonly StripTab[]
): StripTab[] {
  return tabs.map((tab) => {
    return {
      ...tab,
      disabled: true
    };
  });
}

function fixedStrip(
  fixed: readonly boolean[]
): TabStrip {
  return new TabStrip(fixed.map((isFixed, index) => {
    return {
      key: String(index),
      disabled: false,
      fixed: isFixed
    };
  }));
}

describe("TabStrip.active", () => {
  const strip = new TabStrip(kTabs);

  test("keeps an enabled requested tab", () => {
    assert.equal(strip.active("paint"), "paint");
  });

  test("falls back to the first enabled tab for a disabled or unknown request", () => {
    assert.equal(strip.active("animate"), "build");
    assert.equal(new TabStrip([...kTabs].reverse()).active("missing"), "paint");
  });

  test("falls back to the first tab when every tab is disabled", () => {
    assert.equal(new TabStrip(disabled(kTabs)).active("missing"), "build");
  });

  test("returns the request untouched while no tab is slotted", () => {
    assert.equal(new TabStrip([]).active("paint"), "paint");
  });
});

describe("TabStrip.navigate", () => {
  const strip = new TabStrip(kTabs);

  test("Home and End stop on the outer enabled tabs", () => {
    assert.equal(strip.navigate("End", 0), 1);
    assert.equal(new TabStrip([...kTabs].reverse()).navigate("Home", 2), 1);
  });

  test("arrows wrap past disabled tabs", () => {
    assert.equal(strip.navigate("ArrowRight", 1), 0);
    assert.equal(strip.navigate("ArrowLeft", 0), 1);
  });

  test("a vertical strip moves with Up and Down instead of Left and Right", () => {
    assert.equal(strip.navigate("ArrowDown", 0, "vertical"), 1);
    assert.equal(strip.navigate("ArrowUp", 1, "vertical"), 0);
    assert.equal(strip.navigate("ArrowRight", 0, "vertical"), -1);
  });

  test("ignores other keys and an all-disabled strip", () => {
    assert.equal(strip.navigate("Enter", 0), -1);
    assert.equal(new TabStrip(disabled(kTabs)).navigate("ArrowRight", 0), -1);
  });
});

describe("TabStrip.segment", () => {
  test("spans every tab when none is fixed", () => {
    assert.deepEqual(fixedStrip([false, false, false]).segment(1), {
      start: 0,
      end: 3
    });
  });

  test("stops at the nearest fixed tab on each side", () => {
    assert.deepEqual(fixedStrip([true, false, false]).segment(2), {
      start: 1,
      end: 3
    });
    assert.deepEqual(fixedStrip([false, true, false, false, true, false]).segment(3), {
      start: 2,
      end: 4
    });
  });

  test("returns null for a fixed tab or out of range", () => {
    assert.equal(fixedStrip([true, false]).segment(0), null);
    assert.equal(fixedStrip([false]).segment(1), null);
    assert.equal(fixedStrip([false]).segment(-1), null);
  });
});

describe("TabStrip.dropTarget", () => {
  const strip = fixedStrip([true, false, false, false, true]);

  test("moves a tab forward past its successors", () => {
    assert.equal(strip.dropTarget(1, 3), 3);
  });

  test("moves a tab backward to the segment start", () => {
    assert.equal(strip.dropTarget(3, 0), 1);
  });

  test("returns null on either side of the tab itself", () => {
    assert.equal(strip.dropTarget(2, 1), null);
    assert.equal(strip.dropTarget(2, 2), null);
  });

  test("clamps an insertion outside the segment", () => {
    assert.equal(strip.dropTarget(2, -5), 1);
    assert.equal(strip.dropTarget(2, 10), 3);
  });

  test("never moves a fixed tab", () => {
    assert.equal(strip.dropTarget(0, 2), null);
  });
});
