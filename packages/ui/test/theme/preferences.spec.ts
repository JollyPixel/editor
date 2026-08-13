// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  applyAppearance,
  resolveDensityPreference,
  resolveThemePreference
} from "../../src/theme/preferences.ts";

describe("theme preferences", () => {
  test("falls back from invalid stored values", () => {
    assert.equal(resolveThemePreference("violet", "auto"), "auto");
    assert.equal(resolveDensityPreference("dense", "default"), "default");
  });

  test("keeps valid stored values", () => {
    assert.equal(resolveThemePreference("dark", "auto"), "dark");
    assert.equal(resolveDensityPreference("comfortable", "default"), "comfortable");
  });

  test("applies auto by removing an explicit theme", () => {
    const target = document.createElement("div");
    target.setAttribute("theme", "dark");

    applyAppearance(target, "auto", "compact");

    assert.equal(target.hasAttribute("theme"), false);
    assert.equal(target.getAttribute("density"), "compact");
  });
});
