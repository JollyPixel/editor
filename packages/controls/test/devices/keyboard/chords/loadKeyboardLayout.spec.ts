// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { loadKeyboardLayout } from "../../../../src/index.ts";
import { stubNavigator } from "../../../helpers/navigator.ts";

describe("Controls.loadKeyboardLayout", () => {
  test("returns a copy of the navigator layout map", async(t) => {
    const source = new Map([["KeyQ", "a"]]);
    stubNavigator(t, {
      keyboard: {
        getLayoutMap: async() => source
      }
    });

    const layout = await loadKeyboardLayout();

    assert.deepEqual(layout, source);
    assert.notEqual(layout, source);
  });

  test("returns null without the Keyboard Map API", async(t) => {
    stubNavigator(t, {});

    assert.equal(await loadKeyboardLayout(), null);
  });

  test("returns null when the browser refuses the layout map", async(t) => {
    stubNavigator(t, {
      keyboard: {
        getLayoutMap: async() => {
          throw new DOMException("blocked", "SecurityError");
        }
      }
    });

    assert.equal(await loadKeyboardLayout(), null);
  });
});
