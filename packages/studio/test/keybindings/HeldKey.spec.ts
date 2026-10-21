// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { HeldKey } from "../../src/keybindings/HeldKey.ts";

describe("HeldKey", () => {
  test("captures the key position, whatever the layout prints", () => {
    assert.deepEqual(HeldKey.capture({ code: "KeyW" })?.codes, ["KeyW"]);
  });

  test("binds both sides of a modifier pressed alone", () => {
    assert.deepEqual(
      HeldKey.capture({ code: "ControlRight" })?.codes,
      ["ControlLeft", "ControlRight"]
    );
  });

  test("ignores a key the keyboard does not name", () => {
    assert.equal(HeldKey.capture({ code: "Unidentified" }), null);
  });
});
