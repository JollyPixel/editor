// Import Node.js Dependencies
import {
  describe,
  test,
  type TestContext
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ThreeRenderer } from "../../../src/systems/rendering/ThreeRenderer.ts";
import { createRendererSpy } from "./helpers.ts";

type ResizeCallback = (entries: { contentRect: DOMRectReadOnly; }[]) => void;

describe("Systems.Rendering.ThreeRenderer", () => {
  function observedRenderer(
    t: TestContext
  ) {
    let observed: ResizeCallback | null = null;
    const previous = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      constructor(
        callback: ResizeCallback
      ) {
        observed = callback;
      }

      observe() {
        // no-op
      }
    } as any;
    t.after(() => {
      globalThis.ResizeObserver = previous;
    });

    const spy = createRendererSpy();
    const renderer = new ThreeRenderer({
      ...spy,
      domElement: { parentElement: {} }
    } as any);
    renderer.observeResize();
    const resized: { width: number; height: number; }[] = [];
    renderer.on("resize", (size) => resized.push(size));

    return {
      spy,
      resized,
      resizeTo(width: number, height: number) {
        observed?.([
          { contentRect: { width, height } as DOMRectReadOnly }
        ]);
        renderer.resize();
      }
    };
  }

  test("should keep its buffers while the canvas is hidden then shown again", (t) => {
    const { spy, resized, resizeTo } = observedRenderer(t);

    resizeTo(800, 600);
    resizeTo(0, 0);
    resizeTo(800, 600);
    resizeTo(800, 600);

    assert.deepStrictEqual(
      spy.setSize.mock.calls.map((call) => call.arguments),
      [[800, 600, false]]
    );
    assert.deepStrictEqual(resized, [{ width: 800, height: 600 }]);
  });

  test("should resize once the shown canvas has a new size", (t) => {
    const { spy, resizeTo } = observedRenderer(t);

    resizeTo(800, 600);
    resizeTo(0, 0);
    resizeTo(1024, 768);

    assert.deepStrictEqual(
      spy.setSize.mock.calls.map((call) => call.arguments),
      [[800, 600, false], [1024, 768, false]]
    );
  });
});
