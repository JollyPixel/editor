// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  isToggleShortcut,
  resolveKey,
  type KeyInput,
  type KeyState
} from "#src/element/keymap.ts";

function key(
  name: string,
  modifiers: Partial<KeyInput> = {}
): KeyInput {
  return {
    key: name,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...modifiers
  };
}

function state(
  overrides: Partial<KeyState> = {}
): KeyState {
  return {
    highlight: -1,
    itemCount: 0,
    browsingHistory: false,
    inlineCompletion: false,
    ...overrides
  };
}

describe("isToggleShortcut", () => {
  test("matches Ctrl+K and Cmd+K only", () => {
    assert.equal(isToggleShortcut(key("k", { ctrlKey: true })), true);
    assert.equal(isToggleShortcut(key("k", { metaKey: true })), true);
    assert.equal(isToggleShortcut(key("k")), false);
    assert.equal(isToggleShortcut(key("K", { ctrlKey: true, shiftKey: true })), false);
    assert.equal(isToggleShortcut(key("k", { ctrlKey: true, altKey: true })), false);
    assert.equal(isToggleShortcut(key("j", { ctrlKey: true })), false);
  });
});

describe("resolveKey", () => {
  const cases: [string, KeyInput, Partial<KeyState>, string | null][] = [
    ["Escape closes", key("Escape"), {}, "close"],
    ["Enter with no suggestion submits the line", key("Enter"), {}, "submit"],
    [
      "Enter with nothing highlighted submits the line",
      key("Enter"),
      { itemCount: 2 },
      "submit"
    ],
    [
      "Enter accepts the highlighted suggestion",
      key("Enter"),
      { highlight: 1, itemCount: 2 },
      "accept"
    ],
    ["Shift+Enter does nothing", key("Enter", { shiftKey: true }), {}, null],
    ["Tab completes", key("Tab"), {}, "complete"],
    ["Shift+Tab is left alone", key("Tab", { shiftKey: true }), {}, null],
    [
      "Up recalls history with nothing highlighted",
      key("ArrowUp"),
      { itemCount: 2 },
      "history-previous"
    ],
    ["Up moves a highlight", key("ArrowUp"), { highlight: 1, itemCount: 3 }, "highlight-previous"],
    [
      "Up keeps walking history once recalled",
      key("ArrowUp"),
      { highlight: 0, itemCount: 3, browsingHistory: true },
      "history-previous"
    ],
    [
      "Down enters the suggestion list",
      key("ArrowDown"),
      { itemCount: 2 },
      "highlight-next"
    ],
    [
      "Down walks history forward while browsing",
      key("ArrowDown"),
      { itemCount: 2, browsingHistory: true },
      "history-next"
    ],
    ["Down with no suggestions does nothing", key("ArrowDown"), {}, null],
    [
      "Right accepts the inline completion",
      key("ArrowRight"),
      { itemCount: 1, inlineCompletion: true },
      "complete"
    ],
    ["Right without an inline completion moves the caret", key("ArrowRight"), { itemCount: 1 }, null],
    [
      "Shift+Right keeps extending the selection",
      key("ArrowRight", { shiftKey: true }),
      { itemCount: 1, inlineCompletion: true },
      null
    ],
    ["a modified key is left alone", key("Enter", { ctrlKey: true }), {}, null],
    ["a composing key is left alone", key("Enter", { isComposing: true }), {}, null],
    ["a printable key is left alone", key("a"), {}, null]
  ];

  for (const [name, input, overrides, expected] of cases) {
    test(name, () => {
      assert.equal(resolveKey(input, state(overrides)), expected);
    });
  }
});
