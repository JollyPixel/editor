// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  readFileSync,
  readdirSync
} from "node:fs";
import { resolve } from "node:path";
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

// CONSTANTS
const kSourceRoot = resolve(import.meta.dirname, "../../src");

function styleSources(): Array<{ path: string; source: string; }> {
  return readdirSync(kSourceRoot, {
    recursive: true,
    withFileTypes: true
  })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".styles.ts"))
    .map((entry) => {
      const path = resolve(entry.parentPath, entry.name);

      return {
        path,
        source: readFileSync(path, "utf8")
      };
    });
}

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

  test("focusRing keeps a fallback for the unscoped case", () => {
    assert.match(
      focusRing.cssText,
      /outline:\s*2px solid var\(--jolly-focus-ring,\s*#[0-9a-f]{6}\)/
    );
  });

  test("fillTransition drives background-color alone", () => {
    assert.match(fillTransition.cssText, /^\s*transition:\s*background-color\b/);
  });

  test("visuallyHidden stays in the accessibility tree", () => {
    assert.ok(!visuallyHidden.cssText.includes("display: none"));
    assert.match(visuallyHidden.cssText, /clip-path:\s*inset\(50%\)/);
  });
});

describe("style mixin adoption", () => {
  test("no component re-declares the truncation trio inline", () => {
    for (const { path, source } of styleSources()) {
      assert.ok(
        !source.includes("text-overflow: ellipsis"),
        `${path} should interpolate truncate instead`
      );
    }
  });

  test("no component re-declares the focus ring inline", () => {
    for (const { path, source } of styleSources()) {
      assert.ok(
        !source.includes("outline: 2px solid var(--jolly-focus-ring"),
        `${path} should interpolate focusRing instead`
      );
    }
  });

  test("no component re-declares the fill transition inline", () => {
    for (const { path, source } of styleSources()) {
      assert.ok(
        !source.includes("transition: background-color var(--jolly-duration-fast"),
        `${path} should interpolate fillTransition instead`
      );
    }
  });

  test("no component re-declares the visually-hidden clip inline", () => {
    for (const { path, source } of styleSources()) {
      assert.ok(
        !source.includes("clip-path: inset(50%)"),
        `${path} should interpolate visuallyHidden instead`
      );
    }
  });
});
