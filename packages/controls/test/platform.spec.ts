// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  detectApplePlatform,
  isApplePlatform
} from "../src/platform.ts";

describe("Controls.platform", () => {
  test("detectApplePlatform() matches Apple platform strings", () => {
    assert.strictEqual(detectApplePlatform("MacIntel"), true);
    assert.strictEqual(detectApplePlatform("iPhone"), true);
    assert.strictEqual(detectApplePlatform("iPad"), true);
  });

  test("detectApplePlatform() rejects other or missing platforms", () => {
    assert.strictEqual(detectApplePlatform("Win32"), false);
    assert.strictEqual(detectApplePlatform("Linux x86_64"), false);
    assert.strictEqual(detectApplePlatform(undefined), false);
  });

  test("isApplePlatform() reflects the current navigator", () => {
    const platform = typeof navigator === "undefined" ?
      undefined :
      navigator.platform;

    assert.strictEqual(isApplePlatform(), detectApplePlatform(platform));
  });
});
