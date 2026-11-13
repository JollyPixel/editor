// Import Node.js Dependencies
import { describe, test } from "node:test";
import path from "node:path";

// Import Third-party Dependencies
import { assertDeclaresSceneComponents } from "@jolly-pixel/editor.host/testing";

// Import Internal Dependencies
import { SCENE_COMPONENTS } from "../../src/sceneComponents/index.ts";

// CONSTANTS
const kPackageDir = path.join(import.meta.dirname, "..", "..");

describe("SCENE_COMPONENTS", () => {
  test("matches the scene components the package declares", () => {
    assertDeclaresSceneComponents(kPackageDir, SCENE_COMPONENTS);
  });
});
