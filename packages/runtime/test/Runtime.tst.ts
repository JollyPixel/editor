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
  expect<"resolveOverlayAnchor">().type.not.toBeAssignableTo<
    keyof typeof RuntimePackage
  >();
  expect<"mountFocusHint">().type.not.toBeAssignableTo<
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

test("Runtime options accept an overlay container", () => {
  expect<{
    container: HTMLElement;
  }>().type.toBeAssignableTo<
    RuntimePackage.RuntimeOptions<TestContext>["overlay"]
  >();
  expect<{
    container: string;
  }>().type.toBeAssignableTo<
    RuntimePackage.RuntimeOptions<TestContext>["overlay"]
  >();
  expect<{
    container: number;
  }>().type.not.toBeAssignableTo<
    RuntimePackage.RuntimeOptions<TestContext>["overlay"]
  >();
});

test("performance stats accept every overlay position and an inset", () => {
  expect<{
    position: "bottom-center";
    inset: number;
  }>().type.toBeAssignableTo<
    RuntimePackage.RuntimeOptions<TestContext>["includePerformanceStats"]
  >();
  expect<RuntimePackage.PerformanceStatsPosition>().type.toBe<
    RuntimePackage.OverlayPosition
  >();
  expect<RuntimePackage.FocusHintPosition>().type.toBe<
    RuntimePackage.OverlayPosition
  >();
});

test("runtime.overlay mounts content and returns a disposer", () => {
  expect(runtime.overlay).type.toBe<RuntimePackage.OverlayLayer>();
  expect(runtime.overlay.mount).type.toBeCallableWith(
    document.createElement("div"),
    {
      position: "center",
      inset: 4,
      interactive: true
    }
  );
  expect(
    runtime.overlay.mount(document.createElement("div"))
  ).type.toBe<RuntimePackage.MountedOverlay>();
});

test("Runtime options accept both view helper forms", () => {
  expect<boolean>().type.toBeAssignableTo<
    RuntimePackage.RuntimeOptions<TestContext>["viewHelper"]
  >();
  expect<{
    position: RuntimePackage.ViewHelperPosition;
    inset: number;
  }>().type.toBeAssignableTo<
    RuntimePackage.RuntimeOptions<TestContext>["viewHelper"]
  >();
  expect<"bottom-right">().type.toBeAssignableTo<
    RuntimePackage.ViewHelperPosition
  >();
  expect<"top-center">().type.not.toBeAssignableTo<
    RuntimePackage.ViewHelperPosition
  >();
  expect<"mountViewHelper">().type.not.toBeAssignableTo<
    keyof typeof RuntimePackage
  >();
});
