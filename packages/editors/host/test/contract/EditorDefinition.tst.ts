// Import Third-party Dependencies
import {
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import type {
  EditorHandle,
  EditorRuntime,
  HostLogger,
  PageEditorDefinition,
  RuntimeEditorContext,
  RuntimeEditorDefinition
} from "#src/index.ts";

test("a runtime editor mounts with the runtime its factory created", () => {
  expect<RuntimeEditorContext["runtime"]>().type.toBe<EditorRuntime>();
  expect<
    Parameters<RuntimeEditorDefinition<EditorHandle>["createRuntime"]>
  >().type.toBe<[logger: HostLogger]>();
});

test("a page editor declares no runtime factory", () => {
  expect<
    PageEditorDefinition<EditorHandle>["createRuntime"]
  >().type.toBe<undefined>();
});
