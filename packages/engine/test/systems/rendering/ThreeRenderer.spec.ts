// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ThreeRenderer } from "../../../src/systems/rendering/ThreeRenderer.ts";
import { createRendererSpy } from "./helpers.ts";

describe("Systems.Rendering.ThreeRenderer", () => {
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
