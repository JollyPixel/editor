// Import Third-party Dependencies
import {
  expect,
  test
} from "tstyche";
import type { Systems } from "@jolly-pixel/engine";

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

test("performance stats accept a readout panel", () => {
  expect<{
    panel: true;
  }>().type.toBeAssignableTo<
    RuntimePackage.RuntimeOptions<TestContext>["includePerformanceStats"]
  >();
  expect<{
    panel: {
      target: HTMLElement;
      toggleKey: string;
    };
  }>().type.toBeAssignableTo<
    RuntimePackage.RuntimeOptions<TestContext>["includePerformanceStats"]
  >();
  expect<"MetricsPanel">().type.not.toBeAssignableTo<
    keyof typeof RuntimePackage
  >();
});

test("every metric goes through runtime.metrics", () => {
  expect(runtime.metrics).type.toBe<RuntimePackage.RuntimeMetrics>();
  expect(runtime.metrics.addSource).type.toBeCallableWith({
    metrics: [
      {
        id: "chunks",
        label: "chunks",
        unit: "count",
        sample: () => 1
      }
    ]
  });
  expect(
    runtime.metrics.addSource({ metrics: [] })
  ).type.toBe<() => void>();
  expect(runtime.metrics.addSource).type.not.toBeCallableWith({
    metrics: [{ label: "chunks" }]
  });
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

test("the runtime exposes its concrete renderer", () => {
  expect(runtime.renderer).type.toBe<Systems.ThreeRenderer>();
  expect(runtime.renderer.renderStrategy).type.toBe<Systems.RenderStrategy>();
});

test("Runtime options forward the renderer options", () => {
  expect<{
    webgpu: { antialias: false; };
    output: { pixelRatio: number; };
  }>().type.toBeAssignableTo<
    RuntimePackage.RuntimeOptions<TestContext>["renderer"]
  >();
  expect<{
    output: { pixelRatio: string; };
  }>().type.not.toBeAssignableTo<
    RuntimePackage.RuntimeOptions<TestContext>["renderer"]
  >();
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
