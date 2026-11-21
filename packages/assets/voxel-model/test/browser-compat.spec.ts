// Import Node.js Dependencies
import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import {
  browserBundleInputs,
  KIND_HANDLER_INPUT
} from "@jolly-pixel/asset.common/testing";

// CONSTANTS
const kEntryPoint = path.join(
  import.meta.dirname,
  "..",
  "src",
  "network",
  "client.ts"
);

describe("Voxel-model client browser compatibility", () => {
  it("bundles the client entry without kind handler code", async() => {
    assert.deepEqual(
      await browserBundleInputs(kEntryPoint, KIND_HANDLER_INPUT),
      []
    );
  });
});
