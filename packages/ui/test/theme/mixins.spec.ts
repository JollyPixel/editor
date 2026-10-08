// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  fillTransition,
  focusRing,
  truncate,
  visuallyHidden
} from "../../src/theme/styles/mixins.ts";

describe("style mixins", () => {
  test("each one is a declaration list, not a rule", () => {
    for (const mixin of [truncate, focusRing, fillTransition, visuallyHidden]) {
      assert.ok(
        !mixin.cssText.includes("{"),
        `${mixin.cssText} must carry no selector of its own`
      );
      assert.match(mixin.cssText.trim(), /;$/);
    }
  });

  test("visuallyHidden stays in the accessibility tree", () => {
    assert.ok(!visuallyHidden.cssText.includes("display: none"));
    assert.match(visuallyHidden.cssText, /clip-path:\s*inset\(50%\)/);
  });
});
