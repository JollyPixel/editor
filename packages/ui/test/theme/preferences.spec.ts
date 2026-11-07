// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { applyAppearance } from "../../src/theme/preferences.ts";

describe("theme preferences", () => {
  test("applies auto by removing an explicit theme", () => {
    const target = document.createElement("div");
    target.setAttribute("theme", "dark");

    applyAppearance(target, "auto", "compact");

    assert.equal(target.hasAttribute("theme"), false);
    assert.equal(target.getAttribute("density"), "compact");
  });
});
