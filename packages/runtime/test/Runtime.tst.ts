// Import Third-party Dependencies
import {
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import * as RuntimePackage from "../src/index.ts";

interface TestContext {
  difficulty: "normal" | "hard";
}

declare const runtime: RuntimePackage.Runtime<TestContext>;
declare const options: RuntimePackage.RuntimeLoadOptions<TestContext>;

test("Runtime.load keeps the runtime context and returns its completion promise", () => {
  expect(runtime.load).type.toBeCallableWith(options);
  expect(runtime.load(options)).type.toBe<Promise<void>>();
});

test("internal runtime helpers are absent from the package API", () => {
  expect<"loadRuntime">().type.not.toBeAssignableTo<
    keyof typeof RuntimePackage
  >();
  expect<"resolveRuntimeCanvas">().type.not.toBeAssignableTo<
    keyof typeof RuntimePackage
  >();
});

test("Runtime options accept both focus hint forms", () => {
  expect<boolean>().type.toBeAssignableTo<
    RuntimePackage.RuntimeOptions<TestContext>["focusHint"]
  >();
  expect<{
    position: RuntimePackage.FocusHintPosition;
    inset: number;
    text: string;
  }>().type.toBeAssignableTo<
    RuntimePackage.RuntimeOptions<TestContext>["focusHint"]
  >();
  expect<"top-center">().type.toBeAssignableTo<
    RuntimePackage.FocusHintPosition
  >();
  expect<"top">().type.not.toBeAssignableTo<
    RuntimePackage.FocusHintPosition
  >();
});
