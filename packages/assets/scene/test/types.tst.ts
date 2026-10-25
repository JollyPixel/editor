// Import Third-party Dependencies
import {
  describe,
  expect,
  test
} from "tstyche";
import type { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import type {
  SceneCommand,
  SceneFile
} from "../src/index.ts";

describe("SceneFile", () => {
  test("is a file the engine reads", () => {
    expect<SceneFile>().type.toBeAssignableTo<Systems.SceneFile>();
  });

  test("holds every file the engine describes", () => {
    expect<Systems.SceneFile>().type.toBeAssignableTo<SceneFile>();
  });

  test("leaves component data free of a schema", () => {
    expect<Systems.SceneComponentFile>().type.toBeAssignableTo<
      Extract<SceneCommand, { action: "component-added"; }>["component"]
    >();
  });
});
