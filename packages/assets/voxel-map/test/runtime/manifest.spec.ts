// Import Node.js Dependencies
import { describe, test } from "node:test";
import path from "node:path";

// Import Third-party Dependencies
import { assertDeclaresSceneComponents } from "@jolly-pixel/asset.common/testing";

// Import Internal Dependencies
import { RUNTIME_COMPONENTS } from "#src/runtime/index.ts";

// CONSTANTS
const kPackageDir = path.join(import.meta.dirname, "..", "..");

describe("RUNTIME_COMPONENTS", () => {
  test("matches the scene components the package declares", () => {
    assertDeclaresSceneComponents(kPackageDir, RUNTIME_COMPONENTS);
  });
});
