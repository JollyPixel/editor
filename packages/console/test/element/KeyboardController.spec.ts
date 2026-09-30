// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  KeyboardController,
  type ConsoleKeyAction,
  type KeyInput,
  type KeyState
} from "#src/element/KeyboardController.ts";
import { createControllerHost } from "../helpers/controllerHost.ts";

interface KeyEvent extends KeyInput {
  prevented: boolean;
}

interface Keyboard {
  controller: KeyboardController;
  acted: ConsoleKeyAction[];
  toggles: number;
}

function key(
  name: string,
  modifiers: Partial<KeyInput> = {}
): KeyEvent {
  const event: KeyEvent = {
    key: name,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    prevented: false,
    preventDefault: () => {
      event.prevented = true;
    },
    ...modifiers
  };

  return event;
}

function keyboard(
  overrides: Partial<KeyState> = {},
  hasConsole = true
): Keyboard {
  const result: Keyboard = {
    controller: new KeyboardController(createControllerHost(), {
      state: () => {
        return {
          highlight: -1,
          itemCount: 0,
          browsingHistory: false,
          inlineCompletion: false,
          hasText: false,
          hasHistory: false,
          highlightRuns: false,
          ...overrides
        };
      },
      act: (action) => result.acted.push(action),
      toggle: () => {
        result.toggles++;

        return hasConsole;
      }
    }),
    acted: [],
    toggles: 0
  };

  return result;
}

describe("the toggle shortcut", () => {
  test("Ctrl+K and Cmd+K toggle and claim the key", () => {
    for (const event of [key("k", { ctrlKey: true }), key("k", { metaKey: true })]) {
      const recorded = keyboard();
      recorded.controller.onWindowKeyDown(event);

      assert.equal(recorded.toggles, 1);
      assert.equal(event.prevented, true);
    }
  });

  test("other chords are left alone", () => {
    const recorded = keyboard();
    for (const event of [
      key("k"),
      key("K", { ctrlKey: true, shiftKey: true }),
      key("k", { ctrlKey: true, altKey: true }),
      key("j", { ctrlKey: true })
    ]) {
      recorded.controller.onWindowKeyDown(event);
      assert.equal(event.prevented, false);
    }

    assert.equal(recorded.toggles, 0);
  });

  test("the key is not claimed while no console is bound", () => {
    const event = key("k", { ctrlKey: true });
    keyboard({}, false).controller.onWindowKeyDown(event);

    assert.equal(event.prevented, false);
  });
});

describe("prompt keys", () => {
  const cases: [string, KeyEvent, Partial<KeyState>, ConsoleKeyAction | null][] = [
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
      const { controller, acted } = keyboard(overrides);
      controller.onKeyDown(input);

      assert.deepEqual(acted, expected === null ? [] : [expected]);
      assert.equal(input.prevented, expected !== null);
    });
  }
});

describe("hints", () => {
  function hints(
    overrides: Partial<KeyState>
  ): string {
    return keyboard(overrides).controller.hints
      .map(({ keys, action }) => `${keys} ${action}`)
      .join(", ");
  }

  const cases: [string, Partial<KeyState>, string][] = [
    ["an empty console only closes", {}, "Esc close"],
    ["an empty prompt with history walks it", { hasHistory: true }, "↑↓ history, Esc close"],
    [
      "the browse panel navigates without completing",
      { itemCount: 5, hasHistory: true },
      "↑↓ navigate, Esc close"
    ],
    [
      "typed text with suggestions runs and completes",
      { itemCount: 2, hasText: true },
      "↑↓ navigate, ↵ run, Tab complete, Esc close"
    ],
    [
      "a highlighted namespace inserts",
      { itemCount: 2, highlight: 0 },
      "↑↓ navigate, ↵ insert, Esc close"
    ],
    [
      "a highlighted toggle runs",
      { itemCount: 2, highlight: 1, highlightRuns: true },
      "↑↓ navigate, ↵ run, Esc close"
    ],
    [
      "a gray suffix completes",
      { hasText: true, inlineCompletion: true },
      "↵ run, Tab complete, Esc close"
    ]
  ];

  for (const [name, overrides, expected] of cases) {
    test(name, () => {
      assert.equal(hints(overrides), expected);
    });
  }
});
