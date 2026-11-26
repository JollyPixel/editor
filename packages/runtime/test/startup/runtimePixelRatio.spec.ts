// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  isMobileDevice,
  runtimePixelRatio
} from "../../src/startup/runtimePixelRatio.ts";
import { stubProperty } from "../helpers/stubProperty.ts";

describe("runtimePixelRatio", () => {
  for (const [display, expected] of [
    [1.25, 1.25],
    [2, 2],
    [3, 2]
  ]) {
    describe(`on a ${display}x desktop display`, () => {
      stubProperty(window, "devicePixelRatio", display);

      test(`renders at ${expected}x`, () => {
        assert.strictEqual(runtimePixelRatio(), expected);
      });
    });
  }
});

describe("isMobileDevice", () => {
  const desktop = {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0",
    platform: "Win32",
    maxTouchPoints: 0
  };

  test("treats a desktop browser as not mobile", () => {
    assert.strictEqual(isMobileDevice(desktop), false);
  });

  test("detects Android and iOS user agents", () => {
    for (const userAgent of [
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)"
    ]) {
      assert.strictEqual(isMobileDevice({
        ...desktop,
        userAgent
      }), true, userAgent);
    }
  });

  test("detects an iPad reporting a desktop Mac", () => {
    assert.strictEqual(isMobileDevice({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      platform: "MacIntel",
      maxTouchPoints: 5
    }), true);
    assert.strictEqual(isMobileDevice({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      platform: "MacIntel",
      maxTouchPoints: 0
    }), false);
  });
});
