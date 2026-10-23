// Import Third-party Dependencies
import {
  expect,
  test
} from "tstyche";
import type { Runtime } from "@jolly-pixel/runtime";

// Import Internal Dependencies
import type {
  EditorHandle,
  EditorSession
} from "#src/index.ts";

test("an editor handle exposes readiness, its session and its runtime", () => {
  expect<EditorHandle["ready"]>().type.toBe<Promise<void>>();
  expect<EditorHandle["session"]>().type.toBe<EditorSession>();
  expect<EditorHandle["runtime"]>().type.toBe<Runtime | null>();
  expect<Window["jollyEditor"]>().type.toBe<EditorHandle | undefined>();
});
