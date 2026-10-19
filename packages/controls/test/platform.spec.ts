// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { isApplePlatform } from "../src/platform.ts";
import { mockPlatform } from "./helpers/platform.ts";

describe("Controls.platform", () => {
  for (const platform of ["MacIntel", "iPhone", "iPad"]) {
    test(`isApplePlatform() is true on ${platform}`, (t) => {
      mockPlatform(t, platform);

      assert.strictEqual(isApplePlatform(), true);
    });
  }

  for (const platform of ["Win32", "Linux x86_64"]) {
    test(`isApplePlatform() is false on ${platform}`, (t) => {
      mockPlatform(t, platform);

      assert.strictEqual(isApplePlatform(), false);
    });
  }
});
