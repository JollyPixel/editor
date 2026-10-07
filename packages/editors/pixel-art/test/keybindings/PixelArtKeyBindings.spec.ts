// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import { PixelArtKeyBindings } from "../../src/keybindings/PixelArtKeyBindings.ts";

describe("PixelArtKeyBindings.parse", () => {
  test("drops a corrupt entry with its reason and keeps the others", () => {
    const { keyBindings, dropped } = PixelArtKeyBindings.parse(JSON.stringify({
      undo: ["Mod+u"],
      redo: 42,
      jump: "j",
      copy: "Mod+u"
    }));

    assert.deepEqual(keyBindings.overrides, { undo: ["Mod+u"] });
    assert.equal(dropped.length, 3);
    assert.match(dropped[0], /"redo": not a string or a list of strings/);
    assert.match(dropped[1], /"jump": unknown action/);
    assert.match(dropped[2], /"copy": Key chord "Mod\+u" is bound to both/);
  });

  test("drops a chord that is not in the canonical form", () => {
    const { keyBindings, dropped } = PixelArtKeyBindings.parse(JSON.stringify({
      undo: "mod+u",
      delete: "Backspace"
    }));

    assert.equal(dropped.length, 1);
    assert.match(dropped[0], /"undo": Invalid key chord: "mod\+u"/);
    assert.deepEqual(keyBindings.overrides, { delete: ["Backspace"] });
  });

  test("drops every entry of a value that is not a JSON object", () => {
    const { keyBindings, dropped } = PixelArtKeyBindings.parse("{not json");

    assert.deepEqual(keyBindings.overrides, {});
    assert.deepEqual(dropped, ["Dropped the stored keybindings: not a JSON object"]);
  });
});
