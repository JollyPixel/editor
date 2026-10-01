// Import Node.js Dependencies
import {
  describe,
  test,
  afterEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { loadKeyboardLayout } from "../../../src/index.ts";

// CONSTANTS
const kNavigatorDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "navigator"
);

function stubNavigator(
  value: unknown
): void {
  Object.defineProperty(globalThis, "navigator", {
    value,
    configurable: true
  });
}

describe("Controls.loadKeyboardLayout", () => {
  afterEach(() => {
    if (kNavigatorDescriptor === undefined) {
      Reflect.deleteProperty(globalThis, "navigator");
    }
    else {
      Object.defineProperty(globalThis, "navigator", kNavigatorDescriptor);
    }
  });

  test("returns a copy of the navigator layout map", async() => {
    const source = new Map([["KeyQ", "a"]]);
    stubNavigator({
      keyboard: {
        getLayoutMap: async() => source
      }
    });

    const layout = await loadKeyboardLayout();

    assert.deepEqual(layout, source);
    assert.notEqual(layout, source);
  });

  test("returns null without the Keyboard Map API", async() => {
    stubNavigator({});

    assert.equal(await loadKeyboardLayout(), null);
  });

  test("returns null when the browser refuses the layout map", async() => {
    stubNavigator({
      keyboard: {
        getLayoutMap: async() => {
          throw new DOMException("blocked", "SecurityError");
        }
      }
    });

    assert.equal(await loadKeyboardLayout(), null);
  });
});
