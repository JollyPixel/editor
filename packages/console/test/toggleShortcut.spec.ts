// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  isToggleShortcut,
  type ShortcutInput
} from "#src/toggleShortcut.ts";

function chord(
  key: string,
  modifiers: Partial<ShortcutInput> = {}
): ShortcutInput {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...modifiers
  };
}

describe("isToggleShortcut", () => {
  test("matches Ctrl+K and Cmd+K only", () => {
    assert.equal(isToggleShortcut(chord("k", { ctrlKey: true })), true);
    assert.equal(isToggleShortcut(chord("k", { metaKey: true })), true);

    for (const input of [
      chord("k"),
      chord("K", { ctrlKey: true, shiftKey: true }),
      chord("k", { ctrlKey: true, altKey: true }),
      chord("j", { ctrlKey: true })
    ]) {
      assert.equal(isToggleShortcut(input), false);
    }
  });
});
