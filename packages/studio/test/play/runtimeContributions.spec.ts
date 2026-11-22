// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  contributedRuntimePackages
} from "../../src/play/runtimeContributions.ts";

describe("contributedRuntimePackages", () => {
  test("names the package that declares the field without the export", () => {
    assert.throws(
      () => contributedRuntimePackages([
        {
          name: "@jolly-pixel/editor.model",
          module: {}
        }
      ]),
      {
        name: "TypeError",
        message: "\"@jolly-pixel/editor.model\" declares \"jollypixel.runtime\" " +
          "but does not export \"RUNTIME_COMPONENTS\"."
      }
    );
  });
});
