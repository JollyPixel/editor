// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import {
  RuntimeSessionSettings
} from "../../src/session/RuntimeSessionSettings.ts";

describe("RuntimeSessionSettings", () => {
  test("defaults to focusing the canvas and nothing else", () => {
    const settings = new RuntimeSessionSettings();

    assert.equal(settings.focusCanvas, true);
    assert.equal(settings.focusHint, null);
    assert.equal(settings.renderOnDemand, false);
    assert.equal(settings.suspendWhenHidden, false);
  });

  test("turns a true toggle into empty options and false into null", () => {
    const shown = new RuntimeSessionSettings({ focusHint: true });
    const hidden = new RuntimeSessionSettings({ focusHint: false });

    assert.deepEqual(shown.focusHint, {});
    assert.equal(hidden.focusHint, null);
  });

  test("copies toggle options and freezes itself", () => {
    const focusHint = { text: "Click me" };
    const settings = new RuntimeSessionSettings({ focusHint });
    focusHint.text = "Changed";

    assert.deepEqual(settings.focusHint, { text: "Click me" });
    assert.equal(Object.isFrozen(settings), true);
    assert.equal(Object.isFrozen(settings.focusHint), true);
  });
});
