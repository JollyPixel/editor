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

  test("should report a lost device after the three.js handler", () => {
    const calls: string[] = [];
    const source = {
      ...createRendererSpy(),
      onDeviceLost: (_info: unknown) => calls.push("three")
    };
    const renderer = new ThreeRenderer(source as any);
    renderer.on("deviceLost", (info) => {
      calls.push("engine");
      assert.deepStrictEqual(info, {
        api: "WebGPU",
        message: "GPU reset",
        reason: "unknown"
      });
    });

    source.onDeviceLost({
      api: "WebGPU",
      message: "GPU reset",
      reason: "unknown",
      originalEvent: null
    });

    assert.deepStrictEqual(calls, ["three", "engine"]);
  });

  describe("pipeline compiles", () => {
    function compilingRenderer() {
      const compiles: PromiseWithResolvers<void>[] = [];
      const backend = {
        createRenderPipeline(
          _renderObject: unknown,
          promises: Promise<void>[] | null
        ) {
          if (promises !== null) {
            const compile = Promise.withResolvers<void>();
            compiles.push(compile);
            promises.push(compile.promise);
          }
        }
      };
      const renderer = new ThreeRenderer({
        ...createRendererSpy(),
        backend
      } as any);
      let emitted = 0;
      renderer.on("compiled", () => emitted++);

      return {
        renderer,
        compiles,
        emitted: () => emitted,
        createPipeline: () => backend.createRenderPipeline({}, null)
      };
    }

    test("should compile asynchronously a pipeline three.js would create synchronously", () => {
      const { renderer, compiles, createPipeline } = compilingRenderer();

      createPipeline();

      assert.strictEqual(compiles.length, 1);
      assert.strictEqual(renderer.pendingCompiles, 1);
    });

    test("should settle once every pending pipeline has compiled", async() => {
      const { renderer, compiles, emitted, createPipeline } = compilingRenderer();
      createPipeline();
      createPipeline();
      let settled = false;
      void renderer.compiled().then(() => {
        settled = true;
      });

      compiles[0].resolve();
      await Promise.resolve();
      await Promise.resolve();
      assert.strictEqual(settled, false);
      assert.strictEqual(emitted(), 0);

      compiles[1].reject(new Error("invalid shader"));
      await renderer.compiled();
      assert.strictEqual(settled, true);
      assert.strictEqual(emitted(), 1);
      assert.strictEqual(renderer.pendingCompiles, 0);
    });
  });
});
