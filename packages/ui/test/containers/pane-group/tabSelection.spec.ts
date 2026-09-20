// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  resolveActiveTab,
  tabNavigationTarget,
  type SelectableTab
} from "../../../src/containers/pane-group/tabSelection.ts";

// CONSTANTS
const kTabs: SelectableTab[] = [
  {
    layoutKey: "build",
    disabled: false
  },
  {
    layoutKey: "paint",
    disabled: false
  },
  {
    layoutKey: "animate",
    disabled: true
  }
];

describe("resolveActiveTab", () => {
  test("keeps an enabled requested tab", () => {
    assert.equal(resolveActiveTab(kTabs, "paint"), "paint");
  });

  test("falls back to the first enabled tab for a disabled request", () => {
    assert.equal(resolveActiveTab(kTabs, "animate"), "build");
  });

  test("falls back to the first enabled tab for an unknown request", () => {
    const tabs = [
      {
        layoutKey: "animate",
        disabled: true
      },
      {
        layoutKey: "paint",
        disabled: false
      }
    ];

    assert.equal(resolveActiveTab(tabs, "missing"), "paint");
  });

  test("falls back to the first tab when every tab is disabled", () => {
    const tabs = kTabs.map((tab) => {
      return {
        ...tab,
        disabled: true
      };
    });

    assert.equal(resolveActiveTab(tabs, "missing"), "build");
  });

  test("returns the request untouched while no tab is slotted", () => {
    assert.equal(resolveActiveTab([], "paint"), "paint");
  });
});

describe("tabNavigationTarget", () => {
  test("End stops on the last enabled tab", () => {
    assert.equal(tabNavigationTarget(kTabs, "End", 0), 1);
  });

  test("ArrowRight wraps past a trailing disabled tab", () => {
    assert.equal(tabNavigationTarget(kTabs, "ArrowRight", 1), 0);
  });

  test("ArrowLeft wraps to the last enabled tab", () => {
    assert.equal(tabNavigationTarget(kTabs, "ArrowLeft", 0), 1);
  });

  test("Home skips a leading disabled tab", () => {
    const tabs = [...kTabs].reverse();

    assert.equal(tabNavigationTarget(tabs, "Home", 2), 1);
  });

  test("ignores other keys and an all-disabled strip", () => {
    const disabled = kTabs.map((tab) => {
      return {
        ...tab,
        disabled: true
      };
    });

    assert.equal(tabNavigationTarget(kTabs, "Enter", 0), -1);
    assert.equal(tabNavigationTarget(disabled, "ArrowRight", 0), -1);
  });
});
