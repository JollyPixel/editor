// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  contextMenuKeyAction,
  type ContextMenuKeyItem
} from "../../../src/containers/context-menu/contextMenuKeys.ts";

// CONSTANTS
const kMiddleDisabled = itemsOf([true, false, true]);

function itemsOf(
  enabled: readonly boolean[],
  submenus: readonly boolean[] = []
): ContextMenuKeyItem[] {
  return enabled.map((on, index) => {
    return {
      enabled: on,
      submenu: submenus[index] === true
    };
  });
}

describe("ContextMenu.contextMenuKeyAction", () => {
  test("arrows skip disabled items and wrap", () => {
    assert.deepEqual(
      contextMenuKeyAction("ArrowDown", kMiddleDisabled, 0, false),
      { kind: "focus", index: 2 }
    );
    assert.deepEqual(
      contextMenuKeyAction("ArrowDown", kMiddleDisabled, 2, false),
      { kind: "focus", index: 0 }
    );
    assert.deepEqual(
      contextMenuKeyAction("ArrowUp", kMiddleDisabled, 0, false),
      { kind: "focus", index: 2 }
    );
  });

  test("an arrow with nothing focused starts at the matching end", () => {
    assert.deepEqual(
      contextMenuKeyAction("ArrowDown", kMiddleDisabled, -1, false),
      { kind: "focus", index: 0 }
    );
    assert.deepEqual(
      contextMenuKeyAction("ArrowUp", kMiddleDisabled, -1, false),
      { kind: "focus", index: 2 }
    );
  });

  test("Home and End reach the first and last enabled items", () => {
    const items = itemsOf([false, true, true, false]);

    assert.deepEqual(
      contextMenuKeyAction("Home", items, 2, false),
      { kind: "focus", index: 1 }
    );
    assert.deepEqual(
      contextMenuKeyAction("End", items, 1, false),
      { kind: "focus", index: 2 }
    );
  });

  test("Enter and Space activate only an enabled focused item", () => {
    assert.deepEqual(
      contextMenuKeyAction("Enter", kMiddleDisabled, 2, false),
      { kind: "activate", index: 2 }
    );
    assert.deepEqual(
      contextMenuKeyAction(" ", kMiddleDisabled, 0, false),
      { kind: "activate", index: 0 }
    );
    assert.deepEqual(
      contextMenuKeyAction("Enter", kMiddleDisabled, 1, false),
      { kind: "none" }
    );
    assert.deepEqual(
      contextMenuKeyAction("Enter", kMiddleDisabled, -1, false),
      { kind: "none" }
    );
  });

  test("ArrowRight, Enter and Space open an enabled submenu item", () => {
    const items = itemsOf([true, false, true], [false, true, true]);

    for (const key of ["ArrowRight", "Enter", " "]) {
      assert.deepEqual(
        contextMenuKeyAction(key, items, 2, false),
        { kind: "open", index: 2 }
      );
    }
    assert.deepEqual(
      contextMenuKeyAction("ArrowRight", items, 1, false),
      { kind: "none" }
    );
    assert.deepEqual(
      contextMenuKeyAction("ArrowRight", items, 0, false),
      { kind: "none" }
    );
  });

  test("ArrowLeft goes back only from a nested menu", () => {
    assert.deepEqual(
      contextMenuKeyAction("ArrowLeft", kMiddleDisabled, 0, true),
      { kind: "back" }
    );
    assert.deepEqual(
      contextMenuKeyAction("ArrowLeft", kMiddleDisabled, 0, false),
      { kind: "none" }
    );
  });

  test("Tab closes and a menu with every item disabled goes nowhere", () => {
    assert.deepEqual(
      contextMenuKeyAction("Tab", kMiddleDisabled, 0, false),
      { kind: "close" }
    );
    assert.deepEqual(
      contextMenuKeyAction("ArrowDown", itemsOf([false, false]), -1, false),
      { kind: "none" }
    );
  });
});
