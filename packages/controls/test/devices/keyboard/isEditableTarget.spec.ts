// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { isEditableTarget } from "../../../src/index.ts";
import { createElement } from "./Keyboard.fixture.ts";

describe("Controls.isEditableTarget", () => {
  test("matches an input anywhere in the composed path", () => {
    assert.equal(
      isEditableTarget({
        target: createElement("jolly-pane"),
        composedPath: () => [
          createElement("span"),
          createElement("input")
        ]
      }),
      true
    );
  });

  test("prefers the composed path over target, which shadow DOM retargets to the host", () => {
    assert.equal(
      isEditableTarget({
        target: createElement("input"),
        composedPath: () => [
          createElement("div")
        ]
      }),
      false
    );
  });

  test("matches a contenteditable element", () => {
    assert.equal(
      isEditableTarget({
        composedPath: () => [{ isContentEditable: true }]
      }),
      true
    );
  });

  test("falls back to target when composedPath is absent, as on synthetic events", () => {
    assert.equal(
      isEditableTarget({ target: createElement("textarea") }),
      true
    );
    assert.equal(
      isEditableTarget({ target: createElement("div") }),
      false
    );
  });

  test("tolerates a missing or non object target", () => {
    assert.equal(
      isEditableTarget({}),
      false
    );
    assert.equal(
      isEditableTarget({ target: null }),
      false
    );
    assert.equal(
      isEditableTarget({ target: "input" }),
      false
    );
  });
});
