// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  playShortcut,
  type PlayScope
} from "#src/shell/playShortcut.ts";
import { parseFrameMessage } from "#src/shell/protocol.ts";
import { shellChannel } from "../helpers/shell.ts";

describe("playShortcut", () => {
  const cases: [string, Partial<KeyboardEvent>, PlayScope | null][] = [
    ["F5", {}, "game"],
    ["Ctrl+F5", { ctrlKey: true }, "scene"],
    ["Cmd+F5", { metaKey: true }, "scene"],
    ["Shift+F5", { shiftKey: true }, null],
    ["Alt+F5", { altKey: true }, null]
  ];

  for (const [name, modifiers, scope] of cases) {
    test(`reads ${name} as ${scope ?? "no play"}`, () => {
      assert.strictEqual(playShortcut({
        key: "F5",
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        ...modifiers
      }), scope);
    });
  }

  test("ignores every other key", () => {
    assert.strictEqual(playShortcut({
      key: "F6",
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false
    }), null);
  });
});

describe("ShellChannel.play", () => {
  test("posts the scope to play as a shell command", () => {
    const posted: unknown[] = [];
    const channel = shellChannel({
      port: { postMessage: (message: unknown) => posted.push(message) }
    });

    channel.play("scene");

    assert.deepEqual(posted.map(parseFrameMessage), [
      { type: "jolly-play", scope: "scene" }
    ]);
  });
});
