// Import Node.js Dependencies
import { describe, test } from "node:test";
import path from "node:path";

// Import Third-party Dependencies
import { assertDeclaresSceneComponents } from "@jolly-pixel/editor.host/testing";

// Import Internal Dependencies
import { BUILT_IN_COMPONENTS } from "../../src/components/builtInComponents.ts";

// CONSTANTS
const kPackageDir = path.join(import.meta.dirname, "..", "..");

describe("BUILT_IN_COMPONENTS", () => {
  test("matches the scene components the package declares", () => {
    assertDeclaresSceneComponents(kPackageDir, BUILT_IN_COMPONENTS);
  });
});
