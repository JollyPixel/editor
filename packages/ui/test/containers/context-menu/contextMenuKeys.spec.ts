// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { contextMenuKeyAction } from "../../../src/containers/context-menu/contextMenuKeys.ts";

// CONSTANTS
const kMiddleDisabled = [true, false, true];

describe("ContextMenu.contextMenuKeyAction", () => {
  test("arrows skip disabled items and wrap", () => {
    assert.deepEqual(
      contextMenuKeyAction("ArrowDown", kMiddleDisabled, 0),
      { kind: "focus", index: 2 }
    );
    assert.deepEqual(
      contextMenuKeyAction("ArrowDown", kMiddleDisabled, 2),
      { kind: "focus", index: 0 }
    );
    assert.deepEqual(
      contextMenuKeyAction("ArrowUp", kMiddleDisabled, 0),
      { kind: "focus", index: 2 }
    );
  });

  test("an arrow with nothing focused starts at the matching end", () => {
    assert.deepEqual(
      contextMenuKeyAction("ArrowDown", kMiddleDisabled, -1),
      { kind: "focus", index: 0 }
    );
    assert.deepEqual(
      contextMenuKeyAction("ArrowUp", kMiddleDisabled, -1),
      { kind: "focus", index: 2 }
    );
  });

  test("Home and End reach the first and last enabled items", () => {
    const enabled = [false, true, true, false];

    assert.deepEqual(
      contextMenuKeyAction("Home", enabled, 2),
      { kind: "focus", index: 1 }
    );
    assert.deepEqual(
      contextMenuKeyAction("End", enabled, 1),
      { kind: "focus", index: 2 }
    );
  });

  test("Enter and Space activate only an enabled focused item", () => {
    assert.deepEqual(
      contextMenuKeyAction("Enter", kMiddleDisabled, 2),
      { kind: "activate", index: 2 }
    );
    assert.deepEqual(
      contextMenuKeyAction(" ", kMiddleDisabled, 0),
      { kind: "activate", index: 0 }
    );
    assert.deepEqual(
      contextMenuKeyAction("Enter", kMiddleDisabled, 1),
      { kind: "none" }
    );
    assert.deepEqual(
      contextMenuKeyAction("Enter", kMiddleDisabled, -1),
      { kind: "none" }
    );
  });

  test("Tab closes and a menu with every item disabled goes nowhere", () => {
    assert.deepEqual(
      contextMenuKeyAction("Tab", kMiddleDisabled, 0),
      { kind: "close" }
    );
    assert.deepEqual(
      contextMenuKeyAction("ArrowDown", [false, false], -1),
      { kind: "none" }
    );
  });
});
