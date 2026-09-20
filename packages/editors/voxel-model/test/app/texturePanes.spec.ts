// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  visibleTexturePane,
  type TexturePane
} from "../../src/app/texturePanes.ts";

function shown(
  ...panes: TexturePane[]
): (pane: TexturePane) => boolean {
  return (pane) => panes.includes(pane);
}

describe("visibleTexturePane", () => {
  test("keeps the current pane while it is shown", () => {
    assert.equal(visibleTexturePane(shown("build"), "build"), "build");
  });

  test("follows the tab that replaced the current pane", () => {
    assert.equal(visibleTexturePane(shown("paint"), "build"), "paint");
    assert.equal(visibleTexturePane(shown("build"), "paint"), "build");
  });

  test("stays put while the dock hides every texture pane", () => {
    assert.equal(visibleTexturePane(shown(), "paint"), "paint");
  });
});
