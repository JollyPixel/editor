import {
  expect,
  test
} from "tstyche";
import type {
  AssetDependency,
  AssetLease,
  EditorSession,
  EditorSessionEvents
} from "#src/index.ts";

test("session dependencies expose borrowed views", () => {
  expect<ReturnType<EditorSession["dependency"]>>()
    .type.toBe<AssetDependency | undefined>();
  expect<ReturnType<EditorSession["dependencies"]>>()
    .type.toBe<IterableIterator<AssetDependency>>();
  expect<Parameters<EditorSessionEvents["dependency-added"]>[0]>()
    .type.toBe<AssetDependency>();
  expect<Extract<keyof AssetDependency, "release">>().type.toBe<never>();
  expect<Extract<keyof AssetLease<unknown>, "release">>()
    .type.toBe<"release">();
});
